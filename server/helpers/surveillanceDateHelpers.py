from datetime import datetime, timedelta, timezone
import re

PH_TIMEZONE = timezone(timedelta(hours=8))
ISO_DATE_PATTERN = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
ISO_TIMESTAMP_PATTERN = re.compile(
    r"[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}"
    r"(?::[0-9]{2}(?:\.[0-9]{1,6})?)?(?:Z|[+-][0-9]{2}:[0-9]{2})?"
)


def parse_analytics_datetime(value):
    """Parse ISO dates/timestamps; legacy offset-free times mean Philippine time."""
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        value = value.strip()
        if not (ISO_DATE_PATTERN.fullmatch(value) or ISO_TIMESTAMP_PATTERN.fullmatch(value)):
            return None
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=PH_TIMEZONE)
    try:
        return parsed.astimezone(PH_TIMEZONE)
    except (ValueError, OverflowError):
        return None


def normalize_analytics_datetime(value):
    """Preserve a date-only value; serialize known times with an explicit +08:00."""
    parsed = parse_analytics_datetime(value)
    if parsed is None:
        raise ValueError(
            "Use YYYY-MM-DD (2026-10-31), or an ISO timestamp "
            "such as 2026-10-31T09:30:00+08:00."
        )
    if isinstance(value, str) and ISO_DATE_PATTERN.fullmatch(value.strip()):
        return parsed.date().isoformat()
    return parsed.isoformat()

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
    event_time = parse_analytics_datetime(value)
    if event_time is None:
        return False
    # A date-only post has no known time of day. Compare Philippine calendar
    # dates rather than inventing a midnight timestamp for a rolling window.
    if isinstance(value, str) and ISO_DATE_PATTERN.fullmatch(value.strip()):
        return start.date() <= event_time.date() <= end.date()
    return start <= event_time <= end
