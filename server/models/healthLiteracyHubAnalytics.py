from typing import Any, Optional

from pydantic import BaseModel


class HealthLiteracyAnalyticsEvent(BaseModel):
    eventType: str
    contentId: Optional[str] = None
    contentTitle: Optional[str] = None
    contentType: Optional[str] = None
    clientPlatform: Optional[str] = None
    region: Optional[str] = None
    topic: Optional[str] = None
    vote: Optional[str] = None
    reportFormat: Optional[str] = None
    visitorId: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class HealthLiteracyFeedbackRequest(BaseModel):
    vote: str
    clientPlatform: str


class HealthLiteracyContentReviewAction(BaseModel):
    action: str
    assignedReviewer: Optional[str] = None
