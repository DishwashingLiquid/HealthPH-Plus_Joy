from helpers.surveillanceDateHelpers import normalize_analytics_datetime

DATASET_DATE_COLUMNS = ("date_posted", "date_collected")


def normalize_dataset_dates(dataframe):
    """Validate before persistence; never guess a slash-date's month/day order."""
    normalized = dataframe.copy()
    for index, row in normalized.iterrows():
        for column in DATASET_DATE_COLUMNS:
            value = str(row.get(column) or "").strip()
            try:
                normalized.at[index, column] = normalize_analytics_datetime(value)
            except ValueError as error:
                raise ValueError(
                    f"CSV row {index + 2}, {column}: invalid or missing date. {error} "
                    "In Excel, use yyyy-mm-dd for date cells before saving as CSV."
                ) from error
    return normalized
