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
    label: "Article Content",
    accept: "",
    helperText: "Text only",
    allowedTypes: [],
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
  duration: "",
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

export const HEALTH_LITERACY_LANGUAGE_LIMIT = 5;

export const HEALTH_LITERACY_LANGUAGE_OPTIONS = [
  "English",
  "Filipino",
  "Cebuano",
  "Ilocano",
  "Hiligaynon",
].map((tag, index) => ({
  value: tag,
  label: tag,
  order: index,
}));

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

export const ANALYTICS_REGIONS = RegionsData.regions;

export const HEALTH_LITERACY_VISITOR_ID_KEY = "healthLiteracyVisitorId";

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

export const DEFAULT_ANALYTICS_OVERVIEW = {
  totalContentInteractions: 0,
  contentPieces: 0,
  engagementRate: 0,
  interactedUsers: 0,
  totalRegisteredUsers: 0,
  topPerformingContent: [],
};

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

export const getTagOptionsWithSelectedTags = () => HEALTH_LITERACY_LANGUAGE_OPTIONS;

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

export const formatVideoDuration = (durationInSeconds) => {
  const totalSeconds = Math.floor(Number(durationInSeconds));

  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = hours > 0 ? String(minutes).padStart(2, "0") : minutes;
  const paddedSeconds = String(seconds).padStart(2, "0");

  return hours > 0
    ? `${hours}:${paddedMinutes}:${paddedSeconds}`
    : `${minutes}:${paddedSeconds}`;
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

export const buildAnalyticsReport = ({
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
  };
  const topPerformingContent = Array.isArray(overview.topPerformingContent)
    ? overview.topPerformingContent
    : [];

  return {
    columns: ["Metric", "Value", "Details"],
    rows: [
      [
        "Total Content Views",
        formatNumber(overview.totalContentInteractions),
        "Views, shares, and downloads from articles, videos, and infographics",
      ],
      [
        "Content Pieces",
        formatNumber(overview.contentPieces),
        "Uploaded articles, videos, and infographics",
      ],
      [
        "Engagement Rate",
        formatPercent(overview.engagementRate),
        `${formatNumber(overview.interactedUsers)} interacted users / ${formatNumber(
          overview.totalRegisteredUsers
        )} active users`,
      ],
      [
        "Misinformation Reports",
        "",
        "Future enhancement",
      ],
      ...topPerformingContent.map((item) => [
        `Top Content #${item.rank}`,
        item.title,
        `${item.contentType} - ${formatPercent(item.engagementRate)} engagement`,
      ]),
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
