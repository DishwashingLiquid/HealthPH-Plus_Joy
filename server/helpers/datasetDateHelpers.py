from helpers.surveillanceDateHelpers import normalize_analytics_datetime

DATASET_DATE_COLUMNS = ("date_posted", "date_collected")

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
                    "Use year-month-day, for example 2026-10-31."
                ) from error

    return normalized