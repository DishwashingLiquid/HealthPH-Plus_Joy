# Dashboard Test Report

## Scope
- Included the routed dashboard pages, shared shell, dashboard-like unrouted files, and the reusable components listed in the request.
- Roles reviewed statically: `USER`, `ADMIN`, and `SUPERADMIN`.
- Runtime verification was attempted, but the app could not boot locally in this workspace.
- Assumptions: I treated the current repo as authoritative and did not edit any application code. There was already a pre-existing uncommitted change in `client/src/pages/admin/Help.jsx`, and I left it untouched.

## Shared Dashboard Shell
### AdminLayout
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: `Navbar`, `Sidebar`, disabled-user branch, dashboard outlet layout.
- Errors and blockers
- BLOCKED: no live browser pass was possible.

### Navbar
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: account menu, logout modal, desktop/mobile nav links.
- Errors and blockers
- BLOCKED: no live browser pass was possible.

### Sidebar
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: primary nav links, hamburger toggle.
- Errors and blockers
- BLOCKED: no source-level crash found during inspection.

### Access Control / Disabled User / PWA Behavior
- Page-level tests: static review only.
- Components: `DashboardMiddleware`, `AuthMiddleware`, `AdminLayout`, route-level guards in `App.jsx`.
- Errors and blockers
- BLOCKED: no test credentials were available for live USER, ADMIN, SUPERADMIN, or disabled-user verification.
- BLOCKED: PWA-only hiding of admin routes was visible in source, but could not be exercised in a browser.

## Routed Dashboard Pages

### /dashboard - AISurveillance
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: `Map`, `Report`.
- Errors and blockers
- BLOCKED: no source-level crash found during inspection.

### /dashboard/health-literacy-hub - HealthLiteracyHub
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: `ArticlesTab`, `VideosTab`, `InfographicsTab`, `AnalyticsTab`, `ContentTab`, `ContentShared`, `AnalyticsShared`, `OverviewAnalyticsPage`.
- Errors and blockers
- BLOCKED: no source-level crash found during inspection.

### /dashboard/NLP-insights - NLPInsights
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: `NamedEntityRecognition`, `SentimentAnalysis`, `LanguageDetection`, `Report`.
- Errors and blockers
- BLOCKED: no source-level crash found during inspection.

### /dashboard/disease-watch-feed - DiseaseWatchFeed
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: recent alerts panel, regional coverage chart, user analytics cards.
- Errors and blockers
- BLOCKED: no source-level crash found during inspection.

### /dashboard/misinformation-tracker - MisinformationTracker
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: summary cards, trend chart, source pie chart, claims table.
- Errors and blockers
- BLOCKED: the page is mostly static/demo content; I did not find a source-level crash.

### /dashboard/model-access-toolkit - ModelAccessToolkit
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: `TabButton`, `ModelComparison`, `DataManagement`, `TrainingLogs`.
- Errors and blockers
- Severity: Medium
- Page/component: `ModelAccessToolkit` -> `DataManagement`
- Role affected: users who can reach this subtab
- Reproduction steps: Open Model Access and Toolkit, switch to Data Management, then click `Preview`, `Download`, or `Delete` on any dataset row.
- Expected result: each control should open a preview, start a download, or trigger a delete confirmation.
- Actual result: the buttons render with no handlers.
- Probable cause: placeholder UI that was never wired up.
- Evidence: [ModelAccessToolkit.jsx](C:/Users/Janzzen/HealthPH-Plus_Joy/client/src/pages/admin/ModelAccessToolkit.jsx#L257)

### /dashboard/trends-map - TrendsMap
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: `Map`, `MapScreenshot`, `PrintTrendsMap`, `SidebarDataItem`, `Modal`, `EmptyState`, `MultiSelect`, `CustomSelect`.
- Errors and blockers
- Severity: High
- Page/component: `TrendsMap`
- Role affected: all dashboard users when the points-by-user API fails or returns no data
- Reproduction steps: Sign in to a dashboard account, make the points-by-user endpoint fail or return an unexpected empty response, then open `/dashboard/trends-map`.
- Expected result: the page should show an error or empty state.
- Actual result: the render path dereferences `pointsDiseaseUser["data"].length` and `pointsDiseaseUser["data"].map(...)`.
- Probable cause: missing null/error guard after the query hook.
- Evidence: [TrendsMap.jsx](C:/Users/Janzzen/HealthPH-Plus_Joy/client/src/pages/admin/TrendsMap.jsx#L608)

### /dashboard/sentiment-pulse - SentimentPulseTool
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: `StaticContainers`, `SentimentTrends`, `RegionalAnalysis`, `MobileSurveys`, `MobileSurveyCreateModal`, `MobileSurveyScheduleModal`, `MobileSurveyResultsModal`.
- Errors and blockers
- Severity: Low
- Page/component: `MobileSurveys`
- Role affected: users who try to edit a survey
- Reproduction steps: Open Sentiment Pulse Tool, switch to Mobile Surveys, and click `Edit` on any survey card.
- Expected result: an edit flow or modal should open.
- Actual result: the handler shows an alert that the feature is "Coming soon".
- Probable cause: edit flow is not implemented yet.
- Evidence: [MobileSurveys.jsx](C:/Users/Janzzen/HealthPH-Plus_Joy/client/src/pages/admin/sentimentPulseTool/MobileSurveys.jsx#L41)

### /dashboard/trends-map/upload-dataset - UploadDataset
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: CSV upload flow, preview modal, delete modal, `Datatable`, `EmptyState`, `Modal`.
- Errors and blockers
- Severity: High
- Page/component: `UploadDataset`
- Role affected: admin and superadmin users
- Reproduction steps: Sign in as an admin or superadmin, make the user datasets query fail or return undefined, then open `/dashboard/trends-map/upload-dataset`.
- Expected result: show a load/error state or an empty table.
- Actual result: the render branch uses `datasetsByUser.length` without a null guard.
- Probable cause: missing failure handling after `useFetchDatasetsByUserQuery`.
- Evidence: [UploadDataset.jsx](C:/Users/Janzzen/HealthPH-Plus_Joy/client/src/pages/admin/UploadDataset.jsx#L463)

### /dashboard/user-management - UserManagement
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: `AdminsTable`, `UsersTable`, `Datatable`, search box, print flow.
- Errors and blockers
- Severity: High
- Page/component: `UserManagement`
- Role affected: admin and superadmin users
- Reproduction steps: Sign in as admin or superadmin, make either the admins or users query fail or return undefined, then open `/dashboard/user-management`.
- Expected result: show an error or empty state.
- Actual result: the render branch dereferences `admins.length` and `users.length`.
- Probable cause: missing failure guards after the RTK query hooks.
- Evidence: [AdminsTable.jsx](C:/Users/Janzzen/HealthPH-Plus_Joy/client/src/components/admin/AdminsTable.jsx#L271), [UsersTable.jsx](C:/Users/Janzzen/HealthPH-Plus_Joy/client/src/components/admin/UsersTable.jsx#L423)

### /dashboard/user-management/add-user - AddUser
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: `FieldGroup`, `Input`, `CustomSelect`, `MultiSelect`, `InputPassword`, `PasswordRequirements`.
- Errors and blockers
- BLOCKED: no live admin or superadmin account was available to submit the form against the backend.

### /dashboard/help - Help
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: `HelpImage`, `Input`, TOC navigation, section search.
- Errors and blockers
- Severity: Medium
- Page/component: `Help`
- Role affected: all dashboard users
- Reproduction steps: Open `/dashboard/help` and compare the user help text to the actual dashboard landing route.
- Expected result: Help should describe the real first dashboard view.
- Actual result: the user help text says the user is directed to the Analytics page, but `/dashboard` actually renders AI Surveillance.
- Probable cause: Help content was not updated after the dashboard landing page changed.
- Evidence: [Help.jsx](C:/Users/Janzzen/HealthPH-Plus_Joy/client/src/pages/admin/Help.jsx#L514), [App.jsx](C:/Users/Janzzen/HealthPH-Plus_Joy/client/src/App.jsx#L201)

### /dashboard/activity-logs - ActivityLogs
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: `Datatable`, `SkeletonTable`, `EmptyState`, `PrintComponent`.
- Errors and blockers
- Severity: High
- Page/component: `ActivityLogs`
- Role affected: admin and superadmin users
- Reproduction steps: Sign in as admin or superadmin, make the activity log query fail or return undefined, then open `/dashboard/activity-logs`.
- Expected result: show an error or empty state.
- Actual result: the render branch dereferences `activity_logs.length`.
- Probable cause: missing error/undefined guard after the query hook.
- Evidence: [ActivityLogs.jsx](C:/Users/Janzzen/HealthPH-Plus_Joy/client/src/pages/admin/ActivityLogs.jsx#L252)

### /dashboard/settings - Settings
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: `FieldGroup`, `Input`, `CustomSelect`, `MultiSelect`, account delete modal.
- Errors and blockers
- Severity: Medium
- Page/component: `Settings`
- Role affected: all dashboard users
- Reproduction steps: Open `/dashboard/settings` and click `Edit Password`.
- Expected result: navigate to `/dashboard/settings/edit-password`.
- Actual result: the link target includes a trailing space, so it points to `/dashboard/settings/edit-password `.
- Probable cause: typo in the `to` prop.
- Evidence: [Settings.jsx](C:/Users/Janzzen/HealthPH-Plus_Joy/client/src/pages/admin/Settings.jsx#L617)

### /dashboard/settings/edit-email - EditEmail
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: `FieldGroup`, `Input`, `InputPassword`.
- Errors and blockers
- BLOCKED: no live account was available to verify the email-change API handling.

### /dashboard/settings/edit-password - EditPassword
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: `FieldGroup`, `InputPassword`, `PasswordRequirements`.
- Errors and blockers
- BLOCKED: no live account was available to verify the password-change API handling.

## Unrouted Dashboard-like Files

### Analytics.jsx
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: `Report`, `PrintAnalytics`, `EmptyState`, `AnalyticCardItem`.
- Errors and blockers
- Severity: High
- Page/component: `Analytics.jsx`
- Role affected: all authenticated dashboard users
- Reproduction steps: Sign in, make the points or datasets query fail or return undefined, then open the unrouted analytics surface or reintroduce the old route.
- Expected result: show a loading or empty state.
- Actual result: the render branch checks `points.length == 0 || datasets.length == 0`, which will crash if either query returns undefined.
- Probable cause: no null guard for failed RTK query results.
- Evidence: [Analytics.jsx](C:/Users/Janzzen/HealthPH-Plus_Joy/client/src/pages/admin/Analytics.jsx#L238)

### Analytics copy.jsx
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: duplicate analytics charts, print stub, word cloud.
- Errors and blockers
- BLOCKED: this file appears to be a stale duplicate of the analytics page with placeholder behavior. It is not routed, so I did not treat it as a live user-facing page.
- Notable source issue: the print button calls `print("asas")`, and most of the rest of the content is hard-coded mock data.
- Evidence: [Analytics copy.jsx](C:/Users/Janzzen/HealthPH-Plus_Joy/client/src/pages/admin/Analytics%20copy.jsx#L107)

### FullMap.jsx
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: `MapContainer`, `Polygon`, `SemiCircleMarker`.
- Errors and blockers
- BLOCKED: no immediate source-level crash found during inspection.

### Print.jsx
- Page-level tests: source review only; runtime verification BLOCKED.
- Components: print wrapper, `useReactToPrint`.
- Errors and blockers
- BLOCKED: no immediate source-level crash found during inspection.

## Cross-Page Reusable Components
### Modal
- Severity: Medium
- Page/component: `Modal`
- Role affected: any page that passes non-string content in the future
- Reproduction steps: pass a React node or another non-string value to `content`.
- Expected result: the modal should render arbitrary content safely.
- Actual result: `content.split("\n")` will throw if `content` is not a string.
- Probable cause: the modal assumes all content is text.
- Evidence: [Modal.jsx](C:/Users/Janzzen/HealthPH-Plus_Joy/client/src/components/admin/Modal.jsx#L24)

### ModalWithBody
- BLOCKED: source review only. No immediate source-level crash found during inspection.

### Datatable
- BLOCKED: source review only. No immediate source-level crash found during inspection.

### EmptyState
- BLOCKED: source review only. No immediate source-level crash found during inspection.

### SkeletonTable
- BLOCKED: source review only. No immediate source-level crash found during inspection.

### SkeletonBody
- BLOCKED: source review only. No immediate source-level crash found during inspection.

### Snackbar
- BLOCKED: source review only. No immediate source-level crash found during inspection.

### MultiSelect
- BLOCKED: source review only. No immediate source-level crash found during inspection.

### Input
- BLOCKED: source review only. No immediate source-level crash found during inspection.

### InputPassword
- BLOCKED: source review only. No immediate source-level crash found during inspection.

### FieldGroup
- BLOCKED: source review only. No immediate source-level crash found during inspection.

### CustomSelect
- Severity: Medium
- Page/component: `CustomSelect`
- Role affected: any page that feeds an unexpected value into the select
- Reproduction steps: render the select with a value that is not present in `options`.
- Expected result: show the placeholder or a safe fallback.
- Actual result: `options.find(... )["label"]` will throw if the value is unmatched.
- Probable cause: missing fallback after `find`.
- Evidence: [CustomSelect.jsx](C:/Users/Janzzen/HealthPH-Plus_Joy/client/src/components/CustomSelect.jsx#L52)

### Report
- BLOCKED: source review only. No immediate source-level crash found during inspection.

## Global Errors
- Runtime verification blocker: `npm run build` and `npx vite --host 127.0.0.1` both failed before the app could boot. Vite/esbuild tried to read `../..` and hit `Access is denied`, so I could not complete a browser pass in this workspace.
- Role-specific blocker: I do not have credentials for `USER`, `ADMIN`, `SUPERADMIN`, or a disabled-user account, so live access-control verification is BLOCKED.
- Environment blocker: the repository already had an uncommitted change in `client/src/pages/admin/Help.jsx`; I left it untouched.

## Questions / Clarifications Needed
- Please provide test logins for `USER`, `ADMIN`, `SUPERADMIN`, and, if possible, one disabled account so I can run the actual role flows.
- If you want me to continue runtime verification in a follow-up pass, I need either a way to make the Vite/esbuild startup stop scanning above `client/` or permission to adjust the frontend config in a separate change.
- Confirm whether the unrouted analytics copy is intentionally kept as a mock/staging surface, or whether you want it treated as dead code.

## Final Summary
- The confirmed dashboard issues are the settings navigation typo, the Help-page documentation drift, and multiple list pages that crash when their RTK queries return undefined.
- Several dashboard subviews are still placeholder-driven or static-only, especially `ModelAccessToolkit` data management and the unrouted analytics copy.
- I could not complete live browser verification because the app would not boot locally in this workspace and no dashboard credentials were available.
