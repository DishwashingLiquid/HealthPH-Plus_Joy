# Disease Watch Feed fixes and cleanup handoff

## Behavior

- Dashboard reads, settings, evaluation and applicable manual cancellations resolve the current desktop user's active role and require its existing `accessible_pages` entry `Disease Watch Feed`. SUPERADMIN retains access without a role. Authentication, activation and disabled-account checks remain in force. Missing sessions return 401; missing module access returns 403.
- Frontend access fails closed locally without an explicit page list (except SUPERADMIN). Saved settings must load successfully before configuration-dependent actions become usable. Read or mutation 403 responses disable further module actions.
- Protected JSON report and map adapters live at `/mobile/disease-watch-feed/self-reports` and `/mobile/disease-watch-feed/map-pins`. They delegate to the existing readers. User analytics retains its URL and calculations, with authorization now based on this module's page permission.
- `POST /mobile/disease-watch-feed/alert-settings/run-evaluation` accepts `{}` and uses saved configuration. An optional legacy `intervalMinutes` equal to the saved effective interval is accepted; a different supported value returns 409 before processing. Unsupported values return validation errors. Omission or null means use the saved interval, never substitute 1440. Paused automation returns 409.
- Evaluation retains the existing tick and recipient-preparation pipeline. It can update evaluation/reconciliation metadata and legitimate processing state. The request itself never saves configuration or recalculates existing cooldowns.
- Self-Reports and Alert History have independent initial loading, refreshing, empty, error and retry states. Cached data remains visible with a stale warning after failed refreshes. Settings failures disable dependent actions even when settings are cached.
- History labels distinguish preparation, failure, inbox availability and legacy queuing. Dashboard `recipientCount` counts actual recipient assignment records rather than a potentially lagging aggregate; it is null when assignment storage is unavailable. `inboxAssignmentCount` counts Prepared assignments only for automated Published/legacy Prepared alerts, matching the inbox publication/status conditions. These counts do not measure push receipt or opening. Mobile payloads and persisted statuses are unchanged.

## Limits and deferred policy

The shared `/mobile/self-reports/map-pins` reader retains its existing unauthenticated policy. The shared `/mobile/self-reports/export` reader still requires desktop authentication without a Disease Watch Feed page check. The new protected adapters secure this dashboard's requests; they do **not** make the underlying shared report data exclusive to this module. Tightening those shared contracts requires a separate consumer review.

The interval still controls the rolling reporting window, scheduled reconciliation and per-region/per-symptom cooldown. New reports can evaluate immediately while automation is enabled. Saving settings still performs its existing enabled evaluation and active-cooldown recalculation when the interval changes. No independent timing controls, threshold changes, timing defaults, event resets or cooldown migrations were introduced. Submitted symptoms are not confirmed diagnoses.

Existing recipient preparation, mobile read acknowledgements and inbox behavior remain intact. This change adds no push transport, push acknowledgements or analytics pipeline. UI tests render the actual components and API wiring with mocked query results; they do not constitute a live browser or production integration test.

## Validation

Final results: 89 backend tests passed, with 6 optional database tests skipped (95 total). The complete frontend suite passed 117 of 118 tests; the only failure is the existing 17-versus-18-region assertion described below. Changed-source ESLint and the Vite build passed. `git diff --check` passed.

Backend tests run as separate Python processes because existing tests install module-level database/framework stubs. Database-dependent tests use mocked/mongomock storage; no application startup, live database, migration or production writes are needed. Test dependencies were installed under ignored `.hub-build-check/disease-watch-python`; environment files and dependency manifests were not changed.

Run with `PYTHONPATH` pointing to that isolated dependency directory:

```powershell
$env:PYTHONPATH = (Join-Path (Get-Location) '.hub-build-check/disease-watch-python')
$tests = @(
  'test_disease_watch_dashboard_access.py', 'test_disease_watch_alert_processing.py',
  'test_regional_alert_collection_guards.py', 'test_regional_alert_eligibility.py',
  'test_regional_summaries.py', 'test_mobile_alert_inbox.py',
  'test_disease_watch_storage.py', 'test_mobile_registration_and_analytics.py',
  'test_mobile_user_auth_contract.py', 'test_dashboard_regions.py',
  'test_health_literacy_analytics.py', 'test_sentiment_pulse_summary.py'
)
foreach ($test in $tests) { & .\.venv\Scripts\python.exe (Join-Path 'server/tests' $test) }
```

The dashboard-access test verifies anonymous submission still creates its source report, self-report analytics entry and regional summary event, while shared readers and mobile authentication retain their contracts. Existing mobile test fixtures were updated with an in-memory report-ID counter required by the current ingestion implementation.

From `client`, run `node --test tests/*.test.mjs`, `npm run build`, and ESLint on the changed source files. Full-project lint also ran: its existing 832 errors and 17 warnings are outside the changed source files. The pre-existing `dashboardRegions.test.mjs` expectation of 17 regions fails against the unchanged 18-region data. Build completes with existing CSS syntax, Browserslist and chunk-size warnings. Optional real-MongoDB region/Sentiment Pulse checks remain skipped.

## Safe subsequent cleanup

No feature removal was performed. The next cleanup may remove the duplicate disabled evaluation interval `<select>`, its label and option rendering from `RecentAlertsTab.jsx`, and update the test that specifically checks that display. Preserve a clear saved-configuration indication if the next design needs one; evaluation must continue sending `{}`. Do not remove the interval setting from Set Up Alerts or change its saved values as part of removing the duplicate control.

`normalizeAlertAutomationInterval` currently has no runtime consumers, only its compatibility tests. It can be removed together with those now-unused tests after rechecking repository references. Shared report hooks remain exported for compatibility; remove them only after reviewing external consumers.

Keep the protected adapters, role guards, source ingestion and analytics-entry creation, summary aggregation/eligibility, kind-scoped stores, batch IDs, consumed-event markers, cooldown reservations, unique indexes, conditional claims, recovery, recipient preparation, mobile inbox and scheduler. Several logical stores share `disease_watch_internal`; never drop or restructure that collection as UI cleanup.

## Changed files

Client source:

- `client/src/features/api/diseaseWatchFeedSlice.js`
- `client/src/pages/admin/diseaseWatchFeed/DiseaseWatchFeed.jsx`
- `client/src/pages/admin/diseaseWatchFeed/RecentAlertsTab.jsx`
- `client/src/pages/admin/diseaseWatchFeed/RegionalSummaryList.jsx`
- `client/src/pages/admin/diseaseWatchFeed/SendAlertModal.jsx`
- `client/src/pages/admin/diseaseWatchFeed/alertAutomation.js`
- `client/src/pages/admin/diseaseWatchFeed/alertHistory.js` (new)

Server source:

- `server/controllers/regionalAlertsController.py`
- `server/controllers/diseaseWatchFeedDashboardController.py` (new)
- `server/routes/diseaseWatchFeedRoutes.py`

Tests:

- `client/tests/alertAutomation.test.mjs`
- `client/tests/regionalSummaries.test.mjs`
- `client/tests/diseaseWatchFeedUi.test.mjs` (new)
- `client/tests/diseaseWatchFeedApi.test.mjs` (new)
- `server/tests/test_disease_watch_alert_processing.py`
- `server/tests/test_disease_watch_dashboard_access.py` (new)
- `server/tests/test_regional_alert_collection_guards.py`
- `server/tests/test_mobile_registration_and_analytics.py`

Handoff: `docs/disease-watch-feed-fixes-handoff.md` (new).
