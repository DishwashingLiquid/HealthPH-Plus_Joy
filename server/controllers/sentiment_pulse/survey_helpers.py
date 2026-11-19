from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, status
from pymongo import ReturnDocument

from helpers.miscHelpers import get_ph_datetime
from controllers.dashboard_regions import USER_REGION_PATHS, dashboard_region

from .constants import (
    EMPTY_SENTIMENT_BREAKDOWN,
    PUBLIC_PLATFORMS,
    application_settings_collection,
    mobile_users_collection,
    survey_responses_collection,
    surveys_collection,
)
from .survey_ids import (
    QUESTION_ID_PATTERN, SURVEY_ID_PATTERN, format_answer_id,
    format_question_id, format_survey_id, sync_survey_json_names,
)


APPLICATION_ID_SEQUENCE_SETTINGS_ID = "sentiment_pulse_sequences"
APPLICATION_ID_SEQUENCE_FIELD = "nextSurveySequence"


def get_application_survey_sequence(survey: dict) -> int:
    """Extract the sequence from the current survey identifier."""
    match = SURVEY_ID_PATTERN.match(str(survey.get("id") or ""))
    return int(match.group(1)) if match else 0


def allocate_survey_id_sequence() -> int:
    """Atomically allocate a new survey ID from the current sequence."""
    application_settings_collection.update_one(
        {"_id": APPLICATION_ID_SEQUENCE_SETTINGS_ID},
        {"$setOnInsert": {APPLICATION_ID_SEQUENCE_FIELD: 1}}, upsert=True,
    )
    previous = application_settings_collection.find_one_and_update(
        {"_id": APPLICATION_ID_SEQUENCE_SETTINGS_ID, APPLICATION_ID_SEQUENCE_FIELD: {"$gte": 1}},
        {"$inc": {APPLICATION_ID_SEQUENCE_FIELD: 1}}, return_document=ReturnDocument.BEFORE,
    )
    if previous is None:
        raise HTTPException(status_code=503, detail="Survey ID sequence is unavailable")
    return previous[APPLICATION_ID_SEQUENCE_FIELD]


def allocate_question_id_sequences(survey: dict, count: int) -> int:
    """Reserve a contiguous, permanent sequence range on the survey document."""
    if count < 1:
        return 0
    previous = surveys_collection.find_one_and_update(
        {"id": survey["id"]},
        {"$inc": {"nextQuestionIdSequence": count}},
        return_document=ReturnDocument.BEFORE,
    )
    if not previous:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Survey changed before question IDs could be reserved; reload and try again",
        )
    return previous["nextQuestionIdSequence"]


def ensure_survey_indexes() -> None:
    surveys_collection.create_index([("id", 1)], unique=True, name="unique_sentiment_pulse_survey_id")
    surveys_collection.create_index(
        [("scheduledAt", 1), ("publishToMobile", 1), ("publishToWebsite", 1)],
        name="sentiment_pulse_public_publish_lookup",
    )
    survey_responses_collection.create_index(
        [("surveyId", 1), ("createdAt", -1)], name="sentiment_pulse_response_lookup"
    )
    mobile_users_collection.create_index(
        [("id", 1)], name="sentiment_pulse_mobile_user_lookup"
    )


def serialize_datetime(value) -> str:
    return value.isoformat() if isinstance(value, datetime) else str(value or "")


def parse_ph_datetime(value: str) -> datetime:
    try:
        parsed_datetime = datetime.fromisoformat(str(value or "").strip())
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="scheduledAt must be a valid ISO date and time")
    if parsed_datetime.tzinfo:
        return parsed_datetime.astimezone(timezone(timedelta(hours=8))).replace(tzinfo=None)
    return parsed_datetime


def get_survey_status(survey: dict, now: Optional[datetime] = None) -> str:
    if survey.get("endedAt"):
        return "Ended"

    scheduled_at = survey.get("scheduledAt")
    if not scheduled_at:
        return "Draft"
    return "Published" if scheduled_at <= (now or get_ph_datetime()) else "Scheduled"


def serialize_survey(survey: dict, include_private_fields: bool = True) -> dict:
    serialized = dict(survey)
    serialized.pop("_id", None)
    for field in ("nextQuestionIdSequence", "nextAnswerIdSequences"):
        serialized.pop(field, None)
    serialized["status"] = get_survey_status(survey)
    serialized["createdAt"] = serialize_datetime(survey.get("createdAt"))
    serialized["updatedAt"] = serialize_datetime(survey.get("updatedAt"))
    serialized["scheduledAt"] = serialize_datetime(survey.get("scheduledAt"))
    serialized["endedAt"] = serialize_datetime(survey.get("endedAt"))
    serialized["publishedAt"] = (
        serialized["scheduledAt"]
        if serialized["status"] in {"Published", "Ended"}
        else ""
    )
    serialized["responses"] = int(survey.get("responseCount") or 0)
    serialized["sentimentBreakdown"] = survey.get("sentimentBreakdown", dict(EMPTY_SENTIMENT_BREAKDOWN))
    serialized["dominantSentiment"] = survey.get("dominantSentiment") or "Neutral"
    if not include_private_fields:
        for field in ("createdBy", "updatedBy", "responseCount"):
            serialized.pop(field, None)
    return serialized


def get_survey_or_404(survey_id: str) -> dict:
    ensure_survey_indexes()
    survey = surveys_collection.find_one({"id": survey_id})
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sentiment Pulse survey not found")
    return survey


def validate_platform(platform: str) -> str:
    normalized = str(platform or "").strip().lower()
    if normalized not in PUBLIC_PLATFORMS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="platform must be mobile or website")
    return normalized


def get_public_survey_match(platform: str) -> dict:
    return {
        "scheduledAt": {"$lte": get_ph_datetime()},
        "endedAt": {"$exists": False},
        "publishToMobile" if platform == "mobile" else "publishToWebsite": True,
    }


def get_user_snapshot(current_user: Optional[dict]) -> dict:
    if not current_user:
        return {"id": "", "name": ""}
    return {
        "id": str(current_user.get("_id", "")),
        "name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip(),
    }


def _question_input_id(question: dict) -> str:
    return str(question.get("id") or question.get("name") or "").strip()


def _normalize_new_survey_questions(questions: list[dict], survey_sequence: int):
    normalized_questions, id_mapping = [], {}
    for position, question in enumerate(questions, start=1):
        assigned_id = format_question_id(survey_sequence, position)
        supplied_id = _question_input_id(question)
        if supplied_id:
            id_mapping[supplied_id] = assigned_id
        normalized = dict(question)
        normalized["id"] = assigned_id
        normalized["name"] = assigned_id
        normalized_questions.append(normalized)
    return normalized_questions, id_mapping


def build_survey_document(data, current_user: Optional[dict]) -> dict:
    created_at = get_ph_datetime()
    survey_sequence = allocate_survey_id_sequence()
    questions, id_mapping = _normalize_new_survey_questions(data.questions, survey_sequence)
    return {
        "id": format_survey_id(survey_sequence),
        "title": data.title.strip(),
        "subtitle": (data.subtitle or "").strip() or "Draft mobile sentiment survey",
        "target": data.target,
        "questions": questions,
        "nextQuestionIdSequence": len(questions) + 1,
        "surveyJson": sync_survey_json_names(data.surveyJson, id_mapping),
        "publishToMobile": True, "publishToWebsite": True, "scheduledAt": None,
        "responseCount": 0, "sentimentBreakdown": dict(EMPTY_SENTIMENT_BREAKDOWN),
        "dominantSentiment": "Neutral", "createdAt": created_at, "updatedAt": created_at,
        "createdBy": get_user_snapshot(current_user),
    }


def validate_survey_payload(data) -> None:
    if not data.title.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please enter a survey title")
    if data.target < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Set a target response count of at least 1")
    if not data.questions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Add at least one survey question")
    supplied_ids = [question_id for question_id in (_question_input_id(question) for question in data.questions) if question_id]
    if len(supplied_ids) != len(set(supplied_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Survey question IDs must be unique")


def _normalize_new_format_questions(survey: dict, questions: list[dict]):
    survey_sequence = get_application_survey_sequence(survey)
    if not survey_sequence:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Invalid survey ID")
    existing = {str(question.get("id")): question for question in survey.get("questions") or []}
    new_questions = [question for question in questions if _question_input_id(question) not in existing]
    next_sequence = allocate_question_id_sequences(survey, len(new_questions))
    normalized_questions, id_mapping = [], {}
    for question in questions:
        supplied_id = _question_input_id(question)
        assigned_id = supplied_id if supplied_id in existing else format_question_id(survey_sequence, next_sequence)
        if supplied_id not in existing:
            next_sequence += 1
        normalized = dict(question)
        normalized["id"] = assigned_id
        normalized["name"] = assigned_id
        normalized_questions.append(normalized)
        if supplied_id:
            id_mapping[supplied_id] = assigned_id
    return normalized_questions, id_mapping


def build_survey_update_document(data, current_user: Optional[dict], survey: dict) -> dict:
    questions, id_mapping = _normalize_new_format_questions(survey, data.questions)
    # Do not reset publication, counters, responses, or analytics when editing.
    return {
        "title": data.title.strip(),
        "subtitle": (data.subtitle or "").strip() or "Draft mobile sentiment survey",
        "target": data.target, "questions": questions,
        "surveyJson": sync_survey_json_names(data.surveyJson, id_mapping),
        "updatedAt": get_ph_datetime(), "updatedBy": get_user_snapshot(current_user),
    }


def build_public_response_document(
    survey: dict,
    data,
    platform: str,
    authenticated_mobile_user: Optional[dict] = None,
) -> dict:
    survey_id = survey["id"]
    if not get_application_survey_sequence(survey):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Invalid survey ID")
    question_ids = {question["id"] for question in survey.get("questions") or []}
    if any(not QUESTION_ID_PATTERN.fullmatch(question_id) or
           not question_id.startswith(survey_id + "-Q") for question_id in question_ids):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Invalid question ID")
    invalid = set(data.answers) - question_ids
    if invalid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Answers contain unknown question IDs")
    answer_ids = {}
    for question_id in data.answers:
        previous = surveys_collection.find_one_and_update(
            {"id": survey_id},
            {"$inc": {f"nextAnswerIdSequences.{question_id}": 1}},
            return_document=ReturnDocument.BEFORE,
        )
        if not previous:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Survey changed before answer IDs could be reserved")
        sequence = (previous.get("nextAnswerIdSequences") or {}).get(question_id, 0) + 1
        answer_ids[question_id] = format_answer_id(question_id, sequence)
    document = {
        "submissionId": str(uuid4()), "surveyId": survey_id,
        "answers": data.answers, "answerIds": answer_ids,
        "platform": platform, "visitorId": str(data.visitorId or "").strip(),
        "region": data.region or "", "metadata": data.metadata or {},
        "createdAt": get_ph_datetime(),
    }
    if authenticated_mobile_user:
        # The verified mobile token, never a client-supplied ID, establishes this link.
        document["mobileUserId"] = authenticated_mobile_user["id"]
        document["accountLinkVerified"] = True
        document["region"] = dashboard_region(
            authenticated_mobile_user, USER_REGION_PATHS
        ) or ""
    return document
