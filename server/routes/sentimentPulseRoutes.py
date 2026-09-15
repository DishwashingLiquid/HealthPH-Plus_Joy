from fastapi import APIRouter

from controllers.sentimentPulseController import (
    create_public_survey_response,
    create_survey,
    delete_survey,
    fetch_public_surveys,
    fetch_regional_analysis,
    fetch_survey_results,
    fetch_surveys,
    fetch_summary,
    schedule_survey,
    update_survey,
)


router = APIRouter()

# GET       /sentiment-pulse/summary (same admin access as the survey list)
router.add_api_route("/summary", methods=["GET"], endpoint=fetch_summary)

# GET       /sentiment-pulse/surveys
router.add_api_route(
    "/surveys",
    methods=["GET"],
    endpoint=fetch_surveys,
)

# POST      /sentiment-pulse/surveys
router.add_api_route(
    "/surveys",
    methods=["POST"],
    endpoint=create_survey,
)

# PATCH     /sentiment-pulse/surveys/{survey_id}
router.add_api_route(
    "/surveys/{survey_id}",
    methods=["PATCH"],
    endpoint=update_survey,
)

# DELETE    /sentiment-pulse/surveys/{survey_id}
router.add_api_route(
    "/surveys/{survey_id}",
    methods=["DELETE"],
    endpoint=delete_survey,
)

# GET       /sentiment-pulse/surveys/{survey_id}/results
router.add_api_route(
    "/surveys/{survey_id}/results",
    methods=["GET"],
    endpoint=fetch_survey_results,
)

# PATCH     /sentiment-pulse/surveys/{survey_id}/schedule
router.add_api_route(
    "/surveys/{survey_id}/schedule",
    methods=["PATCH"],
    endpoint=schedule_survey,
)

# GET       /sentiment-pulse/public-surveys
router.add_api_route(
    "/public-surveys",
    methods=["GET"],
    endpoint=fetch_public_surveys,
)

# POST      /sentiment-pulse/public-surveys/{survey_id}/responses
router.add_api_route(
    "/public-surveys/{survey_id}/responses",
    methods=["POST"],
    endpoint=create_public_survey_response,
)

# GET       /sentiment-pulse/regional-analysis
router.add_api_route(
    "/regional-analysis",
    methods=["GET"],
    endpoint=fetch_regional_analysis,
)
