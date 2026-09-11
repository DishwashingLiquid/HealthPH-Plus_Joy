"""Saved regional symptom summaries and manually reviewed mobile alerts.

This module deliberately does not infer conditions from reports.  It persists
the literal submitted symptom values used by each report and only exposes
those counts to authorised administrators.
"""
import config.database as database
from datetime import datetime, timedelta
from typing_extensions import Annotated

from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from helpers.miscHelpers import get_ph_datetime
from middleware.requireAuth import require_auth


from region_normalization import REGIONS, REGION_NAMES, normalize_region
from regional_summaries import SummaryStore


# getattr keeps the existing isolated mobile-report tests compatible with their
# deliberately small config.database fake.
summaries = getattr(database, "regional_symptom_summaries_collection", None)
summary_events = getattr(database, "regional_summary_events_collection", None)
alerts = getattr(database, "regional_alerts_collection", None)
deliveries = getattr(database, "mobile_notification_deliveries_collection", None)
mobile_users = getattr(database, "mobile_users_collection", None)
users = getattr(database, "user_collection", None)
self_reports = getattr(database, "self_reports_collection", None)
settings = getattr(database, "application_settings_collection", None)


def _collections_available(*collections):
    return all(collection is not None for collection in collections)


class RegionalAlertPayload(BaseModel):
    title: str
    region: str
    message: str
    scheduledAt: str

    @field_validator("title", "message")
    @classmethod
    def required_text(cls, value, info):
        value = str(value or "").strip()
        if not value:
            raise ValueError(f"{info.field_name} is required")
        if len(value) > (160 if info.field_name == "title" else 2000):
            raise ValueError(f"{info.field_name} is too long")
        return value

    @field_validator("region")
    @classmethod
    def valid_region(cls, value):
        value = normalize_region(value)
        if value not in REGIONS:
            raise ValueError("region must be a predefined Philippine region")
        return value


def _as_datetime(value, field="scheduledAt"):
    try:
        parsed = datetime.fromisoformat(str(value or "").strip().replace("Z", "+00:00"))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=f"{field} must be a valid ISO date and time") from error
    return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed


async def require_regional_alert_user(user_id: Annotated[str, Depends(require_auth)]):
    user = users.find_one({"_id": ObjectId(user_id)}) if users is not None and ObjectId.is_valid(user_id) else None
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    # Temporary access policy: any authenticated dashboard account may review,
    # schedule, and cancel regional alerts. Keep authentication in place.
    return user


def ensure_regional_alert_indexes():
    if not _collections_available(summaries, summary_events, alerts, deliveries):
        return
    summaries.create_index("region", unique=True, name="unique_regional_symptom_summary")
    summary_events.create_index([("region", 1), ("reportId", 1)], unique=True, name="unique_regional_summary_report")
    alerts.create_index([("status", 1), ("scheduledAt", 1)], name="regional_alert_due")
    deliveries.create_index([("alertId", 1), ("mobileUserId", 1)], unique=True, name="unique_regional_alert_delivery")


def update_regional_summary_for_report(report: dict):
    if not _collections_available(summaries, summary_events):
        import logging
        logging.getLogger(__name__).error("Regional summary storage unavailable; reconcile sources")
        return {"status": "failed", "reason": "storage_unavailable"}
    return SummaryStore(self_reports, summary_events, summaries, settings).update_report(report)


def serialize_summary(item):
    return {"region": item.get("region"), "regionName": REGION_NAMES.get(item.get("region"), item.get("region")), "reportCount": int(item.get("reportCount") or 0),
            "symptomCounts": item.get("symptomCounts") or [], "updatedAt": _iso(item.get("updatedAt")),
            "notice": "Counts reflect submitted symptoms only and are not diagnoses."}


def _iso(value):
    return value.isoformat() if isinstance(value, datetime) else str(value or "")


def serialize_alert(item):
    return {"id": str(item.get("_id")), "title": item.get("title"), "region": item.get("region"),
            "message": item.get("message"), "status": item.get("status"), "scheduledAt": _iso(item.get("scheduledAt")),
            "sentAt": _iso(item.get("sentAt")), "cancelledAt": _iso(item.get("cancelledAt")),
            "recipientCount": int(item.get("recipientCount") or 0), "deliveryError": item.get("deliveryError") or ""}


async def fetch_regional_summaries(_user: Annotated[dict, Depends(require_regional_alert_user)]):
    items = list(summaries.find({"isReady": True})) if summaries is not None else []
    items.sort(key=lambda item: REGIONS.index(item.get("region")) if item.get("region") in REGIONS else len(REGIONS))
    return JSONResponse(status_code=200, content={"items": [serialize_summary(item) for item in items]})


async def fetch_regional_alerts(_user: Annotated[dict, Depends(require_regional_alert_user)]):
    items = list(alerts.find({}).sort([("scheduledAt", -1), ("createdAt", -1)])) if alerts is not None else []
    return JSONResponse(status_code=200, content={"items": [serialize_alert(item) for item in items]})


async def create_regional_alert(payload: RegionalAlertPayload, user: Annotated[dict, Depends(require_regional_alert_user)]):
    ensure_regional_alert_indexes()
    scheduled_at = _as_datetime(payload.scheduledAt)
    if scheduled_at <= get_ph_datetime():
        raise HTTPException(status_code=400, detail="scheduledAt must be in the future")
    now = get_ph_datetime()
    alert = {"title": payload.title, "region": payload.region, "message": payload.message, "scheduledAt": scheduled_at,
             "status": "Scheduled", "recipientCount": 0, "createdAt": now, "updatedAt": now,
             "createdBy": {"id": str(user.get("_id")), "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()}}
    result = alerts.insert_one(alert)
    alert["_id"] = result.inserted_id
    return JSONResponse(status_code=201, content={"message": "Alert scheduled for admin-reviewed delivery", "item": serialize_alert(alert)})


async def cancel_regional_alert(alert_id: str, _user: Annotated[dict, Depends(require_regional_alert_user)]):
    if not ObjectId.is_valid(alert_id):
        raise HTTPException(status_code=404, detail="Alert not found")
    now = get_ph_datetime()
    result = alerts.find_one_and_update({"_id": ObjectId(alert_id), "status": "Scheduled", "scheduledAt": {"$gt": now}},
        {"$set": {"status": "Cancelled", "cancelledAt": now, "updatedAt": now}}, return_document=ReturnDocument.AFTER)
    if not result:
        raise HTTPException(status_code=400, detail="Only scheduled alerts before their send time can be cancelled")
    return JSONResponse(status_code=200, content={"item": serialize_alert(result)})


def process_due_regional_alerts():
    """Claim each due alert once and create one durable mobile-delivery record/user.

    The unique delivery index means a restart or repeated scheduler tick cannot
    send/target a recipient twice.  The mobile client/push worker consumes this
    existing-data outbox; accounts without a registered device remain excluded.
    """
    if not _collections_available(alerts, deliveries, mobile_users):
        return 0
    ensure_regional_alert_indexes()
    now, sent = get_ph_datetime(), 0
    due_query = {"$or": [
        {"status": "Scheduled", "scheduledAt": {"$lte": now}},
        # Recover safely when a worker died after claiming but before marking
        # Sent. Existing unique delivery rows are counted below.
        {"status": "Sending", "deliveryClaimedAt": {"$lte": now - timedelta(minutes=5)}},
    ]}
    for candidate in alerts.find(due_query):
        claimed = alerts.find_one_and_update({"_id": candidate["_id"], "status": candidate["status"]},
            {"$set": {"status": "Sending", "deliveryClaimedAt": now, "updatedAt": now}}, return_document=ReturnDocument.AFTER)
        if not claimed:
            continue
        recipients = mobile_users.find({"regionCode": claimed["region"], "source": "mobile_registration", "roleId": "user"})
        failures = []
        for recipient in recipients:
            # A user record is an available mobile target. The outbox is the
            # idempotent handoff point for the deployment's push transport.
            try:
                deliveries.insert_one({"alertId": claimed["_id"], "mobileUserId": recipient["id"], "region": claimed["region"],
                                       "title": claimed["title"], "message": claimed["message"], "status": "Queued", "createdAt": now})
            except DuplicateKeyError:
                pass
            except Exception as error:
                failures.append(str(error)[:160])
        count = deliveries.count_documents({"alertId": claimed["_id"]})
        completion = {"status": "Sent", "sentAt": now, "updatedAt": now, "recipientCount": count}
        if failures:
            completion["deliveryError"] = f"{len(failures)} recipient delivery record(s) could not be queued."
        alerts.update_one({"_id": claimed["_id"], "status": "Sending"}, {"$set": completion})
        sent += 1
    return sent
