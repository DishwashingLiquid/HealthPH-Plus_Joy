"""Focused, database-free tests for survey-backed Regional Analysis rules."""

import sys
import types
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch


SERVER_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_ROOT))

database = types.ModuleType("config.database")
for name in (
    "application_settings",
    "analytics_events",
    "mobile_users",
    "survey_responses",
    "surveys",
):
    setattr(database, f"{name}_collection", types.SimpleNamespace(name=name))

fastapi = types.ModuleType("fastapi")


class HTTPException(Exception):
    def __init__(self, status_code, detail):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


fastapi.HTTPException = HTTPException
fastapi.status = types.SimpleNamespace(HTTP_400_BAD_REQUEST=400, HTTP_404_NOT_FOUND=404)
pymongo = types.ModuleType("pymongo")
pymongo.ReturnDocument = types.SimpleNamespace(BEFORE="before")

with patch.dict(
    sys.modules,
    {"config.database": database, "fastapi": fastapi, "pymongo": pymongo},
):
    for module_name in list(sys.modules):
        if module_name.startswith("controllers.sentiment_pulse."):
            del sys.modules[module_name]
    from controllers.sentiment_pulse.regional_analysis import (
        get_response_date_range,
        published_survey_platforms,
        regional_response_pipeline,
        summarize_regional_response_rows,
    )


NOW = datetime(2026, 9, 15, 14, 30)


def linked_response(
    identifier,
    account_id,
    created_at,
    response_region="NCR",
    platform="mobile",
    account_region="NCR",
):
    return {
        "id": identifier,
        "createdAt": created_at,
        "platform": platform,
        "responseRegion": response_region,
        "mobileUserId": account_id,
        "accountLinkVerified": True,
        "account": {
            "id": account_id,
            "regionCode": account_region,
            "regionLabel": account_region,
        },
    }


class RegionalAnalysisTests(unittest.TestCase):
    def test_distinct_accounts_across_surveys_and_platforms(self):
        rows = [
            linked_response("one", "mu_same", datetime(2026, 9, 10), platform="mobile"),
            linked_response("two", "mu_same", datetime(2026, 9, 11), platform="website"),
            linked_response("three", "mu_other", datetime(2026, 9, 12), platform="website"),
        ]
        result = summarize_regional_response_rows(rows, [])
        ncr = next(row for row in result["regions"] if row["region"] == "NCR")

        self.assertEqual(result["totals"]["surveyRespondents"], 2)
        self.assertEqual(result["totals"]["totalSubmissions"], 3)
        self.assertEqual(ncr["surveyRespondents"], 2)
        self.assertEqual(ncr["totalSubmissions"], 3)

    def test_unverified_visitor_is_unlinked_and_unknown_account_region_is_separate(self):
        rows = [
            {
                "id": "visitor",
                "createdAt": NOW,
                "responseRegion": "III",
                "visitorId": "mu_looks_real",
            },
            linked_response(
                "verified",
                "mu_unknown",
                NOW,
                response_region="not-a-region",
                account_region="also-unknown",
            ),
        ]
        result = summarize_regional_response_rows(rows, [])

        self.assertEqual(result["totals"]["surveyRespondents"], 1)
        self.assertEqual(result["totals"]["unlinkedSubmissions"], 1)
        self.assertEqual(result["totals"]["unknownRegionRespondents"], 1)
        self.assertEqual(result["totals"]["unknownRegionSubmissions"], 1)

    def test_latest_response_assigns_account_once_before_region_filter(self):
        rows = [
            linked_response("old", "mu_one", datetime(2026, 9, 10), response_region="NCR"),
            linked_response("new", "mu_one", datetime(2026, 9, 11), response_region="III"),
        ]
        ncr_result = summarize_regional_response_rows(rows, ["NCR"])
        iii_result = summarize_regional_response_rows(rows, ["III"])

        self.assertEqual(ncr_result["filteredTotals"]["surveyRespondents"], 0)
        self.assertEqual(iii_result["filteredTotals"]["surveyRespondents"], 1)
        self.assertEqual(iii_result["filteredTotals"]["totalSubmissions"], 1)

    def test_equal_timestamps_use_response_id_as_deterministic_tie_breaker(self):
        rows = [
            linked_response("a", "mu_one", NOW, response_region="NCR"),
            linked_response("b", "mu_one", NOW, response_region="III"),
        ]
        result = summarize_regional_response_rows(rows, [])
        counts = {row["region"]: row["surveyRespondents"] for row in result["regions"]}

        self.assertEqual(counts["NCR"], 0)
        self.assertEqual(counts["III"], 1)

    def test_missing_response_region_uses_linked_account_region(self):
        result = summarize_regional_response_rows(
            [linked_response("one", "mu_one", NOW, response_region="", account_region="IV-A")],
            [],
        )
        iva = next(row for row in result["regions"] if row["region"] == "IVA")
        self.assertEqual((iva["surveyRespondents"], iva["totalSubmissions"]), (1, 1))

    def test_publication_eligibility_excludes_draft_future_missing_and_wrong_platform(self):
        surveys = [
            {"id": "old", "scheduledAt": datetime(2026, 1, 1), "publishToMobile": True, "publishToWebsite": True},
            {"id": "mobile-only", "scheduledAt": datetime(2026, 9, 1), "publishToMobile": True, "publishToWebsite": False},
            {"id": "draft", "scheduledAt": None, "publishToMobile": True, "publishToWebsite": True},
            {"id": "future", "scheduledAt": datetime(2026, 9, 16), "publishToMobile": True, "publishToWebsite": True},
        ]
        eligible = published_survey_platforms(surveys, NOW)

        self.assertEqual(eligible["mobile"], {"old", "mobile-only"})
        self.assertEqual(eligible["website"], {"old"})
        match = regional_response_pipeline(
            eligible,
            get_response_date_range("last-7-days", now=NOW),
        )[0]["$match"]
        self.assertEqual(match["createdAt"]["$gte"], datetime(2026, 9, 9))
        self.assertEqual(match["createdAt"]["$lte"], NOW)
        self.assertNotIn("draft", str(match))
        self.assertNotIn("future", str(match))

    def test_custom_dates_are_inclusive_ph_days_and_future_responses_are_capped(self):
        bounds = get_response_date_range(
            "custom", "2026-09-01", "2026-09-15", now=NOW
        )
        self.assertEqual(bounds.start, datetime(2026, 9, 1))
        self.assertEqual(bounds.end_exclusive, datetime(2026, 9, 16))
        self.assertEqual(bounds.cutoff, NOW)

    def test_every_preset_uses_an_inclusive_philippine_day_window(self):
        for time_range, expected_start in (
            ("last-7-days", datetime(2026, 9, 9)),
            ("last-30-days", datetime(2026, 8, 17)),
            ("last-90-days", datetime(2026, 6, 18)),
        ):
            with self.subTest(time_range=time_range):
                bounds = get_response_date_range(time_range, now=NOW)
                self.assertEqual(bounds.start, expected_start)
                self.assertEqual(bounds.cutoff, NOW)


if __name__ == "__main__":
    unittest.main()
