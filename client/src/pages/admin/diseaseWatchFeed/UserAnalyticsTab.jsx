/* eslint-disable react/prop-types */
import PropTypes from "prop-types";

import { DASHBOARD_METRIC_LABEL_CLASS } from "../dashboardTypography";

const formatNumber = (value) =>
  new Intl.NumberFormat("en-US").format(value ?? 0);

const formatMetricPercentage = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value ?? 0);

const MetricCard = ({ label, metric }) => {
  const isUnavailable =
    metric?.isAvailable === false ||
    metric?.current === null ||
    metric?.current === undefined;

  return (
    <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
      <p className={`${DASHBOARD_METRIC_LABEL_CLASS} mb-[8px]`}>{label}</p>
      <div className="flex items-end justify-between gap-[16px]">
        <h2 className="text-[32px] font-semibold text-gray-800 leading-none">
          {isUnavailable ? "Unavailable" : formatNumber(metric.current)}
        </h2>
        <div className="text-right">
          {isUnavailable ? (
            <p className="text-sm font-semibold text-gray-500">No source</p>
          ) : (
            <p
              className={`text-sm font-semibold ${
                metric.trend === "up" ? "text-green-600" : "text-red-600"
              }`}
            >
              {metric.trend === "up" ? "Up" : "Down"}{" "}
              {formatMetricPercentage(metric.percentage)}%
            </p>
          )}
          <p className="text-xs text-gray-500">
            {isUnavailable
              ? metric?.fallbackReason || "This metric is not tracked yet."
              : "vs previous period"}
          </p>
        </div>
      </div>
    </div>
  );
};

MetricCard.propTypes = {
  label: PropTypes.string.isRequired,
  metric: PropTypes.shape({
    current: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])]),
    fallbackReason: PropTypes.string,
    isAvailable: PropTypes.bool,
    percentage: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])]),
    trend: PropTypes.oneOf(["up", "down", null]),
  }).isRequired,
};

export default function UserAnalyticsTab({
  errorMessage,
  isLoading,
  userAnalytics,
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-[20px]">
        {[0, 1, 2].map((index) => (
          <div
            key={`user-analytics-loading-${index}`}
            className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]"
          >
            <p className={`${DASHBOARD_METRIC_LABEL_CLASS} mb-[8px]`}>
              Loading metric...
            </p>
            <h2 className="text-[32px] font-semibold text-gray-800 leading-none">
              --
            </h2>
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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-[20px]">
      <MetricCard label="Total Users" metric={userAnalytics.totalUsers} />
      <MetricCard label="Alert Open Rate" metric={userAnalytics.alertOpenRate} />
      <MetricCard label="Symptom Reports" metric={userAnalytics.symptomReports} />
    </div>
  );
}

UserAnalyticsTab.propTypes = {
  errorMessage: PropTypes.string,
  isLoading: PropTypes.bool,
  userAnalytics: PropTypes.shape({
    alertOpenRate: PropTypes.shape({
      current: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])])
        .isRequired,
      fallbackReason: PropTypes.string,
      isAvailable: PropTypes.bool,
      percentage: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.oneOf([null]),
      ]).isRequired,
      trend: PropTypes.oneOf(["up", "down", null]).isRequired,
    }).isRequired,
    symptomReports: PropTypes.shape({
      current: PropTypes.number.isRequired,
      percentage: PropTypes.number.isRequired,
      trend: PropTypes.oneOf(["up", "down"]).isRequired,
    }).isRequired,
    totalUsers: PropTypes.shape({
      current: PropTypes.number.isRequired,
      percentage: PropTypes.number.isRequired,
      trend: PropTypes.oneOf(["up", "down"]).isRequired,
    }).isRequired,
  }).isRequired,
};

UserAnalyticsTab.defaultProps = {
  errorMessage: "",
  isLoading: false,
};
