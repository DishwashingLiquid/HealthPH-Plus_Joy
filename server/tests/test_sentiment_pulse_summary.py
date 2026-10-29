"""Run with unittest; optional real aggregation tests use SENTIMENT_PULSE_TEST_MONGO_URI.

The optional URI must point to a disposable test server. No application config
or deployment database is imported; each integration test owns a temporary DB.
"""

import os
import sys
import types
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Match the existing isolated survey tests, without requiring application startup
# or the full ML/backend dependency set for calculation tests.
database = types.ModuleType("config.database")
for name in ("application_settings", "analytics_events", "mobile_users", "survey_responses", "surveys"):
    setattr(database, f"{name}_collection", types.SimpleNamespace(name=name))
fastapi = types.ModuleType("fastapi")
fastapi.HTTPException = Exception
fastapi.status = types.SimpleNamespace(HTTP_400_BAD_REQUEST=400)
pymongo_stub = types.ModuleType("pymongo")
pymongo_stub.ReturnDocument = types.SimpleNamespace(BEFORE="before")
with patch.dict(sys.modules, {"config.database": database, "fastapi": fastapi, "pymongo": pymongo_stub}):
    # Other isolated tests also stub these modules; use our own collection
    # handles and restore all prior modules when leaving this context.
    for module_name in list(sys.modules):
        if module_name.startswith("controllers.sentiment_pulse."):
            del sys.modules[module_name]
    from controllers.sentiment_pulse.dashboard_summary import (
        build_dashboard_summary, reporting_months, summary_pipeline,
    )


NOW = datetime(2026, 9, 14, 12)
LATEST = datetime(2026, 9, 13, 10)


def survey(identifier, published, total=0, regions=(), latest=LATEST, **extra):
    return {
        "id": identifier, "publishedAt": published,
        "responseTotals": [{"total": total, "regions": list(regions), "latestResponseAt": latest}]
        if total else [],
        **extra,
    }


class SummaryCalculationTests(unittest.TestCase):
    def test_latest_five_include_zero_response_surveys_and_deduplicate_regions(self):
        rows = [survey(str(day), datetime(2026, 9, day), 2, ["NCR", "I"]) for day in range(1, 7)]
        rows[0] = survey("1", datetime(2026, 9, 1), 1, ["BARMM"])
        rows[-1] = survey("6", datetime(2026, 9, 6))
        rows.extend([survey("draft", None, 1, ["CAR"]),
                     survey("future", datetime(2026, 10, 1), 1, ["CAR"])])
        result = build_dashboard_summary(reversed(rows), NOW)
        self.assertEqual(result["activeRegions"], 2)
        self.assertEqual(result["publishedSurveyCount"], 5)
        self.assertEqual(result["surveyResponses"], 9)

    def test_fewer_surveys_and_invalid_regions(self):
        result = build_dashboard_summary([
            survey("one", datetime(2026, 9, 1), 5, ["NCR", None, "", "unknown", "ncr"]),
        ], NOW)
        self.assertEqual(result["activeRegions"], 1)
        self.assertEqual(result["publishedSurveyCount"], 1)

    def test_region_aliases_are_deduplicated_and_unknowns_do_not_inflate_coverage(self):
        rows = [survey("one", datetime(2026, 9, 1), 5, ["NCR", "Metro Manila", "ncr", None])]
        rows[0]["responseTotals"][0]["unknownRegionResponses"] = 2
        result = build_dashboard_summary(rows, NOW)
        self.assertEqual(result["activeRegions"], 1)
        self.assertEqual(result["unknownRegionResponses"], 2)
        self.assertEqual(result["surveyResponses"], 5)

    def test_publication_month_includes_late_responses_and_ignores_creation_date(self):
        result = build_dashboard_summary([
            survey("august", datetime(2026, 8, 31), 4, latest=LATEST, createdAt=datetime(2026, 7, 1)),
            survey("september", datetime(2026, 9, 1), 6, createdAt=datetime(2026, 8, 1)),
            survey("july", datetime(2026, 7, 31), 50),
        ], NOW)
        self.assertEqual(result["surveyResponses"], 6)
        self.assertEqual(result["previousMonthResponses"], 4)
        self.assertEqual(result["responseChangePercent"], 50)
        self.assertEqual(result["responseCutoff"], "2026-09-13T10:00:00+08:00")

    def test_philippine_month_and_year_boundaries(self):
        previous, current, following = reporting_months(datetime(2026, 12, 31, 16, tzinfo=timezone.utc))
        self.assertEqual((previous, current, following),
                         (datetime(2026, 12, 1), datetime(2027, 1, 1), datetime(2027, 2, 1)))
        self.assertEqual(reporting_months(datetime(2026, 12, 31, 15, 59, tzinfo=timezone.utc))[1], datetime(2026, 12, 1))
        result = build_dashboard_summary([
            survey("dec", "2026-12-31T15:59:59Z", 2),
            survey("jan", "2026-12-31T16:00:00Z", 3),
        ], datetime(2027, 1, 1))
        self.assertEqual((result["surveyResponses"], result["previousMonthResponses"]), (3, 2))

    def test_zero_previous_total_and_empty_data(self):
        empty = build_dashboard_summary([], NOW)
        self.assertEqual((empty["activeRegions"], empty["surveyResponses"], empty["previousMonthResponses"]), (0, 0, 0))
        self.assertIsNone(empty["responseCutoff"])
        self.assertIsNone(empty["responseChangePercent"])
        result = build_dashboard_summary([survey("new", datetime(2026, 9, 1), 10)], NOW)
        self.assertIsNone(result["responseChangePercent"])
        result = build_dashboard_summary([survey("old", datetime(2026, 8, 1), 10)], NOW)
        self.assertEqual(result["responseChangePercent"], -100)

    def test_edit_does_not_advance_last_update(self):
        rows = [survey("one", datetime(2026, 9, 1), 2)]
        before = build_dashboard_summary(rows, NOW)
        rows[0]["updatedAt"] = NOW
        rows[0]["title"] = "Edited survey"
        self.assertEqual(build_dashboard_summary(rows, NOW), before)

    def test_publication_changes_regions_without_a_new_response(self):
        rows = [survey(str(day), datetime(2026, 9, day), 1, ["NCR" if day == 1 else "I"])
                for day in range(1, 6)]
        before = build_dashboard_summary(rows, NOW)
        rows.append(survey("new", datetime(2026, 9, 14)))
        after = build_dashboard_summary(rows, NOW)
        self.assertEqual((before["activeRegions"], after["activeRegions"]), (2, 1))
        self.assertEqual(before["responseCutoff"], after["responseCutoff"])

    def test_month_rollover_and_deletion_without_a_new_response(self):
        rows = [survey("one", datetime(2026, 9, 1), 2, ["NCR"])]
        before = build_dashboard_summary(rows, NOW)
        after = build_dashboard_summary(rows, datetime(2026, 10, 1))
        self.assertEqual((after["surveyResponses"], after["previousMonthResponses"]), (0, 2))
        self.assertEqual(before["responseCutoff"], after["responseCutoff"])
        self.assertEqual(after["nextReportingPeriod"], "2026-11-01T00:00:00+08:00")
        self.assertEqual(build_dashboard_summary([], NOW)["activeRegions"], 0)


@unittest.skipUnless(os.getenv("SENTIMENT_PULSE_TEST_MONGO_URI"), "No disposable MongoDB test URI configured")
class SummaryMongoTests(unittest.TestCase):
    def setUp(self):
        from pymongo import MongoClient
        self.client = MongoClient(os.environ["SENTIMENT_PULSE_TEST_MONGO_URI"], serverSelectionTimeoutMS=5000)
        self.db = self.client[f"sentiment_summary_test_{uuid4().hex}"]
        self.addCleanup(self.client.close)
        self.addCleanup(self.client.drop_database, self.db.name)

    def summary(self, now=NOW):
        return build_dashboard_summary(self.db.surveys.aggregate(summary_pipeline(now)), now)

    def test_combined_sources_cutoff_late_responses_and_region_fallback(self):
        self.db.surveys.insert_many([
            {"id": "aug", "scheduledAt": datetime(2026, 8, 31), "createdAt": datetime(2026, 7, 1)},
            {"id": "sep", "scheduledAt": datetime(2026, 9, 1)},
            {"id": "draft", "scheduledAt": None},
            {"id": "future", "scheduledAt": datetime(2026, 10, 1)},
        ])
        records = [
            {"surveyId": "aug", "platform": "mobile", "createdAt": LATEST, "region": "NCR"},
            {"surveyId": "aug", "platform": "website", "createdAt": LATEST, "region": "", "metadata": {"region": "I"}},
            {"surveyId": "sep", "platform": "website", "createdAt": LATEST, "region": "NCR"},
            {"surveyId": "sep", "platform": "mobile", "createdAt": LATEST, "region": "invalid", "metadata": {"region": "CAR"}},
            {"surveyId": "sep", "platform": "mobile", "createdAt": datetime(2026, 10, 1), "region": "CAR"},
        ]
        for identifier in ("draft", "future", "deleted"):
            records.append({"surveyId": identifier, "platform": "mobile", "createdAt": NOW, "region": "BARMM"})
        self.db.survey_responses.insert_many(records)
        result = self.summary()
        self.assertEqual((result["surveyResponses"], result["previousMonthResponses"]), (2, 2))
        self.assertEqual(result["activeRegions"], 3)
        self.assertEqual(result["responseCutoff"], "2026-09-13T10:00:00+08:00")
        self.db.surveys.update_one({"id": "sep"}, {"$set": {"updatedAt": NOW}})
        self.assertEqual(self.summary(), result)

    def test_latest_five_keep_empty_surveys_and_string_publication_dates(self):
        self.db.surveys.insert_many([
            {"id": str(day), "scheduledAt": datetime(2026, 9, day)} for day in range(1, 6)
        ] + [{"id": "new", "scheduledAt": "2026-09-13T16:00:00Z"}])
        self.db.survey_responses.insert_many([
            {"surveyId": "1", "platform": "website", "createdAt": LATEST, "region": "CAR"},
            {"surveyId": "2", "platform": "mobile", "createdAt": LATEST, "region": "NCR"},
        ])
        result = self.summary()
        self.assertEqual(result["activeRegions"], 1)
        self.assertEqual(result["publishedSurveyCount"], 5)
        self.assertEqual(result["surveyResponses"], 2)
        following = self.summary(datetime(2026, 10, 1))
        self.assertEqual((following["surveyResponses"], following["previousMonthResponses"]), (0, 2))
        self.assertEqual(following["responseCutoff"], result["responseCutoff"])


if __name__ == "__main__":
    unittest.main()
