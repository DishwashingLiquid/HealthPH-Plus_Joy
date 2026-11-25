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