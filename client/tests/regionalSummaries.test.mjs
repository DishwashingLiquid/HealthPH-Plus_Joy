import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Existing Vite dependency transforms the actual JSX; no server, browser,
// installed test framework, or network/database calls are involved.
const filename = fileURLToPath(new URL("../src/pages/admin/diseaseWatchFeed/RegionalSummaryList.jsx", import.meta.url));
const result = buildSync({ entryPoints: [filename], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", packages: "external" });
const compiled = new Module(filename);
compiled.filename = filename;
compiled.require = createRequire(filename);
compiled._compile(result.outputFiles[0].text, filename);
const SummaryList = compiled.exports.default;
const render = (props) => renderToStaticMarkup(React.createElement(SummaryList, props));

test("summary loading, empty, failure and refresh states are distinct", () => {
  const loading = render({ isLoading: true });
  assert.match(loading, /Loading regional summaries/);
  assert.doesNotMatch(loading, /No regional summary/);
  assert.match(render({}), /No regional summary is ready/);
  const error = render({ errorMessage: "Failed to load regional summaries." });
  assert.match(error, /role="alert"/);
  assert.doesNotMatch(error, /No regional summary|Loading/);
  assert.doesNotMatch(render({ isFetching: true }), /No regional summary/);
});

test("template uses backend top three, keeps complete list and notice", () => {
  const html = render({ summaries: [{ region: "III", regionName: "Central Luzon", reportCount: 11,
    symptomCounts: [{ symptom: "cough", count: 8 }, { symptom: "fever", count: 6 }, { symptom: "sore throat", count: 4 }, { symptom: "fatigue", count: 1 }] }] });
  assert.match(html, /Central Luzon has 11 submitted self-reports\. The most frequently reported symptoms are cough \(8 reports\), fever \(6 reports\), and sore throat \(4 reports\)\./);
  assert.match(html, /<details/);
  assert.match(html, /fatigue: 1 report/);
  assert.match(html, /are not diagnoses/);
});

test("singular, missing data, and React text escaping", () => {
  const singular = render({ summaries: [{ region: "NCR", reportCount: 1, symptomCounts: [{ symptom: "<script>alert(1)</script>", count: 1 }] }] });
  assert.match(singular, /1 submitted self-report\./);
  assert.match(singular, /symptom is/);
  assert.doesNotMatch(singular, /<script>/);
  assert.match(render({ summaries: [{ region: "III", reportCount: 5 }] }), /No symptom data was provided/);
});

test("cached summary stays visible during refresh", () => {
  const html = render({ isFetching: true, summaries: [{ region: "III", reportCount: 5 }] });
  assert.match(html, /Refreshing regional summaries/);
  assert.match(html, /5 submitted self-reports/);
});
