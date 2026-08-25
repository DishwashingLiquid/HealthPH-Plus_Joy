from fastapi import APIRouter

from controllers.analyticsEntryController import fetch_analytics_entries


router = APIRouter()

#GET /analytics-entries
router.add_api_route("/", methods=["GET"], endpoint=fetch_analytics_entries)