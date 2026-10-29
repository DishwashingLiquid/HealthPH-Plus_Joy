from copy import deepcopy
from threading import Lock
from time import monotonic

import httpx


AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
CACHE_SECONDS = 600

_air_quality_cache = {}
_air_quality_cache_lock = Lock()

class AirQualityServiceError(Exception):
    """Air-quality data could not be retrieved."""


def fetch_current_air_quality(latitude: float, longitude: float):
    cache_key = (latitude, longitude)

    with _air_quality_cache_lock:
        cached = _air_quality_cache.get(cache_key)

        if cached and monotonic() < cached["expires_at"]:
            return deepcopy(cached["data"])

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "pm2_5,us_aqi",
        "domains": "cams_global",
        "timezone": "Asia/Manila",
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(AIR_QUALITY_URL, params=params)
            response.raise_for_status()
            payload = response.json()

    except httpx.TimeoutException as error:
        raise AirQualityServiceError(
            "The air-quality provider took too long to respond. Please try again."
        ) from error

    except (httpx.HTTPError, ValueError) as error:
        raise AirQualityServiceError(
            "Air-quality data is temporarily unavailable. Please try again."
        ) from error

    if not isinstance(payload, dict):
        raise AirQualityServiceError(
            "The air-quality provider returned invalid data."
        )

    current = payload.get("current")
    units = payload.get("current_units")

    if (
        not isinstance(current, dict)
        or not current.get("time")
        or not isinstance(units, dict)
    ):
        raise AirQualityServiceError(
            "The air-quality provider returned incomplete current data."
        )

    result = {
        "provider": "Open-Meteo",
        "model": "CAMS Global",
        "data_type": "model_estimate",
        "spatial_resolution_km": 45,
        "timezone": payload.get("timezone", "Asia/Manila"),
        "data_time": current["time"],
        "pm25": current.get("pm2_5"),
        "us_aqi": current.get("us_aqi"),
        "units": {
            "pm25": units.get("pm2_5"),
            "us_aqi": units.get("us_aqi"),
        },
    }

    with _air_quality_cache_lock:
        _air_quality_cache[cache_key] = {
            "expires_at": monotonic() + CACHE_SECONDS,
            "data": deepcopy(result),
        }

    return result