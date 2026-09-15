# Health Literacy Hub content cards — Flutter rebuilding reference

This is a map of the code that exists **right now**. Think of a card as a tiny box that tells one small story: an article, a video, or a picture-like infographic. This guide describes two real card surfaces in the repository:

1. The public web **Articles** page. It puts articles, videos, and infographics into one shared `ArticleItem` card.
2. The admin **Health Literacy Hub**. It has three different management-card layouts: one for Articles, one for Videos, and one for Infographics.

They do not look or behave the same. A Flutter rebuild must choose the surface it is recreating; do not mix rules from the two.

### Dashboard content-card boundary (verified)

For the **Health Literacy Hub dashboard**, the only reachable content-card variants are:

1. `ArticleContentCard`
2. `VideoContentCard`
3. `InfographicContentCard`

The path is fixed: `HealthLiteracyHub` exposes only the Articles, Videos, and Infographics content tabs; each tiny tab component passes exactly one of those three labels to `ContentTab`; `ContentTab` renders `ContentGrid`; and `ContentGrid` maps each record through `ContentCard`. `ContentCard` dispatches those three labels only to the three components above ([tab definitions](client/src/pages/admin/healthLiteracyHub/HealthLiteracyHub.jsx#L8-L20), [tab adapters](client/src/pages/admin/healthLiteracyHub/ArticlesTab.jsx#L1-L5), [VideosTab](client/src/pages/admin/healthLiteracyHub/VideosTab.jsx#L1-L5), [InfographicsTab](client/src/pages/admin/healthLiteracyHub/InfographicsTab.jsx#L1-L5), and [dispatch](client/src/pages/admin/healthLiteracyHub/content/ContentCards.jsx#L74-L130)).

`ContentCards.jsx` does contain a generic fallback JSX branch after those three checks. It is **not a fourth dashboard content-card type**: no dashboard tab supplies any other `contentType`, and the server configuration recognizes only articles, videos, and infographics. This reference does not treat that unreachable fallback as an implemented dashboard card. The dashboard also has three top-of-page **illustration tiles** (Educational Content, Multilingual Resources, Community Q&A) and an Analytics tab; they are dashboard UI, not content-item cards, so they are outside this card reference ([illustration rendering](client/src/pages/admin/healthLiteracyHub/HealthLiteracyHub.jsx#L31-L58)).

## 1. Repository source map

| Source | What this little piece does |
|---|---|
| [client/src/pages/Articles.jsx](client/src/pages/Articles.jsx#L15-L228) | Public page. Fetches website-published Hub content, adds static articles, sorts it, shows nine cards per page, and opens the video/infographic modal. |
| [client/src/components/about-us/ArticleItem.jsx](client/src/components/about-us/ArticleItem.jsx#L8-L105) | The one public card component. It decides the image/video/placeholder and which CTA to show. |
| [client/src/utils/healthLiteracyWebsiteContent.js](client/src/utils/healthLiteracyWebsiteContent.js#L1-L124) | Converts API and static records to the public-card shape; resolves media URLs; creates type labels and slugs; formats dates; sorts newest first. |
| [client/src/features/api/healthLiteracyHubSlice.js](client/src/features/api/healthLiteracyHubSlice.js#L3-L82) | Defines the web calls. The public page calls `GET /health-literacy-hub/website`; the admin tabs call the type-specific private endpoint. |
| [client/src/assets/data/articles.json](client/src/assets/data/articles.json) | Static public article records. These are combined with website-published Hub records. |
| [client/src/assets/css/about.css](client/src/assets/css/about.css#L384-L582) | Exact public card grid, card, image, chip, text-clamp, skeleton, and responsive CSS. The public preview modal is at [lines 670–742](client/src/assets/css/about.css#L670-L742). |
| [client/src/pages/admin/healthLiteracyHub/HealthLiteracyHub.jsx](client/src/pages/admin/healthLiteracyHub/HealthLiteracyHub.jsx#L8-L82) | Admin tab chooser. Its initial tab is **Articles**. |
| [client/src/pages/admin/healthLiteracyHub/content/ContentTab.jsx](client/src/pages/admin/healthLiteracyHub/content/ContentTab.jsx#L24-L155) | Shared admin-tab controller: fetches one type, owns the search text, and wires preview, edit, share, and download actions. Rendering is at [lines 388–420](client/src/pages/admin/healthLiteracyHub/content/ContentTab.jsx#L388-L420). |
| [client/src/pages/admin/healthLiteracyHub/content/ContentCards.jsx](client/src/pages/admin/healthLiteracyHub/content/ContentCards.jsx#L13-L71) | Admin empty/loading states and layouts. The type switch is at [lines 74–130](client/src/pages/admin/healthLiteracyHub/content/ContentCards.jsx#L74-L130); the three real cards are at [lines 267–548](client/src/pages/admin/healthLiteracyHub/content/ContentCards.jsx#L267-L548). |
| [client/src/pages/admin/healthLiteracyHub/content/contentTabFiltering.js](client/src/pages/admin/healthLiteracyHub/content/contentTabFiltering.js#L5-L45) | The admin's only card-list filter: free-text search. |
| [client/src/pages/admin/healthLiteracyHub/content/ContentMediaPreviewBody.jsx](client/src/pages/admin/healthLiteracyHub/content/ContentMediaPreviewBody.jsx#L18-L180) | The admin modal contents used after tapping a video or infographic card. |
| [client/src/pages/admin/healthLiteracyHub/shared.js](client/src/pages/admin/healthLiteracyHub/shared.js#L31-L152) | Normalizes arrays, resolves uploaded media, chooses count fields, formats dates/numbers/durations, and validates media type. |
| [client/src/pages/admin/healthLiteracyHub/shared/sharedConfig.js](client/src/pages/admin/healthLiteracyHub/shared/sharedConfig.js#L3-L65) | Content-type names, upload rules, initial form fields, and the five available language values. |
| [server/public/health-literacy-hub/articles.json](server/public/health-literacy-hub/articles.json), [videos.json](server/public/health-literacy-hub/videos.json), [infographics.json](server/public/health-literacy-hub/infographics.json) | Seed data for the three Hub types. Current Hub `tags`, `topics`, and `diseases` arrays are empty in every seed item. |
| [server/routes/healthLiteracyHubRoutes.py](server/routes/healthLiteracyHubRoutes.py#L33-L110) | Public URL routing, including `/website`, `/mobile`, `/mobile/{content_type}`, media files, and the mobile contract endpoint. |
| [server/controllers/health_literacy_hub/content_bridge.py](server/controllers/health_literacy_hub/content_bridge.py#L402-L466) | Only serves content marked for Mobile/Website publication and not archived. It orders records by pinned flag, pinned date, then newest `createdAt`. |
| [server/controllers/health_literacy_hub/serialization.py](server/controllers/health_literacy_hub/serialization.py#L92-L177) | Implements the mobile-contract filters for type, tags, topics, diseases, and language. |
| [client/src/assets/css/typography.css](client/src/assets/css/typography.css#L5-L48), [client/src/assets/css/buttons.css](client/src/assets/css/buttons.css#L5-L95), [client/tailwind.config.js](client/tailwind.config.js#L3-L92) | Defines font scales, button states, color tokens, screen breakpoints, and shadows used by the cards. |

## 2. The common Hub data picture

The stored Hub record has these supported fields. A field may be `null`, empty, or absent. The admin form requires only `title`, `description`, and `language`; a media file is optional.

| Field | Tiny explanation | Used on a current card? |
|---|---|---|
| `id` | The card's name tag for machines. | Yes, React keys and analytics. |
| `title` | Big heading words. | Public and all admin cards. |
| `description` | The small explanation words. | Public and all admin cards; admin Article cuts it to first 75 JavaScript characters. |
| `contentType` | The kind: `articles`, `videos`, or `infographics` in public/API routes; the admin rendering layer assigns `Articles`, `Videos`, or `Infographics`. | Yes; it chooses the card. |
| `tags` | Optional little topic words. | Admin Article and Video only. Public cards do not show them. |
| `topics`, `diseases` | Optional lists used by search/mobile contract filters. | Not displayed on the current cards. |
| `language` | A language code: `en`, `fil`, `ceb`, `ilo`, or `hil`. | Searchable/admin-editable; not displayed on a current card. |
| `media` | Uploaded file information: `filename`, `contentType`, `size`, `storedFilename`, `url` (or legacy `dataUrl`). | Used for image/video preview. |
| `imageUrl`, `mediaUrl` | Optional external URL fallbacks. | Public card media resolver only. Admin cards use `media` only. |
| `duration` | Text duration such as `1:42`. | Admin Video only. |
| `source`, `author` | Optional attribution text. | Searchable only; neither card surface displays them. |
| `publishedDate`, `createdAt` | Dates. | Public uses `publishedDate`, then `createdAt`; admin formats `createdAt` as its date. |
| `externalUrl`, `publicUrl`, `shareUrl` | Optional URL. | Admin Article's Share chooses the first available in that order, then media URL. |
| `publishToMobile`, `publishToWebsite` | Two yes/no publication switches. | Public sources require Website=true; mobile sources require Mobile=true. Admin previews show the chosen target(s). |
| `isArchived`, `isPinned`, `pinnedAt` | Publication/order flags. | The server excludes archived public/mobile items and sorts pinned records first. No card badge is drawn for either flag. |
| `viewCount`, `downloadCount` | Counts supplied/derived by the API. | Admin Articles/Videos show Views; Infographics show Downloads. |
| `isFactCheck`, `claim`, `claimStatus`, `verifiedBy`, `verdict`, `explanation` | Stored fact-check metadata. | Not shown in any of these three current card layouts. |

### Shared things versus special things

All three Hub types share `id`, `title`, `description`, `tags`, `topics`, `diseases`, `language`, `source`, `author`, dates, publication flags, and optional `media` metadata in their stored shape. The visible card is much smaller than the record.

* **Article-only card behavior:** public navigation to a detail route; admin Share/Edit and Views; no image in the dedicated admin Article layout.
* **Video-only card behavior:** video media, `duration`, Views, and video preview; admin video cards render green tags.
* **Infographic-only card behavior:** image media, Downloads, and a download button; it deliberately does not render tags in the dedicated admin card.

## 3. Public website cards (one shared shell)

The public page calls every card “an article item,” even when the record is a Video or Infographic. The type label tells the child what it is.

### Public Article card

**It uses:** `articleTitle`, `articleSlug`, `datePublished`, `articlePreview`, `articleImageCaption`, `articleImage`, and normalized `resourceType = "article"`. For API records, these come from `title`, generated slug, `publishedDate ?? createdAt`, `description`, title, and `imageUrl` respectively ([normalizer](client/src/utils/healthLiteracyWebsiteContent.js#L89-L118)). Static article records use their own `article*` fields.

**What the child sees:** image, `Article` chip, formatted date (`Month DD, YYYY`), two-line title, three-line preview, then **Read More** with a 24px ArrowUpRight icon.

**Tap/click:** it goes to `/articles/{articleSlug}` and passes the current page number in navigation state. It is not a modal ([component](client/src/components/about-us/ArticleItem.jsx#L58-L78)).

**Media rule:** the public resolver picks uploaded `media` first for API content, otherwise `imageUrl`; static content uses `/assets/articles/preview/{articleImage}`. No image gives a pale `#F8FAFC` box with a 48px Document icon ([resolver](client/src/utils/healthLiteracyWebsiteContent.js#L30-L68), [render](client/src/components/about-us/ArticleItem.jsx#L22-L42)).

### Public Video card

**It uses:** the same normalized title, description, date, type label, and media fields as the public Article card. `resourceType` becomes `video`, and `contentTypeLabel` becomes `Video`. The current public card does **not** show `duration`, author, source, tags, views, or a play badge.

**What the child sees:** a muted, inline `<video>` thumbnail if a media source exists. It uses `object-fit: cover`; controls are absent in the card. If no source is available, it gets the same Document placeholder. Under it are the `Video` chip, date, title, description, and **Watch Video** CTA.

**Tap/click:** the CTA opens the page modal. The modal autoplays the video with controls. Tapping the backdrop or close icon closes it ([page modal](client/src/pages/Articles.jsx#L162-L228)).

### Public Infographic card

**It uses:** the same normalized title, description, date, and label. `resourceType` becomes `infographic`; `contentTypeLabel` becomes `Infographic`. For API records, the public resolver chooses uploaded `media` first, then `imageUrl`, then `mediaUrl` ([resolver](client/src/utils/healthLiteracyWebsiteContent.js#L49-L65)).

**What the child sees:** image (`object-fit: cover`), `Infographic` chip, date, title, description, and **View Infographic** CTA. It shows no tags, author/source, duration, badge, or count on the public card.

**Tap/click:** CTA opens the same modal. A source is displayed with `object-fit: contain`. If a source exists, the modal adds a **Download** link with a 20px Download icon and uses `media.filename`, else the title/`infographic`, as the filename. If there is no source, the modal says `Preview is unavailable.` ([page modal](client/src/pages/Articles.jsx#L162-L228)).

## 4. Admin Hub management cards

These are a different, private UI. A user first selects the **Articles**, **Videos**, or **Infographics** tab. The selected data is fetched from `GET /health-literacy-hub/{articles|videos|infographics}`. These are the three—and only three—reachable dashboard content-card layouts; the nearby generic fallback branch is unreachable from the defined tabs and is intentionally excluded.

### Admin Article card

This is a horizontal/list card with no media thumbnail. It shows:

* Full `title`, 18px/26px semibold.
* `description` sliced with JavaScript `slice(0, 75)`; there is no added ellipsis.
* Every tag as a green badge when at least one exists.
* `Views: {formatted count}`. The count resolver checks `viewCount`, then `views`, `viewsCount`, `analytics.viewCount`, `metrics.viewCount`, then zero ([shared utility](client/src/pages/admin/healthLiteracyHub/shared.js#L65-L76)).
* **Share** and, for API content, **Edit**. Share uses Web Share if available, otherwise copies a URL to the clipboard; an absent URL produces a toast error ([handlers](client/src/pages/admin/healthLiteracyHub/content/ContentTab.jsx#L139-L187)).

There is no whole-card navigation, image, date, author, source, language, duration, or content-type badge in this specialized card ([card](client/src/pages/admin/healthLiteracyHub/content/ContentCards.jsx#L489-L548)).

### Admin Video card

This is a fixed-height 440px card. It shows:

* A 240px-high muted inline video thumbnail (`object-fit: cover`) only when `media.contentType` begins with `video/`. Otherwise it uses a blue-to-mint gradient and a translucent 64px Image icon.
* Two-line `title`.
* `Duration: {duration}`; if `duration` is empty, it first tries to read video metadata, formats seconds as `m:ss` or `h:mm:ss`, then otherwise displays `Duration: --`.
* `Views: {formatted count}`.
* Every tag as a green badge, but only if tags exist.
* **Edit** only for API-origin content.

If media exists, tapping the card or pressing Enter/Space opens the admin preview modal; otherwise the card is non-clickable, has default cursor and `opacity-80`. The preview has video controls. It does not show description, source, author, language, date, or an explicit play overlay on the card ([card](client/src/pages/admin/healthLiteracyHub/content/ContentCards.jsx#L363-L487), [preview](client/src/pages/admin/healthLiteracyHub/content/ContentMediaPreviewBody.jsx#L105-L180)).

### Admin Infographic card

This is a fixed-height 360px card. Its `2fr 1fr` grid gives two relative rows: a larger media area and a smaller information area. It shows:

* Image `media` only when its MIME type begins with `image/`. The image is contained, not cropped. Missing/unusable image gets a translucent white 64px Image icon on `#F8FAFC`.
* Two-line `title`.
* `Downloads: {formatted count}`. The resolver checks `downloadCount`, `downloads`, `downloadsCount`, `analytics.downloadCount`, `metrics.downloadCount`, then zero ([shared utility](client/src/pages/admin/healthLiteracyHub/shared.js#L78-L89)).
* **Download**, disabled if no media source, and **Edit** for API-origin content.

The whole card opens its preview on tap/click or Enter/Space, even if preview media is missing. Download/Edit stop the tap from also opening the preview. The modal shows the image, description, created date, and publication status ([card](client/src/pages/admin/healthLiteracyHub/content/ContentCards.jsx#L267-L361), [preview](client/src/pages/admin/healthLiteracyHub/content/ContentMediaPreviewBody.jsx#L24-L102)). Tags are intentionally not drawn on this dedicated card.

## 5. Tags, categories, labels, and badges

### Values actually present today

There are **no content tag values**, **no topic values**, and **no disease values** in the current three Hub JSON seed files. Each current array is `[]`. So there is no real tag/category word to list or explain beyond the content-type labels below. Do not invent “Dengue,” “Nutrition,” or similar tags from the form helper examples; those are illustrative form text, not card data.

| Existing label/value | What it means in tiny words | Where it comes from / appears |
|---|---|---|
| `Article` / `articles` | A thing to read. | Public normalizer changes `articles` into the `Article` chip. Admin tab says `Articles`. |
| `Video` / `videos` | A thing to watch. | Public chip / admin Video tab and card. |
| `Infographic` / `infographics` | A picture that teaches. | Public chip / admin Infographic tab and card. |
| `en` / English | English words. | Current Hub seed records use `en`; the field is searchable/filterable but not rendered on cards. |

The configured language choices are `en` English, `fil` Filipino, `ceb` Cebuano, `ilo` Ilocano, and `hil` Hiligaynon ([configuration](client/src/pages/admin/healthLiteracyHub/shared/sharedConfig.js#L51-L65)). These are supported language values, not visible tags and not all current data values.

### The words are not the same thing

* **Content type** is the big bucket: Articles, Videos, or Infographics. It decides card layout and is selected by the admin tab. Public cards turn it into a blue type chip.
* **Tag** is an optional free-text list stored in `tags`. Admin Article/Video cards show it as a green badge. The current cards have no stored tags to show.
* **Topic** and **disease** are separate optional lists. Current cards do not display them; filtering code can search/filter them.
* **Label** means display text like `Article`, `Video`, or `Infographic` created by the public normalizer.
* **Badge/chip** means the little colored visual box: public type chip is blue; admin tags are green. There is no “featured,” “pinned,” fact-check, category, author, or source badge on the current cards.

Tag input is normalized by splitting a comma string (or accepting an array), trimming whitespace, dropping blanks, and removing duplicates without regard to letter case; the first spelling is preserved ([normalization](client/src/pages/admin/healthLiteracyHub/shared.js#L31-L58)).

## 6. Existing filters, ordering, paging, and empty states

### A. Public website card list

There is **no user-facing search bar, tag filter, topic filter, disease filter, language filter, category filter, or content-type filter** on the public `Articles` page.

The page does this instead:

1. Requests all Website-published, non-archived Hub records from `GET /health-literacy-hub/website`.
2. Adds static records from `client/src/assets/data/articles.json`, but drops any static record whose `articleTitle` is exactly `""`.
3. Sorts the combined list descending by `sortDate`, which is `publishedDate ?? createdAt` for API content and `datePublished` for static content. An invalid/missing date sorts as 1970-01-01 ([utility](client/src/utils/healthLiteracyWebsiteContent.js#L24-L28) and [page](client/src/pages/Articles.jsx#L31-L40)).
4. Starts on page 1 and shows exactly nine items per page. Previous/next buttons appear only when the total exceeds nine. They disable at first/last page. This is pagination, not Load more ([page](client/src/pages/Articles.jsx#L29-L65) and [lines 112–159](client/src/pages/Articles.jsx#L112-L159)).

The server itself orders fetched Website records pinned first, then newest `pinnedAt`, then newest `createdAt`; the public page subsequently re-sorts the combined result by date, so the page's final visual order is newest-first by the public sort date. There is no featured-card layout. `isPinned` has no visual card treatment.

**Loading/error/empty:** while the initial public fetch is both loading and fetching with no data, it draws nine animated skeleton cards. On API error it displays `Dashboard resources could not be loaded. Showing saved articles.` and still shows static items. There is no dedicated “no public cards” empty message; an empty list simply has no cards ([page](client/src/pages/Articles.jsx#L24-L31) and [lines 91–111](client/src/pages/Articles.jsx#L91-L111)).

### B. Admin cards: tab selection and search

* The first selected tab is **Articles**. The visible tabs are Articles, Videos, Infographics, and Analytics. Choosing a content tab fetches that one content type; it is a tab/data-source choice, not a combined filter ([tabs](client/src/pages/admin/healthLiteracyHub/HealthLiteracyHub.jsx#L8-L16)).
* Each content tab has one control: `Search articles...`, `Search videos...`, or `Search infographics...`. Its initial text is the empty string.
* Non-empty search text is lowercased, split on literal spaces, and empty pieces are discarded. A card matches when **at least one** word appears anywhere in the lowercased joined fields: title, description, source, author, language, tags, topics, or diseases. It is not an “all words must match” search.
* There is no admin category/tag/topic/disease/language dropdown, sort selector, pagination, Load more, or featured filter in these content tabs.
* A search text of only spaces reaches an empty `searchTerms` list and therefore matches no cards. This odd outcome is exactly what the current `some(...)` code does.
* Searching two or more trimmed characters causes an analytics `search` event after 800ms. It does not change matching rules ([effect](client/src/pages/admin/healthLiteracyHub/content/ContentTab.jsx#L42-L62)).
* A zero-result admin list shows a Search icon and: `No {type} found` / `Try adjusting your search terms or create new content`. Fetching shows `Loading {type}...` ([empty/loading](client/src/pages/admin/healthLiteracyHub/content/ContentCards.jsx#L13-L43)).

### C. Mobile contract server filters

For Flutter, the repository also exposes `GET /health-literacy/mobile`. It accepts optional query values `contentType`, `tags`, `topics`, `diseases`, and `language` ([route](server/routes/healthLiteracyHubRoutes.py#L43-L48), [endpoint](server/controllers/healthLiteracyHubController.py#L80-L111)). This endpoint is not used by the React public-card page, but it is real mobile behavior suitable to reproduce in a Flutter client.

Only `publishToMobile == true` and non-archived records enter this list. The server applies all supplied filter groups together:

| Query | Matching rule |
|---|---|
| `contentType` | Must normalize to and equal the requested type. Accepted aliases include singular/plural type names and labels. Invalid values return HTTP 400. |
| `language` | English names/codes normalize to the five codes. The record language must equal it. Unknown/empty language has no language restriction. |
| `tags` | Comma/JSON-list values. The card must contain **every** requested tag, case-insensitively. |
| `topics` | Same: the card must contain every requested topic, case-insensitively. |
| `diseases` | Same: the card must contain every requested disease, case-insensitively. |

These groups are ANDed. Example: `contentType=videos&tags=vaccine,prevention&language=en` needs an English video with both `vaccine` and `prevention`; one matching tag is not enough. The current seed items have empty tag/topic/disease lists, so any non-empty one of those query filters returns no current seed item. The matching code is [here](server/controllers/health_literacy_hub/serialization.py#L92-L177).

### Simple filter examples

These are small rule demonstrations, not extra repository data:

| Situation | Result under the existing rule |
|---|---|
| Admin search `flu cough`; one item has `title: "Flu guide"`, another has `description: "Cough care"`, and another has neither | The first two show. Search uses **any** word. |
| Admin search `flu cough`; an item has only `title: "Flu guide"` | It shows; it need not contain `cough`. |
| Mobile query `tags=flu,cough`; item tags are `["flu", "cough", "child"]` | It shows. Every requested tag exists. |
| Mobile query `tags=flu,cough`; item tags are `["flu"]` | It does not show. `cough` is missing. |
| Public page has 10 valid combined items | Page 1 shows 9; Next moves to page 2 and shows item 10. |

## 7. Flutter-ready model reference

These Dart snippets are **reference translations, not repository changes**. They use only fields the current implementation stores/returns. `ContentType` expresses the same three kinds as the API.

```dart
enum ContentType { articles, videos, infographics }

class HubMedia {
  const HubMedia({
    this.filename,
    this.contentType,
    this.size,
    this.storedFilename,
    this.url,
  });

  final String? filename;       // The friendly uploaded file name.
  final String? contentType;    // MIME type, e.g. video/mp4 or image/jpeg.
  final int? size;              // File size in bytes.
  final String? storedFilename; // Server's stored file name.
  final String? url;            // API media URL.
}

class HubContent {
  const HubContent({
    required this.id,
    required this.type,
    required this.title,
    required this.description,
    required this.language,
    this.tags = const [],
    this.topics = const [],
    this.diseases = const [],
    this.media,
    this.duration = '',
    this.source,
    this.author,
    this.publishedDate,
    this.createdAt,
    this.externalUrl,
    this.imageUrl,
    this.mediaUrl,
    this.publishToMobile = false,
    this.publishToWebsite = false,
    this.isArchived = false,
    this.isPinned = false,
    this.viewCount = 0,
    this.downloadCount = 0,
  });

  final String id;                  // Machine ID.
  final ContentType type;           // articles, videos, or infographics.
  final String title;               // Card heading.
  final String description;         // Card explanation.
  final List<String> tags;          // Optional green admin badges.
  final List<String> topics;        // Search/mobile filter words; not card text.
  final List<String> diseases;      // Search/mobile filter words; not card text.
  final String language;            // en, fil, ceb, ilo, or hil.
  final HubMedia? media;            // Uploaded file, if any.
  final String duration;            // Video text such as 1:42; empty otherwise.
  final String? source;             // Searchable attribution; not shown on current cards.
  final String? author;             // Searchable attribution; not shown on current cards.
  final String? publishedDate;      // Public-card preferred date.
  final String? createdAt;          // Fallback public date / admin Date value.
  final String? externalUrl;        // First admin Article share URL choice.
  final String? imageUrl;           // Public fallback image URL.
  final String? mediaUrl;           // Public video/infographic fallback URL.
  final bool publishToMobile;       // Makes it eligible for mobile API output.
  final bool publishToWebsite;      // Makes it eligible for public website output.
  final bool isArchived;            // Excluded from public/mobile output when true.
  final bool isPinned;              // Server ordering flag; no visible badge.
  final int viewCount;              // Admin Article/Video count.
  final int downloadCount;          // Admin Infographic count.
}
```

### Current-data examples

These are **Flutter reference examples, not changes**. They are grounded in the current repository data. The current Hub Video and Infographic have placeholder title/description `test`; that is the real seed value, so it is shown rather than invented.

```dart
// Static public Article from client/src/assets/data/articles.json.
final articleExample = {
  'articleID': 1,
  'articleTitle': 'HealthPH Partnership Meeting with DOH',
  'articleSlug': 'healthph-partnership-meeting-with-doh',
  'datePublished': '10/09/2023',
  'articlePreview':
      'The HealthPH Partnership Meeting with DOH discussed collaborative efforts '
      'to enhance public health through coordinated research and resource sharing.',
  'articleImage': 'healthph-partnership-meeting-with-doh.jpg',
};

// Current server/public/health-literacy-hub/videos.json record (selected fields).
final videoExample = HubContent(
  id: 'd3bedbdd-81b5-404c-9ba5-4a952d0df2d5',
  type: ContentType.videos,
  title: 'test',
  description: 'test',
  language: 'en',
  duration: '1:42',
  media: HubMedia(
    filename: 'Mobile Wireframe Figma.mp4',
    contentType: 'video/mp4',
    size: 62776622,
    storedFilename: '8bd00c5c-6e78-4d3b-8e11-1be27d5db412-Mobile-Wireframe-Figma.mp4',
    url: '/api/health-literacy-hub/media/videos/8bd00c5c-6e78-4d3b-8e11-1be27d5db412-Mobile-Wireframe-Figma.mp4',
  ),
  publishToMobile: true,
  publishToWebsite: true,
);

// Current server/public/health-literacy-hub/infographics.json record (selected fields).
final infographicExample = HubContent(
  id: 'abf0e920-5b0b-4561-bb6b-a3e350cc7622',
  type: ContentType.infographics,
  title: 'test',
  description: 'test',
  language: 'en',
  media: HubMedia(
    filename: 'Screenshot_29-7-2026_153822_claude.ai.jpeg',
    contentType: 'image/jpeg',
    size: 165882,
    storedFilename: 'a40c1a44-8d16-4b78-8dfa-d93c70748119-Screenshot_29-7-2026_153822_claude.ai.jpeg',
    url: '/api/health-literacy-hub/media/infographics/a40c1a44-8d16-4b78-8dfa-d93c70748119-Screenshot_29-7-2026_153822_claude.ai.jpeg',
  ),
  publishToMobile: true,
  publishToWebsite: true,
);
```

## 8. Visual specification for Flutter

**Exact CSS first:** all `px`, colors, shadows, and breakpoint numbers below are extracted values. **Flutter reading:** `px` can normally be used as logical pixels (`double`) in Flutter, but that is a unit translation, not an extracted Flutter value. CSS `1fr` is relative space, not a fixed Flutter pixel value.

### Public shared card

| Part | Exact web value | Flutter-friendly reading |
|---|---|---|
| Page/card grid | Parent max width `1144px`; 3 equal columns; `row-gap: 56px`, `column-gap: 32px`. At `<=1024px`: 2 columns; at `<=768px`: 1. | Constrain grid to 1144 logical px; use `GridView`/responsive columns 3, 2, 1 and the same gaps. Card width is not fixed: it fills its grid track. |
| Card | `width: 100%`, white, `border-radius: 8px`, `overflow: hidden`; shadow `0 1px 1px rgba(0,0,0,.1), 0 0 0 1px rgba(70,83,96,.16)`. No fixed/min/max height. | `Card`/`Container` with clip, 8 radius, white and two-part shadow/border approximation. |
| Image/video | `height: 240px`, width 100%, white; `object-fit: cover`, center. | Fixed 240 logical px `SizedBox`; `Image`/video cover crop. No declared aspect ratio because width changes. |
| Missing media | `#F8FAFC`, centered Document icon `48px`. | Center a 48 logical px document icon. |
| Body | `padding: 18px`. | `Padding(all: 18)`. |
| Meta row | minimum height `28px`, wraps, `gap: 8px`, bottom margin `8px`. | `Wrap(spacing: 8, runSpacing: 8)` inside 28-min-height area. |
| Type chip | `min-height: 24px`, radius `6px`, background `#E9F4FB` (`primary-50`), horizontal padding `8px`, text 12px semibold `#004EA2` (`primary-700`). | Blue `Container` chip. No vertical padding is declared; center the text in min 24 height. |
| Date | 14px/20px medium, letter spacing `0.7px`, `#687582` (`gray-500`). | `TextStyle(fontSize: 14, height: 20/14, fontWeight: w500, letterSpacing: .7)`. |
| Title | exactly `height: 56px`; 24px/28px semibold, letter spacing `-0.36px`, `#171E26`; two-line clamp; bottom margin `12px`. | Constrain 2 lines, overflow ellipsis; fixed 56 logical px. |
| Description | exactly `height: 78px`; 18px/26px, `#465360`; three-line clamp; bottom margin `18px`. | Constrain 3 lines, overflow ellipsis; fixed 78 logical px. |
| CTA | width 100%, centered. Base button: horizontal padding `12px`, vertical `6px`, radius `6px`; 18px/28px medium, `0.36px` letter spacing; white, text `#465360`, shadow `0 0 0 1px rgba(70,83,96,.16), 0 1px 1px rgba(0,0,0,.1)`. | Full-width outlined/elevated button. The card gives it no explicit height; the content/padding decides it. |
| CTA icon | ArrowUpRight 24px by 24px; `#8693A0` stroke. | 24 logical px icon. |
| CTA hover | Text `#171E26`; shadow border alpha grows to `.32`. | Web-only pointer state; a Flutter pressed/hover state can mirror these colors. |
| CTA active/focus | Shadow `0 0 0 4px rgba(0,122,255,.4), 0 0 0 1px rgba(70,83,96,.32), 0 1px 1px rgba(0,0,0,.1)`. | Use a 4 logical px translucent `#007AFF` focus ring plus outline/shadow. |
| CTA disabled | Text `#8693A0`, background `#D5DDE5`, shadow border alpha `.2`. | Used by public pagination buttons, not by the content-card CTA. |
| Skeleton | Gradient `#E5E7EB → #F3F4F6 → #E5E7EB`; 1.6s infinite shimmer; image 240px. Chip 92×24, date 108×16, lines 16px tall, CTA 48px tall. Reduced motion duration 2.8s. | Only during initial public fetch; optional exact visual parity. |

### Admin specialized cards

| Part | Exact web value | Flutter-friendly reading |
|---|---|---|
| Admin Video grid | 1 column, then 2 at `md` (`768px`), 3 at `lg` (`1024px`); gap 20px. | Responsive `GridView`. No fixed card width. |
| Admin Article list | Full width vertical list; gap 16px. | `ListView.separated` with 16 gap. |
| Article card | White, 8px radius, `1px #E5E5E5` border, 18px padding; hover `shadow-sm` = `0 1px 3px rgba(0,0,0,.08)`. No fixed height. | Rounded `Container`; Flutter does not have hover on touch by default. |
| Article title/description | Title 18px/26px semibold `#333E4A`; description top margin 6, 14px/20px `#687582`; first 75 characters only. | `Text` plus `substring` equivalent, without an ellipsis. |
| Article tag | Min height 28, radius 6, `#16A34A`, horizontal padding 10, 12px semibold white; tag gap 8, top 12. | Green `Wrap` chips. |
| Article footer | Top margin 14; top border `1px #E5E5E5`; top padding 12; column with gap 10, switches to row at `>=576px`. View text 13px semibold `#465360`. | Responsive Row/Column. |
| Video card | Width 100%, height 440, rows `240px 1fr`, white, 12px radius, `1px #E5E5E5` border, clipped. `hover: shadow-lg` = `0 10px 15px -3px rgba(0,0,0,.10), 0 4px 6px -2px rgba(0,0,0,.05)`. | Fixed 440 logical px `Card`, top child 240. |
| Video image area | Gradient `#6A8EB5` to `#78C6B2` toward bottom-right; video cover crop. Fallback Image icon 64px white at 0.5 opacity. | Decorated container plus video thumbnail. |
| Video body/title | Padding 14; title 16px/22px semibold `#333E4A`, 2-line clamp; metadata top 8, 12px semibold `#5A6876`, gap 12. | `Padding(14)`, maxLines 2. |
| Video tag | Top 10; min height 24; radius 6; green `#16A34A`; horizontal pad 8; 11px semibold white; gap 6. | `Wrap` of green chips. |
| Infographic card | Width 100%, height 360, `grid-template-rows: 2fr 1fr`; white, 12px radius, `1px #E5E5E5` border. | Fixed 360 logical px with `Expanded(flex:2)` and `Expanded(flex:1)`; actual final row pixels depend on available inner height. |
| Infographic image area | `#F8FAFC`, 8px padding, image contain; fallback 64px white Image icon at 0.5 opacity. | `Padding(8)` and `BoxFit.contain`. |
| Infographic body | 14px padding; title 16px/22px semibold `#333E4A`, 2-line clamp; action row top 10, min height 32, gap 10. | `Padding(14)`, `maxLines: 2`. |
| Admin action buttons | White, `1px #D0D5DD` border, 6px radius; text 12px semibold `#465360`; gap 6. Download/Edit min heights vary: 30, 32, or 34px by layout; horizontal padding 9/10/12px. Icons 14px `#344054`. | Small outlined buttons. |
| Admin focus state | `outline: none`, 2px `#6A8EB5` ring plus `focus:ring-offset-2`. | Use a 2 logical px focus border/ring and 2 logical px outer offset on keyboard/web Flutter where appropriate. |
| Video no-media state | Default cursor and `opacity: .8`; not keyboard/tap interactive. | Disable the tap handler and reduce opacity to 0.8. |
| Infographic no-media state | Download disabled, but the whole card remains tap/keyboard interactive and opens a preview error. | Keep parent tap active; disable only Download. |

The configured family is Inter with `ui-sans-serif` fallback ([font declaration](client/src/assets/css/fonts.css#L1-L5), [Tailwind setting](client/tailwind.config.js#L76-L80)). The global use of the Inter utility on these particular card selectors cannot be confirmed from the card files alone; see gaps below.

## 9. Flutter build outline

This is deliberately short pseudocode. It copies the existing decisions; it does not add features.

### Public shared card

```dart
Widget buildPublicHubCard(PublicCard item) {
  final isVideo = item.resourceType == 'video';
  final isPreview = isVideo || item.resourceType == 'infographic';

  return Card(
    clipBehavior: Clip.antiAlias,
    child: Column(
      children: [
        SizedBox(
          height: 240,
          width: double.infinity,
          child: item.mediaUrl == null
              ? const Center(child: Icon(Icons.description, size: 48))
              : isVideo
                  ? MutedVideoThumbnail(url: item.mediaUrl!, fit: BoxFit.cover)
                  : Image.network(item.mediaUrl!, fit: BoxFit.cover),
        ),
        Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(spacing: 8, children: [
                if (item.contentTypeLabel.isNotEmpty) TypeChip(item.contentTypeLabel),
                if (item.displayDate.isNotEmpty) Text(item.displayDate),
              ]),
              const SizedBox(height: 8),
              SizedBox(height: 56, child: Text(item.title, maxLines: 2, overflow: TextOverflow.ellipsis)),
              const SizedBox(height: 12),
              SizedBox(height: 78, child: Text(item.preview, maxLines: 3, overflow: TextOverflow.ellipsis)),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => isPreview
                      ? openPreviewModal(item)
                      : openArticleRoute('/articles/${item.slug}'),
                  icon: const Icon(Icons.arrow_outward, size: 24),
                  label: Text(isVideo ? 'Watch Video' :
                      item.resourceType == 'infographic' ? 'View Infographic' : 'Read More'),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}
```

### Admin cards and tags

```dart
Widget buildAdminCard(HubContent item) {
  switch (item.type) {
    case ContentType.articles:
      return ArticleListCard(
        title: item.title,
        description: item.description.length <= 75
            ? item.description : item.description.substring(0, 75),
        tags: item.tags,
        views: item.viewCount,
        onShare: () => shareFirstAvailableUrl(item),
      );
    case ContentType.videos:
      return VideoGridCard(
        height: 440,
        thumbnailHeight: 240,
        title: item.title,
        durationText: item.duration.isEmpty ? 'Duration: --' : 'Duration: ${item.duration}',
        tags: item.tags,
        views: item.viewCount,
        enabled: item.media?.url?.isNotEmpty == true,
        onTap: () => openAdminMediaPreview(item),
      );
    case ContentType.infographics:
      return InfographicGridCard(
        height: 360,
        imageFlex: 2,
        detailsFlex: 1,
        title: item.title,
        downloads: item.downloadCount,
        downloadEnabled: item.media?.url?.isNotEmpty == true,
        onTap: () => openAdminMediaPreview(item),
      );
  }
}

Widget tagWrap(List<String> tags, {required bool publicCard}) {
  if (publicCard || tags.isEmpty) return const SizedBox.shrink();
  return Wrap(
    spacing: 6,
    runSpacing: 6,
    children: tags.map((tag) => Chip(label: Text(tag))).toList(),
  );
}
```

Use green tags for dedicated admin Article/Video cards only. Do not add them to public cards or dedicated admin Infographic cards.

### Existing admin search logic

```dart
List<HubContent> filterAdminSearch(List<HubContent> items, String query) {
  if (query.isEmpty) return items;
  final terms = query.toLowerCase().split(' ').where((term) => term.isNotEmpty);

  return items.where((item) {
    final haystack = [
      item.title, item.description, item.source, item.author, item.language,
      item.tags.join(' '), item.topics.join(' '), item.diseases.join(' '),
    ].whereType<String>().join(' ').toLowerCase();

    return terms.any(haystack.contains); // Any word wins, exactly like React.
  }).toList();
}

Widget adminResult(List<HubContent> cards, String typeLabel) {
  if (cards.isEmpty) {
    return Text('No ${typeLabel.toLowerCase()} found');
  }
  return buildAdminListOrGrid(cards);
}
```

The public page has no equivalent search filter. For the mobile contract, prefer sending supported query parameters to `/health-literacy/mobile`; its server-side matching rules are in section 6C.

## 10. Assumptions and gaps

Nothing in this list is a suggested feature. These are things that were **not found in the repository** or cannot be confirmed from the checked implementation.

* **Not found:** a public web search box or public tag/category/content-type filter UI.
* **Not found:** a public empty-results message, public Load more button, or infinite scroll.
* **Not found:** a public visible author, source, duration, tag, topic, disease, language, views, downloads, pinned, featured, or fact-check badge on the shared public card.
* **Not found:** actual non-empty content `tags`, `topics`, or `diseases` in the current three Hub seed JSON files.
* **Not found:** a dedicated Flutter/mobile widget implementation in this repository. The Flutter code above is a faithful translation guide, not existing app code.
* **Not found:** a CSS hover/pressed visual value for the public card container itself; only its CTA buttons have explicitly defined hover/active/focus values. Admin cards specify `hover:shadow-*` and focus rings where listed.
* **Not found:** fixed public-card width, fixed public-card total height, or fixed desktop/mobile image aspect ratio. The public image height is fixed at 240px while the grid width changes.
* **Not found:** an explicit `font-family` declaration inside the card selectors. Inter is configured in shared CSS/Tailwind, but whether a higher global selector applies it to every card cannot be confirmed from these card rules alone.
* **Not found:** a rule that shows a play icon, a video duration, an author/source line, or an image caption in the public Video/Infographic card itself.
* **Not found:** an admin card tag limit for the dedicated Article or Video layouts. Article/Video render all tags and Infographic renders none. A generic fallback branch elsewhere in the same file limits its tags to two, but it is unreachable from every defined Health Literacy Hub content tab and is not a dashboard content-card implementation.
