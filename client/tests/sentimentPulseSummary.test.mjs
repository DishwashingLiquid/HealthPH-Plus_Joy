import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync, transformSync } from "esbuild";
import { readFileSync } from "node:fs";
import { configureStore } from "@reduxjs/toolkit";
import { createApi } from "@reduxjs/toolkit/query/react";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const filename = fileURLToPath(new URL("../src/pages/admin/sentimentPulseTool/StaticContainers.jsx", import.meta.url));
const result = buildSync({ entryPoints: [filename], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", packages: "external" });
const compiled = new Module(filename);
compiled.filename = filename;
compiled.require = createRequire(filename);
compiled._compile(result.outputFiles[0].text, filename);
const render = (props = {}) => renderToStaticMarkup(React.createElement(compiled.exports.default, props));
const summary = {
  activeRegions: 3, totalRegions: 17, publishedSurveyCount: 5,
  surveyResponses: 120, previousMonthResponses: 80, responseChangePercent: 50,
  currentPublicationMonth: "2026-09", previousPublicationMonth: "2026-08",
  responseCutoff: "2026-09-01T00:01:00+08:00",
  nextReportingPeriod: "2026-10-01T00:00:00+08:00",
};

test("cards display a complete summary with publication-month labels and Philippine dates", () => {
  const html = render({ summary });
  assert.match(html, /120/);
  assert.match(html, /50\.0%/);
  assert.match(html, /Surveys published in Sep 2026/);
  assert.match(html, /vs surveys published in Aug 2026 \(80 responses\)/);
  assert.match(html, /3\/17/);
  assert.match(html, /Across the latest 5 published surveys/);
  assert.match(html, /Sep 1, 2026/);
  assert.match(html, /Next reporting period/);
  assert.match(html, /Oct 1, 2026/);
  assert.doesNotMatch(html, /Next update|from last update/);
});

test("loading and failed requests have no mock summary values", () => {
  assert.match(render({ isLoading: true }), /Loading\.\.\./);
  const html = render({ isError: true });
  assert.match(html, /role="alert"/);
  assert.match(html, /Unavailable/);
  assert.doesNotMatch(html, /No responses yet|regions active.*vs previous/);
});

test("empty data and a zero previous total never display a response percentage", () => {
  const empty = { ...summary, activeRegions: 0, publishedSurveyCount: 0, surveyResponses: 0,
    previousMonthResponses: 0, responseChangePercent: null, responseCutoff: null };
  const html = render({ summary: empty });
  assert.match(html, /No responses yet/);
  assert.match(html, /No published surveys yet/);
  assert.match(html, /No responses in either group/);
  assert.match(render({ summary: { ...empty, surveyResponses: 1 } }), /No previous-month responses/);
  assert.doesNotMatch(html, /NaN|Infinity|50\.0%/);
});

test("a refresh error preserves the whole prior summary and marks it stale", () => {
  const html = render({ summary, isError: true });
  assert.match(html, /Showing the last loaded values/);
  assert.match(html, /120/);
  assert.match(html, /3\/17/);
  assert.match(html, /Sep 1, 2026/);
});

test("unknown-region responses are reported separately from active regions", () => {
  const html = render({ summary: { ...summary, unknownRegionResponses: 7 } });
  assert.match(html, /3\/17/);
  assert.match(html, /7 responses have an unknown region in these surveys/);
  assert.match(html, /120/);
});

test("month rollover replaces values even when the response cutoff does not change", () => {
  const html = render({ summary: { ...summary, surveyResponses: 0, previousMonthResponses: 120,
    responseChangePercent: -100, currentPublicationMonth: "2026-10", previousPublicationMonth: "2026-09",
    nextReportingPeriod: "2026-11-01T00:00:00+08:00" } });
  assert.match(html, /100\.0%/);
  assert.match(html, /Surveys published in Oct 2026/);
  assert.match(html, /Sep 1, 2026/);
  assert.match(html, /Nov 1, 2026/);
});

test("survey mutations refresh both subscribed queries, even with an unchanged cutoff", async () => {
  let summaryReads = 0;
  let surveyReads = 0;
  const baseAPI = createApi({
    reducerPath: "api",
    tagTypes: ["SentimentPulseSurveys"],
    baseQuery: async (query) => {
      if (query === "/sentiment-pulse/summary") {
        summaryReads += 1;
        return { data: { ...summary, surveyResponses: summaryReads } };
      }
      if (query === "/sentiment-pulse/surveys") surveyReads += 1;
      return { data: [] };
    },
    endpoints: () => ({}),
  });
  const apiFilename = fileURLToPath(new URL("../src/features/api/sentimentPulseSlice.js", import.meta.url));
  const apiModule = new Module(apiFilename);
  const require = createRequire(apiFilename);
  apiModule.require = (name) => name === "./_baseAPI" ? { baseAPI } : require(name);
  apiModule._compile(transformSync(readFileSync(apiFilename, "utf8"), { format: "cjs" }).code, apiFilename);
  const api = apiModule.exports.sentimentPulseApi;
  const store = configureStore({ reducer: { api: api.reducer }, middleware: (defaults) => defaults().concat(api.middleware) });
  try {
    await Promise.all([
      store.dispatch(api.endpoints.fetchSentimentPulseSummary.initiate()),
      store.dispatch(api.endpoints.fetchSentimentPulseSurveys.initiate()),
    ]);
    for (const [endpoint, arg] of [
      ["createSentimentPulseSurvey", {}],
      ["updateSentimentPulseSurvey", { surveyId: "one", data: {} }],
      ["scheduleSentimentPulseSurvey", { surveyId: "one", scheduledAt: summary.nextReportingPeriod }],
      ["deleteSentimentPulseSurvey", "one"],
      ["submitPublicSentimentPulseSurveyResponse", { surveyId: "one", data: {} }],
    ]) {
      const previousReads = summaryReads;
      await store.dispatch(api.endpoints[endpoint].initiate(arg));
      await Promise.all(store.dispatch(api.util.getRunningQueriesThunk()));
      assert.equal(summaryReads, previousReads + 1, endpoint);
      assert.equal(surveyReads, summaryReads, endpoint);
      const data = api.endpoints.fetchSentimentPulseSummary.select()(store.getState()).data;
      assert.equal(data.surveyResponses, summaryReads);
      assert.equal(data.responseCutoff, summary.responseCutoff);
    }
  } finally {
    store.dispatch(api.util.resetApiState());
  }
});
