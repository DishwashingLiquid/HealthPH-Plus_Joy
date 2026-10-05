"""Summary cards use publication dates and response records, never cached counters."""

from datetime import datetime, timedelta, timezone

from helpers.miscHelpers import get_ph_datetime
from controllers.dashboard_regions import mongo_region_expression

from .constants import PUBLIC_SOURCES, REGIONS, survey_responses_collection, surveys_collection
from .regional_analysis import get_event_region
from .survey_helpers import get_survey_status, parse_ph_datetime


PH_TIMEZONE = timezone(timedelta(hours=8))  # Asia/Manila; matches get_ph_datetime.


def reporting_months(now: datetime):
    # MongoDB dates in this application contain naive Philippine wall time.
    if now.tzinfo:
        now = now.astimezone(PH_TIMEZONE).replace(tzinfo=None)
    current = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    previous = (current - timedelta(days=1)).replace(day=1)
    following = (current.replace(day=28) + timedelta(days=4)).replace(day=1)
    return previous, current, following


def publication_date_expression():
    """Accept the legacy ISO strings supported by serialize_survey as well as BSON dates."""
    return {
        "$cond": [
            {"$eq": [{"$type": "$scheduledAt"}, "string"]},
            {"$let": {
                "vars": {"parsed": {"$convert": {
                    "input": "$scheduledAt", "to": "date", "onError": None, "onNull": None,
                }}},
                "in": {"$cond": [
                    {"$regexMatch": {"input": "$scheduledAt", "regex": r"(?:Z|[+-]\d{2}:?\d{2})$"}},
                    {"$add": ["$$parsed", 8 * 60 * 60 * 1000]},
                    "$$parsed",
                ]},
            }},
            {"$cond": [{"$eq": [{"$type": "$scheduledAt"}, "date"]}, "$scheduledAt", None]},
        ],
    }


def response_totals_pipeline(now: datetime):
    return [
        {"$match": {
            "$expr": {"$eq": ["$surveyId", "$$surveyId"]},
            "platform": {"$in": PUBLIC_SOURCES},
            "createdAt": {"$type": "date", "$lte": now},
        }},
        {"$set": {"dashboardRegion": mongo_region_expression()}},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "latestResponseAt": {"$max": "$createdAt"},
            "regions": {"$addToSet": "$dashboardRegion"},
            "unknownRegionResponses": {"$sum": {"$cond": [{"$eq": ["$dashboardRegion", None]}, 1, 0]}},
        }},
    ]


def summary_pipeline(now: datetime):
    return [
        {"$project": {"id": 1, "publishedAt": publication_date_expression()}},
        {"$match": {"publishedAt": {"$type": "date", "$lte": now}}},
        {"$sort": {"publishedAt": -1, "id": 1}},
        {"$lookup": {
            "from": survey_responses_collection.name,
            "let": {"surveyId": "$id"},
            "pipeline": response_totals_pipeline(now),
            "as": "responseTotals",
        }},
        {"$project": {"_id": 0, "id": 1, "publishedAt": 1, "responseTotals": 1}},
    ]


def build_dashboard_summary(surveys, now: datetime):
    """Reduce one compact aggregate per survey, including surveys with no responses."""
    if now.tzinfo:
        now = now.astimezone(PH_TIMEZONE).replace(tzinfo=None)
    previous, current, following = reporting_months(now)
    published = []
    for survey in surveys:
        publication = survey.get("publishedAt")
        if isinstance(publication, str):
            publication = parse_ph_datetime(publication)
        if get_survey_status({"scheduledAt": publication}, now) == "Published":
            published.append({**survey, "publishedAt": publication})
    published.sort(key=lambda survey: (datetime.max - survey["publishedAt"], survey["id"]))

    active_regions = set()
    current_total = previous_total = 0
    unknown_region_responses = 0
    cutoff = None
    for index, survey in enumerate(published):
        totals = next(iter(survey.get("responseTotals") or []), {})
        latest = totals.get("latestResponseAt")
        if latest is not None:
            cutoff = max(cutoff, latest) if cutoff else latest
        if index < 5:
            unknown_region_responses += totals.get("unknownRegionResponses", 0)
            active_regions.update(
                code for region in totals.get("regions", [])
                if (code := get_event_region({"region": region})) is not None
            )
        publication = survey["publishedAt"]
        if current <= publication < following:
            current_total += totals.get("total", 0)
        elif previous <= publication < current:
            previous_total += totals.get("total", 0)

    # Every counted response belongs to the same aggregation and is <= its
    # maximum createdAt. That maximum is the shared cutoff, without a second
    # response query that could race with a new submission.
    return {
        "activeRegions": len(active_regions),
        "unknownRegionResponses": unknown_region_responses,
        "totalRegions": len(REGIONS),
        "publishedSurveyCount": min(5, len(published)),
        "surveyResponses": current_total,
        "previousMonthResponses": previous_total,
        "responseChangePercent": (
            (current_total - previous_total) / previous_total * 100
            if previous_total else None
        ),
        "currentPublicationMonth": current.strftime("%Y-%m"),
        "previousPublicationMonth": previous.strftime("%Y-%m"),
        "responseCutoff": cutoff.replace(tzinfo=PH_TIMEZONE).isoformat() if cutoff else None,
        "nextReportingPeriod": following.replace(tzinfo=PH_TIMEZONE).isoformat(),
    }


def fetch_dashboard_summary():
    now = get_ph_datetime()
    # One MongoDB aggregation fixes publication eligibility at request start and
    # joins responses using the existing (surveyId, createdAt) index. It avoids
    # independent reads for each card; default MongoDB read isolation still
    # applies (the application does not require a replica-set snapshot session).
    return build_dashboard_summary(surveys_collection.aggregate(summary_pipeline(now)), now)
