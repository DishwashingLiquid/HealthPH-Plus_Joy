# Article image galleries

Articles store an ordered `galleryImages` array. Each entry has a stable `id`,
`media` (the existing GridFS metadata including `fileId`), `caption`, and `alt`.
Captions and alternative text are separate plain strings. Captions are creator
content; public discussion comments and moderation retain their existing APIs.

## Multipart create and update

Send `galleryImages` as a JSON array of `{id, fileId?, caption?, alt?}`.
For each new or replacement image, send a binary multipart field named
`galleryFile_<id>`. Its ID must match exactly one entry; multipart ordering and
filenames have no role in associating metadata. Replacement retains the entry
ID and its editable caption and alternative text. For retained entries, send
their existing `fileId`; files from other entries/articles cannot be attached.
The endpoint retains the existing Admin/SUPERADMIN authorization rules.

The dashboard presents images first and keeps the optional video/PDF picker
collapsed unless an attachment exists. Both pickers support a button and drag
and drop. Each image has a caption and a separate screen-reader description.
The decorative-image checkbox saves an empty `alt`, following the existing
contract; reopening an image with empty `alt` shows it as decorative. Toggling
the checkbox back off before saving restores the unsaved description. File-size
hints use decimal MB (rounded to one decimal), without changing byte limits.

Omitting `galleryImages` preserves the existing gallery. Sending `[]` explicitly
removes it. Gallery uploads without metadata, duplicate entry IDs, duplicate
upload fields, and unmatched upload IDs are rejected. All public website,
legacy mobile, and mobile contract responses include the same gallery shape;
only admin responses contain scoped preview URLs.

## Limits

- Up to 10 images per article; JPEG, PNG, GIF, and WEBP only.
- 25 MiB per image, following the existing media convention; signatures are
  checked by the existing streaming GridFS uploader.
- 75 MiB combined **new/replacement gallery uploads per save**. Retained files
  do not consume this upload budget.
- 1,000 characters per caption; 500 per alternative-text description. Empty
  alternative text denotes a decorative image. Text is escaped by React and
  captions render only when nonempty, directly below the matching image.
- 326 MiB for the full POST/PUT request, including multipart overhead and text.
  This allows the existing 250 MiB main-video limit plus 75 MiB of gallery
  uploads and 1 MiB overhead. Enforcement occurs while receiving the body,
  before multipart parsing completes, even without Content-Length. This bound
  also applies to other Hub POST/PUT routes using the same router.

Main attachments remain supported, including PDF and video. Existing single
GridFS article images are presented in the editor as `main-<fileId>` gallery
entries. Saving moves their reference into the gallery and clears the main
attachment without reuploading or deleting the referenced file. Legacy assets
that still require the existing GridFS migration keep their migration notice.

## File lifecycle and visibility

Validate metadata and authorization before writing new files. Save the article
before cleaning removed/replaced files. Failed uploads and failed saves clean
only new, unreferenced files. Cleanup rechecks all main, thumbnail, and gallery
references, protecting shared files and ambiguous database commits. Aged orphan
maintenance handles deferred cleanup using its existing 24-hour grace period.
Draft, archived, unpublished, and scoped-admin-preview access rules apply to
gallery files exactly as they do to main attachments.

Admin uploaded-media previews use the dashboard's `VITE_API_URL` endpoint,
preserving the signed preview query. This keeps local draft previews on the API
that issued their tokens even when `PUBLIC_API_BASE_URL` points to the hosted
mobile API. Public website/media and share links retain the public media URL.

## Focused verification

Run from the repository root (using an environment with requirements-test.txt):

```powershell
python -m unittest discover -s server/tests -p test_health_literacy_media.py -v
python -m unittest discover -s server/tests -p test_health_literacy_comments.py -v
```

From `client`:

```powershell
node --test tests/healthLiteracyMedia.test.mjs tests/publicArticleMedia.test.mjs
npm run build
```

For browser checks, start Vite on port 5178 and an isolated headless Chromium
profile on debugging port 9236, then run `node tests/articleGallery.browser.mjs`.
Optional `HL_PREVIEW_URL` and `HL_CDP_URL` override these endpoints. Screenshots
are written to `.hub-build-check/article-gallery/`. The browser fixture intercepts
API calls and never connects to a live backend.
