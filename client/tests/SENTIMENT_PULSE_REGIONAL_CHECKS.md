# Regional Analysis: stored analytics reporting

Verified October 30, 2026 (Asia/Singapore), using isolated fixtures only.

## Behavior and contract

Regional Analysis now uses `GET /sentiment-pulse/regional-analytics` for its overview,
regional cards, native comparison disclosure and CSV. The simplified accent strips,
tinted headers, 28px primary counts, active-region defaults and 1/2/4-column layout
are preserved. The comparison always renders, with loading/unavailable states.
Existing PDF behavior and the other subtabs are preserved.

The primary label is **Survey responses analyzed**. `totals.analyzedSubmissions`
and the same field on each regional row count distinct submissions with at least
one currently eligible answer satisfying `stored_prediction()`. Several analyzed
answers count once. Anonymous submissions count, and repeated submissions from
the same person count separately. No account, visitor, text similarity or timestamp
identity heuristic is used. `analysis_status` does not determine sentiment validity.

- Direct `submission_id` links are preferred, with response document aliases
  (`submissionId`, `id`, `_id`) canonicalized where available. Older entries link
  through survey ID, question ID, and `response_id`/`source_id` to
  `survey_responses.answerIds`. Conflicting identifiers and nonunique answer links
  are ambiguous. Responses are used only for these relationships.
- New analytics entries now persist the submission ID already computed by the
  existing builder. No existing records are backfilled or changed.
- If any valid sentiment answer in the date window has a missing/ambiguous link,
  exact overall and regional counts are null (`submissionCountStatus: incomplete`).
  `linkedAnalyzedSubmissions` reports only submissions with resolved links.
  `linkage.missingAnalyzedAnswers` and `ambiguousAnalyzedAnswers` describe all
  date-filtered regions before filtering. This intentionally conservative behavior
  also applies when the unresolved answer appears outside the selected region.
  Sentiment still includes valid unlinked answers; unlinked scoring answers cannot
  establish membership in the satisfaction population and are excluded.
- The endpoint shares Trends aggregation, sentiment validation and scoring rules.
  Eligible/predicted/without-result answer counts remain visible, including eligible
  answers from submissions without any sentiment result. Calm/Worried ties and
  `sentimentContract.js` colors are unchanged.
- Satisfaction is satisfied / valid configured scored answers * 100. It uses only
  date-filtered scoring answers linked to submissions represented by valid sentiment
  results within the date window. Valid 0% remains visible. Unconfigured scoring,
  no valid scoring answers and missing fields have distinct states. The existing
  Trends population remains unchanged: it includes all valid scored mobile answers,
  including submissions without sentiment results. This difference is disclosed in
  the overview, definitions and CSV. Regional locations can also differ from Trends:
  Trends keeps per-answer locations; Regional assigns linked submissions once.
- Both reports cover mobile survey-response analytics for all existing surveys,
  including unpublished surveys where entries exist. Regional ignores the
  Trends-only survey selector. `event_time` (`created_at` fallback) uses existing
  Philippine calendar boundaries and the request cutoff.
- Linked submissions are assigned from all their valid sentiment records within
  the date window before region filtering. Any missing or conflicting processed
  location leaves the submission in Unknown Region. Pending answers linked to
  analyzed submissions follow that assignment; pending-only groups use their
  eligible record locations for coverage. Unlinked answers use their record's
  normalized location. No account-region fallback is used. Region accents are stable.
- `regionsComplete: true` explicitly permits absent regional rows to represent no
  activity. Missing arrays/metrics are unavailable, never silently zeroed. Requests
  use RTK Query `currentData`; failures suppress cached values, and filter changes
  cannot display old-filter counts. Refresh, polling, focus refresh and processing/
  survey mutation invalidation remain active. CSV uses the same rows and assessment
  as the UI; unavailable numeric cells are blank. Exports are disabled during
  requests, invalid filters and request failures.

The existing `GET /sentiment-pulse/regional-analysis` verified-account respondent
contract is unchanged and still available to other consumers. Received-submission
totals are omitted from this subtab to keep its reporting population clear.

## Files

Client source: `RegionalAnalysis.jsx`, `SentimentPulseTool.jsx`, `regionalMetrics.js`,
`exportUtils.js`, and `features/api/sentimentPulseSlice.js`.

Backend: new `controllers/sentiment_pulse/regional_reporting.py`, optional scope
hooks in `annotation_reporting.py`, endpoint in `annotation_controller.py` and
`routes/sentimentPulseRoutes.py`, and the future-entry `submission_id` field in
`helpers/analyticsEntryHelpers.py`.

Validation: regional frontend tests, API integration tests, mocked preview fixture
and browser script; new `test_sentiment_pulse_regional_reporting.py`, added to
`scripts/run_sentiment_pulse_checks.py`. Pre-existing README and annotation-test
changes were preserved.

## Validation

From `client/`:

```powershell
node --test tests/sentimentPulseRegionalAnalysis.test.mjs tests/sentimentPulseIntegration.test.mjs tests/sentimentPulseSummary.test.mjs
npx eslint src/pages/admin/sentimentPulseTool/RegionalAnalysis.jsx src/pages/admin/sentimentPulseTool/SentimentPulseTool.jsx src/pages/admin/sentimentPulseTool/regionalMetrics.js src/pages/admin/sentimentPulseTool/exportUtils.js src/features/api/sentimentPulseSlice.js
npm run build
```

61 frontend tests pass. Focused ESLint and the build pass. Build retains existing
CSS syntax/minification warnings, large chunks and outdated Browserslist warnings.
Windows sandbox blocks Node/esbuild worker spawning; the tests/build were rerun
with the environment's approved process permissions.

From `server/`:

```powershell
.venv/Scripts/python.exe scripts/run_sentiment_pulse_checks.py
```

All 11 isolated backend suites pass: 137 tests run, six optional live-database tests
skipped. The new regional suite covers submission deduplication, anonymous/repeated
submissions, direct/legacy/ambiguous/missing links, source/date/question/survey
eligibility, stored prediction validity, unknown/conflicting regions, assignment
before filtering, partial coverage, ties, independent scoped satisfaction, valid 0%,
unconfigured scoring, future ID recording, admin access, filter validation and
read-only GET behavior. Existing Trends/mobile Trends and respondent suites pass.

With local Vite and isolated headless Edge remote debugging at port 9223:

```powershell
node tests/sentimentPulseRegional.browser.mjs
```

Browser checks pass at 375/768/1440px with 1/2/4 columns, no horizontal overflow or
card text clipping. Checks include count typography, native comparison opening via
Enter, bar/count agreement and accessible headings, region selector Enter/Escape
and focus return, all-survey scope, delayed region/date changes, request failure
and refresh recovery, missing fields, unresolved links, CSV and empty states.
The populated mobile screenshot was visually reviewed. Every preview fetch is
mocked; no backend is contacted. `REGIONAL_CDP_URL`, `REGIONAL_PREVIEW_URL` and
optional `REGIONAL_SCREENSHOT` override local defaults.

## Remaining limits

Historical unresolved links prevent exact submission totals. Missing stored results
cannot distinguish never attempted analysis from failed attempts. Reporting reads
analytics and response relationships in separate queries without an atomic database
snapshot, and currently scans the mobile survey analytics/relationship scope in
memory like existing answer aggregation; production volume was not benchmarked.
No deployment, inference, live-data verification or live-data modification was done.
