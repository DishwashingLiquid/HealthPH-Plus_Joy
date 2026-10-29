"""Time-aligned environmental model history; no current-value substitution."""
import asyncio
from collections import Counter, OrderedDict
from copy import deepcopy
from datetime import datetime, timedelta
from math import atan2, cos, degrees, isfinite, radians, sin
from threading import Lock
from time import monotonic

import httpx

from helpers.heatIndexHelpers import calculate_heat_index
from helpers.surveillanceDateHelpers import PH_TIMEZONE, get_surveillance_window

WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
WEATHER_FIELDS = {
    "temperature": "temperature_2m",
    "relative_humidity": "relative_humidity_2m",
    "wind_speed": "wind_speed_10m",
    "wind_direction": "wind_direction_10m",
    "precipitation": "precipitation",
    "weather_code": "weather_code",
}
AIR_FIELDS = {"pm25": "pm2_5", "us_aqi": "us_aqi"}
CACHE_SECONDS = 600
MAX_CACHE_ENTRIES = 64
_cache = OrderedDict()
_cache_lock = Lock()


def _number(value, field):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value):
        return None
    if field == "relative_humidity" and not 0 <= value <= 100:
        return None
    if field == "wind_direction" and not 0 <= value <= 360:
        return None
    if field in {"wind_speed", "precipitation", "pm25", "us_aqi", "weather_code"} and value < 0:
        return None
    if field == "weather_code":
        return int(value) if value == int(value) else None
    return float(value)


def _parse_hour(value):
    if not isinstance(value, str):
        return None
    try:
        hour = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return hour.replace(tzinfo=PH_TIMEZONE) if hour.tzinfo is None else hour.astimezone(PH_TIMEZONE)
    except ValueError:
        return None


def _rows(payload, fields, start, end):
    hourly = payload.get("hourly") if isinstance(payload, dict) else None
    times = hourly.get("time") if isinstance(hourly, dict) else None
    if not isinstance(times, list) or not times:
        raise ValueError("Missing hourly history")
    rows = {}
    for index, raw_time in enumerate(times):
        hour = _parse_hour(raw_time)
        if hour is None or not start <= hour <= end or hour.minute or hour.second:
            continue
        row = {"time": hour}
        for field, provider_field in fields.items():
            values = hourly.get(provider_field)
            value = values[index] if isinstance(values, list) and len(values) == len(times) else None
            # Exclude a preceding-hour rainfall total if its interval starts
            # before the selected window (including rolling 24-hour windows).
            row[field] = None if field == "precipitation" and hour - timedelta(hours=1) < start else _number(value, field)
        if "temperature" in fields:
            row["estimated_heat_index"] = calculate_heat_index(row["temperature"], row["relative_humidity"])
        rows[hour] = row
    return [rows[hour] for hour in sorted(rows)]


def _expected_hours(start, end):
    first = start.replace(minute=0, second=0, microsecond=0)
    if first < start:
        first += timedelta(hours=1)
    last = end.replace(minute=0, second=0, microsecond=0)
    return max(0, int((last - first).total_seconds() // 3600) + 1)


def _coverage(rows, fields, start, end, error=None):
    usable = [row for row in rows if any(row.get(field) is not None for field in fields)]
    expected = _expected_hours(start, end)
    counts = {field: sum(row.get(field) is not None for row in rows) for field in fields}
    complete = all(counts[field] == expected - (1 if field == "precipitation" else 0) for field in fields)
    status = "available" if usable and complete else "partial" if usable else "unavailable"
    return {
        "status": status,
        "available_hours": len(usable),
        "expected_hours": expected,
        "sample_counts": counts,
        "first_time": usable[0]["time"].isoformat() if usable else None,
        "last_time": usable[-1]["time"].isoformat() if usable else None,
        "message": error or (
            "Some hourly readings are missing; summaries use available readings."
            if status == "partial" else
            "No environmental history is available for this location and period."
            if status == "unavailable" else None
        ),
    }


def _aggregate(weather_rows, air_rows):
    def values(rows, field):
        return [row[field] for row in rows if row.get(field) is not None]

    def average(rows, field):
        samples = values(rows, field)
        return round(sum(samples) / len(samples), 2) if samples else None

    directions = [row for row in weather_rows if row.get("wind_direction") is not None and row.get("wind_speed") is not None]
    x = sum(sin(radians(row["wind_direction"])) * row["wind_speed"] for row in directions)
    y = sum(cos(radians(row["wind_direction"])) * row["wind_speed"] for row in directions)
    direction = round(degrees(atan2(x, y)) % 360, 1) if abs(x) + abs(y) > 1e-8 else None
    codes = values(weather_rows, "weather_code")
    return {
        "temperature": average(weather_rows, "temperature"),
        "relative_humidity": average(weather_rows, "relative_humidity"),
        "estimated_heat_index": average(weather_rows, "estimated_heat_index"),
        "wind_speed": average(weather_rows, "wind_speed"),
        "wind_direction": direction,
        "precipitation": average(weather_rows, "precipitation"),
        "weather_code": Counter(codes).most_common(1)[0][0] if codes else None,
        "us_aqi": average(air_rows, "us_aqi"),
        "pm25": average(air_rows, "pm25"),
    }


async def _fetch_source(client, url, params, fields, start, end, label):
    try:
        response = await client.get(url, params=params)
        response.raise_for_status()
        rows = _rows(response.json(), fields, start, end)
        return rows, _coverage(rows, fields, start, end)
    except (httpx.HTTPError, ValueError, TypeError):
        return [], _coverage([], fields, start, end, f"{label} history is temporarily unavailable. Please try again.")


async def fetch_environmental_history(latitude, longitude, days, hours=None):
    start, end = get_surveillance_window(days, hours)
    key = (latitude, longitude, days, hours, start.date(), end.date())
    with _cache_lock:
        cached = _cache.get(key)
        if cached and monotonic() < cached["expires_at"]:
            _cache.move_to_end(key)
            return deepcopy(cached["data"])
        if cached:
            del _cache[key]

    params = {
        "latitude": latitude, "longitude": longitude,
        "start_date": start.date().isoformat(), "end_date": end.date().isoformat(),
        "timezone": "Asia/Manila",
    }
    async with httpx.AsyncClient(timeout=12.0) as client:
        weather_result, air_result = await asyncio.gather(
            _fetch_source(client, WEATHER_URL, {
                **params, "hourly": ",".join(WEATHER_FIELDS.values()),
                "temperature_unit": "celsius", "wind_speed_unit": "kmh", "precipitation_unit": "mm",
            }, WEATHER_FIELDS, start, end, "Weather"),
            _fetch_source(client, AIR_URL, {
                **params, "hourly": ",".join(AIR_FIELDS.values()), "domains": "cams_global",
            }, AIR_FIELDS, start, end, "Air-quality"),
        )
    weather_rows, weather_coverage = weather_result
    air_rows, air_coverage = air_result
    result = {
        "timezone": "Asia/Manila", "days": 1 if hours else days, "hours": hours,
        "requested_start": start.isoformat(), "requested_end": end.isoformat(),
        "generated_at": end.isoformat(), "data_type": "model_estimate",
        "summary": _aggregate(weather_rows, air_rows),
        "weather_coverage": weather_coverage, "air_quality_coverage": air_coverage,
    }
    # A retry must be able to recover a failed source immediately.
    if weather_coverage["status"] == air_coverage["status"] == "available":
        with _cache_lock:
            _cache[key] = {"expires_at": monotonic() + CACHE_SECONDS, "data": deepcopy(result)}
            _cache.move_to_end(key)
            while len(_cache) > MAX_CACHE_ENTRIES:
                _cache.popitem(last=False)
    return result
