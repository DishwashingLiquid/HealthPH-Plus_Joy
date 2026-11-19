"""Dashboard regional-alert settings and durable automatic alert preparation.

Automatic alerts end at a per-user preparation outbox.  This module never
claims device delivery: mobile inbox and push transports intentionally live
outside this dashboard/backend feature.
"""
from datetime import datetime, timedelta
import re
from uuid import uuid4
from typing_extensions import Annotated

from bson import ObjectId
from fastapi import Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

import config.database as database
from disease_watch_storage import (
    ensure_disease_watch_internal_indexes,
)
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
roles = getattr(database, "role_label_collection", None)
analytics_entries = getattr(database, "analytics_entries_collection", None)
settings = getattr(database, "application_settings_collection", None)
batch_states = getattr(database, "regional_alert_batch_states_collection", None)
cooldowns = getattr(database, "regional_alert_cooldowns_collection", None)
disease_watch_internal = getattr(database, "disease_watch_internal_collection", None)


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


class RunRegionalAlertEvaluationPayload(BaseModel):
    # Compatibility only: evaluation always uses the effective saved settings.
    intervalMinutes: int | None = None

    @field_validator("intervalMinutes")
    @classmethod
    def allowed_interval(cls, value):
        if value is not None and value not in ALLOWED_INTERVALS: raise ValueError("intervalMinutes must be 15, 30, 60, 480, 720, or 1440")
        return value


async def require_regional_alert_user(user_id: Annotated[str, Depends(require_auth)]):
    user = users.find_one({"_id": ObjectId(user_id)}) if users is not None and ObjectId.is_valid(user_id) else None
    if not user: raise HTTPException(status_code=401, detail="User not found")
    if user.get("activation_pending") or user.get("is_disabled", False):
        raise HTTPException(status_code=403, detail="An active account is required.")
    if user.get("user_type") == "SUPERADMIN":
        return user
    role_name = str(user.get("role_label") or "").strip()
    role = roles.find_one({
        "name": {"$regex": f"^{re.escape(role_name)}$", "$options": "i"},
        "is_active": {"$ne": False},
    }) if roles is not None and role_name else None
    pages = role.get("accessible_pages") if role else None
    if not isinstance(pages, list) or "Disease Watch Feed" not in pages:
        raise HTTPException(status_code=403, detail="You do not have access to Disease Watch Feed.")
    return user


def ensure_regional_alert_indexes():
    """Called at startup only; ordinary scheduler ticks do not build indexes."""
    if analytics_entries is not None:
        _store().repository.ensure_indexes()
    if disease_watch_internal is not None:
        ensure_disease_watch_internal_indexes(disease_watch_internal)
    if _collections_available(summaries, summary_events, alerts, deliveries):
        alerts.create_index([("batchId", 1)], unique=True, sparse=True, name="unique_automatic_alert_batch")
        alerts.create_index([("status", 1), ("scheduledAt", 1)], name="regional_alert_due")
        deliveries.create_index([("alertId", 1), ("mobileUserId", 1)], unique=True, name="unique_regional_alert_delivery")
        deliveries.create_index([("mobileUserId", 1), ("status", 1), ("alertId", 1)], name="mobile_alert_inbox_lookup")


def _store(): return SummaryStore(analytics_entries, summary_events, summaries, settings)


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
            "notice": "Counts combine selected symptoms and non-negated symptoms extracted from processed report text, once per report. These are not diagnoses."}


def preview_for_alert(item):
    """Return a dashboard-only preview until automated recipient preparation completes."""
    if item.get("source") != "automated_regional_summary" or item.get("status") != "Preparing":
        return None
    snapshot = item.get("trigger", {}).get("summarySnapshot") or {}
    return {
        "reportCount": int(snapshot.get("reportCount") or 0),
        "symptomCounts": snapshot.get("symptomCounts") or [],
        "windowStart": _iso(snapshot.get("windowStart")),
        "windowEnd": _iso(snapshot.get("windowEnd")),
    }


def serialize_alert(item):
    trigger = item["trigger"]
    assignment_count = deliveries.count_documents({"alertId": item["_id"]}) if deliveries is not None else None
    inbox_count = deliveries.count_documents({"alertId": item["_id"], "status": "Prepared"}) if item["status"] == "Published" and deliveries is not None else None
    return {"id": str(item["_id"]), "title": item["title"], "region": item["region"],
            "message": item["message"], "status": item["status"], "automated": True,
            "recipientCount": assignment_count, "inboxAssignmentCount": inbox_count,
            "deliveryError": item.get("deliveryError") or "",
            "reportCount": trigger["reportCount"], "intervalMinutes": trigger["intervalMinutes"],
            "windowStart": _iso(trigger["windowStart"]), "windowEnd": _iso(trigger["windowEnd"]),
            "generatedAt": _iso(item["createdAt"]), "preparationStatus": item["status"],
            "summaryPreview": preview_for_alert(item)}


async def fetch_regional_summaries(_user: Annotated[dict, Depends(require_regional_alert_user)]):
    items = [item for item in _store().read_summaries() if item["isReady"]] if _collections_available(analytics_entries, summary_events, summaries) else []
    states = {item.get("_id"): item for item in batch_states.find({})} if batch_states is not None else {}
    items.sort(key=lambda item: REGIONS.index(item.get("region")) if item.get("region") in REGIONS else len(REGIONS))
    return JSONResponse(status_code=200, content={"items": [serialize_summary(item, states.get(item.get("region"))) for item in items]})


async def fetch_regional_alerts(_user: Annotated[dict, Depends(require_regional_alert_user)]):
    items = list(alerts.find({"source": "automated_regional_summary"}).sort([("createdAt", -1), ("scheduledAt", -1)])) if alerts is not None else []
    return JSONResponse(status_code=200, content={"items": [serialize_alert(item) for item in items]})


async def fetch_regional_alert_settings(_user: Annotated[dict, Depends(require_regional_alert_user)]):
    if settings is None: raise HTTPException(status_code=503, detail="Alert settings storage is unavailable")
    return JSONResponse(status_code=200, content={"item": _serialize_settings(None)})


async def save_regional_alert_settings(payload: RegionalAlertSettingsPayload, _user: Annotated[dict, Depends(require_regional_alert_user)]):
    if settings is None: raise HTTPException(status_code=503, detail="Alert settings storage is unavailable")
    current = _settings_document(); current_time = now()
    saved = {"enabled": payload.enabled, "threshold": payload.threshold, "intervalMinutes": payload.intervalMinutes, "updatedAt": current_time,
             "nextScheduledReconciliation": current_time if payload.enabled else None}
    # Do not reset cooldowns/consumption. Enabling asks the next tick to inspect
    # only active events and permits an immediate bounded evaluation below.
    settings.update_one({"_id": AUTOMATION_SETTINGS_ID}, {"$set": saved, "$setOnInsert": {"createdAt": current_time}}, upsert=True)
    if payload.intervalMinutes != current["intervalMinutes"]:
        _recalculate_active_cooldowns(payload.intervalMinutes, current_time)
    if payload.enabled:
        run_automation_tick(force=True)
    return JSONResponse(status_code=200, content={"item": _serialize_settings(settings.find_one({"_id": AUTOMATION_SETTINGS_ID}))})


async def run_regional_alert_evaluation(payload: RunRegionalAlertEvaluationPayload, _user: Annotated[dict, Depends(require_regional_alert_user)]):
    """Evaluate saved settings through the existing durable pipeline."""
    if settings is None: raise HTTPException(status_code=503, detail="Alert settings storage is unavailable")
    current = _settings_document()
    if not current["enabled"]:
        raise HTTPException(status_code=409, detail="Enable automation in Alert Settings to run an evaluation.")
    if payload.intervalMinutes is not None and payload.intervalMinutes != current["intervalMinutes"]:
        raise HTTPException(status_code=409, detail="Evaluation uses the saved interval. Reload settings or save interval changes in Alert Settings first.")
    evaluated_regions = run_automation_tick(force=True)
    # The normal scheduler prepares existing work before evaluation. A manual
    # run also prepares an alert created by this evaluation without creating a
    # second delivery path; preparation remains idempotent and recoverable.
    prepared_alerts = _prepare_automatic_recipients()
    saved = settings.find_one({"_id": AUTOMATION_SETTINGS_ID})
    serialized = _serialize_settings(saved)
    if serialized["lastEvaluationError"]:
        raise HTTPException(status_code=503, detail=f"Evaluation could not complete: {serialized['lastEvaluationError']}")
    return JSONResponse(status_code=200, content={
        "item": serialized,
        "evaluatedRegions": evaluated_regions,
        "preparedAlerts": prepared_alerts,
        "message": "Evaluation completed. Settings and alert history have been refreshed.",
    })


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
    return (f"{count} processed self-reports were recorded in {region} during the last {interval_text}. "
            f"Reported symptoms included {listed}. These are not confirmed diagnoses.")


def _cooldown_status(region, symptom_keys, at):
    deadlines_by_key = {}
    for item in cooldowns.find({"region": region, "expiresAt": {"$gt": at}}):
        key = item["symptomKey"]
        deadline = item["expiresAt"]
        deadlines_by_key[key] = max(deadline, deadlines_by_key.get(key, deadline))
    eligible, suppressed, deadlines = [], [], []
    for key in symptom_keys:
        deadline = deadlines_by_key.get(key)
        if deadline and deadline > at: suppressed.append(key); deadlines.append(deadline)
        else: eligible.append(key)
    return eligible, suppressed, min(deadlines) if deadlines else None


def _recalculate_active_cooldowns(interval_minutes, at):
    """Retain active reservations while applying the selected interval.

    A reservation's start and batch identity are durable alert history.  Only
    its derived expiry changes, and only while its prior expiry is still active;
    expired reservations must never be revived by a later settings change.
    """
    if cooldowns is None:
        return 0
    updated = 0
    for cooldown in cooldowns.find({
        "reservedAt": {"$exists": True},
        "expiresAt": {"$gt": at},
    }):
        reserved_at = cooldown.get("reservedAt")
        if not isinstance(reserved_at, datetime):
            continue
        result = cooldowns.update_one(
            {"_id": cooldown["_id"], "expiresAt": {"$gt": at}},
            {"$set": {"expiresAt": reserved_at + timedelta(minutes=interval_minutes)}},
        )
        updated += int(bool(result.modified_count or result.matched_count))
    return updated


def _claim_and_finish(region, summary, configuration, at):
    """CAS state machine: alert insert, reservation and consumption retry safely."""
    snapshot = {**summary, "intervalMinutes": configuration["intervalMinutes"]}
    keys = list((summary.get("symptomKeyCounts") or {}).keys())
    eligible, suppressed, next_deadline = _cooldown_status(region, keys, at)
    if not eligible:
        batch_states.update_one({"_id": region}, {"$set": {"region": region, "status": "CoolingDown", "nextEligibleAt": next_deadline, "updatedAt": at, "lastSnapshot": snapshot}}, upsert=True)
        return "cooling_down"
    batch_id = str(uuid4())
    # Create the state independently, then use a non-upserting CAS claim.
    # An upsert with a status predicate can race an existing Processing state
    # and attempt a duplicate _id insert instead of reporting a lost claim.
    batch_states.update_one(
        {"_id": region},
        {"$setOnInsert": {"region": region, "status": "Active", "createdAt": at}},
        upsert=True,
    )
    claimed = batch_states.find_one_and_update({"_id": region, "status": {"$ne": "Processing"}}, {"$set": {"region": region, "status": "Processing", "batchId": batch_id, "snapshot": snapshot,
        "includedSymptomKeys": eligible, "suppressedSymptomKeys": suppressed, "claimedAt": at, "updatedAt": at}}, return_document=ReturnDocument.AFTER)
    if not claimed or claimed.get("batchId") != batch_id: return "claimed_elsewhere"
    _finish_processing(region, claimed, at)
    return "generated"


def _finish_processing(region, state, at=None):
    at = at or now(); batch_id, snapshot = state.get("batchId"), state.get("snapshot") or {}
    if not batch_id: return False
    cooldown_minutes = int(snapshot.get("intervalMinutes") or _settings_document()["intervalMinutes"])
    alert = alerts.find_one({"batchId": batch_id})
    if not alert:
        included = state.get("includedSymptomKeys") or []
        alert_document = {"source": "automated_regional_summary", "batchId": batch_id, "region": region,
            "title": f"Regional self-report alert: {region}", "message": _message(snapshot, region, included), "status": "Preparing", "recipientCount": 0,
            "createdAt": at, "updatedAt": at, "trigger": {"reportCount": snapshot.get("reportCount"), "threshold": _settings_document()["threshold"], "comparison": ">",
            "intervalMinutes": snapshot.get("intervalMinutes"), "windowStart": snapshot.get("windowStart"), "windowEnd": snapshot.get("windowEnd"), "summarySnapshot": snapshot,
            "includedSymptomKeys": included, "suppressedSymptomKeys": state.get("suppressedSymptomKeys") or []}}
        try:
            result = alerts.insert_one(alert_document); alert_document["_id"] = result.inserted_id; alert = alert_document
        except DuplicateKeyError: alert = alerts.find_one({"batchId": batch_id})
    for key in state.get("includedSymptomKeys") or []:
        cooldowns.update_one({"region": region, "symptomKey": key}, {"$set": {"region": region, "symptomKey": key, "batchId": batch_id, "reservedAt": at, "expiresAt": at + timedelta(minutes=cooldown_minutes)}}, upsert=True)
    ids = snapshot.get("eventIds") or []
    if ids: summary_events.update_many({"_id": {"$in": ids}, "consumedBatchId": {"$exists": False}}, {"$set": {"consumedBatchId": batch_id, "consumedAt": at}})
    batch_states.update_one({"_id": region, "batchId": batch_id}, {"$set": {"status": "Active", "updatedAt": at, "lastCompletedBatchId": batch_id}, "$unset": {"batchId": "", "snapshot": "", "includedSymptomKeys": "", "suppressedSymptomKeys": "", "nextEligibleAt": ""}})
    _store().refresh_region(region, at)
    return bool(alert)


def evaluate_regional_summary(region, *, refresh=True):
    if not _collections_available(analytics_entries, summaries, summary_events, alerts, batch_states, cooldowns, settings): return "unavailable"
    configuration, at = _settings_document(), now()
    if not configuration["enabled"]: return "paused"
    summary = _store().refresh_region(region, at) if refresh else (summaries.find_one({"region": region}) or {})
    if int(summary.get("reportCount") or 0) <= configuration["threshold"]:
        # A cooling-down batch may age below the strict trigger boundary. It is
        # retained raw but must not wake repeatedly or alert after expiry.
        batch_states.update_one({"_id": region, "status": "CoolingDown"}, {"$set": {"status": "Active", "updatedAt": at}, "$unset": {"nextEligibleAt": "", "lastSnapshot": ""}})
        return "below_threshold"
    return _claim_and_finish(region, summary, configuration, at)


def on_self_report_processing_completed():
    """Processing-completion hook; submissions never trigger alert evaluation."""
    if not _collections_available(analytics_entries, summary_events, summaries):
        return 0
    if _settings_document()["enabled"]:
        return run_automation_tick(force=True)
    return _store().refresh_recent_reports()


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
                prepared_at = now()
                deliveries.update_one({"alertId": claimed["_id"], "mobileUserId": recipient.get("id")}, {"$setOnInsert": {"alertId": claimed["_id"], "mobileUserId": recipient.get("id"), "region": claimed["region"], "title": claimed["title"], "message": claimed["message"], "status": "Prepared", "publishedAt": prepared_at, "createdAt": prepared_at}}, upsert=True)
            except Exception as error: failures.append(type(error).__name__)
        count = deliveries.count_documents({"alertId": claimed["_id"]})
        completion = {"status": "Preparation failed" if failures else "Published", "recipientCount": count, "updatedAt": now(), "preparedAt": now()}
        if failures: completion["deliveryError"] = f"{len(failures)} recipient record(s) need preparation retry."
        alerts.update_one({"_id": claimed["_id"], "status": "Preparing"}, {"$set": completion}); prepared += 1
    return prepared


def run_automation_tick(force=False):
    """30-second wake-up: recover claims/preparation and reconcile only when due."""
    if not _collections_available(analytics_entries, summaries, summary_events, alerts, batch_states, cooldowns, settings): return 0
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
        _store().refresh_recent_reports(current)
        for region in regions:
            if region in REGIONS: evaluate_regional_summary(region, refresh=False); successes += 1
        settings.update_one({"_id": AUTOMATION_SETTINGS_ID}, {"$set": {"lastSuccessfulEvaluation": current, "lastEvaluationError": "", "nextScheduledReconciliation": current + timedelta(minutes=configuration["intervalMinutes"])}}, upsert=True)
    except Exception as error:
        settings.update_one({"_id": AUTOMATION_SETTINGS_ID}, {"$set": {"lastEvaluationError": type(error).__name__, "nextScheduledReconciliation": current + timedelta(seconds=30)}}, upsert=True)
    return successes
