from datetime import datetime, timedelta, timezone

PH_TIMEZONE = timezone(timedelta(hours=8))

def get_surveillance_window(days, hours=None):
    end = datetime.now(PH_TIMEZONE)

    if hours is not None:
        return end - timedelta(hours=hours), end

    start = (end - timedelta(days=days - 1)).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    return start, end

def is_within_surveillance_window(entry, start, end):
    value = entry.get("event_time")

    if isinstance(value, datetime):
        event_time = value
    elif isinstance(value, str):
        try:
            event_time = datetime.fromisoformat(
                value.strip().replace("Z", "+00:00")
            )
        except ValueError:
            return False
    else:
        return False

    # Existing application timestamps without an offset use PH time.
    if event_time.tzinfo is None:
        event_time = event_time.replace(tzinfo=PH_TIMEZONE)

    event_time = event_time.astimezone(PH_TIMEZONE)

    return start <= event_time <= end
