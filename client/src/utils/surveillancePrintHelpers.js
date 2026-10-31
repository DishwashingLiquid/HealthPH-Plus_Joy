import { formatSelfReportPrintDate } from "./selfReportPrintHelpers";

export const buildSurveillancePrintReport = ({ summary, timeLabel, regionLabel, diseaseLabel, user, generatedAt = new Date().toISOString() }) => {
    const totalDetections = summary.disease_label_count;
    const diseaseRows = [
        ["TB", "Tuberculosis"],
        ["PN", "Pneumonia"],
        ["COVID", "COVID-19"],
        ["AURI", "AURI"],
    ].map(([code, label]) => ({
        label,
        count: summary.disease_counts[code] || 0,
        share: totalDetections
            ? Number(((summary.disease_counts[code] || 0) / totalDetections * 100).toFixed(1))
            : 0,
    }));

    return {
        title: "AI Surveillance",
        subtitle: "Disease Label Detections, Suspected Conditions Percentage and Symptom Frequency",
        generatedAt,
        generatedBy: [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Unavailable",
        totalLabel: "Matching processed entries",
        totalReports: summary.processed_entry_count,
        filters: [
            { label: "Time range", value: timeLabel },
            { label: "Region", value: regionLabel },
            { label: "Impact", value: diseaseLabel },
            { label: "Reporting period (PHT)", value: `${formatSelfReportPrintDate(summary.period_start)} to ${formatSelfReportPrintDate(summary.period_end)}` },
            { label: "Data sources", value: "Self Reports and Social Media Datasets" },
        ],
        notes: [
            `Total disease label detections: ${totalDetections.toLocaleString()}. Percentages use disease label detections as their denominator, matching the dashboard pie chart.`,
            "A report may contribute more than one disease label. When an impact is selected, only that label is counted.",
            "Symptom counts include selected self-report symptoms and non-negated extracted symptoms. Each report counts once per symptom. The complete list is included.",
            "Results are limited to the account's permitted regions. Date-only records match Philippine calendar dates covered by the reporting period.",
            "Respiratory monitoring is unavailable because respiratory rate and cough frequency measurements are not connected. Trend forecasting is unavailable because a forecasting model and prediction data are not connected.",
        ],
        sections: [
            {
                title: "Disease Label Detections and Suspected Conditions Percentage",
                countLabel: "Detections",
                shareLabel: "Share of detections",
                rows: diseaseRows,
            },
            {
                title: "Symptom Frequency",
                showShare: false,
                rows: (summary.symptom_counts || []).map(({ symptom, report_count }) => ({ label: symptom, count: report_count })),
            },
        ],
    };
};
