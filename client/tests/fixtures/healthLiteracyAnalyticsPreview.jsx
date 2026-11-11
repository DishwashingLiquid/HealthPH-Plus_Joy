/* All API calls are intercepted. This fixture never writes to a backend. */
import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { store } from "../../src/features/store";
import { healthLiteracyHubApi } from "../../src/features/api/healthLiteracyHubSlice";
import AnalyticsTab from "../../src/pages/admin/healthLiteracyHub/AnalyticsTab";
import ContentTab from "../../src/pages/admin/healthLiteracyHub/content/ContentTab";
import Articles from "../../src/pages/Articles";
import ArticlePage from "../../src/pages/ArticlePage";
import "../../src/App.css";
import "../../src/assets/css/admin.css";

const source = `${location.origin}/tests/fixtures/health-literacy-tall.svg`;
const content = [
  { id: "static-article-1", contentType: "articles", title: "Imported article", legacyArticleSlug: "original-article",
    legacyStaticArticleId: "1", description: "Readable public article text.", galleryImages: [
      { id: "gallery", media: { url: source, filename: "photo.svg", contentType: "image/svg+xml" }, caption: "Creator caption", alt: "Gallery photo" },
    ] },
  { id: "public-image", contentType: "infographics", title: "Public infographic", description: "Image description.",
    media: { url: source, filename: "photo.svg", contentType: "image/svg+xml" } },
  { id: "public-video", contentType: "videos", title: "Public video", description: "Video description.",
    media: { url: "/tests/fixtures/missing-video.mp4", filename: "video.mp4", contentType: "video/mp4" } },
  { id: "public-pdf", contentType: "articles", title: "Public PDF", description: "PDF description.",
    media: { url: "/tests/fixtures/guide.pdf", filename: "guide.pdf", contentType: "application/pdf" } },
].map((item) => ({ ...item, publishedDate: "2026-11-09", publishToWebsite: true, isPublished: true }));

const fixture = window.__analyticsFixture = {
  calls: [], mode: "error", pending: [], shareMode: "success", clipboardMode: "success", eventFailure: false, downloadFailure: false,
};
fixture.refreshArticle = () => store.dispatch(healthLiteracyHubApi.util.updateQueryData(
  "fetchWebsiteHealthLiteracyContent", "articles", (items) => { items[0].description += " Updated content object."; }
));
const respond = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const overview = { totalContentInteractions: 42, contentPieces: 17, engagementRate: 25, interactedUsers: 5,
  totalRegisteredUsers: 20, unknownRegionInteractions: 0, topPerformingContent: [] };
fixture.release = (status = 200) => { const pending = fixture.pending.splice(0); pending.forEach((done) => done(status === 200 ? respond(overview) : respond({}, status))); };
window.fetch = async (request, options = {}) => {
  const req = new Request(request, options);
  const url = new URL(req.url, location.origin);
  const body = req.method === "POST" ? await req.clone().text() : undefined;
  fixture.calls.push({ path: url.pathname, search: url.search, method: req.method, body: body ? JSON.parse(body) : undefined,
    credentials: req.credentials, headers: Object.fromEntries(req.headers) });
  if (url.pathname.endsWith("/analytics/overview")) {
    if (fixture.mode === "pending") return new Promise((done) => fixture.pending.push(done));
    return fixture.mode === "error" ? respond({ detail: "Isolated fixture error" }, 500) : respond(overview);
  }
  if (url.pathname.endsWith("/analytics/events")) return respond({}, fixture.eventFailure ? 503 : 201);
  if (url.pathname.includes("/comments")) return respond({ items: [], nextCursor: null });
  if (url.pathname.includes("/health-literacy-hub/")) {
    const type = url.pathname.split("/").at(-1);
    return respond(["articles", "videos", "infographics"].includes(type) ? content.filter((item) => item.contentType === type) : content);
  }
  if (url.pathname.startsWith("/tests/fixtures/")) return new Response("isolated media bytes", { status: fixture.downloadFailure ? 503 : 200 });
  return respond({ detail: "No network request sent" }, 400);
};
Object.defineProperty(navigator, "share", { configurable: true, value: async () => {
  if (fixture.shareMode !== "success") throw Object.assign(new Error("Fixture sharing failure"), { name: fixture.shareMode === "cancel" ? "AbortError" : "Error" });
} });
Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => {
  if (fixture.clipboardMode !== "success") throw new Error("Fixture clipboard failure");
} } });

function Fixture() {
  const params = new URLSearchParams(location.search);
  if (params.get("scene") === "analytics") return <div className="p-6 internal-buttons"><AnalyticsTab /></div>;
  if (params.get("scene") === "admin") return <div className="p-6 internal-buttons"><ContentTab contentTypeLabel="Infographics" /></div>;
  return <Routes><Route path="/articles/:slug" element={<ArticlePage />} /><Route path="*" element={<Articles embedded />} /></Routes>;
}
createRoot(document.getElementById("root")).render(<React.StrictMode><Provider store={store}><BrowserRouter><Fixture /></BrowserRouter></Provider></React.StrictMode>);
