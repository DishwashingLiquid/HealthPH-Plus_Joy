from fastapi import APIRouter

from controllers.healthLiteracyHubController import (
    create_health_literacy_content,
    fetch_health_literacy_content,
)

router = APIRouter()

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
