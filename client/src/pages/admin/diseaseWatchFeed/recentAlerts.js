import { getDashboardRegionLabel } from "../dashboardRegions";

export const buildRecentAlerts = (reports, locationLookup) => {
  const dedupeKeys = new Set();
  const alerts = [];

  reports.forEach((report) => {
    const mapPin = locationLookup.get(report.id);
    const canonicalSymptoms = [...(report.symptomIds || [])].sort();
    const dedupeKey = `${report.id}:${canonicalSymptoms.join("|")}`;

    if (dedupeKeys.has(dedupeKey)) {
      return;
    }

    dedupeKeys.add(dedupeKey);

    const symptomLabels = report.symptomLabels?.length
      ? report.symptomLabels
      : mapPin?.tags?.length
        ? mapPin.tags
        : ["respiratory symptoms"];
    const locationLabel = getDashboardRegionLabel(report.region);
    const diseaseLabel =
      mapPin?.disease || report.possibleConditionLabel || "Respiratory symptoms reported";
    const summarySymptoms = symptomLabels.slice(0, 3).join(", ");

    alerts.push({
      id: report.id,
      disease: diseaseLabel,
      region: locationLabel,
      type: "Symptom Report",
      timestamp: report.createdAt,
      summary: `Self-reported ${summarySymptoms} in ${locationLabel}.`,
      summarySegments: [
        { type: "text", value: "Self-reported " },
        { type: "entity", label: summarySymptoms, tone: "symptom" },
        { type: "text", value: " in " },
        { type: "entity", label: locationLabel, tone: "location" },
        { type: "text", value: "." },
      ],
    });
  });

  return alerts;
};
