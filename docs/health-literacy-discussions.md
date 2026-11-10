# Health Literacy media and website discussions

This change is confined to the Health Literacy Hub content area and public Articles (including the embedded listing). React 18, Tailwind 3, Inter, existing theme definitions, and dependency manifests/lockfiles are unchanged.

Calculated contrast on white is 11.55:1 for navy, 10.89:1 for body slate, and 5.71:1 for muted metadata. Gold is used for accents, not body text.

## Behavior and boundaries

- Article thumbnails and Read More use the same existing detail route and listing page state. Reading surfaces use 17–18px text, 1.7 line height, and a 72ch measure. Comments follow the body/gallery and precede Latest Articles.
- Missing article attachments omit the hero; listing cards use the bundled generic thumbnail. Real failures retain text and comments and provide local retries. MIME metadata takes priority; image/video/PDF renderers are separate. Unknown types get a document/source link. YouTube/Vimeo pages use an explicitly labeled source link, never an HTML video source. No provider SDK is added.
- Video cards start with a poster. Fine-pointer hover starts a muted preview after 500ms, for at most six seconds. Sources load on demand; one preview runs at a time. Exit, offscreen intersection, visibility change, reduced motion, unmount, and viewer opening stop/release previews. Hover emits no view analytics.
- Video viewers order the player, title, publication details, description, and comments. Playback is attempted after opening; blocked playback leaves a Play button. Controls and supplied caption tracks are supported. Closing pauses and releases the player.
- Photo viewers initially contain the entire image on a dark stage. Desktop has a white details/comments panel; mobile stacks it below. Zoom, drag/keyboard pan, fit, download, and conditional previous/next controls are included. Article gallery discussions use the parent article identity.
- The feature uses native modal `dialog.showModal()` for background inertness, keyboard containment, Escape, and focus restoration. Inline comment login stays within the same dialog. The existing `PublicFullscreenModal` lacks background inertness and also serves testimonials, so it is untouched. [Native dialog behavior](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) and [playback promise handling](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play) informed this decision. No component framework/dependency was introduced.
- Hub creation/edit forms and publishing workflows remain in their existing wrappers. Hub previews reuse viewer bodies with separate editing controls and approved-comment reading. Moderation is available in the content area; it uses the existing Admin/SUPERADMIN authorization.

## Comment API

All paths are relative to `/api/health-literacy-hub/comments` (subject to the existing API mount). A resource is `{contentId, contentType, contentOrigin}`. `contentType` is `articles`, `videos`, or `infographics`; origin is `api` or `static`.

| Method and path | Access and behavior |
| --- | --- |
| `GET /?contentId=…&contentType=…&contentOrigin=…` | Public approved comments; optional `cursor`, `limit` (1–50, default 20). |
| `POST /session` | Existing mobile email/password credentials; returns a dedicated comment token, expiry seconds, and the caller's public user ID. |
| `POST /` | Comment bearer token; resource plus plain-text `body` (1–2000 trimmed characters); returns pending submission. Extra identity/reply fields are rejected. |
| `GET /mine?contentId=…&contentType=…&contentOrigin=…` | Comment token; own submissions, statuses, cursor pagination. |
| `DELETE /{id}` | Comment token; server-enforced ownership; soft delete clears body. |
| `POST /{id}/report` | Comment token; published resource and approved comment required; one report per account/comment. |
| `GET /moderation/queue?status=pending` | Existing dashboard authorization; pending/approved/hidden, cursor pagination, report counts. |
| `PATCH /moderation/{id}` | Existing dashboard authorization; `{status: approved|hidden|deleted}`. Deleted comments cannot be restored. |

Pagination sorts descending by `createdAt` plus `_id`, including tied timestamps. Cursors are bounded, validated base64 JSON pairs. Public responses contain only ID, plain-text body, a generic public author label, and UTC creation time; they contain no email, user ID, region, role, password or PIN fields. No public counts include pending/hidden records. Flat discussions are intentional; replies and editing are not implemented.

All currently published website resources permit comments by feature policy. Publication uses the existing `publishToWebsite`, `isPublished`, and `isArchived` meanings, without new content fields. Static article IDs are explicitly allowlisted in application code and checked against the bundled article list in tests. Titles/slugs are never thread identifiers.

After unpublishing/deletion, public reading, new posts, reports, and approval return 404. Existing comments remain in the dedicated collection; owners can still read/delete their own submissions, and moderators can hide/delete them. Removed or ineligible accounts cannot write. Existing approved comments retain their body and show “Removed account”; no private profile snapshot is stored.

## Authentication and sessions

Comment login reuses `MobileLoginRequest`, the existing stored-hash selector, and canonical bcrypt/legacy PBKDF2 verifier. Eligibility is the existing `source=mobile_registration`, `roleId=user` rule, with an existing stable public `id`. Region is not restricted. It deliberately avoids calling the optional password-migrating mobile handler, so even a deployment that enables legacy migration gets **no user writes from comment login**. Existing mobile login, registration, token and PIN contracts are unchanged.

The dedicated one-hour JWT requires signature, expiry, issued-at, subject, audience `health_literacy_comments`, and type `public_comment_access`. Every protected operation resolves the subject against current `mobile_users` eligibility. Identity/ownership comes from that record, not submitted identity fields or role/region claims. Mobile/dashboard tokens cannot authorize comment writes, and comment tokens cannot authorize dashboard moderation.

The frontend stores this bearer token only in module memory, shared across this tab's comment composers. It never uses dashboard cookies, localStorage, sessionStorage, URLs, or password persistence for credentials. Comment fetches use `credentials: omit`; dashboard moderation uses only the existing dashboard base API. This accommodates the existing configurable API origin without introducing cookie-domain/SameSite/deployment changes. Credentialed CORS exists, but the deployed site relationship and third-party cookie availability were not established here; an HttpOnly cookie rollout would require a separate deployment-aware decision.

Tradeoffs: refreshing the page or closing the tab loses the comment session. Logout clears the current tab's token; there is no server revocation list, so a copied token remains valid until expiry unless the account becomes ineligible. Memory tokens remain accessible to injected same-origin script. No session collection/fields are introduced. Because authentication is an explicit bearer header, there is no ambient comment cookie requiring CSRF tokens.

Drafts alone are stored in tab-scoped sessionStorage, keyed by immutable resource identity. They survive canceled/failed login, expiry, viewer closure, and reload. Successful posting clears the draft. Login always returns to review and a deliberate Post action; it never silently publishes. Submitted comments clearly show pending approval. Signing out preserves a draft; users should avoid entering private health information, as the composer states.

## Storage and operator setup

**Only `health_literacy_comments` receives new documents or fields.** No user/content counters, settings, profile flags, or auth/session fields are added. No supporting collection is created.

| `recordType` | Fields |
| --- | --- |
| `comment` | `_id` (server ObjectId), `contentId`, `contentType`, `contentOrigin`, `userId` (existing public mobile ID), `body`, `parentId` (null), `status`, UTC `createdAt`/`updatedAt`, optional dashboard `moderatedBy`. |
| `report` | Deterministic string `_id`, `commentId`, existing public `userId`, UTC `createdAt`. No arrays. |
| `rate` | Hashed-key/window `_id`, atomic `count`, UTC `expiresAt`. No raw IP/email stored. |

Rate limits are fixed windows shared across workers: 10 login attempts per client IP per ten minutes, five posts per account per minute, and ten reports per account per minute. `Retry-After` is returned on 429. Existing reverse-proxy handling determines `request.client`; it is not changed here.

Before enabling on an intended database, review and run the opt-in script:

```powershell
# Set MONGO_URI and DB_NAME in this shell to the explicitly intended database.
python server/scripts/setup_health_literacy_comments.py       # No changes
python server/scripts/setup_health_literacy_comments.py --apply
```

The script creates or validates only this collection and installs:

- Strict record-type JSON Schema with allowed fields/types and bounded comment body.
- Public resource/status/time/ID, author/resource/time/ID, and moderation status/time/ID indexes.
- Report lookup index; the deterministic primary key prevents duplicate reports.
- TTL index on `expiresAt` for rate records. Comments/reports have no TTL field and do not expire.

**Setup was not applied to any live database.** The script does not import the live database module, load `.env`, migrate existing documents, delete data, or run automatically at server startup. Explicit operator environment variables are required. Validate existing comment data before applying strict rules to a collection already populated by another implementation.

## Changed files and scope

Paths below are relative to the repository root. Each change serves only the two requested feature areas or their verification.

| Files | Purpose / consumers |
| --- | --- |
| `client/src/pages/Articles.jsx`, `ArticlePage.jsx` | Public listing/embedded listing and article detail composition, navigation, scoped reading design and viewers. |
| `client/src/components/about-us/ArticleItem.jsx`, `ArticleMedia.jsx` | Inspected consumers are public Articles/detail; thumbnail actions and missing/loading/failure behavior. Hub imports the provider only for its new feature viewers. |
| `client/src/utils/articleMediaState.js`, `healthLiteracyWebsiteContent.js` | Article media status and website normalization; consumers remain these article views and the new Hub adapter. No unrelated utility behavior changes. |
| `client/src/components/health-literacy/FeatureDialog.jsx`, `MediaViewers.jsx`, `VideoCardPreview.jsx`, `CommentSection.jsx` | New feature-only modal, renderer/player/photo behavior, hover previews, inline login and discussion UI. |
| `client/src/utils/healthLiteracyMedia.js`, `publicCommentSession.js` | Feature-only type classification/preview lifecycle and isolated public comment transport/session/drafts. |
| `client/src/assets/css/health-literacy.css` | Local feature tokens/styles; no global theme/reset edits. |
| `client/public/assets/articles/generic-article.png` | Locally bundled generated article fallback. |
| `client/src/pages/admin/healthLiteracyHub/content/ContentTab.jsx`, `ContentCards.jsx`, `CommentModeration.jsx` | Hub-only cards, shared viewer adapters, existing Edit controls, moderation UI. Creation/edit form bodies unchanged. |
| `client/src/features/api/healthLiteracyHubSlice.js` | Adds only Hub moderation endpoints/tags; base API and existing endpoints unchanged. |
| `server/controllers/health_literacy_comments.py`, `server/routes/healthLiteracyHubRoutes.py` | Dedicated comment endpoints/auth/storage and route inclusion before dynamic content routes. Existing handlers untouched. |
| `server/scripts/setup_health_literacy_comments.py` | Explicit operator setup for the sole allowed new collection. |
| `client/tests/publicArticleMedia.test.mjs`, `healthLiteracyMedia.test.mjs` | Actual component interaction and injected-scheduler lifecycle coverage. |
| `client/tests/healthLiteracy.browser.mjs`, `healthLiteracy.preview.html`, `fixtures/healthLiteracyPreview.jsx`, `fixtures/health-literacy-tall.svg` | Isolated browser scenarios and deterministic test assets; no backend fetch forwarding. |
| `server/tests/test_health_literacy_comments.py`, `test_health_literacy_media.py`, `test_mobile_user_auth_contract.py` | Comment security/storage, route integration and canonical credential/mobile contract regression coverage. |
| `docs/health-literacy-discussions.md` | Implementation, scope, setup and verification record. |

`PublicFullscreenModal`, testimonials, navigation, public-site/about global styles, `_baseAPI`, dashboard auth, mobile auth code, deployment configuration, secrets and production data remain unchanged. The complete diff was checked for these boundaries. The testimonial's actual original modal was also opened/closed in the browser fixture after loading the new feature CSS.

## Verification record

Final results: 18 frontend tests and 36 backend tests passed, changed production frontend files passed targeted ESLint with zero warnings, Python compile checks passed, and Vite built successfully. The isolated Chrome browser suite passed. No live database setup or production data writes were performed.

Frontend commands:

```powershell
cd client
node --test --test-isolation=none tests/publicArticleMedia.test.mjs tests/healthLiteracyMedia.test.mjs
npm run build
# Targeted eslint was run over every changed production JS/JSX file, with --max-warnings 0.
# Start Vite on 5174 and isolated Chromium on debug port 9225, then:
node tests/healthLiteracy.browser.mjs
```

Backend suites must run in separate Python processes, matching their existing module-mock conventions:

```powershell
python -m unittest discover -s server/tests -p test_health_literacy_comments.py -v
python -m unittest discover -s server/tests -p test_health_literacy_media.py -v
python -m unittest discover -s server/tests -p test_mobile_user_auth_contract.py -v
```

Tests use in-memory MongoDB/GridFS with live database imports prohibited. They verify wrong signatures/audiences/types, missing/expired claims, current account resolution, forged identity rejection, ownership, publication, pending/hidden visibility, tied-timestamp pagination, reporting, rate limits, and session separation. User/content snapshots remain identical after comment operations; the only newly created collection in those tests is the comment collection. Mobile login/PIN and media contracts continue to pass.

Browser checks use local fixture content, a synthetic canvas-recorded clip, and mocked API responses. Screenshots are under ignored `.hub-build-check/health-literacy/`. Desktop 1440×1000 and mobile 390×844 checks cover all three types, long titles/descriptions, tall images, zoom/keyboard pan/fit, missing attachments, empty/loading/error comments, inline login, canceled login, expiry, deliberate posting, focus/inertness/restoration, Hub previews, and the unchanged testimonial consumer. Reduced-motion and offscreen preview cleanup are exercised; page visibility is dispatched in the fixture. Mobile keyboard geometry is emulated only by viewport/focus behavior; no physical mobile device was used.

The repository-wide lint baseline failed with 846 findings (831 errors/15 warnings) before implementation; unrelated findings were not changed. Vite builds emit CSS parsing, large-chunk and outdated Browserslist warnings. The checked-in Python virtual environment points to a missing interpreter. Backend tests were run with isolated, pinned test packages and system Python; no application dependency manifests or lockfiles were changed. The first test-package download failed pip integrity validation and was not installed; a pinned retry succeeded. Browser-access tooling was unavailable, so the repository's existing dependency-free Chrome/CDP test convention was used.

Limitations: no live MongoDB validator/index application, production authentication round trip, external-provider playback, real mobile keyboard/device, or assistive-technology audit was performed. External providers intentionally use source links. Caption rendering is supported for supplied tracks; content schema and upload workflows were not expanded to add tracks. There are no replies or comment edits.

## Thumbnail provenance

Built-in imagegen generated `client/public/assets/articles/generic-article.png`; the selected output was copied into the repository and visually inspected. It has no runtime generation dependency. Final prompt:

> Use case: illustration-story. Create one polished reusable 16:9 landscape thumbnail for health literacy articles. Solid deep navy background #003874, restrained gold #DBB324 details, simple elegant open book and small public-health learning motif in white and gold, ample negative space, crisp flat editorial illustration. No text, no titles, no logos, no medical claims, no fabricated health information. Output 16:9 landscape.
