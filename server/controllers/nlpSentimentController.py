from typing import Annotated

from fastapi import BackgroundTasks, Depends, HTTPException
from fastapi.responses import JSONResponse

from config.database import analytics_entries_collection
from helpers.analyticsAccessHelpers import get_allowed_analytics_regions, get_analytics_entry_region
from helpers.analyticsSentimentHelpers import (
    ENTRY_FIELDS, SOURCES, eligible_text, has_sentiment, is_processing,
    run_sentiment_processing, summarize_sentiments,
)
from middleware.requirePage import require_page

NlpUser = Annotated[dict, Depends(require_page("NLP Insights"))]


def can_process(user):
    return str(user.get("user_type", "")).upper() in {"ADMIN", "SUPERADMIN"} or user.get("role_label") == "Admin"


def _entries():
    return analytics_entries_collection.find({
        "analysis_status": "PROCESSED", "source_type": {"$in": list(SOURCES)},
    }, ENTRY_FIELDS).sort("_id", -1)


def fetch_nlp_sentiment_summary(current_user: NlpUser):
    return {
        **summarize_sentiments(_entries(), get_allowed_analytics_regions(current_user)),
        "can_process": can_process(current_user),
    }


def process_nlp_sentiments(background_tasks: BackgroundTasks, current_user: NlpUser):
    if not can_process(current_user):
        raise HTTPException(403, "Only administrators can process sentiment results.")
    allowed = get_allowed_analytics_regions(current_user)
    ids = []
    for entry in _entries():
        if allowed is not None and get_analytics_entry_region(entry) not in allowed:
            continue
        if eligible_text(entry) and not has_sentiment(entry) and not is_processing(entry):
            ids.append(entry["_id"])
        if len(ids) == 500:
            break
    if not ids:
        raise HTTPException(400, "No processed reports need sentiment analysis right now.")
    background_tasks.add_task(run_sentiment_processing, analytics_entries_collection, ids)
    return JSONResponse(status_code=202, content={"message": "Reports queued for sentiment analysis.", "queued_count": len(ids)})
