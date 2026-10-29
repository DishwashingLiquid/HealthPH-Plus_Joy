"""Read-only region inventory; no application imports, startup, or writes."""
import json
import os
from pathlib import Path
import sys

SERVER_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_ROOT))

from dotenv import load_dotenv
from pymongo import MongoClient

from disease_watch_storage import (
    REGIONAL_SUMMARY,
    SUMMARY_EVENT,
    assert_disease_watch_cutover_ready,
    scoped_collections,
)


def main():
    load_dotenv(SERVER_ROOT / ".env")
    with MongoClient(os.environ["MONGO_URI"], serverSelectionTimeoutMS=10000) as client:
        db = client[os.environ["DB_NAME"]]
        assert_disease_watch_cutover_ready(db)
        views = scoped_collections(db.disease_watch_internal)
        result = {}
        for collection, fields in (
            ("self_reports", {"source": "$source", "status": "$status", "code": "$location.regionCode", "name": "$location.regionName"}),
            ("mobile_users", {"code": "$regionCode", "name": "$regionLabel"}),
        ):
            result[collection] = list(db[collection].aggregate([
                {"$group": {"_id": fields, "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
            ]))
        result["summaries"] = list(views[REGIONAL_SUMMARY].find({}, {"_id": 0, "region": 1, "reportCount": 1, "isReady": 1}))
        result["events"] = views[SUMMARY_EVENT].count_documents({})
        result["markers"] = list(db.application_settings.find({"_id": {"$in": ["regional_symptom_summary_backfill_v1", "regional_symptom_summary_reconciliation_v2"]}}))
        print(json.dumps(result, default=str, indent=2))


if __name__ == "__main__":
    main()
