"""MongoDB is authoritative. Runtime reads/writes never synchronize repository JSON."""
from fastapi import HTTPException

from .constants import content_collection, get_legacy_content_type, normalize_storage_content_type
from .serialization import serialize_content_document
from health_literacy_media import MediaStore


def get_media_store():
    from config.database import db
    return MediaStore(db)


def require_storage_content_type(content_type):
    value = normalize_storage_content_type(content_type)
    if not value:
        raise HTTPException(404, "Health Literacy Hub content type not found")
    return value


def content_match(content_type):
    value = require_storage_content_type(content_type)
    return {"contentType": {"$in": [value, get_legacy_content_type(value)]}}


def ensure_content_indexes():
    content_collection.create_index([("contentType", 1), ("id", 1)], unique=True,
                                    name="unique_health_literacy_content_type_id")
    content_collection.create_index("media.fileId", name="health_literacy_media_lookup")


def read_content(content_type):
    return [serialize_content_document(item) for item in
            content_collection.find(content_match(content_type)).sort(
                [("isPinned", -1), ("pinnedAt", -1), ("createdAt", -1)])]


def find_content(content_type, content_id):
    items = list(content_collection.find({**content_match(content_type), "id": content_id}))
    if not items:
        raise HTTPException(404, "Health Literacy Hub content not found")
    if len(items) != 1:
        raise HTTPException(409, "Duplicate legacy content IDs require migration review")
    return items[0]


def insert_content(content_type, document):
    document = {**document, "contentType": require_storage_content_type(content_type)}
    ensure_content_indexes()
    content_collection.insert_one(document)
    return document


def revision_match(document):
    return {"_id": document["_id"], "updatedAt": document.get("updatedAt"),
            "media": document.get("media")}


def replace_content(original, updated):
    fields = {key: value for key, value in updated.items() if key != "_id"}
    result = content_collection.update_one(revision_match(original), {"$set": fields})
    if not result.matched_count:
        raise HTTPException(409, "Content changed while editing; reload and try again")


def delete_content(original):
    result = content_collection.delete_one(revision_match(original))
    if not result.deleted_count:
        raise HTTPException(409, "Content changed while deleting; reload and try again")


def published_match(destination, content_type=None):
    query = {destination: True, "isArchived": {"$ne": True}, "isPublished": {"$ne": False}}
    if content_type:
        query.update(content_match(content_type))
    return query


def get_published_mobile_match(content_type=None):
    return published_match("publishToMobile", content_type)


def get_published_website_match(content_type=None):
    return published_match("publishToWebsite", content_type)


def fetch_published_mobile_content(content_type=None):
    return list(content_collection.find(get_published_mobile_match(content_type)).sort(
        [("isPinned", -1), ("pinnedAt", -1), ("createdAt", -1)]))


def fetch_published_website_content(content_type=None):
    return list(content_collection.find(get_published_website_match(content_type)).sort(
        [("isPinned", -1), ("pinnedAt", -1), ("createdAt", -1)]))


def encode_media(content_type, file):
    if file is None:
        return None
    file.file.seek(0)
    return get_media_store().upload(file.file, file.filename, file.content_type, content_type)


def delete_media_file(content_type, media):
    # Legacy source files are preserved for migration/rollback.
    get_media_store().cleanup_safely(media)
