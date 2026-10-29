# Survey ID hierarchy and mobile API contract

## IDs and stored records

- Surveys use `SUR00001`, `SUR00002`, and so on. The server assigns these globally.
- Questions use `SUR00001-Q01`, `SUR00001-Q02`, and so on. The server restarts the question counter for each survey.
- Each answer uses an ID such as `SUR00001-Q01-RES0001`. The server restarts the answer counter for each question. The displayed widths are minimum widths.
- Gaps are expected when an ID was reserved before a failed write or a question was deleted. Counters do not move backward.
- Existing `survey_responses` documents remain one document per submission, so platform, account, region, time, and all answers remain grouped. `submissionId` identifies that group. `answers` remains a map keyed by question ID. `answerIds` is a parallel map from each question ID to its individual answer ID. Do not use `submissionId` as a response ID.
- Analytics `response_id` and `source_id` refer to the individual answer ID. `submission_id` links entries from the same submission. The analysis fields and processing tasks are unchanged.
- Deleted questions with historical answers are recorded in the survey's private `archivedQuestions` list. Their stored answer keys and answer IDs still link to those question IDs. The active `questions` list and question types are unchanged.

## API

The route names are unchanged. For every survey path parameter, use the `id` returned by `GET /api/sentiment-pulse/public-surveys?platform=mobile` or the admin survey list. Use each returned `questions[].id` as the SurveyJS element `name` and the key in `answers`.

```http
POST /api/sentiment-pulse/public-surveys/SUR00001/responses
Content-Type: application/json

{"platform":"mobile","answers":{"SUR00001-Q01":"Fever","SUR00001-Q02":4}}
```

The server returns `201`:

```json
{
  "message": "Sentiment Pulse survey response recorded",
  "submissionId": "server-generated-uuid",
  "answerIds": {
    "SUR00001-Q01": "SUR00001-Q01-RES0001",
    "SUR00001-Q02": "SUR00001-Q02-RES0001"
  }
}
```

The client must persist/use these returned IDs when it needs to identify an answer. It must never invent survey, question, or answer IDs for stored records. Unsaved website form questions may have temporary local keys; the server replaces them on create/update. The admin UI then reloads the canonical survey. Unknown question keys in a new submission return `400`.

## Migration plan

1. Back up `surveys`, `survey_responses`, `analytics_entries`, and the `sentiment_pulse_display_sequences` document in `application_settings`. Pause all survey create, edit, delete, and response writers for the migration window.
2. Set `MONGO_URI`, then run `python server/scripts/migrate_survey_id_hierarchy.py --database <DB_NAME>` for a read-only preflight. It fails before writing if a stored response has no survey, an answer mapping is ambiguous, or a survey analytics entry cannot be matched to a saved answer. Resolve any such records explicitly before apply.
3. With writers still paused, run `python server/scripts/migrate_survey_id_hierarchy.py --database <DB_NAME> --apply --writers-paused`. The script sorts historical records by creation time and MongoDB `_id`, preserves existing canonical IDs, prefers historic display numbers when available, maps SurveyJS names and answer keys, and updates analytics references. It sets counters above all assigned or previously reserved numbers. Legacy IDs remain as private aliases for an interrupted run to resume.
4. Run the read-only command again and verify counts and sample result aggregates against the backup before resuming writers. The apply command is idempotent and can be repeated after an interruption. Do not run old and new server versions together during the migration.

The script is checked in but has **not** been run against a deployment database from this workspace. Historic records will have the new hierarchy only after the deployment migration is applied.

## Mobile integration

No Flutter or other mobile application source is present in this repository. The mobile application itself was **not updated**. Its maintainers must:

1. Fetch the canonical survey and question IDs from the public survey endpoint; discard locally generated or cached legacy identifiers after refresh.
2. Render SurveyJS questions with the returned `surveyJson` element `name` or `questions[].id`. Submit `answers` keyed by those IDs to the returned survey ID path. Keep the existing question types and answer values.
3. Parse and retain `answerIds` and `submissionId` from the `201` response. Treat each `answerIds[questionId]` as the ID of that one answer; use `submissionId` only to group answers from the same submission.
4. Refresh old cached surveys before submitting. Handle `400` for a stale/unknown question ID and `404` for a survey that is no longer published.

The checked-in website API hook already passes the server's survey ID through its path and returns the mutation response. The admin form uses temporary keys only until the server allocates canonical IDs.
