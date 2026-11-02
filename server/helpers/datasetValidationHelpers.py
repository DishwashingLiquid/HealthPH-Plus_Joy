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
