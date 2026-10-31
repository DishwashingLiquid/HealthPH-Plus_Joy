# HealthPH (v2.1)

## Social-media CSV dates and processing

Download the shared template from Data Management → Social Media Datasets.
Replace both sample rows and keep these six columns:
`id,text,location,date_posted,source,date_collected`.

For both date columns, use `YYYY-MM-DD`, for example `2026-10-31`.
If the time is known, use an ISO timestamp such as
`2026-10-31T09:30:00+08:00`. UTC timestamps ending in `Z` are also accepted
and converted to Philippine time. Offset-free ISO timestamps follow the
application's existing Philippine-time convention. Slash dates such as
`31/10/2026` and invalid or missing dates are rejected with a row/column error.
In Excel, format date cells as `yyyy-mm-dd` before exporting to CSV. The
exported text, rather than Excel's screen display, determines the input format.

Surveillance uses `date_posted` for social-media posts and the mobile report's
`createdAt` for self-reports. `date_collected` records when a post was collected;
upload and processing times do not replace the source event date. Analytics
timestamps with known times include the Philippine `+08:00` offset. Date-only
posts remain calendar dates and are matched against Philippine calendar dates
covered by the selected window; provide a timestamp for exact 24-hour matching.

Both Data Management sources run language detection, disease classification,
and symptom extraction when processed. Disease labels are generated results,
not CSV columns. The surveillance disease map requires processed entries with
at least one supported disease label; a symptom-only result can still appear
in symptom counts without creating a disease pin.

### Updating symptom word variants

Both disease service folders bundle `healthph_symptoms/keywords_master.csv` for
matching and `healthph_symptoms/aliases.json` for the common English symptom
name. A new phrase needs to be in the keyword list and mapped in the aliases;
adding an alias alone does not enable matching. For example, `inuubo` and
`umuubo` match as `cough`. Keep both service copies synchronized. Restart the
disease services and backend after vocabulary updates; previously processed
results need reprocessing to use the updated vocabulary.

## Prerequisites
1. Python
2. MongoDB database connection string

### How to setup
1. In client folder, create an `.env` file and copy the contents of `.env.example` file. Put the required data.
2. In server, create an `.env` file and copy the contents of `.env.example` file. Put the required data.
3. Open terminal on root directory, and go to `client` directory

```bash
cd client
```
4. Type the following commands:
```bash
yarn install
yarn build
```

5. Open another terminal in root directory, and go to `server` folder
```bash
cd server
```

6. Type the following commands:
```
python -m venv ./.venv

.venv/Scripts/activate

pip install -r requirements.txt
```

### How to use
1. Open terminal in root directory and go to `server` folder.
```bash
cd server
```
2. Run FastAPI app.
```bash
python main.py
```
3. On a browser go to the following URL: `http://localhost:8000/`
