// Presentation of server aggregates only. No raw-entry aggregation or model scores.
export const SENTIMENT_COLORS = { calm: "#2572A5", worried: "#B45309", satisfaction: "#15803D" };
export const isCount = (value) => Number.isInteger(value) && value >= 0;
export const isShare = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
export const formatCount = (value) => isCount(value) ? value.toLocaleString("en-PH") : "Unavailable";
export const formatShare = (value) => isShare(value) ? `${value.toFixed(1)}%` : "Unavailable";
export const getPhilippineDateInput = (offset = 0, now = Date.now()) => {
  const date = new Date(now + 8 * 60 * 60 * 1000);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

const validDay = (day) => /^\d{4}-\d{2}-\d{2}$/.test(day || "") &&
  Number.isFinite(Date.parse(`${day}T00:00:00Z`)) &&
  new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;

export const dateRangeError = ({ timeRange, startDate, endDate }, today = getPhilippineDateInput()) => {
  if (timeRange !== "custom") return "";
  if (!validDay(startDate) || !validDay(endDate)) return "Choose valid start and end dates.";
  if (startDate > endDate) return "Start date must be on or before end date.";
  if (endDate > today) return "Choose an end date no later than today in the Philippines.";
  return "";
};

export const trendsRequest = ({ timeRange = "last-30-days", regions = [], startDate, endDate, surveyId } = {}) => ({
  url: "/sentiment-pulse/trends",
  params: {
    timeRange,
    ...(regions.length ? { regions: regions.join(",") } : {}),
    ...(timeRange === "custom" ? { startDate, endDate } : {}),
    ...(surveyId ? { surveyId } : {}),
  },
});

export const surveyAggregate = (report, id) => report?.surveys?.find((row) => row.surveyId === id);
// The card shows the larger class's share of classified answers, not a model score.
export const surveyCardSentiment = (summary) => {
  const empty = (label) => ({ label, share: null, kind: null });
  if (!summary) return empty("Unavailable");
  if (summary.sentimentStatus === "not_configured") return empty("Not configured");
  const totals = summary.totals;
  if (!totals || !isCount(totals.eligibleAnswers) || !isCount(totals.predictedAnswers)) return empty("Unavailable");
  if (totals.eligibleAnswers === 0) return empty("No eligible feedback");
  if (totals.predictedAnswers === 0) return empty("Not processed");
  if (!isCount(totals.calm) || !isCount(totals.worried) ||
      totals.calm + totals.worried !== totals.predictedAnswers ||
      totals.predictedAnswers > totals.eligibleAnswers || !isShare(totals.worriedShare)) return empty("Unavailable");
  if (totals.calm === totals.worried) return { label: "Calm / Worried", share: totals.worriedShare, kind: "tie" };
  return totals.worried > totals.calm
    ? { label: "Worried", share: totals.worriedShare, kind: "worried" }
    : { label: "Calm", share: 100 - totals.worriedShare, kind: "calm" };
};
export const isActiveJob = (job) => ["scheduled", "running"].includes(job?.state);
export const processNotice = (result) => {
  if (result.state === "not_configured") return "Not configured. No processing task was scheduled.";
  if (result.state === "configured" && result.summary && !result.job) {
    const totals = result.summary.totals;
    return `Rating satisfaction: ${formatShare(totals?.satisfactionShare)}. ${formatCount(totals?.satisfiedAnswers)} satisfied out of ${formatCount(totals?.satisfactionAnswers)} valid scored answers. No model inference was required.`;
  }
  return result.accepted ? "Processing request accepted. Completion is reported separately below." : "A current job already exists on this worker; refreshing coverage.";
};
export const jobLabel = (job) => ({
  scheduled: "Request scheduled", running: "Processing feedback answers",
  completed: "Processing finished", completed_with_errors: "Processing finished with errors",
  failed: "Processing job failed",
}[job?.state] || "Current job status unavailable");

export const summaryState = (summary, row = summary) => {
  if (!summary || !row) return "Unavailable";
  if (row.sentimentStatus === "not_configured") return "Not configured";
  const totals = summary.totals || row;
  if (!isCount(totals.eligibleAnswers) || !isCount(totals.predictedAnswers)) return "Unavailable";
  if (totals.eligibleAnswers === 0) return "No eligible text/choice answers";
  if (totals.predictedAnswers === 0) return "Not processed";
  return isShare(totals.worriedShare) ? `${formatShare(totals.worriedShare)} worried` : "Unavailable";
};

export const reportingScope = (report) => {
  const f = report?.filters;
  return f ? `Mobile answers · ${f.startDate} to ${f.endDate} · Philippine dates · ${f.regions?.length ? f.regions.join(", ") : "All regions (including unknown)"}${f.surveyId ? ` · ${f.surveyId}` : " · All surveys"}` : "Date-filtered mobile answers";
};

export const dailySeries = (report) => {
  const rows = [...(report?.daily || [])].sort((a, b) => a.date.localeCompare(b.date));
  // A null separator prevents charts connecting across dates absent from the API.
  return rows.flatMap((row, index) => {
    const previous = rows[index - 1];
    const nextDay = previous && new Date(Date.parse(`${previous.date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    const gap = nextDay && nextDay < row.date ? [{ date: nextDay, worriedShare: null, satisfactionShare: null, predictedAnswers: null }] : [];
    return [...gap, { ...row, worriedShare: isShare(row.worriedShare) ? row.worriedShare : null,
      satisfactionShare: isShare(row.satisfactionShare) ? row.satisfactionShare : null }];
  });
};
