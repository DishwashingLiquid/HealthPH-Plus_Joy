import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import React from "react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { renderToStaticMarkup } from "react-dom/server";

function load(file, api, options = {}) {
  const filename = fileURLToPath(new URL(`../src/pages/admin/diseaseWatchFeed/${file}`, import.meta.url));
  const result = buildSync({ entryPoints: [filename], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", packages: "external", external: api ? ["../../../features/api/diseaseWatchFeedSlice", "../../../assets/icons/icons", "./RecentAlertsTab"] : [] });
  const compiled = new Module(filename);
  compiled.filename = filename;
  const require = createRequire(filename);
  compiled.require = (name) => {
    if (api && name.includes("diseaseWatchFeedSlice")) return api;
    if (api && name.includes("assets/icons/icons")) return { AlertDistribution: () => null, EarlyWarning: () => null, SymptomReporting: () => null };
    if (api && name === "./RecentAlertsTab") return (props) => { options.capture?.(props); return React.createElement(RecentAlerts, props); };
    // SSR cannot click navigation; select the initial tab through its state hook
    // while rendering the actual parent and child components for each subtab.
    if (api && options.tab && name === "react") return { ...React, useState: (initial) => React.useState(initial === "recent-alerts" ? options.tab : initial) };
    return require(name);
  };
  compiled._compile(result.outputFiles[0].text, filename);
  return compiled.exports;
}
const RecentAlerts = load("RecentAlertsTab.jsx").default;
const Modal = load("SendAlertModal.jsx").default;
const { alertStatusLabel, recipientAssignmentLabel } = load("alertHistory.js");
const report = { id: "report-1", disease: "Source report", region: "NCR", type: "Symptom Report", summary: "Submitted cough", timestamp: "2026-09-11T12:00:00" };
const alert = { id: "alert-1", title: "Historical alert", region: "NCR", automated: true, status: "Published", recipientCount: 2, inboxAssignmentCount: 2, generatedAt: "2026-09-11T12:00:00", intervalMinutes: 30, reportCount: 6, windowStart: "2026-09-11T11:30:00", windowEnd: "2026-09-11T12:00:00" };
const settings = { enabled: true, threshold: 5, intervalMinutes: 30 };
const render = (props = {}) => renderToStaticMarkup(React.createElement(RecentAlerts, { alerts: [report], sentAlerts: [alert], hasReportsData: true, hasHistoryData: true, alertSettings: settings, canSendAlert: true, ...props }));

test("history failure leaves source reports visible and offers a local retry", () => {
  const html = render({ historyErrorMessage: "History failed", hasHistoryData: false });
  assert.match(html, /Source report/);
  assert.match(html, /Retry alert history/);
  assert.doesNotMatch(html, /Historical alert|No alerts to show/);
});

test("source report failure leaves alert history visible", () => {
  const html = render({ reportsErrorMessage: "Reports failed", hasReportsData: false });
  assert.match(html, /Historical alert/);
  assert.match(html, /Retry self-reports/);
  assert.doesNotMatch(html, /Submitted cough|No self-reports are available/);
});

test("each section has independent initial loading and successful empty states", () => {
  const html = render({ hasReportsData: false, isReportsLoading: true });
  assert.match(html, /Loading self-reports/);
  assert.match(html, /Historical alert/);
  assert.doesNotMatch(html, /Loading alert history/);
  const historyLoading = render({ hasHistoryData: false, isHistoryLoading: true });
  assert.match(historyLoading, /Loading alert history/);
  assert.match(historyLoading, /Source report/);
  const empty = render({ alerts: [], sentAlerts: [] });
  assert.match(empty, /No self-reports are available/);
  assert.match(empty, /No alerts to show/);
});

test("cached reports and history remain visible during refresh and after refresh errors", () => {
  for (const props of [{ isReportsFetching: true, isHistoryFetching: true }, { reportsErrorMessage: "Reports failed", historyErrorMessage: "History failed" }]) {
    const html = render(props);
    assert.match(html, /Source report/);
    assert.match(html, /Historical alert/);
    if (props.isReportsFetching) {
      assert.match(html, /Refreshing self-reports/);
      assert.match(html, /Refreshing alert history/);
    } else {
      assert.equal((html.match(/data may be out of date/g) || []).length, 2);
    }
  }
  const staleEmpty = render({ alerts: [], sentAlerts: [], reportsErrorMessage: "Reports failed", historyErrorMessage: "History failed" });
  assert.match(staleEmpty, /last successful response contained no self-reports/);
  assert.match(staleEmpty, /last successful response contained no alerts/);
});

test("settings failure disables configuration, evaluation and cancellation despite cached settings", () => {
  const scheduled = { ...alert, automated: false, status: "Scheduled", scheduledAt: "2099-01-01T12:00:00" };
  const html = render({ sentAlerts: [scheduled], settingsErrorMessage: "Settings failed", canSendAlert: false });
  assert.match(html, /Retry settings/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Set Up Alerts/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Check reports now/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Cancel alert/);
  assert.match(html, /Report period: Unavailable/);
  assert.doesNotMatch(html, /<select/);
});

test("evaluation uses a read-only saved window, with configuration editing only in Set Up Alerts", () => {
  const html = render();
  assert.doesNotMatch(html, /<select|run-evaluation-interval/);
  assert.match(html, /Checks reports from the past 30 minutes/);
  const paused = render({ alertSettings: { ...settings, enabled: false } });
  assert.match(paused, /<button[^>]*disabled=""[^>]*>Check reports now/);
  const running = render({ isEvaluationRunning: true });
  assert.match(running, /<button[^>]*disabled=""[^>]*>Checking reports/);
});

test("history labels distinguish preparation, inbox assignments and legacy queuing", () => {
  assert.equal(alertStatusLabel({ ...alert, status: "Preparing" }), "Preparing alert");
  assert.equal(alertStatusLabel({ ...alert, status: "Preparation failed" }), "Preparation incomplete");
  assert.equal(alertStatusLabel(alert), "Available in app inboxes");
  assert.equal(alertStatusLabel({ ...alert, inboxAssignmentCount: 0 }), "Ready — no app inboxes assigned");
  assert.equal(alertStatusLabel({ ...alert, inboxAssignmentCount: null }), "App inbox availability unknown");
  assert.equal(alertStatusLabel({ ...alert, status: "Prepared" }), "Available in app inboxes");
  assert.equal(alertStatusLabel({ automated: false, status: "Sent" }), "Recipients queued — older alert");
  assert.match(recipientAssignmentLabel({ ...alert, recipientCount: null, inboxAssignmentCount: null }), /count unavailable/);
  assert.doesNotMatch(recipientAssignmentLabel({ ...alert, recipientCount: null, inboxAssignmentCount: null }), /0 recipient|%/);
  const html = render({ sentAlerts: [{ ...alert, status: "Preparation failed", inboxAssignmentCount: null }] });
  assert.match(html, /Preparation incomplete/);
  assert.doesNotMatch(html, /Prepared for|Marked as sent|Available in app inboxes/);
});

test("only published prepared inboxes are described as available", () => {
  for (const item of [
    { ...alert, status: "Preparing" },
    { ...alert, status: "Preparation failed" },
    { ...alert, automated: false, status: "Sent" },
    { ...alert, inboxAssignmentCount: null },
  ]) {
    assert.doesNotMatch(recipientAssignmentLabel(item), /Available in \d+ app/);
  }
  assert.match(recipientAssignmentLabel({ ...alert, inboxAssignmentCount: 0 }), /No app inboxes assigned/);
  assert.match(recipientAssignmentLabel({ ...alert, recipientCount: 1, inboxAssignmentCount: 1 }), /1 recipient\. Available in 1 app inbox\./);
  const html = render();
  assert.match(html, /This page does not show whether notifications were received or alerts were read/);
});

test("historical alerts use recorded dates while preserving symptoms and custom messages", () => {
  const message = "6 self-reports were recorded in NCR during the last 30 minutes. Reported symptoms included cough. These are not confirmed diagnoses.";
  const html = render({ sentAlerts: [{ ...alert, message }] });
  assert.match(html, /NCR · 6 symptom reports/);
  assert.match(html, /Reported symptoms included cough\. These are not confirmed diagnoses/);
  assert.ok(html.includes(`Reports from: ${new Date(alert.windowStart).toLocaleString()}`));
  assert.ok(html.includes(`Reports to: ${new Date(alert.windowEnd).toLocaleString()}`));
  assert.doesNotMatch(html, /during the last 30 minutes/);
  for (const automated of [true, false]) {
    const custom = "Please review reports from the last 30 minutes with the regional team.";
    assert.ok(render({ sentAlerts: [{ ...alert, automated, message: custom }] }).includes(custom));
  }
  assert.ok(render({ sentAlerts: [{ ...alert, automated: false, message }] }).includes(message));
});

test("settings explanation derives timing from configuration and keeps strict threshold wording", () => {
  const html = renderToStaticMarkup(React.createElement(Modal, { settings, onClose() {}, onSave() {} }));
  assert.match(html, /Count reports from the past 30 minutes/);
  assert.match(html, /Run an automatic check every 30 minutes/);
  assert.match(html, /Wait 30 minutes before another alert for the same symptom in the same region/);
  assert.match(html, /enter 5 to allow an alert at 6 or more reports/);
  assert.match(html, /not confirmed diagnoses/);
  assert.doesNotMatch(html, /waits 24 hours/);
  assert.match(html, /have not already been used for an alert/);
  assert.match(html, /at least one symptom is new or its waiting period has ended/);
  assert.match(html, /Next automatic check: No check planned yet/);
  assert.match(html, /<select/);
});

test("dashboard wiring denies unknown permissions and 403 responses, and gates actions on settings", async () => {
  const queries = [];
  const refreshed = [];
  const mutations = [];
  let captured;
  let settingsResult = { data: { item: settings } };
  let reportsResult = { data: { items: [] } };
  let pinsResult = { data: { items: [] } };
  let historyError;
  const query = (name, result) => (_arg, options) => {
    queries.push({ name, skip: options?.skip });
    return { ...result(), refetch() { refreshed.push(name); } };
  };
  const mutation = () => [(...args) => ({ unwrap: async () => { mutations.push(args); return {}; } }), { isLoading: false }];
  const Dashboard = load("DiseaseWatchFeed.jsx", {
    useGetDiseaseWatchFeedSelfReportsQuery: query("reports", () => reportsResult),
    useGetDiseaseWatchFeedMapPinsQuery: query("pins", () => pinsResult),
    useGetDiseaseWatchFeedUserAnalyticsQuery: query("analytics", () => ({})),
    useGetRegionalSymptomSummariesQuery: () => { throw new Error("Removed summary display must never subscribe or poll"); },
    useGetRegionalAlertsQuery: query("history", () => ({ data: { items: [] }, error: historyError })),
    useGetRegionalAlertSettingsQuery: query("settings", () => settingsResult),
    useSaveRegionalAlertSettingsMutation: mutation,
    useRunRegionalAlertEvaluationMutation: mutation,
    useCancelRegionalAlertMutation: mutation,
  }, { capture: (props) => { captured = props; } }).default;
  const dashboard = (user) => {
    queries.length = 0;
    const store = configureStore({ reducer: () => ({ auth: { user } }) });
    return renderToStaticMarkup(React.createElement(Provider, { store }, React.createElement(Dashboard)));
  };
  assert.match(dashboard({ user_type: "USER" }), /access is unavailable/);
  assert.ok(queries.every(({ skip }) => skip));
  const allowed = { user_type: "USER", accessible_pages: ["Disease Watch Feed"] };
  const allowedHtml = dashboard(allowed);
  assert.match(allowedHtml, /<button[^>]*>Check reports now/);
  for (const title of ["Alert Distribution", "Early Warning", "Symptom Reporting"]) assert.ok(allowedHtml.includes(title));
  assert.doesNotMatch(allowedHtml, /regional summar|Reports counted for this alert/);
  assert.match(allowedHtml, /Disease Watch Feed/);
  assert.match(allowedHtml, /Recent Alerts/);
  assert.ok(queries.every(({ skip }) => !skip));
  assert.equal(queries.length, 5);
  await captured.onRunEvaluation();
  assert.deepEqual(mutations, [[]]);
  assert.deepEqual(refreshed.sort(), ["history", "settings"]);
  reportsResult = { data: { items: [{ id: "raw", region: "NCR", symptomLabels: ["Raw cough"], possibleConditionLabel: "Source condition label", createdAt: "2026-09-11T12:00:00" }] } };
  pinsResult = { error: { status: 503 } };
  const unenriched = dashboard(allowed);
  assert.match(unenriched, /Raw cough/);
  assert.match(unenriched, /Source condition label/);
  settingsResult = { data: { item: settings }, error: { status: 503 } };
  assert.match(dashboard(allowed), /<button[^>]*disabled=""[^>]*>Check reports now/);
  settingsResult = { isLoading: true };
  assert.match(dashboard(allowed), /Loading saved alert settings/);
  assert.match(dashboard(allowed), /<button[^>]*disabled=""[^>]*>Set Up Alerts/);
  settingsResult = { data: { item: settings } };
  historyError = { status: 403 };
  const denied = dashboard(allowed);
  assert.match(denied, /access is unavailable/);
  assert.doesNotMatch(denied, /Check reports now|Set Up Alerts|Cancel alert/);
});

test("history integrates stored details throughout preparation without a temporary summary panel", () => {
  for (const status of ["Preparing", "Preparation failed", "Published", "Prepared"]) {
    const html = render({ sentAlerts: [{ ...alert, status, deliveryError: "Recipient retry needed", summaryPreview: { reportCount: 999, symptomCounts: [{ symptom: "Removed preview symptom", count: 999 }] } }] });
    assert.match(html, /Region: NCR/);
    assert.match(html, /Reports counted: 6/);
    assert.match(html, /Report period: 30 minutes/);
    assert.ok(html.includes(`Alert created: ${new Date(alert.generatedAt).toLocaleString()}`));
    assert.ok(html.includes(`Reports from: ${new Date(alert.windowStart).toLocaleString()}`));
    assert.ok(html.includes(`Reports to: ${new Date(alert.windowEnd).toLocaleString()}`));
    assert.match(html, /2 recipients/);
    assert.match(html, /Recipient retry needed/);
    assert.match(html, /<summary[^>]*>View alert details/);
    assert.doesNotMatch(html, /Reports counted for this alert|Removed preview symptom|999/);
  }
});

test("missing historical details are unavailable while recorded zero counts stay zero", () => {
  const missing = { ...alert, reportCount: null, intervalMinutes: null, generatedAt: null, windowStart: null, windowEnd: "invalid", region: "", recipientCount: null, inboxAssignmentCount: null };
  const html = render({ sentAlerts: [missing] });
  for (const label of ["Region", "Alert created", "Reports counted", "Report period", "Reports from", "Reports to"]) {
    assert.ok(html.includes(`${label}: Unavailable`));
  }
  assert.match(html, /Recipient count unavailable/);
  assert.doesNotMatch(html, /Invalid Date|NaN|undefined minutes|Reports counted: 0/);
  assert.match(render({ sentAlerts: [{ ...missing, reportCount: 0 }] }), /Reports counted: 0/);
});

test("source pagination, diagnosis notice and evaluation feedback remain in the retained features", () => {
  const reports = Array.from({ length: 7 }, (_, index) => ({ ...report, id: String(index), summary: `Page report ${index}` }));
  const html = render({ alerts: reports, evaluationFeedback: { type: "success", message: "Reports checked" } });
  assert.match(html, /Page report 4/);
  assert.doesNotMatch(html, /Page report 5/);
  assert.match(html, /aria-label="Self-report pages"/);
  assert.match(html, /1 \/ 2/);
  assert.match(html, /not confirmed diagnoses/);
  assert.match(html, /role="status"[^>]*>Reports checked/);
});

test("only future manual scheduled alerts offer cancellation, with in-flight protection", () => {
  const scheduled = { ...alert, automated: false, status: "Scheduled", scheduledAt: "2099-01-01T12:00:00" };
  const cancellable = render({ sentAlerts: [scheduled] });
  assert.match(cancellable, /<button[^>]*>Cancel alert/);
  assert.doesNotMatch(cancellable, /<button[^>]*disabled=""[^>]*>Cancel alert/);
  assert.match(render({ sentAlerts: [scheduled], cancellingId: scheduled.id }), /<button[^>]*disabled=""[^>]*>Cancelling/);
  for (const item of [{ ...scheduled, automated: true }, { ...scheduled, status: "Sent" }, { ...scheduled, status: "Cancelled" }, { ...scheduled, scheduledAt: "2000-01-01T12:00:00" }]) {
    assert.doesNotMatch(render({ sentAlerts: [item] }), />Cancel alert<|>Cancelling/);
  }
});

test("Regional Coverage and User Analytics retain their static cards and tab content", () => {
  const query = () => ({ data: { items: [] }, refetch() {} });
  const mutation = () => [() => ({ unwrap: async () => ({}) }), { isLoading: false }];
  const api = {
    useGetDiseaseWatchFeedSelfReportsQuery: query, useGetDiseaseWatchFeedMapPinsQuery: query,
    useGetDiseaseWatchFeedUserAnalyticsQuery: () => ({ data: Object.fromEntries(["totalUsers", "alertOpenRate", "symptomReports"].map((key) => [key, { current: 1, previous: 1, change: 0, percentage: 0, trend: "up" }])) }), useGetRegionalAlertsQuery: query,
    useGetRegionalAlertSettingsQuery: () => ({ data: { item: settings } }),
    useSaveRegionalAlertSettingsMutation: mutation, useRunRegionalAlertEvaluationMutation: mutation, useCancelRegionalAlertMutation: mutation,
  };
  for (const tab of ["regional-coverage", "user-analytics"]) {
    const Dashboard = load("DiseaseWatchFeed.jsx", api, { tab }).default;
    const store = configureStore({ reducer: () => ({ auth: { user: { user_type: "SUPERADMIN" } } }) });
    const html = renderToStaticMarkup(React.createElement(Provider, { store }, React.createElement(Dashboard)));
    for (const title of ["Alert Distribution", "Early Warning", "Symptom Reporting"]) assert.ok(html.includes(title));
    assert.doesNotMatch(html, /Check reports now|Set Up Alerts/);
    assert.match(html, tab === "regional-coverage" ? /No regional coverage data is available yet/ : /Total Mobile Reporters/);
  }
});
