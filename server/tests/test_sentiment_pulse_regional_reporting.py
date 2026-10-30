"""Regional analytics integration with in-memory MongoDB and inference blocked."""

import copy
from datetime import datetime
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_sentiment_pulse_annotations import db, entry, RULES, VERSION
from controllers.sentiment_pulse import annotation_controller as controller
from controllers.sentiment_pulse.annotation_reporting import report
from controllers.sentiment_pulse.regional_reporting import regional_report
from controllers.sentiment_pulse.regional_analysis import get_response_date_range
from helpers.analyticsEntryHelpers import build_survey_response_analytics_entries
from fastapi import FastAPI
from fastapi.testclient import TestClient


class RegionalReportingTests(unittest.TestCase):
    def setUp(self):
        for collection in (db.analytics_entries, db.survey_responses, db.surveys, db.user):
            collection.drop()
        self.bounds = get_response_date_range("custom", "2026-10-28", "2026-10-28",
                                              now=datetime(2026, 10, 29, 12))

    def classified(self, aid, parent=None, label="calm", **kwargs):
        row = entry(aid, **kwargs)
        row["analysis"].update(sentiment=label, sentiment_score=0 if label == "calm" else .9,
                               sentiment_model_version=VERSION)
        if parent:
            row["submission_id"] = parent
        return row

    def aggregate(self, regions=(), rules=None):
        return regional_report(db.analytics_entries, db.survey_responses,
                               rules or {"survey": RULES}, self.bounds, regions)

    def test_many_answers_anonymous_and_repeated_people_count_submissions(self):
        db.analytics_entries.insert_many([self.classified("a", "anonymous"),
            self.classified("b", "anonymous", "worried"),
            self.classified("c", "repeat-1", user_id="same-person"),
            self.classified("d", "repeat-2", user_id="same-person")])
        totals = self.aggregate()["totals"]
        self.assertEqual(totals["analyzedSubmissions"], 3)
        self.assertEqual(totals["predictedAnswers"], 4)
        self.assertEqual(totals["submissionCountStatus"], "exact")

    def test_legacy_answer_relationships_and_direct_aliases_unify(self):
        db.survey_responses.insert_one({"_id": "mongo-id", "id": "old-id", "submissionId": "uuid",
            "surveyId": "survey", "answerIds": {"explain": "a"}, "visitorId": "ignored",
            "createdAt": datetime(2000, 1, 1), "region": "CAR"})
        db.analytics_entries.insert_many([self.classified("a"), self.classified("b", "uuid"),
                                         self.classified("c", "old-id"), self.classified("d", "mongo-id")])
        result = self.aggregate()
        self.assertEqual(result["totals"]["analyzedSubmissions"], 1)
        self.assertEqual(result["regions"][0]["region"], "NCR")

    def test_missing_ambiguous_and_conflicting_links_never_fabricate_exact_counts(self):
        db.survey_responses.insert_many([
            {"_id": "one", "surveyId": "survey", "answerIds": {"explain": "shared"}},
            {"_id": "two", "surveyId": "survey", "answerIds": {"explain": "shared"}},
            {"_id": "three", "surveyId": "other", "answerIds": {"explain": "missing"}},
            {"_id": "four", "surveyId": "survey", "answerIds": {"different-question": "missing"}}])
        db.analytics_entries.insert_many([self.classified("shared"), self.classified("missing"),
            self.classified("known", "one"), self.classified("conflict", "two", response_id="shared")])
        result = self.aggregate()
        self.assertIsNone(result["totals"]["analyzedSubmissions"])
        self.assertEqual(result["totals"]["linkedAnalyzedSubmissions"], 1)
        self.assertEqual(result["totals"]["predictedAnswers"], 4)
        self.assertEqual(result["linkage"]["missingAnalyzedAnswers"], 1)
        self.assertEqual(result["linkage"]["ambiguousAnalyzedAnswers"], 2)
        self.assertIsNone(self.aggregate(["CAR"])["totals"]["analyzedSubmissions"])
        # No visitor, account, text or date heuristics can connect the missing answer.
        db.survey_responses.insert_one({"surveyId": "survey", "visitorId": "same",
            "answers": {"explain": entry()["text"]}, "createdAt": datetime(2026, 10, 28)})
        self.assertEqual(self.aggregate()["linkage"]["missingAnalyzedAnswers"], 1)

    def test_answer_source_and_response_ids_cannot_link_to_different_submissions(self):
        db.survey_responses.insert_many([{"_id": "one", "surveyId": "survey", "answerIds": {"explain": "a"}},
            {"_id": "two", "surveyId": "survey", "answerIds": {"explain": "b"}}])
        db.analytics_entries.insert_one(self.classified("a", response_id="b"))
        self.assertEqual(self.aggregate()["linkage"]["ambiguousAnalyzedAnswers"], 1)

    def test_prediction_validation_eligibility_and_partial_coverage_ignore_task_status(self):
        good = self.classified("good", "one", analysis_status="FAILED")
        rows = [good, entry("pending"), entry("failed", analysis_status="FAILED"),
                self.classified("ineligible", "bad", raw_answer="ok", text="ok")]
        for i, change in enumerate(({"sentiment": "neutral"}, {"sentiment_score": None},
                                    {"sentiment_score": 2}, {"sentiment_model_version": ""})):
            invalid = self.classified(f"invalid-{i}")
            invalid["analysis"].update(change)
            rows.append(invalid)
        db.analytics_entries.insert_many(rows)
        result = self.aggregate()
        self.assertEqual(result["totals"]["analyzedSubmissions"], 1)
        self.assertEqual(result["totals"]["predictedAnswers"], 1)
        self.assertEqual(result["totals"]["eligibleAnswers"], 7)
        self.assertEqual(result["totals"]["answersWithoutResults"], 6)
        self.assertEqual(result["linkage"]["missingAnalyzedAnswers"], 0)

    def test_region_assignment_uses_processed_locations_before_filtering(self):
        db.analytics_entries.insert_many([
            self.classified("a", "conflict"),
            self.classified("b", "conflict", "worried", location={"region": "CAR"}),
            self.classified("c", "missing", location={}),
            self.classified("d", "mixed"), self.classified("e", "mixed", location={}),
            self.classified("f", "internal-conflict", location={"region": "NCR"}, region="CAR"),
            self.classified("g", "known", location={"region": "Region NCR"}),
            entry("pending", submission_id="known", location={"region": "CAR"})])
        result = self.aggregate()
        regions = {r["region"]: r for r in result["regions"]}
        self.assertEqual(result["totals"]["analyzedSubmissions"], 5)
        self.assertEqual(regions[None]["analyzedSubmissions"], 4)
        self.assertEqual(regions["NCR"]["analyzedSubmissions"], 1)
        self.assertEqual(self.aggregate(["NCR"])["totals"]["predictedAnswers"], 1)
        self.assertEqual(self.aggregate(["NCR"])["totals"]["eligibleAnswers"], 2)
        self.assertEqual(self.aggregate(["CAR"])["totals"]["analyzedSubmissions"], 0)
        self.assertEqual(self.aggregate(["CAR"])["totals"]["predictedAnswers"], 0)
        self.assertEqual(sum(r["analyzedSubmissions"] for r in regions.values()), 5)

    def test_ph_dates_survey_question_source_scope_and_fallback(self):
        db.analytics_entries.insert_many([self.classified("start", "s", event_time="2026-10-27T16:00:00Z"),
            self.classified("end", "e", event_time="2026-10-28T15:59:59Z"),
            self.classified("before", "b", event_time="2026-10-27T15:59:59Z"),
            self.classified("after", "a", event_time="2026-10-28T16:00:00Z"),
            self.classified("future", "f", event_time="2026-10-30T00:00:00+08:00"),
            self.classified("bad-date", event_time="bad"),
            self.classified("fallback", "fallback", event_time=None, created_at=datetime(2026, 10, 28)),
            self.classified("deleted-survey", "deleted", survey_id="deleted"),
            self.classified("old-question", "old", question_id="deleted-question"),
            self.classified("web", "web", source_platform="website"),
            self.classified("social", "social", source_type="social_media")])
        result = self.aggregate()
        self.assertEqual(result["totals"]["analyzedSubmissions"], 3)
        self.assertEqual(result["totals"]["eligibleAnswers"], 3)
        self.assertEqual(result["excludedInvalidSubmissionDates"], 1)

    def test_satisfaction_is_scored_only_for_represented_submissions_and_zero_is_valid(self):
        def rating(aid, parent, value):
            return entry(aid, submission_id=parent, question_id="rating", question_type="rating", raw_answer=value, text=str(value))
        db.analytics_entries.insert_many([self.classified("calm", "one"),
            self.classified("worried", "one", "worried"), entry("pending", submission_id="one"),
            rating("r1", "one", 1), rating("r2", "one", 0), rating("r3", "other", 5),
            entry("unlinked-score", question_id="rating", question_type="rating", raw_answer=5, text="5")])
        result = self.aggregate()["totals"]
        self.assertEqual((result["calm"], result["worried"]), (1, 1))
        self.assertEqual(result["worriedShare"], 50)
        self.assertEqual((result["satisfactionAnswers"], result["satisfiedAnswers"], result["satisfactionShare"]), (1, 0, 0))
        trends = report(db.analytics_entries, {"survey": RULES}, self.bounds)["totals"]
        self.assertEqual(trends["satisfactionAnswers"], 3)
        self.assertAlmostEqual(trends["satisfactionShare"], 2 / 3 * 100)
        from controllers.sentiment_pulse.annotation_config import SurveyRules
        unconfigured = self.aggregate(rules={"survey": SurveyRules(RULES.explanations, {})})
        self.assertEqual(unconfigured["satisfactionStatus"], "not_configured")
        self.assertIsNone(unconfigured["totals"]["satisfactionShare"])

    def test_new_analytics_record_submission_id_without_modifying_old_records(self):
        response = {"submissionId": "future", "surveyId": "survey", "platform": "mobile",
            "answers": {"explain": "Helpful visit"}, "answerIds": {"explain": "answer"}}
        before = copy.deepcopy(response)
        rows = build_survey_response_analytics_entries(response, {"questions": [{"id": "explain", "type": "text"}]})
        self.assertEqual(rows[0]["submission_id"], "future")
        self.assertEqual(response, before)

    def test_admin_contract_all_existing_surveys_read_only_and_bad_filters(self):
        # API annotation's Admin dependency is the same as all existing admin reports.
        from controllers.sentiment_pulse.annotation_controller import Admin
        app = FastAPI()
        app.dependency_overrides[Admin.__metadata__[0].dependency] = lambda: {"role": "Admin"}
        app.add_api_route("/regional-analytics", controller.fetch_regional_analytics)
        client = TestClient(app)
        db.surveys.insert_one({"id": "survey", "publishToMobile": False, "scheduledAt": None,
            "questions": [{"id": "explain", "type": "text"}, {"id": "rating", "type": "rating"}]})
        db.analytics_entries.insert_one(self.classified("a", "anonymous"))
        before = list(db.analytics_entries.find())
        with patch.object(controller, "configuration", return_value={}), patch.object(controller, "run_processing") as inference:
            params = {"timeRange": "custom", "startDate": "2026-10-28", "endDate": "2026-10-28"}
            response = client.get("/regional-analytics", params=params)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["totals"]["analyzedSubmissions"], 1)
            self.assertEqual(data["sources"], ["mobile"])
            self.assertIsNone(data["filters"]["surveyId"])
            self.assertTrue(data["regionsComplete"])
            self.assertEqual(data["satisfactionScope"], "linked_analyzed_submissions")
            for invalid in ({"timeRange": "bad"}, {"regions": "unknown"}, {"startDate": "2026-02-30"}):
                self.assertEqual(client.get("/regional-analytics", params={**params, **invalid}).status_code, 400)
            inference.assert_not_called()
        self.assertEqual(list(db.analytics_entries.find()), before)
        app.dependency_overrides.clear()
        self.assertEqual(client.get("/regional-analytics").status_code, 401)


if __name__ == "__main__":
    unittest.main()
