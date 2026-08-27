import pandas as pd

from helpers.miscHelpers import get_ph_datetime

DEFAULT_ANALYSIS_TASKS = [
    "sentiment",
    "disease_classification",
    "misinformation",
    "ner",
]


def _clean_text_value(value):
    if value is None:
        return ""

    if isinstance(value, float) and pd.isna(value):
        return ""

    if isinstance(value, list):
        return ", ".join(
            _clean_text_value(item)
            for item in value
            if _clean_text_value(item)
        )

    if isinstance(value, dict):
        return " ".join(
            _clean_text_value(item)
            for item in value.values()
            if _clean_text_value(item)
        )

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

def _is_analyzable_text(value):
    text = _clean_text_value(value)

    if not text:
        return False

    if text.isnumeric():
        return False

    return len(text) >= 3

def build_survey_response_analytics_entries(response_document):
    entries = []

    response_id = str(response_document.get("_id") or response_document.get("id") or "")
    survey_id = str(response_document.get("surveyId") or "")
    answers = response_document.get("answers") or {}
    created_at = response_document.get("createdAt") or get_ph_datetime()

    for question_id, answer_value in answers.items():
        text = _clean_text_value(answer_value)

        if not _is_analyzable_text(text):
            continue

        entries.append(
            {
                "source_type": "survey",
                "source_id": f"{response_id}:{question_id}",
                "survey_id": survey_id,
                "response_id": response_id,
                "question_id": str(question_id),

                "text": text,
                "language": "",
                "source_platform": _clean_text_value(response_document.get("platform")),

                "location": {
                    "raw": _clean_text_value(response_document.get("region")),
                    "region": _clean_text_value(response_document.get("region")),
                    "province": "",
                    "city": "",
                    "barangay": "",
                },

                "event_time": str(created_at),
                "collected_at": str(created_at),

                "analysis_status": "pending",
                "analysis_tasks": ["sentiment", "misinformation", "ner"],

                "analysis": {
                    "sentiment": None,
                    "sentiment_score": None,
                    "disease_labels": [],
                    "disease_probabilities": {},
                    "symptoms": [],
                    "misinformation": None,
                    "misinformation_score": None,
                    "entities": [],
                    "model_version": "",
                },

                "metadata": {
                    "visitor_id": _clean_text_value(response_document.get("visitorId")),
                    "question_id": str(question_id),
                },

                "created_at": created_at,
                "updated_at": None,
                "analyzed_at": None,
            }
        )

    return entries

def build_self_report_analytics_entry(report_document):
    report_id = str(report_document.get("_id") or "")
    notes = _clean_text_value(report_document.get("notes"))
    symptom_labels = report_document.get("symptomLabels") or []
    possible_condition = _clean_text_value(report_document.get("possibleConditionLabel"))

    fallback_text = " ".join(
        value
        for value in [
            _clean_text_value(symptom_labels),
            possible_condition,
        ]
        if value
    )

    text = notes or fallback_text

    if not _is_analyzable_text(text):
        return None

    location = report_document.get("location") or {}
    created_at = report_document.get("createdAt") or get_ph_datetime()

    return {
        "source_type": "self_report",
        "source_id": report_id,
        "report_id": report_id,

        "text": text,
        "language": "",
        "source_platform": _clean_text_value(report_document.get("source")),

        "location": {
            "raw": _clean_text_value(location.get("geocodedAddress"))
                or _clean_text_value(location.get("cityName"))
                or _clean_text_value(location.get("provinceName"))
                or _clean_text_value(location.get("regionName")),
            "region": _clean_text_value(location.get("regionCode"))
                or _clean_text_value(location.get("regionName")),
            "province": _clean_text_value(location.get("provinceName")),
            "city": _clean_text_value(location.get("cityName")),
            "barangay": _clean_text_value(location.get("barangayName")),
            "latitude": location.get("latitude"),
            "longitude": location.get("longitude"),
        },

        "event_time": str(created_at),
        "collected_at": str(report_document.get("syncedAt") or created_at),

        "analysis_status": "pending",
        "analysis_tasks": ["sentiment", "disease_classification", "ner"],

        "analysis": {
            "sentiment": None,
            "sentiment_score": None,
            "disease_labels": [],
            "disease_probabilities": {},
            "symptoms": [],
            "misinformation": None,
            "misinformation_score": None,
            "entities": [],
            "model_version": "",
        },

        "metadata": {
            "symptom_ids": report_document.get("symptomIds") or [],
            "symptom_labels": symptom_labels,
            "possible_condition_id": report_document.get("possibleConditionId") or "",
            "possible_condition_label": possible_condition,
            "status": report_document.get("status") or "",
        },

        "created_at": created_at,
        "updated_at": None,
        "analyzed_at": None,
    }