import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const filename = fileURLToPath(
  new URL("../src/pages/admin/diseaseWatchFeed/alertAutomation.js", import.meta.url)
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
const {
  ALERT_AUTOMATION_INTERVALS,
  getRunEvaluationControlState,
  alertIntervalLabel,
  hasDiseaseWatchFeedAccess,
} = compiled.exports;

test("alert configuration retains every supported backend interval", () => {
  assert.deepEqual(
    ALERT_AUTOMATION_INTERVALS.map(({ minutes }) => minutes),
    [15, 30, 60, 480, 720, 1440]
  );
  for (const { minutes } of ALERT_AUTOMATION_INTERVALS) {
    assert.notEqual(alertIntervalLabel(minutes), "Unavailable");
  }
  assert.equal(alertIntervalLabel(undefined), "Unavailable");
  assert.equal(alertIntervalLabel(120), "Unavailable");
});

test("paused automation and an in-flight evaluation disable the check action", () => {
  const paused = getRunEvaluationControlState({ enabled: false, threshold: 5, intervalMinutes: 15 });
  assert.equal(paused.disabled, true);
  assert.equal(paused.intervalMinutes, 15);
  assert.equal(paused.helperText, "Turn on automatic alerts in Set Up Alerts before checking reports.");

  const enabled = getRunEvaluationControlState({ enabled: true, threshold: 5, intervalMinutes: 30 });
  assert.equal(enabled.disabled, false);
  assert.equal(enabled.intervalMinutes, 30);
  assert.equal(enabled.helperText, "");
  assert.equal(getRunEvaluationControlState({ enabled: true, threshold: 5, intervalMinutes: 30 }, true).disabled, true);
});

test("missing or invalid saved settings never invent an actionable configuration", () => {
  for (const settings of [undefined, null, {}, { enabled: true }, { enabled: true, threshold: 5, intervalMinutes: 120 }]) {
    const state = getRunEvaluationControlState(settings);
    assert.equal(state.disabled, true);
    assert.equal(state.intervalMinutes, null);
    assert.match(state.helperText, /unavailable/);
  }
});

test("Disease Watch Feed locally requires explicit access or SUPERADMIN", () => {
  assert.equal(hasDiseaseWatchFeedAccess({ user_type: "SUPERADMIN" }), true);
  assert.equal(hasDiseaseWatchFeedAccess({ user_type: "USER", accessible_pages: ["Disease Watch Feed"] }), true);
  for (const user of [null, {}, { accessible_pages: [] }, { accessible_pages: ["Health Literacy Hub"] }, { accessible_pages: "Disease Watch Feed" }, { user_type: "SUPERADMIN", is_disabled: true }, { user_type: "SUPERADMIN", activation_pending: true }]) {
    assert.equal(hasDiseaseWatchFeedAccess(user), false);
  }
});
