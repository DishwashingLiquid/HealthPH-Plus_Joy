"""Isolated analytics regression tests. Never load config.database or a live DB.

Run separately: python -m unittest discover -s server/tests -p test_health_literacy_analytics.py -v
"""
from datetime import datetime, timedelta, timezone
import importlib
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

import mongomock
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
PH = timezone(timedelta(hours=8))
NOW = datetime(2026, 11, 10, 13, 24, 15)


class AnalyticsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = mongomock.MongoClient().isolated_analytics
        database = types.ModuleType("config.database")
        database.db = cls.db
        for name in ("content", "user", "analytics_events"):
            setattr(database, f"{name}_collection", cls.db[name])
        cls.modules = patch.dict(sys.modules, {"config.database": database})
        cls.modules.start()
        cls.addClassCleanup(cls.modules.stop)
        for name in list(sys.modules):
            if name.startswith("controllers.health_literacy_hub."):
                del sys.modules[name]
        with patch("pymongo.MongoClient", side_effect=AssertionError("Live DB forbidden")):
            cls.analytics = importlib.import_module("controllers.health_literacy_hub.analytics")
            cls.model = importlib.import_module("models.healthLiteracyHubAnalytics").HealthLiteracyAnalyticsEvent

    def setUp(self):
        for name in self.db.list_collection_names():
            self.db[name].delete_many({})
        clock = patch.object(self.analytics, "get_ph_datetime", return_value=NOW)
        clock.start()
        self.addCleanup(clock.stop)

    def test_naive_ph_utc_and_other_offsets_normalize_to_same_wall_time(self):
        expected = datetime(2026, 10, 12)
        for value in ("2026-10-12T00:00:00", "2026-10-12T00:00:00+08:00",
                      "2026-10-11T16:00:00+00:00", "2026-10-11T16:00:00Z",
                      "2026-10-11T12:00:00-04:00"):
            with self.subTest(value=value):
                self.assertEqual(self.analytics.parse_content_datetime(value), expected)
        for value in (None, "", "invalid-date"):
            self.assertIsNone(self.analytics.parse_content_datetime(value))

    def test_inclusive_upload_cutoffs_and_exclusive_previous_period_end(self):
        for time_range, days in (("last-7-days", 7), ("last-30-days", 30), ("last-90-days", 90)):
            start = NOW.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)
            with self.subTest(time_range=time_range):
                self.assertEqual(self.analytics.get_range_start_date(time_range), start)
                for offset, expected in ((-1, False), (0, True), (1, True)):
                    date = start + timedelta(microseconds=offset)
                    for value in (date.isoformat(), date.replace(tzinfo=PH).isoformat(),
                                  date.replace(tzinfo=PH).astimezone(timezone.utc).isoformat()):
                        item = {"createdAt": value}
                        self.assertEqual(self.analytics.content_matches_upload_filters(
                            item, "Articles", 0, "all", "all", time_range), expected, value)
                        self.assertEqual(item["createdAt"], value)  # No stored timestamp edits.
                previous = self.analytics.build_content_interaction_match(time_range, "all", "all", True)
                self.assertEqual(previous["created_at"], {"$gte": start - timedelta(days=days), "$lt": start})
                self.db.analytics_events.insert_many([
                    {"event_type": "content_opened", "client_platform": "website", "created_at": date}
                    for date in (start - timedelta(days=days, microseconds=1), start - timedelta(days=days),
                                 start - timedelta(microseconds=1), start)
                ])
                self.assertEqual(self.db.analytics_events.count_documents(previous), 2)
                self.db.analytics_events.delete_many({})
        self.assertIsNone(self.analytics.get_range_start_date("all-time"))
        self.assertEqual(self.analytics.build_content_interaction_match("all-time", "all", "all", True), {})
        self.assertNotIn("created_at", self.analytics.build_content_interaction_match("all-time", "all", "all"))

    def test_overview_all_ranges_with_mixed_upload_dates_and_unmarked_admin_events(self):
        midnight = NOW.replace(hour=0, minute=0, second=0, microsecond=0)
        items = []
        for days_ago in (0, 6, 7, 29, 30, 89, 90):
            date = midnight - timedelta(days=days_ago)
            for suffix, value in (("naive", date.isoformat()), ("ph", date.replace(tzinfo=PH).isoformat()),
                                  ("utc", date.replace(tzinfo=PH).astimezone(timezone.utc).isoformat())):
                items.append({"id": f"{days_ago}-{suffix}", "title": f"Guide {days_ago}", "createdAt": value})
            self.db.analytics_events.insert_one({"event_type": "content_opened", "content_id": f"{days_ago}-ph",
                "client_platform": "website", "visitor_id": f"visitor-{days_ago}", "created_at": date, "region": None})
        # Preserve the legacy behavior: missing/invalid upload dates remain included.
        items.extend([{"id": "missing"}, {"id": "invalid", "createdAt": "bad-date"}])
        self.db.user.insert_many([{"user_type": "USER"} for _ in range(10)])
        legacy = [{"event_type": "content_opened", "content_id": "0-ph", "visitor_id": f"admin-{i}",
                   "created_at": NOW, "region": None} for i in range(12)]
        self.db.analytics_events.insert_many(legacy)
        # mongomock lacks the production region alias expression. These fixtures
        # only have a single canonical region field; use it for the unknown count.
        with patch.object(self.analytics, "read_content", side_effect=lambda key: items if key == "article" else []), \
             patch.object(self.analytics, "mongo_region_expression", return_value="$region"):
            for time_range, pieces, interactions in (("last-7-days", 8, 2), ("last-30-days", 14, 4),
                                                     ("last-90-days", 20, 6), ("all-time", 23, 7)):
                with self.subTest(time_range=time_range):
                    overview = self.analytics.build_health_literacy_analytics_overview(time_range, "all", "all")
                    self.assertEqual(overview["contentPieces"], pieces)
                    self.assertEqual(overview["totalContentInteractions"], interactions)
                    self.assertEqual(overview["interactedUsers"], interactions)
                    self.assertEqual(overview["unknownRegionInteractions"], interactions)
                    self.assertEqual(overview["engagementRate"], interactions * 10)
                    self.assertEqual(overview["topPerformingContent"][0]["interactedUsers"], 1)
        self.assertEqual(self.db.analytics_events.count_documents({"client_platform": {"$exists": False}}), 12)

    def test_public_endpoint_payload_and_admin_exclusion_use_only_mock_writes(self):
        app = FastAPI()
        analytics = self.analytics
        model = self.model
        from fastapi import Request

        @app.post("/analytics/events", status_code=201)
        def record(data: model, request: Request):
            self.db.analytics_events.insert_one(analytics.build_analytics_event_document(data, request))
            return {"ok": True}

        client = TestClient(app)
        for event_type in ("content_opened", "content_shared", "content_downloaded"):
            response = client.post("/analytics/events", json={"eventType": event_type,
                "contentId": "static-article-1", "contentType": "articles", "clientPlatform": "website", "visitorId": "stable-id"})
            self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(self.db.analytics_events.count_documents({"content_type": "article", "client_platform": "website",
            "visitor_id": "stable-id", "region": "all"}), 3)
        missing_marker = client.post("/analytics/events", json={"eventType": "content_opened", "visitorId": "stable-id"})
        self.assertEqual(missing_marker.status_code, 400)
        with patch.object(analytics, "get_optional_bearer_user_id", return_value="admin"):
            self.assertEqual(client.post("/analytics/events", json={"eventType": "content_opened", "contentId": "static-article-1"}).status_code, 201)
        match = analytics.build_content_interaction_match("all-time", "all", "all")
        self.assertEqual(self.db.analytics_events.count_documents(match), 3)
        self.assertEqual(self.db.analytics_events.count_documents({}), 4)


if __name__ == "__main__":
    unittest.main()
