# HealthPH+ Codex Handoff - Mac Migration

Date prepared: 2026-07-08

This handoff is for continuing the HealthPH+ repo work on a Mac device with a fresh Codex chat. The user prefers step-by-step snippet sets for coding, not direct edits, unless they explicitly give one-time permission to edit files directly.

## Project Summary

HealthPH+ is a modernized version of the legacy HealthPH / RespiratoryPH project. The goal is a multilingual Philippine public health surveillance system that supports scraped social media data, NLP-based annotation, disease surveillance dashboards, misinformation tracking, sentiment insights, and model/toolkit management.

Relevant project framing from the docs and handoff discussions:

- Program: Research and Development Center on Natural Language Processing for Health Applications (RDC-NLPHA).
- Project: HealthPH+: An Improved Intelligent Philippine Public Health Surveillance System through Multilingual Natural Language Processing Innovation.
- Workplan target: multilingual scraping, data annotation, model training, dashboard/mobile toolkit, LGU/DOH stakeholder support.
- Target raw languages include English, Filipino, Cebuano, Ilocano, and Hiligaynon, but the app should not hard-restrict languages in upload. It should accept and display whatever is in the uploaded `language` column.

## Collaboration Rules To Preserve

- User wants code changes sent by sets/snippets so they can manually type them.
- Ask clarifying questions when decisions are unclear, especially data pipeline/model questions.
- Do not silently decide major pipeline behavior. Refer to documents, handoff notes, and user-provided data scientist answers.
- Direct file edits are only okay when the user explicitly says one-time permission or directly asks to edit files.
- For UI, match the new HealthPH+ design, not the legacy UI.
- Legacy repo features may be reused or embedded only if they fit the new design and architecture.

## Key Data Pipeline Decisions

Data scientist clarification:

- Scraping happens outside HealthPH+.
- Raw scraped CSV is uploaded to HealthPH+.
- Exact raw upload columns:
  - `id`
  - `language`
  - `text`
  - `location`
  - `date_posted`
  - `source`
  - `date_collected`
- Model output fields expected later:
  - Disease labels such as AURI, PN, TB, COVID, encoded 1 if present and 0 if absent.
  - Misinformation: 0 = not misinformation, 1 = misinformation.
  - Sentiment: 0 = negative, 1 = positive.
  - Confidence score per post.
  - Probability per label.
- Location exists in raw uploaded data, but model has no lat/long/PH code. Backend should compute/match geospatial mapping later from `location`.
- Planned app flow:
  - Upload raw CSV first.
  - Store dataset as `RAW` and `UPLOADED`.
  - User manually clicks Process / Retry Processing.
  - Backend queues annotation/processing job.
  - Status flow: `UPLOADED -> QUEUED -> PROCESSING -> ANNOTATED` or `FAILED`.
- Reason for separating upload and annotation:
  - Avoid failed uploads interfering with annotation.
  - Let user verify upload first.
  - More transparent status handling.
  - Still efficient because process button can be a bulk action.

## Backend Dataset Work Done

Main files:

- `server/controllers/datasetsController.py`
- `server/schema/datasetSchema.py`
- `server/routes/datasetsRoutes.py`
- `client/src/features/api/datasetsSlice.js`
- `client/public/assets/dataset-template.csv`

Current backend upload behavior:

- Required raw CSV headers in `datasetsController.py`:
  - `id, language, text, location, date_posted, source, date_collected`
- Headers are normalized by trimming, lowercasing, and replacing spaces with underscores.
- Backend rejects missing required headers.
- Backend removes blank comma rows before counting:
  - Replaces empty/whitespace-only cells with `pd.NA`.
  - Drops rows where all required columns are empty.
  - Rejects CSV if no data rows remain.
- Backend rejects the sample template row.
- Backend stores:
  - `filename`
  - `original_filename`
  - `file_size`
  - `num_of_rows`
  - `languages`
  - `preview_row_count`
  - `preview_headers`
  - `preview_data`
  - `dataset_type: RAW`
  - `dataset_status: UPLOADED`
  - `processing_error`
  - `processed_at`
  - `created_at`
- `preview_row_count` is at least 10 rows, or 5% of total rows, capped by total row count.
- Languages are captured from uploaded CSV values, sorted, and not restricted.

Current process behavior:

- `process_dataset` endpoint exists.
- It sets status to `QUEUED`, starts a background job, then `run_dataset_processing_job` sets status to `PROCESSING`.
- The actual model/annotation is not connected yet.
- Current job intentionally fails with `Annotation processer not connected yet.` and sets status to `FAILED`.
- This is expected until the data scientist/model integration is ready.

Template:

- `client/public/assets/dataset-template.csv` currently only contains:
  - `id,language,text,location,date_posted,source,date_collected`

Known typo:

- `Annotation processer not connected yet.` should eventually become `Annotation processor not connected yet.`

## Frontend Dataset / Model Access Toolkit Work Done

Main file:

- `client/src/pages/admin/ModelAccessToolkit.jsx`

Data Management tab currently has:

- Upload dataset button with CSV reader.
- Required columns aligned with backend:
  - `id, language, text, location, date_posted, source, date_collected`
- Frontend preview counts only non-empty rows under required headers, so blank comma rows are ignored.
- Upload preview modal:
  - Wider modal.
  - Centered below the navbar.
  - Header uses left title `Upload Dataset`.
  - Right header shows filename and `Previewing X of Y records`.
  - Preview table shows up to 10 rows.
- Data table revised to use:
  - Checkbox
  - File Name
  - Records
  - Languages as pills
  - Date Uploaded
  - Uploaded By
  - Status
- Summary cards at the top were removed.
- Total datasets shown near search.
- Row click opens dataset preview modal.
- Dataset preview modal:
  - Larger modal.
  - Shows all preview columns.
  - Shows preview count such as `Previewing 10 of 50 records`.
  - Includes Close, Download, Process/Retry Processing, Delete.
- Bulk actions:
  - Select rows by checkbox.
  - Bulk Download, Process, Delete.
  - Confirmation modal includes selected count.
- Status is shown with badge/pill.

Parked Data Management improvement:

- User wanted the whole status message row in the preview modal to reflect the status color, not only the pill. This may still be pending depending on current code.

## Training Logs Status

Training Logs was started but parked.

Initial request:

- User wanted dynamic training logs using existing columns.

Then user found the Replit design and asked to revise Training Logs to match it:

- Learning Curves chart.
- Filters: model and date range.
- Export Logs.
- New Training Run.
- Training log accordion cards with model, timestamp, duration, status.
- Expanded row shows metrics, hyperparameters, buttons.
- Model Audit Trail section.

Decision:

- Since real training log data and model training integration are not ready, we parked this.
- Current `TrainingLogs` in `ModelAccessToolkit.jsx` may use dataset processing history as placeholder activity.
- Next work should either:
  - Keep placeholder dynamic from datasets, or
  - Build static Replit-like UI until model training APIs exist.

## AI Surveillance / Analytics Notes

We made some fields dynamic previously.

Discussion about suspected case totals:

- User asked if suspected cases count can change with filters.
- We discussed that the total suspected cases does not always have to equal the sum of disease labels if posts can have multiple labels or if total is distinct posts.
- User asked for reference and decided to keep current behavior for the meantime.

Parked:

- Full AI Surveillance, NLP Insights, Misinformation Tracker, Sentiment Pulse dynamic integration should come after Data Management processing produces annotated outputs.
- These pages likely need annotated dataset schema/API first.

## User Management Work Done

Main files:

- `client/src/pages/admin/UserManagement.jsx`
- `client/src/components/admin/AdminsTable.jsx`
- `client/src/components/admin/UsersTable.jsx`
- `client/src/components/admin/PrintComponent.jsx`
- `client/src/components/SkeletonBody.jsx`
- `client/src/components/SkeletonTable.jsx`

Design direction:

- Make User Management cohesive with Model Access and Toolkit.
- Subtabs should look like `Model Comparison / Data Management / Training Logs`.
- User asked to remove count badges from subtabs.
- Toolbar and table should sit in one white workspace card, like Data Management.
- Table should not have its own extra border.
- Loading should happen only in the table area, not replace the whole page.

Admin table status:

- User said admin table is okay for now.
- `AdminsTable.jsx` was redesigned away from the old `Datatable` shell.
- It now uses a plain table style with:
  - Full Name
  - Email
  - Date Created
  - User Type
  - Status
  - Actions
- Status badge shows Active / Disabled.
- Current account shows `Current account` instead of actions.
- Enable/Disable/Delete actions use existing backend mutations and old confirmation modal.

Users table status:

- `UsersTable.jsx` was partially redesigned to match Admins table.
- The old update button was commented out in the current file scan.
- It still has old update modal logic imported/available.
- Needs cleanup after Mac migration:
  - Decide whether to keep/update accessible regions action.
  - Remove unused imports/unused state if update stays parked.
  - Ensure search filters include role/region if desired.

User Management page current state:

- The whole-page loading was replaced conceptually with table-only loading using `SkeletonBody`.
- Search/print/add button remain visible while table loads.
- Add Admin/Add User button now opens an add account modal.
- Subtab count badges should be removed or kept removed.

Known immediate issue in `UserManagement.jsx`:

- The add account modal was partially pasted and may be incomplete/broken.
- The most recent scan showed several known problems still present:
  - `size="snackbar=sm"` should be `size="snackbar-sm"`.
  - `detail.forEach(({ field, errro }) => {` should use `error`, not `errro`.
  - Inside that loop, make sure `[field]: error` refers to the destructured `error`.
  - Regional Office field should render only for normal users, not admin mode, because admin mode stores `region: "ALL"` and `ALL` is not in the CustomSelect options.
  - The pasted modal was cut off near the Organization `Input` and needs the rest of the form fields and footer buttons restored.
- If the app crashes in `CustomSelect.jsx` with `Cannot read properties of undefined (reading 'label')`, check for a CustomSelect `value` not present in `options`.

## Print Component Issue

File:

- `client/src/components/admin/PrintComponent.jsx`

Current problem:

- Console warning: `Maximum update depth exceeded`.
- Cause: `PrintComponent` calculates `pageData` in `useEffect` and calls `setPageData` when `data` changes. In User Management, the passed `data` can be a new array on repeated renders, triggering a loop.

Planned fix:

- Replace `useEffect + useState` derived state with `useMemo`.
- Change import:
  - from `forwardRef, useEffect, useState`
  - to `forwardRef, useMemo`
- Compute `pageData` directly with `useMemo(() => ..., [data, rowsPerPage])`.

## Loading Skeleton Work Done

Files:

- `client/src/components/SkeletonBody.jsx`
- `client/src/components/SkeletonTable.jsx`

Updated direction:

- Use modern table-shaped skeletons matching the new table design.
- `SkeletonBody` is for table-body-only loading inside existing page/card.
- `SkeletonTable` is for page-level loading when needed.

Used by:

- Data Management table.
- Training Logs table.
- User Management table-only loading.
- Activity Logs should pass correct column count, likely 4.

## Parked / Deferred Items

Data pipeline:

- Exact annotated output schema is not finalized.
- Need model integration contract from data scientist:
  - Endpoint or script?
  - Input/output file format?
  - Disease labels/probabilities column names?
  - Misinformation/sentiment column names?
  - Confidence format?
  - Error handling?
  - Processing time expectations?
  - Batch size/queue requirements?

Geospatial mapping:

- Backend needs logic to map raw `location` string to province/region/lat/lng/PH code or whatever AI Surveillance and map pages need.

Dataset processing:

- Actual annotation process is not connected.
- Current process endpoint intentionally fails after setting status to `PROCESSING`.

Training logs:

- Replit-like Learning Curves, Training Logs accordion, and Model Audit Trail are not implemented fully.

User Management:

- Add Admin/Add User modal needs to be completed and tested.
- Users table update-accessible-regions action needs decision.
- Print component loop fix should be applied.

Legacy HealthPH reuse:

- Use legacy features where useful, but preserve new HealthPH+ styling.
- Legacy app appears to combine upload and annotation more tightly, but HealthPH+ plan is upload first, manual process second.

Security:

- Legacy had role-based restrictions and token-authenticated protected routes.
- HealthPH+ backend upload/process/delete should remain protected for `ADMIN` and `SUPERADMIN`.
- Do not expose secrets or `.env` values in the handoff.

## Suggested Next Steps For Mac Codex Chat

Start with this order:

1. Inspect current `client/src/pages/admin/UserManagement.jsx`.
2. Fix the incomplete Add Admin/Add User modal and the known typos.
3. Fix `PrintComponent.jsx` derived-state loop with `useMemo`.
4. Run the frontend and verify:
   - User Management Admin tab renders.
   - Users tab renders.
   - Add Admin modal opens without crashing.
   - Add User modal opens without crashing.
   - Print button does not trigger maximum update depth warning.
5. Clean up unused imports from `UserManagement.jsx`, `AdminsTable.jsx`, and `UsersTable.jsx`.
6. Return to Data Management only after User Management is stable.
7. Later, ask data scientist for final annotation/model output schema before making AI Surveillance/NLP/Misinformation pages fully dynamic.

## Files Worth Attaching Or Bringing To Mac

Necessary/very useful:

- This handoff document.
- The whole current repo or latest committed branch.
- `.env` / `.env.local` values for local dev, but do not paste secrets into Codex chat. Add them manually on the Mac.
- Sample raw CSV files that reproduce upload cases:
  - A valid CSV with the seven required columns.
  - A CSV with blank comma rows.
  - The template CSV.
- Original project documents if the next chat needs domain context:
  - Form 2 research proposal.
  - Form 5 workplan/timeline.
  - Updated ChatGPT handoff notes.
- Replit design reference:
  - `https://mba-healthplus-ph-interface.replit.app/`

Optional:

- Screenshots of target UI sections from Replit, especially Training Logs and Model Audit Trail.
- Screenshot of any current UI bugs.

## Most Important Context To Paste Into New Codex Chat

Paste this:

> We are building HealthPH+, a multilingual public health surveillance app. I prefer code in manual snippet sets unless I explicitly give direct-edit permission. Use the new HealthPH+ design, not legacy styling. Data upload now accepts raw scraped CSV with columns `id, language, text, location, date_posted, source, date_collected`. Upload and processing are separate. Processing/annotation model is not connected yet. Current focus is finishing User Management redesign and stabilizing the Add Admin/Add User modal.

