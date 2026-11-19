export const EVALUATION_MODEL_NAMES = { electra: "ELECTRA", xlmr: "XLM-RoBERTa" };
export const EVALUATION_LANGUAGE_NAMES = {
    en: "English", fil: "Filipino", hil: "Hiligaynon", ilo: "Ilocano", ceb: "Cebuano",
};
export const MAX_EVALUATION_BYTES = 256 * 1024;

export const getComparisonIssue = (models) => {
    const evaluated = models.filter((model) => model.modelVersion);
    if (evaluated.length < 2) return "";
    const first = evaluated[0];
    const same = evaluated.every((model) =>
        ["testSetId", "evaluationProtocol", "split", "sampleCount"].every((key) => model[key] === first[key])
    );
    return same ? "" : "These records use different test sets or evaluation protocols. View each model separately, or upload results evaluated on the same records and protocol.";
};

export const buildEvaluationLanguageRows = (models) => Object.entries(EVALUATION_LANGUAGE_NAMES)
    .map(([language, name]) => {
        const row = { language: name };
        for (const model of models) {
            const value = model.perLanguage?.find((item) => item.language === language)?.macroF1;
            if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1) {
                row[model.id] = value * 100;
            }
        }
        return row;
    })
    .filter((row) => Object.keys(row).length > 1);

export const getLanguageComparisonIssue = (models) => {
    if (models.length < 2) return "";
    for (const language of Object.keys(EVALUATION_LANGUAGE_NAMES)) {
        const rows = models.map((model) => model.perLanguage?.find((row) => row.language === language))
            .filter((row) => typeof row?.macroF1 === "number");
        if (rows.length > 1 && rows.some((row) => row.sampleCount !== rows[0].sampleCount)) {
            return "Language sample counts differ between models. Upload language results from the same test records, or select one model.";
        }
    }
    return "";
};

export const parseEvaluationPreview = (text) => {
    let report;
    try { report = JSON.parse(text); }
    catch { throw new Error("This file is not valid JSON. Check it against the downloaded template."); }
    if (report?.schemaVersion !== 1 || !Array.isArray(report.models) || report.models.length < 1 || report.models.length > 2) {
        throw new Error("Use schemaVersion 1 and a models list containing ELECTRA, XLM-RoBERTa, or both. Download the template for the format.");
    }
    const ids = report.models.map((model) => model?.id);
    if (ids.some((id) => !Object.hasOwn(EVALUATION_MODEL_NAMES, id)) || new Set(ids).size !== ids.length) {
        throw new Error('Use each model ID only once: "electra" or "xlmr".');
    }
    return report;
};

export const formatEvaluationDate = (value) => {
    if (!value) return "Unavailable";
    const date = new Date(`${value}T00:00:00+08:00`);
    return Number.isNaN(date.getTime()) ? "Unavailable" : new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila", month: "short", day: "2-digit", year: "numeric",
    }).format(date);
};

export const buildModelEvaluationPrintReport = ({
    models, selectedModel = "all", selectedMetric = "all", search = "", user,
    generatedAt = new Date().toISOString(),
}) => {
    const records = models.filter((model) => model.modelVersion &&
        (selectedModel === "all" || model.id === selectedModel) &&
        model.name.toLowerCase().includes(search.trim().toLowerCase()));
    if (!records.length) return null;
    const metricNames = { macroF1: "Macro F1", precisionMacro: "Macro Precision", recallMacro: "Macro Recall" };
    const measured = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
    const percent = (value) => measured(value) ? `${(value * 100).toFixed(2)}%` : "Unavailable";
    const comparisonIssue = getComparisonIssue(records);
    const languageIssue = comparisonIssue || getLanguageComparisonIssue(records);
    const column = (key, label, width, align = "left") => ({ key, label, width, align });
    const sections = [{
        title: "Evaluation Details",
        columns: [column("model", "Model", 18), column("version", "Checkpoint", 24), column("dataset", "Evaluation Dataset", 23),
            column("split", "Split", 10), column("date", "Evaluated", 15), column("samples", "Samples", 10, "right")],
        rows: records.map((model) => ({ id: model.id, model: model.name, version: model.modelVersion,
            dataset: model.evaluationSet, split: model.split, date: formatEvaluationDate(model.evaluatedAt), samples: model.sampleCount })),
    }, {
        title: "Recorded Model Metrics",
        columns: [column("model", "Model", 30), column("metric", "Metric", 45), column("result", "Result", 25, "right")],
        rows: records.flatMap((model) => [
            ...Object.entries(metricNames).filter(([key]) => selectedMetric === "all" || key === selectedMetric)
                .map(([key, label]) => ({ model: model.name, metric: label, result: percent(model[key]) })),
            { model: model.name, metric: "Hamming Loss (lower is better)", result: measured(model.hammingLoss) ? model.hammingLoss.toFixed(4) : "Unavailable" },
        ]),
    }, {
        title: "Evaluation Settings",
        columns: [column("model", "Model", 20), column("testSet", "Test Records ID", 28), column("protocol", "Evaluation Protocol", 27), column("thresholds", "Disease Thresholds", 25)],
        rows: records.map((model) => ({ model: model.name, testSet: model.testSetId, protocol: model.evaluationProtocol,
            thresholds: Object.entries(model.thresholds || {}).map(([key, value]) => `${key}: ${value}`).join(", ") })),
    }];
    const languageRows = languageIssue ? [] : records.flatMap((model) => (model.perLanguage || [])
        .filter((row) => measured(row.macroF1))
        .map((row) => ({ model: model.name, language: EVALUATION_LANGUAGE_NAMES[row.language] || row.language,
            macroF1: percent(row.macroF1), samples: row.sampleCount })));
    if (languageRows.length) sections.push({
        title: "Multilingual Performance",
        columns: [column("model", "Model", 30), column("language", "Test Language", 30), column("macroF1", "Macro F1", 20, "right"), column("samples", "Samples", 20, "right")],
        rows: languageRows,
    });
    return {
        title: "Model Access and Toolkit — Model Comparison",
        subtitle: "Recorded disease-classification evaluation results",
        generatedAt,
        generatedBy: [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Unavailable",
        totalLabel: "Matching recorded models", totalReports: records.length,
        filters: [{ label: "Model", value: EVALUATION_MODEL_NAMES[selectedModel] || "All Models" },
            { label: "Metric", value: metricNames[selectedMetric] || "All Metrics" }, { label: "Search", value: search.trim() || "None" }],
        notes: ["Missing evaluation results are unavailable, not zero. Hamming loss is shown as a decimal; lower is better.",
            ...(comparisonIssue ? [comparisonIssue, "Model metrics below are independent records, not a direct performance comparison."] : []),
            ...(languageIssue ? [`Multilingual comparison unavailable: ${languageIssue}`] : []),
            ...(!languageIssue && !languageRows.length ? ["No per-language Macro F1 results are recorded."] : [])],
        sections,
    };
};
