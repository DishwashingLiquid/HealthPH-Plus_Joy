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

export {
    formatPhDateTime as formatPrintDate,
} from "./dateTimeHelpers";