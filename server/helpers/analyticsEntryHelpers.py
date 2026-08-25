import pandas as pd

from helpers.miscHelpers import get_ph_datetime

DEFAULT_ANALYSIS_TASKS = [
    "sentiment",
    "disease_classification",
    "misinformation",
    "ner",
]


def _clean_text_value(value):
    if pd.isna(value):
        return ""

    return str(value).strip()


def build_social_media_analytics_entries(
    raw_dataset_df,
    dataset_id,
    uploaded_by,
):
    entries = []

    for _, row in raw_dataset_df.iterrows():
        source_id = _clean_text_value(row.get("id"))
        text = _clean_text_value(row.get("text"))

        if not text:
            continue

        entries.append(
            {
                "source_type": "social_media",
                "source_id": source_id,
                "dataset_id": str(dataset_id),
                "uploaded_by": str(uploaded_by),

                "text": text,
                "language": _clean_text_value(row.get("language")),
                "source_platform": _clean_text_value(row.get("source")),

                "location": {
                    "raw": _clean_text_value(row.get("location")),
                    "region": "",
                    "province": "",
                    "city": "",
                    "barangay": "",
                },

                "event_time": _clean_text_value(row.get("date_posted")),
                "collected_at": _clean_text_value(row.get("date_collected")),

                "analysis_status": "pending",
                "analysis_tasks": DEFAULT_ANALYSIS_TASKS,

                "analysis": {
                    "sentiment": None,
                    "sentiment_score": None,
                    "disease_labels": [],
                    "disease_probabilities": {},
                    "symptoms": [],
                    "misinformation_score": None,
                    "entities": [],
                    "model_version": "",
                },

                "created_at": get_ph_datetime(),
                "updated_at": None,
                "analyzed_at": None,
            }
        )

    return entries