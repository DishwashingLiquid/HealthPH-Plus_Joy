from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, status

from helpers.miscHelpers import get_ph_datetime

from .constants import (
    EMPTY_SENTIMENT_BREAKDOWN,
    PUBLIC_PLATFORMS,
    survey_responses_collection,
    surveys_collection,
)


def ensure_survey_indexes() -> None:
    surveys_collection.create_index(
        [("id", 1)],
        unique=True,
        name="unique_sentiment_pulse_survey_id",
    )
    surveys_collection.create_index(
        [
            ("scheduledAt", 1),
            ("publishToMobile", 1),
            ("publishToWebsite", 1),
        ],
        name="sentiment_pulse_public_publish_lookup",
    )
    survey_responses_collection.create_index(
        [("surveyId", 1), ("createdAt", -1)],
        name="sentiment_pulse_response_lookup",
    )


def serialize_datetime(value) -> str:
    if isinstance(value, datetime):
        return value.isoformat()

    return str(value or "")


def parse_ph_datetime(value: str) -> datetime:
    try:
        parsed_datetime = datetime.fromisoformat(str(value or "").strip())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scheduledAt must be a valid ISO date and time",
        )

    if parsed_datetime.tzinfo:
        ph_timezone = timezone(timedelta(hours=8))
        return parsed_datetime.astimezone(ph_timezone).replace(tzinfo=None)

    return parsed_datetime


def get_survey_status(survey: dict, now: Optional[datetime] = None) -> str:
    scheduled_at = survey.get("scheduledAt")

    if not scheduled_at:
        return "Draft"

    if isinstance(scheduled_at, str):
        scheduled_at = parse_ph_datetime(scheduled_at)

    current_datetime = now or get_ph_datetime()

    return "Published" if scheduled_at <= current_datetime else "Scheduled"


def serialize_survey(survey: dict, include_private_fields: bool = True) -> dict:
    serialized_survey = dict(survey)
    serialized_survey.pop("_id", None)
    serialized_survey["status"] = get_survey_status(survey)
    serialized_survey["createdAt"] = serialize_datetime(survey.get("createdAt"))
    serialized_survey["updatedAt"] = serialize_datetime(survey.get("updatedAt"))
    serialized_survey["scheduledAt"] = serialize_datetime(survey.get("scheduledAt"))
    serialized_survey["publishedAt"] = (
        serialized_survey["scheduledAt"]
        if serialized_survey["status"] == "Published"
        else ""
    )
    serialized_survey["responses"] = int(survey.get("responseCount") or 0)
    serialized_survey["sentimentBreakdown"] = survey.get(
        "sentimentBreakdown",
        dict(EMPTY_SENTIMENT_BREAKDOWN),
    )
    serialized_survey["dominantSentiment"] = (
        survey.get("dominantSentiment") or "Neutral"
    )

    if not include_private_fields:
        serialized_survey.pop("createdBy", None)
        serialized_survey.pop("updatedBy", None)
        serialized_survey.pop("responseCount", None)

    return serialized_survey


def get_survey_or_404(survey_id: str) -> dict:
    ensure_survey_indexes()
    survey = surveys_collection.find_one({"id": survey_id})

    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sentiment Pulse survey not found",
        )

    return survey


def validate_platform(platform: str) -> str:
    normalized_platform = str(platform or "").strip().lower()

    if normalized_platform not in PUBLIC_PLATFORMS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="platform must be mobile or website",
        )

    return normalized_platform


def get_public_survey_match(platform: str) -> dict:
    now = get_ph_datetime()
    publish_field = "publishToMobile" if platform == "mobile" else "publishToWebsite"

    return {
        "scheduledAt": {"$lte": now},
        publish_field: True,
    }


def get_user_snapshot(current_user: Optional[dict]) -> dict:
    if not current_user:
        return {
            "id": "",
            "name": "",
        }

    return {
        "id": str(current_user.get("_id", "")),
        "name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip(),
    }


def build_survey_document(data, current_user: Optional[dict]) -> dict:
    created_at = get_ph_datetime()

    return {
        "id": str(uuid4()),
        "title": data.title.strip(),
        "subtitle": (data.subtitle or "").strip() or "Draft mobile sentiment survey",
        "target": data.target,
        "questions": data.questions,
        "surveyJson": data.surveyJson,
        "publishToMobile": True,
        "publishToWebsite": True,
        "scheduledAt": None,
        "responseCount": 0,
        "sentimentBreakdown": dict(EMPTY_SENTIMENT_BREAKDOWN),
        "dominantSentiment": "Neutral",
        "createdAt": created_at,
        "updatedAt": created_at,
        "createdBy": get_user_snapshot(current_user),
    }


def validate_survey_payload(data) -> None:
    if not data.title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a survey title",
        )

    if data.target < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Set a target response count of at least 1",
        )

    if not data.questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add at least one survey question",
        )


def build_survey_update_document(data, current_user: Optional[dict]) -> dict:
    updated_at = get_ph_datetime()

    return {
        "title": data.title.strip(),
        "subtitle": (data.subtitle or "").strip() or "Draft mobile sentiment survey",
        "target": data.target,
        "questions": data.questions,
        "surveyJson": data.surveyJson,
        "scheduledAt": None,
        "responseCount": 0,
        "sentimentBreakdown": dict(EMPTY_SENTIMENT_BREAKDOWN),
        "dominantSentiment": "Neutral",
        "updatedAt": updated_at,
        "updatedBy": get_user_snapshot(current_user),
    }


def build_public_response_document(survey_id: str, data, platform: str) -> dict:
    return {
        "id": str(uuid4()),
        "surveyId": survey_id,
        "answers": data.answers,
        "platform": platform,
        "visitorId": str(data.visitorId or "").strip(),
        "region": data.region or "",
        "metadata": data.metadata or {},
        "createdAt": get_ph_datetime(),
    }
