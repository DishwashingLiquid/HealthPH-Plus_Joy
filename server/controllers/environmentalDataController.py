from fastapi import Depends, HTTPException, Query

from helpers.analyticsAccessHelpers import get_allowed_analytics_regions
from helpers.environmentalDataHelpers import (
    WeatherServiceError,
    fetch_current_weather,
)
from helpers.environmentalLocations import REGION_WEATHER_LOCATIONS
from middleware.requirePage import require_page
from region_normalization import REGION_NAMES, normalize_region


def fetch_environmental_weather(
    region: str = Query(..., min_length=1, max_length=100),
    current_user: dict = Depends(require_page("AI Surveillance")),
):
    region_code = normalize_region(region)

    if not region_code:
        raise HTTPException(
            status_code=400,
            detail="Select a specific region to view its reference weather.",
        )

    allowed_regions = get_allowed_analytics_regions(current_user)

    if allowed_regions is not None and region_code not in allowed_regions:
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this region.",
        )

    reference = REGION_WEATHER_LOCATIONS.get(region_code)

    if not reference:
        raise HTTPException(
            status_code=400,
            detail="A weather reference location is not configured for this region.",
        )

    location_name, latitude, longitude = reference

    try:
        weather = fetch_current_weather(latitude, longitude)
    except WeatherServiceError as error:
        raise HTTPException(
            status_code=502,
            detail=str(error),
        ) from error

    return {
        "region": region_code,
        "region_name": REGION_NAMES[region_code],
        "reference_location": {
            "name": location_name,
            "latitude": latitude,
            "longitude": longitude,
        },
        "data_type": "model_estimate",
        "weather": weather,
        "attribution": {
            "label": "Weather data by Open-Meteo",
            "url": "https://open-meteo.com",
        },
    }