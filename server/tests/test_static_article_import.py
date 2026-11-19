"""Draft migration checks with in-memory MongoDB/GridFS; no app DB import."""
from copy import deepcopy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

import mongomock
from mongomock.gridfs import enable_gridfs_integration

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from health_literacy_media import MediaStore
from scripts.import_static_articles import import_drafts, plan_import
from scripts.migrate_health_literacy_media import rollback

enable_gridfs_integration()
PNG = b"\x89PNG\r\n\x1a\n" + b"test image" * 100


class StaticArticleImportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.assets = self.root / "assets"
        (self.assets / "preview").mkdir(parents=True)
        (self.assets / "gallery/story").mkdir(parents=True)
        (self.assets / "preview/cover.png").write_bytes(PNG)
        (self.assets / "gallery/story/photo.png").write_bytes(PNG)
        self.article = {"articleID": 1, "articleTitle": "Story", "articleSlug": "original-story-link",
                        "articlePreview": "Short introduction", "articleBody": "First paragraph.\nSecond paragraph.",
                        "datePublished": "02/09/2025", "articleImage": "cover.png",
                        "articleImageCaption": "Original cover caption", "galleryFolder": "story",
                        "galleryImages": [{"filename": "photo.png", "caption": "Original photo caption"}]}
        self.source = self.root / "articles.json"
        self.journal = self.root / "journal.jsonl"
        self.db = mongomock.MongoClient().isolated_static_import
        options = patch.object(self.db, "with_options", return_value=self.db)
        options.start()
        self.addCleanup(options.stop)

    def plan(self, articles=None):
        self.source.write_text(json.dumps(articles if articles is not None else [self.article]), encoding="utf-8")
        return plan_import(self.source, self.assets)

    def apply(self, plan):
        return import_drafts(*plan, db=self.db, apply=True, journal=self.journal)

    def test_offline_and_database_dry_runs_do_not_write(self):
        plan = self.plan([self.article, {"articleID": 99, "articleTitle": ""}])
        original = self.source.read_bytes()
        report = import_drafts(*plan)
        self.assertEqual(report["skippedBlankArticleIds"], [99])
        self.assertEqual(report["items"][0]["status"], "would-import-draft")
        import_drafts(*plan, db=self.db)
        self.assertEqual(self.db.list_collection_names(), [])
        self.assertFalse(self.journal.exists())
        self.assertEqual(original, self.source.read_bytes())

    def test_import_keeps_body_preview_date_slug_captions_and_images_as_draft(self):
        report = self.apply(self.plan())
        self.assertEqual(report["errors"], 0)
        self.assertEqual(report["imported"], 1)
        saved = self.db.content.find_one()
        for flag in ("publishToMobile", "publishToWebsite", "isPublished"):
            self.assertIs(saved[flag], False)
        self.assertEqual(saved["shortPreview"], self.article["articlePreview"])
        self.assertEqual(saved["description"], self.article["articleBody"])
        self.assertEqual(saved["publishedDate"], "2025-02-09T00:00:00+08:00")
        self.assertEqual(saved["legacyArticleSlug"], self.article["articleSlug"])
        self.assertEqual(saved["legacyStaticArticleId"], "1")
        self.assertEqual(saved["lastReviewedAt"], "")
        self.assertEqual([i["id"] for i in saved["galleryImages"]], ["cover", "gallery-1"])
        self.assertEqual(saved["galleryImages"][0]["caption"], self.article["articleImageCaption"])
        for image in saved["galleryImages"]:
            MediaStore(self.db).verify(image["media"])

    def test_rerun_preserves_admin_edits_publication_and_existing_media(self):
        plan = self.plan()
        self.apply(plan)
        self.db.content.update_one({}, {"$set": {"title": "Admin edited", "description": "Reviewed body",
                                                  "shortPreview": "Edited preview", "publishToWebsite": True, "isPublished": True}})
        before = deepcopy(self.db.content.find_one())
        count = MediaStore(self.db).files.count_documents({})
        report = self.apply(plan)
        self.assertEqual(report["preserved"], 1)
        self.assertEqual(report["imported"], 0)
        self.assertEqual(before, self.db.content.find_one())
        self.assertEqual(count, MediaStore(self.db).files.count_documents({}))

    def test_conflicting_content_blocks_all_uploads(self):
        plan = self.plan()
        self.db.content.insert_one({"id": "existing", "contentType": "articles", "title": "Story"})
        with self.assertRaisesRegex(ValueError, "conflicts"):
            self.apply(plan)
        self.assertEqual(MediaStore(self.db).files.count_documents({}), 0)
        self.assertFalse(self.journal.exists())

    def test_missing_unsafe_invalid_and_oversized_gallery_sources_block_preflight(self):
        for fields in ({"articleImage": "missing.png"}, {"articleImage": "../../../escape.png"},
                       {"datePublished": "not-a-date"}, {"galleryImages": self.article["galleryImages"] * 10}):
            with self.subTest(fields=fields), self.assertRaises((ValueError, FileNotFoundError)):
                self.plan([{**self.article, **fields}])
        self.assertEqual(self.db.list_collection_names(), [])

    def test_long_caption_keeps_full_text_with_approved_title_description(self):
        plan, _ = self.plan([{**self.article, "articleImageCaption": "x" * 662}])
        self.assertEqual(plan[0]["images"][0]["caption"], "x" * 662)
        self.assertEqual(plan[0]["images"][0]["alt"], self.article["articleTitle"])
        self.assertTrue(any("full caption is preserved" in note for note in plan[0]["reviewNotes"]))

    def test_repository_preflight_counts_sources_and_preserves_feu_dates(self):
        repo = Path(__file__).resolve().parents[2]
        plan, skipped = plan_import(repo / "client/src/assets/data/articles.json", repo / "client/public/assets/articles")
        self.assertEqual(len(plan), 13)
        self.assertEqual(sum(len(item["images"]) for item in plan), 70)
        self.assertEqual(len(skipped), 6)
        feu = next(item for item in plan if item["legacyId"] == "16")
        self.assertTrue(feu["publishedDate"].startswith("2025-02-09"))
        self.assertIn("February 19, 2025", feu["description"])

    def test_failure_cleans_new_unreferenced_uploads_and_leaves_no_draft(self):
        plan = self.plan()
        upload = MediaStore.upload
        calls = []

        def fail_second(store, *args, **kwargs):
            calls.append(1)
            if len(calls) == 2:
                raise ValueError("Simulated upload failure")
            return upload(store, *args, **kwargs)

        with patch.object(MediaStore, "upload", fail_second):
            report = self.apply(plan)
        self.assertEqual(report["errors"], 1)
        self.assertEqual(self.db.content.count_documents({}), 0)
        self.assertEqual(MediaStore(self.db).files.count_documents({}), 0)

    def test_rollback_removes_unchanged_import_but_preserves_admin_edits(self):
        self.apply(self.plan())
        self.assertEqual(rollback(self.db, self.journal)["items"][0]["status"], "would-restore")
        self.db.content.update_one({}, {"$set": {"shortPreview": "Reviewed"}})
        self.assertEqual(rollback(self.db, self.journal, apply=True)["errors"], 1)
        self.db.content.update_one({}, {"$set": {"shortPreview": self.article["articlePreview"]}})
        self.assertEqual(rollback(self.db, self.journal, apply=True)["errors"], 0)
        self.assertEqual(self.db.content.count_documents({}), 0)
        # Media retained for rollback/retry; existing aged-orphan maintenance can clean it.
        self.assertEqual(MediaStore(self.db).files.count_documents({}), 2)


if __name__ == "__main__":
    unittest.main()
