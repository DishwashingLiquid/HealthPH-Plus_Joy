from collections import Counter

from config.database import analytics_entries_collection
from helpers.analyticsAccessHelpers import get_analytics_entry_region
from helpers.surveillanceDateHelpers import (
    get_surveillance_window,
    is_within_surveillance_window,
)

MAP_DISEASE_CODES = {"TB", "PN", "COVID", "AURI"}


def build_processed_map_points(*, days, hours=None, allowed_regions=None):
    entries = analytics_entries_collection.find(
        {
            "analysis_status": "PROCESSED",
            "location.latitude": {"$ne": None},
            "location.longitude": {"$ne": None},
            "analysis.disease_labels.0": {"$exists": True},
        },
        {
            "_id": 0,
            "location.latitude": 1,
            "location.longitude": 1,
            "location.region": 1,
            "location.regionCode": 1,
            "location.regionName": 1,
            "location.province": 1,
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

        location = entry.get("location")
        if not isinstance(location, dict):
            continue
        try:
            latitude = float(location.get("latitude"))
            longitude = float(location.get("longitude"))
        except (TypeError, ValueError, OverflowError):
            continue
        if not (4 <= latitude <= 22 and 116 <= longitude <= 128):
            continue

        analysis = entry.get("analysis")
        raw_labels = analysis.get("disease_labels") if isinstance(analysis, dict) else []
        if not isinstance(raw_labels, list):
            continue
        labels = {str(label).strip().upper() for label in raw_labels} & MAP_DISEASE_CODES
        if not labels:
            continue

        key = (region or "", round(latitude, 6), round(longitude, 6))
        if key not in grouped:
            grouped[key] = {
                "PH_code": "",
                "region": region or "",
                "province": str(location.get("province") or "").strip(),
                "lat": latitude,
                "long": longitude,
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
            "annotations": sorted(counts),
            "annotations_count": counts,
            "keywords": [],
        })
    return points
