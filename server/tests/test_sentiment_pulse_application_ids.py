"""Contract tests for survey, question, and answer ID allocation."""

import copy
import sys
import threading
import types
import unittest
from datetime import datetime
from pathlib import Path


SERVER_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_ROOT))


def _matches(document, query):
    return all(document.get(key) == expected for key, expected in query.items())


class Cursor(list):
    def sort(self, fields):
        key, direction = fields[0]
        return Cursor(sorted(self, key=lambda item: item.get(key) or datetime.min, reverse=direction < 0))


class Collection:
    def __init__(self):
        self.documents = []
        self.lock = threading.Lock()

    def create_index(self, *args, **kwargs):
        return kwargs.get("name")

    def find(self, query, *args, **kwargs):
        with self.lock:
            return Cursor(copy.deepcopy([item for item in self.documents if _matches(item, query)]))

    def find_one(self, query, *args, **kwargs):
        with self.lock:
            document = next((item for item in self.documents if _matches(item, query)), None)
            return copy.deepcopy(document)

    @staticmethod
    def _apply_update(document, update, inserted=False):
        def target(field):
            parts = field.split(".")
            current = document
            for part in parts[:-1]:
                current = current.setdefault(part, {})
            return current, parts[-1]
        if inserted:
            document.update(copy.deepcopy(update.get("$setOnInsert", {})))
        for field, value in update.get("$set", {}).items():
            current, key = target(field)
            current[key] = copy.deepcopy(value)
        for field, value in update.get("$max", {}).items():
            current, key = target(field)
            current[key] = max(current.get(key, value), value)
        for field, value in update.get("$inc", {}).items():
            current, key = target(field)
            current[key] = current.get(key, 0) + value

    def update_one(self, query, update, upsert=False):
        with self.lock:
            document = next((item for item in self.documents if _matches(item, query)), None)
            inserted = False
            if document is None and upsert:
                document = {key: value for key, value in query.items()}
                self.documents.append(document)
                inserted = True
            if document is None:
                return types.SimpleNamespace(modified_count=0, matched_count=0)
            before = copy.deepcopy(document)
            self._apply_update(document, update, inserted)
            return types.SimpleNamespace(modified_count=int(before != document), matched_count=1)

    def find_one_and_update(self, query, update, **kwargs):
        with self.lock:
            document = next((item for item in self.documents if _matches(item, query)), None)
            if document is None:
                return None
            previous = copy.deepcopy(document)
            self._apply_update(document, update)
            return previous


fake_database = types.ModuleType("config.database")
fake_database.surveys_collection = Collection()
fake_database.survey_responses_collection = Collection()
fake_database.application_settings_collection = Collection()
fake_database.analytics_events_collection = Collection()
fake_database.mobile_users_collection = Collection()
sys.modules["config.database"] = fake_database

fake_fastapi = types.ModuleType("fastapi")
fake_fastapi.HTTPException = type("HTTPException", (Exception,), {})
fake_fastapi.status = types.SimpleNamespace(
    HTTP_400_BAD_REQUEST=400, HTTP_404_NOT_FOUND=404, HTTP_409_CONFLICT=409
)
sys.modules.setdefault("fastapi", fake_fastapi)

fake_pymongo = types.ModuleType("pymongo")
fake_pymongo.ReturnDocument = types.SimpleNamespace(BEFORE="before")
sys.modules.setdefault("pymongo", fake_pymongo)

from controllers.sentiment_pulse import survey_helpers as helpers  # noqa: E402


class Data:
    title = "Dengue prevention"
    subtitle = ""
    target = 100

    def __init__(self, questions, survey_json=None):
        self.questions = questions
        self.surveyJson = survey_json or {"pages": [{"elements": []}]}


class SentimentPulseApplicationIdTests(unittest.TestCase):
    def setUp(self):
        # Other test modules may install their own config/pymongo stubs during
        # unittest discovery; bind this fixture directly for either order.
        helpers.ReturnDocument = types.SimpleNamespace(BEFORE="before")
        helpers.surveys_collection = fake_database.surveys_collection
        helpers.survey_responses_collection = fake_database.survey_responses_collection
        helpers.application_settings_collection = fake_database.application_settings_collection
        helpers.mobile_users_collection = fake_database.mobile_users_collection
        for collection in (
            fake_database.surveys_collection,
            fake_database.survey_responses_collection,
            fake_database.application_settings_collection,
            fake_database.mobile_users_collection,
        ):
            with collection.lock:
                collection.documents.clear()

    def test_historic_display_numbers_are_reserved_for_migration(self):
        legacy = {
            "_id": "legacy-object-id", "id": "legacy-survey-uuid",
            "displayId": "SUR-00007", "displaySequence": 7,
            "questions": [{"id": "question-legacy", "displayId": "Q-SUR00007-01"}],
        }
        fake_database.surveys_collection.documents.append(legacy)

        helpers.ensure_survey_indexes()
        serialized = helpers.serialize_survey(legacy)

        self.assertEqual(legacy["id"], "legacy-survey-uuid")
        self.assertEqual(legacy["questions"][0]["id"], "question-legacy")
        self.assertNotIn("displayId", serialized)
        self.assertNotIn("displayId", serialized["questions"][0])
        self.assertEqual(helpers.allocate_survey_id_sequence(), 8)

    def test_new_survey_uses_actual_ids_and_surveyjs_names(self):
        document = helpers.build_survey_document(
            Data(
                [{"id": "browser-a"}, {"id": "browser-b"}],
                {"pages": [{"elements": [{"name": "browser-a"}, {"name": "browser-b"}]}]},
            ),
            None,
        )

        self.assertEqual(document["id"], "SUR00001")
        self.assertEqual([q["id"] for q in document["questions"]], ["SUR00001-Q01", "SUR00001-Q02"])
        self.assertEqual([q["name"] for q in document["questions"]], ["SUR00001-Q01", "SUR00001-Q02"])
        self.assertEqual(
            [element["name"] for element in document["surveyJson"]["pages"][0]["elements"]],
            ["SUR00001-Q01", "SUR00001-Q02"],
        )

    def test_new_format_question_ids_do_not_renumber_after_delete_or_reorder(self):
        survey = helpers.build_survey_document(Data([{"id": "a"}, {"id": "b"}, {"id": "c"}]), None)
        survey["_id"] = "new-survey"
        fake_database.surveys_collection.documents.append(survey)

        update = helpers.build_survey_update_document(
            Data([survey["questions"][2], survey["questions"][0], {"id": "browser-d"}]),
            None,
            copy.deepcopy(survey),
        )

        self.assertEqual([q["id"] for q in update["questions"]], ["SUR00001-Q03", "SUR00001-Q01", "SUR00001-Q04"])
        stored = fake_database.surveys_collection.find_one({"id": survey["id"]})
        self.assertEqual(stored["nextQuestionIdSequence"], 5)
        self.assertEqual(update["archivedQuestions"][0]["id"], "SUR00001-Q02")

    def test_question_suffix_expands_past_ninety_nine(self):
        document = helpers.build_survey_document(Data([{"id": f"browser-{i}"} for i in range(100)]), None)
        self.assertEqual(document["questions"][-1]["id"], "SUR00001-Q100")
        self.assertEqual(helpers.format_survey_id(100000), "SUR100000")
        self.assertEqual(helpers.format_answer_id("SUR00001-Q01", 10000), "SUR00001-Q01-RES10000")

    def test_authenticated_response_persists_verified_account_and_canonical_region(self):
        data = types.SimpleNamespace(
            answers={"SUR00001-Q01": "answer"},
            visitorId="not-an-account-id",
            region="III",
            metadata={},
        )
        account = {
            "id": "mu_verified",
            "regionCode": "130000000",
            "regionLabel": "National Capital Region",
        }
        survey = {"id": "SUR00001", "questions": [{"id": "SUR00001-Q01"}]}
        fake_database.surveys_collection.documents.append(survey)
        authenticated = helpers.build_public_response_document(survey, data, "website", account)
        anonymous = helpers.build_public_response_document(
            survey, data, "mobile"
        )

        self.assertEqual(authenticated["mobileUserId"], "mu_verified")
        self.assertTrue(authenticated["accountLinkVerified"])
        self.assertEqual(authenticated["region"], "NCR")
        self.assertNotIn("mobileUserId", anonymous)
        self.assertNotIn("accountLinkVerified", anonymous)
        self.assertEqual(anonymous["region"], "III")
        self.assertEqual(authenticated["answerIds"], {"SUR00001-Q01": "SUR00001-Q01-RES0001"})
        self.assertEqual(anonymous["answerIds"], {"SUR00001-Q01": "SUR00001-Q01-RES0002"})
        self.assertNotEqual(authenticated["submissionId"], anonymous["submissionId"])

    def test_concurrent_survey_reservations_are_unique_and_preserve_historic_counter(self):
        fake_database.application_settings_collection.documents.append(
            {"_id": helpers.APPLICATION_ID_SEQUENCE_SETTINGS_ID, helpers.APPLICATION_ID_SEQUENCE_FIELD: 25}
        )
        values = []
        lock = threading.Lock()

        def reserve():
            value = helpers.allocate_survey_id_sequence()
            with lock:
                values.append(value)

        threads = [threading.Thread(target=reserve) for _ in range(12)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertEqual(sorted(values), list(range(25, 37)))

    def test_concurrent_question_reservations_are_unique(self):
        survey = {"id": "SUR00001", "questions": [{"id": "SUR00001-Q01"}], "nextQuestionIdSequence": 2}
        fake_database.surveys_collection.documents.append(survey)
        values = []
        lock = threading.Lock()

        def reserve():
            value = helpers.allocate_question_id_sequences(copy.deepcopy(survey), 1)
            with lock:
                values.append(value)

        threads = [threading.Thread(target=reserve) for _ in range(12)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertEqual(sorted(values), list(range(2, 14)))

    def test_answer_numbers_restart_per_question_and_allocate_concurrently(self):
        survey = {"id": "SUR00001", "questions": [{"id": "SUR00001-Q01"}, {"id": "SUR00001-Q02"}]}
        fake_database.surveys_collection.documents.append(survey)
        values = []
        lock = threading.Lock()

        def reserve():
            data = types.SimpleNamespace(answers={"SUR00001-Q01": "a", "SUR00001-Q02": "b"},
                                         visitorId="", region="", metadata={})
            result = helpers.build_public_response_document(survey, data, "website")
            with lock:
                values.append(result["answerIds"])

        threads = [threading.Thread(target=reserve) for _ in range(12)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        for question_id in ("SUR00001-Q01", "SUR00001-Q02"):
            self.assertEqual(sorted(value[question_id] for value in values),
                             [helpers.format_answer_id(question_id, number) for number in range(1, 13)])


if __name__ == "__main__":
    unittest.main()
