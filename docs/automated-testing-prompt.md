Use the following prompt with another AI:

```text
You are performing automated smoke testing on an existing repository. Your job is to inspect, start, exercise, and report on the app without changing any tracked source files.

Hard rules:
- Do not modify application code, config, routes, tests, package manifests, lockfiles, env files, or build settings.
- Do not "fix" issues you find.
- You may install dependencies locally and run the app, but you must leave repo-tracked files unchanged.
- Prefer browser automation for coverage and diagnostics.
- Report all issues you detect for every tested page.

Repository shape:
- Frontend: React + Vite in `client`
- Backend: FastAPI in `server`
- Frontend API base URL is expected to be `http://localhost:8000/api`

Goal:
Run a non-mutating automated smoke test across the app, page by page, and produce a structured report that flags all detected runtime and navigation issues.

Execution requirements:
1. Inspect the repository first to confirm startup commands, route structure, and any obvious constraints.
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

Authentication requirements:
- Do not use the OTP login flow interactively.
- Instead, inject a pre-authenticated session after the app loads.
- The user will provide these placeholders:
  - `<AUTH_LOCALSTORAGE_JSON>` for `localStorage["auth"]`
  - `<AUTH_COOKIE_TOKEN>` for the `token` cookie
- Apply both session values in the browser, then refresh the page before testing protected routes.
- Assume the injected session belongs to an `ADMIN` or `SUPERADMIN` unless runtime behavior proves otherwise.

Session injection requirements:
- Set `localStorage["auth"]` to the exact JSON string supplied in `<AUTH_LOCALSTORAGE_JSON>`.
- Set the `token` cookie to the exact value supplied in `<AUTH_COOKIE_TOKEN>`.
- Refresh after injection and confirm protected navigation is available.
- If the session is invalid or insufficient for a route, mark that route `blocked` and explain why.

Routes that must be covered:

Public routes:
- `/`
- `/about-the-project`
- `/articles`
- One valid `/articles/:slug` route discovered from the app itself, from page navigation, or from app data. Do not invent a slug.
- `/research-team`
- `/contact-us`
- `/full-map`
- `/login`
- `/forgot-password`

Special route:
- `/test`

Protected routes:
- `/print`
- `/dashboard`

Protected dashboard child routes:
- `/dashboard/health-literacy-hub`
- `/dashboard/NLP-insights`
- `/dashboard/disease-watch-feed`
- `/dashboard/misinformation-tracker`
- `/dashboard/model-access-toolkit`
- `/dashboard/trends-map`
- `/dashboard/sentiment-pulse`
- `/dashboard/trends-map/upload-dataset`
- `/dashboard/user-management`
- `/dashboard/user-management/add-user`
- `/dashboard/help`
- `/dashboard/activity-logs`
- `/dashboard/settings`
- `/dashboard/settings/edit-email`
- `/dashboard/settings/edit-password`

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
- Primary navigation failures
- Broken primary smoke interactions on the page

What does NOT need deep coverage:
- Do not do full visual QA.
- Do not do deep accessibility auditing.
- Do not do exhaustive form validation beyond smoke testing.
- Do not attempt code changes to confirm fixes.

Testing behavior requirements:
- Wait for app readiness before judging a page as failed.
- For each page, allow enough time for initial requests and hydration/rendering to settle.
- Capture console and network activity while each page is loading and while performing one or two primary smoke interactions.
- If a route is reachable but data-dependent, still test it and report runtime/data errors rather than skipping it.
- Mark a route `blocked` only when access truly depends on missing or invalid auth/session/role/data prerequisites that prevent meaningful entry.
- If a page loads but shows errors, that is `fail`, not `blocked`.
- Note role-dependent behavior where relevant.

Minimum smoke interactions:
- Public content pages: confirm the main content renders and key links/buttons respond.
- Articles index: open at least one real article detail page.
- Login and forgot-password pages: confirm the forms render and accept input; do not complete OTP flow.
- Dashboard pages: confirm the page renders after auth injection and exercise at least one obvious primary interaction if available, such as tab switching, filters, table rendering, navigation, or modal opening, without mutating application data when avoidable.

Output format:
Produce one section per page in the exact order below, then a final summary.

For each page, include:
- `Route:`
- `Access result:` one of `accessible`, `blocked`, or `redirected`
- `Render result:` short plain-English description
- `Console errors:` list or `none`
- `Failed requests:` list with method, URL/path, status, and short reason, or `none`
- `Interaction failures:` list or `none`
- `Screenshot status:` `taken`, `not taken`, or `not supported`
- `Verdict:` one of `pass`, `fail`, or `blocked`

Verdict rules:
- `pass` = page was meaningfully reachable and no errors were detected during smoke testing
- `fail` = page was reachable but had one or more runtime, render, request, redirect, or interaction problems
- `blocked` = page could not be meaningfully tested because of missing/invalid session, insufficient role, or another hard prerequisite outside ordinary page behavior

After the per-page sections, add:
1. `Summary by severity`
   - critical
   - major
   - minor
2. `Summary by route`
3. `Authentication/session notes`
4. `Unverified areas`

Important interpretation notes:
- Be strict about logging real failures.
- Do not over-report cosmetic issues unless they block normal use.
- If a route redirects by design and still reaches a usable destination, explain that clearly.
- If you discover additional routes while testing, mention them separately, but do not omit any required route above.
- If tooling limits prevent screenshots, say so explicitly.

Final instruction:
Return only the structured test report plus a short opening note describing how you started the frontend/backend and how you injected the session. Do not include implementation suggestions or code fixes unless they are necessary to explain a detected failure.
```
