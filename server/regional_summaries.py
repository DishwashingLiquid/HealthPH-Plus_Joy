"""Derived rolling regional self-report summaries.

Source reports are immutable here.  A summary event projects one eligible
report; ``consumedBatchId`` permanently excludes a completed alert batch from
ordinary updates and repair. Missing legacy statuses mean ``submitted``, the
historical API default. Naive dates are Philippine wall-clock times, never UTC.
"""
from collections import Counter
from datetime import datetime, timedelta, timezone
import logging

try:  # Keeps pure summary validation usable in the repository's minimal test env.
    from pymongo.errors import DuplicateKeyError
except ModuleNotFoundError:  # pragma: no cover - production always has PyMongo
    class DuplicateKeyError(Exception):
        pass
from region_normalization import REGIONS, resolve_region

logger = logging.getLogger(__name__)
SUMMARY_MINIMUM_REPORTS = 5
MIGRATION_ID = "regional_symptom_summary_reconciliation_v3"
AUTOMATION_SETTINGS_ID = "regional_alert_automation"
SOURCE_QUERY = {"source": "mobile_self_report"}
SOURCE_PROJECTION = {"_id": 1, "source": 1, "status": 1, "location.regionCode": 1, "location.regionName": 1,
                     "submittedSymptoms": 1, "symptomLabels": 1, "symptomIds": 1, "createdAt": 1}
PH_TZ = timezone(timedelta(hours=8))
ALLOWED_STATUSES = {"submitted", "for_review", "verified"}
ALLOWED_INTERVALS = {15, 30, 60, 480, 720, 1440}


def now():
    return datetime.now(PH_TZ).replace(tzinfo=None)


def aware_ph(value):
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return None
    if not isinstance(value, datetime):
        return None
    return value.replace(tzinfo=PH_TZ) if value.tzinfo is None else value.astimezone(PH_TZ)


def settings_values(document=None):
    document = document or {}
    try:
        threshold, interval = int(document.get("threshold", 5)), int(document.get("intervalMinutes", 1440))
    except (TypeError, ValueError):
        threshold, interval = 5, 1440
    return {"enabled": bool(document.get("enabled", False)), "threshold": threshold if threshold > 0 else 5,
            "intervalMinutes": interval if interval in ALLOWED_INTERVALS else 1440}


def symptoms_as_submitted(report):
    raw = report.get("submittedSymptoms") or report.get("symptomLabels") or report.get("symptomIds") or []
    if not isinstance(raw, list):
        raise ValueError("invalid_symptom_list")
    return sorted({str(item).strip() for item in raw if str(item).strip()}, key=lambda value: (value.casefold(), value))


def symptom_entries(report):
    raw = report.get("submittedSymptoms") or report.get("symptomLabels") or report.get("symptomIds") or []
    if not isinstance(raw, list):
        raise ValueError("invalid_symptom_list")
    ids = report.get("symptomIds") if isinstance(report.get("symptomIds"), list) else []
    entries = []
    for index, item in enumerate(raw):
        label = str(item).strip()
        if not label:
            continue
        raw_id = ids[index] if index < len(ids) else None
        entries.append({"label": label, "key": "id:" + str(raw_id).strip() if str(raw_id or "").strip() else "literal:" + label})
    return sorted({entry["key"]: entry for entry in entries}.values(), key=lambda entry: (entry["label"].casefold(), entry["label"], entry["key"]))


def event_for_report(report):
    if report.get("source") != SOURCE_QUERY["source"]:
        return None, "ineligible_source"
    if not report.get("_id"):
        return None, "missing_report_id"
    report_status = str(report.get("status") or "submitted").strip().lower()
    if report_status not in ALLOWED_STATUSES:
        return None, "ineligible_status"
    occurred = aware_ph(report.get("createdAt"))
    if occurred is None:
        return None, "invalid_created_at"
    region, issue = resolve_region(report.get("location"))
    if not region:
        return None, issue
    return {"region": region, "reportId": report["_id"], "symptoms": symptoms_as_submitted(report), "symptomEntries": symptom_entries(report),
            "createdAt": report.get("createdAt"), "occurredAt": occurred.replace(tzinfo=None), "sourceStatus": report_status}, issue


def event_is_current(event, at, interval_minutes):
    occurred, at = aware_ph(event.get("occurredAt", event.get("createdAt"))), aware_ph(at)
    return bool(occurred and at and occurred <= at and occurred >= at - timedelta(minutes=interval_minutes))


def summarize(region, events, at=None, interval_minutes=1440):
    at = at or now()
    by_report = {str(event["reportId"]): event for event in events if not event.get("consumedBatchId") and event_is_current(event, at, interval_minutes)}
    counts, key_counts, key_labels = Counter(), Counter(), {}
    for event in by_report.values():
        seen = set()
        fallback = [{"label": item, "key": "literal:" + item} for item in event.get("symptoms") or []]
        for entry in event.get("symptomEntries") or fallback:
            if entry["key"] not in seen:
                seen.add(entry["key"]); counts[entry["label"]] += 1; key_counts[entry["key"]] += 1; key_labels.setdefault(entry["key"], entry["label"])
    ph_at = aware_ph(at)
    return {"region": region, "reportCount": len(by_report), "eventIds": [event.get("_id") for event in by_report.values() if event.get("_id") is not None],
            "symptomCounts": [{"symptom": symptom, "count": count} for symptom, count in sorted(counts.items(), key=lambda item: (-item[1], item[0].casefold(), item[0]))],
            "symptomKeyCounts": dict(sorted(key_counts.items())), "symptomKeyLabels": dict(sorted(key_labels.items())), "isReady": len(by_report) >= SUMMARY_MINIMUM_REPORTS,
            "windowStart": (ph_at - timedelta(minutes=interval_minutes)).replace(tzinfo=None), "windowEnd": ph_at.replace(tzinfo=None)}


def build_plan(reports, events, summaries, at=None, interval_minutes=1440):
    expected, skipped, failures, warnings = [], [], [], []
    statuses, locations = Counter(), Counter()
    consumed_ids = {str(event.get("reportId")) for event in events if event.get("consumedBatchId")}
    for report in reports:
        statuses[str(report.get("status") or "<missing>")] += 1
        location = report.get("location") or {}
        if isinstance(location, dict): locations[(str(location.get("regionCode") or ""), str(location.get("regionName") or ""))] += 1
        try: event, issue = event_for_report(report)
        except Exception as error:
            failures.append({"reportId": str(report.get("_id")), "reason": "invalid_symptom_list" if isinstance(error, ValueError) else type(error).__name__}); continue
        if not event:
            skipped.append({"reportId": str(report.get("_id")), "reason": issue}); continue
        if str(event["reportId"]) in consumed_ids: continue
        if issue: warnings.append({"reportId": str(report["_id"]), "reason": issue})
        expected.append(event)
    desired = [summarize(region, [event for event in expected if event["region"] == region], at, interval_minutes) for region in REGIONS]
    desired = [item for item in desired if item["reportCount"] or any(old.get("region") == item["region"] for old in summaries)]
    expected_by_key = {(item["region"], str(item["reportId"])): item for item in expected}
    existing_by_key, remove_ids = {}, []
    for event in events:
        if event.get("consumedBatchId"): continue
        key = (event.get("region"), str(event.get("reportId")))
        if key not in expected_by_key or key in existing_by_key: remove_ids.append(event["_id"])
        else: existing_by_key[key] = event
    event_changes = [item for key, item in expected_by_key.items() if any(existing_by_key.get(key, {}).get(field) != value for field, value in item.items())]
    summary_changes = [item for item in desired if not any(all(old.get(field) == value for field, value in item.items()) for old in summaries)]
    seen, summary_remove_ids = set(), []
    for item in summaries:
        region = item.get("region")
        if region not in REGIONS or region in seen: summary_remove_ids.append(item["_id"])
        seen.add(region)
    inserted = sum((item["region"], str(item["reportId"])) not in existing_by_key for item in event_changes)
    audit = {"migration": MIGRATION_ID, "sourceReportCount": len(reports), "eligibleReportCount": len(expected), "statusCounts": dict(sorted(statuses.items())),
             "locationCounts": [{"code": code, "name": name, "count": count} for (code, name), count in sorted(locations.items())], "skipped": skipped, "failed": failures, "warnings": warnings, "regions": desired,
             "proposedChanges": {"eventsUpserted": len(event_changes), "eventsInserted": inserted, "eventsUpdated": len(event_changes) - inserted, "eventsRemoved": len(remove_ids), "summariesUpdated": len(summary_changes), "summariesRemoved": len(summary_remove_ids)}}
    return audit, event_changes, remove_ids, desired, summary_remove_ids


class SummaryStore:
    def __init__(self, reports, events, summaries, settings=None): self.reports, self.events, self.summaries, self.settings = reports, events, summaries, settings

    def _interval(self):
        document = self.settings.find_one({"_id": AUTOMATION_SETTINGS_ID}) if self.settings is not None else None
        return settings_values(document)["intervalMinutes"]

    def plan(self, session=None, at=None):
        options = {"session": session} if session is not None else {}
        return build_plan(list(self.reports.find(SOURCE_QUERY, SOURCE_PROJECTION, **options)), list(self.events.find({}, **options)), list(self.summaries.find({}, **options)), at=at, interval_minutes=self._interval())

    def refresh_region(self, region, at=None):
        at = at or now()
        for _ in range(8):
            current = self.summaries.find_one({"region": region}); revision = (current or {}).get("revision")
            summary = summarize(region, list(self.events.find({"region": region})), at, self._interval()); summary.update(updatedAt=at, revision=int(revision or 0) + 1)
            if current:
                result = self.summaries.update_one({"_id": current["_id"], "revision": revision}, {"$set": summary})
                if result.matched_count: return summary
            else:
                try: self.summaries.insert_one({**summary, "createdAt": at}); return summary
                except DuplicateKeyError: continue
        raise RuntimeError("summary_revision_contention")

    def update_report(self, report):
        try:
            event, issue = event_for_report(report)
            if issue: logger.warning("Regional summary report=%s issue=%s", report.get("_id"), issue)
            if not event: return {"status": "skipped", "reason": issue}
            self.events.update_one({"region": event["region"], "reportId": event["reportId"]}, {"$set": event, "$setOnInsert": {"projectedAt": now()}}, upsert=True)
            return {"status": "updated", "region": event["region"], "summary": self.refresh_region(event["region"])}
        except Exception as error:
            logger.error("Regional summary update failed: report=%s error=%s; reconcile sources", report.get("_id"), type(error).__name__)
            return {"status": "failed", "reason": type(error).__name__}

    def reconcile(self, session):
        reconciliation_at = now()
        audit, changes, removals, desired, obsolete = self.plan(session, reconciliation_at)
        if audit["failed"]: raise ValueError("Source processing failed; inspect the dry run before applying")
        for event_id in removals: self.events.delete_one({"_id": event_id}, session=session)
        for event in changes: self.events.update_one({"region": event["region"], "reportId": event["reportId"]}, {"$set": event, "$setOnInsert": {"projectedAt": now()}}, upsert=True, session=session)
        for summary_id in obsolete: self.summaries.delete_one({"_id": summary_id}, session=session)
        for summary in desired: self.summaries.update_one({"region": summary["region"]}, {"$set": {**summary, "updatedAt": now()}, "$inc": {"revision": 1}, "$setOnInsert": {"createdAt": now()}}, upsert=True, session=session)
        validation = self.plan(session, reconciliation_at)[0]
        if validation["failed"] or any(validation["proposedChanges"].values()): raise RuntimeError("Reconciliation validation failed")
        self.settings.update_one({"_id": MIGRATION_ID}, {"$set": {"completedAt": now(), "validation": validation}}, upsert=True, session=session)
        return audit
