Regional Self-Reports summary repair
===================================

The v2 repair is explicit and rerunnable. Neither API startup nor dashboard GET
handlers invoke it. The v1 marker is retained and does not gate v2. The command
imports only the standalone summary module and existing MongoDB/dotenv packages;
it does not import `api.py`, start workers, or access alert/delivery collections.

Counting contract
-----------------

- Include every source record with `source: mobile_self_report`, across all dates.
  As in v1, there is **no status filter**: submitted, for_review, verified,
  rejected, missing, and legacy statuses all remain eligible. “Submitted” in the
  dashboard text describes submissions, not a status predicate. Current data
  happens to contain only submitted records. Changing eligibility is a separate
  product decision.
- Count report records, including multiple reports from the same person. Five
  eligible regional records make a summary ready; four do not. Reports with no
  symptom data still contribute to the regional denominator and readiness.
- Use submittedSymptoms, then symptomLabels, then symptomIds, following the
  existing nonempty fallback order. Trim literal strings and count each exact
  symptom value once per report. Case variants remain distinct. No synonym
  mapping, condition inference, TF-IDF, or AI service is used. Sort by frequency
  descending, then case-insensitive alphabetical order, then exact text for ties.
  No percentages are displayed; any future percentage must divide the symptom's
  report count by the eligible regional report count, not by total mentions.
- `region_normalization.py` is shared by ingestion, summaries, and reconciliation.
  Canonical identifiers and established aliases are retained. The numeric
  allowlist was checked against source code/name pairs on September 11, 2026:
  010000000=I, 020000000=II, 030000000=III, 040000000=IVA, 050000000=V,
  110000000=XI, 130000000=NCR, 170000000=IVB. The local map's PH-* identifiers
  use a different numbering scheme and must not be converted mechanically.
  Unknown codes may use a recognized region name. Conflicting recognized
  code/name pairs and fully unknown locations are skipped and reported.
  Supported fallback/name issues are also reported. Source locations are never
  rewritten by reconciliation. Add other numeric mappings only after verifying
  their meaning; this allowlist is not a full national numeric-code catalog.

Read-only preview (repository root)
----------------------------------

```powershell
server/.venv/Scripts/python.exe server/scripts/reconcile_regional_summaries.py --dry-run --output server/scripts/regional_summary_dry_run.json
```

The default is also dry run. It uses a read-only snapshot transaction to compare
source records, saved events, summaries, and migration markers consistently.
`MONGO_URI` and `DB_NAME` come from the environment, with `server/.env` as fallback.
Output includes status/location inventories, eligible regional counts and
symptoms, skipped IDs/reasons, failed IDs/reasons, warnings, and proposed changes.
Processing failures exit nonzero; unknown/conflicting locations appear as skips.
The snapshot requires a MongoDB replica set or sharded deployment supporting
transactions. Local tests do not connect to MongoDB.

The saved audit found 31 eligible records, zero skips/failures/warnings, and:

| Region | Reports | Ready |
| --- | ---: | --- |
| Central Luzon (III) | 11 | Yes |
| National Capital Region (NCR) | 9 | Yes |
| CALABARZON (IVA) | 4 | No |
| MIMAROPA (IVB) | 2 | No |
| Bicol (V) | 2 | No |
| Ilocos (I) | 1 | No |
| Cagayan Valley (II) | 1 | No |
| Davao (XI) | 1 | No |

Only NCR was saved (3 reports, unready), with 3 events. Proposed changes are
28 event inserts, 3 existing-event updates, and 8 summary writes (7 new and 1
corrected). No event or summary deletions are proposed for this snapshot. The
existing events are refreshed with sorted, per-report deduplicated symptoms.
Central Luzon's actual leading symptoms are Fatigue (11), Cough (8), and Cough
for 2+ weeks (6). NCR's are Cough (7), Fever (5), and Headache (5).

Repair procedure and execution record
-------------------------------------

Executed with user authorization on September 11, 2026 at 13:34 Philippine time.
The local API process tree was suspended for maintenance and resumed afterward
without restarting application startup hooks. The pre-apply preview matched the
approved changes: 28 event inserts, 3 event updates, and 8 summary writes.
The transaction committed and the v2 marker is complete. The post-apply preview
reported zero outstanding changes. A full-source fingerprint before and after
confirmed all 31 source records were unchanged. Ready summaries are NCR=9 and
III=11. See `regional_summary_apply.json`, `regional_summary_post_apply.json`, and
`regional_summary_verification.json`; `regional_summary_before_repair.json`
contains the prior derived events and summaries.

For any future rerun:

1. Obtain separate authorization for database repairs. Pause all submission,
   report-edit, and summary writers for the maintenance window. The CLI requires
   operator confirmation of this with `--writers-paused`; it cannot enforce an
   infrastructure pause. Do not start the API to run this command.
2. Run another dry run and review any changes since the saved audit.
3. From the repository root, run:

   ```powershell
   server/.venv/Scripts/python.exe server/scripts/reconcile_regional_summaries.py --apply --writers-paused --output server/scripts/regional_summary_apply.json
   ```

4. Run dry run again before resuming writers. Proposed event/summary changes
   should all be zero. The summaries GET should return III=11 and NCR=9 for
   the observed snapshot; regions below five stay saved but hidden.

Apply ensures the two existing unique summary indexes, then performs the repair
and validation in a transaction with majority write concern. It replaces stale
event payloads, removes obsolete derived events, and recomputes summaries from
eligible source records. Only successful validation writes the v2 completion
marker. Any transaction failure rolls back derived writes and the marker
together. The v1 marker and source report records remain untouched. If index
creation encounters pre-existing duplicate keys, apply fails before repair;
review that exceptional database state before attempting index changes. Index
creation itself is outside the repair transaction. The authorized transaction
and post-commit validation succeeded on the configured shared deployment.

Reruns do not inflate counts and always recompute the desired source-based state,
even when v2 already completed. Unchanged events/summaries are not rewritten;
the validated marker timestamp is refreshed. Normal submissions upsert their
unique event and save counts with optimistic revisions. Duplicate processing
also retries summary persistence. Failed derived writes are logged with report
IDs and can be recovered by this reconciliation, without rejecting the source
submission. Reconciliation is not scheduled automatically.

UI and focused checks
---------------------

React uses backend order/counts to render up to three symptoms in a sentence and
an expandable complete list, with singular/plural wording and the diagnosis
notice. Initial loading, failed requests, successful empty results, and refresh
are distinct. The summary query refreshes on dashboard mount and every 30 seconds
while the Self-Reports tab is active, without render-triggered fetch effects.
Existing pagination and alert controls are preserved.

Run each Python suite in a separate process because the pre-existing controller
tests install global module fakes:

```powershell
server/.venv/Scripts/python.exe -m unittest discover -s server/tests -p test_regional_summaries.py -v
server/.venv/Scripts/python.exe -m unittest discover -s server/tests -p test_mobile_registration_and_analytics.py -v
server/.venv/Scripts/python.exe -m unittest discover -s server/tests -p test_regional_alert_collection_guards.py -v
```

From `client`, use `node --test tests/regionalSummaries.test.mjs`, the existing
ESLint CLI for the three changed dashboard components, and `npm run build`.
The React tests render the actual JSX using existing esbuild/React dependencies
and Node built-ins. No libraries or packages were added.

Submission checks also exposed two missing helper references already present in
the endpoint. The response now uses the existing safe mobile-account serializer
for authenticated users and null for guests, without creating report-derived
accounts. This prevents a post-save NameError from returning a failed submission.
