from typing_extensions import Annotated
from bson import ObjectId
from fastapi import Depends, Query, Body, HTTPException, status

from config.database import analytics_entries_collection
from middleware.requireAuth import require_auth
from middleware.requireRole import require_role
from schema.analyticsEntrySchema import list_analytics_entries
from helpers.miscHelpers import get_ph_datetime

ANALYTICS_PROCESSOR_UNAVAILABLE_MESSAGE = (
    "Analytics processor is not connected yet. Entry is saved and can be retried once NLP/model integration is available."
)

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

async def process_analytics_entries(
    current_user: Annotated[dict, Depends(require_role(["Admin", "SUPERADMIN"]))],
    entry_ids: list[str] = Body(...),
):
    valid_entry_ids = [
        ObjectId(entry_id)
        for entry_id in entry_ids
        if ObjectId.is_valid(entry_id)
    ]

    if not valid_entry_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select at least one valid analytics entry.",
        )

    analytics_entries_collection.update_many(
        {
            "_id": {"$in": valid_entry_ids},
            "analysis_status": {"$in": ["pending", "failed"]},
        },
        {
            "$set": {
                "analysis_status": "failed",
                "analysis_error": ANALYTICS_PROCESSOR_UNAVAILABLE_MESSAGE,
                "updated_at": get_ph_datetime(),
            }
        },
    )

    return {
        "message": "Selected analytics entries queued for processing placeholder.",
        "processed_count": len(valid_entry_ids),
    }