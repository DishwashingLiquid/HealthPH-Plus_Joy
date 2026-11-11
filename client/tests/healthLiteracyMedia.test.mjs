import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const load = (path) => {
  const filename = fileURLToPath(new URL(path, import.meta.url));
  const result = buildSync({ entryPoints: [filename], bundle: true, write: false,
    platform: "node", format: "cjs", jsx: "automatic", packages: "external",
    define: { "import.meta.env.VITE_API_URL": '"https://api.example.test/api"' },
    loader: { ".svg": "empty" } });
  const compiled = new Module(filename);
  compiled.filename = filename;
  compiled.require = createRequire(filename);
  compiled._compile(result.outputFiles[0].text, filename);
  return compiled.exports;
};

const shared = load("../src/pages/admin/healthLiteracyHub/shared.js");
const helpers = load("../src/pages/admin/healthLiteracyHub/content/contentTabModalHelpers.js");
const website = load("../src/utils/healthLiteracyWebsiteContent.js");
const gallery = load("../src/pages/admin/healthLiteracyHub/content/contentGallery.js");
const url = "https://api.example.test/api/health-literacy-hub/media/abc";
const previewUrl = `${url}?preview=scoped-token`;

test("article preview edits round-trip separately from the full body and keep legacy links", () => {
  const item = { id: "static-article-1", title: "Edited title", description: "Full body", shortPreview: "Short summary",
    legacyArticleSlug: "original-story", legacyStaticArticleId: "1" };
  const form = helpers.createEditFormData({ item, contentTypeLabel: "Articles" });
  assert.equal(form.shortPreview, "Short summary");
  form.shortPreview = "Reviewed preview";
  const data = helpers.buildContentFormPayload({ formData: form, contentTypeLabel: "Articles" });
  assert.equal(data.get("shortPreview"), "Reviewed preview");
  assert.equal(data.get("description"), "Full body");
  const publicArticle = website.normalizeDashboardContent({ ...item, contentType: "articles" });
  assert.equal(publicArticle.articleSlug, "original-story");
  assert.equal(publicArticle.articlePreview, "Short summary");
  assert.equal(publicArticle.articleBody, "Full body");
  assert.equal(website.normalizeDashboardContent({ ...item, shortPreview: "" }).articlePreview, "Full body");
});

test("admin uses scoped preview while public website and sharing use public URL", () => {
  const media = { url, previewUrl };
  assert.equal(shared.getContentMediaSource(media), previewUrl);
  assert.equal(website.getContentMediaSource(media), url);
  assert.equal(helpers.getShareUrl({ media }), "");
  assert.equal(helpers.getShareUrl({ media, publishToWebsite: true }), url);
  assert.equal(website.getContentMediaSource({ dataUrl: "data:secret" }), "");
});

test("admin draft images use the dashboard API even when public media URLs point to another deployment", () => {
  const id = "6af28dedd0747c3a1815cd34";
  const publicUrl = `https://hosted.example.test/api/health-literacy-hub/media/${id}`;
  const media = { url: publicUrl, previewUrl: `${publicUrl}?preview=local-scoped-token` };
  assert.equal(shared.getContentMediaSource(media), `https://api.example.test/api/health-literacy-hub/media/${id}?preview=local-scoped-token`);
  assert.equal(shared.getContentMediaSource({ url: publicUrl }), `https://api.example.test/api/health-literacy-hub/media/${id}`);
  assert.equal(website.getContentMediaSource(media), publicUrl);
  assert.equal(helpers.getShareUrl({ media, publishToWebsite: true }), publicUrl);
  assert.equal(shared.getContentMediaSource({ url: "https://editorial.example.test/photo.jpg" }), "https://editorial.example.test/photo.jpg");
});

test("client accepts only supported MIME types with matching size limits", () => {
  assert.equal(shared.isAllowedMediaType({ type: "image/png" }, "Infographics"), true);
  assert.equal(shared.isAllowedMediaType({ type: "image/svg+xml" }, "Infographics"), false);
  assert.equal(shared.isAllowedMediaType({ type: "video/mp4" }, "Infographics"), false);
  assert.equal(shared.isAllowedMediaType({ type: "application/pdf" }, "Articles"), true);
  assert.equal(shared.isAllowedMediaType({ type: "video/mp4" }, "Videos"), true);
  assert.equal(shared.getMediaSizeError({ type: "image/png", size: 25 * 1024 ** 2 }), null);
  assert.match(shared.getMediaSizeError({ type: "image/png", size: 25 * 1024 ** 2 + 1 }), /25 MiB/);
  assert.equal(shared.getMediaSizeError({ type: "video/mp4", size: 250 * 1024 ** 2 }), null);
  assert.match(shared.getMediaSizeError({ type: "video/mp4", size: 250 * 1024 ** 2 + 1 }), /250 MiB/);
  assert.match(shared.getMediaSizeError({ type: "image/png", size: 0 }), /non-empty/);
});

test("edit preserves fields and multipart uploads binary, never preview URL or file ID", () => {
  const form = helpers.createEditFormData({ item: { title: "Title", description: "Description",
    topics: ["Health"], diseases: ["Dengue"], tags: ["prevention"], language: "fil",
    media: { fileId: "abc", url, previewUrl, contentType: "image/png" }, publishToMobile: true } });
  assert.equal(form.mediaPreview, previewUrl);
  assert.equal(form.language, "fil");
  form.media = new Blob(["bytes"], { type: "image/png" });
  const data = helpers.buildContentFormPayload({ formData: form, contentTypeLabel: "Infographics", includeRemoveMedia: true });
  assert.equal(data.get("file").size, 5);
  assert.equal(data.get("language"), "fil");
  assert.equal(data.get("publishToMobile"), "true");
  assert.equal(data.get("topics"), '["Health"]');
  assert.equal(data.get("removeMedia"), "false");
  assert.equal(data.has("mediaPreview"), false);
  assert.equal(data.has("fileId"), false);
  form.media = null;
  form.removeMedia = true;
  const removal = helpers.buildContentFormPayload({ formData: form, contentTypeLabel: "Infographics", includeRemoveMedia: true });
  assert.equal(removal.get("removeMedia"), "true");
  assert.equal(removal.has("file"), false);
});

test("video edit uploads a separate poster without sending generated GridFS URLs as external links", () => {
  const posterUrl = `${url}poster`;
  const form = helpers.createEditFormData({ item: { title: "Video", description: "Guide",
    media: { fileId: "video", url, contentType: "video/mp4" },
    thumbnail: { fileId: "poster", url: posterUrl, contentType: "image/png" },
    imageUrl: posterUrl, mediaUrl: url } });
  assert.equal(form.imageUrl, "");
  assert.equal(form.mediaUrl, "");
  form.thumbnail = new Blob(["poster"], { type: "image/png" });
  const data = helpers.buildContentFormPayload({ formData: form, contentTypeLabel: "Videos", includeRemoveMedia: true });
  assert.equal(data.get("thumbnail").size, 6);
  assert.equal(data.get("imageUrl"), "");
  assert.equal(data.get("mediaUrl"), "");
});

test("gallery edits and reordering associate captions and uploads by ID despite identical filenames", () => {
  const saved = [{ id: "one", media: { fileId: "file-one", filename: "same.png", url, previewUrl }, caption: "First", alt: "First alt" },
    { id: "two", media: { fileId: "file-two", filename: "same.png", url: `${url}2` }, caption: "Second", alt: "Second alt" }];
  const form = helpers.createEditFormData({ item: { title: "Gallery", description: "Description", galleryImages: saved }, contentTypeLabel: "Articles" });
  form.galleryImages = gallery.moveGalleryImage(form.galleryImages, "two", -1);
  assert.deepEqual(form.galleryImages.map(({ id, caption }) => [id, caption]), [["two", "Second"], ["one", "First"]]);
  form.galleryImages[0] = { ...form.galleryImages[0], caption: "Edited without reuploading" };
  let data = helpers.buildContentFormPayload({ formData: form, contentTypeLabel: "Articles" });
  assert.deepEqual(JSON.parse(data.get("galleryImages")), [
    { id: "two", fileId: "file-two", caption: "Edited without reuploading", alt: "Second alt" },
    { id: "one", fileId: "file-one", caption: "First", alt: "First alt" }]);
  assert.equal(data.has("galleryFile_two"), false);
  form.galleryImages[1] = { ...form.galleryImages[1], file: new File(["new bytes"], "same.png", { type: "image/png" }) };
  form.galleryImages.push({ id: "three", file: new File(["third"], "same.png", { type: "image/png" }), caption: "Third", alt: "" });
  data = helpers.buildContentFormPayload({ formData: form, contentTypeLabel: "Articles" });
  assert.equal(data.get("galleryFile_one").name, "same.png");
  assert.equal(data.get("galleryFile_three").name, "same.png");
  assert.equal(JSON.parse(data.get("galleryImages"))[1].caption, "First");
  assert.equal(JSON.parse(data.get("galleryImages"))[1].fileId, undefined);
  form.galleryImages = form.galleryImages.filter(({ id }) => id !== "two");
  data = helpers.buildContentFormPayload({ formData: form, contentTypeLabel: "Articles" });
  assert.deepEqual(JSON.parse(data.get("galleryImages")).map(({ id }) => id), ["one", "three"]);
  assert.equal(gallery.moveGalleryImage(saved, "one", -1), saved);
  assert.equal(gallery.galleryValidationError(Array(11).fill({})), "An article supports at most 10 gallery images");
  assert.match(gallery.galleryValidationError([{ caption: "c".repeat(1001) }]), /1000/);
  assert.match(gallery.galleryValidationError([{ file: { type: "image/svg+xml", size: 10 } }]), /JPG/);
  assert.match(gallery.galleryValidationError([{ file: { type: "image/png", size: 26 * 1024 ** 2 } }]), /26.2 MB/);
});

test("existing article image can gain a caption without a new upload; other content retains its main image", () => {
  const item = { title: "Existing", media: { fileId: "file-one", contentType: "image/png", url, previewUrl }, imageUrl: url };
  const form = helpers.createEditFormData({ item, contentTypeLabel: "Articles" });
  assert.equal(form.removeMedia, true);
  assert.equal(form.existingMedia, null);
  assert.equal(form.galleryImages[0].id, "main-file-one");
  form.galleryImages[0].caption = "New caption";
  const data = helpers.buildContentFormPayload({ formData: form, contentTypeLabel: "Articles", includeRemoveMedia: true });
  assert.equal(data.get("removeMedia"), "true");
  assert.equal(data.get("imageUrl"), "");
  assert.equal(data.has("galleryFile_main-file-one"), false);
  assert.equal(helpers.createEditFormData({ item, contentTypeLabel: "Infographics" }).existingMedia, item.media);
});

test("decorative images save empty alternative text while preserving captions and unsaved descriptions", () => {
  const item = { title: "Images", galleryImages: [
    { id: "one", media: { fileId: "one" }, caption: "Visible caption", alt: "An informative image" },
    { id: "two", media: { fileId: "two" }, caption: "", alt: "" },
  ] };
  const form = helpers.createEditFormData({ item, contentTypeLabel: "Articles" });
  assert.equal(form.galleryImages[0].decorative, false);
  assert.equal(form.galleryImages[1].decorative, true);
  form.galleryImages[0].decorative = true;
  let entries = JSON.parse(helpers.buildContentFormPayload({ formData: form, contentTypeLabel: "Articles" }).get("galleryImages"));
  assert.equal(entries[0].alt, "");
  assert.equal(entries[0].caption, "Visible caption");
  assert.equal(form.galleryImages[0].alt, "An informative image");
  const reopened = helpers.createEditFormData({ item: { ...item, galleryImages: entries.map((entry) => ({ ...entry, media: { fileId: entry.fileId } })) }, contentTypeLabel: "Articles" });
  assert.equal(reopened.galleryImages[0].decorative, true);
  form.galleryImages[0].decorative = false;
  entries = JSON.parse(helpers.buildContentFormPayload({ formData: form, contentTypeLabel: "Articles" }).get("galleryImages"));
  assert.equal(entries[0].alt, "An informative image");
});

const mediaBehavior = load("../src/utils/healthLiteracyMedia.js");

test("attachments distinguish absence, real MIME types, providers and unsupported data", () => {
  const kind = mediaBehavior.attachmentKind;
  assert.equal(kind(""), "missing");
  assert.equal(kind(url, "application/pdf"), "pdf");
  assert.equal(kind(url, "image/png"), "image");
  assert.equal(kind(url, "video/mp4"), "video");
  assert.equal(kind("https://www.youtube.com/watch?v=abc", "video/mp4"), "provider");
  assert.equal(kind("https://vimeo.com/123", "video/mp4"), "provider");
  assert.equal(kind("javascript:alert(1)"), "unsupported");
  assert.equal(kind(url, "application/zip"), "unsupported");
});

const previewHarness = () => {
  let sequence = 0;
  const tasks = new Map();
  const video = { src: "", pauses: 0, loads: 0, plays: 0, muted: false,
    pause() { this.pauses++; }, load() { this.loads++; },
    removeAttribute() { this.src = ""; }, async play() { this.plays++; } };
  const visible = [];
  let allowed = true;
  const controller = mediaBehavior.createHoverPreview({ video, src: url,
    allowed: () => allowed, show: (value) => visible.push(value),
    delay: (fn, ms) => { const id = ++sequence; tasks.set(id, { fn, ms }); return id; }, cancel: (id) => tasks.delete(id),
  });
  return { video, visible, controller, tasks, disallow: () => { allowed = false; },
    tick: async (ms) => { for (const [id, task] of [...tasks]) if (task.ms === ms) { tasks.delete(id); await task.fn(); } } };
};

test("hover loads on demand after 500ms, stops after six seconds and releases the source", async () => {
  const h = previewHarness();
  h.controller.start();
  assert.equal(h.video.src, ""); assert.equal(h.video.plays, 0);
  await h.tick(500);
  assert.equal(h.video.src, url); assert.equal(h.video.muted, true); assert.equal(h.video.plays, 1);
  await h.tick(6000);
  assert.equal(h.video.src, ""); assert.equal(h.visible.at(-1), false);
  h.controller.start(); h.controller.stop(); await h.tick(500);
  assert.equal(h.video.plays, 1); // Pointer exit cancels intent timer.
});

test("only one preview runs and visibility/reduced-motion gating prevents playback", async () => {
  const first = previewHarness(), second = previewHarness();
  first.controller.start(); await first.tick(500);
  second.controller.start();
  assert.equal(first.video.src, "");
  await second.tick(500); assert.equal(second.video.plays, 1);
  mediaBehavior.stopCardPreviews(); assert.equal(second.video.src, "");
  second.disallow(); second.controller.start(); await second.tick(500);
  assert.equal(second.video.plays, 1);
});

test("blocked and late preview playback retain the poster without reviving an exited card", async () => {
  const h = previewHarness();
  h.video.play = () => Promise.reject(new Error("blocked"));
  h.controller.start(); await h.tick(500);
  assert.equal(h.video.src, ""); assert.equal(h.visible.at(-1), false);
  let resolve;
  h.video.play = () => new Promise((done) => { resolve = done; });
  h.controller.start(); const pending = h.tick(500);
  h.controller.stop(); resolve(); await pending;
  assert.equal(h.visible.at(-1), false);
});
