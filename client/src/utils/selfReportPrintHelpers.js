const PRINT_BATCH_SIZE = 500;
const CHANGED_REPORTS_MESSAGE =
    "The matching reports changed while preparing the report. Please try printing again.";

export const loadSelfReportsForPrint = async (fetchPage, filters) => {
    const entries = [];
    const seenIds = new Set();
    let expectedTotal = null;

    do {
        const page = await fetchPage({
            ...filters,
            sourceType: "self_report",
            limit: PRINT_BATCH_SIZE,
            offset: entries.length,
        });

        if (
            !Array.isArray(page?.entries) ||
            !Number.isSafeInteger(page.total) ||
            page.total < 0
        ) {
            throw new Error("Unable to prepare the report: an invalid response was received.");
        }

        if (expectedTotal === null) expectedTotal = page.total;
        if (
            page.total !== expectedTotal ||
            (page.offset !== undefined && page.offset !== entries.length) ||
            (page.entries.length === 0 && entries.length < expectedTotal) ||
            entries.length + page.entries.length > expectedTotal
        ) {
            throw new Error(CHANGED_REPORTS_MESSAGE);
        }

        for (const entry of page.entries) {
            if (!entry.id || entry.source_type !== "self_report") {
                throw new Error("Unable to prepare the report: an invalid self report was received.");
            }
            if (seenIds.has(entry.id)) throw new Error(CHANGED_REPORTS_MESSAGE);
            seenIds.add(entry.id);
            entries.push(entry);
        }
    } while (entries.length < expectedTotal);

    return entries;
};

export const formatSelfReportPrintDate = (value) => {
    if (!value) return "Unavailable";

    let timestamp = value;
    if (typeof timestamp === "string") {
        timestamp = timestamp.trim().replace(" ", "T");
        // Existing offset-free backend timestamps represent Philippine local time.
        if (/^\d{4}-\d{2}-\d{2}T/.test(timestamp) && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp)) {
            timestamp += "+08:00";
        }
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "Unavailable";

    return new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    }).format(date);
};
