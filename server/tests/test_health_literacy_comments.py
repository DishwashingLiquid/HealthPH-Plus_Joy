"""Real HTTP contracts with isolated MongoDB doubles; never imports the live DB.

Run this file separately, as with the existing media/auth suites.
"""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import importlib
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

import mongomock
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class CommentTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"SECRET_KEY": "isolated-comment-tests", "ALGORITHM": "HS256",
            "MOBILE_MIGRATE_PBKDF2_TO_BCRYPT": "true"})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.db = mongomock.MongoClient().isolated_comments
        database = types.ModuleType("config.database")
        database.db = self.db
        for field, name in (("mobile_users", "mobile_users"), ("content", "content"), ("user", "users"), ("analytics_events", "analytics_events")):
            setattr(database, f"{field}_collection", self.db[name])
        self.modules = patch.dict(sys.modules, {"config.database": database})
        self.modules.start()
        self.addCleanup(self.modules.stop)
        for name in list(sys.modules):
            if (name.startswith("controllers.health_literacy_hub.") or name in {
                "controllers.health_literacy_comments", "controllers.mobileUserController", "middleware.requireRole", "middleware.requireAuth"}):
                del sys.modules[name]
        with patch("pymongo.MongoClient", side_effect=AssertionError("Live DB access forbidden")):
            self.mod = importlib.import_module("controllers.health_literacy_comments")
            self.mobile = importlib.import_module("controllers.mobileUserController")
        self.app = FastAPI()
        self.app.include_router(self.mod.router, prefix="/api/health-literacy-hub")
        self.client = TestClient(self.app)
        self.path = "/api/health-literacy-hub/comments"
        self.account = {"id": "mu_existing", "email": "reader@example.test", "fullName": "Private Name",
            "passwordHash": self.mobile._hash_pbkdf2_secret("ExistingPassword1"), "source": "mobile_registration",
            "roleId": "user", "roleLabel": "User", "regionCode": "PH-00", "pins": "private-pin"}
        self.db.mobile_users.insert_one(deepcopy(self.account))
        self.admin_id = ObjectId()
        self.db.users.insert_one({"_id": self.admin_id, "user_type": "Admin"})
        self.db.content.insert_one({"id": "immutable-content", "contentType": "video", "publishToWebsite": True})
        self.resource = {"contentId": "immutable-content", "contentType": "videos", "contentOrigin": "api"}
        self.token = self.make_token()
        self.auth = {"Authorization": f"Bearer {self.token}"}
        self.admin = {"Authorization": "Bearer " + jwt.encode({"sub": str(self.admin_id)}, os.environ["SECRET_KEY"], algorithm="HS256")}

    def make_token(self, **overrides):
        return jwt.encode({"sub": "mu_existing", "aud": "health_literacy_comments", "typ": "public_comment_access",
            "iat": datetime.now(timezone.utc), "exp": datetime.now(timezone.utc) + timedelta(hours=1), **overrides},
            os.environ["SECRET_KEY"], algorithm="HS256")

    def post(self, **overrides):
        return self.client.post(self.path, json={**self.resource, "body": "A plain text comment", **overrides}, headers=self.auth)

    def approve(self, identifier):
        return self.client.patch(f"{self.path}/moderation/{identifier}", json={"status": "approved"}, headers=self.admin)

    def test_login_reuses_hash_verifier_without_writing_user_or_dashboard_session(self):
        before = list(self.db.mobile_users.find())
        content = list(self.db.content.find())
        result = self.client.post(f"{self.path}/session", json={"email": "reader@example.test", "password": "ExistingPassword1"})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertNotIn("set-cookie", result.headers)
        self.assertEqual(result.headers["cache-control"], "no-store")
        data = result.json()
        self.assertEqual(set(data), {"access_token", "expires_in", "userId"})
        claims = jwt.decode(data["access_token"], os.environ["SECRET_KEY"], algorithms=["HS256"], audience="health_literacy_comments")
        self.assertEqual(claims["typ"], "public_comment_access")
        self.assertEqual(before, list(self.db.mobile_users.find()))
        self.assertEqual(content, list(self.db.content.find()))
        for payload in ({"email": "reader@example.test", "password": "wrong"}, {"email": "missing@example.test", "password": "wrong"}):
            self.assertEqual(self.client.post(f"{self.path}/session", json=payload).status_code, 401)

    def test_pending_visibility_identity_and_owner_delete(self):
        before = list(self.db.mobile_users.find())
        content = list(self.db.content.find())
        result = self.post()
        self.assertEqual(result.status_code, 201, result.text)
        self.assertEqual(result.json()["status"], "pending")
        identifier = result.json()["id"]
        self.assertEqual(self.client.get(self.path, params=self.resource).json()["items"], [])
        own = self.client.get(f"{self.path}/mine", params=self.resource, headers=self.auth).json()["items"]
        self.assertEqual(own[0]["id"], identifier)
        self.assertEqual(self.approve(identifier).status_code, 200)
        public = self.client.get(self.path, params=self.resource).json()["items"][0]
        self.assertEqual(set(public), {"id", "body", "author", "createdAt"})
        self.assertEqual(public["author"], "Community member")
        stored = self.db.health_literacy_comments.find_one({"_id": ObjectId(identifier)})
        self.assertEqual(stored["userId"], "mu_existing")
        self.assertEqual(self.client.delete(f"{self.path}/{identifier}", headers=self.auth).status_code, 200)
        self.assertEqual(self.client.get(self.path, params=self.resource).json()["items"], [])
        self.assertEqual(before, list(self.db.mobile_users.find()))
        self.assertEqual(content, list(self.db.content.find()))
        self.assertEqual(set(self.db.list_collection_names()), {"mobile_users", "users", "content", "health_literacy_comments"})

    def test_forged_identity_ownership_and_removed_accounts(self):
        self.assertEqual(self.post(userId="other", email="forged@example.test").status_code, 422)
        self.assertEqual(self.post(parentId="other-resource").status_code, 422)  # Flat discussions only.
        identifier = self.post().json()["id"]
        self.db.mobile_users.insert_one({**self.account, "id": "mu_other", "email": "other@example.test"})
        other = {"Authorization": "Bearer " + self.make_token(sub="mu_other")}
        self.assertEqual(self.client.delete(f"{self.path}/{identifier}", headers=other).status_code, 403)
        self.approve(identifier)
        self.db.mobile_users.delete_one({"id": "mu_existing"})
        self.assertEqual(self.post().status_code, 401)
        self.assertEqual(self.client.get(self.path, params=self.resource).json()["items"][0]["author"], "Removed account")

    def test_signature_expiry_type_audience_claims_and_session_separation(self):
        tokens = ["invalid", self.make_token(exp=1), self.make_token(aud="mobile"),
            self.make_token(typ="mobile_access"), self.make_token(sub="missing"), self.make_token(sub=42),
            jwt.encode({"sub": "mu_existing", "aud": "health_literacy_comments", "typ": "public_comment_access"}, os.environ["SECRET_KEY"], algorithm="HS256"),
            self.admin["Authorization"].split()[1], self.mobile.create_mobile_access_token("mu_existing"),
            jwt.encode({"sub": "mu_existing", "exp": 9999999999}, "wrong-secret", algorithm="HS256")]
        for token in tokens:
            with self.subTest(token=token[:12]):
                self.auth = {"Authorization": f"Bearer {token}"}
                self.assertEqual(self.post().status_code, 401)
        self.assertEqual(self.client.post(self.path, json={**self.resource, "body": "test"}).status_code, 401)
        self.assertEqual(self.client.get(f"{self.path}/moderation/queue", headers={"Authorization": f"Bearer {self.token}"}).status_code, 401)
        self.assertEqual(self.client.get(f"{self.path}/moderation/queue").status_code, 401)

    def test_current_account_eligibility_ignores_forged_role_and_region_claims(self):
        self.auth = {"Authorization": "Bearer " + self.make_token(roleId="SUPERADMIN", regionCode="made-up")}
        self.assertEqual(self.post().status_code, 201)
        self.db.mobile_users.update_one({"id": "mu_existing"}, {"$set": {"roleId": "admin"}})
        self.assertEqual(self.post().status_code, 401)
        self.db.mobile_users.update_one({"id": "mu_existing"}, {"$set": {"roleId": "user", "source": "other"}})
        self.assertEqual(self.post().status_code, 401)

    def test_publication_checks_static_mapping_and_unpublish_delete(self):
        self.assertEqual(self.client.get(self.path, params={**self.resource, "contentId": ""}).status_code, 422)
        identifier = self.post().json()["id"]
        for fields in ({"publishToWebsite": False}, {"publishToWebsite": True, "isPublished": False},
                       {"isPublished": True, "isArchived": True}):
            self.db.content.update_one({}, {"$set": fields})
            self.assertEqual(self.post().status_code, 404)
            self.assertEqual(self.client.get(self.path, params=self.resource).status_code, 404)
            self.assertEqual(self.approve(identifier).status_code, 404)
        self.assertEqual(self.client.delete(f"{self.path}/{identifier}", headers=self.auth).status_code, 200)
        self.assertEqual(self.post(contentOrigin="static", contentType="articles", contentId="1").status_code, 201)
        for content_id in ("10", "99", "unknown-title"):
            self.assertEqual(self.post(contentOrigin="static", contentType="articles", contentId=content_id).status_code, 404)
        self.assertEqual(self.post(contentOrigin="static", contentType="videos", contentId="1").status_code, 404)
        static = __import__("json").loads((Path(__file__).resolve().parents[2] / "client/src/assets/data/articles.json").read_text(encoding="utf-8"))
        self.assertEqual(self.mod.STATIC_ARTICLE_IDS, {str(a["articleID"]) for a in static if a["articleTitle"]})

    def test_cursor_ties_moderation_reports_limits_and_plain_text(self):
        ids = [self.post(body=f"Comment {i}").json()["id"] for i in range(5)]
        self.assertEqual(self.post().status_code, 429)
        stamp = datetime(2026, 1, 1, tzinfo=timezone.utc)
        self.db.health_literacy_comments.update_many({"recordType": "comment"}, {"$set": {"createdAt": stamp}})
        for identifier in ids:
            self.assertEqual(self.approve(identifier).status_code, 200)
        found = []
        cursor = None
        while True:
            response = self.client.get(self.path, params={**self.resource, "limit": 2, **({"cursor": cursor} if cursor else {})})
            self.assertEqual(response.status_code, 200, response.text)
            result = response.json()
            found += [item["id"] for item in result["items"]]
            cursor = result["nextCursor"]
            if not cursor:
                break
        self.assertEqual(found, sorted(ids, reverse=True))
        self.assertEqual(len(found), len(set(found)))
        self.assertEqual(self.client.get(self.path, params={**self.resource, "cursor": "garbage"}).status_code, 400)
        identifier = ids[0]
        for _ in range(2):
            self.assertEqual(self.client.post(f"{self.path}/{identifier}/report", headers=self.auth).status_code, 200)
        self.assertEqual(self.db.health_literacy_comments.count_documents({"recordType": "report"}), 1)
        approved = self.client.get(f"{self.path}/moderation/queue", params={"status": "approved"}, headers=self.admin)
        self.assertEqual(sum(item["reportCount"] for item in approved.json()["items"]), 1)
        self.assertEqual(self.client.patch(f"{self.path}/moderation/{identifier}", json={"status": "hidden"}, headers=self.admin).status_code, 200)
        self.assertEqual(len(self.client.get(self.path, params=self.resource).json()["items"]), 4)
        self.assertEqual(self.client.post(f"{self.path}/{identifier}/report", headers=self.auth).status_code, 404)
        self.client.delete(f"{self.path}/{identifier}", headers=self.auth)
        self.assertEqual(self.approve(identifier).status_code, 409)
        for body in (" ", "a" * 2001, "bad\x00text"):
            self.assertEqual(self.post(body=body).status_code, 422)


if __name__ == "__main__":
    unittest.main()
