import { dailySeries, isCount, isShare, SENTIMENT_COLORS, summaryState } from "./sentimentContract.js";

export const SATISFACTION_COLORS = { satisfied: SENTIMENT_COLORS.satisfaction,
  neutral: "#687582", dissatisfied: "#D82727" }; // theme gray-500 and destructive-500

export const surveySatisfaction = (row) => {
  const unavailable = { label: "Not available", kind: null, count: null };
  if (row.satisfactionStatus === "not_configured" || !isCount(row.satisfactionAnswers)) return unavailable;
  if (row.satisfactionAnswers === 0) return { label: "No answers", kind: null, count: null };
  const categories = [
    { label: "Satisfied", kind: "satisfied", count: row.satisfiedAnswers },
    { label: "Neutral", kind: "neutral", count: row.neutralSatisfactionAnswers },
    { label: "Dissatisfied", kind: "dissatisfied", count: row.dissatisfiedAnswers },
  ];
  if (categories.some(({ count }) => !isCount(count)) ||
      categories.reduce((sum, { count }) => sum + count, 0) !== row.satisfactionAnswers) return unavailable;
  const largest = Math.max(...categories.map(({ count }) => count));
  const leaders = categories.filter(({ count }) => count === largest);
  return leaders.length === 1 ? leaders[0]
    : { label: `${leaders.map(({ label }) => label).join(" / ")} (tie)`, kind: "tie", count: largest };
};

export const trendsFeedbackLabel = (summary) => {
  const state = summaryState(summary);
  return ({ "Not configured": "Not available", "No eligible text/choice answers": "No answers for analysis",
    "Not processed": "No answers analyzed yet", "Unavailable": "Not available" })[state] || state;
};

// Trends-only presentation. Percentages always use the scoped summed counts.
export const answerShare = (answers, denominator) =>
  isCount(answers) && isCount(denominator) && denominator > 0 && answers <= denominator
    ? answers / denominator * 100 : null;

export const satisfactionTrendSeries = (report) => dailySeries(report).map((row) => ({
  ...row,
  // No scored answers or no category mapping is a gap, never a fabricated zero.
  ...Object.fromEntries(["satisfiedAnswers", "neutralSatisfactionAnswers", "dissatisfiedAnswers"].map((key) =>
    [key, row.satisfactionAnswers > 0 && isCount(row[key]) && row[key] <= row.satisfactionAnswers ? row[key] : null])),
}));

export const trendsMetrics = (report) => {
  const totals = report?.totals || {};
  const classified = isCount(totals.calm) && isCount(totals.worried) &&
    totals.calm + totals.worried === totals.predictedAnswers;
  const sentiment = [["Calm", "calm"], ["Worried", "worried"]].map(([label, key]) => ({
    label, answers: totals[key], share: classified ? answerShare(totals[key], totals.predictedAnswers) : null,
    color: SENTIMENT_COLORS[key],
  }));
  // Requested web reference category; the stored classifier remains Calm/Worried.
  // Unanalyzed answers never become Neutral, and empty denominators stay unavailable.
  sentiment.splice(1, 0, { label: "Neutral", answers: 0,
    share: classified ? answerShare(0, totals.predictedAnswers) : null, color: "#687582" });
  const satisfaction = [
    ["Satisfied", "satisfiedAnswers", SATISFACTION_COLORS.satisfied],
    ["Neutral satisfaction", "neutralSatisfactionAnswers", SATISFACTION_COLORS.neutral],
    ["Dissatisfied", "dissatisfiedAnswers", SATISFACTION_COLORS.dissatisfied],
  ].map(([label, key, color]) => ({ label, answers: totals[key],
    share: answerShare(totals[key], totals.satisfactionAnswers), color }));
  const dominant = sentiment.every((row) => isShare(row.share))
    ? totals.calm === totals.worried ? "tie" : totals.calm > totals.worried ? "calm" : "worried" : null;
  return { sentiment, satisfaction, dominant,
    dominantShare: dominant ? Math.max(...sentiment.map((row) => row.share)) : null,
    analysisCoverage: answerShare(totals.predictedAnswers, totals.eligibleAnswers) };
};
