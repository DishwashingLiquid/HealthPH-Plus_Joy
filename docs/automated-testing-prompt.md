Use the following prompt with another AI:

```text
You are performing automated Phase 6 QA on an existing repository after a Health Literacy Hub frontend refactor. Your job is to inspect, start, exercise, and report on the app without changing any tracked source files.

Hard rules:
- Do not modify application code, config, routes, tests, package manifests, lockfiles, env files, build settings, or tracked assets.
- Do not "fix" issues you find.
- You may install dependencies locally and run the app, but you must leave repo-tracked files unchanged.
- Prefer browser automation for coverage, diagnostics, screenshots, and UI verification notes.
- Report all issues you detect for every tested route, tab, modal, and interaction.

Repository shape:
- Frontend: React + Vite in `client`
- Backend: FastAPI in `server`
- Frontend API base URL is expected to be `http://localhost:8000/api`

Phase under test:
- Phase 6 only: Health Literacy Hub Frontend Refactor

Phase 6 QA goal:
Verify that the Health Literacy Hub frontend refactor preserved behavior exactly while splitting files by concern. Focus on route rendering, tab switching, CRUD flows, media upload/preview flows, search, analytics tab behavior, CSV/PDF export reachability, and modal behavior.

What this QA must emphasize:
- Health Literacy Hub shell rendering
- Tab rendering and tab switching
- Articles, Videos, Infographics, and Analytics tab behavior
- Create, edit, delete, upload, preview, search, and export behavior
- Modal/backdrop/container styling and close behavior
- Payload-affecting form behavior as observed from requests
- Print/export reachability for analytics PDF flow
- Console/runtime regressions
- Failed requests and broken state transitions

Execution requirements:
1. Inspect the repository first to confirm startup commands, route structure, and obvious constraints.
2. Start the frontend from `client` using Vite.
3. Start the backend from `server` using FastAPI.
4. Use the existing `client/.env` value pattern with `VITE_API_URL=http://localhost:8000/api`.
5. Use the backend environment already expected by `server/api.py`.
6. Do not modify repo files to make the app easier to test.

Recommended startup approach:
- Frontend:
  - working directory: `client`
  - install dependencies if needed
  - run the Vite dev server
- Backend:
  - working directory: `server`
  - create/use a virtual environment if needed
  - install `requirements.txt` if needed
  - run `python main.py`

Authentication and session requirements:
- This repository uses an OTP-based login flow.
- Prefer injecting a pre-authenticated session after the app loads.
- Preferred placeholders:
  - `<AUTH_LOCALSTORAGE_JSON>` for `localStorage["auth"]`
  - `<AUTH_COOKIE_TOKEN>` for the `token` cookie
- If valid injected session values are available, apply both, refresh, and use them for protected/admin route testing.
- If injected session values are not available, attempt sign-in with these fallback credentials:
  - email: `janzzendeleon@gmail.com`
  - password: `Admin123!`
  - OTP: `000000`
- Important: those fallback credentials are login credentials, not a cookie token value. Do not set the cookie token to the email or password.
- If auth or OTP still prevents protected-route access, mark protected/admin pages `blocked` and explain that coverage was limited by session/auth requirements.

Session injection requirements:
- Set `localStorage["auth"]` to the exact JSON string supplied in `<AUTH_LOCALSTORAGE_JSON>`.
- Set the `token` cookie to the exact value supplied in `<AUTH_COOKIE_TOKEN>`.
- Refresh after injection and confirm protected navigation is available.
- If the session is invalid or insufficient for a route, mark that route `blocked` and explain why.

Routes and surfaces that must be covered for Phase 6:

Auth access:
- `/login`

Protected routes:
- `/dashboard`
- `/dashboard/health-literacy-hub`
- `/print` only if meaningfully reachable through the analytics export flow

Health Literacy Hub surfaces that must be covered:
- page shell and intro cards
- tab bar
- `Articles` tab
- `Videos` tab
- `Infographics` tab
- `Analytics` tab

Phase 6-specific interactions that must be exercised:

Login and access:
- Verify the login page renders.
- Attempt authenticated access using injected session values if available.
- If not available, use the fallback email/password and complete OTP with `000000`.
- Confirm the app can reach `/dashboard/health-literacy-hub` after auth.

Health Literacy Hub shell:
- Confirm page title, subtitle, intro cards, and tab controls render.
- Confirm tab switching works without blank states or crashes.
- Confirm admin shell/header/sidebar styles remain usable.

Articles tab:
- Verify content list renders.
- Use search and confirm results update without crashes.
- Open the create modal.
- Verify title, description, language picker, publish options, fact-check controls, and action buttons render correctly.
- Create one low-risk test article if the environment allows it.
- Re-open or edit that article and verify existing values populate correctly.
- Edit at least one field and save.
- Open article share behavior if reachable and note whether native share or clipboard fallback works.
- Delete the created article if delete is available and safe.

Videos tab:
- Verify content list renders.
- Use search and confirm results update without crashes.
- Open the create modal.
- Verify media upload controls render.
- Upload one small safe test video file if possible.
- Confirm media preview appears immediately in the form.
- Confirm duration handling appears populated if the app derives it.
- Save if the environment allows it.
- Open a video preview modal from the grid.
- Verify preview media, publish info, tags, and close behavior.
- If an editable video exists, verify edit modal population and save flow.

Infographics tab:
- Verify content list renders.
- Use search and confirm results update without crashes.
- Open the create modal.
- Verify image upload controls render.
- Upload one small safe test image file if possible.
- Confirm preview appears immediately in the form.
- Save if the environment allows it.
- Open an infographic preview modal from the grid.
- Verify preview image, download action visibility, publish info, and close behavior.
- If editable content exists, verify edit modal population and save flow.

Delete flow:
- Explicitly verify the delete confirmation modal if delete is reachable.
- Confirm backdrop, container, body copy, buttons, and close behavior.
- If delete succeeds, confirm the deleted item no longer appears after refresh/reload when appropriate.

Analytics tab:
- Open the analytics tab.
- Verify overview metrics render without crashes.
- Exercise all three filters:
  - time range
  - content type
  - region
- Verify filter changes do not break rendering.
- Trigger CSV export if available and confirm the action reaches a browser download attempt.
- Trigger PDF export if available and confirm whether it navigates to `/print` with usable print/report UI.
- If `/print` depends on navigation state and cannot be entered directly, mark it `blocked` and explain the prerequisite.

Modal checks:
- Explicitly verify at least these modal types if reachable:
  - create content modal
  - edit content modal
  - delete confirmation modal
  - media preview modal
- For each opened modal, check:
  - backdrop visible
  - container visible
  - body content styled
  - actions/buttons styled
  - close behavior works

Data mutation rules:
- Use low-risk clearly labeled content only, for example titles prefixed with `QA-P6-HealthLiteracyHub-<timestamp>`.
- Prefer creating one item per content type only if needed to verify the required behavior.
- If creating data is required and succeeds, prefer deleting that same test data before finishing when delete works.
- If deletion fails or is unavailable, report the exact leftover test items created.

What counts as an error:
- Console errors
- Uncaught exceptions
- Unhandled promise rejections
- Failed network requests
- Hanging network requests that prevent the page from becoming usable
- Failed API requests
- Blank screens
- Crashed renders
- Redirect loops
- Tab switch failures
- Broken create/edit/delete/upload/preview/search/export interactions
- Missing modal content or broken modal close behavior
- Incorrect form prefill during edit
- Broken print/export navigation

What does NOT need deep coverage:
- Do not do exhaustive design review.
- Do not do deep accessibility auditing.
- Do not do exhaustive validation edge-case testing beyond smoke coverage.
- Do not test unrelated dashboard modules.
- Do not mutate production-like data beyond the minimum needed for the required Phase 6 checks.
- Do not attempt code changes to confirm fixes.

Testing behavior requirements:
- Wait for app readiness before judging a page as failed.
- For each route/tab/modal, allow enough time for requests and rendering to settle.
- Capture console and network activity while each page is loading and while performing primary smoke interactions.
- If a route is reachable but data-dependent, still test it and report runtime/data errors rather than skipping it.
- Mark a route or interaction `blocked` only when access truly depends on missing or invalid auth/session/role/navigation-state/data prerequisites that prevent meaningful entry.
- If a page loads but shows errors, that is `fail`, not `blocked`.

Minimum screenshot expectations:
- Take at least one screenshot for:
  - login page
  - Health Literacy Hub shell
  - each tab
  - each modal type opened
  - print/report surface if reachable
- Take extra screenshots for any detected regression or runtime issue.

Output format:
Produce sections in the exact order below, then a final summary.

Required sections:
1. `Startup and auth`
2. `Route: /login`
3. `Route: /dashboard`
4. `Route: /dashboard/health-literacy-hub`
5. `Tab: Articles`
6. `Tab: Videos`
7. `Tab: Infographics`
8. `Tab: Analytics`
9. `Route: /print`
10. `Created test data`
11. `Final summary`

For sections 2 through 9, include:
- `Access result:` one of `accessible`, `blocked`, or `redirected`
- `Render result:` short plain-English description
- `Behavior result:` short plain-English description of the relevant interactions
- `Console errors:` list or `none`
- `Failed requests:` list with method, URL/path, status, and short reason, or `none`
- `Interaction failures:` list or `none`
- `Modal/export notes:` short note or `none`
- `Screenshot status:` `taken`, `not taken`, or `not supported`
- `Verdict:` one of `pass`, `fail`, or `blocked`

For `Startup and auth`, include:
- how frontend and backend were started
- whether injected session values were used
- whether fallback login credentials were used
- whether OTP `000000` was used
- whether protected access succeeded

For `Created test data`, include:
- every created article/video/infographic title
- whether each item was edited
- whether each item was deleted
- any leftover test data that could not be cleaned up

For `Final summary`, include:
1. `Summary by severity`
   - critical
   - major
   - minor
2. `Summary by surface`
3. `Phase 6 behavior-preservation notes`
4. `Authentication/session notes`
5. `Unverified areas`
6. `Proceed / stop recommendation for Phase 7`

Verdict rules:
- `pass` = the route/tab was meaningfully reachable and no runtime or behavior regressions were detected during smoke testing
- `fail` = the route/tab was reachable but had one or more runtime, render, request, interaction, modal, or export problems
- `blocked` = the route/tab could not be meaningfully tested because of missing/invalid session, OTP/session gating, insufficient role, missing navigation state, or another hard prerequisite outside ordinary page behavior

Important interpretation notes:
- Be strict about real failures.
- Be especially strict about behavior regressions in create, edit, delete, upload, preview, search, and export flows.
- Do not over-report tiny cosmetic differences unless they affect normal use.
- If analytics export triggers browser download behavior that tooling cannot fully observe, report the last confirmed step precisely.
- If `/print` is reached with navigation state, verify the rendered print surface rather than assuming success from navigation alone.
- If the provided fallback credentials reach OTP but still do not grant protected access, report that explicitly instead of guessing session state.

Final instruction:
Return only the structured test report plus a short opening note describing how you started the frontend/backend and whether you used injected session values or the fallback login credentials and OTP. Do not include implementation suggestions or code fixes unless they are necessary to explain a detected failure.
```
