from fastapi import APIRouter

from controllers.environmentalDataController import (
    fetch_environmental_air_quality,
    fetch_environmental_weather,
    fetch_mobile_environmental_air_quality,
    fetch_mobile_environmental_locations,
    fetch_mobile_environmental_weather,
)
from models.environmentalData import (
    AirQualityResponse,
    EnvironmentalErrorResponse,
    EnvironmentalLocationsResponse,
    WeatherResponse,
)


router = APIRouter()
mobile_router = APIRouter()

public_errors = {
    400: {"model": EnvironmentalErrorResponse, "description": "Unsupported region; use /locations."},
    502: {"model": EnvironmentalErrorResponse, "description": "Environmental provider unavailable or timed out."},
}
dashboard_errors = {
    **public_errors,
    401: {"model": EnvironmentalErrorResponse, "description": "Dashboard login required."},
    403: {"model": EnvironmentalErrorResponse, "description": "Page or regional access denied."},
}

router.add_api_route(
    "/weather",
    methods=["GET"],
    endpoint=fetch_environmental_weather,
    response_model=WeatherResponse,
    responses=dashboard_errors,
    summary="Current weather for an accessible reference city",
)

router.add_api_route(
    "/air-quality",
    methods=["GET"],
    endpoint=fetch_environmental_air_quality,
    response_model=AirQualityResponse,
    responses=dashboard_errors,
    summary="Current air quality for an accessible reference city",
)

mobile_router.add_api_route(
    "/locations",
    methods=["GET"],
    endpoint=fetch_mobile_environmental_locations,
    response_model=EnvironmentalLocationsResponse,
    summary="Supported public environmental reference locations",
    description="Public GET. No mobile or dashboard token is required. Lists configured locations, not personal report coordinates.",
)

mobile_router.add_api_route(
    "/weather",
    methods=["GET"],
    endpoint=fetch_mobile_environmental_weather,
    response_model=WeatherResponse,
    responses=public_errors,
    summary="Public current weather for a reference city",
    description="Available to guests and registered users without Authorization. Requires one supported region. Uses the same provider cache and calculations as the dashboard; does not trigger model processing.",
)

mobile_router.add_api_route(
    "/air-quality",
    methods=["GET"],
    endpoint=fetch_mobile_environmental_air_quality,
    response_model=AirQualityResponse,
    responses=public_errors,
    summary="Public current PM2.5 and US AQI for a reference city",
    description="Available without Authorization. CAMS Global model estimates for the reference location; not an entire regional average or local monitoring-station measurement.",
)
