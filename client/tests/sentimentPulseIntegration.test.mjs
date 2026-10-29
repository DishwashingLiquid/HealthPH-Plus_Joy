import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { buildSync, transformSync } from "esbuild";
import { configureStore } from "@reduxjs/toolkit";
import { createApi } from "@reduxjs/toolkit/query/react";
import React from "react";
import { Provider } from "react-redux";
import { renderToStaticMarkup } from "react-dom/server";
import { counts, makeReport, surveys, summary as surveySummary } from "./fixtures/sentimentPulseData.mjs";
import { dailySeries, dateRangeError, formatShare, getPhilippineDateInput, isActiveJob, jobLabel, processNotice, summaryState, trendsRequest } from "../src/pages/admin/sentimentPulseTool/sentimentContract.js";

function load(relative, api) {
  const filename = fileURLToPath(new URL(relative, import.meta.url));
  const result = buildSync({ entryPoints: [filename], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", packages: "external", loader: { ".svg": "empty", ".css": "empty" },
    external: api ? ["../../../features/api/sentimentPulseSlice"] : [] });
  const compiled = new Module(filename);
  const require = createRequire(filename);
  compiled.filename = filename;
  compiled.require = (name) => name.endsWith(".css") ? {} : api && name.includes("sentimentPulseSlice") ? api : require(name);
  compiled._compile(result.outputFiles[0].text, filename);
  return compiled.exports;
}

const Summary = load("../src/pages/admin/sentimentPulseTool/SentimentSummary.jsx").default;
const Trends = load("../src/pages/admin/sentimentPulseTool/SentimentTrends.jsx").default;
const { buildSentimentPulseCsv } = load("../src/pages/admin/sentimentPulseTool/exportUtils.js");
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const options = { timeRange: "custom", customStartDate: "2026-10-01", customEndDate: "2026-10-28", selectedRegions: [], surveys };

test("request parameters are restricted to the verified reporting contract", () => {
  assert.deepEqual(trendsRequest({ timeRange: "custom", regions: ["NCR", "III"], startDate: "2026-10-01", endDate: "2026-10-28", surveyId: "SUR00001", questionId: "must-not-send", limit: 100 }), {
    url: "/sentiment-pulse/trends", params: { timeRange: "custom", regions: "NCR,III", startDate: "2026-10-01", endDate: "2026-10-28", surveyId: "SUR00001" },
  });
  assert.deepEqual(trendsRequest({ regions: [], startDate: "unused", endDate: "unused" }).params, { timeRange: "last-30-days" });
});

test("custom ranges require real calendar dates and complete Philippine boundaries", () => {
  const today = "2026-10-28";
  for (const [startDate, endDate] of [["", today], [today, ""], ["2026-02-30", today], ["2026-10-29", today], [today, "2026-10-29"]]) {
    assert.ok(dateRangeError({ timeRange: "custom", startDate, endDate }, today));
  }
  assert.equal(dateRangeError({ timeRange: "custom", startDate: today, endDate: today }, today), "");
  assert.equal(dateRangeError({ timeRange: "last-7-days" }, today), "");
  assert.equal(getPhilippineDateInput(0, Date.parse("2026-12-31T15:59:59Z")), "2026-12-31");
  assert.equal(getPhilippineDateInput(0, Date.parse("2026-12-31T16:00:00Z")), "2027-01-01");
  assert.equal(getPhilippineDateInput(-1, Date.parse("2026-12-31T16:00:00Z")), "2026-12-31");
});

test("null, zero, ties, configuration, and missing coverage remain distinct", () => {
  assert.equal(formatShare(null), "Unavailable");
  assert.equal(formatShare(0), "0.0%");
  assert.equal(summaryState(makeReport()), "50.0% worried");
  assert.equal(summaryState(makeReport({ sentimentStatus: "not_configured" })), "Not configured");
  assert.equal(summaryState(makeReport({ totals: { ...counts, eligibleAnswers: 0, predictedAnswers: 0, worriedShare: null } })), "No eligible text/choice answers");
  assert.equal(summaryState(makeReport({ totals: { ...counts, predictedAnswers: 0, worriedShare: null } })), "Not processed");
  assert.equal(summaryState(undefined), "Unavailable");
});

test("summary shows server counts, coverage, and a separate satisfaction denominator", () => {
  const html = render(Summary, { summary: makeReport() });
  assert.match(html, /50\.0% worried/);
  assert.match(html, /6 feedback answers analyzed/);
  assert.match(html, /Calm: 3 answers/);
  assert.match(html, /Worried: 3 answers/);
  assert.match(html, /2 eligible text\/choice answers have no available prediction/);
  assert.match(html, /2 satisfied answers out of 4 valid scored answers/);
  assert.match(html, /not unique respondents/);
  assert.match(html, /Dissatisfied: 1/);
  assert.match(html, /Neutral satisfaction: 1/);
  assert.doesNotMatch(html, /Neutral sentiment|Concerned|Dominant Sentiment|0 failed|0 queued/);
});

test("empty denominators render unavailable, while a real zero share is displayed", () => {
  const html = render(Summary, { summary: makeReport({ totals: { ...counts, eligibleAnswers: 0, predictedAnswers: 0, calm: 0, worried: 0, worriedShare: null, satisfactionShare: null, answersWithoutResults: 0 } }) });
  assert.match(html, /No eligible text\/choice answers/);
  assert.match(html, /Satisfaction: Unavailable/);
  assert.doesNotMatch(html, /0\.0%|Neutral sentiment/);
  assert.match(render(Summary, { summary: makeReport({ totals: { ...counts, worried: 0, worriedShare: 0 } }) }), /0\.0% worried/);
});

test("unconfigured satisfaction is not inferred from calm/worried", () => {
  const html = render(Summary, { summary: makeReport({ satisfactionStatus: "not_configured", totals: { ...counts, satisfactionShare: null } }) });
  assert.match(html, /Satisfaction: Not configured/);
  assert.match(html, /50\.0% worried/);
});

test("Trends renders supported survey and daily breakdowns with honest API gaps", () => {
  const html = render(Trends, { report: makeReport(), surveys });
  assert.match(html, /Community care feedback/);
  assert.match(html, /Survey breakdown/);
  assert.match(html, /Daily answer counts/);
  assert.match(html, /Question-level sentiment and a question filter are unavailable/);
  assert.match(html, /filtered rating distribution is unavailable/);
  assert.match(html, /2026-10-28/);
  assert.doesNotMatch(html, /Top Health Topics|Misinformed|Neutral sentiment/);
});

test("loading, errors, and invalid custom dates never display stale aggregates", () => {
  assert.match(render(Trends, { isLoading: true }), /Loading sentiment aggregates/);
  const failed = render(Trends, { report: makeReport(), isError: true });
  assert.match(failed, /role="alert"/);
  assert.doesNotMatch(failed, /50\.0%/);
  assert.doesNotMatch(render(Trends, { report: makeReport(), filterError: "Choose valid dates" }), /50\.0%/);
});

test("daily chart preserves null percentages and breaks across absent dates", () => {
  const report = makeReport();
  report.daily = [{ date: "2026-10-01", ...counts }, { date: "2026-10-03", ...counts, worriedShare: null, satisfactionShare: null }];
  const rows = dailySeries(report);
  assert.equal(rows[1].date, "2026-10-02");
  assert.equal(rows[1].worriedShare, null);
  assert.equal(rows[1].predictedAnswers, null);
  assert.equal(rows[2].satisfactionShare, null);
});

test("Trends CSV agrees with its displayed backend aggregate", () => {
  const report = makeReport();
  const trendsCsv = buildSentimentPulseCsv({ ...options, activeTab: "sentiment-trends", trends: report });
  assert.match(trendsCsv, /8,6,2,3,3,50\.0,2,4,50\.0/);
  assert.match(trendsCsv, /50\.0% worried/);
  assert.doesNotMatch(trendsCsv, /Neutral sentiment|Concerned|2026-05-01|Dominant Sentiment/);
  assert.match(trendsCsv, /Dissatisfied answers,Neutral satisfaction answers/);
  assert.match(trendsCsv, /Daily,2026-10-28/);
  assert.match(render(Summary, { summary: report, compact: true }), /50\.0% worried/);
});

test("Mobile Surveys CSV uses the same stored assessment and coverage as its card", () => {
  const report = makeReport({ totals: { ...counts, calm: 1, worried: 5, worriedShare: 100 * 5 / 6 } });
  const csv = buildSentimentPulseCsv({ ...options, activeTab: "mobile-surveys",
    surveys: [{ ...surveys[0], dominantSentiment: "Neutral" }],
    surveyFeedback: { SUR00001: { data: { summary: report } } } });
  assert.match(csv, /Responses,Target,Assessed Sentiment,Class share \(%\)/);
  assert.match(csv, /12,20,Worried,83\.3,8,6,2,1,5,83\.3,2,4,50\.0/);
  assert.match(csv, /Whole survey; all dates/);
  assert.doesNotMatch(csv, /Neutral,|Dominant Sentiment/);
  const missing = buildSentimentPulseCsv({ ...options, activeTab: "mobile-surveys", surveys: [surveys[0]] });
  assert.match(missing, /12,20,Unavailable,,/);
  assert.doesNotMatch(missing, /0\.0%|Neutral,/);
});

test("exports preserve unavailable percentages as blank and known zero as zero", () => {
  const report = makeReport({ totals: { ...counts, worriedShare: null, satisfactionShare: null } });
  const csv = buildSentimentPulseCsv({ ...options, activeTab: "sentiment-trends", trends: report });
  assert.match(csv, /Totals,All filtered answers,8,6,2,3,3,,2,4,,1,1\n/);
  report.totals.worriedShare = 0;
  assert.match(buildSentimentPulseCsv({ ...options, activeTab: "sentiment-trends", trends: report }), /Totals,All filtered answers,8,6,2,3,3,0\.0,2,4,,1,1\n/);
  assert.throws(() => buildSentimentPulseCsv({ ...options, activeTab: "sentiment-trends" }), /Load sentiment aggregates/);
});

test("exports escape survey titles and keep unknown regions explicit", () => {
  const report = makeReport();
  report.regions[0].region = null;
  const csv = buildSentimentPulseCsv({ ...options, surveys: [{ ...surveys[0], title: 'Care, "today"\nfeedback' }], activeTab: "sentiment-trends", trends: report });
  assert.match(csv, /Region,Unknown region/);
  assert.match(csv, /"Care, ""today""\nfeedback"/);
});

test("only actual backend job states are active or named", () => {
  for (const state of ["scheduled", "running"]) assert.equal(isActiveJob({ state }), true);
  for (const state of [undefined, "queued", "interrupted", "completed", "failed"]) assert.equal(isActiveJob({ state }), false);
  assert.equal(jobLabel({ state: "queued" }), "Current job status unavailable");
  assert.equal(jobLabel(null), "Current job status unavailable");
  assert.equal(jobLabel({ state: "completed_with_errors" }), "Processing finished with errors");
});

test("rating-only Process reports computed satisfaction without inventing an active job", () => {
  const summary = makeReport({ totals: { ...counts, satisfactionAnswers: 5, satisfiedAnswers: 2, satisfactionShare: 40 } });
  const result = { state: "configured", job: null, summary };
  assert.match(processNotice(result), /Rating satisfaction: 40\.0%/);
  assert.match(processNotice(result), /2 satisfied out of 5/);
  assert.match(processNotice(result), /No model inference was required/);
  assert.doesNotMatch(processNotice(result), /current job already exists|request accepted/i);
  assert.equal(isActiveJob(result.job), false);
});

function apiHarness(handler, failReads = false) {
  const requests = [];
  const baseAPI = createApi({ reducerPath: "api", tagTypes: ["SentimentPulseSurveys", "SentimentPulseRegionalAnalysis"],
    baseQuery: async (request) => { requests.push(request); return failReads ? { error: { status: 503, data: { detail: "Status unavailable" } } } : { data: handler(request) }; }, endpoints: () => ({}) });
  const filename = fileURLToPath(new URL("../src/features/api/sentimentPulseSlice.js", import.meta.url));
  const compiled = new Module(filename);
  const require = createRequire(filename);
  compiled.require = (name) => name === "./_baseAPI" ? { baseAPI } : require(name);
  compiled._compile(transformSync(readFileSync(filename, "utf8"), { format: "cjs" }).code, filename);
  const api = compiled.exports.sentimentPulseApi;
  const store = configureStore({ reducer: { api: api.reducer }, middleware: (defaults) => defaults().concat(api.middleware) });
  return { api, store, requests, exports: compiled.exports };
}

test("API uses exact endpoints and acceptance response without fabricating completion", async () => {
  const accepted = { surveyId: "SUR00001", accepted: true, job: { jobId: "j", state: "scheduled", stored: 0 } };
  const h = apiHarness(() => accepted);
  try {
    const result = await h.store.dispatch(h.api.endpoints.processSentimentPulseSurvey.initiate("SUR00001")).unwrap();
    assert.deepEqual(h.requests[0], { url: "/sentiment-pulse/surveys/SUR00001/process", method: "POST" });
    assert.equal(result.job.state, "scheduled");
    assert.equal(isActiveJob(result.job), true);
    await h.store.dispatch(h.api.endpoints.fetchSentimentPulseProcessing.initiate("SUR00001"));
    assert.equal(h.requests[1], "/sentiment-pulse/surveys/SUR00001/processing");
  } finally { h.store.dispatch(h.api.util.resetApiState()); }
});

test("processing invalidates subscribed status and Trends without changing legacy survey counts", async () => {
  const h = apiHarness((request) => typeof request === "string" ? { summary: makeReport(), job: null } : request.method ? { accepted: true, job: { state: "scheduled" } } : makeReport());
  try {
    await Promise.all([
      h.store.dispatch(h.api.endpoints.fetchSentimentPulseProcessing.initiate("SUR00001")),
      h.store.dispatch(h.api.endpoints.fetchSentimentPulseTrends.initiate()),
      h.store.dispatch(h.api.endpoints.fetchSentimentPulseSummary.initiate()),
    ]);
    h.requests.length = 0;
    await h.store.dispatch(h.api.endpoints.processSentimentPulseSurvey.initiate("SUR00001"));
    await Promise.all(h.store.dispatch(h.api.util.getRunningQueriesThunk()));
    assert.ok(h.requests.includes("/sentiment-pulse/surveys/SUR00001/processing"));
    assert.ok(h.requests.some((r) => r.url === "/sentiment-pulse/trends"));
    assert.ok(!h.requests.includes("/sentiment-pulse/summary"));
  } finally { h.store.dispatch(h.api.util.resetApiState()); }
});

test("survey cards use server processing summaries, not legacy neutral defaults", async () => {
  const report = makeReport();
  const h = apiHarness(() => ({ summary: report, surveyId: "SUR00001", state: "configured", job: { jobId: "j", state: "running", stored: 0 }, progressDurable: false }));
  try {
    await h.store.dispatch(h.api.endpoints.fetchSentimentPulseProcessing.initiate("SUR00001"));
    const Feedback = load("../src/pages/admin/sentimentPulseTool/SurveyFeedback.jsx", h.exports).default;
    const html = renderToStaticMarkup(React.createElement(Provider, { store: h.store }, React.createElement(Feedback, { surveyId: "SUR00001", ended: true })));
    assert.match(html, /50\.0% worried/);
    assert.match(html, /6 feedback answers analyzed/);
    assert.match(html, /Processing\.\.\./);
    assert.match(html, /disabled=""/);
    assert.match(html, /Whole-survey mobile answers/);
    assert.doesNotMatch(html, /Neutral|confidence:|percent complete/);
  } finally { h.store.dispatch(h.api.util.resetApiState()); }
});

test("unended surveys preserve actions and do not request sentiment processing", () => {
  const h = apiHarness(() => assert.fail("No processing reads for unended surveys"));
  try {
    const Feedback = load("../src/pages/admin/sentimentPulseTool/SurveyFeedback.jsx", h.exports).default;
    const html = renderToStaticMarkup(React.createElement(Provider, { store: h.store }, React.createElement(Feedback, { surveyId: "SUR00002", ended: false })));
    assert.match(html, /available after the survey ends/);
    assert.equal(h.requests.length, 0);
  } finally { h.store.dispatch(h.api.util.resetApiState()); }
});

test("Mobile Surveys preserves its layout and End Survey-to-Process action slot without legacy sentiment fallbacks", () => {
  const h = apiHarness(() => ({}));
  try {
    const Mobile = load("../src/pages/admin/sentimentPulseTool/MobileSurveys.jsx", h.exports).default;
    const survey = { ...surveys[0], dominantSentiment: "Proactive", sentimentBreakdown: { proactive: 60 } };
    const renderMobile = (record) => renderToStaticMarkup(React.createElement(Provider, { store: h.store }, React.createElement(Mobile, { surveys: [record] })));
    const published = renderMobile({ ...survey, status: "Published" });
    assert.match(published, /End Survey/);
    assert.doesNotMatch(published, />Process<\/button>/);
    const ended = renderMobile(survey);
    assert.match(ended, /Loading\.\.\./);
    assert.doesNotMatch(ended, />60%<|Proactive|Neutral/);
    const action = ended.match(/<button\b[^>]*>Process<\/button>/)?.[0];
    assert.ok(action);
    assert.doesNotMatch(action, /\sdisabled=/);
    assert.doesNotMatch(ended, /End Survey|Feedback sentiment|Satisfaction:|Refresh status/);
    assert.match(ended, /grid-cols-3/);
  } finally { h.store.dispatch(h.api.util.resetApiState()); }
});

test("survey card colors, ties, empty and partial coverage come from stored class counts", async () => {
  const h = apiHarness(() => ({}));
  try {
    const Mobile = load("../src/pages/admin/sentimentPulseTool/MobileSurveys.jsx", h.exports).default;
    const renderCard = () => renderToStaticMarkup(React.createElement(Provider, { store: h.store }, React.createElement(Mobile, {
      surveys: [{ ...surveys[0], dominantSentiment: "Neutral", sentimentBreakdown: { neutral: 0 } }],
    })));
    for (const [totals, expected, color] of [
      [{ ...counts, calm: 5, worried: 1, worriedShare: 100 / 6 }, "Calm", "#15803D"],
      [{ ...counts, calm: 1, worried: 5, worriedShare: 100 * 5 / 6 }, "Worried", "#DC2626"],
    ]) {
      await h.store.dispatch(h.api.util.upsertQueryData("fetchSentimentPulseProcessing", "SUR00001", { summary: makeReport({ totals }), job: null }));
      const html = renderCard();
      assert.match(html, /83\.3%/);
      assert.ok(html.includes(`style="color:${color}">${expected}</p>`));
      assert.match(html, /6 of 8 answers analyzed/);
      assert.doesNotMatch(html, /Neutral|>0(?:\.0)?%</);
    }
    await h.store.dispatch(h.api.util.upsertQueryData("fetchSentimentPulseProcessing", "SUR00001", { summary: makeReport(), job: null }));
    const tied = renderCard();
    assert.match(tied, /50\.0%.*each/);
    assert.match(tied, /color:#15803D">Calm/);
    assert.match(tied, /color:#DC2626">Worried/);
    assert.doesNotMatch(tied, /Neutral/);
    for (const [overrides, expected] of [
      [{ totals: { ...counts, predictedAnswers: 0, calm: 0, worried: 0, worriedShare: null } }, "Not processed"],
      [{ totals: { ...counts, eligibleAnswers: 0, predictedAnswers: 0, calm: 0, worried: 0, worriedShare: null } }, "No eligible feedback"],
      [{ sentimentStatus: "not_configured" }, "Not configured"],
      [{ totals: { ...counts, worriedShare: null } }, "Unavailable"],
    ]) {
      await h.store.dispatch(h.api.util.upsertQueryData("fetchSentimentPulseProcessing", "SUR00001", { summary: makeReport(overrides), job: null }));
      const html = renderCard();
      assert.ok(html.includes(expected));
      assert.doesNotMatch(html, /Neutral|>0(?:\.0)?%</);
    }
    await h.store.dispatch(h.api.util.upsertQueryData("fetchSentimentPulseProcessing", "SUR00001", {
      summary: makeReport({ totals: { ...counts, calm: 6, worried: 0, worriedShare: 0 } }), job: null,
    }));
    assert.match(renderCard(), /100\.0%/);
    assert.match(renderCard(), /color:#15803D">Calm/);
  } finally { h.store.dispatch(h.api.util.resetApiState()); }
});

test("accepted Process does not change the card until refreshed stored predictions exist", async () => {
  let report = makeReport({ totals: { ...counts, predictedAnswers: 0, answersWithoutResults: 8, calm: 0, worried: 0, worriedShare: null } });
  const h = apiHarness((request) => request?.method === "POST"
    ? { accepted: true, surveyId: "SUR00001", job: { state: "scheduled", stored: 0 } }
    : { summary: report, surveyId: "SUR00001", state: "configured", job: null });
  try {
    const Mobile = load("../src/pages/admin/sentimentPulseTool/MobileSurveys.jsx", h.exports).default;
    const renderCard = () => renderToStaticMarkup(React.createElement(Provider, { store: h.store }, React.createElement(Mobile, { surveys: [surveys[0]] })));
    await h.store.dispatch(h.api.endpoints.fetchSentimentPulseProcessing.initiate("SUR00001"));
    assert.match(renderCard(), /Not processed/);
    await h.store.dispatch(h.api.endpoints.processSentimentPulseSurvey.initiate("SUR00001"));
    await Promise.all(h.store.dispatch(h.api.util.getRunningQueriesThunk()));
    assert.match(renderCard(), /Not processed/);
    report = makeReport({ totals: { ...counts, calm: 1, worried: 5, worriedShare: 100 * 5 / 6 } });
    const result = await h.store.dispatch(h.api.endpoints.fetchSentimentPulseProcessing.initiate("SUR00001", { forceRefetch: true, subscribe: false })).unwrap();
    const html = renderCard();
    assert.match(html, /83\.3%/);
    assert.match(html, /color:#DC2626">Worried/);
    assert.match(html, /6 of 8 answers analyzed/);
    const csv = buildSentimentPulseCsv({ ...options, activeTab: "mobile-surveys", surveyFeedback: { SUR00001: { data: result } } });
    assert.match(csv, /Worried,83\.3,8,6,2,1,5,83\.3/);
    assert.ok(h.requests.every((request) => (typeof request === "string" ? request : request.url).startsWith("/sentiment-pulse/")));
  } finally { h.store.dispatch(h.api.util.resetApiState()); }
});

test("every ended survey offers Process regardless of configuration, eligibility, or unloaded status", async () => {
  const empty = { ...counts, eligibleAnswers: 0, predictedAnswers: 0, answersWithoutResults: 0, calm: 0, worried: 0, worriedShare: null };
  for (const data of [undefined,
    { state: "not_configured", job: null, summary: makeReport({ totals: empty, sentimentStatus: "not_configured" }) },
    { state: "configured", job: null, summary: makeReport({ totals: empty }) },
  ]) {
    const h = apiHarness(() => data);
    try {
      if (data) await h.store.dispatch(h.api.endpoints.fetchSentimentPulseProcessing.initiate("SUR00001"));
      const Feedback = load("../src/pages/admin/sentimentPulseTool/SurveyFeedback.jsx", h.exports).default;
      const html = renderToStaticMarkup(React.createElement(Provider, { store: h.store }, React.createElement(Feedback, { surveyId: "SUR00001", ended: true })));
      const button = html.match(/<button\b[^>]*>Process<\/button>/)?.[0];
      assert.ok(button, "Ended survey must offer Process");
      assert.doesNotMatch(button, /\sdisabled=/);
    } finally { h.store.dispatch(h.api.util.resetApiState()); }
  }
});

test("a failed status read does not prevent requesting Process for an ended survey", async () => {
  const h = apiHarness(() => ({}), true);
  try {
    await h.store.dispatch(h.api.endpoints.fetchSentimentPulseProcessing.initiate("SUR00001"));
    const Feedback = load("../src/pages/admin/sentimentPulseTool/SurveyFeedback.jsx", h.exports).default;
    const html = renderToStaticMarkup(React.createElement(Provider, { store: h.store }, React.createElement(Feedback, { surveyId: "SUR00001", ended: true })));
    assert.match(html, /Unable to load feedback results/);
    const button = html.match(/<button\b[^>]*>Process<\/button>/)?.[0];
    assert.ok(button);
    assert.doesNotMatch(button, /\sdisabled=/);
  } finally { h.store.dispatch(h.api.util.resetApiState()); }
});

test("survey creation and edit helpers preserve IDs, question types, and validation", () => {
  const h = apiHarness(() => ({}));
  try {
    const mobile = load("../src/pages/admin/sentimentPulseTool/MobileSurveys.jsx", h.exports);
    const draft = mobile.createDraftFromSurvey({ ...surveys[0], questions: [
      ...surveys[0].questions,
      { id: "SUR00001-Q03", type: "multipleChoice", title: "Visit type", choices: ["Clinic", "Hospital"] },
    ] });
    assert.equal(mobile.validateDraft(draft), "");
    const elements = mobile.buildSurveyJson(draft).pages[0].elements;
    assert.deepEqual(elements.map((q) => [q.name, q.type]), [["SUR00001-Q01", "rating"], ["SUR00001-Q02", "text"], ["SUR00001-Q03", "radiogroup"]]);
    assert.equal(elements[0].rateMax, 5);
    assert.deepEqual(elements[2].choices, ["Clinic", "Hospital"]);
    assert.match(mobile.validateDraft({ ...draft, title: "" }), /survey title/);
    assert.match(mobile.validateDraft({ ...draft, questions: [{ type: "rating", title: "Visit", rateMin: 5, rateMax: 1 }] }), /rating maximum/);
  } finally { h.store.dispatch(h.api.util.resetApiState()); }
});

test("create, schedule, end, update, and submission API contracts stay unchanged", async () => {
  const h = apiHarness(() => ({}));
  try {
    const cases = [
      ["createSentimentPulseSurvey", { title: "Care" }, { url: "/sentiment-pulse/surveys", method: "POST", body: { title: "Care" } }],
      ["updateSentimentPulseSurvey", { surveyId: "SUR00001", data: { title: "Edited" } }, { url: "/sentiment-pulse/surveys/SUR00001", method: "PATCH", body: { title: "Edited" } }],
      ["scheduleSentimentPulseSurvey", { surveyId: "SUR00001", scheduledAt: "2026-10-29T08:00:00" }, { url: "/sentiment-pulse/surveys/SUR00001/schedule", method: "PATCH", body: { scheduledAt: "2026-10-29T08:00:00" } }],
      ["endSentimentPulseSurvey", "SUR00001", { url: "/sentiment-pulse/surveys/SUR00001/end", method: "PATCH" }],
      ["submitPublicSentimentPulseSurveyResponse", { surveyId: "SUR00001", data: { answers: { q: "Feedback" }, platform: "mobile" } }, { url: "/sentiment-pulse/public-surveys/SUR00001/responses", method: "POST", body: { answers: { q: "Feedback" }, platform: "mobile" } }],
    ];
    for (const [name, arg, expected] of cases) {
      h.requests.length = 0;
      await h.store.dispatch(h.api.endpoints[name].initiate(arg));
      assert.deepEqual(h.requests[0], expected);
    }
  } finally { h.store.dispatch(h.api.util.resetApiState()); }
});

test("complete Sentiment Pulse dashboard renders before and after aggregate loading", async () => {
  const h = apiHarness(() => ({}));
  try {
    const Tool = load("../src/pages/admin/sentimentPulseTool/SentimentPulseTool.jsx", h.exports).default;
    const renderTool = () => renderToStaticMarkup(React.createElement(Provider, { store: h.store }, React.createElement(Tool)));
    assert.match(renderTool(), /Sentiment Pulse Tool/);
    await Promise.all([
      h.store.dispatch(h.api.util.upsertQueryData("fetchSentimentPulseSurveys", undefined, surveys)),
      h.store.dispatch(h.api.util.upsertQueryData("fetchSentimentPulseSummary", undefined, surveySummary)),
      h.store.dispatch(h.api.util.upsertQueryData("fetchSentimentPulseTrends", {
        timeRange: "last-30-days", regions: [], startDate: getPhilippineDateInput(-29),
        endDate: getPhilippineDateInput(), surveyId: "",
      }, makeReport())),
    ]);
    const loaded = renderTool();
    assert.match(loaded, /Survey Responses/);
    assert.match(loaded, /50\.0% worried/);
  } finally { h.store.dispatch(h.api.util.resetApiState()); }
});
