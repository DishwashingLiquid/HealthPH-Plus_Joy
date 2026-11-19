from .constants import ALLOWED_FEEDBACK_PLATFORMS, normalize_storage_content_type, analytics_events_collection


def public_content_match(content_type, content_id):
    return {"content_type": normalize_storage_content_type(content_type, allow_fact_check=True),
            "content_id": content_id, "client_platform": {"$in": list(ALLOWED_FEEDBACK_PLATFORMS)}}


def get_public_download_count(content_type: str, content_id: str) -> int:
    if not content_id:
        return 0

    return analytics_events_collection.count_documents(
        {
            "event_type": "content_downloaded",
            **public_content_match(content_type, content_id),
        }
    )


def get_public_share_count(content_type: str, content_id: str) -> int:
    if not content_id:
        return 0

    return analytics_events_collection.count_documents(
        {
            "event_type": "content_shared",
            **public_content_match(content_type, content_id),
        }
    )


def get_public_view_count(content_type: str, content_id: str) -> int:
    if not content_id:
        return 0

    return analytics_events_collection.count_documents(
        {
            "event_type": "content_opened",
            **public_content_match(content_type, content_id),
        }
    )
