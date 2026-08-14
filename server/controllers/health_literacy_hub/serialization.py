import json
from typing import Optional

from fastapi import HTTPException, status

from .constants import (
    ANALYTICS_CONTENT_LABELS,
    FACT_CHECK_CLAIM_STATUSES,
    FACT_CHECK_VERIFIERS,
    HEALTH_LITERACY_LANGUAGES,
    get_content_type_label,
    get_legacy_content_type,
    normalize_storage_content_type,
)
from .public_metrics import (
    get_public_download_count,
    get_public_share_count,
    get_public_view_count,
)

LANGUAGE_NAME_TO_CODE = {
    "english": "en",
    "filipino": "fil",
    "cebuano": "ceb",
    "ilocano": "ilo",
    "hiligaynon": "hil",
    "en": "en",
    "fil": "fil",
    "ceb": "ceb",
    "ilo": "ilo",
    "hil": "hil",
}
LANGUAGE_CODE_TO_NAME = {
    "en": "English",
    "fil": "Filipino",
    "ceb": "Cebuano",
    "ilo": "Ilocano",
    "hil": "Hiligaynon",
}

FACT_CHECK_STATUS_TO_VERDICT = {
    "False": "False",
    "Misleading": "Needs Context",
    "Verified": "True",
    "Needs Expert Review": "Needs Context",
}


def serialize_content_document(document: dict) -> dict:
    serialized_document = dict(document)
    content_type = normalize_storage_content_type(
        serialized_document.get("contentType"),
        allow_fact_check=True,
    )
    content_id = str(serialized_document.get("id", ""))

    if content_type == "infographic":
        serialized_document["downloadCount"] = get_public_download_count(
            content_type,
            content_id,
        )
    elif content_type in {"article", "video"}:
        serialized_document["viewCount"] = get_public_view_count(
            content_type,
            content_id,
        )

    serialized_document.pop("_id", None)
    serialized_document.pop("contentType", None)
    return serialized_document


def serialize_mobile_content(document: dict) -> dict:
    serialized_document = serialize_content_document(document)
    serialized_document["contentType"] = get_legacy_content_type(
        document.get("contentType", "")
    )
    return serialized_document


def serialize_website_content(document: dict) -> dict:
    serialized_document = serialize_content_document(document)
    serialized_document["contentType"] = get_legacy_content_type(
        document.get("contentType", "")
    )
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


def parse_string_list(value) -> list[str]:
    if value is None:
        return []

    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    return parse_tags(str(value or ""))


def normalize_language_code(value: Optional[str]) -> Optional[str]:
    normalized_value = str(value or "").strip().lower()
    if not normalized_value:
        return None

    return LANGUAGE_NAME_TO_CODE.get(normalized_value)


def split_content_tags_by_schema(document: dict) -> tuple[list[str], list[str]]:
    raw_tags = parse_string_list(document.get("tags"))
    content_tags = []
    language_codes = []

    for tag in raw_tags:
        language_code = normalize_language_code(tag)
        if language_code:
            if language_code not in language_codes:
                language_codes.append(language_code)
            continue

        if tag not in content_tags:
            content_tags.append(tag)

    return content_tags, language_codes


def get_mobile_language(document: dict) -> str:
    explicit_language = normalize_language_code(document.get("language"))
    if explicit_language:
        return explicit_language

    _, language_codes = split_content_tags_by_schema(document)
    if language_codes:
        return language_codes[0]

    return "en"


def get_mobile_topics(document: dict) -> list[str]:
    return parse_string_list(document.get("topics"))


def get_mobile_diseases(document: dict) -> list[str]:
    return parse_string_list(document.get("diseases"))


def get_mobile_content_tags(document: dict) -> list[str]:
    content_tags, _ = split_content_tags_by_schema(document)
    return content_tags


def get_mobile_content_type(document: dict) -> str:
    stored_content_type = normalize_storage_content_type(
        document.get("contentType"),
        allow_fact_check=True,
    )

    if bool(document.get("isFactCheck")) or stored_content_type == "fact_check":
        return "fact_check"

    return stored_content_type or str(document.get("contentType") or "").strip()


def normalize_mobile_content_type_filter(value: Optional[str]) -> Optional[str]:
    if not str(value or "").strip():
        return None

    storage_content_type = normalize_storage_content_type(
        value,
        allow_fact_check=True,
    )
    if storage_content_type:
        return storage_content_type

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Invalid contentType filter: {value}",
    )


def matches_mobile_content_filters(
    document: dict,
    *,
    content_type: Optional[str] = None,
    tags: Optional[list[str]] = None,
    topics: Optional[list[str]] = None,
    diseases: Optional[list[str]] = None,
    language: Optional[str] = None,
) -> bool:
    mobile_content_type = get_mobile_content_type(document)
    if content_type and mobile_content_type != content_type:
        return False

    document_language = get_mobile_language(document)
    requested_language = normalize_language_code(language)
    if requested_language and document_language != requested_language:
        return False

    document_tags = {tag.lower() for tag in get_mobile_content_tags(document)}
    document_topics = {topic.lower() for topic in get_mobile_topics(document)}
    document_diseases = {disease.lower() for disease in get_mobile_diseases(document)}

    if tags and not all(tag.lower() in document_tags for tag in tags):
        return False

    if topics and not all(topic.lower() in document_topics for topic in topics):
        return False

    if diseases and not all(disease.lower() in document_diseases for disease in diseases):
        return False

    return True


def normalize_mobile_verdict(document: dict) -> str:
    explicit_verdict = str(document.get("verdict") or "").strip()
    if explicit_verdict:
        return explicit_verdict

    claim_status = str(document.get("claimStatus") or "").strip()
    return FACT_CHECK_STATUS_TO_VERDICT.get(claim_status, "Needs Context")


def serialize_mobile_contract_content(document: dict) -> dict:
    serialized_document = serialize_content_document(document)
    content_type = normalize_storage_content_type(
        document.get("contentType"),
        allow_fact_check=True,
    ) or str(document.get("contentType") or "").strip()
    content_id = str(document.get("id") or "")
    media = document.get("media") if isinstance(document.get("media"), dict) else {}
    mobile_content_type = get_mobile_content_type(document)
    image_url = str(document.get("imageUrl") or "").strip() or None
    media_url = str(document.get("mediaUrl") or "").strip() or None
    media_type = str(media.get("contentType") or "").strip().lower()
    media_source = str(media.get("url") or "").strip() or None

    if not image_url and media_source:
        if content_type == "infographic":
            image_url = media_source
        elif content_type == "article" and media_type.startswith("image/"):
            image_url = media_source

    if not media_url and media_source:
        if content_type == "video":
            media_url = media_source
        elif content_type == "article" and not media_type.startswith("image/"):
            media_url = media_source

    return {
        "id": content_id,
        "contentType": mobile_content_type,
        "title": str(document.get("title") or "").strip(),
        "description": str(document.get("description") or "").strip(),
        "source": str(document.get("source") or "").strip() or None,
        "author": str(document.get("author") or "").strip() or None,
        "publishedDate": document.get("publishedDate"),
        "externalUrl": str(document.get("externalUrl") or "").strip() or None,
        "imageUrl": image_url,
        "mediaUrl": media_url,
        "claim": str(document.get("claim") or "").strip() or None,
        "verdict": normalize_mobile_verdict(document)
        if mobile_content_type == "fact_check"
        else None,
        "explanation": str(document.get("explanation") or "").strip() or None,
        "tags": get_mobile_content_tags(document),
        "topics": get_mobile_topics(document),
        "diseases": get_mobile_diseases(document),
        "language": get_mobile_language(document),
        "isPublished": bool(
            document.get("isPublished")
            if document.get("isPublished") is not None
            else document.get("publishToMobile") or document.get("publishToWebsite")
        ),
        "publishToMobile": bool(document.get("publishToMobile")),
        "viewCount": serialized_document.get("viewCount", 0),
        "shareCount": get_public_share_count(content_type, content_id),
        "createdAt": document.get("createdAt"),
        "updatedAt": document.get("updatedAt") or document.get("createdAt"),
    }


def normalize_video_duration(
    content_type: str,
    duration: Optional[str],
    fallback: Optional[str] = "",
) -> str:
    if normalize_storage_content_type(content_type) != "video":
        return ""

    duration_value = duration if duration is not None else fallback
    return str(duration_value or "").strip()


def validate_content_language(explicit_language: Optional[str]) -> str:
    language_code = normalize_language_code(explicit_language)
    if not language_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please select a language",
        )

    return language_code


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
    return ANALYTICS_CONTENT_LABELS.get(
        normalize_storage_content_type(content_type) or content_type,
        get_content_type_label(content_type),
    )


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
    verdict: Optional[str] = None,
    explanation: Optional[str] = None,
) -> dict:
    normalized_claim = str(claim or "").strip()

    if is_fact_check and not normalized_claim:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fact-check content requires a claim",
        )

    return {
        "isFactCheck": bool(is_fact_check),
        "claim": normalized_claim if is_fact_check else None,
        "claimStatus": normalize_fact_check_status(claim_status),
        "verifiedBy": normalize_fact_check_verifier(verified_by),
        "verdict": str(verdict or "").strip()
        or FACT_CHECK_STATUS_TO_VERDICT.get(
            normalize_fact_check_status(claim_status),
            "Needs Context",
        ),
        "explanation": str(explanation or "").strip() or None,
    }
