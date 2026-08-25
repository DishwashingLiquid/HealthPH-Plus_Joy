def individual_analytics_entry(entry) -> dict:
    return {
        "id": str(entry["_id"]),
        "source_type": entry.get("source_type", ""),
        "source_id": entry.get("source_id", ""),
        "dataset_id": str(entry.get("dataset_id", "")),
        "survey_id": str(entry.get("survey_id", "")),
        "report_id": str(entry.get("report_id", "")),
        "text": entry.get("text", ""),
        "language": entry.get("language", ""),
        "source_platform": entry.get("source_platform", ""),
        "location": entry.get("location", {}),
        "event_time": str(entry.get("event_time", "")),
        "collected_at": str(entry.get("collected_at", "")),
        "analysis_status": entry.get("analysis_status", "pending"),
        "analysis_tasks": entry.get("analysis_tasks", []),
        "analysis": entry.get("analysis", {}),
        "created_at": str(entry.get("created_at", "")),
        "updated_at": str(entry.get("updated_at", "")),
        "analyzed_at": str(entry.get("analyzed_at", "")),
    }


def list_analytics_entries(entries) -> list:
    return [individual_analytics_entry(entry) for entry in entries]