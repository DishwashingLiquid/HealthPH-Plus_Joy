"""Regional scope and submission counts from current analytics submission IDs."""

from collections import defaultdict

from controllers.dashboard_regions import EVENT_REGION_PATHS, dashboard_region
from .annotation_config import eligible_text
from .annotation_processing import scope, stored_prediction
from .annotation_reporting import (READ_FIELDS, aggregate_annotations, empty_counts,
                                   finalize, submission_time)


def identifier(value):
    return str(value).strip() if value is not None and not isinstance(value, (dict, list, bool)) else ""


def submission_link(entry):
    survey = identifier(entry.get("survey_id"))
    submission = identifier(entry.get("submission_id"))
    return ((survey, submission), None) if survey and submission else (None, "missing")


def regional_report(collection, rules, bounds, regions=()):
    fields = {**READ_FIELDS, "submission_id": 1}
    entries = []
    invalid_dates = 0
    for entry in collection.find(scope({"$in": list(rules)}), fields):
        when = submission_time(entry)
        if when is None:
            invalid_dates += 1
        elif (bounds.start <= when <= bounds.cutoff
              and (not bounds.end_exclusive or when < bounds.end_exclusive)):
            entries.append(entry)
    links = {id(entry): submission_link(entry) for entry in entries}
    eligible = [entry for entry in entries if eligible_text(entry, rules[entry["survey_id"]])]
    predicted = [entry for entry in eligible if stored_prediction(entry)]
    processed_groups = defaultdict(list)
    coverage_groups = defaultdict(list)
    for entry in eligible:
        parent, _ = links[id(entry)]
        if parent:
            coverage_groups[parent].append(entry)
    for entry in predicted:
        parent, _ = links[id(entry)]
        if parent:
            processed_groups[parent].append(entry)

    def location(entry):
        return dashboard_region(entry, ("location.region", *EVENT_REGION_PATHS))

    def assigned(group):
        locations = {location(entry) for entry in group}
        # A missing or internally conflicting location keeps the submission unknown.
        return next(iter(locations)) if len(locations) == 1 else None

    assignments = {parent: assigned(processed_groups.get(parent) or group)
                   for parent, group in coverage_groups.items()}

    def entry_region(entry):
        parent, _ = links[id(entry)]
        return assignments[parent] if parent in assignments else location(entry)

    result = aggregate_annotations(entries, rules, regions=regions,
        region_for_entry=entry_region,
        satisfaction_filter=lambda entry: links[id(entry)][0] in processed_groups)
    unresolved = [entry for entry in predicted if not links[id(entry)][0]]
    # Without all relationships the exact number, and potentially its regional
    # allocation, cannot be proved. Expose counts of resolved links separately.
    exact = not unresolved
    known_by_region = defaultdict(int)
    for parent in processed_groups:
        known_by_region[assignments[parent]] += 1

    def counts(region=None, overall=False):
        known = (sum(count for key, count in known_by_region.items() if not regions or key in regions)
                 if overall else known_by_region[region])
        return {"analyzedSubmissions": known if exact else None,
                "linkedAnalyzedSubmissions": known, "submissionCountStatus": "exact" if exact else "incomplete"}

    result["totals"].update(counts(overall=True))
    # Include empty selected regions so a missing row is never interpreted as zero.
    by_region = {row["region"]: row for row in result["regions"]}
    for region in regions:
        by_region.setdefault(region, {"region": region, **finalize(empty_counts())})
    for region, row in by_region.items():
        row.update(counts(region))
    result["regions"] = list(by_region.values())
    result["linkage"] = {"missingAnalyzedAnswers": sum(links[id(e)][1] == "missing" for e in unresolved),
                         "ambiguousAnalyzedAnswers": sum(links[id(e)][1] == "ambiguous" for e in unresolved),
                         "scope": "All date-filtered mobile analytics before region filtering"}
    result["excludedInvalidSubmissionDates"] = invalid_dates
    result["satisfactionScope"] = "linked_analyzed_submissions"
    result["regionsComplete"] = True
    return result
