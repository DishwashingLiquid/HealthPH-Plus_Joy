# Recent Alerts cleanup

This follows the [issue-fix handoff](disease-watch-feed-fixes-handoff.md). Its uncommitted permission, evaluation, reliability and status fixes were inspected and preserved. The prior handoff remains a historical record; its summary UI and duplicate selector descriptions are superseded here. No applicable AGENTS.md was found. Before removal, all 8 HTTP access tests and 16 existing processing tests passed.

## Boundary and dependency decisions

| Candidate | Classification | Result |
| --- | --- | --- |
| Regional summary cards and expandable symptom counts | Removable presentation | Removed RegionalSummaryList and its component-only tests after repository-wide reference checks. |
| Summary subscription, polling, props, error/empty/loading UI and explicit refreshes | Removable presentation | Removed from DiseaseWatchFeed/RecentAlertsTab; no summary request is made by the dashboard. |
| Duplicate evaluation interval selector | Removable presentation | Replaced with concise read-only saved reporting-window text. Editing remains in Set Up Alerts. |
| Temporary Reports counted for this alert panel | Removable presentation | Removed its frontend component and consumption. The existing backend summaryPreview compatibility field remains. |
| Three static explanatory cards | Removable presentation on Recent Alerts only | Hidden there, with the same cards/icons retained on Regional Coverage and User Analytics. |
| Source reports, pagination, enrichment/fallbacks, diagnosis notice | Supporting retained behavior | Preserved in Self-Reports. |
| Validation, enabled/paused and in-flight checks, results, retries and failures | Supporting retained behavior | Preserved with Set Up Alerts, Check reports now and Alert History. |
| Historical count/window/generated time, region, status, assignments and errors | Supporting retained behavior | Integrated directly into history entries across preparation states. |
| Applicable manual cancellation | Supporting retained behavior | Preserved inside history; backend conditions and legacy scheduler remain intact. |
| Regional summaries API and client API endpoint/export | Backend/consumer dependency | Retained; absence of a dashboard subscription is not proof of no external consumers. |
| Aggregation, projection, eligibility, event consumption, cooldowns, batches, reconciliation and recovery | Backend dependency | Retained; these still generate and recover alerts and support mobile reporting/inbox behavior. |
| trigger.summarySnapshot, kind-scoped stores, unique indexes, claims, recipient preparation and scheduler | Backend dependency | Retained; these preserve mobile symptom details, duplicate prevention and reliable processing. |

The unused normalizeAlertAutomationInterval export and fallback-default tests were removed after reference checks found no runtime consumers. The supported interval list, saved values and timing policies are unchanged.

## Historical details

The Disease Watch Feed dashboard serializer adds read-only windowStart/windowEnd fields from stored trigger values (falling back to stored summarySnapshot dates for legacy history). They remain available after preparation completes. Nothing derives historical dates from current settings, edits stored triggers, or changes mobile serialization. Missing historical reportCount is now null rather than an invented zero; a recorded zero remains zero. Missing/invalid dates and unknown intervals display Unavailable.

The role guard, SUPERADMIN exception, activation/disabled checks, protected report adapters and saved-settings evaluation contract are unchanged. Evaluation still POSTs an empty object and refreshes settings/history, without a summary subscription or refresh. The summaries API still enforces module permission.

## Verification

- Focused frontend: 22 tests passed. Coverage includes the four retained features, no summary subscription/refetch, saved-settings POST, source cards without map enrichment, independent failures, cached refreshes, pagination, feedback, historical detail continuity, unknown versus zero values, cancellation, and cards/content on the other subtabs.
- Backend: 92 tests passed, 6 optional real-database tests skipped (98 total across 12 files). Includes HTTP authorization, saved-settings evaluation, strict thresholds, duplicate prevention/recovery, aggregation/eligibility, storage adapters, legacy cancellation, shared ingestion/analytics creation, mobile inbox/auth, dashboard region contracts, Health Literacy analytics and Sentiment Pulse summary contracts.
- Full frontend: 117 passed, 1 existing failure in dashboardRegions.test.mjs, which expects 17 regions while unchanged shared data has 18.
- Changed-source ESLint, Vite build and git diff --check passed. Build retains existing Browserslist, CSS syntax and bundle-size warnings. The prior task documented full-project lint failures outside the changed source; this cleanup did not repair those unrelated issues.
- Tests use mocked/in-memory storage. No live inventory, production queries/writes, data migration, deployment, environment-file edits, new services or dependency-manifest changes were performed. UI verification uses rendered React components and mocked API wiring, not a live browser session.

Reproduce focused checks:

```powershell
# From repository root; uses the prior task's isolated test dependencies.
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

# From client:
node --test tests/alertAutomation.test.mjs tests/diseaseWatchFeedUi.test.mjs tests/diseaseWatchFeedApi.test.mjs tests/recentAlerts.test.mjs
node --test tests/*.test.mjs
npm run build
```

## Files changed by this cleanup

- client/src/pages/admin/diseaseWatchFeed/DiseaseWatchFeed.jsx
- client/src/pages/admin/diseaseWatchFeed/RecentAlertsTab.jsx
- client/src/pages/admin/diseaseWatchFeed/RegionalSummaryList.jsx (deleted)
- client/src/pages/admin/diseaseWatchFeed/SendAlertModal.jsx
- client/src/pages/admin/diseaseWatchFeed/alertAutomation.js
- client/tests/alertAutomation.test.mjs
- client/tests/regionalSummaries.test.mjs (deleted; summary-only UI coverage)
- client/tests/diseaseWatchFeedUi.test.mjs
- client/tests/diseaseWatchFeedApi.test.mjs
- server/controllers/regionalAlertsController.py (dashboard history serialization only)
- server/tests/test_disease_watch_alert_processing.py
- docs/disease-watch-feed-cleanup-handoff.md (new)

Other pre-existing changes, including the API slice, routes, mobile test fixture, strict role checks and prior handoff, remain intact. The cleanup baseline and prior tracked patch were saved under ignored .hub-build-check/disease-watch-cleanup-baseline for review.

## Separate decisions

Retiring the summaries API, compatibility preview field or legacy scheduled processing needs a separate consumer/inventory audit. No live scheduled-record inventory was attempted. Shared map/export API access policies retain the limitations described in the issue-fix handoff. Independent reporting/evaluation/cooldown timing policies, push delivery telemetry and unrelated lint/region-test repairs remain outside this cleanup.
