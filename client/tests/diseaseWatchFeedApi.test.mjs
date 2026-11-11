import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { configureStore } from "@reduxjs/toolkit";
import { createApi } from "@reduxjs/toolkit/query/react";

test("dashboard reads use protected adapters and evaluation posts no settings changes", async () => {
  const requests = [];
  const baseAPI = createApi({ reducerPath: "diseaseWatchTest", baseQuery: async (request) => {
    requests.push(request);
    return { data: request.url.endsWith("alert-settings") ? { item: { enabled: true, threshold: 5, intervalMinutes: 30 } } : { items: [] } };
  }, tagTypes: ["RegionalAlerts", "RegionalSymptomSummaries"], endpoints: () => ({}) });
  const filename = fileURLToPath(new URL("../src/features/api/diseaseWatchFeedSlice.js", import.meta.url));
  const result = buildSync({ entryPoints: [filename], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", external: ["./_baseAPI"] });
  const compiled = new Module(filename);
  const require = createRequire(filename);
  compiled.filename = filename;
  compiled.require = (name) => name === "./_baseAPI" ? { baseAPI } : require(name);
  compiled._compile(result.outputFiles[0].text, filename);
  const api = compiled.exports.diseaseWatchFeedApi;
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: (getDefault) => getDefault().concat(api.middleware) });
  const subscriptions = [];
  try {
    for (const name of ["getDiseaseWatchFeedSelfReports", "getDiseaseWatchFeedMapPins", "getDiseaseWatchFeedUserAnalytics", "getRegionalAlertSettings", "getRegionalAlerts"]) {
      const subscription = store.dispatch(api.endpoints[name].initiate());
      subscriptions.push(subscription);
      await subscription;
    }
    assert.ok(requests.every(({ url }) => url.startsWith("/mobile/disease-watch-feed/")));
    const settingsReads = () => requests.filter(({ url, method }) => url.endsWith("/alert-settings") && !method).length;
    assert.equal(settingsReads(), 1);
    await store.dispatch(api.endpoints.runRegionalAlertEvaluation.initiate()).unwrap();
    await Promise.all(store.dispatch(api.util.getRunningQueriesThunk()));
    const mutation = requests.find(({ method }) => method === "POST");
    assert.deepEqual(mutation, { url: "/mobile/disease-watch-feed/alert-settings/run-evaluation", method: "POST", body: {} });
    assert.equal(settingsReads(), 2);
    assert.equal(requests.filter(({ url }) => url.endsWith("/alerts")).length, 2);
    assert.equal(requests.filter(({ url }) => url.endsWith("/regional-summaries")).length, 0);
    // Endpoint compatibility remains available to explicit consumers, without
    // this dashboard subscribing, polling or refetching it after evaluation.
    await store.dispatch(api.endpoints.getRegionalSymptomSummaries.initiate()).unwrap();
    assert.equal(requests.filter(({ url }) => url.endsWith("/regional-summaries")).length, 1);
    await store.dispatch(api.endpoints.getMobileSelfReportsExport.initiate({ format: "json" })).unwrap();
    await store.dispatch(api.endpoints.getMobileSelfReportsMapPins.initiate()).unwrap();
    assert.ok(requests.some(({ url }) => url === "/mobile/self-reports/export"));
    assert.ok(requests.some(({ url }) => url === "/mobile/self-reports/map-pins"));
  } finally {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
    store.dispatch(api.util.resetApiState());
  }
});
