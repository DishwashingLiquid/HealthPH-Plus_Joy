"""Sentiment annotations for reports; reuse the shared, private HTTP service."""
import hashlib
import logging
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from controllers.sentiment_pulse.inference_client import (
    BATCH_SIZE, SentimentClient, probability, valid_version,
)
from helpers.analyticsAccessHelpers import get_analytics_entry_region
from helpers.surveillanceDateHelpers import parse_analytics_datetime

logger = logging.getLogger(__name__)
SOURCES = ("self_report", "social_media")
LABELS = ("calm", "worried")
ENTRY_FIELDS = {
    "_id": 1, "source_type": 1, "report_id": 1, "source_id": 1,
    "text": 1, "location": 1, "analysis": 1, "event_time": 1,
}


def input_hash(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def eligible_text(entry):
    text = entry.get("text")
    return isinstance(text, str) and bool(text.strip()) and len(text) <= 10000


def has_sentiment(entry):
    analysis = entry.get("analysis") or {}
    classification = analysis.get("sentiment_classification") or {}
    score = analysis.get("sentiment_score")
    threshold = classification.get("threshold_used")
    return (
        eligible_text(entry)
        and classification.get("status") == "completed"
        and classification.get("input_hash") == input_hash(entry["text"])
        and probability(score) and probability(threshold)
        and valid_version(analysis.get("sentiment_model_version"))
        and analysis.get("sentiment") == LABELS[int(score >= threshold)]
    )


def is_processing(entry):
    classification = (entry.get("analysis") or {}).get("sentiment_classification") or {}
    lease = parse_analytics_datetime(classification.get("lease_until"))
    return (eligible_text(entry) and classification.get("status") == "processing"
            and classification.get("input_hash") == input_hash(entry["text"])
            and lease is not None and lease > datetime.now(timezone.utc))


def report_key(entry):
    identifier = entry["_id"]
    if entry["source_type"] == "self_report":
        identifier = entry.get("report_id") or entry.get("source_id") or identifier
    return entry["source_type"], str(identifier)


def summarize_sentiments(entries, allowed_regions):
    seen = set()
    totals = Counter()
    distribution = Counter({label: 0 for label in LABELS})
    regions, dates, versions = defaultdict(Counter), defaultdict(Counter), Counter()
    for entry in entries:
        region = get_analytics_entry_region(entry)
        if allowed_regions is not None and region not in allowed_regions:
            continue
        key = report_key(entry)
        if key in seen:
            continue
        seen.add(key)
        totals["processed_reports"] += 1
        if not eligible_text(entry):
            totals["ineligible_reports"] += 1
            continue
        if not has_sentiment(entry):
            classification = (entry.get("analysis") or {}).get("sentiment_classification") or {}
            state = "processing" if is_processing(entry) else "failed" if classification.get("status") == "failed" else "pending"
            totals[f"{state}_reports"] += 1
            continue
        totals["scored_reports"] += 1
        analysis = entry["analysis"]
        label = analysis["sentiment"]
        distribution[label] += 1
        regions[region or "UNMAPPED"][label] += 1
        versions[analysis["sentiment_model_version"]] += 1
        event = parse_analytics_datetime(entry.get("event_time"))
        if event is not None:
            dates[event.date().isoformat()][label] += 1
        else:
            totals["undated_reports"] += 1
    return {
        **{key: totals[key] for key in (
            "processed_reports", "scored_reports", "pending_reports", "processing_reports",
            "failed_reports", "ineligible_reports", "undated_reports",
        )},
        "distribution": [{"label": label, "count": distribution[label]} for label in LABELS],
        "regions": [{"region": region, **{label: counts[label] for label in LABELS}}
                    for region, counts in sorted(regions.items(), key=lambda item: (-sum(item[1].values()), item[0]))],
        "trends": [{"date": day, **{label: counts[label] for label in LABELS}} for day, counts in sorted(dates.items())],
        "model_versions": [{"version": version, "report_count": count} for version, count in sorted(versions.items())],
    }


def run_sentiment_processing(collection, entry_ids, client_factory=SentimentClient):
    """Claim each input optimistically; preserve all other analysis results."""
    client = None
    claims = []
    try:
        entries = collection.find({
            "_id": {"$in": entry_ids}, "source_type": {"$in": list(SOURCES)},
            "analysis_status": "PROCESSED",
        }, ENTRY_FIELDS)
        for entry in entries:
            if not eligible_text(entry) or has_sentiment(entry) or is_processing(entry):
                continue
            analysis = entry.get("analysis") or {}
            previous = analysis.get("sentiment_classification")
            token = str(uuid4())
            now = datetime.now(timezone.utc)
            guard = {
                "_id": entry["_id"], "source_type": entry["source_type"], "text": entry["text"],
                "analysis_status": "PROCESSED", "analysis.sentiment_classification": previous,
            }
            classification = {
                "status": "processing", "job_id": token, "input_hash": input_hash(entry["text"]),
                "started_at": now.isoformat(), "lease_until": (now + timedelta(minutes=15)).isoformat(),
            }
            if not collection.update_one(guard, {"$set": {"analysis.sentiment_classification": classification}}).matched_count:
                continue
            claims.append((entry, token))
            if len(claims) == BATCH_SIZE:
                client = _process_batch(collection, claims, client, client_factory)
                claims = []
        if claims:
            client = _process_batch(collection, claims, client, client_factory)
    except Exception:
        # Never mark successful language/disease processing as failed.
        logger.exception("Report sentiment processing failed")
        for entry, token in claims:
            _fail_claim(collection, entry, token)
    finally:
        if client is not None:
            try:
                client.close()
            except Exception:
                logger.warning("Unable to close sentiment HTTP client")


def _claim_guard(entry, token):
    return {"_id": entry["_id"], "source_type": entry["source_type"], "text": entry["text"],
            "analysis_status": "PROCESSED", "analysis.sentiment_classification.job_id": token}


def _fail_claim(collection, entry, token):
    try:
        collection.update_one(_claim_guard(entry, token), {"$set": {
            "analysis.sentiment_classification.status": "failed",
            "analysis.sentiment_classification.error": "Sentiment service unavailable or processing failed. Please retry.",
        }})
    except Exception:
        logger.warning("Unable to record sentiment failure; the processing lease can be retried after expiry")


def _process_batch(collection, claims, client, client_factory):
    try:
        if client is None:
            client = client_factory()
        predictions = client.predict_batch([entry["text"] for entry, _ in claims])
        for (entry, token), prediction in zip(claims, predictions, strict=True):
            collection.update_one(_claim_guard(entry, token), {"$set": {
                "analysis.sentiment": prediction["predicted_label_name"],
                "analysis.sentiment_score": prediction["worried_probability"],
                "analysis.sentiment_model_version": prediction["model_version"],
                "analysis.sentiment_classification": {
                    "status": "completed", "input_hash": input_hash(entry["text"]),
                    "threshold_used": prediction["threshold_used"],
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
            }})
    except Exception:
        logger.warning("Report sentiment batch failed; results can be retried")
        for entry, token in claims:
            _fail_claim(collection, entry, token)
    return client
