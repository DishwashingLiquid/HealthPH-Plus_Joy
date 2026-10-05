"""Isolated checks for typed Disease Watch storage and migration behavior."""
from copy import deepcopy
from pathlib import Path
import sys
import unittest

import mongomock
from pymongo.errors import DuplicateKeyError

SERVER_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_ROOT))

from disease_watch_storage import (
    ALERT_BATCH_STATE,
    ALERT_COOLDOWN,
    DESTINATION_COLLECTION,
    REGIONAL_SUMMARY,
    SUMMARY_EVENT,
    KindScopedCollection,
    assert_disease_watch_cutover_ready,
    ensure_disease_watch_internal_indexes,
    scoped_collections,
)
from scripts.migrate_disease_watch_internal import (
    MigrationValidationError,
    apply_migration,
    plan_migration,
    validate_allowlist,
)


class KindScopedCollectionTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.views = scoped_collections(self.db[DESTINATION_COLLECTION])

    def test_every_operation_is_kind_scoped_and_writes_retain_kind(self):
        summaries = self.views[REGIONAL_SUMMARY]
        events = self.views[SUMMARY_EVENT]
        summaries.insert_one({"_id": "summary", "region": "NCR", "value": 1})
        events.insert_one({"_id": "event", "region": "NCR", "reportId": "report", "value": 1})

        summaries.update_many({}, {"$set": {"value": 2}})
        self.assertEqual(summaries.count_documents({}), 1)
        self.assertEqual(events.find_one({})["value"], 1)
        self.assertEqual(list(summaries.aggregate([{"$count": "count"}]))[0]["count"], 1)

        summaries.replace_one({"_id": "summary"}, {"_id": "summary", "region": "NCR", "value": 3})
        self.assertEqual(summaries.find_one({})["kind"], REGIONAL_SUMMARY)
        summaries.delete_many({})
        self.assertEqual(summaries.count_documents({}), 0)
        self.assertEqual(events.count_documents({}), 1)

    def test_conflicting_kind_cannot_be_queried_or_written(self):
        summaries = self.views[REGIONAL_SUMMARY]
        for action in (
            lambda: summaries.find_one({"kind": SUMMARY_EVENT}),
            lambda: summaries.insert_one({"kind": SUMMARY_EVENT, "region": "NCR"}),
            lambda: summaries.update_one({}, {"$set": {"kind": SUMMARY_EVENT}}),
        ):
            with self.assertRaises(ValueError):
                action()

    def test_partial_unique_indexes_are_independent_by_kind(self):
        ensure_disease_watch_internal_indexes(self.db[DESTINATION_COLLECTION])
        self.views[REGIONAL_SUMMARY].insert_one({"_id": "s1", "region": "NCR"})
        self.views[SUMMARY_EVENT].insert_one({"_id": "e1", "region": "NCR", "reportId": "r1"})
        self.views[ALERT_BATCH_STATE].insert_one({"_id": "state", "region": "NCR"})
        self.views[ALERT_COOLDOWN].insert_one({"_id": "c1", "region": "NCR", "symptomKey": "fever"})
        with self.assertRaises(DuplicateKeyError):
            self.views[REGIONAL_SUMMARY].insert_one({"_id": "s2", "region": "NCR"})
        with self.assertRaises(DuplicateKeyError):
            self.views[SUMMARY_EVENT].insert_one({"_id": "e2", "region": "NCR", "reportId": "r1"})
        with self.assertRaises(DuplicateKeyError):
            self.views[ALERT_BATCH_STATE].insert_one({"_id": "state2", "region": "NCR"})
        with self.assertRaises(DuplicateKeyError):
            self.views[ALERT_COOLDOWN].insert_one({"_id": "c2", "region": "NCR", "symptomKey": "fever"})

    def test_cutover_guard_rejects_an_empty_or_incomplete_destination(self):
        self.db.regional_summary_events.insert_one({"_id": "e1"})
        with self.assertRaises(RuntimeError):
            assert_disease_watch_cutover_ready(self.db)
        self.db[DESTINATION_COLLECTION].insert_one({"_id": "e1", "kind": SUMMARY_EVENT})
        self.assertEqual(assert_disease_watch_cutover_ready(self.db)["destinationCount"], 1)


class DiseaseWatchMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.source_documents = {
            "regional_symptom_summaries": [{"_id": "summary-1", "region": "NCR", "eventIds": ["event-1"]}],
            "regional_summary_events": [{"_id": "event-1", "region": "NCR", "reportId": "report-1"}],
            "regional_alert_batch_states": [{"_id": "III", "status": "Active", "lastSnapshot": {"eventIds": ["event-1"]}}],
            "regional_alert_cooldowns": [{"_id": "cooldown-1", "region": "NCR", "symptomKey": "fever"}],
        }
        for name, documents in self.source_documents.items():
            self.db[name].insert_many(deepcopy(documents))
        self.db.self_reports.insert_one({"_id": "report-1"})
        self.db.regional_alerts.insert_one({
            "source": "automated_regional_summary",
            "trigger": {"summarySnapshot": {"eventIds": ["event-1"]}},
        })

    def test_dry_run_is_read_only_and_apply_preserves_ids_and_retries(self):
        before = {name: list(self.db[name].find({})) for name in self.source_documents}
        report, _ = plan_migration(self.db)
        self.assertEqual(report["proposedInserts"], 4)
        self.assertEqual(report["blockingIssueCount"], 0)
        self.assertEqual(self.db[DESTINATION_COLLECTION].count_documents({}), 0)

        applied = apply_migration(self.db)
        self.assertTrue(applied["validated"])
        self.assertEqual(applied["inserted"], 4)
        self.assertEqual(
            set(self.db[DESTINATION_COLLECTION].distinct("kind")),
            {REGIONAL_SUMMARY, SUMMARY_EVENT, ALERT_BATCH_STATE, ALERT_COOLDOWN},
        )
        state = self.db[DESTINATION_COLLECTION].find_one({"kind": ALERT_BATCH_STATE})
        self.assertEqual((state["_id"], state["region"]), ("III", "III"))
        self.assertEqual(apply_migration(self.db)["inserted"], 0)
        self.assertEqual(before, {name: list(self.db[name].find({})) for name in self.source_documents})

    def test_cross_collection_ids_and_malformed_records_block_apply(self):
        self.db.regional_alert_batch_states.delete_many({})
        self.db.regional_alert_batch_states.insert_one({"_id": "summary-1", "status": "Active"})
        self.db.regional_alert_cooldowns.insert_one({"_id": "bad", "region": "NCR"})
        report, _ = plan_migration(self.db)
        self.assertEqual(len(report["crossCollectionIdCollisions"]), 1)
        self.assertEqual(len(report["malformedRecords"]), 1)
        with self.assertRaises(MigrationValidationError):
            apply_migration(self.db)
        self.assertEqual(self.db[DESTINATION_COLLECTION].count_documents({}), 0)

    def test_destination_conflict_and_missing_references_are_reported(self):
        self.db.self_reports.delete_many({})
        self.db.regional_symptom_summaries.update_one({}, {"$set": {"eventIds": ["missing-event"]}})
        self.db[DESTINATION_COLLECTION].insert_one({"_id": "event-1", "kind": SUMMARY_EVENT, "region": "WRONG", "reportId": "report-1"})
        report, _ = plan_migration(self.db)
        self.assertEqual(len(report["destinationConflicts"]), 1)
        self.assertEqual(report["referenceIssues"]["summaryEventsMissingSourceReports"], 1)
        self.assertEqual(report["referenceIssues"]["referencesToMissingSummaryEvents"], 1)

    def test_protected_and_unapproved_write_targets_are_rejected(self):
        with self.assertRaises(MigrationValidationError):
            validate_allowlist(destination="self_reports")
        with self.assertRaises(MigrationValidationError):
            validate_allowlist(destination="another_internal_collection")
        with self.assertRaises(MigrationValidationError):
            validate_allowlist({"regional_summary_events": SUMMARY_EVENT})


if __name__ == "__main__":
    unittest.main()
