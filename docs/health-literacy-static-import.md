# Static article draft import

`server/scripts/import_static_articles.py` imports the public website's bundled
articles into MongoDB content records with GridFS images. Both publication
destinations and `isPublished` are false. Nothing is automatically published.

The public Articles listing and article detail page now read managed API content
only. Deploy the client change alongside the import: the static copies will no
longer appear, including as a fallback during API errors. Original JSON and image
files remain intact for recovery; deleting them is a separate cleanup task.

## Mapping and review

- Title is retained; full article body becomes Description.
- The original short introduction becomes the editable Short preview field.
  Cards use it when present, with Description as the fallback.
- Publication dates retain the source month/day/year value, normalized to midnight
  Philippine time. They do not publish or schedule the drafts.
- Cover image is first, followed by the original gallery order. Captions remain
  intact. Image descriptions reuse source text where possible; a missing or
  overlong cover description uses the article title, as approved for this import.
- Original slugs remain the public URLs after publication. Existing discussion
  identities are retained, with access blocked while their article is unpublished
  or archived.
- Six blank template records are skipped. No tags, attribution, or facts are
  invented. The FEU-NRMF publication/event date discrepancy is retained and noted.

In Admin → Health Literacy Hub → Articles, select **Read More** to preview a draft
and **Edit** to review Short preview, Description, Published Date, and Article
images. Import review notes identify source issues. Image descriptions and
captions are separate editable fields. Leave both Publish Options unchecked
while saving review edits. When ready, select **Publish to website** and save;
mobile publication is a separate choice.

The script is not required at runtime. Keep it and the local journal until draft
review is complete; it can then be removed without affecting imported records.

## Commands

Run from the repository root using the server environment. The script does not
import `config.database` or automatically read an `.env`. Explicit `--env-file`
uses only MongoDB connection settings and never prints credentials.

```powershell
# Offline source validation; default mode never connects or writes to MongoDB.
./server/.venv/Scripts/python.exe server/scripts/import_static_articles.py --report hub-static-articles-dry-run.json

# Read-only check for collisions in the configured application database.
./server/.venv/Scripts/python.exe server/scripts/import_static_articles.py --check-database --env-file server/.env --report hub-static-articles-db-check.json

# Import only missing drafts, with an append-only local recovery journal.
./server/.venv/Scripts/python.exe server/scripts/import_static_articles.py --apply --env-file server/.env --journal hub-static-articles-journal.jsonl --report hub-static-articles-import.json

# Preview rollback. Add --apply only to remove unchanged imported drafts.
./server/.venv/Scripts/python.exe server/scripts/import_static_articles.py --rollback hub-static-articles-journal.jsonl --env-file server/.env --report hub-static-articles-rollback-check.json
```

Reruns preserve existing imports, including admin edits and publication flags.
Conflicting IDs, titles, or slugs stop the import before uploads. Source images
are checked for existence, format/signature, size, and editor limits. Uploads are
read back and hashed, and failed imports clean only unreferenced new media.
An interrupted import can be rerun; already committed drafts are preserved.

Rollback uses exact journal snapshots and refuses to overwrite admin changes.
It leaves media copies for recovery; the existing aged-orphan maintenance tool
can clean them later. Report and journal files match existing gitignore patterns;
keep them private and outside source asset folders.

## Verification

```powershell
./server/.venv/Scripts/python.exe -m unittest discover -s server/tests -p test_static_article_import.py -v
./server/.venv/Scripts/python.exe -m unittest discover -s server/tests -p test_health_literacy_media.py -v
./server/.venv/Scripts/python.exe -m unittest discover -s server/tests -p test_health_literacy_comments.py -v
```

From `client`, run `node --test tests/healthLiteracyMedia.test.mjs
tests/publicArticleMedia.test.mjs` and `npm run build`. The existing isolated
`tests/articleGallery.browser.mjs` suite also checks Short preview edits survive
save/reopen independently of Description. Its synthetic API never accesses the
configured application database.
