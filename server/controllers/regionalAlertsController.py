"""Dashboard regional-alert settings and durable automatic alert preparation.

Automatic alerts end at a per-user preparation outbox.  This module never
claims device delivery: mobile inbox and push transports intentionally live
outside this dashboard/backend feature.
"""
from datetime import datetime, timedelta
from uuid import uuid4
from typing_extensions import Annotated

from bson import ObjectId
from fastapi import Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

import config.database as database
from helpers.miscHelpers import get_ph_datetime
from middleware.requireAuth import require_auth
from region_normalization import REGIONS, REGION_NAMES, normalize_region
from regional_summaries import (ALLOWED_INTERVALS, AUTOMATION_SETTINGS_ID, SummaryStore,
                                now, settings_values)

summaries = getattr(database, "regional_symptom_summaries_collection", None)
summary_events = getattr(database, "regional_summary_events_collection", None)
alerts = getattr(database, "regional_alerts_collection", None)
deliveries = getattr(database, "mobile_notification_deliveries_collection", None)
mobile_users = getattr(database, "mobile_users_collection", None)
users = getattr(database, "user_collection", None)
self_reports = getattr(database, "self_reports_collection", None)
settings = getattr(database, "application_settings_collection", None)
batch_states = getattr(database, "regional_alert_batch_states_collection", None)
cooldowns = getattr(database, "regional_alert_cooldowns_collection", None)


def _collections_available(*collections): return all(collection is not None for collection in collections)


class RegionalAlertSettingsPayload(BaseModel):
    enabled: bool
    threshold: int = 5
    intervalMinutes: int = 1440

    @field_validator("threshold")
    @classmethod
    def positive_threshold(cls, value):
        if value < 1: raise ValueError("threshold must be a positive integer")
        return value

    @field_validator("intervalMinutes")
    @classmethod
    def allowed_interval(cls, value):
        if value not in ALLOWED_INTERVALS: raise ValueError("intervalMinutes must be 15, 30, 60, 480, 720, or 1440")
        return value


async def require_regional_alert_user(user_id: Annotated[str, Depends(require_auth)]):
    user = users.find_one({"_id": ObjectId(user_id)}) if users is not None and ObjectId.is_valid(user_id) else None
    if not user: raise HTTPException(status_code=401, detail="User not found")
    return user


def ensure_regional_alert_indexes():
    """Called at startup only; ordinary scheduler ticks do not build indexes."""
    if _collections_available(summaries, summary_events, alerts, deliveries):
        summaries.create_index("region", unique=True, name="unique_regional_symptom_summary")
        summary_events.create_index([("region", 1), ("reportId", 1)], unique=True, name="unique_regional_summary_report")
        summary_events.create_index([("region", 1), ("consumedBatchId", 1), ("occurredAt", 1)], name="regional_active_summary_events")
        alerts.create_index([("batchId", 1)], unique=True, sparse=True, name="unique_automatic_alert_batch")
        alerts.create_index([("status", 1), ("scheduledAt", 1)], name="regional_alert_due")
        deliveries.create_index([("alertId", 1), ("mobileUserId", 1)], unique=True, name="unique_regional_alert_delivery")
    if _collections_available(batch_states, cooldowns):
        cooldowns.create_index([("region", 1), ("symptomKey", 1)], unique=True, name="regional_symptom_cooldown")
        batch_states.create_index([("status", 1), ("nextEligibleAt", 1)], name="regional_alert_state_due")


def _store(): return SummaryStore(self_reports, summary_events, summaries, settings)


def _settings_document():
    document = settings.find_one({"_id": AUTOMATION_SETTINGS_ID}) if settings is not None else None
    return {**(document or {}), **settings_values(document)}


def _iso(value): return value.isoformat() if isinstance(value, datetime) else str(value or "")


def _serialize_settings(document):
    value = _settings_document() if document is None else {**document, **settings_values(document)}
    return {"enabled": value["enabled"], "threshold": value["threshold"], "intervalMinutes": value["intervalMinutes"],
            "lastSuccessfulEvaluation": _iso(value.get("lastSuccessfulEvaluation")), "nextScheduledReconciliation": _iso(value.get("nextScheduledReconciliation")),
            "lastEvaluationError": value.get("lastEvaluationError") or "", "status": "Enabled" if value["enabled"] else "Paused"}


def serialize_summary(item, state=None):
    return {"region": item.get("region"), "regionName": REGION_NAMES.get(item.get("region"), item.get("region")), "reportCount": int(item.get("reportCount") or 0),
            "symptomCounts": item.get("symptomCounts") or [], "updatedAt": _iso(item.get("updatedAt")),
            "automationStatus": (state or {}).get("status") or "Active", "nextEligibleAt": _iso((state or {}).get("nextEligibleAt")),
            "notice": "Counts reflect eligible submitted symptoms only and are not diagnoses."}


def serialize_alert(item):
    automatic = item.get("source") == "automated_regional_summary"
    return {"id": str(item.get("_id")), "title": item.get("title"), "region": item.get("region"), "message": item.get("message"), "status": item.get("status"),
            "scheduledAt": _iso(item.get("scheduledAt")), "sentAt": _iso(item.get("sentAt")), "cancelledAt": _iso(item.get("cancelledAt")),
            "recipientCount": int(item.get("recipientCount") or 0), "deliveryError": item.get("deliveryError") or "", "automated": automatic,
            "reportCount": int(item.get("trigger", {}).get("reportCount") or 0), "intervalMinutes": item.get("trigger", {}).get("intervalMinutes"),
            "generatedAt": _iso(item.get("createdAt")), "preparationStatus": item.get("status") if automatic else None}


async def fetch_regional_summaries(_user: Annotated[dict, Depends(require_regional_alert_user)]):
    items = list(summaries.find({"isReady": True})) if summaries is not None else []
    states = {item.get("_id"): item for item in batch_states.find({})} if batch_states is not None else {}
    items.sort(key=lambda item: REGIONS.index(item.get("region")) if item.get("region") in REGIONS else len(REGIONS))
    return JSONResponse(status_code=200, content={"items": [serialize_summary(item, states.get(item.get("region"))) for item in items]})


async def fetch_regional_alerts(_user: Annotated[dict, Depends(require_regional_alert_user)]):
    items = list(alerts.find({}).sort([("createdAt", -1), ("scheduledAt", -1)])) if alerts is not None else []
    return JSONResponse(status_code=200, content={"items": [serialize_alert(item) for item in items]})


async def fetch_regional_alert_settings(_user: Annotated[dict, Depends(require_regional_alert_user)]):
    return JSONResponse(status_code=200, content={"item": _serialize_settings(None)})


async def save_regional_alert_settings(payload: RegionalAlertSettingsPayload, _user: Annotated[dict, Depends(require_regional_alert_user)]):
    if settings is None: raise HTTPException(status_code=503, detail="Alert settings storage is unavailable")
    current = _settings_document(); current_time = now()
    saved = {"enabled": payload.enabled, "threshold": payload.threshold, "intervalMinutes": payload.intervalMinutes, "updatedAt": current_time,
             "nextScheduledReconciliation": current_time if payload.enabled else None}
    # Do not reset cooldowns/consumption. Enabling asks the next tick to inspect
    # only active events and permits an immediate bounded evaluation below.
    settings.update_one({"_id": AUTOMATION_SETTINGS_ID}, {"$set": saved, "$setOnInsert": {"createdAt": current_time}}, upsert=True)
    if payload.enabled:
        run_automation_tick(force=True)
    return JSONResponse(status_code=200, content={"item": _serialize_settings(settings.find_one({"_id": AUTOMATION_SETTINGS_ID}))})


def _message(summary, region, included_keys=None):
    key_labels = summary.get("symptomKeyLabels") or {}
    labels = [key_labels[key] for key in included_keys or key_labels if key in key_labels]
    if not labels:
        labels = [item.get("symptom") for item in summary.get("symptomCounts") or [] if item.get("symptom")]
    if not labels: labels = ["submitted symptoms"]
    if len(labels) == 1: listed = labels[0]
    elif len(labels) == 2: listed = " and ".join(labels)
    else: listed = ", ".join(labels[:-1]) + ", and " + labels[-1]
    interval = int(summary.get("intervalMinutes") or 0)
    interval_text = f"{interval} minutes" if interval < 60 else ("1 hour" if interval == 60 else f"{interval // 60} hours")
    count = int(summary.get("reportCount") or 0)
    return (f"{count} self-reports were recorded in {region} during the last {interval_text}. "
            f"Reported symptoms included {listed}. These are not confirmed diagnoses.")


def _cooldown_status(region, symptom_keys, at):
    records = {item.get("symptomKey"): item for item in cooldowns.find({"region": region, "symptomKey": {"$in": list(symptom_keys)}})}
    eligible, suppressed, deadlines = [], [], []
    for key in symptom_keys:
        deadline = records.get(key, {}).get("expiresAt")
        if deadline and deadline > at: suppressed.append(key); deadlines.append(deadline)
        else: eligible.append(key)
    return eligible, suppressed, min(deadlines) if deadlines else None


def _claim_and_finish(region, summary, configuration, at):
    """CAS state machine: alert insert, reservation and consumption retry safely."""
    snapshot = {**summary, "intervalMinutes": configuration["intervalMinutes"]}
    keys = list((summary.get("symptomKeyCounts") or {}).keys())
    eligible, suppressed, next_deadline = _cooldown_status(region, keys, at)
    if not eligible:
        batch_states.update_one({"_id": region}, {"$set": {"status": "CoolingDown", "nextEligibleAt": next_deadline, "updatedAt": at, "lastSnapshot": snapshot}}, upsert=True)
        return "cooling_down"
    batch_id = str(uuid4())
    claimed = batch_states.find_one_and_update({"_id": region, "status": {"$ne": "Processing"}}, {"$set": {"status": "Processing", "batchId": batch_id, "snapshot": snapshot,
        "includedSymptomKeys": eligible, "suppressedSymptomKeys": suppressed, "claimedAt": at, "updatedAt": at}}, upsert=True, return_document=ReturnDocument.AFTER)
    if not claimed or claimed.get("batchId") != batch_id: return "claimed_elsewhere"
    _finish_processing(region, claimed, at)
    return "generated"


def _finish_processing(region, state, at=None):
    at = at or now(); batch_id, snapshot = state.get("batchId"), state.get("snapshot") or {}
    if not batch_id: return False
    alert = alerts.find_one({"batchId": batch_id})
    if not alert:
        included = state.get("includedSymptomKeys") or []
        included_labels = [item["symptom"] for item in snapshot.get("symptomCounts") or [] if item.get("symptom")]
        alert_document = {"source": "automated_regional_summary", "batchId": batch_id, "region": region,
            "title": f"Regional self-report alert: {region}", "message": _message(snapshot, region, included), "status": "Preparing", "recipientCount": 0,
            "createdAt": at, "updatedAt": at, "trigger": {"reportCount": snapshot.get("reportCount"), "threshold": _settings_document()["threshold"], "comparison": ">",
            "intervalMinutes": snapshot.get("intervalMinutes"), "windowStart": snapshot.get("windowStart"), "windowEnd": snapshot.get("windowEnd"), "summarySnapshot": snapshot,
            "includedSymptomKeys": included, "suppressedSymptomKeys": state.get("suppressedSymptomKeys") or [], "includedSymptomLabels": included_labels}}
        try:
            result = alerts.insert_one(alert_document); alert_document["_id"] = result.inserted_id; alert = alert_document
        except DuplicateKeyError: alert = alerts.find_one({"batchId": batch_id})
    for key in state.get("includedSymptomKeys") or []:
        cooldowns.update_one({"region": region, "symptomKey": key}, {"$set": {"region": region, "symptomKey": key, "batchId": batch_id, "reservedAt": at, "expiresAt": at + timedelta(hours=24)}}, upsert=True)
    ids = snapshot.get("eventIds") or []
    if ids: summary_events.update_many({"_id": {"$in": ids}, "consumedBatchId": {"$exists": False}}, {"$set": {"consumedBatchId": batch_id, "consumedAt": at}})
    batch_states.update_one({"_id": region, "batchId": batch_id}, {"$set": {"status": "Active", "updatedAt": at, "lastCompletedBatchId": batch_id}, "$unset": {"batchId": "", "snapshot": "", "includedSymptomKeys": "", "suppressedSymptomKeys": "", "nextEligibleAt": ""}})
    _store().refresh_region(region, at)
    return bool(alert)


def evaluate_regional_summary(region):
    if not _collections_available(summaries, summary_events, alerts, batch_states, cooldowns, settings): return "unavailable"
    configuration, at = _settings_document(), now()
    if not configuration["enabled"]: return "paused"
    summary = _store().refresh_region(region, at)
    if int(summary.get("reportCount") or 0) <= configuration["threshold"]:
        # A cooling-down batch may age below the strict trigger boundary. It is
        # retained raw but must not wake repeatedly or alert after expiry.
        batch_states.update_one({"_id": region, "status": "CoolingDown"}, {"$set": {"status": "Active", "updatedAt": at}, "$unset": {"nextEligibleAt": "", "lastSnapshot": ""}})
        return "below_threshold"
    return _claim_and_finish(region, summary, configuration, at)


def update_regional_summary_for_report(report: dict):
    if not _collections_available(summaries, summary_events): return {"status": "failed", "reason": "storage_unavailable"}
    result = _store().update_report(report)
    if result.get("status") == "updated":
        # Alert persistence is deliberately separate from source acceptance;
        # an automation problem cannot turn an accepted report into a failed POST.
        try: result["automation"] = evaluate_regional_summary(result["region"])
        except Exception as error: result["automation"] = f"deferred:{type(error).__name__}"
    return result


def _prepare_automatic_recipients():
    if not _collections_available(alerts, deliveries, mobile_users): return 0
    prepared = 0
    for alert in alerts.find({"source": "automated_regional_summary", "status": {"$in": ["Preparing", "Preparation failed"]}}):
        claimed = alerts.find_one_and_update({"_id": alert["_id"], "status": alert["status"]}, {"$set": {"status": "Preparing", "preparationClaimedAt": now(), "updatedAt": now()}}, return_document=ReturnDocument.AFTER)
        if not claimed: continue
        failures = []
        for recipient in mobile_users.find({"source": "mobile_registration", "roleId": "user"}):
            if normalize_region(recipient.get("regionCode")) != claimed["region"]: continue
            if not recipient.get("id"):
                failures.append("missing_mobile_user_id"); continue
            try:
                deliveries.update_one({"alertId": claimed["_id"], "mobileUserId": recipient.get("id")}, {"$setOnInsert": {"alertId": claimed["_id"], "mobileUserId": recipient.get("id"), "region": claimed["region"], "title": claimed["title"], "message": claimed["message"], "status": "Prepared", "createdAt": now()}}, upsert=True)
            except Exception as error: failures.append(type(error).__name__)
        count = deliveries.count_documents({"alertId": claimed["_id"]})
        completion = {"status": "Preparation failed" if failures else "Prepared", "recipientCount": count, "updatedAt": now(), "preparedAt": now()}
        if failures: completion["deliveryError"] = f"{len(failures)} recipient record(s) need preparation retry."
        alerts.update_one({"_id": claimed["_id"], "status": "Preparing"}, {"$set": completion}); prepared += 1
    return prepared


def _reconcile_recent_source_reports(configuration, current):
    """Bounded recovery for reports accepted before a projection write failed.

    The normal POST path projects immediately.  The scheduler additionally
    reads only the active rolling window, so a restart or projection failure
    does not leave fresh source reports permanently invisible.  Old consumed
    events remain untouched by SummaryStore's explicit consumption checks.
    """
    if self_reports is None:
        return 0
    lower_bound = current - timedelta(minutes=configuration["intervalMinutes"])
    recovered = 0
    for report in self_reports.find({"source": "mobile_self_report", "createdAt": {"$gte": lower_bound}}):
        result = _store().update_report(report)
        recovered += int(result.get("status") == "updated")
    return recovered


def process_due_regional_alerts():
    """Legacy manual scheduled alerts only; automatic records are never Sent here."""
    if not _collections_available(alerts, deliveries, mobile_users): return 0
    current, sent = get_ph_datetime(), 0
    for candidate in alerts.find({"source": {"$ne": "automated_regional_summary"}, "$or": [{"status": "Scheduled", "scheduledAt": {"$lte": current}}, {"status": "Sending", "deliveryClaimedAt": {"$lte": current - timedelta(minutes=5)}}]}):
        claimed = alerts.find_one_and_update({"_id": candidate["_id"], "status": candidate["status"]}, {"$set": {"status": "Sending", "deliveryClaimedAt": current}}, return_document=ReturnDocument.AFTER)
        if not claimed: continue
        for recipient in mobile_users.find({"regionCode": claimed["region"], "source": "mobile_registration", "roleId": "user"}):
            try: deliveries.update_one({"alertId": claimed["_id"], "mobileUserId": recipient.get("id")}, {"$setOnInsert": {"alertId": claimed["_id"], "mobileUserId": recipient.get("id"), "status": "Queued", "createdAt": current}}, upsert=True)
            except Exception: pass
        alerts.update_one({"_id": claimed["_id"], "status": "Sending"}, {"$set": {"status": "Sent", "sentAt": current, "recipientCount": deliveries.count_documents({"alertId": claimed["_id"]})}}); sent += 1
    return sent


def run_automation_tick(force=False):
    """30-second wake-up: recover claims/preparation and reconcile only when due."""
    if not _collections_available(summaries, summary_events, alerts, batch_states, cooldowns, settings): return 0
    configuration, current = _settings_document(), now()
    for state in batch_states.find({"status": "Processing"}): _finish_processing(state.get("_id"), state, current)
    _prepare_automatic_recipients()
    if not configuration["enabled"]: return 0
    due = force or not configuration.get("nextScheduledReconciliation") or configuration["nextScheduledReconciliation"] <= current
    due_states = list(batch_states.find({"status": "CoolingDown", "nextEligibleAt": {"$lte": current}}))
    if not due and not due_states: return 0
    regions = set(REGIONS if due else []) | {state.get("_id") for state in due_states}
    successes = 0
    try:
        if due:
            _reconcile_recent_source_reports(configuration, current)
        for region in regions:
            if region in REGIONS: evaluate_regional_summary(region); successes += 1
        settings.update_one({"_id": AUTOMATION_SETTINGS_ID}, {"$set": {"lastSuccessfulEvaluation": current, "lastEvaluationError": "", "nextScheduledReconciliation": current + timedelta(minutes=configuration["intervalMinutes"])}}, upsert=True)
    except Exception as error:
        settings.update_one({"_id": AUTOMATION_SETTINGS_ID}, {"$set": {"lastEvaluationError": type(error).__name__, "nextScheduledReconciliation": current + timedelta(seconds=30)}}, upsert=True)
    return successes


async def cancel_regional_alert(alert_id: str, _user: Annotated[dict, Depends(require_regional_alert_user)]):
    if not ObjectId.is_valid(alert_id): raise HTTPException(status_code=404, detail="Alert not found")
    result = alerts.find_one_and_update({"_id": ObjectId(alert_id), "source": {"$ne": "automated_regional_summary"}, "status": "Scheduled", "scheduledAt": {"$gt": get_ph_datetime()}}, {"$set": {"status": "Cancelled", "cancelledAt": now()}}, return_document=ReturnDocument.AFTER)
    if not result: raise HTTPException(status_code=400, detail="Only future manually scheduled alerts can be cancelled")
    return JSONResponse(status_code=200, content={"item": serialize_alert(result)})
