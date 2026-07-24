import { getRegionLabel, getVisibleRegionalRows } from "./regionUtils";

const escapeCsvValue = (value) => {
  const text = String(value ?? "");
  return text.includes(",") || text.includes('"') || text.includes("\n")
    ? `"${text.replace(/"/g, '""')}"`
    : text;
};

export const exportSentimentPulseCsv = ({
  activeTab,
  timeRange,
  selectedRegions,
  regionalData,
  surveys,
}) => {
  const timestamp = new Date().toLocaleString();
  const selectedRegionLabels =
    selectedRegions.length === 0
      ? "All"
      : selectedRegions.map(getRegionLabel).join(", ");
  const headers = [
    "Sentiment Pulse Tool Export",
    `Generated: ${timestamp}`,
    `Active Tab: ${activeTab}`,
    `Time Range: ${timeRange}`,
    `Selected Regions: ${selectedRegionLabels}`,
    "",
  ];

  let csvContent = `${headers.join("\n")}\n`;

  if (activeTab === "sentiment-trends") {
    csvContent +=
      "Date,Concerned (%),Proactive (%),Misinformed (%),Neutral (%)\n";
    csvContent += "2026-05-01,15,42,18,25\n";
    csvContent += "2026-05-02,14,44,17,25\n";
    csvContent += "2026-05-03,16,41,19,24\n";
  } else if (activeTab === "regional-analysis") {
    csvContent +=
      "Region,Responses,Previous Responses,Dominant Sentiment,Trend (%)\n";
    const regionalRows = getVisibleRegionalRows(selectedRegions, regionalData);
    csvContent += regionalRows
      .map((region) =>
        [
          region.label,
          region.data.responses,
          region.data.previousResponses,
          region.data.dominantSentiment,
          region.data.trend,
        ]
          .map(escapeCsvValue)
          .join(",")
      )
      .join("\n");
    csvContent += regionalRows.length > 0 ? "\n" : "";
  } else if (activeTab === "mobile-surveys") {
    csvContent +=
      "Survey Title,Status,Scheduled At,Responses,Target,Dominant Sentiment\n";
    csvContent += surveys
      .map((survey) =>
        [
          survey.title,
          survey.status,
          survey.scheduledAt || "",
          survey.responses,
          survey.target,
          survey.dominantSentiment,
        ]
          .map(escapeCsvValue)
          .join(",")
      )
      .join("\n");
    csvContent += surveys.length > 0 ? "\n" : "";
  }

  const element = document.createElement("a");
  element.setAttribute(
    "href",
    `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`
  );
  element.setAttribute(
    "download",
    `sentiment-pulse-export-${activeTab}-${new Date().getTime()}.csv`
  );
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

export const showSentimentPulsePdfExportNotice = () => {
  alert(
    "PDF export will be available soon. Features would include visualizations of charts, applied filters, and professional formatting."
  );
};
