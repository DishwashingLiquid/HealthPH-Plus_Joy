from typing import Any, Optional

from pydantic import BaseModel


class SentimentPulseSurveyDraft(BaseModel):
    title: str
    subtitle: Optional[str] = ""
    target: int
    questions: list[dict[str, Any]]
    surveyJson: dict[str, Any]


class SentimentPulseSurveySchedule(BaseModel):
    scheduledAt: str


class SentimentPulseSurveyResponse(BaseModel):
    answers: dict[str, Any]
    platform: str
    visitorId: Optional[str] = None
    region: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
