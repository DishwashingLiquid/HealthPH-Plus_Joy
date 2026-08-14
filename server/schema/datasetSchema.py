import json

# Create a dictionary of a single Dataset
def individual_dataset(dataset) -> dict:
    return {
        "id": str(dataset["_id"]),
        "user_id": str(dataset["user_id"]),
        "user_name": dataset["user_name"],
        "filename": dataset["filename"],
        "original_filename": dataset["original_filename"],
        "file_size": dataset["file_size"],
        "num_of_rows": dataset["num_of_rows"],
        "languages": dataset.get("languages", []),
        "language_counts": dataset.get("language_counts", {}),
        "location_language_counts": dataset.get("location_language_counts", {}),
        "preview_row_count": dataset.get("preview_row_count", 0),
        "preview_headers": str(dataset["preview_headers"]).split("+"),
        "preview_data": (json.loads(dataset["preview_data"])),
        'dataset_type': str(dataset['dataset_type']),
        "dataset_status": dataset.get("dataset_status", dataset.get("dataset_type", "RAW")),
        "description": dataset.get("description", ""),
        "processing_error": dataset.get("processing_error", ""),
        "processed_at": (
            str(dataset["processed_at"]) if dataset.get("processed_at") else ""
        ),
        "created_at": (
            str(dataset["created_at"]) if "created_at" in dataset.keys() else ""
        ),
    }

# Create a list of Dataset dictionaries
def list_datasets(datasets) -> list:
    return [individual_dataset(log) for log in datasets]
