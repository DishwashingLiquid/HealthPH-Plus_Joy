"""Ordered article galleries. Multipart file field names bind uploads to entry IDs."""
import json
import re

from fastapi import HTTPException, Request
from fastapi.routing import APIRoute
from starlette.datastructures import UploadFile

from health_literacy_media import IMAGE_TYPES, serialize_media

GALLERY_COUNT_LIMIT = 10
CAPTION_LIMIT = 1000
ALT_LIMIT = 500
# Existing main video (250 MiB), gallery uploads (75 MiB combined),
# plus 1 MiB for multipart boundaries and text fields.
REQUEST_LIMIT = 326 * 1024 * 1024
GALLERY_BYTES_LIMIT = 75 * 1024 * 1024
ENTRY_ID = re.compile(r"[A-Za-z0-9_-]{1,100}\Z")


class HubUploadRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def bounded(request):
            if request.method in {"POST", "PUT"}:
                try:
                    length = int(request.headers.get("content-length", "0"))
                except ValueError:
                    raise HTTPException(400, "Invalid Content-Length")
                if length > REQUEST_LIMIT:
                    raise HTTPException(413, "Upload request exceeds 326 MiB")
                receive = request._receive
                size = 0

                async def limited_receive():
                    nonlocal size
                    message = await receive()
                    size += len(message.get("body", b""))
                    if size > REQUEST_LIMIT:
                        raise HTTPException(413, "Upload request exceeds 326 MiB")
                    return message

                request._receive = limited_receive
            return await handler(request)

        return bounded


async def gallery_uploads(request: Request):
    form = await request.form()
    uploads = {}
    for key, value in form.multi_items():
        if key.startswith("galleryFile_"):
            entry_id = key.removeprefix("galleryFile_")
            if not isinstance(value, UploadFile) or entry_id in uploads:
                raise HTTPException(400, "Each gallery entry needs one uniquely keyed upload")
            uploads[entry_id] = value
    if len(form.getlist("galleryImages")) > 1:
        raise HTTPException(400, "Send galleryImages only once")
    return uploads


def serialize_gallery(document, admin_id=None):
    return [{"id": entry["id"], "media": serialize_media(entry.get("media"), admin_id),
             "caption": entry.get("caption", ""), "alt": entry.get("alt", "")}
            for entry in document.get("galleryImages", [])]


def prepare_gallery(content_type, raw, uploads, current=None):
    """Validate all metadata and references before writing any files.

    Existing references are accepted only for the same entry on this article.
    Admin role authorization happens in the controller; arbitrary file IDs, even
    from another article or unreferenced uploads, cannot be attached.
    """
    current = current or {}
    if raw is None:
        if uploads:
            raise HTTPException(400, "Gallery uploads require galleryImages metadata")
        return None
    if content_type != "articles":
        raise HTTPException(400, "Image galleries are supported for articles only")
    try:
        entries = json.loads(raw)
    except (ValueError, TypeError):
        raise HTTPException(400, "galleryImages must be a JSON array")
    if not isinstance(entries, list) or len(entries) > GALLERY_COUNT_LIMIT:
        raise HTTPException(400, "An article supports at most 10 gallery images")
    existing = {entry["id"]: entry["media"] for entry in current.get("galleryImages", [])}
    main = current.get("media") or {}
    if main.get("fileId") and main.get("contentType") in IMAGE_TYPES:
        existing[f"main-{main['fileId']}"] = main
    seen, result, used_uploads = set(), [], set()
    total_bytes = 0
    for entry in entries:
        if not isinstance(entry, dict):
            raise HTTPException(400, "Invalid gallery entry")
        entry_id = entry.get("id")
        if not isinstance(entry_id, str) or not ENTRY_ID.fullmatch(entry_id) or entry_id in seen:
            raise HTTPException(400, "Gallery entry IDs must be unique and stable")
        seen.add(entry_id)
        text = {}
        for key, limit in (("caption", CAPTION_LIMIT), ("alt", ALT_LIMIT)):
            value = entry.get(key, "")
            if not isinstance(value, str) or len(value) > limit:
                raise HTTPException(400, f"Gallery {key} must be text of at most {limit} characters")
            text[key] = value.strip()
        upload = uploads.get(entry_id)
        media = existing.get(entry_id)
        if upload:
            if upload.content_type not in IMAGE_TYPES:
                raise HTTPException(400, "Gallery uploads must be JPG, PNG, GIF, or WEBP images")
            used_uploads.add(entry_id)
            total_bytes += upload.size or 0
            media = None
        elif (not media or str(media.get("fileId")) != entry.get("fileId")):
            raise HTTPException(400, "Existing gallery file is not authorized for this entry")
        result.append({"id": entry_id, "media": media, **text})
    if used_uploads != set(uploads):
        raise HTTPException(400, "Gallery upload has no matching entry ID")
    if total_bytes > GALLERY_BYTES_LIMIT:
        raise HTTPException(413, "Gallery uploads exceed the combined 75 MiB limit")
    return result


def store_gallery(entries, uploads, encode, newly_uploaded):
    for entry in entries:
        if entry["id"] in uploads:
            media = encode("infographics", uploads[entry["id"]])
            newly_uploaded.append(media)
            entry["media"] = media
    return entries
