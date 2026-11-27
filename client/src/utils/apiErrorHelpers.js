const text = (value) =>
    typeof value === "string" ? value.trim() : "";

const detailMessage = (value) => {
    if (typeof value === "string") return text(value);

    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return "";
    }

    return (
        text(value.msg) ||
        text(value.error) ||
        text(value.message)
    );
};

export function getRequestErrorMessage(
    error,
    fallback = "Unable to complete the request. Please try again.",
) {
    const detail = error?.data?.detail;
    const details = Array.isArray(detail) ? detail : [detail];

    for (const item of details) {
        const message = detailMessage(item);
        if (message) return message;
    }

    return (
        text(error?.error) ||
        text(error?.message) ||
        text(error) ||
        text(fallback) ||
        "Unable to complete the request. Please try again."
    );
}

export function getRequestFormErrors(
    error,
    allowedFields = [],
    fallback = "Unable to complete the request. Please try again.",
) {
    const allowed = new Set(allowedFields);
    const detail = error?.data?.detail;
    const fieldErrors = {};
    const generalErrors = [];

    if (Array.isArray(detail)) {
        for (const item of detail) {
            const location = item?.loc;
            const field =
                item?.field ??
                (
                    Array.isArray(location) &&
                    location.length === 2 &&
                    ["body", "query", "path"].includes(location[0])
                        ? location[1]
                        : undefined
                );

            const message = detailMessage(item);

            if (
                typeof field === "string" &&
                allowed.has(field) &&
                message
            ) {
                fieldErrors[field] = message;
            } else {
                generalErrors.push(item);
            }
        }
    }

    const hasFieldErrors = Object.keys(fieldErrors).length > 0;

    const generalError = Array.isArray(detail)
        ? {
            ...error,
            data: {
                ...error?.data,
                detail: generalErrors,
            },
        }
        : error;

    return {
        fieldErrors,
        message:
            Array.isArray(detail) &&
            generalErrors.length === 0 &&
            hasFieldErrors
                ? ""
                : getRequestErrorMessage(generalError, fallback),
    };
}