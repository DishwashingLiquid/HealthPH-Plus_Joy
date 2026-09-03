import { useEffect, useMemo, useState } from "react";

import {
  AlertDistribution,
  EarlyWarning,
  SymptomReporting,
} from "../../../assets/icons/icons";
import {
  useGetMobileSelfReportsExportQuery,
  useGetMobileSelfReportsMapPinsQuery,
} from "../../../features/api/diseaseWatchFeedSlice";
import RecentAlertsTab from "./RecentAlertsTab";
import RegionalCoverageTab from "./RegionalCoverageTab";
import UserAnalyticsTab from "./UserAnalyticsTab";

const TABS = [
  { id: "recent-alerts", label: "Recent Alerts" },
  { id: "regional-coverage", label: "Regional Coverage" },
  { id: "user-analytics", label: "User Analytics" },
];

const REGION_ORDER = [
  "NCR",
  "I",
  "II",
  "III",
  "IVA",
  "IVB",
  "V",
  "CAR",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "BARMM",
];

const TOP_METRIC_CARD_META = {
  "alert-distribution": {
    icon: AlertDistribution,
    iconColor: "#ef4444",
  },
  "early-warning": {
    icon: EarlyWarning,
    iconColor: "#f59e0b",
  },
  "symptom-report": {
    icon: SymptomReporting,
    iconColor: "#3b82f6",
  },
};

const EMPTY_USER_ANALYTICS = {
  totalUsers: {
    current: 0,
    previous: 0,
    change: 0,
    percentage: 0,
    trend: "up",
  },
  alertOpenRate: {
    current: null,
    previous: null,
    change: null,
    percentage: null,
    trend: null,
    isAvailable: false,
    fallbackReason: "No alert-open source available.",
  },
  symptomReports: {
    current: 0,
    previous: 0,
    change: 0,
    percentage: 0,
    trend: "up",
  },
};

const sortRegions = (regions) =>
  [...regions].sort((left, right) => {
    const leftIndex = REGION_ORDER.indexOf(left);
    const rightIndex = REGION_ORDER.indexOf(right);
    const normalizedLeftIndex = leftIndex === -1 ? REGION_ORDER.length : leftIndex;
    const normalizedRightIndex =
      rightIndex === -1 ? REGION_ORDER.length : rightIndex;

    if (normalizedLeftIndex !== normalizedRightIndex) {
      return normalizedLeftIndex - normalizedRightIndex;
    }

    return left.localeCompare(right);
  });

const getErrorMessage = (error, fallback) => {
  const detail = error?.data?.detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.error || item?.message || item?.field)
      .filter(Boolean)
      .join(", ");
  }

  if (typeof detail === "string") {
    return detail;
  }

  return error?.error || fallback;
};

const formatNumber = (value) =>
  new Intl.NumberFormat("en-US").format(value ?? 0);

const renderTopMetricCards = (cards, errorMessage, isLoading) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-[10px] xl:grid-cols-3">
        {[0, 1, 2].map((cardIndex) => (
          <div
            key={`top-metric-loading-${cardIndex}`}
            className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]"
          >
            <p className="text-gray-500 text-sm mb-[8px]">Loading metric...</p>
            <h2 className="text-[32px] font-semibold text-gray-800 leading-none">
              --
            </h2>
            <p className="text-xs text-gray-500 mt-[4px]">
              Refreshing disease watch totals
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-[12px] border border-[#F2CACA] bg-[#FFF6F6] px-[20px] py-[18px] text-sm text-[#B42318]">
        {errorMessage}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-[12px] border border-[#E5E5E5] bg-white px-[20px] py-[18px] text-sm text-gray-500">
        No top metrics are available yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-[10px] xl:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm mb-[8px]">{card.label}</p>
              <h2 className="text-[32px] font-semibold text-gray-800 leading-none">
                {formatNumber(card.value)}
              </h2>
              <p className="text-xs text-gray-500 mt-[4px]">{card.helper}</p>
            </div>
            <div
              className="flex h-[40px] w-[40px] shrink-0 items-center justify-center"
              style={{ color: card.iconColor }}
            >
              <card.icon aria-hidden="true" className="h-[34px] w-[34px]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const toDate = (value) => {
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const buildMetricSummary = (current, previous) => {
  const change = current - previous;
  let percentage = 0;

  if (previous) {
    percentage = Math.abs((change / previous) * 100);
  } else if (current) {
    percentage = 100;
  }

  return {
    current,
    previous,
    change,
    percentage: Math.round(percentage * 10) / 10,
    trend: change >= 0 ? "up" : "down",
  };
};

const buildLocationLookup = (mapPins) =>
  new Map(mapPins.map((pin) => [pin.id, pin]));

const buildRecentAlerts = (reports, locationLookup) => {
  const dedupeKeys = new Set();
  const alerts = [];

  reports.forEach((report) => {
    const mapPin = locationLookup.get(report.id);
    if (!mapPin) {
      return;
    }

    const canonicalSymptoms = [...(report.symptomIds || [])].sort();
    const dedupeKey = `${report.id}:${canonicalSymptoms.join("|")}`;
    if (dedupeKeys.has(dedupeKey)) {
      return;
    }

    dedupeKeys.add(dedupeKey);

    const symptomLabels = report.symptomLabels || mapPin.tags || [];
    const locationLabel = mapPin.name || "Unknown region";
    const diseaseLabel =
      mapPin.disease || report.possibleConditionLabel || "Respiratory symptoms reported";

    alerts.push({
      id: report.id,
      disease: diseaseLabel,
      region: locationLabel,
      type: "Symptom Report",
      timestamp: report.createdAt,
      summary: `Self-reported ${symptomLabels.slice(0, 3).join(", ") || "respiratory symptoms"} in ${locationLabel}.`,
      summarySegments: [
        { type: "text", value: "Self-reported " },
        {
          type: "entity",
          label: symptomLabels.slice(0, 3).join(", ") || "respiratory symptoms",
          tone: "symptom",
        },
        { type: "text", value: " in " },
        { type: "entity", label: locationLabel, tone: "location" },
        { type: "text", value: "." },
      ],
    });
  });

  return alerts.slice(0, 10);
};

const buildRegionalCoverage = (reports, locationLookup) => {
  const regionMap = new Map();

  reports.forEach((report) => {
    const mapPin = locationLookup.get(report.id);
    const region = mapPin?.name;
    if (!region) {
      return;
    }

    if (!regionMap.has(region)) {
      regionMap.set(region, {
        region,
        reporterIds: new Set(),
        reportCount: 0,
      });
    }

    const regionEntry = regionMap.get(region);
    regionEntry.reportCount += 1;
    regionEntry.reporterIds.add(report.mobileReporterId || report.id);
  });

  const totalDistinctReporters = [...regionMap.values()].reduce(
    (count, regionEntry) => count + regionEntry.reporterIds.size,
    0
  );

  return sortRegions([...regionMap.keys()]).map((region) => {
    const regionEntry = regionMap.get(region);
    const mobileReporterCount = regionEntry?.reporterIds.size || 0;
    const reportCount = regionEntry?.reportCount || 0;

    return {
      region,
      users: mobileReporterCount,
      percentage: totalDistinctReporters
        ? Math.round((mobileReporterCount / totalDistinctReporters) * 100)
        : 0,
      alertCount: reportCount,
      reportCount,
    };
  });
};

const buildTopMetricCards = (reports, locationLookup) => {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 7);

  const clusterCounts = new Map();
  let symptomReportCount = 0;

  reports.forEach((report) => {
    const createdAt = toDate(report.createdAt);
    if (!createdAt || createdAt < windowStart || createdAt > now) {
      return;
    }

    const mapPin = locationLookup.get(report.id);
    const region = mapPin?.name;
    const diseaseId = mapPin?.diseaseId || report.possibleConditionId;
    if (!region || !diseaseId) {
      return;
    }

    symptomReportCount += 1;
    const clusterKey = `${region}:${diseaseId}`;
    clusterCounts.set(clusterKey, (clusterCounts.get(clusterKey) || 0) + 1);
  });

  const alertDistributionCount = [...clusterCounts.values()].filter(
    (count) => count >= 2
  ).length;
  const earlyWarningCount = [...clusterCounts.values()].filter(
    (count) => count >= 5
  ).length;

  return [
    {
      key: "alert-distribution",
      label: "Alert Distribution",
      value: alertDistributionCount,
      helper: "condition clusters with 2+ self-reports",
    },
    {
      key: "early-warning",
      label: "Early Warning",
      value: earlyWarningCount,
      helper: "condition clusters with 5+ self-reports",
    },
    {
      key: "symptom-report",
      label: "Symptom Report",
      value: symptomReportCount,
      helper: "mobile self-reports submitted in the last 7 days",
    },
  ];
};

const buildUserAnalytics = (reports) => {
  const now = new Date();
  const currentFrom = new Date(now);
  currentFrom.setDate(currentFrom.getDate() - 30);
  const previousTo = new Date(currentFrom);
  const previousFrom = new Date(currentFrom);
  previousFrom.setDate(previousFrom.getDate() - 30);

  const distinctCurrentUsers = new Set();
  const distinctPreviousUsers = new Set();
  let currentSymptomReports = 0;
  let previousSymptomReports = 0;

  reports.forEach((report) => {
    const createdAt = toDate(report.createdAt);
    const reporterId = report.mobileReporterId || report.id;
    if (!createdAt || !reporterId) {
      return;
    }

    if (createdAt <= now) {
      distinctCurrentUsers.add(reporterId);
    }
    if (createdAt <= previousTo) {
      distinctPreviousUsers.add(reporterId);
    }
    if (createdAt >= currentFrom && createdAt <= now) {
      currentSymptomReports += 1;
    }
    if (createdAt >= previousFrom && createdAt <= previousTo) {
      previousSymptomReports += 1;
    }
  });

  return {
    totalUsers: buildMetricSummary(
      distinctCurrentUsers.size,
      distinctPreviousUsers.size
    ),
    alertOpenRate: EMPTY_USER_ANALYTICS.alertOpenRate,
    symptomReports: buildMetricSummary(
      currentSymptomReports,
      previousSymptomReports
    ),
  };
};

export default function DiseaseWatchFeed() {
  const [activeTab, setActiveTab] = useState("recent-alerts");
  const [selectedRegions, setSelectedRegions] = useState([]);

  const handleRegionChange = (regionName) => {
    setSelectedRegions((currentRegions) =>
      currentRegions.includes(regionName)
        ? currentRegions.filter((region) => region !== regionName)
        : [...currentRegions, regionName]
    );
  };

  const {
    data: mapPinsResponse,
    error: mapPinsError,
    isFetching: isMapPinsFetching,
    isLoading: isMapPinsLoading,
  } = useGetMobileSelfReportsMapPinsQuery();

  const {
    data: selfReportsResponse,
    error: selfReportsError,
    isFetching: isSelfReportsFetching,
    isLoading: isSelfReportsLoading,
  } = useGetMobileSelfReportsExportQuery({ format: "json" });

  const mapPins = mapPinsResponse?.items || [];
  const selfReports = selfReportsResponse?.items || [];

  const locationLookup = useMemo(
    () => buildLocationLookup(mapPins),
    [mapPins]
  );

  const alerts = useMemo(
    () => buildRecentAlerts(selfReports, locationLookup),
    [locationLookup, selfReports]
  );
  const regionUserData = useMemo(
    () => buildRegionalCoverage(selfReports, locationLookup),
    [locationLookup, selfReports]
  );
  const userAnalytics = useMemo(
    () =>
      selfReports.length > 0
        ? buildUserAnalytics(selfReports)
        : EMPTY_USER_ANALYTICS,
    [selfReports]
  );
  const topMetricCards = useMemo(
    () =>
      buildTopMetricCards(selfReports, locationLookup).map((card) => ({
        ...card,
        ...TOP_METRIC_CARD_META[card.key],
      })),
    [locationLookup, selfReports]
  );

  const availableRegions = useMemo(
    () => regionUserData.map((region) => region.region),
    [regionUserData]
  );

  useEffect(() => {
    if (availableRegions.length === 0) {
      return;
    }

    setSelectedRegions((currentRegions) =>
      currentRegions.filter((region) => availableRegions.includes(region))
    );
  }, [availableRegions]);

  const isDashboardLoading =
    isMapPinsLoading ||
    isMapPinsFetching ||
    isSelfReportsLoading ||
    isSelfReportsFetching;
  const sharedError = mapPinsError || selfReportsError;

  return (
    <div className="flex flex-col gap-[10px]">
      <div>
        <h1 className="text-[24px] font-semibold text-gray-800">
          Disease Watch Feed
        </h1>
        <p className="text-[14px] text-gray-500">
          Canonical mobile self-report activity, regional coverage, and mobile
          reporter analytics.
        </p>
      </div>

      {renderTopMetricCards(
        topMetricCards,
        sharedError
          ? getErrorMessage(sharedError, "Failed to load top metrics.")
          : "",
        isDashboardLoading
      )}

      <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[12px]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[8px] bg-[#F5F5F5] rounded-[10px] p-[6px]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-[16px] py-[10px] rounded-[8px] text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[400px]">
        {activeTab === "recent-alerts" && (
          <RecentAlertsTab
            alerts={alerts}
            errorMessage={
              sharedError
                ? getErrorMessage(sharedError, "Failed to load recent alerts.")
                : ""
            }
            isLoading={isDashboardLoading}
          />
        )}
        {activeTab === "regional-coverage" && (
          <RegionalCoverageTab
            availableRegions={availableRegions}
            errorMessage={
              sharedError
                ? getErrorMessage(
                    sharedError,
                    "Failed to load regional coverage."
                  )
                : ""
            }
            isLoading={isDashboardLoading}
            onRegionChange={handleRegionChange}
            regionUserData={regionUserData}
            selectedRegions={selectedRegions}
          />
        )}
        {activeTab === "user-analytics" && (
          <UserAnalyticsTab
            errorMessage={
              sharedError
                ? getErrorMessage(
                    sharedError,
                    "Failed to load user analytics."
                  )
                : ""
            }
            isLoading={isDashboardLoading}
            userAnalytics={userAnalytics}
          />
        )}
      </div>
    </div>
  );
}
