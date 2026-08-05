from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import uuid4

from fastapi import Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from typing_extensions import Annotated

from config.database import (
    health_literacy_analytics_events_collection,
    sentiment_pulse_survey_responses_collection,
    sentiment_pulse_surveys_collection,
)
from helpers.miscHelpers import get_ph_datetime
from middleware.requireAuth import require_auth
from middleware.requireRole import require_role
from models.sentimentPulseSurvey import (
    SentimentPulseSurveyDraft,
    SentimentPulseSurveyResponse,
    SentimentPulseSurveySchedule,
)


REGIONS = [
    "NCR",
    "I",
    "II",
    "III",
    "IVA",
    "IVB",
    "V",
    "CAR",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
    "XIII",
    "BARMM",
]

SENTIMENTS = {
    "concerned": "Concerned",
    "proactive": "Proactive",
    "misinformed": "Misinformed",
    "neutral": "Neutral",
}

TIME_RANGE_DAYS = {
    "last-7-days": 7,
    "last-30-days": 30,
    "last-90-days": 90,
}

PUBLIC_SOURCES = ["mobile", "website"]
PUBLIC_PLATFORMS = {"mobile", "website"}


def _ensure_survey_indexes() -> None:
    sentiment_pulse_surveys_collection.create_index(
        [("id", 1)],
        unique=True,
        name="unique_sentiment_pulse_survey_id",
    )
    sentiment_pulse_surveys_collection.create_index(
        [
            ("scheduledAt", 1),
            ("publishToMobile", 1),
            ("publishToWebsite", 1),
        ],
        name="sentiment_pulse_public_publish_lookup",
    )
    sentiment_pulse_survey_responses_collection.create_index(
        [("surveyId", 1), ("createdAt", -1)],
        name="sentiment_pulse_response_lookup",
    )


def _serialize_datetime(value) -> str:
    if isinstance(value, datetime):
        return value.isoformat()

    return str(value or "")


def _parse_ph_datetime(value: str) -> datetime:
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


def _get_survey_status(survey: dict, now: Optional[datetime] = None) -> str:
    scheduled_at = survey.get("scheduledAt")

    if not scheduled_at:
        return "Draft"

    if isinstance(scheduled_at, str):
        scheduled_at = _parse_ph_datetime(scheduled_at)

    current_datetime = now or get_ph_datetime()

    return "Published" if scheduled_at <= current_datetime else "Scheduled"


def _serialize_survey(survey: dict, include_private_fields: bool = True) -> dict:
    serialized_survey = dict(survey)
    serialized_survey.pop("_id", None)
    serialized_survey["status"] = _get_survey_status(survey)
    serialized_survey["createdAt"] = _serialize_datetime(survey.get("createdAt"))
    serialized_survey["updatedAt"] = _serialize_datetime(survey.get("updatedAt"))
    serialized_survey["scheduledAt"] = _serialize_datetime(survey.get("scheduledAt"))
    serialized_survey["publishedAt"] = (
        serialized_survey["scheduledAt"]
        if serialized_survey["status"] == "Published"
        else ""
    )
    serialized_survey["responses"] = int(survey.get("responseCount") or 0)
    serialized_survey["sentimentBreakdown"] = survey.get(
        "sentimentBreakdown",
        {
            "concerned": 0,
            "proactive": 0,
            "misinformed": 0,
            "neutral": 0,
        },
    )
    serialized_survey["dominantSentiment"] = survey.get("dominantSentiment") or "Neutral"

    if not include_private_fields:
        serialized_survey.pop("createdBy", None)
        serialized_survey.pop("updatedBy", None)
        serialized_survey.pop("responseCount", None)

    return serialized_survey


def _get_survey_or_404(survey_id: str) -> dict:
    _ensure_survey_indexes()
    survey = sentiment_pulse_surveys_collection.find_one({"id": survey_id})

    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sentiment Pulse survey not found",
        )

    return survey


def _validate_platform(platform: str) -> str:
    normalized_platform = str(platform or "").strip().lower()

    if normalized_platform not in PUBLIC_PLATFORMS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="platform must be mobile or website",
        )

    return normalized_platform


def _get_public_survey_match(platform: str) -> dict:
    now = get_ph_datetime()
    publish_field = "publishToMobile" if platform == "mobile" else "publishToWebsite"

    return {
        "scheduledAt": {"$lte": now},
        publish_field: True,
    }


def _get_user_snapshot(current_user: Optional[dict]) -> dict:
    if not current_user:
        return {
            "id": "",
            "name": "",
        }

    return {
        "id": str(current_user.get("_id", "")),
        "name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip(),
    }


def _get_range_start_date(time_range: str):
    days = TIME_RANGE_DAYS.get(time_range)

    if not days:
        return None

    start_date = get_ph_datetime().replace(hour=0, minute=0, second=0, microsecond=0)
    return start_date - timedelta(days=days - 1)


def _parse_regions(regions: Optional[str]) -> list[str]:
    if not regions:
        return REGIONS

    selected_regions = [
        region.strip()
        for region in regions.split(",")
        if region.strip() in REGIONS
    ]

    return selected_regions or REGIONS


def _normalize_sentiment(value) -> Optional[str]:
    normalized_value = str(value or "").strip().lower()

    return SENTIMENTS.get(normalized_value)


def _get_event_sentiment(event: dict) -> Optional[str]:
    metadata = event.get("metadata") or {}

    for key in (
        "dominantSentiment",
        "dominant_sentiment",
        "sentiment",
        "sentimentScore",
        "sentiment_score",
    ):
        sentiment = _normalize_sentiment(event.get(key) or metadata.get(key))

        if sentiment:
            return sentiment

    return None


def _get_event_region(event: dict) -> Optional[str]:
    metadata = event.get("metadata") or {}
    region = event.get("region") or metadata.get("region")

    if region in REGIONS:
        return region

    return None


def _build_sentiment_breakdown(sentiment_counts: Counter, total_responses: int) -> dict:
    if total_responses == 0:
        return {sentiment_key: 0 for sentiment_key in SENTIMENTS.keys()}

    return {
        sentiment_key: round(
            (sentiment_counts[sentiment_label] / total_responses) * 100
        )
        for sentiment_key, sentiment_label in SENTIMENTS.items()
    }


def _calculate_percentage(count: int, total: int) -> int:
    if total == 0:
        return 0

    return round((count / total) * 100)


def _normalize_answer_value(value) -> str:
    return str(value).strip()


def _is_empty_answer(value) -> bool:
    if value is None:
        return True

    if isinstance(value, str):
        return value.strip() == ""

    if isinstance(value, list):
        return len(value) == 0

    return False


def _get_question_label(question: dict, index: int) -> str:
    title = str(question.get("title") or "").strip()

    return title or f"Question {index + 1}"


def _get_question_result_type(question: dict) -> str:
    question_type = str(question.get("type") or "").strip()

    if question_type == "multipleChoice":
        return "multipleChoice"

    if question_type == "rating":
        return "rating"

    return "text"


def _get_choice_labels(question: dict) -> list[str]:
    choices = question.get("choices") or []

    return [
        _normalize_answer_value(choice)
        for choice in choices
        if _normalize_answer_value(choice)
    ]


def _get_rating_labels(question: dict) -> list[str]:
    rate_min = int(question.get("rateMin") or 1)
    rate_max = int(question.get("rateMax") or 5)
    start = min(rate_min, rate_max)
    end = max(rate_min, rate_max)

    return [str(value) for value in range(start, end + 1)]


def _build_choice_or_rating_rows(
    configured_labels: list[str],
    answer_counts: Counter,
    answered_count: int,
) -> list[dict]:
    rows = [
        {
            "label": label,
            "count": answer_counts[label],
            "percentage": _calculate_percentage(answer_counts[label], answered_count),
        }
        for label in configured_labels
    ]
    configured_set = set(configured_labels)
    unknown_count = sum(
        count
        for label, count in answer_counts.items()
        if label not in configured_set
    )

    if unknown_count > 0:
        rows.append(
            {
                "label": "Other / Removed option",
                "count": unknown_count,
                "percentage": _calculate_percentage(unknown_count, answered_count),
            }
        )

    return rows


def _build_question_results(question: dict, index: int, responses: list[dict]) -> dict:
    question_id = question.get("id")
    result_type = _get_question_result_type(question)
    answer_counts = Counter()
    answered_count = 0

    for response in responses:
        answers = response.get("answers") or {}

        if question_id not in answers:
            continue

        answer_value = answers.get(question_id)

        if _is_empty_answer(answer_value):
            continue

        answered_count += 1

        if result_type == "text":
            answer_counts.update(["Non-empty text response"])
            continue

        if isinstance(answer_value, list):
            answer_counts.update(
                _normalize_answer_value(value)
                for value in answer_value
                if not _is_empty_answer(value)
            )
            continue

        answer_counts.update([_normalize_answer_value(answer_value)])

    if result_type == "multipleChoice":
        rows = _build_choice_or_rating_rows(
            _get_choice_labels(question),
            answer_counts,
            answered_count,
        )
    elif result_type == "rating":
        rows = _build_choice_or_rating_rows(
            _get_rating_labels(question),
            answer_counts,
            answered_count,
        )
    else:
        text_count = answer_counts["Non-empty text response"]
        rows = [
            {
                "label": "Non-empty text responses",
                "count": text_count,
                "percentage": _calculate_percentage(text_count, answered_count),
            }
        ]

    return {
        "id": question_id,
        "title": _get_question_label(question, index),
        "type": result_type,
        "answeredResponses": answered_count,
        "rows": rows,
    }


"""
@desc     Fetch admin Sentiment Pulse surveys
route     GET api/sentiment-pulse/surveys
@access   Private
"""


async def fetch_surveys(
    _current_user: Annotated[
        dict, Depends(require_role(["Admin", "SUPERADMIN"]))
    ],
):
    _ensure_survey_indexes()
    surveys = sentiment_pulse_surveys_collection.find({}).sort(
        [("createdAt", -1)]
    )

    return [_serialize_survey(survey) for survey in surveys]


"""
@desc     Fetch admin Sentiment Pulse survey results
route     GET api/sentiment-pulse/surveys/{survey_id}/results
@access   Private
"""


async def fetch_survey_results(
    survey_id: str,
    _current_user: Annotated[
        dict, Depends(require_role(["Admin", "SUPERADMIN"]))
    ],
):
    survey = _get_survey_or_404(survey_id)
    serialized_survey = _serialize_survey(survey)
    responses = list(
        sentiment_pulse_survey_responses_collection.find(
            {"surveyId": survey_id},
            {"_id": 0, "answers": 1},
        )
    )
    questions = survey.get("questions") or []

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "survey": {
                "id": serialized_survey.get("id"),
                "title": serialized_survey.get("title"),
                "subtitle": serialized_survey.get("subtitle"),
                "status": serialized_survey.get("status"),
                "target": serialized_survey.get("target"),
                "responses": serialized_survey.get("responses"),
                "dominantSentiment": serialized_survey.get("dominantSentiment"),
                "sentimentBreakdown": serialized_survey.get("sentimentBreakdown"),
            },
            "questions": [
                _build_question_results(question, index, responses)
                for index, question in enumerate(questions)
            ],
            "updatedAt": get_ph_datetime().isoformat(),
        },
    )


"""
@desc     Create a draft Sentiment Pulse survey
route     POST api/sentiment-pulse/surveys
@access   Private
"""


async def create_survey(
    data: SentimentPulseSurveyDraft,
    current_user: Annotated[
        dict, Depends(require_role(["Admin", "SUPERADMIN"]))
    ],
):
    _ensure_survey_indexes()

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

    created_at = get_ph_datetime()
    survey = {
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
        "sentimentBreakdown": {
            "concerned": 0,
            "proactive": 0,
            "misinformed": 0,
            "neutral": 0,
        },
        "dominantSentiment": "Neutral",
        "createdAt": created_at,
        "updatedAt": created_at,
        "createdBy": _get_user_snapshot(current_user),
    }

    sentiment_pulse_surveys_collection.insert_one(survey)

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "message": "Sentiment Pulse survey draft created successfully",
            "survey": _serialize_survey(survey),
        },
    )


"""
@desc     Schedule a draft Sentiment Pulse survey
route     PATCH api/sentiment-pulse/surveys/{survey_id}/schedule
@access   Private
"""


async def schedule_survey(
    survey_id: str,
    data: SentimentPulseSurveySchedule,
    current_user: Annotated[
        dict, Depends(require_role(["Admin", "SUPERADMIN"]))
    ],
):
    scheduled_at = _parse_ph_datetime(data.scheduledAt)
    survey = _get_survey_or_404(survey_id)

    if _get_survey_status(survey) != "Draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft surveys can be scheduled",
        )

    updated_at = get_ph_datetime()
    update = {
        "scheduledAt": scheduled_at,
        "updatedAt": updated_at,
        "updatedBy": _get_user_snapshot(current_user),
    }

    sentiment_pulse_surveys_collection.update_one(
        {"id": survey_id},
        {"$set": update},
    )
    updated_survey = {
        **survey,
        **update,
    }

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "message": "Sentiment Pulse survey scheduled successfully",
            "survey": _serialize_survey(updated_survey),
        },
    )


"""
@desc     Fetch published Sentiment Pulse surveys for mobile or website
route     GET api/sentiment-pulse/public-surveys
@access   Public
"""


async def fetch_public_surveys(
    platform: Annotated[str, Query()] = "mobile",
):
    platform = _validate_platform(platform)
    _ensure_survey_indexes()
    surveys = sentiment_pulse_surveys_collection.find(
        _get_public_survey_match(platform)
    ).sort([("scheduledAt", -1), ("createdAt", -1)])

    return [
        _serialize_survey(survey, include_private_fields=False)
        for survey in surveys
    ]


"""
@desc     Submit a public/mobile Sentiment Pulse survey response
route     POST api/sentiment-pulse/public-surveys/{survey_id}/responses
@access   Public
"""


async def create_public_survey_response(
    survey_id: str,
    data: SentimentPulseSurveyResponse,
):
    platform = _validate_platform(data.platform)
    survey = _get_survey_or_404(survey_id)
    publish_match = _get_public_survey_match(platform)
    scheduled_at = survey.get("scheduledAt")
    if isinstance(scheduled_at, str):
        scheduled_at = _parse_ph_datetime(scheduled_at)
    publish_field = "publishToMobile" if platform == "mobile" else "publishToWebsite"

    if (
        scheduled_at is None
        or scheduled_at > publish_match["scheduledAt"]["$lte"]
        or not survey.get(publish_field)
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Published Sentiment Pulse survey not found",
        )

    if not isinstance(data.answers, dict) or not data.answers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Survey response answers are required",
        )

    created_at = get_ph_datetime()
    response = {
        "id": str(uuid4()),
        "surveyId": survey_id,
        "answers": data.answers,
        "platform": platform,
        "visitorId": str(data.visitorId or "").strip(),
        "region": data.region or "",
        "metadata": data.metadata or {},
        "createdAt": created_at,
    }

    sentiment_pulse_survey_responses_collection.insert_one(response)
    sentiment_pulse_surveys_collection.update_one(
        {"id": survey_id},
        {
            "$inc": {"responseCount": 1},
            "$set": {"updatedAt": created_at},
        },
    )

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={"message": "Sentiment Pulse survey response recorded"},
    )


"""
@desc     Fetch regional Sentiment Pulse data from mobile and website events
route     GET api/sentiment-pulse/regional-analysis
@access   Private
"""


async def fetch_regional_analysis(
    _user_id: Annotated[str, Depends(require_auth)],
    timeRange: str = "last-30-days",
    regions: Optional[str] = None,
):
    selected_regions = _parse_regions(regions)
    start_date = _get_range_start_date(timeRange)
    match = {
        "$or": [
            {"client_platform": {"$in": PUBLIC_SOURCES}},
            {"metadata.clientPlatform": {"$in": PUBLIC_SOURCES}},
            {"metadata.client_platform": {"$in": PUBLIC_SOURCES}},
        ],
    }

    if start_date:
        match["created_at"] = {"$gte": start_date}

    events = health_literacy_analytics_events_collection.find(match)
    regional_counts = {region: Counter() for region in selected_regions}

    for event in events:
        region = _get_event_region(event)

        if region not in selected_regions:
            continue

        sentiment = _get_event_sentiment(event)

        if not sentiment:
            continue

        regional_counts[region].update([sentiment])

    regional_data = []

    for region in selected_regions:
        sentiment_counts = regional_counts[region]
        total_responses = sum(sentiment_counts.values())

        if total_responses == 0:
            continue

        dominant_sentiment = sentiment_counts.most_common(1)[0][0]

        regional_data.append(
            {
                "region": region,
                "dominantSentiment": dominant_sentiment,
                "sentimentBreakdown": _build_sentiment_breakdown(
                    sentiment_counts,
                    total_responses,
                ),
                "responses": total_responses,
            }
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "regions": regional_data,
            "sources": PUBLIC_SOURCES,
            "updatedAt": get_ph_datetime().isoformat(),
        },
    )
