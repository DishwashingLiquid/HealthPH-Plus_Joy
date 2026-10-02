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
const url = "https://api.example.test/api/health-literacy-hub/media/abc";
const previewUrl = `${url}?preview=scoped-token`;

test("admin uses scoped preview while public website and sharing use public URL", () => {
  const media = { url, previewUrl };
  assert.equal(shared.getContentMediaSource(media), previewUrl);
  assert.equal(website.getContentMediaSource(media), url);
  assert.equal(helpers.getShareUrl({ media }), "");
  assert.equal(helpers.getShareUrl({ media, publishToWebsite: true }), url);
  assert.equal(website.getContentMediaSource({ dataUrl: "data:secret" }), "");
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
