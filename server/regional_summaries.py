"""Source-based reconciliation and literal symptom frequencies, without app startup.

Eligibility deliberately matches v1: all mobile_self_report records, all statuses
(including rejected and missing), all dates, counting records rather than people.
"""
from collections import Counter
from datetime import datetime, timedelta, timezone
import logging

from pymongo.errors import DuplicateKeyError
from region_normalization import REGIONS, resolve_region

logger = logging.getLogger(__name__)
SUMMARY_MINIMUM_REPORTS = 5
MIGRATION_ID = "regional_symptom_summary_reconciliation_v2"
SOURCE_QUERY = {"source": "mobile_self_report"}
SOURCE_PROJECTION = {"_id": 1, "source": 1, "status": 1, "location.regionCode": 1,
                     "location.regionName": 1, "submittedSymptoms": 1, "symptomLabels": 1,
                     "symptomIds": 1, "createdAt": 1}


def now():
    return datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)


def symptoms_as_submitted(report):
    raw = report.get("submittedSymptoms") or report.get("symptomLabels") or report.get("symptomIds") or []
    if not isinstance(raw, list):
        raise ValueError("invalid_symptom_list")
    return sorted({str(item).strip() for item in raw if str(item).strip()}, key=lambda value: (value.casefold(), value))


def event_for_report(report):
    if report.get("source") != SOURCE_QUERY["source"]:
        return None, "ineligible_source"
    if not report.get("_id"):
        return None, "missing_report_id"
    region, issue = resolve_region(report.get("location"))
    if not region:
        return None, issue
    return {"region": region, "reportId": report["_id"], "symptoms": symptoms_as_submitted(report),
            "createdAt": report.get("createdAt")}, issue


def summarize(region, events):
    # Defensive deduplication also handles legacy events with repeated symptoms.
    by_report = {event["reportId"]: event for event in events}
    counts = Counter(symptom for event in by_report.values() for symptom in set(event.get("symptoms") or []))
    return {"region": region, "reportCount": len(by_report),
            "symptomCounts": [{"symptom": symptom, "count": count} for symptom, count in
                              sorted(counts.items(), key=lambda item: (-item[1], item[0].casefold(), item[0]))],
            "isReady": len(by_report) >= SUMMARY_MINIMUM_REPORTS}


def build_plan(reports, events, summaries):
    expected, skipped, failures, warnings = [], [], [], []
    statuses, locations = Counter(), Counter()
    for report in reports:
        statuses[str(report.get("status") or "<missing>")] += 1
        location = report.get("location") or {}
        if isinstance(location, dict):
            locations[(str(location.get("regionCode") or ""), str(location.get("regionName") or ""))] += 1
        try:
            event, issue = event_for_report(report)
        except Exception as error:
            failures.append({"reportId": str(report.get("_id")), "reason": "invalid_symptom_list" if isinstance(error, ValueError) else type(error).__name__})
            continue
        if not event:
            skipped.append({"reportId": str(report.get("_id")), "reason": issue})
            continue
        if issue:
            warnings.append({"reportId": str(report["_id"]), "reason": issue})
        expected.append(event)
    desired = [summarize(region, [event for event in expected if event["region"] == region]) for region in REGIONS]
    # Keep empty summaries only if they already exist, to clear stale readiness.
    desired = [item for item in desired if item["reportCount"] or any(old.get("region") == item["region"] for old in summaries)]
    expected_by_key = {(item["region"], item["reportId"]): item for item in expected}
    existing_by_key = {}
    remove_ids = []
    for event in events:
        key = (event.get("region"), event.get("reportId"))
        if key not in expected_by_key or key in existing_by_key:
            remove_ids.append(event["_id"])
        else:
            existing_by_key[key] = event
    event_changes = [item for key, item in expected_by_key.items()
                     if any(existing_by_key.get(key, {}).get(field) != value for field, value in item.items())]
    summary_changes = [item for item in desired if not any(
        all(old.get(field) == value for field, value in item.items()) for old in summaries)]
    # Duplicate/unsupported derived summary documents are obsolete.
    seen, summary_remove_ids = set(), []
    for item in summaries:
        region = item.get("region")
        if region not in REGIONS or region in seen:
            summary_remove_ids.append(item["_id"])
        seen.add(region)
    inserted = sum((event["region"], event["reportId"]) not in existing_by_key for event in event_changes)
    audit = {"migration": MIGRATION_ID, "sourceReportCount": len(reports), "eligibleReportCount": len(expected),
             "statusCounts": dict(sorted(statuses.items())),
             "locationCounts": [{"code": code, "name": name, "count": count} for (code, name), count in sorted(locations.items())],
             "skipped": skipped, "failed": failures, "warnings": warnings,
             "regions": desired, "proposedChanges": {"eventsUpserted": len(event_changes), "eventsInserted": inserted,
                "eventsUpdated": len(event_changes) - inserted, "eventsRemoved": len(remove_ids),
                "summariesUpdated": len(summary_changes), "summariesRemoved": len(summary_remove_ids)}}
    return audit, event_changes, remove_ids, desired, summary_remove_ids


class SummaryStore:
    def __init__(self, reports, events, summaries, settings=None):
        self.reports, self.events, self.summaries, self.settings = reports, events, summaries, settings

    def plan(self, session=None):
        options = {"session": session} if session is not None else {}
        return build_plan(list(self.reports.find(SOURCE_QUERY, SOURCE_PROJECTION, **options)),
                          list(self.events.find({}, **options)), list(self.summaries.find({}, **options)))

    def update_report(self, report):
        """Accept source independently; log failures for explicit reconciliation.

        Read the summary revision BEFORE events so a slower concurrent snapshot
        cannot overwrite a newer save. Duplicate event processing still retries
        summary persistence (an earlier attempt may have failed after insertion).
        """
        try:
            event, issue = event_for_report(report)
            if issue:
                logger.warning("Regional summary report=%s issue=%s", report.get("_id"), issue)
            if not event:
                return {"status": "skipped", "reason": issue}
            self.events.update_one({"region": event["region"], "reportId": event["reportId"]}, {"$set": event}, upsert=True)
            for _ in range(8):
                current = self.summaries.find_one({"region": event["region"]})
                revision = (current or {}).get("revision")
                summary = summarize(event["region"], list(self.events.find({"region": event["region"]})))
                summary.update(updatedAt=now(), revision=int(revision or 0) + 1)
                if current:
                    result = self.summaries.update_one({"_id": current["_id"], "revision": revision}, {"$set": summary})
                    if result.matched_count:
                        return {"status": "updated"}
                else:
                    try:
                        self.summaries.insert_one({**summary, "createdAt": now()})
                        return {"status": "updated"}
                    except DuplicateKeyError:
                        continue
            raise RuntimeError("summary_revision_contention")
        except Exception as error:
            logger.error("Regional summary update failed: report=%s error=%s; reconcile sources", report.get("_id"), type(error).__name__)
            return {"status": "failed", "reason": type(error).__name__}

    def reconcile(self, session):
        """Called inside a transaction with submission writers paused by operator.

        No source documents or alert collections are mutated. Failure rolls back
        events, summaries, and the v2 marker together; v1 never gates this repair.
        """
        audit, changes, removals, desired, obsolete = self.plan(session)
        if audit["failed"]:
            raise ValueError("Source processing failed; inspect the dry run before applying")
        for event_id in removals:
            self.events.delete_one({"_id": event_id}, session=session)
        for event in changes:
            self.events.update_one({"region": event["region"], "reportId": event["reportId"]}, {"$set": event}, upsert=True, session=session)
        for summary_id in obsolete:
            self.summaries.delete_one({"_id": summary_id}, session=session)
        for summary in desired:
            current = self.summaries.find_one({"region": summary["region"]}, session=session)
            if current and all(current.get(field) == value for field, value in summary.items()):
                continue
            self.summaries.update_one({"region": summary["region"]},
                {"$set": {**summary, "updatedAt": now()}, "$inc": {"revision": 1}, "$setOnInsert": {"createdAt": now()}},
                upsert=True, session=session)
        validation = self.plan(session)[0]
        if validation["failed"] or any(validation["proposedChanges"].values()):
            raise RuntimeError("Reconciliation validation failed")
        self.settings.update_one({"_id": MIGRATION_ID}, {"$set": {"completedAt": now(), "validation": validation}}, upsert=True, session=session)
        return audit
