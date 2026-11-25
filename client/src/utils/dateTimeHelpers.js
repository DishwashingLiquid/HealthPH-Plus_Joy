const PH_TIME_ZONE = "Asia/Manila";
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const validDay = (value) => {
    const date = new Date(`${value}T00:00:00Z`);

    return (
        !value.startsWith("0000-") &&
        Number.isFinite(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
};

export function parsePhDate(value) {
    if (value instanceof Date) {
        return Number.isFinite(value.getTime())
            ? new Date(value.getTime())
            : null;
    }

    if (typeof value === "number") {
        const date = new Date(value);
        return Number.isFinite(date.getTime()) ? date : null;
    }

    if (typeof value !== "string") return null;

    const input = value.trim();

    if (DATE_ONLY.test(input)) {
        return validDay(input)
            ? new Date(`${input}T00:00:00+08:00`)
            : null;
    }

    const match =
        /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?$/i.exec(input);

    if (
        !match ||
        !validDay(match[1]) ||
        Number(match[2]) > 23 ||
        Number(match[3]) > 59 ||
        Number(match[4] ?? 0) > 59
    ) {
        return null;
    }

    const normalized = input
        .replace(" ", "T")
        .replace(/z$/, "Z");

    const date = new Date(
        normalized + (match[5] ? "" : "+08:00"),
    );

    return Number.isFinite(date.getTime()) ? date : null;
}

export function formatPhDate(
    value,
    { fallback = "Unavailable" } = {},
) {
    const date = parsePhDate(value);

    return date
        ? new Intl.DateTimeFormat("en-PH", {
            timeZone: PH_TIME_ZONE,
            year: "numeric",
            month: "short",
            day: "2-digit",
        }).format(date)
        : fallback;
}

export function formatPhDateTime(
    value,
    { fallback = "Unavailable" } = {},
) {
    if (typeof value === "string" && DATE_ONLY.test(value.trim())) {
        return formatPhDate(value, { fallback });
    }

    const date = parsePhDate(value);

    return date
        ? new Intl.DateTimeFormat("en-PH", {
            timeZone: PH_TIME_ZONE,
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        }).format(date)
        : fallback;
}