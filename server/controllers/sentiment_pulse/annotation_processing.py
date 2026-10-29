"""Sentiment-only, insert-once annotations with optimistic input guards."""

from threading import Lock
from uuid import uuid4

from .annotation_config import eligible_text
from .inference_client import BATCH_SIZE, SentimentClient, probability, valid_version


def scope(survey_id):
    return {"source_type": "survey_response", "survey_id": survey_id, "source_platform": "mobile"}


def stored_prediction(entry):
    analysis = entry.get("analysis") or {}
    return (isinstance(analysis, dict) and analysis.get("sentiment") in {"calm", "worried"}
            and probability(analysis.get("sentiment_score"))
            and valid_version(analysis.get("sentiment_model_version")))


def unannotated(entry):
    analysis = entry.get("analysis")
    return isinstance(analysis, dict) and all(analysis.get(k) is None for k in (
        "sentiment", "sentiment_score", "sentiment_model_version"))


def write_prediction(collection, survey_id, entry, prediction):
    query = {**scope(survey_id), "_id": entry["_id"]}
    # Preserve missing vs null as well as values. Protect every consumed input
    # and the annotations against changes after inference was dispatched.
    for key in ("text", "raw_answer", "question_id", "question_type", "source_id", "response_id"):
        query[key] = entry[key] if key in entry else {"$exists": False}
    query.update({"analysis.sentiment": None, "analysis.sentiment_score": None,
                  "analysis.sentiment_model_version": None})
    return collection.update_one(query, {"$set": {
        "analysis.sentiment": prediction["predicted_label_name"],
        "analysis.sentiment_score": prediction["worried_probability"],
        "analysis.sentiment_model_version": prediction["model_version"],
    }}).matched_count


class ProcessRegistry:
    """Bounded latest job per survey in this process, without persistent claims."""
    def __init__(self, capacity=256):
        self.lock = Lock()
        self.jobs = {}
        self.capacity = capacity

    def reserve(self, survey_id):
        with self.lock:
            existing = self.jobs.get(survey_id)
            if existing and existing["state"] in {"scheduled", "running"}:
                return dict(existing), False
            if len(self.jobs) >= self.capacity and survey_id not in self.jobs:
                idle = next((sid for sid, job in self.jobs.items() if job["state"] not in {"scheduled", "running"}), None)
                if idle is None:
                    raise RuntimeError("Sentiment processing capacity reached")
                del self.jobs[idle]
            job = {"jobId": str(uuid4()), "state": "scheduled", "stored": 0,
                   "skipped": 0, "failedBatches": 0, "failedWrites": 0, "error": None}
            self.jobs[survey_id] = job
            return dict(job), True

    def update(self, survey_id, **values):
        with self.lock:
            self.jobs[survey_id].update(values)

    def get(self, survey_id):
        with self.lock:
            job = self.jobs.get(survey_id)
            return dict(job) if job else None


registry = ProcessRegistry()


def run_processing(collection, survey_id, rules, jobs=registry, client_factory=SentimentClient):
    stored = skipped = failed = failed_writes = 0
    client = None
    jobs.update(survey_id, state="running")

    def process(batch):
        nonlocal stored, skipped, failed, failed_writes
        try:
            predictions = client.predict_batch([entry["text"] for entry in batch])
        except Exception:
            failed += 1
            jobs.update(survey_id, failedBatches=failed, error="Sentiment inference batch failed")
            return
        for entry, prediction in zip(batch, predictions, strict=True):
            try:
                written = write_prediction(collection, survey_id, entry, prediction)
                stored += int(bool(written))
                skipped += int(not written)
            except Exception:
                # A failed write never removes successful writes in this batch.
                failed_writes += 1
                jobs.update(survey_id, error="Sentiment annotation write failed")
        jobs.update(survey_id, stored=stored, skipped=skipped, failedBatches=failed, failedWrites=failed_writes)

    try:
        batch = []
        for entry in collection.find(scope(survey_id)):
            if not eligible_text(entry, rules) or not unannotated(entry):
                skipped += 1
                continue
            if client is None:
                client = client_factory()
                client.ready()
            batch.append(entry)
            if len(batch) == BATCH_SIZE:
                process(batch)
                batch = []
        if batch:
            process(batch)
        jobs.update(survey_id, state="completed_with_errors" if failed or failed_writes else "completed",
                    stored=stored, skipped=skipped, failedBatches=failed, failedWrites=failed_writes)
    except Exception:
        jobs.update(survey_id, state="failed", stored=stored, skipped=skipped,
                    error="Sentiment processing failed; retry answers without results")
    finally:
        if client is not None:
            client.close()
