"""Mobile aggregate Trends adapter. Reads stored reporting data; never processes it."""

from datetime import timedelta
from typing import Annotated, Optional

from fastapi import Depends, HTTPException

from config.database import (analytics_entries_collection, mobile_users_collection,
                             survey_responses_collection, surveys_collection)
from controllers.dashboard_regions import dashboard_region, USER_REGION_PATHS
from middleware.requireMobileAuth import require_mobile_auth
from models.mobileUser import MOBILE_REGISTRATION_SOURCE, MOBILE_ROLE_ID
from region_normalization import REGION_NAMES
from .annotation_controller import configuration, configured_rules
from .annotation_processing import scope
from .annotation_reporting import READ_FIELDS, aggregate_annotations
from .regional_analysis import (PH_TIMEZONE, ResponseDateRange, get_response_date_range,
                                parse_regions, published_survey_platforms)
from .regional_reporting import regional_report


def share(answers, denominator):
    # Unknown legacy satisfaction mappings remain null, including in distributions.
    return answers / denominator * 100 if answers is not None and denominator else None


def sentiment_summary(status, totals):
    calm, worried = totals["calm"], totals["worried"]
    predicted = totals["predictedAnswers"]
    dominant = ("tie" if calm == worried else "calm" if calm > worried else "worried") if predicted else None
    return {
        "status": status, "dominantCategory": dominant,
        "dominantShare": share(max(calm, worried), predicted),
        **{key: totals[key] for key in ("eligibleAnswers", "predictedAnswers", "answersWithoutResults")},
        "analysisCoverage": share(predicted, totals["eligibleAnswers"]),
    }


def sentiment_distribution(totals):
    return [{"category": category, "answers": totals[category],
             "share": share(totals[category], totals["predictedAnswers"])}
            for category in ("calm", "worried")]


def sentiment_change(current, baseline):
    # A missing baseline/current denominator is unavailable, never a zero change.
    return {category: (share(current[category], current["predictedAnswers"])
                       - share(baseline[category], baseline["predictedAnswers"]))
            if current["predictedAnswers"] and baseline["predictedAnswers"] else None
            for category in ("calm", "worried")}


def mobile_report(aggregate, filters):
    """Explicit allowlist: no identities, raw answers or model metadata."""
    totals = aggregate["totals"]
    return {
        "sources": ["mobile"], "filters": filters,
        "sentiment": sentiment_summary(aggregate["sentimentStatus"], totals),
        "satisfaction": {
            "status": aggregate["satisfactionStatus"],
            **{key: totals[key] for key in ("satisfactionAnswers", "satisfiedAnswers", "satisfactionShare")},
        },
        "sentimentDistribution": sentiment_distribution(totals),
        "satisfactionDistribution": [
            {"category": category, "answers": totals[key], "share": share(totals[key], totals["satisfactionAnswers"])}
            for category, key in (("satisfied", "satisfiedAnswers"),
                                  ("neutral", "neutralSatisfactionAnswers"),
                                  ("dissatisfied", "dissatisfiedAnswers"))
        ],
        "satisfactionTrend": [
            {"date": row["date"], **{key: row[key] for key in ("satisfactionAnswers", "satisfiedAnswers", "satisfactionShare")}}
            for row in aggregate["daily"]
        ],
    }


def previous_period(bounds):
    end = bounds.end_exclusive or (bounds.cutoff.replace(hour=0, minute=0, second=0, microsecond=0)
                                   + timedelta(days=1))
    try:
        return ResponseDateRange(start=bounds.start - (end - bounds.start),
                                 cutoff=bounds.cutoff, end_exclusive=bounds.start)
    except OverflowError:
        raise HTTPException(400, "Date range has no representable previous comparison period") from None


def sentiment_trends(current, baseline, surveys, baseline_bounds):
    previous = {row["surveyId"]: row for row in baseline["surveys"]}
    titles = {survey["id"]: survey.get("title") or survey["id"] for survey in surveys}
    rows = []
    for row in sorted(current["surveys"], key=lambda item: item["surveyId"]):
        prior = previous[row["surveyId"]]
        rows.append({
            "surveyId": row["surveyId"], "title": titles[row["surveyId"]],
            "sentiment": sentiment_summary(row["sentimentStatus"], row),
            "sentimentDistribution": sentiment_distribution(row),
            "previousSentiment": sentiment_summary(prior["sentimentStatus"], prior),
            "previousSentimentDistribution": sentiment_distribution(prior),
            "changeFromOverviewBaseline": sentiment_change(row, baseline["totals"]),
            "changeFromPreviousPeriod": sentiment_change(row, prior),
        })
    return {
        "comparison": "previous-equal-calendar-period", "changeUnit": "percentage-points",
        "baseline": {
            "startDate": baseline_bounds.start.date().isoformat(),
            "endDate": (baseline_bounds.end_exclusive - timedelta(days=1)).date().isoformat(),
            "sentiment": sentiment_summary(baseline["sentimentStatus"], baseline["totals"]),
            "sentimentDistribution": sentiment_distribution(baseline["totals"]),
        },
        "overviewChange": sentiment_change(current["totals"], baseline["totals"]),
        "surveys": rows,
    }


def mobile_regional(user, requested_region, surveys, fallback, bounds, filters):
    if requested_region is not None:
        selected = parse_regions(requested_region)
        if len(selected) != 1:
            raise HTTPException(400, "regionalRegion must select exactly one recognized region")
        region, source = selected[0], "selection"
    else:
        region, source = dashboard_region(user, USER_REGION_PATHS), "profile"
    regional_filters = {**filters, "regions": [region] if region else [], "surveyId": None,
                        "unknownRegionIncluded": False, "surveyVisibility": "all-existing-surveys"}
    result = {"status": "available" if region else "region_required", "regionCode": region,
              "regionLabel": REGION_NAMES.get(region), "regionSource": source, "filters": regional_filters}
    if region is None:
        # Never substitute all-region totals for an absent/contradictory profile region.
        return result
    rules = {survey["id"]: configured_rules(survey, fallback) for survey in surveys if survey.get("id")}
    aggregate = regional_report(analytics_entries_collection, survey_responses_collection, rules, bounds, [region])
    projected = mobile_report(aggregate, regional_filters)
    result.update({key: projected[key] for key in ("sentiment", "sentimentDistribution",
                                                 "satisfaction", "satisfactionDistribution")})
    result.update({key: aggregate["totals"][key] for key in
                   ("analyzedSubmissions", "linkedAnalyzedSubmissions", "submissionCountStatus")})
    result["satisfactionScope"] = aggregate["satisfactionScope"]
    return result


def fetch_mobile_trends(mobile_claims: Annotated[dict, Depends(require_mobile_auth)],
                        timeRange: str = "last-30-days", regions: Optional[str] = None,
                        startDate: Optional[str] = None, endDate: Optional[str] = None,
                        surveyId: Optional[str] = None, regionalRegion: Optional[str] = None):
    user = mobile_users_collection.find_one({"id": mobile_claims["sub"],
                                           "source": MOBILE_REGISTRATION_SOURCE, "roleId": MOBILE_ROLE_ID})
    if not user:
        raise HTTPException(401, "Mobile user not found")
    bounds = get_response_date_range(timeRange, startDate, endDate)
    selected = parse_regions(regions)
    # Reporting includes ended surveys: ending is when answers are staged for analysis.
    # Reuse publication eligibility, independent of the selected submission window.
    surveys = list(surveys_collection.find({}))
    candidates = [survey for survey in surveys if survey.get("publishToMobile") is True
                  and (not surveyId or survey.get("id") == surveyId)]
    visible = published_survey_platforms(candidates, bounds.cutoff)["mobile"]
    if surveyId and surveyId not in visible:
        raise HTTPException(404, "Sentiment Pulse survey not found")
    candidates = [survey for survey in candidates if survey.get("id") in visible]
    fallback = configuration()
    rules = {survey["id"]: configured_rules(survey, fallback) for survey in candidates}
    baseline_bounds = previous_period(bounds)
    # One stored-answer read supplies both periods; reuse the dashboard aggregator.
    entries = list(analytics_entries_collection.find(scope({"$in": list(rules)}), READ_FIELDS))
    current = aggregate_annotations(entries, rules, bounds, selected)
    baseline = aggregate_annotations(entries, rules, baseline_bounds, selected)
    filters = {
        "timeRange": timeRange, "startDate": bounds.start.date().isoformat(),
        "endDate": ((bounds.end_exclusive - timedelta(days=1)).date().isoformat()
                    if bounds.end_exclusive else bounds.cutoff.date().isoformat()),
        "regions": selected, "surveyId": surveyId, "unknownRegionIncluded": not selected,
        "timezone": "Asia/Manila", "surveyVisibility": "published-to-mobile",
        "participants": "all",
    }
    result = mobile_report(current, filters)
    result["asOf"] = bounds.cutoff.replace(tzinfo=PH_TIMEZONE).isoformat()
    result["sentimentTrends"] = sentiment_trends(current, baseline, candidates, baseline_bounds)
    result["regional"] = mobile_regional(user, regionalRegion, surveys, fallback, bounds, filters)
    return result
