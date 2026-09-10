import {
  ANALYTICS_CONTENT_FILTERS,
  ANALYTICS_REGIONS,
  ANALYTICS_TIME_RANGES,
  DEFAULT_ANALYTICS_OVERVIEW,
  HEALTH_LITERACY_VISITOR_ID_KEY,
} from "./sharedConfig";
import {
  formatNumber,
  formatPercent,
  getFilterLabel,
  getRegionLabel,
} from "./sharedFormatting";

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
