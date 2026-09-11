"""Explicit repair command. Defaults to reads only; never imports the API.

Completed automatic batches are represented by consumed summary events.  This
repair intentionally preserves those events and never recreates them in an
active regional summary.  It does not enable alert automation.
"""
import argparse
import json
import os
from pathlib import Path
import sys
from datetime import datetime, timezone

SERVER_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_ROOT))

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.read_concern import ReadConcern
from pymongo.write_concern import WriteConcern
from regional_summaries import MIGRATION_ID, SummaryStore


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Read-only preview (default)")
    mode.add_argument("--apply", action="store_true", help="Apply ONLY after separate authorization")
    parser.add_argument("--writers-paused", action="store_true", help="Confirm all submission/update workers are paused")
    parser.add_argument("--output", type=Path, help="Save the JSON audit locally")
    args = parser.parse_args()
    if args.apply and not args.writers_paused:
        parser.error("--apply requires --writers-paused; pause all report/summary writers first")
    load_dotenv(SERVER_ROOT / ".env")
    committed = False
    try:
        with MongoClient(os.environ["MONGO_URI"], serverSelectionTimeoutMS=10000, connectTimeoutMS=10000) as client:
            db = client[os.environ["DB_NAME"]]
            store = SummaryStore(db.self_reports, db.regional_summary_events, db.regional_symptom_summaries, db.application_settings)
            # Snapshot reads give the audit a consistent source/derived view.
            # Starting a read-only transaction does not create indexes or records.
            with client.start_session() as session:
                if args.apply:
                    # Dedicated summary indexes only; never alert/delivery indexes.
                    # Existing duplicate keys fail safely here for operator review.
                    db.regional_symptom_summaries.create_index("region", unique=True, name="unique_regional_symptom_summary")
                    db.regional_summary_events.create_index([("region", 1), ("reportId", 1)], unique=True, name="unique_regional_summary_report")
                    audit = session.with_transaction(store.reconcile, read_concern=ReadConcern("snapshot"), write_concern=WriteConcern("majority"))
                    committed = True
                else:
                    with session.start_transaction(read_concern=ReadConcern("snapshot")):
                        audit = store.plan(session)[0]
                        audit["savedSummaries"] = list(db.regional_symptom_summaries.find({}, {"_id": 0, "region": 1, "reportCount": 1, "isReady": 1}, session=session))
                        audit["previousMigration"] = db.application_settings.find_one({"_id": "regional_symptom_summary_backfill_v1"}, session=session)
                        audit["currentMigration"] = db.application_settings.find_one({"_id": MIGRATION_ID}, {"_id": 1, "completedAt": 1}, session=session)
                        audit["automationSettings"] = db.application_settings.find_one({"_id": "regional_alert_automation"}, {"_id": 0, "enabled": 1, "threshold": 1, "intervalMinutes": 1}, session=session)
            audit.update(mode="apply" if args.apply else "dry-run", observedAt=datetime.now(timezone.utc).isoformat())
            encoded = json.dumps(audit, default=str, indent=2)
            if args.output:
                args.output.write_text(encoded + "\n", encoding="utf-8")
            print(encoded)
            return 1 if audit["failed"] else 0
    except Exception as error:
        # Connection strings and driver exception text may contain credentials.
        print(json.dumps({"mode": "apply" if args.apply else "dry-run", "status": "failed", "errorType": type(error).__name__,
                          "migration": MIGRATION_ID, "committed": committed,
                          "message": "Repair committed, but local audit output failed." if committed else
                          "Command failed. Inspect the dry run or retry; an unsuccessful repair transaction cannot write its completion marker."}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
