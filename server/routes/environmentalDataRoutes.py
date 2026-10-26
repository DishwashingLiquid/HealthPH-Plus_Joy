from fastapi import APIRouter

from controllers.environmentalDataController import (
    fetch_environmental_weather,
)


router = APIRouter()

router.add_api_route(
    "/weather",
    methods=["GET"],
    endpoint=fetch_environmental_weather,
)