/* eslint-disable react/prop-types */
import { AnalyticsMetricCard, AnalyticsPanel } from "../AnalyticsShared";
import {
  DEFAULT_ANALYTICS_OVERVIEW,
  formatNumber,
  formatPercent,
} from "../shared";

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

export default OverviewAnalyticsPage;
