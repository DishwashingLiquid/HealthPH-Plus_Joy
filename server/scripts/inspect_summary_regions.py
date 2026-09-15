"""Read-only region inventory; no application imports, startup, or writes."""
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient


def main():
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    with MongoClient(os.environ["MONGO_URI"], serverSelectionTimeoutMS=10000) as client:
        db = client[os.environ["DB_NAME"]]
        result = {}
        for collection, fields in (
            ("self_reports", {"source": "$source", "status": "$status", "code": "$location.regionCode", "name": "$location.regionName"}),
            ("mobile_users", {"code": "$regionCode", "name": "$regionLabel"}),
        ):
            result[collection] = list(db[collection].aggregate([
                {"$group": {"_id": fields, "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
            ]))
        result["summaries"] = list(db.regional_symptom_summaries.find({}, {"_id": 0, "region": 1, "reportCount": 1, "isReady": 1}))
        result["events"] = db.regional_summary_events.count_documents({})
        result["markers"] = list(db.application_settings.find({"_id": {"$in": ["regional_symptom_summary_backfill_v1", "regional_symptom_summary_reconciliation_v2"]}}))
        print(json.dumps(result, default=str, indent=2))


if __name__ == "__main__":
    main()
