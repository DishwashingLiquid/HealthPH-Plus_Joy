import json
from typing import Optional

from fastapi import HTTPException, status

from .constants import (
    ANALYTICS_CONTENT_LABELS,
    FACT_CHECK_CLAIM_STATUSES,
    FACT_CHECK_VERIFIERS,
    HEALTH_LITERACY_LANGUAGES,
)
from .public_metrics import get_public_download_count, get_public_view_count


def serialize_content_document(document: dict) -> dict:
    serialized_document = dict(document)
    content_type = serialized_document.get("contentType")
    content_id = str(serialized_document.get("id", ""))

    if content_type == "infographics":
        serialized_document["downloadCount"] = get_public_download_count(
            content_type,
            content_id,
        )
    elif content_type in {"articles", "videos"}:
        serialized_document["viewCount"] = get_public_view_count(
            content_type,
            content_id,
        )

    serialized_document.pop("_id", None)
    serialized_document.pop("contentType", None)
    return serialized_document


def serialize_mobile_content(document: dict) -> dict:
    serialized_document = serialize_content_document(document)
    serialized_document["contentType"] = document.get("contentType", "")
    return serialized_document


def serialize_website_content(document: dict) -> dict:
    serialized_document = serialize_content_document(document)
    serialized_document["contentType"] = document.get("contentType", "")
    return serialized_document


def parse_tags(tags: Optional[str]) -> list[str]:
    if not tags:
        return []

    try:
        parsed_tags = json.loads(tags)
        if isinstance(parsed_tags, list):
            return [str(tag).strip() for tag in parsed_tags if str(tag).strip()]
    except json.JSONDecodeError:
        pass

    return [tag.strip() for tag in tags.split(",") if tag.strip()]


def normalize_content_languages(content_type: str, tags: Optional[str]) -> list[str]:
    if content_type == "infographics":
        return []

    selected_language_keys = set()
    selected_languages = []

    for tag in parse_tags(tags):
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


def normalize_video_duration(
    content_type: str,
    duration: Optional[str],
    fallback: Optional[str] = "",
) -> str:
    if content_type != "videos":
        return ""

    duration_value = duration if duration is not None else fallback
    return str(duration_value or "").strip()


def validate_content_languages(content_type: str, tags: Optional[str]) -> list[str]:
    selected_languages = normalize_content_languages(content_type, tags)

    if content_type != "infographics" and not selected_languages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please select at least one language",
        )

    return selected_languages


def get_user_snapshot(current_user: Optional[dict]) -> dict:
    if not current_user:
        return {
            "id": "",
            "name": "",
        }

    return {
        "id": str(current_user["_id"]),
        "name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip(),
    }


def get_content_label(content_type: str) -> str:
    return ANALYTICS_CONTENT_LABELS.get(content_type, content_type)


def normalize_fact_check_status(value: Optional[str]) -> str:
    if value in FACT_CHECK_CLAIM_STATUSES:
        return value

    return "Needs Expert Review"


def normalize_fact_check_verifier(value: Optional[str]) -> str:
    if value in FACT_CHECK_VERIFIERS:
        return value

    return "Project Researcher"


def build_fact_check_metadata(
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
        "claimStatus": normalize_fact_check_status(claim_status),
        "verifiedBy": normalize_fact_check_verifier(verified_by),
    }
