import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Request, status
from jose import JWTError, jwt

from helpers.miscHelpers import get_ph_datetime
from .constants import (
    ALGORITHM,
    ALLOWED_ANALYTICS_EVENTS,
    ALLOWED_FEEDBACK_PLATFORMS,
    ANALYTICS_CONTENT_LABELS,
    ANALYTICS_REGIONS,
    ANALYTICS_TIME_RANGE_DAYS,
    CONTENT_INTERACTION_EVENTS,
    PUBLIC_ANALYTICS_EVENTS,
    SECRET_KEY,
    get_content_type_label,
    get_legacy_content_type,
    normalize_storage_content_type,
    analytics_events_collection,
    user_collection,
)
from .content_bridge import read_content
from .public_metrics import get_public_event_platform_or_match


def get_optional_bearer_user_id(request: Request) -> Optional[str]:
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
            SECRET_KEY,
            algorithms=[ALGORITHM],
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


def get_analytics_seed(value) -> int:
    return sum(ord(char) for char in str(value or ""))


def get_analytics_region(content_type: str, item: dict, index: int = 0) -> str:
    seed = get_analytics_seed(
        f"{content_type}-{item.get('id', '')}-{item.get('title', '')}"
    )
    return ANALYTICS_REGIONS[(seed + index) % len(ANALYTICS_REGIONS)]


def get_range_start_date(time_range: str):
    days = ANALYTICS_TIME_RANGE_DAYS.get(time_range)

    if not days:
        return None

    start_date = get_ph_datetime().replace(hour=0, minute=0, second=0, microsecond=0)
    return start_date - timedelta(days=days - 1)


def parse_content_datetime(value):
    if not value:
        return None

    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


def get_event_content_type_values(content_type: str) -> list[str]:
    if content_type == "all":
        return []

    values = {content_type}
    storage_content_type = normalize_storage_content_type(content_type)
    if storage_content_type:
        values.add(storage_content_type)
        values.add(get_legacy_content_type(storage_content_type))
        values.add(get_content_type_label(storage_content_type))
    else:
        for content_key, content_label in ANALYTICS_CONTENT_LABELS.items():
            if content_label == content_type:
                values.add(content_key)
                values.add(get_legacy_content_type(content_key))

    return list(values)


def get_previous_range_bounds(time_range: str):
    days = ANALYTICS_TIME_RANGE_DAYS.get(time_range)
    current_start = get_range_start_date(time_range)

    if not days or not current_start:
        return None

    return current_start - timedelta(days=days), current_start


def build_content_interaction_match(
    time_range: str,
    content_type: str,
    region: str,
    previous_period: bool = False,
) -> dict:
    match = {
        "event_type": {"$in": list(CONTENT_INTERACTION_EVENTS)},
        "$or": get_public_event_platform_or_match(),
    }
    content_type_values = get_event_content_type_values(content_type)

    if content_type_values:
        match["content_type"] = {"$in": content_type_values}

    if region != "all":
        match["region"] = region

    if previous_period:
        previous_bounds = get_previous_range_bounds(time_range)
        if not previous_bounds:
            return {}

        previous_start, previous_end = previous_bounds
        match["created_at"] = {"$gte": previous_start, "$lt": previous_end}
        return match

    start_date = get_range_start_date(time_range)
    if start_date:
        match["created_at"] = {"$gte": start_date}

    return match


def content_matches_upload_filters(
    item: dict,
    content_type: str,
    index: int,
    selected_content_type: str,
    selected_region: str,
    time_range: str,
) -> bool:
    if selected_content_type != "all" and content_type != selected_content_type:
        return False

    if (
        selected_region != "all"
        and get_analytics_region(content_type, item, index) != selected_region
    ):
        return False

    start_date = get_range_start_date(time_range)
    if not start_date:
        return True

    created_at = parse_content_datetime(item.get("createdAt"))
    if not created_at:
        return True

    return created_at >= start_date


def count_content_pieces(
    time_range: str,
    content_type: str,
    region: str,
) -> int:
    content_count = 0

    for content_key, label in ANALYTICS_CONTENT_LABELS.items():
        if content_type != "all" and label != content_type:
            continue

        for index, item in enumerate(read_content(content_key)):
            if content_matches_upload_filters(
                item=item,
                content_type=label,
                index=index,
                selected_content_type=content_type,
                selected_region=region,
                time_range=time_range,
            ):
                content_count += 1

    return content_count


def count_active_registered_users(region: str) -> int:
    match = {
        "user_type": "USER",
        "is_disabled": {"$ne": True},
    }

    if region != "all":
        match["region"] = region

    return user_collection.count_documents(match)


def get_content_snapshots(content_type: str, region: str) -> list[dict]:
    snapshots = []

    for content_key, label in ANALYTICS_CONTENT_LABELS.items():
        if content_type != "all" and label != content_type:
            continue

        for index, item in enumerate(read_content(content_key)):
            item_region = get_analytics_region(label, item, index)
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


def get_content_interaction_user_count(content_id: str, match: dict) -> int:
    if not content_id or not match:
        return 0

    visitor_ids = analytics_events_collection.distinct(
        "visitor_id",
        {
            **match,
            "content_id": content_id,
        },
    )

    return len([visitor_id for visitor_id in visitor_ids if visitor_id])


def build_content_rank_map(
    content_snapshots: list[dict],
    match: dict,
    total_registered_users: int,
) -> dict:
    if not match:
        return {}

    ranked_content = []

    for content in content_snapshots:
        interacted_users = get_content_interaction_user_count(
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


def build_top_performing_content(
    time_range: str,
    content_type: str,
    region: str,
    total_registered_users: int,
    limit: int = 5,
) -> list[dict]:
    content_snapshots = get_content_snapshots(content_type, region)
    current_match = build_content_interaction_match(
        time_range=time_range,
        content_type=content_type,
        region=region,
    )
    previous_match = build_content_interaction_match(
        time_range=time_range,
        content_type=content_type,
        region=region,
        previous_period=True,
    )
    previous_rank_map = build_content_rank_map(
        content_snapshots,
        previous_match,
        total_registered_users,
    )
    ranked_content = []

    for content in content_snapshots:
        interacted_users = get_content_interaction_user_count(
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


def build_health_literacy_analytics_overview(
    time_range: str,
    content_type: str,
    region: str,
) -> dict:
    content_interaction_match = build_content_interaction_match(
        time_range=time_range,
        content_type=content_type,
        region=region,
    )
    interacted_visitor_ids = analytics_events_collection.distinct(
        "visitor_id",
        content_interaction_match,
    )
    interacted_user_count = len(
        [visitor_id for visitor_id in interacted_visitor_ids if visitor_id]
    )
    total_registered_users = count_active_registered_users(region)
    engagement_rate = (
        (interacted_user_count / total_registered_users) * 100
        if total_registered_users
        else 0
    )

    return {
        "totalContentInteractions": analytics_events_collection.count_documents(
            content_interaction_match
        ),
        "contentPieces": count_content_pieces(
            time_range=time_range,
            content_type=content_type,
            region=region,
        ),
        "engagementRate": engagement_rate,
        "interactedUsers": interacted_user_count,
        "totalRegisteredUsers": total_registered_users,
        "topPerformingContent": build_top_performing_content(
            time_range=time_range,
            content_type=content_type,
            region=region,
            total_registered_users=total_registered_users,
        ),
    }


def build_analytics_event_document(data, request: Request) -> dict:
    authenticated_user_id = get_optional_bearer_user_id(request)
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

    return {
        "event_type": event_type,
        "content_id": data.contentId,
        "content_title": data.contentTitle,
        "content_type": (
            normalize_storage_content_type(data.contentType, allow_fact_check=True)
            or data.contentType
            or "all"
        ),
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
