from copy import deepcopy
from datetime import datetime, timedelta, timezone
import re
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


# Retain the existing settings document and its next value. The old display-ID
# allocator may already have consumed values, so reusing it prevents a reset.
APPLICATION_ID_SEQUENCE_SETTINGS_ID = "sentiment_pulse_display_sequences"
APPLICATION_ID_SEQUENCE_FIELD = "nextSentimentPulseSurveyDisplaySequence"
SURVEY_ID_PATTERN = re.compile(r"^SUR-(\d+)$")
QUESTION_ID_PATTERN = re.compile(r"^Q-SUR(\d+)-(\d+)$")


def format_survey_id(sequence: int) -> str:
    return f"SUR-{sequence:05d}"


def format_question_id(survey_sequence: int, sequence: int) -> str:
    return f"Q-SUR{survey_sequence:05d}-{sequence:02d}"


def get_application_survey_sequence(survey: dict) -> int:
    """Only an actual SUR-* application id marks a new-format survey."""
    match = SURVEY_ID_PATTERN.match(str(survey.get("id") or ""))
    return int(match.group(1)) if match else 0


def _historic_survey_sequence(survey: dict) -> int:
    """Read old display fields only to preserve already consumed numbers."""
    sequence = get_application_survey_sequence(survey)
    if isinstance(survey.get("displaySequence"), int):
        sequence = max(sequence, survey["displaySequence"])
    match = SURVEY_ID_PATTERN.match(str(survey.get("displayId") or ""))
    return max(sequence, int(match.group(1)) if match else 0)


def _initialize_survey_id_sequence() -> None:
    highest = 0
    for survey in surveys_collection.find({}, {"id": 1, "displayId": 1, "displaySequence": 1}):
        highest = max(highest, _historic_survey_sequence(survey))
    # Create first, then use $max separately: MongoDB forbids targeting the
    # same field with $setOnInsert and $max in one update. $max never rolls a
    # concurrent allocation back.
    application_settings_collection.update_one(
        {"_id": APPLICATION_ID_SEQUENCE_SETTINGS_ID},
        {"$setOnInsert": {"kind": "application_settings"}},
        upsert=True,
    )
    application_settings_collection.update_one(
        {"_id": APPLICATION_ID_SEQUENCE_SETTINGS_ID},
        {"$max": {APPLICATION_ID_SEQUENCE_FIELD: highest + 1}},
    )


def allocate_survey_id_sequence() -> int:
    """Atomically reserve a survey number. Reservations are never recycled."""
    while True:
        _initialize_survey_id_sequence()
        previous = application_settings_collection.find_one_and_update(
            {"_id": APPLICATION_ID_SEQUENCE_SETTINGS_ID},
            {"$inc": {APPLICATION_ID_SEQUENCE_FIELD: 1}},
            return_document=ReturnDocument.BEFORE,
        )
        if previous and isinstance(previous.get(APPLICATION_ID_SEQUENCE_FIELD), int):
            return previous[APPLICATION_ID_SEQUENCE_FIELD]


def _highest_question_sequence(survey: dict, survey_sequence: int) -> int:
    highest = 0
    for question in survey.get("questions") or []:
        for candidate in (question.get("id"), question.get("displayId")):
            match = QUESTION_ID_PATTERN.match(str(candidate or ""))
            if match and int(match.group(1)) == survey_sequence:
                highest = max(highest, int(match.group(2)))
    return highest


def _initialize_question_id_sequence(survey: dict) -> None:
    survey_sequence = get_application_survey_sequence(survey)
    if not survey_sequence:
        return
    next_sequence = _highest_question_sequence(survey, survey_sequence) + 1
    if isinstance(survey.get("nextQuestionDisplaySequence"), int):
        next_sequence = max(next_sequence, survey["nextQuestionDisplaySequence"])
    surveys_collection.update_one(
        {"id": survey["id"]}, {"$max": {"nextQuestionIdSequence": next_sequence}}
    )


def allocate_question_id_sequences(survey: dict, count: int) -> int:
    """Reserve a contiguous, permanent sequence range on the survey document."""
    if count < 1:
        return 0
    _initialize_question_id_sequence(survey)
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
    return int(previous.get("nextQuestionIdSequence") or 1)


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
    scheduled_at = survey.get("scheduledAt")
    if not scheduled_at:
        return "Draft"
    if isinstance(scheduled_at, str):
        scheduled_at = parse_ph_datetime(scheduled_at)
    return "Published" if scheduled_at <= (now or get_ph_datetime()) else "Scheduled"


def serialize_survey(survey: dict, include_private_fields: bool = True) -> dict:
    serialized = dict(survey)
    serialized.pop("_id", None)
    # Historic display fields stay in MongoDB, but are no longer serialized.
    for field in ("displayId", "displaySequence", "nextQuestionDisplaySequence", "nextQuestionIdSequence"):
        serialized.pop(field, None)
    if isinstance(serialized.get("questions"), list):
        serialized["questions"] = [
            {key: value for key, value in question.items() if key != "displayId"}
            if isinstance(question, dict)
            else question
            for question in serialized["questions"]
        ]
    serialized["status"] = get_survey_status(survey)
    serialized["createdAt"] = serialize_datetime(survey.get("createdAt"))
    serialized["updatedAt"] = serialize_datetime(survey.get("updatedAt"))
    serialized["scheduledAt"] = serialize_datetime(survey.get("scheduledAt"))
    serialized["publishedAt"] = serialized["scheduledAt"] if serialized["status"] == "Published" else ""
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


def _without_display_id(question: dict) -> dict:
    normalized = dict(question)
    normalized.pop("displayId", None)
    return normalized


def _sync_survey_json_names(survey_json: dict, id_mapping: dict[str, str]) -> dict:
    """Keep SurveyJS names and submitted answer keys equal to question IDs."""
    normalized = deepcopy(survey_json or {})

    def visit(value):
        if isinstance(value, dict):
            if isinstance(value.get("name"), str) and value["name"] in id_mapping:
                value["name"] = id_mapping[value["name"]]
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(normalized)
    return normalized


def _normalize_new_survey_questions(questions: list[dict], survey_sequence: int):
    normalized_questions, id_mapping = [], {}
    for position, question in enumerate(questions, start=1):
        assigned_id = format_question_id(survey_sequence, position)
        supplied_id = _question_input_id(question)
        if supplied_id:
            id_mapping[supplied_id] = assigned_id
        normalized = _without_display_id(question)
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
        "surveyJson": _sync_survey_json_names(data.surveyJson, id_mapping),
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


def _normalize_legacy_questions(survey: dict, questions: list[dict]):
    existing = {_question_input_id(question): question for question in survey.get("questions") or []}
    normalized_questions, id_mapping = [], {}
    for question in questions:
        question_id = _question_input_id(question)
        if not question_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Legacy survey questions must retain a client-generated question ID")
        normalized = _without_display_id(question)
        normalized["id"] = question_id
        if question_id in existing and existing[question_id].get("name"):
            # Legacy SurveyJS names can be response keys in their own right.
            # Preserve them even when the dashboard rebuilds surveyJson.
            normalized["name"] = existing[question_id]["name"]
            id_mapping[question_id] = normalized["name"]
        elif "name" in normalized:
            normalized["name"] = question_id
        # Preserve withdrawn fields if an edit includes an existing question.
        if question_id in existing and "displayId" in existing[question_id]:
            normalized["displayId"] = existing[question_id]["displayId"]
        normalized_questions.append(normalized)
        id_mapping.setdefault(question_id, question_id)
    return normalized_questions, id_mapping


def _normalize_new_format_questions(survey: dict, questions: list[dict]):
    survey_sequence = get_application_survey_sequence(survey)
    existing = {str(question.get("id")): question for question in survey.get("questions") or []}
    new_questions = [question for question in questions if _question_input_id(question) not in existing]
    next_sequence = allocate_question_id_sequences(survey, len(new_questions))
    normalized_questions, id_mapping = [], {}
    for question in questions:
        supplied_id = _question_input_id(question)
        assigned_id = supplied_id if supplied_id in existing else format_question_id(survey_sequence, next_sequence)
        if supplied_id not in existing:
            next_sequence += 1
        normalized = _without_display_id(question)
        normalized["id"] = assigned_id
        normalized["name"] = assigned_id
        if supplied_id in existing and "displayId" in existing[supplied_id]:
            normalized["displayId"] = existing[supplied_id]["displayId"]
        normalized_questions.append(normalized)
        if supplied_id:
            id_mapping[supplied_id] = assigned_id
    return normalized_questions, id_mapping


def build_survey_update_document(data, current_user: Optional[dict], survey: dict) -> dict:
    if get_application_survey_sequence(survey):
        questions, id_mapping = _normalize_new_format_questions(survey, data.questions)
    else:
        questions, id_mapping = _normalize_legacy_questions(survey, data.questions)
    # Do not reset publication, counters, responses, or analytics when editing.
    return {
        "title": data.title.strip(),
        "subtitle": (data.subtitle or "").strip() or "Draft mobile sentiment survey",
        "target": data.target, "questions": questions,
        "surveyJson": _sync_survey_json_names(data.surveyJson, id_mapping),
        "updatedAt": get_ph_datetime(), "updatedBy": get_user_snapshot(current_user),
    }


def build_public_response_document(
    survey_id: str,
    data,
    platform: str,
    authenticated_mobile_user: Optional[dict] = None,
) -> dict:
    document = {
        "id": str(uuid4()), "surveyId": survey_id, "answers": data.answers,
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
