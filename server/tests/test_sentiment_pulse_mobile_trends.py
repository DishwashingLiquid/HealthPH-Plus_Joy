"""Mobile Trends contracts with in-memory storage; no app startup or live database."""

import copy
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_sentiment_pulse_annotations import db, entry, VERSION
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt

from controllers.sentiment_pulse import annotation_controller as admin
from controllers.sentiment_pulse import mobile_trends as mobile
from controllers.sentiment_pulse.regional_analysis import get_response_date_range
from middleware.requireAuth import require_auth
from models.mobileUser import MOBILE_REGISTRATION_SOURCE, MOBILE_ROLE_ID
from routes.mobileSentimentPulseRoutes import router


class MobileTrendsTests(unittest.TestCase):
    def setUp(self):
        for collection in (db.surveys, db.analytics_entries, db.mobile_users, db.survey_responses, db.user):
            collection.drop()
        self.env = patch.dict(os.environ, {"SECRET_KEY": "mobile-trends-tests-only", "ALGORITHM": "HS256"})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.config = patch.object(mobile, "configuration", return_value={})
        self.config.start()
        self.addCleanup(self.config.stop)
        # Stable request cutoff also makes future-publication and PH boundaries deterministic.
        self.now = datetime(2026, 10, 29, 12)
        self.bounds = patch.object(mobile, "get_response_date_range",
            side_effect=lambda time_range, start, end: get_response_date_range(time_range, start, end, now=self.now))
        self.bounds.start()
        self.addCleanup(self.bounds.stop)
        self.app = FastAPI()
        self.app.include_router(router, prefix="/api/mobile/sentiment-pulse")
        self.app.add_api_route("/api/sentiment-pulse/trends", admin.fetch_trends)
        self.client = TestClient(self.app)
        self.path = "/api/mobile/sentiment-pulse/trends"
        self.params = {"timeRange": "custom", "startDate": "2026-10-28", "endDate": "2026-10-28"}
        for uid in ("mu_one", "mu_two"):
            db.mobile_users.insert_one({"id": uid, "source": MOBILE_REGISTRATION_SOURCE, "roleId": MOBILE_ROLE_ID})
        self.survey = {"id": "survey", "title": "Service feedback", "publishToMobile": True, "scheduledAt": datetime(2026, 10, 1),
            "endedAt": datetime(2026, 10, 28), "questions": [{"id": "explain", "type": "text"},
                {"id": "rating", "type": "rating", "rateMin": 1, "rateMax": 5}]}
        db.surveys.insert_one(copy.deepcopy(self.survey))

    def headers(self, sub="mu_one", **claims):
        payload = {"sub": sub, "aud": "mobile", "typ": "mobile_access",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5), **claims}
        return {"Authorization": "Bearer " + jwt.encode(payload, "mobile-trends-tests-only", algorithm="HS256")}

    def get(self, **params):
        return self.client.get(self.path, params={**self.params, **params}, headers=self.headers())

    def classified(self, identifier, label="calm", **overrides):
        row = entry(identifier, **overrides)
        row["analysis"].update(sentiment=label, sentiment_score=0 if label == "calm" else .9, sentiment_model_version=VERSION)
        return row

    def test_real_mobile_auth_rejects_missing_invalid_expired_wrong_audience_and_type(self):
        for headers in ({}, {"Authorization": "Bearer broken"}, self.headers(aud="admin"),
                        self.headers(typ="access"), self.headers(exp=datetime(2000, 1, 1, tzinfo=timezone.utc)),
                        self.headers(sub="deleted")):
            self.assertEqual(self.client.get(self.path, headers=headers).status_code, 401)
        db.mobile_users.update_one({"id": "mu_one"}, {"$set": {"roleId": "Admin"}})
        self.assertEqual(self.get().status_code, 401)

    def test_mobile_token_does_not_grant_admin_reporting_access(self):
        self.assertEqual(self.client.get("/api/sentiment-pulse/trends", headers=self.headers()).status_code, 401)

    def test_visibility_includes_ended_mobile_but_excludes_private_draft_and_future(self):
        for sid, fields in (("web", {"publishToMobile": False, "publishToWebsite": True}),
                            ("draft", {"scheduledAt": None}), ("future", {"scheduledAt": datetime(2026, 10, 30)}),
                            ("invalid-date", {"scheduledAt": "bad"})):
            db.surveys.insert_one({**copy.deepcopy(self.survey), "id": sid, **fields})
            db.analytics_entries.insert_one(self.classified(sid, survey_id=sid))
            self.assertEqual(self.get(surveyId=sid).status_code, 404)
        db.analytics_entries.insert_one(self.classified("visible"))
        db.surveys.insert_one({"publishToMobile": True, "scheduledAt": datetime(2026, 10, 1)})
        self.assertEqual(self.get().json()["sentiment"]["predictedAnswers"], 1)
        self.assertEqual(self.get(surveyId="survey").status_code, 200)
        self.assertEqual(self.get(surveyId="missing").status_code, 404)

    def test_web_mobile_parity_all_participants_filters_ph_dates_and_read_only(self):
        rows = [self.classified("one", user_id="mu_one"), self.classified("two", "worried", user_id="mu_two"),
            entry("unprocessed", user_id="mu_two"),
            self.classified("other-region", location={"region": "CAR"}),
            entry("previous", event_time="2026-10-27T15:59:59Z"),
            entry("next", event_time="2026-10-28T16:00:00Z"),
            entry("invalid", event_time="bad"),
            self.classified("website", source_platform="website")]
        rows += [entry(f"rating-{i}", question_id="rating", question_type="rating", raw_answer=i, text=str(i)) for i in range(1, 6)]
        db.analytics_entries.insert_many(rows)
        before = list(db.analytics_entries.find())
        admin_id = ObjectId()
        db.user.insert_one({"_id": admin_id, "user_type": "Admin"})
        self.app.dependency_overrides[require_auth] = lambda: str(admin_id)
        for regions in ("NCR", "CAR", ""):
            params = {**self.params, "regions": regions, "surveyId": "survey"}
            with patch.object(admin, "configuration", return_value={}), patch.object(admin, "run_processing") as inference:
                web = self.client.get("/api/sentiment-pulse/trends", params=params).json()
                result = self.get(regions=regions, surveyId="survey").json()
                inference.assert_not_called()
            totals = web["totals"]
            for key in ("eligibleAnswers", "predictedAnswers", "answersWithoutResults"):
                self.assertEqual(result["sentiment"][key], totals[key])
            self.assertEqual(result["satisfaction"]["satisfactionShare"], totals["satisfactionShare"])
            self.assertEqual(result["satisfactionTrend"], [{"date": row["date"], **{key: row[key] for key in
                ("satisfactionAnswers", "satisfiedAnswers", "satisfactionShare")}} for row in web["daily"]])
            self.assertEqual(result["sentimentDistribution"][1]["share"], totals["worriedShare"])
            for key in ("timeRange", "startDate", "endDate", "regions", "surveyId", "unknownRegionIncluded"):
                self.assertEqual(result["filters"][key], web["filters"][key])
        result = self.get(regions="NCR").json()
        self.assertEqual(result["sentiment"]["eligibleAnswers"], 3)
        self.assertEqual(result["sentiment"]["dominantCategory"], "tie")
        self.assertEqual(result["sentiment"]["dominantShare"], 50)
        self.assertAlmostEqual(result["sentiment"]["analysisCoverage"], 2 / 3 * 100)
        self.assertEqual([row["share"] for row in result["satisfactionDistribution"]], [40, 20, 40])
        other_user = self.client.get(self.path, params={**self.params, "regions": "NCR"}, headers=self.headers("mu_two")).json()
        self.assertEqual(result, other_user)
        self.assertEqual(list(db.analytics_entries.find()), before)

    def test_mobile_response_allowlist_excludes_web_details_and_identifiers(self):
        db.analytics_entries.insert_one(self.classified("secret-entry", user_id="secret-user", response_id="secret-response"))
        result = self.get().json()
        self.assertEqual(set(result), {"sources", "filters", "sentiment", "satisfaction", "sentimentDistribution",
                                       "satisfactionDistribution", "satisfactionTrend", "asOf", "sentimentTrends", "regional"})
        self.assertEqual(set(result["satisfactionTrend"][0]), {"date", "satisfactionAnswers", "satisfiedAnswers", "satisfactionShare"})
        serialized = str(result)
        for forbidden in ("secret-entry", "secret-user", "secret-response", "raw_answer", "modelVersions", "surveyBreakdown", "worriedShare"):
            self.assertNotIn(forbidden, serialized)
        self.assertEqual(result["filters"]["participants"], "all")

    def test_per_survey_changes_distinguish_overview_baseline_from_same_survey_change(self):
        db.surveys.insert_one({**copy.deepcopy(self.survey), "id": "second", "title": "Second survey"})
        rows = []
        for sid, current, previous in (("survey", ["calm"] + ["worried"] * 3, ["calm"] * 3 + ["worried"]),
                                       ("second", ["calm"] * 3, ["worried"] * 2)):
            for period, labels in (("current", current), ("previous", previous)):
                for index, label in enumerate(labels):
                    rows.append(self.classified(f"{sid}-{period}-{index}", label, survey_id=sid,
                        event_time="2026-10-27T16:00:00Z" if period == "current" else "2026-10-26T16:00:00Z"))
        db.analytics_entries.insert_many(rows)
        result = self.get().json()
        trends = result["sentimentTrends"]
        self.assertEqual(trends["comparison"], "previous-equal-calendar-period")
        self.assertEqual(trends["changeUnit"], "percentage-points")
        self.assertEqual((trends["baseline"]["startDate"], trends["baseline"]["endDate"]),
                         ("2026-10-27", "2026-10-27"))
        self.assertEqual(trends["baseline"]["sentimentDistribution"][0]["share"], 50)
        self.assertAlmostEqual(result["sentimentDistribution"][0]["share"], 4 / 7 * 100)
        self.assertAlmostEqual(trends["overviewChange"]["calm"], 4 / 7 * 100 - 50)
        by_id = {row["surveyId"]: row for row in trends["surveys"]}
        self.assertEqual(by_id["survey"]["title"], "Service feedback")
        self.assertEqual(by_id["survey"]["changeFromOverviewBaseline"], {"calm": -25, "worried": 25})
        self.assertEqual(by_id["survey"]["changeFromPreviousPeriod"], {"calm": -50, "worried": 50})
        self.assertEqual(by_id["second"]["changeFromOverviewBaseline"], {"calm": 50, "worried": -50})
        self.assertEqual(by_id["second"]["changeFromPreviousPeriod"], {"calm": 100, "worried": -100})
        filtered = self.get(surveyId="survey").json()["sentimentTrends"]
        self.assertEqual([row["surveyId"] for row in filtered["surveys"]], ["survey"])
        self.assertEqual(filtered["baseline"]["sentimentDistribution"][0]["share"], 75)

    def test_baseline_windows_use_ph_calendar_days_and_never_overlap(self):
        for time_range, start, end, prior_start, prior_end in (
            ("last-7-days", "2026-10-23", "2026-10-29", "2026-10-16", "2026-10-22"),
            ("last-30-days", "2026-09-30", "2026-10-29", "2026-08-31", "2026-09-29"),
            ("custom", "2026-10-26", "2026-10-28", "2026-10-23", "2026-10-25")):
            result = self.get(timeRange=time_range, startDate=start, endDate=end).json()
            self.assertEqual(result["filters"]["startDate"], start)
            self.assertEqual(result["filters"]["endDate"], end)
            baseline = result["sentimentTrends"]["baseline"]
            self.assertEqual((baseline["startDate"], baseline["endDate"]), (prior_start, prior_end))
        db.analytics_entries.insert_many([
            self.classified("previous-edge", "worried", event_time="2026-10-27T15:59:59Z"),
            self.classified("current-edge", event_time="2026-10-27T16:00:00Z"),
            self.classified("next-edge", event_time="2026-10-28T16:00:00Z")])
        result = self.get().json()
        self.assertEqual(result["sentimentTrends"]["baseline"]["sentiment"]["predictedAnswers"], 1)
        self.assertEqual(result["sentiment"]["predictedAnswers"], 1)
        self.assertEqual(result["sentimentTrends"]["overviewChange"], {"calm": 100, "worried": -100})
        self.assertEqual(result["asOf"], "2026-10-29T12:00:00+08:00")

    def test_missing_baseline_and_current_results_preserve_null_changes(self):
        db.analytics_entries.insert_one(entry("pending"))
        result = self.get().json()
        row = result["sentimentTrends"]["surveys"][0]
        self.assertEqual(row["sentiment"]["analysisCoverage"], 0)
        self.assertEqual(row["changeFromPreviousPeriod"], {"calm": None, "worried": None})
        db.analytics_entries.insert_one(self.classified("current"))
        row = self.get().json()["sentimentTrends"]["surveys"][0]
        self.assertEqual(row["changeFromOverviewBaseline"], {"calm": None, "worried": None})
        self.assertEqual(row["sentiment"]["analysisCoverage"], 50)
        db.analytics_entries.insert_one(self.classified("late-analysis", event_time="2026-10-26T16:00:00Z"))
        row = self.get().json()["sentimentTrends"]["surveys"][0]
        self.assertEqual(row["changeFromPreviousPeriod"], {"calm": 0, "worried": 0})

    def test_comparisons_apply_region_and_request_cutoff_to_both_periods(self):
        db.analytics_entries.insert_many([
            self.classified("prior-ncr", "worried"),
            self.classified("prior-car", location={"region": "CAR"}),
            self.classified("current-ncr", event_time="2026-10-29T03:00:00Z"),
            self.classified("current-car", "worried", location={"region": "CAR"}, event_time="2026-10-29T03:00:00Z"),
            self.classified("after-request", "worried", event_time="2026-10-29T05:00:00Z")])
        for end_date in ("2026-10-29", "2026-10-30"):
            result = self.get(startDate="2026-10-29", endDate=end_date, regions="NCR").json()
            self.assertEqual(result["filters"]["endDate"], end_date)
            self.assertEqual(result["sentiment"]["predictedAnswers"], 1)
            self.assertEqual(result["sentimentTrends"]["baseline"]["sentiment"]["predictedAnswers"], 1)
            self.assertEqual(result["sentimentTrends"]["overviewChange"], {"calm": 100, "worried": -100})

    def test_survey_catalog_excludes_hidden_titles_and_includes_ended_and_empty_surveys(self):
        for sid, fields in (("hidden", {"publishToMobile": False}),
                            ("future", {"scheduledAt": datetime(2026, 10, 30)}),
                            ("draft", {"scheduledAt": None})):
            db.surveys.insert_one({**copy.deepcopy(self.survey), "id": sid, "title": f"private-{sid}", **fields})
            db.analytics_entries.insert_one(self.classified(sid, survey_id=sid, event_time="2026-10-26T16:00:00Z"))
        result = self.get().json()
        self.assertEqual([row["surveyId"] for row in result["sentimentTrends"]["surveys"]], ["survey"])
        self.assertNotIn("private-", str(result))
        self.assertEqual(result["sentimentTrends"]["baseline"]["sentiment"]["predictedAnswers"], 0)

    def test_regional_defaults_to_profile_and_matches_dashboard_all_survey_population(self):
        db.mobile_users.update_one({"id": "mu_one"}, {"$set": {"regionCode": "130000000", "regionLabel": "Metro Manila"}})
        db.surveys.insert_one({**copy.deepcopy(self.survey), "id": "private", "title": "private-title", "publishToMobile": False})
        db.analytics_entries.insert_many([
            self.classified("visible", submission_id="a"),
            self.classified("hidden", "worried", survey_id="private", submission_id="b"),
            self.classified("other-region", location={"region": "CAR"}, submission_id="c"),
            entry("unprocessed", submission_id="a"),
            entry("linked-rating", submission_id="a", question_id="rating", question_type="rating", raw_answer=5),
            entry("unrepresented-rating", submission_id="not-analyzed", question_id="rating", question_type="rating", raw_answer=1)])
        self.app.add_api_route("/api/sentiment-pulse/regional-analytics", admin.fetch_regional_analytics)
        admin_id = ObjectId()
        db.user.insert_one({"_id": admin_id, "user_type": "Admin"})
        self.app.dependency_overrides[require_auth] = lambda: str(admin_id)
        before = {name: list(db[name].find()) for name in ("analytics_entries", "survey_responses", "mobile_users", "surveys")}
        with patch.object(admin, "configuration", return_value={}), patch.object(admin, "run_processing") as inference:
            web = self.client.get("/api/sentiment-pulse/regional-analytics", params={**self.params, "regions": "NCR"}).json()
            result = self.get(regions="CAR", surveyId="survey").json()
            inference.assert_not_called()
        regional = result["regional"]
        self.assertEqual(regional["regionCode"], "NCR")
        self.assertEqual(regional["regionSource"], "profile")
        self.assertEqual(regional["filters"]["regions"], ["NCR"])
        self.assertIsNone(regional["filters"]["surveyId"])
        self.assertEqual(regional["filters"]["surveyVisibility"], "all-existing-surveys")
        for key in ("predictedAnswers", "eligibleAnswers", "answersWithoutResults"):
            self.assertEqual(regional["sentiment"][key], web["totals"][key])
        self.assertEqual(regional["sentimentDistribution"][1]["share"], web["totals"]["worriedShare"])
        self.assertEqual(regional["analyzedSubmissions"], web["totals"]["analyzedSubmissions"])
        self.assertEqual(regional["satisfaction"]["satisfactionShare"], 100)
        self.assertNotIn("private-title", str(result))
        self.assertNotIn("private", str(regional))
        self.assertEqual({name: list(db[name].find()) for name in before}, before)

    def test_regional_selected_region_is_independent_and_missing_profile_never_falls_back_to_national(self):
        db.analytics_entries.insert_many([self.classified("ncr", submission_id="a"),
            self.classified("car", "worried", submission_id="b", location={"region": "CAR"})])
        self.assertEqual(self.get().json()["regional"]["status"], "region_required")
        self.assertNotIn("sentiment", self.get().json()["regional"])
        selected = self.get(regions="NCR", regionalRegion="Cordillera Administrative Region").json()
        self.assertEqual(selected["sentiment"]["dominantCategory"], "calm")
        self.assertEqual(selected["regional"]["sentiment"]["dominantCategory"], "worried")
        self.assertEqual(selected["regional"]["regionSource"], "selection")
        empty = self.get(regionalRegion="III").json()["regional"]
        self.assertEqual(empty["status"], "available")
        self.assertEqual(empty["analyzedSubmissions"], 0)
        self.assertIsNone(empty["sentimentDistribution"][0]["share"])
        db.mobile_users.update_one({"id": "mu_one"}, {"$set": {"regionCode": "NCR", "regionLabel": "CAR"}})
        self.assertEqual(self.get().json()["regional"]["status"], "region_required")
        for value in ("unknown", "NCR,CAR", "", " , "):
            self.assertEqual(self.get(regionalRegion=value).status_code, 400)

    def test_regional_preserves_unknown_submission_counts_and_submission_region_rules(self):
        db.analytics_entries.insert_many([
            self.classified("missing-link"),
            self.classified("conflict-one", submission_id="conflict"),
            self.classified("conflict-two", "worried", submission_id="conflict", location={"region": "CAR"})])
        regional = self.get(regionalRegion="NCR").json()["regional"]
        self.assertEqual(regional["sentiment"]["predictedAnswers"], 1)
        self.assertEqual(regional["submissionCountStatus"], "incomplete")
        self.assertIsNone(regional["analyzedSubmissions"])
        self.assertEqual(regional["linkedAnalyzedSubmissions"], 0)
        self.assertNotIn("linkage", regional)  # Dashboard linkage diagnostics cover other regions too.

    def test_null_zero_unprocessed_missing_days_and_weighted_totals(self):
        result = self.get().json()
        self.assertIsNone(result["sentiment"]["analysisCoverage"])
        self.assertIsNone(result["sentiment"]["dominantCategory"])
        self.assertIsNone(result["satisfaction"]["satisfactionShare"])
        db.analytics_entries.insert_one(entry("pending"))
        result = self.get().json()
        self.assertEqual(result["sentiment"]["analysisCoverage"], 0)
        self.assertIsNone(result["sentimentDistribution"][0]["share"])
        db.analytics_entries.insert_one(self.classified("calm"))
        db.analytics_entries.insert_many([entry(f"old-rating-{i}", question_id="rating", question_type="rating", raw_answer=5,
            event_time="2026-10-25T16:00:00Z") for i in range(3)])
        db.analytics_entries.insert_one(entry("new-rating", question_id="rating", question_type="rating", raw_answer=1))
        result = self.get(startDate="2026-10-26").json()
        self.assertEqual(result["sentiment"]["dominantCategory"], "calm")
        self.assertEqual(result["sentimentDistribution"][1]["share"], 0)
        self.assertEqual(result["satisfaction"]["satisfactionShare"], 75)  # not average(100, 0)
        self.assertEqual([row["date"] for row in result["satisfactionTrend"]], ["2026-10-26", "2026-10-28"])
        self.assertEqual(result["satisfactionTrend"][1]["satisfactionShare"], 0)

    def test_survey_overrides_unknown_categories_and_unsupported_scales(self):
        db.surveys.update_one({}, {"$set": {"sentimentPulseConfig": {"satisfaction": {"rating": {
            "validValues": [1, 2, 3, 4, 5], "satisfiedValues": [3]}}}}})
        db.analytics_entries.insert_one(entry("rating", question_id="rating", question_type="rating", raw_answer=3))
        result = self.get().json()
        self.assertEqual(result["satisfaction"]["satisfactionShare"], 100)
        for row in result["satisfactionDistribution"][1:]:
            self.assertIsNone(row["answers"])
            self.assertIsNone(row["share"])
        db.surveys.update_one({}, {"$unset": {"sentimentPulseConfig": ""}, "$set": {"questions": [
            {"id": "rating", "type": "rating", "rateMin": 0, "rateMax": 10}]}})
        result = self.get().json()
        self.assertEqual(result["satisfaction"]["status"], "not_configured")
        self.assertIsNone(result["satisfaction"]["satisfactionShare"])

    def test_bad_filters_and_default_range(self):
        for params in ({"timeRange": "bad"}, {"regions": "unknown"}, {"startDate": "2026-02-30"},
                       {"startDate": "2026-10-29", "endDate": "2026-10-28"},
                       {"startDate": "0001-01-01", "endDate": "0001-01-01"}):
            self.assertEqual(self.get(**params).status_code, 400)
        response = self.client.get(self.path, headers=self.headers())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["filters"]["startDate"], "2026-09-30")
        self.assertEqual(response.json()["filters"]["endDate"], "2026-10-29")


if __name__ == "__main__":
    unittest.main()
