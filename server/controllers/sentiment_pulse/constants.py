from config.database import (
    health_literacy_analytics_events_collection,
    sentiment_pulse_survey_responses_collection,
    sentiment_pulse_surveys_collection,
)

REGIONS = [
    "NCR",
    "I",
    "II",
    "III",
    "IVA",
    "IVB",
    "V",
    "CAR",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
    "XIII",
    "BARMM",
]

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
