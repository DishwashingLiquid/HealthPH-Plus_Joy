"""Regression coverage for PyMongo collection availability checks."""

import asyncio
import os
import sys
import types
import unittest
from datetime import datetime
from pathlib import Path
from typing import Annotated
from unittest.mock import patch


SERVER_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_ROOT))
os.environ.setdefault("SECRET_KEY", "regional-alert-test-secret")
os.environ.setdefault("ALGORITHM", "HS256")


class ObjectId:
    def __init__(self, value=None):
        self.value = str(value or "test-object-id")

    def __str__(self):
        return self.value

    @staticmethod
    def is_valid(value):
        return isinstance(value, str) and bool(value)


class HTTPException(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code
        self.detail = detail


class JSONResponse:
    def __init__(self, status_code, content):
        self.status_code = status_code
        self.content = content


class BaseModel:
    pass


def Depends(dependency):
    return dependency


def field_validator(*fields):
    def decorator(method):
        return method

    return decorator


class DuplicateKeyError(Exception):
    pass


fake_bson = types.ModuleType("bson")
fake_bson.ObjectId = ObjectId
sys.modules["bson"] = fake_bson

fake_fastapi = types.ModuleType("fastapi")
fake_fastapi.Depends = Depends
fake_fastapi.HTTPException = HTTPException
fake_fastapi.status = types.SimpleNamespace()
sys.modules["fastapi"] = fake_fastapi
fake_fastapi_responses = types.ModuleType("fastapi.responses")
fake_fastapi_responses.JSONResponse = JSONResponse
sys.modules["fastapi.responses"] = fake_fastapi_responses

fake_pydantic = types.ModuleType("pydantic")
fake_pydantic.BaseModel = BaseModel
fake_pydantic.field_validator = field_validator
sys.modules["pydantic"] = fake_pydantic

fake_pymongo = types.ModuleType("pymongo")
fake_pymongo.ReturnDocument = types.SimpleNamespace(AFTER="after")
sys.modules["pymongo"] = fake_pymongo
fake_pymongo_errors = types.ModuleType("pymongo.errors")
fake_pymongo_errors.DuplicateKeyError = DuplicateKeyError
sys.modules["pymongo.errors"] = fake_pymongo_errors

fake_typing_extensions = types.ModuleType("typing_extensions")
fake_typing_extensions.Annotated = Annotated
sys.modules["typing_extensions"] = fake_typing_extensions

fake_helpers = types.ModuleType("helpers")
fake_helpers.__path__ = []
sys.modules["helpers"] = fake_helpers
fake_misc_helpers = types.ModuleType("helpers.miscHelpers")
fake_misc_helpers.get_ph_datetime = datetime.now
sys.modules["helpers.miscHelpers"] = fake_misc_helpers

fake_middleware = types.ModuleType("middleware")
fake_middleware.__path__ = []
sys.modules["middleware"] = fake_middleware
fake_require_auth = types.ModuleType("middleware.requireAuth")


async def require_auth():
    return None


fake_require_auth.require_auth = require_auth
sys.modules["middleware.requireAuth"] = fake_require_auth


class FakeCursor(list):
    def sort(self, *args, **kwargs):
        return self


class TruthinessForbiddenCollection:
    """Behaves like PyMongo Collection for the one behavior under test."""

    def __init__(self, find_one_result=None):
        self.bool_checks = 0
        self.find_one_result = find_one_result
        self.indexes = []

    def __bool__(self):
        self.bool_checks += 1
        raise AssertionError("Collection truth-value evaluation is not allowed")

    def create_index(self, *args, **kwargs):
        self.indexes.append((args, kwargs))

    def find_one(self, *args, **kwargs):
        return self.find_one_result

    def find(self, *args, **kwargs):
        return FakeCursor()


fake_database = types.ModuleType("config.database")
sys.modules["config.database"] = fake_database
sys.modules.pop("controllers.regionalAlertsController", None)

from controllers import regionalAlertsController as controller  # noqa: E402


class RegionalAlertCollectionGuardTests(unittest.TestCase):
    def test_collection_guards_never_evaluate_collection_truthiness(self):
        user_id = ObjectId()
        collections = {
            "summaries": TruthinessForbiddenCollection(),
            "summary_events": TruthinessForbiddenCollection(),
            "alerts": TruthinessForbiddenCollection(),
            "deliveries": TruthinessForbiddenCollection(),
            "mobile_users": TruthinessForbiddenCollection(),
            "users": TruthinessForbiddenCollection(
                {"_id": user_id, "user_type": "USER", "role_label": "ADMIN"}
            ),
            "self_reports": TruthinessForbiddenCollection(),
            "settings": TruthinessForbiddenCollection({"_id": "regional_symptom_summary_backfill_v1"}),
        }

        with patch.multiple(controller, **collections):
            self.assertFalse(controller._collections_available(collections["summaries"], None))
            controller.ensure_regional_alert_indexes()
            controller.update_regional_summary_for_report({"location": {"regionCode": "invalid"}})
            self.assertEqual(controller.process_due_regional_alerts(), 0)
            asyncio.run(controller.require_regional_alert_user(str(user_id)))
            index_counts = {name: len(collection.indexes) for name, collection in collections.items()}
            asyncio.run(controller.fetch_regional_summaries({}))
            asyncio.run(controller.fetch_regional_alerts({}))
            self.assertEqual(index_counts, {name: len(collection.indexes) for name, collection in collections.items()})

        self.assertTrue(all(collection.bool_checks == 0 for collection in collections.values()))


if __name__ == "__main__":
    unittest.main()
