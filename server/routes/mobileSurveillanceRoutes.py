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
        "Supplied report coordinates are retained without claiming GPS accuracy. "
        "Social-media entries without coordinates use the existing PSGC location-to-region "
        "resolver and a configured reference city for that region. locationPrecision "
        "and referenceLocation distinguish these regional groups from submitted coordinates. "
        "Excludes reporter identity, text, notes, "
        "addresses, and internal report IDs. Disease filtering selects matching "
        "groups and retains their co-occurring disease counts."
    ),
)
