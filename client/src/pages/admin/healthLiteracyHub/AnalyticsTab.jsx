import { useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toPng } from "html-to-image";
import Icon from "../../../components/Icon";
import {
  useCreateHealthLiteracyAnalyticsEventMutation,
  useFetchHealthLiteracyAnalyticsOverviewQuery,
} from "../../../features/api/healthLiteracyHubSlice";
import { AnalyticsSelect } from "./AnalyticsShared";
import OverviewAnalyticsPage from "./analytics/OverviewAnalyticsPage";
import {
  ANALYTICS_CONTENT_FILTERS,
  ANALYTICS_REGIONS,
  ANALYTICS_TIME_RANGES,
  DEFAULT_ANALYTICS_OVERVIEW,
  buildAnalyticsReport,
  downloadCsv,
  getHealthLiteracyVisitorId,
  showToast,
  slugify,
} from "./shared";
import {
  DASHBOARD_PAGE_SUBTITLE_CLASS,
  DASHBOARD_SECTION_TITLE_CLASS,
} from "../dashboardTypography";

const ANALYTICS_DASHBOARD_LABEL = "Analytics Dashboard";
const ANALYTICS_EXPORT_BUTTON_CLASS = "health-literacy-analytics-export-btn";
const ANALYTICS_EXPORT_ICON_FILL = "#FFFFFF";

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
        <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[16px]">
          <div className="flex flex-col gap-[14px] lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className={DASHBOARD_SECTION_TITLE_CLASS}>
                Health Literacy Analytics
              </h2>
              <p className={`${DASHBOARD_PAGE_SUBTITLE_CLASS} mt-[4px]`}>
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
