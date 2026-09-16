"""Contract tests for the authenticated automated-alert mobile inbox."""
import asyncio
from datetime import datetime
import importlib.util
import json
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

import mongomock
from bson import ObjectId
from fastapi import HTTPException


SERVER_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_ROOT))
os.environ.setdefault("SECRET_KEY", "mobile-alert-inbox-test-secret")
os.environ.setdefault("ALGORITHM", "HS256")


def load_controller(db):
    database = types.ModuleType("config.database")
    database.regional_alerts_collection = db.regional_alerts
    database.mobile_notification_deliveries_collection = db.mobile_notification_deliveries
    database.mobile_users_collection = db.mobile_users
    spec = importlib.util.spec_from_file_location(
        "mobile_alert_controller_test",
        SERVER_ROOT / "controllers" / "mobileAlertsController.py",
    )
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, {"config.database": database}):
        spec.loader.exec_module(module)
    return module


class MobileAlertInboxTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.controller = load_controller(self.db)
        self.db.mobile_users.insert_one({
            "id": "mu_reader", "source": "mobile_registration", "roleId": "user",
        })
        self.db.mobile_users.insert_one({
            "id": "mu_other", "source": "mobile_registration", "roleId": "user",
        })

        self.new_alert_id = self._insert_prepared_alert(datetime(2026, 9, 16, 9, 30))
        self.old_alert_id = self._insert_prepared_alert(datetime(2026, 9, 16, 8, 30))
        self.db.mobile_notification_deliveries.insert_many([
            {"alertId": self.new_alert_id, "mobileUserId": "mu_reader", "status": "Prepared", "publishedAt": datetime(2026, 9, 16, 9, 31)},
            {"alertId": self.old_alert_id, "mobileUserId": "mu_reader", "status": "Prepared", "publishedAt": datetime(2026, 9, 16, 8, 31)},
            {"alertId": self.new_alert_id, "mobileUserId": "mu_other", "status": "Prepared", "publishedAt": datetime(2026, 9, 16, 9, 31)},
            {"alertId": ObjectId(), "mobileUserId": "mu_reader", "status": "Queued"},
        ])

    def _insert_prepared_alert(self, created_at):
        return self.db.regional_alerts.insert_one({
            "source": "automated_regional_summary",
            "status": "Prepared",
            "region": "NCR",
            "title": "Regional self-report alert: NCR",
            "message": "Six reports were recorded.",
            "createdAt": created_at,
            "trigger": {
                "reportCount": 6,
                "threshold": 5,
                "comparison": ">",
                "intervalMinutes": 30,
                "windowStart": datetime(2026, 9, 16, 9, 0),
                "windowEnd": datetime(2026, 9, 16, 9, 30),
                "includedSymptomKeys": ["literal:Fever"],
                "summarySnapshot": {
                    "symptomKeyLabels": {"literal:Fever": "Fever"},
                    "symptomKeyCounts": {"literal:Fever": 6},
                },
            },
        }).inserted_id

    def _body(self, response):
        return json.loads(response.body)

    def test_list_is_paginated_and_exposes_only_completed_assignments(self):
        response = asyncio.run(self.controller.fetch_mobile_alerts({"sub": "mu_reader"}, limit=1))
        body = self._body(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["unreadCount"], 2)
        self.assertEqual(len(body["items"]), 1)
        self.assertEqual(body["items"][0]["id"], str(self.new_alert_id))
        self.assertEqual(body["items"][0]["source"], "automated")
        self.assertEqual(body["items"][0]["comparison"], "gt")
        self.assertEqual(body["items"][0]["regionName"], "National Capital Region")
        self.assertEqual(body["items"][0]["symptoms"], [{"symptomKey": "literal:Fever", "label": "Fever", "reportCount": 6}])
        self.assertTrue(body["items"][0]["publishedAt"].endswith("Z"))
        self.assertIsNotNone(body["nextCursor"])

        second = self._body(asyncio.run(self.controller.fetch_mobile_alerts(
            {"sub": "mu_reader"}, cursor=body["nextCursor"], limit=1,
        )))
        self.assertEqual([item["id"] for item in second["items"]], [str(self.old_alert_id)])
        self.assertIsNone(second["nextCursor"])

    def test_detail_is_recipient_scoped_and_read_is_idempotent(self):
        with self.assertRaises(HTTPException) as missing:
            asyncio.run(self.controller.fetch_mobile_alert(str(self.new_alert_id), {"sub": "mu_other_missing"}))
        self.assertEqual(missing.exception.status_code, 401)

        with self.assertRaises(HTTPException) as unassigned:
            asyncio.run(self.controller.fetch_mobile_alert(str(self.old_alert_id), {"sub": "mu_other"}))
        self.assertEqual(unassigned.exception.status_code, 404)

        first = self._body(asyncio.run(self.controller.mark_mobile_alert_read(
            str(self.new_alert_id), {"sub": "mu_reader"},
        )))
        second = self._body(asyncio.run(self.controller.mark_mobile_alert_read(
            str(self.new_alert_id), {"sub": "mu_reader"},
        )))
        self.assertEqual(first["unreadCount"], 1)
        self.assertEqual(second["unreadCount"], 1)
        self.assertIsNotNone(first["item"]["readAt"])
        self.assertEqual(second["item"]["readAt"], first["item"]["readAt"])

    def test_invalid_cursor_is_rejected(self):
        with self.assertRaises(HTTPException) as invalid:
            asyncio.run(self.controller.fetch_mobile_alerts({"sub": "mu_reader"}, cursor="not-a-cursor", limit=20))
        self.assertEqual(invalid.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
