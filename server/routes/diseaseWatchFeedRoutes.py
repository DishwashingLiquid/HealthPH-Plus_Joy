from fastapi import APIRouter

from controllers.diseaseWatchFeedController import (
    create_mobile_self_report,
    export_mobile_self_reports,
    fetch_mobile_alerts,
    fetch_mobile_filter_options,
    fetch_mobile_regional_coverage,
    fetch_mobile_self_reports_map_pins,
    fetch_mobile_self_reports_mine,
    fetch_mobile_top_metrics,
    fetch_mobile_user_analytics_summary,
)

router = APIRouter()
mobile_self_reports_router = APIRouter()

# GET       /disease-watch-feed/mobile/alerts
router.add_api_route("/alerts", methods=["GET"], endpoint=fetch_mobile_alerts)

# GET       /disease-watch-feed/mobile/regional-coverage
router.add_api_route(
    "/regional-coverage",
    methods=["GET"],
    endpoint=fetch_mobile_regional_coverage,
)

# GET       /disease-watch-feed/mobile/user-analytics-summary
router.add_api_route(
    "/user-analytics-summary",
    methods=["GET"],
    endpoint=fetch_mobile_user_analytics_summary,
)

# GET       /disease-watch-feed/mobile/top-metrics
router.add_api_route(
    "/top-metrics",
    methods=["GET"],
    endpoint=fetch_mobile_top_metrics,
)

# GET       /disease-watch-feed/mobile/filter-options
router.add_api_route(
    "/filter-options",
    methods=["GET"],
    endpoint=fetch_mobile_filter_options,
)

# POST      /mobile/self-reports
mobile_self_reports_router.add_api_route(
    "/self-reports",
    methods=["POST"],
    endpoint=create_mobile_self_report,
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
