"""Explicit backend maintenance; never imports config.database or loads .env.

Default: read-only dry run. Run --help for required connection/report arguments.
Source files and JSON are NEVER changed or deleted by this tool.
"""
import argparse
import base64
from collections import Counter
import hashlib
import io
import json
import mimetypes
import os
from pathlib import Path
import sys
from urllib.parse import unquote, urlsplit

from bson import ObjectId, json_util
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from health_literacy_media import (BLOCK_SIZE, IMAGE_LIMIT, VIDEO_LIMIT, VIDEO_TYPES,
                                   MediaStore, allowed_media_types, validate_signature)

TYPES = {"article": "articles", "video": "videos", "infographic": "infographics"}
ALIASES = {**{key: key for key in TYPES}, **{value: key for key, value in TYPES.items()}}


def legacy_source(document, source_root):
    media = document.get("media") or {}
    bucket = TYPES[ALIASES[document["contentType"]]]
    value = media.get("dataUrl") or media.get("url") or ""
    legacy_links = [str(document.get(field) or "") for field in ("imageUrl", "mediaUrl")]
    legacy_links = [link for link in legacy_links
                    if link.startswith("data:") or "/health-literacy-hub/media/" in link]
    if not value and not media.get("storedFilename"):
        value = legacy_links[0] if legacy_links else ""
    primary = value or f"/api/health-literacy-hub/media/{bucket}/{media.get('storedFilename', '')}"

    def identity(link):
        return link if link.startswith("data:") else unquote(urlsplit(link).path)

    if any(identity(link) != identity(primary) for link in legacy_links):
        # The current schema has one uploaded attachment. Never discard a second
        # legacy attachment in an imageUrl/mediaUrl field by silently clearing it.
        raise ValueError("Multiple distinct legacy attachments require manual migration review")
    mime = media.get("contentType")
    filename = media.get("filename") or "upload"
    if value.startswith("data:"):
        header, encoded = value.split(",", 1)
        if not header.endswith(";base64"):
            raise ValueError("Only base64 legacy data URLs are supported")
        mime = mime or header[5:-7]
        # Bound decoding before allocating a large binary payload.
        if len(encoded) > (VIDEO_LIMIT * 4 // 3 + 8):
            raise ValueError("Legacy data URL exceeds upload limit")
        return io.BytesIO(base64.b64decode(encoded, validate=True)), filename, mime
    stored_name = media.get("storedFilename")
    path = unquote(urlsplit(value).path)
    if not stored_name:
        prefix = f"/api/health-literacy-hub/media/{bucket}/"
        if not path.startswith(prefix):
            if media:
                raise ValueError("Unrecognized legacy media path; supply/review a filesystem source")
            return None
        stored_name = path[len(prefix):]
    if not stored_name or "/" in stored_name or "\\" in stored_name or stored_name in {".", ".."}:
        raise ValueError("Unsafe legacy filename")
    root = Path(source_root).resolve()
    folder = (root / "media" / bucket).resolve()
    source = (folder / stored_name).resolve()
    if root not in folder.parents or folder not in source.parents:
        raise ValueError("Source path escapes media folder")
    mime = mime or mimetypes.guess_type(str(source))[0]
    return source.open("rb"), media.get("filename") or stored_name, mime


def inspect_source(stream, mime, content_type):
    if mime not in allowed_media_types(content_type):
        raise ValueError("Unsupported legacy MIME type")
    limit = VIDEO_LIMIT if mime in VIDEO_TYPES else IMAGE_LIMIT
    digest, size = hashlib.sha256(), 0
    block = stream.read(BLOCK_SIZE)
    validate_signature(block, mime)
    while block:
        size += len(block)
        if size > limit:
            raise ValueError("Legacy source exceeds upload size limit")
        digest.update(block)
        block = stream.read(BLOCK_SIZE)
    stream.seek(0)
    return {"size": size, "sha256": digest.hexdigest()}


def append_journal(path, entry):
    # Journal BEFORE changing a content reference. Flush to disk for crash recovery.
    with Path(path).open("a", encoding="utf-8") as handle:
        handle.write(json_util.dumps(entry) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def migration_documents(db, source_root, include_seeds):
    documents = list(db.content.find({"contentType": {"$in": list(ALIASES)}}))
    seen = {(ALIASES[d["contentType"]], str(d.get("id"))) for d in documents}
    result = [(item, False) for item in documents]
    if include_seeds:
        for canonical, bucket in TYPES.items():
            path = Path(source_root) / f"{bucket}.json"
            if not path.exists():
                continue
            seeds = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(seeds, list):
                raise ValueError(f"{path.name} must be a JSON array")
            for seed in seeds:
                if not isinstance(seed, dict) or not seed.get("id"):
                    raise ValueError(f"{path.name} contains content without a stable id")
                key = (canonical, str(seed["id"]))
                if key in seen:
                    continue  # Atlas always wins, regardless of seed timestamps.
                seen.add(key)
                result.append(({**seed, "_id": ObjectId(), "id": str(seed["id"]),
                                "contentType": canonical}, True))
    return result


def migrate(db, source_root, *, apply=False, include_seeds=False, journal=None):
    if apply and not journal:
        raise ValueError("Apply requires a rollback journal path")
    store = MediaStore(db)
    report = {"mode": "apply" if apply else "dry-run", "database": db.name,
              "items": [], "errors": 0}
    documents = migration_documents(db, source_root, include_seeds)
    identities = [(ALIASES[d["contentType"]], str(d.get("id"))) for d, _ in documents]
    duplicates = {key for key, count in Counter(identities).items() if count > 1}
    if duplicates:
        raise ValueError(f"Duplicate legacy/canonical content IDs need manual review: {sorted(duplicates)}")
    for original, seed in documents:
        item = {"id": original.get("id"), "contentType": original["contentType"], "seed": seed}
        report["items"].append(item)
        try:
            current_media = original.get("media") or {}
            if current_media.get("fileId"):
                store.verify(current_media)
                item["status"] = "already-migrated-verified"
                continue
            source = legacy_source(original, source_root)
            fields = {}
            if source:
                stream, filename, mime = source
                with stream:
                    fingerprint = inspect_source(stream, mime, original["contentType"])
                    item.update(fingerprint)
                    if not apply:
                        item["status"] = "would-import-and-migrate" if seed else "would-migrate"
                        continue
                    key = f"{original['contentType']}:{original['id']}:{fingerprint['sha256']}"
                    previous = store.files.find_one({"metadata.migrationKey": key, "metadata.verified": True})
                    if previous:
                        new_media = {"fileId": str(previous["_id"]), "filename": previous["filename"],
                                     "contentType": mime, **fingerprint}
                        store.verify(new_media)
                    else:
                        new_media = store.upload(stream, filename, mime, original["contentType"],
                                                 metadata={"migrationKey": key})
                    fields["media"] = new_media
                    # Remove duplicate legacy media links, preserving unrelated editorial links.
                    for field in ("imageUrl", "mediaUrl"):
                        value = str(original.get(field) or "")
                        if value.startswith("data:") or "/health-literacy-hub/media/" in value:
                            fields[field] = None
            if not apply:
                item["status"] = "would-import" if seed else "no-uploaded-media"
                continue
            if not fields and not seed:
                item["status"] = "no-uploaded-media"
                continue
            after = {**original, **fields}
            append_journal(journal, {"before": None if seed else original, "after": after,
                                     "fields": list(fields)})
            if seed:
                # Maintenance runs with writers stopped. Still reject a concurrent seed import.
                canonical = ALIASES[original["contentType"]]
                if db.content.find_one({"id": original["id"], "contentType": {"$in": [canonical, TYPES[canonical]]}}):
                    raise ValueError("Content appeared during seed import; rerun to use Atlas record")
                db.content.insert_one(after)
            else:
                result = db.content.update_one({"_id": original["_id"], "media": original.get("media"),
                                                "updatedAt": original.get("updatedAt"),
                                                "imageUrl": original.get("imageUrl"),
                                                "mediaUrl": original.get("mediaUrl")}, {"$set": fields})
                if not result.matched_count:
                    raise ValueError("Content changed during migration; rerun after review")
            if fields.get("media"):
                store.verify(db.content.find_one({"_id": original["_id"]})["media"])
            item["status"] = "imported-verified" if seed else "migrated-verified"
        except Exception as error:
            item["status"] = "error"
            item["error"] = str(error)
            report["errors"] += 1
    return report


def rollback(db, journal, *, apply=False):
    report = {"mode": "rollback" if apply else "rollback-dry-run", "items": [], "errors": 0}
    for line in reversed(Path(journal).read_text(encoding="utf-8").splitlines()):
        entry = json_util.loads(line)
        before, after = entry["before"], entry["after"]
        current = db.content.find_one({"_id": after["_id"]})
        item = {"id": after.get("id")}
        report["items"].append(item)
        if current == before:
            item["status"] = "already-restored"
            continue
        if current != after:
            item["status"] = "conflict-preserved"
            report["errors"] += 1
            continue
        item["status"] = "restored" if apply else "would-restore"
        if apply:
            # Exact snapshot comparison prevents clobbering post-migration edits.
            if before is None:
                result = db.content.delete_one(current)
                changed = result.deleted_count
            else:
                result = db.content.replace_one(current, before)
                changed = result.matched_count
            if not changed:
                item["status"] = "conflict-preserved"
                report["errors"] += 1
    # GridFS copies stay intact for review/retry; orphan cleanup is a separate operation.
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--uri-env", default="HUB_MIGRATION_URI", help="Name of an explicit connection environment variable; no .env loading")
    parser.add_argument("--database", required=True)
    parser.add_argument("--source-root", type=Path, default=Path(__file__).resolve().parents[1] / "public" / "health-literacy-hub")
    parser.add_argument("--include-seeds", action="store_true", help="Explicitly import missing JSON IDs only; existing Atlas records always win")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--confirm-database")
    parser.add_argument("--journal", type=Path, help="Append-only private rollback journal, required for migration apply")
    parser.add_argument("--rollback", type=Path, help="Restore a previously written journal (dry-run unless --apply)")
    parser.add_argument("--orphans", action="store_true", help="Report aged orphan files/chunks, delete only with --apply")
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()
    if args.apply and (args.dry_run or args.confirm_database != args.database):
        parser.error("Apply requires --confirm-database matching --database and no --dry-run")
    if sum((args.rollback is not None, args.orphans)) > 1:
        parser.error("Choose migration, rollback, or orphan maintenance")
    if args.apply and not args.orphans and not args.rollback and not args.journal:
        parser.error("Migration apply requires --journal")
    uri = os.getenv(args.uri_env)
    if not uri:
        parser.error(f"Set {args.uri_env} explicitly; no automatic use of the app connection")
    if args.report.resolve() in {p.resolve() for p in (args.journal, args.rollback) if p}:
        parser.error("Report and journal must be separate files")
    source_root = args.source_root.resolve()
    for output in (args.report, args.journal):
        if output and (output.resolve() == source_root or source_root in output.resolve().parents):
            parser.error("Keep report/journal files outside the legacy source directory")
    try:
        with MongoClient(uri, serverSelectionTimeoutMS=10000, readPreference="primary", w="majority") as client:
            db = client[args.database]
            if args.rollback:
                report = rollback(db, args.rollback, apply=args.apply)
            elif args.orphans:
                report = MediaStore(db).orphan_report(apply=args.apply)
            else:
                report = migrate(db, args.source_root, apply=args.apply,
                                 include_seeds=args.include_seeds, journal=args.journal)
    except Exception as error:
        # Reports also cover preflight/connection failures; never print URI secrets.
        report = {"mode": "apply" if args.apply else "dry-run", "errors": 1,
                  "errorType": type(error).__name__,
                  "message": str(error) if isinstance(error, (ValueError, FileNotFoundError)) else
                  "Preflight or connection failed; inspect inputs and backups before retrying"}
    args.report.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    print(f"Report written to {args.report}; errors={report.get('errors', 0)}")
    return 1 if report.get("errors") else 0


if __name__ == "__main__":
    raise SystemExit(main())
