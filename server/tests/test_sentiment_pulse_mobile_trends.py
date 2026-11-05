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
        for collection in (db.surveys, db.analytics_entries, db.mobile_users, db.user):
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
        self.survey = {"id": "survey", "publishToMobile": True, "scheduledAt": datetime(2026, 10, 1),
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
        self.assertEqual(set(result), {"sources", "filters", "sentiment", "satisfaction", "sentimentDistribution", "satisfactionDistribution", "satisfactionTrend"})
        self.assertEqual(set(result["satisfactionTrend"][0]), {"date", "satisfactionAnswers", "satisfiedAnswers", "satisfactionShare"})
        serialized = str(result)
        for forbidden in ("secret-entry", "secret-user", "secret-response", "raw_answer", "modelVersions", "surveyBreakdown", "worriedShare"):
            self.assertNotIn(forbidden, serialized)
        self.assertEqual(result["filters"]["participants"], "all")

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
                       {"startDate": "2026-10-29", "endDate": "2026-10-28"}):
            self.assertEqual(self.get(**params).status_code, 400)
        response = self.client.get(self.path, headers=self.headers())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["filters"]["startDate"], "2026-09-30")
        self.assertEqual(response.json()["filters"]["endDate"], "2026-10-29")


if __name__ == "__main__":
    unittest.main()
