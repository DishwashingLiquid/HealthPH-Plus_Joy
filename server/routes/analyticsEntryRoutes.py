from fastapi import APIRouter

from controllers.analyticsEntryController import (
    fetch_analytics_entries,
    fetch_analytics_map_points,
    fetch_self_report_language_summary,
    process_analytics_entries,
    fetch_surveillance_summary,
    fetch_nlp_entity_summary,
)

router = APIRouter()

#GET /analytics-entries
router.add_api_route("/", methods=["GET"], endpoint=fetch_analytics_entries)

#GET /analytics-entries/language-summary
router.add_api_route(
    "/language-summary",
    methods=["GET"],
    endpoint=fetch_self_report_language_summary,
)

#GET /analytics-entries/map-points
router.add_api_route(
    "/map-points",
    methods=["GET"],
    endpoint=fetch_analytics_map_points,
)

#POST /analytics-entries/process
router.add_api_route("/process", methods=["POST"], endpoint=process_analytics_entries)

# GET /analytics-entries/surveillance-summary
router.add_api_route(
    "/surveillance-summary",
    methods=["GET"],
    endpoint=fetch_surveillance_summary,
)

# GET /analytics-entries/nlp-entity-summary
router.add_api_route(
    "/nlp-entity-summary",
    methods=["GET"],
    endpoint=fetch_nlp_entity_summary,
)