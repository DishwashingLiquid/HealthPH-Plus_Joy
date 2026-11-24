export const loadPrintPages = async (
    fetchPage,
    filters = {},
    {
        itemsKey = "entries",
        batchSize = 100,
        getKey = (item) => item?.id,
        isValidItem = () => true,
        invalidMessage =
            "Unable to prepare the report: an invalid response was received.",
        changedMessage =
            "The matching records changed while preparing the report. Please try printing again.",
    } = {},
) => {
    const items = [];
    const seen = new Set();
    let expectedTotal = null;

    do {
        const page = await fetchPage({
            ...filters,
            limit: batchSize,
            offset: items.length,
        });

        const rows = page?.[itemsKey];

        if (
            !Array.isArray(rows) ||
            !Number.isSafeInteger(page.total) ||
            page.total < 0
        ) {
            throw new Error(invalidMessage);
        }

        if (expectedTotal === null) expectedTotal = page.total;

        if (
            page.total !== expectedTotal ||
            page.offset !== items.length ||
            (rows.length === 0 && items.length < expectedTotal) ||
            items.length + rows.length > expectedTotal
        ) {
            throw new Error(changedMessage);
        }

        for (const item of rows) {
            if (!item || !isValidItem(item)) {
                throw new Error(invalidMessage);
            }

            const key = getKey(item);

            if (!key) throw new Error(invalidMessage);
            if (seen.has(key)) throw new Error(changedMessage);

            seen.add(key);
            items.push(item);
        }
    } while (items.length < expectedTotal);

    return items;
};

export const loadSelfReportsForPrint = (fetchPage, filters = {}) =>
    loadPrintPages(
        fetchPage,
        { ...filters, sourceType: "self_report" },
        {
            batchSize: 500,
            isValidItem: (entry) => entry.source_type === "self_report",
            invalidMessage:
                "Unable to prepare the report: an invalid self-report response was received.",
            changedMessage:
                "The matching reports changed while preparing the report. Please try printing again.",
        },
    );

export const formatPrintDate = (value) => {
    if (!value) return "Unavailable";

    let timestamp = value;

    if (typeof timestamp === "string") {
        timestamp = timestamp.trim().replace(" ", "T");

        if (
            /^\d{4}-\d{2}-\d{2}T/.test(timestamp) &&
            !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp)
        ) {
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