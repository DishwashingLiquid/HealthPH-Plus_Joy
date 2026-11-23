"""The read model for processed self-report results.

Only analytics_entries is a reporting source. Raw submissions are accepted by
the mobile controller and snapshotted at ingestion, never joined at read time.
"""
from collections import Counter
from datetime import timedelta
from hashlib import sha256

from helpers.analyticsSymptomHelpers import get_entry_symptoms
from helpers.dateTimeHelpers import parse_analytics_datetime
from region_normalization import REGIONS, resolve_region

PROCESSED_SELF_REPORT_QUERY = {"source_type": "self_report", "analysis_status": "PROCESSED"}
ELIGIBLE_REPORT_STATUSES = {"submitted", "for_review", "verified"}
DISEASE_LABELS = {"TB": "Tuberculosis", "PN": "Pneumonia", "AURI": "Acute Upper Respiratory Infection", "COVID": "COVID-19"}
READ_FIELDS = {field: 1 for field in (
    "source_type", "analysis_status", "report_id", "sourcePublicId",
    "event_time", "reporter", "location",
    "metadata.status", "metadata.symptom_labels", "analysis.symptoms",
    "analysis.symptom_extraction", "analysis.disease_labels",
)}


def ph_datetime(value):
    parsed = parse_analytics_datetime(value)
    return parsed.replace(tzinfo=None) if parsed else None


def reporter_snapshot(reporter):
    """Capture stable identity once; never merge people by their display name."""
    kind = "registered" if reporter.get("reporterType") == "registered" else "guest"
    identity = reporter.get("mobileUserId") if kind == "registered" else reporter.get("sessionKey")
    key = sha256(f"{kind}:{identity}".encode()).hexdigest() if identity else None
    return {
        "reporterType": kind, "identityKey": key,
        "mobileUserId": reporter.get("mobileUserId"),
        "roleId": reporter.get("roleId"), "roleLabel": reporter.get("roleLabel"),
    }


def processed_report(entry):
    """Project a single processed entry, or reject it with an explicit reason."""
    if any(entry.get(field) != value for field, value in PROCESSED_SELF_REPORT_QUERY.items()):
        return None, "not_processed_self_report"
    report_id = entry.get("report_id")
    if not report_id:
        return None, "missing_report_id"
    if not entry.get("sourcePublicId"):
        return None, "missing_public_id"
    status = str((entry.get("metadata") or {}).get("status") or "").strip().lower()
    if status not in ELIGIBLE_REPORT_STATUSES:
        return None, "ineligible_status"
    occurred = ph_datetime(entry.get("event_time"))
    if occurred is None:
        return None, "invalid_event_time"
    reporter = entry.get("reporter") or {}
    identity = reporter.get("identityKey")
    region, _ = resolve_region(entry.get("location"))
    labels = (entry.get("analysis") or {}).get("disease_labels") or []
    diseases = sorted({label for label in labels if isinstance(label, str) and label in DISEASE_LABELS})
    return {
        "entry_id": str(entry.get("_id") or ""), "report_id": str(report_id),
        "id": entry["sourcePublicId"],
        "occurred_at": occurred, "region": region,
        "reporter_id": str(identity) if identity else None,
        "reporter_type": reporter.get("reporterType") or "unknown",
        "reporter": {key: reporter.get(key) for key in ("reporterType", "roleId", "roleLabel")},
        "symptoms": get_entry_symptoms(entry), "disease_codes": diseases,
        "location": dict(entry.get("location") or {}), "status": status,
    }, None


class ProcessedSelfReportRepository:
    def __init__(self, analytics_entries):
        self.collection = analytics_entries

    def ensure_indexes(self):
        self.collection.create_index(
            [("report_id", 1)],
            name="unique_self_report_analytics",
            unique=True,
            partialFilterExpression={
                "source_type": "self_report",
                "report_id": {
                    "$type": "string",
                    "$gt": "",
                },
            },
        )

    def records(self, *, start=None, end=None, regions=None, disease=None, session=None):
        options = {"session": session} if session is not None else {}
        entries = self.collection.find(PROCESSED_SELF_REPORT_QUERY, READ_FIELDS, **options)
        records = []
        for entry in entries:
            record, _ = processed_report(entry)
            if record is None:
                continue
            occurred = record["occurred_at"]
            if (start and occurred < start) or (end and occurred > end):
                continue
            if regions and record["region"] not in regions:
                continue
            if disease and disease not in record["disease_codes"]:
                continue
            records.append(record)
        return sorted(records, key=lambda item: (item["occurred_at"], item["report_id"]), reverse=True)


def report_item(record):
    return {
        "id": record["id"], "analyticsEntryId": record["entry_id"],
        "region": record["region"], "mobileReporterId": record["reporter_id"],
        "reporter": record["reporter"], "combinedSymptoms": list(record["symptoms"].values()),
        "diseaseCodes": record["disease_codes"],
        "diseaseLabels": [DISEASE_LABELS[code] for code in record["disease_codes"]],
        "status": record["status"], "createdAt": record["occurred_at"].isoformat() + "+08:00",
        "source": "processed_analytics",
    }


def report_totals(records):
    identities = {record["reporter_id"] for record in records if record["reporter_id"]}
    symptoms, diseases = Counter(), Counter()
    for record in records:
        symptoms.update(record["symptoms"].values())
        diseases.update(record["disease_codes"])
    return {
        "reportCount": len(records), "reporterCount": len(identities),
        "unidentifiedReporterReports": sum(not record["reporter_id"] for record in records),
        "unknownRegionReports": sum(record["region"] is None for record in records),
        "registeredReporterCount": len({record["reporter_id"] for record in records if record["reporter_id"] and record["reporter_type"] == "registered"}),
        "guestReporterCount": len({record["reporter_id"] for record in records if record["reporter_id"] and record["reporter_type"] == "guest"}),
        "symptomCounts": [{"symptom": label, "count": count} for label, count in sorted(symptoms.items(), key=lambda item: (-item[1], item[0]))],
        "diseaseCounts": dict(sorted(diseases.items())),
    }


def regional_coverage(records):
    grouped = {region: [record for record in records if record["region"] == region] for region in REGIONS}
    denominator = sum(len({record["reporter_id"] for record in rows if record["reporter_id"]}) for rows in grouped.values())
    result = []
    for region, rows in grouped.items():
        if not rows:
            continue
        totals = report_totals(rows)
        result.append({"region": region, "users": totals["reporterCount"], "reportCount": totals["reportCount"],
                       "unidentifiedReporterReports": totals["unidentifiedReporterReports"],
                       "percentage": round(totals["reporterCount"] / denominator * 100) if denominator else None})
    return result


def metric(current, previous):
    difference = current - previous
    return {"current": current, "previous": previous, "change": difference,
            "percentage": round(difference / previous * 100, 2) if previous else None,
            "trend": "up" if difference >= 0 else "down"}


def dashboard(repository, start, end, regions=None):
    previous_start = start - (end - start + timedelta(microseconds=1))
    records = repository.records(start=previous_start, end=end, regions=regions)
    current = [record for record in records if record["occurred_at"] >= start]
    previous = [record for record in records if record["occurred_at"] < start]
    totals, previous_totals = report_totals(current), report_totals(previous)
    return {
        "source": "processed_analytics", "items": [report_item(record) for record in current],
        "regionalCoverage": regional_coverage(current), "totals": totals,
        "userAnalytics": {
            "totalUsers": metric(totals["reporterCount"], previous_totals["reporterCount"]),
            "symptomReports": metric(totals["reportCount"], previous_totals["reportCount"]),
            "unidentifiedReporterReports": totals["unidentifiedReporterReports"],
            "registeredReporterCount": totals["registeredReporterCount"],
            "guestReporterCount": totals["guestReporterCount"],
            "alertOpenRate": {"current": None, "previous": None, "change": None,
                              "percentage": None, "trend": None, "isAvailable": False,
                              "fallbackReason": "Alert reads are delivery events, not processed report results."},
        },
        "period": {"currentStart": start.isoformat() + "+08:00", "currentEnd": end.isoformat() + "+08:00",
                   "previousStart": previous_start.isoformat() + "+08:00", "previousEnd": (start - timedelta(microseconds=1)).isoformat() + "+08:00"},
    }
