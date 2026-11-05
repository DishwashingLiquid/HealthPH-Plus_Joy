"""Read-only submission linkage and regional scope over stored Trends analytics.

Responses supply relationships only. Neither account identity nor response dates,
locations, publication status or answers determine whether analytics is analyzed.
"""

from collections import defaultdict

from controllers.dashboard_regions import EVENT_REGION_PATHS, dashboard_region
from .annotation_config import eligible_text
from .annotation_processing import scope, stored_prediction
from .annotation_reporting import (READ_FIELDS, aggregate_annotations, empty_counts,
                                   finalize, submission_time)


def identifier(value):
    return str(value).strip() if value is not None and not isinstance(value, (dict, list, bool)) else ""


class SubmissionLookup:
    def __init__(self, responses):
        self.aliases = defaultdict(set)
        self.answers = defaultdict(set)
        for response in responses:
            survey = response.get("surveyId")
            aliases = {identifier(response.get(field)) for field in ("submissionId", "id", "_id")} - {""}
            if not aliases:
                continue
            # The document key detects reused submission aliases as ambiguous.
            parent = (survey, identifier(response.get("_id")) or identifier(response.get("submissionId"))
                      or identifier(response.get("id")))
            for alias in aliases:
                self.aliases[(survey, alias)].add(parent)
            answers = response.get("answerIds")
            for question, answer in (answers.items() if isinstance(answers, dict) else ()):
                if identifier(answer):
                    self.answers[(survey, question, identifier(answer))].add(parent)

    def resolve(self, entry):
        survey, question = entry.get("survey_id"), entry.get("question_id")
        direct = identifier(entry.get("submission_id"))
        candidates = set()
        for field in ("response_id", "source_id"):
            answer = identifier(entry.get(field))
            if answer and question:
                candidates.update(self.answers.get((survey, question, answer), ()))
        if direct:
            parents = self.aliases.get((survey, direct), set())
            if len(parents) > 1 or (parents and candidates and parents != candidates) or len(candidates) > 1:
                return None, "ambiguous"
            if parents:
                return next(iter(parents)), None
            if candidates:
                # Two explicit relationship identifiers disagree; do not guess.
                return None, "ambiguous"
            return (survey, direct), None
        if len(candidates) == 1:
            return next(iter(candidates)), None
        return None, "ambiguous" if candidates else "missing"


def regional_report(collection, responses, rules, bounds, regions=()):
    fields = {**READ_FIELDS, "submission_id": 1, "response_id": 1, "source_id": 1}
    entries = []
    invalid_dates = 0
    for entry in collection.find(scope({"$in": list(rules)}), fields):
        when = submission_time(entry)
        if when is None:
            invalid_dates += 1
        elif (bounds.start <= when <= bounds.cutoff
              and (not bounds.end_exclusive or when < bounds.end_exclusive)):
            entries.append(entry)
    lookup = SubmissionLookup(responses.find({"surveyId": {"$in": list(rules)}},
        {"surveyId": 1, "submissionId": 1, "id": 1, "answerIds": 1}))
    links = {id(entry): lookup.resolve(entry) for entry in entries}
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
