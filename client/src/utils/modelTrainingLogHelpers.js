export const MAX_TRAINING_LOG_BYTES = 2 * 1024 * 1024;
export const TRAINING_MODEL_NAMES = {
    fasttext: "FastText", electra: "ELECTRA", xlmr: "XLM-RoBERTa",
};
export const TRAINING_METRICS = {
    trainLoss: "Training loss",
    validationLoss: "Validation loss",
    trainAccuracy: "Training accuracy",
    validationAccuracy: "Validation accuracy",
    validationMacroF1: "Validation macro-F1",
    validationMicroF1: "Validation micro-F1",
};
const CONTRACT_FIELDS = [
    "schemaVersion", "runId", "modelId", "modelVersion", "trainingDataset",
    "validationDataset", "status", "startedAt", "endedAt", "hyperparameters", "epochs", "notes",
];
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function parseTrainingLogPreview(text) {
    let report;
    try { report = JSON.parse(text.replace(/^\uFEFF/, "")); }
    catch { throw new Error("This file is not valid JSON. Please check it and try again."); }
    if (!isObject(report) || report.schemaVersion !== 1) throw new Error("Use the training-log JSON template (schemaVersion 1).");
    if (Object.keys(report).some((key) => !CONTRACT_FIELDS.includes(key))) throw new Error("Use only the fields in the training-log template.");
    if (!Object.hasOwn(TRAINING_MODEL_NAMES, report.modelId)) throw new Error("Model must be fasttext, electra, or xlmr.");
    for (const key of ["runId", "modelVersion", "trainingDataset", "validationDataset"]) {
        if (key === "validationDataset" && report[key] == null) continue;
        if (typeof report[key] !== "string" || !report[key].trim() || report[key].length > 200 || /^REPLACE_/i.test(report[key].trim())) {
            throw new Error(`Add the actual ${key} (up to 200 characters).`);
        }
    }
    if (!["completed", "failed", "cancelled"].includes(report.status)) throw new Error("Status must be completed, failed, or cancelled.");
    for (const key of ["startedAt", "endedAt"]) {
        if (typeof report[key] !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(report[key]) || !Number.isFinite(Date.parse(report[key]))) {
            throw new Error(`Add ${key} with a timezone, for example 2026-11-10T09:00:00+08:00.`);
        }
    }
    if (Date.parse(report.endedAt) < Date.parse(report.startedAt)) throw new Error("The end time cannot be earlier than the start time.");
    const epochs = report.epochs ?? [];
    if (!Array.isArray(epochs) || epochs.length > 10000) throw new Error("Epochs must be a list of up to 10,000 recorded epochs.");
    const seen = new Set();
    for (const row of epochs) {
        if (!isObject(row) || !Number.isInteger(row.epoch) || row.epoch < 1 || seen.has(row.epoch)) throw new Error("Use a unique positive whole number for each epoch.");
        seen.add(row.epoch);
        if (!isObject(row.metrics) || !Object.keys(row.metrics).length) throw new Error(`Add a recorded metric for epoch ${row.epoch}, or remove that epoch.`);
        for (const [name, value] of Object.entries(row.metrics)) {
            if (!Object.hasOwn(TRAINING_METRICS, name) || typeof value !== "number" || !Number.isFinite(value) || value < 0 || (!name.endsWith("Loss") && value > 1)) {
                throw new Error(`Check ${name} in epoch ${row.epoch}. Use recorded numbers; accuracy and F1 use 0 to 1. Remove unmeasured metrics.`);
            }
        }
    }
    if (report.hyperparameters != null && !isObject(report.hyperparameters)) throw new Error("Hyperparameters must be a JSON object.");
    return report;
}

export function formatTrainingDate(value) {
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime())
        ? `${new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(date)} PHT`
        : "Not recorded";
}

export function formatTrainingDuration(seconds) {
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return "Not recorded";
    const total = Math.floor(seconds);
    if (total < 60) return `${total}s`;
    const minutes = Math.floor(total / 60);
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

export function formatTrainingMetric(name, value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "Not recorded";
    return name.endsWith("Loss") ? value.toFixed(4) : `${(value * 100).toFixed(2)}%`;
}

export function trainingRunKey(log) {
    return JSON.stringify([log.modelId, log.runId]);
}

export function trainingLogForExport(log) {
    return Object.fromEntries(CONTRACT_FIELDS.filter((key) => log[key] !== undefined).map((key) => [key, log[key]]));
}

export async function loadTrainingLogsForPrint(filters, fetchPage) {
    const logs = [];
    const seen = new Set();
    let expected = null;
    do {
        const result = await fetchPage({ ...filters, limit: 20, offset: logs.length });
        if (expected === null) expected = result.total;
        if (result.total !== expected || (!result.logs.length && logs.length < expected)) {
            throw new Error("The training-log list changed. Please refresh and print again.");
        }
        for (const log of result.logs) {
            const key = trainingRunKey(log);
            if (seen.has(key)) throw new Error("The training-log list changed. Please refresh and print again.");
            seen.add(key);
            logs.push(log);
        }
    } while (logs.length < expected);
    return logs;
}

export function buildTrainingLogPrintReport({ logs, filters, user, generatedAt = new Date().toISOString() }) {
    if (!logs.length) return null;
    const column = (key, label, width, align = "left") => ({ key, label, width, align });
    const modelName = (log) => TRAINING_MODEL_NAMES[log.modelId] || log.name || log.modelId;
    const statusName = (value) => value ? value[0].toUpperCase() + value.slice(1) : "Not recorded";
    const sections = [{
        title: "Training History",
        columns: [column("runId", "Run ID", 22), column("model", "Model", 16), column("checkpoint", "Checkpoint", 22),
            column("status", "Status", 10), column("started", "Started", 20), column("duration", "Duration", 10)],
        rows: logs.map((log) => ({ id: trainingRunKey(log), runId: log.runId, model: modelName(log),
            checkpoint: log.modelVersion, status: statusName(log.status), started: formatTrainingDate(log.startedAt),
            duration: formatTrainingDuration(log.durationSeconds) })),
    }, {
        title: "Dataset and Run Details",
        columns: [column("runId", "Run ID", 20), column("trainingDataset", "Training Dataset", 25),
            column("validationDataset", "Validation Dataset", 25), column("ended", "Ended", 15), column("uploaded", "Uploaded", 15)],
        rows: logs.map((log) => ({ id: trainingRunKey(log), runId: log.runId, trainingDataset: log.trainingDataset,
            validationDataset: log.validationDataset ?? "Not recorded", ended: formatTrainingDate(log.endedAt), uploaded: formatTrainingDate(log.uploadedAt) })),
    }, {
        title: "Hyperparameters",
        columns: [column("runId", "Run ID", 25), column("model", "Model", 20), column("parameter", "Parameter", 30), column("value", "Value", 25)],
        rows: logs.flatMap((log) => {
            const parameters = Object.entries(log.hyperparameters ?? {});
            return (parameters.length ? parameters : [["Not recorded", null]]).map(([parameter, value], index) => ({
                id: `${trainingRunKey(log)}-${index}`, runId: log.runId, model: modelName(log), parameter: parameter.replace(/_/g, " "),
                value: value === null ? "Not recorded" : String(value),
            }));
        }),
    }, {
        title: "Last Recorded Epoch Results",
        columns: [column("runId", "Run ID", 25), column("model", "Model", 20), column("epoch", "Epoch", 10, "right"),
            column("metric", "Metric", 30), column("result", "Result", 15, "right")],
        rows: logs.flatMap((log) => {
            const last = (log.epochs ?? []).reduce((latest, epoch) => !latest || epoch.epoch > latest.epoch ? epoch : latest, null);
            const metrics = last ? Object.entries(last.metrics) : [];
            return (metrics.length ? metrics : [[null, null]]).map(([metric, value], index) => ({
                id: `${trainingRunKey(log)}-${index}`, runId: log.runId, model: modelName(log), epoch: last?.epoch ?? "Not recorded",
                metric: TRAINING_METRICS[metric] || "Not recorded", result: metric ? formatTrainingMetric(metric, value) : "Not recorded",
            }));
        }),
    }];
    const notes = logs.filter((log) => log.notes).map((log) => ({ id: trainingRunKey(log), runId: log.runId, model: modelName(log), notes: log.notes }));
    if (notes.length) sections.push({
        title: "Training Notes",
        columns: [column("runId", "Run ID", 25), column("model", "Model", 20), column("notes", "Notes", 55)],
        rows: notes,
    });
    return {
        title: "Model Access and Toolkit — Training Logs",
        subtitle: "Recorded external model training runs",
        generatedAt,
        generatedBy: [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Unavailable",
        totalLabel: "Matching training runs", totalReports: logs.length,
        filters: [{ label: "Model", value: TRAINING_MODEL_NAMES[filters.model] || "All Models" },
            { label: "Status", value: filters.status === "all" ? "All Status" : statusName(filters.status) },
            { label: "Run start time", value: filters.days === "all" ? "All Dates" : `Last ${filters.days} Days` },
            { label: "Search", value: filters.search || "None" }],
        notes: ["Results show each run's last recorded epoch, not necessarily its best checkpoint or held-out test evaluation.",
            "Accuracy and F1 are percentages; loss is a decimal. Missing measurements are not recorded, not zero."],
        sections,
    };
}

export function downloadTrainingJson(value, filename) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
