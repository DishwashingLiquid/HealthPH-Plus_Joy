# Sentiment Pulse frontend milestone

Updated 2026-10-28, Asia/Manila. The initial frontend milestone preserved backend
work. A later owner-approved follow-up now updates Sentiment Pulse-specific backend
rules/reporting: text and choice answers go to the model; 1–5 ratings use 1–2
dissatisfied, 3 neutral, 4–5 satisfactory. Question IDs are derived from actual survey
definitions unless an explicit override exists. No dependencies, shared API behavior,
model artifacts, actual `.env` files, or live database data were changed. No live
Process, End Survey, or other database mutation was executed during verification.

## Verified contract used

All calls use the existing `baseAPI` authentication and the existing
`SentimentPulseSurveys` cache-tag type. No new global tags were added.

- `GET /sentiment-pulse/trends`: `timeRange`, comma-separated `regions`,
  `startDate`/`endDate` only for `custom`, and optional `surveyId`.
- `GET /sentiment-pulse/surveys/{id}/processing`: no date/region parameters;
  returns whole-survey mobile summary and a transient worker-local job.
- `POST /sentiment-pulse/surveys/{id}/process`: no body; a 202 acceptance is
  distinct from completion. Rating-only surveys return 200 `configured` with a
  computed `summary` and `job: null`; no model inference is required. The 200
  `not_configured` response remains for unsupported/explicitly disabled rules.
- Existing survey list, summary, results, create, edit, delete, schedule, end, and
  submission interfaces are unchanged. The results endpoint retains its original
  all-platform question-response counts.

The handoff was checked against `annotation_controller.py`,
`annotation_reporting.py`, `annotation_processing.py`, the route registrations,
configuration rules, legacy results aggregation, and backend annotation tests.
No undocumented endpoints/metrics are used. No raw analytics entries are downloaded.

## Behavior and files

Following the requested Mobile Surveys UI rollback, its original card layout,
results-modal breakdown, and three-action layout are preserved. The subsequent
card follow-up replaces its legacy sentiment fields with the stored calm/worried
assessment from the existing processing summary.
After a successful End Survey request, the End Survey button becomes Process in
the same position immediately. Processing remains wired to the existing backend;
its eligibility/configuration rules were not changed by this UI rollback.

- `sentimentPulseSlice.js` adds the three supported reporting/processing operations.
  Processing invalidates its status and Trends, without changing survey response
  totals. Existing survey mutations still invalidate their existing queries.
- `sentimentContract.js` formats server counts/shares, builds the supported request,
  validates complete Philippine calendar dates, names actual job states, and leaves
  chart gaps for missing dates. It does not recompute whole-survey aggregates.
- `SentimentTrends.jsx` shows explanation coverage, calm/worried counts, worried
  share with analyzed counts over time, separately scored satisfaction, filtered
  survey breakdowns, and daily counts. Unsupported Top Health Topics was removed.
- `SentimentSummary.jsx` presents Trends aggregates; null percentages
  remain unavailable, real zero remains zero, ties remain a two-class distribution.
- `SurveyFeedback.jsx` supplies the compact Process action in Mobile Surveys.
  Its detailed summary mode is no longer rendered in survey cards or results.
  A shared mutation key and immediate click guard prevent repeated pending actions.
  Known scheduled/running jobs poll every five seconds; other states poll every
  minute. Refresh is available. Successful coverage changes refresh Trends.
  Missing worker-local status never becomes an invented queued/failed answer count.
  Process is available for every ended survey regardless of eligibility/configuration
  or status-read availability; only an action in progress or a known active job
  disables it. The backend can still return `not_configured` without scheduling work.
- `MobileSurveys.jsx` keeps the existing response/target/completion, results tables,
  and survey actions. Its compact sentiment column now uses `SurveySentiment`
  from `SurveyFeedback.jsx`, sharing the Process button's status cache and polling.
  The larger class's share of classified answers appears with a green Calm label
  (`#15803D`) or red Worried label (`#DC2626`), plus analyzed/eligible answer counts.
  A tie shows 50% each with both class labels; it is not a Neutral model class.
  Missing results show a dash with loading, unavailable, not processed, no eligible
  feedback, or not configured text. A 202 acceptance alone changes no assessment.
- `StaticContainers.jsx` replaces the mock sentiment score with filtered worried
  share and its classified-explanation denominator. Publication-month response,
  region, and reporting-period cards retain their original definitions.
- `SentimentPulseTool.jsx` connects shared filters, Philippine custom dates, survey
  selection, refresh options, scoped CSV availability, and KPI data.
  `SentimentPulseFilters.jsx` adds accessible names and Escape support.
- `exportUtils.js` exports current filtered Trends aggregates, preserving null as
  blank and reporting each denominator. Mobile Surveys exports retain survey
  response/target fields and use the same stored assessment/coverage as the card.
  Its class share and separate calm/worried counts identify tied distributions.
  CSV availability waits for ended-survey summaries and disables on read errors.
  Regional Analysis export behavior and the existing PDF notice are preserved.

Native buttons/selects, labels, table captions, named focusable scrolling regions,
and textual counts accompany charts. Layout uses the existing responsive breakpoints
and supported theme palettes. Trends retains blue calm, amber worried, and green
satisfaction colors; survey-card sentiment uses the requested green/red fonts.
These aspects received static/code review; no successful live
browser rendering or keyboard interaction review is claimed.

## Checks

From `client/`:

```powershell
node --test tests/sentimentPulseIntegration.test.mjs tests/sentimentPulseRegionalAnalysis.test.mjs tests/sentimentPulseSummary.test.mjs tests/dashboardRegions.test.mjs
node node_modules/eslint/bin/eslint.js src/pages/admin/sentimentPulseTool src/features/api/sentimentPulseSlice.js tests/fixtures/sentimentPulsePreview.jsx --ext js,jsx --report-unused-disable-directives --max-warnings 0
node node_modules/eslint/bin/eslint.js tests/sentimentPulseIntegration.test.mjs tests/fixtures/sentimentPulseData.mjs --env node --report-unused-disable-directives --max-warnings 0
npm run build -- --outDir dist/sentiment-pulse-check
```

- **41 tests passed**: 27 new integration tests, 11 existing Sentiment Pulse
  summary/Regional Analysis tests, and three existing dashboard-region tests.
- Follow-up coverage renders the complete dashboard before and after loading mocked
  survey, summary, and sentiment aggregates. This does not exercise Vite's live
  module-resolution cache.
- Card follow-up tests verify green Calm/red Worried, ties, null/empty coverage,
  legacy Neutral suppression, partial coverage, matching CSV, and acceptance versus
  refreshed stored predictions. These are mocked cache/render checks, not a live
  browser click/poll timing test. Focused lint and the production build were rerun.
- Tests cover exact request parameters, calendar boundaries and invalid custom dates,
  missing/zero percentages, incomplete coverage, independent satisfaction denominators,
  identical aggregate presentation across views/CSV, chart gaps, quoted CSV titles,
  unknown regions, actual job states, 202 acceptance, cache invalidation, running-job
  button disabling, unended surveys, existing form helpers, and legacy mutations.
- Scoped lint passes with no warnings, including focused fixtures/tests.
- Production build passes to an ignored verification directory. It reports outdated
  Browserslist data, CSS-minification syntax warnings from existing stylesheet inputs,
  and large chunks. No unrelated stylesheet/configuration/dependency changes were made.
- Whole-client lint fails with **721 errors and 20 warnings across 61 unchanged
  files** (mainly existing prop-type and unused-variable errors). None of those
  findings are in this milestone's changed/new files.
- `git diff --check` passes. At the initial frontend milestone, SHA-256 comparison of 177 backend/model/handoff
  files against its starting state confirmed preservation, including existing
  uncommitted backend work. Shared `_baseAPI`, Regional Analysis implementation,
  and mock-data source were not edited.

Node/Vite workers required execution outside the Windows sandbox after `spawn EPERM`;
checks then passed. They used mocks and did not start or contact the main backend.

## Browser-review blocker and manual fixture

Computer Use stopped before interacting with Chrome because it could not determine
the current browser URL on Windows confidently enough to enforce policy. No alternative
browser automation was used to bypass that restriction. Desktop/mobile visual checks,
real keyboard interaction, and end-to-end click/poll timing remain unverified.

A test-only fixture is available for manual verification:

```powershell
npm run dev -- --host 127.0.0.1 --port 5178 --strictPort
```

Open `http://127.0.0.1:5178/tests/sentimentPulse.preview.html`. The preview is not
imported by the production entry point. It replaces every fetch with synthetic
responses and never forwards requests to the configured backend. It provides
configured/incomplete, unconfigured, unprocessed, empty, and error scenarios, a
narrow-window preview control, and an intercepted-request log. Do not use the
ordinary authenticated app to exercise mutations against live MongoDB for this check.

## Remaining backend/configuration limits

- Trends has no question filter, question-level sentiment/coverage, or filtered
  rating-distribution contract. Those features are explicitly unavailable in UI;
  existing whole-survey question counts are kept separate in the results modal.
- Text and multiple-choice questions now use their actual question types by default;
  no separate question-ID list is needed. Explicit survey/operator overrides still
  take precedence. Unsupported rating ranges require custom rules.
- The approved 1–5 rule supplies satisfaction meaning. Neutral satisfaction is a
  rating category, not a third model class. Multiple-choice labels are sent literally
  to the calm/worried model; model probabilities do not supply rating satisfaction.
- Cards/CSV use all dates and regions for mobile answers; Trends/KPI use their
  selected date/region/survey scope. They agree only when the reporting scopes agree.
  The restored results modal retains legacy all-platform summaries and question
  counts; its legacy sentiment block was not redesigned in the card-only follow-up.
- Job tracking is worker-local and non-durable. Cross-worker duplicate inference,
  status loss, interrupted jobs, and manual retries remain backend limitations.
- Tests are mocked/SSR checks; they do not establish production backend connectivity,
  model quality, browser layout, or durable recovery.
