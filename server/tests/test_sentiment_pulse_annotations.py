"""Isolated integration contracts. config.database is replaced before imports."""

import copy
import sys
import types
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import httpx
import mongomock
import pymongo
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
# Fail closed even if a future import bypasses the replacement database module.
pymongo.MongoClient = lambda *a, **k: (_ for _ in ()).throw(AssertionError("Real MongoDB forbidden in tests"))
import pymongo.mongo_client
pymongo.mongo_client.MongoClient = pymongo.MongoClient
db = mongomock.MongoClient().db
database = types.ModuleType("config.database")
for name in ("application_settings", "analytics_events", "analytics_entries", "mobile_users", "survey_responses", "surveys", "user"):
    setattr(database, name + "_collection", db[name])
sys.modules["config.database"] = database

from controllers.sentiment_pulse.annotation_config import (  # noqa: E402
    ConfigurationError, SurveyRules, eligible_text, parse_config, rules_for_survey, validate_survey_rules,
)
from controllers.sentiment_pulse.annotation_processing import (  # noqa: E402
    ProcessRegistry, run_processing, scope, stored_prediction, write_prediction,
)
from controllers.sentiment_pulse.annotation_reporting import report  # noqa: E402
from controllers.sentiment_pulse.inference_client import SentimentClient, SentimentServiceError  # noqa: E402
from controllers.sentiment_pulse.regional_analysis import get_response_date_range  # noqa: E402
from controllers.sentiment_pulse import annotation_controller as controller  # noqa: E402
from middleware.requireAuth import require_auth  # noqa: E402

VERSION = "sha256:" + "a" * 64
RULES = SurveyRules(frozenset({"explain"}), {"rating": {"validValues": [1, 2, 3, 4, 5], "satisfiedValues": [4, 5]}})


def entry(identifier="one", **overrides):
    return {"_id": identifier, **scope("survey"), "question_id": "explain", "question_type": "text",
            "source_id": identifier, "response_id": identifier, "text": "Mas maayos ang serbisyo ngayon.",
            "raw_answer": "Mas maayos ang serbisyo ngayon.", "language": "fil",
            "analysis_status": "PROCESSED", "analysis_error": "unchanged",
            "analysis": {"sentiment": None, "sentiment_score": None, "model_version": "another-task",
                         "language_detection": {"status": "completed", "confidence": .9}, "entities": ["kept"]},
            "event_time": "2026-10-27T16:00:00Z", "created_at": datetime(2026, 10, 1),
            "location": {"region": "NCR"}, "updated_at": "unchanged", "analyzed_at": "unchanged", **overrides}


def prediction(score=.8):
    return {"predicted_label": int(score >= .7), "predicted_label_name": "worried" if score >= .7 else "calm",
            "worried_probability": score, "threshold_used": .7, "model_version": VERSION}


class FakeClient:
    def __init__(self):
        self.batches = []

    def ready(self):
        return VERSION

    def predict_batch(self, texts):
        self.batches.append(texts)
        return [prediction() for text in texts]

    def close(self):
        pass


class ProcessingTests(unittest.TestCase):
    def setUp(self):
        db.analytics_entries.drop()
        self.collection = db.analytics_entries
        self.jobs = ProcessRegistry()
        self.jobs.reserve("survey")
        self.client = FakeClient()

    def run_job(self):
        run_processing(self.collection, "survey", RULES, self.jobs, lambda: self.client)

    def test_scope_and_only_three_fields_written(self):
        rows = [entry(), entry("other", survey_id="other"), entry("social", source_type="social_media"),
                entry("self", source_type="self_report"), entry("web", source_platform="website")]
        self.collection.insert_many(copy.deepcopy(rows))
        self.run_job()
        actual = self.collection.find_one({"_id": "one"})
        expected = copy.deepcopy(rows[0])
        expected["analysis"].update(sentiment="worried", sentiment_score=.8, sentiment_model_version=VERSION)
        self.assertEqual(actual, expected)
        for original in rows[1:]:
            self.assertEqual(self.collection.find_one({"_id": original["_id"]}), original)

    def test_more_than_500_and_repeat_requests(self):
        self.collection.insert_many([entry(str(i)) for i in range(601)])
        self.run_job()
        self.assertEqual(self.jobs.get("survey")["stored"], 601)
        self.assertEqual(max(map(len, self.client.batches)), 32)
        self.jobs.reserve("survey")
        self.client.batches.clear()
        self.client.ready = lambda: self.fail("Completed answers must not require an available model")
        self.run_job()
        self.assertEqual(self.client.batches, [])
        self.assertEqual(report(self.collection, {"survey": RULES})["totals"]["predictedAnswers"], 601)

    def test_text_and_choice_inference_with_independent_five_point_ratings(self):
        survey = {"id": "survey", "questions": [{"id": "explain", "type": "text"},
            {"id": "choice", "type": "multipleChoice"}, {"id": "rating", "type": "rating", "rateMin": 1, "rateMax": 5}]}
        rules = rules_for_survey(survey, {})
        rating_rows = [entry(f"r{i}", question_id="rating", question_type="rating", raw_answer=i, text=str(i)) for i in range(1, 6)]
        choice = entry("choice", question_id="choice", question_type="multipleChoice", raw_answer="Satisfied", text="Satisfied")
        self.collection.insert_many([entry(), choice, *copy.deepcopy(rating_rows),
            entry("website-choice", question_id="choice", question_type="multipleChoice", raw_answer="Dissatisfied", text="Dissatisfied", source_platform="website")])
        run_processing(self.collection, "survey", rules, self.jobs, lambda: self.client)
        self.assertEqual(self.client.batches, [[entry()["text"], "Satisfied"]])
        self.assertTrue(stored_prediction(self.collection.find_one({"_id": "choice"})))
        for row in rating_rows:
            self.assertEqual(self.collection.find_one({"_id": row["_id"]}), row)
        counts = report(self.collection, {"survey": rules})["totals"]
        self.assertEqual((counts["eligibleAnswers"], counts["predictedAnswers"]), (2, 2))
        self.assertEqual((counts["satisfactionAnswers"], counts["satisfiedAnswers"], counts["dissatisfiedAnswers"], counts["neutralSatisfactionAnswers"]), (5, 2, 2, 1))
        self.assertEqual(counts["satisfactionShare"], 40)
        self.assertEqual(counts["worriedShare"], 100)

    def test_preserves_nonnull_unowned_or_invalid_results(self):
        for i, field in enumerate(("sentiment", "sentiment_score", "sentiment_model_version")):
            row = entry(str(i))
            row["analysis"][field] = "unknown" if field != "sentiment_score" else 0
            self.collection.insert_one(row)
        before = list(self.collection.find())
        self.run_job()
        self.assertEqual(before, list(self.collection.find()))
        self.assertEqual(report(self.collection, {"survey": RULES})["totals"]["answersWithoutResults"], 3)

    def test_changed_inputs_and_deleted_entries_cannot_be_annotated(self):
        for change in ({"text": "Changed explanation"}, {"raw_answer": "different"},
                       {"question_id": "other"}, {"question_type": "rating"},
                       {"survey_id": "other"}, {"source_type": "social_media"},
                       {"source_platform": "website"}, {"response_id": "changed"}):
            original = entry()
            self.collection.delete_many({})
            self.collection.insert_one(copy.deepcopy(original))
            self.collection.update_one({"_id": "one"}, {"$set": change})
            self.assertEqual(write_prediction(self.collection, "survey", original, prediction()), 0)
        self.collection.delete_many({})
        self.assertEqual(write_prediction(self.collection, "survey", entry(), prediction()), 0)

    def test_concurrent_writes_keep_first_prediction(self):
        self.collection.insert_one(entry())
        with ThreadPoolExecutor(2) as pool:
            outcomes = list(pool.map(lambda score: write_prediction(self.collection, "survey", entry(), prediction(score)), [.2, .8]))
        self.assertEqual(sum(outcomes), 1)

    def test_partial_failure_keeps_successes_and_retry_only_missing(self):
        self.collection.insert_many([entry(str(i)) for i in range(65)])
        original = self.client.predict_batch
        def sometimes(texts):
            if len(self.client.batches) == 1:
                self.client.batches.append(texts)
                raise SentimentServiceError("test")
            return original(texts)
        self.client.predict_batch = sometimes
        self.run_job()
        self.assertEqual(self.jobs.get("survey")["state"], "completed_with_errors")
        self.assertEqual(self.jobs.get("survey")["stored"], 33)
        self.jobs.reserve("survey")
        self.client = FakeClient()
        self.run_job()
        self.assertEqual(self.jobs.get("survey")["stored"], 32)

    def test_unavailable_readiness_leaves_nulls(self):
        self.collection.insert_one(entry())
        self.client.ready = lambda: (_ for _ in ()).throw(SentimentServiceError())
        self.run_job()
        self.assertIsNone(self.collection.find_one()["analysis"]["sentiment"])
        self.assertEqual(self.jobs.get("survey")["state"], "failed")

    def test_concurrent_language_write_is_preserved(self):
        self.collection.insert_one(entry())
        original = self.client.predict_batch
        def with_language_update(texts):
            self.collection.update_one({"_id": "one"}, {"$set": {
                "language": "ceb", "analysis.language_detection.status": "completed",
                "analysis_status": "PROCESSED", "updated_at": "language-time"}})
            return original(texts)
        self.client.predict_batch = with_language_update
        self.run_job()
        row = self.collection.find_one()
        self.assertEqual(row["language"], "ceb")
        self.assertEqual(row["updated_at"], "language-time")
        self.assertTrue(stored_prediction(row))

    def test_write_failure_preserves_other_successes(self):
        self.collection.insert_many([entry("one"), entry("two")])
        original = self.collection.update_one
        def fail_one(query, update):
            if query["_id"] == "one":
                raise RuntimeError("write failure")
            return original(query, update)
        with patch.object(self.collection, "update_one", side_effect=fail_one):
            self.run_job()
        self.assertTrue(stored_prediction(self.collection.find_one({"_id": "two"})))
        self.assertIsNone(self.collection.find_one({"_id": "one"})["analysis"]["sentiment"])
        self.assertEqual(self.jobs.get("survey")["failedWrites"], 1)

    def test_registry_deduplicates_in_process_only_and_bounds_memory(self):
        jobs = ProcessRegistry(capacity=1)
        with ThreadPoolExecutor(8) as pool:
            results = list(pool.map(lambda _: jobs.reserve("survey"), range(8)))
        self.assertEqual(sum(started for _, started in results), 1)
        with self.assertRaises(RuntimeError):
            jobs.reserve("other")
        self.assertIsNone(ProcessRegistry().get("survey"))
        jobs.update("survey", state="completed")
        self.assertTrue(jobs.reserve("other")[1])


class ClientTests(unittest.TestCase):
    def client(self, handler):
        client = SentimentClient(httpx.MockTransport(handler))
        self.addCleanup(client.close)
        return client

    def test_real_http_contract_and_order_and_unicode(self):
        texts = ["  Ubo\n at lagnat — ñ 😷  ", "Buti na lang okay na siya ngayon."]
        def handler(request):
            if request.method == "GET":
                return httpx.Response(200, json={"status": "ready", "model_version": VERSION})
            import json
            self.assertEqual(json.loads(request.content)["texts"], texts)
            return httpx.Response(200, json={"results": [prediction(.2), prediction(.8)]})
        self.assertEqual([r["predicted_label_name"] for r in self.client(handler).predict_batch(texts)], ["calm", "worried"])

    def test_invalid_response_fields_count_version_and_threshold(self):
        bad = [[], [None], [prediction(), prediction()]]
        for field, value in (("worried_probability", float("nan")), ("worried_probability", True),
                             ("threshold_used", float("inf")), ("worried_probability", -1),
                             ("predicted_label", True), ("predicted_label_name", "calm"),
                             ("model_version", "bad"), ("model_version", "sha256:" + "b" * 64)):
            bad.append([{**prediction(), field: value}])
        for results in bad:
            client = self.client(lambda _: httpx.Response(200, json={"results": results}))
            client.version = VERSION
            # JSON serializer rejects NaN/Inf itself; use raw JSON for malformed remote payloads.
            import json
            client.client.close()
            client.client = httpx.Client(transport=httpx.MockTransport(lambda _, rows=results: httpx.Response(200, content=json.dumps({"results": rows}))))
            with self.assertRaises(SentimentServiceError):
                client.predict_batch(["valid explanation"])
        client = self.client(lambda _: httpx.Response(200, json={"results": [prediction(), {**prediction(), "threshold_used": .6}]}))
        client.version = VERSION
        with self.assertRaises(SentimentServiceError):
            client.predict_batch(["first explanation", "second explanation"])

    def test_unavailable_timeout_http_and_json_errors(self):
        def timeout(request):
            raise httpx.ReadTimeout("secret text should not escape", request=request)
        for handler in (timeout, lambda _: httpx.Response(503), lambda _: httpx.Response(200, text="invalid"),
                        lambda _: httpx.Response(200, json=[]), lambda _: httpx.Response(200, json={"status": "ready", "model_version": "bad"})):
            with self.assertRaises(SentimentServiceError) as raised:
                self.client(handler).ready()
            self.assertNotIn("secret", str(raised.exception))

    def test_input_limits_and_configuration(self):
        client = self.client(lambda _: self.fail("Must not send invalid inputs"))
        for texts in ([], ["x"] * 33, [" "], ["x" * 10001], [3]):
            with self.assertRaises(SentimentServiceError):
                client.predict_batch(texts)
        for value in ("nan", "inf", "0", "121", "bad"):
            with patch.dict("os.environ", {"HEALTHPH_SENTIMENT_TIMEOUT_SECONDS": value}):
                with self.assertRaises(SentimentServiceError):
                    SentimentClient()


class EligibilityReportingTests(unittest.TestCase):
    def setUp(self):
        db.analytics_entries.drop()

    def test_explicit_ids_and_raw_written_answers_only(self):
        self.assertTrue(eligible_text(entry(), RULES))
        for overrides in ({"question_id": "other"}, {"question_type": "rating"},
                          {"raw_answer": 5}, {"raw_answer": ["a"]}):
            self.assertFalse(eligible_text(entry(**overrides), RULES))
        for text in ("", "   ", "5", "5.0", "N/A", "No comment", "Satisfied", "x" * 10001):
            self.assertFalse(eligible_text(entry(text=text, raw_answer=text), RULES))
        self.assertFalse(eligible_text(entry(), SurveyRules()))

    def test_defaults_derive_text_choices_and_only_the_approved_rating_scale(self):
        survey = {"id": "s", "questions": [{"id": "t", "name": "text-key", "type": "text"},
            {"id": "choice", "type": "multipleChoice"}, {"id": "rating", "type": "rating", "rateMin": 1, "rateMax": 5},
            {"id": "other-scale", "type": "rating", "rateMin": 0, "rateMax": 10}, {"id": "html", "type": "html"}]}
        rules = rules_for_survey(survey, {})
        self.assertEqual(rules.explanations, frozenset({"text-key", "choice"}))
        self.assertEqual(set(rules.satisfaction), {"rating"})
        self.assertEqual(rules.satisfaction["rating"]["satisfiedValues"], [4, 5])
        self.assertEqual(rules.satisfaction["rating"]["dissatisfiedValues"], [1, 2])
        self.assertEqual(rules.satisfaction["rating"]["neutralValues"], [3])
        validate_survey_rules(survey, rules)

    def test_choice_labels_are_model_text_without_placeholder_or_numeric_rating_rules(self):
        rules = SurveyRules(frozenset({"choice"}))
        for raw, text in (("Yes", "Yes"), ("No", "No"), ("Satisfied", "Satisfied"), ("5", "5"), (0, "0"), ("Maayos ñ", "Maayos ñ")):
            self.assertTrue(eligible_text(entry(question_id="choice", question_type="multipleChoice", raw_answer=raw, text=text), rules))
        for raw in ([], {}, True, None, float("nan")):
            self.assertFalse(eligible_text(entry(question_id="choice", question_type="multipleChoice", raw_answer=raw), rules))
        self.assertFalse(eligible_text(entry(question_id="choice", question_type="rating", raw_answer=5, text="5"), rules))

    def test_explicit_overrides_are_preserved_and_category_sets_cannot_overlap(self):
        survey = {"id": "s", "questions": [{"id": "t", "type": "text"}], "sentimentPulseConfig": {}}
        self.assertEqual(rules_for_survey(survey, {}).explanations, frozenset())
        fallback = {"s": SurveyRules(frozenset({"other"}))}
        self.assertEqual(rules_for_survey({"id": "s"}, fallback), fallback["s"])
        for extra in ({"dissatisfiedValues": [4]}, {"neutralValues": [6]}, {"dissatisfiedValues": [3], "neutralValues": [3]},
                      {"dissatisfiedValues": [1], "neutralValues": [3]}):
            with self.assertRaises(ConfigurationError):
                parse_config({"surveys": {"s": {"satisfaction": {"r": {"validValues": [1, 2, 3, 4, 5], "satisfiedValues": [4, 5], **extra}}}}})

    def test_config_rejects_guesses_and_bad_satisfaction_sets(self):
        with self.assertRaises(ConfigurationError):
            parse_config({"surveys": {"s": {"satisfaction": {"q": {"validValues": [1, 2], "satisfiedValues": [5]}}}}})
        with self.assertRaises(ConfigurationError):
            validate_survey_rules({"questions": [{"id": "explain", "type": "rating"}]}, RULES)
        configured = parse_config({"surveys": {"s": {"explanationQuestionIds": ["explain"]}}})
        self.assertEqual(configured["s"].explanations, frozenset({"explain"}))

    def test_explicit_choice_satisfaction_and_numeric_rating_equivalence(self):
        rules = SurveyRules(satisfaction={
            "choice": {"validValues": ["good", "poor"], "satisfiedValues": ["good"]},
            "rating": {"validValues": [1, 5], "satisfiedValues": [5]},
        })
        db.analytics_entries.insert_many([
            entry("a", question_id="choice", question_type="multipleChoice", raw_answer="good", text="good"),
            entry("b", question_id="choice", question_type="multipleChoice", raw_answer="poor", text="poor"),
            entry("c", question_id="choice", question_type="multipleChoice", raw_answer="unknown", text="unknown"),
            entry("d", question_id="rating", question_type="rating", raw_answer=5.0, text="5.0"),
        ])
        result = report(db.analytics_entries, {"survey": rules})["totals"]
        self.assertEqual(result["satisfactionAnswers"], 3)
        self.assertEqual(result["satisfiedAnswers"], 2)
        self.assertIsNone(result["worriedShare"])
        self.assertEqual(result["eligibleAnswers"], 0)

    def test_null_zero_original_ph_date_unknown_and_separate_satisfaction(self):
        calm = entry("calm")
        calm["analysis"].update(sentiment="calm", sentiment_score=0, sentiment_model_version=VERSION)
        worried = entry("worried", location={"region": "unknown"})
        worried["analysis"].update(sentiment="worried", sentiment_score=.9, sentiment_model_version="sha256:" + "b" * 64)
        rows = [calm, worried, entry("missing"), entry("rating", question_id="rating", question_type="rating", raw_answer=5, text="5"),
                entry("bad-rating", question_id="rating", question_type="rating", raw_answer="5", text="5"),
                entry("previous", event_time="2026-10-27T15:59:59Z"), entry("bad-date", event_time="bad")]
        db.analytics_entries.insert_many(rows)
        bounds = get_response_date_range("custom", "2026-10-28", "2026-10-28", now=datetime(2026, 10, 29))
        result = report(db.analytics_entries, {"survey": RULES}, bounds)
        self.assertEqual(result["totals"]["worriedShare"], 50)
        self.assertEqual(result["totals"]["eligibleAnswers"], 3)
        self.assertEqual(result["totals"]["answersWithoutResults"], 1)
        self.assertEqual(result["totals"]["satisfactionAnswers"], 1)
        self.assertEqual(result["totals"]["satisfactionShare"], 100)
        self.assertTrue(result["mixedModelVersions"])
        self.assertEqual(result["daily"][0]["date"], "2026-10-28")
        self.assertEqual(next(r for r in result["regions"] if r["region"] is None)["worried"], 1)
        self.assertEqual(report(db.analytics_entries, {"survey": RULES}, bounds, ["NCR"])["totals"]["worriedShare"], 0)
        empty = report(db.analytics_entries, {"survey": SurveyRules()}, bounds)
        self.assertIsNone(empty["totals"]["worriedShare"])
        self.assertIsNone(empty["totals"]["satisfactionShare"])
        self.assertEqual(empty["surveys"][0]["sentimentStatus"], "not_configured")

    def test_region_fallback_and_conflicts_reuse_existing_adapter(self):
        db.analytics_entries.insert_many([
            entry("fallback", location={}, metadata={"region": "Region III"}),
            entry("conflict", location={"region": "NCR"}, metadata={"region": "CAR"}),
        ])
        result = report(db.analytics_entries, {"survey": RULES})
        regions = {row["region"]: row["eligibleAnswers"] for row in result["regions"]}
        self.assertEqual(regions, {"III": 1, None: 1})

    def test_regional_totals_weight_answer_counts_and_preserve_zero_and_missing(self):
        rows = [entry("ncr-good", question_id="rating", question_type="rating", raw_answer=5),
                *[entry(f"iii-low-{i}", question_id="rating", question_type="rating",
                        raw_answer=1, location={"region": "Region III"}) for i in range(9)],
                entry("unprocessed"), entry("unknown", location={})]
        db.analytics_entries.insert_many(rows)
        result = report(db.analytics_entries, {"survey": RULES})
        regional = {row["region"]: row for row in result["regions"]}
        self.assertEqual(result["totals"]["satisfactionShare"], 10)
        self.assertEqual(regional["NCR"]["satisfactionShare"], 100)
        self.assertEqual(regional["III"]["satisfactionShare"], 0)
        self.assertEqual(regional["III"]["satisfiedAnswers"], 0)
        self.assertIsNone(regional[None]["satisfactionShare"])
        self.assertEqual(regional["NCR"]["answersWithoutResults"], 1)
        self.assertIsNone(result["totals"]["worriedShare"])


class RouteTests(unittest.TestCase):
    def setUp(self):
        db.surveys.drop()
        db.user.drop()
        db.analytics_entries.drop()
        from bson import ObjectId
        self.user_id = ObjectId()
        db.user.insert_one({"_id": self.user_id, "user_type": "Admin"})
        self.app = FastAPI()
        self.app.dependency_overrides[require_auth] = lambda: str(self.user_id)
        for path, method, endpoint in (("/surveys/{survey_id}/sentiment-config", "PUT", controller.configure_survey),
                                      ("/surveys/{survey_id}/process", "POST", controller.process_survey),
                                      ("/surveys/{survey_id}/processing", "GET", controller.processing_status),
                                      ("/trends", "GET", controller.fetch_trends)):
            self.app.add_api_route(path, endpoint, methods=[method])
        self.client = TestClient(self.app)
        self.survey = {"id": "survey", "questions": [{"id": "explain", "name": "explain", "type": "text"}]}
        db.surveys.insert_one(copy.deepcopy(self.survey))

    def test_roles_ended_requirement_not_configured_and_no_staging(self):
        db.user.update_one({}, {"$set": {"user_type": "User"}})
        self.assertEqual(self.client.post("/surveys/survey/process").status_code, 403)
        db.user.update_one({}, {"$set": {"user_type": "Admin"}})
        self.assertEqual(self.client.post("/surveys/survey/process").status_code, 409)
        db.surveys.update_one({}, {"$set": {"endedAt": datetime.now(), "sentimentPulseConfig": {}}})
        with patch.object(controller, "configuration", return_value={}):
            response = self.client.post("/surveys/survey/process")
        self.assertEqual(response.json()["state"], "not_configured")
        self.assertEqual(db.analytics_entries.count_documents({}), 0)

    def test_rating_only_process_returns_scoring_without_inference_or_writes(self):
        questions = [{"id": "rating", "type": "rating", "rateMin": 1, "rateMax": 5}]
        db.surveys.update_one({}, {"$set": {"endedAt": datetime.now(), "questions": questions}})
        rows = [entry(str(i), question_id="rating", question_type="rating", raw_answer=i, text=str(i)) for i in range(1, 7)]
        db.analytics_entries.insert_many(copy.deepcopy(rows))
        with patch.object(controller, "configuration", return_value={}), patch.object(controller, "run_processing") as run:
            response = self.client.post("/surveys/survey/process")
            status = self.client.get("/surveys/survey/processing").json()
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["state"], "configured")
        self.assertIsNone(payload["job"])
        self.assertEqual(status["state"], "configured")
        counts = payload["summary"]["totals"]
        self.assertEqual(counts["satisfactionShare"], 40)
        self.assertEqual((counts["satisfiedAnswers"], counts["dissatisfiedAnswers"], counts["neutralSatisfactionAnswers"]), (2, 2, 1))
        self.assertIsNone(counts["worriedShare"])
        run.assert_not_called()
        self.assertEqual(list(db.analytics_entries.find()), rows)
        db.analytics_entries.delete_many({})
        db.analytics_entries.insert_one(entry("neutral", question_id="rating", question_type="rating", raw_answer=3, text="3"))
        with patch.object(controller, "configuration", return_value={}):
            neutral = self.client.post("/surveys/survey/process").json()["summary"]["totals"]
        self.assertEqual(neutral["satisfactionAnswers"], 1)
        self.assertEqual(neutral["neutralSatisfactionAnswers"], 1)
        self.assertEqual(neutral["satisfactionShare"], 0)

    def test_unconfigured_supported_survey_now_schedules_inference_from_question_types(self):
        db.surveys.update_one({}, {"$set": {"endedAt": datetime.now()}})
        with patch.object(controller, "configuration", return_value={}), patch.object(controller, "registry", ProcessRegistry()), patch.object(controller, "run_processing") as run:
            response = self.client.post("/surveys/survey/process")
        self.assertEqual(response.status_code, 202)
        self.assertTrue(response.json()["accepted"])
        self.assertEqual(run.call_args.args[2].explanations, frozenset({"explain"}))

    def test_per_survey_configuration_and_shared_reporting(self):
        config = {"explanationQuestionIds": ["explain"]}
        self.assertEqual(self.client.put("/surveys/survey/sentiment-config", json=config).status_code, 200)
        db.surveys.update_one({}, {"$set": {"endedAt": datetime.now()}})
        self.assertEqual(self.client.put("/surveys/survey/sentiment-config", json=config).status_code, 409)
        db.analytics_entries.insert_one(entry())
        with patch.object(controller, "configuration", return_value={}):
            status = self.client.get("/surveys/survey/processing").json()
            trends = self.client.get("/trends?timeRange=custom&startDate=2026-10-28&endDate=2026-10-28&surveyId=survey").json()
        self.assertEqual(status["summary"]["totals"], trends["totals"])
        self.assertFalse(status["progressDurable"])

    def test_regional_dashboard_read_scope_is_mobile_all_existing_surveys_and_never_processes(self):
        db.surveys.update_one({}, {"$set": {"questions": [
            {"id": "explain", "type": "text"},
            {"id": "rating", "type": "rating", "rateMin": 1, "rateMax": 5}]}})
        # No publication flags: answer reporting intentionally retains Trends eligibility.
        rows = [entry("calm"), entry("worried"), entry("pending"),
                entry("zero-rating", question_id="rating", question_type="rating", raw_answer=1),
                entry("website", source_platform="website"), entry("deleted", survey_id="deleted"),
                entry("previous", event_time="2026-10-27T15:59:59Z"),
                entry("other-region", location={"region": "Region III"}),
                entry("unknown", location={})]
        for row, sentiment in zip(rows[:2], ("calm", "worried")):
            row["analysis"].update(sentiment=sentiment, sentiment_score=.5, sentiment_model_version=VERSION)
        db.analytics_entries.insert_many(copy.deepcopy(rows))
        before = list(db.analytics_entries.find())
        with patch.object(controller, "configuration", return_value={}), \
                patch.object(controller, "run_processing") as run, \
                patch.object(controller.registry, "reserve") as reserve:
            response = self.client.get("/trends?timeRange=custom&startDate=2026-10-28&endDate=2026-10-28&regions=Region%20NCR")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["sources"], ["mobile"])
        self.assertIsNone(data["filters"]["surveyId"])
        self.assertEqual(data["filters"]["regions"], ["NCR"])
        self.assertFalse(data["filters"]["unknownRegionIncluded"])
        self.assertEqual(data["totals"]["eligibleAnswers"], 3)
        self.assertEqual(data["totals"]["predictedAnswers"], 2)
        self.assertEqual(data["totals"]["answersWithoutResults"], 1)
        self.assertEqual(data["totals"]["worriedShare"], 50)
        self.assertEqual(data["totals"]["satisfactionShare"], 0)
        self.assertEqual(data["regions"][0]["region"], "NCR")
        self.assertEqual(list(db.analytics_entries.find()), before)
        run.assert_not_called()
        reserve.assert_not_called()

    def test_background_process_dispatches_and_repeat_is_safe(self):
        db.surveys.update_one({}, {"$set": {"sentimentPulseConfig": {"explanationQuestionIds": ["explain"]}, "endedAt": datetime.now()}})
        jobs = ProcessRegistry()
        with patch.object(controller, "registry", jobs), patch.object(controller, "run_processing") as run, patch.object(controller, "configuration", return_value={}):
            first = self.client.post("/surveys/survey/process")
            second = self.client.post("/surveys/survey/process")
        self.assertEqual(first.status_code, 202)
        self.assertTrue(first.json()["accepted"])
        self.assertFalse(second.json()["accepted"])
        self.assertEqual(run.call_count, 1)


class SharedLanguageCompatibilityTests(unittest.TestCase):
    """Execute unchanged shared workers against isolated collection adapters."""
    def setUp(self):
        db.analytics_entries.drop()
        self.collection = db.analytics_entries

    def apply_bulk(self, updates):
        matched = sum(self.collection.update_one(op._filter, op._doc).matched_count for op in updates)
        return types.SimpleNamespace(matched_count=matched)

    def test_existing_analytics_language_worker_preserves_sentiment(self):
        from bson import ObjectId
        from controllers import analyticsEntryController as shared
        identifier = ObjectId()
        row = entry(identifier, analysis_status="QUEUED")
        row["analysis"].update(sentiment="calm", sentiment_score=0, sentiment_model_version=VERSION)
        self.collection.insert_one(row)
        language = {"language": "fil", "is_supported": True, "detection_source": "fasttext", "confidence": .95}
        with patch.object(shared, "detect_languages", return_value=[language]) as detect, patch.object(self.collection, "bulk_write", side_effect=self.apply_bulk):
            shared.run_analytics_entry_processing_job([str(identifier)])
        after = self.collection.find_one()
        self.assertEqual(after["analysis_status"], "PROCESSED")
        self.assertEqual(after["language"], "fil")
        self.assertEqual(after["analysis"]["sentiment_score"], 0)
        self.assertEqual(after["analysis"]["sentiment_model_version"], VERSION)
        detect.assert_called_once_with([row["text"]])

    def test_existing_analytics_language_failure_contract(self):
        from bson import ObjectId
        from controllers import analyticsEntryController as shared
        identifier = ObjectId()
        self.collection.insert_one(entry(identifier, analysis_status="QUEUED"))
        with patch.object(shared, "detect_languages", side_effect=RuntimeError("service failed")):
            shared.run_analytics_entry_processing_job([str(identifier)])
        after = self.collection.find_one()
        self.assertEqual(after["analysis_status"], "FAILED")
        self.assertIsNone(after["analysis"]["sentiment"])

    def test_shared_language_http_contract_still_uses_language_api(self):
        from helpers import languageDetectionHelpers as language
        def handler(request):
            self.assertEqual(request.url.path, "/v1/language/predict-batch")
            return httpx.Response(200, json={"results": [{"language": "fil", "is_supported": True,
                "prediction_source": "fasttext", "fasttext_confidence": .9}]})
        real_client = httpx.Client
        with patch.object(language.httpx, "Client", side_effect=lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs)):
            result = language.detect_languages(["Kamusta ang serbisyo?"])
        self.assertEqual(result[0]["language"], "fil")
        self.assertEqual(result[0]["detection_source"], "fasttext")

    def test_dataset_language_worker_stays_social_media_scoped(self):
        # Extract the unchanged worker only, avoiding unrelated NLTK/Electra
        # initialization and imports from the full dataset module.
        import ast
        from bson import ObjectId
        from collections import Counter, defaultdict
        from helpers.miscHelpers import get_ph_datetime
        source = Path(__file__).resolve().parents[1] / "controllers/datasetsController.py"
        function = next(n for n in ast.parse(source.read_text(encoding="utf-8")).body
                        if isinstance(n, ast.FunctionDef) and n.name == "run_dataset_processing_job")
        identifier = ObjectId()
        dataset = db.dataset_compatibility
        dataset.drop()
        dataset.insert_one({"_id": identifier})
        self.collection.insert_many([
            entry("social", source_type="social_media", dataset_id=str(identifier)),
            entry("survey", dataset_id=str(identifier)),
        ])
        language = {"language": "fil", "is_supported": True, "detection_source": "fasttext", "confidence": .95}
        namespace = {"ObjectId": ObjectId, "Counter": Counter, "defaultdict": defaultdict, "pymongo": pymongo,
                     "get_ph_datetime": get_ph_datetime, "analytics_entries_collection": self.collection,
                     "dataset_collection": dataset, "detect_languages": lambda texts: [language for text in texts]}
        exec(compile(ast.Module(body=[function], type_ignores=[]), str(source), "exec"), namespace)
        with patch.object(self.collection, "bulk_write", side_effect=self.apply_bulk):
            namespace["run_dataset_processing_job"](str(identifier))
        self.assertEqual(dataset.find_one()["dataset_status"], "PROCESSED")
        self.assertEqual(self.collection.find_one({"_id": "social"})["language"], "fil")
        self.assertEqual(self.collection.find_one({"_id": "survey"})["language"], "fil")
        # Initial survey language was already fil: the entire row is unchanged.
        self.assertEqual(self.collection.find_one({"_id": "survey"}), entry("survey", dataset_id=str(identifier)))


if __name__ == "__main__":
    unittest.main()
