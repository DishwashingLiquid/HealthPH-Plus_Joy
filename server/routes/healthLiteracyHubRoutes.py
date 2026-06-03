from fastapi import APIRouter

from controllers.healthLiteracyHubController import (
    create_health_literacy_analytics_event,
    create_health_literacy_content,
    fetch_health_literacy_media,
    fetch_health_literacy_analytics_overview,
    fetch_health_literacy_content,
    fetch_mobile_health_literacy_content,
    fetch_mobile_health_literacy_content_by_type,
    update_health_literacy_content,
)

router = APIRouter()

# GET       /health-literacy-hub/analytics/overview
router.add_api_route(
    "/analytics/overview",
    methods=["GET"],
    endpoint=fetch_health_literacy_analytics_overview,
)

# POST      /health-literacy-hub/analytics/events
router.add_api_route(
    "/analytics/events",
    methods=["POST"],
    endpoint=create_health_literacy_analytics_event,
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
