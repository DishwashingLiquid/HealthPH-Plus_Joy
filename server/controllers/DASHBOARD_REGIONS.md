# Region handling in the three health dashboards

`dashboard_regions.py` is a read-only adapter for Disease Watch Feed, Health
Literacy Hub, and Sentiment Pulse Tool. It reuses the aliases and codes in
`region_normalization.py` without changing that module. Other dashboards and
mobile submission models keep their existing contracts.

## Resolution rules

- Known names, codes, casing and whitespace variations resolve to a canonical
  code, such as `Metro Manila` -> `NCR` or `Region IV-A` -> `IVA`.
- Numeric codes use the existing explicit allowlist. Unverified codes and city
  names are not guessed.
- An unknown field can fall back to another recognized region field.
- Contradictory recognized fields resolve to unknown. Missing fields, `all`,
  `N/A`, and unrecognized values also resolve to unknown.
- The adapter examines only the explicit paths configured for that record type.
  It does not query a respondent's current profile or infer a survey answer's
  meaning from its question text.

## Dashboard behavior

Sentiment Pulse resolves response regions in MongoDB before distinct-region
aggregation. Unknown responses still count toward response totals and are
reported separately for the latest five published surveys.

Disease Watch Feed's admin JSON export adds a canonical `region`. Coverage
groups this value rather than the map pin's display name. Mobile submissions,
the mobile "mine" response shape, stored locations, and alert automation are
unchanged. Deploy the API before the client so this export field is available.

Health Literacy Hub normalizes event and account region filters on reads. It
no longer derives a content region from its title or ID. Content without an
explicit region has unknown geographic scope; regional engagement uses the
interaction's region. Existing synthetic region values cannot be distinguished
from real values automatically, so no historical values are rewritten.

Normalization at query time avoids a data migration and keeps raw responses
out of application memory. It adds query work: source/date filters can use their
existing indexes, while normalized region expressions cannot use a plain
region index directly. No database documents or indexes are changed by this
implementation.

## Validation

Run `python -B -m unittest discover -s server/tests -p test_dashboard_regions.py`.
The optional MongoDB tests use collectionless aggregations over synthetic
documents only. Set `DASHBOARD_REGION_TEST_URI`, or
`DASHBOARD_REGION_TEST_USE_CONFIG=1` to use the server's configured connection.
They never query stored response documents or write records.

From `client`, run `node --test tests/dashboardRegions.test.mjs
tests/sentimentPulseSummary.test.mjs tests/regionalSummaries.test.mjs`.
