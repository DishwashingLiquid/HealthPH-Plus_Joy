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

export function isIsoDateOnly(value) {
    return (
        typeof value === "string" &&
        DATE_ONLY.test(value) &&
        validDay(value)
    );
}

export function formatPhDateTimeInput(value) {
    const date = parsePhDate(value);
    if (!date) return "";

    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: PH_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);

    const fields = Object.fromEntries(
        parts
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, part.value]),
    );

    const year = fields.year.padStart(4, "0");

    return `${year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`;
}

export function getPhilippineDateInput(
    offset = 0,
    now = Date.now(),
) {
    if (!Number.isInteger(offset)) return "";

    const input = formatPhDateTimeInput(now);
    if (!input) return "";

    const date = new Date(`${input.slice(0, 10)}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);

    return Number.isFinite(date.getTime())
        ? date.toISOString().slice(0, 10)
        : "";
}