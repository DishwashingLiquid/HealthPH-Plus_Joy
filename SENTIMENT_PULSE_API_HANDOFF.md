# Sentiment Pulse backend handoff

Updated 2026-10-28 (Asia/Manila). This records the implemented backend contract,
local checks, and limitations. Frontend work and the requested Mobile Surveys UI
rollback happened after the original backend milestone. Tests do not certify full
browser/deployment readiness. No live MongoDB data, model files, or actual `.env`
files were changed by the question-type/rating-rule update.

Current owner-approved defaults, derived from the survey's actual questions:

- `text`: written answer sent to the calm/worried model.
- `multipleChoice`: selected string/numeric choice converted to its existing staged
  text representation and sent to the same model. No question text or translation
  is added. Single-choice answers are supported; lists/objects are excluded.
- `rating` on the 1-5 scale: 4-5 satisfactory, 1-2 dissatisfied, 3 neutral.
  Ratings are not sent to the model. Other rating ranges require explicit rules.

No separate question-ID configuration is required for these defaults, including
already-ended surveys. Existing explicit survey/operator overrides remain authoritative.
End Survey still stages per-answer analytics entries; Process does not move staging.

## API contract

Main backend base path: `/api/sentiment-pulse`. Every new endpoint uses the
existing `require_role(["Admin", "SUPERADMIN"])` dependency and existing bearer
authentication. The existing dependency checks both `user_type` and `role_label`.
Existing 401/403 behavior applies. Survey IDs are the existing application IDs,
not MongoDB ObjectIds. Unknown surveys return 404.

| Method | Path | Parameters/body | Result |
| --- | --- | --- | --- |
| PUT | `/surveys/{survey_id}/sentiment-config` | JSON configuration below | 200; choose explanation answer keys and optional satisfaction rules before ending |
| POST | `/surveys/{survey_id}/process` | No body or raw-entry IDs | 202 for text/choice inference; 200 for rating-only scoring or `not_configured` |
| GET | `/surveys/{survey_id}/processing` | No query parameters | 200; transient local job and an all-time stored-answer summary |
| GET | `/trends` | `timeRange`, `regions`, `startDate`, `endDate`, optional `surveyId` | 200; date-filtered totals, daily, regional, and per-survey summaries |

`timeRange` defaults to `last-30-days`; supported values are `last-7-days`,
`last-30-days`, `last-90-days`, and `custom`. `custom` requires both dates in
`YYYY-MM-DD` form. `regions` is a comma-separated list accepted by the existing
region normalizer. Bad date ranges, unknown region filters, and invalid question
configuration bodies return 400. Processing an unended survey, configuring an
ended survey, or a concurrent question/end change during configuration returns
409. Unreadable/invalid operator configuration and exhausted local job-registry
capacity return 503. Inference failures happen in the background and appear in
the transient job; they do not retroactively change the 202 response.

Examples below are optional explicit overrides, not configuration applied to real data.
The approved question-type defaults apply when no override exists. To narrow the
inference scope, configure exact text/choice answer keys before ending:

```http
PUT /api/sentiment-pulse/surveys/SUR00001/sentiment-config
Authorization: Bearer <admin token>
Content-Type: application/json

{
  "explanationQuestionIds": ["SUR00001-Q02"],
  "excludedTexts": ["prefer not to answer"],
  "satisfaction": {}
}
```

```json
{
  "surveyId": "SUR00001",
  "configuration": {
    "explanationQuestionIds": ["SUR00001-Q02"],
    "excludedTexts": ["prefer not to answer"],
    "satisfaction": {}
  }
}
```

The IDs are exact stored answer keys (`question.name`, falling back to `id`),
matching the existing analytics-entry builder. The legacy `explanationQuestionIds`
key now accepts existing `text` and `multipleChoice` answer keys for inference. Configuration does not alter questions or survey JSON.
It is stored as `surveys.sentimentPulseConfig`; this is question semantics, not
duplicate annotations or a persisted summary. Ended-survey configuration is
immutable through this API. An edit that removes/changes a configured question
requires a valid configuration before processing; invalid definitions fail closed.

For optional operator overrides, including already-ended surveys, an
operator-controlled UTF-8 JSON file can supply the same definitions through the process environment
variable `HEALTHPH_SENTIMENT_QUESTIONS_FILE`:

```json
{
  "surveys": {
    "SUR00001": {
      "explanationQuestionIds": ["SUR00001-Q02"],
      "excludedTexts": [],
      "satisfaction": {}
    }
  }
}
```

No live configuration file or production survey was edited. A survey's stored
configuration takes precedence over this file; file rules take precedence over
the approved question-type defaults. An explicitly empty override disables defaults. Treat definitions as immutable
once used: changing an operator file does not authorize overwriting results.

The owner approved the following rule for 1-5 ratings. It is generated automatically
for that scale and can also be expressed in an explicit `satisfaction` override:

```json
{
  "SUR00001-Q01": {
    "validValues": [1, 2, 3, 4, 5],
    "satisfiedValues": [4, 5],
    "dissatisfiedValues": [1, 2],
    "neutralValues": [3]
  }
}
```

Numeric `5` differs from choice string `"5"`; numeric `5.0` equals numeric `5`.
Under the defaults, rating 5 is scored as satisfactory, while choice label `"5"`
is a model input. Optional overrides retain their existing rating/choice scoring
support; the new default for multiple choice is model inference. Category sets
must be valid, disjoint subsets of `validValues`. Booleans, unknown values,
blanks, lists, and objects do not enter the satisfaction denominator.

The model still predicts only calm/worried. Satisfaction is computed separately
from raw ratings; neutral rating satisfaction does not create a neutral sentiment
class or populate rating entries' sentiment fields. A missing/unsupported scale
returns `satisfactionStatus: "not_configured"` and a null satisfaction share.

```http
POST /api/sentiment-pulse/surveys/SUR00001/process
Authorization: Bearer <admin token>
```

```json
{
  "surveyId": "SUR00001",
  "accepted": true,
  "job": {
    "jobId": "example-uuid",
    "state": "scheduled",
    "stored": 0,
    "skipped": 0,
    "failedBatches": 0,
    "failedWrites": 0,
    "error": null
  }
}
```

A repeat while the same process owns a scheduled/running job returns 202 with
`accepted: false` and the same job. A survey with no enabled inference questions and no satisfaction rules returns
200, schedules nothing, and makes no model call:

```json
{"surveyId":"SUR00001","state":"not_configured","job":null}
```

For a rating-only survey, Process returns HTTP 200 with `surveyId`,
`state: "configured"`, `job: null`, and `summary` (the reporting shape below).
Satisfaction is computed immediately from staged rating entries; no background
job or model call is needed. GET processing also reports `state: "configured"`
when satisfaction rules exist without text/choice inference questions.

`GET /surveys/{id}/processing` returns `surveyId`, configuration `state`, `job`
(or null on another worker/after restart/eviction), `progressDurable: false`, and
`summary`. The summary has the same aggregation shape as Trends, without a date
filter. This is available for Mobile Surveys reporting; the restored card/results UI
continues to use its previous survey fields, while the compact Process action uses
this status API. Existing survey-list, survey-results, summary, and Regional Analysis
definitions/serializers are unchanged.

Example Trends request:

```http
GET /api/sentiment-pulse/trends?timeRange=custom&startDate=2026-10-01&endDate=2026-10-28&regions=NCR&surveyId=SUR00001
Authorization: Bearer <admin token>
```

Illustrative response with one prediction and two eligible text/choice answers:

```json
{
  "sources": ["mobile"],
  "filters": {
    "timeRange": "custom", "startDate": "2026-10-01", "endDate": "2026-10-28",
    "regions": ["NCR"], "surveyId": "SUR00001", "unknownRegionIncluded": false
  },
  "sentimentStatus": "configured",
  "satisfactionStatus": "not_configured",
  "totals": {
    "eligibleAnswers": 2, "predictedAnswers": 1, "answersWithoutResults": 1,
    "calm": 0, "worried": 1, "worriedShare": 100.0,
    "satisfactionAnswers": 0, "satisfiedAnswers": 0, "satisfactionShare": null,
    "dissatisfiedAnswers": 0, "neutralSatisfactionAnswers": 0
  },
  "daily": [{
    "date": "2026-10-28", "eligibleAnswers": 2, "predictedAnswers": 1,
    "answersWithoutResults": 1, "calm": 0, "worried": 1, "worriedShare": 100.0,
    "satisfactionAnswers": 0, "satisfiedAnswers": 0, "satisfactionShare": null,
    "dissatisfiedAnswers": 0, "neutralSatisfactionAnswers": 0
  }],
  "regions": [{
    "region": "NCR", "eligibleAnswers": 2, "predictedAnswers": 1,
    "answersWithoutResults": 1, "calm": 0, "worried": 1, "worriedShare": 100.0,
    "satisfactionAnswers": 0, "satisfiedAnswers": 0, "satisfactionShare": null,
    "dissatisfiedAnswers": 0, "neutralSatisfactionAnswers": 0
  }],
  "surveys": [{
    "surveyId": "SUR00001", "sentimentStatus": "configured",
    "satisfactionStatus": "not_configured", "eligibleAnswers": 2,
    "predictedAnswers": 1, "answersWithoutResults": 1, "calm": 0, "worried": 1,
    "worriedShare": 100.0, "satisfactionAnswers": 0, "satisfiedAnswers": 0,
    "satisfactionShare": null, "dissatisfiedAnswers": 0, "neutralSatisfactionAnswers": 0
  }],
  "modelVersions": {
    "sha256:1dbbd75538ac2a326a097a71ac38113145c71c6e0daafee5dd21e91f110d5df0": 1
  },
  "mixedModelVersions": false,
  "excludedInvalidSubmissionDates": 0
}
```

## Eligibility, aggregation, and write ownership

- The existing flow remains submission → `survey_responses` → End Survey stages
  per-answer `analytics_entries` with null sentiment → explicit Process → stored
  annotations → reporting. Process never stages entries or backfills linkage.
- Every read/write for predictions is scoped to `source_type=survey_response`,
  the selected `survey_id`, and `source_platform=mobile`. Each write additionally
  matches exact `_id`, original text/raw answer, question ID/type, source ID, and
  response ID. Deleted or changed entries cannot receive a stale prediction.
- Text and multiple-choice IDs are derived from actual question types when no
  override exists. Text answers must match the trimmed raw string; blanks,
  numeric-only text, common contextless text placeholders, and inputs over 10,000
  characters are excluded. Selected choice labels are sent literally, including
  labels such as Yes, No, Satisfied, or numeric choice labels. String/numeric scalar
  choice values must match their staged text; booleans, lists and objects are
  excluded. Explicit `excludedTexts` still applies. Casing and Unicode are preserved.
- Rating satisfaction uses original raw values, with 1-2 dissatisfied, 3 neutral,
  and 4-5 satisfactory on the approved 1-5 scale. The denominator includes all five
  valid values; neutral is not silently dropped. Values outside the scale are
  excluded. Satisfaction is computed in reporting, without duplicate storage.
- Targeted `$set` writes exactly **three analytics fields**:
  `analysis.sentiment` (`calm`/`worried`), `analysis.sentiment_score` (returned
  worried probability), and the owner-approved `analysis.sentiment_model_version`.
  The last is the only new analytics field. No processing metadata structure,
  collection migration, duplicate results collection, or summary storage was added.
- Audit found generic `analysis.model_version` initialized by shared entry builders
  for multiple analysis tasks. Its exclusive sentiment ownership cannot be assumed;
  it is never changed. Language, language metadata, other annotations, global
  statuses/errors, generic timestamps, and all original answer data stay intact.
- A result is reportable only with calm/worried, a finite score in [0,1], and a
  valid sentiment SHA-256 model version. Null is unavailable. Numeric zero is valid.
  Any non-null sentiment, score, or sentiment-version field blocks new annotation,
  even if malformed or of unknown ownership. No overwrite/reprocessing policy was
  authorized. A new model version only processes still-unannotated entries.
- `worriedShare = worried / (calm + worried) * 100`, counting classified text/choice answers, not
  respondents. Scores are not averaged. An empty denominator returns null.
  Satisfaction has its own valid-rating denominator and can disagree
  with calm/worried. The same `annotation_reporting.report` implementation serves
  Trends and Mobile Surveys processing summaries.
- Computed `dissatisfiedAnswers` and `neutralSatisfactionAnswers` are returned
  alongside `satisfiedAnswers`/`satisfactionAnswers` in totals, daily, region, and
  survey rows. They do not add MongoDB fields. For legacy overrides without explicit
  category sets, the corresponding category count is null when scored answers exist;
  an unknown category mapping is not reported as zero.
- Dates use original `event_time` (the staged original submission date), with
  original `created_at` as fallback when event time is absent. ISO offsets are
  converted to Philippine time; legacy naive dates follow the existing Philippine
  convention. No analysis time is used. Inclusive day bounds and request-time caps
  reuse `get_response_date_range`; invalid submission dates are excluded and counted.
- Regions reuse `dashboard_region`/normalization, including staged `location.region`.
  Contradictory or unknown regions are returned explicitly as `region: null` when
  no region filter is selected. A specific region filter excludes unknowns.
- Reporting combines versions and exposes `modelVersions` counts and
  `mixedModelVersions`. Each retained label uses that bundle's saved threshold;
  historical labels are not recalculated under the newest threshold. There is no
  mandatory old-annotation or submission-linkage backfill.

## HTTP service and progress limitations

The main backend imports only `httpx` for inference, already an existing backend
dependency. It does not import torch, transformers, tokenizers, or model assets.
Configuration uses process environment variables, without editing `.env` files:

| Variable | Default / contract |
| --- | --- |
| `HEALTHPH_SENTIMENT_URL` | `http://127.0.0.1:8002`; operator must keep this a private HTTP(S) origin |
| `HEALTHPH_SENTIMENT_TIMEOUT_SECONDS` | 30 seconds; finite, greater than zero, at most 120 |
| `HEALTHPH_SENTIMENT_QUESTIONS_FILE` | Unset; optional owner-approved configuration fallback |
| `HEALTHPH_SENTIMENT_ARTIFACT_DIR` | Service-only override; defaults to its canonical `model/` |

Client calls `GET /health/ready` before the first pending text/choice prediction, then
`POST /v1/sentiment/predict-batch` with `{"texts":[...]}`. Completed scopes do not
require an available model. Batches contain at most 32 texts and each text at most
10,000 Unicode characters. The service retains its saved whitespace normalization,
casing/Unicode, tokenizer, 256-token truncation, labels, and threshold. No cleaner,
translation, training, or replacement model was introduced. HTTP proxy environment
variables and redirects are disabled for this private client.

The client validates readiness, response count, positional mapping, integer labels,
names, finite bounded probabilities/thresholds, inclusive threshold consistency,
stable threshold within a job, and matching SHA-256 model version. A version switch
during a job fails subsequent batches. The supplied protocol returns no echoed
input IDs/indices: arbitrary permutation by a noncompliant remote server cannot
be independently detected; order relies on the supplied service's tested positional
contract. Timeout, malformed JSON/predictions, and unavailable service are failures,
never calm fallbacks. Failed batches are not retried automatically.

Processing uses existing FastAPI `BackgroundTasks`, with a locked in-memory latest
job per survey (maximum 256 retained survey jobs; inactive entries may be evicted).
No persistent job tracking infrastructure was found. Job states are `scheduled`,
`running`, `completed`, `completed_with_errors`, or `failed`; they describe only this
process's job and are not stored on entries. Counters are cumulative local writes,
skipped answers, failed inference batches, and failed writes. They are not a durable
percentage-complete contract. `answersWithoutResults` is the durable reporting
distinction; it does not assert pending, failed, or interrupted status.

Same-process repeated requests coalesce while a job runs. Across workers, duplicate
inference is possible; atomic guarded writes accept only the first annotation.
There is no cross-worker claim, automatic restart recovery, durable queue, or
polling affinity. After restart, retry Process to scan remaining unannotated
answers. Successful writes survive another batch/write failure. A crash between
inference and persistence may require inference again. Reporting streams the full
scoped cursor with a projection, without the raw-entry endpoint's 100/500 limits;
it scans answers in Python and has not been production load-tested.

## Local model installation and operation

Canonical service: `services/sentiment-analysis-service/`. The supplied archive
was inspected in `C:\Users\NU\Downloads\sentiment-analysis-service-20261028T013521Z-1-001.zip`.
Before changes, service source matched the archive after line-ending normalization,
except intentional Git-ignore rules. There was no existing model bundle; the new
service successfully bound port 8002. Only the complete archive `model/` content was extracted;
archive caches and source were not copied over the service.

The staged bundle was hash-checked file-by-file against the archive, loaded offline,
and exercised before activation. It is installed at `services/sentiment-analysis-service/model/`.
An identical complete ignored copy is retained at `.sentiment-backup-initial/`.
Since no old model existed, that copy is the initial installed bundle, not an older
model generation. The service was started against the active canonical directory
and its real HTTP readiness and predictions were verified.

The host originally had only Python 3.11, incompatible with pinned NumPy 2.5.1.
A private Python **3.14.10** was installed under `.runtime/`, and the unchanged
supplied inference/test dependency pins installed into `.runtime/venv/` (torch
2.14.0, transformers 5.16.1, tokenizers 0.23.1, safetensors 0.8.0, NumPy 2.5.1,
FastAPI 0.141.1, Starlette 1.6.0, Pydantic 2.13.5, uvicorn 0.52.4).
The service's `.venv/` is a separate Python 3.11 test/bootstrap environment,
not the model runtime. Main backend dependencies were not changed.

Start from the service directory in PowerShell:

```powershell
$env:HF_HUB_OFFLINE = '1'
$env:TRANSFORMERS_OFFLINE = '1'
.runtime/venv/Scripts/python.exe -m healthph_sentiment.api
```

It listens locally at `127.0.0.1:8002`; it is not deployed or exposed publicly.
The local verification service was left running (process 33140 at handoff time;
verify the current listener rather than assuming that PID remains valid).

Active version:
`sha256:1dbbd75538ac2a326a097a71ac38113145c71c6e0daafee5dd21e91f110d5df0`.
Saved worried threshold: **0.7263377904891968**. Saved max length: **256**.

Real observed HTTP predictions (rounded):

| Input | Label | Worried probability |
| --- | --- | --- |
| I am worried that my fever is getting worse. | worried | 0.8097761 |
| Buti na lang okay na siya ngayon. | calm | 0.0075019 |
| Kinakabahan ako, my fever is not going away. | calm | 0.0088067 |
| Whitespace, ñ, emoji, and hashtag input | calm | 0.0074580 |

The mixed-language example illustrates that model output may differ from human
expectation. These checks establish loading, protocol behavior, and parity, not
accuracy, calibration, or suitability for satisfaction measurement.

During the rule update, real HTTP inference on selected-choice labels returned
`calm` for both `Satisfied` (worried probability 0.00755947) and `Dissatisfied`
(0.00752946), and also for `Yes` (0.00757347). The model version and saved threshold
were unchanged. These observed classifications are not satisfaction scores, and
short choice labels may not behave as a human expects. No manual label remapping
or model-quality claim was introduced.

For a replacement bundle:

1. Inspect the incoming package and existing canonical service first. Extract only
   the complete bundle into a new `.sentiment-staging-<unique-name>/` under this
   service. Never extract a nested second service or merge files into `model/`.
2. Compare `artifact_fingerprint` for incoming and active bundles using the supplied
   `healthph_sentiment.inference` functions. Keep the active bundle if identical.
   The fingerprint includes inference settings, weights, tokenizer, labels, and
   threshold, and ignores training-only run metadata.
3. Load `SentimentPredictor(staging_path)` and run representative predictions in
   the isolated runtime. Verify complete files, 256-token contract for this model,
   expected labels/threshold, and offline loading. Leave active service untouched
   if validation fails. Do not substitute exports or retrain.
4. Stop every service using the active bundle. For an interactive service use
   Ctrl+C; otherwise verify the port's owning process/command before stopping it.
   Resolve both filesystem targets and check they remain under the canonical
   service directory before any move. Rename the entire `model/` to a unique
   `.sentiment-backup-<timestamp>/`, then rename the entire staged bundle to `model/`.
   Never replace selected files or mix exports. Keep the backup after success.
5. Restart with the command above. Check `GET /health/ready`, then real
   `POST /v1/sentiment/predict-batch` results, including version, threshold, label,
   order/count, and representative Unicode inputs. If activation fails, stop the
   failed service, move the whole failed bundle aside to an ignored staging path,
   restore the whole backup as `model/`, restart, and verify readiness/predictions
   with the old version. Do not delete the last working bundle.

The supplied export helper validates staged artifacts and restores an old bundle
on a rename failure, but its temporary previous copy is cleaned on success. It
does **not** replace the persistent rollback-copy and post-start HTTP checks above.

Preserved ignores: `/model/`, `/models/*.bin`, `/models/*.ftz`. Staging, backup,
runtime, export temporary directories, test caches, and download caches are ignored.
`git check-ignore` verified weights, both legacy model patterns, backup, runtime,
and caches. `git ls-files` returned no files in those service model/runtime/backup
paths. No weights were force-added and no unrelated tracked models were removed.

## Verification and compatibility scope

Run backend checks from the repository root using a separate test environment:

```powershell
python -m pip install -r server/requirements-sentiment-pulse-test.txt
python server/scripts/run_sentiment_pulse_checks.py
```

The installed test interpreter here is
`services/sentiment-analysis-service/.venv/Scripts/python.exe`.
The runner launches each suite in a separate process, forbids real `config.database`
imports and MongoClient construction, and disables optional MongoDB integration
tests. Controller imports use in-memory fixtures. No shared MongoDB was contacted.

Current backend results: **111 passed, 6 skipped** (117 test cases across nine suites).

| Suite | Cases | Result |
| --- | ---: | --- |
| Sentiment Pulse annotations and scoring | 32 | All pass |
| Existing Sentiment Pulse dashboard summary | 11 | 9 pass, 2 optional Mongo tests skipped |
| Existing Sentiment Pulse Regional Analysis | 8 | All pass |
| Existing application survey/question/answer IDs | 8 | All pass |
| Existing regional summaries | 15 | All pass |
| Existing dashboard regions | 10 | 6 pass, 4 optional Mongo tests skipped |
| Existing mobile registration and analytics | 12 | All pass |
| Existing Disease Watch storage | 8 | All pass |
| Existing Disease Watch alert processing | 13 | All pass |

New coverage includes exact survey/source/platform write isolation; language,
statuses, metadata and timestamps preserved; 601 entries; repeated/coalesced jobs;
competing annotation and language writes; deleted/changed inputs; partial inference
and write failures; readiness failures; malformed/count/version/threshold/probability
responses; input limits/Unicode; explicit eligibility; separate typed satisfaction
scoring; null/zero; Philippine date boundaries; unknown regions; role enforcement;
configuration and shared reporting contracts. Unchanged analytics language-worker
success/failure paths and shared language HTTP contract were executed with mocks.
The unchanged dataset language-worker function was extracted from its AST and
executed with isolated dependencies, confirming social-media scope and survey
preservation; the full heavy dataset module/runtime was not started.

Model service verification from its directory:

```powershell
$env:HF_HUB_OFFLINE = '1'
$env:TRANSFORMERS_OFFLINE = '1'
$env:OMP_NUM_THREADS = '2'
$env:MKL_NUM_THREADS = '2'
.runtime/venv/Scripts/python.exe -m pytest -q --run-model --basetemp .cache/pytest-full-check -p no:cacheprovider --tb=short
$env:HEALTHPH_TEST_REAL_SERVICE = '1'
node --test tests/sentiment-client.test.mjs
```

At the original model installation: **92 Python tests passed**, including real model/notebook-loader parity,
multilingual inputs, Unicode/order/truncation, offline copied-service operation,
restart activation, and export rollback tests; **18 JavaScript client tests passed**,
including real local HTTP inference. These supplied service suites were not rerun
for the question-type/rating-rule change; the model implementation was unchanged.
The Python inference client also directly
verified real readiness and representative predictions over HTTP.

Two supplied test assertions needed Windows-only path portability fixes (`as_posix`
and escaping regex paths); the copied-service test now excludes local runtimes,
caches, and rollback bundles. Service inference/API/export implementations and
requirements were preserved. Initial sandbox temp-directory/DLL/Node spawn failures
were rerun successfully with required local execution permissions.

At the original backend milestone, inspected without frontend changes: Model Access Toolkit's existing dataset and
`/analytics-entries/process` integrations; dataset processing selectors/updates;
Electra dataset helper separation; Disease Watch's self-report analytics builder
and ingestion call; generic analytics serializer. Toolkit browser flows, full
dataset/Electra runtime, and full main-app startup were not exercised. Main-app
startup was deliberately avoided because its existing database module initializes
a real connection. Mocked regression checks do not establish deployed MongoDB
behavior, cross-worker coordination, model quality, or production capacity.

Final diff review: no edits to `analyticsEntryController.py`, `datasetsController.py`,
`diseaseWatchFeedController.py`, shared database configuration, language helpers,
Regional Analysis calculations, existing summary definitions, or client files.
Existing user modifications to the service ignore file were retained.

## Remaining owner decisions

- Defaults now cover text, multiple choice, and the owner-approved 1-5 rating rule.
  Custom ranges and optional explicit per-survey overrides still need their own rules.
- The restored Mobile Surveys cards/results retain their legacy display; they do
  not yet visualize the new analytics annotations or computed rating categories.
- Any overwrite/reprocessing policy for existing non-null annotations needs a
  separate ownership decision. Currently all such fields are preserved.
- Operational acceptance of in-process jobs, duplicate inference across workers,
  linear reporting scans, and model suitability requires deployment planning and
  real workload/quality evaluation. Durable recovery was not implemented or claimed.

## Sentiment Trends web/mobile reporting update (2026-10-29)

This follow-up is limited to Sentiment Trends and a new mobile aggregate read API.
The existing admin `/api/sentiment-pulse/trends` response, role dependency,
calculations, filters, and consumers are unchanged. The web uses one Trends
response for Overview, Trends, and Detailed Data, in that scrolling order.
Overview includes overall sentiment, analysis coverage, and the existing Worried
Share Over Time and Satisfaction Over Time graphs. Trends adds separate horizontal
sentiment and satisfaction distributions with exact percentage/count tables.
Survey Breakdown and Daily Answer Counts remain directly available under Detailed
data. Existing time-series styling, null gaps, and detailed table contents remain.
There is one satisfaction time-series graph. Shared `SentimentSummary`,
`sentimentContract`, StaticContainers, parent filters/queries, Regional Analysis,
Mobile Surveys, and all export branches are unchanged. Existing Trends CSV fields
already contain the summed counts and denominators behind these presentations.

The requested web sentiment distribution now keeps categories in Calm, Neutral,
Worried order, displaying Neutral as 0 answers and 0% when classified answers
exist. This is a display reference category: the stored classifier and mobile
report remain Calm/Worried only. Missing predictions are never counted as Neutral.
With no classified answers, all distribution shares remain unavailable.

The web view uses short labels and omits explanatory paragraphs under the charts
and tables. Missing results and incomplete analysis retain brief status messages.
This wording change is confined to Trends; metric definitions, API fields, shared
summaries, and exports keep their existing meanings.

The existing satisfaction time-series card is now titled "Satisfaction Answers
Over Time" and shows stacked daily answer counts for Satisfied (green), Neutral
(theme gray), and Dissatisfied (destructive red). Its vertical axis is an automatic
whole-answer scale starting at zero, with exact counts in tooltips. With complete
category mappings, the stack height is the day's total scored satisfaction answers.
Missing days, dates without scored satisfaction answers, and unavailable category
mappings stay gaps rather than invented zero counts. Incomplete category mappings
show a brief unavailable message. Daily Answer Counts also exposes Neutral and
Dissatisfied counts within its grouped Satisfaction cell as a tabular equivalent.
Satisfaction Distribution and the overall satisfaction summary remain percentages.
This web presentation uses existing daily counts without backend, mobile API,
scoring, filter, or export changes; mobile retains its date-based percentage trend.

Detailed Data is now presented by the Trends-only `TrendsDetailedData.jsx`:

- Survey Breakdown uses Survey, Sentiment, Analyzed, and Satisfaction columns.
  Sentiment shows both Calm and Worried percentages of classified answers with
  their counts. Analyzed is classified/eligible (for example `3/5`), with the
  without-results count shown below when positive. Satisfaction shows the leading
  rating category (Satisfied, Neutral, or Dissatisfied), with its count out of
  valid scored answers. Equal leading counts list the tied categories explicitly.
  Missing category mappings show Not available; zero scored answers show No answers.
  The keyboard-accessible Breakdown retains all category counts and percentages.
  Labels use scoped summed counts, not model predictions or a fixed percentage
  threshold, and require a complete category mapping before choosing a leader.
- Daily Answer Counts uses Date, Analyzed, Sentiment, and Satisfaction columns.
  Counts are grouped under their full category names. The satisfaction total stays
  visible; native keyboard-accessible Percentages disclosures retain daily Calm,
  Worried, Satisfied, Neutral satisfaction, and Dissatisfied shares. Dates display
  in short Philippine format and retain their original ISO date in a `time` element.
- Both tables remain in the scrolling page, with captions, row/column headers,
  named focusable scroll regions, and all previous counts/percentages available.
  Zero, missing category mappings, incomplete analysis, and empty tables retain
  distinct displays. No backend, filters, graphs, mobile routes, shared summaries,
  or export branches changed for this table update.
- The three frontend suites (integration, Regional Analysis, and summary cards)
  passed **44 tests** after the table update. Focused ESLint and `git diff --check`
  also passed. Browser layout and interaction QA remains unverified because of the
  browser-access limitation recorded below.

The dashboard summary cards now use shorter text: Sentiment Score, Survey
Responses, Active Regions, and Latest Response. Helper labels use concise phrases
such as analyzed answers, Published surveys, With responses, and Next month.
The sentiment card's full filter scope remains available on hover and to screen
readers. Response comparisons still refer to survey publication months, region
counts still use the latest published surveys, and Latest Response still shows the
original response cutoff in Philippine time. Error, empty, unknown-region, and
incomplete-analysis messages are shortened. This changes only card wording in
`StaticContainers.jsx` and corresponding assertions; props, queries, and refresh
behavior are unchanged. Sentiment Score displays the dominant Calm/Worried category
alongside its share of analyzed answers, reusing the existing `surveyCardSentiment`
assessment without changing it. A tie reads Calm / Worried with 50% each. The
percentage represents the category's answer share, not model confidence or an
average model probability. Analysis counts, missing-result counts, applied filter
scope, loading/error states, and absent results remain distinct. Other summary
cards retain their metrics and layout.

The Sentiment Trends toolbar now groups the time range, regions, and optional
survey selector in that order, with Refresh Results aligned to the right on
screens with sufficient space. It wraps on smaller screens; custom dates and
selected-region chips remain below the main row. The existing shared filter
component accepts optional control/action slots while its default Regional
Analysis rendering is preserved. Filter state and query parameters are unchanged.
Refresh reuses the existing Trends refetch and is disabled during a fetch, for
invalid dates, and before the query has initialized. The separate survey card and
chart-header refresh button were replaced by this single toolbar action; the
existing reporting-scope text and error retry remain available. This is a web-only
layout change and does not affect mobile reporting.

### Mobile endpoint and visibility

```http
GET /api/mobile/sentiment-pulse/trends?timeRange=last-30-days
Authorization: Bearer <mobile access token>
```

This separate GET route uses `require_mobile_auth` (JWT audience `mobile`, type
`mobile_access`) and verifies that its subject is an existing mobile registration
with the existing mobile role. Missing, invalid, expired, wrong-audience,
wrong-type, or unrecognized mobile credentials return 401. Admin reporting access
has not been broadened; an admin token is not a mobile token.

Results aggregate **all participants' eligible mobile answers**, independent of
the authenticated user's answers or profile region. Server-side visibility requires
`publishToMobile: true` and a valid `scheduledAt` no later than request time, reusing
the existing publication-eligibility helper. Ended surveys remain reportable:
ending stages their answers for analysis. Drafts, future publications, missing
surveys, and website-only surveys are excluded. Requesting any such `surveyId`
returns the same 404. Publication eligibility is independent of the selected
submission window. This is historical reporting visibility, not the active survey
list's eligibility for accepting new submissions.

Filters have the same meanings as admin Trends:

- `timeRange`: defaults to `last-30-days`; also `last-7-days`, `last-90-days`,
  or `custom`. Rolling ranges include today and the preceding N-1 Philippine days.
- `startDate`, `endDate`: required only for `custom`, inclusive calendar dates;
  reporting is still capped at request time. Date validation/error behavior reuses
  the admin helper, including its handling of future custom end dates. Bad dates,
  reversed ranges, unsupported ranges, and unknown regions return 400.
- `regions`: optional comma-separated canonical codes or existing recognized
  aliases; normalized/deduplicated on the server. Omission includes unknown regions;
  a specific region selection excludes them. This is a reporting filter, not a
  participant identity filter.
- `surveyId`: optional exact application survey ID, restricted by mobile visibility.

Response fields are explicitly allowlisted by this feature's adapter. Example
with three classified answers out of four eligible, and five valid ratings:

```json
{
  "sources": ["mobile"],
  "filters": {
    "timeRange": "custom", "startDate": "2026-10-28", "endDate": "2026-10-28",
    "regions": ["NCR"], "surveyId": "SUR00001", "unknownRegionIncluded": false,
    "timezone": "Asia/Manila", "surveyVisibility": "published-to-mobile",
    "participants": "all"
  },
  "sentiment": {
    "status": "configured", "dominantCategory": "calm",
    "dominantShare": 66.66666666666666,
    "eligibleAnswers": 4, "predictedAnswers": 3, "answersWithoutResults": 1,
    "analysisCoverage": 75.0
  },
  "satisfaction": {
    "status": "configured", "satisfactionAnswers": 5,
    "satisfiedAnswers": 2, "satisfactionShare": 40.0
  },
  "sentimentDistribution": [
    {"category": "calm", "answers": 2, "share": 66.66666666666666},
    {"category": "worried", "answers": 1, "share": 33.33333333333333}
  ],
  "satisfactionDistribution": [
    {"category": "satisfied", "answers": 2, "share": 40.0},
    {"category": "neutral", "answers": 1, "share": 20.0},
    {"category": "dissatisfied", "answers": 2, "share": 40.0}
  ],
  "satisfactionTrend": [
    {"date": "2026-10-28", "satisfactionAnswers": 5,
     "satisfiedAnswers": 2, "satisfactionShare": 40.0}
  ]
}
```

### Units, denominators, unavailable values, and dates

- Every count is **answers**, not unique respondents. All percentages are numbers
  in **0–100 percentage units**, not 0–1 fractions. Display rounding is a client
  concern. Overall percentages use summed counts, never averages of daily/survey
  percentages. Model probabilities are never used as population or satisfaction
  percentages.
- `predictedAnswers` is classified eligible sentiment answers, equal to Calm plus
  Worried. Distribution `share` is category answers / `predictedAnswers` × 100.
  `dominantCategory` is `calm`, `worried`, `tie`, or null when none is classified.
  A tie has `dominantShare: 50` and means equal Calm/Worried counts. Otherwise
  `dominantShare` is the larger category's share of classified answers.
- `analysisCoverage` is `predictedAnswers` / `eligibleAnswers` × 100. It is null
  with no eligible answers, and measured zero when eligible answers exist but none
  have results. `answersWithoutResults` indicates incomplete analysis, without
  asserting whether those answers are pending, failed, or interrupted.
- Satisfaction uses its separate `satisfactionAnswers` denominator: valid raw
  scored answers under the existing survey/operator rules. Summary/trend
  `satisfactionShare` is `satisfiedAnswers` / `satisfactionAnswers` × 100.
  Each satisfaction distribution share uses that same denominator. Default 1–5
  ratings use 4–5 Satisfied, 3 Neutral, 1–2 Dissatisfied. Explicit overrides remain
  authoritative; unsupported scales are not assigned the 1–5 defaults.
- `neutral` in `satisfactionDistribution` means rating satisfaction only. There is
  no neutral text sentiment. If a legacy override does not define a category,
  that category's `answers` and `share` remain null when scored answers exist.
  They are not inferred from the remaining categories. Any share with a zero
  denominator is null; a measured category count of zero with a positive
  denominator has share 0. Status is `configured` or `not_configured`, independent
  of whether observations exist in the requested window.
- `satisfactionTrend` contains date-based satisfaction counts needed for its
  denominator/tooltips, without the web's daily sentiment/count-table data. Dates
  follow original submission `event_time`, falling back to original `created_at`,
  converted to Asia/Manila under the existing legacy-naive convention. Invalid
  dates are excluded. Only dates observed by the shared report are returned;
  a date with text-only observations has null satisfaction share. Absent days and
  null shares must remain chart gaps, never zero-filled or connected across gaps.
- `filters` echoes the applied date/region/survey scope and adds the fixed timezone,
  publication visibility, and all-participant scope. Equivalent authorized
  admin/mobile scopes produce matching counts and percentages; admin's unrestricted
  all-surveys scope can intentionally include surveys unavailable to mobile.

No raw answers, participant identifiers, per-survey breakdowns, regional breakdowns,
model metadata, worried-share series, or detailed daily-count table data are
returned to mobile. The route calls the existing `annotation_reporting.report`
read service and projects its result. It does not trigger inference, staging,
submission, configuration writes, or any collection/schema changes. The existing
linear report scan remains; no production capacity claim is made. Mobile screens
and other mobile workflows were not changed.

### Checks for this follow-up

- Frontend: **43 passed**, using the four existing suites for Sentiment Pulse
  integration, Regional Analysis, summary cards, and dashboard regions. New checks
  cover section order, both retained graphs/tables, weighted totals, dominant/tied
  sentiment, incomplete coverage, missing/zero values, and unknown category mappings.
  Existing CSV and Mobile Surveys checks pass without export/component changes.
- Backend: **119 passed, 6 optional MongoDB cases skipped**, across the ten suites
  in `server/scripts/run_sentiment_pulse_checks.py`. The added eight mobile tests
  cover JWT access controls, publication visibility, all-participant aggregation,
  authorized web/mobile parity, identical scope, Philippine midnight, partial
  processing, no writes/inference on GET, minimal response fields, gaps, null/zero,
  weighted totals, custom scoring overrides, and unsupported scales. All storage
  used in these checks is in memory; real MongoDB construction is blocked.
- Focused frontend ESLint and the production build passed. Build output went to
  ignored `client/dist/sentiment-trends-check`, leaving the served `build/` alone.
  The build reported Browserslist age, CSS minifier syntax, and bundle-size
  warnings; no global styles or dependencies were changed to address them.
- `git diff --check` passed. Scope review confirms no edits to existing shared
  reporting calculations/contracts, submission/staging/inference, survey schemas,
  Regional Analysis, Mobile Surveys, shared cards, styles, or export branches.
- Browser visual/interaction QA could not be completed: the browser host was
  unavailable, and the Windows fallback stopped because it could not establish
  the current browser URL. Desktop/narrow-screen rendering, live tooltips, and
  keyboard interactions therefore remain unverified in a real browser. No
  production app startup, deployment, production data access, or model execution
  was performed for this follow-up. The existing report still scans scoped answers
  in Python and has not been production load-tested.
