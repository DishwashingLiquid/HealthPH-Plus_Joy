# Region handling

The dashboards use the current region fields of each record type:

- Analytics entries: `location.region` (self-reports also retain submitted region
  code/name as evidence, so conflicting input remains unknown).
- Survey responses and content interaction events: `region`.
- Registered mobile users: `regionCode`/`regionLabel`.
- Desktop users: `region`.

`region_normalization.py` defines supported geographic codes and names.
Normalizing input casing, whitespace and geographic names is part of the current
input contract. It does not read retired database field layouts. Missing or
conflicting geographic evidence remains unknown and is reported separately.

Mobile Integration report results read processed analytics. Content interaction
metrics read current analytics events. Survey submission grouping uses the
`submission_id` written to each analytics entry at ingestion. No historical
record repair or profile-location lookup runs during report requests.
