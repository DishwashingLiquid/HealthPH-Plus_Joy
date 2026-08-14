import base64
import json
import mimetypes
import os
import re
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from .constants import (
    CONTENT_FILES,
    CONTENT_MEDIA_PREFIXES,
    _migrated_content_types,
    get_content_bucket,
    get_legacy_content_type,
    get_storage_content_types,
    health_literacy_content_collection,
    health_literacy_folder,
    health_literacy_media_folder,
    normalize_storage_content_type,
)
from .serialization import (
    get_mobile_language,
    parse_string_list,
    parse_tags,
    serialize_content_document,
    split_content_tags_by_schema,
)


def require_storage_content_type(content_type: str) -> str:
    storage_content_type = normalize_storage_content_type(content_type)
    if not storage_content_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health Literacy Hub content type not found",
        )

    return storage_content_type


def require_content_bucket(content_type: str) -> str:
    storage_content_type = require_storage_content_type(content_type)
    content_bucket = get_content_bucket(storage_content_type)
    if not content_bucket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health Literacy Hub content type not found",
        )

    return content_bucket


def get_content_path(content_type: str) -> Path:
    content_bucket = require_content_bucket(content_type)
    os.makedirs(health_literacy_folder, exist_ok=True)
    content_path = health_literacy_folder / CONTENT_FILES[content_bucket]

    if not content_path.exists():
        content_path.write_text("[]", encoding="utf-8")

    return content_path


def get_media_folder(content_type: str) -> Path:
    media_folder = health_literacy_media_folder / require_content_bucket(content_type)
    os.makedirs(media_folder, exist_ok=True)
    return media_folder


def get_media_url(content_type: str, filename: str) -> str:
    return (
        f"/api/health-literacy-hub/media/"
        f"{require_content_bucket(content_type)}/{filename}"
    )


def sanitize_filename(filename: Optional[str]) -> str:
    cleaned_filename = Path(str(filename or "upload")).name
    cleaned_filename = re.sub(r"[^A-Za-z0-9._-]+", "-", cleaned_filename).strip(
        "-._"
    )

    return cleaned_filename or "upload"


def get_media_extension(filename: Optional[str], content_type_header: str) -> str:
    suffix = Path(str(filename or "")).suffix

    if suffix:
        return suffix

    guessed_extension = mimetypes.guess_extension(content_type_header or "")
    return guessed_extension or ".bin"


def ensure_content_indexes() -> None:
    health_literacy_content_collection.create_index(
        [("contentType", 1), ("id", 1)],
        unique=True,
        name="unique_health_literacy_content_type_id",
    )
    health_literacy_content_collection.create_index(
        [
            ("contentType", 1),
            ("publishToMobile", 1),
            ("isArchived", 1),
            ("isPinned", -1),
            ("createdAt", -1),
        ],
        name="health_literacy_mobile_publish_lookup",
    )
    health_literacy_content_collection.create_index(
        [
            ("contentType", 1),
            ("publishToWebsite", 1),
            ("isArchived", 1),
            ("isPinned", -1),
            ("createdAt", -1),
        ],
        name="health_literacy_website_publish_lookup",
    )


def normalize_content_schema_fields(item: dict, storage_content_type: str) -> dict:
    normalized_item = dict(item)
    normalized_item["contentType"] = storage_content_type

    seed_tags = normalized_item.get("tags", [])
    normalized_item["tags"] = (
        [str(tag).strip() for tag in seed_tags if str(tag).strip()]
        if isinstance(seed_tags, list)
        else parse_tags(str(seed_tags or ""))
    )
    normalized_item["topics"] = parse_string_list(normalized_item.get("topics"))
    normalized_item["diseases"] = parse_string_list(normalized_item.get("diseases"))

    content_tags, _ = split_content_tags_by_schema(normalized_item)
    normalized_item["tags"] = content_tags
    normalized_item["language"] = get_mobile_language(normalized_item)

    normalized_item["publishToMobile"] = bool(normalized_item.get("publishToMobile"))
    normalized_item["publishToWebsite"] = bool(
        normalized_item.get("publishToWebsite")
    )
    normalized_item["isArchived"] = bool(normalized_item.get("isArchived"))
    normalized_item["isPinned"] = bool(normalized_item.get("isPinned"))
    normalized_item["isPublished"] = bool(
        normalized_item.get("isPublished")
        if normalized_item.get("isPublished") is not None
        else normalized_item["publishToMobile"] or normalized_item["publishToWebsite"]
    )
    normalized_item["media"] = migrate_data_url_media(
        get_legacy_content_type(storage_content_type),
        normalized_item,
    )

    return normalized_item


def read_json_seed_content(content_type: str) -> list:
    content_path = get_content_path(content_type)

    try:
        content = json.loads(content_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"{CONTENT_FILES[content_type]} contains invalid JSON",
        )

    if isinstance(content, list):
        return content

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"{CONTENT_FILES[content_type]} must contain a JSON array",
    )


def migrate_data_url_media(content_type: str, item: dict) -> dict:
    media = item.get("media")

    if not isinstance(media, dict) or not media.get("dataUrl"):
        return media

    migrated_media = dict(media)
    data_url = str(migrated_media.pop("dataUrl", ""))

    if not data_url.startswith("data:") or ";base64," not in data_url:
        return migrated_media

    header, encoded_data = data_url.split(";base64,", 1)
    content_type_header = migrated_media.get("contentType") or header.replace(
        "data:", ""
    )
    content_id = str(item.get("id") or uuid4())
    safe_filename = sanitize_filename(migrated_media.get("filename"))
    extension = get_media_extension(safe_filename, content_type_header)
    filename_root = Path(safe_filename).stem or "media"
    stored_filename = f"{content_id}-{filename_root}{extension}"
    media_path = get_media_folder(content_type) / stored_filename

    if not media_path.exists():
        try:
            media_path.write_bytes(base64.b64decode(encoded_data))
        except Exception:
            return migrated_media

    migrated_media.update(
        {
            "filename": migrated_media.get("filename") or safe_filename,
            "contentType": content_type_header,
            "size": migrated_media.get("size") or media_path.stat().st_size,
            "storedFilename": stored_filename,
            "url": get_media_url(content_type, stored_filename),
        }
    )

    return migrated_media


def normalize_seed_content_item(content_type: str, item: dict) -> dict:
    storage_content_type = require_storage_content_type(content_type)
    normalized_item = dict(item)
    normalized_item["id"] = str(normalized_item.get("id") or uuid4())
    return normalize_content_schema_fields(normalized_item, storage_content_type)


def migrate_existing_content_documents(storage_content_type: str) -> None:
    existing_content = health_literacy_content_collection.find(
        {
            "contentType": {
                "$in": [
                    storage_content_type,
                    get_legacy_content_type(storage_content_type),
                ]
            }
        }
    )

    for item in existing_content:
        normalized_item = normalize_content_schema_fields(item, storage_content_type)
        normalized_item.pop("_id", None)
        health_literacy_content_collection.replace_one(
            {"_id": item["_id"]},
            normalized_item,
        )


def migrate_existing_data_url_media_documents(content_type: str) -> None:
    storage_content_type = require_storage_content_type(content_type)
    existing_content = health_literacy_content_collection.find(
        {
            "contentType": storage_content_type,
            "media.dataUrl": {"$exists": True},
        }
    )

    for item in existing_content:
        migrated_media = migrate_data_url_media(
            get_legacy_content_type(storage_content_type),
            item,
        )

        health_literacy_content_collection.update_one(
            {"_id": item["_id"]},
            {"$set": {"media": migrated_media}},
        )


def ensure_json_content_migrated(content_type: str) -> None:
    storage_content_type = require_storage_content_type(content_type)

    if storage_content_type in _migrated_content_types:
        return

    ensure_content_indexes()

    for item in read_json_seed_content(storage_content_type):
        if not isinstance(item, dict):
            continue

        normalized_item = normalize_seed_content_item(storage_content_type, item)

        health_literacy_content_collection.update_one(
            {
                "contentType": storage_content_type,
                "id": normalized_item["id"],
            },
            {"$setOnInsert": normalized_item},
            upsert=True,
        )

    migrate_existing_content_documents(storage_content_type)
    migrate_existing_data_url_media_documents(storage_content_type)
    _migrated_content_types.add(storage_content_type)


def read_content(content_type: str) -> list:
    storage_content_type = require_storage_content_type(content_type)
    ensure_json_content_migrated(storage_content_type)

    content = list(
        health_literacy_content_collection.find(
            {"contentType": storage_content_type}
        ).sort([("isPinned", -1), ("pinnedAt", -1), ("createdAt", -1)])
    )

    return [serialize_content_document(item) for item in content]


def write_content(content_type: str, content: list) -> None:
    storage_content_type = require_storage_content_type(content_type)
    ensure_content_indexes()
    content_documents = []
    json_content = []

    for item in content:
        if not isinstance(item, dict):
            continue

        content_document = dict(item)
        content_document.pop("_id", None)
        content_document.pop("likeCount", None)
        content_document.pop("downloadCount", None)
        content_document.pop("viewCount", None)
        content_document["contentType"] = storage_content_type
        content_document["id"] = str(content_document.get("id") or uuid4())
        content_document = normalize_content_schema_fields(
            content_document,
            storage_content_type,
        )
        content_documents.append(content_document)

        json_document = dict(content_document)
        json_document.pop("contentType", None)
        json_content.append(json_document)

    content_ids = [item["id"] for item in content_documents]
    get_content_path(content_type).write_text(
        json.dumps(json_content, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    for content_document in content_documents:
        health_literacy_content_collection.replace_one(
            {
                "contentType": storage_content_type,
                "id": content_document["id"],
            },
            content_document,
            upsert=True,
        )

    health_literacy_content_collection.delete_many(
        {
            "contentType": storage_content_type,
            "id": {"$nin": content_ids},
        }
    )


def get_stored_media_filename(media: Optional[dict]) -> Optional[str]:
    if not isinstance(media, dict):
        return None

    stored_filename = str(media.get("storedFilename") or "").strip()
    if stored_filename:
        safe_filename = Path(stored_filename).name
        if safe_filename == stored_filename:
            return safe_filename

    media_url = str(media.get("url") or "").strip()
    if not media_url:
        return None

    return Path(media_url).name or None


def delete_media_file(content_type: str, media: Optional[dict]) -> None:
    stored_filename = get_stored_media_filename(media)
    if not stored_filename:
        return

    media_folder = get_media_folder(content_type).resolve()
    media_path = (media_folder / stored_filename).resolve()

    if media_folder not in media_path.parents:
        return

    if media_path.exists() and media_path.is_file():
        media_path.unlink()


def get_published_mobile_match(content_type: Optional[str] = None) -> dict:
    match = {
        "publishToMobile": True,
        "isArchived": {"$ne": True},
    }

    if content_type:
        match["contentType"] = require_storage_content_type(content_type)

    return match


def fetch_published_mobile_content(content_type: Optional[str] = None) -> list:
    content_keys = [content_type] if content_type else get_storage_content_types()

    for content_key in content_keys:
        ensure_json_content_migrated(content_key)

    return list(
        health_literacy_content_collection.find(
            get_published_mobile_match(content_type)
        ).sort([("isPinned", -1), ("pinnedAt", -1), ("createdAt", -1)])
    )


def get_published_website_match(content_type: Optional[str] = None) -> dict:
    match = {
        "publishToWebsite": True,
        "isArchived": {"$ne": True},
    }

    if content_type:
        match["contentType"] = require_storage_content_type(content_type)

    return match


def fetch_published_website_content(content_type: Optional[str] = None) -> list:
    content_keys = [content_type] if content_type else get_storage_content_types()

    for content_key in content_keys:
        ensure_json_content_migrated(content_key)

    return list(
        health_literacy_content_collection.find(
            get_published_website_match(content_type)
        ).sort([("isPinned", -1), ("pinnedAt", -1), ("createdAt", -1)])
    )


async def encode_media(content_type: str, file: Optional[UploadFile]) -> Optional[dict]:
    if file is None:
        return None

    content_type_header = file.content_type or ""
    content_bucket = require_content_bucket(content_type)
    allowed_prefixes = CONTENT_MEDIA_PREFIXES[content_bucket]

    if not content_type_header.startswith(allowed_prefixes):
        allowed_label = " or ".join(prefix.rstrip("/") for prefix in allowed_prefixes)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{content_type.title()} only accepts {allowed_label} uploads",
        )

    contents = await file.read()
    safe_filename = sanitize_filename(file.filename)
    extension = get_media_extension(safe_filename, content_type_header)
    filename_root = Path(safe_filename).stem or "media"
    stored_filename = f"{uuid4()}-{filename_root}{extension}"
    media_path = get_media_folder(content_type) / stored_filename
    media_path.write_bytes(contents)

    return {
        "filename": file.filename,
        "contentType": content_type_header,
        "size": len(contents),
        "storedFilename": stored_filename,
        "url": get_media_url(content_bucket, stored_filename),
    }
