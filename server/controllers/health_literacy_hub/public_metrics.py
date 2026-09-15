from .constants import (
    ALLOWED_FEEDBACK_PLATFORMS,
    ANALYTICS_CONTENT_LABELS,
    get_content_type_label,
    get_legacy_content_type,
    normalize_storage_content_type,
    analytics_events_collection,
)


def get_content_type_or_match(content_type: str) -> list[dict]:
    storage_content_type = normalize_storage_content_type(content_type, allow_fact_check=True)
    legacy_content_type = (
        get_legacy_content_type(storage_content_type)
        if storage_content_type
        else str(content_type or "")
    )
    content_label = (
        get_content_type_label(storage_content_type)
        if storage_content_type
        else ANALYTICS_CONTENT_LABELS.get(content_type, content_type)
    )

    return [
        {"content_type_key": storage_content_type or content_type},
        {"content_type_key": legacy_content_type},
        {"content_type": storage_content_type or content_type},
        {"content_type": legacy_content_type},
        {"content_type": content_label},
    ]


def get_public_event_platform_or_match() -> list[dict]:
    platform_list = list(ALLOWED_FEEDBACK_PLATFORMS)

    return [
        {"client_platform": {"$in": platform_list}},
        {"metadata.clientPlatform": {"$in": platform_list}},
        {"metadata.client_platform": {"$in": platform_list}},
    ]


def get_public_download_count(content_type: str, content_id: str) -> int:
    if not content_id:
        return 0

    return analytics_events_collection.count_documents(
        {
            "event_type": "content_downloaded",
            "content_id": content_id,
            "$and": [
                {"$or": get_content_type_or_match(content_type)},
                {"$or": get_public_event_platform_or_match()},
            ],
        }
    )


def get_public_share_count(content_type: str, content_id: str) -> int:
    if not content_id:
        return 0

    return analytics_events_collection.count_documents(
        {
            "event_type": "content_shared",
            "content_id": content_id,
            "$and": [
                {"$or": get_content_type_or_match(content_type)},
                {"$or": get_public_event_platform_or_match()},
            ],
        }
    )


def get_public_view_count(content_type: str, content_id: str) -> int:
    if not content_id:
        return 0

    return analytics_events_collection.count_documents(
        {
            "event_type": "content_opened",
            "content_id": content_id,
            "$and": [
                {"$or": get_content_type_or_match(content_type)},
                {"$or": get_public_event_platform_or_match()},
            ],
        }
    )
