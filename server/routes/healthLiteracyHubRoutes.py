from fastapi import APIRouter

from controllers.healthLiteracyHubController import (
    apply_health_literacy_content_review_action,
    create_health_literacy_analytics_event,
    create_health_literacy_content,
    fetch_health_literacy_media,
    fetch_health_literacy_analytics_overview,
    fetch_health_literacy_content,
    fetch_health_literacy_fact_check_analytics,
    fetch_mobile_health_literacy_content,
    fetch_mobile_health_literacy_content_by_type,
    update_health_literacy_content,
    upsert_health_literacy_content_feedback,
)

router = APIRouter()

# GET       /health-literacy-hub/analytics/overview
router.add_api_route(
    "/analytics/overview",
    methods=["GET"],
    endpoint=fetch_health_literacy_analytics_overview,
)

# GET       /health-literacy-hub/analytics/fact-check
router.add_api_route(
    "/analytics/fact-check",
    methods=["GET"],
    endpoint=fetch_health_literacy_fact_check_analytics,
)

# POST      /health-literacy-hub/analytics/events
router.add_api_route(
    "/analytics/events",
    methods=["POST"],
    endpoint=create_health_literacy_analytics_event,
)

# POST      /health-literacy-hub/content/{content_type}/{content_id}/feedback
router.add_api_route(
    "/content/{content_type}/{content_id}/feedback",
    methods=["POST"],
    endpoint=upsert_health_literacy_content_feedback,
)

# GET       /health-literacy-hub/mobile
router.add_api_route(
    "/mobile",
    methods=["GET"],
    endpoint=fetch_mobile_health_literacy_content,
)

# GET       /health-literacy-hub/mobile/{content_type}
router.add_api_route(
    "/mobile/{content_type}",
    methods=["GET"],
    endpoint=fetch_mobile_health_literacy_content_by_type,
)

# GET       /health-literacy-hub/media/{content_type}/{filename}
router.add_api_route(
    "/media/{content_type}/{filename}",
    methods=["GET"],
    endpoint=fetch_health_literacy_media,
)

# PATCH     /health-literacy-hub/{content_type}/{content_id}/review-action
router.add_api_route(
    "/{content_type}/{content_id}/review-action",
    methods=["PATCH"],
    endpoint=apply_health_literacy_content_review_action,
)

# GET       /health-literacy-hub/{content_type}
router.add_api_route(
    "/{content_type}",
    methods=["GET"],
    endpoint=fetch_health_literacy_content,
)

# POST      /health-literacy-hub/{content_type}
router.add_api_route(
    "/{content_type}",
    methods=["POST"],
    endpoint=create_health_literacy_content,
)

# PUT       /health-literacy-hub/{content_type}/{content_id}
router.add_api_route(
    "/{content_type}/{content_id}",
    methods=["PUT"],
    endpoint=update_health_literacy_content,
)
