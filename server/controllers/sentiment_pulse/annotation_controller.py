"""Admin routes kept separate from existing survey and language controllers."""

from typing import Annotated, Optional
from datetime import timedelta

from fastapi import BackgroundTasks, Body, Depends, HTTPException
from fastapi.responses import JSONResponse

from config.database import analytics_entries_collection, surveys_collection
from middleware.requireRole import require_role
from .annotation_config import (ConfigurationError, load_config, parse_config,
                                rules_for_survey, validate_survey_rules)
from .annotation_processing import registry, run_processing
from .annotation_reporting import report
from .regional_analysis import get_response_date_range, parse_regions
from .survey_helpers import get_survey_or_404, get_survey_status

Admin = Annotated[dict, Depends(require_role(["Admin", "SUPERADMIN"]))]


def configured_rules(survey, fallback):
    try:
        rules = rules_for_survey(survey, fallback)
        validate_survey_rules(survey, rules)
        return rules
    except ConfigurationError:
        raise HTTPException(503, "Sentiment Pulse question configuration is invalid") from None


def configuration():
    try:
        return load_config()
    except ConfigurationError:
        raise HTTPException(503, "Sentiment Pulse question configuration is unavailable") from None


def configure_survey(survey_id: str, _current_user: Admin, data: dict = Body(...)):
    survey = get_survey_or_404(survey_id)
    # Ended survey semantics are immutable through this interface. No reprocessing
    # or ownership takeover is authorized, including for malformed old results.
    if get_survey_status(survey) == "Ended":
        raise HTTPException(409, "Configure explanation questions before ending the survey")
    try:
        rules = parse_config({"surveys": {survey_id: data}})[survey_id]
        validate_survey_rules(survey, rules)
    except ConfigurationError as error:
        raise HTTPException(400, str(error)) from None
    query = {"id": survey_id, "questions": survey.get("questions") or [],
             "endedAt": survey.get("endedAt")}
    result = surveys_collection.update_one(query, {"$set": {"sentimentPulseConfig": data}})
    if not result.matched_count:
        raise HTTPException(409, "Survey changed; reload before configuring")
    return {"surveyId": survey_id, "configuration": data}


def process_survey(survey_id: str, background_tasks: BackgroundTasks, _current_user: Admin):
    survey = get_survey_or_404(survey_id)
    if get_survey_status(survey) != "Ended":
        raise HTTPException(409, "Only ended surveys can be processed")
    rules = configured_rules(survey, configuration())
    if not rules.explanations:
        if rules.satisfaction:
            return {"surveyId": survey_id, "state": "configured", "job": None,
                    "summary": report(analytics_entries_collection, {survey_id: rules})}
        return {"surveyId": survey_id, "state": "not_configured", "job": None}
    try:
        job, started = registry.reserve(survey_id)
    except RuntimeError:
        raise HTTPException(503, "Sentiment processing capacity reached") from None
    if started:
        background_tasks.add_task(run_processing, analytics_entries_collection, survey_id, rules)
    return JSONResponse(status_code=202, content={"surveyId": survey_id, "accepted": started, "job": job})


def processing_status(survey_id: str, _current_user: Admin):
    survey = get_survey_or_404(survey_id)
    rules = configured_rules(survey, configuration())
    return {"surveyId": survey_id,
            "state": "configured" if rules.explanations or rules.satisfaction else "not_configured",
            "job": registry.get(survey_id), "progressDurable": False,
            "summary": report(analytics_entries_collection, {survey_id: rules})}


def fetch_trends(_current_user: Admin, timeRange: str = "last-30-days",
                 regions: Optional[str] = None, startDate: Optional[str] = None,
                 endDate: Optional[str] = None, surveyId: Optional[str] = None):
    bounds = get_response_date_range(timeRange, startDate, endDate)
    selected = parse_regions(regions)
    surveys = [get_survey_or_404(surveyId)] if surveyId else surveys_collection.find({})
    fallback = configuration()
    rules = {s["id"]: configured_rules(s, fallback) for s in surveys}
    return {"sources": ["mobile"], "filters": {"timeRange": timeRange,
            "startDate": bounds.start.date().isoformat(),
            "endDate": ((bounds.end_exclusive - timedelta(days=1)).date().isoformat()
                        if bounds.end_exclusive else bounds.cutoff.date().isoformat()),
            "regions": selected, "surveyId": surveyId,
            "unknownRegionIncluded": not selected},
            **report(analytics_entries_collection, rules, bounds, selected)}
