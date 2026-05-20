/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { toPng } from "html-to-image";
import Input from "../../components/Input";
import Icon from "../../components/Icon";
import Snackbar from "../../components/Snackbar";
import ModalWithBody from "../../components/admin/ModalWithBody";
import RegionsData from "../../assets/data/regions.json";
import {
  useCreateHealthLiteracyContentMutation,
  useCreateHealthLiteracyAnalyticsEventMutation,
  useFetchHealthLiteracyAnalyticsOverviewQuery,
  useFetchHealthLiteracyContentQuery,
  useUpdateHealthLiteracyContentMutation,
} from "../../features/api/healthLiteracyHubSlice";

const TAB_CONTENT_TYPES = {
  Articles: "articles",
  Videos: "videos",
  Infographics: "infographics",
};

const UPLOAD_RULES = {
  Articles: {
    label: "Media Upload (Image/Video)",
    accept: "image/*,video/*",
    helperText: "JPG, PNG, GIF, WEBP, MP4, MOV",
    allowedTypes: ["image/", "video/"],
  },
  Infographics: {
    label: "Image Upload",
    accept: "image/*",
    helperText: "JPG, PNG, GIF, WEBP",
    allowedTypes: ["image/"],
  },
  Videos: {
    label: "Video Upload",
    accept: "video/*",
    helperText: "MP4, MOV, WEBM",
    allowedTypes: ["video/"],
  },
};

const INITIAL_FORM_DATA = {
  title: "",
  description: "",
  tags: "",
  media: null,
  mediaPreview: null,
  existingMedia: null,
  removeMedia: false,
  publishToMobile: false,
  publishToWebsite: false,
};

const MOCK_ARTICLES = [
  {
    id: 1,
    title: "Understanding Hypertension",
    description:
      "Learn about high blood pressure and its management strategies to maintain a healthy lifestyle",
    tags: ["health", "hypertension", "prevention"],
    thumbnail: "article1.jpg",
    date: "May 10, 2026",
  },
  {
    id: 2,
    title: "Diabetes Prevention Guide",
    description:
      "Comprehensive guide to preventing type 2 diabetes through diet, exercise, and lifestyle changes",
    tags: ["diabetes", "nutrition", "lifestyle"],
    thumbnail: "article2.jpg",
    date: "May 08, 2026",
  },
  {
    id: 3,
    title: "Mental Health Awareness",
    description:
      "Breaking stigma and understanding mental health conditions and available support resources",
    tags: ["mental-health", "awareness", "wellness"],
    thumbnail: "article3.jpg",
    date: "May 05, 2026",
  },
  {
    id: 4,
    title: "COVID-19 Prevention",
    description:
      "Latest guidelines on preventing COVID-19 transmission and staying protected",
    tags: ["covid", "prevention", "health"],
    thumbnail: "article4.jpg",
    date: "May 01, 2026",
  },
];

const MOCK_VIDEOS = [
  {
    id: 1,
    title: "Exercise Routines for Seniors",
    description:
      "Safe and effective exercises designed specifically for elderly individuals to improve mobility",
    tags: ["exercise", "seniors", "fitness"],
    thumbnail: "video1.jpg",
    duration: "12:35",
  },
  {
    id: 2,
    title: "Nutrition Basics",
    description:
      "Learn about balanced diet and nutrition fundamentals for optimal health and wellness",
    tags: ["nutrition", "diet", "health"],
    thumbnail: "video2.jpg",
    duration: "18:42",
  },
  {
    id: 3,
    title: "Stress Management Techniques",
    description:
      "Practical techniques to manage stress and improve mental well-being in daily life",
    tags: ["stress", "mental-health", "wellness"],
    thumbnail: "video3.jpg",
    duration: "15:20",
  },
];

const MOCK_INFOGRAPHICS = [
  {
    id: 1,
    title: "COVID-19 Prevention Steps",
    description:
      "Visual guide to preventing COVID-19 transmission through proper hygiene and safety measures",
    tags: ["covid", "prevention", "health"],
    thumbnail: "infographic1.jpg",
  },
  {
    id: 2,
    title: "Food Pyramid Guide",
    description:
      "Understanding the food pyramid and recommended serving sizes for each food group",
    tags: ["nutrition", "diet", "visual"],
    thumbnail: "infographic2.jpg",
  },
  {
    id: 3,
    title: "Signs of Stroke",
    description:
      "Recognize the early warning signs of stroke to seek immediate medical attention",
    tags: ["emergency", "health", "awareness"],
    thumbnail: "infographic3.jpg",
  },
];

const MOCK_CONTENT_BY_TAB = {
  Articles: MOCK_ARTICLES,
  Videos: MOCK_VIDEOS,
  Infographics: MOCK_INFOGRAPHICS,
};

const ILLUSTRATIONS = [
  {
    id: 1,
    title: "Educational Content",
    icon: "BookOpen",
    description: "Access curated health education materials",
  },
  {
    id: 2,
    title: "Multilingual Resources",
    icon: "Globe",
    description: "Content available in multiple languages",
  },
  {
    id: 3,
    title: "Community Q&A",
    icon: "MessageCircle",
    description: "Ask and answer health-related questions",
  },
];

const ANALYTICS_TABS = [
  { id: "overview", label: "Overview" },
  { id: "content-performance", label: "Content Performance" },
  { id: "search-topic", label: "Search and Topic Analysis" },
  { id: "helpful", label: "Helpful/Not Helpful Analytics" },
  { id: "fact-check", label: "Fact-Check Usage Analytics" },
  { id: "regional-usage", label: "Regional Usage" },
  { id: "review-queue", label: "Review Queue" },
];

const ANALYTICS_TIME_RANGES = [
  { value: "last-7-days", label: "Last 7 days", days: 7 },
  { value: "last-30-days", label: "Last 30 days", days: 30 },
  { value: "last-90-days", label: "Last 90 days", days: 90 },
  { value: "all-time", label: "All time", days: null },
];

const ANALYTICS_CONTENT_FILTERS = [
  { value: "all", label: "All content" },
  { value: "Articles", label: "Articles" },
  { value: "Videos", label: "Videos" },
  { value: "Infographics", label: "Infographics" },
];

const ANALYTICS_REGIONS = RegionsData.regions;

const HEALTH_LITERACY_VISITOR_ID_KEY = "healthLiteracyVisitorId";

const DEFAULT_ANALYTICS_OVERVIEW = {
  peopleReached: 0,
  uniqueVisitors: 0,
  topSearchTopic: {
    topic: "No searches yet",
    searches: 0,
  },
  helpfulScore: 0,
  needsReview: 0,
  reportsExported: 0,
};

const REVIEW_SOON_AFTER_DAYS = 150;
const REVIEW_OVERDUE_AFTER_DAYS = 180;
const LOW_HELPFUL_SCORE_THRESHOLD = 60;
const PROMOTE_HELPFUL_SCORE_THRESHOLD = 80;
const PROMOTE_VIEWS_THRESHOLD = 500;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const SEARCH_TOPIC_STOP_WORDS = new Set([
  "and",
  "are",
  "for",
  "from",
  "has",
  "have",
  "how",
  "the",
  "what",
  "when",
  "where",
  "with",
]);

const MOCK_SEARCH_TOPIC_ANALYTICS = [
  {
    term: "diabetes symptoms",
    topic: "Diabetes",
    contentType: "Articles",
    region: "NCR",
    searchCount: 684,
    zeroResults: 18,
    resultFound: true,
    resultClicked: true,
    suggestedAction: "Refresh diabetes symptom content and add common search phrases to tags.",
    date: "2026-05-18",
  },
  {
    term: "hypertension diet",
    topic: "Hypertension",
    contentType: "Articles",
    region: "IVA",
    searchCount: 571,
    zeroResults: 12,
    resultFound: true,
    resultClicked: true,
    suggestedAction: "Add diet-focused links or summaries to hypertension content.",
    date: "2026-05-16",
  },
  {
    term: "mental health hotline",
    topic: "Mental Health",
    contentType: "Infographics",
    region: "VII",
    searchCount: 436,
    zeroResults: 31,
    resultFound: true,
    resultClicked: false,
    suggestedAction: "Create or improve hotline content with clear emergency contact details.",
    date: "2026-05-13",
  },
  {
    term: "covid prevention",
    topic: "COVID-19",
    contentType: "Videos",
    region: "III",
    searchCount: 398,
    zeroResults: 9,
    resultFound: true,
    resultClicked: true,
    suggestedAction: "Keep prevention guidance current and promote the most useful video.",
    date: "2026-05-10",
  },
  {
    term: "stroke warning signs",
    topic: "Emergency Care",
    contentType: "Infographics",
    region: "VI",
    searchCount: 284,
    zeroResults: 7,
    resultFound: true,
    resultClicked: true,
    suggestedAction: "Add stroke warning signs to emergency care tags and related content.",
    date: "2026-05-04",
  },
];

const MOCK_FACT_CHECK_ANALYTICS = [
  {
    claim: "Garlic water can cure high blood pressure",
    topic: "Hypertension",
    contentType: "Articles",
    region: "NCR",
    checks: 248,
    verified: 92,
    needsReview: 14,
    date: "2026-05-18",
  },
  {
    claim: "Skipping meals prevents diabetes",
    topic: "Diabetes",
    contentType: "Articles",
    region: "IVA",
    checks: 204,
    verified: 84,
    needsReview: 21,
    date: "2026-05-15",
  },
  {
    claim: "Antibiotics treat common colds",
    topic: "Respiratory Illness",
    contentType: "Videos",
    region: "VII",
    checks: 186,
    verified: 79,
    needsReview: 18,
    date: "2026-05-12",
  },
  {
    claim: "All chest pain means a heart attack",
    topic: "Emergency Care",
    contentType: "Infographics",
    region: "III",
    checks: 143,
    verified: 88,
    needsReview: 9,
    date: "2026-05-07",
  },
];

const getAnalyticsSeed = (value) => {
  return String(value ?? "")
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);
};

const getAnalyticsRegionValue = (contentType, item, index = 0) => {
  const seed = getAnalyticsSeed(`${contentType}-${item.id}-${item.title}`);
  return ANALYTICS_REGIONS[(seed + index) % ANALYTICS_REGIONS.length]?.value ?? "all";
};

const getHealthLiteracyVisitorId = (userId) => {
  if (userId) return String(userId);

  if (typeof window === "undefined") return "anonymous";

  const existingVisitorId = window.localStorage.getItem(
    HEALTH_LITERACY_VISITOR_ID_KEY
  );

  if (existingVisitorId) return existingVisitorId;

  const visitorId =
    window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  window.localStorage.setItem(HEALTH_LITERACY_VISITOR_ID_KEY, visitorId);
  return visitorId;
};

const formatNumber = (value) => {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
};

const formatPercent = (value) => {
  return `${Math.round(value ?? 0)}%`;
};

const getAnalyticsCellText = (value) => {
  if (value && typeof value === "object") {
    return value.csvValue ?? value.label ?? value.title ?? "";
  }

  return value ?? "";
};

const escapeCsvValue = (value) => {
  const text = String(getAnalyticsCellText(value) ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const slugify = (value) => {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

const getFilterLabel = (options, value) => {
  return options.find((option) => option.value === value)?.label ?? value;
};

const getRegionLabel = (value) => {
  if (value === "all") return "All regions";
  return ANALYTICS_REGIONS.find((region) => region.value === value)?.label ?? value;
};

const getRangeStartDate = (timeRange) => {
  const selectedRange = ANALYTICS_TIME_RANGES.find(
    (range) => range.value === timeRange
  );

  if (!selectedRange?.days) return null;

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - selectedRange.days + 1);
  return startDate;
};

const isWithinTimeRange = (dateValue, timeRange) => {
  const startDate = getRangeStartDate(timeRange);
  if (!startDate || !dateValue) return true;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return true;

  return date >= startDate;
};

const truncateContentDescription = (value, maxLength = 50) => {
  const description = String(value ?? "").trim();

  if (description.length <= maxLength) return description;

  return `${description.slice(0, maxLength).trimEnd()}....`;
};

const formatTopicLabel = (value) => {
  return String(value ?? "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getContentTopic = (item) => {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const topicLabels = tags.slice(0, 2).map(formatTopicLabel).filter(Boolean);

  if (topicLabels.length === 0) return "Uncategorized";

  return tags.length > 2
    ? `${topicLabels.join(", ")}....`
    : topicLabels.join(", ");
};

const getContentHelpfulScore = (item) => {
  const totalFeedback = Number(item.helpful ?? 0) + Number(item.notHelpful ?? 0);

  if (totalFeedback <= 0) return 0;

  return (Number(item.helpful ?? 0) / totalFeedback) * 100;
};

const getContentShares = (item) => {
  return Number(
    item.shares ??
      item.shareCount ??
      item.sharesCount ??
      item.analytics?.shares ??
      item.metrics?.shares ??
      0
  );
};

const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const getReviewDateValue = (item, fallbackIndex = 0) => {
  const explicitReviewDate = getContentReviewDate(item);

  if (explicitReviewDate) return explicitReviewDate;

  const seed = getAnalyticsSeed(`${item.contentType}-${item.id}-${item.title}`);

  if ((seed + fallbackIndex) % 9 === 0) return null;

  const daysAgoOptions = [45, 116, 154, 176, 194, 223];
  const daysAgo = daysAgoOptions[(seed + fallbackIndex) % daysAgoOptions.length];
  return addDays(new Date(), -daysAgo).toISOString();
};

const formatReviewDate = (value) => {
  if (!value) return "No review date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No review date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const getContentReviewDate = (item) => {
  return (
    item.lastReviewedAt ??
    item.lastReviewed ??
    item.reviewedAt ??
    item.reviewDate ??
    item.updatedAt ??
    item.createdAt
  );
};

const getNextReviewDueDate = (lastReviewedAt) => {
  if (!lastReviewedAt) return null;

  const date = new Date(lastReviewedAt);
  if (Number.isNaN(date.getTime())) return null;

  return addDays(date, REVIEW_OVERDUE_AFTER_DAYS).toISOString();
};

const getDaysSinceReview = (lastReviewedAt) => {
  if (!lastReviewedAt) return null;

  const date = new Date(lastReviewedAt);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return Math.floor((today.getTime() - date.getTime()) / DAY_IN_MS);
};

const getReviewStatus = ({ lastReviewedAt, helpfulScore, views }) => {
  const daysSinceReview = getDaysSinceReview(lastReviewedAt);

  if (daysSinceReview === null) return "Needs Review";
  if (helpfulScore < LOW_HELPFUL_SCORE_THRESHOLD) return "Improve";
  if (daysSinceReview > REVIEW_OVERDUE_AFTER_DAYS) return "Overdue";
  if (daysSinceReview > REVIEW_SOON_AFTER_DAYS) return "Review Soon";
  if (
    helpfulScore >= PROMOTE_HELPFUL_SCORE_THRESHOLD &&
    Number(views ?? 0) < PROMOTE_VIEWS_THRESHOLD
  ) {
    return "Promote";
  }

  return "Good";
};

const STATUS_STYLES = {
  Good: "bg-[#E7F6EF] text-[#166534] border-[#BBE8D2]",
  "Review Soon": "bg-[#FFF7E6] text-[#92400E] border-[#F8D8A6]",
  Overdue: "bg-[#FEECEC] text-[#B42318] border-[#F8B4B4]",
  "Needs Review": "bg-[#EEF2F6] text-[#475467] border-[#D0D5DD]",
  Improve: "bg-[#FDEAF2] text-[#A2145B] border-[#F8B5D0]",
  Promote: "bg-[#EAF3FF] text-[#175CD3] border-[#B8D7FF]",
};

const buildContentPerformanceRows = (rows) => {
  return rows
    .slice()
    .sort((a, b) => b.views - a.views)
    .map((item, index) => {
      const helpfulScore = getContentHelpfulScore(item);
      const lastReviewedAt = getReviewDateValue(item, index);
      const nextReviewDue = getNextReviewDueDate(lastReviewedAt);
      const status = getReviewStatus({
        lastReviewedAt,
        helpfulScore,
        views: item.views,
      });
      const contentTitle = item.title || "Untitled content";
      const contentDescription = truncateContentDescription(item.description);

      return [
        {
          type: "content",
          title: contentTitle,
          description: contentDescription,
          csvValue: contentDescription
            ? `${contentTitle} - ${contentDescription}`
            : contentTitle,
        },
        item.contentType,
        getContentTopic(item),
        formatNumber(item.views),
        formatPercent(helpfulScore),
        formatNumber(getContentShares(item)),
        formatReviewDate(lastReviewedAt),
        nextReviewDue ? formatReviewDate(nextReviewDue) : "Not scheduled",
        {
          type: "status",
          label: status,
          csvValue: status,
          className: STATUS_STYLES[status] ?? STATUS_STYLES["Needs Review"],
        },
      ];
    });
};

const downloadCsv = ({ filename, title, filters, columns, rows }) => {
  const headerRows = [
    [title],
    [`Generated: ${new Date().toLocaleString()}`],
    [`Time Range: ${filters.timeRange}`],
    [`Content Type: ${filters.contentType}`],
    [`Region: ${filters.region}`],
    [],
    columns,
  ];

  const csvContent = [...headerRows, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");

  const element = document.createElement("a");
  element.setAttribute(
    "href",
    `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`
  );
  element.setAttribute("download", filename);
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

const normalizeContentForAnalytics = (content, contentType) => {
  return normalizeApiContent(content).map((item, index) => {
    const seed = getAnalyticsSeed(`${contentType}-${item.id}-${item.title}`);
    const lastReviewedAt = getContentReviewDate(item);

    return {
      ...item,
      contentType,
      region: getAnalyticsRegionValue(contentType, item),
      lastReviewedAt,
      analyticsDate: lastReviewedAt ?? "2026-05-18",
      views: 420 + seed * 3 + index * 64,
      clicks: 92 + (seed % 180) + index * 17,
      completions: 58 + (seed % 120) + index * 12,
      helpful: 34 + (seed % 84),
      notHelpful: 4 + (seed % 22),
      shares: getContentShares(item),
      factChecks: 12 + (seed % 52),
    };
  });
};

const normalizeMockContentForAnalytics = (content, contentType) => {
  return (content ?? []).map((item, index) => {
    const seed = getAnalyticsSeed(`${contentType}-${item.id}-${item.title}`);

    return {
      ...item,
      source: "mock",
      contentType,
      region: getAnalyticsRegionValue(contentType, item, index),
      analyticsDate: item.date ? new Date(item.date).toISOString() : "2026-05-12",
      publishToMobile: index % 2 === 0,
      publishToWebsite: true,
      views: 510 + seed * 2 + index * 81,
      clicks: 118 + (seed % 210) + index * 25,
      completions: 78 + (seed % 160) + index * 18,
      helpful: 44 + (seed % 92),
      notHelpful: 5 + (seed % 24),
      shares: 18 + (seed % 86) + index * 9,
      factChecks: 14 + (seed % 48),
    };
  });
};

const contentHasMedia = (item) => {
  return Boolean(item.media?.dataUrl || item.media || item.thumbnail);
};

const getReviewIssues = (item) => {
  const issues = [];

  if (!String(item.title ?? "").trim()) issues.push("Missing title");
  if (!String(item.description ?? "").trim()) issues.push("Missing description");
  if (!contentHasMedia(item)) issues.push("Missing media");
  if (!item.publishToMobile && !item.publishToWebsite) {
    issues.push("No publish target");
  }

  return issues;
};

const filterAnalyticsRows = (rows, filters) => {
  return rows.filter((row) => {
    const matchesType =
      filters.contentType === "all" || row.contentType === filters.contentType;
    const matchesRegion = filters.region === "all" || row.region === filters.region;
    const matchesDate = isWithinTimeRange(row.analyticsDate ?? row.date, filters.timeRange);

    return matchesType && matchesRegion && matchesDate;
  });
};

const parseAnalyticsBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();
    if (["yes", "true", "found", "clicked", "1"].includes(normalizedValue)) {
      return true;
    }
    if (["no", "false", "none", "not found", "not clicked", "0"].includes(normalizedValue)) {
      return false;
    }
  }

  return fallback;
};

const getSearchTopicSuggestedAction = (item) => {
  if (!item.resultFound) {
    return `Create content for "${item.term}" and add matching tags.`;
  }

  if (!item.resultClicked) {
    return `Improve titles, descriptions, and tags for "${item.term}" so users can find the right content.`;
  }

  return `Maintain existing content for "${item.term}" and keep it updated.`;
};

const normalizeSearchTopicAnalyticsRows = (apiRows = []) => {
  const sourceRows = apiRows.length > 0 ? apiRows : MOCK_SEARCH_TOPIC_ANALYTICS;

  return sourceRows.map((item) => {
    const searchCount = Number(
      item.searchCount ?? item.searches ?? item.count ?? item.totalSearches ?? 0
    );
    const zeroResults = Number(item.zeroResults ?? 0);
    const resultFound = parseAnalyticsBoolean(
      item.resultFound ?? item.result_found,
      searchCount > zeroResults
    );
    const resultClicked = parseAnalyticsBoolean(
      item.resultClicked ?? item.result_clicked ?? item.clicked,
      Number(item.clicks ?? 0) > 0 || Number(item.clickThroughRate ?? 0) > 0
    );
    const normalizedItem = {
      term: item.term ?? item.searchTerm ?? item.search_term ?? "Unknown search",
      topic: item.topic ?? item.searchTopic ?? item.search_topic ?? item.term,
      contentType: item.contentType ?? item.content_type ?? "all",
      region: item.region ?? "all",
      searchCount,
      resultFound,
      resultClicked,
      analyticsDate: item.analyticsDate ?? item.date ?? item.createdAt,
      suggestedAction: item.suggestedAction ?? item.suggested_action,
    };

    return {
      ...normalizedItem,
      suggestedAction:
        normalizedItem.suggestedAction ??
        getSearchTopicSuggestedAction(normalizedItem),
    };
  });
};

const tokenizeSearchTopic = (value) => {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length > 2 && !SEARCH_TOPIC_STOP_WORDS.has(token)
    );
};

const getRelatedContentMatches = (searchItem, contentRows, limit = 5) => {
  const searchTokens = new Set(
    tokenizeSearchTopic(`${searchItem.term} ${searchItem.topic}`)
  );

  if (searchTokens.size === 0) return [];

  return contentRows
    .map((item) => {
      const tagTokens = (item.tags ?? []).flatMap(tokenizeSearchTopic);
      const titleTokens = tokenizeSearchTopic(item.title);
      const descriptionTokens = tokenizeSearchTopic(item.description);
      const tagMatches = tagTokens.filter((token) => searchTokens.has(token));
      const titleMatches = titleTokens.filter((token) => searchTokens.has(token));
      const descriptionMatches = descriptionTokens.filter((token) =>
        searchTokens.has(token)
      );
      const score =
        tagMatches.length * 3 + titleMatches.length * 2 + descriptionMatches.length;

      return {
        id: item.id,
        title: item.title || "Untitled content",
        description: truncateContentDescription(item.description, 96),
        contentType: item.contentType,
        tags: item.tags ?? [],
        score,
        matchedTags: [...new Set(tagMatches)],
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
};

const buildTopSearchTopicItems = (rows) => {
  const topicTotals = rows.reduce((totals, row) => {
    const label = row.topic || row.term;
    totals[label] = (totals[label] ?? 0) + Number(row.searchCount ?? 0);
    return totals;
  }, {});

  return Object.entries(topicTotals)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
};

const buildSearchTopicReportRows = (searchRows, contentRows) => {
  return searchRows.map((item) => {
    const relatedContent = getRelatedContentMatches(item, contentRows);

    return [
      item.term,
      formatNumber(item.searchCount),
      getRegionLabel(item.region),
      {
        type: "result-status",
        label: item.resultFound ? "Found" : "Not Found",
        csvValue: item.resultFound ? "Found" : "Not Found",
        className: item.resultFound
          ? "bg-[#E7F6EF] text-[#166534] border-[#BBE8D2]"
          : "bg-[#FEECEC] text-[#B42318] border-[#F8B4B4]",
      },
      {
        type: "result-status",
        label: item.resultClicked ? "Clicked" : "Not Clicked",
        csvValue: item.resultClicked ? "Clicked" : "Not Clicked",
        className: item.resultClicked
          ? "bg-[#EAF3FF] text-[#175CD3] border-[#B8D7FF]"
          : "bg-[#FFF7E6] text-[#92400E] border-[#F8D8A6]",
      },
      {
        type: "related-content",
        label:
          relatedContent.length > 0
            ? `View ${relatedContent.length}`
            : "No Matches",
        csvValue:
          relatedContent.length > 0
            ? relatedContent.map((content) => content.title).join("; ")
            : "No matches",
        disabled: relatedContent.length === 0,
        searchTerm: item.term,
        matches: relatedContent,
      },
      item.suggestedAction,
    ];
  });
};

const sumBy = (rows, key) => {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
};

const buildRegionalUsageRows = (rows, regionFilter = "all") => {
  return ANALYTICS_REGIONS.filter(
    (region) => regionFilter === "all" || region.value === regionFilter
  ).map((region, index) => {
    const regionRows = rows.filter((row) => row.region === region.value);
    const baseSessions = 320 + index * 29;
    const views = sumBy(regionRows, "views");

    return {
      region: region.label,
      regionValue: region.value,
      contentItems: regionRows.length,
      sessions: baseSessions + Math.round(views / 16),
      views,
      helpfulRate:
        sumBy(regionRows, "helpful") + sumBy(regionRows, "notHelpful") > 0
          ? (sumBy(regionRows, "helpful") /
              (sumBy(regionRows, "helpful") + sumBy(regionRows, "notHelpful"))) *
            100
          : 0,
    };
  }).filter((row) => row.contentItems > 0 || row.sessions > 0);
};

const buildReviewQueueRows = (rows) => {
  return rows
    .map((item) => ({
      title: item.title || "Untitled content",
      contentType: item.contentType,
      region: getRegionLabel(item.region),
      issues: getReviewIssues(item),
      source: item.source === "api" ? "Live content" : "Mock content",
    }))
    .filter((item) => item.issues.length > 0);
};

const buildAnalyticsReport = ({
  activeTab,
  rows,
  filters,
  overviewAnalytics = DEFAULT_ANALYTICS_OVERVIEW,
}) => {
  const filterLabels = {
    timeRange: getFilterLabel(ANALYTICS_TIME_RANGES, filters.timeRange),
    contentType: getFilterLabel(ANALYTICS_CONTENT_FILTERS, filters.contentType),
    region: getRegionLabel(filters.region),
  };
  const overview = {
    ...DEFAULT_ANALYTICS_OVERVIEW,
    ...overviewAnalytics,
    topSearchTopic: {
      ...DEFAULT_ANALYTICS_OVERVIEW.topSearchTopic,
      ...overviewAnalytics?.topSearchTopic,
    },
  };
  const regionalRows = buildRegionalUsageRows(rows, filters.region);
  const reviewRows = buildReviewQueueRows(rows);
  const searchRows = filterAnalyticsRows(normalizeSearchTopicAnalyticsRows(), filters);
  const factRows = filterAnalyticsRows(MOCK_FACT_CHECK_ANALYTICS, filters);

  if (activeTab === "content-performance") {
    return {
      columns: [
        "Content",
        "Type",
        "Topic",
        "Views",
        "Helpful Score",
        "Shares",
        "Last Reviewed",
        "Next Review Due",
        "Status",
      ],
      rows: buildContentPerformanceRows(rows),
      filterLabels,
    };
  }

  if (activeTab === "search-topic") {
    return {
      columns: [
        "Search Term",
        "Search Count",
        "Region",
        "Result Found",
        "Result Clicked",
        "Related Content",
        "Suggested Action",
      ],
      rows: buildSearchTopicReportRows(searchRows, rows),
      filterLabels,
    };
  }

  if (activeTab === "helpful") {
    return {
      columns: ["Title", "Type", "Region", "Helpful", "Not Helpful", "Helpful Rate"],
      rows: rows.map((item) => [
        item.title,
        item.contentType,
        getRegionLabel(item.region),
        item.helpful,
        item.notHelpful,
        formatPercent(
          (item.helpful / Math.max(item.helpful + item.notHelpful, 1)) * 100
        ),
      ]),
      filterLabels,
    };
  }

  if (activeTab === "fact-check") {
    return {
      columns: ["Claim", "Topic", "Type", "Region", "Checks", "Verified", "Needs Review"],
      rows: factRows.map((item) => [
        item.claim,
        item.topic,
        item.contentType,
        getRegionLabel(item.region),
        item.checks,
        `${item.verified}%`,
        item.needsReview,
      ]),
      filterLabels,
    };
  }

  if (activeTab === "regional-usage") {
    return {
      columns: ["Region", "Content Items", "Sessions", "Views", "Helpful Rate"],
      rows: regionalRows.map((item) => [
        item.region,
        item.contentItems,
        item.sessions,
        item.views,
        formatPercent(item.helpfulRate),
      ]),
      filterLabels,
    };
  }

  if (activeTab === "review-queue") {
    return {
      columns: ["Title", "Type", "Region", "Source", "Issues"],
      rows: reviewRows.map((item) => [
        item.title,
        item.contentType,
        item.region,
        item.source,
        item.issues.join("; "),
      ]),
      filterLabels,
    };
  }

  return {
    columns: ["Metric", "Value", "Details"],
    rows: [
      [
        "People Reached",
        formatNumber(overview.peopleReached),
        "Health Literacy Hub content opened",
      ],
      [
        "Unique Visitors",
        formatNumber(overview.uniqueVisitors),
        "Distinct audience members reached",
      ],
      [
        "Top Search Topic",
        overview.topSearchTopic.topic,
        `${formatNumber(overview.topSearchTopic.searches)} searches`,
      ],
      [
        "Helpful Score",
        formatPercent(overview.helpfulScore),
        "Helpful votes divided by total feedback",
      ],
      [
        "Needs Review",
        formatNumber(overview.needsReview),
        "Content missing review-ready details",
      ],
      [
        "Reports Exported",
        formatNumber(overview.reportsExported),
        "PDF and CSV report exports",
      ],
    ],
    filterLabels,
  };
};

const showToast = ({ color, iconName, message }) => {
  toast(
    <Snackbar
      iconName={iconName}
      size="snackbar-sm"
      color={color}
      message={message}
    />,
    {
      closeButton: ({ closeToast }) => (
        <Icon
          iconName="Close"
          className={`close-icon close-icon-sm close-${color}`}
          onClick={closeToast}
        />
      ),
    }
  );
};

const formatContentDate = (value) => {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const normalizeApiContent = (content) => {
  return (content ?? []).map((item) => ({
    ...item,
    tags: Array.isArray(item.tags) ? item.tags : [],
    lastReviewedAt: getContentReviewDate(item),
    date: formatContentDate(item.createdAt),
    source: "api",
  }));
};

const isAllowedMediaType = (file, activeTab) => {
  if (!file) return true;

  return UPLOAD_RULES[activeTab].allowedTypes.some((allowedType) =>
    file.type.startsWith(allowedType)
  );
};

const getContentLabel = (activeTab) => activeTab.slice(0, -1);

const HealthLiteracyHub = () => {
  const user = useSelector((state) => state.auth.user);
  const [activeTab, setActiveTab] = useState("Articles");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMediaContent, setSelectedMediaContent] = useState(null);
  const [editingContent, setEditingContent] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const contentType = TAB_CONTENT_TYPES[activeTab];
  const shouldFetchContent = Boolean(contentType);

  const {
    data: fetchedContent = [],
    isFetching: isFetchingContent,
  } = useFetchHealthLiteracyContentQuery(contentType, {
    skip: !shouldFetchContent,
  });

  const [
    createHealthLiteracyContent,
    { isLoading: isCreatingContent },
  ] = useCreateHealthLiteracyContentMutation();

  const [
    updateHealthLiteracyContent,
    { isLoading: isUpdatingContent },
  ] = useUpdateHealthLiteracyContentMutation();
  const [createHealthLiteracyAnalyticsEvent] =
    useCreateHealthLiteracyAnalyticsEventMutation();

  const uploadRule = UPLOAD_RULES[activeTab] ?? UPLOAD_RULES.Articles;

  useEffect(() => {
    const topic = searchQuery.trim();

    if (!contentType || topic.length < 2) return undefined;

    const timeoutId = window.setTimeout(() => {
      createHealthLiteracyAnalyticsEvent({
        eventType: "search",
        contentType: activeTab,
        region: "all",
        topic,
        visitorId: getHealthLiteracyVisitorId(user?.id),
      }).catch(() => {});
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [
    activeTab,
    contentType,
    createHealthLiteracyAnalyticsEvent,
    searchQuery,
    user?.id,
  ]);

  const resetForm = () => {
    setFormData(INITIAL_FORM_DATA);
  };

  const filterContent = (content) => {
    if (!searchQuery) return content;

    const searchTerms = searchQuery
      .toLowerCase()
      .split(" ")
      .filter((term) => term.length > 0);

    return content.filter((item) => {
      const searchableText = `${item.title} ${item.description} ${
        item.tags ? item.tags.join(" ") : ""
      }`.toLowerCase();

      return searchTerms.some((term) => searchableText.includes(term));
    });
  };

  const handleCreateClick = () => {
    resetForm();
    setEditingContent(null);
    setIsCreateModalOpen(true);
  };

  const handleEditClick = (item) => {
    if (item.source !== "api") return;

    setEditingContent(item);
    setFormData({
      title: item.title ?? "",
      description: item.description ?? "",
      tags: (item.tags ?? []).join(", "),
      media: null,
      mediaPreview: item.media?.dataUrl ?? null,
      existingMedia: item.media ?? null,
      removeMedia: false,
      publishToMobile: Boolean(item.publishToMobile),
      publishToWebsite: Boolean(item.publishToWebsite),
    });
    setIsEditModalOpen(true);
  };

  const handleMediaPreviewClick = (item) => {
    if (!item.media?.dataUrl) return;

    createHealthLiteracyAnalyticsEvent({
      eventType: "content_opened",
      contentId: item.id ? String(item.id) : undefined,
      contentTitle: item.title,
      contentType: activeTab,
      region: item.region ?? getAnalyticsRegionValue(activeTab, item),
      visitorId: getHealthLiteracyVisitorId(user?.id),
    }).catch(() => {});

    setSelectedMediaContent({
      title: item.title,
      description: item.description,
      media: item.media,
      publishToMobile: item.publishToMobile,
      publishToWebsite: item.publishToWebsite,
    });
  };

  const handleMediaPreviewClose = () => {
    setSelectedMediaContent(null);
  };

  const buildContentPayload = ({ includeRemoveMedia = false } = {}) => {
    const payload = new FormData();
    payload.append("title", formData.title);
    payload.append("description", formData.description);
    payload.append(
      "tags",
      JSON.stringify(
        formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    );
    payload.append("publishToMobile", String(formData.publishToMobile));
    payload.append("publishToWebsite", String(formData.publishToWebsite));

    if (includeRemoveMedia) {
      payload.append("removeMedia", String(formData.removeMedia));
    }

    if (formData.media) {
      payload.append("file", formData.media);
    }

    return payload;
  };

  const handleCreateSubmit = async () => {
    if (!formData.title.trim()) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: "Please enter a title",
      });
      return;
    }

    if (!formData.description.trim()) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: "Please enter a description",
      });
      return;
    }

    if (formData.media && !isAllowedMediaType(formData.media, activeTab)) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: `${activeTab} does not accept this file type`,
      });
      return;
    }

    try {
      await createHealthLiteracyContent({
        contentType,
        data: buildContentPayload(),
      }).unwrap();

      showToast({
        iconName: "CheckCircle",
        color: "success",
        message: `New ${getContentLabel(activeTab)} created successfully`,
      });

      setIsCreateModalOpen(false);
      resetForm();
    } catch (error) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message:
          error?.data?.detail ??
          `Failed to create ${getContentLabel(activeTab).toLowerCase()}`,
      });
    }
  };

  const handleEditSubmit = async () => {
    if (!editingContent) return;

    if (!formData.title.trim()) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: "Please enter a title",
      });
      return;
    }

    if (!formData.description.trim()) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: "Please enter a description",
      });
      return;
    }

    if (formData.media && !isAllowedMediaType(formData.media, activeTab)) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: `${activeTab} does not accept this file type`,
      });
      return;
    }

    try {
      await updateHealthLiteracyContent({
        contentType,
        contentId: editingContent.id,
        data: buildContentPayload({ includeRemoveMedia: true }),
      }).unwrap();

      showToast({
        iconName: "CheckCircle",
        color: "success",
        message: `${getContentLabel(activeTab)} updated successfully`,
      });

      setIsEditModalOpen(false);
      setEditingContent(null);
      resetForm();
    } catch (error) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message:
          error?.data?.detail ??
          `Failed to update ${getContentLabel(activeTab).toLowerCase()}`,
      });
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const setMediaFile = (file) => {
    if (!file) return;

    if (!isAllowedMediaType(file, activeTab)) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: `${activeTab} does not accept this file type`,
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({
        ...prev,
        media: file,
        mediaPreview: reader.result,
        existingMedia: null,
        removeMedia: false,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleMediaChange = (e) => {
    const file = e.target.files?.[0];
    setMediaFile(file);
    e.target.value = "";
  };

  const handleMediaDrop = (e) => {
    e.preventDefault();
    setMediaFile(e.dataTransfer.files?.[0]);
  };

  const handleRemoveMedia = () => {
    setFormData((prev) => ({
      ...prev,
      media: null,
      mediaPreview: null,
      existingMedia: null,
      removeMedia: Boolean(isEditModalOpen),
    }));
  };

  const getFilteredContent = () => {
    if (activeTab === "HealthLiteracyAnalytics") return [];

    const apiContent = normalizeApiContent(fetchedContent).map((item) => ({
      ...item,
      contentType: activeTab,
      region: getAnalyticsRegionValue(activeTab, item),
    }));
    const mockContent = (MOCK_CONTENT_BY_TAB[activeTab] ?? []).map((item, index) => ({
      ...item,
      contentType: activeTab,
      region: getAnalyticsRegionValue(activeTab, item, index),
    }));

    return filterContent([...apiContent, ...mockContent]);
  };

  return (
    <div className="flex flex-col gap-[20px]">
      {/* PAGE HEADER */}
      <div>
        <h1 className="text-[28px] font-semibold text-gray-800">
          Health Literacy Hub
        </h1>
        <p className="text-gray-500 mt-[4px]">
          Access educational resources, multilingual content, and community
          insights to enhance your health knowledge.
        </p>
      </div>

      {/* ILLUSTRATION CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[20px]">
        {ILLUSTRATIONS.map((illustration) => (
          <div
            key={illustration.id}
            className="bg-white rounded-[12px] border border-[#E5E5E5] p-[24px] flex flex-col items-center justify-center text-center"
          >
            <div className="mb-[16px]">
              <Icon
                iconName={illustration.icon}
                height="48px"
                width="48px"
                fill="#6A8EB5"
              />
            </div>
            <h3 className="text-[18px] font-semibold text-gray-800 mb-[8px]">
              {illustration.title}
            </h3>
            <p className="text-[14px] text-gray-500">
              {illustration.description}
            </p>
          </div>
        ))}
      </div>

      {/* TABS NAVIGATION */}
      <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[12px]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-[8px] bg-[#F5F5F5] rounded-[10px] p-[6px]">
          {["Articles", "Videos", "Infographics", "HealthLiteracyAnalytics"].map(
            (tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setSearchQuery("");
                }}
                className={`px-[16px] py-[10px] rounded-[8px] text-sm font-medium transition ${
                  activeTab === tab
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {tab === "HealthLiteracyAnalytics" ? "Analytics" : tab}
              </button>
            )
          )}
        </div>
      </div>

      {/* SEARCH AND CREATE SECTION */}
      {activeTab !== "HealthLiteracyAnalytics" && (
        <div className="flex flex-col sm:flex-row gap-[12px] items-start sm:items-center">
          <Input
            size="input-md"
            id="search-content"
            additionalClasses="flex-1"
            placeholder={`Search ${activeTab.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leadingIcon="Search"
            trailingIcon={searchQuery.length > 0 ? "Close" : undefined}
            onClickTrailing={
              searchQuery.length > 0 ? () => setSearchQuery("") : undefined
            }
          />
          <button
            onClick={handleCreateClick}
            className="prod-btn-base prod-btn-primary flex justify-center items-center whitespace-nowrap"
          >
            <span>Create New Content</span>
            <Icon
              iconName="Plus"
              height="20px"
              width="20px"
              fill="#FFF"
              className="ms-[8px]"
            />
          </button>
        </div>
      )}

      {/* CONTENT DISPLAY */}
      {activeTab === "HealthLiteracyAnalytics" ? (
        <AnalyticsSection />
      ) : (
        <ContentGrid
          content={getFilteredContent()}
          contentType={activeTab}
          isLoading={isFetchingContent}
          onMediaClick={handleMediaPreviewClick}
          onEditClick={handleEditClick}
        />
      )}

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <ModalWithBody
          onConfirm={handleCreateSubmit}
          onConfirmLabel="Create"
          onCancel={() => {
            setIsCreateModalOpen(false);
            resetForm();
          }}
          onLoading={isCreatingContent}
          onLoadingLabel="Creating..."
          heading={`Create New ${getContentLabel(activeTab)}`}
          color="primary"
          additionalClasses="!top-[68px] !h-[calc(100vh-68px)] !pt-[20px]"
        >
          <ContentFormBody
            formData={formData}
            uploadRule={uploadRule}
            mode="create"
            onFormChange={handleFormChange}
            onMediaChange={handleMediaChange}
            onMediaDrop={handleMediaDrop}
            onRemoveMedia={handleRemoveMedia}
          />
        </ModalWithBody>
      )}

      {isEditModalOpen && (
        <ModalWithBody
          onConfirm={handleEditSubmit}
          onConfirmLabel="Save"
          onCancel={() => {
            setIsEditModalOpen(false);
            setEditingContent(null);
            resetForm();
          }}
          onLoading={isUpdatingContent}
          onLoadingLabel="Saving..."
          heading={`Edit ${getContentLabel(activeTab)}`}
          color="primary"
          additionalClasses="!top-[68px] !h-[calc(100vh-68px)] !pt-[20px]"
        >
          <ContentFormBody
            formData={formData}
            uploadRule={uploadRule}
            mode="edit"
            onFormChange={handleFormChange}
            onMediaChange={handleMediaChange}
            onMediaDrop={handleMediaDrop}
            onRemoveMedia={handleRemoveMedia}
          />
        </ModalWithBody>
      )}

      {selectedMediaContent && (
        <MediaPreviewModal
          title={selectedMediaContent.title}
          description={selectedMediaContent.description}
          media={selectedMediaContent.media}
          publishToMobile={selectedMediaContent.publishToMobile}
          publishToWebsite={selectedMediaContent.publishToWebsite}
          onClose={handleMediaPreviewClose}
        />
      )}
    </div>
  );
};

const ContentFormBody = ({
  formData,
  uploadRule,
  mode,
  onFormChange,
  onMediaChange,
  onMediaDrop,
  onRemoveMedia,
}) => {
  const uploadInputId = `health-literacy-media-upload-${mode}`;
  const hasMediaPreview = Boolean(formData.mediaPreview) && !formData.removeMedia;
  const previewType =
    formData.media?.type ?? formData.existingMedia?.contentType ?? "";
  const previewName =
    formData.media?.name ?? formData.existingMedia?.filename ?? "";

  return (
    <div className="p-[20px] flex flex-col gap-[16px] max-h-[60vh] overflow-y-auto">
      <div>
        <label className="block text-[14px] font-medium text-gray-800 mb-[8px]">
          Title *
        </label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={onFormChange}
          placeholder="Enter content title"
          className="w-full px-[12px] py-[10px] border border-[#E5E5E5] rounded-[8px] text-[14px] focus:outline-none focus:border-[#6A8EB5]"
        />
      </div>
      <div>
        <label className="block text-[14px] font-medium text-gray-800 mb-[8px]">
          Description *
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={onFormChange}
          placeholder="Enter content description"
          className="w-full max-h-[220px] px-[12px] py-[10px] border border-[#E5E5E5] rounded-[8px] text-[14px] focus:outline-none focus:border-[#6A8EB5]"
          rows="5"
        />
      </div>
      <div>
        <label className="block text-[14px] font-medium text-gray-800 mb-[8px]">
          Tags (comma-separated)
        </label>
        <input
          type="text"
          name="tags"
          value={formData.tags}
          onChange={onFormChange}
          placeholder="e.g., health, education, wellness"
          className="w-full px-[12px] py-[10px] border border-[#E5E5E5] rounded-[8px] text-[14px] focus:outline-none focus:border-[#6A8EB5]"
        />
      </div>
      <div>
        <label className="block text-[14px] font-medium text-gray-800 mb-[8px]">
          {uploadRule.label}
        </label>
        <label
          htmlFor={uploadInputId}
          className="block border-2 border-dashed border-[#E5E5E5] rounded-[8px] p-[20px] text-center cursor-pointer hover:bg-[#F9F9F9] transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onMediaDrop}
        >
          {hasMediaPreview ? (
            <div className="flex flex-col items-center">
              {previewType.startsWith("video/") ? (
                <video
                  src={formData.mediaPreview}
                  className="w-[140px] h-[100px] object-cover rounded-[4px] mb-[8px]"
                  controls
                />
              ) : (
                <img
                  src={formData.mediaPreview}
                  alt="Preview"
                  className="w-[100px] h-[100px] object-cover rounded-[4px] mb-[8px]"
                />
              )}
              {previewName && (
                <p className="text-[13px] text-gray-600 font-medium break-all">
                  {previewName}
                </p>
              )}
              <p className="text-[12px] text-gray-500 mt-[4px]">
                Click to change
              </p>
            </div>
          ) : (
            <div>
              <Icon
                iconName="Upload"
                height="32px"
                width="32px"
                fill="#D0D5DD"
                className="mx-auto mb-[8px]"
              />
              <p className="text-[14px] font-medium text-gray-800">
                Drag and drop your file
              </p>
              <p className="text-[12px] text-gray-500 mt-[4px]">
                or click to browse
              </p>
              <p className="text-[11px] text-gray-400 mt-[8px]">
                {uploadRule.helperText}
              </p>
            </div>
          )}
        </label>
        <input
          id={uploadInputId}
          type="file"
          accept={uploadRule.accept}
          onChange={onMediaChange}
          className="hidden"
        />
        {hasMediaPreview && (
          <button
            type="button"
            onClick={onRemoveMedia}
            className="text-[12px] text-red-500 hover:text-red-700 mt-[8px] font-medium"
          >
            Remove file
          </button>
        )}
      </div>
      <div className="border-t border-[#E5E5E5] pt-[16px]">
        <p className="text-[14px] font-medium text-gray-800 mb-[8px]">
          Publish Options
        </p>
        <div className="flex flex-col gap-[10px]">
          <label className="flex items-center gap-[10px] text-[14px] text-gray-700">
            <input
              type="checkbox"
              name="publishToMobile"
              checked={formData.publishToMobile}
              onChange={onFormChange}
              className="h-[16px] w-[16px]"
            />
            Publish to mobile application
          </label>
          <label className="flex items-center gap-[10px] text-[14px] text-gray-700">
            <input
              type="checkbox"
              name="publishToWebsite"
              checked={formData.publishToWebsite}
              onChange={onFormChange}
              className="h-[16px] w-[16px]"
            />
            Publish to website
          </label>
        </div>
      </div>
    </div>
  );
};

const ContentGrid = ({
  content,
  contentType,
  isLoading,
  onMediaClick,
  onEditClick,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[40px] flex flex-col items-center justify-center text-center">
        <p className="text-[16px] font-medium text-gray-600">
          Loading {contentType.toLowerCase()}...
        </p>
      </div>
    );
  }

  if (content.length === 0) {
    return (
      <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[40px] flex flex-col items-center justify-center text-center">
        <Icon
          iconName="Search"
          height="48px"
          width="48px"
          fill="#D0D5DD"
          className="mb-[16px]"
        />
        <p className="text-[16px] font-medium text-gray-600 mb-[8px]">
          No {contentType.toLowerCase()} found
        </p>
        <p className="text-[14px] text-gray-500">
          Try adjusting your search terms or create new content
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[20px]">
      {content.map((item) => (
        <ContentCard
          key={`${item.source ?? "mock"}-${item.id}`}
          item={item}
          onMediaClick={onMediaClick}
          onEditClick={onEditClick}
        />
      ))}
    </div>
  );
};

const ContentCard = ({ item, onMediaClick, onEditClick }) => {
  const media = item.media;
  const mediaType = media?.contentType ?? "";
  const hasPreviewMedia = Boolean(media?.dataUrl);
  const canEdit = item.source === "api";
  const MediaPreviewWrapper = hasPreviewMedia ? "button" : "div";

  return (
    <div className="bg-white rounded-[12px] border border-[#E5E5E5] overflow-hidden hover:shadow-lg transition-shadow">
      <MediaPreviewWrapper
        type={hasPreviewMedia ? "button" : undefined}
        onClick={hasPreviewMedia ? () => onMediaClick(item) : undefined}
        className={`bg-gradient-to-br from-[#6A8EB5] to-[#78C6B2] h-[180px] w-full flex items-center justify-center ${
          hasPreviewMedia
            ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6A8EB5] focus:ring-offset-2"
            : ""
        }`}
        aria-label={hasPreviewMedia ? `Open ${item.title} media preview` : undefined}
      >
        {media?.dataUrl && mediaType.startsWith("image/") ? (
          <img
            src={media.dataUrl}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : media?.dataUrl && mediaType.startsWith("video/") ? (
          <video
            src={media.dataUrl}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
        ) : (
          <Icon
            iconName="Image"
            height="64px"
            width="64px"
            fill="#FFFFFF"
            opacity="0.5"
          />
        )}
      </MediaPreviewWrapper>

      <div className="p-[16px]">
        <div className="flex items-start justify-between gap-[12px] mb-[8px]">
          <h3 className="text-[16px] font-semibold text-gray-800 line-clamp-2">
            {item.title}
          </h3>
          {canEdit && (
            <button
              type="button"
              onClick={() => onEditClick(item)}
              className="flex-shrink-0 rounded-[6px] border border-[#E5E5E5] px-[10px] py-[6px] text-[12px] font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]"
            >
              Edit
            </button>
          )}
        </div>
        <p className="h-[58px] overflow-y-auto text-[13px] text-gray-600 mb-[12px] pr-[4px]">
          {item.description}
        </p>

        <div className="flex flex-wrap gap-[6px] mb-[12px]">
          {(item.tags ?? []).slice(0, 2).map((tag, index) => (
            <span
              key={index}
              className="inline-block px-[8px] py-[4px] bg-[#F5F5F5] rounded-[4px] text-[11px] text-gray-600 font-medium"
            >
              {tag}
            </span>
          ))}
          {(item.tags ?? []).length > 2 && (
            <span className="inline-block px-[8px] py-[4px] bg-[#F5F5F5] rounded-[4px] text-[11px] text-gray-600 font-medium">
              +{item.tags.length - 2}
            </span>
          )}
        </div>

        <div className="text-[12px] text-gray-500 flex flex-col gap-[4px]">
          {item.date && <span>Date: {item.date}</span>}
          {item.duration && <span>Duration: {item.duration}</span>}
          {item.source === "api" && (
            <span>
              Publish:{" "}
              {[
                item.publishToMobile ? "Mobile" : null,
                item.publishToWebsite ? "Website" : null,
              ]
                .filter(Boolean)
                .join(", ") || "Not selected"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const MediaPreviewModal = ({
  title,
  description,
  media,
  publishToMobile,
  publishToWebsite,
  onClose,
}) => {
  const mediaType = media?.contentType ?? "";
  const publishTargets = [
    publishToMobile ? "Mobile" : null,
    publishToWebsite ? "Website" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="fixed bottom-0 left-0 right-0 top-[68px] z-20 flex items-center justify-center bg-transparent px-[16px] py-[20px]">
      <div
        className="absolute inset-0 bg-[rgba(52,64,84,0.6)] backdrop-blur-[8px]"
        onClick={onClose}
      ></div>
      <div className="relative z-10 flex max-h-[calc(100vh-40px)] w-full max-w-[960px] flex-col rounded-[8px] border-2 border-gray-50 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-[16px] border-b-2 border-gray-50 p-[16px] sm:p-[20px]">
          <h2 className="text-[18px] font-semibold text-gray-900 line-clamp-2">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-[8px] hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]"
            aria-label="Close media preview"
          >
            <Icon
              iconName="Close"
              height="22px"
              width="22px"
              stroke="#344054"
            />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-gray-900 p-[12px] sm:p-[20px]">
          {mediaType.startsWith("image/") ? (
            <img
              src={media.dataUrl}
              alt={title}
              className="max-h-[calc(100vh-220px)] w-auto max-w-full object-contain"
            />
          ) : mediaType.startsWith("video/") ? (
            <video
              key={media.dataUrl}
              src={media.dataUrl}
              className="max-h-[calc(100vh-220px)] w-full max-w-full rounded-[4px] bg-black"
              controls
            />
          ) : (
            <div className="flex min-h-[260px] flex-col items-center justify-center text-center text-white">
              <Icon
                iconName="Image"
                height="64px"
                width="64px"
                fill="#FFFFFF"
                opacity="0.5"
                className="mb-[12px]"
              />
              <p className="text-[14px] font-medium">
                This media type cannot be previewed.
              </p>
            </div>
          )}
        </div>
        <div className="border-t-2 border-gray-50 p-[16px] sm:p-[20px]">
          <p className="max-h-[110px] overflow-y-auto pr-[4px] text-[14px] text-gray-700">
            {description}
          </p>
          <p className="mt-[10px] text-[12px] font-medium text-gray-500">
            Publish: {publishTargets || "Not selected"}
          </p>
        </div>
      </div>
    </div>
  );
};

const AnalyticsSection = () => {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const reportRef = useRef(null);
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState("overview");
  const [filters, setFilters] = useState({
    timeRange: "last-30-days",
    contentType: "all",
    region: "all",
  });

  const {
    data: articles = [],
    isFetching: isFetchingArticles,
  } = useFetchHealthLiteracyContentQuery("articles");
  const {
    data: videos = [],
    isFetching: isFetchingVideos,
  } = useFetchHealthLiteracyContentQuery("videos");
  const {
    data: infographics = [],
    isFetching: isFetchingInfographics,
  } = useFetchHealthLiteracyContentQuery("infographics");
  const {
    data: overviewAnalytics = DEFAULT_ANALYTICS_OVERVIEW,
    isFetching: isFetchingOverviewAnalytics,
  } = useFetchHealthLiteracyAnalyticsOverviewQuery(filters);
  const [createHealthLiteracyAnalyticsEvent] =
    useCreateHealthLiteracyAnalyticsEventMutation();

  const isFetchingAnalytics =
    isFetchingArticles ||
    isFetchingVideos ||
    isFetchingInfographics ||
    (activeAnalyticsTab === "overview" && isFetchingOverviewAnalytics);
  const activeTabLabel =
    ANALYTICS_TABS.find((tab) => tab.id === activeAnalyticsTab)?.label ??
    "Overview";

  const allContentRows = useMemo(
    () => [
      ...normalizeContentForAnalytics(articles, "Articles"),
      ...normalizeContentForAnalytics(videos, "Videos"),
      ...normalizeContentForAnalytics(infographics, "Infographics"),
      ...normalizeMockContentForAnalytics(MOCK_ARTICLES, "Articles"),
      ...normalizeMockContentForAnalytics(MOCK_VIDEOS, "Videos"),
      ...normalizeMockContentForAnalytics(MOCK_INFOGRAPHICS, "Infographics"),
    ],
    [articles, videos, infographics]
  );

  const filteredRows = useMemo(
    () => filterAnalyticsRows(allContentRows, filters),
    [allContentRows, filters]
  );

  const report = useMemo(
    () =>
      buildAnalyticsReport({
        activeTab: activeAnalyticsTab,
        rows: filteredRows,
        filters,
        overviewAnalytics,
      }),
    [activeAnalyticsTab, filteredRows, filters, overviewAnalytics]
  );

  const updateFilter = (name, value) => {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const recordReportExport = (reportFormat) => {
    createHealthLiteracyAnalyticsEvent({
      eventType: "report_exported",
      reportFormat,
      contentType: filters.contentType,
      region: filters.region,
      visitorId: getHealthLiteracyVisitorId(user?.id),
      metadata: {
        analyticsTab: activeAnalyticsTab,
        timeRange: filters.timeRange,
      },
    }).catch(() => {});
  };

  const handleExportCsv = () => {
    recordReportExport("csv");

    downloadCsv({
      filename: `health-literacy-${slugify(activeTabLabel)}-${Date.now()}.csv`,
      title: `Health Literacy Hub - ${activeTabLabel}`,
      filters: report.filterLabels,
      columns: report.columns,
      rows: report.rows,
    });
  };

  const handleExportPdf = async () => {
    if (!reportRef.current) return;

    try {
      recordReportExport("pdf");

      const imageData = await toPng(reportRef.current, {
        canvasWidth: reportRef.current.offsetWidth * 2,
        canvasHeight: reportRef.current.offsetHeight * 2,
        pixelRatio: 1,
        quality: 1,
        backgroundColor: "#ffffff",
      });

      navigate("/print", {
        state: {
          data: {
            documentTitle: `HealthPH - Health Literacy Hub - ${activeTabLabel}`,
            imageData,
            log_activity: {
              user_id: user?.id,
              entry: `Generated Health Literacy Hub ${activeTabLabel} report`,
              module: "Health Literacy Hub",
            },
          },
        },
      });
    } catch (error) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: "Failed to generate PDF report. Please try again.",
      });
    }
  };

  return (
    <div ref={reportRef} className="flex flex-col gap-[16px]">
      <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[16px]">
        <div className="flex flex-col gap-[14px] lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-[22px] font-semibold text-gray-900">
              Health Literacy Analytics
            </h2>
            <p className="mt-[4px] text-[14px] text-gray-500">
              Monitor content usage, feedback, fact-check demand, regional reach,
              and quality review needs.
            </p>
          </div>
          <div className="flex flex-col gap-[8px] sm:flex-row">
            <button
              type="button"
              onClick={handleExportCsv}
              className="prod-btn-base prod-btn-primary flex min-h-[40px] items-center justify-center gap-[8px] px-[14px]"
            >
              <Icon iconName="Download" height="18px" width="18px" fill="#FFF" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              className="prod-btn-base prod-btn-primary flex min-h-[40px] items-center justify-center gap-[8px] px-[14px]"
            >
              <Icon iconName="Printer" height="18px" width="18px" fill="#FFF" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        <div className="mt-[16px] grid grid-cols-1 gap-[12px] lg:grid-cols-3">
          <AnalyticsSelect
            label="Time Range"
            value={filters.timeRange}
            options={ANALYTICS_TIME_RANGES}
            onChange={(value) => updateFilter("timeRange", value)}
          />
          <AnalyticsSelect
            label="Content Type"
            value={filters.contentType}
            options={ANALYTICS_CONTENT_FILTERS}
            onChange={(value) => updateFilter("contentType", value)}
          />
          <AnalyticsSelect
            label="Region"
            value={filters.region}
            options={[{ value: "all", label: "All regions" }, ...ANALYTICS_REGIONS]}
            onChange={(value) => updateFilter("region", value)}
          />
        </div>
      </div>

      <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[12px]">
        <div className="grid grid-cols-1 gap-[8px] md:grid-cols-2 xl:grid-cols-7">
          {ANALYTICS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveAnalyticsTab(tab.id)}
              className={`min-h-[44px] rounded-[8px] px-[10px] py-[8px] text-[13px] font-medium transition ${
                activeAnalyticsTab === tab.id
                  ? "bg-[#6A8EB5] text-white shadow-sm"
                  : "bg-[#F5F5F5] text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isFetchingAnalytics && (
        <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[14px] text-[14px] text-gray-500">
          Refreshing analytics data...
        </div>
      )}

      <AnalyticsTabContent
        activeTab={activeAnalyticsTab}
        rows={filteredRows}
        filters={filters}
        report={report}
        overviewAnalytics={overviewAnalytics}
      />
    </div>
  );
};

const AnalyticsSelect = ({ label, value, options, onChange }) => {
  return (
    <label className="flex flex-col gap-[6px]">
      <span className="text-[13px] font-semibold text-gray-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[40px] rounded-[8px] border border-[#D0D5DD] bg-white px-[12px] text-[14px] text-gray-800 outline-none focus:border-[#6A8EB5] focus:ring-2 focus:ring-[#6A8EB5]/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
};

const AnalyticsMetricCard = ({ label, value, detail }) => {
  return (
    <div className="rounded-[8px] border border-[#E5E5E5] bg-white p-[16px]">
      <p className="text-[13px] font-medium text-gray-500">{label}</p>
      <p className="mt-[6px] text-[24px] font-semibold text-gray-900">{value}</p>
      {detail && <p className="mt-[4px] text-[12px] text-gray-500">{detail}</p>}
    </div>
  );
};

const AnalyticsBarList = ({ items, labelKey, valueKey, valueSuffix = "" }) => {
  const maxValue = Math.max(...items.map((item) => Number(item[valueKey] ?? 0)), 1);

  return (
    <div className="flex flex-col gap-[12px]">
      {items.map((item) => {
        const value = Number(item[valueKey] ?? 0);
        return (
          <div key={item[labelKey]} className="flex flex-col gap-[6px]">
            <div className="flex items-center justify-between gap-[12px] text-[13px]">
              <span className="font-medium text-gray-700">{item[labelKey]}</span>
              <span className="text-gray-500">
                {formatNumber(value)}
                {valueSuffix}
              </span>
            </div>
            <div className="h-[8px] overflow-hidden rounded-full bg-[#EEF2F6]">
              <div
                className="h-full rounded-full bg-[#78C6B2]"
                style={{ width: `${Math.max((value / maxValue) * 100, 4)}%` }}
              ></div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const renderAnalyticsTableCell = (cell) => {
  if (cell?.type === "content") {
    return (
      <div className="flex min-w-[220px] flex-col gap-[3px]">
        <span className="font-semibold text-gray-900">{cell.title}</span>
        {cell.description && (
          <span className="text-[12px] leading-[1.35] text-gray-500">
            {cell.description}
          </span>
        )}
      </div>
    );
  }

  if (cell?.type === "status") {
    return (
      <span
        className={`inline-flex min-w-[92px] items-center justify-center rounded-full border px-[10px] py-[4px] text-[12px] font-semibold ${cell.className}`}
      >
        {cell.label}
      </span>
    );
  }

  if (cell?.type === "result-status") {
    return (
      <span
        className={`inline-flex min-w-[96px] items-center justify-center rounded-full border px-[10px] py-[4px] text-[12px] font-semibold ${cell.className}`}
      >
        {cell.label}
      </span>
    );
  }

  if (cell?.type === "related-content") {
    return (
      <button
        type="button"
        onClick={cell.onClick}
        disabled={cell.disabled}
        className={`inline-flex min-h-[34px] items-center justify-center rounded-[8px] border px-[12px] text-[12px] font-semibold transition ${
          cell.disabled
            ? "cursor-not-allowed border-[#D0D5DD] bg-[#F8FAFC] text-gray-400"
            : "border-[#6A8EB5] bg-white text-[#315F8C] hover:bg-[#F0F6FC] focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]/30"
        }`}
      >
        {cell.label}
      </button>
    );
  }

  return <span className="line-clamp-2">{cell}</span>;
};

const AnalyticsTable = ({ columns, rows, emptyMessage }) => {
  return (
    <div className="overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#E5E5E5]">
          <thead className="bg-[#F8FAFC]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-[14px] py-[12px] text-left text-[12px] font-semibold uppercase tracking-[0.04em] text-gray-500"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E5]">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-[14px] py-[28px] text-center text-[14px] text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr
                  key={`${row.map(getAnalyticsCellText).join("-")}-${rowIndex}`}
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${cellIndex}-${getAnalyticsCellText(cell)}`}
                      className="max-w-[340px] px-[14px] py-[12px] text-[13px] text-gray-700"
                    >
                      {renderAnalyticsTableCell(cell)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AnalyticsPanel = ({ title, children }) => {
  return (
    <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[16px]">
      <h3 className="mb-[14px] text-[16px] font-semibold text-gray-900">
        {title}
      </h3>
      {children}
    </div>
  );
};

const RelatedContentModal = ({ searchTerm, matches, onClose }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 top-[68px] z-20 flex items-center justify-center bg-transparent px-[16px] py-[20px]">
      <div
        className="absolute inset-0 bg-[rgba(52,64,84,0.6)] backdrop-blur-[8px]"
        onClick={onClose}
      ></div>
      <div className="relative z-10 flex max-h-[calc(100vh-40px)] w-full max-w-[720px] flex-col rounded-[8px] border-2 border-gray-50 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-[16px] border-b-2 border-gray-50 p-[16px] sm:p-[20px]">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-gray-500">
              Related Content
            </p>
            <h2 className="mt-[4px] text-[18px] font-semibold text-gray-900">
              {searchTerm}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-[8px] hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]"
            aria-label="Close related content"
          >
            <Icon
              iconName="Close"
              height="22px"
              width="22px"
              stroke="#344054"
            />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-[16px] sm:p-[20px]">
          <div className="flex flex-col gap-[10px]">
            {matches.map((item) => (
              <div
                key={`${item.contentType}-${item.id}-${item.title}`}
                className="rounded-[8px] border border-[#E5E5E5] p-[12px]"
              >
                <div className="flex flex-col gap-[6px] sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[14px] font-semibold text-gray-900">
                      {item.title}
                    </p>
                    <p className="mt-[3px] text-[12px] text-gray-500">
                      {item.contentType}
                    </p>
                  </div>
                  {item.matchedTags.length > 0 && (
                    <span className="rounded-full bg-[#EAF3FF] px-[10px] py-[4px] text-[12px] font-semibold text-[#175CD3]">
                      {item.matchedTags.join(", ")}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="mt-[8px] text-[13px] leading-[1.45] text-gray-600">
                    {item.description}
                  </p>
                )}
                {item.tags.length > 0 && (
                  <div className="mt-[10px] flex flex-wrap gap-[6px]">
                    {item.tags.slice(0, 5).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-[4px] bg-[#F5F5F5] px-[8px] py-[4px] text-[11px] font-medium text-gray-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const AnalyticsTabContent = ({
  activeTab,
  rows,
  filters,
  report,
  overviewAnalytics,
}) => {
  const [relatedContentModal, setRelatedContentModal] = useState(null);
  const totalViews = sumBy(rows, "views");
  const totalShares = sumBy(rows, "shares");
  const totalFeedback = sumBy(rows, "helpful") + sumBy(rows, "notHelpful");
  const helpfulRate = (sumBy(rows, "helpful") / Math.max(totalFeedback, 1)) * 100;
  const overview = {
    ...DEFAULT_ANALYTICS_OVERVIEW,
    ...overviewAnalytics,
    topSearchTopic: {
      ...DEFAULT_ANALYTICS_OVERVIEW.topSearchTopic,
      ...overviewAnalytics?.topSearchTopic,
    },
  };
  const searchRows = filterAnalyticsRows(normalizeSearchTopicAnalyticsRows(), filters);
  const searchTopicTableRows = report.rows.map((row) =>
    row.map((cell) => {
      if (cell?.type !== "related-content" || cell.disabled) return cell;

      return {
        ...cell,
        onClick: () =>
          setRelatedContentModal({
            searchTerm: cell.searchTerm,
            matches: cell.matches,
          }),
      };
    })
  );
  const factRows = filterAnalyticsRows(MOCK_FACT_CHECK_ANALYTICS, filters);
  const regionalRows = buildRegionalUsageRows(rows, filters.region)
    .slice()
    .sort((a, b) => b.sessions - a.sessions);
  const reviewRows = buildReviewQueueRows(rows);

  if (activeTab === "content-performance") {
    return (
      <div className="flex flex-col gap-[16px]">
        <div className="grid grid-cols-1 gap-[12px] md:grid-cols-3">
          <AnalyticsMetricCard label="Total Views" value={formatNumber(totalViews)} />
          <AnalyticsMetricCard
            label="Helpful Score"
            value={formatPercent(helpfulRate)}
          />
          <AnalyticsMetricCard label="Shares" value={formatNumber(totalShares)} />
        </div>
        <AnalyticsPanel title="Content Performance">
          <AnalyticsTable
            columns={report.columns}
            rows={report.rows}
            emptyMessage="No content performance data matches the selected filters."
          />
        </AnalyticsPanel>
      </div>
    );
  }

  if (activeTab === "search-topic") {
    return (
      <>
        <div className="grid grid-cols-1 gap-[16px] xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <AnalyticsPanel title="Top Search Topics">
            <AnalyticsBarList
              items={buildTopSearchTopicItems(searchRows)}
              labelKey="label"
              valueKey="value"
            />
          </AnalyticsPanel>
          <AnalyticsPanel title="Search and Topic Analysis">
            <AnalyticsTable
              columns={report.columns}
              rows={searchTopicTableRows}
              emptyMessage="No search activity matches the selected filters."
            />
          </AnalyticsPanel>
        </div>
        {relatedContentModal && (
          <RelatedContentModal
            searchTerm={relatedContentModal.searchTerm}
            matches={relatedContentModal.matches}
            onClose={() => setRelatedContentModal(null)}
          />
        )}
      </>
    );
  }

  if (activeTab === "helpful") {
    return (
      <div className="flex flex-col gap-[16px]">
        <div className="grid grid-cols-1 gap-[12px] md:grid-cols-3">
          <AnalyticsMetricCard
            label="Helpful Responses"
            value={formatNumber(sumBy(rows, "helpful"))}
          />
          <AnalyticsMetricCard
            label="Not Helpful Responses"
            value={formatNumber(sumBy(rows, "notHelpful"))}
          />
          <AnalyticsMetricCard
            label="Helpful Rate"
            value={formatPercent(helpfulRate)}
          />
        </div>
        <AnalyticsPanel title="Helpful/Not Helpful Analytics">
          <AnalyticsTable
            columns={report.columns}
            rows={report.rows}
            emptyMessage="No feedback data matches the selected filters."
          />
        </AnalyticsPanel>
      </div>
    );
  }

  if (activeTab === "fact-check") {
    return (
      <div className="flex flex-col gap-[16px]">
        <div className="grid grid-cols-1 gap-[12px] md:grid-cols-3">
          <AnalyticsMetricCard
            label="Fact Checks"
            value={formatNumber(sumBy(factRows, "checks"))}
          />
          <AnalyticsMetricCard
            label="Average Verified"
            value={formatPercent(
              factRows.reduce((total, row) => total + row.verified, 0) /
                Math.max(factRows.length, 1)
            )}
          />
          <AnalyticsMetricCard
            label="Claims Needing Review"
            value={formatNumber(sumBy(factRows, "needsReview"))}
          />
        </div>
        <AnalyticsPanel title="Fact-Check Usage Analytics">
          <AnalyticsTable
            columns={report.columns}
            rows={report.rows}
            emptyMessage="No fact-check usage matches the selected filters."
          />
        </AnalyticsPanel>
      </div>
    );
  }

  if (activeTab === "regional-usage") {
    return (
      <div className="grid grid-cols-1 gap-[16px] xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <AnalyticsPanel title="Regional Sessions">
          <AnalyticsBarList
            items={regionalRows.slice(0, 8)}
            labelKey="region"
            valueKey="sessions"
          />
        </AnalyticsPanel>
        <AnalyticsPanel title="Regional Usage">
          <AnalyticsTable
            columns={report.columns}
            rows={report.rows}
            emptyMessage="No regional usage data matches the selected filters."
          />
        </AnalyticsPanel>
      </div>
    );
  }

  if (activeTab === "review-queue") {
    return (
      <div className="flex flex-col gap-[16px]">
        <div className="grid grid-cols-1 gap-[12px] md:grid-cols-3">
          <AnalyticsMetricCard
            label="Items Needing Review"
            value={formatNumber(reviewRows.length)}
          />
          <AnalyticsMetricCard
            label="Missing Media"
            value={formatNumber(
              reviewRows.filter((row) => row.issues.includes("Missing media")).length
            )}
          />
          <AnalyticsMetricCard
            label="Missing Publish Target"
            value={formatNumber(
              reviewRows.filter((row) => row.issues.includes("No publish target"))
                .length
            )}
          />
        </div>
        <AnalyticsPanel title="Review Queue">
          <AnalyticsTable
            columns={report.columns}
            rows={report.rows}
            emptyMessage="No content currently needs review."
          />
        </AnalyticsPanel>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2 xl:grid-cols-3">
      <AnalyticsMetricCard
        label="People Reached"
        value={formatNumber(overview.peopleReached)}
        detail="Health Literacy Hub content opened"
      />
      <AnalyticsMetricCard
        label="Unique Visitors"
        value={formatNumber(overview.uniqueVisitors)}
        detail="Distinct audience members reached"
      />
      <AnalyticsMetricCard
        label="Top Search Topic"
        value={overview.topSearchTopic.topic}
        detail={`${formatNumber(overview.topSearchTopic.searches)} searches`}
      />
      <AnalyticsMetricCard
        label="Helpful Score"
        value={formatPercent(overview.helpfulScore)}
        detail="Helpful votes divided by total feedback"
      />
      <AnalyticsMetricCard
        label="Needs Review"
        value={formatNumber(overview.needsReview)}
        detail="Content missing review-ready details"
      />
      <AnalyticsMetricCard
        label="Reports Exported"
        value={formatNumber(overview.reportsExported)}
        detail="PDF and CSV report exports"
      />
    </div>
  );
};

export default HealthLiteracyHub;
