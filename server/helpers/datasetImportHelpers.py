from helpers.dateTimeHelpers import normalize_analytics_datetime


RAW_DATASET_REQUIRED_HEADERS = [
    "id",
    "text",
    "location",
    "date_posted",
    "source",
    "date_collected",
]

DATASET_DATE_COLUMNS = ("date_posted", "date_collected")


def normalize_csv_header(header):
    return str(header).strip().lower().replace(" ", "_")

def is_template_dataset(raw_dataset_df):
    return raw_dataset_df["text"].fillna("").astype(str).str.strip().eq(
        "Sample post text about lung-related diseases."
    ).any()

def validate_dataset_required_values(dataframe):
    """Validate retained CSV rows after completely blank rows are removed."""
    for index, row in dataframe.iterrows():
        if not str(row.get("text", "")).strip():
            raise ValueError(
                f"Row {index + 2}: Text is missing. "
                "Add the post text or remove this row."
            )

        if not str(row.get("id", "")).strip():
            raise ValueError(
                f"Row {index + 2}: ID is missing. "
                "Add an ID or remove this row."
            )

def normalize_dataset_dates(dataframe):
    normalized = dataframe.copy()

    for index, row in normalized.iterrows():
        for column in DATASET_DATE_COLUMNS:
            value = str(row.get(column) or "").strip()

            try:
                normalized.at[index, column] = normalize_analytics_datetime(value)
            except ValueError as error:
                label = column.replace("_", " ").title()

                raise ValueError(
                    f"Row {index + 2}: Check {label}. "
                    "Use year-month-day, for example 2026-12-31."
                ) from error

    return normalized