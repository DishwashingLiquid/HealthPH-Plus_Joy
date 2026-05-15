import base64
import json
import os
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from typing_extensions import Annotated

from helpers.miscHelpers import get_ph_datetime
from middleware.requireRole import require_role


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


def _read_content(content_type: str) -> list:
    content_path = _get_content_path(content_type)

    try:
        content = json.loads(content_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"{CONTENT_FILES[content_type]} contains invalid JSON",
        )

    if not isinstance(content, list):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"{CONTENT_FILES[content_type]} must contain a JSON array",
        )

    return content


def _write_content(content_type: str, content: list) -> None:
    content_path = _get_content_path(content_type)
    temp_path = content_path.with_suffix(".tmp")

    temp_path.write_text(
        json.dumps(content, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    temp_path.replace(content_path)


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


async def _encode_media(content_type: str, file: Optional[UploadFile]) -> Optional[dict]:
    if file is None:
        return None

    content_type_header = file.content_type or ""
    allowed_prefixes = CONTENT_MEDIA_PREFIXES[content_type]

    if not content_type_header.startswith(allowed_prefixes):
        allowed_label = " or ".join(prefix.rstrip("/") for prefix in allowed_prefixes)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{content_type.title()} only accepts {allowed_label} uploads",
        )

    contents = await file.read()
    encoded_contents = base64.b64encode(contents).decode("utf-8")

    return {
        "filename": file.filename,
        "contentType": content_type_header,
        "size": len(contents),
        "dataUrl": f"data:{content_type_header};base64,{encoded_contents}",
    }


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
    publishToMobile: Annotated[bool, Form()] = False,
    publishToWebsite: Annotated[bool, Form()] = False,
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

    created_by = {
        "id": str(current_user["_id"]) if current_user else "",
        "name": (
            f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip()
            if current_user
            else ""
        ),
    }

    new_content = {
        "id": str(uuid4()),
        "title": title.strip(),
        "description": description.strip(),
        "tags": _parse_tags(tags),
        "media": media,
        "publishToMobile": publishToMobile,
        "publishToWebsite": publishToWebsite,
        "createdAt": created_at.isoformat(),
        "createdBy": created_by,
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
