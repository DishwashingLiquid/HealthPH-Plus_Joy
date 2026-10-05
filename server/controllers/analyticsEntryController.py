from typing_extensions import Annotated
from bson import ObjectId
from fastapi import BackgroundTasks, Body, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from pymongo import UpdateOne

from config.database import analytics_entries_collection
from middleware.requireAuth import require_auth
from middleware.requireRole import require_role
from schema.analyticsEntrySchema import list_analytics_entries
from helpers.languageDetectionHelpers import detect_languages
from helpers.miscHelpers import get_ph_datetime


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

PROCESSABLE_SOURCE_TYPES = ["survey_response", "self_report"]

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

        predictions = detect_languages([
            entry["text"]
            for entry in entries
        ])

        completed_at = get_ph_datetime()
        updates = []

        for entry, prediction in zip(entries, predictions, strict=True):
            is_supported = prediction["is_supported"]

            updates.append(
                UpdateOne(
                    {"_id": entry["_id"]},
                    {
                        "$set": {
                            "language": (
                                prediction["language"]
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
                                    prediction["detection_source"]
                                ),
                                "confidence": (
                                    prediction["confidence"]
                                    if is_supported
                                    else None
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
            "message": "Analytics entries queued for language processing.",
            "queued_count": len(eligible_ids),
        },
    )
