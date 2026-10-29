from datetime import datetime
from hashlib import sha256
from typing import Literal

from fastapi import HTTPException, Query
from pydantic import BaseModel

from helpers.surveillanceMapHelpers import MAP_DISEASE_CODES, build_processed_map_points
from helpers.surveillanceDateHelpers import PH_TIMEZONE
from region_normalization import normalize_region


class MobileProcessedMapPin(BaseModel):
    id: str
    region: str
    province: str
    latitude: float
    longitude: float
    diseaseCodes: list[str]
    diseaseCounts: dict[str, int]
    processedEntryCount: int


class MobileProcessedMapResponse(BaseModel):
    schemaVersion: Literal[1] = 1
    source: Literal["processed_analytics"] = "processed_analytics"
    generatedAt: datetime
    days: int
    hours: int | None = None
    region: str
    disease: str
    items: list[MobileProcessedMapPin]


def fetch_mobile_processed_map_pins(
    days: int = Query(7, ge=1, le=365),
    hours: int | None = Query(None, ge=24, le=24, description="Optional rolling 24-hour window."),
    region: str = Query("all"),
    disease: str = Query("all"),
):
    selected_region = None
    if region.strip().lower() != "all":
        selected_region = normalize_region(region)
        if not selected_region:
            raise HTTPException(status_code=400, detail="Invalid region filter.")

    selected_disease = disease.strip().upper()
    if selected_disease != "ALL" and selected_disease not in MAP_DISEASE_CODES:
        raise HTTPException(status_code=400, detail="Invalid disease filter.")

    # Public map projection, intentionally separate from dashboard authorization.
    points = build_processed_map_points(days=days, hours=hours)
    items = []
    for point in points:
        if selected_region and point["region"] != selected_region:
            continue
        if selected_disease != "ALL" and selected_disease not in point["annotations"]:
            continue

        location_key = f"{point['region']}:{point['lat']:.6f}:{point['long']:.6f}"
        items.append({
            "id": "signal_" + sha256(location_key.encode("utf-8")).hexdigest()[:24],
            "region": point["region"],
            "province": point["province"],
            "latitude": point["lat"],
            "longitude": point["long"],
            "diseaseCodes": point["annotations"],
            "diseaseCounts": {
                code: point["annotations_count"].get(code, 0)
                for code in sorted(MAP_DISEASE_CODES)
            },
            "processedEntryCount": point["processed_entry_count"],
        })

    return {
        "schemaVersion": 1,
        "source": "processed_analytics",
        "generatedAt": datetime.now(PH_TIMEZONE),
        "days": days,
        "hours": hours,
        "region": selected_region or "all",
        "disease": selected_disease if selected_disease != "ALL" else "all",
        "items": items,
    }
