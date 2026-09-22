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
  useGetRegionalAlertSettingsQuery,
  useGetRegionalSymptomSummariesQuery,
  useSaveRegionalAlertSettingsMutation,
  useRunRegionalAlertEvaluationMutation,
  useCancelRegionalAlertMutation,
} from "../../../features/api/diseaseWatchFeedSlice";
import RecentAlertsTab from "./RecentAlertsTab";
import SendAlertModal from "./SendAlertModal";
import RegionalCoverageTab from "./RegionalCoverageTab";
import UserAnalyticsTab from "./UserAnalyticsTab";
import { DASHBOARD_REGION_CODES } from "../dashboardRegions";
import { buildRegionalCoverage } from "./regionalCoverage";
import { buildRecentAlerts } from "./recentAlerts";

const TABS = [
  { id: "recent-alerts", label: "Recent Alerts" },
  { id: "regional-coverage", label: "Regional Coverage" },
  { id: "user-analytics", label: "User Analytics" },
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

export default function DiseaseWatchFeed() {
  const [activeTab, setActiveTab] = useState("recent-alerts");
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [isSendAlertOpen, setIsSendAlertOpen] = useState(false);
  const [cancellingAlertId, setCancellingAlertId] = useState("");
  const [evaluationFeedback, setEvaluationFeedback] = useState(null);
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
  } = useGetMobileSelfReportsExportQuery(
    { format: "json" },
    {
      pollingInterval: activeTab === "recent-alerts" ? 30000 : 0,
      refetchOnMountOrArgChange: true,
    }
  );

  const {
    data: userAnalyticsResponse,
    error: userAnalyticsError,
    isFetching: isUserAnalyticsFetching,
    isLoading: isUserAnalyticsLoading,
  } = useGetDiseaseWatchFeedUserAnalyticsQuery();

  const { data: summariesResponse, error: summariesError, isLoading: isSummariesLoading, isFetching: isSummariesFetching, refetch: refetchRegionalSummaries } =
    useGetRegionalSymptomSummariesQuery(undefined, {
      skip: !canSendAlert,
      refetchOnMountOrArgChange: true,
      // Mobile submissions happen outside this Redux cache. Poll at a bounded
      // interval while Self-Reports is visible, never from a render effect.
      pollingInterval: activeTab === "recent-alerts" ? 30000 : 0,
    });
  const { data: regionalAlertsResponse, error: regionalAlertsError, refetch: refetchRegionalAlerts } =
    useGetRegionalAlertsQuery(undefined, { skip: !canSendAlert, pollingInterval: activeTab === "recent-alerts" ? 30000 : 0 });
  const { data: alertSettingsResponse, isLoading: isSettingsLoading, refetch: refetchAlertSettings } =
    useGetRegionalAlertSettingsQuery(undefined, { skip: !canSendAlert, pollingInterval: activeTab === "recent-alerts" || isSendAlertOpen ? 30000 : 0 });
  const [saveRegionalAlertSettings, { isLoading: isSavingSettings }] = useSaveRegionalAlertSettingsMutation();
  const [runRegionalAlertEvaluation, { isLoading: isEvaluationRunning }] = useRunRegionalAlertEvaluationMutation();
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
    () => buildRegionalCoverage(selfReports),
    [selfReports]
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

  const isRecentAlertsLoading = isSelfReportsLoading || isSelfReportsFetching;
  const isRegionalCoverageLoading =
    isMapPinsLoading ||
    isMapPinsFetching ||
    isSelfReportsLoading ||
    isSelfReportsFetching;
  const regionalCoverageError = mapPinsError || selfReportsError;

  const handleSaveAlertSettings = async (form) => {
    await saveRegionalAlertSettings(form).unwrap();
    setIsSendAlertOpen(false);
  };

  const refreshRegionalAlertData = async () => {
    await Promise.allSettled([
      refetchAlertSettings(),
      refetchRegionalSummaries(),
      refetchRegionalAlerts(),
    ]);
  };

  const handleRunEvaluation = async (intervalMinutes) => {
    setEvaluationFeedback(null);
    try {
      const result = await runRegionalAlertEvaluation({ intervalMinutes }).unwrap();
      setEvaluationFeedback({
        type: "success",
        message: result.message || "Evaluation completed. Settings and alert history have been refreshed.",
      });
    } catch (requestError) {
      setEvaluationFeedback({
        type: "error",
        message: getErrorMessage(requestError, "The evaluation could not be completed. Please try again."),
      });
    } finally {
      await refreshRegionalAlertData();
    }
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
            alertSettings={alertSettingsResponse?.item}
            onRunEvaluation={handleRunEvaluation}
            isEvaluationRunning={isEvaluationRunning}
            evaluationFeedback={evaluationFeedback}
            errorMessage={
              selfReportsError || regionalAlertsError
                ? getErrorMessage(selfReportsError || regionalAlertsError, "Failed to load recent alerts.")
                : ""
            }
            isLoading={isRecentAlertsLoading}
          />
        )}
        {activeTab === "regional-coverage" && (
          <RegionalCoverageTab
            unknownRegionReports={selfReports.filter((report) => !DASHBOARD_REGION_CODES.includes(report.region)).length}
            availableRegions={availableRegions}
            errorMessage={
              regionalCoverageError
                ? getErrorMessage(
                    regionalCoverageError,
                    "Failed to load regional coverage."
                  )
                : ""
            }
            isLoading={isRegionalCoverageLoading}
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
          onSave={handleSaveAlertSettings}
          isSaving={isSavingSettings}
          settings={alertSettingsResponse?.item}
          isLoading={isSettingsLoading}
        />
      )}
    </div>
  );
}
