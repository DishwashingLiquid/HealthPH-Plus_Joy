"""Merge the four approved Disease Watch stores into one typed collection.

The command is a read-only dry run unless ``--apply`` is supplied. Applying
also requires ``--writers-paused``. It never drops or changes source
collections, and it contains no record-cleanup operation.
"""
import argparse
from copy import deepcopy
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys

SERVER_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_ROOT))

from dotenv import load_dotenv
from pymongo import MongoClient

from disease_watch_storage import (
    ALERT_BATCH_STATE,
    ALERT_COOLDOWN,
    DESTINATION_COLLECTION,
    DOCUMENT_KINDS,
    REGIONAL_SUMMARY,
    SOURCE_COLLECTION_KINDS,
    SUMMARY_EVENT,
    ensure_disease_watch_internal_indexes,
)


SOURCE_KINDS = SOURCE_COLLECTION_KINDS

PROTECTED_COLLECTIONS = {
    "self_reports", "mobile_users", "content", "analytics_events", "surveys",
    "survey_responses", "regional_alerts", "mobile_notification_deliveries",
    "application_settings", "analytics_entries", "id_counters", "users",
    "organizations", "role_labels", "activity_logs", "datasets", "points",
}


class MigrationValidationError(RuntimeError):
    pass


def validate_allowlist(source_kinds=SOURCE_KINDS, destination=DESTINATION_COLLECTION):
    if dict(source_kinds) != SOURCE_KINDS:
        raise MigrationValidationError("Source collections must exactly match the approved Disease Watch allowlist")
    if destination in PROTECTED_COLLECTIONS:
        raise MigrationValidationError(f"Protected collection cannot be a migration write target: {destination}")
    if destination != DESTINATION_COLLECTION:
        raise MigrationValidationError(f"Unapproved migration write target: {destination}")


def _identity(value):
    try:
        hash(value)
        return "value", value
    except TypeError:
        return "unhashable", repr(value)


def _display(value):
    return str(value)


def _canonical_document(kind, document):
    item = deepcopy(document)
    if "_id" not in item:
        raise ValueError("missing _id")
    if item.get("kind") not in (None, kind):
        raise ValueError(f"conflicting kind {item.get('kind')!r}")
    item["kind"] = kind
    def require_text(field):
        if not isinstance(item.get(field), str) or not item[field].strip():
            raise ValueError(f"missing or invalid {field}")

    if kind == REGIONAL_SUMMARY:
        require_text("region")
    elif kind == SUMMARY_EVENT:
        require_text("region")
        if item.get("reportId") is None:
            raise ValueError("missing region or reportId")
    elif kind == ALERT_BATCH_STATE:
        region = item.get("region", item["_id"])
        if not isinstance(region, str) or not region.strip() or (item.get("region") is not None and item.get("region") != item["_id"]):
            raise ValueError("batch-state region must equal _id")
        item["region"] = region
    elif kind == ALERT_COOLDOWN:
        require_text("region")
        require_text("symptomKey")
    return item


def _logical_key(item):
    kind = item["kind"]
    if kind in (REGIONAL_SUMMARY, ALERT_BATCH_STATE):
        return kind, _identity(item.get("region"))
    if kind == SUMMARY_EVENT:
        return kind, _identity(item.get("region")), _identity(item.get("reportId"))
    return kind, _identity(item.get("region")), _identity(item.get("symptomKey"))


def _event_reference_diagnostics(db, expected):
    events = [item for item in expected if item["kind"] == SUMMARY_EVENT]
    event_ids = {_identity(item["_id"]) for item in events}
    report_ids = {_identity(item["_id"]) for item in db["self_reports"].find({}, {"_id": 1})}
    missing_sources = [_display(item["reportId"]) for item in events if _identity(item["reportId"]) not in report_ids]

    referenced = []
    for item in expected:
        if item["kind"] == REGIONAL_SUMMARY:
            referenced.extend(("regional_summary", value) for value in item.get("eventIds") or [])
        elif item["kind"] == ALERT_BATCH_STATE:
            for field in ("snapshot", "lastSnapshot"):
                referenced.extend((f"alert_batch_state.{field}", value) for value in (item.get(field) or {}).get("eventIds") or [])
    for alert in db["regional_alerts"].find(
        {"source": "automated_regional_summary"},
        {"trigger.summarySnapshot.eventIds": 1},
    ):
        snapshot = (alert.get("trigger") or {}).get("summarySnapshot") or {}
        referenced.extend(("regional_alert.trigger.summarySnapshot", value) for value in snapshot.get("eventIds") or [])
    missing_events = [
        {"owner": owner, "eventId": _display(value)}
        for owner, value in referenced
        if _identity(value) not in event_ids
    ]
    return {
        "summaryEventsMissingSourceReports": len(missing_sources),
        "missingSourceReportIdSamples": missing_sources[:20],
        "referencesToMissingSummaryEvents": len(missing_events),
        "missingSummaryEventReferenceSamples": missing_events[:20],
    }


def plan_migration(db, source_kinds=SOURCE_KINDS, destination=DESTINATION_COLLECTION):
    validate_allowlist(source_kinds, destination)
    existing_names = set(db.list_collection_names())
    report = {
        "mode": "dry-run",
        "sources": dict(source_kinds),
        "destination": destination,
        "destinationExists": destination in existing_names,
        "sourceCounts": {},
        "destinationCount": db[destination].count_documents({"kind": {"$in": list(DOCUMENT_KINDS)}}),
        "destinationUnknownKindCount": db[destination].count_documents({"kind": {"$nin": list(DOCUMENT_KINDS)}}),
        "destinationKindCounts": {
            kind: db[destination].count_documents({"kind": kind})
            for kind in SOURCE_KINDS.values()
        },
        "destinationIndexNames": [
            item.get("name") for item in db[destination].list_indexes()
        ] if destination in existing_names else [],
        "proposedInserts": 0,
        "alreadyCopied": 0,
        "crossCollectionIdCollisions": [],
        "uniqueKeyConflicts": [],
        "malformedRecords": [],
        "destinationConflicts": [],
        "unexpectedDestinationIds": [],
    }
    expected = []
    ids = {}
    keys = {}
    for source, kind in source_kinds.items():
        documents = list(db[source].find({}))
        report["sourceCounts"][source] = len(documents)
        for document in documents:
            source_id = document.get("_id", "<missing>")
            try:
                item = _canonical_document(kind, document)
            except ValueError as error:
                report["malformedRecords"].append({"source": source, "id": _display(source_id), "reason": str(error)})
                continue
            identity = _identity(item["_id"])
            prior_source = ids.get(identity)
            if prior_source and prior_source != source:
                report["crossCollectionIdCollisions"].append({"id": _display(item["_id"]), "sources": [prior_source, source]})
            else:
                ids[identity] = source
            key = _logical_key(item)
            prior = keys.get(key)
            if prior is not None and prior != identity:
                report["uniqueKeyConflicts"].append({
                    "kind": kind,
                    "ids": [_display(prior[1]), _display(item["_id"])],
                })
            else:
                keys[key] = identity
            expected.append(item)

    expected_by_id = {_identity(item["_id"]): item for item in expected}
    destination_documents = []
    for kind in DOCUMENT_KINDS:
        destination_documents.extend(db[destination].find({"kind": kind}))
    unknown_documents = list(db[destination].find({"kind": {"$nin": list(DOCUMENT_KINDS)}}))
    report["unexpectedDestinationIds"].extend(_display(item.get("_id")) for item in unknown_documents)
    for existing in destination_documents:
        identity = _identity(existing.get("_id"))
        wanted = expected_by_id.get(identity)
        if wanted is None:
            report["unexpectedDestinationIds"].append(_display(existing.get("_id")))
        elif existing == wanted:
            report["alreadyCopied"] += 1
        else:
            report["destinationConflicts"].append({
                "id": _display(existing.get("_id")),
                "expectedKind": wanted["kind"],
                "actualKind": existing.get("kind"),
            })
    report["proposedInserts"] = len(expected) - report["alreadyCopied"] - len(report["destinationConflicts"])
    report["referenceIssues"] = _event_reference_diagnostics(db, expected)
    blocking_fields = (
        "crossCollectionIdCollisions", "uniqueKeyConflicts", "malformedRecords",
        "destinationConflicts", "unexpectedDestinationIds",
    )
    report["blockingIssueCount"] = sum(len(report[field]) for field in blocking_fields)
    report["recordPreservationExpected"] = sum(report["sourceCounts"].values())
    return report, expected


def apply_migration(db, source_kinds=SOURCE_KINDS, destination=DESTINATION_COLLECTION):
    report, expected = plan_migration(db, source_kinds, destination)
    if report["blockingIssueCount"]:
        raise MigrationValidationError("Migration preflight found blocking collisions or malformed/conflicting records")
    target = db[destination]
    ensure_disease_watch_internal_indexes(target)
    inserted = 0
    for item in expected:
        existing = target.find_one({"_id": item["_id"], "kind": item["kind"]})
        if existing is None:
            other_kind = target.find_one({"_id": item["_id"], "kind": {"$ne": item["kind"]}})
            if other_kind is not None:
                raise MigrationValidationError(f"Destination changed kind during copy for _id={item['_id']}")
            target.insert_one(deepcopy(item))
            inserted += 1
        elif existing != item:
            raise MigrationValidationError(f"Destination changed during copy for _id={item['_id']}")
    validation, _ = plan_migration(db, source_kinds, destination)
    if validation["blockingIssueCount"] or validation["proposedInserts"]:
        raise MigrationValidationError("Destination validation failed after copy; sources remain unchanged and the operation is safe to retry")
    validation.update(mode="apply", inserted=inserted, validated=True)
    return validation


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Copy records and create destination indexes")
    parser.add_argument("--writers-paused", action="store_true", help="Confirm API, schedulers, and repair writers are paused")
    parser.add_argument("--destination", default=DESTINATION_COLLECTION, help="Must be the approved destination")
    parser.add_argument("--output", type=Path, help="Save the JSON report locally")
    args = parser.parse_args()
    try:
        validate_allowlist(destination=args.destination)
    except MigrationValidationError as error:
        parser.error(str(error))
    if args.apply and not args.writers_paused:
        parser.error("--apply requires --writers-paused")

    load_dotenv(SERVER_ROOT / ".env")
    try:
        with MongoClient(
            os.environ["MONGO_URI"], serverSelectionTimeoutMS=10000,
            connectTimeoutMS=10000, socketTimeoutMS=10000,
        ) as client:
            db = client[os.environ["DB_NAME"]]
            report = apply_migration(db, destination=args.destination) if args.apply else plan_migration(db, destination=args.destination)[0]
        report["observedAt"] = datetime.now(timezone.utc).isoformat()
        encoded = json.dumps(report, default=str, indent=2)
        if args.output:
            args.output.write_text(encoded + "\n", encoding="utf-8")
        print(encoded)
        return int(bool(report["blockingIssueCount"]))
    except Exception as error:
        # Never print driver exceptions because they can contain the URI.
        print(json.dumps({
            "mode": "apply" if args.apply else "dry-run",
            "status": "failed",
            "errorType": type(error).__name__,
            "message": "Sources were not retired or cleaned. Review the dry run and retry safely.",
        }))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
