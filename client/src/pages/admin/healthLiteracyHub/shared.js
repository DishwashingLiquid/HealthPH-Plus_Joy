import {
  HEALTH_LITERACY_LANGUAGE_LIMIT,
  HEALTH_LITERACY_LANGUAGE_OPTIONS,
  UPLOAD_RULES,
} from "./sharedConfig";

export {
  ANALYTICS_CONTENT_FILTERS,
  ANALYTICS_REGIONS,
  ANALYTICS_TIME_RANGES,
  DEFAULT_ANALYTICS_OVERVIEW,
  FACT_CHECK_CLAIM_STATUS_OPTIONS,
  FACT_CHECK_VERIFIED_BY_OPTIONS,
  HEALTH_LITERACY_LANGUAGE_LIMIT,
  HEALTH_LITERACY_LANGUAGE_OPTIONS,
  HEALTH_LITERACY_VISITOR_ID_KEY,
  ILLUSTRATIONS,
  INITIAL_FORM_DATA,
  TAB_CONTENT_TYPES,
  UPLOAD_RULES,
} from "./sharedConfig";
export {
  downloadCsv,
  escapeCsvValue,
  formatNumber,
  formatPercent,
  formatVideoDuration,
  getAnalyticsCellText,
  getFilterLabel,
  getRegionLabel,
  slugify,
} from "./sharedFormatting";
export {
  buildAnalyticsReport,
  getAnalyticsRegionValue,
  getAnalyticsSeed,
  getHealthLiteracyVisitorId,
} from "./sharedAnalytics";
export { showToast } from "./sharedToast";

export const normalizeContentTags = (tags) => {
  const sourceTags = Array.isArray(tags)
    ? tags
    : String(tags ?? "")
        .split(",")
        .map((tag) => tag.trim());
  const seenTags = new Set();

  return sourceTags.reduce((normalizedTags, tag) => {
    const normalizedTag = String(tag ?? "").trim();
    const tagKey = normalizedTag.toLowerCase();

    if (!normalizedTag || seenTags.has(tagKey)) return normalizedTags;

    seenTags.add(tagKey);
    normalizedTags.push(normalizedTag);
    return normalizedTags;
  }, []);
};

export const getLimitedContentTags = (tags) =>
  normalizeContentTags(tags)
    .filter((tag) =>
      HEALTH_LITERACY_LANGUAGE_OPTIONS.some(
        (option) => option.value.toLowerCase() === tag.toLowerCase()
      )
    )
    .slice(0, HEALTH_LITERACY_LANGUAGE_LIMIT);

export const getTagOptionsWithSelectedTags = () =>
  HEALTH_LITERACY_LANGUAGE_OPTIONS;

export const getContentMediaSource = (media) => {
  const mediaSource = media?.url || media?.dataUrl || "";

  if (!mediaSource || mediaSource.startsWith("data:")) return mediaSource;

  try {
    return new URL(mediaSource, import.meta.env.VITE_API_URL).href;
  } catch {
    return mediaSource;
  }
};

export const getContentLikeCount = (item) => {
  return Number(
    item.likeCount ??
      item.likes ??
      item.likesCount ??
      item.analytics?.likeCount ??
      item.metrics?.likeCount ??
      0
  );
};

export const getContentDownloadCount = (item) => {
  return Number(
    item.downloadCount ??
      item.downloads ??
      item.downloadsCount ??
      item.analytics?.downloadCount ??
      item.metrics?.downloadCount ??
      0
  );
};

export const getContentViewCount = (item) => {
  return Number(
    item.viewCount ??
      item.views ??
      item.viewsCount ??
      item.analytics?.viewCount ??
      item.metrics?.viewCount ??
      0
  );
};

export const getContentReviewDate = (item) => {
  return (
    item.lastReviewedAt ??
    item.lastReviewed ??
    item.reviewedAt ??
    item.reviewDate ??
    item.updatedAt ??
    item.createdAt
  );
};

export const formatContentDate = (value) => {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

export const normalizeApiContent = (content) => {
  return (content ?? []).map((item) => ({
    ...item,
    tags: getLimitedContentTags(item.tags),
    lastReviewedAt: getContentReviewDate(item),
    assignedReviewer: item.assignedReviewer ?? "",
    isArchived: Boolean(item.isArchived),
    isPinned: Boolean(item.isPinned),
    date: formatContentDate(item.createdAt),
    source: "api",
  }));
};

export const isAllowedMediaType = (file, activeTab) => {
  if (!file) return true;

  return (UPLOAD_RULES[activeTab]?.allowedTypes ?? []).some((allowedType) =>
    file.type.startsWith(allowedType)
  );
};

export const getContentFormValidationError = (formData, contentTypeLabel) => {
  if (!formData.title.trim()) {
    return "Please enter a title";
  }

  if (!formData.description.trim()) {
    return "Please enter a description";
  }

  if (contentTypeLabel !== "Infographics") {
    const selectedLanguages = getLimitedContentTags(formData.tags);

    if (selectedLanguages.length === 0) {
      return "Please select at least one language";
    }

    if (selectedLanguages.length > HEALTH_LITERACY_LANGUAGE_LIMIT) {
      return `Please select up to ${HEALTH_LITERACY_LANGUAGE_LIMIT} languages only`;
    }
  }

  if (
    formData.media &&
    !isAllowedMediaType(formData.media, contentTypeLabel)
  ) {
    return `${contentTypeLabel} does not accept this file type`;
  }

  if (formData.isFactCheck && !formData.claim.trim()) {
    return "Please enter the fact-check claim";
  }

  return null;
};

export const getContentLabel = (activeTab) => activeTab.slice(0, -1);
