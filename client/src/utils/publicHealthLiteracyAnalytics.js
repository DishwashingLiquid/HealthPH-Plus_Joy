import { getHealthLiteracyVisitorId } from "./healthLiteracyVisitor";
import { safeMediaSource } from "./healthLiteracyMedia";

const CONTENT_TYPES = { articles: "article", article: "article", videos: "video", video: "video", infographics: "infographic", infographic: "infographic" };
const EVENTS = new Set(["content_opened", "content_shared", "content_downloaded"]);

export const publicContentIdentity = (article) => {
  // Imported records use their current Mongo content ID, not their legacy comment ID.
  const contentId = String(article?.id ?? "").trim();
  const contentType = CONTENT_TYPES[article?.contentType];
  return article?.contentOrigin === "api" && contentId && contentType
    ? { contentId, contentType } : null;
};

export const trackPublicContentEvent = async (eventType, article) => {
  try {
    const identity = publicContentIdentity(article);
    if (!identity || !EVENTS.has(eventType)) return;
    // Public engagement never inherits the dashboard token or cookies. No reader
    // region is reliably available here; content titles/IDs cannot supply one.
    await fetch(`${import.meta.env?.VITE_API_URL ?? "/api"}/health-literacy-hub/analytics/events`, {
      method: "POST", credentials: "omit", keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, ...identity, contentTitle: article.articleTitle,
        clientPlatform: "website", visitorId: getHealthLiteracyVisitorId() }),
    });
  } catch { /* Analytics is best effort and must never block the public action. */ }
};

export const publicContentShareUrl = (article) => {
  const url = new URL("/articles", window.location.origin);
  if (article.resourceType === "article") url.pathname += `/${encodeURIComponent(article.articleSlug)}`;
  else {
    url.searchParams.set("content", article.id);
    url.searchParams.set("type", article.contentType);
  }
  return url.href;
};

export const sharePublicContent = async (article) => {
  const url = publicContentShareUrl(article);
  if (navigator.share) {
    await navigator.share({ title: article.articleTitle, url });
    void trackPublicContentEvent("content_shared", article);
    return "Content shared.";
  }
  await navigator.clipboard.writeText(url);
  void trackPublicContentEvent("content_shared", article);
  return "Link copied to clipboard.";
};

export const downloadPublicContent = async (article, source, filename) => {
  if (!safeMediaSource(source)) throw new Error("Unsupported download source");
  const response = await fetch(source, { credentials: "omit" });
  if (!response.ok) throw new Error("Download unavailable");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = filename || "health-literacy-content";
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // Allow the browser to consume the blob before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  void trackPublicContentEvent("content_downloaded", article);
};
