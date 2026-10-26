from collections import Counter, defaultdict

from typing_extensions import Annotated
from bson import ObjectId
from fastapi import BackgroundTasks, Body, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from pymongo import UpdateOne

from config.database import analytics_entries_collection
from middleware.requireAuth import require_auth
from middleware.requireRole import require_role
from middleware.requirePage import require_page

from schema.analyticsEntrySchema import list_analytics_entries
from helpers.languageDetectionHelpers import (
    SUPPORTED_LANGUAGE_CODES,
    detect_languages,
)
from helpers.analyticsAccessHelpers import (
    get_allowed_analytics_regions,
    get_analytics_entry_region,
)
from helpers.diseaseDetectionHelpers import detect_diseases

from helpers.miscHelpers import get_ph_datetime
from region_normalization import normalize_region


MAP_DISEASE_CODES = {"TB", "PN", "COVID", "AURI"}


"""
@desc = "Fetch analytics entries"
@route = "GET api/analytics-entries"
@access = "Private"
"""

async def fetch_analytics_entries(
    user_id: Annotated[str, Depends(require_auth)],
    source_type: str = Query("all"),
    analysis_status: str = Query("all"),
    dataset_id: str = Query("all"),
    search: str = Query(""),
    limit: int = Query(100),
):
    query = {}

    if source_type != "all":
        query["source_type"] = source_type

    if analysis_status != "all":
        query["analysis_status"] = analysis_status

    if dataset_id != "all":
        query["dataset_id"] = dataset_id

    if search:
        query["text"] = {"$regex": search, "$options": "i"}

    limit = max(1, min(limit, 500))

    entries = analytics_entries_collection.find(query).sort(
        "created_at", -1
    ).limit(limit)

    total = analytics_entries_collection.count_documents(query)

    return {
        "total": total,
        "entries": list_analytics_entries(entries),
    }


async def fetch_self_report_language_summary(
    current_user: Annotated[
        dict,
        Depends(require_page("NLP Insights")),
    ],
):
    entries = analytics_entries_collection.find(
        {
            "source_type": "self_report",
            "analysis_status": "PROCESSED",
            "analysis.language_detection.status": "completed",
            "language": {"$in": sorted(SUPPORTED_LANGUAGE_CODES)},
        },
        {
            "language": 1,
            "location": 1,
        },
    )

    language_counts = Counter()
    location_language_counts = defaultdict(Counter)
    allowed_regions = get_allowed_analytics_regions(current_user)

    for entry in entries:
        region = get_analytics_entry_region(entry)

        if allowed_regions is not None and region not in allowed_regions:
            continue

        language = entry.get("language")
        language_counts[language] += 1

        location = entry.get("location") or {}
        location_label = str(
            location.get("province")
            or location.get("region")
            or location.get("raw")
            or ""
        ).strip()

        if location_label:
            location_language_counts[location_label][language] += 1

    return {
        "source_type": "self_report",
        "record_count": sum(language_counts.values()),
        "language_counts": dict(language_counts),
        "location_language_counts": {
            location: dict(counts)
            for location, counts in location_language_counts.items()
        },
    }


async def fetch_analytics_map_points(
    current_user: Annotated[
        dict,
        Depends(require_page("AI Surveillance")),
    ],
):
    entries = analytics_entries_collection.find(
        {
            "analysis_status": "PROCESSED",
            "location.latitude": {"$ne": None},
            "location.longitude": {"$ne": None},
            "analysis.disease_labels.0": {"$exists": True},
        },
        {
            "location": 1,
            "analysis.disease_labels": 1,
        },
    )

    grouped_points = {}

    allowed_regions = get_allowed_analytics_regions(current_user)

    for entry in entries:
        region = get_analytics_entry_region(entry)

        if allowed_regions is not None and region not in allowed_regions:
            continue

        location = entry.get("location") or {}

        try:
            latitude = float(location.get("latitude"))
            longitude = float(location.get("longitude"))
        except (TypeError, ValueError):
            continue

        if not (4 <= latitude <= 22 and 116 <= longitude <= 128):
            continue

        labels = {
            str(label).strip().upper()
            for label in (entry.get("analysis") or {}).get("disease_labels", [])
        } & MAP_DISEASE_CODES

        if not labels:
            continue

        region = region or ""
        point_key = (region, round(latitude, 6), round(longitude, 6))

        if point_key not in grouped_points:
            grouped_points[point_key] = {
                "PH_code": "",
                "region": region,
                "province": str(location.get("province") or "").strip(),
                "lat": latitude,
                "long": longitude,
                "annotation_counts": Counter(),
                "keyword_counts": Counter(),
                "keyword_annotations": defaultdict(set),
            }

        point = grouped_points[point_key]
        point["annotation_counts"].update(labels)

    map_points = []

    for point in grouped_points.values():
        annotation_counts = dict(point.pop("annotation_counts"))
        keyword_counts = point.pop("keyword_counts")
        keyword_annotations = point.pop("keyword_annotations")

        map_points.append(
            {
                **point,
                "annotations": sorted(annotation_counts),
                "annotations_count": annotation_counts,
                "keywords": [
                    {
                        "key": keyword,
                        "count": count,
                        "annotation": sorted(keyword_annotations[keyword]),
                    }
                    for keyword, count in keyword_counts.most_common(3)
                ],
            }
        )

    return map_points

def fetch_surveillance_summary(
    current_user: Annotated[
        dict,
        Depends(require_page("AI Surveillance")),
    ],
    region: str = Query("all"),
    disease: str = Query("all"),
):
    allowed_regions = get_allowed_analytics_regions(current_user)

    selected_region = None
    if region.strip().lower() != "all":
        selected_region = normalize_region(region)

        if not selected_region:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid region filter.",
            )

        if (
            allowed_regions is not None
            and selected_region not in allowed_regions
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this region.",
            )

    selected_disease = disease.strip().upper()

    if selected_disease != "ALL" and selected_disease not in MAP_DISEASE_CODES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid disease filter.",
        )

    entries = analytics_entries_collection.find(
        {
            "analysis_status": "PROCESSED",
            "source_type": {"$in": ["social_media", "self_report"]},
        },
        {
            "_id": 0,
            "location": 1,
            "analysis.disease_labels": 1,
        },
    )

    processed_entries = 0
    disease_positive_entries = 0
    disease_counts = Counter()
    active_regions = set()

    for entry in entries:
        entry_region = get_analytics_entry_region(entry)

        if (
            allowed_regions is not None
            and entry_region not in allowed_regions
        ):
            continue

        if selected_region and entry_region != selected_region:
            continue

        raw_labels = (entry.get("analysis") or {}).get(
            "disease_labels", []
        )

        labels = (
            {
                str(label).strip().upper()
                for label in raw_labels
            } & MAP_DISEASE_CODES
            if isinstance(raw_labels, list)
            else set()
        )

        if selected_disease != "ALL":
            if selected_disease not in labels:
                continue
            labels = {selected_disease}

        processed_entries += 1

        if labels:
            disease_positive_entries += 1
            disease_counts.update(labels)

            if entry_region:
                active_regions.add(entry_region)

    return {
        "processed_entry_count": processed_entries,
        "disease_positive_entry_count": disease_positive_entries,
        "disease_label_count": sum(disease_counts.values()),
        "disease_counts": {
            code: disease_counts[code]
            for code in sorted(MAP_DISEASE_CODES)
        },
        "active_region_count": len(active_regions),
        "active_regions": sorted(active_regions),
    }

PROCESSABLE_SOURCE_TYPES = ["self_report"]

def run_analytics_entry_processing_job(entry_ids: list[str]):
    object_ids = [ObjectId(entry_id) for entry_id in entry_ids]

    analytics_entries_collection.update_many(
        {
            "_id": {"$in": object_ids},
            "analysis_status": "QUEUED",
        },
        {
            "$set": {
                "analysis_status": "PROCESSING",
                "analysis_error": "",
                "analysis_started_at": get_ph_datetime(),
                "updated_at": get_ph_datetime(),
            }
        },
    )

    try:
        entries = list(
            analytics_entries_collection.find(
                {
                    "_id": {"$in": object_ids},
                    "source_type": {"$in": PROCESSABLE_SOURCE_TYPES},
                    "analysis_status": "PROCESSING",
                }
            ).sort("_id", 1)
        )

        if not entries:
            raise RuntimeError("No analytics entries are available for processing.")

        texts = [
            entry["text"]
            for entry in entries
        ]

        language_predictions = detect_languages(texts)
        disease_predictions = detect_diseases(texts)

        completed_at = get_ph_datetime()
        updates = []

        for entry, language_prediction, disease_prediction in zip(
            entries,
            language_predictions,
            disease_predictions,
            strict=True,
        ):
            is_supported = language_prediction["is_supported"]

            updates.append(
                UpdateOne(
                    {"_id": entry["_id"]},
                    {
                        "$set": {
                            "language": (
                                language_prediction["language"]
                                if is_supported
                                else ""
                            ),
                            "analysis.language_detection": {
                                "status": (
                                    "completed"
                                    if is_supported
                                    else "unsupported"
                                ),
                                "detection_source": (
                                    language_prediction["detection_source"]
                                ),
                                "confidence": (
                                    language_prediction["confidence"]
                                    if is_supported
                                    else None
                                ),
                                "completed_at": completed_at,
                            },
                            "analysis.disease_labels": (
                                disease_prediction["labels"]
                            ),
                            "analysis.disease_probabilities": (
                                disease_prediction["probabilities"]
                            ),
                            "analysis.disease_classification": {
                                "status": "completed",
                                "thresholds_used": (
                                    disease_prediction["thresholds_used"]
                                ),
                                "model_version": (
                                    disease_prediction["model_version"]
                                ),
                                "completed_at": completed_at,
                            },
                            "analysis_status": "PROCESSED",
                            "analysis_error": "",
                            "analyzed_at": completed_at,
                            "updated_at": completed_at,
                        }
                    },
                )
            )

        update_result = analytics_entries_collection.bulk_write(updates)

        if update_result.matched_count != len(entries):
            raise RuntimeError(
                "Not all selected analytics entries were updated."
            )

    except Exception as error:
        analytics_entries_collection.update_many(
            {
                "_id": {"$in": object_ids},
                "analysis_status": {
                    "$in": ["QUEUED", "PROCESSING"],
                },
            },
            {
                "$set": {
                    "analysis_status": "FAILED",
                    "analysis_error": str(error),
                    "updated_at": get_ph_datetime(),
                }
            },
        )

async def process_analytics_entries(
    background_tasks: BackgroundTasks,
    current_user: Annotated[
        dict,
        Depends(require_role(["Admin", "SUPERADMIN"])),
    ],
    entry_ids: list[str] = Body(...),
):
    if not entry_ids or any(
        not ObjectId.is_valid(entry_id)
        for entry_id in entry_ids
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Every selected analytics entry must have a valid ID.",
        )

    object_ids = list({
        ObjectId(entry_id)
        for entry_id in entry_ids
    })

    eligible_entries = list(
        analytics_entries_collection.find(
            {
                "_id": {"$in": object_ids},
                "source_type": {"$in": PROCESSABLE_SOURCE_TYPES},
                "analysis_status": {"$in": ["SUBMITTED", "FAILED"]},
            },
            {"_id": 1},
        )
    )

    if not eligible_entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No selected entries are ready for processing.",
        )

    eligible_ids = [
        entry["_id"]
        for entry in eligible_entries
    ]

    queued_at = get_ph_datetime()

    analytics_entries_collection.update_many(
        {"_id": {"$in": eligible_ids}},
        {
            "$set": {
                "analysis_status": "QUEUED",
                "analysis_error": "",
                "queued_at": queued_at,
                "updated_at": queued_at,
            }
        },
    )

    background_tasks.add_task(
        run_analytics_entry_processing_job,
        [str(entry_id) for entry_id in eligible_ids],
    )

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={
            "message": (
                "Self-report entries queued for language and disease processing."
            ),
            "queued_count": len(eligible_ids),
        },
    )
