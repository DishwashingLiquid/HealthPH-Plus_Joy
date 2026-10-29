# MongoDB dashboard consolidation audit

Date: September 15, 2026. Scope: Disease Watch Feed, Health Literacy Hub, Sentiment Pulse Tool, their backend dependencies, and the configured MongoDB database.

## Conclusion

**Disease Watch Feed's four approved internal collections now have a completed local consolidation implementation.** `disease_watch_internal` stores separate typed documents and initially preserves all records. Kind-scoped storage, partial unique indexes, scheduler and reconciliation changes, migration preflight/copy validation, startup cutover protection, repair/inspection updates, and isolated regressions are implemented. The live migration remains unapplied.

The user confirmed exclusive internal ownership for `regional_symptom_summaries`, `regional_summary_events`, `regional_alert_batch_states`, and `regional_alert_cooldowns`. That resolves eligibility for this local implementation. Protected, unfamiliar, shared, and externally owned collections remain unchanged. No production copy, source retirement, or record deletion was performed.

The user also requested assessment of record reduction. The best current candidates remain 15 expired cooldown records and 26 unconsumed summary events whose source reports are absent. These are conditional cleanup candidates, not a deletion list. Seventeen consumed summary events now retain protection against processing the same report again; 11 of those also lack source reports.

Health Literacy content already shares one collection. Its analytics events supply mobile-visible counts and cannot simply be discarded. Sentiment Pulse already embeds survey questions and creation metadata, and its survey sequence lives in shared settings. Neither dashboard has an obvious additional low-risk collection merge under the requested backend-only, same-dashboard rule.

## Evidence and limits

- Inspected the current working tree and preserved unrelated uncommitted changes. The Disease Watch application and operational scripts were updated only for the approved consolidation.
- Traced React dashboards and API slices through FastAPI routes, controllers, helpers, serializers, startup jobs, reconciliation scripts, and existing regression tests.
- Inspected mobile integration documentation. No Flutter application source exists in this repository. A mobile API response is treated as mobile-facing even when the actual widget cannot be inspected.
- The original audit used read-only collection metadata and aggregate lifecycle checks. The final implementation checks also invoked only read-only migration preflight and inventory commands; `--apply` was never used.
- The configured database originally contained 21 collections. A final recheck found 22 because an empty `disease_watch_internal` collection with the six implementation indexes now exists. No destination documents exist. Two local Python process pairs were already active, and the exact new startup index definitions indicate a running/reloading application likely loaded the edited controller. Do not treat the destination as migrated.
- Measurements began at 10:37:24 Philippine time; lifecycle checks ran at 10:37:37. They are sequential observations, not a consistent transaction snapshot. Recheck before any migration or cleanup, especially because other services may write concurrently.
- The optional historical `DASHBOARD_MONGODB_INVENTORY.json` is not present in the current working tree. The dated observations below remain historical evidence. Reusable read-only tool: [inspect_dashboard_collections.py](server/scripts/inspect_dashboard_collections.py).

## Current read-only preflight

At 15:25 Philippine time on September 15, the approved sources contained 92
records: 17 summaries, 43 events, 2 batch states, and 30 cooldowns. The
migration preflight found no cross-collection `_id` collisions, logical-key
conflicts, malformed source records, destination document conflicts, or
snapshot references to missing events. It proposed all 92 inserts.

The lifecycle recheck found 17 consumed and 26 unconsumed events. Thirty-seven
events lacked source reports: 11 consumed and all 26 unconsumed events. Eleven
events were older than the maximum rolling window. Fifteen of 30 cooldowns
were expired, no batch was Processing, and all 17 summaries were zero-count.
These observations are sequential and can change while existing services run.

The destination has zero documents and is explicitly reported as
`incomplete-destination` with `cutoverReady: false`. Its indexes can remain in
place for a later apply run; do not drop them during this task. The application
startup guard now refuses cutover whenever any destination kind contains fewer
records than its corresponding retained source.

## Collection classification

“Internal” means no direct mobile UI read was found in this repository. Internal state can still affect whether an alert or another mobile-facing record is created correctly.

### Disease Watch Feed

| Collection | Observed records | Purpose and dependencies | Assessment |
| --- | ---: | --- | --- |
| `self_reports` | 6 | Canonical mobile submissions; POST response, personal report history, map/export, reporter analytics, summary projection, NLP entry creation. | Keep as a source collection. |
| `mobile_users` | 1 | Mobile registration/login and authenticated account identity; report ownership, regional analytics, survey joins, recipient targeting. | Keep shared identity storage. |
| `regional_symptom_summaries` | 17 | Derived regional totals shown on the admin dashboard; revision-controlled updates and automation input. All 17 had zero report counts at observation. | Consolidation candidate: `kind: regional_summary`. |
| `regional_summary_events` | 43 | Per-report projection, rolling-window calculation, and durable consumed-batch markers. | Approved as `kind: summary_event`; preserve event identity and consumption state. |
| `regional_alert_batch_states` | 2 | Processing claims, restart recovery, cooldown wake-ups, admin automation status. No batch was `Processing` at observation. | Approved as `kind: alert_batch_state`. |
| `regional_alert_cooldowns` | 30 | Per-region/symptom suppression reservations. Fifteen were expired at observation. | Approved as `kind: alert_cooldown`; conditional record cleanup remains separate. |
| `regional_alerts` | 2 | Saved alert message, trigger snapshot, admin history, recipient-preparation lifecycle. | Protected mobile-facing history; retain unchanged. |
| `mobile_notification_deliveries` | 1 | One assignment per alert/mobile user; preparation retries and recipient counts. | Protected mobile integration boundary; retain unchanged. |
| `application_settings` | 4 total, shared | Alert settings, repair markers, and Sentiment Pulse ID allocation. | Keep shared collection; do not move unrelated dashboard settings into Disease Watch storage. |
| `analytics_entries` | 6, shared | NLP processing entries from report notes, survey answers, and imported datasets. | Already shared by source type; do not absorb it into one dashboard. |

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
| `surveys` | 1 | Survey definitions, embedded questions, publication/scheduling settings, creator metadata, question sequence and response count. Public/mobile survey list consumes these records. | Already combines creation features; keep. Draft status does not make the collection backend-only because drafts can be published. |
| `survey_responses` | 0 | Submitted answers and respondent metadata; admin results, summary joins, regional/date analysis, and NLP entry generation. Submission endpoint returns an acknowledgment rather than the response document. | Backend-held source records, but no suitable separate dashboard-owned internal collection to combine with under the requested rule. Keep full answers for existing features. |
| `application_settings` | 4 total, shared | Atomically reserves survey IDs. The observed next survey sequence is 8. | Preserve sequence state; do not reset or derive solely from current surveys. |
| `analytics_entries` | 6, shared | Per-answer NLP entries, shared with self-reports and dataset imports. | Preserve shared processing contract. |
| `mobile_users` | 1, shared | Authenticated response association and regional identity joins. | Keep shared identity storage. |
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

The local implementation combines only these four collections into `disease_watch_internal`:

| Current collection | Required discriminator |
| --- | --- |
| `regional_symptom_summaries` | `kind: regional_summary` |
| `regional_summary_events` | `kind: summary_event` |
| `regional_alert_batch_states` | `kind: alert_batch_state` |
| `regional_alert_cooldowns` | `kind: alert_cooldown` |

Keep each event, state, summary and cooldown as its own document. This is four collections becoming one, not 92 records becoming one giant record. Growing event/recipient arrays would introduce document-size and update costs; MongoDB documents this in [Avoid Unbounded Arrays](https://www.mongodb.com/docs/manual/data-modeling/design-antipatterns/unbounded-arrays/).

Implemented storage guarantees:

1. `KindScopedCollection` adds the discriminator to every supported read, update, upsert, deletion, count, distinct, and aggregation operation. Inserts and replacements retain the discriminator and reject a conflicting kind.
2. The migration preserves `_id` values and blocks cross-collection collisions before copying. Batch-state `_id` remains the region code, with `region` added for its partial unique index. Event IDs remain unchanged in summaries, processing snapshots, and alert snapshots.
3. Type-specific partial indexes enforce one regional summary per region, one event per `(region, reportId)`, one batch state per region, and one cooldown per `(region, symptomKey)`. Separate indexes support active events and due batch states.
4. Revision checks, consumed markers, cooldown deadlines, restart recovery, and alert-generation behavior remain in place. The batch claim now initializes state separately and uses a non-upserting compare-and-set, avoiding a duplicate `_id` race when another worker is Processing.
5. Database configuration, the alert controller, repair and inspection scripts, documentation, and regression coverage use the consolidated logical views. Protected alert history, deliveries, source reports, and application settings retain their existing collection contracts.
6. [Migration instructions](DISEASE_WATCH_MONGODB_MIGRATION.md) coordinate writers, scheduler instances, and repair jobs. The tool validates the full copy before cutover, and startup rejects an empty or partial destination while retained sources contain more records.

Potential result: three fewer collections after source retirement. The four source collections currently hold **26,176 logical data bytes** and **483,328 bytes of allocated collection plus index storage**. Those allocated bytes are not a savings estimate: the destination still needs documents and indexes, and temporary migration copies increase storage. Across the currently inspected existing collections, logical document data totals about **58,686 bytes**. The present benefit is chiefly simpler organization, not a substantial data-volume reduction.

## Record and field reduction assessment

| Candidate | Observed evidence | Safe reduction conditions |
| --- | --- | --- |
| Expired cooldown records | 15/30 expired; no processing batch observed. | Best bounded cleanup candidate after external-use review. Recheck expiry at deletion, coordinate with processing/retry writers, and preserve any required operational history. Removing an expired reservation must not delete a concurrently renewed cooldown. |
| Unconsumed orphan summary events | All 26 unconsumed events lacked matching `self_reports` records; 6 newer events retained their sources. | Investigate the 37 historical source removals and concurrent/external writers first. If source removal is confirmed intentional and events are not reserved/referenced by an in-flight batch, remove obsolete unconsumed projections and reconcile summaries. The existing repair planner can remove unconsumed events missing from eligible sources, but has broader effects and must be dry-run/reviewed separately. |
| Consumed summary-event payloads | 17 consumed; 11 lacked source reports, and 11 total events were older than the maximum 24-hour reporting window. The checks do not establish that these two sets are identical. | Preserve a minimal permanent consumption marker containing identity, region, source report ID and consumed-batch metadata. Bulky symptom payloads could later be removed after verifying references, repair behavior, and historical requirements. This reduces bytes, not necessarily document count. |
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
- Exercise regional eligibility boundaries, duplicate report submission, consumed-event replay, reconciliation, cooldown expiry, concurrent claims and restart recovery. Existing regional tests plus `test_disease_watch_storage.py` and `test_disease_watch_alert_processing.py` now cover these paths and the migration-specific failures.
- Preserve current mobile/public API payloads and authorization for personal reports, content counters and surveys. Check admin summaries, alert statuses, survey results, and regional analysis.
- Run retention against a fresh dry-run inventory and an agreed retention policy. Keep merge validation separate from cleanup validation so record loss is attributable and reviewable.

## Remaining ownership limits outside the approved scope

The approved four Disease Watch collections no longer require an ownership confirmation. Ownership remains unresolved for `id_counters` and for unfamiliar external implementations. `regional_alerts`, `mobile_notification_deliveries`, and `self_reports` are protected regardless of that uncertainty. Their actual external read/write maps are needed only before proposing any future contract change or cleanup in those collections. No message was sent to the senior developer.

The unexplained historical absence of source reports remains relevant to any later orphan-event cleanup, but it does not block the approved record-preserving merge.

## Validation performed

- The September 15 read-only MongoDB inventory and retention diagnostics remain historical evidence; no new live write was made.
- Isolated tests cover document-kind isolation, partial unique constraints, ID and reference preservation, migration retry, collisions, malformed records, protected-target rejection, duplicate report processing, replay prevention, cooldown expiry/renewal, concurrent claims, restart recovery, reconciliation, and unchanged admin/mobile-facing serialization.
- Python syntax and the focused Disease Watch, regional-summary, regional-alert, mobile-alert, Health Literacy, and Sentiment Pulse regression suites are run locally as part of implementation validation.

## Reproduce the read-only inventory

From the repository root, with database network access:

```powershell
& server/.venv/Scripts/python.exe server/scripts/inspect_dashboard_collections.py --retention-details
```

The command loads `server/.env`, prints metadata and aggregate diagnostics, and returns a nonzero exit status if the inventory fails. Output includes no connection string, source report payload, survey answer, or account payload. It does not apply the recommendations in this document.
