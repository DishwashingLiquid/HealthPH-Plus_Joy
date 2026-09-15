# MongoDB dashboard consolidation audit

Date: September 15, 2026. Scope: Disease Watch Feed, Health Literacy Hub, Sentiment Pulse Tool, their backend dependencies, and the configured MongoDB database.

## Conclusion

**Disease Watch Feed has four internal collections that are candidates for consolidation into one dashboard-owned collection.** This would remove three collection namespaces while initially preserving all 70 records. It requires changes to queries, indexes, scripts, and the alert scheduler; changing collection aliases alone would break isolation between record types.

**No production merge or deletion is yet established as safe across the whole system.** The user identified the mobile application and a senior developer's work on AI Surveillance, NLP Insights, Misinformation Tracker, User Management, and Model Access Toolkit as additional consumers. Their deployed or independently maintained code has not been inspected. Local implementations of those dashboards were checked for shared dependencies. The recommendations below describe what this working tree supports and the conditions needed before applying them.

The user also requested assessment of record reduction. The best current candidates are 15 expired cooldown records and 26 unconsumed summary events whose source reports are absent. These are conditional cleanup candidates, not a deletion list. Eleven consumed summary events must retain their protection against processing the same report again.

Health Literacy content already shares one collection. Its analytics events supply mobile-visible counts and cannot simply be discarded. Sentiment Pulse already embeds survey questions and creation metadata, and its survey sequence lives in shared settings. Neither dashboard has an obvious additional low-risk collection merge under the requested backend-only, same-dashboard rule.

## Evidence and limits

- Inspected the current working tree, including existing uncommitted Sentiment Pulse changes. Existing application files were not modified.
- Traced React dashboards and API slices through FastAPI routes, controllers, helpers, serializers, startup jobs, reconciliation scripts, and existing regression tests.
- Inspected mobile integration documentation. No Flutter application source exists in this repository. A mobile API response is treated as mobile-facing even when the actual widget cannot be inspected.
- Ran a read-only inventory of collection names, document counts, indexes, storage metadata, and aggregate lifecycle checks. No API startup, scheduler, application migration helper, collection creation, index creation, or database mutation was invoked.
- The configured database contained 21 collections. The audit inspected 16 relevant or potentially related names; 15 existed and `health_literacy_feedback` did not.
- Measurements began at 10:37:24 Philippine time; lifecycle checks ran at 10:37:37. They are sequential observations, not a consistent transaction snapshot. Recheck before any migration or cleanup, especially because other services may write concurrently.
- Saved evidence: [DASHBOARD_MONGODB_INVENTORY.json](DASHBOARD_MONGODB_INVENTORY.json). Reusable read-only tool: [inspect_dashboard_collections.py](server/scripts/inspect_dashboard_collections.py).

## Collection classification

“Internal” means no direct mobile UI read was found in this repository. Internal state can still affect whether an alert or another mobile-facing record is created correctly.

### Disease Watch Feed

| Collection | Observed records | Purpose and dependencies | Assessment |
| --- | ---: | --- | --- |
| `self_reports` | 0 | Canonical mobile submissions; POST response, personal report history, map/export, reporter analytics, summary projection, NLP entry creation. | Keep as a source collection. Empty does not mean unused. |
| `mobile_users` | 5 | Mobile registration/login and authenticated account identity; report ownership, regional analytics, survey joins, recipient targeting. | Keep shared identity storage. |
| `regional_symptom_summaries` | 17 | Derived regional totals shown on the admin dashboard; revision-controlled updates and automation input. All 17 had zero report counts at observation. | Consolidation candidate: `kind: regional_summary`. |
| `regional_summary_events` | 37 | Per-report projection, rolling-window calculation, and durable consumed-batch markers. | Consolidation candidate: `kind: summary_event`; preserve event identity and consumption state. |
| `regional_alert_batch_states` | 1 | Processing claims, restart recovery, cooldown wake-ups, admin automation status. No batch was `Processing` at observation. | Consolidation candidate: `kind: alert_batch_state`. |
| `regional_alert_cooldowns` | 15 | Per-region/symptom suppression reservations. All 15 had expired at observation. | Consolidation candidate: `kind: alert_cooldown`; conditional record cleanup. |
| `regional_alerts` | 1 | Saved alert message, trigger snapshot, admin history, recipient-preparation lifecycle. | Retain for now. No implemented mobile inbox reader here, but external services may consume it. |
| `mobile_notification_deliveries` | 0 | One assignment per alert/mobile user; preparation retries and recipient counts. | Retain for now. Integration boundary and external consumption need checking. |
| `application_settings` | 4 total, shared | Alert settings, repair markers, and Sentiment Pulse ID allocation. | Keep shared collection; do not move unrelated dashboard settings into Disease Watch storage. |
| `analytics_entries` | 0, shared | NLP processing entries from report notes, survey answers, and imported datasets. | Already shared by source type; do not absorb it into one dashboard. |

Key evidence:

- [Disease Watch API slice](client/src/features/api/diseaseWatchFeedSlice.js) and [routes](server/routes/diseaseWatchFeedRoutes.py): paths beginning `/mobile/disease-watch-feed/` are used by the admin dashboard; a `/mobile` prefix alone does not establish a mobile UI consumer.
- [Regional alert controller](server/controllers/regionalAlertsController.py): `ensure_regional_alert_indexes`, `fetch_regional_summaries`, `_claim_and_finish`, `_finish_processing`, `_prepare_automatic_recipients`, and `run_automation_tick` define the storage dependencies.
- [Summary store](server/regional_summaries.py): `summarize`, `build_plan`, `update_report`, and `reconcile` retain consumed events and manage source-derived records.
- [API startup](server/api.py) runs alert preparation/reconciliation every 30 seconds; migration coordination must cover every scheduler instance.
- [Mobile alert handoff](MOBILE_ALERTS_API_FLUTTER_HANDOFF.md) explicitly labels mobile inbox endpoints as proposed. This is evidence about this repository, not proof that another service has not implemented them.

### Health Literacy Hub

| Collection/dependency | Observed records | Purpose and dependencies | Assessment |
| --- | ---: | --- | --- |
| `content` | 3 | Articles, videos, and infographics distinguished by `contentType`; publication flags, media metadata, authorship and creation fields already coexist. Mobile and website readers consume it. | Already consolidated; preserve public content and IDs. |
| `analytics_events` | 0 | Content opened/shared/downloaded events, searches and report-export activity; admin analytics and public content counters. | Keep. Backend ingestion produces mobile-facing results. |
| `health_literacy_feedback` | Absent | Collection handle declared in database configuration; no current production reader/writer found in this repository. | Unused declaration candidate. Removing the alias would not remove a live collection or save records in this database. |
| `users` | Not inventoried | Shared admin authentication, author snapshots, user/region analytics. | Keep shared identity dependency. |
| JSON files and media files | Not MongoDB collections | Seed/mirror content and stored media under `server/public/health-literacy-hub`. | Do not count articles/videos/infographics JSON files as separate collections. |

Key evidence:

- [Public metrics](server/controllers/health_literacy_hub/public_metrics.py) counts raw `analytics_events` for views, shares and downloads. [Serialization](server/controllers/health_literacy_hub/serialization.py) returns these counts in mobile/public content responses.
- [Analytics](server/controllers/health_literacy_hub/analytics.py) uses event filters, counts and distinct visitor identities. Simple daily totals do not preserve exact unique visitors across overlapping date ranges.
- [Content bridge](server/controllers/health_literacy_hub/content_bridge.py) uses a unique `(contentType, id)` index and already handles legacy content-type normalization. It seeds from JSON and writes a JSON mirror. A database-only deletion can be undone by later seed import if the same content remains in JSON.
- No stored content record currently has `media.dataUrl`; moving embedded base64 media out of MongoDB offers no current savings in the inspected collection.

### Sentiment Pulse Tool

| Collection/dependency | Observed records | Purpose and dependencies | Assessment |
| --- | ---: | --- | --- |
| `surveys` | 0 | Survey definitions, embedded questions, publication/scheduling settings, creator metadata, question sequence and response count. Public/mobile survey list consumes these records. | Already combines creation features; keep. Draft status does not make the collection backend-only because drafts can be published. |
| `survey_responses` | 0 | Submitted answers and respondent metadata; admin results, summary joins, regional/date analysis, and NLP entry generation. Submission endpoint returns an acknowledgment rather than the response document. | Backend-held source records, but no suitable separate dashboard-owned internal collection to combine with under the requested rule. Keep full answers for existing features. |
| `application_settings` | 4 total, shared | Atomically reserves survey IDs. The observed next survey sequence is 7 although the survey collection is empty. | Preserve sequence state; do not reset to 1 or derive solely from current surveys. |
| `analytics_entries` | 0, shared | Per-answer NLP entries, shared with self-reports and dataset imports. | Preserve shared processing contract. |
| `mobile_users` | 5, shared | Authenticated response association and regional identity joins. | Keep shared identity storage. |
| `analytics_events` | 0 | Imported by Sentiment Pulse constants, but no active Sentiment Pulse reader/writer found. | Unused import is not evidence that the collection can be removed; Health Literacy uses it. |
| `id_counters` | 9 | Live sequence documents; no source-code references found in this repository. | Ownership unresolved. Other services may actively allocate IDs here. Do not classify as obsolete based on this repository alone. |

Key evidence:

- [Survey helpers](server/controllers/sentiment_pulse/survey_helpers.py) embeds question allocation in each survey and uses `application_settings` for atomic survey allocation. Public serialization removes internal sequence fields while retaining published content and derived response totals.
- [Survey controller](server/controllers/sentimentPulseController.py) writes answers, creates NLP entries, updates response counts, and publishes surveys to mobile/website clients.
- [Dashboard summary](server/controllers/sentiment_pulse/dashboard_summary.py) joins `survey_responses`; [regional analysis](server/controllers/sentiment_pulse/regional_analysis.py) joins `mobile_users` and processes dated response records.
- [Sentiment Trends](client/src/pages/admin/sentimentPulseTool/SentimentTrends.jsx) currently imports static `sentimentMockData`; its charts do not have a separate MongoDB collection to condense. Mobile Surveys and Regional Analysis do use backend data.
- [Analytics entry helpers](server/helpers/analyticsEntryHelpers.py), [entry controller](server/controllers/analyticsEntryController.py), and [dataset controller](server/controllers/datasetsController.py) establish the cross-dashboard NLP dependency. Source text and processing state are not interchangeable with click/download events.

## Recommended consolidation design

### Shared dependencies confirmed in the additional dashboards

| Dashboard identified by the user | Dependency found in this working tree | Consequence |
| --- | --- | --- |
| [AI Surveillance](client/src/pages/admin/AISurveillance.jsx) | Fetches completed `analytics_entries` and map `points`; backend access also depends on `datasets` and `users`. | Report/survey NLP entries are already used outside the three target dashboards. |
| [NLP Insights](client/src/pages/admin/NLPInsights.jsx) | Dataset listing plus frequent-word/word-cloud APIs; controllers use `datasets` and `users`. | Keep shared dataset and identity contracts. |
| [Misinformation Tracker](client/src/pages/admin/MisinformationTracker.jsx) | Current component contains static chart/summary data and no API hook. | This local component cannot establish what the senior developer's newer implementation reads. |
| [User Management](client/src/pages/admin/UserManagement.jsx) | User, organization, role-label and account-activity APIs; `users`, `organizations`, `role_labels`, `activity_logs`. | These are shared administration collections, not backend-only storage owned by one target dashboard. |
| [Model Access Toolkit](client/src/pages/admin/ModelAccessToolkit.jsx) | Reads/processes `analytics_entries`, manages datasets, and writes account activity. | Keep shared NLP processing entries and their source references. |
| Mobile application | Backend contracts for content, surveys, self-reports and mobile accounts are present; application code and any separate direct database access are absent. | Verify its actual collection access before changing physical collection names or retaining fewer records. |

The six live collections outside the detailed inventory were `activity_logs`, `datasets`, `organizations`, `points`, `role_labels`, and `users`. Their code dependencies were traced; their record payloads were not inspected.

### Disease Watch internal storage

After mapping external consumers, combine only these four collections into a proposed `disease_watch_internal` collection:

| Current collection | Required discriminator |
| --- | --- |
| `regional_symptom_summaries` | `kind: regional_summary` |
| `regional_summary_events` | `kind: summary_event` |
| `regional_alert_batch_states` | `kind: alert_batch_state` |
| `regional_alert_cooldowns` | `kind: alert_cooldown` |

Keep each event, state, summary and cooldown as its own document. This is four collections becoming one, not 70 records becoming one giant record. Growing event/recipient arrays would introduce document-size and update costs; MongoDB documents this in [Avoid Unbounded Arrays](https://www.mongodb.com/docs/manual/data-modeling/design-antipatterns/unbounded-arrays/).

Implementation requirements:

1. Scope every read, update, upsert, deletion, count and aggregation by `kind`. Existing calls such as `find({})`, `find({region: ...})`, and repair scans would otherwise mix unrelated documents. Insert and replacement paths must also retain the discriminator.
2. Preserve `_id` values where possible and check cross-collection collisions before copying. Batch-state `_id` currently doubles as the region code. Event IDs appear in snapshots and consumed-batch processing; any changed ID requires a complete reference mapping.
3. Preserve independent uniqueness rules with type-specific partial indexes: one regional summary per region, one event per `(region, reportId)`, and one cooldown per `(region, symptomKey)`. Preserve one batch state per region. A global unique `region` index would reject legitimate event/cooldown documents. MongoDB supports uniqueness restricted by a partial filter; queries must include the filter to use the index: [Partial Indexes](https://www.mongodb.com/docs/manual/core/index-partial/).
4. Keep separate query indexes for active events and due batch states. A smaller collection count does not eliminate the queries or their index requirements.
5. Preserve revision checks, atomic processing claims, `consumedBatchId`, cooldown deadlines, and retry behavior. Do not reset these when enabling automation or restarting workers.
6. Update `server/config/database.py`, `regional_summaries.py`, `regionalAlertsController.py`, both inventory/repair scripts, and affected regression fixtures. `reconcile_regional_summaries.py` and `inspect_summary_regions.py` directly address the current physical collections.
7. Coordinate source writers, schedulers, repair jobs, and the external services during cutover. Validate the copied data before switching readers; retain recoverable source data until the migration is accepted.

Potential result: three fewer collections after source retirement. The four source collections currently hold **19,289 logical data bytes** and **479,232 bytes of allocated collection plus index storage**. Those allocated bytes are not a savings estimate: the destination still needs documents and indexes, and temporary migration copies increase storage. Across all 15 existing inspected collections, logical document data totals only **33,990 bytes**. The present benefit is chiefly simpler organization, not a substantial data-volume reduction.

## Record and field reduction assessment

| Candidate | Observed evidence | Safe reduction conditions |
| --- | --- | --- |
| Expired cooldown records | 15/15 expired; no processing batch observed. | Best bounded cleanup candidate after external-use review. Recheck expiry at deletion, coordinate with processing/retry writers, and preserve any required operational history. Removing an expired reservation must not delete a concurrently renewed cooldown. |
| Unconsumed orphan summary events | 26 unconsumed; all 37 total events had no matching `self_reports` record. | Investigate source disappearance and concurrent/external writers first. If source removal is confirmed intentional and events are not reserved/referenced by an in-flight batch, remove obsolete unconsumed projections and reconcile summaries. The existing repair planner can remove unconsumed events missing from eligible sources, but has broader effects and must be dry-run/reviewed separately. |
| Consumed summary-event payloads | 11 consumed; 11 total events older than the maximum 24-hour reporting window. The checks do not establish that these two sets are identical. | Preserve a minimal permanent consumption marker containing identity, region, source report ID and consumed-batch metadata. Bulky symptom payloads could later be removed after verifying references, repair behavior, and historical requirements. This reduces bytes, not necessarily document count. |
| Zero regional summaries | 17 summaries, all zero. | Leave them. The set is small and bounded; refresh/automation may recreate them, and removing rows changes admin state representation. |
| Completed repair audit payload | One settings document is 4,571 bytes and includes `validation`. | Optional field-level reduction: retain its completion marker/version and archive detailed validation if no external reader needs it. Very small current benefit. Avoid appending unbounded audit history to a settings singleton. |
| Old `id_counters` | Nine sequence records, 562 logical bytes. | Only consolidate after identifying the owning services, sequence namespaces and high-water marks. Preserve atomic allocation and never recycle previously issued values. These are not proven Sentiment Pulse-only records. |
| Health Literacy analytics rollups | Zero events now. | No immediate record savings. Future rollups must preserve lifetime mobile view/share/download totals and admin filter/distinct-visitor semantics before raw events expire. A blanket age-based delete would change public counters. |
| Survey-response rollups | Zero responses now. | No immediate savings. Full answers, per-question results, date/region analysis and NLP reprocessing cannot be reconstructed from totals alone. |
| Shared NLP entry deduplication/retention | Zero entries now. | No immediate savings. Future deduplication needs verified source identity and processing-state rules; repeated text can represent legitimate different submissions. |
| Legacy survey display-ID index | Empty `surveys` retains `unique_sentiment_pulse_survey_display_id`, while current index setup uses application `id`. | Separate optional index review after checking older/external writers. Index removal does not condense records; legacy uniqueness may still be required. |

Important behavior: `build_plan` uses consumed events to prevent source replay, and `update_report` preserves an existing consumed marker while refreshing projected fields. Blindly deleting all events older than 24 hours would remove that protection. Reconciliation can read historical source reports, so the active reporting window alone is not a sufficient retention policy.

Existing alert code stores naive Philippine wall-clock dates. Do not add a TTL policy directly to these dates without defining and migrating their UTC interpretation. A reviewed cleanup operation using the existing time semantics is a separate implementation choice.

If external ownership and lifecycle checks pass, the currently observed **15 expired cooldowns plus 26 unconsumed orphan events** provide an upper bound of **41 conditional record-removal candidates**. They should not be deleted solely from this inventory.

## Validation before implementation

- External services: identify their collection access, indexes, change streams and jobs; confirm how mobile UI data is obtained and whether deployed code matches this repository.
- Copy validation: compare per-kind counts, content/identity checks, reference integrity, unique keys, consumption markers, and sequence high-water marks; reject conflicts rather than silently dropping duplicates.
- Exercise regional eligibility boundaries, duplicate report submission, consumed-event replay, reconciliation, cooldown expiry, concurrent claims and restart recovery. Existing `test_regional_summaries.py`, `test_regional_alert_eligibility.py`, and `test_regional_alert_collection_guards.py` cover related behavior and need migration-specific extensions.
- Preserve current mobile/public API payloads and authorization for personal reports, content counters and surveys. Check admin summaries, alert statuses, survey results, and regional analysis.
- Run retention against a fresh dry-run inventory and an agreed retention policy. Keep merge validation separate from cleanup validation so record loss is attributable and reviewable.

## Open dependency question

The user identified the mobile app and the senior developer's five dashboard areas. The remaining information needed is **their actual MongoDB collection read/write map or the corresponding current source/repository locations**, particularly for `id_counters`, the four proposed Disease Watch internal collections, `regional_alerts`, and `mobile_notification_deliveries`. Also establish whether another component intentionally clears `self_reports` while retaining projections. No message was sent to the senior developer.

This dependency information is required before implementation; it does not invalidate the local code and read-only inventory findings above.

## Validation performed for this audit

- Read-only MongoDB inventory and retention diagnostics completed successfully.
- Inventory script Python syntax and saved JSON were validated locally.
- No application behavior changed, so dashboard build or regression execution was not needed for this assessment. The migration validation listed above remains future work.

## Reproduce the read-only inventory

From the repository root, with database network access:

```powershell
& server/.venv/Scripts/python.exe server/scripts/inspect_dashboard_collections.py --retention-details
```

The command loads `server/.env`, prints metadata and aggregate diagnostics, and returns a nonzero exit status if the inventory fails. Output includes no connection string, source report payload, survey answer, or account payload. It does not apply the recommendations in this document.
