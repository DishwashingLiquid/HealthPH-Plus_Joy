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
  normalizeAlertAutomationInterval,
} = compiled.exports;

test("the run-evaluation selector exposes every supported backend interval", () => {
  assert.deepEqual(
    ALERT_AUTOMATION_INTERVALS.map(({ minutes }) => minutes),
    [15, 30, 60, 480, 720, 1440]
  );
  for (const { minutes } of ALERT_AUTOMATION_INTERVALS) {
    assert.equal(normalizeAlertAutomationInterval(minutes), minutes);
  }
  assert.equal(normalizeAlertAutomationInterval(undefined), 1440);
  assert.equal(normalizeAlertAutomationInterval(120), 1440);
});

test("a paused automation disables the interval selector and Run Evaluation Now action", () => {
  const paused = getRunEvaluationControlState({ enabled: false, intervalMinutes: 15 });
  assert.equal(paused.disabled, true);
  assert.equal(paused.intervalMinutes, 15);
  assert.equal(paused.helperText, "Enable automation in Alert Settings to run an evaluation.");

  const enabled = getRunEvaluationControlState({ enabled: true, intervalMinutes: 30 });
  assert.equal(enabled.disabled, false);
  assert.equal(enabled.intervalMinutes, 30);
  assert.equal(enabled.helperText, "");
  assert.equal(getRunEvaluationControlState({ enabled: true }, true).disabled, true);
});
