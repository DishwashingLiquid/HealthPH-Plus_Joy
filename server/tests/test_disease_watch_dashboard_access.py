"""HTTP authorization and adapter contracts using only an in-memory database."""
import os
from pathlib import Path
import sys
import types
import unittest
from datetime import datetime, timedelta

import mongomock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["SECRET_KEY"] = "disease-watch-dashboard-test-secret"
os.environ["ALGORITHM"] = "HS256"

from disease_watch_storage import scoped_collections, REGIONAL_SUMMARY, SUMMARY_EVENT, ALERT_BATCH_STATE, ALERT_COOLDOWN
from regional_summaries import AUTOMATION_SETTINGS_ID

db = mongomock.MongoClient().db
database = types.ModuleType("config.database")
for name in ("user", "role_label", "self_reports", "mobile_users", "analytics_entries", "dataset", "point", "application_settings", "regional_alerts", "mobile_notification_deliveries", "report_id_counters"):
    setattr(database, f"{name}_collection", db[name])
views = scoped_collections(db.disease_watch_internal)
for name, kind in (("regional_symptom_summaries", REGIONAL_SUMMARY), ("regional_summary_events", SUMMARY_EVENT), ("regional_alert_batch_states", ALERT_BATCH_STATE), ("regional_alert_cooldowns", ALERT_COOLDOWN)):
    setattr(database, f"{name}_collection", views[kind])
sys.modules["config.database"] = database

from routes.diseaseWatchFeedRoutes import mobile_self_reports_router

app = FastAPI()
app.include_router(mobile_self_reports_router, prefix="/mobile")
client = TestClient(app)
BASE = "/mobile/disease-watch-feed"
OPERATIONS = (
    ("GET", "/self-reports", None),
    ("GET", "/map-pins", None),
    ("GET", "/user-analytics", None),
    ("GET", "/regional-summaries", None),
    ("GET", "/alerts", None),
    ("GET", "/alert-settings", None),
    ("PUT", "/alert-settings", {"enabled": False, "threshold": 5, "intervalMinutes": 30}),
    ("POST", "/alert-settings/run-evaluation", {}),
    ("PATCH", "/alerts/{alert_id}/cancel", None),
)


class DiseaseWatchDashboardAccessTests(unittest.TestCase):
    def setUp(self):
        for name in db.list_collection_names():
            db[name].delete_many({})
        db.report_id_counters.insert_one({"_id": "self_report_public_id", "value": 0})
        self.user_id = db.user.insert_one({"user_type": "USER", "role_label": "analyst", "accessible_pages": ["Disease Watch Feed"]}).inserted_id
        db.role_label.insert_one({"name": "Analyst", "is_active": True, "accessible_pages": ["Disease Watch Feed"]})
        self.alert_id = db.regional_alerts.insert_one({"status": "Scheduled", "scheduledAt": datetime.now() + timedelta(days=1)}).inserted_id
        token = jwt.encode({"sub": str(self.user_id)}, os.environ["SECRET_KEY"], algorithm="HS256")
        self.headers = {"Authorization": f"Bearer {token}"}

    def request(self, method, path, body=None, headers=None):
        return client.request(method, BASE + path.format(alert_id=self.alert_id), json=body, headers=self.headers if headers is None else headers)

    def assert_operations(self, status, headers=None):
        for method, path, body in OPERATIONS:
            with self.subTest(method=method, path=path):
                self.assertEqual(self.request(method, path, body, headers).status_code, status)

    def test_unauthenticated_and_invalid_sessions_are_401(self):
        self.assert_operations(401, {})
        self.assert_operations(401, {"Authorization": "Bearer invalid"})
        db.user.delete_many({})
        self.assert_operations(401)

    def test_active_role_allows_all_reads_and_management(self):
        # PUT pauses automation; enable explicitly before the evaluation request.
        for method, path, body in OPERATIONS:
            if method == "POST":
                db.application_settings.update_one({"_id": AUTOMATION_SETTINGS_ID}, {"$set": {"enabled": True}}, upsert=True)
            with self.subTest(path=path):
                response = self.request(method, path, body)
                self.assertEqual(response.status_code, 200, response.text)

    def test_superadmin_does_not_require_a_role_or_page_list(self):
        db.user.update_one({"_id": self.user_id}, {"$set": {"user_type": "SUPERADMIN"}, "$unset": {"role_label": "", "accessible_pages": ""}})
        db.role_label.delete_many({})
        self.test_active_role_allows_all_reads_and_management()

    def test_current_role_wins_over_user_or_token_permission_claims(self):
        token = jwt.encode({"sub": str(self.user_id), "accessible_pages": ["Disease Watch Feed"], "user_type": "SUPERADMIN"}, os.environ["SECRET_KEY"], algorithm="HS256")
        self.headers = {"Authorization": f"Bearer {token}"}
        db.role_label.update_one({}, {"$set": {"accessible_pages": ["Health Literacy Hub"]}})
        self.assert_operations(403)

    def test_missing_inactive_and_unresolvable_permissions_are_denied(self):
        for role in (None, {"name": "Analyst", "is_active": False, "accessible_pages": ["Disease Watch Feed"]}, {"name": "Analyst"}, {"name": "Analyst", "accessible_pages": "Disease Watch Feed"}):
            with self.subTest(role=role):
                db.role_label.delete_many({})
                if role:
                    db.role_label.insert_one(role)
                self.assert_operations(403)
        db.user.update_one({}, {"$unset": {"role_label": ""}})
        self.assert_operations(403)

    def test_disabled_and_pending_superadmins_remain_denied(self):
        for field in ("is_disabled", "activation_pending"):
            db.user.update_one({}, {"$set": {"user_type": "SUPERADMIN", field: True}})
            self.assert_operations(403)
            db.user.update_one({}, {"$unset": {field: ""}})

    def test_shared_submission_still_creates_analytics_and_summary_events(self):
        db.role_label.update_one({}, {"$set": {"accessible_pages": []}})
        response = client.post("/mobile/self-reports", json={
            "reporter": {"reporterType": "guest"},
            "location": {"regionCode": "NCR", "regionName": "NCR"},
            "symptomIds": ["cough"], "symptomLabels": ["Cough"],
        })
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(db.self_reports.count_documents({}), 1)
        self.assertEqual(db.analytics_entries.count_documents({"source_type": "self_report"}), 1)
        self.assertEqual(views[SUMMARY_EVENT].count_documents({"region": "NCR"}), 1)
        self.assertIsNotNone(response.json()["analyticsEntryId"])
        # The unchanged shared APIs remain usable under their own policies.
        self.assertEqual(client.get("/mobile/self-reports/map-pins").status_code, 200)
        self.assertEqual(client.get("/mobile/self-reports/export?format=json", headers=self.headers).status_code, 200)
        self.assertEqual(client.get("/mobile/self-reports/mine").status_code, 401)
        self.assertEqual(client.get("/mobile/alerts").status_code, 401)

    def test_dashboard_adapters_reuse_shared_report_contracts(self):
        shared = client.get("/mobile/self-reports/export?format=json", headers=self.headers)
        protected = self.request("GET", "/self-reports")
        self.assertEqual(protected.json()["items"], shared.json()["items"])
        self.assertEqual(self.request("GET", "/map-pins").json(), client.get("/mobile/self-reports/map-pins").json())


if __name__ == "__main__":
    unittest.main()
