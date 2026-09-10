/* eslint-disable react/prop-types */
import { useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toPng } from "html-to-image";
import Icon from "../../../components/Icon";
import {
  useCreateHealthLiteracyAnalyticsEventMutation,
  useFetchHealthLiteracyAnalyticsOverviewQuery,
} from "../../../features/api/healthLiteracyHubSlice";
import {
  ANALYTICS_CONTENT_FILTERS,
  ANALYTICS_REGIONS,
  ANALYTICS_TIME_RANGES,
  DEFAULT_ANALYTICS_OVERVIEW,
  buildAnalyticsReport,
  downloadCsv,
  formatNumber,
  formatPercent,
  getHealthLiteracyVisitorId,
  showToast,
  slugify,
} from "./shared";

const ANALYTICS_DASHBOARD_LABEL = "Analytics Dashboard";
const ANALYTICS_EXPORT_BUTTON_CLASS = "health-literacy-analytics-export-btn";
const ANALYTICS_EXPORT_ICON_FILL = "#FFFFFF";

const AnalyticsSelect = ({ label, value, options, onChange }) => {
  return (
    <label className="flex flex-col gap-[6px]">
      <span className="text-[13px] font-semibold text-gray-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[40px] rounded-[10px] border border-[#E5E5E5] bg-white px-[14px] text-[14px] text-gray-800 outline-none focus:border-[#32418C] focus:ring-2 focus:ring-[#D9E3F2]"
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
    <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-[6px] text-[28px] font-semibold leading-none text-gray-800">{value}</p>
      {detail && <p className="mt-[4px] text-[12px] text-gray-500">{detail}</p>}
    </div>
  );
};

const AnalyticsPanel = ({ title, children }) => {
  return (
    <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
      <h3 className="mb-[14px] text-[16px] font-semibold text-gray-800">
        {title}
      </h3>
      {children}
    </div>
  );
};

const getTrendClassName = (trend) => {
  if (trend === "up") return "text-[#166534]";
  if (trend === "down") return "text-[#B42318]";

  return "text-gray-900";
};

const OverviewAnalyticsPage = ({ overviewAnalytics }) => {
  const overview = {
    ...DEFAULT_ANALYTICS_OVERVIEW,
    ...overviewAnalytics,
    topPerformingContent: Array.isArray(overviewAnalytics?.topPerformingContent)
      ? overviewAnalytics.topPerformingContent
      : [],
  };

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2 xl:grid-cols-4">
        <AnalyticsMetricCard
          label="Total Content Views"
          value={formatNumber(overview.totalContentInteractions)}
          detail="Views, shares, and downloads"
        />
        <AnalyticsMetricCard
          label="Content Pieces"
          value={formatNumber(overview.contentPieces)}
          detail="Uploaded articles, videos, and infographics"
        />
        <AnalyticsMetricCard
          label="Engagement Rate"
          value={formatPercent(overview.engagementRate)}
          detail={`${formatNumber(overview.interactedUsers)} of ${formatNumber(
            overview.totalRegisteredUsers
          )} active users`}
        />
        <AnalyticsMetricCard
          label="Misinformation Reports"
          value=""
          detail="Future enhancement"
        />
      </div>

      <AnalyticsPanel title="Top Performing Content">
        {overview.topPerformingContent.length > 0 ? (
          <div className="flex flex-col divide-y divide-[#E5E5E5]">
            {overview.topPerformingContent.map((item) => (
              <div
                key={`${item.contentType}-${item.contentId}`}
                className="flex min-h-[64px] items-center justify-between gap-[16px] py-[12px]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-gray-900">
                    {item.title}
                  </p>
                  <p className="mt-[3px] text-[12px] text-gray-500">
                    {item.contentType}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-right text-[16px] font-semibold ${getTrendClassName(
                    item.trend
                  )}`}
                >
                  {formatPercent(item.engagementRate)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-gray-500">
            No content interactions match the selected filters.
          </p>
        )}
      </AnalyticsPanel>
    </div>
  );
};

const AnalyticsTab = () => {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const reportRef = useRef(null);
  const [filters, setFilters] = useState({
    timeRange: "last-30-days",
    contentType: "all",
    region: "all",
  });

  const {
    data: overviewAnalytics = DEFAULT_ANALYTICS_OVERVIEW,
    isFetching: isFetchingOverviewAnalytics,
  } = useFetchHealthLiteracyAnalyticsOverviewQuery(filters);
  const [createHealthLiteracyAnalyticsEvent] =
    useCreateHealthLiteracyAnalyticsEventMutation();

  const report = useMemo(
    () =>
      buildAnalyticsReport({
        activeTab: "overview",
        rows: [],
        filters,
        overviewAnalytics,
      }),
    [filters, overviewAnalytics]
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
        analyticsTab: "dashboard",
        timeRange: filters.timeRange,
      },
    }).catch(() => {});
  };

  const handleExportCsv = () => {
    recordReportExport("csv");

    downloadCsv({
      filename: `health-literacy-${slugify(ANALYTICS_DASHBOARD_LABEL)}-${Date.now()}.csv`,
      title: `Health Literacy Hub - ${ANALYTICS_DASHBOARD_LABEL}`,
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
            documentTitle: `HealthPH - Health Literacy Hub - ${ANALYTICS_DASHBOARD_LABEL}`,
            imageData,
            log_activity: {
              user_id: user?.id,
              entry: `Generated Health Literacy Hub ${ANALYTICS_DASHBOARD_LABEL} report`,
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
    <>
      <style>
        {`
          .${ANALYTICS_EXPORT_BUTTON_CLASS} {
            background-color: #2a3776;
            border-color: #2a3776;
            color: #ffffff;
            box-shadow: 0px 0px 0px 1px #2a3776, 0px 1px 1px 0px rgba(0, 0, 0, 0.1);
          }

          .${ANALYTICS_EXPORT_BUTTON_CLASS}:hover:not(:active):not(:focus-visible):not(:disabled) {
            background-color: #2a3776;
            border-color: #2a3776;
            color: #ffffff;
            box-shadow: 0px 0px 0px 1px #2a3776, 0px 1px 1px 0px rgba(0, 0, 0, 0.1);
          }
        `}
      </style>
      <div ref={reportRef} className="flex flex-col gap-[16px]">
        <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
          <div className="flex flex-col gap-[14px] lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-[18px] font-semibold text-gray-800">
                Health Literacy Analytics
              </h2>
              <p className="mt-[4px] text-[14px] text-gray-500">
                Monitor content usage, engagement, and top-performing health
                literacy resources.
              </p>
            </div>
            <div className="flex flex-col gap-[8px] sm:flex-row">
              <button
                type="button"
                onClick={handleExportCsv}
                className={`prod-btn-base admin-module-brand-btn ${ANALYTICS_EXPORT_BUTTON_CLASS} flex min-h-[40px] items-center justify-center gap-[8px] px-[14px]`}
              >
                <Icon
                  iconName="Download"
                  height="18px"
                  width="18px"
                  fill={ANALYTICS_EXPORT_ICON_FILL}
                />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className={`prod-btn-base admin-module-brand-btn ${ANALYTICS_EXPORT_BUTTON_CLASS} flex min-h-[40px] items-center justify-center gap-[8px] px-[14px]`}
              >
                <Icon
                  iconName="Printer"
                  height="18px"
                  width="18px"
                  fill={ANALYTICS_EXPORT_ICON_FILL}
                />
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

        {isFetchingOverviewAnalytics && (
          <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[14px] text-[14px] text-gray-500">
            Refreshing analytics data...
          </div>
        )}

        <OverviewAnalyticsPage overviewAnalytics={overviewAnalytics} />
      </div>
    </>
  );
};

export default AnalyticsTab;
