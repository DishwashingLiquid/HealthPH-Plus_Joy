from fastapi import APIRouter

from controllers.analyticsEntryController import (
    fetch_analytics_entries,
    process_analytics_entries,
)

router = APIRouter()

#GET /analytics-entries
router.add_api_route("/", methods=["GET"], endpoint=fetch_analytics_entries)

#POST /analytics-entries/process
router.add_api_route("/process", methods=["POST"], endpoint=process_analytics_entries)