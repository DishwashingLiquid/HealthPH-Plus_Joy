"""Mobile aggregate Trends adapter. Reads stored reporting data; never processes it."""

from datetime import timedelta
from typing import Annotated, Optional

from fastapi import Depends, HTTPException

from config.database import analytics_entries_collection, mobile_users_collection, surveys_collection
from middleware.requireMobileAuth import require_mobile_auth
from models.mobileUser import MOBILE_REGISTRATION_SOURCE, MOBILE_ROLE_ID
from .annotation_controller import configuration, configured_rules
from .annotation_reporting import report
from .regional_analysis import get_response_date_range, parse_regions, published_survey_platforms


def share(answers, denominator):
    # Unknown legacy satisfaction mappings remain null, including in distributions.
    return answers / denominator * 100 if answers is not None and denominator else None


def mobile_report(aggregate, filters):
    """Explicit allowlist: no survey rows, identities, model scores or count-table series."""
    totals = aggregate["totals"]
    calm, worried = totals["calm"], totals["worried"]
    predicted = totals["predictedAnswers"]
    dominant = ("tie" if calm == worried else "calm" if calm > worried else "worried") if predicted else None
    return {
        "sources": ["mobile"], "filters": filters,
        "sentiment": {
            "status": aggregate["sentimentStatus"], "dominantCategory": dominant,
            "dominantShare": share(max(calm, worried), predicted),
            **{key: totals[key] for key in ("eligibleAnswers", "predictedAnswers", "answersWithoutResults")},
            "analysisCoverage": share(predicted, totals["eligibleAnswers"]),
        },
        "satisfaction": {
            "status": aggregate["satisfactionStatus"],
            **{key: totals[key] for key in ("satisfactionAnswers", "satisfiedAnswers", "satisfactionShare")},
        },
        "sentimentDistribution": [
            {"category": category, "answers": totals[category], "share": share(totals[category], predicted)}
            for category in ("calm", "worried")
        ],
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


def fetch_mobile_trends(mobile_claims: Annotated[dict, Depends(require_mobile_auth)],
                        timeRange: str = "last-30-days", regions: Optional[str] = None,
                        startDate: Optional[str] = None, endDate: Optional[str] = None,
                        surveyId: Optional[str] = None):
    if not mobile_users_collection.find_one({"id": mobile_claims["sub"],
                                           "source": MOBILE_REGISTRATION_SOURCE, "roleId": MOBILE_ROLE_ID}):
        raise HTTPException(401, "Mobile user not found")
    bounds = get_response_date_range(timeRange, startDate, endDate)
    selected = parse_regions(regions)
    # Reporting includes ended surveys: ending is when answers are staged for analysis.
    # Reuse publication eligibility, independent of the selected submission window.
    candidates = list(surveys_collection.find({"publishToMobile": True, **({"id": surveyId} if surveyId else {})}))
    visible = published_survey_platforms(candidates, bounds.cutoff)["mobile"]
    if surveyId and surveyId not in visible:
        raise HTTPException(404, "Sentiment Pulse survey not found")
    fallback = configuration()
    rules = {survey["id"]: configured_rules(survey, fallback) for survey in candidates if survey.get("id") in visible}
    filters = {
        "timeRange": timeRange, "startDate": bounds.start.date().isoformat(),
        "endDate": ((bounds.end_exclusive - timedelta(days=1)).date().isoformat()
                    if bounds.end_exclusive else bounds.cutoff.date().isoformat()),
        "regions": selected, "surveyId": surveyId, "unknownRegionIncluded": not selected,
        "timezone": "Asia/Manila", "surveyVisibility": "published-to-mobile",
        "participants": "all",
    }
    return mobile_report(report(analytics_entries_collection, rules, bounds, selected), filters)
