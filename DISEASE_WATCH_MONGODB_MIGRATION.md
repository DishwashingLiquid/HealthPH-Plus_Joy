# Disease Watch internal storage migration

## Scope and safety

This migration copies every document from these approved sources:

| Source | Destination `kind` |
| --- | --- |
| `regional_symptom_summaries` | `regional_summary` |
| `regional_summary_events` | `summary_event` |
| `regional_alert_batch_states` | `alert_batch_state` |
| `regional_alert_cooldowns` | `alert_cooldown` |

The only destination is `disease_watch_internal`. The tool preserves every
`_id`, adds the required `kind`, and adds `region: <_id>` to a legacy batch
state when that field is absent. It does not rename, delete, expire, or alter
any source collection. It has no source-retirement or record-cleanup mode.

The migration rejects malformed documents, duplicate logical keys,
cross-source `_id` collisions, conflicting destination records, unexpected
destination records, protected write targets, and any destination outside the
allowlist. Missing source reports and missing event snapshot references are
reported separately for investigation; records are still preserved.

## Commands

Current operational note: read-only verification on September 15 found the
destination collection already present with the six expected indexes but zero
documents. The four sources still contained all 92 records, and preflight had
zero blocking issues. Leave the empty destination in place; an apply run can
reuse its compatible indexes and safely copy the records after writers pause.

Run the read-only preflight from the repository root:

```powershell
& server/.venv/Scripts/python.exe server/scripts/migrate_disease_watch_internal.py
```

Optionally save the report outside the application tree:

```powershell
& server/.venv/Scripts/python.exe server/scripts/migrate_disease_watch_internal.py --output disease-watch-migration-preflight.json
```

The live copy is intentionally explicit and was not run as part of the local
implementation:

```powershell
& server/.venv/Scripts/python.exe server/scripts/migrate_disease_watch_internal.py --apply --writers-paused --output disease-watch-migration-applied.json
```

An apply run creates the six discriminator-aware destination indexes, copies
only absent records, and validates every copied document. An interrupted copy
is safe to retry: identical records are counted as `alreadyCopied`, while a
different record with the same `_id` stops the migration.

## Deployment order

1. Take the normal database backup or snapshot and retain it through the
   acceptance period.
2. Make the migration tool available without starting the updated API code.
3. Stop every API instance that can accept or update self-reports. Stop all
   regional-alert scheduler instances and do not run either summary repair
   script. Confirm no separate worker writes the four approved source
   collections.
4. Run the default dry run. Require `blockingIssueCount` to be zero. Review
   source counts, destination count, collisions, malformed records, and both
   reference diagnostics.
5. Run `--apply --writers-paused`. Require `validated: true`, zero proposed
   inserts after validation, and `recordPreservationExpected` equal to the sum
   of all four source counts.
6. Deploy the updated API and scripts while writers remain paused. Startup
   checks that the destination has at least as many records as the retained
   sources before it creates indexes or starts the scheduler. This prevents
   the updated code from silently using an empty or partial destination.
7. Smoke-test the admin summaries and automation settings, submit a controlled
   test report through the normal API if the environment permits it, and
   confirm mobile/public alert payloads retain their existing shape.
8. Resume API writers and schedulers only after the updated instances pass the
   startup check and smoke tests.

Do not deploy the updated application before step 5. It reads only
`disease_watch_internal` for these four logical stores.

## Validation after cutover

Run these read-only tools:

```powershell
& server/.venv/Scripts/python.exe server/scripts/migrate_disease_watch_internal.py
& server/.venv/Scripts/python.exe server/scripts/inspect_dashboard_collections.py --retention-details
& server/.venv/Scripts/python.exe server/scripts/inspect_summary_regions.py
```

The first command should report all records as already copied, no proposed
inserts, and no blocking issues. The inventory should report
`diseaseWatchStorage: consolidated`. Reference issues require investigation
but are not a reason to discard a source or destination record.

Keep the four sources unchanged through the acceptance period. Source
retirement is a later, explicit operation after every deployed reader, writer,
scheduler, and repair job uses the destination. Retirement must never include
the protected collections listed in the audit.

## Recovery and rollback

- If preflight or copy validation fails, keep writers paused, retain all
  sources, inspect the reported IDs, and rerun after resolving the conflict.
  A partial destination copy can remain in place because retries compare full
  documents and never overwrite a conflict.
- If deployment fails before writers resume, redeploy the previous code. The
  legacy sources are still complete and unchanged.
- If a problem appears after destination writes resume, do not immediately
  point old code at the legacy sources because they are then stale. Pause
  writers and schedulers, inventory both layouts, and either roll forward or
  perform a separately reviewed reverse copy by `kind` with the same `_id`,
  logical-key, and reference validation. Preserve the destination and backup
  until reconciliation is accepted.

## Record reduction remains separate

The migration retains all records. No TTL index is added. Any later cleanup of
expired cooldowns or orphan events needs a fresh read-only inventory, an
approved retention policy, protection against concurrently renewed cooldowns,
checks for Processing batches and alert snapshots, and explicit handling of
the existing naive Philippine timestamp semantics. Consumed event identity and
batch metadata must remain durable to prevent report replay.
