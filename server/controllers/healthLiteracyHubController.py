from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse, JSONResponse
from typing_extensions import Annotated

from middleware.requireRole import require_role
from models.healthLiteracyHubAnalytics import HealthLiteracyAnalyticsEvent
from helpers.miscHelpers import get_ph_datetime
from config.database import health_literacy_analytics_events_collection
from controllers.health_literacy_hub.analytics import (
    build_analytics_event_document,
    build_health_literacy_analytics_overview,
    get_analytics_region,
)
from controllers.health_literacy_hub.constants import CONTENT_FILES
from controllers.health_literacy_hub.content_bridge import (
    delete_media_file,
    encode_media,
    fetch_published_mobile_content,
    fetch_published_website_content,
    get_media_folder,
    read_content,
    write_content,
)
from controllers.health_literacy_hub.serialization import (
    build_fact_check_metadata,
    get_content_label,
    matches_mobile_content_filters,
    normalize_mobile_content_type_filter,
    parse_string_list,
    get_user_snapshot,
    normalize_video_duration,
    serialize_mobile_content,
    serialize_mobile_contract_content,
    serialize_website_content,
    validate_content_language,
)


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


def _serialize_mobile_contract_items(
    *,
    content_type: Optional[str] = None,
    tags: Optional[str] = None,
    topics: Optional[str] = None,
    diseases: Optional[str] = None,
    language: Optional[str] = None,
):
    normalized_content_type = normalize_mobile_content_type_filter(content_type)
    parsed_tags = parse_string_list(tags)
    parsed_topics = parse_string_list(topics)
    parsed_diseases = parse_string_list(diseases)

    matching_documents = []
    for item in fetch_published_mobile_content():
        if matches_mobile_content_filters(
            item,
            content_type=normalized_content_type,
            tags=parsed_tags,
            topics=parsed_topics,
            diseases=parsed_diseases,
            language=language,
        ):
            matching_documents.append(serialize_mobile_contract_content(item))

    return matching_documents


def _parse_optional_datetime(value: Optional[str]) -> Optional[str]:
    normalized_value = str(value or "").strip()
    if not normalized_value:
        return None

    try:
        parsed_datetime = datetime.fromisoformat(normalized_value.replace("Z", "+00:00"))
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid publishedDate value",
        ) from error

    return parsed_datetime.isoformat()


def _parse_optional_string(value: Optional[str]) -> Optional[str]:
    normalized_value = str(value or "").strip()
    return normalized_value or None


"""
@desc     Fetch Health Literacy Hub content by type
route     GET api/health-literacy-hub/{content_type}
@access   Private
"""


async def fetch_health_literacy_content(
    content_type: str,
    current_user: Annotated[dict, Depends(require_role(["Admin", "SUPERADMIN"]))],
):
    return read_content(content_type)


"""
@desc     Fetch published Health Literacy Hub content for mobile
route     GET api/health-literacy-hub/mobile
@access   Public
"""


async def fetch_mobile_health_literacy_content():
    return [
        serialize_mobile_content(item) for item in fetch_published_mobile_content()
    ]


"""
@desc     Fetch published Health Literacy Hub content by type for mobile
route     GET api/health-literacy-hub/mobile/{content_type}
@access   Public
"""


async def fetch_mobile_health_literacy_content_by_type(content_type: str):
    return [
        serialize_mobile_content(item)
        for item in fetch_published_mobile_content(content_type)
    ]


async def fetch_mobile_health_literacy_contract(
    contentType: str | None = Query(default=None),
    tags: str | None = Query(default=None),
    topics: str | None = Query(default=None),
    diseases: str | None = Query(default=None),
    language: str | None = Query(default=None),
):
    return {
        "items": _serialize_mobile_contract_items(
            content_type=contentType,
            tags=tags,
            topics=topics,
            diseases=diseases,
            language=language,
        )
    }


"""
@desc     Fetch published Health Literacy Hub content for website
route     GET api/health-literacy-hub/website
@access   Public
"""


async def fetch_website_health_literacy_content():
    return [
        serialize_website_content(item)
        for item in fetch_published_website_content()
    ]


"""
@desc     Fetch published Health Literacy Hub content by type for website
route     GET api/health-literacy-hub/website/{content_type}
@access   Public
"""


async def fetch_website_health_literacy_content_by_type(content_type: str):
    return [
        serialize_website_content(item)
        for item in fetch_published_website_content(content_type)
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

    media_path = get_media_folder(content_type) / media_filename

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
    current_user: Annotated[dict, Depends(require_role(["Admin", "SUPERADMIN"]))],
    timeRange: str = "last-30-days",
    contentType: str = "all",
    region: str = "all",
):
    return build_health_literacy_analytics_overview(
        time_range=timeRange,
        content_type=contentType,
        region=region,
    )


"""
@desc     Record Health Literacy Hub analytics event
route     POST api/health-literacy-hub/analytics/events
@access   Public for mobile/website events, private for admin-only events
"""


async def create_health_literacy_analytics_event(
    data: HealthLiteracyAnalyticsEvent,
    request: Request,
):
    health_literacy_analytics_events_collection.insert_one(
        build_analytics_event_document(data, request)
    )

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
        dict, Depends(require_role(["Admin", "SUPERADMIN"]))
    ],
    title: Annotated[str, Form()],
    description: Annotated[str, Form()],
    tags: Annotated[Optional[str], Form()] = "",
    topics: Annotated[Optional[str], Form()] = "",
    diseases: Annotated[Optional[str], Form()] = "",
    language: Annotated[Optional[str], Form()] = "",
    duration: Annotated[Optional[str], Form()] = None,
    source: Annotated[Optional[str], Form()] = "",
    author: Annotated[Optional[str], Form()] = "",
    publishedDate: Annotated[Optional[str], Form()] = None,
    externalUrl: Annotated[Optional[str], Form()] = "",
    imageUrl: Annotated[Optional[str], Form()] = "",
    mediaUrl: Annotated[Optional[str], Form()] = "",
    publishToMobile: Annotated[bool, Form()] = False,
    publishToWebsite: Annotated[bool, Form()] = False,
    isFactCheck: Annotated[bool, Form()] = False,
    claim: Annotated[Optional[str], Form()] = "",
    claimStatus: Annotated[Optional[str], Form()] = "Needs Expert Review",
    verifiedBy: Annotated[Optional[str], Form()] = "Project Researcher",
    verdict: Annotated[Optional[str], Form()] = "",
    explanation: Annotated[Optional[str], Form()] = "",
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

    content = read_content(content_type)
    media = await encode_media(content_type, file)
    created_at = get_ph_datetime()
    created_by = get_user_snapshot(current_user)
    fact_check_metadata = build_fact_check_metadata(
        isFactCheck,
        claim,
        claimStatus,
        verifiedBy,
        verdict,
        explanation,
    )
    normalized_topics = parse_string_list(topics)
    normalized_diseases = parse_string_list(diseases)
    normalized_language = str(language or "").strip()
    normalized_published_date = _parse_optional_datetime(publishedDate)

    new_content = {
        "id": str(uuid4()),
        "title": title.strip(),
        "description": description.strip(),
        "tags": parse_string_list(tags),
        "topics": normalized_topics,
        "diseases": normalized_diseases,
        "language": validate_content_language(normalized_language),
        "media": media,
        "duration": normalize_video_duration(content_type, duration),
        "source": _parse_optional_string(source),
        "author": _parse_optional_string(author),
        "publishedDate": normalized_published_date,
        "externalUrl": _parse_optional_string(externalUrl),
        "imageUrl": _parse_optional_string(imageUrl),
        "mediaUrl": _parse_optional_string(mediaUrl),
        "publishToMobile": publishToMobile,
        "publishToWebsite": publishToWebsite,
        "isPublished": bool(publishToMobile or publishToWebsite),
        "createdAt": created_at.isoformat(),
        "updatedAt": created_at.isoformat(),
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
    write_content(content_type, content)

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
        dict, Depends(require_role(["Admin", "SUPERADMIN"]))
    ],
    title: Annotated[str, Form()],
    description: Annotated[str, Form()],
    tags: Annotated[Optional[str], Form()] = "",
    topics: Annotated[Optional[str], Form()] = "",
    diseases: Annotated[Optional[str], Form()] = "",
    language: Annotated[Optional[str], Form()] = "",
    duration: Annotated[Optional[str], Form()] = None,
    source: Annotated[Optional[str], Form()] = "",
    author: Annotated[Optional[str], Form()] = "",
    publishedDate: Annotated[Optional[str], Form()] = None,
    externalUrl: Annotated[Optional[str], Form()] = "",
    imageUrl: Annotated[Optional[str], Form()] = "",
    mediaUrl: Annotated[Optional[str], Form()] = "",
    publishToMobile: Annotated[bool, Form()] = False,
    publishToWebsite: Annotated[bool, Form()] = False,
    isFactCheck: Annotated[bool, Form()] = False,
    claim: Annotated[Optional[str], Form()] = "",
    claimStatus: Annotated[Optional[str], Form()] = "Needs Expert Review",
    verifiedBy: Annotated[Optional[str], Form()] = "Project Researcher",
    verdict: Annotated[Optional[str], Form()] = "",
    explanation: Annotated[Optional[str], Form()] = "",
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

    content = read_content(content_type)
    content_index = _find_content_index(content, content_id)

    current_content = content[content_index]
    updated_media = current_content.get("media")

    if file is not None:
        updated_media = await encode_media(content_type, file)
    elif removeMedia:
        updated_media = None

    updated_at = get_ph_datetime()
    fact_check_metadata = build_fact_check_metadata(
        isFactCheck,
        claim,
        claimStatus,
        verifiedBy,
        verdict,
        explanation,
    )
    normalized_topics = parse_string_list(topics)
    normalized_diseases = parse_string_list(diseases)
    normalized_language = str(language or "").strip()
    normalized_published_date = _parse_optional_datetime(publishedDate)
    updated_content = {
        **current_content,
        "title": title.strip(),
        "description": description.strip(),
        "tags": parse_string_list(tags),
        "topics": normalized_topics,
        "diseases": normalized_diseases,
        "language": validate_content_language(normalized_language),
        "media": updated_media,
        "duration": normalize_video_duration(
            content_type,
            duration,
            current_content.get("duration"),
        ),
        "source": _parse_optional_string(source),
        "author": _parse_optional_string(author),
        "publishedDate": normalized_published_date,
        "externalUrl": _parse_optional_string(externalUrl),
        "imageUrl": _parse_optional_string(imageUrl),
        "mediaUrl": _parse_optional_string(mediaUrl),
        "publishToMobile": publishToMobile,
        "publishToWebsite": publishToWebsite,
        "isPublished": bool(publishToMobile or publishToWebsite),
        "updatedAt": updated_at.isoformat(),
        "lastReviewedAt": updated_at.isoformat(),
        "updatedBy": get_user_snapshot(current_user),
        **fact_check_metadata,
    }

    content[content_index] = updated_content
    write_content(content_type, content)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "message": "Health Literacy Hub content updated successfully",
            "content": updated_content,
        },
    )


"""
@desc     Delete Health Literacy Hub content
route     DELETE api/health-literacy-hub/{content_type}/{content_id}
@access   Private
"""


async def delete_health_literacy_content(
    content_type: str,
    content_id: str,
    current_user: Annotated[
        dict, Depends(require_role(["Admin", "SUPERADMIN"]))
    ],
):
    if content_type not in CONTENT_FILES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health Literacy Hub content type not found",
        )

    content = read_content(content_type)
    content_index = _find_content_index(content, content_id)
    deleted_content = content.pop(content_index)

    delete_media_file(content_type, deleted_content.get("media"))
    write_content(content_type, content)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "message": "Health Literacy Hub content deleted successfully",
            "content": deleted_content,
        },
    )
