from fastapi import APIRouter

from controllers.diseaseWatchFeedController import (
    fetch_mobile_alerts,
    fetch_mobile_filter_options,
    fetch_mobile_regional_coverage,
    fetch_mobile_top_metrics,
    fetch_mobile_user_analytics_summary,
)

router = APIRouter()

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
