# Mobile Sentiment Pulse: Overview and Trends — AI agent handoff

Contract verified against this backend workspace on **2026-10-29, Asia/Manila**.

## Task for the receiving mobile AI agent

Implement the mobile **Overview** and **Trends** reporting integration using the
existing authenticated mobile API described here. Inspect your mobile repository's
`AGENTS.md`, existing feature structure, API client, authentication, state
management, chart widgets, and tests first. Follow those patterns and preserve
uncommitted work. Implement and verify the integration; do not stop at a plan.

Limit your changes to this mobile reporting feature and necessary wiring. Preserve
Regional Analysis, survey listing/submission, Mobile Surveys, other dashboards,
navigation, and shared component behavior. Reuse installed dependencies. Do not
upgrade packages, redesign unrelated screens, change backend contracts, deploy,
or mutate production data as part of this handoff.

The backend route is implemented in the current working tree, including new files
that may not yet be committed. **Deployment and availability at your configured
API origin have not been verified.** Confirm the backend build containing this
route is available before claiming end-to-end completion. No Flutter/Dart source
is present in this backend/web repository; work in the actual mobile repository.

If deployment access or a development login is missing, complete the local client,
fixtures, and tests independently, then report the exact integration prerequisite.
Do not invent a hostname, credentials, response fields, or replacement endpoints.

## 1. Endpoint decision: one reporting request

| Endpoint | Role in this integration |
| --- | --- |
| `GET /api/mobile/sentiment-pulse/trends` | **Use this.** One response supplies Overview, both distributions, and the supported satisfaction trend. |
| `POST /api/mobile/users/login` | Existing sign-in, only if the app does not already have a valid mobile session. Reuse its `access_token`. |
| `GET /api/sentiment-pulse/trends` | Admin reference only. Do not call it from the mobile feature or bypass its role checks. |

The mobile route is a thin adapter around the **same**
`annotation_reporting.report` service used by admin Trends. It restricts survey
visibility and projects only mobile-required aggregates. Do not request each card
or graph separately, download raw answers, aggregate the signed-in user's own
submissions, or introduce a second reporting calculation on the client.

If the app's configured API base already ends in `/api`, append
`/mobile/sentiment-pulse/trends` once. If it is an origin without `/api`, append
`/api/mobile/sentiment-pulse/trends`. Keep environment configuration in the app's
existing location. Do not assume a physical phone can reach the development
machine through `localhost`.

Default request:

```http
GET /api/mobile/sentiment-pulse/trends?timeRange=last-30-days
Authorization: Bearer <mobile-access-token>
Accept: application/json
```

Filtered request:

```http
GET /api/mobile/sentiment-pulse/trends?timeRange=custom&startDate=2026-10-27&endDate=2026-10-29&regions=NCR
Authorization: Bearer <mobile-access-token>
Accept: application/json
```

These GET requests have no body, pagination, per-chart URL, or processing side
effect. Do not invent `userId`, `participantId`, `platform`, `questionId`, `limit`,
or `includeDetails` filters.

## 2. Authentication and population scope

Reuse the mobile session established by:

```http
POST /api/mobile/users/login
Content-Type: application/json

{"email":"<existing-user-email>","password":"<existing-user-password>"}
```

Successful login returns `access_token`, `token_type: "bearer"`, and `user`.
Use the existing session/token storage and sign-in flow; do not add a separate
reporting login or log tokens/passwords.

The reporting route verifies the existing mobile JWT (`aud: "mobile"`,
`typ: "mobile_access"`, nonempty `sub`) and checks that its subject is an existing
`mobile_users` registration with `source: "mobile_registration"` and
`roleId: "user"`. The server validates authorization; client-side JWT decoding is
not a substitute. An admin dashboard token, visitor ID, or account ID in the
query string cannot authorize this route.

**The report covers all eligible mobile participants' answers in the selected
scope, not only the signed-in user's answers.** It is also not automatically
restricted to the user's profile region. Send `regions` only when the user has
chosen a reporting region filter. Identity authorizes the read; it does not
select the answer population.

Server-side survey visibility requires:

- `publishToMobile` is true.
- `scheduledAt` is valid and no later than request time.
- Ended surveys remain eligible for historical reporting.

Drafts, future publications, website-only surveys, and missing/invalid publication
dates are excluded. An explicitly requested hidden or nonexistent `surveyId`
returns the same 404. Survey publication eligibility is evaluated at request time,
independently of the selected submission-date window.

## 3. Filters and date semantics

| Query parameter | Type/default | Behavior |
| --- | --- | --- |
| `timeRange` | String; `last-30-days` | Allowed: `last-7-days`, `last-30-days`, `last-90-days`, `custom`. |
| `startDate` | Optional `YYYY-MM-DD` | Required for `custom`; inclusive Philippine start day. Omit for rolling ranges. |
| `endDate` | Optional `YYYY-MM-DD` | Required for `custom`; inclusive Philippine end day. Omit for rolling ranges. |
| `regions` | Optional comma-separated string | Example `NCR,III`. Send existing canonical region codes. Omission includes all regions, including unknown ones. A specific region selection excludes unknowns. Server normalizes/deduplicates recognized aliases. |
| `surveyId` | Optional exact application ID | Omission means all mobile-visible surveys. Use the server's actual ID unchanged; never synthesize or parse IDs for authorization. |

Rolling windows include today plus the preceding N-1 **Asia/Manila calendar days**.
Custom start/end dates are inclusive, but answers after request time are excluded.
The current backend accepts a future custom end date and still caps observations
at request time; its echoed `endDate` remains the requested date. Do not claim the
server rejects all future dates. A mobile date picker may restrict selection to
today to avoid confusion. Invalid/missing custom dates, reversed ranges, unknown
regions, and unsupported time ranges return 400.

Use the returned `filters` as the authoritative applied scope. Preserve dates as
Philippine calendar dates. Do not convert a `YYYY-MM-DD` chart date through the
device's local timezone, use analysis timestamps, or group by survey publish date.
For example, submission `2026-10-27T16:00:00Z` belongs to **2026-10-28** in Manila.

An optional survey filter does **not** require adding a picker. This response does
not supply survey titles or an authorized list of historical surveys. The active
public-survey list excludes ended surveys, so it is not a complete reporting
survey catalog. Reuse a suitable existing authorized selection if available;
otherwise default to all surveys. Do not call the admin survey list to fill it.

## 4. Exact successful response

Synthetic example for the filtered custom request above. Totals and daily
satisfaction counts are internally consistent; the missing October 28 row is
intentional.

```json
{
  "sources": ["mobile"],
  "filters": {
    "timeRange": "custom",
    "startDate": "2026-10-27",
    "endDate": "2026-10-29",
    "regions": ["NCR"],
    "surveyId": null,
    "unknownRegionIncluded": false,
    "timezone": "Asia/Manila",
    "surveyVisibility": "published-to-mobile",
    "participants": "all"
  },
  "sentiment": {
    "status": "configured",
    "dominantCategory": "calm",
    "dominantShare": 65.38461538461539,
    "eligibleAnswers": 160,
    "predictedAnswers": 130,
    "answersWithoutResults": 30,
    "analysisCoverage": 81.25
  },
  "satisfaction": {
    "status": "configured",
    "satisfactionAnswers": 10,
    "satisfiedAnswers": 6,
    "satisfactionShare": 60.0
  },
  "sentimentDistribution": [
    {"category": "calm", "answers": 85, "share": 65.38461538461539},
    {"category": "worried", "answers": 45, "share": 34.61538461538461}
  ],
  "satisfactionDistribution": [
    {"category": "satisfied", "answers": 6, "share": 60.0},
    {"category": "neutral", "answers": 1, "share": 10.0},
    {"category": "dissatisfied", "answers": 3, "share": 30.0}
  ],
  "satisfactionTrend": [
    {"date": "2026-10-27", "satisfactionAnswers": 4, "satisfiedAnswers": 1, "satisfactionShare": 25.0},
    {"date": "2026-10-29", "satisfactionAnswers": 6, "satisfiedAnswers": 5, "satisfactionShare": 83.33333333333334}
  ]
}
```

### Feature-scoped response models

Use these JSON names exactly at the transport boundary. Keep new models local to
this feature, preserve nullable values, and tolerate unrelated additional fields.

| Object/field | JSON type | Meaning |
| --- | --- | --- |
| `sources` | Array of strings | Currently `["mobile"]`. |
| `filters` | Object | Applied scope; fields shown in the example are returned. `surveyId` is nullable; region codes are strings. |
| `sentiment.status` | String | `configured` or `not_configured`; whether applicable sentiment questions exist, not job completion. |
| `sentiment.dominantCategory` | String or null | `calm`, `worried`, `tie`, or null when no answer has been classified. |
| `sentiment.dominantShare` | Number or null | Larger Calm/Worried category's share of classified answers; 50 for a nonempty tie. |
| `sentiment.eligibleAnswers` | Integer | Answers eligible for the existing sentiment rules. |
| `sentiment.predictedAnswers` | Integer | Classified eligible answers; Calm plus Worried. |
| `sentiment.answersWithoutResults` | Integer | Eligible minus classified answers; does not identify pending/failed jobs. |
| `sentiment.analysisCoverage` | Number or null | Classified / eligible answers × 100. |
| `satisfaction.status` | String | `configured` or `not_configured`; whether applicable scoring rules exist. |
| `satisfaction.satisfactionAnswers` | Integer | Valid scored satisfaction answers, a separate denominator from sentiment. |
| `satisfaction.satisfiedAnswers` | Integer | Satisfied answers under the survey's scoring rules. |
| `satisfaction.satisfactionShare` | Number or null | Satisfied / valid scored satisfaction answers × 100. |
| `sentimentDistribution[]` | Category objects | `category`: `calm` or `worried`; `answers`: integer; `share`: number or null. |
| `satisfactionDistribution[]` | Category objects | `category`: `satisfied`, `neutral`, `dissatisfied`; `answers`: integer **or null**; `share`: number or null. |
| `satisfactionTrend[]` | Daily objects | Only `date`, `satisfactionAnswers`, `satisfiedAnswers`, and nullable `satisfactionShare`. Dates are `YYYY-MM-DD`; counts are integers. |

For Dart, decode percentage JSON numbers through `num` and convert to `double`
when needed: `(value as num?)?.toDouble()`. JSON may contain `0`, `100`, or decimal
values. Model nullable satisfaction category counts as `int?` and nullable shares
as `double?`. Do not use `?? 0` to erase unavailable values. Malformed mandatory
fields should become a controlled parsing/error state, not a successful zero report.

## 5. Bind the response to Overview and Trends

Use **one report state** and one filter scope for these sections. Adapt the
existing mobile layout; the following is a field-to-feature map, not a mandate to
redesign navigation or copy every web card.

| Feature | Response fields | Display behavior |
| --- | --- | --- |
| Overview: overall sentiment / Sentiment Score | `sentiment.dominantCategory`, `dominantShare` | Example `Calm · 65.4%`. A tie is `Calm / Worried · 50% each`. This is the most common answer category, not model confidence. |
| Overview: analysis coverage | `predictedAnswers`, `eligibleAnswers`, `analysisCoverage`, `answersWithoutResults` | Example `130/160 analyzed`, `30 without results`. Preserve incomplete coverage. |
| Overview: satisfaction summary | `satisfaction.satisfactionShare`, `satisfiedAnswers`, `satisfactionAnswers` | Example `60% satisfied`, `6/10 answers`. Keep this separate from Calm/Worried. |
| Trends: sentiment distribution | `sentimentDistribution` | Stable Calm, Worried order; category shares and answer counts. |
| Trends: satisfaction distribution | `satisfactionDistribution` | Stable Satisfied, Neutral, Dissatisfied order; category shares and answer counts. |
| Satisfaction Trend | `satisfactionTrend` | The currently supported mobile trend is the daily **Satisfied share**. Use the supplied share with the day's satisfied/total counts in tooltips or accessible text. |

The current mobile response does **not** contain survey breakdowns, raw answers,
participant identifiers, model probabilities, model metadata, regional breakdowns,
the web Worried Share time series, or the web Daily Answer Counts table. Do not
request or reconstruct these for this feature.

### Important web/mobile distinction

The web has since changed its satisfaction chart to stacked **Satisfied / Neutral /
Dissatisfied daily counts**. The mobile response currently exposes only the daily
Satisfied count, total scored count, and Satisfied percentage. It has **no daily
Neutral or Dissatisfied counts**. Aggregate distributions cannot be allocated back
to individual days.

Implement the supported mobile Satisfied-share trend with clear labeling. If the
mobile design explicitly requires the newer three-category daily count chart,
report a narrow backend requirement for those two extra daily category counts;
do not invent fields, silently substitute a different chart, or fall back to the
admin endpoint. `total - satisfied` combines Neutral and Dissatisfied and must
never be labeled Dissatisfied. This handoff does not authorize backend changes.

The web's display-only zero Neutral row in its sentiment graph does not change
the API's Calm/Worried sentiment contract. Mobile text sentiment has two classes.
Neutral in `satisfactionDistribution` refers only to satisfaction scoring.

## 6. Calculation and unavailable-value rules

All counts are **answers**, not unique people, participants, or submissions. One
survey submission can contribute multiple answers. Keep this distinction in labels
and accessibility text.

All API percentages use **0–100 units**, not fractions. Format for display, but
do not multiply by 100 again. If the chart library expects 0–1 values, convert once
in its presentation adapter without changing the model's units.

| Metric | Denominator |
| --- | --- |
| Calm or Worried share | All classified sentiment answers (`predictedAnswers`). |
| Analysis coverage | Eligible sentiment answers (`eligibleAnswers`). |
| Satisfied, Neutral satisfaction, Dissatisfied shares | All valid scored satisfaction answers (`satisfactionAnswers`). |
| Daily Satisfied share | That date's `satisfactionAnswers`. |

Use the server's aggregate percentages. Never average daily or per-survey
percentages to build the overall summary. In the sample response, overall
satisfaction is `6/10 = 60%`, not the arithmetic mean of 25% and 83.33%.

Default 1–5 ratings use 4–5 Satisfied, 3 Neutral, and 1–2 Dissatisfied. Existing
survey/operator overrides remain authoritative, including supported custom scales
or explicitly scored choices. Unsupported scales are not assigned these defaults.
The client should consume the server's scored results, not rescore raw answers.
Satisfaction uses rating/scoring rules; Calm/Worried uses stored eligible text or
choice annotations. Neither is an average model probability.

| Situation | Meaning and required UI handling |
| --- | --- |
| `eligibleAnswers == 0`, `analysisCoverage == null` | No eligible sentiment answers. Do not show 0% coverage as a measurement. |
| Eligible > 0, predicted == 0, coverage == 0, dominant == null | Eligible answers exist but no classifications are available. Show `No results yet`; no Calm/Worried percentage. |
| Predicted < eligible | Partial analysis. Display the analyzed fraction and missing-result count. Do not call missing answers Calm, Neutral, failed, or pending. |
| Positive denominator, category count 0, share 0 | A measured zero; display 0%. |
| Satisfaction denominator 0, share null | No scored satisfaction answers; show an empty/unavailable state. |
| Category `answers: null`, `share: null` | One or more scoring overrides do not define that category. Show unavailable; never infer its count or replace it with zero. |
| `status: "not_configured"` | This measure is not available for the selected surveys; not a transport error. |
| `status: "configured"` with empty/zero observations | Rules exist, but no usable observations exist in the scope. Not proof that processing completed. |
| Transport/parsing error | An error state, never a successful empty result. |

Satisfaction categories need not sum to a known 100% when mappings are unavailable.
Do not force chart segments to fill 100% or label the unknown remainder.

### Date gaps

`satisfactionTrend` is sorted by submission date. It includes only dates observed
by the shared report. A date with text-only observations may have zero satisfaction
counts and a null share; another date may be absent entirely. Leave missing days
and null shares as **gaps**. Merely disabling "connect nulls" is insufficient if
an omitted date has no row: insert a local null separator or use the chart's
calendar-aware gap mechanism. Never zero-fill missing observations or connect
across an absent day. Do not send these presentation-only separators back to the API.

## 7. State, refresh, charts, and errors

Implement a feature-local repository/service method and models using the existing
HTTP client and authenticated headers. Reuse the app's state-management approach.

1. Load once for the current filter scope; default to `last-30-days`, all regions,
   all visible surveys. Overview and Trends read the same successful response.
2. Build a cache/request key from all filters and the authentication context.
   Cancel superseded requests or ignore their responses so older requests cannot
   overwrite a newer scope. Do not mix totals from one scope with a chart from another.
3. Refresh on explicit user action and the app's existing appropriate resume/focus
   flow. Reuse established caching/debounce behavior; add no aggressive per-card
   polling. Reporting progress is not a background-job API.
4. A refresh error for the same scope may preserve previous values with a short
   stale/error indicator. After changing scope, do not present previous-scope
   values as if they matched the new filters. Clear account-bound caches on logout.
5. Keep summaries and category labels short, but retain denominators, missing-data
   states, and accessible counts. Treat each measure's availability independently:
   satisfaction may be available while text sentiment is unprocessed, and vice versa.

Suggested distribution styling matches the web: Calm `#2572A5`, Worried `#B45309`,
Satisfied `#15803D`, Neutral satisfaction gray `#687582`, Dissatisfied red `#D82727`.
Use 0–100% axes for percentage charts, stable category order, readable legends,
and accessible text/count equivalents. Fit the app's existing cards and spacing.
Chart zero values remain zero; unavailable values remain unavailable.

Typical error payload: `{"detail":"..."}`. Some validation failures can have a
structured `detail` list, so do not assume every error detail is a string.

| HTTP result | Client action |
| --- | --- |
| 200 | Parse the report; handle zero, partial, and not-configured states independently. |
| 400 | Show a short invalid-filter message; preserve the user's selection for correction. |
| 401 | Reuse session-expiry/sign-in handling. Missing, invalid, expired, wrong-audience/type tokens, and unrecognized mobile users are rejected. Do not retry indefinitely or use an admin token. |
| 404 | Selected survey is missing or unavailable to mobile. Prompt to clear/change the selection; do not retry through admin/public result endpoints. |
| 422 | Handle a validation error if returned by the framework; this is not empty reporting data. |
| 503 | Reporting configuration is unavailable/invalid. Show unavailable/retry; do not infer zero results. |
| Network error, timeout, unexpected 5xx | Show a recoverable loading error using existing app behavior. Never replace failures with fabricated zero counts. |

An unexpected 403 or a 404 for the route itself can indicate a gateway/deployment
issue. Report the URL path, HTTP status, and non-sensitive error detail; do not log
tokens or try to weaken server authorization.

## 8. Preserve processing and existing workflows

The existing server flow remains:

```text
Survey submission -> survey_responses
End Survey -> per-answer analytics_entries
Explicit admin Process -> annotate existing eligible entries
GET reporting -> read stored annotations and score stored rating answers
```

The mobile reporting client must not call Process, End Survey, configuration writes,
or inference services. GET never starts inference or stages submissions. A recent
submission can remain absent until staging; eligible staged text can remain
unclassified until processing. Rating satisfaction can be available without model
inference. Do not "fix" these states by changing submission/processing behavior,
introducing a sentiment-results collection, or overwriting stored annotations.

Existing survey submission and public-survey endpoints are separate workflows;
do not modify them for this reporting integration. Do not use old survey fields
such as `dominantSentiment`/`sentimentBreakdown` or legacy Concerned/Proactive/
Misinformed categories to populate this feature.

## 9. Implementation sequence and acceptance checks

Proceed in the receiving mobile repository:

1. Identify the actual Overview/Trends entry points, shared API base, mobile token
   provider, lifecycle refresh pattern, installed chart library, and test commands.
   Record these paths in your completion summary; do not invent repository paths.
2. Add feature-scoped request/response models and the single authenticated reporting
   method. Keep number/null semantics and exact transport field names above.
3. Bind one report state to the existing Overview/Trends widgets. Apply the same
   date/region/optional survey filters to every value and refresh.
4. Add focused model, repository, state, and widget tests using synthetic fixtures.
   Do not need a real database or model service for these tests.
5. Run the mobile repository's relevant analyzer/test/build checks and a development
   integration smoke test when the deployed route and a development session are
   available. Do not claim live verification if these prerequisites are unavailable.
6. Review your final diff for changes outside this feature. Preserve other screens,
   survey workflows, and shared interfaces.

Acceptance checklist:

- [ ] One mobile GET per selected scope supplies both sections; no admin endpoints,
  raw answer downloads, per-chart calls, or per-user answer filtering.
- [ ] A valid mobile session can load a report. Missing/expired/admin credentials do
  not silently become an anonymous or zero report.
- [ ] Scope parameters are correct for default, rolling, custom, region, and optional
  survey selections; the returned scope is retained with the report state.
- [ ] Dominant Calm, dominant Worried, 50/50 tie, no eligible answers, unprocessed
  text, and partial analysis all have distinct correct displays.
- [ ] Satisfied/Neutral/Dissatisfied aggregate distributions use their separate
  valid-scored denominator. Nullable category counts are not cast to zero.
- [ ] The sample report displays 65.4% Calm, 130/160 analyzed, 30 without results,
  and 60% satisfaction. Daily Satisfied shares are 25% and about 83.3%; no point
  is plotted for October 28. Totals are not averages of those daily percentages.
- [ ] Measured zero, missing/null values, configured-with-no-data, unsupported scales,
  and unavailable category mappings remain distinct.
- [ ] Philippine midnight, date-only parsing on a device outside Manila, omitted
  dates, and text-only dates do not shift or zero-fill observations.
- [ ] An older/slower response cannot replace a newer filter scope; logout clears
  report state; retry/error states do not expose stale-scope values as current.
- [ ] Mobile Satisfaction Trend uses only supported fields. There are no invented
  daily Neutral/Dissatisfied counts or fabricated neutral text classifications.
- [ ] No regression in Regional Analysis, Mobile Surveys, survey submission,
  other dashboards, or authentication/session behavior.

If separately authorized backend/admin test access is available, compare an
identical date/region scope and the **same mobile-visible survey** between admin
and mobile reports. Counts and percentages should match. Admin's unfiltered
all-surveys population can include surveys unavailable to mobile, so that broader
scope is not a valid parity comparison. Do not place admin credentials in the app
or bypass visibility to make totals match.

## 10. Completion report required from the receiving agent

Return a concise report covering:

- Files changed and how they connect to the app's existing architecture.
- Actual endpoint/base-path composition, authentication reuse, and filter mapping.
- Overview/Trends field mapping, null/zero handling, date-gap handling, and refresh
  behavior implemented.
- Commands/checks actually run and their results; include device/emulator checks
  only if performed.
- Any remaining deployment/session prerequisite or unsupported UI requirement,
  especially a requested three-category daily satisfaction count chart.
- Confirmation that no backend/admin access changes, deployment, production-data
  writes, or unrelated mobile workflow changes were performed.

## Backend trace and verification for this handoff

These files are the inspected source of truth in the backend repository:

- `server/api.py`: mounts the router at `/api/mobile/sentiment-pulse`.
- `server/routes/mobileSentimentPulseRoutes.py`: registers GET `/trends`.
- `server/controllers/sentiment_pulse/mobile_trends.py`: mobile auth dependency,
  account check, publication visibility, filter echo, and response allowlist.
- `server/middleware/requireMobileAuth.py`: existing mobile JWT validation.
- `server/routes/mobileUserRoutes.py` and
  `server/controllers/mobileUserController.py`: existing mobile sign-in/token.
- `server/controllers/sentiment_pulse/annotation_reporting.py`: shared stored-answer
  aggregation, counts, percentages, nullable mappings, and submission dates.
- `server/controllers/sentiment_pulse/annotation_config.py`: default and override
  eligibility/scoring rules.
- `server/controllers/sentiment_pulse/regional_analysis.py`: reused date/region and
  publication eligibility helpers; no Regional Analysis API changes are required.
- `server/controllers/sentiment_pulse/annotation_controller.py`: unchanged admin
  Trends reference; not a mobile access path.
- `server/tests/test_sentiment_pulse_mobile_trends.py`: isolated contracts for JWT
  controls, visibility, all-participant scope, web/mobile parity, read-only GET,
  Philippine dates, weighted totals, null/zero, gaps, and scoring overrides.

Backend verification recorded for this handoff: the focused mobile Trends suite
passes **8 tests**, using in-memory storage with real MongoDB construction blocked.
No live deployed endpoint, real participant data, inference service, mobile screen,
or production capacity was verified. The existing reporting service scans scoped
answers in Python; do not claim production load testing or introduce high-frequency
polling based on these contract tests.
