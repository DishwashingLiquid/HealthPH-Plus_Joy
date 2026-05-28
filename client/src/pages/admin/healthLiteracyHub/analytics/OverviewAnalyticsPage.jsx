/* eslint-disable react/prop-types */
import { AnalyticsMetricCard } from "../AnalyticsShared";
import {
  DEFAULT_ANALYTICS_OVERVIEW,
  formatNumber,
  formatPercent,
} from "../shared";

const OverviewAnalyticsPage = ({ overviewAnalytics }) => {
  const overview = {
    ...DEFAULT_ANALYTICS_OVERVIEW,
    ...overviewAnalytics,
    topSearchTopic: {
      ...DEFAULT_ANALYTICS_OVERVIEW.topSearchTopic,
      ...overviewAnalytics?.topSearchTopic,
    },
  };

  return (
    <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2 xl:grid-cols-3">
      <AnalyticsMetricCard
        label="People Reached"
        value={formatNumber(overview.peopleReached)}
        detail="Health Literacy Hub content opened"
      />
      <AnalyticsMetricCard
        label="Unique Visitors"
        value={formatNumber(overview.uniqueVisitors)}
        detail="Distinct audience members reached"
      />
      <AnalyticsMetricCard
        label="Top Search Topic"
        value={overview.topSearchTopic.topic}
        detail={`${formatNumber(overview.topSearchTopic.searches)} searches`}
      />
      <AnalyticsMetricCard
        label="Helpful Score"
        value={formatPercent(overview.helpfulScore)}
        detail="Helpful votes divided by total feedback"
      />
      <AnalyticsMetricCard
        label="Needs Review"
        value={formatNumber(overview.needsReview)}
        detail="Content missing review-ready details"
      />
      <AnalyticsMetricCard
        label="Reports Exported"
        value={formatNumber(overview.reportsExported)}
        detail="PDF and CSV report exports"
      />
    </div>
  );
};

export default OverviewAnalyticsPage;
