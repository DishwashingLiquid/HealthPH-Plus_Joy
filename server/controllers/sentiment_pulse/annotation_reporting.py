"""One answer-level aggregation for Trends and Mobile Surveys."""

from collections import Counter, defaultdict
from datetime import datetime

from controllers.dashboard_regions import EVENT_REGION_PATHS, dashboard_region
from .annotation_config import answer_key, eligible_text
from .annotation_processing import scope, stored_prediction
from .regional_analysis import _ph_naive

READ_FIELDS = {key: 1 for key in (
    "survey_id", "question_id", "question_type", "text", "raw_answer", "analysis.sentiment",
    "analysis.sentiment_score", "analysis.sentiment_model_version", "event_time",
    "created_at", "region", "regionCode", "regionName", "regionLabel", "location",
    "user_location", "userLocation", "metadata",
)}


def submission_time(entry):
    value = entry.get("event_time") or entry.get("created_at")
    try:
        return _ph_naive(value if isinstance(value, datetime) else datetime.fromisoformat(value))
    except (ValueError, TypeError):
        return None


def empty_counts():
    return {"eligibleAnswers": 0, "predictedAnswers": 0, "answersWithoutResults": 0,
            "calm": 0, "worried": 0, "satisfactionAnswers": 0, "satisfiedAnswers": 0,
            "dissatisfiedAnswers": 0, "neutralSatisfactionAnswers": 0}


def finalize(counts):
    return {**counts,
            "worriedShare": counts["worried"] / counts["predictedAnswers"] * 100 if counts["predictedAnswers"] else None,
            "satisfactionShare": counts["satisfiedAnswers"] / counts["satisfactionAnswers"] * 100 if counts["satisfactionAnswers"] else None}


def aggregate_annotations(entries, rules_by_survey, bounds=None, regions=(), *,
                          region_for_entry=None, satisfaction_filter=None):
    totals = empty_counts()
    daily = defaultdict(empty_counts)
    regional = defaultdict(empty_counts)
    surveys = {sid: empty_counts() for sid in rules_by_survey}
    versions = Counter()
    invalid_dates = 0
    for entry in entries:
        sid = entry.get("survey_id")
        if sid not in rules_by_survey:
            continue
        rules = rules_by_survey[sid]
        when = submission_time(entry)
        if when is None:
            invalid_dates += 1
            continue
        if bounds and (when < bounds.start or when > bounds.cutoff
                       or (bounds.end_exclusive and when >= bounds.end_exclusive)):
            continue
        region = (region_for_entry(entry) if region_for_entry else
                  dashboard_region(entry, ("location.region", *EVENT_REGION_PATHS)))
        if regions and region not in regions:
            continue
        targets = (totals, daily[when.date().isoformat()], regional[region], surveys[sid])
        if eligible_text(entry, rules):
            valid = stored_prediction(entry)
            for counts in targets:
                counts["eligibleAnswers"] += 1
                counts["predictedAnswers"] += int(valid)
                counts["answersWithoutResults"] += int(not valid)
                if valid:
                    counts[entry["analysis"]["sentiment"]] += 1
            if valid:
                versions[entry["analysis"]["sentiment_model_version"]] += 1
        scoring = rules.satisfaction.get(entry.get("question_id"))
        if (scoring and entry.get("question_type") in {"rating", "multipleChoice"}
                and (satisfaction_filter is None or satisfaction_filter(entry))):
            key = answer_key(entry.get("raw_answer"))
            if key is not None and key in {answer_key(v) for v in scoring["validValues"]}:
                for counts in targets:
                    counts["satisfactionAnswers"] += 1
                    counts["satisfiedAnswers"] += int(key in {answer_key(v) for v in scoring["satisfiedValues"]})
                    for field, config_key in (("dissatisfiedAnswers", "dissatisfiedValues"),
                                              ("neutralSatisfactionAnswers", "neutralValues")):
                        if config_key not in scoring:
                            # Older two-set overrides do not define these categories.
                            counts[field] = None
                        elif counts[field] is not None:
                            counts[field] += int(key in {answer_key(v) for v in scoring[config_key]})
    return {
        "sentimentStatus": "configured" if any(r.explanations for r in rules_by_survey.values()) else "not_configured",
        "satisfactionStatus": "configured" if any(r.satisfaction for r in rules_by_survey.values()) else "not_configured",
        "totals": finalize(totals),
        "daily": [{"date": day, **finalize(counts)} for day, counts in sorted(daily.items())],
        "regions": [{"region": region, **finalize(counts)} for region, counts in sorted(regional.items(), key=lambda row: row[0] or "")],
        "surveys": [{"surveyId": sid, "sentimentStatus": "configured" if rules_by_survey[sid].explanations else "not_configured",
                     "satisfactionStatus": "configured" if rules_by_survey[sid].satisfaction else "not_configured",
                     **finalize(counts)} for sid, counts in surveys.items()],
        "modelVersions": dict(versions), "mixedModelVersions": len(versions) > 1,
        "excludedInvalidSubmissionDates": invalid_dates,
    }


def report(collection, rules_by_survey, bounds=None, regions=()):
    query = scope({"$in": list(rules_by_survey)})
    return aggregate_annotations(collection.find(query, READ_FIELDS), rules_by_survey, bounds, regions)
