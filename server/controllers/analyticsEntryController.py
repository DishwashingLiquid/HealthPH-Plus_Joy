from typing_extensions import Annotated
from bson import ObjectId
from fastapi import Depends, Query

from config.database import analytics_entries_collection
from middleware.requireAuth import require_auth
from schema.analyticsEntrySchema import list_analytics_entries

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