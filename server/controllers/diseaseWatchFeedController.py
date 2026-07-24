from collections import Counter
from datetime import datetime, timedelta
from typing import Iterable

from bson import ObjectId
from fastapi import Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from typing_extensions import Annotated

from config.database import dataset_collection, point_collection, user_collection
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
    current_user = _get_current_user(current_user_id)
    normalized_regions = _parse_region_list(region)
    disease_code = _normalize_disease_code(disease)
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

    point_entries = _get_point_entries(
        current_user=current_user,
        date_from=parsed_date_from,
        date_to=parsed_date_to,
    )
    point_entries = _filter_point_entries(
        point_entries,
        regions=normalized_regions,
        disease_code=disease_code,
    )
    alerts = _build_alert_items(point_entries, disease_code=disease_code)

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
    current_user = _get_current_user(current_user_id)
    normalized_regions = _parse_region_list(regions)
    disease_code = _normalize_disease_code(disease)
    parsed_date_from = _parse_datetime(date_from)
    parsed_date_to = _parse_datetime(date_to, end_of_day=True)

    _validate_date_range(parsed_date_from, parsed_date_to)

    scoped_users = _get_scoped_users(current_user)
    user_counts = Counter()

    for user in scoped_users:
        region_code = _normalize_region_safely(user.get("region"))
        if region_code and region_code != "ALL":
            user_counts[region_code] += 1

    point_entries = _get_point_entries(
        current_user=current_user,
        date_from=parsed_date_from,
        date_to=parsed_date_to,
    )
    point_entries = _filter_point_entries(
        point_entries,
        regions=normalized_regions,
        disease_code=disease_code,
    )

    alert_counts = Counter()
    report_counts = Counter()

    for entry in point_entries:
        region_code = entry["region"]
        report_counts[region_code] += entry["total_reports"]

        if _build_alert_item(entry, disease_code=disease_code):
            alert_counts[region_code] += 1

    if normalized_regions:
        region_list = normalized_regions
    else:
        region_list = _sort_regions(set(user_counts.keys()) | set(report_counts.keys()))

    total_users = sum(user_counts.values())

    response_regions = []
    for region_code in region_list:
        users = user_counts.get(region_code, 0)
        response_regions.append(
            {
                "region": region_code,
                "users": users,
                "percentage": round((users / total_users) * 100) if total_users else 0,
                "alertCount": alert_counts.get(region_code, 0),
                "reportCount": report_counts.get(region_code, 0),
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
    current_user = _get_current_user(current_user_id)
    normalized_regions = _parse_region_list(region)
    parsed_date_from = _parse_datetime(date_from)
    parsed_date_to = _parse_datetime(date_to, end_of_day=True)

    (
        current_from,
        current_to,
        previous_from,
        previous_to,
    ) = _resolve_window(parsed_date_from, parsed_date_to, default_days=30)

    scoped_users = _get_scoped_users(current_user)

    def count_users_at(cutoff):
        total = 0
        for user in scoped_users:
            region_code = _normalize_region_safely(user.get("region"))
            if normalized_regions and region_code not in normalized_regions:
                continue
            created_at = _coerce_datetime(user.get("created_at"))
            if created_at and created_at <= cutoff:
                total += 1
        return total

    total_users_current = count_users_at(current_to)
    total_users_previous = count_users_at(previous_to)

    symptom_reports_current = _count_raw_reports(
        current_user=current_user,
        date_from=current_from,
        date_to=current_to,
    )
    symptom_reports_previous = _count_raw_reports(
        current_user=current_user,
        date_from=previous_from,
        date_to=previous_to,
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
    current_user = _get_current_user(current_user_id)
    normalized_regions = _parse_region_list(region)
    disease_code = _normalize_disease_code(disease)
    parsed_date_from = _parse_datetime(date_from)
    parsed_date_to = _parse_datetime(date_to, end_of_day=True)
    current_from, current_to, _, _ = _resolve_window(
        parsed_date_from,
        parsed_date_to,
        default_days=7,
    )

    point_entries = _get_point_entries(
        current_user=current_user,
        date_from=current_from,
        date_to=current_to,
    )
    point_entries = _filter_point_entries(
        point_entries,
        regions=normalized_regions,
        disease_code=disease_code,
    )
    alerts = _build_alert_items(point_entries, disease_code=disease_code)

    alert_distribution_count = len(
        [alert for alert in alerts if alert["type"] == "Alert Distribution"]
    )
    early_warning_count = len(
        [alert for alert in alerts if alert["type"] == "Early Warning"]
    )

    if disease_code:
        symptom_report_count = sum(entry["total_reports"] for entry in point_entries)
    else:
        symptom_report_count = _count_raw_reports(
            current_user=current_user,
            date_from=current_from,
            date_to=current_to,
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "cards": [
                {
                    "key": "alert-distribution",
                    "label": "Alert Distribution",
                    "value": alert_distribution_count,
                    "helper": "alerts in selected period",
                },
                {
                    "key": "early-warning",
                    "label": "Early Warning",
                    "value": early_warning_count,
                    "helper": "elevated disease clusters",
                },
                {
                    "key": "symptom-report",
                    "label": "Symptom Report",
                    "value": symptom_report_count,
                    "helper": "reports submitted",
                },
            ],
            "updatedAt": get_ph_datetime().isoformat(),
        },
    )


async def fetch_mobile_filter_options(
    current_user_id: Annotated[str, Depends(require_auth)],
):
    current_user = _get_current_user(current_user_id)
    scoped_users = _get_scoped_users(current_user)
    point_entries = _get_point_entries(current_user=current_user)

    region_values = set()

    for user in scoped_users:
        region_code = _normalize_region_safely(user.get("region"))
        if region_code and region_code != "ALL":
            region_values.add(region_code)

    for entry in point_entries:
        region_values.add(entry["region"])

    disease_values = set()
    for entry in point_entries:
        for disease_code in entry["annotations_count"].keys():
            if disease_code in DISEASE_CODE_TO_LABEL:
                disease_values.add(DISEASE_CODE_TO_LABEL[disease_code])

    if not disease_values:
        disease_values = set(DISEASE_CODE_TO_LABEL.values())

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "regions": _sort_regions(region_values),
            "diseases": sorted(disease_values),
            "dateRanges": ["last-7-days", "last-30-days", "custom"],
        },
    )
