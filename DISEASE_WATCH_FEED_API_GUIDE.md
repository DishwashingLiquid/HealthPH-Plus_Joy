# Disease Watch Feed API Guide

The dashboard uses **two GET endpoints**. It combines their data in the frontend to show recent alerts, regional coverage, user analytics, and top metric cards.

| Method | Endpoint | Purpose | Dashboard use |
|---|---|---|---|
| GET | `/api/mobile/self-reports/map-pins` | Gets location and symptom details for each mobile self-report. | Matches reports to their region/location details. |
| GET | `/api/mobile/self-reports/export?format=json` | Gets the mobile self-report list as JSON. | Builds alerts, regional totals, user analytics, and top metrics. |

Base path: `/api` is set by the server. The current frontend configuration uses `http://localhost:8000/api`.

## 1. Get self-report map pins

**Method:** `GET`  
**Path:** `/api/mobile/self-reports/map-pins`

**Purpose:** Returns location, possible condition, and symptom information for mobile self-reports.

**Dashboard use:** Called in `client/src/features/api/diseaseWatchFeedSlice.js` and used in `client/src/pages/admin/diseaseWatchFeed/DiseaseWatchFeed.jsx` to add location and condition details to reports.

**Backend definition:**

- `server/routes/diseaseWatchFeedRoutes.py`
- `server/controllers/diseaseWatchFeedController.py`

### Request details

No request body.

| Parameter | Required | Description |
|---|---:|---|
| `region` | No | One or more comma-separated regions, such as `NCR,IVA`. |
| `date_from` | No | Start date/time, such as `2026-08-01` or an ISO date-time. |
| `date_to` | No | End date/time, such as `2026-08-24` or an ISO date-time. |

The dashboard currently sends **no filters**.

Example:

```http
GET /api/mobile/self-reports/map-pins
```

### Response details

Main response fields:

- `items`: list of report location records
- `items[].id`: public report ID
- `items[].name`: location name, usually the region
- `items[].diseaseId` / `disease`: possible condition ID and label
- `items[].lat` / `lng`: map coordinates
- `items[].tagIds` / `tags`: symptom IDs and labels
- `items[].pinAccuracy`: `geocoded` or `region_estimate`

Example:

```json
{
  "items": [
    {
      "id": "sr_a1b2c3d4e5f6",
      "name": "NCR",
      "diseaseId": "covid_like_respiratory_pattern",
      "disease": "Possible COVID-like respiratory symptom pattern",
      "category": "Self-reported respiratory symptoms",
      "reports": 1,
      "updated": "Self-reported on 8/24/2026 at 10:30",
      "lat": 14.5995,
      "lng": 120.9842,
      "tagIds": ["cough", "fever"],
      "tags": ["Cough", "Fever"],
      "source": "selfReport",
      "pinAccuracy": "geocoded",
      "geocodedAddress": "Manila, Philippines"
    }
  ]
}
```

### Notes for mobile developers

- Send no body; filters are optional.
- No login token is required by this route in the current backend code.
- If coordinates are missing, the backend may use the region's center coordinates. Check `pinAccuracy` before treating a pin as an exact user location.
- There is no pagination.
- Invalid region names, invalid dates, or `date_from` later than `date_to` return a `400` error.

## 2. Export mobile self-reports as JSON

**Method:** `GET`  
**Path:** `/api/mobile/self-reports/export?format=json`

**Purpose:** Returns the main list of mobile self-reports in JSON format.

**Dashboard use:** Called in `client/src/features/api/diseaseWatchFeedSlice.js` and used in `client/src/pages/admin/diseaseWatchFeed/DiseaseWatchFeed.jsx`.

The dashboard uses it to calculate:

- Recent Alerts
- Regional Coverage
- Total Mobile Reporters
- Symptom Reports
- Alert Distribution and Early Warning metric cards

**Backend definition:**

- `server/routes/diseaseWatchFeedRoutes.py`
- `server/controllers/diseaseWatchFeedController.py`

### Request details

No request body.

| Parameter | Required | Description |
|---|---:|---|
| `format` | Yes for JSON use | Send `json` to receive JSON data. |

Example:

```http
GET /api/mobile/self-reports/export?format=json
Authorization: Bearer <access-token>
```

Authentication is required. The dashboard automatically sends its saved bearer token when one is available.

### Response details

Main response fields:

- `items`: list of self-reports, newest first
- `updatedAt`: server update time
- `items[].id`: public report ID
- `items[].mobileReporterId`: public ID used to count unique reporters
- `items[].reporter`: reporter type and role information
- `items[].symptomIds` / `symptomLabels`: symptoms
- `items[].possibleConditionId` / `possibleConditionLabel`: possible condition
- `items[].status`, `source`, `createdAt`

Example:

```json
{
  "items": [
    {
      "id": "sr_a1b2c3d4e5f6",
      "mobileReporterId": "mr_9f8e7d6c5b4a",
      "reporter": {
        "userId": null,
        "reporterType": "guest",
        "roleId": "guest",
        "roleLabel": "Guest Tester"
      },
      "symptomIds": ["cough", "fever"],
      "symptomLabels": ["Cough", "Fever"],
      "possibleConditionId": "covid_like_respiratory_pattern",
      "possibleConditionLabel": "Possible COVID-like respiratory symptom pattern",
      "status": "submitted",
      "source": "mobile_self_report",
      "createdAt": "2026-08-24T10:30:00"
    }
  ],
  "updatedAt": "2026-08-24T11:00:00"
}
```

### Notes for mobile developers

- Send `format=json` and a valid bearer token.
- Without `format=json`, this endpoint returns a CSV file instead of JSON.
- There are no filtering or pagination parameters in the current endpoint.
- The response contains all mobile self-reports, ordered newest first.
- Missing or invalid login tokens return `401`.
- The public IDs are generated by the backend; do not assume they are database IDs.

## Dashboard behavior to match

- Both requests start when the Disease Watch Feed page loads.
- If either request fails, the dashboard shows an error state for its sections.
- The dashboard does not send region filters to the backend. Region selection filters already-loaded data in the browser.
- Recent Alerts are built in the frontend and limited to the first **10** items.
- There is no polling, server-side pagination, or automatic refresh behavior visible in the dashboard code.
- Alert Open Rate is shown as unavailable because the dashboard has no alert-open tracking source.

## Scope note

The dashboard does not call the related `POST /api/mobile/self-reports` or `GET /api/mobile/self-reports/mine` endpoints, so they are intentionally excluded from this guide.
