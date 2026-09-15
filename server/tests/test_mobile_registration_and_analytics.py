"""Mock-only coverage for the mobile registration and Disease Watch Feed contract.

This module replaces config.database before controller imports, so it never
opens a MongoDB connection or touches deployment data.
"""

import asyncio
import json
import os
import sys
import types
import unittest
from datetime import datetime
from pathlib import Path

from bson import ObjectId
from fastapi import HTTPException


SERVER_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_ROOT))
os.environ.setdefault("SECRET_KEY", "mobile-contract-test-secret")
os.environ.setdefault("ALGORITHM", "HS256")


def _value_at(document, dotted_key):
    value = document
    for part in dotted_key.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(part)
    return value


def _matches(document, query):
    for key, expected in query.items():
        actual = _value_at(document, key)
        if isinstance(expected, dict):
            for operator, boundary in expected.items():
                if operator == "$in" and actual not in boundary:
                    return False
                if operator == "$gte" and (actual is None or actual < boundary):
                    return False
                if operator == "$lte" and (actual is None or actual > boundary):
                    return False
                if operator == "$lt" and (actual is None or actual >= boundary):
                    return False
        elif actual != expected:
            return False
    return True


class FakeCursor(list):
    def sort(self, fields):
        key, direction = fields[0]
        return FakeCursor(
            sorted(self, key=lambda item: _value_at(item, key) or datetime.min, reverse=direction < 0)
        )


class FakeCollection:
    def __init__(self):
        self.documents = []
        self.queries = []
        self.force_duplicate = False

    def find_one(self, query, *args, **kwargs):
        self.queries.append(query)
        return next((item for item in self.documents if _matches(item, query)), None)

    def find(self, query, *args, **kwargs):
        self.queries.append(query)
        return FakeCursor([item for item in self.documents if _matches(item, query)])

    def count_documents(self, query):
        self.queries.append(query)
        return sum(_matches(item, query) for item in self.documents)

    def insert_one(self, document):
        if self.force_duplicate:
            from pymongo.errors import DuplicateKeyError

            raise DuplicateKeyError("duplicate")
        document.setdefault("_id", ObjectId())
        self.documents.append(document)
        return types.SimpleNamespace(inserted_id=document["_id"])


fake_database = types.ModuleType("config.database")
fake_database.mobile_users_collection = FakeCollection()
fake_database.self_reports_collection = FakeCollection()
fake_database.analytics_entries_collection = FakeCollection()
fake_database.dataset_collection = FakeCollection()
fake_database.point_collection = FakeCollection()
fake_database.user_collection = FakeCollection()
sys.modules["config.database"] = fake_database

from controllers import diseaseWatchFeedController as disease  # noqa: E402
from controllers import mobileUserController as mobile  # noqa: E402
from middleware.requireMobileAuth import decode_mobile_token  # noqa: E402
from models.mobileUser import MobileLoginRequest, MobileRegistrationRequest  # noqa: E402


def registration_payload(**overrides):
    payload = {
        "fullName": "Mobile User",
        "email": "Mobile.User@Example.COM",
        "password": "AsecurePassword1",
        "roleId": "user",
        "roleLabel": "User",
        "regionCode": "NCR",
        "regionLabel": "National Capital Region",
        "province": "Metro Manila",
        "city": "Quezon City",
        "barangay": "Central",
        "source": "mobile_registration",
    }
    payload.update(overrides)
    return payload


def self_report_payload(reporter=None):
    return disease.SelfReportPayload(
        reporter=reporter
        or {"reporterType": "guest", "fullName": "Guest", "email": "guest@example.com"},
        location={"regionCode": "NCR", "regionName": "NCR"},
        symptomIds=["cough"],
    )


class MobileRegistrationAndAnalyticsTests(unittest.TestCase):
    def setUp(self):
        for collection in (
            fake_database.mobile_users_collection,
            fake_database.self_reports_collection,
            fake_database.analytics_entries_collection,
            fake_database.user_collection,
        ):
            collection.documents.clear()
            collection.queries.clear()
            collection.force_duplicate = False
        disease.build_self_report_analytics_entry = lambda report: None

    def test_registration_serializes_safely_and_normalizes_email(self):
        response = asyncio.run(
            mobile.register_mobile_user(MobileRegistrationRequest(**registration_payload()))
        )
        body = json.loads(response.body)
        stored = fake_database.mobile_users_collection.documents[0]

        self.assertEqual(response.status_code, 201)
        self.assertEqual(stored["email"], "mobile.user@example.com")
        self.assertTrue(stored["id"].startswith("mu_"))
        self.assertIn("passwordHash", stored)
        self.assertNotIn("passwordHash", body["user"])
        self.assertNotIn("password", body["user"])
        self.assertEqual(body["user"]["source"], "mobile_registration")

    def test_normalized_duplicate_email_and_duplicate_key_return_409(self):
        asyncio.run(mobile.register_mobile_user(MobileRegistrationRequest(**registration_payload())))
        with self.assertRaises(HTTPException) as duplicate:
            asyncio.run(
                mobile.register_mobile_user(
                    MobileRegistrationRequest(**registration_payload(email="mobile.user@example.com"))
                )
            )
        self.assertEqual(duplicate.exception.status_code, 409)

        fake_database.mobile_users_collection.documents.clear()
        fake_database.mobile_users_collection.force_duplicate = True
        with self.assertRaises(HTTPException) as race:
            asyncio.run(mobile.register_mobile_user(MobileRegistrationRequest(**registration_payload())))
        self.assertEqual(race.exception.status_code, 409)

    def test_login_uses_only_registration_and_returns_safe_mobile_token(self):
        asyncio.run(mobile.register_mobile_user(MobileRegistrationRequest(**registration_payload())))
        response = asyncio.run(
            mobile.login_mobile_user(
                MobileLoginRequest(email="MOBILE.USER@example.com", password="AsecurePassword1")
            )
        )
        body = json.loads(response.body)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("passwordHash", body["user"])
        self.assertEqual(decode_mobile_token(body["access_token"])["sub"], body["user"]["id"])

        with self.assertRaises(HTTPException) as invalid:
            asyncio.run(
                mobile.login_mobile_user(
                    MobileLoginRequest(email="mobile.user@example.com", password="WrongPassword1")
                )
            )
        self.assertEqual(invalid.exception.status_code, 401)
        self.assertEqual(invalid.exception.detail, "Invalid email or password")

    def test_mobile_token_cannot_authorize_admin_analytics(self):
        token = mobile.create_mobile_access_token("mu_not_a_desktop_id")
        with self.assertRaises(HTTPException) as unauthorized:
            asyncio.run(disease.require_desktop_admin(token))
        self.assertEqual(unauthorized.exception.status_code, 401)

    def test_dashboard_export_region_does_not_replace_mobile_location_fields(self):
        document = {
            "_id": ObjectId(), "createdAt": datetime(2026, 9, 14),
            "location": {"regionCode": "130000000", "regionName": "Metro Manila"},
            "reporter": {"mobileUserId": "mu_one"},
        }
        exported = disease._serialize_self_report_export_item(document, reports=[document])
        self.assertEqual(exported["region"], "NCR")
        self.assertEqual(document["location"]["regionCode"], "130000000")
        mobile_item = disease._serialize_self_report(document)
        self.assertEqual(mobile_item["location"]["regionCode"], "130000000")
        self.assertNotIn("region", mobile_item)
        document["location"]["regionName"] = "Central Luzon"
        self.assertIsNone(disease._serialize_self_report_export_item(document, reports=[document])["region"])

    def test_analytics_counts_registrations_not_viewers_or_reports(self):
        current_start = datetime(2026, 2, 1)
        current_end = datetime(2026, 3, 1)
        fake_database.mobile_users_collection.documents.extend(
            [
                {"id": "mu_previous", "source": "mobile_registration", "roleId": "user", "regionCode": "NCR", "createdAt": datetime(2026, 1, 10)},
                {"id": "mu_non_reporter", "source": "mobile_registration", "roleId": "user", "regionCode": "NCR", "createdAt": datetime(2026, 2, 4)},
                {"sourceTag": "viewer", "roleId": "user", "createdAt": datetime(2026, 2, 4)},
                {"id": "guest", "source": "mobile_registration", "roleId": "guest", "createdAt": datetime(2026, 2, 4)},
                {"id": "wrong", "source": "other", "roleId": "user", "createdAt": datetime(2026, 2, 4)},
            ]
        )
        fake_database.self_reports_collection.documents.extend(
            [
                {"source": "mobile_self_report", "createdAt": datetime(2026, 1, 10), "location": {"regionCode": "NCR"}},
                {"source": "mobile_self_report", "createdAt": current_start, "location": {"regionCode": "NCR"}},
                {"source": "mobile_self_report", "createdAt": datetime(2026, 2, 4), "location": {"regionCode": "NCR"}},
                {"source": "other", "createdAt": datetime(2026, 2, 4), "location": {"regionCode": "NCR"}},
            ]
        )

        response = asyncio.run(
            disease.fetch_mobile_user_analytics_summary(
                {}, date_from=current_start.isoformat(), date_to=current_end.isoformat()
            )
        )
        body = json.loads(response.body)
        self.assertEqual(body["totalUsers"]["current"], 2)
        self.assertEqual(body["totalUsers"]["previous"], 1)
        self.assertEqual(body["symptomReports"]["current"], 2)
        self.assertEqual(body["symptomReports"]["previous"], 1)
        self.assertFalse(body["alertOpenRate"]["isAvailable"])
        self.assertEqual(body["alertOpenRate"]["fallbackReason"], "No alert-open event source available.")

    def test_registered_reports_use_token_identity_and_guests_still_work(self):
        canonical_user = {
            "id": "mu_canonical",
            "fullName": "Canonical Name",
            "email": "canonical@example.com",
            "source": "mobile_registration",
            "roleId": "user",
        }
        fake_database.mobile_users_collection.documents.append(canonical_user)
        registered = self_report_payload(
            {
                "reporterType": "registered",
                "mobileUserId": "client-controlled",
                "fullName": "Client Controlled",
                "email": "client@example.com",
                "roleId": "guest",
            }
        )
        response = asyncio.run(
            disease.create_mobile_self_report(registered, {"sub": "mu_canonical"})
        )
        reporter = json.loads(response.body)["item"]["reporter"]
        self.assertEqual(json.loads(response.body)["mobileUser"]["id"], "mu_canonical")
        self.assertEqual(reporter["mobileUserId"], "mu_canonical")
        self.assertEqual(reporter["fullName"], "Canonical Name")
        self.assertEqual(reporter["roleId"], "user")

        guest_response = asyncio.run(disease.create_mobile_self_report(self_report_payload(), None))
        guest = json.loads(guest_response.body)["item"]["reporter"]
        self.assertIsNone(json.loads(guest_response.body)["mobileUser"])
        self.assertEqual(guest["reporterType"], "guest")
        self.assertIsNone(guest["mobileUserId"])
        self.assertEqual(len(fake_database.mobile_users_collection.documents), 1)

        mine_response = asyncio.run(
            disease.fetch_mobile_self_reports_mine({"sub": "mu_canonical"})
        )
        mine = json.loads(mine_response.body)["items"]
        self.assertEqual(len(mine), 1)
        self.assertEqual(mine[0]["reporter"]["mobileUserId"], "mu_canonical")

    def test_self_report_keeps_literal_submitted_symptoms_for_admin_summary(self):
        payload = disease.SelfReportPayload(
            reporter={"reporterType": "guest", "fullName": "Guest"},
            location={"regionCode": "NCR", "regionName": "NCR"},
            symptomLabels=["Cough", "Cough", "Fever"],
        )
        asyncio.run(disease.create_mobile_self_report(payload, None))
        stored = fake_database.self_reports_collection.documents[0]

        # The dashboard's separate summary pipeline must count exactly what the
        # reporter submitted, rather than the legacy canonical symptom fields.
        self.assertEqual(
            stored["submittedSymptoms"],
            ["Cough", "Cough", "Fever"],
        )

    def test_self_report_preserves_naive_ph_time_and_normalizes_offset_time(self):
        naive = disease._coerce_self_report_datetime("2026-09-11T16:00:00")
        utc = disease._coerce_self_report_datetime("2026-09-11T08:00:00Z")
        self.assertEqual(naive, datetime(2026, 9, 11, 16, 0))
        self.assertEqual(utc, datetime(2026, 9, 11, 16, 0))

    def test_ingestion_and_summary_share_region_resolution(self):
        from regional_summaries import event_for_report
        for code, name, expected in [("030000000", "Central Luzon", "III"),
                                     ("130000000", "NCR", "NCR"),
                                     ("unknown", "Central Luzon", "III"),
                                     ("030000000", "NCR", None)]:
            payload = disease.SelfReportPayload(reporter={"reporterType": "guest"}, location={"regionCode": code, "regionName": name}, symptomLabels=["Cough"])
            stored = disease._build_self_report_document(payload)
            stored["_id"] = ObjectId()
            event, issue = event_for_report(stored)
            self.assertEqual(event["region"] if event else None, expected)
            self.assertEqual(disease._get_report_region(stored), expected or "Unknown")


if __name__ == "__main__":
    unittest.main()
