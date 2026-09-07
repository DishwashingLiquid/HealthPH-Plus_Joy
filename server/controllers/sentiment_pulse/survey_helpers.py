from datetime import datetime, timedelta, timezone
import re
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, status
from pymongo import ReturnDocument

from helpers.miscHelpers import get_ph_datetime

from .constants import (
    EMPTY_SENTIMENT_BREAKDOWN,
    PUBLIC_PLATFORMS,
    application_settings_collection,
    survey_responses_collection,
    surveys_collection,
)


DISPLAY_SEQUENCE_SETTINGS_ID = "sentiment_pulse_display_sequences"
SURVEY_DISPLAY_ID_PATTERN = re.compile(r"^SUR-(\d+)$")
QUESTION_DISPLAY_ID_PATTERN = re.compile(r"^Q-SUR(\d+)-(\d+)$")


def format_survey_display_id(sequence: int) -> str:
    return f"SUR-{sequence:05d}"


def format_question_display_id(survey_sequence: int, sequence: int) -> str:
    return f"Q-SUR{survey_sequence:05d}-{sequence:02d}"


def get_display_sequence(survey: dict) -> int:
    sequence = survey.get("displaySequence")
    if isinstance(sequence, int) and sequence > 0:
        return sequence

    match = SURVEY_DISPLAY_ID_PATTERN.match(str(survey.get("displayId") or ""))
    return int(match.group(1)) if match else 0


def get_question_display_sequence(question: dict, survey_sequence: int) -> int:
    match = QUESTION_DISPLAY_ID_PATTERN.match(str(question.get("displayId") or ""))
    if not match or int(match.group(1)) != survey_sequence:
        return 0

    return int(match.group(2))


def initialize_display_sequence_settings() -> None:
    """Ensure the singleton settings document is never behind stored surveys."""
    highest_sequence = 0
    for survey in surveys_collection.find({}, {"displaySequence": 1, "displayId": 1}):
        highest_sequence = max(highest_sequence, get_display_sequence(survey))

    application_settings_collection.update_one(
        {"_id": DISPLAY_SEQUENCE_SETTINGS_ID},
        {
            "$setOnInsert": {"kind": "application_settings"},
            "$max": {"nextSentimentPulseSurveyDisplaySequence": highest_sequence + 1},
        },
        upsert=True,
    )


def allocate_survey_display_sequence() -> int:
    """Atomically reserve a survey number; reserved values are never reused."""
    initialize_display_sequence_settings()
    previous = application_settings_collection.find_one_and_update(
        {"_id": DISPLAY_SEQUENCE_SETTINGS_ID},
        {"$inc": {"nextSentimentPulseSurveyDisplaySequence": 1}},
        upsert=True,
        return_document=ReturnDocument.BEFORE,
    )
    if previous:
        return int(previous.get("nextSentimentPulseSurveyDisplaySequence") or 1)

    # The first upsert increments a missing field from zero to one. Reserve 1
    # and correct the stored next value to 2 for subsequent callers.
    application_settings_collection.update_one(
        {"_id": DISPLAY_SEQUENCE_SETTINGS_ID},
        {"$set": {"nextSentimentPulseSurveyDisplaySequence": 2}},
    )
    return 1


def assign_missing_survey_display_id(survey: dict) -> dict:
    if get_display_sequence(survey):
        return survey

    sequence = allocate_survey_display_sequence()
    result = surveys_collection.update_one(
        {"_id": survey["_id"], "displayId": {"$exists": False}},
        {
            "$set": {
                "displaySequence": sequence,
                "displayId": format_survey_display_id(sequence),
            }
        },
    )
    if result.modified_count:
        return {
            **survey,
            "displaySequence": sequence,
            "displayId": format_survey_display_id(sequence),
        }

    return surveys_collection.find_one({"_id": survey["_id"]}) or survey


def backfill_survey_question_display_ids(survey: dict) -> None:
    """Idempotently add immutable display IDs and mutable display positions."""
    survey_sequence = get_display_sequence(survey)
    if not survey_sequence:
        return

    questions = survey.get("questions") or []
    updated_questions = []
    highest_question_sequence = 0
    changed = False

    for position, question in enumerate(questions, start=1):
        updated_question = dict(question)
        question_sequence = get_question_display_sequence(
            updated_question, survey_sequence
        )
        if question_sequence:
            highest_question_sequence = max(highest_question_sequence, question_sequence)
        else:
            highest_question_sequence += 1
            updated_question["displayId"] = format_question_display_id(
                survey_sequence, highest_question_sequence
            )
            changed = True

        if updated_question.get("position") != position:
            updated_question["position"] = position
            changed = True
        updated_questions.append(updated_question)

    next_question_sequence = highest_question_sequence + 1
    if int(survey.get("nextQuestionDisplaySequence") or 1) < next_question_sequence:
        changed = True

    if not changed:
        return

    # The exact old array prevents a background backfill from overwriting an
    # administrator's simultaneous question edit. A later request retries it.
    surveys_collection.update_one(
        {"_id": survey["_id"], "questions": questions},
        {
            "$set": {
                "questions": updated_questions,
                "nextQuestionDisplaySequence": next_question_sequence,
            }
        },
    )


def backfill_missing_display_ids() -> None:
    initialize_display_sequence_settings()
    surveys = surveys_collection.find({}).sort([("createdAt", 1), ("_id", 1)])
    for survey in surveys:
        survey = assign_missing_survey_display_id(survey)
        backfill_survey_question_display_ids(survey)


def ensure_survey_indexes() -> None:
    surveys_collection.create_index(
        [("id", 1)],
        unique=True,
        name="unique_sentiment_pulse_survey_id",
    )
    surveys_collection.create_index(
        [("displayId", 1)],
        unique=True,
        sparse=True,
        name="unique_sentiment_pulse_survey_display_id",
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
    backfill_missing_display_ids()


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
    serialized_survey.pop("displaySequence", None)
    serialized_survey.pop("nextQuestionDisplaySequence", None)
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
    display_sequence = allocate_survey_display_sequence()
    questions, next_question_sequence = normalize_questions_for_create(
        data.questions, display_sequence
    )

    return {
        "id": str(uuid4()),
        "displayId": format_survey_display_id(display_sequence),
        "displaySequence": display_sequence,
        "title": data.title.strip(),
        "subtitle": (data.subtitle or "").strip() or "Draft mobile sentiment survey",
        "target": data.target,
        "questions": questions,
        "nextQuestionDisplaySequence": next_question_sequence,
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

    question_ids = []
    for question in data.questions:
        question_id = str(question.get("id") or question.get("name") or "").strip()
        if not question_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Every survey question must have an ID",
            )
        question_ids.append(question_id)

    if len(question_ids) != len(set(question_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Survey question IDs must be unique",
        )


def normalize_questions_for_create(questions: list[dict], survey_sequence: int):
    normalized_questions = []
    for position, question in enumerate(questions, start=1):
        normalized_question = dict(question)
        normalized_question["displayId"] = format_question_display_id(
            survey_sequence, position
        )
        normalized_question["position"] = position
        normalized_questions.append(normalized_question)

    return normalized_questions, len(normalized_questions) + 1


def normalize_questions_for_update(survey: dict, questions: list[dict]):
    survey_sequence = get_display_sequence(survey)
    existing_by_id = {
        str(question.get("id")): question
        for question in survey.get("questions") or []
        if question.get("id")
    }
    new_questions = [
        question
        for question in questions
        if not existing_by_id.get(str(question.get("id")))
        or not existing_by_id[str(question.get("id"))].get("displayId")
    ]
    next_sequence = int(survey.get("nextQuestionDisplaySequence") or 1)
    if new_questions:
        previous = surveys_collection.find_one_and_update(
            {"id": survey["id"]},
            {"$inc": {"nextQuestionDisplaySequence": len(new_questions)}},
            return_document=ReturnDocument.BEFORE,
        ) or survey
        next_sequence = int(previous.get("nextQuestionDisplaySequence") or next_sequence)

    normalized_questions = []
    for position, question in enumerate(questions, start=1):
        normalized_question = dict(question)
        previous_question = existing_by_id.get(str(question.get("id")))
        if previous_question and previous_question.get("displayId"):
            normalized_question["displayId"] = previous_question["displayId"]
        else:
            normalized_question["displayId"] = format_question_display_id(
                survey_sequence, next_sequence
            )
            next_sequence += 1
        normalized_question["position"] = position
        normalized_questions.append(normalized_question)

    return normalized_questions


def build_survey_update_document(data, current_user: Optional[dict], survey: dict) -> dict:
    updated_at = get_ph_datetime()

    return {
        "title": data.title.strip(),
        "subtitle": (data.subtitle or "").strip() or "Draft mobile sentiment survey",
        "target": data.target,
        "questions": normalize_questions_for_update(survey, data.questions),
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
