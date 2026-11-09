# Mobile Sentiment Pulse: Overview, Trends, and Regional — AI agent handoff

Contract updated against the backend working tree on **2026-11-04, Asia/Manila**.
This document replaces the earlier Overview/Trends-only handoff. The user's three
sections take precedence over older instructions that excluded Regional or defined
Trends only as satisfaction over time.

## Task for the receiving mobile AI agent

Implement and verify all three sections in the actual mobile repository. Do not
stop at a plan. First inspect its `AGENTS.md`, working-tree changes, existing
Sentiment tab, HTTP client, authentication/session storage, state management,
region settings, chart widgets, and tests. Reuse those patterns and installed
dependencies. Preserve unrelated and uncommitted work.

Use the existing mobile reporting endpoint below. Backend support is implemented
in this backend/web repository; no Flutter/Dart application source is present here.
Do not implement a second backend or call admin endpoints from the phone. Preserve
survey listing/submission, navigation, authentication, and unrelated dashboards.
Do not upgrade packages, deploy, or mutate production data under this handoff.

Deployment and the configured API origin have NOT been verified. Complete local
models, integration, synthetic fixtures, and tests even without a development login.
Before claiming end-to-end completion, verify a deployed build returns both new
`sentimentTrends` and `regional` objects. If it does not, report a backend deployment
prerequisite; do not substitute satisfaction for sentiment or use admin credentials.

## 1. One existing reporting URL

```http
GET /api/mobile/sentiment-pulse/trends?timeRange=last-30-days
Authorization: Bearer <existing-mobile-access-token>
Accept: application/json
```

One response supplies Overview, per-survey sentiment Trends, and Regional. Reuse
the mobile session and existing API base configuration. Append `/mobile/sentiment-pulse/trends`
when the base already ends in `/api`; otherwise append `/api/mobile/sentiment-pulse/trends`.
Do not duplicate `/api` or assume a phone can reach a development server at localhost.
The existing login is `POST /api/mobile/users/login`, returning `access_token` and
`user`; reuse sign-in rather than introducing a separate reporting login.

| Query parameter | Contract |
| --- | --- |
| `timeRange` | `last-7-days`, `last-30-days` (default), `last-90-days`, or `custom`. |
| `startDate`, `endDate` | Required for custom, inclusive `YYYY-MM-DD` Philippine dates. Omit for rolling windows. |
| `regions` | Optional comma-separated recognized region codes/aliases, for Overview and Trends ONLY. Omission means all regions, including unknowns. |
| `surveyId` | Optional exact mobile-visible application survey ID, for Overview and Trends ONLY. Omission means all eligible surveys. |
| `regionalRegion` | Optional single region code/alias from the app's selected region. Omit to use the authenticated account's stored region. Blank, unknown, or multiple distinct regions return 400. Does not update the account. |

Example: national Overview/Trends and Regional for the app's selected NCR region:

```http
GET /api/mobile/sentiment-pulse/trends?timeRange=custom&startDate=2026-10-28&endDate=2026-10-28&regionalRegion=NCR
```

Do not automatically copy the profile region into `regions`: that would restrict
the national Overview too. If the app's region setting is stored locally, send it
as `regionalRegion` on every request and refresh when it changes. If it represents
the saved account region, omit the override and let the backend read the account.
Reuse existing settings persistence; no new profile-region update endpoint is added.
Do not invent a profile update URL or a baseline/query parameter absent from this table.

Authentication remains the existing mobile JWT (`aud: mobile`, `typ: mobile_access`)
and a valid mobile registration with role `user`. Admin/visitor tokens cannot authorize
this route. All reports aggregate eligible answers from all participants in scope,
not just answers submitted by the signed-in mobile user.

## 2. Population, dates, and baseline

Overview and Trends share one scope: mobile survey-response analytics from surveys
with `publishToMobile: true` and a valid publication date no later than request time.
Ended surveys remain eligible. Hidden, draft, future, website-only, and deleted
surveys are excluded. A hidden/missing explicit `surveyId` returns the same 404.
Current publication eligibility applies to BOTH current and baseline periods.

Regional follows the dashboard Regional Analysis service: mobile analytics from
ALL existing surveys, including unpublished surveys with stored answers, for the
chosen region and dates. It ignores `surveyId` and `regions`. Only aggregates are
returned; unpublished survey IDs/titles and participant identities are not exposed.
It assigns a linked submission's region from its analyzed answer locations before
filtering; missing/conflicting locations stay unknown. It does not move old answers
when a mobile user changes their profile region.

Consequently, Regional can differ from region-filtered Overview. Matching Overview
to dashboard Trends also requires the same mobile-visible surveys/date/region scope;
the admin's unrestricted all-survey total is not a valid direct parity comparison.

All dates use Asia/Manila submission dates (`event_time`, with `created_at` fallback),
not processing dates or survey publication dates. Rolling windows include today
plus N-1 prior calendar days. Current observations are capped at request time.
Custom future end dates remain accepted; their echoed date stays requested, but
future observations are excluded. Prefer a date picker capped at today. Do not
re-interpret date-only strings through the device timezone.

The baseline is the immediately preceding NON-OVERLAPPING window of the same number
of requested Philippine calendar days. It is computed by the backend:

- Current October 28 only -> baseline October 27 only.
- Current October 26-28 -> baseline October 23-25.
- Last 7 days as of October 29 -> current October 23-29, baseline October 16-22.

A current window containing today is partial through `asOf`; the preceding window
may be complete. Show period labels. A previous period with no analyzed answers
has null shares/changes, not zero. Extremely early date ranges without a
representable prior window return 400.

The baseline is RECALCULATED from currently stored annotations. It is not an
immutable snapshot of what a user previously saw. Delayed staging/analysis can
change historical results. No snapshot collection or snapshot-writing GET is
introduced. Do not label these values "since your last visit" or "live sentiment".

## 3. Exact response field contract

Existing top-level fields retain their shapes and meaning. Added top-level fields
are `asOf`, `sentimentTrends`, and `regional`. Treat extra unrelated fields as
forward-compatible; missing required new blocks indicate an unsupported backend
build or a parsing failure, not an empty success.

| Field | JSON type / meaning |
| --- | --- |
| `sources` | Array, currently `["mobile"]`. |
| `asOf` | ISO timestamp with +08:00 offset; request observation cutoff, NOT last analysis completion time. |
| `filters` | Applied current scope: `timeRange`, `startDate`, `endDate`, `regions` array, nullable `surveyId`, `unknownRegionIncluded`, `timezone: "Asia/Manila"`, `surveyVisibility: "published-to-mobile"`, `participants: "all"`. |
| `sentiment` | Sentiment summary object defined below. |
| `sentimentDistribution` | Exactly Calm and Worried category objects, in that order. |
| `satisfaction` | `status`, integer `satisfactionAnswers`, integer `satisfiedAnswers`, nullable numeric `satisfactionShare`. |
| `satisfactionDistribution` | Satisfied, Neutral, Dissatisfied category objects; category counts can be null for undefined legacy scoring mappings. |
| `satisfactionTrend` | Existing daily satisfaction rows: `date`, `satisfactionAnswers`, `satisfiedAnswers`, nullable `satisfactionShare`. Preserve existing consumers; this is NOT the new sentiment trend. |
| `sentimentTrends` | Per-survey comparisons defined below. |
| `regional` | Region-specific result or `region_required`, defined below. |

Every sentiment summary has exactly these fields:

```json
{
  "status": "configured",
  "dominantCategory": "calm",
  "dominantShare": 75.0,
  "eligibleAnswers": 5,
  "predictedAnswers": 4,
  "answersWithoutResults": 1,
  "analysisCoverage": 80.0
}
```

`status` is `configured` or `not_configured`; it describes applicable rules, not
job completion. `dominantCategory` is `calm`, `worried`, `tie`, or null.
`dominantShare` and `analysisCoverage` are numbers or null. All counts are integers.
A nonempty tie has 50% dominant share. When no answer is classified, dominant
category/share are null even if eligible answers exist.

Every category object has `category`, `answers`, and `share`:

```json
[
  {"category": "calm", "answers": 3, "share": 75.0},
  {"category": "worried", "answers": 1, "share": 25.0}
]
```

Sentiment counts are integers. Shares are percentages in 0-100 units, nullable
when the denominator is zero. Satisfaction uses category names `satisfied`,
`neutral`, `dissatisfied` and its own valid-scored-answer denominator.

### Per-survey sentiment comparisons

`sentimentTrends` has these exact fields:

| Field | Meaning |
| --- | --- |
| `comparison` | Literal `previous-equal-calendar-period`. |
| `changeUnit` | Literal `percentage-points`. |
| `baseline.startDate`, `baseline.endDate` | Inclusive previous-period dates. |
| `baseline.sentiment` | Overall prior-period sentiment summary, using the same Overview region/survey scope. |
| `baseline.sentimentDistribution` | Prior-period overall Calm/Worried distribution. |
| `overviewChange` | Object `{calm: number-or-null, worried: number-or-null}`: current Overview shares minus baseline Overview shares. |
| `surveys` | Array of the mobile-visible survey rows below, sorted by survey ID. Includes ended and empty eligible surveys. An explicit `surveyId` narrows this array and the Overview baseline to that survey. |

Each `sentimentTrends.surveys[]` row contains:

| Field | Meaning |
| --- | --- |
| `surveyId` | Exact application ID, unchanged. |
| `title` | Survey title; the survey ID is the server fallback if no title exists. |
| `sentiment`, `sentimentDistribution` | This survey's CURRENT-period summary and Calm/Worried distribution. |
| `previousSentiment`, `previousSentimentDistribution` | This survey's PREVIOUS-period summary and distribution. |
| `changeFromOverviewBaseline` | `{calm, worried}`: current survey shares minus previous OVERALL Overview shares. This is the requested comparison to the Overview baseline. |
| `changeFromPreviousPeriod` | `{calm, worried}`: current survey shares minus the SAME survey's previous-period shares. This measures temporal change within that survey. |

Changes are SIGNED percentage points, not relative percent change. Either missing
denominator makes both changes null. Zero is a valid measured unchanged value.
The first comparison does not imply the survey itself changed by that amount;
label the two comparisons distinctly. Do not call a distribution alone a change.

Synthetic acceptance example: previous Overview Calm 50%, current Survey A Calm
25%, previous Survey A Calm 75% -> Survey A `changeFromOverviewBaseline.calm` is
-25 and `changeFromPreviousPeriod.calm` is -50. Worried changes are +25 and +50.
For one survey with 1 Calm/3 Worried and another with 3 Calm/0 Worried, current
Overview Calm is 4/7 = 57.1%, NOT the average of 25% and 100%.

The returned array supplies authorized survey IDs/titles, including ended surveys;
do not fetch admin survey lists. The public active-survey list is not a complete
historical reporting catalog. If implementing a survey picker, keep an authorized
unfiltered catalog or reset the filter to obtain all rows again.

### Regional result

For a valid selected/profile region, `regional` contains:

| Field | Meaning |
| --- | --- |
| `status` | `available`: regional reporting was returned, even if it has zero observations. |
| `regionCode`, `regionLabel` | Canonical region code and display name. |
| `regionSource` | `selection` when `regionalRegion` was supplied, otherwise `profile`. |
| `filters` | Applied dates/timezone/participants plus `regions: [regionCode]`, `surveyId: null`, `unknownRegionIncluded: false`, `surveyVisibility: "all-existing-surveys"`. |
| `sentiment`, `sentimentDistribution` | Same summary and category shapes as Overview; based on the dashboard regional rules. |
| `satisfaction`, `satisfactionDistribution` | Same shapes as their top-level equivalents, with the regional scoring scope. |
| `analyzedSubmissions` | Integer or null. Each submission with at least one valid eligible sentiment result counts once. Repeated/anonymous submissions count. |
| `linkedAnalyzedSubmissions` | Integer number of submissions with resolved links. |
| `submissionCountStatus` | `exact` or `incomplete`. Missing/ambiguous links can make the exact count unavailable. |
| `satisfactionScope` | Literal `linked_analyzed_submissions`. Regional satisfaction only includes scored answers linked to submissions with sentiment results in the window. |

Regional does NOT return survey rows, raw answers, identities, linkage identifiers,
model probabilities, or dashboard linkage diagnostics for other regions.

Without a recognized unambiguous profile region and without an override:

```json
{
  "status": "region_required",
  "regionCode": null,
  "regionLabel": null,
  "regionSource": "profile",
  "filters": {
    "timeRange": "custom",
    "startDate": "2026-10-28",
    "endDate": "2026-10-28",
    "regions": [],
    "surveyId": null,
    "unknownRegionIncluded": false,
    "timezone": "Asia/Manila",
    "surveyVisibility": "all-existing-surveys",
    "participants": "all"
  }
}
```

This variant omits sentiment, satisfaction, and submission counts. Prompt the user
to set a region through the existing settings flow. Overview and Trends remain
usable. Do not display national totals or fabricate zero regional values.

## 4. Bind the three mobile portions

1. **Overview:** display separate Calm and Worried counts/shares from the top-level
   `sentimentDistribution`. Show coverage from `sentiment`. Optional overall change
   comes from `sentimentTrends.overviewChange`, labeled with both reporting periods.
   Satisfaction remains a separate measure if already present in the design.
2. **Trends:** show each returned survey's current Calm/Worried split, analyzed
   answer count/coverage, and signed `changeFromOverviewBaseline` with a label such
   as "vs previous Overview". Show `changeFromPreviousPeriod` separately as "vs this
   survey's previous period". Include the baseline dates. Use cards/bars or another
   existing widget suited to separate surveys; do not connect survey IDs as a daily
   time series. Use a missing-baseline state when changes are null.
3. **Regional:** display the returned region label, Calm/Worried shares and coverage
   from `regional`, not the top-level totals. If showing responses analyzed, use the
   submission counts and distinguish them from answer counts. Keep regional
   satisfaction separate; its population differs from Overview satisfaction.

Use server percentages/deltas; formatting and chart unit conversion are the only
client calculations needed. Never average survey shares or model probabilities.
There is no neutral TEXT sentiment. Neutral satisfaction is a separate scored
rating category. Do not reconstruct daily Calm/Worried history from aggregate
survey comparisons; this response does not expose that series.

For Dart, decode numeric shares/deltas with `(value as num?)?.toDouble()`. Keep
nullable shares, changes, satisfaction category counts, and analyzed submission
counts nullable. Do not use `?? 0` to erase missing data. Validate mandatory fields
and treat malformed data as a controlled parsing error. Round only for display.
Use signed `pp` labels and normalize rounded negative zero to displayed zero.

## 5. Loading, refresh, and availability

Use one repository/service method and one response state for the three sections.
Reuse the existing authenticated HTTP client and state-management approach. Cache
by authentication context and ALL query parameters, including `regionalRegion` and
the effective region setting. Ignore/cancel superseded requests so old region or
filter results cannot overwrite the current scope. Clear account caches on logout.

Default to last 30 days, all eligible surveys, all Overview/Trends regions, and the
app's selected region or account-region fallback for Regional. Refresh on explicit
user action, appropriate existing screen focus/resume, and region-setting changes.
Do not issue per-survey requests or add aggressive polling. If a same-scope refresh
fails, old results may remain clearly marked stale. Never present old-scope results
as current after a scope change.

| State | UI behavior |
| --- | --- |
| No eligible answers; coverage null | No eligible feedback; unavailable percentage. |
| Eligible > 0, predicted = 0 | No analyzed results yet; coverage can be measured 0%. |
| Predicted < eligible | Show incomplete analysis and analyzed/eligible counts. Missing results are not automatically pending/failed. |
| Category share/change = 0 | Display measured zero/unchanged. |
| No previous/current analyzed denominator | No comparable results; leave change null. |
| `not_configured` | Measure unavailable for the selected surveys, not a network error. |
| Regional `region_required` | Show set-region state; preserve Overview/Trends. |
| Regional `available` with no observations | Empty regional data, not region-required or a transport error. |
| `analyzedSubmissions: null` | Exact count unavailable; display the linked count with qualification if useful. |
| Missing required new blocks | Unsupported backend build or parsing error; do not substitute unrelated charts. |

All sentiment counts are ANSWERS, not unique participants. Submission counts are
explicitly named. API percentages already use 0-100. Historical windows are
recomputed with current stored results. No polling interval proves processing is
complete.

Existing satisfaction charts may use `satisfactionTrend`. Its omitted dates/null
shares must remain gaps, not zero-filled or connected across absent days. It has
no daily Neutral/Dissatisfied counts. Do not substitute that chart for sentiment
Trends or infer missing daily category counts from totals.

HTTP 400 means invalid filters (including region selection), 401 means invalid or
expired mobile session, 404 means a selected survey is unavailable, 422 is request
validation, and 503 means reporting configuration unavailable/invalid. Handle
network/5xx failures with retry. Error `detail` may be a string or structured list.
No error becomes a successful zero report. A route-level 404 or unexpected 403 may
indicate deployment/gateway mismatch; report sanitized URL/status, never tokens.

The processing flow remains: survey submission -> survey responses -> End Survey
stages per-answer analytics -> explicit admin Process stores classifications ->
GET reads stored results. Recent submissions can remain absent/unclassified until
staging/processing. Mobile must never call Process, End Survey, configuration
writes, inference, or raw participant-result endpoints to fill these sections.

## 6. Execute and verify in the mobile repository

Proceed autonomously in this order; use the actual project paths and commands:

1. Inspect instructions/current changes, locate all three portions and existing
   region setting, and identify shared networking, token, models, state, and tests.
2. Add feature-local transport models for the documented fields, including both
   Regional variants and all nullable counts/shares/deltas. Preserve legacy fields
   used elsewhere. Add the new query parameter to the existing reporting method.
3. Fetch once for the current scope. Wire Overview, Trends, and Regional to the
   correct response objects. Implement clear comparison labels, current/baseline
   period labels, and missing-data/region states using existing UI conventions.
4. Add synthetic fixtures and meaningful model/repository/state/widget tests for
   the acceptance checks below. Run the project's formatter, static analysis,
   focused tests, and relevant existing regression checks. Fix introduced failures.
5. If a development backend/session is available, verify authenticated requests and
   a screen on an emulator/device. Check presence of the new blocks before claiming
   compatibility. Do not invent a URL, credentials, or device-test result.
6. Complete all local work even if deployment/session access is missing. Report
   precisely which live verification remains blocked and the prerequisite.

Acceptance checks:

- One existing mobile endpoint, existing mobile token, correct `/api` composition.
- Overview displays both Calm/Worried; all-survey shares are weighted by answers.
- Both per-survey comparison types match the synthetic example above and are
  labeled differently. Baseline dates are visible; no "since last visit" claim.
- Default, custom, rolling, future-capped, Philippine-midnight, empty, tie, partial
  analysis, zero change, and missing baseline cases retain correct semantics.
- Ended surveys/titles appear; hidden/future/draft survey IDs/titles do not leak
  into the mobile survey list. No admin catalog request is introduced.
- `regionalRegion` overrides the profile only for Regional. Top-level `regions`
  and `surveyId` do not affect Regional. A profile change does not relocate old data.
- Missing/conflicting region -> set-region state; recognized empty region -> no data.
- Regional submission counts remain nullable when links are incomplete; answer
  counts are not relabeled as people. Regional satisfaction uses its stated scope.
- Older/slower responses cannot replace a new region/filter/account scope.
- 401 follows existing session handling; invalid/parsing/network errors never
  fabricate zero results. Logout clears cached regional and report state.
- No regression in submissions, Mobile Surveys, navigation, or other features.

## 7. Completion report required from the receiving agent

Return files changed, the actual API base/path and token reuse, query/region mapping,
field-to-widget mapping, comparison labels and null handling, refresh/cache behavior,
and exact commands/check outcomes. State whether device/deployed checks actually
ran and any deployment prerequisite. Confirm no backend/admin access changes,
production writes, deployment, dependency upgrades, or unrelated changes occurred.

## Backend implementation and verification

- `server/routes/mobileSentimentPulseRoutes.py`: existing GET `/trends`; no new URL.
- `server/api.py`: existing `/api/mobile/sentiment-pulse` mount.
- `server/controllers/sentiment_pulse/mobile_trends.py`: preserves original fields;
  adds previous-period survey comparisons, cutoff, and selected/profile Regional.
- `server/controllers/sentiment_pulse/annotation_reporting.py`: shared dashboard
  answer aggregation reused for both periods from one stored-answer read.
- `server/controllers/sentiment_pulse/regional_reporting.py`: unchanged shared
  dashboard regional service, including submission assignment/linkage/scoring.
- `server/controllers/sentiment_pulse/annotation_controller.py`: unchanged admin
  endpoints and role requirements. Mobile never calls them directly.
- `server/tests/test_sentiment_pulse_mobile_trends.py`: isolated auth, visibility,
  weighted changes, dates, nulls, Regional parity/selection, and read-only contracts.

Verification performed in this workspace:

```powershell
.\services\sentiment-analysis-service\.venv\Scripts\python.exe server/tests/test_sentiment_pulse_mobile_trends.py
.\services\sentiment-analysis-service\.venv\Scripts\python.exe server/scripts/run_sentiment_pulse_checks.py
```

The final focused mobile suite passes **16 tests**. The compatibility runner passes
all **11 suites**; six opt-in database-dependent tests are skipped because their
test database configuration is absent. The final added region/cutoff boundary test
was also verified in the focused suite. `git diff --check` passes.

Tests use in-memory storage with real MongoDB blocked; no live data, inference,
deployment, production load, or mobile UI is implied. The reporting scan remains
in Python; do not infer high-frequency polling capacity from contract tests.
