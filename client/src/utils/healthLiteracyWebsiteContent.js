export const WEBSITE_CONTENT_TYPE_LABELS = {
  articles: "Article",
  videos: "Video",
  infographics: "Infographic",
};

export const slugify = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const getDashboardContentSlug = (item) => {
  const titleSlug = slugify(item?.title) || "health-literacy-content";
  return `${titleSlug}-${item?.id}`;
};

export const getContentMediaSource = (media) => {
  const mediaSource = media?.url || media?.dataUrl || "";

  if (!mediaSource || mediaSource.startsWith("data:")) return mediaSource;

  try {
    return new URL(mediaSource, import.meta.env.VITE_API_URL).href;
  } catch {
    return mediaSource;
  }
};

export const getStaticArticleImageSource = (article) =>
  article?.articleImage ? `/assets/articles/preview/${article.articleImage}` : "";

export const getArticleSortDate = (article) => {
  const date = new Date(article?.sortDate ?? article?.datePublished ?? article?.createdAt);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
};

export const formatContentDate = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

export const getResourceImageSource = (article) => {
  if (article?.source === "api") {
    return getContentMediaSource(article.media);
  }

  return getStaticArticleImageSource(article);
};

const getReadDuration = (text) => {
  const words = String(text ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} minute${minutes > 1 ? "s" : ""} read`;
};

export const normalizeStaticArticle = (article) => ({
  ...article,
  source: "static",
  contentType: "articles",
  contentTypeLabel: "Article",
  resourceType: "article",
  sortDate: article.datePublished,
});

export const normalizeDashboardContent = (item) => {
  const contentType = item.contentType ?? "";
  const contentTypeLabel = WEBSITE_CONTENT_TYPE_LABELS[contentType] ?? "Content";
  const resourceType =
    contentType === "videos"
      ? "video"
      : contentType === "infographics"
      ? "infographic"
      : "article";

  return {
    ...item,
    source: "api",
    contentType,
    contentTypeLabel,
    resourceType,
    articleTitle: item.title ?? "Untitled content",
    articleSlug: getDashboardContentSlug(item),
    datePublished: item.createdAt,
    articlePreview: item.description ?? "",
    articleImage: "",
    articleImageCaption: item.title ?? "",
    articleBody: item.description ?? "",
    galleryImages: [],
    galleryFolder: "",
    readDuration: getReadDuration(item.description),
    sortDate: item.createdAt,
  };
};

export const normalizeWebsiteContent = (content = []) =>
  content.map(normalizeDashboardContent);

export const sortNewestFirst = (items) =>
  [...items].sort((a, b) => getArticleSortDate(b) - getArticleSortDate(a));
