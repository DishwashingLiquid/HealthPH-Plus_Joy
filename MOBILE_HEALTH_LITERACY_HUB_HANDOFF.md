# Mobile Application Handoff: Health Literacy Hub

This guide is for a developer who is new to the project. It explains how the mobile app gets Health Literacy Hub articles, images, videos, and PDF files.

It is adapted from [the backend GridFS handoff](HEALTH_LITERACY_GRIDFS_HANDOFF.md). The backend changes have been written and tested locally. That does **not** mean they are already running on the live server. Confirm the server address and readiness with the backend developer before testing.

## 1. What the mobile app needs to do

The mobile app asks the backend for published content. The backend sends back the content details and complete links to its images or other files. The app uses those links to display the files.

For example, an admin uploads a health video through the admin website. After the admin publishes it to mobile, the app can request the content list, read the video's link, and open it in the video player.

The mobile app does not upload Hub files, manage the database, or copy files from the website project. Those jobs belong to the admin website and backend.

## 2. Terms used in this guide

| Term | Plain-language meaning |
| --- | --- |
| Backend | The server program that reads content and sends it to the app. This project uses FastAPI. |
| API | The set of requests an app can send to the backend. |
| Endpoint | One API address for a particular job, such as getting the mobile content list. |
| Base URL | The beginning of the API address, shared by its endpoints. In this project it includes `/api`. |
| GET request | A request to read information or a file. It does not create or edit content. |
| Response | The answer the backend sends after a request. |
| JSON | Text containing named values, lists, and objects. The backend uses it to send content details. |
| Media | An image, video, or PDF attached to a content item. |
| MongoDB Atlas | The online database used by the backend. |
| GridFS | The MongoDB feature the backend uses to store files. The mobile app does not need to work with it directly. |
| Published | Made available to users by an admin. A draft has not been made available yet. |
| Migration | Moving older files into the new shared storage. The backend developer handles this. |
| Cache | A saved copy of previously downloaded information or a file. It can become out of date. |

## 3. Get these details before starting

Ask the backend developer for the API base URL you should use and confirmation that the server is running. Also ask for one content item published to mobile with a working attachment. A video is useful for testing playback and skipping forward.

For an older attachment, confirm that its migration is complete. An old file may not be available through the new API until the backend developer moves and verifies it.

You do not need database access. Never put `MONGO_URI`, a database password, or the backend's `SECRET_KEY` in the mobile app, its configuration files, or its source code.

## 4. Choose the correct API address

These are example addresses. Replace them with the address provided for your environment.

| Where you are testing | Example API base URL | What to check |
| --- | --- | --- |
| Physical phone on the same local network as the backend computer | `http://192.168.1.50:8000/api` | Replace the IP address with the backend computer's local network address. Both devices must be able to reach each other. |
| Android emulator running on the backend computer | `http://10.0.2.2:8000/api` | This address lets the Android emulator reach its host computer. It is not the address to use on a physical phone. |
| iOS simulator on a Mac | The backend computer's local network address | If the backend runs on that same Mac, localhost may work for the simulator's API calls. Returned media links must still use a reachable network address. |
| Released app using the live backend | `https://api.your-domain.example/api` | Use the actual HTTPS address supplied by the backend developer. |

### Why localhost fails on a phone

`localhost` means “this device.” On your computer it points to your computer. On your phone it points to your phone, not to the computer running FastAPI.

For a physical phone, use the backend computer's reachable network address. Do not replace returned media links with localhost. `0.0.0.0` is also not an address to enter in the app; it is a server setting for accepting connections.

### The two addresses that must work

The app has an API base URL for requesting content. The backend also has a setting called `PUBLIC_API_BASE_URL`, which it uses when making media links. Both must point to a server your test device can reach. They may be different addresses, but both must work from that device.

For example, an Android emulator might request content through `10.0.2.2`, while the returned image link uses `192.168.1.50`. That is fine if the emulator can reach both. If physical phones share the same backend, the backend should return links those phones can also open.

For local HTTP testing, the backend developer must enable `HEALTH_LITERACY_ALLOW_HTTP=true` and use a private network IP in `PUBLIC_API_BASE_URL`. The app's development network settings may also need to allow HTTP. Ask the mobile project maintainer how this project handles that setting. Use HTTPS for the released app.

## 5. Request the mobile content list

First check which endpoint the existing app uses. Do not change it just because another endpoint is listed here: their response formats differ.

### Mobile endpoint with an `items` list

Send a GET request to:

```text
<API base URL>/health-literacy/mobile
```

For example:

```text
http://192.168.1.50:8000/api/health-literacy/mobile
```

Add `/api` only once. The endpoint path above starts with `/health-literacy`, because the base URL already includes `/api`.

The response contains an `items` list. This is a shortened example, with made-up content and addresses; the real response includes additional fields:

```json
{
  "items": [
    {
      "id": "example-content-id",
      "contentType": "video",
      "title": "How to wash your hands",
      "description": "A short guide to handwashing.",
      "imageUrl": null,
      "mediaUrl": "https://api.your-domain.example/api/health-literacy-hub/media/507f1f77bcf86cd799439011",
      "language": "en",
      "publishToMobile": true,
      "isPublished": true
    }
  ]
}
```

Read `items`, then display each item's title and description. Use `imageUrl` for an image and `mediaUrl` for a video or other attachment. `null` means there is no value for that field; do not pass it to an image widget or video player.

For an uploaded infographic or article image, the backend supplies `imageUrl`. For an uploaded video, a separate uploaded poster supplies `imageUrl`, while the video supplies `mediaUrl`. Every uploaded attachment supplies `mediaUrl` and `media.url`; `media.contentType` identifies its type. A video without a poster can still have a null `imageUrl`. Some content uses external links instead. An article attachment is not always a video, so use `media.contentType` before choosing a player or file viewer.

An empty response such as `{"items": []}` is valid. Show a “No content available” message rather than treating it as a broken response.

### Other existing mobile endpoints

These endpoints also remain available:

```text
<API base URL>/health-literacy-hub/mobile
<API base URL>/health-literacy-hub/mobile/articles
<API base URL>/health-literacy-hub/mobile/videos
<API base URL>/health-literacy-hub/mobile/infographics
```

They return a list directly, without an outer `items` field. Uploaded-file details are inside `media`. This is another shortened example:

```json
[
  {
    "id": "example-content-id",
    "contentType": "videos",
    "title": "How to wash your hands",
    "media": {
      "fileId": "507f1f77bcf86cd799439011",
      "filename": "handwashing.mp4",
      "contentType": "video/mp4",
      "size": 1200000,
      "url": "https://api.your-domain.example/api/health-literacy-hub/media/507f1f77bcf86cd799439011"
    }
  }
]
```

For this format, read `media.url`. The outer `contentType` describes the content category. `media.contentType` describes the file format: for example, `image/png`, `video/mp4`, or `application/pdf`. `size` is measured in bytes. `media` can be `null` when there is no available uploaded attachment.

The content item's `id` and the attachment's `fileId` are different identifiers. Neither should be used to build a media link in the app. Use the complete URL returned by the backend.

These public Hub content requests do not require an admin login. This does not change the login requirements for other parts of the mobile app.

## 6. Display images and play videos

Pass the returned image link to the app's network-image component. Pass a video link to its network-video player. “Network” means the component loads the file from a URL instead of from files bundled with the app.

Show a loading indicator while the file is opening. If it fails, show a useful message and a retry action. If no attachment URL is available, keep the text content visible where appropriate and show a placeholder or hide the media area.

Do not look for uploaded files in `server/public`, add them to Flutter assets, or construct links using a filename. A replacement upload can have a new file ID and URL. Request the content list again to get the current link. Do the same after the backend domain changes.

### Skipping forward in a video

The backend supports HTTP Range requests. A Range request asks for part of a file instead of the whole file. Video players commonly use this when the user skips to a later point in a video.

A successful partial-file response uses status `206`. This is a success, not an error. Use a network-video player that supports seeking, and test it on the target device. The mobile developer usually does not need to build Range headers manually when the player handles them.

The backend accepting a video file does not guarantee that every phone can decode that video's format. If a link opens but playback fails, include the file format and player error when reporting the issue.

## 7. Understand content visibility

The mobile content list includes items published to mobile that are not archived or explicitly unpublished. If an item is missing, ask the admin to check its publishing settings.

The file-delivery endpoint allows public access when a current content record publishes that file to at least one public destination: mobile or website. “Published to website only” therefore means it is excluded from the mobile list; it does not make the file private to website users.

Drafts need an authorized admin preview. Admin responses may contain `previewUrl`, a private temporary link. The public mobile app should never depend on that link or receive an admin token to access drafts.

When an admin removes or unpublishes content, refresh the app's list and stop presenting the old item as available. Follow the backend's cache instructions when requesting files again. A file already downloaded onto a device cannot be erased merely by unpublishing it on the server.

## 8. Troubleshooting

| What you see | What it means or what to check next |
| --- | --- |
| The phone cannot open the content endpoint | Check the API address, whether the server is running, the shared network, and firewall access to port 8000. A timeout is a connection problem, not an empty content list. |
| Content text loads, but images/videos do not | Inspect the returned URL. Ask the backend developer to check `PUBLIC_API_BASE_URL` and whether that address is reachable from the device. |
| A returned media URL contains localhost | Report it to the backend developer. Do not patch the URL inside the app. |
| HTTP is blocked on the device | Check the app's local-development network policy with the mobile maintainer. The live app should use HTTPS. |
| The list is empty or a particular item is missing | Ask the admin to confirm “Publish to mobile,” archive status, and the intended test server/database. |
| The file request returns `404` | The file may be missing, replaced, deleted, or no longer publicly available. Refresh the content list, then report a still-broken current link. |
| The file request returns `410` | The app is using a retired filename-based link. Refresh content and ask the backend developer whether the old attachment was migrated. |
| Video requests return `206` | This is normal: the backend successfully returned part of the video. |
| Video requests return `416` | The requested part of the file is invalid. Refresh the content and restart the player. If it repeats, report the player version and request details. |
| The server returns `500` | The backend encountered an error. Share the request path, time, and response status with the backend developer. |

When reporting a problem, include the device/emulator, API base URL, content ID, time, and exact error message. Do not include passwords, database connection strings, admin tokens, or private preview links.

## 9. Checklist before handing the mobile work back

Use a test environment approved by the project team. Coordinate publishing and file changes with the admin/backend developer; do not change live content just to test this guide.

- [ ] The content endpoint opens from the test phone or emulator.
- [ ] The app reads the response shape used by its endpoint: `items` or a direct list.
- [ ] A published infographic displays from its returned URL.
- [ ] A published video plays, pauses, and skips forward/backward.
- [ ] Articles handle missing attachments and PDF attachments without treating them as videos.
- [ ] An empty list, slow connection, missing file, and failed request each have a usable screen state.
- [ ] After an admin replaces a test attachment, refreshing content loads the new file.
- [ ] A draft does not appear in the mobile list; previously published test content disappears after it is unpublished and the list refreshes.
- [ ] Physical-phone media links contain a reachable network address, never localhost.
- [ ] Production configuration uses the supplied HTTPS API address.
- [ ] The mobile app contains no MongoDB credentials or backend signing secrets.

## 10. Who handles the remaining work?

The mobile developer handles the API address, reading the response, displaying files, loading/error states, and device testing.

The backend developer handles Atlas/GridFS settings, returned media URLs, old-file migration, and server access problems. The admin handles uploading and publishing content through the admin website. Render deployment and database changes should be coordinated with the person responsible for the backend environment.

This document is a handoff for future mobile work. Creating it does not change Flutter code, migrate files, update Atlas, or deploy the app. Backend maintenance instructions remain in [HEALTH_LITERACY_GRIDFS_HANDOFF.md](HEALTH_LITERACY_GRIDFS_HANDOFF.md).
