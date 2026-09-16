"""Alert state-machine checks using the consolidated in-memory store."""
import asyncio
from datetime import datetime, timedelta
import importlib.util
import json
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

import mongomock

SERVER_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_ROOT))
os.environ.setdefault("SECRET_KEY", "disease-watch-test-secret")
os.environ.setdefault("ALGORITHM", "HS256")

from disease_watch_storage import (
    ALERT_BATCH_STATE,
    ALERT_COOLDOWN,
    REGIONAL_SUMMARY,
    SUMMARY_EVENT,
    scoped_collections,
)
from regional_summaries import AUTOMATION_SETTINGS_ID


def load_controller(db):
    database = types.ModuleType("config.database")
    views = scoped_collections(db.disease_watch_internal)
    database.db = db
    database.disease_watch_internal_collection = db.disease_watch_internal
    database.regional_symptom_summaries_collection = views[REGIONAL_SUMMARY]
    database.regional_summary_events_collection = views[SUMMARY_EVENT]
    database.regional_alert_batch_states_collection = views[ALERT_BATCH_STATE]
    database.regional_alert_cooldowns_collection = views[ALERT_COOLDOWN]
    database.regional_alerts_collection = db.regional_alerts
    database.mobile_notification_deliveries_collection = db.mobile_notification_deliveries
    database.mobile_users_collection = db.mobile_users
    database.user_collection = db.users
    database.self_reports_collection = db.self_reports
    database.application_settings_collection = db.application_settings
    spec = importlib.util.spec_from_file_location(
        "disease_watch_alert_controller_test",
        SERVER_ROOT / "controllers" / "regionalAlertsController.py",
    )
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, {"config.database": database}):
        spec.loader.exec_module(module)
    return module, views


def source_report(number, at):
    return {
        "_id": f"report-{number}",
        "source": "mobile_self_report",
        "status": "submitted",
        "location": {"regionCode": "NCR"},
        "submittedSymptoms": ["Fever"],
        "createdAt": at,
    }


class ConsolidatedAlertProcessingTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.controller, self.views = load_controller(self.db)
        self.controller.ensure_regional_alert_indexes()
        self.at = datetime.now().replace(microsecond=0)

    def settings(self, enabled=True):
        self.db.application_settings.insert_one({
            "_id": AUTOMATION_SETTINGS_ID,
            "enabled": enabled,
            "threshold": 5,
            "intervalMinutes": 30,
        })

    def test_duplicate_processing_and_consumed_event_replay_are_prevented(self):
        self.settings()
        reports = [source_report(index, self.at) for index in range(6)]
        self.db.self_reports.insert_many(reports)
        for report in reports:
            result = self.controller.update_regional_summary_for_report(report)
            self.assertEqual(result["status"], "updated")

        self.assertEqual(self.db.regional_alerts.count_documents({}), 1)
        self.assertEqual(self.views[SUMMARY_EVENT].count_documents({"consumedBatchId": {"$exists": True}}), 6)
        self.assertEqual(self.views[REGIONAL_SUMMARY].find_one({"region": "NCR"})["reportCount"], 0)
        cooldown = self.views[ALERT_COOLDOWN].find_one({"region": "NCR", "symptomKey": "literal:Fever"})
        self.assertGreater(cooldown["expiresAt"], cooldown["reservedAt"])

        retry = self.controller.update_regional_summary_for_report(reports[-1])
        self.assertEqual(retry["status"], "updated")
        self.assertEqual(self.db.regional_alerts.count_documents({}), 1)
        self.assertEqual(self.views[REGIONAL_SUMMARY].find_one({"region": "NCR"})["reportCount"], 0)

    def test_concurrent_claim_loses_cleanly_and_cooldown_expiry_is_respected(self):
        self.settings()
        self.views[ALERT_BATCH_STATE].insert_one({"_id": "NCR", "region": "NCR", "status": "Processing", "batchId": "other"})
        summary = {
            "region": "NCR", "reportCount": 6, "eventIds": [],
            "symptomKeyCounts": {"literal:Fever": 6},
            "symptomKeyLabels": {"literal:Fever": "Fever"},
            "symptomCounts": [{"symptom": "Fever", "count": 6}],
        }
        self.assertEqual(
            self.controller._claim_and_finish("NCR", summary, {"intervalMinutes": 30}, self.at),
            "claimed_elsewhere",
        )
        self.views[ALERT_COOLDOWN].insert_one({
            "_id": "cooldown", "region": "NCR", "symptomKey": "literal:Fever",
            "expiresAt": self.at + timedelta(minutes=1),
        })
        self.assertEqual(self.controller._cooldown_status("NCR", ["literal:Fever"], self.at)[0], [])
        self.assertEqual(self.controller._cooldown_status("NCR", ["literal:Fever"], self.at + timedelta(minutes=2))[0], ["literal:Fever"])

    def test_restart_recovers_processing_state_and_retry_renews_reservation(self):
        self.settings(enabled=False)
        event_id = "event-1"
        self.views[SUMMARY_EVENT].insert_one({
            "_id": event_id, "region": "NCR", "reportId": "report-1",
            "occurredAt": self.at, "symptoms": ["Fever"],
            "symptomEntries": [{"key": "literal:Fever", "label": "Fever"}],
        })
        snapshot = {
            "region": "NCR", "reportCount": 6, "eventIds": [event_id],
            "symptomKeyCounts": {"literal:Fever": 6},
            "symptomKeyLabels": {"literal:Fever": "Fever"},
            "symptomCounts": [{"symptom": "Fever", "count": 6}],
            "intervalMinutes": 30,
        }
        state = {
            "_id": "NCR", "region": "NCR", "status": "Processing", "batchId": "batch-1",
            "snapshot": snapshot, "includedSymptomKeys": ["literal:Fever"],
            "suppressedSymptomKeys": [],
        }
        self.views[ALERT_BATCH_STATE].insert_one(state)
        self.controller.run_automation_tick()
        recovered = self.views[ALERT_BATCH_STATE].find_one({"_id": "NCR"})
        self.assertEqual(recovered["status"], "Active")
        self.assertEqual(self.views[SUMMARY_EVENT].find_one({"_id": event_id})["consumedBatchId"], "batch-1")
        self.assertEqual(self.db.regional_alerts.count_documents({"batchId": "batch-1"}), 1)
        first_expiry = self.views[ALERT_COOLDOWN].find_one({"region": "NCR"})["expiresAt"]

        self.controller._finish_processing("NCR", state, self.at + timedelta(hours=1))
        renewed = self.views[ALERT_COOLDOWN].find_one({"region": "NCR"})
        self.assertGreater(renewed["expiresAt"], first_expiry)
        self.assertEqual(self.db.regional_alerts.count_documents({"batchId": "batch-1"}), 1)

    def test_admin_summary_payload_does_not_expose_storage_kind(self):
        self.views[REGIONAL_SUMMARY].insert_one({
            "_id": "summary", "region": "NCR", "reportCount": 6,
            "isReady": True, "symptomCounts": [{"symptom": "Fever", "count": 6}],
            "updatedAt": self.at,
        })
        self.views[ALERT_BATCH_STATE].insert_one({"_id": "NCR", "region": "NCR", "status": "Active"})
        response = asyncio.run(self.controller.fetch_regional_summaries({}))
        body = json.loads(response.body)
        self.assertEqual(body["items"][0]["region"], "NCR")
        self.assertNotIn("kind", json.dumps(body))


if __name__ == "__main__":
    unittest.main()
