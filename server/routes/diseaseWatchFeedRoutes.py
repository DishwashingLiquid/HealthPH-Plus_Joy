from fastapi import APIRouter

from controllers.diseaseWatchFeedController import (
    create_mobile_self_report,
    export_mobile_self_reports,
    fetch_mobile_self_reports_map_pins,
    fetch_mobile_self_reports_mine,
    fetch_mobile_user_analytics_summary,
)
from controllers.regionalAlertsController import (
    cancel_regional_alert,
    fetch_regional_alert_settings,
    fetch_regional_alerts,
    fetch_regional_summaries,
    save_regional_alert_settings,
)

mobile_self_reports_router = APIRouter()

# POST      /mobile/self-reports
mobile_self_reports_router.add_api_route(
    "/self-reports",
    methods=["POST"],
    endpoint=create_mobile_self_report,
)

# Saved, admin-reviewed reporting and manual regional mobile alerts.
mobile_self_reports_router.add_api_route(
    "/disease-watch-feed/regional-summaries", methods=["GET"], endpoint=fetch_regional_summaries
)
mobile_self_reports_router.add_api_route(
    "/disease-watch-feed/alerts", methods=["GET"], endpoint=fetch_regional_alerts
)
# Authenticated dashboard automation controls. These are deliberately not
# mobile-facing inbox routes.
mobile_self_reports_router.add_api_route(
    "/disease-watch-feed/alert-settings", methods=["GET"], endpoint=fetch_regional_alert_settings
)
mobile_self_reports_router.add_api_route(
    "/disease-watch-feed/alert-settings", methods=["PUT"], endpoint=save_regional_alert_settings
)
mobile_self_reports_router.add_api_route(
    "/disease-watch-feed/alerts/{alert_id}/cancel", methods=["PATCH"], endpoint=cancel_regional_alert
)

# GET       /mobile/self-reports/mine
mobile_self_reports_router.add_api_route(
    "/self-reports/mine",
    methods=["GET"],
    endpoint=fetch_mobile_self_reports_mine,
)

# GET       /mobile/self-reports/map-pins
mobile_self_reports_router.add_api_route(
    "/self-reports/map-pins",
    methods=["GET"],
    endpoint=fetch_mobile_self_reports_map_pins,
)

# GET       /mobile/self-reports/export
mobile_self_reports_router.add_api_route(
    "/self-reports/export",
    methods=["GET"],
    endpoint=export_mobile_self_reports,
)

# GET       /mobile/disease-watch-feed/user-analytics
mobile_self_reports_router.add_api_route(
    "/disease-watch-feed/user-analytics",
    methods=["GET"],
    endpoint=fetch_mobile_user_analytics_summary,
)
