import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const load = (path) => {
  const filename = fileURLToPath(new URL(path, import.meta.url));
  const result = buildSync({
    entryPoints: [filename],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    packages: "external",
    loader: { ".svg": "empty" },
  });
  const compiled = new Module(filename);
  compiled.filename = filename;
  compiled.require = createRequire(filename);
  compiled._compile(result.outputFiles[0].text, filename);
  return compiled.exports;
};

const regionalModule = load("../src/pages/admin/sentimentPulseTool/RegionalAnalysis.jsx");
const RegionalAnalysis = regionalModule.default;
const render = (props) =>
  renderToStaticMarkup(React.createElement(RegionalAnalysis, props));

const response = {
  regions: [
    {
      region: "NCR",
      surveyRespondents: 2,
      totalSubmissions: 3,
      healthSentimentScore: null,
      sentimentStatus: "Coming soon",
    },
  ],
  unknownRegion: {
    region: null,
    surveyRespondents: 1,
    totalSubmissions: 1,
    healthSentimentScore: null,
    sentimentStatus: "Coming soon",
  },
  totals: {
    surveyRespondents: 3,
    totalSubmissions: 5,
    unlinkedSubmissions: 1,
    unknownRegionRespondents: 1,
  },
  filteredTotals: {
    surveyRespondents: 3,
    totalSubmissions: 5,
    unlinkedSubmissions: 1,
  },
};

test("cards render null sentiment as a dash and keep response metrics visible", () => {
  const html = render({ regionalAnalysis: response });

  assert.match(html, /Regional Survey Summary/);
  assert.match(html, /Survey Respondents by Region/);
  assert.match(html, /Survey respondents/);
  assert.match(html, /Health sentiment score/);
  assert.match(html, /—/);
  assert.match(html, /Coming soon/);
  assert.match(html, /Unknown region/);
  assert.doesNotMatch(html, />0%<|Proactive|Concerned/);
});

test("loading, error, and empty states never merge in mock values", () => {
  assert.match(render({ isLoading: true }), /Loading regional survey statistics/);
  const error = render({ isError: true });
  assert.match(error, /role="alert"/);
  assert.doesNotMatch(error, /Regional Survey Summary|Survey Respondents by Region/);
  assert.match(
    render({
      regionalAnalysis: {
        ...response,
        totals: { ...response.totals, totalSubmissions: 0 },
        filteredTotals: { ...response.filteredTotals, totalSubmissions: 0 },
      },
    }),
    /No eligible survey responses/,
  );
  assert.deepEqual(regionalModule.normalizeRegionalApiData(null), {});
});

test("region filters hide unknown respondents after backend assignment", () => {
  const html = render({ selectedRegions: ["NCR"], regionalAnalysis: response });
  assert.match(html, /Unknown-region respondents are excluded/);
  assert.doesNotMatch(html, /<h4[^>]*>Unknown region<\/h4>/);
});

test("regional CSV matches respondent, submission, filter, and sentiment placeholders", () => {
  const { buildSentimentPulseCsv } = load(
    "../src/pages/admin/sentimentPulseTool/exportUtils.js",
  );
  const csv = buildSentimentPulseCsv({
    activeTab: "regional-analysis",
    timeRange: "custom",
    customStartDate: "2026-09-01",
    customEndDate: "2026-09-15",
    selectedRegions: ["NCR"],
    regionalAnalysis: {
      ...response,
      filteredTotals: {
        surveyRespondents: 2,
        totalSubmissions: 3,
        unlinkedSubmissions: 1,
      },
    },
    surveys: [],
  });

  assert.match(csv, /Start Date: 2026-09-01/);
  assert.match(csv, /Region,Survey Respondents,Total Submissions,Health Sentiment Score,Sentiment Status/);
  assert.match(csv, /Region NCR,2,3,—,Coming soon/);
  assert.doesNotMatch(csv, /Previous Responses|Dominant Sentiment|Trend/);
});
