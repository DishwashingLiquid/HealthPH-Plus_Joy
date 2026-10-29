# Sentiment Pulse integration decisions

Recorded: 2026-10-28 (Asia/Manila).

Status: backend collection flow agreed; implementation deferred. This note does
not authorize implementation, dependency installation, deployment, or database
changes.

## Agreed collection flow

1. A mobile user submits survey answers to `survey_responses`.
2. Ending the survey prepares per-answer entries in `analytics_entries`, using
   the existing backend flow.
3. Those entries initially have `analysis.sentiment = null` and
   `analysis.sentiment_score = null`, as the current entry builder already sets.
4. Clicking the survey's Process button will initiate backend processing of
   eligible written explanations from that survey's analytics entries.
5. The backend sends text to the private `sentiment-analysis-service`. The model
   service returns predictions; it does not need MongoDB access.
6. The backend updates the corresponding existing analytics entries with the
   calm/worried label, worried score, and sufficient processing/model metadata.
7. Sentiment Trends and Mobile Surveys sentiment summaries will use the stored
   analytics annotations through backend reporting APIs.

No separate sentiment results collection is planned. An additional blank
sentiment field in `survey_responses` is unnecessary for this flow; annotating an
analytics entry does not automatically update the original submission.

## Confirmed constraints and reporting intent

- Keep changes to shared collections and shared backend features minimal, and
  preserve behavior relied on by other dashboards.
- Reuse existing parameters, helpers, API infrastructure, and fields where their
  meanings match the new functionality.
- Show satisfaction and calm/worried sentiment as separate measures.
- Survey input includes ratings and written explanations. The model predicts
  calm/worried for text; ratings require their own satisfaction calculation.
- A null sentiment means no classification is available, not calm or neutral.
- Existing overall processing status can represent language detection; it alone
  must not be treated as proof that sentiment inference completed.

## Still to design and validate

- Exact processing API, retry ownership, task completion metadata, and protection
  against duplicate work or overwriting unrelated annotations.
- Written-question eligibility, satisfaction scoring, platform scope, reporting
  denominators, and per-survey versus date-filtered summaries.
- Compatibility of calm/worried values with shared analytics consumers.
- Model runtime compatibility, throughput, and accuracy on representative survey
  explanations and intended languages.

Dashboard layouts and API contracts discussed after this decision remain
recommendations until explicitly accepted.
