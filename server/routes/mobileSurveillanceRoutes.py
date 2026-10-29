"""Public, read-only processed surveillance signals for Flutter."""
from fastapi import APIRouter

from controllers.mobileSurveillanceController import (
    MobileProcessedMapResponse,
    fetch_mobile_processed_map_pins,
)

router = APIRouter()
router.add_api_route(
    "/map-pins",
    endpoint=fetch_mobile_processed_map_pins,
    methods=["GET"],
    response_model=MobileProcessedMapResponse,
    summary="Public processed surveillance map pins",
    description=(
        "Guest-accessible coordinate groups from processed disease-positive analytics. "
        "Returns aggregate disease counts and a separate processed entry count. "
        "Coordinates are supplied report locations, not verified GPS accuracy; no "
        "region-center fallback is applied. Excludes reporter identity, text, notes, "
        "addresses, and internal report IDs. Disease filtering selects matching "
        "groups and retains their co-occurring disease counts."
    ),
)
