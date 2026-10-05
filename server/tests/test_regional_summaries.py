"""Isolated summary tests: no config.database or application startup imports."""
from copy import deepcopy
from datetime import datetime
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from region_normalization import NUMERIC_REGION_CODES, REGION_ALIASES, REGIONS, normalize_region, resolve_region
from regional_summaries import MIGRATION_ID, SummaryStore, build_plan, event_for_report, summarize


class Collection:
    def __init__(self, documents=()):
        self.documents = deepcopy(list(documents))
        self.writes = 0
        self.fail_write = False

    def __bool__(self):
        raise AssertionError("PyMongo collection truthiness")

    def find(self, query, *args, **kwargs):
        return deepcopy([item for item in self.documents if all(item.get(key) == value for key, value in query.items())])

    def find_one(self, query, **kwargs):
        return next(iter(self.find(query)), None)

    def writing(self):
        self.writes += 1
        if self.fail_write:
            raise RuntimeError("injected_failure")

    def insert_one(self, item):
        self.writing()
        self.documents.append({"_id": f"generated-{len(self.documents)}", **deepcopy(item)})

    def update_one(self, query, update, upsert=False, **kwargs):
        self.writing()
        item = next((item for item in self.documents if all(item.get(key) == value for key, value in query.items())), None)
        matched = item is not None
        if item is None:
            if not upsert:
                return SimpleNamespace(matched_count=0)
            item = {"_id": f"generated-{len(self.documents)}", **query, **update.get("$setOnInsert", {})}
            self.documents.append(item)
        item.update(deepcopy(update.get("$set", {})))
        for key, value in update.get("$inc", {}).items():
            item[key] = item.get(key, 0) + value
        return SimpleNamespace(matched_count=int(matched))

    def delete_one(self, query, **kwargs):
        self.writing()
        item = next((item for item in self.documents if all(item.get(key) == value for key, value in query.items())), None)
        if item is not None:
            self.documents.remove(item)


def report(index, region="NCR", symptoms=None, **overrides):
    return {"_id": str(index), "source": "mobile_self_report", "status": "submitted", "location": {"regionCode": region},
            "submittedSymptoms": symptoms if symptoms is not None else ["Cough"], "reporter": {"id": "same-person"}, "createdAt": datetime.now(), **overrides}


class RegionalSummaryTests(unittest.TestCase):
    def store(self, reports=(), events=(), summaries=()):
        return SummaryStore(Collection(reports), Collection(events), Collection(summaries), Collection())

    def test_codes_and_all_supported_aliases(self):
        for alias, canonical in {**REGION_ALIASES, **NUMERIC_REGION_CODES}.items():
            self.assertEqual(normalize_region(f"  {alias.lower()}  "), canonical)
        for code in REGIONS:
            self.assertEqual(normalize_region(code), code)
        self.assertIsNone(normalize_region("PH-13"))
        self.assertIsNone(normalize_region("999000000"))

    def test_name_fallback_and_conflict_are_observable(self):
        self.assertEqual(resolve_region({"regionCode": "unknown", "regionName": "Central Luzon"}), ("III", "region_name_fallback"))
        self.assertEqual(resolve_region({"regionCode": "030000000", "regionName": "NCR"}), (None, "conflicting_region"))
        self.assertEqual(resolve_region({"regionCode": "unknown"}), (None, "unrecognized_region"))

    def test_four_and_five_records_same_reporter(self):
        store = self.store()
        for index in range(4):
            self.assertEqual(store.update_report(report(index))["status"], "updated")
        self.assertFalse(store.summaries.documents[0]["isReady"])
        store.update_report(report(4))
        self.assertTrue(store.summaries.documents[0]["isReady"])
        self.assertEqual(store.summaries.documents[0]["reportCount"], 5)

    def test_previously_observed_dataset(self):
        reports = [report(index, "030000000") for index in range(11)]
        reports += [report(index + 11, "130000000" if index < 6 else "NCR") for index in range(9)]
        audit = self.store(reports).plan()[0]
        self.assertEqual({item["region"]: item["reportCount"] for item in audit["regions"]}, {"III": 11, "NCR": 9})
        self.assertTrue(all(item["isReady"] for item in audit["regions"]))

    def test_literal_symptoms_ranked_once_per_report_and_ties(self):
        events = [event_for_report(report(1, symptoms=["Fever", "Cough", "Cough", "cough", " Cough "]))[0],
                  event_for_report(report(2, symptoms=["Fever", "Sore throat"]))[0]]
        summary = summarize("NCR", events + [events[0]])
        self.assertEqual(summary["reportCount"], 2)
        self.assertEqual(summary["symptomCounts"], [{"symptom": "Fever", "count": 2}, {"symptom": "Cough", "count": 1},
                                                  {"symptom": "cough", "count": 1}, {"symptom": "Sore throat", "count": 1}])

    def test_legacy_fallbacks_and_missing_symptoms(self):
        for fields, expected in [({"symptomLabels": ["literal Label"]}, ["literal Label"]),
                                 ({"symptomIds": ["legacy_id"]}, ["legacy_id"]), ({}, [])]:
            self.assertEqual(event_for_report(report(1, symptoms=[], **fields))[0]["symptoms"], expected)

    def test_status_scope_excludes_rejected_and_missing_defaults_to_submitted(self):
        reports = [report(i, status=value, createdAt="1900-01-01") for i, value in enumerate(["submitted", "for_review", "verified", "rejected", None])]
        audit = self.store(reports + [report(6, source="other")]).plan()[0]
        self.assertEqual(audit["eligibleReportCount"], 4)
        self.assertEqual(audit["statusCounts"]["rejected"], 1)

    def test_duplicate_processing_retries_failed_summary_and_no_inflation(self):
        store = self.store()
        store.summaries.fail_write = True
        self.assertEqual(store.update_report(report(1))["status"], "failed")
        self.assertEqual(len(store.events.documents), 1)
        store.summaries.fail_write = False
        for _ in range(3):
            self.assertEqual(store.update_report(report(1))["status"], "updated")
        self.assertEqual(len(store.events.documents), 1)
        self.assertEqual(store.summaries.documents[0]["reportCount"], 1)

    def test_failed_event_write_is_reported_and_recoverable(self):
        store = self.store([report(1)])
        store.events.fail_write = True
        self.assertEqual(store.update_report(report(1))["status"], "failed")
        store.events.fail_write = False
        store.reconcile(object())
        self.assertEqual(store.summaries.documents[0]["reportCount"], 1)

    def test_reconciliation_repairs_and_reruns_preserve_sources(self):
        reports = [report(index, "030000000", ["Cough", "Cough"]) for index in range(5)]
        stale = {"_id": "old-event", "region": "III", "reportId": "0", "symptoms": ["Cough", "Cough", "wrong"]}
        store = self.store(reports, [stale, {**stale, "_id": "duplicate"}, {**stale, "_id": "wrong-region", "region": "NCR"}],
                           [{"_id": "old-summary", "region": "NCR", "reportCount": 50, "isReady": True}])
        original = deepcopy(store.reports.documents)
        store.reconcile(object())
        self.assertEqual(store.summaries.find_one({"region": "III"})["symptomCounts"], [{"symptom": "Cough", "count": 5}])
        self.assertFalse(store.summaries.find_one({"region": "NCR"})["isReady"])
        self.assertEqual(len(store.events.documents), 5)
        store.reconcile(object())
        # Rolling-window bounds intentionally change over wall-clock time; a
        # same-instant audit must be idempotent.
        self.assertFalse(any(store.plan(at=store.summaries.find_one({"region": "III"})["windowEnd"])[0]["proposedChanges"].values()))
        self.assertEqual(store.reports.documents, original)
        self.assertEqual(store.reports.writes, 0)
        self.assertIsNotNone(store.settings.find_one({"_id": MIGRATION_ID}))

    def test_dry_run_is_read_only_reports_skips_and_failures(self):
        reports = [report(1, "unknown"), report(2, location={"regionCode": "NCR", "regionName": "Central Luzon"}),
                   report(3, symptoms="invalid list"), report(4, location={"regionCode": "unknown", "regionName": "NCR"})]
        store = self.store(reports)
        audit = store.plan()[0]
        self.assertEqual((len(audit["skipped"]), len(audit["failed"]), len(audit["warnings"])), (2, 1, 1))
        self.assertEqual(audit["eligibleReportCount"], 1)
        self.assertEqual(sum(c.writes for c in [store.reports, store.events, store.summaries, store.settings]), 0)
        with self.assertRaises(ValueError):
            store.reconcile(object())
        self.assertEqual(store.settings.writes, 0)

    def test_write_failure_never_marks_complete(self):
        store = self.store([report(1)])
        store.summaries.fail_write = True
        with self.assertRaises(RuntimeError):
            store.reconcile(object())
        self.assertEqual(store.settings.writes, 0)

    def test_validation_failure_never_marks_complete(self):
        store = self.store([report(1)])
        store.events.update_one = lambda *args, **kwargs: None
        with self.assertRaises(RuntimeError):
            store.reconcile(object())
        self.assertEqual(store.settings.writes, 0)

    def test_legacy_summary_without_revision_updates(self):
        store = self.store(summaries=[{"_id": "old", "region": "NCR", "reportCount": 0}])
        self.assertEqual(store.update_report(report(1))["status"], "updated")
        self.assertEqual(store.summaries.documents[0]["revision"], 1)

    def test_concurrent_snapshot_cannot_overwrite_newer_summary(self):
        store = self.store()
        store.update_report(report(0))
        original_find = store.events.find
        intercepted = False

        def interleave(query, *args, **kwargs):
            nonlocal intercepted
            snapshot = original_find(query, *args, **kwargs)
            if not intercepted:
                intercepted = True
                store.update_report(report(2))
            return snapshot

        store.events.find = interleave
        store.update_report(report(1))
        self.assertEqual(store.summaries.documents[0]["reportCount"], 3)


if __name__ == "__main__":
    unittest.main()
