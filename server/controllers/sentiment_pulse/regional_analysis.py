from collections import Counter
from datetime import timedelta
from typing import Optional

from .constants import REGIONS, SENTIMENTS, TIME_RANGE_DAYS
from helpers.miscHelpers import get_ph_datetime


def get_range_start_date(time_range: str):
    days = TIME_RANGE_DAYS.get(time_range)

    if not days:
        return None

    start_date = get_ph_datetime().replace(hour=0, minute=0, second=0, microsecond=0)
    return start_date - timedelta(days=days - 1)


def parse_regions(regions: Optional[str]) -> list[str]:
    if not regions:
        return REGIONS

    selected_regions = [
        region.strip() for region in regions.split(",") if region.strip() in REGIONS
    ]

    return selected_regions or REGIONS


def normalize_sentiment(value) -> Optional[str]:
    normalized_value = str(value or "").strip().lower()
    return SENTIMENTS.get(normalized_value)


def get_event_sentiment(event: dict) -> Optional[str]:
    metadata = event.get("metadata") or {}

    for key in (
        "dominantSentiment",
        "dominant_sentiment",
        "sentiment",
        "sentimentScore",
        "sentiment_score",
    ):
        sentiment = normalize_sentiment(event.get(key) or metadata.get(key))

        if sentiment:
            return sentiment

    return None


def get_event_region(event: dict) -> Optional[str]:
    metadata = event.get("metadata") or {}
    region = event.get("region") or metadata.get("region")

    if region in REGIONS:
        return region

    return None


def build_sentiment_breakdown(
    sentiment_counts: Counter,
    total_responses: int,
) -> dict:
    if total_responses == 0:
        return {sentiment_key: 0 for sentiment_key in SENTIMENTS.keys()}

    return {
        sentiment_key: round(
            (sentiment_counts[sentiment_label] / total_responses) * 100
        )
        for sentiment_key, sentiment_label in SENTIMENTS.items()
    }
