from copy import deepcopy
from threading import Lock
from time import monotonic

import httpx

from helpers.heatIndexHelpers import calculate_heat_index

WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
CACHE_SECONDS = 600

_weather_cache = {}
_weather_cache_lock = Lock()


class WeatherServiceError(Exception):
    """Weather data could not be retrieved."""


def fetch_current_weather(latitude: float, longitude: float):
    cache_key = (latitude, longitude)

    with _weather_cache_lock:
        cached = _weather_cache.get(cache_key)

        if cached and monotonic() < cached["expires_at"]:
            return deepcopy(cached["data"])

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": (
            "temperature_2m,relative_humidity_2m,"
            "apparent_temperature,precipitation,weather_code,"
            "wind_speed_10m,wind_direction_10m"
        ),
        "temperature_unit": "celsius",
        "wind_speed_unit": "kmh",
        "precipitation_unit": "mm",
        "timezone": "Asia/Manila",
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(WEATHER_URL, params=params)
            response.raise_for_status()
            payload = response.json()

    except httpx.TimeoutException as error:
        raise WeatherServiceError(
            "The weather provider took too long to respond. Please try again."
        ) from error

    except (httpx.HTTPError, ValueError) as error:
        raise WeatherServiceError(
            "Weather data is temporarily unavailable. Please try again."
        ) from error

    if not isinstance(payload, dict):
        raise WeatherServiceError("The weather provider returned invalid data.")

    current = payload.get("current")
    units = payload.get("current_units")

    if (
        not isinstance(current, dict)
        or not current.get("time")
        or not isinstance(units, dict)
    ):
        raise WeatherServiceError(
            "The weather provider returned incomplete current weather data."
        )

    result = {
        "provider": "Open-Meteo",
        "timezone": payload.get("timezone", "Asia/Manila"),
        "data_time": current["time"],
        "interval_seconds": current.get("interval"),
        "temperature": current.get("temperature_2m"),
        "relative_humidity": current.get("relative_humidity_2m"),
        "feels_like": current.get("apparent_temperature"),
        "estimated_heat_index": calculate_heat_index(
            current.get("temperature_2m"),
            current.get("relative_humidity_2m"),
        ),
        "heat_index_method": "NWS Steadman/Rothfusz",
        "heat_index_assumptions": "Shade and light wind",
        "wind_speed": current.get("wind_speed_10m"),
        "wind_direction": current.get("wind_direction_10m"),
        "precipitation": current.get("precipitation"),
        "weather_code": current.get("weather_code"),
        "units": {
            **units,
            "estimated_heat_index": "°C",
        },
    }

    with _weather_cache_lock:
        _weather_cache[cache_key] = {
            "expires_at": monotonic() + CACHE_SECONDS,
            "data": deepcopy(result),
        }

    return result