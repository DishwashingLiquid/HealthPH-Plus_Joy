# Shared Health Literacy Hub media

Hub content is authoritative in the existing database's `content` collection. Uploaded media lives in the dedicated `health_literacy_media` GridFS bucket (`health_literacy_media.files` and `health_literacy_media.chunks`). GridFS creates these collections on the first upload; it uses the cluster's storage allocation, not a separate quota. No runtime Hub operation reads/writes repository JSON or serves a file from `server/public`.

FastAPI owns uploads, verification, references, retrieval, replacement, and deletion. The backend maintenance command below handles legacy migration and orphan recovery. Clients never connect to MongoDB or receive credentials. Local and Render instances share the library only when their Atlas connection, `DB_NAME`, and bucket match.

## API and storage contract

- Existing multipart POST/PUT/DELETE paths and content fields remain. `file` carries an upload; PUT `removeMedia=true` detaches it. A new upload takes precedence when both are supplied.
- Stored `media` and optional video `thumbnail`: `{fileId, filename, contentType, size, sha256}`. Neither binary data nor deployment-specific uploaded-media URLs are stored. Upload the video poster as the separate multipart `thumbnail` file (JPG, PNG, GIF, or WEBP); `removeThumbnail=true` detaches it on PUT. Existing external editorial `externalUrl`, `imageUrl`, and `mediaUrl` fields remain supported as external HTTPS links; local, data, and Hub filesystem URLs cannot be submitted through the editor.
- Admin and public responses generate `media.url`, `mediaUrl`, and `imageUrl` dynamically. Every uploaded attachment sets `mediaUrl` to its GridFS URL. Uploaded images also set `imageUrl`; a video poster sets `imageUrl` to its distinct thumbnail URL. Both mobile endpoints include `media.url` and `media.contentType` for attachment classification. A video without an uploaded poster may have a null `imageUrl` unless an external HTTPS image link was supplied.
- `GET`/`HEAD /api/health-literacy-hub/media/{fileId}` serves GridFS bytes. Public access requires a current referenced record published to at least one destination, not archived, and not explicitly unpublished. Drafts, unreferenced files, and missing IDs return 404. A website/mobile publish destination is visibility metadata, not a separate authenticated audience.
- Admin responses additionally include a file-scoped preview URL, signed for 15 minutes and checked against the user's current admin role on every request. The admin UI refreshes listings every five minutes. Preview URLs are temporary capabilities: keep them private, redact the `preview` query parameter from proxy/access logs, and do not share or cache admin responses. Public responses never include preview tokens. The normal admin bearer token is never placed in a URL.
- Single byte ranges support bounded, open-ended, and suffix ranges; successful ranges return 206 with `Content-Range`. Invalid/unsatisfiable/multiple ranges return 416. `If-Range`, ETag revalidation, MIME type, length, and HEAD are supported. Public cache headers require revalidation so unpublishing is checked again; admin media is `private, no-store`. Already downloaded bytes cannot be revoked.
- Legacy `/media/{content_type}/{filename}` returns 410 and never reads the filesystem. Refresh API content after migration. Unmigrated nested attachments are hidden publicly and flagged `migrationRequired` to admins.
- Allowed: JPEG, PNG, GIF, WEBP, PDF (articles only), MP4, MOV, WEBM. Images/PDF: 25 MiB; videos: 250 MiB. Server checks MIME allowlist, file signatures, actual byte counts, and SHA-256 read-back before attaching a file. This is format validation, not a malware scanner or full codec validation; browser/mobile codec compatibility still matters.
- Each edit changes one MongoDB document with a compare-and-swap check. Concurrent changes return 409. Replacement verifies the new file before switching the reference, then deletes the old file only if no record references it. Failed or ambiguous writes are checked before cleanup. Cleanup failures are logged and recoverable with orphan maintenance.

## Local backend configuration

Use server environment variables (never frontend Vite variables):

```dotenv
MONGO_URI=<existing Atlas connection secret>
DB_NAME=<existing shared database name>
HEALTH_LITERACY_GRIDFS_BUCKET=health_literacy_media
PUBLIC_API_BASE_URL=http://192.168.1.50:8000/api
HEALTH_LITERACY_ALLOW_HTTP=true
APP_ENV=development
SECRET_KEY=<existing backend signing secret>
```

Replace the example LAN IP with the API computer's reachable IP. `PUBLIC_API_BASE_URL` includes `/api`, has no trailing endpoint/query, and must never be localhost, loopback, `10.0.2.2`, or a wildcard bind address. No request Host/forwarded header is trusted for URL generation. LAN HTTP requires explicit opt-in and a private IP. Render/production always requires HTTPS. Run `python main.py` from `server`; it already binds `0.0.0.0:8000`. Permit the port through the local firewall and allow the website's origin through `CORS_ORIGINS`. The existing admin `VITE_API_URL` must point to that API base.

## Render configuration (separate from mobile)

1. Set the private Render environment secret `MONGO_URI` to the same Atlas cluster connection used by the intended shared library. Set `DB_NAME` to exactly the same database. Grant the backend database user appropriate read/write access to that database, including the content collection and GridFS files/chunks and indexes. Do not expose secrets as `VITE_*` settings or in a client build.
2. Set `HEALTH_LITERACY_GRIDFS_BUCKET=health_literacy_media`, `APP_ENV=production`, and `HEALTH_LITERACY_ALLOW_HTTP=false`. Set `PUBLIC_API_BASE_URL=https://<service>.onrender.com/api` or `https://api.your-domain.example/api` once the custom domain and TLS are configured. Every API instance should return a base that its intended clients can reach; choosing the same production base for all instances is also supported.
3. Keep `SECRET_KEY` available for admin authentication and preview signing. Instances serving each other's preview URLs need the same signing secret and shared users database. Ensure the existing authentication `ALGORITHM` remains configured.
4. In Atlas Network Access, allow the Render service's documented outbound IP ranges and the developer machine's current outbound IP as needed. Consult the Render dashboard for the actual service/region addresses. Use narrowly scoped allowlist entries where practical; do not embed Atlas credentials into URLs returned to devices.
5. Configure `CORS_ORIGINS` for the deployed admin/public website origins. Media CORS exposes range/length/ETag headers. Ensure proxies permit Range/HEAD and upload sizes/timeouts suitable for the configured limits, and redact preview query strings in access logs. No persistent Render disk is needed for Hub storage; multipart parsing may use temporary spooling during a request.
6. Coordinate the cutover below before deploying. This task does not deploy or change Render/Atlas configuration.

## Flutter/mobile configuration (no Flutter changes made)

For a standalone, beginner-friendly guide with setup examples, response formats, and troubleshooting, see [Mobile Application Handoff: Health Literacy Hub](MOBILE_HEALTH_LITERACY_HUB_HANDOFF.md).

The mobile app calls FastAPI content endpoints and uses the returned URLs exactly. It must never receive `MONGO_URI`, a database name as a connection target, or MongoDB credentials.

| Device | FastAPI base | Media base returned by backend |
| --- | --- | --- |
| Physical phone on the same Wi-Fi/LAN | `http://192.168.1.50:8000/api` (replace IP) | Same reachable LAN base, with local HTTP opt-in |
| Android emulator on the API host | `http://10.0.2.2:8000/api` may work for content requests | Set `PUBLIC_API_BASE_URL` to the host's reachable LAN IP so generated media links work on iPhone and physical devices too |
| iOS simulator on a Mac | Host LAN IP, or localhost for the simulator's API calls if backend is on that Mac | Always a reachable LAN IP for returned media; never localhost |
| Production | `https://<Render/custom-domain>/api` | Same public HTTPS base |

Ensure local development network/cleartext policies permit HTTP as needed, and the chosen player follows Range responses for seeking. Do not rewrite returned URLs to localhost. After a domain change, refetch content; the database references do not need changes. These are configuration instructions for a later mobile task, not edits to the Flutter application.

## Migration review and later execution

The script is `server/scripts/migrate_health_literacy_media.py`. It does not import app startup, load `.env`, or automatically use `MONGO_URI`. It connects only when invoked with an explicitly set URI environment variable and `--database`. Default behavior is dry-run. **It was not run against Atlas for this implementation.**

Before cutover, stop all old/new Hub writers and automatic old API workers. The previous version seeded/replaced content during reads, so do not leave an old version serving requests while migrating. Take an Atlas backup/export of `content` and retain all legacy JSON/media folders from every relevant server/local copy. Rehearse using an isolated copy of the database and source folder first. Dry-run reads content and hashes source bytes; existing GridFS references are fully verified. It performs no database writes or index creation.

Example commands from the repository root (PowerShell; set `HUB_MIGRATION_URI` privately in the process environment first):

```powershell
# Offline help: no connection and no environment loading
.venv/Scripts/python.exe server/scripts/migrate_health_literacy_media.py --help

# Read-only report; use the explicit target name you intend to review later
.venv/Scripts/python.exe server/scripts/migrate_health_literacy_media.py --database <database> --source-root <backup/health-literacy-hub> --dry-run --report hub-dry-run.json

# Only after reviewing the report and rehearsing in isolation
.venv/Scripts/python.exe server/scripts/migrate_health_literacy_media.py --database <database> --confirm-database <database> --source-root <backup/health-literacy-hub> --apply --journal hub-rollback.jsonl --report hub-apply.json

# Re-run dry-run to verify every reference and SHA-256 in GridFS
.venv/Scripts/python.exe server/scripts/migrate_health_literacy_media.py --database <database> --source-root <backup/health-literacy-hub> --dry-run --report hub-verify.json
```

Pass `--include-seeds` only after reviewing the JSON for intentionally missing records. Seeds are explicitly insert-only and existing Atlas IDs always win, including canonical/legacy type aliases; a stale seed cannot overwrite newer Atlas content. It can reintroduce a deliberately deleted ID if you explicitly choose to import it, so do not routinely enable this flag. Duplicate canonical/legacy IDs are rejected for manual review, not merged or deleted. Apply adds file references without normalizing unrelated fields or overwriting timestamps. Missing files, unsupported sources, invalid MIME/signatures, corrupt data URLs, and concurrent edits are reported as errors; the command exits nonzero. Apply may make partial progress, recorded per item and in the journal. Review errors and rerun safely: verified copies are reused and already-migrated files are verified and skipped. No remote URL is downloaded by the migration.

The source root contains `articles.json`, `videos.json`, `infographics.json`, and `media/<plural-type>/<storedFilename>`. Copy sources from every machine as needed before applying; dry-run will identify missing files. Source files/JSON are never deleted or modified by any migration mode. Keep the private journal secure: it includes original documents and may include legacy data URLs. Each journal entry is flushed before changing the reference. Preserve it alongside backups and do not commit it.

Verification checklist before retiring source copies: zero report errors; each migrated record reports `already-migrated-verified`; counts/IDs and editorial fields match the backup; admin draft previews work; public draft URLs return 404; published image/PDF opens; a published video's Range request returns 206 with correct bytes; physical device playback/seek works using returned LAN/HTTPS URLs; changing `PUBLIC_API_BASE_URL` changes responses without changing MongoDB. Keep original sources through the rollback window. No automatic source deletion is provided.

Rollback preview and apply:

```powershell
.venv/Scripts/python.exe server/scripts/migrate_health_literacy_media.py --database <database> --rollback hub-rollback.jsonl --report hub-rollback-review.json
.venv/Scripts/python.exe server/scripts/migrate_health_literacy_media.py --database <database> --confirm-database <database> --rollback hub-rollback.jsonl --apply --report hub-rollback-result.json
```

Rollback restores only records still exactly matching the migrated snapshot. Post-migration edits are reported as conflicts and preserved. Imported seeds are removed only if unchanged. GridFS copies remain intact for recovery/retry. Restoring legacy references requires a compatible old backend and its original source files to serve them; coordinate a maintenance window and keep its runtime seed behavior in mind. Prefer fixing/retrying migration if deployment has already proceeded.

Orphan maintenance (backend administrator only, with uploads and migrations paused):

```powershell
.venv/Scripts/python.exe server/scripts/migrate_health_literacy_media.py --database <database> --orphans --report hub-orphans-review.json
.venv/Scripts/python.exe server/scripts/migrate_health_literacy_media.py --database <database> --confirm-database <database> --orphans --apply --report hub-orphans-result.json
```

This reports/removes only files older than 24 hours with no current content reference, plus aged incomplete-upload chunks without a files document or content reference. Recent files and all referenced files are preserved. Review the report and finish rollback decisions first; cleanup permanently deletes GridFS copies and must not race an active migration/upload. Normal edits already attempt safe immediate cleanup.

## Isolated verification

```powershell
.venv/Scripts/python.exe -m unittest discover -s server/tests -p test_health_literacy_media.py -v
cd client
node --test tests/healthLiteracyMedia.test.mjs
node node_modules/vite/bin/vite.js build --outDir ../.hub-build-check
```

Tests inject an in-memory `mongomock` database before importing controllers/routes and never load the app's database configuration or contact Atlas. Backend test dependencies are listed in `server/requirements-test.txt`. Build output can be reviewed locally; it is not deployed.

## Implementation files and recorded verification

Backend changes:

- `server/health_literacy_media.py`: GridFS streaming/validation, dynamic URLs, preview authorization, ranges, verification and cleanup.
- `server/controllers/health_literacy_hub/content_bridge.py`: MongoDB-only reads and single-record writes; removes runtime seed/filesystem synchronization.
- `server/controllers/health_literacy_hub/serialization.py`: runtime media URL generation for admin/public/mobile contracts.
- `server/controllers/health_literacy_hub/constants.py`: removes unused runtime filesystem/seed state.
- `server/controllers/healthLiteracyHubController.py`: upload/edit/delete orchestration and media delivery.
- `server/routes/healthLiteracyHubRoutes.py`: GridFS media GET/HEAD and retired legacy route.
- `server/config/database.py`: primary reads and majority-acknowledged Hub content writes. GridFS independently uses primary/majority for verification/reference safety.
- `server/api.py`: media range/ETag CORS response headers.
- `server/scripts/migrate_health_literacy_media.py`: explicit migration, rollback, and orphan maintenance.
- `server/.env.health-literacy.example`: additional backend settings without secrets.
- `server/requirements-test.txt`, `server/tests/test_health_literacy_media.py`: isolated test dependencies and integration tests.

Admin/website changes:

- `client/src/pages/admin/healthLiteracyHub/content/ContentTab.jsx`: upload limits, blob previews, expiring-preview refresh, load errors.
- `client/src/pages/admin/healthLiteracyHub/content/ContentFormBody.jsx`: legacy attachment migration notice.
- `client/src/pages/admin/healthLiteracyHub/content/contentTabFileMedia.js`: removes base64 preview allocation.
- `client/src/pages/admin/healthLiteracyHub/content/contentTabModalHelpers.js`: never shares a private preview capability.
- `client/src/pages/admin/healthLiteracyHub/shared.js`: preview URL selection and validation; preserves the user's pre-existing file-size export.
- `client/src/pages/admin/healthLiteracyHub/shared/sharedConfig.js`: exact MIME allowlists and size guidance.
- `client/src/utils/healthLiteracyWebsiteContent.js`: public API media URL usage.
- `client/tests/healthLiteracyMedia.test.mjs`: upload payload, public/private URL, and validation tests.
- `.gitignore`, `HEALTH_LITERACY_HUB_API_ENDPOINTS.md`, and this handoff: local verification-output ignores and updated documentation.

Pre-existing changes in `ContentMediaPreviewBody.jsx` and `shared/sharedFormatting.js` were preserved and not edited by this implementation. Flutter code, legacy source JSON/media, deployment configuration, and live Atlas data were not changed.

Recorded verification: 23 isolated Hub backend tests passed; six `DashboardRegionTests` backend regression checks passed; six frontend checks (`healthLiteracyMedia.test.mjs` plus `dashboardRegions.test.mjs`) passed; ESLint passed for changed client source files; local Vite production build succeeded. Build warnings remain for CSS syntax in existing styles, large bundles, and outdated Browserslist data. The installed Starlette version emits an httpx test-client deprecation warning. No full app startup or Atlas integration test was run. The local build output is `.hub-build-check` and is ignored by Git.

Storage API reference: [PyMongo GridFS documentation](https://pymongo.readthedocs.io/en/4.15.1/api/gridfs/index.html). Migration verification compares stored SHA-256 and byte length with the source and performs a full GridFS read-back before switching a reference.
