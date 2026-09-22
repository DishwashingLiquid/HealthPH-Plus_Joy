"""Focused, dependency-light coverage for the shared mobile auth contract."""

import asyncio
import json
import os
import sys
import types
import unittest
from pathlib import Path

from fastapi import HTTPException


SERVER_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_ROOT))
os.environ.setdefault("SECRET_KEY", "mobile-user-contract-test-secret")
os.environ.setdefault("ALGORITHM", "HS256")


class Collection:
    def __init__(self):
        self.documents = []

    def find_one(self, query, *args, **kwargs):
        return next(
            (document for document in self.documents if all(document.get(key) == value for key, value in query.items())),
            None,
        )

    def update_one(self, query, update, *args, **kwargs):
        document = self.find_one(query)
        if not document:
            return types.SimpleNamespace(matched_count=0, modified_count=0)
        document.update(update.get("$set", {}))
        return types.SimpleNamespace(matched_count=1, modified_count=1)


database = types.ModuleType("config.database")
database.mobile_users_collection = Collection()
sys.modules["config.database"] = database

from controllers import mobileUserController as mobile  # noqa: E402
from models.mobileUser import MobileLoginRequest, MobileUserPinUpdate, MobileUserPinVerify  # noqa: E402


class MobileUserAuthContractTests(unittest.TestCase):
    def setUp(self):
        database.mobile_users_collection.documents.clear()

    def test_legacy_pbkdf2_login_returns_the_mobile_jwt_contract(self):
        legacy_hash = mobile._hash_pbkdf2_secret("AsecurePassword1")
        database.mobile_users_collection.documents.append({
            "_id": "legacy-document", "id": "mu_legacy", "email": "legacy@example.com",
            "passwordHash": legacy_hash, "source": "mobile_registration", "roleId": "user",
        })

        response = asyncio.run(mobile.login_mobile_user(
            MobileLoginRequest(email="legacy@example.com", password="AsecurePassword1")
        ))
        body = json.loads(response.body)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["token_type"], "bearer")
        self.assertTrue(body["access_token"])
        self.assertEqual(body["user"]["id"], "mu_legacy")
        self.assertEqual(database.mobile_users_collection.documents[0]["passwordHash"], legacy_hash)

    def test_pin_is_hashed_and_can_only_be_verified_by_its_jwt_subject(self):
        user = {
            "_id": "pin-document", "id": "mu_pin", "email": "pin@example.com",
            "source": "mobile_registration", "roleId": "user",
        }
        database.mobile_users_collection.documents.append(user)

        response = asyncio.run(mobile.update_mobile_user_pin(
            "mu_pin", MobileUserPinUpdate(pin="123456"), {"sub": "mu_pin"}
        ))
        self.assertEqual(response.status_code, 200)
        self.assertIn(":", user["pins"])
        self.assertNotIn("123456", user["pins"])

        verified = asyncio.run(mobile.verify_mobile_user_pin(
            "mu_pin", MobileUserPinVerify(pin="123456"), {"sub": "mu_pin"}
        ))
        self.assertEqual(json.loads(verified.body), {"verified": True})

        with self.assertRaises(HTTPException) as other_user:
            asyncio.run(mobile.verify_mobile_user_pin(
                "mu_pin", MobileUserPinVerify(pin="123456"), {"sub": "mu_other"}
            ))
        self.assertEqual(other_user.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
