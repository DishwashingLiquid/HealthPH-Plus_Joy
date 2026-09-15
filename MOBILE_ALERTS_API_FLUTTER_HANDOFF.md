# Proposed mobile alert API and Flutter integration

Status: design handoff only. These endpoints, response schemas, and Flutter changes are not implemented by creating this document and are excluded from the separate dashboard/backend implementation prompt. Verify the resulting backend storage contract before a later integration task. No Flutter source has been inspected in this repository.

## Scope and dependency constraint

Provide an authenticated in-app alert inbox, alert details, and unread badge. Reuse the Flutter application's existing `http: ^1.6.0`, `shared_preferences: ^2.5.5`, and Flutter widgets. Add no dependencies.

The existing survey feature retrieves published surveys through HTTP and displays an in-app count. It is not a push transport. Alerts created while the application is closed will be fetched when it opens or resumes. Closed-app push, device registration/tokens, Firebase/APNs setup, native notifications, and push SDKs are deferred.

## Backend context

- A saved regional administrative summary triggers automatic alert generation when its total eligible report count is greater than the configured threshold, initially five. Six reports qualify at the default threshold.
- Reporting windows and reconciliation intervals are 15, 30, 60, 480, 720, or 1440 minutes; the default is 1440 minutes.
- Evaluation also occurs immediately after a summary save. Mobile retrieval has its own cadence.
- A completed alert consumes the evaluated batch; raw self-reports and historical alerts remain stored.
- A 24-hour cooldown per region and symptom filters the symptoms included in an alert. The trigger is a regional report total, not a per-symptom total.
- Alert and recipient preparation can precede mobile API availability. Do not advertise a working mobile inbox until the endpoints and Flutter integration are implemented and verified.

## Authentication and recipient visibility

All proposed endpoints require `Authorization: Bearer <mobile-access-token>`. Reuse the existing mobile JWT authentication, not a desktop dashboard token or survey visitor ID.

Derive user identity from the verified token. The existing backend targets registered mobile accounts using their stored region and creates one logical recipient record per alert/user. No device registration is required for this in-app workflow.

Return only alerts with a completed recipient assignment to the authenticated user. Do not trust a supplied user ID or region to grant access. Suggested history policy: existing assigned alerts remain in that user's history after a region change; future alerts follow the account's updated region. Newly registered users receive future assignments rather than an implicit historical backfill.

## Proposed endpoints

These are new contracts, not verified live routes.

| Method and path | Purpose | Success |
| --- | --- | --- |
| `GET /api/mobile/alerts?cursor=...&limit=20` | List the authenticated user's alerts | `200` with `items`, `nextCursor`, and `unreadCount` |
| `GET /api/mobile/alerts/{alertId}` | Retrieve one assigned alert | `200` with `item` |
| `PATCH /api/mobile/alerts/{alertId}/read` | Acknowledge that the user opened the alert | `200` with `item` and current `unreadCount` |

List requirements:

- Default page size 20; suggested bounds 1 through 100.
- Sort newest first using `(publishedAt, id)` as a stable ordering. Use an opaque cursor instead of an offset so newly created alerts do not shift subsequent pages.
- `nextCursor` is `null` when exhausted. Clients must not parse cursor internals.
- `unreadCount` is the total for the user's assigned inbox, not only the current page.
- Return an empty list and zero unread count for an empty inbox.
- Exclude incomplete or failed recipient assignments from the published inbox.

Read requirements:

- An empty JSON object is sufficient as the PATCH body. The server owns the timestamp.
- Set `readAt` only if it is currently null. Repeated acknowledgments preserve its original value.
- List/detail GETs do not mark alerts read. Opening the detail screen triggers the explicit acknowledgment.
- Do not decrement a shared global counter blindly; counts must remain correct under duplicate requests and multiple sessions.

Errors should follow FastAPI conventions using `detail`: `401` for missing/invalid mobile credentials, `404` for a nonexistent or unassigned alert, and `400`/`422` for invalid query values. Do not reveal another user's alert through different detail responses.

## Response examples

List envelope:

```json
{
  "items": [],
  "nextCursor": null,
  "unreadCount": 0
}
```

Alert object; identifiers and symptom keys below are illustrative:

```json
{
  "schemaVersion": 1,
  "id": "<opaque-alert-id>",
  "type": "regional_symptom_alert",
  "source": "automated",
  "region": "NCR",
  "regionName": "National Capital Region",
  "title": "Self-reported symptom alert - NCR",
  "message": "6 self-reports were recorded in NCR during the last 30 minutes. Reported symptoms included fever and cough. These are not confirmed diagnoses.",
  "reportCount": 6,
  "threshold": 5,
  "comparison": "gt",
  "windowMinutes": 30,
  "windowStart": "2026-09-11T03:30:00Z",
  "windowEnd": "2026-09-11T04:00:00Z",
  "symptoms": [
    { "symptomKey": "fever", "label": "Fever", "reportCount": 4 },
    { "symptomKey": "cough", "label": "Cough", "reportCount": 3 }
  ],
  "publishedAt": "2026-09-11T04:00:00Z",
  "readAt": null
}
```

Detail returns `{"item": <alert object>}`. Read acknowledgment returns `{"item": <updated alert object>, "unreadCount": <integer>}`; these are shape descriptions rather than literal JSON examples.

The regional total counts reports, not people or confirmed cases. Symptom counts can sum to more than the report total because one report can include multiple symptoms. `symptoms` contains only symptoms selected after cooldown filtering. A symptom does not individually need six reports.

## Field tags and Dart mapping

All listed alert fields are required unless explicitly nullable. Additive unknown fields should be ignored; unsupported schema versions should produce a controlled fallback instead of a crash.

| Field | JSON / Dart type | Contract |
| --- | --- | --- |
| `schemaVersion` | integer / `int` | Initial supported value `1` |
| `id` | string / `String` | Opaque stable alert identifier; use for fetching and deduplication |
| `type` | string / `String` | Routing discriminator `regional_symptom_alert` |
| `source` | string / `String` | `automated` for these new alerts |
| `region` | string / `String` | Existing canonical region code |
| `regionName` | string / `String` | Human-readable region name |
| `title`, `message` | string / `String` | Server-generated aggregate content; display as text |
| `reportCount`, `threshold` | integer / `int` | Evaluated report count and configured threshold |
| `comparison` | string / `String` | `gt` means strictly greater than |
| `windowMinutes` | integer / `int` | One of `15, 30, 60, 480, 720, 1440` |
| `windowStart`, `windowEnd` | ISO string / `DateTime` | Evaluated time bounds with an explicit offset |
| `symptoms` | array / `List<AlertSymptom>` | Included symptom objects |
| `symptomKey`, `label` | string / `String` | Stable existing identifier and display label |
| `symptoms[].reportCount` | integer / `int` | Reports containing that symptom within the snapshot |
| `publishedAt` | ISO string / `DateTime` | Time the alert was published for inbox use, not confirmed receipt |
| `readAt` | ISO string or null / `DateTime?` | User-specific first-read acknowledgment |
| `nextCursor` | string or null / `String?` | Opaque next-page marker |
| `unreadCount` | integer / `int` | Total assigned unread entries |

Serialize new API dates with `Z` or an explicit offset. Existing naive Philippine timestamps must first be interpreted as UTC+08:00 before conversion; do not append `Z` without converting. Validate required fields during parsing and handle a malformed record without breaking the entire inbox.

Do not expose internal report IDs, reporter identities, notes, contact details, cooldown reservations, batch internals, or processing errors in the mobile response.

## Flutter service and screens

Suggested structure, following existing application naming conventions:

- An `AlertService` using the existing HTTP client and authentication flow for list, detail, and read acknowledgment.
- Typed `MobileAlert`, `AlertSymptom`, and paginated-response models using Dart's existing JSON support.
- An alert inbox screen, detail screen, and unread badge in Settings.
- Existing state-management patterns; no new state-management package.

Retrieval rules:

1. Fetch after login, on authenticated app launch/resume, and on inbox entry.
2. While foregrounded, poll approximately every 30 seconds if the badge needs updating. Suspend on backgrounding/logout and dispose timers/listeners with their owning widget/service.
3. Prevent overlapping requests. Do not create a new future or timer on every widget build. A FutureBuilder can render a stored request future that changes only for an intentional refresh.
4. When switching accounts, cancel or ignore stale responses from the previous account. Scope cached hints to the authenticated user.
5. Merge pages by alert ID. Refresh the first page after resume and use a fresh pagination sequence when necessary.
6. Open detail, acknowledge reading, and refresh unread state from the server. Preserve retryable acknowledgment state if offline; do not treat a failed PATCH as confirmed server read status.

The 30-second foreground fetch cadence is independent of the administrative reporting interval. Immediate backend generation does not mean instantaneous device display. Fetching when the app resumes recovers alerts produced while it was closed.

## Use of shared_preferences

Use only for optional preferences and synchronization hints, for example:

- `healthph_alerts_last_refresh_<userId>`
- `healthph_alerts_badge_enabled_<userId>`

These keys are proposed and do not replace existing survey keys. Keep recipient membership and read state authoritative on the backend. Do not use preferences to enforce cooldowns, authorize access, or store a growing alert database. Do not introduce token storage in preferences; reuse the app's existing authentication handling. Cached timestamps are hints, not a filter that may silently skip alerts after clock drift or a failed refresh.

## UI and error behavior

- Show loading, empty, error/retry, and populated states distinctly.
- A failed refresh must not reset a previously valid unread count to zero. Keep existing entries visible and show a refresh error where appropriate.
- On `401`, follow the existing reauthentication flow. On detail `404`, refresh the inbox and explain that the alert is unavailable.
- Show titles, region, publication time, message, and read state. Render times according to the app's established locale/timezone behavior.
- Display an inbox badge, not a claim that an OS notification was sent.
- Keep historical alerts available; a report falling out of the current analysis window does not delete its already-generated alert.

## Integration checklist for the later task

- Verify actual stored fields/statuses produced by the backend implementation and map them explicitly into this versioned API.
- Ensure partial backend recipient preparation does not expose incomplete entries or fabricate recipient totals.
- Test user isolation, missing credentials, cursor pagination under new insertions, repeated read acknowledgment, multiple sessions, and correct unread counts.
- Test empty data, malformed responses, network failures, background/resume, logout/login to another account, and stale asynchronous responses.
- Verify the same alert is shown once after polling, paging, and resume.
- Verify alerts created while Flutter is closed appear after reopening. Do not claim or test closed-app push as delivered scope.
- Do not apply mobile-user inbox semantics to legacy alert records without an explicit compatibility decision.

## Deferred push compatibility

Keep stable IDs and the `type`/`schemaVersion` tags so a future notification can reference an existing inbox item rather than create another alert. A future transport may carry `alertId`, `region`, `type`, and `schemaVersion`. No push payload, device endpoint, provider configuration, native handler, or SDK installation is required for this handoff.

## Existing references

- `mobile-surveys-flutter-integration.md`: existing survey HTTP integration context.
- `server/middleware/requireMobileAuth.py`: current mobile authentication helper.
- `server/controllers/regionalAlertsController.py`: current alert and recipient preparation code; verify behavior after implementation.
- `server/config/database.py`: existing alert and delivery collections.
- [http package documentation](https://pub.dev/packages/http): HTTP client capability.
- [shared_preferences package documentation](https://pub.dev/packages/shared_preferences): local preference storage capability.
