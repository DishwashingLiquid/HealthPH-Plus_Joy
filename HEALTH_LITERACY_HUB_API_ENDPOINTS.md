# Health Literacy Hub API Endpoints

All paths include the `/api` prefix. Schemas below are inferred from the route handlers, models, serializers, and client form code.

## 1. GET /api/health-literacy-hub/analytics/overview

Purpose: Get the admin analytics summary.

Auth: Required (`Admin` or `SUPERADMIN`).

Request schema:

- `timeRange`: string - `last-7-days`, `last-30-days`, `last-90-days`, or `all-time`.
- `contentType`: string - `all`, `Articles`, `Videos`, or `Infographics`.
- `region`: string - a region code or `all`.

Response schema:

- `totalContentInteractions`: number - views, shares, and downloads.
- `contentPieces`: number - matching content count.
- `engagementRate`: number - percentage.
- `topPerformingContent`: array - top items with `contentId`, `title`, `contentType`, `rank`, and `trend`.

Found in: `server/routes/healthLiteracyHubRoutes.py`, `server/controllers/healthLiteracyHubController.py`.

## 2. POST /api/health-literacy-hub/analytics/events

Purpose: Record a content interaction or admin analytics action.

Auth: Not required for public events; required for `report_exported`.

Request schema:

- `eventType`: string - `content_opened`, `content_shared`, `content_downloaded`, `search`, or `report_exported`.
- `contentId`: string - content ID.
- `contentType`: string - content category.
- `clientPlatform`: string - `mobile` or `website`; required for public events.
- `visitorId`: string - visitor ID; required for public events.
- `topic`: string - required when `eventType` is `search`.

Response schema:

- `message`: string - confirmation.

Found in: `server/routes/healthLiteracyHubRoutes.py`, `server/controllers/healthLiteracyHubController.py`, `server/models/healthLiteracyHubAnalytics.py`.

## 3. POST /api/health-literacy/analytics/events

Purpose: Record an analytics event using the mobile contract path.

Auth: Not required for public events; required for `report_exported`.

Request schema:

- Same fields as endpoint 2.

Response schema:

- `message`: string - confirmation.

Found in: `server/routes/healthLiteracyHubRoutes.py`, `server/controllers/healthLiteracyHubController.py`.

## 4. GET /api/health-literacy-hub/mobile

Purpose: Get all content published for mobile.

Auth: Not required.

Request schema: Not clearly defined in repository.

Response schema:

- `[]`: array of published content.
- `id`, `contentType`, `title`, `description`: basic content details.
- `tags`, `topics`, `diseases`, `language`: content filters.
- `media`: object - uploaded media details and URL.
- `viewCount` or `downloadCount`: number - public interaction count.

Found in: `server/routes/healthLiteracyHubRoutes.py`, `server/controllers/healthLiteracyHubController.py`.

## 5. GET /api/health-literacy/mobile

Purpose: Get published mobile content using the current mobile contract.

Auth: Not required.

Request schema:

- `contentType`: string - optional filter.
- `tags`, `topics`, `diseases`: string - comma-separated or JSON-list filters.
- `language`: string - optional language filter.

Response schema:

- `items`: array - content items.
- `items[].id`, `contentType`, `title`, `description`: basic content details.
- `items[].imageUrl`, `mediaUrl`, `externalUrl`: content links.
- `items[].tags`, `topics`, `diseases`, `language`: filters.
- `items[].viewCount`, `shareCount`: number - public interaction counts.

Found in: `server/routes/healthLiteracyHubRoutes.py`, `server/controllers/healthLiteracyHubController.py`, `server/controllers/health_literacy_hub/serialization.py`.

## 6. GET /api/health-literacy-hub/mobile/{content_type}

Purpose: Get mobile content for one type.

Auth: Not required.

Request schema:

- `content_type`: string - articles, videos, or infographics.

Response schema:

- Same content item fields as endpoint 4.

Found in: `server/routes/healthLiteracyHubRoutes.py`, `server/controllers/healthLiteracyHubController.py`.

## 7. GET /api/health-literacy-hub/website

Purpose: Get all content published for the website.

Auth: Not required.

Request schema: Not clearly defined in repository.

Response schema:

- `[]`: array of published content.
- `id`, `contentType`, `title`, `description`: basic content details.
- `tags`, `topics`, `diseases`, `language`: content filters.
- `media`, `imageUrl`, `externalUrl`: media and links.

Found in: `server/routes/healthLiteracyHubRoutes.py`, `server/controllers/healthLiteracyHubController.py`.

## 8. GET /api/health-literacy-hub/website/{content_type}

Purpose: Get website content for one type.

Auth: Not required.

Request schema:

- `content_type`: string - articles, videos, or infographics.

Response schema:

- Same content item fields as endpoint 7.

Found in: `server/routes/healthLiteracyHubRoutes.py`, `server/controllers/healthLiteracyHubController.py`.

## 9. GET /api/health-literacy-hub/media/{content_type}/{filename}

Purpose: Download or display an uploaded media file.

Auth: Not required.

Request schema:

- `content_type`: string - content media folder.
- `filename`: string - stored media file name.

Response schema:

- File response - image, video, or PDF depending on the file.

Found in: `server/routes/healthLiteracyHubRoutes.py`, `server/controllers/healthLiteracyHubController.py`.

## 10. GET /api/health-literacy-hub/{content_type}

Purpose: Get all content of one type for admins.

Auth: Required (`Admin` or `SUPERADMIN`).

Request schema:

- `content_type`: string - `articles`, `videos`, or `infographics`.

Response schema:

- `[]`: array of content records.
- `id`, `title`, `description`, `language`: basic content.
- `tags`, `topics`, `diseases`: string arrays.
- `publishToMobile`, `publishToWebsite`, `isPublished`: boolean - publishing status.
- `media`: object - file name, MIME type, size, and URL.
- `createdAt`, `updatedAt`: string - timestamps.

Found in: `server/routes/healthLiteracyHubRoutes.py`, `server/controllers/healthLiteracyHubController.py`.

## 11. POST /api/health-literacy-hub/{content_type}

Purpose: Create Health Literacy Hub content.

Auth: Required (`Admin` or `SUPERADMIN`).

Request schema:

- `content_type`: string - `articles`, `videos`, or `infographics`.
- `title`, `description`: string - required content text.
- `language`: string - required language code.
- `tags`, `topics`, `diseases`: string - optional comma-separated or JSON-list values.
- `publishToMobile`, `publishToWebsite`: boolean - where to publish.
- `file`: file - optional media; allowed type depends on content type.
- `isFactCheck`, `claim`, `claimStatus`, `verifiedBy`: fact-check fields; `claim` is required when fact-check is enabled.

Response schema:

- `message`: string - confirmation.
- `content`: object - created content record with generated `id` and timestamps.

Found in: `server/routes/healthLiteracyHubRoutes.py`, `server/controllers/healthLiteracyHubController.py`.

## 12. PUT /api/health-literacy-hub/{content_type}/{content_id}

Purpose: Update Health Literacy Hub content.

Auth: Required (`Admin` or `SUPERADMIN`).

Request schema:

- `content_type`: string - `articles`, `videos`, or `infographics`.
- `content_id`: string - content ID.
- Same main form fields as endpoint 11.
- `removeMedia`: boolean - remove current media if no new file is sent.

Response schema:

- `message`: string - confirmation.
- `content`: object - updated content record.

Found in: `server/routes/healthLiteracyHubRoutes.py`, `server/controllers/healthLiteracyHubController.py`.

## 13. DELETE /api/health-literacy-hub/{content_type}/{content_id}

Purpose: Delete content and its uploaded media.

Auth: Required (`Admin` or `SUPERADMIN`).

Request schema:

- `content_type`: string - `articles`, `videos`, or `infographics`.
- `content_id`: string - content ID.

Response schema:

- `message`: string - confirmation.
- `content`: object - deleted content record.

Found in: `server/routes/healthLiteracyHubRoutes.py`, `server/controllers/healthLiteracyHubController.py`.

## Summary

- Total Health Literacy Hub endpoints found: 13.
- Unclear or incomplete schemas: No explicit OpenAPI response models; content fields are inferred from controller and serializer code. Media response MIME type depends on the requested file.
- Related endpoints excluded: Non-Health Literacy Hub modules such as auth, users, organizations, Sentiment Pulse, and Disease Watch Feed.
