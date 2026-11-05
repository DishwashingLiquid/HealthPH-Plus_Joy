import {
  getRegionLabel,
  getVisibleRegionalRows,
  normalizeRegionalApiData,
} from "./RegionalAnalysis";
import { isCount, isShare, reportingScope, summaryState, surveyCardSentiment } from "./sentimentContract";
import { regionalAnswerRows, regionalCardRows, regionalRow, regionalAssessment, regionalDisplayLabel, REGIONAL_ANSWER_SCOPE, REGIONAL_SUBMISSION_SCOPE, REGIONAL_SATISFACTION_SCOPE } from "./regionalMetrics";

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
  regionalRequestState,
  showEmptyRegions = false,
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
    const line = (values) => values.map(escapeCsvValue).join(",") + "\n";
    const count = (value) => isCount(value) ? value : "";
    const report = regionalRequestState === "Request failed" ? undefined : regionalAnalysis;
    csvContent += line(["Submission count definition", REGIONAL_SUBMISSION_SCOPE]);
    csvContent += line(["Survey and regional scope", REGIONAL_ANSWER_SCOPE]);
    csvContent += line(["Satisfaction scope and Trends difference", REGIONAL_SATISFACTION_SCOPE]);
    csvContent += line(["Units", "Class share uses analyzed Calm + Worried answers; ties show both classes. Overall percentages use aggregate counts. Blank means unavailable; zero is valid. Missing predictions have unknown processing status."]);
    csvContent += line(["Dates (Philippines)", report?.filters ? `${report.filters.startDate} to ${report.filters.endDate}` : "Unavailable"]);
    csvContent += line(["Survey scope", "All existing surveys; mobile analytics only; Trends survey selector does not apply"]);
    csvContent += line(["Regional cards", selectedRegions.length ? "Selected regions" : showEmptyRegions ? "All regions" : "Regions with activity"]);
    csvContent += line(["Analytics request", regionalRequestState || (report ? "Available" : "Unavailable")]);
    csvContent += line(["Sentiment configuration", report?.sentimentStatus || "Unavailable"]);
    csvContent += line(["Satisfaction configuration", report?.satisfactionStatus || "Unavailable"]);
    csvContent += line(["Missing submission links (analyzed answers; all date-filtered regions)", count(report?.linkage?.missingAnalyzedAnswers)]);
    csvContent += line(["Ambiguous submission links (analyzed answers; all date-filtered regions)", count(report?.linkage?.ambiguousAnalyzedAnswers)]);
    csvContent += line(["Excluded invalid analytics dates", count(report?.excludedInvalidSubmissionDates)]);
    csvContent += line(["Region", "Survey responses analyzed", "Linked analyzed submissions", "Submission count status", "Sentiment", "Class share (%)", "Analysis coverage", "Coverage status", "Satisfaction", ...metricHeaders]);
    const values = (label, row) => {
      const assessment = regionalAssessment(report, row);
      return [label, count(row?.analyzedSubmissions), count(row?.linkedAnalyzedSubmissions), row?.submissionCountStatus || "Unavailable",
        regionalDisplayLabel(assessment.sentiment.label), isShare(assessment.sentiment.share) ? assessment.sentiment.share.toFixed(1) : "",
        assessment.coverage, assessment.incomplete ? "Incomplete; processing status unknown" : row ? "" : "Unavailable",
        regionalDisplayLabel(assessment.satisfaction.label), ...metricValues(row ? { ...row,
          satisfactionShare: assessment.satisfaction.share,
          ...(report?.satisfactionStatus !== "configured" ? { satisfiedAnswers: null, satisfactionAnswers: null,
            dissatisfiedAnswers: null, neutralSatisfactionAnswers: null } : {}),
        } : undefined)];
    };
    csvContent += line(values("Overall (filtered)", report?.totals));
    const answerRows = regionalAnswerRows(report);
    const rows = getVisibleRegionalRows(selectedRegions, normalizeRegionalApiData(report), answerRows.unknown)
      .map((row) => ({ ...row, data: regionalRow(report, row.value) }));
    for (const region of regionalCardRows(rows, selectedRegions.length > 0 || showEmptyRegions)) {
      csvContent += line(values(region.label, region.data));
    }
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
