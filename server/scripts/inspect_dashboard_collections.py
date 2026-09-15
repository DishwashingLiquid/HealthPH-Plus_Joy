"""Read-only collection inventory for the three mobile-connected dashboards.

Loads connection settings without importing the API or starting its scheduler.
Prints counts and index/storage metadata only; never reads document payloads
into the output or creates indexes, collections, or migration markers.
"""
import argparse
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient


COLLECTIONS = (
    "self_reports", "mobile_users", "regional_symptom_summaries",
    "regional_summary_events", "regional_alerts", "mobile_notification_deliveries",
    "regional_alert_batch_states", "regional_alert_cooldowns",
    "application_settings", "content", "analytics_events",
    "health_literacy_feedback", "surveys", "survey_responses", "analytics_entries", "id_counters",
)


def retention_diagnostics(db, names):
    """Return aggregate lifecycle evidence without report or account payloads."""
    at = datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)
    diagnostics = {"evaluatedAtPhilippineTime": at.isoformat()}
    if "regional_summary_events" in names:
        events = db.regional_summary_events
        diagnostics["events"] = {
            "consumed": events.count_documents({"consumedBatchId": {"$exists": True}}, maxTimeMS=10000),
            "unconsumed": events.count_documents({"consumedBatchId": {"$exists": False}}, maxTimeMS=10000),
            "olderThanMaximumWindow": events.count_documents(
                {"occurredAt": {"$lt": at - timedelta(days=1)}}, maxTimeMS=10000),
            "missingSource": list(events.aggregate([
                {"$lookup": {"from": "self_reports", "localField": "reportId", "foreignField": "_id", "as": "sourceMatches"}},
                {"$match": {"sourceMatches": {"$size": 0}}},
                {"$count": "count"},
            ], maxTimeMS=10000)),
        }
    if "regional_alert_cooldowns" in names:
        diagnostics["expiredCooldowns"] = db.regional_alert_cooldowns.count_documents(
            {"expiresAt": {"$lte": at}}, maxTimeMS=10000)
    if "regional_alert_batch_states" in names:
        diagnostics["processingBatches"] = db.regional_alert_batch_states.count_documents(
            {"status": "Processing"}, maxTimeMS=10000)
    if "regional_symptom_summaries" in names:
        diagnostics["nonzeroSummaries"] = db.regional_symptom_summaries.count_documents(
            {"reportCount": {"$gt": 0}}, maxTimeMS=10000)
    if "content" in names:
        diagnostics["embeddedMediaRecords"] = db.content.count_documents(
            {"media.dataUrl": {"$exists": True}}, maxTimeMS=10000)
    for name in ("id_counters", "application_settings"):
        if name in names:
            # Show shape and numeric sequence values, not arbitrary field values.
            diagnostics[name] = list(db[name].aggregate([
                {"$project": {"_id": 0, "bytes": {"$bsonSize": "$$ROOT"},
                              "fields": {"$map": {"input": {"$objectToArray": "$$ROOT"}, "as": "field", "in": "$$field.k"}},
                              "numericFields": {"$filter": {"input": {"$objectToArray": "$$ROOT"}, "as": "field",
                                  "cond": {"$in": [{"$type": "$$field.v"}, ["int", "long"]]}}}}},
            ], maxTimeMS=10000))
    return diagnostics


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--retention-details", action="store_true", help="Also inspect aggregate lifecycle and counter metadata")
    args = parser.parse_args()
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    result = {"mode": "read-only", "observedAt": datetime.now(timezone.utc).isoformat(),
              "collections": [], "consistentSnapshot": False}
    try:
        with MongoClient(os.environ["MONGO_URI"], serverSelectionTimeoutMS=10000,
                         connectTimeoutMS=10000, socketTimeoutMS=10000) as client:
            db = client[os.environ["DB_NAME"]]
            names = set(db.list_collection_names())
            result["existingCollectionNames"] = sorted(names)
            for name in COLLECTIONS:
                item = {"name": name, "exists": name in names}
                result["collections"].append(item)
                if name not in names:
                    continue
                collection = db[name]
                item["count"] = collection.count_documents({}, maxTimeMS=10000)
                item["indexes"] = list(collection.list_indexes())
                try:
                    stats = db.command("collStats", name, scale=1, maxTimeMS=10000)
                    item.update({key: stats.get(key) for key in
                                 ("size", "storageSize", "totalIndexSize", "avgObjSize")})
                except Exception as error:
                    item["statsErrorType"] = type(error).__name__
            if args.retention_details:
                result["retentionDiagnostics"] = retention_diagnostics(db, names)
        result["status"] = "complete"
    except Exception as error:
        # Driver messages can contain connection details. Emit only the class.
        result.update(status="failed", errorType=type(error).__name__)
    print(json.dumps(result, default=str, indent=2))
    return 0 if result["status"] == "complete" else 1


if __name__ == "__main__":
    raise SystemExit(main())
