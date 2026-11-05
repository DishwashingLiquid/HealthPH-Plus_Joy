import { DASHBOARD_REGIONS } from "../dashboardRegions";
import { formatCount, formatShare, isCount, surveyCardSentiment } from "./sentimentContract";

// Accept canonical codes and display labels; never infer a region from provinces.
export const normalizeRegionalKey = (value) => {
  const key = String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  return DASHBOARD_REGIONS.find((region) =>
    [region.value, region.label.toUpperCase(), region.value.replace("IV", "IV-")].includes(key),
  )?.value ?? "unknown";
};

export const EMPTY_ANSWER_COUNTS = {
  analyzedSubmissions: 0, linkedAnalyzedSubmissions: 0, submissionCountStatus: "exact",
  eligibleAnswers: 0, predictedAnswers: 0, answersWithoutResults: 0,
  calm: 0, worried: 0, worriedShare: null,
  satisfactionAnswers: 0, satisfiedAnswers: 0, satisfactionShare: null,
  dissatisfiedAnswers: 0, neutralSatisfactionAnswers: 0,
};

export const regionalAnswerRows = (report) => Object.fromEntries(
  (Array.isArray(report?.regions) ? report.regions : []).filter(Boolean).map((row) => [normalizeRegionalKey(row.region), row]),
);

export const regionalRow = (report, value) => regionalAnswerRows(report)[value] ||
  (report?.regionsComplete === true && Array.isArray(report.regions) ? {
    ...EMPTY_ANSWER_COUNTS,
    ...(report.totals?.submissionCountStatus === "incomplete" ? { analyzedSubmissions: null, submissionCountStatus: "incomplete" } : {}),
  } : undefined);

export const regionalCardRows = (rows, showAll = false) => {
  return showAll ? rows : rows.filter(({ data }) =>
    data?.analyzedSubmissions > 0 || data?.linkedAnalyzedSubmissions > 0 ||
    data?.eligibleAnswers > 0 || data?.satisfactionAnswers > 0,
  );
};

export const regionalDisplayLabel = (label) => ({
  "No eligible feedback": "No feedback to analyze",
  "No analyzed answers": "No results yet",
  "No valid scored answers": "No satisfaction answers",
  "Not configured": "Not set up",
}[label] || label);

export const regionalAssessment = (report, row) => {
  if (!report || !row) return {
    sentiment: { label: "Unavailable", share: null, kind: null },
    satisfaction: { label: "Unavailable", share: null },
    coverage: "Analysis coverage unavailable", incomplete: false,
  };
  const totals = row;
  const sentiment = ["configured", "not_configured"].includes(report.sentimentStatus)
    ? surveyCardSentiment({ sentimentStatus: report.sentimentStatus, totals })
    : { label: "Unavailable", share: null, kind: null };
  // The aggregate cannot tell never-run answers from failed processing attempts.
  if (sentiment.label === "Not processed") sentiment.label = "No analyzed answers";
  const validSatisfaction = report.satisfactionStatus === "configured" &&
    isCount(totals.satisfactionAnswers) && isCount(totals.satisfiedAnswers) &&
    totals.satisfiedAnswers <= totals.satisfactionAnswers;
  const share = validSatisfaction && totals.satisfactionAnswers > 0
    ? totals.satisfiedAnswers / totals.satisfactionAnswers * 100 : null;
  const satisfaction = { share, label: report.satisfactionStatus === "not_configured"
    ? "Not configured" : validSatisfaction && totals.satisfactionAnswers === 0
      ? "No valid scored answers" : formatShare(share) };
  const validCoverage = isCount(totals.predictedAnswers) && isCount(totals.eligibleAnswers) &&
    totals.predictedAnswers <= totals.eligibleAnswers;
  return { sentiment, satisfaction,
    coverage: validCoverage
      ? `${formatCount(totals.predictedAnswers)} of ${formatCount(totals.eligibleAnswers)} eligible answers analyzed`
      : "Analysis coverage unavailable",
    incomplete: validCoverage && totals.predictedAnswers < totals.eligibleAnswers,
  };
};

export const REGIONAL_SUBMISSION_SCOPE = "Distinct submissions with at least one currently eligible answer containing a valid stored Calm/Worried label, score and model version. Anonymous submissions count; repeated submissions count separately. Analytics submission_id or survey/question/answer IDs linked through survey_responses.answerIds establish the parent. Missing or ambiguous links make exact counts unavailable; counts of submissions with resolved links are shown separately.";
export const REGIONAL_ANSWER_SCOPE = "Mobile survey-response analytics_entries across all existing surveys, including unpublished surveys where answers exist; original event_time (created_at fallback) in the selected Philippine dates. Each linked submission is assigned once using its valid sentiment records before region filtering. Missing or conflicting locations stay Unknown Region. No account-location fallback. All surveys; the Trends survey selector does not apply here.";
export const REGIONAL_SATISFACTION_SCOPE = "Satisfied answers / valid configured scored answers × 100, independent of sentiment. Only answers linked to submissions represented by valid sentiment results in the date window are scored. Trends retains all valid scored mobile answers, including submissions without sentiment results. Eligible-answer coverage includes answers without valid results. Stored results only; viewing never triggers processing.";
