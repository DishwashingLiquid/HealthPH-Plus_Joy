"""Controlled in-memory GridFS + real FastAPI routes; never import the live DB module.

Run separately: python -m unittest discover -s server/tests -p test_health_literacy_media.py -v
"""
import base64
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import importlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import mongomock
from mongomock.gridfs import enable_gridfs_integration
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
enable_gridfs_integration()

from health_literacy_media import MediaStore, media_url, preview_url, BUCKET_NAME
from scripts.migrate_health_literacy_media import migrate, rollback

PNG = b"\x89PNG\r\n\x1a\n" + b"fixture" * 300
VIDEO = b"\x00\x00\x00\x18ftypmp42" + bytes(range(256)) * 3000


class HubMediaTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"PUBLIC_API_BASE_URL": "https://api.example.test/api",
            "SECRET_KEY": "isolated-hub-test-secret", "ALGORITHM": "HS256",
            "HEALTH_LITERACY_GRIDFS_BUCKET": BUCKET_NAME, "APP_ENV": "test", "RENDER": "",
            "HEALTH_LITERACY_ALLOW_HTTP": "false"})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.db = mongomock.MongoClient().isolated_hub_test
        # mongomock has no replica sets and cannot implement database write concern.
        # Keep the production primary/majority options, adapting only this test double.
        options = patch.object(self.db, "with_options", return_value=self.db)
        self.db_options = options.start()
        self.addCleanup(options.stop)
        database = types.ModuleType("config.database")
        database.db = self.db
        for name in ("content", "user", "analytics_events"):
            setattr(database, f"{name}_collection", self.db["users" if name == "user" else name])
        self.modules = patch.dict(sys.modules, {"config.database": database})
        self.modules.start()
        self.addCleanup(self.modules.stop)
        for name in list(sys.modules):
            if (name.startswith("controllers.health_literacy_hub.") or
                name in {"controllers.healthLiteracyHubController", "routes.healthLiteracyHubRoutes",
                         "middleware.requireRole"}):
                del sys.modules[name]
        # Assert that importing routes cannot reach an actual MongoDB server.
        with patch("pymongo.MongoClient", side_effect=AssertionError("Network DB forbidden in tests")):
            routes = importlib.import_module("routes.healthLiteracyHubRoutes")
        self.controller = importlib.import_module("controllers.healthLiteracyHubController")
        self.bridge = importlib.import_module("controllers.health_literacy_hub.content_bridge")
        self.app = FastAPI()
        self.app.include_router(routes.router, prefix="/api/health-literacy-hub")
        self.app.include_router(routes.mobile_contract_router, prefix="/api/health-literacy")
        self.client = TestClient(self.app)
        self.admin_id = ObjectId()
        self.db.users.insert_one({"_id": self.admin_id, "user_type": "Admin", "first_name": "Test"})
        token = jwt.encode({"sub": str(self.admin_id)}, os.environ["SECRET_KEY"], algorithm="HS256")
        self.auth = {"Authorization": f"Bearer {token}"}
        self.store = MediaStore(self.db)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.journal = self.root / "rollback.jsonl"

    def create(self, *, kind="infographics", data=None, binary=PNG, mime="image/png", auth=True):
        return self.client.post(f"/api/health-literacy-hub/{kind}",
            data={"title": "Guide", "description": "Health guide", "language": "en", **(data or {})},
            files={"file": ("guide.png", binary, mime)}, headers=self.auth if auth else {})

    def media_path(self, content):
        return urlsplit(content["media"]["url"]).path

    def update(self, content, *, files=None, data=None):
        return self.client.put(f"/api/health-literacy-hub/infographics/{content['id']}",
            data={"title": "Updated", "description": "Updated guide", "language": "en", **(data or {})},
            files=files, headers=self.auth)

    def test_upload_metadata_and_admin_preview_are_separate_from_stored_document(self):
        response = self.create()
        self.assertEqual(response.status_code, 201, response.text)
        item = response.json()["content"]
        media = item["media"]
        self.assertTrue(media["url"].startswith("https://api.example.test/api/"))
        self.assertIn("preview=", media["previewUrl"])
        stored = self.db.content.find_one({})
        self.assertEqual(set(stored["media"]), {"fileId", "filename", "size", "contentType", "sha256"})
        self.assertEqual(stored["media"]["size"], len(PNG))
        self.store.verify(stored["media"])
        self.assertEqual(self.store.files.count_documents({}), 1)
        self.assertGreater(self.store.chunks.count_documents({}), 0)
        preview = self.client.get(media["previewUrl"])
        self.assertEqual(preview.content, PNG)
        self.assertEqual(preview.headers["cache-control"], "private, no-store")

    def test_upload_requires_admin_and_valid_fields_before_storage(self):
        self.assertEqual(self.create(auth=False).status_code, 401)
        self.assertEqual(self.create(data={"language": "unsupported"}).status_code, 400)
        self.assertEqual(self.create(data={"isFactCheck": "true", "claim": ""}).status_code, 400)
        self.assertEqual(self.create(data={"imageUrl": "http://localhost:8000/a"}).status_code, 400)
        self.assertEqual(self.store.files.count_documents({}), 0)

    def test_mime_signature_empty_and_size_validation_cleans_up_chunks(self):
        for mime, binary in [("image/svg+xml", b"<svg/>"), ("image/png", b"not png"), ("image/png", b"")]:
            self.assertEqual(self.create(mime=mime, binary=binary).status_code, 400)
        self.assertEqual(self.create(kind="videos").status_code, 400)
        with patch("health_literacy_media.IMAGE_LIMIT", 20):
            self.assertEqual(self.create().status_code, 413)
        self.assertEqual(self.store.files.count_documents({}), 0)
        self.assertEqual(self.store.chunks.count_documents({}), 0)

    def test_public_access_obeys_draft_archive_unpublish_and_missing_reference(self):
        item = self.create().json()["content"]
        path = self.media_path(item)
        self.assertEqual(self.client.get(path).status_code, 404)
        self.db.content.update_one({}, {"$set": {"publishToMobile": True, "isPublished": True}})
        response = self.client.get(path)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, PNG)
        self.assertEqual(response.headers["content-type"], "image/png")
        self.assertIn("must-revalidate", response.headers["cache-control"])
        self.assertEqual(self.client.get(path, headers={"If-None-Match": response.headers["etag"]}).status_code, 304)
        for fields in ({"isArchived": True}, {"isArchived": False, "isPublished": False},
                       {"isPublished": True, "publishToMobile": False}):
            self.db.content.update_one({}, {"$set": fields})
            self.assertEqual(self.client.get(path, headers={"If-None-Match": response.headers["etag"]}).status_code, 404)
        self.db.content.delete_many({})
        self.assertEqual(self.client.get(item["media"]["previewUrl"]).status_code, 404)
        self.assertEqual(self.client.get("/api/health-literacy-hub/media/not-an-id").status_code, 404)

    def test_preview_is_scoped_expiring_and_checks_current_admin_role(self):
        first = self.create().json()["content"]
        second = self.create().json()["content"]
        token = parse_qs(urlsplit(first["media"]["previewUrl"]).query)["preview"][0]
        self.assertEqual(self.client.get(self.media_path(second), params={"preview": token}).status_code, 404)
        payload = jwt.get_unverified_claims(token)
        payload["exp"] = 1
        expired = jwt.encode(payload, os.environ["SECRET_KEY"], algorithm="HS256")
        self.assertEqual(self.client.get(self.media_path(first), params={"preview": expired}).status_code, 404)
        self.db.users.update_one({}, {"$set": {"user_type": "USER"}})
        self.assertEqual(self.client.get(first["media"]["previewUrl"]).status_code, 404)

    def test_video_ranges_suffix_open_ended_head_etag_and_invalid_ranges(self):
        item = self.create(kind="videos", mime="video/mp4", binary=VIDEO,
                           data={"publishToWebsite": "true"}).json()["content"]
        path = self.media_path(item)
        for value, expected in [("bytes=2-9", VIDEO[2:10]), ("bytes=-15", VIDEO[-15:]),
                                ("bytes=767990-", VIDEO[767990:]), ("bytes=0-9999999", VIDEO)]:
            response = self.client.get(path, headers={"Range": value})
            self.assertEqual(response.status_code, 206, response.text[:100])
            self.assertEqual(response.content, expected)
            self.assertEqual(int(response.headers["content-length"]), len(expected))
            self.assertIn(f"/{len(VIDEO)}", response.headers["content-range"])
        for value in ("bytes=9-1", "bytes=-0", "bytes=9999999-", "bytes=1-2,4-5", "garbage"):
            response = self.client.get(path, headers={"Range": value})
            self.assertEqual(response.status_code, 416)
            self.assertEqual(response.headers["content-range"], f"bytes */{len(VIDEO)}")
        head = self.client.head(path)
        self.assertEqual(head.content, b"")
        self.assertEqual(int(head.headers["content-length"]), len(VIDEO))
        full = self.client.get(path, headers={"Range": "bytes=0-1", "If-Range": '"outdated"'})
        self.assertEqual(full.status_code, 200)
        self.assertEqual(full.content, VIDEO)

    def test_all_content_contracts_use_dynamic_urls_and_public_responses_have_no_preview(self):
        item = self.create(data={"publishToMobile": "true", "publishToWebsite": "true"}).json()["content"]
        with patch.dict(os.environ, {"PUBLIC_API_BASE_URL": "https://new.example.test/api"}):
            for path in ("/api/health-literacy-hub/mobile", "/api/health-literacy-hub/mobile/infographics",
                         "/api/health-literacy-hub/website", "/api/health-literacy-hub/website/infographics"):
                result = self.client.get(path).json()[0]
                self.assertTrue(result["media"]["url"].startswith("https://new.example.test/"))
                self.assertNotIn("previewUrl", result["media"])
            mobile = self.client.get("/api/health-literacy/mobile").json()["items"][0]
            self.assertTrue(mobile["imageUrl"].startswith("https://new.example.test/"))
            admin = self.client.get("/api/health-literacy-hub/infographics", headers=self.auth).json()[0]
            self.assertIn("previewUrl", admin["media"])
        self.assertEqual(self.db.content.find_one({})["media"]["fileId"], item["media"]["fileId"])

    def test_base_url_rejects_loopback_and_production_http_but_allows_opted_in_lan(self):
        for value in ("", "http://localhost:8000/api", "https://127.0.0.1/api",
                      "http://10.0.2.2:8000/api", "http://192.168.1.2:8000/api"):
            with patch.dict(os.environ, {"PUBLIC_API_BASE_URL": value}):
                with self.assertRaises(RuntimeError):
                    media_url(ObjectId())
        with patch.dict(os.environ, {"PUBLIC_API_BASE_URL": "http://192.168.1.2:8000/api", "HEALTH_LITERACY_ALLOW_HTTP": "true"}):
            self.assertTrue(media_url(ObjectId()).startswith("http://192.168.1.2:8000/api/"))
            with patch.dict(os.environ, {"RENDER": "true"}):
                with self.assertRaises(RuntimeError):
                    media_url(ObjectId())
        with patch.dict(os.environ, {"PUBLIC_API_BASE_URL": "http://10.0.2.2:8000/api", "HEALTH_LITERACY_ALLOW_HTTP": "true"}):
            with self.assertRaises(RuntimeError):
                media_url(ObjectId())

    def test_replacement_removal_and_deletion_clean_only_after_reference_changes(self):
        item = self.create().json()["content"]
        old_id = item["media"]["fileId"]
        response = self.update(item, files={"file": ("new.png", PNG + b"new", "image/png")})
        self.assertEqual(response.status_code, 200, response.text)
        new = response.json()["content"]
        self.assertNotEqual(new["media"]["fileId"], old_id)
        self.assertFalse(self.store.fs.exists(ObjectId(old_id)))
        self.assertEqual(self.store.files.count_documents({}), 1)
        self.assertEqual(self.update(new, data={"removeMedia": "true"}).status_code, 200)
        self.assertEqual(self.store.files.count_documents({}), 0)
        item = self.create().json()["content"]
        self.assertEqual(self.client.delete(f"/api/health-literacy-hub/infographics/{item['id']}", headers=self.auth).status_code, 200)
        self.assertEqual(self.store.files.count_documents({}), 0)

    def test_failed_verification_and_reference_update_leave_old_file_and_content_intact(self):
        item = self.create().json()["content"]
        before = self.db.content.find_one({})
        with patch.object(MediaStore, "verify", side_effect=ValueError("verification failed")):
            with self.assertRaises(ValueError):
                self.update(item, files={"file": ("new.png", PNG, "image/png")})
        self.assertEqual(self.db.content.find_one({}), before)
        with patch.object(self.controller, "replace_content", side_effect=RuntimeError("write failed")):
            with self.assertRaises(RuntimeError):
                self.update(item, files={"file": ("new.png", PNG, "image/png")})
        self.assertEqual(self.db.content.find_one({}), before)
        self.assertEqual(self.store.files.count_documents({}), 1)

    def test_concurrent_edits_conflict_without_losing_other_content(self):
        self.create()
        first = self.db.content.find_one({})
        self.create(data={"title": "Other"})
        self.db.content.update_one({"_id": first["_id"]}, {"$set": {"updatedAt": "concurrent", "title": "Concurrent"}})
        with self.assertRaises(Exception) as error:
            self.bridge.replace_content(first, {**first, "title": "Stale"})
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(self.db.content.count_documents({}), 2)
        self.assertEqual(self.db.content.find_one({"_id": first["_id"]})["title"], "Concurrent")

    def test_ambiguous_write_result_never_deletes_committed_new_media(self):
        item = self.create().json()["content"]
        replace = self.controller.replace_content

        def committed_then_disconnected(original, updated):
            replace(original, updated)
            raise RuntimeError("Connection dropped after commit")

        with patch.object(self.controller, "replace_content", side_effect=committed_then_disconnected):
            with self.assertRaises(RuntimeError):
                self.update(item, files={"file": ("new.png", PNG + b"replacement", "image/png")})
        committed = self.db.content.find_one({})
        self.assertNotEqual(committed["media"]["fileId"], item["media"]["fileId"])
        self.store.verify(committed["media"])
        # The old file is recoverable through aged orphan maintenance.
        self.assertEqual(self.store.files.count_documents({}), 2)

    def test_shared_file_and_failed_content_delete_are_safe(self):
        item = self.create().json()["content"]
        original = self.db.content.find_one({})
        with patch.object(self.controller, "delete_content", side_effect=RuntimeError("Database failure")):
            with self.assertRaises(RuntimeError):
                self.client.delete(f"/api/health-literacy-hub/infographics/{item['id']}", headers=self.auth)
        self.store.verify(original["media"])
        shared = {**original, "_id": ObjectId(), "id": "shared"}
        self.db.content.insert_one(shared)
        self.assertEqual(self.update(item, data={"removeMedia": "true"}).status_code, 200)
        self.store.verify(shared["media"])

    def test_article_pdf_and_video_contract_fallbacks(self):
        pdf = b"%PDF-1.7\nfixture"
        item = self.create(kind="articles", mime="application/pdf", binary=pdf,
                           data={"publishToMobile": "true", "source": "DOH", "topics": '["Prevention"]'}).json()["content"]
        result = self.client.get(self.media_path(item))
        self.assertEqual(result.headers["content-type"], "application/pdf")
        self.assertEqual(result.content, pdf)
        mobile = self.client.get("/api/health-literacy/mobile").json()["items"][0]
        self.assertEqual(mobile["mediaUrl"], item["media"]["url"])
        self.assertEqual(mobile["source"], "DOH")
        self.assertEqual(mobile["topics"], ["Prevention"])
        video = self.create(kind="videos", mime="video/mp4", binary=VIDEO,
                            data={"publishToMobile": "true", "mediaUrl": "https://example.test/old.mp4"}).json()["content"]
        mobile = self.client.get("/api/health-literacy/mobile?contentType=video").json()["items"][0]
        self.assertEqual(mobile["mediaUrl"], video["media"]["url"])

    def test_uploaded_video_poster_and_attachment_are_public_in_both_mobile_contracts(self):
        response = self.client.post("/api/health-literacy-hub/videos",
            data={"title": "Video", "description": "Guide", "language": "en", "publishToMobile": "true"},
            files={"file": ("guide.mp4", VIDEO, "video/mp4"),
                   "thumbnail": ("poster.png", PNG, "image/png")}, headers=self.auth)
        self.assertEqual(response.status_code, 201, response.text)
        item = response.json()["content"]
        for path, video in (("/api/health-literacy-hub/mobile", True),
                            ("/api/health-literacy/mobile", False)):
            result = self.client.get(path).json()
            content = result[0] if video else result["items"][0]
            self.assertEqual(content["imageUrl"], item["thumbnail"]["url"])
            self.assertEqual(content["mediaUrl"], item["media"]["url"])
            self.assertEqual(content["media"]["url"], content["mediaUrl"])
            self.assertEqual(content["media"]["contentType"], "video/mp4")
        self.assertEqual(self.client.get(item["thumbnail"]["url"]).content, PNG)
        self.assertEqual(self.client.get(item["media"]["url"]).content, VIDEO)
        self.assertNotEqual(item["thumbnail"]["fileId"], item["media"]["fileId"])

        update = self.client.put(f"/api/health-literacy-hub/videos/{item['id']}",
            data={"title": "Video", "description": "Guide", "language": "en", "publishToMobile": "true",
                  "removeThumbnail": "true"}, headers=self.auth)
        self.assertEqual(update.status_code, 200, update.text)
        self.assertIsNone(update.json()["content"]["thumbnail"])
        self.assertEqual(self.client.get(item["thumbnail"]["url"]).status_code, 404)
        self.assertEqual(self.client.get(item["media"]["url"]).status_code, 200)

    def test_infographic_and_article_images_expose_both_urls(self):
        for kind in ("infographics", "articles"):
            item = self.create(kind=kind, data={"publishToMobile": "true"}).json()["content"]
            result = next(content for content in self.client.get("/api/health-literacy-hub/mobile").json()
                          if content["id"] == item["id"])
            self.assertEqual(result["imageUrl"], item["media"]["url"])
            self.assertEqual(result["mediaUrl"], item["media"]["url"])


    def test_orphan_report_and_apply_protect_references_and_recent_uploads(self):
        item = self.create().json()["content"]
        orphan = self.store.upload(io.BytesIO(PNG), "orphan.png", "image/png", "infographics")
        recent = self.store.upload(io.BytesIO(PNG), "recent.png", "image/png", "infographics")
        old = datetime.now(timezone.utc) - timedelta(days=2)
        self.store.files.update_many({"_id": {"$in": [ObjectId(item["media"]["fileId"]), ObjectId(orphan["fileId"])]}}, {"$set": {"uploadDate": old}})
        partial_id = ObjectId.from_datetime(old)
        self.store.chunks.insert_one({"files_id": partial_id, "n": 0, "data": b"partial"})
        report = self.store.orphan_report()
        self.assertEqual(report["files"], [orphan["fileId"]])
        self.assertEqual(report["incompleteUploads"], [str(partial_id)])
        self.assertEqual(self.store.files.count_documents({}), 3)
        self.store.orphan_report(apply=True)
        self.assertTrue(self.store.fs.exists(ObjectId(item["media"]["fileId"])))
        self.assertTrue(self.store.fs.exists(ObjectId(recent["fileId"])))
        self.assertFalse(self.store.fs.exists(ObjectId(orphan["fileId"])))
        self.assertEqual(self.store.chunks.count_documents({"files_id": partial_id}), 0)

    def seed_legacy(self, *, data_url=False):
        folder = self.root / "media" / "infographics"
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "old.png").write_bytes(PNG)
        media = {"filename": "old.png", "contentType": "image/png", "storedFilename": "old.png",
                 "url": "http://localhost:8000/api/health-literacy-hub/media/infographics/old.png"}
        if data_url:
            media = {"filename": "old.png", "dataUrl": "data:image/png;base64," + base64.b64encode(PNG).decode()}
        document = {"id": "legacy", "contentType": "infographic", "title": "Atlas wins", "media": media,
                    "updatedAt": "2026-01-01", "publishToMobile": True, "customField": "preserve"}
        self.db.content.insert_one(document)
        return document

    def test_migration_dry_run_apply_verify_idempotence_rollback_and_source_preservation(self):
        original = self.seed_legacy()
        before = deepcopy(self.db.content.find_one({}))
        report = migrate(self.db, self.root)
        self.assertEqual(report["items"][0]["status"], "would-migrate")
        self.assertEqual(self.db.content.find_one({}), before)
        self.assertEqual(self.store.files.count_documents({}), 0)
        applied = migrate(self.db, self.root, apply=True, journal=self.journal)
        self.assertEqual(applied["errors"], 0)
        migrated = self.db.content.find_one({})
        self.assertEqual(migrated["customField"], "preserve")
        self.assertNotIn("url", migrated["media"])
        self.assertEqual(migrate(self.db, self.root, apply=True, journal=self.journal)["items"][0]["status"], "already-migrated-verified")
        self.assertEqual(self.store.files.count_documents({}), 1)
        self.assertEqual((self.root / "media/infographics/old.png").read_bytes(), PNG)
        self.assertEqual(rollback(self.db, self.journal)["items"][0]["status"], "would-restore")
        rollback(self.db, self.journal, apply=True)
        self.assertEqual(self.db.content.find_one({}), original)
        # Reuse the verified GridFS copy on retry after rollback.
        migrate(self.db, self.root, apply=True, journal=self.journal)
        self.assertEqual(self.store.files.count_documents({}), 1)

    def test_data_url_migration_and_rollback_conflict(self):
        self.seed_legacy(data_url=True)
        self.assertEqual(migrate(self.db, self.root, apply=True, journal=self.journal)["errors"], 0)
        self.assertNotIn("dataUrl", self.db.content.find_one({})["media"])
        self.db.content.update_one({}, {"$set": {"title": "Newer edit"}})
        self.assertEqual(rollback(self.db, self.journal, apply=True)["errors"], 1)
        self.assertEqual(self.db.content.find_one({})["title"], "Newer edit")

    def test_missing_file_and_path_traversal_report_without_changing_content(self):
        self.seed_legacy()
        for filename in ("missing.png", "../private.png"):
            self.db.content.update_one({}, {"$set": {"media.storedFilename": filename}})
            before = self.db.content.find_one({})
            self.assertEqual(migrate(self.db, self.root, apply=True, journal=self.journal)["errors"], 1)
            self.assertEqual(self.db.content.find_one({}), before)

    def test_migration_verification_failure_preserves_source_reference_and_reports_corruption(self):
        self.seed_legacy()
        before = self.db.content.find_one({})
        with patch.object(MediaStore, "verify", side_effect=ValueError("bad copy")):
            report = migrate(self.db, self.root, apply=True, journal=self.journal)
        self.assertEqual(report["errors"], 1)
        self.assertEqual(self.db.content.find_one({}), before)
        self.assertEqual(self.store.files.count_documents({}), 0)
        migrate(self.db, self.root, apply=True, journal=self.journal)
        self.store.chunks.update_one({}, {"$set": {"data": b"corrupted"}})
        self.assertEqual(migrate(self.db, self.root)["errors"], 1)

    def test_duplicate_legacy_aliases_block_migration_before_writes(self):
        self.seed_legacy()
        self.db.content.insert_one({"id": "legacy", "contentType": "infographics"})
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            migrate(self.db, self.root, apply=True, journal=self.journal)
        self.assertEqual(self.store.files.count_documents({}), 0)

    def test_top_level_data_url_migrates_and_distinct_attachments_are_not_discarded(self):
        self.db.content.insert_one({"id": "top-level", "contentType": "article",
            "mediaUrl": "https://example.test/editorial-link", "imageUrl": "data:image/png;base64," + base64.b64encode(PNG).decode()})
        self.assertEqual(migrate(self.db, self.root, apply=True, journal=self.journal)["errors"], 0)
        result = self.db.content.find_one({})
        self.assertIsNone(result["imageUrl"])
        self.assertEqual(result["mediaUrl"], "https://example.test/editorial-link")
        self.store.verify(result["media"])
        self.db.content.delete_many({})
        self.seed_legacy()
        self.db.content.update_one({}, {"$set": {"imageUrl": "data:image/png;base64," + base64.b64encode(PNG + b"different").decode()}})
        before = self.db.content.find_one({})
        self.assertEqual(migrate(self.db, self.root, apply=True, journal=self.journal)["errors"], 1)
        self.assertEqual(self.db.content.find_one({}), before)

    def test_json_is_explicit_insert_only_and_runtime_reads_never_reseed(self):
        self.seed_legacy()
        (self.root / "infographics.json").write_text(json.dumps([
            {"id": "legacy", "title": "Stale repo title"}, {"id": "new-seed", "title": "Explicit import"}]))
        self.assertEqual(migrate(self.db, self.root)["items"].__len__(), 1)
        report = migrate(self.db, self.root, include_seeds=True, apply=True, journal=self.journal)
        self.assertEqual(report["errors"], 0)
        self.assertEqual(self.db.content.find_one({"id": "legacy"})["title"], "Atlas wins")
        self.assertEqual(self.db.content.count_documents({}), 2)
        self.assertEqual(migrate(self.db, self.root, include_seeds=True, apply=True, journal=self.journal)["errors"], 0)
        self.db.content.delete_many({})
        with patch.object(Path, "read_text", side_effect=AssertionError("Runtime seed read forbidden")):
            self.assertEqual(self.client.get("/api/health-literacy-hub/mobile").json(), [])
            self.assertEqual(self.client.get("/api/health-literacy-hub/infographics", headers=self.auth).json(), [])

    def test_legacy_endpoint_never_serves_disk(self):
        self.assertEqual(self.client.get("/api/health-literacy-hub/media/videos/test.mp4").status_code, 410)


if __name__ == "__main__":
    unittest.main()
