import { getDashboardRegionLabel } from "../dashboardRegions";

// Presentation only. The backend owns eligibility, deduplication and results.
export const buildRecentAlerts = (reports) => reports.map((report) => {
  const locationLabel = getDashboardRegionLabel(report.region);
  const symptoms = report.combinedSymptoms.slice(0, 3).join(", ") || "no detected symptoms";
  return {
    id: report.id,
    disease: report.diseaseLabels.join(", ") || "No disease detected",
    region: locationLabel,
    type: "Processed Self-Report",
    timestamp: report.createdAt,
    summary: `Report includes ${symptoms} in ${locationLabel}.`,
    summarySegments: [
      { type: "text", value: "Report includes " },
      { type: "entity", label: symptoms, tone: "symptom" },
      { type: "text", value: " in " },
      { type: "entity", label: locationLabel, tone: "location" },
      { type: "text", value: "." },
    ],
  };
});
