"""Regional alert projections derived only from processed self-report analytics.

Completed batches remain immutable consumption history. Dashboard reads compute
from the repository; processing and alert workers persist derived projections.
"""
from collections import Counter
from datetime import datetime, timedelta, timezone

try:
    from pymongo.errors import DuplicateKeyError
except ModuleNotFoundError:  # Pure counting tests do not require a Mongo driver.
    class DuplicateKeyError(Exception):
        pass

from helpers.processedSelfReportHelpers import ProcessedSelfReportRepository, ph_datetime
from region_normalization import REGIONS

SUMMARY_MINIMUM_REPORTS = 5
AUTOMATION_SETTINGS_ID = "regional_alert_automation"
ALLOWED_INTERVALS = {15, 30, 60, 480, 720, 1440}
PH_TZ = timezone(timedelta(hours=8))


def now():
    return datetime.now(PH_TZ).replace(tzinfo=None)


def settings_values(document=None):
    document = document or {}
    try:
        threshold = int(document.get("threshold", 5))
        interval = int(document.get("intervalMinutes", 1440))
    except (TypeError, ValueError):
        threshold, interval = 5, 1440
    return {"enabled": bool(document.get("enabled", False)),
            "threshold": threshold if threshold > 0 else 5,
            "intervalMinutes": interval if interval in ALLOWED_INTERVALS else 1440}


def event_for_record(record):
    return {
        "region": record["region"], "reportId": record["report_id"],
        "source": "processed_analytics", "sourceEntryId": record["entry_id"],
        "symptoms": list(record["symptoms"].values()),
        "symptomEntries": [{"key": "symptom:" + key, "label": record["symptoms"][key]} for key in sorted(record["symptoms"])],
        "occurredAt": record["occurred_at"], "createdAt": record["occurred_at"],
    }


def event_is_current(event, at, interval_minutes):
    occurred = ph_datetime(event.get("occurredAt"))
    at = ph_datetime(at)
    return bool(occurred and at and at - timedelta(minutes=interval_minutes) <= occurred <= at)


def summarize(region, events, at=None, interval_minutes=1440):
    at = at or now()
    reports = {str(event["reportId"]): event for event in events
               if not event.get("consumedBatchId") and event_is_current(event, at, interval_minutes)}
    counts, labels = Counter(), {}
    for event in reports.values():
        for key, label in {item["key"]: item["label"] for item in event["symptomEntries"]}.items():
            counts[key] += 1
            labels[key] = label
    return {
        "region": region, "reportCount": len(reports),
        "eventIds": [event["_id"] for event in reports.values() if event.get("_id") is not None],
        "symptomCounts": [{"symptom": labels[key], "count": count} for key, count in sorted(counts.items(), key=lambda item: (-item[1], labels[item[0]]))],
        "symptomKeyCounts": dict(sorted(counts.items())), "symptomKeyLabels": dict(sorted(labels.items())),
        "isReady": len(reports) >= SUMMARY_MINIMUM_REPORTS,
        "windowStart": at - timedelta(minutes=interval_minutes), "windowEnd": at,
    }


def build_plan(records, events, summaries, at=None, interval_minutes=1440):
    consumed = {event.get("reportId") for event in events if event.get("consumedBatchId")}
    expected, skipped = {}, []
    for record in records:
        if not record["region"]:
            skipped.append({"reportId": record["report_id"], "reason": "unknown_region"})
        elif record["report_id"] not in consumed:
            event = event_for_record(record)
            expected[(event["region"], str(event["reportId"]))] = event
    existing, removals = {}, []
    for event in events:
        if event.get("consumedBatchId"):
            continue
        key = (event.get("region"), event.get("reportId"))
        if key not in expected or key in existing:
            removals.append(event["_id"])
        else:
            existing[key] = event
    changes = [event for key, event in expected.items()
               if any(existing.get(key, {}).get(field) != value for field, value in event.items())]
    projected = [{**event, **({"_id": existing[key]["_id"]} if key in existing else {})} for key, event in expected.items()]
    regions = set(event["region"] for event in projected) | {summary["region"] for summary in summaries if summary.get("region") in REGIONS}
    desired = [summarize(region, [event for event in projected if event["region"] == region], at, interval_minutes)
               for region in REGIONS if region in regions]
    seen, obsolete = set(), []
    for summary in summaries:
        region = summary.get("region")
        if region not in REGIONS or region in seen:
            obsolete.append(summary["_id"])
        seen.add(region)
    summary_changes = [item for item in desired if not any(all(old.get(key) == value for key, value in item.items()) for old in summaries)]
    audit = {
        "source": "processed_analytics", "sourceReportCount": len(records),
        "eligibleReportCount": len(expected), "skipped": skipped, "failed": [], "regions": desired,
        "proposedChanges": {"eventsUpserted": len(changes), "eventsRemoved": len(removals),
                            "summariesUpdated": len(summary_changes), "summariesRemoved": len(obsolete)},
    }
    return audit, changes, removals, desired, obsolete


class SummaryStore:
    def __init__(self, analytics, events, summaries, settings=None):
        self.repository = ProcessedSelfReportRepository(analytics)
        self.events, self.summaries, self.settings = events, summaries, settings

    def _interval(self, session=None):
        options = {"session": session} if session is not None else {}
        document = self.settings.find_one({"_id": AUTOMATION_SETTINGS_ID}, **options) if self.settings is not None else None
        return settings_values(document)["intervalMinutes"]

    def plan(self, session=None, at=None):
        options = {"session": session} if session is not None else {}
        return build_plan(self.repository.records(session=session), list(self.events.find({}, **options)),
                          list(self.summaries.find({}, **options)), at=at, interval_minutes=self._interval(session))

    def read_summaries(self, at=None):
        # Read-only: no source joins, inference, cache repair or alert generation.
        return self.plan(at=at or now())[3]

    def _write_events(self, changes, removals, session=None):
        options = {"session": session} if session is not None else {}
        for event_id in removals:
            self.events.delete_one({"_id": event_id, "consumedBatchId": {"$exists": False}}, **options)
        existing = {(event.get("region"), event.get("reportId")): event for event in self.events.find({}, **options)}
        for event in changes:
            previous = existing.get((event["region"], event["reportId"]))
            if previous and previous.get("consumedBatchId"):
                continue
            if previous:
                self.events.update_one({"_id": previous["_id"], "consumedBatchId": {"$exists": False}}, {"$set": event}, **options)
            else:
                try:
                    self.events.insert_one({**event, "projectedAt": now()}, **options)
                except DuplicateKeyError:
                    # Another worker inserted it. Its next projection will use
                    # the completed analytics result; never overwrite consumption.
                    continue

    def _save_summary(self, summary, session=None):
        options = {"session": session} if session is not None else {}
        for _ in range(8):
            current = self.summaries.find_one({"region": summary["region"]}, **options)
            revision = (current or {}).get("revision")
            updated = {**summary, "updatedAt": now(), "revision": int(revision or 0) + 1}
            if current:
                result = self.summaries.update_one({"_id": current["_id"], "revision": revision}, {"$set": updated}, **options)
                if result.matched_count:
                    return updated
            else:
                try:
                    self.summaries.insert_one({**updated, "createdAt": now()}, **options)
                    return updated
                except DuplicateKeyError:
                    continue
        raise RuntimeError("summary_revision_contention")

    def refresh_recent_reports(self, at=None):
        at = at or now()
        _, changes, removals, _, obsolete = self.plan(at=at)
        self._write_events(changes, removals)
        for summary_id in obsolete:
            self.summaries.delete_one({"_id": summary_id})
        # Re-read after projecting, to include inserted event IDs and exclude
        # batches consumed concurrently. Cached raw-only events never qualify.
        desired = self.plan(at=at)[3]
        for summary in desired:
            self._save_summary(summary)
        return len(changes)

    def refresh_region(self, region, at=None):
        self.refresh_recent_reports(at)
        return self.summaries.find_one({"region": region}) or summarize(region, [], at, self._interval())
