"""Import bundled website articles as unpublished Admin UI drafts.

Default is an offline dry run: validate every article and image without a DB
connection. --check-database adds a read-only collision check. --apply writes
new drafts only and requires a rollback journal. Existing imports always win.
No source JSON, images, existing content, comments, or publication flags change.
"""
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
import mimetypes
import os
from pathlib import Path
import sys

from dotenv import dotenv_values
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from health_literacy_media import IMAGE_TYPES, MediaStore
from scripts.migrate_health_literacy_media import append_journal, inspect_source, rollback

REPO = Path(__file__).resolve().parents[2]
MIGRATION = "public-static-articles-v1"
PH = timezone(timedelta(hours=8))


def source_path(root, *parts):
    """Source metadata must not escape the repository's article asset folder."""
    root = Path(root).resolve()
    path = root.joinpath(*parts).resolve()
    if root not in path.parents:
        raise ValueError("Article image path escapes its source folder")
    return path


def plan_import(source, assets):
    articles = json.loads(Path(source).read_text(encoding="utf-8"))
    if not isinstance(articles, list):
        raise ValueError("Article source must be a JSON array")
    plan, skipped, seen_ids, seen_slugs = [], [], set(), set()
    for article in articles:
        if not isinstance(article, dict):
            raise ValueError("Each article must be an object")
        if not str(article.get("articleTitle") or "").strip():
            skipped.append(article.get("articleID"))
            continue
        legacy_id = str(article["articleID"])
        slug = article["articleSlug"]
        if legacy_id in seen_ids or slug in seen_slugs or not slug:
            raise ValueError("Article IDs and slugs must be nonempty and unique")
        seen_ids.add(legacy_id)
        seen_slugs.add(slug)
        body = article.get("articleBody", "")
        if not body.strip():
            raise ValueError(f"Article {legacy_id} has no body")
        published = datetime.strptime(article["datePublished"], "%m/%d/%Y").replace(tzinfo=PH).isoformat()
        images = [{"id": "cover", "path": source_path(assets, "preview", article["articleImage"]),
                   "caption": article.get("articleImageCaption", ""),
                   "alt": article.get("articleImageCaption") or article["articleTitle"]}]
        for index, image in enumerate(article.get("galleryImages", []), 1):
            images.append({"id": f"gallery-{index}",
                           "path": source_path(assets, "gallery", article["galleryFolder"], image["filename"]),
                           "caption": image.get("caption", ""),
                           "alt": image.get("alt") or image.get("caption") or article["articleTitle"]})
        # Approved mapping: preserve long captions and use the title as alt text
        # where copying a caption would exceed the image-description limit.
        title_alt_fallback = any(len(image["alt"]) > 500 for image in images)
        for image in images:
            if len(image["alt"]) > 500:
                image["alt"] = article["articleTitle"]
        if len(images) > 10:
            raise ValueError(f"Article {legacy_id} exceeds the 10-image gallery limit")
        for image in images:
            if len(image["caption"]) > 1000 or len(image["alt"]) > 500:
                raise ValueError(f"Article {legacy_id} has image text exceeding editor limits")
            image["mime"] = mimetypes.guess_type(str(image["path"]))[0]
            if image["mime"] not in IMAGE_TYPES:
                raise ValueError(f"Article {legacy_id} has an unsupported image format")
            with image["path"].open("rb") as stream:
                image.update(inspect_source(stream, image["mime"], "articles"))
        if sum(image["size"] for image in images) > 75 * 1024**2:
            raise ValueError(f"Article {legacy_id} exceeds the gallery upload budget")
        notes = ["Imported as an unpublished draft. Review the short preview, full description, image order, captions, and image descriptions before publishing."]
        if title_alt_fallback:
            notes.append("A source caption exceeded the image-description limit. Its full caption is preserved; the article title is used as its image description for you to refine.")
        if not article.get("articleImageCaption"):
            notes.append("The source cover image had no caption; it is left blank. Its image description uses the article title.")
        if legacy_id == "16":
            notes.append("Source dates retained for review: publication date February 9, 2025; the description states the event was February 19, 2025.")
        plan.append({"legacyId": legacy_id, "id": f"static-article-{legacy_id}", "slug": slug,
                     "title": article["articleTitle"], "description": body,
                     "shortPreview": article.get("articlePreview", ""), "publishedDate": published,
                     "sourceDate": article["datePublished"], "readDuration": article.get("readDuration", ""),
                     "sourceSha256": hashlib.sha256(json.dumps(article, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest(),
                     "images": images, "reviewNotes": notes})
    return plan, skipped


def existing_import(db, item):
    candidates = list(db.content.find({"$or": [
        {"_id": f"{MIGRATION}:{item['legacyId']}"},
        {"contentType": {"$in": ["article", "articles"]}, "$or": [
            {"id": item["id"]}, {"legacyStaticArticleId": item["legacyId"]},
            {"legacyArticleSlug": item["slug"]}, {"title": item["title"]}]}]}))
    if not candidates:
        return None
    if (len(candidates) != 1 or candidates[0].get("id") != item["id"]
            or candidates[0].get("contentType") not in {"article", "articles"}
            or candidates[0].get("legacyStaticArticleId") != item["legacyId"]
            or candidates[0].get("staticArticleMigration", {}).get("key") != MIGRATION):
        raise ValueError(f"Article {item['legacyId']} conflicts with existing content; review before import")
    return candidates[0]


def draft_document(item, now):
    return {"_id": f"{MIGRATION}:{item['legacyId']}", "id": item["id"], "contentType": "article",
            "title": item["title"], "description": item["description"], "shortPreview": item["shortPreview"],
            "language": "en", "tags": [], "topics": [], "diseases": [],
            "publishedDate": item["publishedDate"], "source": None, "author": None,
            "media": None, "thumbnail": None, "duration": None,
            "externalUrl": None, "imageUrl": None, "mediaUrl": None,
            "publishToWebsite": False, "publishToMobile": False, "isPublished": False,
            "createdAt": now, "updatedAt": now, "createdBy": {"id": "", "name": "Static article import"},
            "lastReviewedAt": "", "lastReviewedBy": {}, "assignedReviewer": "", "reviewRequestedAt": "",
            "isArchived": False, "archivedAt": "", "archivedBy": {},
            "isPinned": False, "pinnedAt": "", "pinnedBy": {},
            "isFactCheck": False, "claim": None, "claimStatus": "Needs Expert Review",
            "verifiedBy": "Project Researcher", "verdict": "Needs Context", "explanation": None,
            "legacyStaticArticleId": item["legacyId"], "legacyArticleSlug": item["slug"],
            "staticArticleMigration": {"key": MIGRATION, "sourceSha256": item["sourceSha256"],
                                       "sourceDate": item["sourceDate"], "sourceReadDuration": item["readDuration"],
                                       "reviewNotes": item["reviewNotes"]}, "galleryImages": []}


def import_drafts(plan, skipped, *, db=None, apply=False, journal=None):
    if apply and (db is None or journal is None):
        raise ValueError("Applying the import requires a database and rollback journal")
    report = {"mode": "apply" if apply else "dry-run", "database": db.name if db is not None else None,
              "skippedBlankArticleIds": skipped, "items": [], "errors": 0}
    # Check every identity BEFORE uploading anything. Never overwrite an admin edit.
    existing = {item["id"]: existing_import(db, item) if db is not None else None for item in plan}
    store = MediaStore(db) if apply else None
    for item in plan:
        entry = {"id": item["id"], "legacyId": item["legacyId"], "title": item["title"],
                 "slug": item["slug"], "publishedDate": item["publishedDate"],
                 "imageCount": len(item["images"]), "imageBytes": sum(i["size"] for i in item["images"]),
                 "reviewNotes": item["reviewNotes"]}
        report["items"].append(entry)
        if existing[item["id"]] is not None:
            entry["status"] = "existing-import-preserved"
            continue
        if not apply:
            entry["status"] = "would-import-draft"
            continue
        uploaded = []
        try:
            print(f"Importing draft {item['id']} ({len(item['images'])} images)", flush=True)
            document = draft_document(item, datetime.now(PH).isoformat())
            for image in item["images"]:
                with image["path"].open("rb") as stream:
                    # Detect source changes since preflight before committing any draft.
                    fingerprint = inspect_source(stream, image["mime"], "articles")
                    if fingerprint != {key: image[key] for key in ("size", "sha256")}:
                        raise ValueError("Image changed since preflight; rerun the import")
                    media = store.upload(stream, image["path"].name, image["mime"], "articles",
                                         metadata={"staticArticleMigration": MIGRATION, "staticArticleId": item["legacyId"]})
                uploaded.append(media)
                document["galleryImages"].append({"id": image["id"], "media": media,
                                                 "caption": image["caption"], "alt": image["alt"]})
            if existing_import(db, item) is not None:
                raise ValueError("Article appeared during import; rerun to preserve it")
            append_journal(journal, {"before": None, "after": document, "fields": []})
            db.content.insert_one(document)
            saved = db.content.find_one({"_id": document["_id"]})
            if saved != document:
                raise ValueError("Imported draft changed during verification; review the report")
            for image in saved["galleryImages"]:
                store.verify(image["media"])
            entry["status"] = "draft-imported-verified"
        except Exception as error:
            # Cleanup rechecks references even after an ambiguous database commit.
            for media in uploaded:
                store.cleanup_safely(media)
            entry["status"] = "error"
            entry["errorType"] = type(error).__name__
            entry["message"] = str(error) if isinstance(error, ValueError) else "Import failed; rerun the database check before retrying."
            report["errors"] += 1
            break
    report["imported"] = sum(i["status"] == "draft-imported-verified" for i in report["items"])
    report["preserved"] = sum(i["status"] == "existing-import-preserved" for i in report["items"])
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=REPO / "client/src/assets/data/articles.json")
    parser.add_argument("--assets", type=Path, default=REPO / "client/public/assets/articles")
    parser.add_argument("--env-file", type=Path, help="Explicit app .env path; only MongoDB connection settings are used")
    parser.add_argument("--uri-env", default="MONGO_URI")
    parser.add_argument("--database", help="Defaults to DB_NAME in the explicit env file or process environment")
    parser.add_argument("--check-database", action="store_true")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--journal", type=Path)
    parser.add_argument("--rollback", type=Path, help="Use the import journal; dry-run unless --apply. Admin edits are preserved.")
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    if args.apply and not args.rollback and not args.journal:
        parser.error("--apply requires --journal")
    outputs = [p.resolve() for p in (args.report, args.journal, args.rollback) if p]
    if len(outputs) != len(set(outputs)):
        parser.error("Report and journal paths must be distinct")
    for output in outputs:
        if output == args.source.resolve() or output == args.assets.resolve() or args.assets.resolve() in output.parents:
            parser.error("Reports and journals must not overwrite article source assets")
    try:
        if args.rollback:
            plan, skipped = [], []
        else:
            plan, skipped = plan_import(args.source, args.assets)
        needs_db = args.apply or args.check_database or args.rollback
        if needs_db:
            settings = dict(dotenv_values(args.env_file)) if args.env_file else {}
            uri = os.getenv(args.uri_env) or settings.get(args.uri_env)
            database = args.database or os.getenv("DB_NAME") or settings.get("DB_NAME")
            if not uri or not database:
                raise ValueError("Specify a MongoDB URI and DB_NAME via environment or --env-file")
            with MongoClient(uri, serverSelectionTimeoutMS=15000, readPreference="primary", w="majority") as client:
                db = client[database]
                if args.rollback:
                    report = rollback(db, args.rollback, apply=args.apply)
                else:
                    report = import_drafts(plan, skipped, db=db, apply=args.apply, journal=args.journal)
        else:
            report = import_drafts(plan, skipped)
    except Exception as error:
        # Driver exceptions can contain connection credentials. Never print them.
        report = {"mode": "apply" if args.apply else "dry-run", "errors": 1,
                  "errorType": type(error).__name__, "message": str(error) if isinstance(error, (ValueError, FileNotFoundError))
                  else "Preflight or database connection failed; no credentials are included in this report."}
    args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Report: {args.report}; errors={report.get('errors', 0)}; imported={report.get('imported', 0)}; preserved={report.get('preserved', 0)}")
    return 1 if report.get("errors") else 0


if __name__ == "__main__":
    raise SystemExit(main())
