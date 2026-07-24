import os
from pathlib import Path

from config.database import (
    health_literacy_analytics_events_collection,
    health_literacy_content_collection,
    user_collection,
)

CONTENT_FILES = {
    "articles": "articles.json",
    "infographics": "infographics.json",
    "videos": "videos.json",
}

CONTENT_MEDIA_PREFIXES = {
    "articles": ("image/", "video/"),
    "infographics": ("image/",),
    "videos": ("video/",),
}

health_literacy_folder = (
    Path(__file__).resolve().parent.parent.parent / "public" / "health-literacy-hub"
)
health_literacy_media_folder = health_literacy_folder / "media"
_migrated_content_types = set()

ANALYTICS_TIME_RANGE_DAYS = {
    "last-7-days": 7,
    "last-30-days": 30,
    "last-90-days": 90,
}

ANALYTICS_CONTENT_LABELS = {
    "articles": "Articles",
    "videos": "Videos",
    "infographics": "Infographics",
}

ANALYTICS_REGIONS = [
    "NCR",
    "I",
    "II",
    "III",
    "IVA",
    "IVB",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
    "XIII",
    "CAR",
    "BARMM",
]

ALLOWED_ANALYTICS_EVENTS = {
    "content_opened",
    "content_shared",
    "content_downloaded",
    "search",
    "report_exported",
}

CONTENT_INTERACTION_EVENTS = {
    "content_opened",
    "content_shared",
    "content_downloaded",
}

PUBLIC_ANALYTICS_EVENTS = {
    "content_opened",
    "content_shared",
    "content_downloaded",
    "search",
}

ALLOWED_FEEDBACK_PLATFORMS = {"mobile", "website"}
HEALTH_LITERACY_LANGUAGES = (
    "English",
    "Filipino",
    "Cebuano",
    "Ilocano",
    "Hiligaynon",
)
FACT_CHECK_CLAIM_STATUSES = {
    "False",
    "Misleading",
    "Verified",
    "Needs Expert Review",
}
FACT_CHECK_VERIFIERS = {
    "DOH",
    "Medical Expert",
    "Project Researcher",
}

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
