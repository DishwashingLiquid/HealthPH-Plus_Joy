import { useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toPng } from "html-to-image";
import Icon from "../../../components/Icon";
import {
  useCreateHealthLiteracyAnalyticsEventMutation,
  useFetchHealthLiteracyAnalyticsOverviewQuery,
  useFetchHealthLiteracyContentQuery,
  useFetchHealthLiteracyFactCheckAnalyticsQuery,
} from "../../../features/api/healthLiteracyHubSlice";
import { AnalyticsSelect } from "./AnalyticsShared";
import ContentPerformanceAnalyticsPage from "./analytics/ContentPerformanceAnalyticsPage";
import FactCheckUsageAnalyticsPage from "./analytics/FactCheckUsageAnalyticsPage";
import HelpfulAnalyticsPage from "./analytics/HelpfulAnalyticsPage";
import OverviewAnalyticsPage from "./analytics/OverviewAnalyticsPage";
import RegionalUsageAnalyticsPage from "./analytics/RegionalUsageAnalyticsPage";
import ReviewQueueAnalyticsPage from "./analytics/ReviewQueueAnalyticsPage";
import SearchTopicAnalyticsPage from "./analytics/SearchTopicAnalyticsPage";
import {
  ANALYTICS_CONTENT_FILTERS,
  ANALYTICS_REGIONS,
  ANALYTICS_TABS,
  ANALYTICS_TIME_RANGES,
  DEFAULT_ANALYTICS_OVERVIEW,
  buildAnalyticsReport,
  downloadCsv,
  filterAnalyticsRows,
  getHealthLiteracyVisitorId,
  normalizeContentForAnalytics,
  showToast,
  slugify,
} from "./shared";

const AnalyticsTab = () => {
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
    refetch: refetchArticles,
  } = useFetchHealthLiteracyContentQuery("articles");
  const {
    data: videos = [],
    isFetching: isFetchingVideos,
    refetch: refetchVideos,
  } = useFetchHealthLiteracyContentQuery("videos");
  const {
    data: infographics = [],
    isFetching: isFetchingInfographics,
    refetch: refetchInfographics,
  } = useFetchHealthLiteracyContentQuery("infographics");
  const {
    data: overviewAnalytics = DEFAULT_ANALYTICS_OVERVIEW,
    isFetching: isFetchingOverviewAnalytics,
    refetch: refetchOverviewAnalytics,
  } = useFetchHealthLiteracyAnalyticsOverviewQuery(filters);
  const {
    data: factCheckAnalytics = [],
    isFetching: isFetchingFactCheckAnalytics,
    refetch: refetchFactCheckAnalytics,
  } = useFetchHealthLiteracyFactCheckAnalyticsQuery(filters);
  const [createHealthLiteracyAnalyticsEvent] =
    useCreateHealthLiteracyAnalyticsEventMutation();
  const [lastHelpfulRefreshAt, setLastHelpfulRefreshAt] = useState(() => new Date());
  const [isRefreshingHelpfulAnalytics, setIsRefreshingHelpfulAnalytics] =
    useState(false);

  const isFetchingAnalytics =
    isFetchingArticles ||
    isFetchingVideos ||
    isFetchingInfographics ||
    (activeAnalyticsTab === "overview" && isFetchingOverviewAnalytics) ||
    (activeAnalyticsTab === "fact-check" && isFetchingFactCheckAnalytics);
  const activeTabLabel =
    ANALYTICS_TABS.find((tab) => tab.id === activeAnalyticsTab)?.label ??
    "Overview";

  const allContentRows = useMemo(
    () => [
      ...normalizeContentForAnalytics(articles, "Articles"),
      ...normalizeContentForAnalytics(videos, "Videos"),
      ...normalizeContentForAnalytics(infographics, "Infographics"),
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
        factCheckAnalytics,
      }),
    [activeAnalyticsTab, filteredRows, filters, overviewAnalytics, factCheckAnalytics]
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

  const handleRefreshHelpfulAnalytics = async () => {
    setIsRefreshingHelpfulAnalytics(true);

    try {
      await Promise.all([
        refetchArticles(),
        refetchVideos(),
        refetchInfographics(),
        refetchOverviewAnalytics(),
        refetchFactCheckAnalytics(),
      ]);
      setLastHelpfulRefreshAt(new Date());
    } catch (error) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: "Failed to refresh helpful analytics. Please try again.",
      });
    } finally {
      setIsRefreshingHelpfulAnalytics(false);
    }
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

  const renderActiveAnalyticsPage = () => {
    if (activeAnalyticsTab === "content-performance") {
      return <ContentPerformanceAnalyticsPage rows={filteredRows} report={report} />;
    }

    if (activeAnalyticsTab === "search-topic") {
      return <SearchTopicAnalyticsPage filters={filters} report={report} />;
    }

    if (activeAnalyticsTab === "helpful") {
      return (
        <HelpfulAnalyticsPage
          rows={filteredRows}
          report={report}
          onRefreshHelpfulAnalytics={handleRefreshHelpfulAnalytics}
          isRefreshingHelpfulAnalytics={isRefreshingHelpfulAnalytics}
          lastHelpfulRefreshAt={lastHelpfulRefreshAt}
        />
      );
    }

    if (activeAnalyticsTab === "fact-check") {
      return (
        <FactCheckUsageAnalyticsPage
          report={report}
          factCheckAnalytics={factCheckAnalytics}
        />
      );
    }

    if (activeAnalyticsTab === "regional-usage") {
      return <RegionalUsageAnalyticsPage report={report} />;
    }

    if (activeAnalyticsTab === "review-queue") {
      return <ReviewQueueAnalyticsPage rows={filteredRows} report={report} />;
    }

    return <OverviewAnalyticsPage overviewAnalytics={overviewAnalytics} />;
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

      {renderActiveAnalyticsPage()}
    </div>
  );
};



export default AnalyticsTab;
