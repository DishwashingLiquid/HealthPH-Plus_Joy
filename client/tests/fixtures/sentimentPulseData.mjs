// Synthetic API contracts for frontend tests and the network-isolated preview.
export const counts = { eligibleAnswers: 8, predictedAnswers: 6, answersWithoutResults: 2,
  calm: 3, worried: 3, worriedShare: 50, satisfiedAnswers: 2, satisfactionAnswers: 4, satisfactionShare: 50, dissatisfiedAnswers: 1, neutralSatisfactionAnswers: 1 };
export const surveys = [
  { id: "SUR00001", title: "Community care feedback", subtitle: "Synthetic fixture survey", status: "Ended", responses: 12, target: 20,
    scheduledAt: "2026-10-01T08:00:00+08:00", publishedAt: "2026-10-01T08:00:00+08:00",
    questions: [{ id: "SUR00001-Q01", name: "SUR00001-Q01", title: "How was your visit?", type: "rating", rateMin: 1, rateMax: 5 },
      { id: "SUR00001-Q02", name: "SUR00001-Q02", title: "Please explain your satisfaction with the visit.", type: "text" }] },
  { id: "SUR00002", title: "New mobile survey", subtitle: "Synthetic draft", status: "Draft", responses: 0, target: 100, questions: [] },
  { id: "SUR00003", title: "Current feedback", subtitle: "Synthetic published survey", status: "Published", responses: 2, target: 10,
    scheduledAt: "2026-10-01T08:00:00+08:00", questions: [] },
];

export function makeReport({ totals = counts, sentimentStatus = "configured", satisfactionStatus = "configured", filters } = {}) {
  return { sentimentStatus, satisfactionStatus, sources: ["mobile"],
    filters: filters || { timeRange: "last-30-days", startDate: "2026-09-29", endDate: "2026-10-28", regions: [], surveyId: null, unknownRegionIncluded: true },
    totals: { ...totals }, daily: [{ date: "2026-10-28", ...totals }],
    regions: [{ region: "NCR", ...totals }],
    surveys: [{ surveyId: "SUR00001", sentimentStatus, satisfactionStatus, ...totals }],
    modelVersions: { ["sha256:" + "a".repeat(64)]: totals.predictedAnswers }, mixedModelVersions: false, excludedInvalidSubmissionDates: 0 };
}

export const summary = { activeRegions: 1, totalRegions: 17, publishedSurveyCount: 2,
  surveyResponses: 14, previousMonthResponses: 10, responseChangePercent: 40,
  currentPublicationMonth: "2026-10", previousPublicationMonth: "2026-09",
  responseCutoff: "2026-10-28T10:00:00+08:00", nextReportingPeriod: "2026-11-01T00:00:00+08:00" };

export const results = { survey: surveys[0], questions: [
  { id: "SUR00001-Q01", title: "How was your visit?", type: "rating", answeredResponses: 12,
    rows: [{ label: "1", count: 2, percentage: 16.7 }, { label: "4", count: 5, percentage: 41.7 }, { label: "5", count: 5, percentage: 41.7 }] },
  { id: "SUR00001-Q02", title: "Please explain your satisfaction with the visit.", type: "text", answeredResponses: 10,
    rows: [{ label: "Non-empty text responses", count: 10, percentage: 100 }] },
] };
