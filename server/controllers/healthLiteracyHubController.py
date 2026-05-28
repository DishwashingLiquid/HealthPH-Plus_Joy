import base64
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from typing_extensions import Annotated

from config.database import (
    health_literacy_analytics_events_collection,
    health_literacy_feedback_collection,
)
from helpers.miscHelpers import get_ph_datetime
from middleware.requireAuth import require_auth
from middleware.requireRole import require_role
from models.healthLiteracyHubAnalytics import (
    HealthLiteracyAnalyticsEvent,
    HealthLiteracyContentReviewAction,
    HealthLiteracyFeedbackRequest,
)


CONTENT_FILES = {
    "articles": "articles.json",
    "infographics": "infographics.json",
    "videos": "videos.json",
}

CONTENT_MEDIA_PREFIXES = {
    "articles": ("image/", "video/"),
    "infographics": ("image/",),
    "videos": ("video/",),
}

health_literacy_folder = Path("public/health-literacy-hub")

ANALYTICS_TIME_RANGE_DAYS = {
    "last-7-days": 7,
    "last-30-days": 30,
    "last-90-days": 90,
}

ANALYTICS_CONTENT_LABELS = {
    "articles": "Articles",
    "videos": "Videos",
    "infographics": "Infographics",
}

ANALYTICS_REGIONS = [
    "NCR",
    "I",
    "II",
    "III",
    "IVA",
    "IVB",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
    "XIII",
    "CAR",
    "BARMM",
]

ALLOWED_ANALYTICS_EVENTS = {
    "content_opened",
    "content_shared",
    "search",
    "helpful_vote",
    "report_exported",
}

ALLOWED_FEEDBACK_VOTES = {"helpful", "not_helpful"}
ALLOWED_FEEDBACK_PLATFORMS = {"mobile", "website"}
FACT_CHECK_CLAIM_STATUSES = {
    "False",
    "Misleading",
    "Verified",
    "Needs Expert Review",
}
FACT_CHECK_VERIFIERS = {
    "DOH",
    "Medical Expert",
    "Project Researcher",
}
REVIEW_ACTIONS = {
    "send_for_review",
    "mark_reviewed",
    "archive",
    "pin",
}
ASSIGNED_REVIEWERS = {
    "Content Editor",
    "Project Researcher",
    "Medical Expert",
}


def _get_content_path(content_type: str) -> Path:
    if content_type not in CONTENT_FILES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health Literacy Hub content type not found",
        )

    os.makedirs(health_literacy_folder, exist_ok=True)

    content_path = health_literacy_folder / CONTENT_FILES[content_type]

    if not content_path.exists():
        content_path.write_text("[]", encoding="utf-8")

    return content_path


def _read_content(content_type: str) -> list:
    content_path = _get_content_path(content_type)

    try:
        content = json.loads(content_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"{CONTENT_FILES[content_type]} contains invalid JSON",
        )

    if not isinstance(content, list):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"{CONTENT_FILES[content_type]} must contain a JSON array",
        )

    return content


def _write_content(content_type: str, content: list) -> None:
    content_path = _get_content_path(content_type)
    temp_path = content_path.with_suffix(".tmp")

    temp_path.write_text(
        json.dumps(content, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    temp_path.replace(content_path)


def _parse_tags(tags: Optional[str]) -> list[str]:
    if not tags:
        return []

    try:
        parsed_tags = json.loads(tags)
        if isinstance(parsed_tags, list):
            return [
                str(tag).strip()
                for tag in parsed_tags
                if str(tag).strip()
            ]
    except json.JSONDecodeError:
        pass

    return [tag.strip() for tag in tags.split(",") if tag.strip()]


async def _encode_media(content_type: str, file: Optional[UploadFile]) -> Optional[dict]:
    if file is None:
        return None

    content_type_header = file.content_type or ""
    allowed_prefixes = CONTENT_MEDIA_PREFIXES[content_type]

    if not content_type_header.startswith(allowed_prefixes):
        allowed_label = " or ".join(prefix.rstrip("/") for prefix in allowed_prefixes)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{content_type.title()} only accepts {allowed_label} uploads",
        )

    contents = await file.read()
    encoded_contents = base64.b64encode(contents).decode("utf-8")

    return {
        "filename": file.filename,
        "contentType": content_type_header,
        "size": len(contents),
        "dataUrl": f"data:{content_type_header};base64,{encoded_contents}",
    }


def _get_user_snapshot(current_user: Optional[dict]) -> dict:
    if not current_user:
        return {
            "id": "",
            "name": "",
        }

    return {
        "id": str(current_user["_id"]),
        "name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip(),
    }


def _get_analytics_seed(value) -> int:
    return sum(ord(char) for char in str(value or ""))


def _get_analytics_region(content_type: str, item: dict, index: int = 0) -> str:
    seed = _get_analytics_seed(
        f"{content_type}-{item.get('id', '')}-{item.get('title', '')}"
    )
    return ANALYTICS_REGIONS[(seed + index) % len(ANALYTICS_REGIONS)]


def _get_content_label(content_type: str) -> str:
    return ANALYTICS_CONTENT_LABELS.get(content_type, content_type)


def _normalize_fact_check_status(value: Optional[str]) -> str:
    if value in FACT_CHECK_CLAIM_STATUSES:
        return value

    return "Needs Expert Review"


def _normalize_fact_check_verifier(value: Optional[str]) -> str:
    if value in FACT_CHECK_VERIFIERS:
        return value

    return "Project Researcher"


def _build_fact_check_metadata(
    is_fact_check: bool,
    claim: Optional[str],
    claim_status: Optional[str],
    verified_by: Optional[str],
) -> dict:
    normalized_claim = str(claim or "").strip()

    if is_fact_check and not normalized_claim:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fact-check content requires a claim",
        )

    return {
        "isFactCheck": bool(is_fact_check),
        "claim": normalized_claim if is_fact_check else "",
        "claimStatus": _normalize_fact_check_status(claim_status),
        "verifiedBy": _normalize_fact_check_verifier(verified_by),
    }


def _ensure_feedback_indexes() -> None:
    health_literacy_feedback_collection.create_index(
        [
            ("user_id", 1),
            ("content_type_key", 1),
            ("content_id", 1),
        ],
        unique=True,
        name="unique_user_content_feedback",
    )


def _find_content_item(content_type: str, content_id: str):
    content = _read_content(content_type)

    for index, item in enumerate(content):
        if str(item.get("id")) == content_id:
            return item, index

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Health Literacy Hub content not found",
    )


def _find_content_index(content: list, content_id: str) -> int:
    content_index = next(
        (index for index, item in enumerate(content) if str(item.get("id")) == content_id),
        None,
    )

    if content_index is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health Literacy Hub content not found",
        )

    return content_index


def _serialize_feedback(feedback: dict) -> dict:
    return {
        "id": str(feedback.get("_id", "")),
        "userId": feedback.get("user_id", ""),
        "contentType": feedback.get("content_type", ""),
        "contentTypeKey": feedback.get("content_type_key", ""),
        "contentId": feedback.get("content_id", ""),
        "vote": feedback.get("vote", ""),
        "clientPlatform": feedback.get("client_platform", ""),
        "contentSnapshot": feedback.get("content_snapshot", {}),
        "createdAt": feedback.get("created_at").isoformat()
        if feedback.get("created_at")
        else "",
        "updatedAt": feedback.get("updated_at").isoformat()
        if feedback.get("updated_at")
        else "",
    }


def _get_range_start_date(time_range: str):
    days = ANALYTICS_TIME_RANGE_DAYS.get(time_range)

    if not days:
        return None

    start_date = get_ph_datetime().replace(hour=0, minute=0, second=0, microsecond=0)
    return start_date - timedelta(days=days - 1)


def _parse_content_datetime(value):
    if not value:
        return None

    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


def _format_review_date(value) -> str:
    date_value = _parse_content_datetime(value)

    if not date_value:
        return "No review date"

    return date_value.strftime("%b %d, %Y")


def _get_fact_check_review_status(last_reviewed_at) -> str:
    date_value = _parse_content_datetime(last_reviewed_at)

    if not date_value:
        return "Needs Update"

    today = get_ph_datetime().date()
    days_since_review = (today - date_value.date()).days

    if days_since_review > 180:
        return "Needs Update"
    if days_since_review > 150:
        return "Review Soon"

    return "Up to Date"


def _build_event_match(
    event_type: Optional[str] = None,
    time_range: str = "last-30-days",
    content_type: str = "all",
    region: str = "all",
) -> dict:
    match = {}
    start_date = _get_range_start_date(time_range)

    if event_type:
        match["event_type"] = event_type

    if start_date:
        match["created_at"] = {"$gte": start_date}

    if content_type != "all":
        match["content_type"] = content_type

    if region != "all":
        match["region"] = region

    return match


def _build_feedback_match(
    time_range: str = "last-30-days",
    content_type: str = "all",
    region: str = "all",
) -> dict:
    match = {}
    start_date = _get_range_start_date(time_range)

    if start_date:
        match["updated_at"] = {"$gte": start_date}

    if content_type != "all":
        match["content_type"] = content_type

    if region != "all":
        match["region"] = region

    return match


def _content_matches_filters(
    item: dict,
    content_type: str,
    index: int,
    selected_content_type: str,
    selected_region: str,
    time_range: str,
) -> bool:
    if selected_content_type != "all" and content_type != selected_content_type:
        return False

    if selected_region != "all" and _get_analytics_region(content_type, item, index) != selected_region:
        return False

    start_date = _get_range_start_date(time_range)
    if not start_date:
        return True

    date_value = (
        item.get("lastReviewedAt")
        or item.get("updatedAt")
        or item.get("createdAt")
    )
    if not date_value:
        return True

    try:
        content_date = datetime.fromisoformat(str(date_value))
    except ValueError:
        return True

    return content_date >= start_date


def _content_has_media(item: dict) -> bool:
    media = item.get("media")
    return bool(
        (isinstance(media, dict) and media.get("dataUrl")) or media or item.get("thumbnail")
    )


def _get_review_issues(item: dict) -> list[str]:
    issues = []

    if item.get("isArchived"):
        return issues

    if not str(item.get("title", "")).strip():
        issues.append("Missing title")
    if not str(item.get("description", "")).strip():
        issues.append("Missing description")
    if not _content_has_media(item):
        issues.append("Missing media")
    if not item.get("publishToMobile") and not item.get("publishToWebsite"):
        issues.append("No publish target")

    return issues


def _get_review_age_issues(item: dict) -> list[str]:
    issues = []

    if item.get("isArchived"):
        return issues

    last_reviewed_at = item.get("lastReviewedAt")
    date_value = _parse_content_datetime(last_reviewed_at)

    if not date_value:
        return ["No review date"]

    days_since_review = (get_ph_datetime().date() - date_value.date()).days

    if days_since_review > 180:
        issues.append("Overdue review")

    return issues


def _count_content_needing_review(
    time_range: str,
    content_type: str,
    region: str,
) -> int:
    review_count = 0

    for content_key, label in ANALYTICS_CONTENT_LABELS.items():
        if content_type != "all" and label != content_type:
            continue

        for index, item in enumerate(_read_content(content_key)):
            if not _content_matches_filters(
                item=item,
                content_type=label,
                index=index,
                selected_content_type=content_type,
                selected_region=region,
                time_range=time_range,
            ):
                continue

            if _get_review_issues(item) or _get_review_age_issues(item):
                review_count += 1

    return review_count


def _get_top_search_topic(match: dict) -> dict:
    rows = list(
        health_literacy_analytics_events_collection.aggregate(
            [
                {"$match": match},
                {
                    "$group": {
                        "_id": "$topic",
                        "searches": {"$sum": 1},
                    }
                },
                {"$sort": {"searches": -1, "_id": 1}},
                {"$limit": 1},
            ]
        )
    )

    if not rows or not rows[0].get("_id"):
        return {"topic": "No searches yet", "searches": 0}

    return {"topic": rows[0]["_id"], "searches": rows[0]["searches"]}


"""
@desc     Fetch Health Literacy Hub content by type
route     GET api/health-literacy-hub/{content_type}
@access   Private
"""


async def fetch_health_literacy_content(
    content_type: str,
    current_user: Annotated[dict, Depends(require_role(["ADMIN", "SUPERADMIN"]))],
):
    return _read_content(content_type)


"""
@desc     Fetch Health Literacy Hub overview analytics
route     GET api/health-literacy-hub/analytics/overview
@access   Private
"""


async def fetch_health_literacy_analytics_overview(
    current_user: Annotated[dict, Depends(require_role(["ADMIN", "SUPERADMIN"]))],
    timeRange: str = "last-30-days",
    contentType: str = "all",
    region: str = "all",
):
    content_opened_match = _build_event_match(
        event_type="content_opened",
        time_range=timeRange,
        content_type=contentType,
        region=region,
    )
    helpful_vote_match = _build_feedback_match(
        time_range=timeRange,
        content_type=contentType,
        region=region,
    )
    report_exported_match = _build_event_match(
        event_type="report_exported",
        time_range=timeRange,
        content_type=contentType,
        region=region,
    )
    search_match = _build_event_match(
        event_type="search",
        time_range=timeRange,
        content_type=contentType,
        region=region,
    )

    helpful_votes = health_literacy_feedback_collection.count_documents(
        {**helpful_vote_match, "vote": "helpful"}
    )
    not_helpful_votes = health_literacy_feedback_collection.count_documents(
        {**helpful_vote_match, "vote": "not_helpful"}
    )
    total_votes = helpful_votes + not_helpful_votes
    helpful_score = (helpful_votes / total_votes) * 100 if total_votes else 0

    visitor_ids = health_literacy_analytics_events_collection.distinct(
        "visitor_id",
        content_opened_match,
    )

    return {
        "peopleReached": health_literacy_analytics_events_collection.count_documents(
            content_opened_match
        ),
        "uniqueVisitors": len([visitor_id for visitor_id in visitor_ids if visitor_id]),
        "topSearchTopic": _get_top_search_topic(search_match),
        "helpfulScore": helpful_score,
        "needsReview": _count_content_needing_review(
            time_range=timeRange,
            content_type=contentType,
            region=region,
        ),
        "reportsExported": health_literacy_analytics_events_collection.count_documents(
            report_exported_match
        ),
    }


"""
@desc     Fetch Health Literacy Hub fact-check usage analytics
route     GET api/health-literacy-hub/analytics/fact-check
@access   Private
"""


async def fetch_health_literacy_fact_check_analytics(
    current_user: Annotated[dict, Depends(require_role(["ADMIN", "SUPERADMIN"]))],
    timeRange: str = "last-30-days",
    contentType: str = "all",
    region: str = "all",
):
    rows = []

    for content_key, content_label in ANALYTICS_CONTENT_LABELS.items():
        if contentType != "all" and content_label != contentType:
            continue

        for index, item in enumerate(_read_content(content_key)):
            if not item.get("isFactCheck"):
                continue

            item_region = _get_analytics_region(content_label, item, index)
            if region != "all" and item_region != region:
                continue

            content_id = str(item.get("id", ""))
            event_match_base = _build_event_match(
                time_range=timeRange,
                content_type=content_label,
                region=item_region,
            )
            event_match_base["content_type"] = {"$in": [content_label, content_key]}
            event_match_base.update(
                {
                    "content_id": content_id,
                }
            )
            event_platform_match = [
                {"client_platform": {"$in": list(ALLOWED_FEEDBACK_PLATFORMS)}},
                {"metadata.clientPlatform": {"$in": list(ALLOWED_FEEDBACK_PLATFORMS)}},
                {"metadata.client_platform": {"$in": list(ALLOWED_FEEDBACK_PLATFORMS)}},
            ]
            feedback_match_base = _build_feedback_match(
                time_range=timeRange,
                content_type=content_label,
                region=item_region,
            )
            feedback_match_base.update(
                {
                    "content_id": content_id,
                    "client_platform": {"$in": list(ALLOWED_FEEDBACK_PLATFORMS)},
                }
            )

            helpful_votes = health_literacy_feedback_collection.count_documents(
                {**feedback_match_base, "vote": "helpful"}
            )
            not_helpful_votes = health_literacy_feedback_collection.count_documents(
                {**feedback_match_base, "vote": "not_helpful"}
            )
            total_feedback = helpful_votes + not_helpful_votes
            helpful_score = (
                (helpful_votes / total_feedback) * 100
                if total_feedback
                else None
            )
            last_reviewed_at = item.get("lastReviewedAt")

            rows.append(
                {
                    "contentId": content_id,
                    "contentType": content_label,
                    "region": item_region,
                    "claim": item.get("claim") or item.get("title", "Untitled claim"),
                    "claimStatus": _normalize_fact_check_status(
                        item.get("claimStatus")
                    ),
                    "views": health_literacy_analytics_events_collection.count_documents(
                        {
                            **event_match_base,
                            "event_type": "content_opened",
                            "$or": event_platform_match,
                        }
                    ),
                    "helpful": helpful_votes,
                    "notHelpful": not_helpful_votes,
                    "helpfulScore": helpful_score,
                    "shares": health_literacy_analytics_events_collection.count_documents(
                        {
                            **event_match_base,
                            "event_type": "content_shared",
                            "$or": event_platform_match,
                        }
                    ),
                    "verifiedBy": _normalize_fact_check_verifier(
                        item.get("verifiedBy")
                    ),
                    "lastReviewedDate": _format_review_date(last_reviewed_at),
                    "reviewStatus": _get_fact_check_review_status(last_reviewed_at),
                }
            )

    return rows


"""
@desc     Record Health Literacy Hub analytics event
route     POST api/health-literacy-hub/analytics/events
@access   Private
"""


async def create_health_literacy_analytics_event(
    data: HealthLiteracyAnalyticsEvent,
    user_id: Annotated[str, Depends(require_auth)],
):
    event_type = data.eventType.strip()

    if event_type not in ALLOWED_ANALYTICS_EVENTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported Health Literacy Hub analytics event",
        )

    topic = data.topic.strip() if data.topic else None
    vote = data.vote.strip() if data.vote else None
    metadata = data.metadata or {}
    client_platform = (
        data.clientPlatform
        or metadata.get("clientPlatform")
        or metadata.get("client_platform")
    )
    client_platform = client_platform.strip() if client_platform else None

    if event_type == "search" and not topic:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search analytics events require a topic",
        )

    if event_type == "helpful_vote" and vote not in {"helpful", "not_helpful"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Helpful vote analytics events require a valid vote",
        )

    if client_platform and client_platform not in ALLOWED_FEEDBACK_PLATFORMS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="clientPlatform must be mobile or website",
        )

    if client_platform:
        metadata = {**metadata, "clientPlatform": client_platform}

    event = {
        "event_type": event_type,
        "content_id": data.contentId,
        "content_title": data.contentTitle,
        "content_type": data.contentType or "all",
        "client_platform": client_platform,
        "region": data.region or "all",
        "topic": topic,
        "vote": vote,
        "report_format": data.reportFormat,
        "visitor_id": data.visitorId or user_id,
        "user_id": user_id,
        "metadata": metadata,
        "created_at": get_ph_datetime(),
    }

    health_literacy_analytics_events_collection.insert_one(event)

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={"message": "Health Literacy Hub analytics event recorded"},
    )


"""
@desc     Create or update logged-in user feedback for Health Literacy Hub content
route     POST api/health-literacy-hub/content/{content_type}/{content_id}/feedback
@access   Private
"""


async def upsert_health_literacy_content_feedback(
    content_type: str,
    content_id: str,
    data: HealthLiteracyFeedbackRequest,
    user_id: Annotated[str, Depends(require_auth)],
):
    if content_type not in CONTENT_FILES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health Literacy Hub content type not found",
        )

    vote = data.vote.strip()
    client_platform = data.clientPlatform.strip()

    if vote not in ALLOWED_FEEDBACK_VOTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feedback vote must be helpful or not_helpful",
        )

    if client_platform not in ALLOWED_FEEDBACK_PLATFORMS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feedback clientPlatform must be mobile or website",
        )

    content_item, content_index = _find_content_item(content_type, content_id)
    content_label = _get_content_label(content_type)
    region = _get_analytics_region(content_label, content_item, content_index)
    now = get_ph_datetime()
    feedback_filter = {
        "user_id": user_id,
        "content_type_key": content_type,
        "content_id": content_id,
    }
    _ensure_feedback_indexes()
    existing_feedback = health_literacy_feedback_collection.find_one(feedback_filter)

    content_snapshot = {
        "id": content_id,
        "title": content_item.get("title", ""),
        "description": content_item.get("description", ""),
        "tags": content_item.get("tags", []),
        "publishToMobile": bool(content_item.get("publishToMobile")),
        "publishToWebsite": bool(content_item.get("publishToWebsite")),
        "region": region,
    }

    health_literacy_feedback_collection.update_one(
        feedback_filter,
        {
            "$set": {
                "vote": vote,
                "client_platform": client_platform,
                "content_type": content_label,
                "content_title": content_item.get("title", ""),
                "region": region,
                "content_snapshot": content_snapshot,
                "updated_at": now,
            },
            "$setOnInsert": {
                "user_id": user_id,
                "content_type_key": content_type,
                "content_id": content_id,
                "created_at": now,
            },
        },
        upsert=True,
    )

    health_literacy_analytics_events_collection.insert_one(
        {
            "event_type": "helpful_vote",
            "content_id": content_id,
            "content_title": content_item.get("title", ""),
            "content_type": content_label,
            "region": region,
            "topic": None,
            "vote": vote,
            "report_format": None,
            "visitor_id": user_id,
            "user_id": user_id,
            "metadata": {
                "clientPlatform": client_platform,
                "previousVote": existing_feedback.get("vote")
                if existing_feedback
                else None,
                "action": "updated" if existing_feedback else "created",
            },
            "created_at": now,
        }
    )

    saved_feedback = health_literacy_feedback_collection.find_one(feedback_filter)

    return JSONResponse(
        status_code=status.HTTP_200_OK if existing_feedback else status.HTTP_201_CREATED,
        content={
            "message": "Health Literacy Hub feedback saved successfully",
            "feedback": _serialize_feedback(saved_feedback),
        },
    )


"""
@desc     Apply Health Literacy Hub review queue action
route     PATCH api/health-literacy-hub/{content_type}/{content_id}/review-action
@access   Private
"""


async def apply_health_literacy_content_review_action(
    content_type: str,
    content_id: str,
    data: HealthLiteracyContentReviewAction,
    current_user: Annotated[
        dict, Depends(require_role(["ADMIN", "SUPERADMIN"]))
    ],
):
    if content_type not in CONTENT_FILES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health Literacy Hub content type not found",
        )

    action = data.action.strip()

    if action not in REVIEW_ACTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported Health Literacy Hub review action",
        )

    content = _read_content(content_type)
    content_index = _find_content_index(content, content_id)
    current_content = content[content_index]
    current_user_snapshot = _get_user_snapshot(current_user)
    updated_at = get_ph_datetime().isoformat()
    updated_content = {
        **current_content,
        "updatedAt": updated_at,
    }

    if action == "send_for_review":
        assigned_reviewer = str(data.assignedReviewer or "").strip()

        if assigned_reviewer not in ASSIGNED_REVIEWERS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please select a valid assigned reviewer",
            )

        updated_content.update(
            {
                "assignedReviewer": assigned_reviewer,
                "reviewRequestedAt": updated_at,
                "reviewRequestedBy": current_user_snapshot,
            }
        )

    if action == "mark_reviewed":
        updated_content.update(
            {
                "lastReviewedAt": updated_at,
                "lastReviewedBy": current_user_snapshot,
            }
        )

    if action == "archive":
        updated_content.update(
            {
                "publishToMobile": False,
                "publishToWebsite": False,
                "isArchived": True,
                "archivedAt": updated_at,
                "archivedBy": current_user_snapshot,
            }
        )

    if action == "pin":
        updated_content.update(
            {
                "isPinned": True,
                "pinnedAt": updated_at,
                "pinnedBy": current_user_snapshot,
            }
        )

    content[content_index] = updated_content

    if action == "pin":
        pinned_content = content.pop(content_index)
        content.insert(0, pinned_content)

    _write_content(content_type, content)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "message": "Health Literacy Hub review action saved successfully",
            "content": updated_content,
        },
    )


"""
@desc     Create Health Literacy Hub content
route     POST api/health-literacy-hub/{content_type}
@access   Private
"""


async def create_health_literacy_content(
    content_type: str,
    current_user: Annotated[
        dict, Depends(require_role(["ADMIN", "SUPERADMIN"]))
    ],
    title: Annotated[str, Form()],
    description: Annotated[str, Form()],
    tags: Annotated[Optional[str], Form()] = "",
    publishToMobile: Annotated[bool, Form()] = False,
    publishToWebsite: Annotated[bool, Form()] = False,
    isFactCheck: Annotated[bool, Form()] = False,
    claim: Annotated[Optional[str], Form()] = "",
    claimStatus: Annotated[Optional[str], Form()] = "Needs Expert Review",
    verifiedBy: Annotated[Optional[str], Form()] = "Project Researcher",
    file: Annotated[Optional[UploadFile], File()] = None,
):
    if content_type not in CONTENT_FILES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health Literacy Hub content type not found",
        )

    if not title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a title",
        )

    if not description.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a description",
        )

    content = _read_content(content_type)
    media = await _encode_media(content_type, file)
    created_at = get_ph_datetime()

    created_by = _get_user_snapshot(current_user)
    fact_check_metadata = _build_fact_check_metadata(
        isFactCheck,
        claim,
        claimStatus,
        verifiedBy,
    )

    new_content = {
        "id": str(uuid4()),
        "title": title.strip(),
        "description": description.strip(),
        "tags": _parse_tags(tags),
        "media": media,
        "publishToMobile": publishToMobile,
        "publishToWebsite": publishToWebsite,
        "createdAt": created_at.isoformat(),
        "lastReviewedAt": created_at.isoformat(),
        "assignedReviewer": "",
        "reviewRequestedAt": "",
        "lastReviewedBy": created_by,
        "isArchived": False,
        "archivedAt": "",
        "archivedBy": {},
        "isPinned": False,
        "pinnedAt": "",
        "pinnedBy": {},
        "createdBy": created_by,
        **fact_check_metadata,
    }

    content.insert(0, new_content)
    _write_content(content_type, content)

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "message": "Health Literacy Hub content created successfully",
            "content": new_content,
        },
    )


"""
@desc     Update Health Literacy Hub content
route     PUT api/health-literacy-hub/{content_type}/{content_id}
@access   Private
"""


async def update_health_literacy_content(
    content_type: str,
    content_id: str,
    current_user: Annotated[
        dict, Depends(require_role(["ADMIN", "SUPERADMIN"]))
    ],
    title: Annotated[str, Form()],
    description: Annotated[str, Form()],
    tags: Annotated[Optional[str], Form()] = "",
    publishToMobile: Annotated[bool, Form()] = False,
    publishToWebsite: Annotated[bool, Form()] = False,
    isFactCheck: Annotated[bool, Form()] = False,
    claim: Annotated[Optional[str], Form()] = "",
    claimStatus: Annotated[Optional[str], Form()] = "Needs Expert Review",
    verifiedBy: Annotated[Optional[str], Form()] = "Project Researcher",
    removeMedia: Annotated[bool, Form()] = False,
    file: Annotated[Optional[UploadFile], File()] = None,
):
    if content_type not in CONTENT_FILES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health Literacy Hub content type not found",
        )

    if not title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a title",
        )

    if not description.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a description",
        )

    content = _read_content(content_type)
    content_index = _find_content_index(content, content_id)

    current_content = content[content_index]
    updated_media = current_content.get("media")

    if file is not None:
        updated_media = await _encode_media(content_type, file)
    elif removeMedia:
        updated_media = None

    updated_at = get_ph_datetime()
    fact_check_metadata = _build_fact_check_metadata(
        isFactCheck,
        claim,
        claimStatus,
        verifiedBy,
    )
    updated_content = {
        **current_content,
        "title": title.strip(),
        "description": description.strip(),
        "tags": _parse_tags(tags),
        "media": updated_media,
        "publishToMobile": publishToMobile,
        "publishToWebsite": publishToWebsite,
        "updatedAt": updated_at.isoformat(),
        "lastReviewedAt": updated_at.isoformat(),
        "updatedBy": _get_user_snapshot(current_user),
        **fact_check_metadata,
    }

    content[content_index] = updated_content
    _write_content(content_type, content)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "message": "Health Literacy Hub content updated successfully",
            "content": updated_content,
        },
    )
