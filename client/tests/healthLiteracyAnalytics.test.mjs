import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const filename = fileURLToPath(new URL("../src/utils/publicHealthLiteracyAnalytics.js", import.meta.url));
const bundle = buildSync({ entryPoints: [filename], bundle: true, write: false, platform: "node", format: "cjs",
  define: { "import.meta.env.VITE_API_URL": '"https://api.example.test/api"' } });
const compiled = new Module(filename);
compiled.filename = filename; compiled.require = createRequire(filename);
compiled._compile(bundle.outputFiles[0].text, filename);
const analytics = compiled.exports;
const article = { id: "static-article-1", legacyStaticArticleId: "1", contentOrigin: "api", contentType: "articles",
  articleTitle: "NCR is a title, not a reader location", articleSlug: "original-link", resourceType: "article", region: "NCR" };

function environment(t) {
  const calls = [];
  const saved = new Map([["healthLiteracyVisitorId", "existing-visitor"]]);
  t.mock.method(globalThis, "fetch", async (url, options) => { calls.push({ url, ...options }); return new Response("fixture", { status: 200 }); });
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: { origin: "https://website.example.test" }, crypto: { randomUUID: () => "new-visitor" },
    localStorage: { getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value) },
  } });
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  t.after(() => {
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor); else delete globalThis.window;
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor); else delete globalThis.navigator;
  });
  return { calls, saved, events: () => calls.filter((call) => call.url.endsWith("/analytics/events")) };
}

test("public payload uses current content ID, canonical type, stable existing visitor, website and no guessed region/auth", async (t) => {
  const env = environment(t);
  for (const event of ["content_opened", "content_shared", "content_downloaded"]) await analytics.trackPublicContentEvent(event, article);
  assert.equal(env.events().length, 3);
  for (const call of env.events()) {
    assert.deepEqual(JSON.parse(call.body), { eventType: JSON.parse(call.body).eventType, contentId: "static-article-1",
      contentType: "article", contentTitle: article.articleTitle, clientPlatform: "website", visitorId: "existing-visitor" });
    assert.equal(call.url, "https://api.example.test/api/health-literacy-hub/analytics/events");
    assert.equal(call.credentials, "omit");
    assert.equal(call.headers.Authorization, undefined);
  }
});

test("blocked local storage keeps a stable page-session visitor and analytics failures never reject", async (t) => {
  const env = environment(t);
  window.localStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  await analytics.trackPublicContentEvent("content_opened", article);
  await analytics.trackPublicContentEvent("content_shared", article);
  assert.equal(JSON.parse(env.events()[0].body).visitorId, JSON.parse(env.events()[1].body).visitorId);
  t.mock.method(globalThis, "fetch", async () => { throw new Error("offline"); });
  await assert.doesNotReject(analytics.trackPublicContentEvent("content_opened", article));
});

test("invalid identities and unsupported events never send public events", async (t) => {
  const env = environment(t);
  for (const invalid of [{ ...article, id: "" }, { ...article, contentOrigin: "static" }, { ...article, contentType: "unknown" }, undefined]) {
    await analytics.trackPublicContentEvent("content_opened", invalid);
  }
  await analytics.trackPublicContentEvent("report_exported", article);
  assert.equal(env.calls.length, 0);
});

test("native shares and clipboard copies track only success; cancellation and failures never track", async (t) => {
  const env = environment(t);
  navigator.share = async ({ url }) => assert.equal(url, "https://website.example.test/articles/original-link");
  assert.equal(await analytics.sharePublicContent(article), "Content shared.");
  assert.equal(env.events().length, 1);
  navigator.share = async () => { throw Object.assign(new Error("cancel"), { name: "AbortError" }); };
  await assert.rejects(analytics.sharePublicContent(article), { name: "AbortError" });
  navigator.share = async () => { throw new Error("share failed"); };
  await assert.rejects(analytics.sharePublicContent(article));
  assert.equal(env.events().length, 1);
  delete navigator.share;
  navigator.clipboard = { writeText: async () => {} };
  await analytics.sharePublicContent(article);
  assert.equal(env.events().length, 2);
  navigator.clipboard.writeText = async () => { throw new Error("denied"); };
  await assert.rejects(analytics.sharePublicContent(article));
  assert.equal(env.events().length, 2);
  // A tracking outage after a completed share cannot turn that share into a failure.
  navigator.clipboard.writeText = async () => {};
  t.mock.method(globalThis, "fetch", async () => { throw new Error("analytics offline"); });
  await assert.doesNotReject(analytics.sharePublicContent(article));
});

test("media shares use a website link containing the exact ID/type", (t) => {
  environment(t);
  const url = new URL(analytics.publicContentShareUrl({ ...article, id: "media/&id", contentType: "infographics", resourceType: "infographic" }));
  assert.equal(url.origin, "https://website.example.test");
  assert.equal(url.pathname, "/articles");
  assert.equal(url.searchParams.get("content"), "media/&id");
  assert.equal(url.searchParams.get("type"), "infographics");
});

test("downloads track after a successful blob handoff, never after failed fetches or failed handoffs", async (t) => {
  const env = environment(t);
  const downloads = [];
  const originalDocument = globalThis.document;
  globalThis.document = { body: { appendChild() {} }, createElement: () => ({
    click() { downloads.push({ href: this.href, filename: this.download, eventsBeforeClick: env.events().length }); }, remove() {},
  }) };
  t.after(() => { globalThis.document = originalDocument; });
  await analytics.downloadPublicContent(article, "https://media.example.test/guide.pdf", "guide.pdf");
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].filename, "guide.pdf");
  assert.match(downloads[0].href, /^blob:/);
  assert.equal(downloads[0].eventsBeforeClick, 0);
  assert.equal(JSON.parse(env.events()[0].body).eventType, "content_downloaded");
  const count = env.events().length;
  t.mock.method(globalThis, "fetch", async () => new Response("unavailable", { status: 503 }));
  await assert.rejects(analytics.downloadPublicContent(article, "https://media.example.test/guide.pdf"));
  await assert.rejects(analytics.downloadPublicContent(article, "javascript:invalid"));
  assert.equal(env.events().length, count);
  assert.equal(downloads.length, 1);
  t.mock.method(globalThis, "fetch", async () => new Response("fixture"));
  document.createElement = () => ({ click() { throw new Error("handoff failed"); }, remove() {} });
  await assert.rejects(analytics.downloadPublicContent(article, "https://media.example.test/guide.pdf"));
  assert.equal(env.events().length, count);
});
