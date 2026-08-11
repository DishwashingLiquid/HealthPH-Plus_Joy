import csv
import json
from collections import Counter
from datetime import datetime, timedelta
from io import StringIO
from pathlib import Path
from typing import Iterable

from bson import ObjectId
from fastapi import Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from typing_extensions import Annotated

from config.database import (
    dataset_collection,
    mobile_users_collection,
    point_collection,
    self_reports_collection,
    user_collection,
)
from helpers.miscHelpers import get_ph_datetime
from middleware.requireAuth import require_auth

REGION_ORDER = [
    "NCR",
    "I",
    "II",
    "III",
    "IVA",
    "IVB",
    "V",
    "CAR",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
    "XIII",
    "BARMM",
]

REGION_ALIASES = {
    "NCR": "NCR",
    "REGION NCR": "NCR",
    "I": "I",
    "REGION I": "I",
    "II": "II",
    "REGION II": "II",
    "III": "III",
    "REGION III": "III",
    "IVA": "IVA",
    "IV-A": "IVA",
    "REGION IVA": "IVA",
    "REGION IV-A": "IVA",
    "CALABARZON": "IVA",
    "IVB": "IVB",
    "IV-B": "IVB",
    "REGION IVB": "IVB",
    "REGION IV-B": "IVB",
    "MIMAROPA": "IVB",
    "V": "V",
    "REGION V": "V",
    "VI": "VI",
    "REGION VI": "VI",
    "VII": "VII",
    "REGION VII": "VII",
    "VIII": "VIII",
    "REGION VIII": "VIII",
    "IX": "IX",
    "REGION IX": "IX",
    "X": "X",
    "REGION X": "X",
    "XI": "XI",
    "REGION XI": "XI",
    "XII": "XII",
    "REGION XII": "XII",
    "XIII": "XIII",
    "REGION XIII": "XIII",
    "REGION XIII (CARAGA)": "XIII",
    "CARAGA": "XIII",
    "CAR": "CAR",
    "REGION CAR": "CAR",
    "CORDILLERA ADMINISTRATIVE REGION": "CAR",
    "BARMM": "BARMM",
    "REGION BARMM": "BARMM",
    "BANGSAMORO AUTONOMOUS REGION IN MUSLIM MINDANAO": "BARMM",
    "ALL": "ALL",
}

DISEASE_CODE_TO_LABEL = {
    "TB": "Tuberculosis",
    "PN": "Pneumonia",
    "AURI": "Acute Upper Respiratory Infection",
    "COVID": "COVID-19",
}

DISEASE_LABEL_TO_CODE = {
    "TB": "TB",
    "TUBERCULOSIS": "TB",
    "PTB": "TB",
    "PN": "PN",
    "PNEUMONIA": "PN",
    "AURI": "AURI",
    "ACUTE UPPER RESPIRATORY INFECTION": "AURI",
    "COVID": "COVID",
    "COVID-19": "COVID",
}

ALERT_OPEN_RATE_FALLBACK = {
    "current": None,
    "previous": None,
    "change": None,
    "percentage": None,
    "trend": None,
    "isAvailable": False,
    "fallbackReason": (
        "No alert-open tracking source was found in the existing collections "
        "or dataset flow."
    ),
}

SELF_REPORT_SOURCE = "mobile_self_report"
USER_ANALYTICS_SOURCE = "viewer"
SELF_REPORT_MAP_SOURCE = "selfReport"
SELF_REPORT_CATEGORY = "Self-reported respiratory symptoms"
SELF_REPORT_STATUSES = {"submitted", "for_review", "verified", "rejected"}
SELF_REPORT_REPORTER_TYPES = {"guest", "registered"}
SELF_REPORT_PIN_ACCURACY = {"geocoded", "region_estimate"}
SUPPORTED_SELF_REPORT_SYMPTOMS = {
    "Cough",
    "Fever",
    "Chills",
    "Fatigue",
    "Shortness of breath",
    "Chest Pain",
    "Sore throat",
    "Runny nose",
    "Wheezing",
    "Loss of taste or smell",
    "Headache",
    "Body aches",
    "Cough for 2+ weeks",
    "Night sweats",
    "Weight loss",
}
REGION_CENTER_PATH = (
    Path(__file__).resolve().parent.parent.parent
    / "client"
    / "src"
    / "assets"
    / "data"
    / "regions_center.json"
)
_region_center_lookup = None


class SelfReportReporterPayload(BaseModel):
    userId: str | None = None
    reporterType: str = "guest"
    role: str = "Guest Tester"
    fullName: str | None = None
    email: str | None = None
    sessionKey: str | None = None


class SelfReportLocationPayload(BaseModel):
    regionCode: str = ""
    regionName: str = ""
    provinceCode: str | None = None
    provinceName: str = ""
    cityCode: str | None = None
    cityName: str = ""
    barangayCode: str | None = None
    barangayName: str = ""
    latitude: float | None = None
    longitude: float | None = None
    geocodedAddress: str | None = None
    pinAccuracy: str = "region_estimate"


class SelfReportPayload(BaseModel):
    reporter: SelfReportReporterPayload
    location: SelfReportLocationPayload
    symptoms: list[str]
    possibleCondition: str | None = None
    notes: str = ""
    status: str = "submitted"
    source: str = SELF_REPORT_SOURCE
    createdAt: str | None = None
    syncedAt: str | None = None


def _load_region_centers():
    global _region_center_lookup

    if _region_center_lookup is not None:
        return _region_center_lookup

    try:
        region_centers = json.loads(REGION_CENTER_PATH.read_text(encoding="utf-8"))
    except Exception:
        _region_center_lookup = {}
        return _region_center_lookup

    _region_center_lookup = {
        str(item.get("region") or "").strip().upper(): item.get("center") or []
        for item in region_centers
        if isinstance(item, dict)
    }
    return _region_center_lookup


def _get_region_center(region_code: str | None):
    normalized_region = _normalize_region_safely(region_code)
    if not normalized_region:
        return None, None

    center = _load_region_centers().get(normalized_region) or []
    if len(center) != 2:
        return None, None

    return center[0], center[1]


def _clean_string(value, default: str = "") -> str:
    normalized_value = str(value or "").strip()
    return normalized_value or default


def _dedupe_preserve_order(values):
    seen = set()
    normalized_values = []

    for value in values:
        normalized_value = _clean_string(value)
        if not normalized_value:
            continue

        value_key = normalized_value.lower()
        if value_key in seen:
            continue

        seen.add(value_key)
        normalized_values.append(normalized_value)

    return normalized_values


def _derive_possible_condition(symptoms: list[str]) -> str:
    symptom_set = {symptom.lower() for symptom in symptoms}

    if {
        "cough",
        "fever",
        "fatigue",
    }.issubset(symptom_set) and (
        {"body aches", "loss of taste or smell", "shortness of breath"} & symptom_set
    ):
        return "Possible COVID-like respiratory symptom pattern"

    if {"cough", "fever", "chills", "fatigue"}.issubset(symptom_set):
        return "Possible pneumonia pattern"

    if "cough for 2+ weeks" in symptom_set or (
        "cough" in symptom_set
        and {"night sweats", "weight loss"}.issubset(symptom_set)
    ):
        return "Possible tuberculosis symptom pattern"

    if {"cough", "sore throat", "runny nose"} & symptom_set:
        return "Possible acute respiratory infection pattern"

    return "Respiratory symptoms reported"


def _normalize_self_report_source(value: str | None) -> str:
    normalized_value = _clean_string(value, SELF_REPORT_SOURCE)
    if normalized_value.lower() == SELF_REPORT_SOURCE:
        return SELF_REPORT_SOURCE
    return SELF_REPORT_SOURCE


def _normalize_self_report_status(value: str | None) -> str:
    normalized_value = _clean_string(value, "submitted").lower()
    if normalized_value not in SELF_REPORT_STATUSES:
        return "submitted"
    return normalized_value


def _normalize_pin_accuracy(value: str | None, latitude, longitude) -> str:
    normalized_value = _clean_string(value, "").lower()
    if normalized_value in SELF_REPORT_PIN_ACCURACY:
        return normalized_value

    return "geocoded" if latitude is not None and longitude is not None else "region_estimate"


def _normalize_reporter_type(value: str | None) -> str:
    normalized_value = _clean_string(value, "guest").lower()
    if normalized_value not in SELF_REPORT_REPORTER_TYPES:
        return "guest"
    return normalized_value


def _to_object_id_or_none(value):
    normalized_value = _clean_string(value)
    if not normalized_value or not ObjectId.is_valid(normalized_value):
        return None
    return ObjectId(normalized_value)


def _to_iso_or_none(value):
    parsed_value = _coerce_datetime(value)
    return parsed_value.isoformat() if parsed_value else None


def _build_mobile_user_key(
    *,
    user_id=None,
    email: str | None = None,
    full_name: str | None = None,
    report_fallback_id: str | None = None,
):
    if user_id:
        return f"registered:{user_id}"

    normalized_email = _clean_string(email).lower()
    if normalized_email:
        return f"email:{normalized_email}"

    normalized_full_name = _clean_string(full_name).lower()
    if normalized_full_name:
        return f"guest:{normalized_full_name}"

    if report_fallback_id:
        return f"guest-report:{report_fallback_id}"

    return None


def _serialize_mobile_user(document: dict) -> dict:
    location = document.get("location") or {}
    return {
        "id": str(document.get("_id") or ""),
        "userKey": document.get("userKey"),
        "sourceTag": document.get("sourceTag") or USER_ANALYTICS_SOURCE,
        "reporterType": document.get("reporterType"),
        "role": document.get("role"),
        "userId": str(document.get("userId")) if document.get("userId") else None,
        "fullName": document.get("fullName"),
        "email": document.get("email"),
        "sessionKey": document.get("sessionKey"),
        "location": {
            "regionCode": location.get("regionCode"),
            "regionName": location.get("regionName"),
            "provinceCode": location.get("provinceCode"),
            "provinceName": location.get("provinceName"),
            "cityCode": location.get("cityCode"),
            "cityName": location.get("cityName"),
            "barangayCode": location.get("barangayCode"),
            "barangayName": location.get("barangayName"),
        },
        "createdAt": _to_iso_or_none(document.get("createdAt")),
        "updatedAt": _to_iso_or_none(document.get("updatedAt")),
        "lastSeenAt": _to_iso_or_none(document.get("lastSeenAt")),
        "latestSelfReportId": str(document.get("latestSelfReportId") or "") or None,
    }


def _upsert_mobile_user_from_report(report_document: dict) -> dict:
    reporter = report_document.get("reporter") or {}
    location = report_document.get("location") or {}
    report_id = str(report_document.get("_id") or "")
    user_key = _build_mobile_user_key(
        user_id=reporter.get("userId"),
        email=reporter.get("email"),
        full_name=reporter.get("fullName"),
        report_fallback_id=report_id,
    )
    report_created_at = _coerce_datetime(report_document.get("createdAt")) or get_ph_datetime()
    report_updated_at = _coerce_datetime(report_document.get("updatedAt")) or report_created_at

    if not user_key:
        created_mobile_user = {
            "userKey": f"guest-report:{report_id}",
            "sourceTag": USER_ANALYTICS_SOURCE,
            "reporterType": reporter.get("reporterType") or "guest",
            "role": reporter.get("role") or "Guest Tester",
            "userId": reporter.get("userId"),
            "fullName": reporter.get("fullName"),
            "email": reporter.get("email"),
            "sessionKey": _clean_string(reporter.get("sessionKey")) or None,
            "location": {
                "regionCode": location.get("regionCode"),
                "regionName": location.get("regionName"),
                "provinceCode": location.get("provinceCode"),
                "provinceName": location.get("provinceName"),
                "cityCode": location.get("cityCode"),
                "cityName": location.get("cityName"),
                "barangayCode": location.get("barangayCode"),
                "barangayName": location.get("barangayName"),
            },
            "createdAt": report_created_at,
            "updatedAt": report_updated_at,
            "lastSeenAt": report_updated_at,
            "latestSelfReportId": report_document.get("_id"),
        }
        inserted_result = mobile_users_collection.insert_one(created_mobile_user)
        return mobile_users_collection.find_one({"_id": inserted_result.inserted_id}) or created_mobile_user

    mobile_users_collection.update_one(
        {"userKey": user_key},
        {
            "$setOnInsert": {
                "userKey": user_key,
                "sourceTag": USER_ANALYTICS_SOURCE,
                "reporterType": reporter.get("reporterType") or "guest",
                "role": reporter.get("role") or "Guest Tester",
                "userId": reporter.get("userId"),
                "fullName": reporter.get("fullName"),
                "email": reporter.get("email"),
                "sessionKey": _clean_string(reporter.get("sessionKey")) or None,
                "createdAt": report_created_at,
            },
            "$set": {
                "updatedAt": report_updated_at,
                "lastSeenAt": report_updated_at,
                "latestSelfReportId": report_document.get("_id"),
                "location": {
                    "regionCode": location.get("regionCode"),
                    "regionName": location.get("regionName"),
                    "provinceCode": location.get("provinceCode"),
                    "provinceName": location.get("provinceName"),
                    "cityCode": location.get("cityCode"),
                    "cityName": location.get("cityName"),
                    "barangayCode": location.get("barangayCode"),
                    "barangayName": location.get("barangayName"),
                },
                "reporterType": reporter.get("reporterType") or "guest",
                "role": reporter.get("role") or "Guest Tester",
                "fullName": reporter.get("fullName"),
                "email": reporter.get("email"),
                "sessionKey": _clean_string(reporter.get("sessionKey")) or None,
            },
        },
        upsert=True,
    )

    return mobile_users_collection.find_one({"userKey": user_key}) or {}


def _get_mobile_users(date_from=None, date_to=None):
    query = {"sourceTag": USER_ANALYTICS_SOURCE}

    if date_from or date_to:
        created_at_filter = {}
        if date_from:
            created_at_filter["$gte"] = date_from
        if date_to:
            created_at_filter["$lte"] = date_to
        query["createdAt"] = created_at_filter

    return list(mobile_users_collection.find(query).sort([("createdAt", -1), ("_id", -1)]))


def _get_mobile_user_region(document: dict) -> str:
    location = document.get("location") or {}
    region_code = _normalize_region_safely(location.get("regionName"))
    if region_code:
        return region_code
    return _normalize_region_safely(location.get("regionCode")) or "Unknown"


def _filter_mobile_users(users, regions=None, cutoff=None):
    filtered_users = users

    if cutoff:
        filtered_users = [
            user
            for user in filtered_users
            if (_coerce_datetime(user.get("createdAt")) or datetime.min) <= cutoff
        ]

    if regions:
        region_set = set(regions)
        filtered_users = [
            user for user in filtered_users if _get_mobile_user_region(user) in region_set
        ]

    return filtered_users


def _serialize_self_report(document: dict) -> dict:
    reporter = document.get("reporter") or {}
    location = document.get("location") or {}
    return {
        "id": str(document.get("_id") or ""),
        "mobileUserId": str(document.get("mobileUserId") or "") or None,
        "mobileUserKey": str(document.get("mobileUserKey") or "") or None,
        "reporter": {
            "userId": str(reporter["userId"]) if reporter.get("userId") else None,
            "reporterType": reporter.get("reporterType"),
            "role": reporter.get("role"),
            "fullName": reporter.get("fullName"),
            "email": reporter.get("email"),
        },
        "location": {
            "regionCode": location.get("regionCode"),
            "regionName": location.get("regionName"),
            "provinceCode": location.get("provinceCode"),
            "provinceName": location.get("provinceName"),
            "cityCode": location.get("cityCode"),
            "cityName": location.get("cityName"),
            "barangayCode": location.get("barangayCode"),
            "barangayName": location.get("barangayName"),
            "latitude": location.get("latitude"),
            "longitude": location.get("longitude"),
            "geocodedAddress": location.get("geocodedAddress"),
            "pinAccuracy": location.get("pinAccuracy"),
        },
        "symptoms": list(document.get("symptoms") or []),
        "possibleCondition": document.get("possibleCondition"),
        "notes": document.get("notes"),
        "status": document.get("status"),
        "source": document.get("source"),
        "createdAt": _to_iso_or_none(document.get("createdAt")),
        "updatedAt": _to_iso_or_none(document.get("updatedAt")),
        "syncedAt": _to_iso_or_none(document.get("syncedAt")),
    }


def _build_self_report_document(payload: SelfReportPayload) -> dict:
    symptoms = _dedupe_preserve_order(payload.symptoms)
    possible_condition = _clean_string(payload.possibleCondition) or _derive_possible_condition(
        symptoms
    )
    payload_created_at = _coerce_datetime(payload.createdAt)
    created_at = payload_created_at or get_ph_datetime()
    synced_at = _coerce_datetime(payload.syncedAt)
    region_name = _clean_string(payload.location.regionName)
    normalized_region = _normalize_region_safely(region_name) or _normalize_region_safely(
        payload.location.regionCode
    )
    province_name = _clean_string(payload.location.provinceName, region_name)
    city_name = _clean_string(payload.location.cityName)
    barangay_name = _clean_string(payload.location.barangayName)
    latitude = payload.location.latitude
    longitude = payload.location.longitude

    return {
        "reporter": {
            "userId": _to_object_id_or_none(payload.reporter.userId),
            "reporterType": _normalize_reporter_type(payload.reporter.reporterType),
            "role": _clean_string(payload.reporter.role, "Guest Tester"),
            "fullName": _clean_string(payload.reporter.fullName) or None,
            "email": _clean_string(payload.reporter.email) or None,
        },
        "location": {
            "regionCode": _clean_string(payload.location.regionCode),
            "regionName": normalized_region or region_name,
            "provinceCode": _clean_string(payload.location.provinceCode) or None,
            "provinceName": province_name,
            "cityCode": _clean_string(payload.location.cityCode) or None,
            "cityName": city_name,
            "barangayCode": _clean_string(payload.location.barangayCode) or None,
            "barangayName": barangay_name,
            "latitude": latitude,
            "longitude": longitude,
            "geocodedAddress": _clean_string(payload.location.geocodedAddress) or None,
            "pinAccuracy": _normalize_pin_accuracy(
                payload.location.pinAccuracy,
                latitude,
                longitude,
            ),
        },
        "symptoms": symptoms,
        "possibleCondition": possible_condition,
        "notes": _clean_string(payload.notes),
        "status": _normalize_self_report_status(payload.status),
        "source": _normalize_self_report_source(payload.source),
        "createdAt": created_at,
        "updatedAt": created_at,
        "syncedAt": synced_at,
    }


def _get_self_reports(date_from=None, date_to=None):
    query = {"source": SELF_REPORT_SOURCE}

    if date_from or date_to:
        created_at_filter = {}
        if date_from:
            created_at_filter["$gte"] = date_from
        if date_to:
            created_at_filter["$lte"] = date_to
        query["createdAt"] = created_at_filter

    return list(
        self_reports_collection.find(query).sort([("createdAt", -1), ("_id", -1)])
    )


def _filter_self_reports(reports, regions=None, disease=None, status_filter=None):
    filtered_reports = reports

    if regions:
        region_set = set(regions)
        filtered_reports = [
            report
            for report in filtered_reports
            if _normalize_region_safely((report.get("location") or {}).get("regionName"))
            in region_set
        ]

    if disease:
        disease_key = _clean_string(disease).lower()
        filtered_reports = [
            report
            for report in filtered_reports
            if disease_key
            in _clean_string(report.get("possibleCondition")).lower()
        ]

    if status_filter:
        normalized_status = _normalize_self_report_status(status_filter)
        filtered_reports = [
            report for report in filtered_reports if report.get("status") == normalized_status
        ]

    return filtered_reports


def _get_report_region(report: dict) -> str:
    location = report.get("location") or {}
    region_code = _normalize_region_safely(location.get("regionName"))
    if region_code:
        return region_code
    return _normalize_region_safely(location.get("regionCode")) or "Unknown"


def _get_report_location_label(report: dict) -> str:
    location = report.get("location") or {}
    parts = [
        _clean_string(location.get("barangayName")),
        _clean_string(location.get("cityName")),
        _clean_string(location.get("regionName")),
    ]
    return ", ".join([part for part in parts if part]) or "Unknown location"


def _get_report_coordinates(report: dict):
    location = report.get("location") or {}
    latitude = location.get("latitude")
    longitude = location.get("longitude")

    if latitude is not None and longitude is not None:
        return latitude, longitude

    return _get_region_center(location.get("regionName") or location.get("regionCode"))


def _build_self_report_alert_item(report: dict) -> dict:
    created_at = _coerce_datetime(report.get("createdAt")) or get_ph_datetime()
    region = _get_report_region(report)
    symptoms = list(report.get("symptoms") or [])
    location_label = _get_report_location_label(report)
    possible_condition = _clean_string(report.get("possibleCondition"), "Respiratory symptoms reported")

    return {
        "id": str(report.get("_id") or ""),
        "disease": possible_condition,
        "region": region,
        "type": "Symptom Report",
        "timestamp": created_at.isoformat(),
        "summary": (
            f"Viewer self-reported {', '.join(symptoms[:3]) or 'respiratory symptoms'} "
            f"in {location_label}."
        ),
        "summarySegments": [
            {"type": "text", "value": "Viewer self-reported "},
            {
                "type": "entity",
                "label": ", ".join(symptoms[:3]) or "respiratory symptoms",
                "tone": "symptom",
            },
            {"type": "text", "value": " in "},
            {"type": "entity", "label": location_label, "tone": "location"},
            {"type": "text", "value": "."},
        ],
        "severity": "low",
        "source": SELF_REPORT_MAP_SOURCE,
    }


def _build_cluster_summary(reports):
    clusters = Counter()
    for report in reports:
        clusters[(_get_report_region(report), _clean_string(report.get("possibleCondition")))] += 1

    return clusters


def _build_self_report_map_pin(report: dict) -> dict:
    latitude, longitude = _get_report_coordinates(report)
    location = report.get("location") or {}
    created_at = _coerce_datetime(report.get("createdAt")) or get_ph_datetime()
    pin_accuracy = _clean_string(location.get("pinAccuracy"), "region_estimate")
    geocoded_address = _clean_string(location.get("geocodedAddress")) or None

    return {
        "id": str(report.get("_id") or ""),
        "name": _get_report_location_label(report),
        "disease": _clean_string(report.get("possibleCondition"), "Respiratory symptoms reported"),
        "category": SELF_REPORT_CATEGORY,
        "reports": 1,
        "updated": (
            f"Self-reported on {created_at.month}/{created_at.day}/{created_at.year} "
            f"at {created_at.strftime('%H:%M')}"
        ),
        "lat": latitude,
        "lng": longitude,
        "tags": list(report.get("symptoms") or []),
        "source": SELF_REPORT_MAP_SOURCE,
        "pinAccuracy": pin_accuracy,
        "geocodedAddress": geocoded_address,
    }


def _build_reporter_key(report: dict) -> str:
    reporter = report.get("reporter") or {}
    user_id = reporter.get("userId")
    email = _clean_string(reporter.get("email")).lower()
    full_name = _clean_string(reporter.get("fullName")).lower()

    if user_id:
        return f"user:{user_id}"
    if email:
        return f"email:{email}"
    if full_name:
        return f"name:{full_name}"
    return f"guest:{report.get('_id')}"


def _count_unique_viewers(reports, cutoff=None, regions=None):
    viewer_keys = set()

    for report in reports:
        created_at = _coerce_datetime(report.get("createdAt"))
        if cutoff and created_at and created_at > cutoff:
            continue
        if regions and _get_report_region(report) not in regions:
            continue
        viewer_keys.add(_build_reporter_key(report))

    return len(viewer_keys)


def _normalize_region(value: str | None):
    if value is None:
        return None

    normalized = str(value).strip().upper()
    normalized = normalized.replace("REGION REGION", "REGION")

    if normalized in REGION_ALIASES:
        return REGION_ALIASES[normalized]

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Invalid region filter: {value}",
    )


def _normalize_region_safely(value: str | None):
    try:
        return _normalize_region(value)
    except HTTPException:
        return None


def _parse_region_list(value: str | None):
    if not value:
        return []

    regions = []
    for item in str(value).split(","):
        normalized = _normalize_region(item)
        if normalized and normalized != "ALL" and normalized not in regions:
            regions.append(normalized)

    return regions


def _normalize_disease_code(value: str | None):
    if not value:
        return None

    normalized = str(value).strip().upper()

    if normalized in DISEASE_LABEL_TO_CODE:
        return DISEASE_LABEL_TO_CODE[normalized]

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Invalid disease filter: {value}",
    )


def _parse_datetime(value: str | None, *, end_of_day: bool = False):
    if not value:
        return None

    raw_value = str(value).strip()
    if not raw_value:
        return None

    parsed = None

    try:
        parsed = datetime.fromisoformat(raw_value.replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = datetime.strptime(raw_value, "%Y-%m-%d")
        except ValueError as error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid date value: {value}",
            ) from error

    if parsed.tzinfo is not None:
        parsed = parsed.replace(tzinfo=None)

    if "T" not in raw_value and " " not in raw_value and end_of_day:
        parsed = parsed.replace(hour=23, minute=59, second=59, microsecond=999999)

    return parsed


def _coerce_datetime(value):
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value

    if value in [None, ""]:
        return None

    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None

    if parsed.tzinfo is not None:
        parsed = parsed.replace(tzinfo=None)

    return parsed


def _is_in_range(value, date_from=None, date_to=None):
    parsed = _coerce_datetime(value)

    if parsed is None:
        return date_from is None and date_to is None

    if date_from and parsed < date_from:
        return False

    if date_to and parsed > date_to:
        return False

    return True


def _validate_date_range(date_from=None, date_to=None):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="date_from must be earlier than or equal to date_to",
        )


def _safe_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _format_percentage(value):
    return round(float(value), 1)


def _trend_from_change(change):
    if change is None:
        return None

    return "up" if change >= 0 else "down"


def _sort_regions(regions: Iterable[str]):
    return sorted(
        regions,
        key=lambda region: (
            REGION_ORDER.index(region) if region in REGION_ORDER else len(REGION_ORDER),
            region,
        ),
    )


def _build_metric_summary(current, previous):
    change = current - previous
    percentage = 0.0

    if previous:
        percentage = (change / previous) * 100
    elif current:
        percentage = 100.0

    return {
        "current": current,
        "previous": previous,
        "change": change,
        "percentage": _format_percentage(abs(percentage)),
        "trend": _trend_from_change(change),
    }


def _resolve_window(date_from, date_to, *, default_days):
    now = get_ph_datetime()
    resolved_to = date_to or now
    resolved_from = date_from or (resolved_to - timedelta(days=default_days))

    _validate_date_range(resolved_from, resolved_to)

    window_duration = resolved_to - resolved_from
    if window_duration <= timedelta(0):
        window_duration = timedelta(days=1)

    previous_to = resolved_from
    previous_from = resolved_from - window_duration

    return resolved_from, resolved_to, previous_from, previous_to


def _get_current_user(user_id: str):
    user = user_collection.find_one({"_id": ObjectId(user_id)})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


def _get_scoped_users(current_user):
    return list(
        user_collection.find(
            {"user_type": "USER"},
            {"region": 1, "created_at": 1, "user_type": 1},
        )
    )


def _get_scoped_datasets(current_user, dataset_type: str):
    return list(
        dataset_collection.find(
            {"dataset_type": dataset_type},
            {
                "filename": 1,
                "created_at": 1,
                "num_of_rows": 1,
                "dataset_type": 1,
            },
        )
    )


def _get_filtered_datasets(current_user, dataset_type, date_from=None, date_to=None):
    datasets = _get_scoped_datasets(current_user, dataset_type)

    return [
        dataset
        for dataset in datasets
        if _is_in_range(dataset.get("created_at"), date_from, date_to)
    ]


def _get_point_entries(current_user, date_from=None, date_to=None):
    datasets = _get_filtered_datasets(
        current_user=current_user,
        dataset_type="ANNOTATED",
        date_from=date_from,
        date_to=date_to,
    )
    dataset_lookup = {
        dataset["filename"]: _coerce_datetime(dataset.get("created_at")) for dataset in datasets
    }

    if not dataset_lookup:
        return []

    points = point_collection.find({"dataset_source": {"$in": list(dataset_lookup.keys())}})

    entries = []
    for point in points:
        annotations_count = {
            key: _safe_int(value)
            for key, value in (point.get("annotations_count") or {}).items()
            if key in DISEASE_CODE_TO_LABEL
        }
        total_reports = sum(annotations_count.values())
        keywords = point.get("keywords") or []

        entries.append(
            {
                "id": str(point["_id"]),
                "region": _normalize_region_safely(point.get("region")),
                "province": str(point.get("province") or "").strip(),
                "annotations": [
                    annotation
                    for annotation in (point.get("annotations") or [])
                    if annotation in DISEASE_CODE_TO_LABEL
                ],
                "annotations_count": annotations_count,
                "keywords": keywords,
                "dataset_source": point.get("dataset_source"),
                "timestamp": dataset_lookup.get(point.get("dataset_source")),
                "total_reports": total_reports,
            }
        )

    return [entry for entry in entries if entry["region"]]


def _filter_point_entries(entries, regions=None, disease_code=None):
    filtered_entries = entries

    if regions:
        region_set = set(regions)
        filtered_entries = [
            entry for entry in filtered_entries if entry["region"] in region_set
        ]

    if disease_code:
        filtered_entries = [
            entry
            for entry in filtered_entries
            if disease_code in entry["annotations_count"]
        ]

    return filtered_entries


def _get_primary_disease_code(entry, requested_disease_code=None):
    if (
        requested_disease_code
        and requested_disease_code in entry["annotations_count"]
    ):
        return requested_disease_code

    if entry["annotations_count"]:
        return max(
            entry["annotations_count"].items(),
            key=lambda item: (item[1], item[0]),
        )[0]

    for annotation in entry["annotations"]:
        if annotation in DISEASE_CODE_TO_LABEL:
            return annotation

    return None


def _get_primary_keyword(entry, disease_code=None):
    keywords = entry.get("keywords") or []

    if disease_code:
        for keyword in keywords:
            if disease_code in (keyword.get("annotation") or []):
                key = str(keyword.get("key") or "").strip()
                if key and key.lower() != "nan":
                    return key

    for keyword in keywords:
        key = str(keyword.get("key") or "").strip()
        if key and key.lower() != "nan":
            return key

    return None


def _derive_alert_type(total_reports):
    if total_reports >= 10:
        return "Early Warning"
    if total_reports >= 4:
        return "Alert Distribution"
    return "Symptom Report"


def _derive_severity(total_reports):
    if total_reports >= 10:
        return "high"
    if total_reports >= 4:
        return "medium"
    return "low"


def _build_alert_item(entry, disease_code=None):
    primary_disease_code = _get_primary_disease_code(entry, disease_code)

    if primary_disease_code is None:
        return None

    disease_label = DISEASE_CODE_TO_LABEL[primary_disease_code]
    keyword = _get_primary_keyword(entry, primary_disease_code) or "symptoms"
    location_label = entry["province"] or entry["region"]
    type_label = _derive_alert_type(entry["total_reports"])
    timestamp = entry["timestamp"] or get_ph_datetime()

    summary = (
        f"Reports mentioning {keyword} were detected in {location_label} for "
        f"{disease_label}"
    )

    return {
        "id": entry["id"],
        "disease": disease_label,
        "region": entry["region"],
        "type": type_label,
        "timestamp": timestamp.isoformat(),
        "summary": summary,
        "summarySegments": [
            {"type": "text", "value": "Reports mentioning "},
            {"type": "entity", "label": keyword, "tone": "symptom"},
            {"type": "text", "value": " were detected in "},
            {"type": "entity", "label": location_label, "tone": "location"},
            {"type": "text", "value": " for "},
            {"type": "entity", "label": disease_label, "tone": "disease"},
        ],
        "severity": _derive_severity(entry["total_reports"]),
        "source": "symptom-reporting",
    }


def _build_alert_items(entries, disease_code=None):
    alerts = []

    for entry in entries:
        alert = _build_alert_item(entry, disease_code=disease_code)
        if alert:
            alerts.append(alert)

    return sorted(
        alerts,
        key=lambda alert: (
            _coerce_datetime(alert["timestamp"]) or datetime.min,
            alert["id"],
        ),
        reverse=True,
    )


def _count_raw_reports(current_user, date_from=None, date_to=None):
    datasets = _get_filtered_datasets(
        current_user=current_user,
        dataset_type="RAW",
        date_from=date_from,
        date_to=date_to,
    )

    return sum(_safe_int(dataset.get("num_of_rows")) for dataset in datasets)


async def fetch_mobile_alerts(
    current_user_id: Annotated[str, Depends(require_auth)],
    region: str | None = None,
    disease: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = Query(default=10, ge=1, le=100),
    cursor: str | None = None,
):
    _get_current_user(current_user_id)
    normalized_regions = _parse_region_list(region)
    parsed_date_from = _parse_datetime(date_from)
    parsed_date_to = _parse_datetime(date_to, end_of_day=True)

    _validate_date_range(parsed_date_from, parsed_date_to)

    offset = 0
    if cursor not in [None, ""]:
        try:
            offset = max(0, int(cursor))
        except ValueError as error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid cursor value",
            ) from error

    reports = _get_self_reports(
        date_from=parsed_date_from,
        date_to=parsed_date_to,
    )
    reports = _filter_self_reports(
        reports,
        regions=normalized_regions,
        disease=disease,
    )
    alerts = [_build_self_report_alert_item(report) for report in reports]

    paged_items = alerts[offset : offset + limit]
    next_cursor = offset + limit if offset + limit < len(alerts) else None

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "items": paged_items,
            "nextCursor": str(next_cursor) if next_cursor is not None else None,
        },
    )


async def fetch_mobile_regional_coverage(
    current_user_id: Annotated[str, Depends(require_auth)],
    regions: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    disease: str | None = None,
):
    _get_current_user(current_user_id)
    normalized_regions = _parse_region_list(regions)
    parsed_date_from = _parse_datetime(date_from)
    parsed_date_to = _parse_datetime(date_to, end_of_day=True)

    _validate_date_range(parsed_date_from, parsed_date_to)
    reports = _get_self_reports(
        date_from=parsed_date_from,
        date_to=parsed_date_to,
    )
    reports = _filter_self_reports(
        reports,
        regions=normalized_regions,
        disease=disease,
    )
    mobile_users = _filter_mobile_users(
        _get_mobile_users(date_from=parsed_date_from, date_to=parsed_date_to),
        regions=normalized_regions,
    )

    region_report_counts = Counter()
    region_viewer_counts = Counter()

    for report in reports:
        region_code = _get_report_region(report)
        if region_code == "Unknown":
            continue
        region_report_counts[region_code] += 1

    for mobile_user in mobile_users:
        region_code = _get_mobile_user_region(mobile_user)
        if region_code == "Unknown":
            continue
        region_viewer_counts[region_code] += 1

    if not region_viewer_counts:
        fallback_viewer_keys = {}
        for report in reports:
            region_code = _get_report_region(report)
            if region_code == "Unknown":
                continue
            fallback_viewer_keys.setdefault(region_code, set()).add(_build_reporter_key(report))
        region_viewer_counts = Counter(
            {region_code: len(viewer_keys) for region_code, viewer_keys in fallback_viewer_keys.items()}
        )

    if normalized_regions:
        region_list = normalized_regions
    else:
        region_list = _sort_regions(set(region_report_counts.keys()) | set(region_viewer_counts.keys()))

    total_viewers = sum(region_viewer_counts.values())

    response_regions = []
    for region_code in region_list:
        viewers = region_viewer_counts.get(region_code, 0)
        reports_count = region_report_counts.get(region_code, 0)
        response_regions.append(
            {
                "region": region_code,
                "users": viewers,
                "percentage": round((viewers / total_viewers) * 100) if total_viewers else 0,
                "alertCount": reports_count,
                "reportCount": reports_count,
            }
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "regions": response_regions,
            "updatedAt": get_ph_datetime().isoformat(),
        },
    )


async def fetch_mobile_user_analytics_summary(
    current_user_id: Annotated[str, Depends(require_auth)],
    region: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    _get_current_user(current_user_id)
    normalized_regions = _parse_region_list(region)
    parsed_date_from = _parse_datetime(date_from)
    parsed_date_to = _parse_datetime(date_to, end_of_day=True)

    (
        current_from,
        current_to,
        previous_from,
        previous_to,
    ) = _resolve_window(parsed_date_from, parsed_date_to, default_days=30)
    reports = _get_self_reports()
    mobile_users = _get_mobile_users()
    filtered_mobile_users_current = _filter_mobile_users(
        mobile_users,
        regions=normalized_regions,
        cutoff=current_to,
    )
    filtered_mobile_users_previous = _filter_mobile_users(
        mobile_users,
        regions=normalized_regions,
        cutoff=previous_to,
    )

    if filtered_mobile_users_current or filtered_mobile_users_previous:
        total_users_current = len(filtered_mobile_users_current)
        total_users_previous = len(filtered_mobile_users_previous)
    else:
        total_users_current = _count_unique_viewers(
            reports,
            cutoff=current_to,
            regions=normalized_regions,
        )
        total_users_previous = _count_unique_viewers(
            reports,
            cutoff=previous_to,
            regions=normalized_regions,
        )

    symptom_reports_current = len(
        _filter_self_reports(
            _get_self_reports(date_from=current_from, date_to=current_to),
            regions=normalized_regions,
        )
    )
    symptom_reports_previous = len(
        _filter_self_reports(
            _get_self_reports(date_from=previous_from, date_to=previous_to),
            regions=normalized_regions,
        )
    )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "totalUsers": _build_metric_summary(
                total_users_current,
                total_users_previous,
            ),
            "alertOpenRate": ALERT_OPEN_RATE_FALLBACK,
            "symptomReports": _build_metric_summary(
                symptom_reports_current,
                symptom_reports_previous,
            ),
            "userSource": USER_ANALYTICS_SOURCE,
            "updatedAt": get_ph_datetime().isoformat(),
        },
    )


async def fetch_mobile_top_metrics(
    current_user_id: Annotated[str, Depends(require_auth)],
    region: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    disease: str | None = None,
):
    _get_current_user(current_user_id)
    normalized_regions = _parse_region_list(region)
    parsed_date_from = _parse_datetime(date_from)
    parsed_date_to = _parse_datetime(date_to, end_of_day=True)
    current_from, current_to, _, _ = _resolve_window(
        parsed_date_from,
        parsed_date_to,
        default_days=7,
    )

    reports = _get_self_reports(
        date_from=current_from,
        date_to=current_to,
    )
    reports = _filter_self_reports(
        reports,
        regions=normalized_regions,
        disease=disease,
    )
    report_clusters = _build_cluster_summary(reports)

    alert_distribution_count = sum(
        1 for cluster_count in report_clusters.values() if cluster_count >= 2
    )
    early_warning_count = sum(
        1 for cluster_count in report_clusters.values() if cluster_count >= 5
    )
    symptom_report_count = len(reports)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "cards": [
                {
                    "key": "alert-distribution",
                    "label": "Alert Distribution",
                    "value": alert_distribution_count,
                    "helper": "condition clusters with 2+ self-reports",
                },
                {
                    "key": "early-warning",
                    "label": "Early Warning",
                    "value": early_warning_count,
                    "helper": "condition clusters with 5+ self-reports",
                },
                {
                    "key": "symptom-report",
                    "label": "Symptom Report",
                    "value": symptom_report_count,
                    "helper": "mobile self-reports submitted",
                },
            ],
            "updatedAt": get_ph_datetime().isoformat(),
        },
    )


async def fetch_mobile_filter_options(
    current_user_id: Annotated[str, Depends(require_auth)],
):
    _get_current_user(current_user_id)
    reports = _get_self_reports()
    mobile_users = _get_mobile_users()

    region_values = {
        _get_report_region(report)
        for report in reports
        if _get_report_region(report) != "Unknown"
    }
    region_values.update(
        {
            _get_mobile_user_region(mobile_user)
            for mobile_user in mobile_users
            if _get_mobile_user_region(mobile_user) != "Unknown"
        }
    )
    disease_values = {
        _clean_string(report.get("possibleCondition"))
        for report in reports
        if _clean_string(report.get("possibleCondition"))
    }

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "regions": _sort_regions(region_values),
            "diseases": sorted(disease_values),
            "dateRanges": ["last-7-days", "last-30-days", "custom"],
        },
    )


async def create_mobile_self_report(payload: SelfReportPayload):
    if not payload.symptoms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one symptom is required",
        )

    normalized_symptoms = _dedupe_preserve_order(payload.symptoms)
    if not normalized_symptoms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one valid symptom is required",
        )

    payload.symptoms = [
        symptom
        for symptom in normalized_symptoms
        if symptom in SUPPORTED_SELF_REPORT_SYMPTOMS or symptom
    ]
    document = _build_self_report_document(payload)
    inserted_report = self_reports_collection.insert_one(document)
    created_report = self_reports_collection.find_one({"_id": inserted_report.inserted_id})
    mobile_user = _upsert_mobile_user_from_report(created_report)
    mobile_user_id = mobile_user.get("_id")
    mobile_user_key = mobile_user.get("userKey")

    self_reports_collection.update_one(
        {"_id": inserted_report.inserted_id},
        {
            "$set": {
                "mobileUserId": mobile_user_id,
                "mobileUserKey": mobile_user_key,
            }
        },
    )
    created_report = self_reports_collection.find_one({"_id": inserted_report.inserted_id})

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "message": "Self-report submitted successfully",
            "item": _serialize_self_report(created_report),
            "mobileUser": _serialize_mobile_user(mobile_user),
        },
    )


async def fetch_mobile_self_reports_mine(
    mobileUserId: str | None = None,
    reporterType: str | None = None,
    sessionKey: str | None = None,
):
    if not mobileUserId:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="mobileUserId is required",
        )

    mobile_user = mobile_users_collection.find_one({"_id": ObjectId(mobileUserId)}) if ObjectId.is_valid(mobileUserId) else None
    if not mobile_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mobile user not found",
        )

    effective_reporter_type = _normalize_reporter_type(
        reporterType or mobile_user.get("reporterType")
    )
    if effective_reporter_type == "registered" and not _clean_string(sessionKey):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="sessionKey is required for registered mobile users",
        )

    stored_session_key = _clean_string(mobile_user.get("sessionKey"))
    if effective_reporter_type == "registered" and stored_session_key and stored_session_key != _clean_string(sessionKey):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid sessionKey for registered mobile user",
        )

    reports = list(
        self_reports_collection.find(
            {
                "source": SELF_REPORT_SOURCE,
                "mobileUserId": mobile_user.get("_id"),
            }
        ).sort([("createdAt", -1), ("_id", -1)])
    )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"items": [_serialize_self_report(report) for report in reports]},
    )


async def fetch_mobile_self_reports_map_pins(
    region: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    normalized_regions = _parse_region_list(region)
    parsed_date_from = _parse_datetime(date_from)
    parsed_date_to = _parse_datetime(date_to, end_of_day=True)
    _validate_date_range(parsed_date_from, parsed_date_to)

    reports = _get_self_reports(date_from=parsed_date_from, date_to=parsed_date_to)
    reports = _filter_self_reports(reports, regions=normalized_regions)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"items": [_build_self_report_map_pin(report) for report in reports]},
    )


async def export_mobile_self_reports(
    current_user_id: Annotated[str, Depends(require_auth)],
):
    _get_current_user(current_user_id)
    reports = _get_self_reports()
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "reporter_type",
            "role",
            "full_name",
            "email",
            "region",
            "province",
            "city",
            "barangay",
            "symptoms",
            "possible_condition",
            "notes",
            "status",
            "source",
            "created_at",
        ]
    )

    for report in reports:
        reporter = report.get("reporter") or {}
        location = report.get("location") or {}
        writer.writerow(
            [
                str(report.get("_id") or ""),
                reporter.get("reporterType") or "",
                reporter.get("role") or "",
                reporter.get("fullName") or "",
                reporter.get("email") or "",
                location.get("regionName") or "",
                location.get("provinceName") or "",
                location.get("cityName") or "",
                location.get("barangayName") or "",
                "|".join(report.get("symptoms") or []),
                report.get("possibleCondition") or "",
                report.get("notes") or "",
                report.get("status") or "",
                report.get("source") or "",
                _to_iso_or_none(report.get("createdAt")) or "",
            ]
        )

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=self_reports_export.csv"},
    )
