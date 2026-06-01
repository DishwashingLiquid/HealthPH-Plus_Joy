import { toast } from "react-toastify";
import Icon from "../../../components/Icon";
import Snackbar from "../../../components/Snackbar";
import RegionsData from "../../../assets/data/regions.json";
export const TAB_CONTENT_TYPES = {
  Articles: "articles",
  Videos: "videos",
  Infographics: "infographics",
};

export const UPLOAD_RULES = {
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

export const INITIAL_FORM_DATA = {
  title: "",
  description: "",
  tags: [],
  media: null,
  mediaPreview: null,
  existingMedia: null,
  removeMedia: false,
  publishToMobile: false,
  publishToWebsite: false,
  isFactCheck: false,
  claim: "",
  claimStatus: "Needs Expert Review",
  verifiedBy: "Project Researcher",
};

export const FACT_CHECK_CLAIM_STATUS_OPTIONS = [
  { value: "False", label: "False" },
  { value: "Misleading", label: "Misleading" },
  { value: "Verified", label: "Verified" },
  { value: "Needs Expert Review", label: "Needs Expert Review" },
];

export const FACT_CHECK_VERIFIED_BY_OPTIONS = [
  { value: "DOH", label: "DOH" },
  { value: "Medical Expert", label: "Medical Expert" },
  { value: "Project Researcher", label: "Project Researcher" },
];

export const HEALTH_LITERACY_TAG_LIMIT = 3;

export const HEALTH_LITERACY_TAG_OPTIONS = [
  "Disease Prevention",
  "Vaccination",
  "Respiratory Health",
  "Dengue and Vector-borne Diseases",
  "Maternal and Child Health",
  "Nutrition",
  "Mental Health",
  "Sexual and Reproductive Health",
  "Chronic Diseases",
  "Medication Safety",
  "First Aid and Emergency Care",
  "Hygiene and Sanitation",
  "Health Services Access",
  "Myth Busting / Fact Check",
  "Environmental Health",
  "Outbreak Updates",
  "Healthy Lifestyle",
].map((tag, index) => ({
  value: tag,
  label: tag,
  order: index,
}));

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
  normalizeContentTags(tags).slice(0, HEALTH_LITERACY_TAG_LIMIT);

export const getTagOptionsWithSelectedTags = (selectedTags = []) => {
  const selectedTagKeys = new Set(
    HEALTH_LITERACY_TAG_OPTIONS.map((option) => option.value.toLowerCase())
  );
  const customTagOptions = normalizeContentTags(selectedTags)
    .filter((tag) => {
      const tagKey = tag.toLowerCase();
      if (selectedTagKeys.has(tagKey)) return false;

      selectedTagKeys.add(tagKey);
      return true;
    })
    .map((tag, index) => ({
      value: tag,
      label: tag,
      order: HEALTH_LITERACY_TAG_OPTIONS.length + index,
    }));

  return [...HEALTH_LITERACY_TAG_OPTIONS, ...customTagOptions];
};

export const ILLUSTRATIONS = [
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

export const ANALYTICS_TABS = [
  { id: "overview", label: "Overview" },
  { id: "content-performance", label: "Content Performance" },
  { id: "search-topic", label: "Search and Topic Analysis" },
  { id: "helpful", label: "Helpful/Not Helpful Analytics" },
  { id: "fact-check", label: "Fact-Check Usage Analytics" },
  { id: "regional-usage", label: "Regional Usage" },
  { id: "review-queue", label: "Review Queue" },
];

export const ANALYTICS_TIME_RANGES = [
  { value: "last-7-days", label: "Last 7 days", days: 7 },
  { value: "last-30-days", label: "Last 30 days", days: 30 },
  { value: "last-90-days", label: "Last 90 days", days: 90 },
  { value: "all-time", label: "All time", days: null },
];

export const ANALYTICS_CONTENT_FILTERS = [
  { value: "all", label: "All content" },
  { value: "Articles", label: "Articles" },
  { value: "Videos", label: "Videos" },
  { value: "Infographics", label: "Infographics" },
];

export const REVIEWER_OPTIONS = [
  { value: "Content Editor", label: "Content Editor" },
  { value: "Project Researcher", label: "Project Researcher" },
  { value: "Medical Expert", label: "Medical Expert" },
];

export const ANALYTICS_REGIONS = RegionsData.regions;

export const HEALTH_LITERACY_VISITOR_ID_KEY = "healthLiteracyVisitorId";

export const DEFAULT_ANALYTICS_OVERVIEW = {
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

export const REVIEW_SOON_AFTER_DAYS = 150;
export const REVIEW_OVERDUE_AFTER_DAYS = 180;
export const LOW_HELPFUL_SCORE_THRESHOLD = 60;
export const PROMOTE_HELPFUL_SCORE_THRESHOLD = 80;
export const PROMOTE_VIEWS_THRESHOLD = 500;
export const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const SEARCH_TOPIC_STOP_WORDS = new Set([
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

export const getAnalyticsSeed = (value) => {
  return String(value ?? "")
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);
};

export const getAnalyticsRegionValue = (contentType, item, index = 0) => {
  const seed = getAnalyticsSeed(`${contentType}-${item.id}-${item.title}`);
  return ANALYTICS_REGIONS[(seed + index) % ANALYTICS_REGIONS.length]?.value ?? "all";
};

export const getHealthLiteracyVisitorId = (userId) => {
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

export const formatNumber = (value) => {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
};

export const formatPercent = (value) => {
  return `${Math.round(value ?? 0)}%`;
};

export const formatAnalyticsTimestamp = (value) => {
  if (!value) return "Not refreshed yet";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not refreshed yet";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export const HELPFUL_SCORE_FORMULA =
  "Helpful Score = Helpful Votes / (Helpful Votes + Not Helpful Votes) x 100";
export const NO_FEEDBACK_LABEL = "No feedback yet";

export const formatHelpfulScore = (helpful, notHelpful) => {
  const helpfulVotes = Number(helpful ?? 0);
  const notHelpfulVotes = Number(notHelpful ?? 0);
  const totalFeedback = helpfulVotes + notHelpfulVotes;

  if (totalFeedback <= 0) return NO_FEEDBACK_LABEL;

  return formatPercent((helpfulVotes / totalFeedback) * 100);
};

export const getAnalyticsCellText = (value) => {
  if (value && typeof value === "object") {
    return value.csvValue ?? value.label ?? value.title ?? "";
  }

  return value ?? "";
};

export const escapeCsvValue = (value) => {
  const text = String(getAnalyticsCellText(value) ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const slugify = (value) => {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

export const getFilterLabel = (options, value) => {
  return options.find((option) => option.value === value)?.label ?? value;
};

export const getRegionLabel = (value) => {
  if (value === "all") return "All regions";
  return ANALYTICS_REGIONS.find((region) => region.value === value)?.label ?? value;
};

export const getRangeStartDate = (timeRange) => {
  const selectedRange = ANALYTICS_TIME_RANGES.find(
    (range) => range.value === timeRange
  );

  if (!selectedRange?.days) return null;

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - selectedRange.days + 1);
  return startDate;
};

export const isWithinTimeRange = (dateValue, timeRange) => {
  const startDate = getRangeStartDate(timeRange);
  if (!startDate || !dateValue) return true;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return true;

  return date >= startDate;
};

export const truncateContentDescription = (value, maxLength = 50) => {
  const description = String(value ?? "").trim();

  if (description.length <= maxLength) return description;

  return `${description.slice(0, maxLength).trimEnd()}....`;
};

export const formatTopicLabel = (value) => {
  return String(value ?? "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export const getContentTopic = (item) => {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const topicLabels = tags.slice(0, 2).map(formatTopicLabel).filter(Boolean);

  if (topicLabels.length === 0) return "Uncategorized";

  return tags.length > 2
    ? `${topicLabels.join(", ")}....`
    : topicLabels.join(", ");
};

export const getContentHelpfulScore = (item) => {
  const totalFeedback = Number(item.helpful ?? 0) + Number(item.notHelpful ?? 0);

  if (totalFeedback <= 0) return 0;

  return (Number(item.helpful ?? 0) / totalFeedback) * 100;
};

export const getContentFeedbackCount = (item) => {
  return Number(item.helpful ?? 0) + Number(item.notHelpful ?? 0);
};

export const getContentShares = (item) => {
  return Number(
    item.shares ??
      item.shareCount ??
      item.sharesCount ??
      item.analytics?.shares ??
      item.metrics?.shares ??
      0
  );
};

export const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

export const getReviewDateValue = (item) => getContentReviewDate(item);

export const formatReviewDate = (value) => {
  if (!value) return "No review date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No review date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

export const formatReviewDateWithAge = (value) => {
  const formattedDate = formatReviewDate(value);
  const daysSinceReview = getDaysSinceReview(value);

  if (daysSinceReview === null) return formattedDate;

  if (daysSinceReview === 0) return `${formattedDate} (today)`;
  if (daysSinceReview === 1) return `${formattedDate} (1 day ago)`;

  return `${formattedDate} (${daysSinceReview} days ago)`;
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

export const getExplicitContentReviewDate = (item) => {
  return (
    item.lastReviewedAt ??
    item.lastReviewed ??
    item.reviewedAt ??
    item.reviewDate
  );
};

export const getNextReviewDueDate = (lastReviewedAt) => {
  if (!lastReviewedAt) return null;

  const date = new Date(lastReviewedAt);
  if (Number.isNaN(date.getTime())) return null;

  return addDays(date, REVIEW_OVERDUE_AFTER_DAYS).toISOString();
};

export const getDaysSinceReview = (lastReviewedAt) => {
  if (!lastReviewedAt) return null;

  const date = new Date(lastReviewedAt);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return Math.floor((today.getTime() - date.getTime()) / DAY_IN_MS);
};

export const getReviewStatus = ({ lastReviewedAt, helpfulScore, views }) => {
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

export const STATUS_STYLES = {
  Good: "bg-[#E7F6EF] text-[#166534] border-[#BBE8D2]",
  "Review Soon": "bg-[#FFF7E6] text-[#92400E] border-[#F8D8A6]",
  Overdue: "bg-[#FEECEC] text-[#B42318] border-[#F8B4B4]",
  "Needs Review": "bg-[#EEF2F6] text-[#475467] border-[#D0D5DD]",
  Improve: "bg-[#FDEAF2] text-[#A2145B] border-[#F8B5D0]",
  Promote: "bg-[#EAF3FF] text-[#175CD3] border-[#B8D7FF]",
  False: "bg-[#FEECEC] text-[#B42318] border-[#F8B4B4]",
  Misleading: "bg-[#FFF7E6] text-[#92400E] border-[#F8D8A6]",
  Verified: "bg-[#E7F6EF] text-[#166534] border-[#BBE8D2]",
  "Needs Expert Review": "bg-[#EEF2F6] text-[#475467] border-[#D0D5DD]",
  "Up to Date": "bg-[#E7F6EF] text-[#166534] border-[#BBE8D2]",
  "Needs Update": "bg-[#FEECEC] text-[#B42318] border-[#F8B4B4]",
};

export const buildContentPerformanceRows = (rows) => {
  return rows
    .slice()
    .sort((a, b) => b.views - a.views)
    .map((item) => {
      const helpfulScore = getContentHelpfulScore(item);
      const lastReviewedAt = getReviewDateValue(item);
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

export const downloadCsv = ({ filename, title, filters, columns, rows }) => {
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

const getContentMetric = (item, keys) => {
  const value = keys
    .flatMap((key) => [item[key], item.analytics?.[key], item.metrics?.[key]])
    .find((entry) => entry !== undefined && entry !== null && entry !== "");
  const metric = Number(value ?? 0);

  return Number.isFinite(metric) ? metric : 0;
};

export const normalizeContentForAnalytics = (content, contentType) => {
  return normalizeApiContent(content).map((item) => {
    const lastReviewedAt = getContentReviewDate(item);

    return {
      ...item,
      contentType,
      region: getAnalyticsRegionValue(contentType, item),
      lastReviewedAt,
      analyticsDate:
        item.analyticsDate ??
        item.analytics?.analyticsDate ??
        item.metrics?.analyticsDate ??
        lastReviewedAt ??
        item.createdAt,
      views: getContentMetric(item, ["views", "viewCount", "viewsCount"]),
      clicks: getContentMetric(item, ["clicks", "clickCount", "clicksCount"]),
      completions: getContentMetric(item, [
        "completions",
        "completionCount",
        "completionsCount",
      ]),
      helpful: getContentMetric(item, ["helpful", "helpfulVotes"]),
      notHelpful: getContentMetric(item, ["notHelpful", "notHelpfulVotes"]),
      shares: getContentShares(item),
      factChecks: getContentMetric(item, [
        "factChecks",
        "factCheckCount",
        "factChecksCount",
      ]),
    };
  });
};

export const contentHasMedia = (item) => {
  return Boolean(item.media?.url || item.media?.dataUrl || item.media || item.thumbnail);
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

export const getReviewIssues = (item) => {
  const issues = [];

  if (item.isArchived) return issues;

  if (!String(item.title ?? "").trim()) issues.push("Missing title");
  if (!String(item.description ?? "").trim()) issues.push("Missing description");
  if (!contentHasMedia(item)) issues.push("Missing media");
  if (!item.publishToMobile && !item.publishToWebsite) {
    issues.push("No publish target");
  }

  return issues;
};

export const getReviewReasons = (item) => {
  if (item.isArchived) return [];

  const reasons = [...getReviewIssues(item)];
  const lastReviewedAt = getExplicitContentReviewDate(item);
  const daysSinceReview = getDaysSinceReview(lastReviewedAt);
  const feedbackCount = getContentFeedbackCount(item);
  const helpfulScore = getContentHelpfulScore(item);

  if (!lastReviewedAt || daysSinceReview === null) {
    reasons.push("No review date");
  } else if (daysSinceReview > REVIEW_OVERDUE_AFTER_DAYS) {
    reasons.push(`Overdue review (${daysSinceReview} days)`);
  }

  if (feedbackCount > 0 && helpfulScore < LOW_HELPFUL_SCORE_THRESHOLD) {
    reasons.push(`Low helpful score (${formatPercent(helpfulScore)})`);
  }

  return [...new Set(reasons)];
};

export const filterAnalyticsRows = (rows, filters) => {
  return rows.filter((row) => {
    const matchesType =
      filters.contentType === "all" || row.contentType === filters.contentType;
    const matchesRegion = filters.region === "all" || row.region === filters.region;
    const matchesDate = isWithinTimeRange(row.analyticsDate ?? row.date, filters.timeRange);

    return matchesType && matchesRegion && matchesDate;
  });
};

export const parseAnalyticsBoolean = (value, fallback = false) => {
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

export const normalizeSearchTopicAnalyticsRows = (apiRows = []) => {
  const sourceRows = Array.isArray(apiRows) ? apiRows : [];

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
    };

    return normalizedItem;
  });
};

export const tokenizeSearchTopic = (value) => {
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

export const getRelatedContentMatches = (searchItem, contentRows, limit = 5) => {
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

export const buildTopSearchTopicItems = (rows) => {
  const topicTotals = rows.reduce((totals, row) => {
    const label = row.topic || row.term;
    totals[label] = (totals[label] ?? 0) + Number(row.searchCount ?? 0);
    return totals;
  }, {});

  return Object.entries(topicTotals)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
};

export const buildTopContentTagItems = (rows) => {
  const tagTotals = rows.reduce((totals, row) => {
    normalizeContentTags(row.tags).forEach((tag) => {
      totals[tag] = (totals[tag] ?? 0) + 1;
    });

    return totals;
  }, {});

  return Object.entries(tagTotals)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
};

export const buildSearchTopicReportRows = (searchRows, contentRows) => {
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
    ];
  });
};

export const sumBy = (rows, key) => {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
};

export const REGIONAL_USAGE_TABLE_COLUMNS = [
  "Region",
  "National Views",
  "Views by Region",
  "Top Topic by Region",
  "Helpful Score by Region",
  "Top Searches by Region",
  "No-result Searches by Region",
];

export const REGIONAL_USAGE_EMPTY_MESSAGE =
  "Regional usage data will appear once mobile and website analytics integrations are available.";

const getRegionalUsageNumber = (item, keys) => {
  const value = keys
    .map((key) => item[key])
    .find((entry) => entry !== undefined && entry !== null && entry !== "");

  return Number(value ?? 0);
};

const formatRegionalUsageList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        const label = item.term ?? item.searchTerm ?? item.topic ?? item.label;
        const count = item.count ?? item.searchCount ?? item.searches;
        return count !== undefined && count !== null
          ? `${label} (${formatNumber(count)})`
          : label;
      })
      .filter(Boolean)
      .join("; ");
  }

  return value ?? "";
};

const getRegionalUsageText = (item, keys) => {
  return (
    keys
      .map((key) => item[key])
      .find((entry) => entry !== undefined && entry !== null && entry !== "") ?? ""
  );
};

const mergeRegionalUsageText = (currentValue, nextValue) => {
  if (!nextValue) return currentValue;
  if (!currentValue) return String(nextValue);

  return [...new Set(`${currentValue}; ${nextValue}`.split(";").map((item) => item.trim()))]
    .filter(Boolean)
    .join("; ");
};

const formatRegionalUsageHelpfulScore = (value, helpful, notHelpful) => {
  if (value !== "") {
    return typeof value === "number" ? formatPercent(value) : String(value);
  }

  return formatHelpfulScore(helpful, notHelpful);
};

const getRegionalUsageRegionValue = (item) => {
  const rawRegion =
    item.regionValue ??
    item.region_code ??
    item.regionCode ??
    item.region ??
    item.regionName;

  const matchingRegion = ANALYTICS_REGIONS.find(
    (region) =>
      region.value === rawRegion ||
      region.label === rawRegion ||
      region.label.toLowerCase() === String(rawRegion ?? "").toLowerCase()
  );

  return matchingRegion?.value ?? rawRegion;
};

export const normalizeRegionalUsageAnalyticsRows = (
  analyticsRows = [],
  regionFilter = "all"
) => {
  const sourceRows = Array.isArray(analyticsRows) ? analyticsRows : [];
  const normalizedRows = sourceRows
    .map((item) => {
      const regionValue = getRegionalUsageRegionValue(item);
      const helpful = getRegionalUsageNumber(item, ["helpful", "helpfulVotes"]);
      const notHelpful = getRegionalUsageNumber(item, [
        "notHelpful",
        "notHelpfulVotes",
      ]);
      const explicitHelpfulScore = getRegionalUsageText(item, [
        "helpfulScore",
        "helpful_score",
        "helpfulScoreByRegion",
      ]);

      return {
        region: getRegionLabel(regionValue),
        regionValue,
        nationalViews: getRegionalUsageNumber(item, [
          "nationalViews",
          "national_views",
          "totalNationalViews",
        ]),
        regionalViews: getRegionalUsageNumber(item, [
          "regionalViews",
          "regional_views",
          "viewsByRegion",
          "views",
        ]),
        topTopic: getRegionalUsageText(item, [
          "topTopic",
          "top_topic",
          "topTopicByRegion",
          "topic",
        ]),
        helpfulScore: formatRegionalUsageHelpfulScore(
          explicitHelpfulScore,
          helpful,
          notHelpful
        ),
        helpful,
        notHelpful,
        explicitHelpfulScore,
        topSearches: formatRegionalUsageList(
          getRegionalUsageText(item, [
            "topSearches",
            "top_searches",
            "topSearchesByRegion",
          ])
        ),
        noResultSearches: formatRegionalUsageList(
          getRegionalUsageText(item, [
            "noResultSearches",
            "no_result_searches",
            "noResultSearchesByRegion",
          ])
        ),
      };
    })
    .filter(
      (item) =>
        item.regionValue &&
        item.regionValue !== "all" &&
        (regionFilter === "all" || item.regionValue === regionFilter)
    );

  return [
    ...normalizedRows
      .reduce((regions, item) => {
        const current = regions.get(item.regionValue) ?? {
          region: item.region,
          regionValue: item.regionValue,
          nationalViews: 0,
          regionalViews: 0,
          topTopic: "",
          helpful: 0,
          notHelpful: 0,
          explicitHelpfulScore: "",
          topSearches: "",
          noResultSearches: "",
        };

        current.nationalViews += item.nationalViews;
        current.regionalViews += item.regionalViews;
        current.topTopic = mergeRegionalUsageText(current.topTopic, item.topTopic);
        current.helpful += item.helpful;
        current.notHelpful += item.notHelpful;
        current.explicitHelpfulScore =
          current.explicitHelpfulScore || item.explicitHelpfulScore;
        current.topSearches = mergeRegionalUsageText(
          current.topSearches,
          item.topSearches
        );
        current.noResultSearches = mergeRegionalUsageText(
          current.noResultSearches,
          item.noResultSearches
        );

        regions.set(item.regionValue, current);
        return regions;
      }, new Map())
      .values(),
  ].map((item) => ({
    region: item.region,
    regionValue: item.regionValue,
    nationalViews: item.nationalViews,
    regionalViews: item.regionalViews,
    topTopic: item.topTopic,
    helpfulScore: formatRegionalUsageHelpfulScore(
      item.explicitHelpfulScore,
      item.helpful,
      item.notHelpful
    ),
    topSearches: item.topSearches,
    noResultSearches: item.noResultSearches,
  }));
};

export const buildRegionalUsageRows = (regionalUsageAnalytics = [], filters = {}) => {
  const regionalRows = normalizeRegionalUsageAnalyticsRows(
    regionalUsageAnalytics,
    filters.region
  );

  return regionalRows.map((item) => [
    item.region,
    formatNumber(item.nationalViews),
    formatNumber(item.regionalViews),
    item.topTopic,
    item.helpfulScore,
    item.topSearches,
    item.noResultSearches,
  ]);
};

export const buildReviewQueueRows = (rows) => {
  return rows
    .map((item) => ({
      id: item.id,
      title: item.title || "Untitled content",
      contentType: item.contentType,
      contentTypeKey: TAB_CONTENT_TYPES[item.contentType],
      region: getRegionLabel(item.region),
      reasons: getReviewReasons(item),
      lastReviewedAt: getExplicitContentReviewDate(item),
      lastReviewDate: formatReviewDateWithAge(getExplicitContentReviewDate(item)),
      assignedReviewer: item.assignedReviewer || "Unassigned",
      item,
      source: "Live content",
    }))
    .filter((item) => item.reasons.length > 0);
};

export const buildAnalyticsReport = ({
  activeTab,
  rows,
  filters,
  overviewAnalytics = DEFAULT_ANALYTICS_OVERVIEW,
  factCheckAnalytics = [],
  regionalUsageAnalytics = [],
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
  const reviewRows = buildReviewQueueRows(rows);
  const searchRows = filterAnalyticsRows(normalizeSearchTopicAnalyticsRows(), filters);

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
      ],
      rows: buildSearchTopicReportRows(searchRows, rows),
      filterLabels,
    };
  }

  if (activeTab === "helpful") {
    return {
      columns: ["Title", "Type", "Region", "Helpful", "Not Helpful", "Helpful Score"],
      rows: rows.map((item) => [
        item.title,
        item.contentType,
        getRegionLabel(item.region),
        item.helpful,
        item.notHelpful,
        formatHelpfulScore(item.helpful, item.notHelpful),
      ]),
      filterLabels,
    };
  }

  if (activeTab === "fact-check") {
    return {
      columns: [
        "Claim",
        "Claim Status",
        "Views",
        "Helpful Score",
        "Shares",
        "Verified by",
        "Last Reviewed Date",
        "Review Status",
      ],
      rows: factCheckAnalytics.map((item) => [
        item.claim,
        {
          type: "status",
          label: item.claimStatus,
          csvValue: item.claimStatus,
          className:
            STATUS_STYLES[item.claimStatus] ?? STATUS_STYLES["Needs Expert Review"],
        },
        formatNumber(item.views),
        formatHelpfulScore(item.helpful, item.notHelpful),
        formatNumber(item.shares),
        item.verifiedBy,
        item.lastReviewedDate,
        {
          type: "status",
          label: item.reviewStatus,
          csvValue: item.reviewStatus,
          className:
            STATUS_STYLES[item.reviewStatus] ?? STATUS_STYLES["Needs Update"],
        },
      ]),
      filterLabels,
    };
  }

  if (activeTab === "regional-usage") {
    return {
      columns: REGIONAL_USAGE_TABLE_COLUMNS,
      rows: buildRegionalUsageRows(regionalUsageAnalytics, filters),
      filterLabels,
    };
  }

  if (activeTab === "review-queue") {
    return {
      columns: [
        "Content Title",
        "Reason for Review",
        "Last Review Date",
        "Assigned Reviewer",
      ],
      rows: reviewRows.map((item) => [
        item.title,
        item.reasons.join("; "),
        item.lastReviewDate,
        item.assignedReviewer,
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

export const showToast = ({ color, iconName, message }) => {
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
    tags: normalizeContentTags(item.tags),
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

  return UPLOAD_RULES[activeTab].allowedTypes.some((allowedType) =>
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

  if (normalizeContentTags(formData.tags).length === 0) {
    return "Please select at least one tag";
  }

  if (normalizeContentTags(formData.tags).length > HEALTH_LITERACY_TAG_LIMIT) {
    return `Please select up to ${HEALTH_LITERACY_TAG_LIMIT} tags only`;
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





