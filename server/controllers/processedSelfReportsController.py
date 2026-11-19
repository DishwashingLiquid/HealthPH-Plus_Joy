"""Dashboard/export endpoints backed exclusively by processed analytics."""
import csv
from datetime import date, datetime, timedelta
from functools import lru_cache
from io import StringIO
import json
from pathlib import Path

from fastapi import Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from typing_extensions import Annotated

from config.database import analytics_entries_collection
from helpers.miscHelpers import get_ph_datetime
from helpers.processedSelfReportHelpers import (
    ProcessedSelfReportRepository, dashboard, ph_datetime, report_item,
)
from middleware.requireAuth import require_auth
from middleware.requireRole import require_role
from region_normalization import normalize_region


def repository():
    return ProcessedSelfReportRepository(analytics_entries_collection)


def parse_regions(value):
    regions = []
    for raw in (value or "").split(","):
        if not raw.strip():
            continue
        region = normalize_region(raw)
        if region is None:
            raise HTTPException(status_code=400, detail="Unknown region filter")
        if region not in regions:
            regions.append(region)
    return regions


def reporting_window(date_from=None, date_to=None):
    end = ph_datetime(get_ph_datetime())
    try:
        if date_to:
            end = min(end, datetime.combine(date.fromisoformat(date_to), datetime.max.time()))
        start = end - timedelta(days=30) + timedelta(microseconds=1)
        if date_from:
            start = datetime.combine(date.fromisoformat(date_from), datetime.min.time())
    except ValueError as error:
        raise HTTPException(status_code=400, detail="Use YYYY-MM-DD dates") from error
    if start > end:
        raise HTTPException(status_code=400, detail="Start date must not exceed end date")
    return start, end


@lru_cache(maxsize=1)
def region_centers():
    path = Path(__file__).resolve().parents[2] / "client/src/assets/data/regions_center.json"
    return {item["region"]: item["center"] for item in json.loads(path.read_text())}


def map_pin(record):
    location = record["location"]
    lat, lng = location.get("latitude"), location.get("longitude")
    accuracy = location.get("pinAccuracy") or "geocoded"
    try:
        if isinstance(lat, bool) or isinstance(lng, bool) or not (4 <= float(lat) <= 22 and 116 <= float(lng) <= 128):
            raise ValueError("invalid coordinates")
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError, OverflowError):
        center = region_centers().get(record["region"])
        if center is None:
            return None
        lat, lng = center
        accuracy = "region_estimate"
    item = report_item(record)
    return {
        "id": item["id"], "name": location.get("raw") or record["region"] or "Unknown region",
        "region": record["region"], "diseaseCodes": item["diseaseCodes"],
        "disease": ", ".join(item["diseaseLabels"]) or "No disease detected",
        "category": "Processed self-report", "reports": 1, "updated": item["createdAt"],
        "lat": lat, "lng": lng, "tags": item["combinedSymptoms"],
        "source": "processed_analytics", "pinAccuracy": accuracy,
        "geocodedAddress": location.get("geocodedAddress"),
    }


async def fetch_processed_self_report_dashboard(
    _user: Annotated[str, Depends(require_auth)], region: str | None = None,
    date_from: str | None = None, date_to: str | None = None,
):
    start, end = reporting_window(date_from, date_to)
    result = dashboard(repository(), start, end, parse_regions(region))
    return JSONResponse(content=result)


async def fetch_mobile_user_analytics_summary(
    _user: Annotated[dict, Depends(require_role(["Admin", "SUPERADMIN"]))], region: str | None = None,
    date_from: str | None = None, date_to: str | None = None,
):
    start, end = reporting_window(date_from, date_to)
    result = dashboard(repository(), start, end, parse_regions(region))
    return JSONResponse(content={**result["userAnalytics"], "period": result["period"], "source": result["source"]})


async def fetch_mobile_self_reports_map_pins(
    region: str | None = None, date_from: str | None = None, date_to: str | None = None,
):
    start, end = reporting_window(date_from, date_to)
    records = repository().records(start=start, end=end, regions=parse_regions(region))
    return JSONResponse(content={"source": "processed_analytics", "items": [pin for record in records if (pin := map_pin(record))]})


async def export_mobile_self_reports(
    _user: Annotated[str, Depends(require_auth)], format: str | None = None,
    region: str | None = None, date_from: str | None = None, date_to: str | None = None,
):
    start, end = reporting_window(date_from, date_to)
    items = [report_item(record) for record in repository().records(start=start, end=end, regions=parse_regions(region))]
    if (format or "").lower() == "json":
        return JSONResponse(content={"source": "processed_analytics", "items": items})
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "analytics_entry_id", "reporter_id", "reporter_type", "region", "symptoms", "disease_codes", "event_time", "source"])
    for item in items:
        writer.writerow([item["id"], item["analyticsEntryId"], item["mobileReporterId"] or "",
                         item["reporter"]["reporterType"], item["region"] or "", "|".join(item["combinedSymptoms"]),
                         "|".join(item["diseaseCodes"]), item["createdAt"], item["source"]])
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=processed_self_reports.csv"})
