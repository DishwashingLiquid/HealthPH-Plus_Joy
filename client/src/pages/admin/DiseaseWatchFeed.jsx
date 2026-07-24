import { useEffect, useMemo, useState } from "react";

import {
  AlertDistribution,
  EarlyWarning,
  SymptomReporting,
} from "../../assets/icons/icons";
import {
  useGetDiseaseWatchAlertsQuery,
  useGetDiseaseWatchFilterOptionsQuery,
  useGetDiseaseWatchRegionalCoverageQuery,
  useGetDiseaseWatchTopMetricsQuery,
  useGetDiseaseWatchUserAnalyticsSummaryQuery,
} from "../../features/api/diseaseWatchFeedSlice";
import {
  DASHBOARD_PAGE_SUBTITLE_CLASS,
  DASHBOARD_PAGE_TITLE_CLASS,
} from "./dashboardTypography";
import RecentAlertsTab from "./diseaseWatchFeed/RecentAlertsTab";
import RegionalCoverageTab from "./diseaseWatchFeed/RegionalCoverageTab";
import TopMetricCards from "./diseaseWatchFeed/TopMetricCards";
import UserAnalyticsTab from "./diseaseWatchFeed/UserAnalyticsTab";

const TABS = [
  { id: "recent-alerts", label: "Recent Alerts" },
  { id: "regional-coverage", label: "Regional Coverage" },
  { id: "user-analytics", label: "User Analytics" },
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
    data: alertsResponse,
    error: alertsError,
    isFetching: isAlertsFetching,
    isLoading: isAlertsLoading,
  } = useGetDiseaseWatchAlertsQuery({ limit: 10 });

  const {
    data: regionalCoverageResponse,
    error: regionalCoverageError,
    isFetching: isRegionalCoverageFetching,
    isLoading: isRegionalCoverageLoading,
  } = useGetDiseaseWatchRegionalCoverageQuery();

  const {
    data: userAnalyticsResponse,
    error: userAnalyticsError,
    isFetching: isUserAnalyticsFetching,
    isLoading: isUserAnalyticsLoading,
  } = useGetDiseaseWatchUserAnalyticsSummaryQuery();

  const {
    data: topMetricsResponse,
    error: topMetricsError,
    isFetching: isTopMetricsFetching,
    isLoading: isTopMetricsLoading,
  } = useGetDiseaseWatchTopMetricsQuery();

  const { data: filterOptionsResponse } = useGetDiseaseWatchFilterOptionsQuery();

  const alerts = alertsResponse?.items || [];
  const regionUserData = useMemo(
    () => regionalCoverageResponse?.regions || [],
    [regionalCoverageResponse?.regions]
  );
  const userAnalytics = userAnalyticsResponse || EMPTY_USER_ANALYTICS;

  const availableRegions = useMemo(() => {
    const fetchedRegions = filterOptionsResponse?.regions || [];

    if (fetchedRegions.length > 0) {
      return fetchedRegions;
    }

    return regionUserData.map((region) => region.region);
  }, [filterOptionsResponse?.regions, regionUserData]);

  useEffect(() => {
    if (availableRegions.length === 0) {
      return;
    }

    setSelectedRegions((currentRegions) =>
      currentRegions.filter((region) => availableRegions.includes(region))
    );
  }, [availableRegions]);

  const topMetricCards = useMemo(
    () =>
      (topMetricsResponse?.cards || []).map((card) => ({
        ...card,
        ...TOP_METRIC_CARD_META[card.key],
      })),
    [topMetricsResponse?.cards]
  );

  return (
    <div className="flex flex-col gap-[20px]">
      <div>
        <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>Disease Watch Feed</h1>
        <p className={`${DASHBOARD_PAGE_SUBTITLE_CLASS} mt-[4px]`}>
          Real-time disease alerts, regional coverage analytics, and user
          engagement metrics.
        </p>
      </div>

      <TopMetricCards
        cards={topMetricCards}
        errorMessage={
          topMetricsError
            ? getErrorMessage(topMetricsError, "Failed to load top metrics.")
            : ""
        }
        isLoading={isTopMetricsLoading || isTopMetricsFetching}
      />

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
              alertsError
                ? getErrorMessage(alertsError, "Failed to load recent alerts.")
                : ""
            }
            isLoading={isAlertsLoading || isAlertsFetching}
          />
        )}
        {activeTab === "regional-coverage" && (
          <RegionalCoverageTab
            availableRegions={availableRegions}
            errorMessage={
              regionalCoverageError
                ? getErrorMessage(
                    regionalCoverageError,
                    "Failed to load regional coverage."
                  )
                : ""
            }
            isLoading={
              isRegionalCoverageLoading || isRegionalCoverageFetching
            }
            onRegionChange={handleRegionChange}
            regionUserData={regionUserData}
            selectedRegions={selectedRegions}
          />
        )}
        {activeTab === "user-analytics" && (
          <UserAnalyticsTab
            errorMessage={
              userAnalyticsError
                ? getErrorMessage(
                    userAnalyticsError,
                    "Failed to load user analytics."
                  )
                : ""
            }
            isLoading={isUserAnalyticsLoading || isUserAnalyticsFetching}
            userAnalytics={userAnalytics}
          />
        )}
      </div>
    </div>
  );
}
