import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const load = (path) => {
  const filename = fileURLToPath(new URL(path, import.meta.url));
  const result = buildSync({ entryPoints: [filename], bundle: true, write: false,
    platform: "node", format: "cjs", jsx: "automatic", packages: "external", loader: { ".svg": "empty" } });
  const compiled = new Module(filename);
  compiled.filename = filename;
  compiled.require = createRequire(filename);
  compiled._compile(result.outputFiles[0].text, filename);
  return compiled.exports;
};

const { DASHBOARD_REGION_CODES, getDashboardRegionLabel } = load("../src/pages/admin/dashboardRegions.js");
const { buildRegionalCoverage } = load("../src/pages/admin/diseaseWatchFeed/regionalCoverage.js");

test("the three dashboard region options use the same codes and labels", () => {
  const health = load("../src/pages/admin/healthLiteracyHub/shared/sharedConfig.js");
  const sentiment = load("../src/pages/admin/sentimentPulseTool/RegionalAnalysis.jsx");
  assert.deepEqual(health.ANALYTICS_REGIONS.map(({ value }) => value), DASHBOARD_REGION_CODES);
  assert.deepEqual(sentiment.REGIONS.map(({ value }) => value), DASHBOARD_REGION_CODES);
  assert.equal(DASHBOARD_REGION_CODES.length, 17);
  assert.equal(getDashboardRegionLabel("NCR"), sentiment.getRegionLabel("NCR"));
  assert.equal(getDashboardRegionLabel(null), "Unknown region");
  assert.equal(DASHBOARD_REGION_CODES.includes("all"), false);
});

test("coverage uses canonical API regions even with missing or inconsistent map labels", () => {
  const rows = buildRegionalCoverage([
    { id: "one", mobileReporterId: "same", region: "NCR", locationLabel: "Metro Manila" },
    { id: "two", mobileReporterId: "same", region: "NCR", locationLabel: "National Capital Region" },
    { id: "three", mobileReporterId: "another", region: "III" },
    { id: "four", region: null, locationLabel: "NCR" },
  ]);
  assert.deepEqual(rows, [
    { region: "NCR", users: 1, reportCount: 2, alertCount: 2, percentage: 50 },
    { region: "III", users: 1, reportCount: 1, alertCount: 1, percentage: 50 },
  ]);
  assert.deepEqual(buildRegionalCoverage([{ id: "unknown", region: null }]), []);
});

test("health content filtering does not manufacture a region", () => {
  const { getFilteredContentItems } = load("../src/pages/admin/healthLiteracyHub/content/contentTabFiltering.js");
  const result = getFilteredContentItems({
    fetchedContent: [{ id: "one", title: "National health guide" }],
    contentTypeLabel: "Articles", searchQuery: "",
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].region, undefined);
});
