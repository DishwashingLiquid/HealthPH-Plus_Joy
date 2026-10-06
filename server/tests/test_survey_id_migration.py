"""Focused, database-free migration and result preservation checks."""

import copy
import sys
import unittest
from datetime import datetime
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_ROOT))

from scripts.migrate_survey_id_hierarchy import make_plan, run  # noqa: E402
from controllers.sentiment_pulse.results_aggregation import build_question_results  # noqa: E402


class SurveyMigrationTests(unittest.TestCase):
    def fixtures(self):
        surveys = [
            {"_id": "s1", "id": "legacy-1", "displayId": "SUR-00007",
             "createdAt": datetime(2025, 1, 1),
             "questions": [
                 {"id": "old-a", "name": "answer-a", "type": "text", "title": "Symptoms"},
                 {"id": "old-b", "type": "rating", "title": "Rating", "rateMin": 1, "rateMax": 5},
             ],
             "surveyJson": {"pages": [{"elements": [{"name": "answer-a"}, {"name": "old-b"}]}]},
             "responseCount": 2},
            {"_id": "s2", "id": "legacy-2", "createdAt": datetime(2025, 1, 2),
             "questions": [{"id": "other", "type": "text"}], "surveyJson": {}},
        ]
        responses = [
            {"_id": "r1", "id": "submission-1", "surveyId": "legacy-1",
             "createdAt": datetime(2025, 1, 3), "answers": {"answer-a": "fever", "old-b": 4}},
            {"_id": "r2", "id": "submission-2", "surveyId": "legacy-1",
             "createdAt": datetime(2025, 1, 4), "answers": {"answer-a": "cough", "removed-key": "saved"}},
            {"_id": "r3", "id": "submission-3", "surveyId": "legacy-2",
             "createdAt": datetime(2025, 1, 5), "answers": {"other": "yes"}},
        ]
        entries = [
            {"_id": "a1", "source_type": "survey_response", "survey_id": "legacy-1",
             "question_id": "answer-a", "response_id": "r1", "source_id": "r1:answer-a",
             "analysis": {"sentiment": "negative"}, "metadata": {"question_id": "answer-a"}},
            {"_id": "a2", "source_type": "survey_response", "survey_id": "legacy-1",
             "question_id": "removed-key", "response_id": "r2", "source_id": "r2:removed-key"},
        ]
        return surveys, responses, entries

    def test_migration_preserves_answers_links_analytics_and_results(self):
        surveys, responses, entries = self.fixtures()
        before = build_question_results(surveys[0]["questions"][0], 0, responses)
        migrated = make_plan(surveys, responses, entries)
        new_surveys, new_responses, new_entries, next_survey = migrated
        self.assertEqual([s["id"] for s in new_surveys], ["SUR00007", "SUR00008"])
        self.assertEqual(next_survey, 9)
        self.assertEqual([q["id"] for q in new_surveys[0]["questions"]],
                         ["SUR00007-Q01", "SUR00007-Q02"])
        self.assertEqual(new_surveys[1]["questions"][0]["id"], "SUR00008-Q01")
        self.assertEqual(new_surveys[0]["archivedQuestions"],
                         [{"id": "SUR00007-Q03", "legacyKey": "removed-key"}])
        self.assertEqual(new_surveys[0]["surveyJson"]["pages"][0]["elements"],
                         [{"name": "SUR00007-Q01"}, {"name": "SUR00007-Q02"}])
        self.assertEqual(new_responses[0]["answers"],
                         {"SUR00007-Q01": "fever", "SUR00007-Q02": 4})
        self.assertEqual(new_responses[1]["answers"]["SUR00007-Q03"], "saved")
        self.assertEqual(new_responses[0]["answerIds"]["SUR00007-Q01"], "SUR00007-Q01-RES0001")
        self.assertEqual(new_responses[1]["answerIds"]["SUR00007-Q01"], "SUR00007-Q01-RES0002")
        self.assertEqual(new_responses[0]["answerIds"]["SUR00007-Q02"], "SUR00007-Q02-RES0001")
        self.assertEqual(new_responses[2]["answerIds"]["SUR00008-Q01"], "SUR00008-Q01-RES0001")
        self.assertEqual(new_responses[0]["submissionId"], "submission-1")
        self.assertEqual(new_entries[0]["response_id"], "SUR00007-Q01-RES0001")
        self.assertEqual(new_entries[0]["source_id"], new_entries[0]["response_id"])
        self.assertEqual(new_entries[0]["submission_id"], "submission-1")
        self.assertEqual(new_entries[0]["analysis"], {"sentiment": "negative"})
        self.assertEqual(new_entries[1]["question_id"], "SUR00007-Q03")
        after = build_question_results(new_surveys[0]["questions"][0], 0, new_responses)
        self.assertEqual((before["answeredResponses"], before["rows"]),
                         (after["answeredResponses"], after["rows"]))
        rerun = make_plan(*copy.deepcopy(migrated[:3]),
                          settings={"nextSentimentPulseSurveyDisplaySequence": next_survey})
        self.assertEqual(rerun, migrated)

    def test_preflight_rejects_unlinked_analytics(self):
        surveys, responses, entries = self.fixtures()
        entries[0]["response_id"] = "missing"
        with self.assertRaisesRegex(ValueError, "no matching saved answer"):
            make_plan(surveys, responses, entries)

    def test_historic_deleted_question_numbers_stay_consumed(self):
        surveys, _, _ = self.fixtures()
        surveys[0]["nextQuestionDisplaySequence"] = 12
        migrated, _, _, _ = make_plan(surveys, [], [])
        self.assertEqual([q["id"] for q in migrated[0]["questions"]],
                         ["SUR00007-Q12", "SUR00007-Q13"])
        self.assertEqual(migrated[0]["nextQuestionIdSequence"], 14)

    def test_database_dry_run_and_repeated_apply(self):
        import mongomock

        db = mongomock.MongoClient().test_survey_ids
        surveys, responses, entries = self.fixtures()
        db.surveys.insert_many(surveys)
        db.survey_responses.insert_many(responses)
        db.analytics_entries.insert_many(entries)
        report = run(db)
        self.assertEqual(report["answers"], 5)
        self.assertEqual(db.surveys.find_one({"_id": "s1"})["id"], "legacy-1")
        run(db, apply=True)
        first = (list(db.surveys.find()), list(db.survey_responses.find()),
                 list(db.analytics_entries.find()))
        run(db, apply=True)
        second = (list(db.surveys.find()), list(db.survey_responses.find()),
                  list(db.analytics_entries.find()))
        self.assertEqual(first, second)
        self.assertEqual(db.application_settings.find_one(
            {"_id": "sentiment_pulse_display_sequences"})[
                "nextSentimentPulseSurveyDisplaySequence"], 9)


if __name__ == "__main__":
    unittest.main()
