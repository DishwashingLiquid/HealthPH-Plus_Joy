import {
  getRegionLabel,
  getVisibleRegionalRows,
  normalizeRegionalApiData,
} from "./RegionalAnalysis";
import { isCount, isShare, reportingScope, summaryState, surveyCardSentiment } from "./sentimentContract";

const metricHeaders = ["Eligible text/choice answers", "Analyzed text/choice answers", "Text/choice answers without results", "Calm answers", "Worried answers", "Worried share (%)", "Satisfied answers", "Valid satisfaction answers", "Satisfaction share (%)", "Dissatisfied answers", "Neutral satisfaction answers"];
const metricValues = (row = {}) => [row.eligibleAnswers, row.predictedAnswers, row.answersWithoutResults, row.calm, row.worried].map((value) => isCount(value) ? value : "").concat([
  isShare(row.worriedShare) ? row.worriedShare.toFixed(1) : "",
  isCount(row.satisfiedAnswers) ? row.satisfiedAnswers : "",
  isCount(row.satisfactionAnswers) ? row.satisfactionAnswers : "",
  isShare(row.satisfactionShare) ? row.satisfactionShare.toFixed(1) : "",
  isCount(row.dissatisfiedAnswers) ? row.dissatisfiedAnswers : "",
  isCount(row.neutralSatisfactionAnswers) ? row.neutralSatisfactionAnswers : "",
]);

const escapeCsvValue = (value) => {
  const text = String(value ?? "");
  return text.includes(",") || text.includes('"') || text.includes("\n")
    ? `"${text.replace(/"/g, '""')}"`
    : text;
};

export const buildSentimentPulseCsv = ({
  activeTab,
  timeRange,
  customStartDate,
  customEndDate,
  selectedRegions,
  regionalAnalysis,
  surveys,
  trends,
  surveyFeedback = {},
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
    `Time Range: ${activeTab === "mobile-surveys" ? "Whole survey; all dates" : timeRange}`,
    ...(timeRange === "custom" && activeTab !== "mobile-surveys"
      ? [`Start Date: ${customStartDate}`, `End Date: ${customEndDate}`]
      : []),
    `Selected Regions: ${activeTab === "mobile-surveys" ? "All (including unknown)" : selectedRegionLabels}`,
    "",
  ];

  let csvContent = `${headers.join("\n")}\n`;

  if (activeTab === "sentiment-trends") {
    if (!trends) throw new Error("Load sentiment aggregates before exporting.");
    const line = (values) => values.map(escapeCsvValue).join(",") + "\n";
    csvContent += line(["Reporting scope", reportingScope(trends)]);
    csvContent += line(["Units", "Feedback answers are not unique respondents. Worried share uses classified text/choice answers; satisfaction uses valid scored answers. Blank means unavailable."]);
    csvContent += line(["Sentiment configuration", trends.sentimentStatus]);
    csvContent += line(["Satisfaction configuration", trends.satisfactionStatus]);
    csvContent += line(["Excluded invalid submission dates", trends.excludedInvalidSubmissionDates]);
    csvContent += line(["Mixed model versions", trends.mixedModelVersions]);
    csvContent += line(["Section", "Date / ID", ...metricHeaders]);
    csvContent += line(["Totals", "All filtered answers", ...metricValues(trends.totals)]);
    for (const row of trends.daily || []) csvContent += line(["Daily", row.date, ...metricValues(row)]);
    for (const row of trends.regions || []) csvContent += line(["Region", row.region ?? "Unknown region", ...metricValues(row)]);
    csvContent += "\n" + line(["Survey ID", "Survey title", "Feedback status", "Satisfaction configuration", ...metricHeaders]);
    for (const row of trends.surveys || []) csvContent += line([row.surveyId, surveys?.find((s) => s.id === row.surveyId)?.title || "", summaryState(row), row.satisfactionStatus, ...metricValues(row)]);
  } else if (activeTab === "regional-analysis") {
    const totals = regionalAnalysis?.filteredTotals || {};
    csvContent += `Survey Respondents (filtered),${escapeCsvValue(totals.surveyRespondents)}\n`;
    csvContent += `Total Submissions (filtered),${escapeCsvValue(totals.totalSubmissions)}\n`;
    csvContent += `Unlinked Submissions (filtered),${escapeCsvValue(totals.unlinkedSubmissions)}\n`;
    csvContent += "\nRegion,Survey Respondents,Total Submissions,Health Sentiment Score,Sentiment Status\n";
    const regionalRows = getVisibleRegionalRows(
      selectedRegions,
      normalizeRegionalApiData(regionalAnalysis),
      regionalAnalysis?.unknownRegion,
    );
    csvContent += regionalRows
      .map((region) =>
        [
          region.label,
          region.data.surveyRespondents,
          region.data.totalSubmissions,
          "—",
          "Coming soon",
        ]
          .map(escapeCsvValue)
          .join(",")
      )
      .join("\n");
    csvContent += regionalRows.length > 0 ? "\n" : "";
  } else if (activeTab === "mobile-surveys") {
    csvContent += "Units,Classified mobile text/choice answers; not unique respondents. Blank means unavailable.\n";
    csvContent +=
      `Survey ID,Survey Title,Status,Scheduled At,Responses,Target,Assessed Sentiment,Class share (%),${metricHeaders.join(",")}\n`;
    csvContent += surveys
      .map((survey) => {
        const snapshot = surveyFeedback[survey.id];
        const report = snapshot?.isError ? undefined : snapshot?.data?.summary;
        const assessment = report ? surveyCardSentiment(report)
          : { label: survey.status === "Ended" ? "Unavailable" : "Not processed", share: null };
        return [
          survey.id || "",
          survey.title,
          survey.status,
          survey.scheduledAt || "",
          survey.responses,
          survey.target,
          assessment.label,
          isShare(assessment.share) ? assessment.share.toFixed(1) : "",
          ...metricValues(report?.totals),
        ]
          .map(escapeCsvValue)
          .join(",");
      })
      .join("\n");
    csvContent += surveys.length > 0 ? "\n" : "";
  }

  return csvContent;
};

export const exportSentimentPulseCsv = (options) => {
  const csvContent = buildSentimentPulseCsv(options);
  const { activeTab } = options;

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
