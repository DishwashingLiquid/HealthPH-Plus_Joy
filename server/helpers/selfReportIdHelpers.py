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


def ensure_report_id_indexes(reports, counters):
    reports.create_index([("id", 1)], name="unique_self_report_public_id", unique=True)
    try:
        counters.update_one({"_id": COUNTER_ID}, {"$setOnInsert": {"value": 0}}, upsert=True)
    except DuplicateKeyError:
        pass  # Another worker initialized the same counter.


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
    # The unique index guards concurrent API workers.
    return reports.insert_one(document)
