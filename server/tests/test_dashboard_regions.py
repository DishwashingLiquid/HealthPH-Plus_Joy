"""Dashboard-only region contracts; no submission writes or application startup.

Optional MongoDB checks run collectionless aggregations on synthetic documents.
Set DASHBOARD_REGION_TEST_URI, or DASHBOARD_REGION_TEST_USE_CONFIG=1 to use the
server's existing connection configuration. Neither mode writes any records.
"""

import importlib
import json
import os
from pathlib import Path
import sys
import types
import unittest
from copy import deepcopy
from datetime import datetime
from unittest.mock import MagicMock, patch

SERVER_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_ROOT))
from controllers.dashboard_regions import (
    EVENT_REGION_PATHS, LOCATION_REGION_PATHS, USER_REGION_PATHS,
    REGIONS, REGION_ALIASES, dashboard_region, dashboard_region_match, mongo_region_expression,
)


def load_health_analytics():
    database = types.ModuleType("config.database")
    for name in ("analytics_events", "content", "user"):
        setattr(database, f"{name}_collection", MagicMock())
    with patch.dict(sys.modules, {"config.database": database}):
        for name in list(sys.modules):
            if name.startswith("controllers.health_literacy_hub."):
                del sys.modules[name]
        return importlib.import_module("controllers.health_literacy_hub.analytics")


def load_sentiment_summary():
    database = types.ModuleType("config.database")
    for name in (
        "analytics_events",
        "application_settings",
        "mobile_users",
        "surveys",
        "survey_responses",
    ):
        setattr(database, f"{name}_collection", types.SimpleNamespace(name=name))
    with patch.dict(sys.modules, {"config.database": database}):
        for name in list(sys.modules):
            if name.startswith("controllers.sentiment_pulse."):
                del sys.modules[name]
        return importlib.import_module("controllers.sentiment_pulse.dashboard_summary")


class DashboardRegionTests(unittest.TestCase):
    def test_aliases_resolve_in_all_three_record_layouts(self):
        for alias, expected in REGION_ALIASES.items():
            value = f"  {alias.lower()}  "
            for record, paths in [
                ({"location": {"regionCode": value}}, LOCATION_REGION_PATHS),
                ({"region": value}, EVENT_REGION_PATHS),
                ({"metadata": {"region": value}}, EVENT_REGION_PATHS),
                ({"regionCode": value}, USER_REGION_PATHS),
            ]:
                with self.subTest(alias=alias, record=record):
                    self.assertEqual(dashboard_region(record, paths), expected)

    def test_missing_invalid_and_conflicting_values_stay_unknown(self):
        for value in (None, "", "all", "ALL", "N/A", "Unknown", "PH-13", "999000000", {}, []):
            self.assertIsNone(dashboard_region({"region": value}))
        self.assertIsNone(dashboard_region({"region": "NCR", "metadata": {"region": "Central Luzon"}}))
        self.assertIsNone(dashboard_region({"location": {"regionCode": "030000000", "regionName": "Metro Manila"}}))

    def test_fallbacks_and_whitespace_without_mutating_source(self):
        record = {"region": "unrecognized", "metadata": {"region": "\tMetro  Manila\n"}}
        original = deepcopy(record)
        self.assertEqual(dashboard_region(record), "NCR")
        self.assertEqual(record, original)
        self.assertEqual(dashboard_region({"user_location": {"regionCode": "IV-A"}}), "IVA")
        self.assertEqual(dashboard_region({"location": {"regionCode": "unknown", "regionName": "Central Luzon"}}), "III")

    def test_dashboard_options_match_existing_codes_without_special_filter_values(self):
        options = json.loads((SERVER_ROOT.parent / "client/src/assets/data/regions.json").read_text())
        self.assertEqual(set(REGIONS), {item["value"] for item in options["regions"]})
        self.assertNotIn("all", REGIONS)

    def test_health_content_never_gets_region_from_title_or_id(self):
        analytics = load_health_analytics()
        for title in ("Prevention", "Edited title"):
            self.assertIsNone(analytics.get_analytics_region("Articles", {"title": title, "id": "one"}))
        self.assertEqual(analytics.get_analytics_region("Articles", {"region": "Metro Manila"}), "NCR")
        self.assertFalse(analytics.content_matches_upload_filters({}, "Articles", 0, "all", "unknown", "all"))

    def test_health_ranking_filters_interactions_instead_of_content_region(self):
        analytics = load_health_analytics()
        with patch.object(analytics, "read_content", return_value=[{"id": "one", "title": "National guide"}]):
            snapshots = analytics.get_content_snapshots("Articles", "NCR")
        self.assertEqual(len(snapshots), 1)
        self.assertIsNone(snapshots[0]["region"])


@unittest.skipUnless(os.getenv("DASHBOARD_REGION_TEST_URI") or os.getenv("DASHBOARD_REGION_TEST_USE_CONFIG"),
                     "No MongoDB read-only test connection requested")
class DashboardRegionMongoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from dotenv import dotenv_values
        from pymongo import MongoClient
        config = dotenv_values(SERVER_ROOT / ".env") if os.getenv("DASHBOARD_REGION_TEST_USE_CONFIG") else {}
        cls.client = MongoClient(os.getenv("DASHBOARD_REGION_TEST_URI") or config.get("MONGO_URI"),
                                 serverSelectionTimeoutMS=10000, connectTimeoutMS=10000)
        cls.addClassCleanup(cls.client.close)
        cls.db = cls.client[config.get("DB_NAME") or "test"]

    def aggregate(self, documents, stages, **kwargs):
        try:
            return list(self.db.aggregate([{"$documents": documents}, *stages], maxTimeMS=20000, **kwargs))
        except Exception as error:
            # Driver errors can contain deployment connection details.
            self.fail(f"Read-only MongoDB aggregation failed: {type(error).__name__}")

    def test_mongo_and_python_resolve_all_aliases_and_edge_cases_identically(self):
        records = [{"region": f"\t{alias.lower().replace(' ', '  ')}\n"} for alias in REGION_ALIASES]
        records += [
            {}, {"region": "all"}, {"region": []}, {"region": {}},
            {"region": "REGION REGION III"},
            {"region": "wrong", "metadata": {"region": "NCR"}},
            {"region": "NCR", "metadata": {"region": "III"}},
            {"location": {"regionCode": "030000000", "regionName": "Central Luzon"}},
            {"location": {"regionCode": "030000000", "regionName": "Metro Manila"}},
            {"userLocation": {"regionCode": "IV-A"}},
        ]
        rows = self.aggregate(records, [{"$project": {"region": mongo_region_expression()}}])
        self.assertEqual([row["region"] for row in rows], [dashboard_region(record) for record in records])

    def test_three_dashboard_filters_select_the_same_region(self):
        for paths, documents in [
            (LOCATION_REGION_PATHS, [
                {"location": {"regionCode": "130000000", "regionName": "Metro Manila"}},
                {"location": {"regionName": "National Capital Region"}},
                {"location": {"regionCode": "NCR", "regionName": "Central Luzon"}}, {}]),
            (EVENT_REGION_PATHS, [{"region": "ncr"}, {"metadata": {"region": "Metro Manila"}},
                                  {"region": "NCR", "metadata": {"region": "III"}}, {}]),
            (USER_REGION_PATHS, [{"regionCode": "NCR"}, {"regionLabel": "Metro Manila"},
                                 {"regionCode": "NCR", "regionLabel": "Central Luzon"}, {}]),
        ]:
            rows = self.aggregate(documents, [{"$match": dashboard_region_match(["NCR"], paths)}, {"$count": "total"}])
            self.assertEqual(rows, [{"total": 2}])

    def test_health_filters_preserve_source_dates_and_unknown_totals(self):
        analytics = load_health_analytics()
        records = [
            {"event_type": "content_opened", "client_platform": "mobile", "region": "Metro Manila"},
            {"event_type": "content_shared", "client_platform": "website", "region": "ncr"},
            {"event_type": "content_opened", "client_platform": "mobile", "region": "all"},
            {"event_type": "search", "client_platform": "mobile", "region": "NCR"},
        ]
        match = analytics.build_content_interaction_match("all", "all", "NCR")
        self.assertEqual(self.aggregate(records, [{"$match": match}, {"$count": "total"}]), [{"total": 2}])
        match = analytics.build_content_interaction_match("all", "all", "all")
        self.assertEqual(self.aggregate(records, [{"$match": match}, {"$count": "total"}]), [{"total": 3}])
        match.update({"$expr": {"$eq": [mongo_region_expression(), None]}})
        self.assertEqual(self.aggregate(records, [{"$match": match}, {"$count": "total"}]), [{"total": 1}])

    def test_survey_response_pipeline_counts_both_sources_and_preserves_unknown_totals(self):
        summary = load_sentiment_summary()
        cutoff = datetime(2026, 9, 14)
        records = [
            {"surveyId": "one", "platform": "mobile", "region": "Metro Manila", "createdAt": cutoff},
            {"surveyId": "one", "platform": "website", "metadata": {"region": "ncr"}, "createdAt": cutoff},
            {"surveyId": "one", "platform": "website", "region": "III", "metadata": {"region": "NCR"}, "createdAt": cutoff},
            {"surveyId": "one", "platform": "mobile", "createdAt": cutoff},
            {"surveyId": "one", "platform": "mobile", "region": "CAR", "createdAt": datetime(2026, 10, 1)},
            {"surveyId": "other", "platform": "mobile", "region": "I", "createdAt": cutoff},
        ]
        totals = self.aggregate(records, summary.response_totals_pipeline(cutoff), let={"surveyId": "one"})
        result = summary.build_dashboard_summary([
            {"id": "one", "publishedAt": datetime(2026, 9, 1), "responseTotals": totals},
        ], cutoff)
        self.assertEqual(result["surveyResponses"], 4)
        self.assertEqual(result["activeRegions"], 1)
        self.assertEqual(result["unknownRegionResponses"], 2)
        self.assertEqual(result["responseCutoff"], "2026-09-14T00:00:00+08:00")


if __name__ == "__main__":
    unittest.main()
