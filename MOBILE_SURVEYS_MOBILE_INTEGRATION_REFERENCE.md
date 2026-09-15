# Mobile Surveys: Mobile Integration Reference

## Scope and Source Trace

This reference covers the Mobile Surveys tab in the Sentiment Pulse Tool and its direct frontend, API, backend, and MongoDB dependencies.

Entry points:

- Dashboard route: `client/src/App.jsx:198-272` -> `/dashboard/sentiment-pulse`
- Sidebar entry: `client/src/components/admin/Sidebar.jsx:108-156`
- Tab definition: `client/src/pages/admin/sentimentPulseTool/tabs.js:1-5`
- Tab container and publication scheduling: `client/src/pages/admin/sentimentPulseTool/SentimentPulseTool.jsx`
- Survey forms and results: `client/src/pages/admin/sentimentPulseTool/MobileSurveys.jsx`
- RTK Query API client: `client/src/features/api/sentimentPulseSlice.js`
- API mount and route group: `server/api.py:75-88`
- Backend: `server/routes/sentimentPulseRoutes.py`, `server/controllers/sentimentPulseController.py`, `server/controllers/sentiment_pulse/survey_helpers.py`, and `server/models/sentimentPulseSurvey.py`
- MongoDB configuration: `server/config/database.py:24-41`

`GET /api/sentiment-pulse/regional-analysis` is the admin Regional Analysis API. It reads eligible `survey_responses`, joins verified links to `mobile_users`, and returns response aggregates; it does not read analytics-event counts or calculate sentiment.

## Feature Overview

Mobile Surveys lets an administrator create, schedule, view, edit, and delete sentiment surveys. Scheduling is the publication mechanism: a survey becomes available when its `scheduledAt` value is at or before the current Philippines time. There is no background publication job.

The requested label **Publish to Mobile** does not exist in the current dashboard. The relevant button is **Publish Survey** (`client/src/pages/admin/sentimentPulseTool/SentimentPulseTool.jsx:115, 623-632`), which opens the scheduling modal.

New surveys are created with `publishToMobile: true` and `publishToWebsite: true` hard-coded by the backend (`server/controllers/sentiment_pulse/survey_helpers.py:151-170`). The current UI has no mobile-only publication control.

No mobile application source is present in this repository. Public-survey client hooks are defined, but no dashboard component calls them (`client/src/features/api/sentimentPulseSlice.js:62-75`). Actual mobile usage is **Not confirmed in repository**.

## MongoDB Collections and Schema

| Collection | Model/schema | Relevant fields and behavior | Indexes / source |
| --- | --- | --- | --- |
| `surveys` | Request models: `SentimentPulseSurveyDraft` and `SentimentPulseSurveySchedule` in `server/models/sentimentPulseSurvey.py:6-15`. No persisted ODM schema exists. | `id`, `title`, `subtitle`, `target`, `questions`, `surveyJson`, publication flags, `scheduledAt`, response/sentiment fields, and audit fields. `status`, `publishedAt`, and `responses` are computed response fields. | Declared in `server/config/database.py:38`; indexes in `server/controllers/sentiment_pulse/survey_helpers.py:17-30`. |
| `survey_responses` | `SentimentPulseSurveyResponse` in `server/models/sentimentPulseSurvey.py`. No persisted ODM schema exists. | `id`, `surveyId`, `answers`, `platform`, optional `visitorId`, `region`, `metadata`, and `createdAt`. Authenticated submissions also store backend-derived `mobileUserId` and `accountLinkVerified: true`. One record is inserted per accepted submission. | Declared in `server/config/database.py`; indexes in `server/controllers/sentiment_pulse/survey_helpers.py`. |
| `analytics_entries` | Serialization helper: `server/schema/analyticsEntrySchema.py:1-21`. | Response side effect. Qualifying text answers create pending analytics entries with `source_type: "survey_response"`, survey/response/question IDs, platform, and region metadata. | Declared in `server/config/database.py:33`; generated in `server/helpers/analyticsEntryHelpers.py`. |

### `surveys` fields

| Field | Meaning / expected value |
| --- | --- |
| `id` | Legacy surveys retain their existing UUID/random value exactly. Newly created surveys receive the immutable server-generated application ID `SUR-00001`; this is used in API paths and as `survey_responses.surveyId`. |
| `questions` | Legacy questions retain their existing IDs. Questions created with a new-format survey receive immutable server-generated IDs such as `Q-SUR00001-01`; new questions on a legacy survey keep the legacy client-generated format. Each question ID is also its SurveyJS element `name` and response-answer key. |
| `surveyJson` | SurveyJS-compatible rendering document. Question `id` values become SurveyJS element `name` values (`MobileSurveys.jsx:100-148`). |
| `publishToMobile` | Must be `true` for mobile public retrieval. New surveys always set it to `true`. |
| `publishToWebsite` | Website equivalent. New surveys always set it to `true`. |
| `scheduledAt` | `null` means Draft. A future value means Scheduled; a value at or before the current Philippines time means Published. |
| `responseCount` | Incremented for each accepted response and serialized as `responses`. It is not capped by `target`. |
| `target` | Dashboard target/progress value only; it does not restrict submissions. |
| `sentimentBreakdown`, `dominantSentiment` | Initialized to zeroes / `Neutral`. This controller does not update them at submission time. |
| `createdBy`, `updatedBy` | Admin snapshots, omitted from public survey output. |

There is no expiry/end date, response cap, or visibility window in the current code.

There is no identifier backfill. Historic `displayId` and sequence fields may remain stored but are not serialized or rendered. New application-ID allocation is atomic through the existing `application_settings` document named `sentiment_pulse_display_sequences`; its prior state and historic assigned display values are treated as consumed numbers. Deletion and reordering never reuse or renumber IDs.

## API Endpoints

All paths are mounted under `/api` and grouped beneath `/sentiment-pulse` (`server/api.py:81, 88`).

| Method | Path | Purpose / consumer | Authentication | Request | Key response | Related tags | Status / source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/sentiment-pulse/surveys` | List surveys for the dashboard. | Bearer JWT; `Admin` or `SUPERADMIN`. | None | Array of serialized surveys. | `Sentiment Pulse`; `SentimentPulseSurveys` | Current. `sentimentPulseController.py:57-65` |
| POST | `/api/sentiment-pulse/surveys` | Create dashboard draft. | `Admin` or `SUPERADMIN`. | `title`, `subtitle`, `target`, `questions`, `surveyJson` | `201`, `{message, survey}` | Same | Current. `:120-138` |
| PATCH | `/api/sentiment-pulse/surveys/{survey_id}` | Update survey; clears schedule and responses. | `ADMIN` or `SUPERADMIN` exactly. | Create payload | `{message, survey}` | Same | Current. `:148-172` |
| DELETE | `/api/sentiment-pulse/surveys/{survey_id}` | Delete survey and response documents. | `ADMIN` or `SUPERADMIN` exactly. | Path `survey_id` | `{message}` | Same | Current. `:227-240` |
| GET | `/api/sentiment-pulse/surveys/{survey_id}/results` | Dashboard result aggregation. | `Admin` or `SUPERADMIN`. | Path `survey_id` | `{survey, questions, updatedAt}` | `Sentiment Pulse`; per-ID `SentimentPulseSurveys` tag | Current. `:75-110` |
| PATCH | `/api/sentiment-pulse/surveys/{survey_id}/schedule` | Schedule a draft for publication. | `Admin` or `SUPERADMIN`. | `{scheduledAt: ISO-date-time}` | `{message, survey}` | `Sentiment Pulse`; invalidates `SentimentPulseSurveys` | Current. `:182-217` |
| GET | `/api/sentiment-pulse/public-surveys?platform=mobile` | Fetch eligible public/mobile surveys. | Public. | Optional `platform`: `mobile` (default) or `website`. | Array of public serialized surveys. | `Sentiment Pulse`; `SentimentPulseSurveys` | Current. `:250-259` |
| POST | `/api/sentiment-pulse/public-surveys/{survey_id}/responses` | Submit mobile/website response. | Optional mobile Bearer token; invalid supplied credentials return `401`. | `answers`, `platform`, plus optional legacy `visitorId`, `region`, `metadata`. Never send an account ID. | `201`, `{message}` | `Sentiment Pulse`; invalidates survey and regional-analysis caches | Current. |

### Public survey retrieval

For `platform=mobile`, `GET /public-surveys` returns only surveys matching:

```text
scheduledAt <= current Philippines time
publishToMobile == true
```

Website retrieval uses `publishToWebsite` instead. Results are ordered by `scheduledAt` descending and then `createdAt` descending, with no pagination (`server/controllers/sentiment_pulse/survey_helpers.py:128-135`, `server/controllers/sentimentPulseController.py:250-259`).

Public serialization excludes `createdBy`, `updatedBy`, and `responseCount`, but includes computed `status`, `publishedAt`, and `responses` (`server/controllers/sentiment_pulse/survey_helpers.py:74-100`).

### Public response submission

The response body must contain a non-empty `answers` object and `platform` must be `mobile` or `website` after normalization (`server/controllers/sentimentPulseController.py:269-297`).

Both mobile and website respondents use accounts in `mobile_users`. Sign in with `POST /api/mobile/users/login`, retain its `access_token`, and send `Authorization: Bearer <access_token>` on the response request. The backend verifies the mobile token and account, persists `mobileUserId` from the token subject, and stores the account's normalized region as the response snapshot. Do not add `mobileUserId` to the JSON body; it is not accepted as proof of identity. Authenticated client-supplied region values are ignored. Anonymous legacy submissions remain accepted, but they are reported as unlinked submissions and never count as respondents. `visitorId` has no account-linking semantics.

The server confirms that the survey is already published for the selected platform. Otherwise, it returns `404` with `Published Sentiment Pulse survey not found`. It does not validate required questions, question IDs, choices, rating ranges, duplicate submissions, or the target count.

## Tags and Route Groups

| Name | Technical system | Purpose / usage | Source |
| --- | --- | --- | --- |
| `Sentiment Pulse` | FastAPI/OpenAPI tag | Groups the Sentiment Pulse routes in generated API documentation. | `server/api.py:81` |
| `/api/sentiment-pulse` | FastAPI mount and router-prefix group | Base API path for the endpoints above. | `server/api.py:81, 88` |
| `SentimentPulseSurveys` | RTK Query cache tag | Provided by list/public queries; invalidated by create, update, delete, schedule, and response mutations. | `client/src/features/api/_baseAPI.js:20-47`; `sentimentPulseSlice.js:5-75` |
| `{ type: "SentimentPulseSurveys", id: surveyId }` | RTK Query cache tag | Per-survey result/update/delete relationship. | `client/src/features/api/sentimentPulseSlice.js:9-13, 29-42` |
| `mobile-surveys` | Frontend tab identifier | Selects the Mobile Surveys tab; it is not an API tag. | `client/src/pages/admin/sentimentPulseTool/tabs.js:1-5` |
| `mobile` / `website` | Public platform selector, not a tag | Selects the publication field used for public retrieval/submission. | `server/controllers/sentiment_pulse/constants.py:40-41`; `survey_helpers.py:116-135` |

## Publish to Mobile Flow

1. An administrator opens `/dashboard/sentiment-pulse` and selects the `mobile-surveys` tab. The dashboard fetches the admin survey list through `useFetchSentimentPulseSurveysQuery()` (`SentimentPulseTool.jsx:89-114`).
2. The user creates a draft. Frontend validation requires a title, `target >= 1`, at least one question, question titles, two multiple-choice options, and valid rating bounds (`MobileSurveys.jsx:150-200`).
3. Confirming the review invokes `POST /api/sentiment-pulse/surveys` with `title`, `subtitle`, `target`, `questions`, and `surveyJson` (`SentimentPulseTool.jsx:342-374`; `sentimentPulseSlice.js:15-21`).
4. The backend inserts a `surveys` document with both publication flags `true`, `scheduledAt: null`, `responseCount: 0`, a zeroed breakdown, `dominantSentiment: "Neutral"`, and audit data (`survey_helpers.py:151-190`).
5. The user clicks **Publish Survey**. The dashboard opens `MobileSurveyScheduleModal` and offers only Draft records. It defaults the time to 15 minutes ahead, but the user may edit it (`SentimentPulseTool.jsx:115, 165-185`; `MobileSurveys.jsx:888-1013`).
6. Clicking **Schedule Selected** sends `PATCH /api/sentiment-pulse/surveys/{survey_id}/schedule` once for every selected draft with `{scheduledAt}` (`SentimentPulseTool.jsx:401-492`; `sentimentPulseSlice.js:44-50`).
7. The backend parses the time as Philippines local time, rejects malformed values and non-Draft surveys, and updates `scheduledAt`, `updatedAt`, and `updatedBy`. It does not change either publication flag (`sentimentPulseController.py:182-217`).
8. Status is derived rather than stored: no time is Draft, a future time is Scheduled, and a reached/past time is Published (`survey_helpers.py:60-85`). There is no background worker.
9. The mobile app should call `GET /api/sentiment-pulse/public-surveys?platform=mobile`. The server applies the publication flag and time criteria, so each returned record is eligible for mobile presentation.
10. A mobile submission inserts a `survey_responses` record, increments `surveys.responseCount`, and creates analytics entries for qualifying text answers (`sentimentPulseController.py:299-316`; `analyticsEntryHelpers.py:106-169`).

### Publication errors and constraints

- The UI blocks missing drafts, missing selections, and missing schedule datetimes.
- Invalid ISO datetime: `400`.
- Scheduling any non-Draft survey: `400`, `Only draft surveys can be scheduled`.
- A past schedule is accepted and makes the survey immediately eligible.
- Updating preserves `scheduledAt`, response counters, stored `survey_responses`, and analytics. Concurrent question-array edits receive `409` and must be reloaded/retried.
- Deleting removes the survey and matching response documents. Neither updating nor deleting removes previously created `analytics_entries`.

## Mobile Developer Implementation Notes

- Fetch active surveys with `GET /api/sentiment-pulse/public-surveys?platform=mobile`. The server marks this endpoint as public.
- Treat an empty array as no active surveys. On response-submission `404`, refresh the list and remove the locally cached survey.
- Render from `surveyJson` when supported; otherwise render `questions`. Submit an `answers` map keyed by each question's `id`.
- Validate required questions, option membership, and rating bounds in the mobile client. The backend only requires a non-empty `answers` object.
- Submit this shape:

  ```json
  {
    "answers": {
      "question-uuid": "answer"
    },
    "platform": "mobile",
    "visitorId": "optional-client-identifier",
    "region": "optional-region",
    "metadata": {}
  }
  ```

- Do not treat `target` as a server-enforced submission limit.
- Refresh before submission or after app resume. An administrator update makes the survey Draft again and removes stored response documents.
- Dates are handled internally as Philippines local time and serialized without an explicit offset. A mobile display-timezone contract is **Not confirmed in repository**.
- The dashboard obtains its API base URL from `VITE_API_URL` (`client/src/features/api/_baseAPI.js:4-19`).

## Legacy and Deprecated Survey APIs

No Mobile Survey endpoint is marked legacy or deprecated in the current codebase. Repository history shows the same `/sentiment-pulse/surveys` and `/sentiment-pulse/public-surveys` API family rather than a replaced route.

`GET /surveys/{survey_id}/results` was added after the original survey routes but is current and used by the dashboard.

Historical code used MongoDB collections named `sentiment_pulse_surveys` and `sentiment_pulse_survey_responses`; current code uses `surveys` and `survey_responses`. A data migration or backward-compatibility layer is **Not confirmed in repository**.

### Mixed ID deployment contract

No database migration or cleanup is performed by this code. Existing survey IDs, question IDs, MongoDB `_id` values, responses, SurveyJS names, and analytics references remain unchanged. Mobile clients must accept both the legacy IDs already returned by the API and new `SUR-*` / `Q-SUR*-*` IDs, using the returned values as route and answer keys. These readable IDs identify resources but are not authorization credentials.

The Model Access Toolkit’s Survey Responses view requests the new `survey_response` analytics type; the API also includes historic `survey` analytics entries in that view without rewriting them. New entries carry the returned survey/question IDs directly, while historic entries retain their existing legacy values.

## Gaps and Verification Needed

- No mobile application source is available, so actual mobile calls, rendering library, caching, authentication use, and error UX are **Not confirmed in repository**.
- Public RTK Query hooks exist but have no `client/src` caller. They establish an available contract, not a confirmed client implementation.
- No explicit OpenAPI response models are declared for these endpoints. Verify live JSON response shapes before release.
- Mobile-only publication is unavailable because both publication fields are hard-coded to `true` at creation.
- Role spelling differs: list/create/schedule/results require `Admin`, while update/delete require `ADMIN`; comparisons are exact (`server/middleware/requireRole.py:8-29`). Verify deployed role data before relying on edit/delete.
- There is no server-side deduplication, rate limiting, device identity enforcement, detailed answer validation, expiry, or target-response cap.
