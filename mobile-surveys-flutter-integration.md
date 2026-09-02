# Mobile Surveys Flutter Integration Guide

## Scope and Source Files

This guide covers only the **Mobile Surveys** tab of the Sentiment Pulse Tool and the survey APIs needed by a Flutter client. It excludes Sentiment Trends and Regional Analysis.

The web-admin route is `/dashboard/sentiment-pulse`; the tab identifier is `mobile-surveys`. The server mounts this API group at `/api/sentiment-pulse`. The checked-in client environment example uses `VITE_API_URL=http://localhost:8000/api`.

Primary sources:

- `client/src/pages/admin/sentimentPulseTool/SentimentPulseTool.jsx` — tab state, admin actions, validation flow, and mutations.
- `client/src/pages/admin/sentimentPulseTool/MobileSurveys.jsx` — survey/question construction, survey preview, list, schedule UI, and results UI.
- `client/src/features/api/sentimentPulseSlice.js` and `client/src/features/api/_baseAPI.js` — web API calls, cache tags, and Bearer-token header behavior.
- `server/routes/sentimentPulseRoutes.py`, `server/controllers/sentimentPulseController.py`, `server/controllers/sentiment_pulse/survey_helpers.py`, `server/controllers/sentiment_pulse/results_aggregation.py`, and `server/models/sentimentPulseSurvey.py` — route, authorization, persistence, validation, and result aggregation.

## Feature Overview

### Confirmed admin-tab behavior

1. The tab loads all surveys with `GET /api/sentiment-pulse/surveys`; it shows loading, generic error, or an empty state.
2. An admin can create a draft with text, multiple-choice, and rating questions. The web form requires a title, `target >= 1`, at least one question, every question title, at least two non-blank multiple-choice options, and `rateMin < rateMax` for ratings.
3. Before create/update, the web app displays a SurveyJS preview. An update requires an acknowledgement if the existing survey has responses or a schedule.
4. Create/update/delete actions are admin-only. Updating clears the schedule, resets response/sentiment data, and deletes stored survey responses. Deleting removes the survey and its stored responses.
5. **Publish Survey** is a scheduling action: it shows Draft surveys only and sends one schedule request per selected survey. The default UI time is the browser's local time plus 15 minutes.
6. A scheduled survey is public for mobile when `scheduledAt` is at or before the server's current Philippines time and `publishToMobile` is `true`. There is no background publishing job; status is calculated when serialized.
7. The Results action loads aggregate per-question results. It does not expose individual answers.

### Confirmed Flutter-facing behavior

Flutter should retrieve public, eligible surveys with `GET /api/sentiment-pulse/public-surveys?platform=mobile`, render the returned questions, and submit one non-empty `answers` map to the public response endpoint. No Flutter client source is present in this repository; the public query/mutation hooks exist but have no web caller.

New surveys are always created with both `publishToMobile: true` and `publishToWebsite: true`. The current admin UI has no mobile-only switch.

## API Endpoints

### Common transport and errors

- Base path: `/api/sentiment-pulse` (combine it with the deployed API origin in Flutter).
- The web client reads a `token` cookie and, when present, sends `Authorization: Bearer <token>`. The slice does not explicitly set other headers. JSON request bodies are passed to RTK Query's `fetchBaseQuery`.
- Admin endpoints require a Bearer JWT. Public endpoints declare no auth dependency; Flutter need not send a token for them.
- FastAPI returns error details in `{"detail":"..."}` for the explicit errors below. Missing/invalid Pydantic request fields normally produce FastAPI validation `422` responses; no explicit error-response model is declared.
- No endpoint has pagination, file upload, WebSocket, or subscription behavior in the inspected code.

### `GET /api/sentiment-pulse/surveys`

**Purpose:** Admin-tab survey list. Called by `useFetchSentimentPulseSurveysQuery`.

- Authentication: Bearer JWT with `user_type` or `role_label` equal to `Admin` or `SUPERADMIN`.
- Parameters/body: none.
- Success: `200` and an array of serialized survey objects, newest `createdAt` first.
- Failure/UI handling: the tab shows `Unable to load mobile surveys.`; scheduling is disabled and shows a helper error. Authorization errors are returned by the server.

```json
[
  {
    "id": "<server UUID>",
    "title": "<string>",
    "subtitle": "<string>",
    "target": 500,
    "questions": [],
    "surveyJson": {},
    "publishToMobile": true,
    "publishToWebsite": true,
    "scheduledAt": "<ISO-like Philippines local datetime, or empty string>",
    "publishedAt": "<same value when Published, otherwise empty string>",
    "status": "Draft",
    "responses": 0,
    "sentimentBreakdown": {
      "concerned": 0,
      "proactive": 0,
      "misinformed": 0,
      "neutral": 0
    },
    "dominantSentiment": "Neutral",
    "createdAt": "<ISO-like Philippines local datetime>",
    "updatedAt": "<ISO-like Philippines local datetime>",
    "createdBy": { "id": "<user id>", "name": "<name>" }
  }
]
```

`updatedBy` may also be present after an update. The server has no explicit response model, so this is a code-derived field list rather than a versioned API schema.

### `POST /api/sentiment-pulse/surveys`

**Purpose:** Create an admin draft. Called after the preview confirmation.

- Authentication: Bearer JWT; `Admin` or `SUPERADMIN`.
- Headers: web sends `Authorization` when its `token` cookie exists; body is JSON.
- Request body: `SentimentPulseSurveyDraft`; all shown top-level fields are required by the Pydantic model except `subtitle`.
- Success: `201` with a message and serialized survey.
- Errors: `400` for blank title, target below one, or no questions; `422` for invalid/missing model fields. The web review modal displays `detail` or `Unable to create the survey draft. Please try again.`

```json
{
  "title": "Dengue prevention awareness",
  "subtitle": "Briefly describe the survey purpose",
  "target": 500,
  "questions": [
    {
      "id": "question-<client generated value>",
      "type": "multipleChoice",
      "title": "Which action helps prevent dengue?",
      "required": true,
      "choices": ["Remove standing water", "Skip cleanup"],
      "rateMin": 1,
      "rateMax": 5
    }
  ],
  "surveyJson": {
    "title": "Dengue prevention awareness",
    "description": "Briefly describe the survey purpose",
    "showQuestionNumbers": "off",
    "showCompleteButton": false,
    "pages": []
  }
}
```

```json
{
  "message": "Sentiment Pulse survey draft created successfully",
  "survey": { "id": "<server UUID>", "status": "Draft" }
}
```

### `PATCH /api/sentiment-pulse/surveys/{survey_id}`

**Purpose:** Admin update. The web calls this after a confirmation warning when the survey has responses or a schedule.

- Authentication: Bearer JWT; exact allowed strings are `ADMIN` or `SUPERADMIN` (note the case differs from list/create/schedule).
- Path parameter: `survey_id` — server-generated survey UUID.
- Body: same `SentimentPulseSurveyDraft` JSON as create.
- Success: `200`, `{"message":"Sentiment Pulse survey updated successfully","survey":{...}}`.
- Side effects: resets `scheduledAt`, `responseCount`, `sentimentBreakdown`, and `dominantSentiment`; deletes matching `survey_responses` records. It does not delete already-created `analytics_entries`.
- Errors/UI handling: missing survey is `404` with `Sentiment Pulse survey not found`; validation is `400`/`422`; the web modal displays `detail` or a generic update error.

### `DELETE /api/sentiment-pulse/surveys/{survey_id}`

**Purpose:** Admin deletion.

- Authentication: Bearer JWT; exact allowed strings are `ADMIN` or `SUPERADMIN`.
- Path parameter: `survey_id`.
- Body: none.
- Success: `200`.

```json
{ "message": "Sentiment Pulse survey deleted successfully" }
```

- Errors/UI handling: missing survey is `404`; the web delete modal displays `detail` or `Unable to delete the survey. Please try again.`

### `GET /api/sentiment-pulse/surveys/{survey_id}/results`

**Purpose:** Admin Results modal only; it is not needed for a respondent-facing Flutter survey screen.

- Authentication: Bearer JWT; `Admin` or `SUPERADMIN`.
- Path parameter: `survey_id`.
- Body/query: none.
- Success: `200`; the questions are server-side aggregates of `survey_responses.answers`.
- UI handling: the modal shows `Loading survey results...`, `detail` or a generic load error, and a no-questions empty state.

```json
{
  "survey": {
    "id": "<server UUID>",
    "title": "<string>",
    "subtitle": "<string>",
    "status": "Published",
    "target": 500,
    "responses": 42,
    "dominantSentiment": "Neutral",
    "sentimentBreakdown": {
      "concerned": 0,
      "proactive": 0,
      "misinformed": 0,
      "neutral": 0
    }
  },
  "questions": [
    {
      "id": "question-<id>",
      "title": "<question title>",
      "type": "multipleChoice",
      "answeredResponses": 42,
      "rows": [
        { "label": "<option or response label>", "count": 20, "percentage": 48 }
      ]
    }
  ],
  "updatedAt": "<ISO-like Philippines local datetime>"
}
```

For `text`, rows contain the aggregate label `Non-empty text responses`; answer text is not returned. Multiple-choice and rating rows include configured options/rating values with zero counts, plus `Other / Removed option` when needed.

### `PATCH /api/sentiment-pulse/surveys/{survey_id}/schedule`

**Purpose:** Admin publication scheduling.

- Authentication: Bearer JWT; `Admin` or `SUPERADMIN`.
- Path parameter: `survey_id`.
- Request body:

```json
{ "scheduledAt": "2026-09-01T09:30" }
```

- `scheduledAt` must parse as an ISO date/time. If an offset is supplied, the server converts it to UTC+08:00 then removes the offset; without one it treats the value as Philippines local time.
- Success: `200`, `{"message":"Sentiment Pulse survey scheduled successfully","survey":{...}}`.
- Errors/UI handling: invalid time is `400` with `scheduledAt must be a valid ISO date and time`; a non-Draft survey is `400` with `Only draft surveys can be scheduled`. The web collects per-survey failures and supports partial success.

### `GET /api/sentiment-pulse/public-surveys?platform=mobile`

**Purpose:** Flutter's respondent-facing survey list.

- Authentication: public; no token is required.
- Query parameter: `platform` is optional and defaults to `mobile`; only `mobile` and `website` are accepted after lowercase/trim normalization.
- Body: none.
- Eligibility: records must have `scheduledAt <=` server Philippines time and `publishToMobile == true` for `platform=mobile`.
- Success: `200` and an array ordered by `scheduledAt` descending, then `createdAt` descending. An empty array is the confirmed no-active-surveys response.
- Error: invalid platform is `400` with `platform must be mobile or website`.

The item shape is the serialized survey shape above, except `createdBy`, `updatedBy`, and `responseCount` are removed. `questions`, `surveyJson`, `publishToMobile`, `publishToWebsite`, `responses`, `status`, and date fields remain. There is no pagination.

### `POST /api/sentiment-pulse/public-surveys/{survey_id}/responses`

**Purpose:** Flutter respondent submission.

- Authentication: public; no token is required.
- Path parameter: `survey_id` from the public survey object.
- Headers: JSON body; do not depend on browser cookies.
- Required body fields: `answers` and `platform`. `visitorId`, `region`, and `metadata` are optional.

```json
{
  "answers": {
    "question-<id>": "Remove standing water",
    "question-<rating-id>": 5,
    "question-<text-id>": "Community cleanup information is useful"
  },
  "platform": "mobile",
  "visitorId": "<optional app/device visitor id>",
  "region": "NCR",
  "metadata": {}
}
```

```json
{ "message": "Sentiment Pulse survey response recorded" }
```

- Success: `201`. The server stores the response, increments the survey's response count, and creates pending analytics entries for qualifying text answers (non-numeric text at least three characters).
- Errors: `404` if the survey does not exist or is no longer published for `mobile` (`Published Sentiment Pulse survey not found`); `400` if `answers` is empty; `400` if platform is invalid; `422` for missing/wrong Pydantic fields.
- Important: the server does **not** validate required questions, question IDs, option membership, rating bounds, duplicates, or the target response count. Flutter should validate its rendered survey before submission.

## Schemas and Data Models

### Confirmed request models

| Model | Field | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `SentimentPulseSurveyDraft` | `title` | `str` | Yes | Server trims and rejects blank. |
|  | `subtitle` | `str \| null` | No | Model default is `""`; server stores a default description if blank. |
|  | `target` | `int` | Yes | Must be at least 1. It is not a submission limit. |
|  | `questions` | `list[dict[str, Any]]` | Yes | Server requires only a non-empty list; internal question fields are not backend-validated. |
|  | `surveyJson` | `dict[str, Any]` | Yes | SurveyJS-compatible document produced by the web UI. |
| `SentimentPulseSurveySchedule` | `scheduledAt` | `str` | Yes | ISO date/time parsed as described above. |
| `SentimentPulseSurveyResponse` | `answers` | `dict[str, Any]` | Yes | Must be non-empty after model validation. |
|  | `platform` | `str` | Yes | `mobile` or `website`. |
|  | `visitorId` | `str \| null` | No | Persisted as a trimmed string. |
|  | `region` | `str \| null` | No | Persisted as supplied or an empty string. |
|  | `metadata` | `dict[str, Any] \| null` | No | Persisted as supplied or `{}`. |

### Web-authored question shape — inferred from the UI, not enforced by the server

| Field | Type | Used for |
| --- | --- | --- |
| `id` | `string` | Answer-map key and SurveyJS element `name`. The web generates `question-<timestamp>-<random>`. |
| `type` | `text` \| `multipleChoice` \| `rating` | Controls rendering and result aggregation. |
| `title` | `string` | Question label. |
| `required` | `boolean` | Client rendering/validation flag; public submission endpoint does not enforce it. |
| `choices` | `string[]` | Multiple-choice options. The web retains it on all question objects but uses it only for `multipleChoice`. |
| `rateMin` / `rateMax` | numbers | Rating inclusive bounds; web defaults to 1 and 5. |

The generated `surveyJson` has `title`, `description`, `showQuestionNumbers: "off"`, `showCompleteButton: false`, and one `pages` item named `survey-details`. Each element uses SurveyJS `text`, `radiogroup`, or `rating`; multiple-choice choices are strings and rating uses `rateMin`/`rateMax`. Flutter does not need SurveyJS: it can render the `questions` array directly, keeping answer keys equal to `question.id`.

### Confirmed serialized survey/result fields

| Object | Fields confirmed by code | Notes |
| --- | --- | --- |
| Survey | `id`, `title`, `subtitle`, `target`, `questions`, `surveyJson`, `publishToMobile`, `publishToWebsite`, `scheduledAt`, `createdAt`, `updatedAt`, `status`, `publishedAt`, `responses`, `sentimentBreakdown`, `dominantSentiment` | `status`, `publishedAt`, and `responses` are calculated on serialization. Admin output can also include `createdBy`, `updatedBy`, and internal `responseCount`; public output removes those three fields. |
| Sentiment breakdown | `concerned`, `proactive`, `misinformed`, `neutral` | Numbers displayed as percentages by the web UI. Initialized to zeroes. This controller does not update the breakdown on submission. |
| Result question | `id`, `title`, `type`, `answeredResponses`, `rows` | `rows` are `{label, count, percentage}`. The result endpoint is admin-only. |

Persistence is MongoDB (`surveys` and `survey_responses`) with documents assembled in helpers; there is no persisted ODM schema. Therefore, stored document details beyond fields written/read by the inspected code are **Needs confirmation**.

## Tags, Constants, and Metadata

| Exact name | Meaning |
| --- | --- |
| `mobile-surveys` | Frontend tab ID. |
| `SentimentPulseSurveys` | RTK Query cache tag for survey list/public-list queries; invalidated by survey and response mutations. |
| `{ type: "SentimentPulseSurveys", id: surveyId }` | Per-survey RTK Query cache tag for results/update/delete. |
| `Sentiment Pulse` | FastAPI/OpenAPI route tag. |
| `mobile`, `website` | Allowed `platform` values; select the respective publication flag. |
| `Draft`, `Scheduled`, `Published` | Server-derived survey statuses. The web also styles `Active` and `Inactive`, but the current server does not derive those values. |
| `text`, `multipleChoice`, `rating` | Web question-type constants. |
| `Concerned`, `Proactive`, `Misinformed`, `Neutral` | UI sentiment labels; stored breakdown keys are lowercase. |
| `publishToMobile`, `publishToWebsite` | Publication fields, currently hard-coded `true` at creation. They are not runtime feature flags. |
| `source_type: "survey"` | Analytics-entry side-effect metadata for qualifying text answers. Entries also include `survey_id`, `response_id`, `question_id`, `source_platform`, and region. |

No Mobile Surveys analytics event name, feature flag, real-time event, or push-notification event was found in the inspected code.

## Relevant Dependencies

| Dependency | How it is used |
| --- | --- |
| `@reduxjs/toolkit` | RTK Query defines the web list/mutation endpoints and cache invalidation. Flutter should implement equivalent refresh behavior, not reuse this library. |
| `react` / `react-redux` | Web tab state, forms, modal state, and Redux store integration. Not needed by Flutter. |
| `js-cookie` | Web reads a `token` cookie to construct the admin Bearer header. Flutter needs a separate secure-token strategy only if it implements admin endpoints. |
| `survey-core` and `survey-react-ui` | Web preview renderer for `surveyJson`. Flutter can render the documented question types natively. |
| FastAPI / Pydantic (server) | Defines routes, JWT dependencies, request parsing, and the confirmed request models. |

Native JavaScript `Date`/`toLocaleString` handle the admin schedule/display values; `date-fns` is not used by this tab.

## Flutter Integration Notes

1. Configure the deployed API base URL so the public calls resolve to `/api/sentiment-pulse/...`; do not hard-code the web development URL.
2. On the respondent screen, fetch `public-surveys?platform=mobile`. Treat `[]` as the normal empty state.
3. Render either `questions` directly (recommended for the three confirmed types) or translate `surveyJson`. Use each question's `id` as the `answers` key.
4. Enforce `required`, valid multiple-choice selections, and rating bounds locally. Send `platform: "mobile"` with every response. `region`, `visitorId`, and `metadata` are optional; only send values the app is permitted to collect.
5. After a `201`, show a completion state. After a `404` from submission, refresh the public list: an admin may have updated/deleted/unpublished the survey after it was cached.
6. Use explicit loading, empty, retry, and server-detail error states. The web UI uses simple loading/error/empty messages and does not implement automatic retries.
7. The public API is stateless and has no subscription. Refresh on screen entry/app resume and choose a cache lifetime appropriate for a survey that can be removed or reset by admins.
8. Do not stop accepting responses merely because `responses >= target`; the backend does not cap responses.

## Gaps, Risks, and Questions

### Confirmed risks

- **Date/time:** server timestamps and schedule values use Philippines time but are serialized without a timezone offset. The web schedule input is browser-local. Confirm the intended Flutter display and input timezone before release.
- **Weak public validation:** backend accepts any non-empty `answers` map and has no duplicate-submission, rate-limit, response-cap, or answer-schema enforcement.
- **Update invalidates a live survey:** an admin update clears schedule/results/responses, so a cached mobile survey can become unavailable. Handle submission `404` and refresh.
- **Sentiment fields:** response submission creates pending analytics records and increments the response count, but the inspected controller does not recalculate `sentimentBreakdown` or `dominantSentiment`.
- **No pagination:** public retrieval returns every eligible survey in one array.

### Needs confirmation from the backend/web team

- What is the production API origin and the Flutter network-security configuration (Android cleartext/iOS ATS, if applicable)?
- Is the timezone contract intentionally Philippines local time without `+08:00`, and should Flutter display schedules in local device time or Philippines time?
- Which record is authoritative for rendering: `questions` or SurveyJS `surveyJson`? The API returns both, but no Flutter implementation exists.
- How should `visitorId`, `region`, and arbitrary `metadata` be generated, consented, retained, and protected?
- Is there an analytics worker that eventually updates sentiment fields? Its contract is outside this direct survey trace.
- Should public responses be idempotent per device/user, and is abuse protection required?
- Admin authorization contains a case mismatch: list/create/schedule/results permit `Admin`, but update/delete permit `ADMIN`; role matching is exact. Confirm deployed role values.
- The server enables credentialed CORS for origins from `CORS_ORIGINS`. Browser behavior depends on deployment configuration; Flutter is not subject to CORS, and the public endpoints do not require cookies.
- No explicit OpenAPI response models or versioned contract tests were found. Verify live response shapes before shipping.

## Mermaid API and Schema Diagram

```mermaid
flowchart LR
  F[Flutter App] -->|GET public-surveys?platform=mobile| L[/api/sentiment-pulse/public-surveys]
  L --> S[Public Survey[]\nquestions + surveyJson]
  F -->|POST public-surveys/{survey_id}/responses| R[/api/sentiment-pulse/public-surveys/{survey_id}/responses]
  A[SurveyResponse\nanswers + platform + optional metadata] --> R
  R --> D[(survey_responses)]
  R --> C[(surveys.responseCount)]
  R --> X[201 message]
```

## Evidence

| Finding | Repository evidence |
| --- | --- |
| Admin route and tab | `client/src/App.jsx`; `client/src/pages/admin/sentimentPulseTool/tabs.js`; `client/src/pages/admin/sentimentPulseTool/SentimentPulseTool.jsx` |
| Create/edit/delete/schedule/list/results UI and validation | `client/src/pages/admin/sentimentPulseTool/SentimentPulseTool.jsx`; `client/src/pages/admin/sentimentPulseTool/MobileSurveys.jsx` |
| Web API paths, methods, cache tags, and auth header | `client/src/features/api/sentimentPulseSlice.js`; `client/src/features/api/_baseAPI.js` |
| API `/api` mount and CORS setup | `server/api.py`; `client/.env.example` |
| Survey route declarations and handler behavior | `server/routes/sentimentPulseRoutes.py`; `server/controllers/sentimentPulseController.py` |
| Request models | `server/models/sentimentPulseSurvey.py` |
| Publication/status/serialization/date behavior | `server/controllers/sentiment_pulse/survey_helpers.py`; `server/helpers/miscHelpers.py` |
| Result aggregation | `server/controllers/sentiment_pulse/results_aggregation.py` |
| JWT and role rules | `server/middleware/requireAuth.py`; `server/middleware/requireRole.py` |
| Persistence and analytics side effect | `server/config/database.py`; `server/helpers/analyticsEntryHelpers.py` |
