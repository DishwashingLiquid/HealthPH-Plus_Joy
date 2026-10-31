from collections import Counter

from config.database import analytics_entries_collection
from helpers.analyticsAccessHelpers import get_analytics_entry_region
from helpers.environmentalLocations import REGION_WEATHER_LOCATIONS
from helpers.surveillanceDateHelpers import (
    get_surveillance_window,
    is_within_surveillance_window,
)

MAP_DISEASE_CODES = {"TB", "PN", "COVID", "AURI"}


def get_analytics_map_location(entry):
    """Keep supplied coordinates; locate text-only social posts by region.

    The PSGC resolver is also used by the NLP location summary. Reference-city
    coordinates are display anchors, never an inferred address for a report.
    """
    region = get_analytics_entry_region(entry)
    location = entry.get("location")
    if not isinstance(location, dict):
        return None

    latitude = location.get("latitude")
    longitude = location.get("longitude")
    missing_coordinates = all(value in (None, "") for value in (latitude, longitude))

    if missing_coordinates and entry.get("source_type") == "social_media":
        reference = REGION_WEATHER_LOCATIONS.get(region)
        if not reference:
            return None
        name, latitude, longitude = reference
        return {
            "region": region,
            "province": "",
            "lat": latitude,
            "long": longitude,
            "location_precision": "regional_reference",
            "reference_location": name,
        }

    try:
        if isinstance(latitude, bool) or isinstance(longitude, bool):
            return None
        latitude, longitude = float(latitude), float(longitude)
    except (TypeError, ValueError, OverflowError):
        return None
    if not (4 <= latitude <= 22 and 116 <= longitude <= 128):
        return None

    return {
        "region": region or "",
        "province": str(location.get("province") or "").strip(),
        "lat": latitude,
        "long": longitude,
        "location_precision": "submitted_coordinates",
        "reference_location": "",
    }


def build_processed_map_points(*, days, hours=None, allowed_regions=None):
    entries = analytics_entries_collection.find(
        {
            "analysis_status": "PROCESSED",
            "analysis.disease_labels.0": {"$exists": True},
        },
        {
            "_id": 0,
            "source_type": 1,
            "location": 1,
            "analysis.disease_labels": 1,
            "event_time": 1,
        },
    )
    window_start, window_end = get_surveillance_window(days, hours)
    grouped = {}

    for entry in entries:
        region = get_analytics_entry_region(entry)
        if allowed_regions is not None and region not in allowed_regions:
            continue
        if not is_within_surveillance_window(entry, window_start, window_end):
            continue

        mapped_location = get_analytics_map_location(entry)
        if not mapped_location:
            continue
        latitude, longitude = mapped_location["lat"], mapped_location["long"]

        analysis = entry.get("analysis")
        raw_labels = analysis.get("disease_labels") if isinstance(analysis, dict) else []
        if not isinstance(raw_labels, list):
            continue
        labels = {str(label).strip().upper() for label in raw_labels} & MAP_DISEASE_CODES
        if not labels:
            continue

        key = (
            region or "", round(latitude, 6), round(longitude, 6),
            mapped_location["location_precision"],
        )
        if key not in grouped:
            grouped[key] = {
                "PH_code": "",
                **mapped_location,
                "counts": Counter(),
                "processed_entry_count": 0,
            }
        grouped[key]["counts"].update(labels)
        grouped[key]["processed_entry_count"] += 1

    points = []
    for key in sorted(grouped):
        point = grouped[key]
        counts = dict(point.pop("counts"))
        points.append({
            **point,
            "report_count": point["processed_entry_count"],
            "annotations": sorted(counts),
            "annotations_count": counts,
            "keywords": [],
        })
    return points
