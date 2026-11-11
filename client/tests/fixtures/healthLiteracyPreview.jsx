/* Isolated browser fixture: intercept every fetch; never access a configured backend. */
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { store } from "../../src/features/store";
import Articles from "../../src/pages/Articles";
import ArticlePage from "../../src/pages/ArticlePage";
import ContentTab from "../../src/pages/admin/healthLiteracyHub/content/ContentTab";
import TestimonialItem from "../../src/components/about-us/TestimonialItem";
import Home from "../../src/pages/Home";
import bundledArticles from "../../src/assets/data/articles.json";
import "../../src/App.css";

const scenario = new URLSearchParams(location.search).get("scenario") || "";
const image = new URL("/tests/fixtures/health-literacy-tall.svg", location.origin).href;
const content = [
  { id: "fixture-video", contentType: "videos", title: "A long video title about learning and community health, with publication details and a readable description",
    description: "An offline video fixture. This description stays accessible when video playback fails. ".repeat(4),
    media: { url: "/tests/fixtures/missing-video.mp4", contentType: "video/mp4" }, imageUrl: "/assets/articles/generic-article.png" },
  { id: "fixture-photo", contentType: "infographics", title: "Tall infographic with a long title and accessible image controls",
    description: "Test illustration only. This fixture contains no medical advice. ".repeat(4), media: { url: image, contentType: "image/svg+xml" } },
  { id: "fixture-article", contentType: "articles", title: "Article without an attachment", description: "A readable article without any media. ".repeat(30), media: null },
  { id: "fixture-pdf", contentType: "articles", title: "Article with a PDF document", description: "This document uses a link rather than an image renderer.", media: { url: "/tests/fixtures/example.pdf", filename: "guide.pdf", contentType: "application/pdf" } },
].map((item) => ({ ...item, publishedDate: "2026-11-09", publishToWebsite: true }));
const requests = [];
if (scenario.startsWith("gallery")) content.push({ id: "fixture-gallery", contentType: "articles", title: "Uploaded gallery with captions",
  description: "Creator captions and public comments stay separate.", shortPreview: "A separate short preview for review.", language: "en", publishedDate: "2026-11-09", publishToWebsite: true,
  galleryImages: [{ id: "first", media: { fileId: "first-file", url: image, previewUrl: image, filename: "same.png", contentType: "image/png" }, caption: "First creator caption", alt: "First accessible description" },
    { id: "second", media: { fileId: "second-file", url: image + "?second", previewUrl: image + "?second", filename: "same.png", contentType: "image/png" }, caption: "Second creator caption", alt: "Second accessible description" }], media: null });
// Simulate an imported article through the API; production no longer reads the
// bundled JSON. Keep the existing gallery typography comparison fixture.
if (scenario.startsWith("gallery")) {
  const article = bundledArticles.find((item) => item.articleTitle && item.galleryImages?.length);
  content.push({ id: `static-article-${article.articleID}`, contentType: "articles", title: article.articleTitle,
    description: article.articleBody, shortPreview: article.articlePreview, legacyArticleSlug: article.articleSlug,
    publishedDate: "2023-10-09", publishToWebsite: true, language: "en", media: null,
    galleryImages: article.galleryImages.map((entry, i) => ({ id: `gallery-${i + 1}`, caption: entry.caption, alt: entry.caption,
      media: { url: `/assets/articles/gallery/${article.galleryFolder}/${entry.filename}`, contentType: "image/jpeg" } })) });
}
window.__hlRequests = requests;
let postAttempts = 0;
window.fetch = async (request, options = {}) => {
  const url = new URL(typeof request === "string" ? request : request.url, location.origin);
  const method = options.method || request.method || "GET";
  requests.push({ path: url.pathname, method, headers: Object.fromEntries(new Headers(options.headers || request.headers)), credentials: options.credentials });
  const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  if (url.pathname.includes("/comments")) {
    if (scenario === "comments-loading") return new Promise(() => {});
    if (scenario === "comments-error") return respond({ detail: "Fixture comments unavailable" }, 503);
    if (url.pathname.endsWith("/session")) return respond({ access_token: "fixture-comment-session", userId: "fixture-reader" });
    if (method === "POST") { postAttempts++; return scenario === "expired" && postAttempts === 1 ? respond({ detail: "Fixture session expired" }, 401) : respond({ id: "fixture-pending", body: JSON.parse(options.body).body, status: "pending" }, 201); }
    if (url.pathname.includes("/mine") || url.pathname.includes("/moderation/")) return respond({ items: [], nextCursor: null });
    return respond({ items: scenario === "empty" ? [] : [{ id: "fixture-comment", body: "An approved comment that anyone can read.", author: "Community member", createdAt: "2026-11-09T00:00:00Z" }], nextCursor: null });
  }
  if (url.pathname.includes("/health-literacy-hub/")) {
    if (scenario.startsWith("gallery") && ["POST", "PUT"].includes(method) && !url.pathname.endsWith("/analytics/events")) {
      const form = options.body instanceof FormData ? options.body : await request.clone().formData();
      const saved = content.find((item) => item.id === url.pathname.split("/").at(-1));
      if (!saved) return respond({ detail: "Fixture content missing" }, 404);
      saved.title = form.get("title"); saved.description = form.get("description");
      saved.shortPreview = form.get("shortPreview");
      if (form.get("removeMedia") === "true") saved.media = null;
      const attachment = form.get("file");
      if (attachment) saved.media = { fileId: "fixture-attachment", url: URL.createObjectURL(attachment), filename: attachment.name, contentType: attachment.type };
      saved.galleryImages = JSON.parse(form.get("galleryImages")).map((entry) => {
        const file = form.get(`galleryFile_${entry.id}`);
        const media = file ? { fileId: `${entry.id}-uploaded`, url: URL.createObjectURL(file), filename: file.name, contentType: file.type }
          : saved.galleryImages.find((image) => image.id === entry.id).media;
        return { id: entry.id, caption: entry.caption, alt: entry.alt, media };
      });
      return respond({ content: saved, message: "Saved fixture" });
    }
    const type = url.pathname.split("/").at(-1);
    return respond(["articles", "videos", "infographics"].includes(type) ? content.filter((item) => item.contentType === type) : content);
  }
  return respond({ detail: "Unimplemented fixture request; no network request sent" }, 400);
};

// Local synthetic clip exercises playback without external video services or files.
try {
  const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 360;
  const stream = canvas.captureStream(10);
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  const chunks = [];
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.start();
  const context = canvas.getContext("2d");
  const paint = setInterval(() => { context.fillStyle = "#003874"; context.fillRect(0, 0, 640, 360); context.fillStyle = "#DBB324"; context.fillRect(Date.now() % 500, 140, 100, 80); }, 100);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  recorder.stop(); clearInterval(paint); await stopped; stream.getTracks().forEach((track) => track.stop());
  content[0].media = { url: URL.createObjectURL(new Blob(chunks, { type: "video/webm" })), contentType: "video/webm" };
} catch { /* Missing-video fixture still verifies failure and comments access. */ }

function Fixture() {
  const [type, setType] = useState(scenario === "gallery-hub" ? "Articles" : "Videos");
  if (scenario === "public-buttons") return <Home />;
  if (scenario === "internal-buttons") return <>
    <section className="admin-layout internal-buttons"><button className="prod-btn-base prod-btn-primary" id="admin-primary">Admin primary</button>
      <button className="prod-btn-base prod-btn-secondary" id="admin-secondary">Admin secondary</button>
      <button className="prod-btn-base prod-btn-primary" disabled id="admin-disabled">Admin disabled</button></section>
    <section className="auth-layout internal-buttons"><button className="prod-btn-base prod-btn-primary" id="auth-primary">Auth primary</button></section>
  </>;
  if (scenario === "testimonial") return <div className="article-layout research-team-page"><TestimonialItem name="Fixture person" position="Fixture role" testimonial="Unchanged shared modal consumer." /></div>;
  if (scenario === "hub" || scenario === "gallery-hub") return <div className="p-4 internal-buttons"><div className="hl-actions">{["Videos", "Infographics", "Articles"].map((label) => <button type="button" className="hl-button" key={label} onClick={() => setType(label)}>{label}</button>)}</div><ContentTab key={type} contentTypeLabel={type} /></div>;
  return <Routes><Route path="/articles/:slug" element={<ArticlePage />} /><Route path="*" element={<Articles embedded />} /></Routes>;
}
createRoot(document.getElementById("root")).render(<React.StrictMode><Provider store={store}><BrowserRouter><Fixture /></BrowserRouter></Provider></React.StrictMode>);
