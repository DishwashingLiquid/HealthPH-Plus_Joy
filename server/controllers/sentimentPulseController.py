from collections import Counter
from typing import Optional

from fastapi import Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from typing_extensions import Annotated

from helpers.miscHelpers import get_ph_datetime
from middleware.requireAuth import require_auth
from middleware.requireRole import require_role
from models.sentimentPulseSurvey import (
    SentimentPulseSurveyDraft,
    SentimentPulseSurveyResponse,
    SentimentPulseSurveySchedule,
)

from controllers.sentiment_pulse.constants import (
    PUBLIC_SOURCES,
    health_literacy_analytics_events_collection,
    sentiment_pulse_survey_responses_collection,
    sentiment_pulse_surveys_collection,
)
from controllers.sentiment_pulse.regional_analysis import (
    build_sentiment_breakdown,
    get_event_region,
    get_event_sentiment,
    get_range_start_date,
    parse_regions,
)
from controllers.sentiment_pulse.results_aggregation import build_question_results
from controllers.sentiment_pulse.survey_helpers import (
    build_survey_update_document,
    build_public_response_document,
    build_survey_document,
    ensure_survey_indexes,
    get_public_survey_match,
    get_survey_or_404,
    get_survey_status,
    get_user_snapshot,
    parse_ph_datetime,
    serialize_survey,
    validate_survey_payload,
    validate_platform,
)


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
    ensure_survey_indexes()
    surveys = sentiment_pulse_surveys_collection.find({}).sort([("createdAt", -1)])

    return [serialize_survey(survey) for survey in surveys]


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
    survey = get_survey_or_404(survey_id)
    serialized_survey = serialize_survey(survey)
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
                build_question_results(question, index, responses)
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
    ensure_survey_indexes()
    validate_survey_payload(data)

    survey = build_survey_document(data, current_user)
    sentiment_pulse_surveys_collection.insert_one(survey)

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "message": "Sentiment Pulse survey draft created successfully",
            "survey": serialize_survey(survey),
        },
    )


"""
@desc     Update a Sentiment Pulse survey
route     PATCH api/sentiment-pulse/surveys/{survey_id}
@access   Private
"""


async def update_survey(
    survey_id: str,
    data: SentimentPulseSurveyDraft,
    current_user: Annotated[
        dict, Depends(require_role(["ADMIN", "SUPERADMIN"]))
    ],
):
    survey = get_survey_or_404(survey_id)
    validate_survey_payload(data)

    update = build_survey_update_document(data, current_user)
    sentiment_pulse_surveys_collection.update_one(
        {"id": survey_id},
        {"$set": update},
    )
    sentiment_pulse_survey_responses_collection.delete_many({"surveyId": survey_id})
    updated_survey = {**survey, **update}

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "message": "Sentiment Pulse survey updated successfully",
            "survey": serialize_survey(updated_survey),
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
    scheduled_at = parse_ph_datetime(data.scheduledAt)
    survey = get_survey_or_404(survey_id)

    if get_survey_status(survey) != "Draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft surveys can be scheduled",
        )

    updated_at = get_ph_datetime()
    update = {
        "scheduledAt": scheduled_at,
        "updatedAt": updated_at,
        "updatedBy": get_user_snapshot(current_user),
    }

    sentiment_pulse_surveys_collection.update_one(
        {"id": survey_id},
        {"$set": update},
    )
    updated_survey = {**survey, **update}

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "message": "Sentiment Pulse survey scheduled successfully",
            "survey": serialize_survey(updated_survey),
        },
    )


"""
@desc     Delete a Sentiment Pulse survey
route     DELETE api/sentiment-pulse/surveys/{survey_id}
@access   Private
"""


async def delete_survey(
    survey_id: str,
    _current_user: Annotated[
        dict, Depends(require_role(["ADMIN", "SUPERADMIN"]))
    ],
):
    get_survey_or_404(survey_id)
    sentiment_pulse_surveys_collection.delete_one({"id": survey_id})
    sentiment_pulse_survey_responses_collection.delete_many({"surveyId": survey_id})

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": "Sentiment Pulse survey deleted successfully"},
    )


"""
@desc     Fetch published Sentiment Pulse surveys for mobile or website
route     GET api/sentiment-pulse/public-surveys
@access   Public
"""


async def fetch_public_surveys(
    platform: Annotated[str, Query()] = "mobile",
):
    platform = validate_platform(platform)
    ensure_survey_indexes()
    surveys = sentiment_pulse_surveys_collection.find(
        get_public_survey_match(platform)
    ).sort([("scheduledAt", -1), ("createdAt", -1)])

    return [serialize_survey(survey, include_private_fields=False) for survey in surveys]


"""
@desc     Submit a public/mobile Sentiment Pulse survey response
route     POST api/sentiment-pulse/public-surveys/{survey_id}/responses
@access   Public
"""


async def create_public_survey_response(
    survey_id: str,
    data: SentimentPulseSurveyResponse,
):
    platform = validate_platform(data.platform)
    survey = get_survey_or_404(survey_id)
    publish_match = get_public_survey_match(platform)
    scheduled_at = survey.get("scheduledAt")

    if isinstance(scheduled_at, str):
        scheduled_at = parse_ph_datetime(scheduled_at)

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

    response = build_public_response_document(survey_id, data, platform)
    sentiment_pulse_survey_responses_collection.insert_one(response)
    sentiment_pulse_surveys_collection.update_one(
        {"id": survey_id},
        {
            "$inc": {"responseCount": 1},
            "$set": {"updatedAt": response["createdAt"]},
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
    selected_regions = parse_regions(regions)
    start_date = get_range_start_date(timeRange)
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
        region = get_event_region(event)

        if region not in selected_regions:
            continue

        sentiment = get_event_sentiment(event)

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
                "sentimentBreakdown": build_sentiment_breakdown(
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
