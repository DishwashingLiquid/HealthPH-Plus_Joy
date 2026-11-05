import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { counts, makeReport } from "./fixtures/sentimentPulseData.mjs";

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

const zero = { eligibleAnswers: 0, predictedAnswers: 0, answersWithoutResults: 0,
  calm: 0, worried: 0, worriedShare: null, satisfactionAnswers: 0, satisfiedAnswers: 0, satisfactionShare: null };
const report = (overrides = {}) => ({ ...makeReport(), regionsComplete: true,
  linkage: { missingAnalyzedAnswers: 0, ambiguousAnalyzedAnswers: 0 },
  totals: { ...counts, analyzedSubmissions: 3, linkedAnalyzedSubmissions: 3, submissionCountStatus: "exact" },
  regions: [{ region: "NCR", ...counts, analyzedSubmissions: 3, linkedAnalyzedSubmissions: 3, submissionCountStatus: "exact" }],
  ...overrides });
const csvFor = (regionalAnalysis, options = {}) => load("../src/pages/admin/sentimentPulseTool/exportUtils.js")
  .buildSentimentPulseCsv({ activeTab: "regional-analysis", selectedRegions: [], regionalAnalysis, ...options });

test("overview and cards use analyzed submissions with answer denominators and existing design", () => {
  const html = render({ regionalAnalysis: report() });
  assert.match(html, /Survey responses analyzed/);
  assert.match(html, /Distinct survey submissions/);
  assert.match(html, /Anonymous and repeated submissions included/);
  assert.match(html, /grid-cols-1[^\"]*md:grid-cols-2 xl:grid-cols-4/);
  assert.match(html, /text-\[28px\]/);
  assert.match(html, /color:#2572A5">Calm/);
  assert.match(html, /color:#B45309">Worried/);
  assert.match(html, /50\.0% each/);
  assert.match(html, /6 of 8 answers analyzed/);
  assert.match(html, /2 answers have no result/);
  assert.match(html, /2 satisfied answers out of 4/);
  assert.match(html, /Trends includes scored answers from submissions without sentiment results too/);
  assert.doesNotMatch(html, /Survey respondents|People with verified accounts|submissions received/);
  assert.equal(regionalModule.getRegionAccent("NCR"), regionalModule.getRegionAccent("Region NCR"));
});

test("comparison always remains present through loading, failures and missing fields", () => {
  for (const props of [{}, { isLoading: true }, { isError: true }, { regionalAnalysis: {} },
    { regionalAnalysis: report({ regions: undefined }) }]) {
    const html = render(props);
    assert.match(html, /Compare analyzed survey responses/);
    assert.match(html, /Survey Responses Analyzed by Region/);
    assert.match(html, /Unavailable/);
    assert.doesNotMatch(html.slice(html.indexOf("Compare analyzed survey responses")), /width:100%/);
  }
  assert.match(render({ isLoading: true }), /Loading regional analytics/);
  assert.match(render({ isError: true }), /Regional analytics could not be loaded/);
  assert.match(render({ regionalAnalysis: {} }), /Some regional analytics fields are unavailable/);
  const html = render({ regionalAnalysis: report(), selectedRegions: ["NCR"] });
  assert.match(html, /width:100%/);
  assert.match(html, /<summary[^>]*>Compare analyzed survey responses<\/summary>/);
  assert.doesNotMatch(html, /<details[^>]*\sopen(?:=|\s|>)/);
});

test("unknown regions remain separate and selected regions keep stable colors", () => {
  const data = report({ regions: [{ region: " region ncr ", ...counts, analyzedSubmissions: 2 },
    { region: null, ...counts, analyzedSubmissions: 1 }] });
  const html = render({ regionalAnalysis: data });
  const cards = html.match(/<article[\s\S]*?<\/article>/g);
  assert.equal(cards.length, 2);
  assert.match(cards.at(-1), /Unknown region[\s\S]*Calm/);
  const filtered = render({ regionalAnalysis: data, selectedRegions: ["NCR"] });
  assert.doesNotMatch(filtered, /<h4[^>]*>Unknown region/);
  assert.match(filtered, /Region filters apply after submission assignment/);
  assert.ok(filtered.includes(`background-color:${regionalModule.getRegionAccent("NCR")}`));
  assert.equal(regionalModule.normalizeRegionalApiData({ regions: [{ region: "Region IV-A" }] }).IVA.region, "Region IV-A");
});

test("valid zero satisfaction, empty, unconfigured and unprocessed have distinct states", () => {
  const data = report();
  data.totals = { ...data.totals, satisfiedAnswers: 0, satisfactionShare: 0 };
  assert.match(render({ regionalAnalysis: data }), /0\.0%/);
  assert.match(render({ regionalAnalysis: data }), /0 satisfied answers out of 4/);
  const unconfigured = render({ regionalAnalysis: report({ sentimentStatus: "not_configured", satisfactionStatus: "not_configured" }) });
  assert.match(unconfigured, /Not set up/);
  assert.doesNotMatch(unconfigured, /50\.0%/);
  const empty = render({ regionalAnalysis: report({ totals: { ...zero, analyzedSubmissions: 0 }, regions: [] }), showEmptyRegions: true });
  assert.match(empty, /No eligible survey answers/);
  assert.match(empty, /No feedback to analyze/);
  assert.match(empty, /No satisfaction answers/);
  assert.doesNotMatch(empty, /0\.0%/);
  const pending = render({ regionalAnalysis: report({ totals: { ...zero, eligibleAnswers: 5, answersWithoutResults: 5 } }) });
  assert.match(pending, /No results yet/);
  assert.match(pending, /5 answers have no result/);
});

test("unresolved submission links keep sentiment but suppress exact counts and comparison bars", () => {
  const partial = { ...counts, analyzedSubmissions: null, linkedAnalyzedSubmissions: 2, submissionCountStatus: "incomplete" };
  const data = report({ totals: partial, regions: [{ region: "NCR", ...partial }],
    linkage: { missingAnalyzedAnswers: 1, ambiguousAnalyzedAnswers: 2 } });
  const html = render({ regionalAnalysis: data });
  assert.match(html, /Exact submission counts are unavailable/);
  assert.match(html, /2 linked submissions/);
  assert.match(html, /1 analyzed answers have missing submission links and 2 have ambiguous links/);
  assert.match(html, /Exact regional comparison unavailable/);
  assert.match(html, /50\.0% each/);
  assert.doesNotMatch(html, /width:100%/);
  const csv = csvFor(data);
  assert.match(csv, /Overall \(filtered\),,2,incomplete,Calm \/ Worried,50\.0/);
  assert.match(csv, /Region NCR,,2,incomplete,Calm \/ Worried,50\.0/);
});

test("loading and failure suppress cached values; invalid filters expose no previous metrics", () => {
  for (const flags of [{ isError: true }, { isLoading: true }]) {
    const html = render({ regionalAnalysis: report(), selectedRegions: ["NCR"], ...flags });
    assert.doesNotMatch(html, /50\.0%|6 of 8|>3<\/p>/);
    assert.match(html, /Compare analyzed survey responses/);
  }
  const html = render({ regionalAnalysis: report(), filterError: "Choose valid dates" });
  assert.match(html, /Choose valid dates/);
  assert.doesNotMatch(html, /50\.0%|By region/);
});

test("missing API metric fields are unavailable rather than zero", () => {
  const data = report({ regionsComplete: false, totals: { predictedAnswers: 6 }, regions: [{ region: "NCR", eligibleAnswers: 8 }] });
  const html = render({ regionalAnalysis: data, selectedRegions: ["NCR"] });
  assert.match(html, /Some regional analytics fields are unavailable/);
  assert.match(html, /Analysis coverage unavailable/);
  assert.match(html, /Unavailable/);
  assert.doesNotMatch(html, /0\.0%|0 satisfied|No feedback to analyze/);
  const missingRow = render({ regionalAnalysis: { ...data, regions: [] }, selectedRegions: ["NCR"] });
  assert.doesNotMatch(missingRow, /No feedback to analyze|>0<\/p>/);
});

test("CSV matches count, class share, coverage and satisfaction with explicit scopes", () => {
  const csv = csvFor(report(), { timeRange: "custom", customStartDate: "2026-10-01", customEndDate: "2026-10-28" });
  assert.match(csv, /Region,Survey responses analyzed,Linked analyzed submissions/);
  assert.match(csv, /Region NCR,3,3,exact,Calm \/ Worried,50\.0,6 of 8 eligible answers analyzed,Incomplete; processing status unknown,50\.0%,8,6,2,3,3,50\.0,2,4,50\.0/);
  assert.match(csv, /Overall \(filtered\),3,3,exact/);
  assert.match(csv, /including unpublished surveys/);
  assert.match(csv, /Trends retains all valid scored mobile answers/);
  assert.match(csv, /All existing surveys; mobile analytics only/);
  assert.doesNotMatch(csv, /Survey Respondents|Total Submissions/);
});

test("CSV keeps unavailable counts blank, valid zero numeric, and scoring configuration explicit", () => {
  const data = report();
  data.totals = { ...data.totals, satisfiedAnswers: 0, satisfactionShare: 0 };
  assert.match(csvFor(data), /0\.0%,8,6,2,3,3,50\.0,0,4,0\.0/);
  data.satisfactionStatus = "not_configured";
  assert.match(csvFor(data), /Not set up,8,6,2,3,3,50\.0,,,,/);
  const failed = csvFor(data, { selectedRegions: ["NCR"], regionalRequestState: "Request failed" });
  assert.match(failed, /Analytics request,Request failed/);
  assert.match(failed, /Region NCR,,,Unavailable,Unavailable,,Analysis coverage unavailable/);
  assert.doesNotMatch(failed, /50\.0/);
});

test("empty-region toggle and CSV visibility agree; selected empty regions remain visible", () => {
  const data = report();
  assert.equal((render({ regionalAnalysis: data }).match(/<article\b/g) || []).length, 1);
  assert.equal((render({ regionalAnalysis: data, showEmptyRegions: true }).match(/<article\b/g) || []).length, 17);
  const selected = render({ regionalAnalysis: data, selectedRegions: ["III"] });
  assert.match(selected, /<h4[^>]*>Region III/);
  assert.match(selected, /No feedback to analyze/);
  assert.match(selected, />0<\/p>/);
  assert.doesNotMatch(selected, /Show regions with no data/);
  assert.doesNotMatch(csvFor(data), /\nRegion III,/);
  assert.match(csvFor(data, { showEmptyRegions: true }), /\nRegion III,0,0,exact/);
  assert.match(csvFor(data, { selectedRegions: ["III"] }), /\nRegion III,0,0,exact/);
});

test("overall shares use aggregate numerators instead of regional averages", () => {
  const data = report();
  data.totals = { ...data.totals, satisfiedAnswers: 1, satisfactionAnswers: 10, satisfactionShare: 10 };
  data.regions = [{ ...data.totals, region: "NCR", satisfiedAnswers: 1, satisfactionAnswers: 1, satisfactionShare: 100 },
    { ...data.totals, region: "III", satisfiedAnswers: 0, satisfactionAnswers: 9, satisfactionShare: 0 }];
  const html = render({ regionalAnalysis: data });
  for (const share of [/10\.0%/, /100\.0%/, /0\.0%/]) assert.match(html, share);
  assert.match(csvFor(data), /Overall \(filtered\),3,3,exact,[^\n]*10\.0%/);
});
