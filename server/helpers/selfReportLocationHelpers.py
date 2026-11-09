"""Resolve missing self-report coordinates to explicitly labeled city references.

Never infer a person's position or overwrite supplied coordinates. Administrative
names/codes alone are sent to the provider, never report text or reporter data.
"""
from copy import deepcopy
from functools import lru_cache
import json
import logging
from pathlib import Path
import re
from threading import Lock
from time import monotonic
import unicodedata

import httpx

from helpers.environmentalLocations import REGION_WEATHER_LOCATIONS
from region_normalization import normalize_region

logger = logging.getLogger(__name__)
GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
_cache = {}
_cache_lock = Lock()


def place_key(value):
    text = unicodedata.normalize("NFKD", str(value or "").casefold())
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = " ".join(re.findall(r"[a-z0-9]+", text))
    return re.sub(r"^(city of|municipality of|province of) | (city|province)$", "", text).strip()


def valid_coordinates(latitude, longitude):
    if isinstance(latitude, bool) or isinstance(longitude, bool):
        return False
    try:
        return 4 <= float(latitude) <= 22 and 116 <= float(longitude) <= 128
    except (TypeError, ValueError, OverflowError):
        return False


@lru_cache(maxsize=1)
def _places():
    path = Path(__file__).resolve().parents[1] / "data" / "psgc_locations.json"
    return json.loads(path.read_text(encoding="utf-8"))["places"]


def _selected_city(location):
    regions = {r for key in ("regionCode", "regionName") if (r := normalize_region(location.get(key)))}
    if len(regions) != 1:
        return None
    region = regions.pop()
    code, name = str(location.get("cityCode") or ""), place_key(location.get("cityName"))
    all_places = [p for p in _places() if p["level"] in {"City", "Mun"}]
    places = [p for p in all_places if p["region"] == region]
    if code:
        matches = [p for p in all_places if code in (p["code"], p.get("correspondence_code"))]
        # Do not silently replace a recognized code with an unrelated name.
        if matches:
            return matches[0] if matches[0]["region"] == region and (not name or place_key(matches[0]["name"]) == name) else None
    matches = [p for p in places if name and place_key(p["name"]) == name]
    return matches[0] if len(matches) == 1 else None


def _provider_city(city, province):
    cache_key = (place_key(city["name"]), place_key(province), city["region"])
    # Bound the request time and share results within a worker. Also cache misses
    # briefly so unsupported/ambiguous places do not hammer the provider.
    with _cache_lock:
        cached = _cache.get(cache_key)
        if cached and cached[0] > monotonic():
            return deepcopy(cached[1])
    try:
        response = httpx.get(
            GEOCODING_URL,
            params={"name": place_key(city["name"]), "countryCode": "PH", "count": 100, "language": "en"},
            headers={"User-Agent": "HealthPH-Plus/1.0 administrative-location-lookup"},
            timeout=5.0,
        )
        response.raise_for_status()
        payload = response.json()
        results = payload.get("results", []) if isinstance(payload, dict) else []
        if not isinstance(results, list):
            results = []
        matches = {}
        for item in results:
            if not isinstance(item, dict) or item.get("country_code") != "PH":
                continue
            if not str(item.get("feature_code", "")).startswith("PPL"):
                continue
            if place_key(item.get("name")) != place_key(city["name"]):
                continue
            if normalize_region(item.get("admin1")) != city["region"]:
                continue
            province_matches = not province or any(place_key(item.get(key)) == place_key(province) for key in ("admin2", "admin3"))
            # Independent cities can have their own name as the province/admin2.
            if not province_matches and city["level"] != "City":
                continue
            lat, lon = item.get("latitude"), item.get("longitude")
            if valid_coordinates(lat, lon):
                matches[(float(lat), float(lon))] = (float(lat), float(lon))
        result = next(iter(matches.values())) if len(matches) == 1 else None
    except (httpx.HTTPError, ValueError, TypeError):
        logger.warning("City reference lookup unavailable; coordinates left unchanged.")
        result = None
    with _cache_lock:
        if len(_cache) >= 2048:
            _cache.clear()
        _cache[cache_key] = (monotonic() + (86400 if result else 60), result)
    return result


def populate_self_report_location(location):
    result = deepcopy(location or {})
    lat, lon = result.get("latitude"), result.get("longitude")
    if valid_coordinates(lat, lon):
        # Complete a missing display address from selected areas, not reverse GPS.
        if not result.get("geocodedAddress"):
            result["geocodedAddress"] = ", ".join(str(result[k]).strip() for k in ("barangayName", "cityName", "provinceName", "regionName") if result.get(k)) or None
        return result
    # Preserve partial/invalid supplied coordinates for review, never replace
    # them with a plausible-looking estimate. This fallback is for missing pairs.
    if lat not in (None, "") or lon not in (None, ""):
        return result
    city = _selected_city(result)
    if not city:
        return result
    reference = REGION_WEATHER_LOCATIONS.get(city["region"])
    # Existing verified reference-city coordinates work offline, including Iloilo.
    if reference and place_key(reference[0].split(",")[0]) == place_key(city["name"]):
        coordinates = reference[1:]
        provider = "HealthPH configured city reference (GeoNames/Open-Meteo)"
    else:
        coordinates = _provider_city(city, result.get("provinceName"))
        provider = "Open-Meteo Geocoding / GeoNames"
    if not coordinates:
        return result
    address = ", ".join(dict.fromkeys(str(v).strip() for v in (city["name"], result.get("provinceName"), "Philippines") if v))
    result.update({"latitude": coordinates[0], "longitude": coordinates[1],
        "geocodedAddress": address, "pinAccuracy": "city_estimate", "geocodingSource": provider})
    return result


def analytics_location_fields(location):
    """Only location display metadata; never modify analytics IDs or status."""
    return {"latitude": location.get("latitude"), "longitude": location.get("longitude"),
        "pinAccuracy": location.get("pinAccuracy"), "geocodedAddress": location.get("geocodedAddress"),
        "geocodingSource": location.get("geocodingSource"),
        "referenceLocation": location.get("geocodedAddress") if location.get("pinAccuracy") == "city_estimate" else ""}
