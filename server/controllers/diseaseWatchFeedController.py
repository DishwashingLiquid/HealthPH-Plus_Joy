"""Mobile self-report ingestion and original submission receipts.

Processed reporting lives in processedSelfReportsController and never reads
these raw submission documents.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing_extensions import Annotated
from config.database import analytics_entries_collection, mobile_users_collection, self_reports_collection
from helpers.selfReportLocationHelpers import populate_self_report_location
from helpers.analyticsEntryHelpers import build_self_report_analytics_entry
from helpers.analyticsSymptomHelpers import SELF_REPORT_SYMPTOM_ID_TO_LABEL
from helpers.selfReportIdHelpers import insert_report_with_id, ReportIdError
from helpers.dateTimeHelpers import get_ph_datetime
from middleware.requireMobileAuth import optional_mobile_auth, require_mobile_auth
from models.mobileUser import MOBILE_REGISTRATION_SOURCE, MOBILE_ROLE_ID, MOBILE_ROLE_LABEL
from controllers.mobileUserController import serialize_mobile_user
from region_normalization import observed_region


SELF_REPORT_SOURCE = "mobile_self_report"

SELF_REPORT_STATUSES = {"submitted", "for_review", "verified", "rejected"}

SELF_REPORT_REPORTER_TYPES = {"guest", "registered"}

SELF_REPORT_PIN_ACCURACY = {"geocoded", "region_estimate", "city_estimate"}

SELF_REPORT_ROLE_ID_TO_LABEL = {
    "guest": "Guest Tester",
    "user": "User",
    "citizen": "Citizen",
    "field_health_worker": "Field Health Worker",
    "lgu_doh_user": "LGU/DOH User",
}

SELF_REPORT_ROLE_LABEL_TO_ID = {
    label.lower(): role_id for role_id, label in SELF_REPORT_ROLE_ID_TO_LABEL.items()
}

SELF_REPORT_SYMPTOM_LABEL_TO_ID = {
    label.lower(): symptom_id
    for symptom_id, label in SELF_REPORT_SYMPTOM_ID_TO_LABEL.items()
}

SELF_REPORT_POSSIBLE_CONDITION_ID_TO_LABEL = {
    "covid_like_respiratory_pattern": (
        "Possible COVID-like respiratory symptom pattern"
    ),
    "pneumonia_pattern": "Possible pneumonia pattern",
    "tuberculosis_pattern": "Possible tuberculosis symptom pattern",
    "acute_respiratory_infection_pattern": (
        "Possible acute respiratory infection pattern"
    ),
    "respiratory_symptoms_reported": "Respiratory symptoms reported",
}

SELF_REPORT_POSSIBLE_CONDITION_LABEL_TO_ID = {
    label.lower(): condition_id
    for condition_id, label in SELF_REPORT_POSSIBLE_CONDITION_ID_TO_LABEL.items()
}

class SelfReportReporterPayload(BaseModel):
    mobileUserId: str | None = None
    reporterType: str = "guest"
    roleId: str | None = None
    roleLabel: str | None = None
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
    symptomIds: list[str] = []
    symptomLabels: list[str] = []
    possibleConditionId: str | None = None
    possibleConditionLabel: str | None = None
    notes: str = ""
    status: str = "submitted"
    source: str = SELF_REPORT_SOURCE
    createdAt: str | None = None
    syncedAt: str | None = None

def _clean_string(value, default: str = "") -> str:
    normalized_value = str(value or "").strip()
    return normalized_value or default

def _normalize_id_token(value: str | None) -> str:
    return _clean_string(value).strip().lower().replace("-", "_").replace(" ", "_")

def _normalize_role_fields(
    *,
    role_id: str | None = None,
    role_label: str | None = None,
):
    normalized_role_id = _normalize_id_token(role_id)
    if normalized_role_id in SELF_REPORT_ROLE_ID_TO_LABEL:
        return normalized_role_id, SELF_REPORT_ROLE_ID_TO_LABEL[normalized_role_id]

    normalized_role_label = _clean_string(role_label).lower()
    if normalized_role_label in SELF_REPORT_ROLE_LABEL_TO_ID:
        resolved_role_id = SELF_REPORT_ROLE_LABEL_TO_ID[normalized_role_label]
        return resolved_role_id, SELF_REPORT_ROLE_ID_TO_LABEL[resolved_role_id]

    return "guest", SELF_REPORT_ROLE_ID_TO_LABEL["guest"]

def _normalize_symptom_id(value: str | None) -> str | None:
    normalized_value = _normalize_id_token(value)
    if normalized_value in SELF_REPORT_SYMPTOM_ID_TO_LABEL:
        return normalized_value

    normalized_label = _clean_string(value).lower()
    if normalized_label in SELF_REPORT_SYMPTOM_LABEL_TO_ID:
        return SELF_REPORT_SYMPTOM_LABEL_TO_ID[normalized_label]

    return None

def _normalize_symptom_fields(
    *,
    symptom_ids: list[str] | None = None,
    symptom_labels: list[str] | None = None,
):
    normalized_symptom_ids = []
    seen_symptom_ids = set()

    for value in list(symptom_ids or []) + list(symptom_labels or []):
        normalized_symptom_id = _normalize_symptom_id(value)
        if not normalized_symptom_id or normalized_symptom_id in seen_symptom_ids:
            continue

        seen_symptom_ids.add(normalized_symptom_id)
        normalized_symptom_ids.append(normalized_symptom_id)

    return normalized_symptom_ids, [
        SELF_REPORT_SYMPTOM_ID_TO_LABEL[symptom_id]
        for symptom_id in normalized_symptom_ids
    ]

def _normalize_possible_condition_id(value: str | None) -> str | None:
    normalized_value = _normalize_id_token(value)
    if normalized_value in SELF_REPORT_POSSIBLE_CONDITION_ID_TO_LABEL:
        return normalized_value

    normalized_label = _clean_string(value).lower()
    if normalized_label in SELF_REPORT_POSSIBLE_CONDITION_LABEL_TO_ID:
        return SELF_REPORT_POSSIBLE_CONDITION_LABEL_TO_ID[normalized_label]

    return None

def _derive_possible_condition_id(symptom_ids: list[str]) -> str:
    symptom_set = set(symptom_ids)

    if {"cough", "fever"}.issubset(symptom_set) and (
        {"fatigue", "body_aches", "loss_of_taste_or_smell", "shortness_of_breath"}
        & symptom_set
    ):
        return "covid_like_respiratory_pattern"

    if {"cough", "fever", "chills", "fatigue"}.issubset(symptom_set):
        return "pneumonia_pattern"

    if "cough_2_weeks" in symptom_set or (
        "cough" in symptom_set
        and {"night_sweats", "weight_loss"}.issubset(symptom_set)
    ):
        return "tuberculosis_pattern"

    if {"cough", "sore_throat", "runny_nose"} & symptom_set:
        return "acute_respiratory_infection_pattern"

    return "respiratory_symptoms_reported"

def _normalize_possible_condition_fields(
    *,
    possible_condition_id: str | None = None,
    possible_condition_label: str | None = None,
    symptom_ids: list[str] | None = None,
):
    normalized_possible_condition_id = _normalize_possible_condition_id(
        possible_condition_id
    ) or _normalize_possible_condition_id(possible_condition_label)

    if normalized_possible_condition_id is None:
        normalized_possible_condition_id = _derive_possible_condition_id(
            symptom_ids or []
        )

    return (
        normalized_possible_condition_id,
        SELF_REPORT_POSSIBLE_CONDITION_ID_TO_LABEL[normalized_possible_condition_id],
    )

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

def _to_iso_or_none(value):
    parsed_value = _coerce_datetime(value)
    return parsed_value.isoformat() if parsed_value else None

def _build_public_report_id(document: dict) -> str:
    return document["id"]


def _serialize_self_report(document: dict) -> dict:
    reporter = document.get("reporter") or {}
    location = document.get("location") or {}
    return {
        "id": _build_public_report_id(document),
        "reporter": {
            "mobileUserId": reporter.get("mobileUserId"),
            "reporterType": reporter.get("reporterType"),
            "label": "GUEST" if reporter.get("reporterType") == "guest" else "Registered user",
            "roleId": reporter.get("roleId"),
            "roleLabel": reporter.get("roleLabel"),
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
        "symptomIds": list(document.get("symptomIds") or []),
        "symptomLabels": list(document.get("symptomLabels") or []),
        "possibleConditionId": document.get("possibleConditionId"),
        "possibleConditionLabel": document.get("possibleConditionLabel"),
        "notes": document.get("notes"),
        "status": document.get("status"),
        "source": document.get("source"),
        "analyticsEntryId": document.get("analyticsEntryId"),
        "createdAt": _to_iso_or_none(document.get("createdAt")),
        "updatedAt": _to_iso_or_none(document.get("updatedAt")),
        "syncedAt": _to_iso_or_none(document.get("syncedAt")),
    }

def _build_self_report_document(
    payload: SelfReportPayload,
    authenticated_mobile_user: dict | None = None,
) -> dict:
    if authenticated_mobile_user:
        reporter = {
            "mobileUserId": authenticated_mobile_user["id"],
            "reporterType": "registered",
            "roleId": MOBILE_ROLE_ID,
            "roleLabel": MOBILE_ROLE_LABEL,
            "fullName": authenticated_mobile_user["fullName"],
            "email": authenticated_mobile_user["email"],
            "sessionKey": None,
        }
    else:
        role_id, role_label = _normalize_role_fields(
            role_id=payload.reporter.roleId,
            role_label=payload.reporter.roleLabel,
        )
        reporter = {
            "mobileUserId": None,
            "reporterType": "guest",
            "roleId": role_id,
            "roleLabel": role_label,
            "fullName": _clean_string(payload.reporter.fullName) or None,
            "email": _clean_string(payload.reporter.email).lower() or None,
            "sessionKey": _clean_string(payload.reporter.sessionKey) or None,
        }
    symptom_ids, symptom_labels = _normalize_symptom_fields(
        symptom_ids=payload.symptomIds,
        symptom_labels=payload.symptomLabels,
    )
    # Preserve the original selections for auditing; derived counts use analytics.
    submitted_symptoms = [
        _clean_string(value)
        for value in (payload.symptomLabels or payload.symptomIds)
        if _clean_string(value)
    ]
    possible_condition_id, possible_condition_label = _normalize_possible_condition_fields(
        possible_condition_id=payload.possibleConditionId,
        possible_condition_label=payload.possibleConditionLabel,
        symptom_ids=symptom_ids,
    )
    payload_created_at = _coerce_self_report_datetime(payload.createdAt)
    created_at = payload_created_at or get_ph_datetime()
    synced_at = _coerce_self_report_datetime(payload.syncedAt)
    normalized_region_code = observed_region({"regionCode": payload.location.regionCode, "regionName": payload.location.regionName})
    region_code = normalized_region_code or _clean_string(payload.location.regionCode)
    region_name = _clean_string(payload.location.regionName) or region_code
    province_name = _clean_string(payload.location.provinceName)
    city_name = _clean_string(payload.location.cityName)
    barangay_name = _clean_string(payload.location.barangayName)
    latitude = payload.location.latitude
    longitude = payload.location.longitude

    return {
        "reporter": {
            **reporter,
        },
        "location": {
            "regionCode": region_code,
            "regionName": region_name,
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
        "symptomIds": symptom_ids,
        "symptomLabels": symptom_labels,
        "submittedSymptoms": submitted_symptoms,
        "possibleConditionId": possible_condition_id,
        "possibleConditionLabel": possible_condition_label,
        "notes": _clean_string(payload.notes),
        "status": _normalize_self_report_status(payload.status),
        "source": _normalize_self_report_source(payload.source),
        "createdAt": created_at,
        "updatedAt": created_at,
        "syncedAt": synced_at,
    }

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

def _coerce_self_report_datetime(value):
    """Store offset-bearing mobile report times as Philippine wall-clock time.

    A timestamp without an offset has historically meant Philippine local time,
    so it is deliberately left alone rather than treated as UTC.
    """
    if value in [None, ""]:
        return None
    raw_value = value.isoformat() if isinstance(value, datetime) else str(value)
    try:
        parsed = datetime.fromisoformat(raw_value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed
    return parsed.astimezone(timezone(timedelta(hours=8))).replace(tzinfo=None)

async def create_mobile_self_report(
    payload: SelfReportPayload,
    mobile_claims: Annotated[dict | None, Depends(optional_mobile_auth)],
):
    symptom_ids, _ = _normalize_symptom_fields(
        symptom_ids=payload.symptomIds,
        symptom_labels=payload.symptomLabels,
    )
    if not symptom_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one symptom is required",
        )

    authenticated_mobile_user = None
    if mobile_claims:
        authenticated_mobile_user = mobile_users_collection.find_one(
            {
                "id": mobile_claims["sub"],
                "source": MOBILE_REGISTRATION_SOURCE,
                "roleId": MOBILE_ROLE_ID,
            }
        )
        if not authenticated_mobile_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Mobile user not found",
            )
    elif _normalize_reporter_type(payload.reporter.reporterType) == "registered":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mobile authentication is required for registered reports",
            headers={"WWW-Authenticate": "Bearer"},
        )

    document = _build_self_report_document(payload, authenticated_mobile_user)
    document["location"] = await asyncio.to_thread(
        populate_self_report_location, document["location"]
    )
    from config.database import report_id_counters_collection

    try:
        inserted_report = insert_report_with_id(
            self_reports_collection, report_id_counters_collection, document
        )
    except ReportIdError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    created_report = self_reports_collection.find_one({"_id": inserted_report.inserted_id})

    analytics_entry_id = None
    analytics_entry = build_self_report_analytics_entry(created_report)

    if analytics_entry:
        inserted_analytics_entry = analytics_entries_collection.insert_one(
            analytics_entry
        )
        analytics_entry_id = str(inserted_analytics_entry.inserted_id)

        self_reports_collection.update_one(
            {"_id": inserted_report.inserted_id},
            {
                "$set": {
                    "analyticsEntryId": analytics_entry_id,
                    "updatedAt": get_ph_datetime(),
                }
            },
        )
        created_report = self_reports_collection.find_one(
            {"_id": inserted_report.inserted_id}
        )

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "message": "Self-report submitted successfully",
            "item": _serialize_self_report(created_report),
            "mobileUser": serialize_mobile_user(authenticated_mobile_user) if authenticated_mobile_user else None,
            "analyticsEntryId": analytics_entry_id,
        },
    )

async def fetch_mobile_self_reports_mine(
    mobile_claims: Annotated[dict, Depends(require_mobile_auth)],
):
    mobile_user_id = mobile_claims["sub"]
    mobile_user = mobile_users_collection.find_one(
        {
            "id": mobile_user_id,
            "source": MOBILE_REGISTRATION_SOURCE,
            "roleId": MOBILE_ROLE_ID,
        }
    )
    if not mobile_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mobile user not found",
        )

    reports = list(
        self_reports_collection.find(
            {"source": SELF_REPORT_SOURCE, "reporter.mobileUserId": mobile_user_id}
        ).sort([("createdAt", -1), ("_id", -1)])
    )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"items": [_serialize_self_report(report) for report in reports]},
    )
