import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const filename = fileURLToPath(
  new URL("../src/pages/admin/diseaseWatchFeed/recentAlerts.js", import.meta.url)
);
const result = buildSync({
  entryPoints: [filename],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  packages: "external",
});
const compiled = new Module(filename);
compiled.filename = filename;
compiled.require = createRequire(filename);
compiled._compile(result.outputFiles[0].text, filename);
const { buildRecentAlerts } = compiled.exports;

const report = {
  id: "report-1",
  symptomIds: ["cough"],
  symptomLabels: ["Cough"],
  possibleConditionLabel: "Possible influenza",
  region: "NCR",
  createdAt: "2026-09-16T00:00:00.000Z",
};

test("an export report renders without a matching map pin", () => {
  const alerts = buildRecentAlerts([report], new Map());

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].disease, "Possible influenza");
  assert.equal(alerts[0].region, "Region NCR");
  assert.match(alerts[0].summary, /Cough/);
});

test("a matching map pin enriches an export report", () => {
  const alerts = buildRecentAlerts(
    [{ ...report, symptomLabels: [] }],
    new Map([[report.id, { id: report.id, disease: "Influenza", tags: ["Fever"] }]])
  );

  assert.equal(alerts[0].disease, "Influenza");
  assert.match(alerts[0].summary, /Fever/);
});

test("export fallbacks are shown when map-pin data is unavailable", () => {
  const alerts = buildRecentAlerts(
    [{ ...report, id: "report-2", symptomIds: [], symptomLabels: [], possibleConditionLabel: "" }],
    new Map()
  );

  assert.equal(alerts[0].disease, "Respiratory symptoms reported");
  assert.match(alerts[0].summary, /respiratory symptoms/);
});
