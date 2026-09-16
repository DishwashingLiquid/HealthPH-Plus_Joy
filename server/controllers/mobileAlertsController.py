"""Authenticated mobile inbox for prepared automated regional alerts."""
import base64
import json
from datetime import datetime, timezone
from typing import Annotated

from bson import ObjectId
from fastapi import Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
import config.database as database
from middleware.requireMobileAuth import require_mobile_auth
from models.mobileUser import MOBILE_REGISTRATION_SOURCE, MOBILE_ROLE_ID
from region_normalization import REGION_NAMES
from regional_summaries import PH_TZ, now


AUTOMATED_SOURCE = "automated_regional_summary"
PREPARED_DELIVERY_STATUS = "Prepared"

alerts = getattr(database, "regional_alerts_collection", None)
deliveries = getattr(database, "mobile_notification_deliveries_collection", None)
mobile_users = getattr(database, "mobile_users_collection", None)


def _collections_available(*collections):
    return all(collection is not None for collection in collections)


def _require_mobile_user(mobile_user_id: str):
    if not _collections_available(mobile_users):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Mobile alert storage is unavailable")
    user = mobile_users.find_one({
        "id": mobile_user_id,
        "source": MOBILE_REGISTRATION_SOURCE,
        "roleId": MOBILE_ROLE_ID,
    })
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Mobile user not found")
    return user


def _date_iso(value):
    """Return an explicit UTC API timestamp, preserving legacy PH wall time."""
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
    if not isinstance(value, datetime):
        return None
    aware = value.replace(tzinfo=PH_TZ) if value.tzinfo is None else value
    return aware.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _published_at(alert: dict, delivery: dict):
    return _date_iso(
        delivery.get("publishedAt")
        or alert.get("preparedAt")
        or alert.get("createdAt")
        or delivery.get("createdAt")
    )


def _integer(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _symptoms(alert: dict):
    trigger = alert.get("trigger") or {}
    snapshot = trigger.get("summarySnapshot") or {}
    keys = trigger.get("includedSymptomKeys") or []
    labels = snapshot.get("symptomKeyLabels") or {}
    counts = snapshot.get("symptomKeyCounts") or {}
    legacy_labels = trigger.get("includedSymptomLabels") or []
    return [
        {
            "symptomKey": str(key),
            "label": str(labels.get(key) or (legacy_labels[index] if index < len(legacy_labels) else key)),
            "reportCount": _integer(counts.get(key)),
        }
        for index, key in enumerate(keys)
    ]


def _serialize_alert(alert: dict, delivery: dict):
    trigger = alert.get("trigger") or {}
    comparison = trigger.get("comparison")
    return {
        "schemaVersion": 1,
        "id": str(alert.get("_id")),
        "type": "regional_symptom_alert",
        "source": "automated",
        "region": alert.get("region"),
        "regionName": REGION_NAMES.get(alert.get("region"), alert.get("region")),
        "title": alert.get("title") or "Regional self-report alert",
        "message": alert.get("message") or "",
        "reportCount": _integer(trigger.get("reportCount")),
        "threshold": _integer(trigger.get("threshold")),
        "comparison": "gt" if comparison == ">" else comparison,
        "windowMinutes": _integer(trigger.get("intervalMinutes")),
        "windowStart": _date_iso(trigger.get("windowStart")),
        "windowEnd": _date_iso(trigger.get("windowEnd")),
        "symptoms": _symptoms(alert),
        "publishedAt": _published_at(alert, delivery),
        "readAt": _date_iso(delivery.get("readAt")),
    }


def _visible_assignments(mobile_user_id: str):
    """Return only completed recipient assignments for completed automatic alerts."""
    if not _collections_available(alerts, deliveries):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Mobile alert storage is unavailable")
    result = []
    for delivery in deliveries.find({"mobileUserId": mobile_user_id, "status": PREPARED_DELIVERY_STATUS}):
        alert_id = delivery.get("alertId")
        alert = alerts.find_one({
            "_id": alert_id,
            "source": AUTOMATED_SOURCE,
            "status": PREPARED_DELIVERY_STATUS,
        })
        if alert:
            result.append((alert, delivery))
    return result


def _cursor_encode(published_at: str, alert_id: str):
    encoded = json.dumps({"publishedAt": published_at, "id": alert_id}, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(encoded).decode("ascii").rstrip("=")


def _cursor_decode(cursor: str):
    try:
        padding = "=" * (-len(cursor) % 4)
        value = json.loads(base64.urlsafe_b64decode((cursor + padding).encode("ascii")))
        published_at, alert_id = value["publishedAt"], value["id"]
        if not isinstance(published_at, str) or not isinstance(alert_id, str) or not _date_iso(published_at):
            raise ValueError
        return published_at, alert_id
    except (KeyError, TypeError, ValueError, UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid alert cursor")


def _find_assignment(mobile_user_id: str, alert_id: str):
    if not _collections_available(alerts, deliveries):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Mobile alert storage is unavailable")
    if not ObjectId.is_valid(alert_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    alert = alerts.find_one({
        "_id": ObjectId(alert_id),
        "source": AUTOMATED_SOURCE,
        "status": PREPARED_DELIVERY_STATUS,
    })
    delivery = deliveries.find_one({
        "alertId": ObjectId(alert_id),
        "mobileUserId": mobile_user_id,
        "status": PREPARED_DELIVERY_STATUS,
    })
    if not alert or not delivery:
        # Use one response for missing and unassigned alerts to avoid disclosure.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return alert, delivery


async def fetch_mobile_alerts(
    mobile_claims: Annotated[dict, Depends(require_mobile_auth)],
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
):
    mobile_user_id = mobile_claims["sub"]
    _require_mobile_user(mobile_user_id)
    assignments = _visible_assignments(mobile_user_id)
    items = [(_serialize_alert(alert, delivery), delivery) for alert, delivery in assignments]
    items.sort(key=lambda item: (item[0]["publishedAt"] or "", item[0]["id"]), reverse=True)

    if cursor:
        cursor_key = _cursor_decode(cursor)
        items = [item for item in items if (item[0]["publishedAt"] or "", item[0]["id"]) < cursor_key]

    page = items[:limit]
    next_cursor = None
    if len(items) > limit:
        last = page[-1][0]
        next_cursor = _cursor_encode(last["publishedAt"] or "", last["id"])
    unread_count = sum(1 for _alert, delivery in assignments if not delivery.get("readAt"))
    return JSONResponse(status_code=status.HTTP_200_OK, content={
        "items": [item for item, _delivery in page],
        "nextCursor": next_cursor,
        "unreadCount": unread_count,
    })


async def fetch_mobile_alert(alert_id: str, mobile_claims: Annotated[dict, Depends(require_mobile_auth)]):
    mobile_user_id = mobile_claims["sub"]
    _require_mobile_user(mobile_user_id)
    alert, delivery = _find_assignment(mobile_user_id, alert_id)
    return JSONResponse(status_code=status.HTTP_200_OK, content={"item": _serialize_alert(alert, delivery)})


async def mark_mobile_alert_read(alert_id: str, mobile_claims: Annotated[dict, Depends(require_mobile_auth)]):
    mobile_user_id = mobile_claims["sub"]
    _require_mobile_user(mobile_user_id)
    alert, delivery = _find_assignment(mobile_user_id, alert_id)
    if not delivery.get("readAt"):
        deliveries.update_one({"_id": delivery["_id"], "readAt": None}, {"$set": {"readAt": now()}})
        delivery = deliveries.find_one({"_id": delivery["_id"]})
    unread_count = sum(1 for _alert, candidate in _visible_assignments(mobile_user_id) if not candidate.get("readAt"))
    return JSONResponse(status_code=status.HTTP_200_OK, content={
        "item": _serialize_alert(alert, delivery),
        "unreadCount": unread_count,
    })
