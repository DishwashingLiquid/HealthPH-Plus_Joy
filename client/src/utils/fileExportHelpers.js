export function downloadUrl(url, filename) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener noreferrer";
    link.style.display = "none";

    try {
        document.body.appendChild(link);
        link.click();
    } finally {
        link.remove();
    }
}

export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);

    try {
        downloadUrl(url, filename);
    } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}

export function downloadJson(value, filename) {
    const blob = new Blob(
        [JSON.stringify(value, null, 2)],
        { type: "application/json" },
    );

    downloadBlob(blob, filename);
}

export function escapeCsvValue(value) {
    const text = String(value ?? "");

    return /[",\r\n]/.test(text)
        ? `"${text.replace(/"/g, '""')}"`
        : text;
}

export function downloadCsvText(csvText, filename) {
    const blob = new Blob(
        ["\uFEFF", csvText],
        { type: "text/csv;charset=utf-8" },
    );

    downloadBlob(blob, filename);
}