import logging
import math
import os
from datetime import datetime, timedelta, timezone
from threading import Event, Thread
from uuid import uuid4

from helpers.dateTimeHelpers import (
    get_ph_datetime,
    parse_analytics_datetime,
)

logger = logging.getLogger(__name__)
ACTIVE_STATES = ["QUEUED", "PROCESSING"]
INTERRUPTED_MESSAGE = "Processing was interrupted. Your data is saved. Please retry processing."


def utc_now():
    return datetime.now(timezone.utc)


def _seconds(name, default):
    try:
        value = float(os.getenv(name, str(default)))
    except ValueError as error:
        raise ValueError(f"{name} must be between 60 and 86400 seconds.") from error
    if not math.isfinite(value) or not 60 <= value <= 86400:
        raise ValueError(f"{name} must be between 60 and 86400 seconds.")
    return value


def new_processing_job():
    now = utc_now()
    return {
        "id": str(uuid4()), "heartbeat_at": now,
        "lease_expires_at": now + timedelta(seconds=_seconds("HEALTHPH_PROCESSING_LEASE_SECONDS", 600)),
    }


def job_guard(job_id, worker_id=None, require_live=False):
    query = {"processing_job.id": job_id}
    if worker_id is not None:
        query["processing_job.worker_id"] = worker_id
    if require_live:
        query.update(live_lease_guard("processing_job"))
    return query


def live_lease_guard(field):
    # Evaluate at MongoDB write time, including for a delayed/large bulk write.
    return {"$expr": {"$gt": [f"${field}.lease_expires_at", "$$NOW"]}}


class ProcessingLeaseLost(RuntimeError):
    pass


class ProcessingLease:
    def __init__(self, collection, status_field, job_id, worker_id, related_collection=None, dataset_id=None, scope=None):
        self.collection = collection
        self.status_field = status_field
        self.job_id = job_id
        self.worker_id = worker_id
        self.related_collection = related_collection
        self.dataset_id = dataset_id
        self.scope = scope or {}
        self.stop = Event()
        self.lost = Event()
        self.thread = None

    def guard(self):
        return {**self.scope, self.status_field: {"$in": ACTIVE_STATES}, **job_guard(self.job_id, self.worker_id, True)}

    def heartbeat(self):
        now = utc_now()
        deadline = now + timedelta(seconds=_seconds("HEALTHPH_PROCESSING_LEASE_SECONDS", 600))
        result = self.collection.update_many(self.guard(), {"$set": {
            "processing_job.heartbeat_at": now, "processing_job.lease_expires_at": deadline,
        }})
        if not result.matched_count:
            self.lost.set()
            return
        if self.related_collection is not None:
            self.related_collection.update_many({
                "dataset_id": self.dataset_id, "source_type": "social_media",
                "dataset_processing_job.id": self.job_id,
                "dataset_processing_job.worker_id": self.worker_id,
                **live_lease_guard("dataset_processing_job"),
            }, {"$set": {"dataset_processing_job.lease_expires_at": deadline}})

    def ensure_active(self):
        if self.lost.is_set() or not self.collection.count_documents(self.guard()):
            raise ProcessingLeaseLost(INTERRUPTED_MESSAGE)

    def _run(self):
        interval = min(30, _seconds("HEALTHPH_PROCESSING_LEASE_SECONDS", 600) / 3)
        while not self.stop.wait(interval):
            try:
                self.heartbeat()
                if self.lost.is_set():
                    return
            except Exception:
                # Publishing still checks database ownership and the deadline.
                logger.warning("Processing heartbeat unavailable; ownership will be checked before publishing")

    def __enter__(self):
        self.ensure_active()
        self.thread = Thread(target=self._run, name="healthph-processing-heartbeat", daemon=True)
        self.thread.start()
        return self

    def __exit__(self, *_):
        self.stop.set()
        if self.thread is not None:
            self.thread.join(timeout=1)


def recover_interrupted_processing(datasets, entries):
    """Mark expired work retryable; never run inference or delete saved results."""
    now = utc_now()
    recovered = {"datasets": 0, "self_reports": 0}
    specifications = [
        (datasets, "dataset_status", {"dataset_type": "RAW"}, "processing_error", "datasets"),
        (entries, "analysis_status", {"source_type": "self_report"}, "analysis_error", "self_reports"),
    ]
    for collection, status_field, scope, error_field, kind in specifications:
        failed_fields = {
            status_field: "FAILED", error_field: INTERRUPTED_MESSAGE,
            "processed_at" if kind == "datasets" else "updated_at": get_ph_datetime(),
        }
        active = {**scope, status_field: {"$in": ACTIVE_STATES}}
        expired = {**active, "processing_job.lease_expires_at": {"$lte": now}}
        for document in collection.find(expired, {"_id": 1, "processing_job": 1}):
            job = document.get("processing_job") or {}
            query = {**expired, "_id": document["_id"], "processing_job.id": job.get("id")}
            if collection.update_one(query, {"$set": {
                **failed_fields,
                "processing_job.recovered_at": now,
            }}).matched_count:
                recovered[kind] += 1
                if kind == "datasets":
                    entries.update_many({
                        "dataset_id": str(document["_id"]), "source_type": "social_media",
                        "dataset_processing_job.id": job.get("id"),
                        "dataset_processing_job.lease_expires_at": {"$lte": now},
                    }, {"$unset": {"dataset_processing_job": ""}})

    return recovered
