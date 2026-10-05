Implement the dashboard and backend portions of automated regional alerts in this HealthPH-Plus repository. Inspect the current code, make the necessary local changes, and run relevant validation. Do not stop at another proposal.

## Scope and constraints

- Repurpose the existing Send Alert feature. Reuse the project's existing dependencies, components, services, storage, and scheduler wherever appropriate.
- Add no npm packages, Python packages, Flutter packages, or other third-party libraries. Do not change dependency manifests or lockfiles. Existing dependencies and language standard libraries are allowed.
- Implement dashboard settings, regional summary evaluation, durable automatic alert generation, recipient record preparation, and dashboard history.
- Mobile-facing inbox API endpoints, mobile response schemas, Flutter code, mobile polling/badge/read behavior, and their separate handoff document are outside this task. Do not implement them or pull their requirements into this task.
- Closed-app push, device registration, Firebase/APNs, external notification services, and notification SDKs are deferred.
- Preserve existing self-reports, historical alerts, unrelated features, and user changes. Do not deploy, send external notifications, or run destructive/live database repairs as part of this task.
- Read applicable AGENTS.md instructions and inspect git status first. Resolve ordinary implementation choices from this specification and repository conventions. Ask only for a material unresolved product decision or an actual blocker.

## Repository starting points

Inspect these files and their callers; verify current behavior rather than relying only on comments:

- `server/regional_summaries.py`
- `server/controllers/regionalAlertsController.py`
- `server/controllers/diseaseWatchFeedController.py`
- `server/routes/diseaseWatchFeedRoutes.py`
- `server/config/database.py`
- `server/api.py`
- `server/region_normalization.py`
- `server/scripts/reconcile_regional_summaries.py` and related repair instructions
- `client/src/pages/admin/diseaseWatchFeed/SendAlertModal.jsx`
- `client/src/pages/admin/diseaseWatchFeed/DiseaseWatchFeed.jsx`
- `client/src/pages/admin/diseaseWatchFeed/RecentAlertsTab.jsx`
- `client/src/pages/admin/diseaseWatchFeed/RegionalSummaryList.jsx`
- `client/src/features/api/diseaseWatchFeedSlice.js`
- Existing regional summary, alert, and mobile self-report regression tests.

Known starting behavior to verify: regional summaries are cumulative; their five-report minimum controls visibility. The existing scheduler checks every 30 seconds. Alert processing creates per-user records and currently labels them Sent without proving device delivery. Summary reconciliation can recreate summaries from historical events.

## Required product behavior

### Settings

Rename Send Alert to Alert Settings and reuse its modal styling. Replace manual description, region, alert text, and scheduled datetime inputs with:

- Automation enabled/paused.
- A positive integer threshold, default `5`.
- One interval selector: `15`, `30`, `60`, `480`, `720`, or `1440` minutes. Display 15 minutes, 30 minutes, 1 hour, 8 hours, 12 hours, and 24 hours. Default to 24 hours.
- Last successful evaluation, next scheduled reconciliation, and useful operational status.

Persist settings in the existing application settings collection and validate on the backend. Use authenticated dashboard endpoints and the existing regional-alert access policy; do not introduce an unrelated role-policy redesign. Start a new installation paused until enabled through these settings; do not rewrite an existing saved choice on startup. Enabling evaluates currently eligible unconsumed reports. Pausing stops new automatic alert generation but preserves histories and cooldowns.

### Threshold and reporting window

- The trigger is the SAVED REGIONAL SUMMARY'S TOTAL REPORT COUNT. It is not a per-symptom threshold and not a count of unique people.
- Use strict `reportCount > threshold`. With the default threshold, five reports do not trigger; six do.
- Count distinct eligible report records once toward the regional total and each symptom once within an individual report.
- Include source `mobile_self_report` with status `submitted`, `for_review`, or `verified`. Exclude rejected reports and invalid/unresolved regions. Handle legacy missing statuses consistently with the repository's submitted-status default and document that choice.
- The selected interval controls BOTH the rolling reporting window and scheduled reconciliation frequency. At evaluation time, count only unconsumed reports within that rolling window.
- Use the existing report submission timestamp with explicit timezone normalization. Exclude future and unparseable dates from triggering and make invalid data observable. Preserve original stored source values; do not reinterpret naive Philippine timestamps as UTC.
- Use the same eligibility/counting logic for saved summaries, evaluation, and reconciliation. Preserve literal symptom labels for display. Prefer existing stable symptom IDs for cooldown identity, with deterministic legacy fallback; do not add disease inference or new synonym-merging behavior.
- The active summary becomes visible at five reports, preserving the existing visibility rule independently of the configurable alert threshold. A batch blocked by cooldown stays visible with an explanatory status.

### Immediate evaluation and scheduled recovery

- Evaluate the affected region whenever its summary is successfully saved, including relevant report/status changes supported by the existing system. The sixth qualifying report must not wait for the selected interval.
- Generate and durably store the alert during that event-driven flow. Do not hold the report request open for recipient fan-out or any external transport. If processing fails after accepting the source report, preserve the report and leave recoverable work; do not encourage duplicate submission through a misleading failure response.
- Extend the existing backend scheduler for reconciliation, pending processing recovery, and cooldown deadlines. Do not run automation in a browser timer or add a scheduler package.
- Persist deadlines and processing state. A short scheduler wake-up interval is distinct from the selected reconciliation interval. Recheck a pending batch near its cooldown expiry without waiting another full reporting interval.
- On restart, resume durable work and evaluate current eligibility. Do not generate a backlog of alerts from reporting windows that have expired.
- Avoid blocking the async API event loop with large synchronous database scans. Use existing capabilities and bounded/indexed queries; avoid repeated index creation during ordinary ticks.

### Fresh batches and removal from summaries

- Each region has an active batch. After generating an eligible alert, save an immutable snapshot and durably record the alert before completing that exact batch and removing it from the active summary display.
- Subsequent reports belong to a fresh batch. Preserve all raw reports, summary source events, and historical alerts.
- Persist batch membership/consumption explicitly. Do not just delete a summary document: old events must not reconstruct it. Do not rely on a timestamp-only cutoff that could lose simultaneous or late-arriving reports.
- A transaction or recoverable state machine must couple alert creation, batch completion, and cooldown reservation. A crash must not clear a region without an alert, duplicate the alert, or consume reports arriving after the evaluated snapshot.
- Reconciliation and repair code must honor consumed batches. Update affected scripts/tests/docs so legacy reconciliation cannot resurrect completed batches. Do not execute destructive repairs against a live database.
- Settings changes recalculate only current unconsumed reports and future deadlines. Never resurrect consumed reports or reset cooldowns.

### Cooldown

- Enforce a rolling 24-hour cooldown per `(region, symptomKey)`, independent of selected interval and batch resets.
- When the regional total exceeds the threshold, include only symptoms whose cooldown has expired. One regional alert may include multiple eligible symptoms. Individual included symptom counts do not have to exceed five.
- If every symptom is cooling down, retain the pending active batch and expose its next eligible time. If at least one symptom is eligible, generate one alert for the eligible symptoms and complete the evaluated batch.
- Preserve the full summary snapshot and suppressed symptom keys internally for audit. Suppressed symptoms do not appear in the generated user-facing message and do not receive a renewed cooldown.
- Reserve cooldowns when the alert is durably generated. Retrying that same alert or its recipient preparation must not create another cooldown reservation or alert. Pending batches whose counts drop below threshold after report expiration must not generate an alert solely because a cooldown expired.

### Alert content, records, and history

- Use deterministic templates, not an AI service. Generate the title/description, region, and text from the qualifying saved summary.
- Example with default threshold: "6 self-reports were recorded in NCR during the last 30 minutes. Reported symptoms included fever and cough. These are not confirmed diagnoses."
- Keep counts factual: report count is not a confirmed case count or a unique-person count. Include only aggregate content, not reporter identities, notes, or contact information.
- Reuse `regional_alerts` for immutable alert content and trigger metadata: automatic source, batch reference, region, total report count, threshold/comparison, reporting interval and bounds, full count snapshot, included/suppressed symptom keys, creation time, and processing status.
- Reuse `mobile_notification_deliveries` for durable per-user recipient records. Select registered mobile user accounts using the existing normalized regional targeting. No device token is required. Keep the unique alert/user constraint and retry partial recipient preparation idempotently.
- Store separate operational batch/cooldown state where appropriate; a narrowly scoped MongoDB collection is allowed and is not a new dependency. Do not place unbounded operational history in the settings singleton.
- Keep Sent Alerts below Self-Reports. Preserve old entries and add an Automated badge, region, generated message, triggering count, interval, generation time, preparation status, and prepared recipient count.
- Since mobile inbox endpoints are outside this task, use honest labels such as Preparing, Prepared, or Preparation failed. Do not claim Available in app, delivered, read, or "Sent to N users" for these new records before the corresponding integration exists. Do not retroactively fabricate delivery evidence for legacy records.
- Reuse existing RTK Query polling/refetch patterns to refresh summary and history while visible, approximately every 30 seconds. This display refresh is independent of reporting-window settings. Do not trigger alert generation from dashboard GETs or render effects.

## Cleanup and compatibility

- Remove obsolete manual composition state, handlers, validation, imports, mutations, and routes only after checking callers.
- Extract reusable alert creation/serialization logic rather than passing fake dashboard users or future schedule dates into the old manual endpoint.
- Preserve handling for historical statuses and cancellation of any existing future manual alerts while still needed. Keep new automatic records out of legacy push/scheduled-send paths that would mislabel them Sent.
- Preserve existing regional normalization and unrelated summary/reporting consumers. Update affected UI copy and intentionally changed tests rather than weakening assertions.
- Make initialization/migration idempotent, documented, and non-destructive. Clearly document any operator action required; keep automation paused until explicitly enabled.

## Validation and completion

Use existing Python unittest, Node test, and repository build/lint tooling; install nothing. Add meaningful tests for the new stateful behavior using isolated fixtures, without production database access or external delivery. Cover:

1. Strict boundary: five reports do not trigger, six do; regional total versus individual symptom counts.
2. Every allowed interval, exact reporting-window boundaries, expired/future reports, eligibility statuses, invalid regions, and repeated symptoms within one report.
3. Immediate evaluation after a saved summary and scheduled recovery if processing fails.
4. Fresh-batch behavior; concurrent reports survive completion; reconciliation cannot revive consumed reports.
5. Same-region/same-symptom cooldown, independent regions/symptoms, mixed eligible/suppressed symptoms, and expiry at exactly 24 hours.
6. All-suppressed batches remain pending; expired pending reports cannot produce stale alerts.
7. Concurrent workers, duplicate processing, failure between state transitions, restart recovery, and partial recipient preparation retries.
8. Invalid settings, authenticated settings access, persistence, pause/resume, interval changes, and cooldown preservation.
9. Settings UI, history position/status/count labels, visible polling, legacy alert compatibility, and relevant existing summary/report regressions.
10. No dependency/lockfile changes and no mobile-facing inbox endpoints or Flutter implementation introduced.

First explain the intended implementation briefly, then complete it. Run focused tests and relevant build/lint checks; distinguish new failures from unrelated pre-existing failures. Finish with changed files, implemented behavior, validation results, and any remaining integration or operational limits. Do not claim end-to-end mobile delivery: this task ends at durable backend preparation and dashboard visibility.
