from controllers.dashboard_regions import REGIONS
from config.database import (
    application_settings_collection,
    analytics_events_collection,
    survey_responses_collection,
    surveys_collection,
)

SENTIMENTS = {
    "concerned": "Concerned",
    "proactive": "Proactive",
    "misinformed": "Misinformed",
    "neutral": "Neutral",
}

TIME_RANGE_DAYS = {
    "last-7-days": 7,
    "last-30-days": 30,
    "last-90-days": 90,
}

PUBLIC_SOURCES = ["mobile", "website"]
PUBLIC_PLATFORMS = {"mobile", "website"}

EMPTY_SENTIMENT_BREAKDOWN = {
    "concerned": 0,
    "proactive": 0,
    "misinformed": 0,
    "neutral": 0,
}
