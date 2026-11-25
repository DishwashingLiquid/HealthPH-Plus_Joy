import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";

import {
  AlertDistribution,
  EarlyWarning,
  SymptomReporting,
} from "../../../assets/icons/icons";
import {
  useGetProcessedSelfReportDashboardQuery,
  useGetRegionalAlertsQuery,
  useGetRegionalAlertSettingsQuery,
  useSaveRegionalAlertSettingsMutation,
  useRunRegionalAlertEvaluationMutation,
} from "../../../features/api/diseaseWatchFeedSlice";
import RecentAlertsTab from "./RecentAlertsTab";
import SendAlertModal from "./SendAlertModal";
import RegionalCoverageTab from "./RegionalCoverageTab";
import UserAnalyticsTab from "./UserAnalyticsTab";
import { buildRecentAlerts } from "./recentAlerts";
import { hasDiseaseWatchFeedAccess, hasSavedAlertSettings } from "./alertAutomation";

import { getRequestErrorMessage } from "../../../utils/apiErrorHelpers";

const TABS = [
  { id: "recent-alerts", label: "Recent Alerts" },
  { id: "regional-coverage", label: "Regional Coverage" },
  { id: "user-analytics", label: "User Analytics" },
];

const STATIC_SUMMARY_CARDS = [
  {
    title: "Alert Distribution",
    subtitle: "Regional symptom alerts prepared for assigned app inboxes",
    icon: AlertDistribution,
    iconColor: "#ef4444",
  },
  {
    title: "Early Warning",
    subtitle: "Submitted symptoms support early awareness; they are not confirmed diagnoses",
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

export default function DiseaseWatchFeed() {
  const [activeTab, setActiveTab] = useState("recent-alerts");
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [isSendAlertOpen, setIsSendAlertOpen] = useState(false);
  const [evaluationFeedback, setEvaluationFeedback] = useState(null);
  const user = useSelector((state) => state.auth.user);
  const [accessDenied, setAccessDenied] = useState(false);
  const canView = hasDiseaseWatchFeedAccess(user) && !accessDenied;

  const handleRegionChange = (regionName) => {
    setSelectedRegions((currentRegions) =>
      currentRegions.includes(regionName)
        ? currentRegions.filter((region) => region !== regionName)
        : [...currentRegions, regionName]
    );
  };

  const {
    data: dashboardResponse,
    error: dashboardError,
    isFetching: isDashboardFetching,
    isLoading: isDashboardLoading,
    refetch: refetchDashboard,
  } = useGetProcessedSelfReportDashboardQuery(undefined, {
    skip: !canView,
    pollingInterval: 30000,
    refetchOnMountOrArgChange: true,
  });

  const { data: regionalAlertsResponse, error: regionalAlertsError, isLoading: isHistoryLoading, isFetching: isHistoryFetching, refetch: refetchRegionalAlerts } =
    useGetRegionalAlertsQuery(undefined, { skip: !canView, pollingInterval: activeTab === "recent-alerts" ? 30000 : 0 });
  const { data: alertSettingsResponse, error: settingsError, isLoading: isSettingsLoading, refetch: refetchAlertSettings } =
    useGetRegionalAlertSettingsQuery(undefined, { skip: !canView, refetchOnMountOrArgChange: true, pollingInterval: activeTab === "recent-alerts" || isSendAlertOpen ? 30000 : 0 });
  const [saveRegionalAlertSettings, { isLoading: isSavingSettings }] = useSaveRegionalAlertSettingsMutation();
  const [runRegionalAlertEvaluation, { isLoading: isEvaluationRunning }] = useRunRegionalAlertEvaluationMutation();
  const readForbidden = [dashboardError, regionalAlertsError, settingsError].some((error) => error?.status === 403);
  const canSendAlert = canView && !readForbidden && !settingsError && !isSettingsLoading && hasSavedAlertSettings(alertSettingsResponse?.item);

  useEffect(() => {
    if (readForbidden) setAccessDenied(true);
  }, [readForbidden]);


  const alerts = useMemo(
    () => buildRecentAlerts(dashboardResponse?.items || []),
    [dashboardResponse]
  );
  const regionUserData = useMemo(
    () => dashboardResponse?.regionalCoverage || [],
    [dashboardResponse]
  );
  const userAnalytics = dashboardResponse?.userAnalytics || EMPTY_USER_ANALYTICS;
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

  const isRegionalCoverageLoading = isDashboardLoading;

  const handleSaveAlertSettings = async (form) => {
    if (!canSendAlert) return;
    try {
      await saveRegionalAlertSettings(form).unwrap();
      setIsSendAlertOpen(false);
    } catch (error) {
      if (error?.status === 403) setAccessDenied(true);
      throw error;
    }
  };

  const refreshRegionalAlertData = async () => {
    await Promise.allSettled([
      refetchDashboard(),
      refetchAlertSettings(),
      refetchRegionalAlerts(),
    ]);
  };

  const handleRunEvaluation = async () => {
    if (!canSendAlert || !alertSettingsResponse.item.enabled) return;
    setEvaluationFeedback(null);
    try {
      await runRegionalAlertEvaluation().unwrap();
      setEvaluationFeedback({
        type: "success",
        message: "Reports checked. Alert history is up to date.",
      });
    } catch (requestError) {
      if (requestError?.status === 403) setAccessDenied(true);
      setEvaluationFeedback({
        type: "error",
        message: getRequestErrorMessage(requestError, "Could not check reports. Please try again."),
      });
    } finally {
      await refreshRegionalAlertData();
    }
  };

  if (!canView || readForbidden) {
    return <p role="alert" className="rounded-xl border border-red-200 bg-white p-5 text-sm text-red-700">Disease Watch Feed access is unavailable for your account.</p>;
  }

  return (
    <div className="flex flex-col gap-[10px]">
      <div>
        <h1 className="text-[24px] font-semibold text-gray-800">
          Disease Watch Feed
        </h1>
        <p className="text-[14px] text-gray-500">
          Processed self-reports, regional coverage, and submitter activity from the last 30 days.
        </p>
      </div>

      {isDashboardFetching && !isDashboardLoading && <p className="text-xs text-gray-500">Refreshing report results...</p>}
      {activeTab !== "recent-alerts" && renderTopMetricCards()}

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
            sentAlerts={regionalAlertsResponse?.items || []}
            canSendAlert={canSendAlert}
            settingsErrorMessage={settingsError ? getRequestErrorMessage(settingsError, "Failed to load saved alert settings.") : !isSettingsLoading && !hasSavedAlertSettings(alertSettingsResponse?.item) ? "Saved alert settings are unavailable." : ""}
            isSettingsLoading={isSettingsLoading}
            onRetrySettings={refetchAlertSettings}
            onSendAlert={() => setIsSendAlertOpen(true)}
            alertSettings={alertSettingsResponse?.item}
            onRunEvaluation={handleRunEvaluation}
            isEvaluationRunning={isEvaluationRunning}
            evaluationFeedback={evaluationFeedback}
            hasReportsData={dashboardResponse !== undefined}
            hasHistoryData={regionalAlertsResponse !== undefined}
            isReportsLoading={isDashboardLoading}
            isReportsFetching={isDashboardFetching}
            isHistoryLoading={isHistoryLoading}
            isHistoryFetching={isHistoryFetching}
            reportsErrorMessage={dashboardError ? getRequestErrorMessage(dashboardError, "Failed to load processed reports.") : ""}
            historyErrorMessage={regionalAlertsError ? getRequestErrorMessage(regionalAlertsError, "Failed to load alert history.") : ""}
            onRetryReports={refetchDashboard}
            onRetryHistory={refetchRegionalAlerts}
          />
        )}
        {activeTab === "regional-coverage" && (
          <RegionalCoverageTab
            unknownRegionReports={dashboardResponse?.totals?.unknownRegionReports || 0}
            availableRegions={availableRegions}
            errorMessage={
              dashboardError
                ? getRequestErrorMessage(
                    dashboardError,
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
              dashboardError
                ? getRequestErrorMessage(
                    dashboardError,
                    "Failed to load user analytics."
                  )
                : ""
            }
            isLoading={isDashboardLoading}
            userAnalytics={userAnalytics}
          />
        )}
      </div>
      {isSendAlertOpen && canSendAlert && (
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
