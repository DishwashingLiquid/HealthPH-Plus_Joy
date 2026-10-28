"""Readable self-report identities; MongoDB references always remain unchanged."""
import re

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

REPORT_ID_PATTERN = re.compile(r"SEL-([0-9]{6})\Z")
COUNTER_ID = "self_report_public_id"
MAX_SEQUENCE = 999999


class ReportIdError(RuntimeError):
    pass


def report_number(value):
    match = REPORT_ID_PATTERN.fullmatch(value) if isinstance(value, str) else None
    return int(match.group(1)) if match and int(match.group(1)) > 0 else None


def audit_report_ids(reports):
    """Validate before index/counter initialization or a controlled backfill."""
    seen = set()
    highest = 0
    missing = []
    for report in reports:
        value = report.get("id")
        if value in (None, ""):
            missing.append(report)
            continue
        number = report_number(value)
        if number is None or value in seen:
            raise ReportIdError("Invalid or duplicate readable report ID; reconcile before rollout.")
        seen.add(value)
        highest = max(highest, number)
    return highest, missing


def ensure_report_id_indexes(reports, counters):
    highest, _ = audit_report_ids(reports.find({}, {"id": 1}))
    # Legacy records without an id are permitted until the controlled backfill.
    reports.create_index(
        [("id", 1)], name="unique_self_report_public_id", unique=True,
        partialFilterExpression={"id": {"$type": "string", "$gt": ""}},
    )
    # $max never resets a sequence consumed by another worker or failed insert.
    try:
        counters.update_one({"_id": COUNTER_ID}, {"$max": {"value": highest}}, upsert=True)
    except DuplicateKeyError:
        counters.update_one({"_id": COUNTER_ID}, {"$max": {"value": highest}})


def next_report_id(counters):
    counter = counters.find_one_and_update(
        {"_id": COUNTER_ID, "value": {"$gte": 0, "$lt": MAX_SEQUENCE}},
        {"$inc": {"value": 1}}, return_document=ReturnDocument.AFTER,
    )
    if counter is None:
        raise ReportIdError("Report ID sequence is unavailable or exhausted.")
    return f"SEL-{counter['value']:06d}"


def insert_report_with_id(reports, counters, document):
    document["id"] = next_report_id(counters)
    # The unique index is the final guard even across API workers/backfill runs.
    return reports.insert_one(document)
