from .constants import (
    ALLOWED_FEEDBACK_PLATFORMS,
    ANALYTICS_CONTENT_LABELS,
    health_literacy_analytics_events_collection,
)


def get_content_type_or_match(content_type: str) -> list[dict]:
    return [
        {"content_type_key": content_type},
        {"content_type": content_type},
        {"content_type": ANALYTICS_CONTENT_LABELS.get(content_type, content_type)},
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

    return health_literacy_analytics_events_collection.count_documents(
        {
            "event_type": "content_downloaded",
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

    return health_literacy_analytics_events_collection.count_documents(
        {
            "event_type": "content_opened",
            "content_id": content_id,
            "$and": [
                {"$or": get_content_type_or_match(content_type)},
                {"$or": get_public_event_platform_or_match()},
            ],
        }
    )
