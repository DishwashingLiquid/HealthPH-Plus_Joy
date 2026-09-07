"""Contract tests for Sentiment Pulse's display-only identifier flow."""

import copy
import sys
import types
import unittest
from datetime import datetime
from pathlib import Path


SERVER_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_ROOT))


def _matches(document, query):
    for key, expected in query.items():
        actual = document.get(key)
        if isinstance(expected, dict) and "$exists" in expected:
            if (key in document) != expected["$exists"]:
                return False
        elif actual != expected:
            return False
    return True


class Cursor(list):
    def sort(self, fields):
        key, direction = fields[0]
        return Cursor(sorted(self, key=lambda item: item.get(key) or datetime.min, reverse=direction < 0))


class Collection:
    def __init__(self):
        self.documents = []

    def create_index(self, *args, **kwargs):
        return kwargs.get("name")

    def find(self, query, *args, **kwargs):
        return Cursor([item for item in self.documents if _matches(item, query)])

    def find_one(self, query, *args, **kwargs):
        return next((item for item in self.documents if _matches(item, query)), None)

    def _apply_update(self, document, update, inserted=False):
        if inserted:
            document.update(copy.deepcopy(update.get("$setOnInsert", {})))
        for field, value in update.get("$set", {}).items():
            document[field] = copy.deepcopy(value)
        for field, value in update.get("$max", {}).items():
            document[field] = max(document.get(field, value), value)
        for field, value in update.get("$inc", {}).items():
            document[field] = document.get(field, 0) + value

    def update_one(self, query, update, upsert=False):
        document = self.find_one(query)
        inserted = False
        if document is None and upsert:
            document = {key: value for key, value in query.items() if not isinstance(value, dict)}
            self.documents.append(document)
            inserted = True
        if document is None:
            return types.SimpleNamespace(modified_count=0)
        before = copy.deepcopy(document)
        self._apply_update(document, update, inserted)
        return types.SimpleNamespace(modified_count=int(before != document))

    def find_one_and_update(self, query, update, upsert=False, **kwargs):
        document = self.find_one(query)
        previous = copy.deepcopy(document) if document else None
        self.update_one(query, update, upsert=upsert)
        return previous


fake_database = types.ModuleType("config.database")
fake_database.surveys_collection = Collection()
fake_database.survey_responses_collection = Collection()
fake_database.application_settings_collection = Collection()
fake_database.analytics_events_collection = Collection()
sys.modules["config.database"] = fake_database

# Keep these focused helper tests executable without the project's optional
# web/database packages installed in the local interpreter.
fake_fastapi = types.ModuleType("fastapi")
fake_fastapi.HTTPException = type("HTTPException", (Exception,), {})
fake_fastapi.status = types.SimpleNamespace()
sys.modules.setdefault("fastapi", fake_fastapi)

fake_pymongo = types.ModuleType("pymongo")
fake_pymongo.ReturnDocument = types.SimpleNamespace(BEFORE="before")
sys.modules.setdefault("pymongo", fake_pymongo)

from controllers.sentiment_pulse import survey_helpers as helpers  # noqa: E402


class Data:
    title = "Dengue prevention"
    subtitle = ""
    target = 100
    surveyJson = {"pages": []}

    def __init__(self, questions):
        self.questions = questions


class SentimentPulseDisplayIdTests(unittest.TestCase):
    def setUp(self):
        for collection in (
            fake_database.surveys_collection,
            fake_database.survey_responses_collection,
            fake_database.application_settings_collection,
        ):
            collection.documents.clear()

    def test_backfill_preserves_existing_ids_and_reserves_future_sequences(self):
        legacy = {
            "_id": "legacy-object-id",
            "id": "legacy-survey-uuid",
            "createdAt": datetime(2026, 1, 1),
            "questions": [{"id": "legacy-question-a"}, {"id": "legacy-question-b"}],
        }
        fake_database.surveys_collection.documents.append(legacy)

        helpers.ensure_survey_indexes()

        self.assertEqual(legacy["id"], "legacy-survey-uuid")
        self.assertEqual(legacy["displayId"], "SUR-00001")
        self.assertEqual(
            [question["id"] for question in legacy["questions"]],
            ["legacy-question-a", "legacy-question-b"],
        )
        self.assertEqual(
            [question["displayId"] for question in legacy["questions"]],
            ["Q-SUR00001-01", "Q-SUR00001-02"],
        )
        self.assertEqual([question["position"] for question in legacy["questions"]], [1, 2])

        created = helpers.build_survey_document(
            Data([{"id": "new-question"}]), None
        )
        self.assertEqual(created["displayId"], "SUR-00002")
        self.assertEqual(created["questions"][0]["displayId"], "Q-SUR00002-01")

    def test_question_identity_does_not_change_when_reordered_or_deleted(self):
        helpers.initialize_display_sequence_settings()
        survey = helpers.build_survey_document(
            Data([{"id": "question-a"}, {"id": "question-b"}]), None
        )
        survey["_id"] = "survey-object-id"
        fake_database.surveys_collection.documents.append(survey)

        update = helpers.build_survey_update_document(
            Data([{"id": "question-b"}, {"id": "question-a"}, {"id": "question-c"}]),
            None,
            survey,
        )
        questions = update["questions"]
        self.assertEqual(
            [question["displayId"] for question in questions],
            ["Q-SUR00001-02", "Q-SUR00001-01", "Q-SUR00001-03"],
        )
        self.assertEqual([question["position"] for question in questions], [1, 2, 3])
        self.assertEqual(survey["nextQuestionDisplaySequence"], 4)


if __name__ == "__main__":
    unittest.main()
