from fastapi import APIRouter
from controllers.activityLogController import (
    create_activity_log,
    fetch_account_analytics,
    fetch_activity_logs,
    delete_all_activity_logs,
)

router = APIRouter()

# GET       /activity-logs/
router.add_api_route("", methods=["GET"], endpoint=fetch_activity_logs)

# GET       /account-analytics/
router.add_api_route("/account-analytics", methods=["GET"], endpoint=fetch_account_analytics)
    
# POST      /activity-logs/
router.add_api_route("", methods=["POST"], endpoint=create_activity_log)

# DELETE    /activity-logs/
router.add_api_route("", methods=["DELETE"], endpoint=delete_all_activity_logs)