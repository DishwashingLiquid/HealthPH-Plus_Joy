import os
from pathlib import Path

from config.database import (
    health_literacy_analytics_events_collection,
    health_literacy_content_collection,
    user_collection,
)

CONTENT_TYPE_CONFIG = {
    "article": {
        "legacy": "articles",
        "label": "Articles",
        "file": "articles.json",
        "media_prefixes": ("image/", "video/", "application/pdf"),
    },
    "video": {
        "legacy": "videos",
        "label": "Videos",
        "file": "videos.json",
        "media_prefixes": ("video/",),
    },
    "infographic": {
        "legacy": "infographics",
        "label": "Infographics",
        "file": "infographics.json",
        "media_prefixes": ("image/",),
    },
}

CONTENT_FILES = {
    config["legacy"]: config["file"] for config in CONTENT_TYPE_CONFIG.values()
}

CONTENT_MEDIA_PREFIXES = {
    config["legacy"]: config["media_prefixes"]
    for config in CONTENT_TYPE_CONFIG.values()
}

LEGACY_TO_STORAGE_CONTENT_TYPE = {
    config["legacy"]: storage_type
    for storage_type, config in CONTENT_TYPE_CONFIG.items()
}
STORAGE_TO_LEGACY_CONTENT_TYPE = {
    storage_type: config["legacy"]
    for storage_type, config in CONTENT_TYPE_CONFIG.items()
}
CONTENT_TYPE_LABELS = {
    storage_type: config["label"]
    for storage_type, config in CONTENT_TYPE_CONFIG.items()
}
CONTENT_TYPE_ALIASES = {
    **LEGACY_TO_STORAGE_CONTENT_TYPE,
    **{storage_type: storage_type for storage_type in CONTENT_TYPE_CONFIG},
}
CONTENT_TYPE_ALIASES["fact_check"] = "fact_check"
CONTENT_TYPE_ALIASES["fact-check"] = "fact_check"

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

ANALYTICS_CONTENT_LABELS = CONTENT_TYPE_LABELS

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


def normalize_storage_content_type(
    value: str | None,
    *,
    allow_fact_check: bool = False,
) -> str | None:
    normalized_value = str(value or "").strip().lower()

    if not normalized_value:
        return None

    if normalized_value in CONTENT_TYPE_ALIASES:
        storage_type = CONTENT_TYPE_ALIASES[normalized_value]
        if storage_type == "fact_check" and not allow_fact_check:
            return None
        return storage_type

    for storage_type, label in CONTENT_TYPE_LABELS.items():
        if label.lower() == normalized_value:
            return storage_type

    return None


def get_content_bucket(content_type: str) -> str | None:
    storage_type = normalize_storage_content_type(content_type)
    if not storage_type:
        return None

    return STORAGE_TO_LEGACY_CONTENT_TYPE.get(storage_type)


def get_legacy_content_type(content_type: str) -> str:
    storage_type = normalize_storage_content_type(content_type)
    if not storage_type:
        return str(content_type or "")

    return STORAGE_TO_LEGACY_CONTENT_TYPE.get(storage_type, storage_type)


def get_content_type_label(content_type: str) -> str:
    storage_type = normalize_storage_content_type(content_type)
    if not storage_type:
        return str(content_type or "")

    return CONTENT_TYPE_LABELS.get(storage_type, storage_type)


def get_storage_content_types() -> tuple[str, ...]:
    return tuple(CONTENT_TYPE_CONFIG.keys())
