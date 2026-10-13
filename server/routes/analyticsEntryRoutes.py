from fastapi import APIRouter

from controllers.analyticsEntryController import (
    fetch_analytics_entries,
    fetch_self_report_language_summary,
    process_analytics_entries,
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

#POST /analytics-entries/process
router.add_api_route("/process", methods=["POST"], endpoint=process_analytics_entries)
