import base64
import json
import mimetypes
import os
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse, JSONResponse
from jose import JWTError, jwt
from typing_extensions import Annotated

from config.database import (
    health_literacy_analytics_events_collection,
    health_literacy_content_collection,
    user_collection,
)
from helpers.miscHelpers import get_ph_datetime
from middleware.requireRole import require_role
from models.healthLiteracyHubAnalytics import (
    HealthLiteracyAnalyticsEvent,
)


CONTENT_FILES = {
    "articles": "articles.json",
    "infographics": "infographics.json",
    "videos": "videos.json",
}

CONTENT_MEDIA_PREFIXES = {
    "articles": ("image/", "video/"),
    "infographics": ("image/",),
    "videos": ("video/",),
}

health_literacy_folder = Path("public/health-literacy-hub")
health_literacy_media_folder = health_literacy_folder / "media"
_migrated_content_types = set()

ANALYTICS_TIME_RANGE_DAYS = {
    "last-7-days": 7,
    "last-30-days": 30,
    "last-90-days": 90,
}

ANALYTICS_CONTENT_LABELS = {
    "articles": "Articles",
    "videos": "Videos",
    "infographics": "Infographics",
}

ANALYTICS_REGIONS = [
    "NCR",
    "I",
    "II",
    "III",
    "IVA",
    "IVB",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
    "XIII",
    "CAR",
    "BARMM",
]

ALLOWED_ANALYTICS_EVENTS = {
    "content_opened",
    "content_shared",
    "content_downloaded",
    "search",
    "report_exported",
}

CONTENT_INTERACTION_EVENTS = {
    "content_opened",
    "content_shared",
    "content_downloaded",
}

PUBLIC_ANALYTICS_EVENTS = {
    "content_opened",
    "content_shared",
    "content_downloaded",
    "search",
}

ALLOWED_FEEDBACK_PLATFORMS = {"mobile", "website"}
HEALTH_LITERACY_LANGUAGES = (
    "English",
    "Filipino",
    "Cebuano",
    "Ilocano",
    "Hiligaynon",
)
FACT_CHECK_CLAIM_STATUSES = {
    "False",
    "Misleading",
    "Verified",
    "Needs Expert Review",
}
FACT_CHECK_VERIFIERS = {
    "DOH",
    "Medical Expert",
    "Project Researcher",
}
def _get_content_path(content_type: str) -> Path:
    if content_type not in CONTENT_FILES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health Literacy Hub content type not found",
        )

    os.makedirs(health_literacy_folder, exist_ok=True)

    content_path = health_literacy_folder / CONTENT_FILES[content_type]

    if not content_path.exists():
        content_path.write_text("[]", encoding="utf-8")

    return content_path


def _get_media_folder(content_type: str) -> Path:
    if content_type not in CONTENT_FILES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health Literacy Hub content type not found",
        )

    media_folder = health_literacy_media_folder / content_type
    os.makedirs(media_folder, exist_ok=True)
    return media_folder


def _get_media_url(content_type: str, filename: str) -> str:
    return f"/api/health-literacy-hub/media/{content_type}/{filename}"


def _sanitize_filename(filename: Optional[str]) -> str:
    cleaned_filename = Path(str(filename or "upload")).name
    cleaned_filename = re.sub(r"[^A-Za-z0-9._-]+", "-", cleaned_filename).strip("-._")

    return cleaned_filename or "upload"


def _get_media_extension(filename: Optional[str], content_type_header: str) -> str:
    suffix = Path(str(filename or "")).suffix

    if suffix:
        return suffix

    guessed_extension = mimetypes.guess_extension(content_type_header or "")
    return guessed_extension or ".bin"


def _serialize_content_document(document: dict) -> dict:
    serialized_document = dict(document)
    content_type = serialized_document.get("contentType")
    content_id = str(serialized_document.get("id", ""))

    if content_type == "infographics":
        serialized_document["downloadCount"] = _get_public_download_count(
            content_type,
            content_id,
        )
    elif content_type in {"articles", "videos"}:
        serialized_document["viewCount"] = _get_public_view_count(
            content_type,
            content_id,
        )

    serialized_document.pop("_id", None)
    serialized_document.pop("contentType", None)
    return serialized_document


def _ensure_content_indexes() -> None:
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


def _read_json_seed_content(content_type: str) -> list:
    content_path = _get_content_path(content_type)

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


def _migrate_data_url_media(content_type: str, item: dict) -> dict:
    media = item.get("media")

    if not isinstance(media, dict) or not media.get("dataUrl"):
        return media

    migrated_media = dict(media)
    data_url = str(migrated_media.pop("dataUrl", ""))

    if not data_url.startswith("data:") or ";base64," not in data_url:
        return migrated_media

    header, encoded_data = data_url.split(";base64,", 1)
    content_type_header = migrated_media.get("contentType") or header.replace("data:", "")
    content_id = str(item.get("id") or uuid4())
    safe_filename = _sanitize_filename(migrated_media.get("filename"))
    extension = _get_media_extension(safe_filename, content_type_header)
    filename_root = Path(safe_filename).stem or "media"
    stored_filename = f"{content_id}-{filename_root}{extension}"
    media_path = _get_media_folder(content_type) / stored_filename

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
            "url": _get_media_url(content_type, stored_filename),
        }
    )

    return migrated_media


def _normalize_seed_content_item(content_type: str, item: dict) -> dict:
    normalized_item = dict(item)
    normalized_item["id"] = str(normalized_item.get("id") or uuid4())
    normalized_item["contentType"] = content_type
    seed_tags = normalized_item.get("tags", [])
    normalized_item["tags"] = (
        [
            str(tag).strip()
            for tag in seed_tags
            if str(tag).strip()
        ]
        if isinstance(seed_tags, list)
        else _parse_tags(str(seed_tags or ""))
    )
    normalized_item["publishToMobile"] = bool(normalized_item.get("publishToMobile"))
    normalized_item["publishToWebsite"] = bool(normalized_item.get("publishToWebsite"))
    normalized_item["isArchived"] = bool(normalized_item.get("isArchived"))
    normalized_item["isPinned"] = bool(normalized_item.get("isPinned"))
    normalized_item["media"] = _migrate_data_url_media(content_type, normalized_item)
    return normalized_item


def _migrate_existing_data_url_media_documents(content_type: str) -> None:
    existing_content = health_literacy_content_collection.find(
        {
            "contentType": content_type,
            "media.dataUrl": {"$exists": True},
        }
    )

    for item in existing_content:
        migrated_media = _migrate_data_url_media(content_type, item)

        health_literacy_content_collection.update_one(
            {"_id": item["_id"]},
            {"$set": {"media": migrated_media}},
        )


def _ensure_json_content_migrated(content_type: str) -> None:
    if content_type in _migrated_content_types:
        return

    _ensure_content_indexes()

    for item in _read_json_seed_content(content_type):
        if not isinstance(item, dict):
            continue

        normalized_item = _normalize_seed_content_item(content_type, item)

        health_literacy_content_collection.update_one(
            {
                "contentType": content_type,
                "id": normalized_item["id"],
            },
            {"$setOnInsert": normalized_item},
            upsert=True,
        )

    _migrate_existing_data_url_media_documents(content_type)
    _migrated_content_types.add(content_type)


def _read_content(content_type: str) -> list:
    if content_type not in CONTENT_FILES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health Literacy Hub content type not found",
        )

    _ensure_json_content_migrated(content_type)

    content = list(
        health_literacy_content_collection.find({"contentType": content_type}).sort(
            [("isPinned", -1), ("pinnedAt", -1), ("createdAt", -1)]
        )
    )

    return [_serialize_content_document(item) for item in content]


def _write_content(content_type: str, content: list) -> None:
    if content_type not in CONTENT_FILES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health Literacy Hub content type not found",
        )

    _ensure_content_indexes()
    content_documents = []

    for item in content:
        if not isinstance(item, dict):
            continue

        content_document = dict(item)
        content_document.pop("_id", None)
        content_document.pop("likeCount", None)
        content_document.pop("downloadCount", None)
        content_document.pop("viewCount", None)
        content_document["contentType"] = content_type
        content_document["id"] = str(content_document.get("id") or uuid4())
        content_documents.append(content_document)

    content_ids = [item["id"] for item in content_documents]

    for content_document in content_documents:
        health_literacy_content_collection.replace_one(
            {
                "contentType": content_type,
                "id": content_document["id"],
            },
            content_document,
            upsert=True,
        )

    health_literacy_content_collection.delete_many(
        {
            "contentType": content_type,
            "id": {"$nin": content_ids},
        }
    )


def _get_content_document(content_type: str, content_id: str) -> dict:
    if content_type not in CONTENT_FILES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health Literacy Hub content type not found",
        )

    _ensure_json_content_migrated(content_type)
    content_item = health_literacy_content_collection.find_one(
        {
            "contentType": content_type,
            "id": content_id,
        }
    )

    if not content_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health Literacy Hub content not found",
        )

    return content_item


def _get_published_mobile_match(content_type: Optional[str] = None) -> dict:
    match = {
        "publishToMobile": True,
        "isArchived": {"$ne": True},
    }

    if content_type:
        if content_type not in CONTENT_FILES:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Health Literacy Hub content type not found",
            )

        match["contentType"] = content_type

    return match


def _fetch_published_mobile_content(content_type: Optional[str] = None) -> list:
    content_keys = [content_type] if content_type else CONTENT_FILES.keys()

    for content_key in content_keys:
        _ensure_json_content_migrated(content_key)

    content = list(
        health_literacy_content_collection.find(
            _get_published_mobile_match(content_type)
        ).sort([("isPinned", -1), ("pinnedAt", -1), ("createdAt", -1)])
    )

    return content


def _serialize_mobile_content(document: dict) -> dict:
    serialized_document = _serialize_content_document(document)
    serialized_document["contentType"] = document.get("contentType", "")
    return serialized_document


def _parse_tags(tags: Optional[str]) -> list[str]:
    if not tags:
        return []

    try:
        parsed_tags = json.loads(tags)
        if isinstance(parsed_tags, list):
            return [
                str(tag).strip()
                for tag in parsed_tags
                if str(tag).strip()
            ]
    except json.JSONDecodeError:
        pass

    return [tag.strip() for tag in tags.split(",") if tag.strip()]


def _normalize_content_languages(content_type: str, tags: Optional[str]) -> list[str]:
    if content_type == "infographics":
        return []

    selected_language_keys = set()
    selected_languages = []

    for tag in _parse_tags(tags):
        matching_language = next(
            (
                language
                for language in HEALTH_LITERACY_LANGUAGES
                if language.lower() == tag.lower()
            ),
            None,
        )

        if not matching_language or matching_language.lower() in selected_language_keys:
            continue

        selected_language_keys.add(matching_language.lower())
        selected_languages.append(matching_language)

    return selected_languages


def _normalize_video_duration(
    content_type: str,
    duration: Optional[str],
    fallback: Optional[str] = "",
) -> str:
    if content_type != "videos":
        return ""

    duration_value = duration if duration is not None else fallback
    return str(duration_value or "").strip()


def _validate_content_languages(content_type: str, tags: Optional[str]) -> list[str]:
    selected_languages = _normalize_content_languages(content_type, tags)

    if content_type != "infographics" and not selected_languages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please select at least one language",
        )

    return selected_languages


def _get_content_type_or_match(content_type: str) -> list[dict]:
    return [
        {"content_type_key": content_type},
        {"content_type": content_type},
        {"content_type": _get_content_label(content_type)},
    ]


def _get_public_event_platform_or_match() -> list[dict]:
    platform_list = list(ALLOWED_FEEDBACK_PLATFORMS)

    return [
        {"client_platform": {"$in": platform_list}},
        {"metadata.clientPlatform": {"$in": platform_list}},
        {"metadata.client_platform": {"$in": platform_list}},
    ]


def _get_public_download_count(content_type: str, content_id: str) -> int:
    if not content_id:
        return 0

    return health_literacy_analytics_events_collection.count_documents(
        {
            "event_type": "content_downloaded",
            "content_id": content_id,
            "$and": [
                {"$or": _get_content_type_or_match(content_type)},
                {"$or": _get_public_event_platform_or_match()},
            ],
        }
    )


def _get_public_view_count(content_type: str, content_id: str) -> int:
    if not content_id:
        return 0

    return health_literacy_analytics_events_collection.count_documents(
        {
            "event_type": "content_opened",
            "content_id": content_id,
            "$and": [
                {"$or": _get_content_type_or_match(content_type)},
                {"$or": _get_public_event_platform_or_match()},
            ],
        }
    )


def _get_optional_bearer_user_id(request: Request) -> Optional[str]:
    authorization = request.headers.get("Authorization", "")

    if not authorization:
        return None

    scheme, _, token = authorization.partition(" ")

    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            token,
            os.getenv("SECRET_KEY"),
            algorithms=[os.getenv("ALGORITHM")],
        )
        user_id = payload.get("sub")

        if not user_id:
            raise JWTError()

        return str(user_id)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def _encode_media(content_type: str, file: Optional[UploadFile]) -> Optional[dict]:
    if file is None:
        return None

    if content_type == "articles":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Articles only accept text content",
        )

    content_type_header = file.content_type or ""
    allowed_prefixes = CONTENT_MEDIA_PREFIXES[content_type]

    if not content_type_header.startswith(allowed_prefixes):
        allowed_label = " or ".join(prefix.rstrip("/") for prefix in allowed_prefixes)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{content_type.title()} only accepts {allowed_label} uploads",
        )

    contents = await file.read()
    safe_filename = _sanitize_filename(file.filename)
    extension = _get_media_extension(safe_filename, content_type_header)
    filename_root = Path(safe_filename).stem or "media"
    stored_filename = f"{uuid4()}-{filename_root}{extension}"
    media_path = _get_media_folder(content_type) / stored_filename
    media_path.write_bytes(contents)

    return {
        "filename": file.filename,
        "contentType": content_type_header,
        "size": len(contents),
        "storedFilename": stored_filename,
        "url": _get_media_url(content_type, stored_filename),
    }


def _get_user_snapshot(current_user: Optional[dict]) -> dict:
    if not current_user:
        return {
            "id": "",
            "name": "",
        }

    return {
        "id": str(current_user["_id"]),
        "name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip(),
    }


def _get_analytics_seed(value) -> int:
    return sum(ord(char) for char in str(value or ""))


def _get_analytics_region(content_type: str, item: dict, index: int = 0) -> str:
    seed = _get_analytics_seed(
        f"{content_type}-{item.get('id', '')}-{item.get('title', '')}"
    )
    return ANALYTICS_REGIONS[(seed + index) % len(ANALYTICS_REGIONS)]


def _get_content_label(content_type: str) -> str:
    return ANALYTICS_CONTENT_LABELS.get(content_type, content_type)


def _normalize_fact_check_status(value: Optional[str]) -> str:
    if value in FACT_CHECK_CLAIM_STATUSES:
        return value

    return "Needs Expert Review"


def _normalize_fact_check_verifier(value: Optional[str]) -> str:
    if value in FACT_CHECK_VERIFIERS:
        return value

    return "Project Researcher"


def _build_fact_check_metadata(
    is_fact_check: bool,
    claim: Optional[str],
    claim_status: Optional[str],
    verified_by: Optional[str],
) -> dict:
    normalized_claim = str(claim or "").strip()

    if is_fact_check and not normalized_claim:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fact-check content requires a claim",
        )

    return {
        "isFactCheck": bool(is_fact_check),
        "claim": normalized_claim if is_fact_check else "",
        "claimStatus": _normalize_fact_check_status(claim_status),
        "verifiedBy": _normalize_fact_check_verifier(verified_by),
    }


def _find_content_index(content: list, content_id: str) -> int:
    content_index = next(
        (index for index, item in enumerate(content) if str(item.get("id")) == content_id),
        None,
    )

    if content_index is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health Literacy Hub content not found",
        )

    return content_index


def _get_range_start_date(time_range: str):
    days = ANALYTICS_TIME_RANGE_DAYS.get(time_range)

    if not days:
        return None

    start_date = get_ph_datetime().replace(hour=0, minute=0, second=0, microsecond=0)
    return start_date - timedelta(days=days - 1)


def _parse_content_datetime(value):
    if not value:
        return None

    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


def _get_event_content_type_values(content_type: str) -> list[str]:
    if content_type == "all":
        return []

    values = {content_type}

    for content_key, content_label in ANALYTICS_CONTENT_LABELS.items():
        if content_label == content_type:
            values.add(content_key)

    return list(values)


def _get_previous_range_bounds(time_range: str):
    days = ANALYTICS_TIME_RANGE_DAYS.get(time_range)
    current_start = _get_range_start_date(time_range)

    if not days or not current_start:
        return None

    return current_start - timedelta(days=days), current_start


def _build_content_interaction_match(
    time_range: str,
    content_type: str,
    region: str,
    previous_period: bool = False,
) -> dict:
    match = {
        "event_type": {"$in": list(CONTENT_INTERACTION_EVENTS)},
        "$or": _get_public_event_platform_or_match(),
    }
    content_type_values = _get_event_content_type_values(content_type)

    if content_type_values:
        match["content_type"] = {"$in": content_type_values}

    if region != "all":
        match["region"] = region

    if previous_period:
        previous_bounds = _get_previous_range_bounds(time_range)
        if not previous_bounds:
            return {}

        previous_start, previous_end = previous_bounds
        match["created_at"] = {"$gte": previous_start, "$lt": previous_end}
        return match

    start_date = _get_range_start_date(time_range)
    if start_date:
        match["created_at"] = {"$gte": start_date}

    return match


def _content_matches_upload_filters(
    item: dict,
    content_type: str,
    index: int,
    selected_content_type: str,
    selected_region: str,
    time_range: str,
) -> bool:
    if selected_content_type != "all" and content_type != selected_content_type:
        return False

    if selected_region != "all" and _get_analytics_region(content_type, item, index) != selected_region:
        return False

    start_date = _get_range_start_date(time_range)
    if not start_date:
        return True

    created_at = _parse_content_datetime(item.get("createdAt"))
    if not created_at:
        return True

    return created_at >= start_date


def _count_content_pieces(
    time_range: str,
    content_type: str,
    region: str,
) -> int:
    content_count = 0

    for content_key, label in ANALYTICS_CONTENT_LABELS.items():
        if content_type != "all" and label != content_type:
            continue

        for index, item in enumerate(_read_content(content_key)):
            if _content_matches_upload_filters(
                item=item,
                content_type=label,
                index=index,
                selected_content_type=content_type,
                selected_region=region,
                time_range=time_range,
            ):
                content_count += 1

    return content_count


def _count_active_registered_users(region: str) -> int:
    match = {
        "user_type": "USER",
        "is_disabled": {"$ne": True},
    }

    if region != "all":
        match["region"] = region

    return user_collection.count_documents(match)


def _get_content_snapshots(content_type: str, region: str) -> list[dict]:
    snapshots = []

    for content_key, label in ANALYTICS_CONTENT_LABELS.items():
        if content_type != "all" and label != content_type:
            continue

        for index, item in enumerate(_read_content(content_key)):
            item_region = _get_analytics_region(label, item, index)
            if region != "all" and item_region != region:
                continue

            snapshots.append(
                {
                    "contentId": str(item.get("id", "")),
                    "title": item.get("title") or "Untitled content",
                    "contentType": label,
                    "contentTypeKey": content_key,
                    "region": item_region,
                }
            )

    return snapshots


def _get_content_interaction_user_count(content_id: str, match: dict) -> int:
    if not content_id or not match:
        return 0

    visitor_ids = health_literacy_analytics_events_collection.distinct(
        "visitor_id",
        {
            **match,
            "content_id": content_id,
        },
    )

    return len([visitor_id for visitor_id in visitor_ids if visitor_id])


def _build_content_rank_map(
    content_snapshots: list[dict],
    match: dict,
    total_registered_users: int,
) -> dict:
    if not match:
        return {}

    ranked_content = []

    for content in content_snapshots:
        interacted_users = _get_content_interaction_user_count(
            content["contentId"],
            match,
        )
        engagement_rate = (
            (interacted_users / total_registered_users) * 100
            if total_registered_users
            else 0
        )
        ranked_content.append(
            {
                **content,
                "interactedUsers": interacted_users,
                "engagementRate": engagement_rate,
            }
        )

    ranked_content = [
        item for item in ranked_content if item["interactedUsers"] > 0
    ]
    ranked_content.sort(
        key=lambda item: (
            -item["engagementRate"],
            -item["interactedUsers"],
            item["title"].lower(),
        )
    )

    return {
        item["contentId"]: index + 1
        for index, item in enumerate(ranked_content)
    }


def _build_top_performing_content(
    time_range: str,
    content_type: str,
    region: str,
    total_registered_users: int,
    limit: int = 5,
) -> list[dict]:
    content_snapshots = _get_content_snapshots(content_type, region)
    current_match = _build_content_interaction_match(
        time_range=time_range,
        content_type=content_type,
        region=region,
    )
    previous_match = _build_content_interaction_match(
        time_range=time_range,
        content_type=content_type,
        region=region,
        previous_period=True,
    )
    previous_rank_map = _build_content_rank_map(
        content_snapshots,
        previous_match,
        total_registered_users,
    )
    ranked_content = []

    for content in content_snapshots:
        interacted_users = _get_content_interaction_user_count(
            content["contentId"],
            current_match,
        )
        engagement_rate = (
            (interacted_users / total_registered_users) * 100
            if total_registered_users
            else 0
        )
        ranked_content.append(
            {
                **content,
                "interactedUsers": interacted_users,
                "engagementRate": engagement_rate,
            }
        )

    ranked_content.sort(
        key=lambda item: (
            -item["engagementRate"],
            -item["interactedUsers"],
            item["title"].lower(),
        )
    )

    top_content = []
    for index, item in enumerate(ranked_content[:limit]):
        current_rank = index + 1
        previous_rank = previous_rank_map.get(item["contentId"])
        trend = "maintained"

        if previous_rank:
            if current_rank < previous_rank:
                trend = "up"
            elif current_rank > previous_rank:
                trend = "down"

        top_content.append(
            {
                **item,
                "rank": current_rank,
                "previousRank": previous_rank,
                "trend": trend,
            }
        )

    return top_content


"""
@desc     Fetch Health Literacy Hub content by type
route     GET api/health-literacy-hub/{content_type}
@access   Private
"""


async def fetch_health_literacy_content(
    content_type: str,
    current_user: Annotated[dict, Depends(require_role(["ADMIN", "SUPERADMIN"]))],
):
    return _read_content(content_type)


"""
@desc     Fetch published Health Literacy Hub content for mobile
route     GET api/health-literacy-hub/mobile
@access   Public
"""


async def fetch_mobile_health_literacy_content():
    return [
        _serialize_mobile_content(item)
        for item in _fetch_published_mobile_content()
    ]


"""
@desc     Fetch published Health Literacy Hub content by type for mobile
route     GET api/health-literacy-hub/mobile/{content_type}
@access   Public
"""


async def fetch_mobile_health_literacy_content_by_type(content_type: str):
    return [
        _serialize_mobile_content(item)
        for item in _fetch_published_mobile_content(content_type)
    ]


"""
@desc     Fetch Health Literacy Hub uploaded media
route     GET api/health-literacy-hub/media/{content_type}/{filename}
@access   Public
"""


async def fetch_health_literacy_media(content_type: str, filename: str):
    media_filename = Path(filename).name

    if media_filename != filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid media filename",
        )

    media_path = _get_media_folder(content_type) / media_filename

    if not media_path.exists() or not media_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health Literacy Hub media not found",
        )

    return FileResponse(path=media_path)


"""
@desc     Fetch Health Literacy Hub overview analytics
route     GET api/health-literacy-hub/analytics/overview
@access   Private
"""


async def fetch_health_literacy_analytics_overview(
    current_user: Annotated[dict, Depends(require_role(["ADMIN", "SUPERADMIN"]))],
    timeRange: str = "last-30-days",
    contentType: str = "all",
    region: str = "all",
):
    content_interaction_match = _build_content_interaction_match(
        time_range=timeRange,
        content_type=contentType,
        region=region,
    )
    interacted_visitor_ids = health_literacy_analytics_events_collection.distinct(
        "visitor_id",
        content_interaction_match,
    )
    interacted_user_count = len(
        [visitor_id for visitor_id in interacted_visitor_ids if visitor_id]
    )
    total_registered_users = _count_active_registered_users(region)
    engagement_rate = (
        (interacted_user_count / total_registered_users) * 100
        if total_registered_users
        else 0
    )

    return {
        "totalContentInteractions": health_literacy_analytics_events_collection.count_documents(
            content_interaction_match
        ),
        "contentPieces": _count_content_pieces(
            time_range=timeRange,
            content_type=contentType,
            region=region,
        ),
        "engagementRate": engagement_rate,
        "interactedUsers": interacted_user_count,
        "totalRegisteredUsers": total_registered_users,
        "topPerformingContent": _build_top_performing_content(
            time_range=timeRange,
            content_type=contentType,
            region=region,
            total_registered_users=total_registered_users,
        ),
    }


"""
@desc     Record Health Literacy Hub analytics event
route     POST api/health-literacy-hub/analytics/events
@access   Public for mobile/website events, private for admin-only events
"""


async def create_health_literacy_analytics_event(
    data: HealthLiteracyAnalyticsEvent,
    request: Request,
):
    authenticated_user_id = _get_optional_bearer_user_id(request)
    event_type = data.eventType.strip()

    if event_type not in ALLOWED_ANALYTICS_EVENTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported Health Literacy Hub analytics event",
        )

    topic = data.topic.strip() if data.topic else None
    vote = data.vote.strip() if data.vote else None
    metadata = data.metadata or {}
    client_platform = (
        data.clientPlatform
        or metadata.get("clientPlatform")
        or metadata.get("client_platform")
    )
    client_platform = client_platform.strip() if client_platform else None
    visitor_id = str(data.visitorId or "").strip()

    if event_type == "search" and not topic:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search analytics events require a topic",
        )

    if client_platform and client_platform not in ALLOWED_FEEDBACK_PLATFORMS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="clientPlatform must be mobile or website",
        )

    if not authenticated_user_id:
        if event_type not in PUBLIC_ANALYTICS_EVENTS:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="This analytics event requires authentication",
            )

        if not client_platform:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Public analytics events require clientPlatform",
            )

        if not visitor_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Public analytics events require visitorId",
            )

    if client_platform:
        metadata = {**metadata, "clientPlatform": client_platform}

    actor_user_id = authenticated_user_id or visitor_id

    event = {
        "event_type": event_type,
        "content_id": data.contentId,
        "content_title": data.contentTitle,
        "content_type": data.contentType or "all",
        "client_platform": client_platform,
        "region": data.region or "all",
        "topic": topic,
        "vote": vote,
        "report_format": data.reportFormat,
        "visitor_id": visitor_id or actor_user_id,
        "user_id": actor_user_id,
        "metadata": metadata,
        "created_at": get_ph_datetime(),
    }

    health_literacy_analytics_events_collection.insert_one(event)

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={"message": "Health Literacy Hub analytics event recorded"},
    )


"""
@desc     Create Health Literacy Hub content
route     POST api/health-literacy-hub/{content_type}
@access   Private
"""


async def create_health_literacy_content(
    content_type: str,
    current_user: Annotated[
        dict, Depends(require_role(["ADMIN", "SUPERADMIN"]))
    ],
    title: Annotated[str, Form()],
    description: Annotated[str, Form()],
    tags: Annotated[Optional[str], Form()] = "",
    duration: Annotated[Optional[str], Form()] = None,
    publishToMobile: Annotated[bool, Form()] = False,
    publishToWebsite: Annotated[bool, Form()] = False,
    isFactCheck: Annotated[bool, Form()] = False,
    claim: Annotated[Optional[str], Form()] = "",
    claimStatus: Annotated[Optional[str], Form()] = "Needs Expert Review",
    verifiedBy: Annotated[Optional[str], Form()] = "Project Researcher",
    file: Annotated[Optional[UploadFile], File()] = None,
):
    if content_type not in CONTENT_FILES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health Literacy Hub content type not found",
        )

    if not title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a title",
        )

    if not description.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a description",
        )

    content = _read_content(content_type)
    media = await _encode_media(content_type, file)
    created_at = get_ph_datetime()

    created_by = _get_user_snapshot(current_user)
    fact_check_metadata = _build_fact_check_metadata(
        isFactCheck,
        claim,
        claimStatus,
        verifiedBy,
    )

    new_content = {
        "id": str(uuid4()),
        "title": title.strip(),
        "description": description.strip(),
        "tags": _validate_content_languages(content_type, tags),
        "media": media,
        "duration": _normalize_video_duration(content_type, duration),
        "publishToMobile": publishToMobile,
        "publishToWebsite": publishToWebsite,
        "createdAt": created_at.isoformat(),
        "lastReviewedAt": created_at.isoformat(),
        "assignedReviewer": "",
        "reviewRequestedAt": "",
        "lastReviewedBy": created_by,
        "isArchived": False,
        "archivedAt": "",
        "archivedBy": {},
        "isPinned": False,
        "pinnedAt": "",
        "pinnedBy": {},
        "createdBy": created_by,
        **fact_check_metadata,
    }

    content.insert(0, new_content)
    _write_content(content_type, content)

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "message": "Health Literacy Hub content created successfully",
            "content": new_content,
        },
    )


"""
@desc     Update Health Literacy Hub content
route     PUT api/health-literacy-hub/{content_type}/{content_id}
@access   Private
"""


async def update_health_literacy_content(
    content_type: str,
    content_id: str,
    current_user: Annotated[
        dict, Depends(require_role(["ADMIN", "SUPERADMIN"]))
    ],
    title: Annotated[str, Form()],
    description: Annotated[str, Form()],
    tags: Annotated[Optional[str], Form()] = "",
    duration: Annotated[Optional[str], Form()] = None,
    publishToMobile: Annotated[bool, Form()] = False,
    publishToWebsite: Annotated[bool, Form()] = False,
    isFactCheck: Annotated[bool, Form()] = False,
    claim: Annotated[Optional[str], Form()] = "",
    claimStatus: Annotated[Optional[str], Form()] = "Needs Expert Review",
    verifiedBy: Annotated[Optional[str], Form()] = "Project Researcher",
    removeMedia: Annotated[bool, Form()] = False,
    file: Annotated[Optional[UploadFile], File()] = None,
):
    if content_type not in CONTENT_FILES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health Literacy Hub content type not found",
        )

    if not title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a title",
        )

    if not description.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a description",
        )

    content = _read_content(content_type)
    content_index = _find_content_index(content, content_id)

    current_content = content[content_index]
    updated_media = current_content.get("media")

    if file is not None:
        updated_media = await _encode_media(content_type, file)
    elif removeMedia:
        updated_media = None

    updated_at = get_ph_datetime()
    fact_check_metadata = _build_fact_check_metadata(
        isFactCheck,
        claim,
        claimStatus,
        verifiedBy,
    )
    updated_content = {
        **current_content,
        "title": title.strip(),
        "description": description.strip(),
        "tags": _validate_content_languages(content_type, tags),
        "media": updated_media,
        "duration": _normalize_video_duration(
            content_type,
            duration,
            current_content.get("duration"),
        ),
        "publishToMobile": publishToMobile,
        "publishToWebsite": publishToWebsite,
        "updatedAt": updated_at.isoformat(),
        "lastReviewedAt": updated_at.isoformat(),
        "updatedBy": _get_user_snapshot(current_user),
        **fact_check_metadata,
    }

    content[content_index] = updated_content
    _write_content(content_type, content)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "message": "Health Literacy Hub content updated successfully",
            "content": updated_content,
        },
    )
