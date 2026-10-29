from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Iterable, Optional

from fastapi import HTTPException, status

from controllers.dashboard_regions import USER_REGION_PATHS, dashboard_region, normalize_region
from helpers.miscHelpers import get_ph_datetime

from .constants import (
    PUBLIC_SOURCES,
    REGIONS,
    TIME_RANGE_DAYS,
    mobile_users_collection,
    survey_responses_collection,
    surveys_collection,
)
from .survey_helpers import parse_ph_datetime


PH_TIMEZONE = timezone(timedelta(hours=8))
UNKNOWN_REGION = None


@dataclass(frozen=True)
class ResponseDateRange:
    start: datetime
    cutoff: datetime
    end_exclusive: Optional[datetime] = None


def _ph_naive(value: datetime) -> datetime:
    if value.tzinfo:
        return value.astimezone(PH_TIMEZONE).replace(tzinfo=None)
    return value


def _parse_date_parameter(value: Optional[str], field_name: str) -> date:
    try:
        return date.fromisoformat(str(value or "").strip())
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} must be a valid YYYY-MM-DD date",
        ) from error


def get_response_date_range(
    time_range: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    now: Optional[datetime] = None,
) -> ResponseDateRange:
    """Return inclusive Philippine calendar-day bounds, capped at request time."""
    current = _ph_naive(now or get_ph_datetime())

    if time_range == "custom":
        start_day = _parse_date_parameter(start_date, "startDate")
        end_day = _parse_date_parameter(end_date, "endDate")
        if start_day > end_day:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="startDate must be on or before endDate",
            )
        start = datetime.combine(start_day, datetime.min.time())
        return ResponseDateRange(
            start=start,
            cutoff=current,
            end_exclusive=datetime.combine(end_day + timedelta(days=1), datetime.min.time()),
        )

    days = TIME_RANGE_DAYS.get(time_range)
    if days is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="timeRange must be last-7-days, last-30-days, last-90-days, or custom",
        )
    start = current.replace(hour=0, minute=0, second=0, microsecond=0)
    return ResponseDateRange(start=start - timedelta(days=days - 1), cutoff=current)


def parse_regions(regions: Optional[str]) -> list[str]:
    if not regions:
        return []

    selected_regions = []
    invalid_regions = []
    for value in regions.split(","):
        region = normalize_region(value)
        if region:
            if region not in selected_regions:
                selected_regions.append(region)
        elif value.strip():
            invalid_regions.append(value.strip())

    if invalid_regions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown region filter: {invalid_regions[0]}",
        )
    return selected_regions


def get_event_region(event: dict) -> Optional[str]:
    return dashboard_region(event)


def published_survey_platforms(surveys: Iterable[dict], now: datetime) -> dict[str, set[str]]:
    """Publication eligibility is independent of the response reporting window."""
    eligible = {platform: set() for platform in PUBLIC_SOURCES}
    current = _ph_naive(now)
    for survey in surveys:
        survey_id = str(survey.get("id") or "")
        scheduled_at = survey.get("scheduledAt")
        if isinstance(scheduled_at, str):
            try:
                scheduled_at = parse_ph_datetime(scheduled_at)
            except HTTPException:
                scheduled_at = None
        if (
            not survey_id
            or not isinstance(scheduled_at, datetime)
            or _ph_naive(scheduled_at) > current
        ):
            continue
        if survey.get("publishToMobile") is True:
            eligible["mobile"].add(survey_id)
        if survey.get("publishToWebsite") is True:
            eligible["website"].add(survey_id)
    return eligible


def get_published_survey_platforms(now: datetime) -> dict[str, set[str]]:
    candidates = surveys_collection.find(
        {"$or": [{"publishToMobile": True}, {"publishToWebsite": True}]},
        {
            "_id": 0,
            "id": 1,
            "scheduledAt": 1,
            "publishToMobile": 1,
            "publishToWebsite": 1,
        },
    )
    return published_survey_platforms(candidates, now)


def regional_response_pipeline(
    published_platforms: dict[str, set[str]],
    date_range: ResponseDateRange,
) -> list[dict]:
    created_at_match = {
        "$type": "date",
        "$gte": date_range.start,
        "$lte": date_range.cutoff,
    }
    if date_range.end_exclusive:
        created_at_match["$lt"] = date_range.end_exclusive

    platform_matches = [
        {"platform": platform, "surveyId": {"$in": sorted(survey_ids)}}
        for platform, survey_ids in published_platforms.items()
        if survey_ids
    ]
    if not platform_matches:
        return [{"$match": {"_id": {"$exists": False}}}]

    return [
        {"$match": {"createdAt": created_at_match, "$or": platform_matches}},
        {
            "$lookup": {
                "from": mobile_users_collection.name,
                "let": {"linkedId": "$mobileUserId", "verified": "$accountLinkVerified"},
                "pipeline": [
                    {
                        "$match": {
                            "$expr": {
                                "$and": [
                                    {"$eq": ["$$verified", True]},
                                    {"$eq": ["$id", "$$linkedId"]},
                                ]
                            },
                            "source": "mobile_registration",
                            "roleId": "user",
                        }
                    },
                    {
                        "$project": {
                            "_id": 0,
                            "id": 1,
                            "region": 1,
                            "regionCode": 1,
                            "regionLabel": 1,
                            "location.regionCode": 1,
                            "location.regionName": 1,
                        }
                    },
                    {"$limit": 1},
                ],
                "as": "linkedAccounts",
            }
        },
        {
            "$project": {
                "_id": 1,
                "id": 1,
                "createdAt": 1,
                "platform": 1,
                "responseRegion": "$region",
                "mobileUserId": 1,
                "accountLinkVerified": 1,
                "account": {"$arrayElemAt": ["$linkedAccounts", 0]},
            }
        },
    ]


def _response_tie_breaker(row: dict) -> str:
    return str(row.get("id") or row.get("_id") or "")


def _linked_account(row: dict) -> Optional[dict]:
    account = row.get("account")
    if (
        row.get("accountLinkVerified") is True
        and isinstance(account, dict)
        and account.get("id") == row.get("mobileUserId")
    ):
        return account
    return None


def _response_region(row: dict) -> Optional[str]:
    return normalize_region(row.get("responseRegion"))


def _account_region(account: Optional[dict]) -> Optional[str]:
    return dashboard_region(account or {}, USER_REGION_PATHS)


def summarize_regional_response_rows(
    rows: Iterable[dict],
    selected_regions: list[str],
) -> dict:
    """Resolve one latest-response region per account before region filtering."""
    submission_counts = Counter()
    unlinked_submission_counts = Counter()
    latest_by_account = {}

    for row in rows:
        account = _linked_account(row)
        response_region = _response_region(row)
        submission_region = response_region or _account_region(account)
        submission_counts[submission_region] += 1

        if account is None:
            unlinked_submission_counts[submission_region] += 1
            continue

        account_id = str(account["id"])
        timestamp = row.get("createdAt")
        if not isinstance(timestamp, datetime):
            continue
        latest_key = (_ph_naive(timestamp), _response_tie_breaker(row))
        existing = latest_by_account.get(account_id)
        if existing is None or latest_key > existing[0]:
            latest_by_account[account_id] = (
                latest_key,
                response_region or _account_region(account),
            )

    respondent_counts = Counter(region for _, region in latest_by_account.values())
    visible_regions = selected_regions or list(REGIONS)
    include_unknown = not selected_regions
    included_region_keys = set(visible_regions)
    if include_unknown:
        included_region_keys.add(UNKNOWN_REGION)

    def count_for(counter: Counter, keys: set) -> int:
        return sum(counter[key] for key in keys)

    region_rows = [
        {
            "region": region,
            "surveyRespondents": respondent_counts[region],
            "totalSubmissions": submission_counts[region],
            "healthSentimentScore": None,
            "sentimentStatus": "Coming soon",
        }
        for region in visible_regions
    ]
    unknown_region = {
        "region": None,
        "surveyRespondents": respondent_counts[UNKNOWN_REGION],
        "totalSubmissions": submission_counts[UNKNOWN_REGION],
        "healthSentimentScore": None,
        "sentimentStatus": "Coming soon",
    }

    return {
        "regions": region_rows,
        "unknownRegion": unknown_region,
        "totals": {
            "surveyRespondents": len(latest_by_account),
            "totalSubmissions": sum(submission_counts.values()),
            "unlinkedSubmissions": sum(unlinked_submission_counts.values()),
            "unknownRegionRespondents": respondent_counts[UNKNOWN_REGION],
            "unknownRegionSubmissions": submission_counts[UNKNOWN_REGION],
        },
        "filteredTotals": {
            "surveyRespondents": count_for(respondent_counts, included_region_keys),
            "totalSubmissions": count_for(submission_counts, included_region_keys),
            "unlinkedSubmissions": count_for(unlinked_submission_counts, included_region_keys),
            "unknownRegionRespondents": respondent_counts[UNKNOWN_REGION] if include_unknown else 0,
            "unknownRegionSubmissions": submission_counts[UNKNOWN_REGION] if include_unknown else 0,
        },
    }


def fetch_regional_statistics(
    time_range: str,
    regions: Optional[str],
    start_date: Optional[str],
    end_date: Optional[str],
) -> dict:
    now = get_ph_datetime()
    date_range = get_response_date_range(
        time_range, start_date=start_date, end_date=end_date, now=now
    )
    selected_regions = parse_regions(regions)
    published_platforms = get_published_survey_platforms(now)
    rows = survey_responses_collection.aggregate(
        regional_response_pipeline(published_platforms, date_range),
        allowDiskUse=True,
    )
    result = summarize_regional_response_rows(rows, selected_regions)
    result.update(
        {
            "sources": PUBLIC_SOURCES,
            "filters": {
                "timeRange": time_range,
                "startDate": date_range.start.date().isoformat(),
                "endDate": (
                    (date_range.end_exclusive - timedelta(days=1)).date().isoformat()
                    if date_range.end_exclusive
                    else date_range.cutoff.date().isoformat()
                ),
                "regions": selected_regions,
                "unknownRegionIncluded": not selected_regions,
            },
            "updatedAt": now.replace(tzinfo=PH_TIMEZONE).isoformat(),
        }
    )
    return result
