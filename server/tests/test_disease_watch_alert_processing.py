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

    def test_cooldown_uses_the_alert_reporting_interval(self):
        self.settings()
        state = {
            "_id": "NCR", "region": "NCR", "batchId": "interval-batch",
            "snapshot": {
                "region": "NCR", "reportCount": 6, "eventIds": [],
                "intervalMinutes": 15, "symptomCounts": [{"symptom": "Fever", "count": 6}],
            },
            "includedSymptomKeys": ["literal:Fever"], "suppressedSymptomKeys": [],
        }

        self.controller._finish_processing("NCR", state, self.at)

        cooldown = self.views[ALERT_COOLDOWN].find_one({"region": "NCR", "symptomKey": "literal:Fever"})
        self.assertEqual(cooldown["expiresAt"], self.at + timedelta(minutes=15))

    def test_saving_a_new_interval_recalculates_an_active_cooldown_from_its_reservation(self):
        self.settings(enabled=False)
        reserved_at = self.at - timedelta(minutes=10)
        self.views[ALERT_COOLDOWN].insert_one({
            "_id": "iva-fever", "region": "IVA", "symptomKey": "literal:Fever",
            "batchId": "original-batch", "reservedAt": reserved_at,
            "expiresAt": reserved_at + timedelta(minutes=1440),
        })

        with patch.object(self.controller, "now", return_value=self.at):
            asyncio.run(self.controller.save_regional_alert_settings(
                self.controller.RegionalAlertSettingsPayload(enabled=False, threshold=5, intervalMinutes=15), {}
            ))

        cooldown = self.views[ALERT_COOLDOWN].find_one({"_id": "iva-fever"})
        self.assertEqual(cooldown["expiresAt"], reserved_at + timedelta(minutes=15))
        self.assertEqual(cooldown["reservedAt"], reserved_at)
        self.assertEqual(cooldown["batchId"], "original-batch")

    def test_recalculated_expiry_in_the_past_does_not_block_the_current_batch(self):
        self.settings()
        self.db.application_settings.update_one(
            {"_id": AUTOMATION_SETTINGS_ID}, {"$set": {"intervalMinutes": 1440}}
        )
        reserved_at = self.at - timedelta(minutes=20)
        self.views[ALERT_COOLDOWN].insert_one({
            "_id": "iva-fever", "region": "IVA", "symptomKey": "literal:Fever",
            "batchId": "original-batch", "reservedAt": reserved_at,
            "expiresAt": reserved_at + timedelta(minutes=1440),
        })
        reports = [source_report(index, self.at - timedelta(minutes=5)) for index in range(6)]
        for report in reports:
            report["location"] = {"regionCode": "IVA"}
        self.db.self_reports.insert_many(reports)

        with patch.object(self.controller, "now", return_value=self.at):
            asyncio.run(self.controller.save_regional_alert_settings(
                self.controller.RegionalAlertSettingsPayload(enabled=True, threshold=5, intervalMinutes=15), {}
            ))

        cooldown = self.views[ALERT_COOLDOWN].find_one({"_id": "iva-fever"})
        self.assertEqual(cooldown["reservedAt"], self.at)
        self.assertEqual(cooldown["expiresAt"], self.at + timedelta(minutes=15))
        self.assertNotEqual(cooldown["batchId"], "original-batch")
        self.assertEqual(self.db.regional_alerts.count_documents({
            "source": "automated_regional_summary", "region": "IVA",
        }), 1)

    def test_run_evaluation_recalculates_active_cooldowns_before_duplicate_evaluation(self):
        self.settings()
        reserved_at = self.at - timedelta(minutes=5)
        self.views[ALERT_COOLDOWN].insert_one({
            "_id": "ncr-fever", "region": "NCR", "symptomKey": "literal:Fever",
            "batchId": "original-batch", "reservedAt": reserved_at,
            "expiresAt": reserved_at + timedelta(minutes=1440),
        })
        self.db.self_reports.insert_many([
            source_report(index, self.at - timedelta(minutes=5)) for index in range(6)
        ])

        with patch.object(self.controller, "now", return_value=self.at):
            asyncio.run(self.controller.run_regional_alert_evaluation(
                self.controller.RunRegionalAlertEvaluationPayload(intervalMinutes=15), {}
            ))

        cooldown = self.views[ALERT_COOLDOWN].find_one({"_id": "ncr-fever"})
        self.assertEqual(cooldown["expiresAt"], reserved_at + timedelta(minutes=15))
        self.assertEqual(cooldown["reservedAt"], reserved_at)
        self.assertEqual(cooldown["batchId"], "original-batch")
        self.assertEqual(self.db.regional_alerts.count_documents({"source": "automated_regional_summary"}), 0)
        self.assertEqual(self.views[SUMMARY_EVENT].count_documents({"consumedBatchId": {"$exists": True}}), 0)

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

    def test_summary_preview_is_removed_after_recipient_preparation(self):
        alert = {
            "_id": "alert-1", "source": "automated_regional_summary", "status": "Preparing",
            "trigger": {"reportCount": 6, "intervalMinutes": 1440, "summarySnapshot": {
                "reportCount": 6, "symptomCounts": [{"symptom": "Fever", "count": 6}],
                "windowStart": self.at - timedelta(hours=24), "windowEnd": self.at,
            }},
        }
        preview = self.controller.serialize_alert(alert)["summaryPreview"]
        self.assertEqual(preview["reportCount"], 6)
        self.assertEqual(preview["symptomCounts"], [{"symptom": "Fever", "count": 6}])

        alert["status"] = "Published"
        self.assertIsNone(self.controller.serialize_alert(alert)["summaryPreview"])

    def test_run_evaluation_accepts_each_supported_interval_and_persists_next_reconciliation(self):
        self.settings()
        for minutes in (15, 30, 60, 480, 720, 1440):
            with self.subTest(minutes=minutes), patch.object(self.controller, "now", return_value=self.at):
                response = asyncio.run(self.controller.run_regional_alert_evaluation(
                    self.controller.RunRegionalAlertEvaluationPayload(intervalMinutes=minutes), {}
                ))
            body = json.loads(response.body)
            saved = self.db.application_settings.find_one({"_id": AUTOMATION_SETTINGS_ID})
            self.assertEqual(body["item"]["intervalMinutes"], minutes)
            self.assertTrue(saved["enabled"])
            self.assertEqual(saved["threshold"], 5)
            self.assertEqual(saved["intervalMinutes"], minutes)
            self.assertEqual(saved["lastSuccessfulEvaluation"], self.at)
            self.assertEqual(saved["nextScheduledReconciliation"], self.at + timedelta(minutes=minutes))

    def test_run_evaluation_immediately_uses_selected_rolling_window_and_prepares_recipients(self):
        self.settings()
        self.db.self_reports.insert_many([
            source_report("outside-window", self.at - timedelta(minutes=16)),
            *[source_report(index, self.at - timedelta(minutes=5)) for index in range(6)],
        ])
        self.db.mobile_users.insert_one({
            "id": "recipient-1", "source": "mobile_registration", "roleId": "user", "regionCode": "NCR",
        })

        with patch.object(self.controller, "now", return_value=self.at):
            response = asyncio.run(self.controller.run_regional_alert_evaluation(
                self.controller.RunRegionalAlertEvaluationPayload(intervalMinutes=15), {}
            ))

        body = json.loads(response.body)
        alert = self.db.regional_alerts.find_one({"source": "automated_regional_summary"})
        self.assertEqual(body["item"]["intervalMinutes"], 15)
        self.assertEqual(alert["trigger"]["reportCount"], 6)
        self.assertEqual(alert["trigger"]["intervalMinutes"], 15)
        self.assertEqual(alert["trigger"]["windowStart"], self.at - timedelta(minutes=15))
        self.assertEqual(alert["status"], "Published")
        self.assertEqual(self.db.mobile_notification_deliveries.count_documents({"alertId": alert["_id"]}), 1)
        self.assertIsNone(self.views[SUMMARY_EVENT].find_one({"reportId": "report-outside-window"}))

    def test_run_evaluation_rejects_paused_automation_without_changing_settings_or_alerts(self):
        self.settings(enabled=False)
        before = self.db.application_settings.find_one({"_id": AUTOMATION_SETTINGS_ID})

        with self.assertRaises(self.controller.HTTPException) as raised:
            asyncio.run(self.controller.run_regional_alert_evaluation(
                self.controller.RunRegionalAlertEvaluationPayload(intervalMinutes=15), {}
            ))

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(self.db.application_settings.find_one({"_id": AUTOMATION_SETTINGS_ID}), before)
        self.assertEqual(self.db.regional_alerts.count_documents({}), 0)

    def test_run_evaluation_does_not_duplicate_a_consumed_alert_batch(self):
        self.settings()
        self.db.self_reports.insert_many([source_report(index, self.at) for index in range(6)])

        with patch.object(self.controller, "now", return_value=self.at):
            payload = self.controller.RunRegionalAlertEvaluationPayload(intervalMinutes=30)
            asyncio.run(self.controller.run_regional_alert_evaluation(payload, {}))
            asyncio.run(self.controller.run_regional_alert_evaluation(payload, {}))

        self.assertEqual(self.db.regional_alerts.count_documents({"source": "automated_regional_summary"}), 1)
        self.assertEqual(self.views[SUMMARY_EVENT].count_documents({"consumedBatchId": {"$exists": True}}), 6)


if __name__ == "__main__":
    unittest.main()
