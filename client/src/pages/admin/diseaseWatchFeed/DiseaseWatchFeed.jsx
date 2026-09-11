import { useEffect, useMemo, useState } from "react";

import {
  AlertDistribution,
  EarlyWarning,
  SymptomReporting,
} from "../../../assets/icons/icons";
import {
  useGetDiseaseWatchFeedUserAnalyticsQuery,
  useGetMobileSelfReportsExportQuery,
  useGetMobileSelfReportsMapPinsQuery,
  useGetRegionalAlertsQuery,
  useGetRegionalSymptomSummariesQuery,
  useCreateRegionalAlertMutation,
  useCancelRegionalAlertMutation,
} from "../../../features/api/diseaseWatchFeedSlice";
import RecentAlertsTab from "./RecentAlertsTab";
import SendAlertModal from "./SendAlertModal";
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

const STATIC_SUMMARY_CARDS = [
  {
    title: "Alert Distribution",
    subtitle: "Push notifications for disease outbreaks to targeted regions",
    icon: AlertDistribution,
    iconColor: "#ef4444",
  },
  {
    title: "Early Warning",
    subtitle: "Citizens receive alerts before official announcements",
    icon: EarlyWarning,
    iconColor: "#f59e0b",
  },
  {
    title: "Symptom Reporting",
    subtitle: "Community-driven symptom reporting for early detection",
    icon: SymptomReporting,
    iconColor: "#3b82f6",
  },
];

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

const renderTopMetricCards = () => (
  <div className="grid grid-cols-1 gap-[20px] md:grid-cols-3">
    {STATIC_SUMMARY_CARDS.map((card) => (
      <section
        key={card.title}
        className="min-h-[182px] rounded-[10px] bg-[#F8FAFC] px-[20px] py-[20px] text-center"
      >
        <div
          className="mx-auto flex h-[48px] w-[48px] items-center justify-center"
          style={{ color: card.iconColor }}
        >
          <card.icon aria-hidden="true" className="h-[40px] w-[40px]" />
        </div>
        <h2 className="mt-[12px] text-[18px] font-medium leading-[24px] text-gray-900">
          {card.title}
        </h2>
        <p className="mt-[8px] text-[16px] leading-[24px] text-[#5B7294]">
          {card.subtitle}
        </p>
      </section>
    ))}
  </div>
);

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

  return alerts;
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

export default function DiseaseWatchFeed() {
  const [activeTab, setActiveTab] = useState("recent-alerts");
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [isSendAlertOpen, setIsSendAlertOpen] = useState(false);
  const [cancellingAlertId, setCancellingAlertId] = useState("");
  // Temporary access policy: show alert controls for every dashboard role.
  const canSendAlert = true;

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

  const {
    data: userAnalyticsResponse,
    error: userAnalyticsError,
    isFetching: isUserAnalyticsFetching,
    isLoading: isUserAnalyticsLoading,
  } = useGetDiseaseWatchFeedUserAnalyticsQuery();

  const { data: summariesResponse, error: summariesError, isLoading: isSummariesLoading, isFetching: isSummariesFetching } =
    useGetRegionalSymptomSummariesQuery(undefined, {
      skip: !canSendAlert,
      refetchOnMountOrArgChange: true,
      // Mobile submissions happen outside this Redux cache. Poll at a bounded
      // interval while Self-Reports is visible, never from a render effect.
      pollingInterval: activeTab === "recent-alerts" ? 30000 : 0,
    });
  const { data: regionalAlertsResponse, error: regionalAlertsError } =
    useGetRegionalAlertsQuery(undefined, { skip: !canSendAlert });
  const [createRegionalAlert, { isLoading: isSchedulingAlert }] =
    useCreateRegionalAlertMutation();
  const [cancelRegionalAlert] = useCancelRegionalAlertMutation();

  const mapPins = useMemo(() => mapPinsResponse?.items || [], [mapPinsResponse]);
  const selfReports = useMemo(
    () => selfReportsResponse?.items || [],
    [selfReportsResponse]
  );

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
  const userAnalytics = userAnalyticsResponse || EMPTY_USER_ANALYTICS;
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

  const handleScheduleAlert = async (form) => {
    await createRegionalAlert({
      ...form,
      // datetime-local is entered in Philippine dashboard time. Preserve the
      // exact wall-clock value for the server's Philippine-time scheduler.
      scheduledAt: form.scheduledAt,
    }).unwrap();
    setIsSendAlertOpen(false);
  };

  const handleCancelAlert = async (alertId) => {
    setCancellingAlertId(alertId);
    try {
      await cancelRegionalAlert(alertId).unwrap();
    } finally {
      setCancellingAlertId("");
    }
  };

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

      {renderTopMetricCards()}

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
            summaries={summariesResponse?.items || []}
            isSummariesLoading={isSummariesLoading}
            isSummariesFetching={isSummariesFetching}
            summariesErrorMessage={summariesError ? getErrorMessage(summariesError, "Failed to load regional summaries.") : ""}
            sentAlerts={regionalAlertsResponse?.items || []}
            canSendAlert={canSendAlert}
            onSendAlert={() => setIsSendAlertOpen(true)}
            onCancelAlert={handleCancelAlert}
            cancellingId={cancellingAlertId}
            errorMessage={
              sharedError || regionalAlertsError
                ? getErrorMessage(sharedError || regionalAlertsError, "Failed to load recent alerts.")
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
      {isSendAlertOpen && (
        <SendAlertModal
          onClose={() => setIsSendAlertOpen(false)}
          onSchedule={handleScheduleAlert}
          isScheduling={isSchedulingAlert}
        />
      )}
    </div>
  );
}
