"""GridFS storage and HTTP delivery. No database connection or writes on import."""
import hashlib
import ipaddress
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, urlsplit

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException
from fastapi.responses import Response, StreamingResponse
from gridfs import GridFS, NoFile
from jose import JWTError, jwt
from pymongo import ReadPreference
from pymongo.write_concern import WriteConcern

BUCKET_NAME = "health_literacy_media"
BLOCK_SIZE = 256 * 1024
IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm"}
MEDIA_TYPES = IMAGE_TYPES | VIDEO_TYPES | {"application/pdf"}
IMAGE_LIMIT = 25 * 1024 * 1024
VIDEO_LIMIT = 250 * 1024 * 1024
PREVIEW_SECONDS = 900
logger = logging.getLogger(__name__)


def public_api_base_url():
    value = os.getenv("PUBLIC_API_BASE_URL", "").strip().rstrip("/")
    parsed = urlsplit(value)
    host = (parsed.hostname or "").lower().rstrip(".")
    if not host or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise RuntimeError("Set PUBLIC_API_BASE_URL to the externally reachable API base, including /api")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if host == "localhost" or host.endswith(".localhost") or (address and (address.is_loopback or address.is_unspecified)):
        raise RuntimeError("PUBLIC_API_BASE_URL must be reachable by devices; localhost/loopback is forbidden")
    if host == "10.0.2.2":
        raise RuntimeError("PUBLIC_API_BASE_URL must use a host reachable by iPhone simulators and devices")
    production = bool(os.getenv("RENDER")) or os.getenv("APP_ENV", "").lower() == "production"
    local_http = (not production and os.getenv("HEALTH_LITERACY_ALLOW_HTTP") == "true"
                  and address is not None and address.is_private)
    if parsed.scheme != "https" and not (parsed.scheme == "http" and local_http):
        raise RuntimeError("PUBLIC_API_BASE_URL requires HTTPS (opt in to LAN HTTP only for local testing)")
    return value


def media_url(file_id):
    return f"{public_api_base_url()}/health-literacy-hub/media/{ObjectId(str(file_id))}"


def external_url(value):
    """External editorial links remain supported; uploaded assets must use fileId."""
    value = str(value or "").strip()
    if not value:
        return None
    try:
        parsed = urlsplit(value)
        host = (parsed.hostname or "").lower().rstrip(".")
        parsed.port  # Validate malformed ports as well as bracketed hosts.
    except ValueError as error:
        raise HTTPException(400, "Invalid external URL") from error
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if (parsed.scheme != "https" or not host or parsed.username or parsed.password
            or host == "localhost" or host.endswith(".localhost")
            or (address and not address.is_global)
            or "/health-literacy-hub/media/" in parsed.path):
        raise HTTPException(400, "Use an external HTTPS URL or upload the media file")
    return value


def preview_url(file_id, user_id):
    secret = os.getenv("SECRET_KEY")
    if not secret:
        raise RuntimeError("SECRET_KEY is required for admin media previews")
    token = jwt.encode({"sub": str(user_id), "fileId": str(file_id),
                        "purpose": "hub-media-preview", "aud": "hub-media-preview",
                        "exp": datetime.now(timezone.utc) + timedelta(seconds=PREVIEW_SECONDS)},
                       secret, algorithm="HS256")
    return f"{media_url(file_id)}?preview={quote(token)}"


def preview_authorized(token, file_id, users):
    if not token:
        return False
    try:
        payload = jwt.decode(token, os.getenv("SECRET_KEY", ""), algorithms=["HS256"],
                             audience="hub-media-preview")
        if payload.get("purpose") != "hub-media-preview" or payload.get("fileId") != str(file_id):
            return False
        user = users.find_one({"_id": ObjectId(payload["sub"])})
        return bool(user and (user.get("user_type") in {"Admin", "SUPERADMIN"}
                             or user.get("role_label") in {"Admin", "SUPERADMIN"}))
    except (JWTError, InvalidId, ValueError, KeyError, TypeError):
        return False


def serialize_media(media, admin_id=None):
    if not isinstance(media, dict):
        return None
    if not media.get("fileId"):
        # Never expose legacy data URLs or host-specific filesystem URLs.
        return {"filename": media.get("filename"), "contentType": media.get("contentType"),
                "size": media.get("size"), "migrationRequired": True} if admin_id else None
    result = {key: media[key] for key in ("fileId", "filename", "contentType", "size", "sha256") if key in media}
    result["fileId"] = str(result["fileId"])
    result["url"] = media_url(result["fileId"])
    if admin_id:
        result["previewUrl"] = preview_url(result["fileId"], admin_id)
    return result


def validate_signature(header, mime):
    valid = {
        "image/jpeg": header.startswith(b"\xff\xd8\xff"),
        "image/png": header.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/gif": header.startswith((b"GIF87a", b"GIF89a")),
        "image/webp": header[:4] == b"RIFF" and header[8:12] == b"WEBP",
        "video/mp4": header[4:8] == b"ftyp",
        "video/quicktime": header[4:8] in (b"ftyp", b"moov", b"mdat", b"wide"),
        "video/webm": header.startswith(b"\x1a\x45\xdf\xa3"),
        "application/pdf": header.startswith(b"%PDF-"),
    }
    if not valid.get(mime):
        raise HTTPException(400, "File signature does not match its supported media type")


def allowed_media_types(content_type):
    if content_type in {"video", "videos"}:
        return VIDEO_TYPES
    if content_type in {"infographic", "infographics"}:
        return IMAGE_TYPES
    if content_type in {"article", "articles"}:
        return MEDIA_TYPES
    raise HTTPException(404, "Health Literacy Hub content type not found")


class MediaStore:
    def __init__(self, db):
        configured = os.getenv("HEALTH_LITERACY_GRIDFS_BUCKET", BUCKET_NAME)
        if configured != BUCKET_NAME:
            raise RuntimeError(f"HEALTH_LITERACY_GRIDFS_BUCKET must be {BUCKET_NAME}")
        # Verification and reference checks must never use a lagging secondary.
        db = db.with_options(read_preference=ReadPreference.PRIMARY,
                             write_concern=WriteConcern(w="majority"))
        self.db = db
        self.fs = GridFS(db, collection=BUCKET_NAME)
        self.files = db[f"{BUCKET_NAME}.files"]
        self.chunks = db[f"{BUCKET_NAME}.chunks"]
        self.content = db["content"]

    def upload(self, source, filename, mime, content_type, *, metadata=None):
        mime = str(mime or "").lower().split(";", 1)[0].strip()
        if mime not in allowed_media_types(content_type):
            raise HTTPException(400, "Unsupported media type for this content")
        limit = VIDEO_LIMIT if mime in VIDEO_TYPES else IMAGE_LIMIT
        header = source.read(BLOCK_SIZE)
        validate_signature(header, mime)
        filename = re.sub(r"[^A-Za-z0-9._-]+", "-", str(filename or "upload").replace("\\", "/").split("/")[-1])[:180] or "upload"
        stream = self.fs.new_file(filename=filename, chunk_size=BLOCK_SIZE,
                                  metadata={**(metadata or {}), "contentType": mime})
        digest, size = hashlib.sha256(), 0
        try:
            block = header
            while block:
                size += len(block)
                if size > limit:
                    raise HTTPException(413, f"Media exceeds the {limit // (1024 * 1024)} MiB limit")
                digest.update(block)
                stream.write(block)
                block = source.read(BLOCK_SIZE)
            stream.close()
            media = {"fileId": str(stream._id), "filename": filename, "contentType": mime,
                     "size": size, "sha256": digest.hexdigest()}
            self.verify(media)
            self.files.update_one({"_id": stream._id}, {"$set": {"metadata.sha256": media["sha256"], "metadata.verified": True}})
            return media
        except BaseException:
            try:
                stream.abort()
                self.fs.delete(stream._id)
            except Exception:
                logger.exception("GridFS upload cleanup deferred for %s", stream._id)
            raise

    def verify(self, media):
        digest, size = hashlib.sha256(), 0
        with self.fs.get(ObjectId(str(media["fileId"]))) as stored:
            while block := stored.read(BLOCK_SIZE):
                digest.update(block)
                size += len(block)
        if size != media["size"] or digest.hexdigest() != media["sha256"]:
            raise ValueError("GridFS read-back verification failed")

    def delete_unreferenced(self, media):
        if not media or not media.get("fileId"):
            return False
        file_id = ObjectId(str(media["fileId"]))
        # Recheck on every delete, including after an ambiguous write outcome.
        if self.content.find_one({"$or": [{"media.fileId": {"$in": [str(file_id), file_id]}},
                                         {"thumbnail.fileId": {"$in": [str(file_id), file_id]}}]}):
            return False
        self.fs.delete(file_id)
        return True

    def cleanup_safely(self, media):
        try:
            self.delete_unreferenced(media)
        except Exception:
            logger.exception("Hub media cleanup deferred; run orphan maintenance")

    def orphan_report(self, *, apply=False, now=None):
        """Backend maintenance only, with a 24-hour grace period for in-flight uploads."""
        cutoff = (now or datetime.now(timezone.utc)) - timedelta(hours=24)
        report = {"files": [], "incompleteUploads": [], "deleted": 0}
        for file in self.files.find({"uploadDate": {"$lt": cutoff}}):
            media = {"fileId": str(file["_id"])}
            if self.content.find_one({"$or": [{"media.fileId": {"$in": [media["fileId"], file["_id"]]}},
                                             {"thumbnail.fileId": {"$in": [media["fileId"], file["_id"]]}}]}):
                continue
            report["files"].append(media["fileId"])
            if apply and self.delete_unreferenced(media):
                report["deleted"] += 1
        # Interrupted uploads can leave chunks without a files document.
        for file_id in self.chunks.distinct("files_id"):
            if not isinstance(file_id, ObjectId) or file_id.generation_time >= cutoff:
                continue
            if self.files.find_one({"_id": file_id}) or self.content.find_one({"$or": [
                    {"media.fileId": {"$in": [str(file_id), file_id]}},
                    {"thumbnail.fileId": {"$in": [str(file_id), file_id]}}]}):
                continue
            report["incompleteUploads"].append(str(file_id))
            if apply:
                self.chunks.delete_many({"files_id": file_id})
        return report


def parse_range(value, length):
    match = re.fullmatch(r"bytes=(\d*)-(\d*)", value or "")
    if not match or not any(match.groups()) or length <= 0:
        raise ValueError("Invalid range")
    first, last = match.groups()
    if not first:
        suffix = int(last)
        if suffix <= 0:
            raise ValueError("Invalid suffix")
        return max(0, length - suffix), length - 1
    start = int(first)
    end = min(int(last), length - 1) if last else length - 1
    if start >= length or end < start:
        raise ValueError("Unsatisfiable range")
    return start, end


def media_response(store, file_id, request, *, admin=False):
    try:
        object_id = ObjectId(file_id)
    except (InvalidId, ValueError, TypeError):
        raise HTTPException(404, "Media not found")
    query = {"$or": [{"media.fileId": {"$in": [file_id, object_id]}},
                     {"thumbnail.fileId": {"$in": [file_id, object_id]}}]}
    if not admin:
        query.update({"isArchived": {"$ne": True}, "isPublished": {"$ne": False},
                      "$and": [{"$or": [{"publishToMobile": True}, {"publishToWebsite": True}]}]})
    if not store.content.find_one(query):
        raise HTTPException(404, "Media not found")
    try:
        stored = store.fs.get(object_id)
    except NoFile:
        raise HTTPException(404, "Media not found")
    length = stored.length
    etag = f'"{file_id}"'
    headers = {"Accept-Ranges": "bytes", "ETag": etag,
               "Cache-Control": "private, no-store" if admin else "public, max-age=0, must-revalidate",
               "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
               "Content-Disposition": f"inline; filename*=UTF-8''{quote(stored.filename, safe='')}"}
    # Authorization precedes conditional handling, so unpublishing revokes cached access.
    if request.headers.get("if-none-match") in (etag, "*"):
        stored.close()
        return Response(status_code=304, headers=headers)
    start, end, code = 0, length - 1, 200
    range_header = request.headers.get("range")
    if range_header and request.headers.get("if-range", etag) == etag:
        try:
            start, end = parse_range(range_header, length)
        except ValueError:
            stored.close()
            return Response(status_code=416, headers={**headers, "Content-Range": f"bytes */{length}"})
        code = 206
        headers["Content-Range"] = f"bytes {start}-{end}/{length}"
    headers["Content-Length"] = str(end - start + 1)
    mime = (stored.metadata or {}).get("contentType", "application/octet-stream")
    if request.method == "HEAD":
        stored.close()
        return Response(status_code=code, headers=headers, media_type=mime)

    def chunks():
        try:
            stored.seek(start)
            remaining = end - start + 1
            while remaining:
                block = stored.read(min(BLOCK_SIZE, remaining))
                if not block:
                    raise IOError("GridFS file truncated")
                remaining -= len(block)
                yield block
        finally:
            stored.close()

    return StreamingResponse(chunks(), status_code=code, headers=headers, media_type=mime)
