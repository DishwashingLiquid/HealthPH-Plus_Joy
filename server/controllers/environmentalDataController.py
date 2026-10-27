from fastapi import Depends, HTTPException, Query

from helpers.airQualityHelpers import (
    AirQualityServiceError,
    fetch_current_air_quality,
)
from helpers.analyticsAccessHelpers import get_allowed_analytics_regions
from helpers.environmentalDataHelpers import (
    WeatherServiceError,
    fetch_current_weather,
)
from helpers.environmentalLocations import REGION_WEATHER_LOCATIONS
from middleware.requirePage import require_page
from region_normalization import REGION_NAMES, normalize_region


def build_reference_location(region):
    region_code = normalize_region(region)

    if not region_code:
        raise HTTPException(
            status_code=400,
            detail="Select a supported region.",
        )

    reference = REGION_WEATHER_LOCATIONS.get(region_code)

    if not reference:
        raise HTTPException(
            status_code=400,
            detail="A reference location is not configured for this region.",
        )

    name, latitude, longitude = reference

    return {
        "region": region_code,
        "region_name": REGION_NAMES[region_code],
        "reference_location": {
            "name": name,
            "latitude": latitude,
            "longitude": longitude,
        },
    }


def resolve_environmental_location(
    region: str = Query(..., min_length=1, max_length=100),
    current_user: dict = Depends(require_page("AI Surveillance")),
):
    location = build_reference_location(region)
    allowed = get_allowed_analytics_regions(current_user)

    if allowed is not None and location["region"] not in allowed:
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this region.",
        )

    return location


def resolve_mobile_environmental_location(
    region: str = Query(..., min_length=1, max_length=100),
):
    return build_reference_location(region)


def build_environmental_weather_response(location: dict):
    reference = location["reference_location"]

    try:
        weather = fetch_current_weather(
            reference["latitude"],
            reference["longitude"],
        )
    except WeatherServiceError as error:
        raise HTTPException(
            status_code=502,
            detail=str(error),
        ) from error

    return {
        **location,
        "data_type": "model_estimate",
        "weather": weather,
        "attribution": {
            "label": "Weather data by Open-Meteo",
            "url": "https://open-meteo.com/",
        },
    }


def build_environmental_air_quality_response(location: dict):
    reference = location["reference_location"]

    try:
        air_quality = fetch_current_air_quality(
            reference["latitude"],
            reference["longitude"],
        )
    except AirQualityServiceError as error:
        raise HTTPException(
            status_code=502,
            detail=str(error),
        ) from error

    return {
        **location,
        "data_type": "model_estimate",
        "air_quality": air_quality,
        "attribution": {
            "label": "Air quality data by Open-Meteo and CAMS",
            "url": "https://open-meteo.com/",
            "cams_url": "https://atmosphere.copernicus.eu/",
        },
    }


def fetch_environmental_weather(
    location: dict = Depends(resolve_environmental_location),
):
    return build_environmental_weather_response(location)


def fetch_environmental_air_quality(
    location: dict = Depends(resolve_environmental_location),
):
    return build_environmental_air_quality_response(location)


def fetch_mobile_environmental_weather(
    location: dict = Depends(resolve_mobile_environmental_location),
):
    return build_environmental_weather_response(location)


def fetch_mobile_environmental_air_quality(
    location: dict = Depends(resolve_mobile_environmental_location),
):
    return build_environmental_air_quality_response(location)


def fetch_mobile_environmental_locations():
    return {
        "items": [
            build_reference_location(region)
            for region in REGION_WEATHER_LOCATIONS
        ]
    }
