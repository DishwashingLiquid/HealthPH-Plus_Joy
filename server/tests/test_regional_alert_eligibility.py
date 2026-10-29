"""Focused pure regression tests for rolling automated-summary eligibility."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from regional_summaries import event_for_report, summarize, settings_values


PH = timezone(timedelta(hours=8))
AT = datetime(2026, 9, 11, 12, 0)


def report(number, when=AT, region="NCR", symptoms=None, status="submitted", **extra):
    item = {"_id": str(number), "source": "mobile_self_report", "status": status,
            "location": {"regionCode": region}, "createdAt": when,
            "submittedSymptoms": symptoms or ["Fever"]}
    item.update(extra)
    return item


class RegionalAlertEligibilityTests(unittest.TestCase):
    def events(self, count, **kwargs): return [event_for_report(report(index, **kwargs))[0] for index in range(count)]

    def test_strict_total_boundary_and_per_report_symptom_deduplication(self):
        self.assertEqual(summarize("NCR", self.events(5), AT, 30)["reportCount"], 5)
        result = summarize("NCR", self.events(6, symptoms=["Fever", "Fever", "Cough"]), AT, 30)
        self.assertEqual(result["reportCount"], 6)  # automation compares this total strictly to threshold
        self.assertEqual(result["symptomCounts"], [{"symptom": "Cough", "count": 6}, {"symptom": "Fever", "count": 6}])

    def test_all_windows_and_exact_boundaries(self):
        for minutes in (15, 30, 60, 480, 720, 1440):
            events = [event_for_report(report("edge", AT - timedelta(minutes=minutes)))[0],
                      event_for_report(report("old", AT - timedelta(minutes=minutes, seconds=1)))[0],
                      event_for_report(report("future", AT + timedelta(seconds=1)))[0]]
            self.assertEqual(summarize("NCR", events, AT, minutes)["reportCount"], 1)

    def test_status_region_and_timestamp_eligibility(self):
        self.assertEqual(event_for_report(report(1, status="rejected"))[1], "ineligible_status")
        self.assertEqual(event_for_report(report(2, status=None))[0]["sourceStatus"], "submitted")
        self.assertEqual(event_for_report(report(3, region="invalid"))[1], "unrecognized_region")
        self.assertEqual(event_for_report(report(4, when="bad-date"))[1], "invalid_created_at")
        aware = event_for_report(report(5, when=datetime(2026, 9, 11, 4, 0, tzinfo=timezone.utc)))[0]
        self.assertEqual(summarize("NCR", [aware], AT, 15)["reportCount"], 1)

    def test_consumption_and_settings_are_non_resurrecting(self):
        events = self.events(6)
        for event in events: event["consumedBatchId"] = "batch-1"
        self.assertEqual(summarize("NCR", events, AT, 1440)["reportCount"], 0)
        self.assertEqual(settings_values({}), {"enabled": False, "threshold": 5, "intervalMinutes": 1440})
        self.assertEqual(settings_values({"enabled": True, "threshold": 2, "intervalMinutes": 15})["intervalMinutes"], 15)


if __name__ == "__main__": unittest.main()
