/* eslint-disable react/prop-types */
import {
  AnalyticsMetricCard,
  AnalyticsPanel,
  AnalyticsTable,
} from "../AnalyticsShared";
import { formatNumber, formatPercent, sumBy } from "../shared";

const ContentPerformanceAnalyticsPage = ({ rows, report }) => {
  const totalViews = sumBy(rows, "views");
  const totalShares = sumBy(rows, "shares");
  const helpfulVotes = sumBy(rows, "helpful");
  const notHelpfulVotes = sumBy(rows, "notHelpful");
  const totalFeedback = helpfulVotes + notHelpfulVotes;
  const helpfulRate = (helpfulVotes / Math.max(totalFeedback, 1)) * 100;

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="grid grid-cols-1 gap-[12px] md:grid-cols-3">
        <AnalyticsMetricCard label="Total Views" value={formatNumber(totalViews)} />
        <AnalyticsMetricCard
          label="Helpful Score"
          value={formatPercent(helpfulRate)}
        />
        <AnalyticsMetricCard label="Shares" value={formatNumber(totalShares)} />
      </div>
      <AnalyticsPanel title="Content Performance">
        <AnalyticsTable
          columns={report.columns}
          rows={report.rows}
          emptyMessage="No content performance data matches the selected filters."
        />
      </AnalyticsPanel>
    </div>
  );
};

export default ContentPerformanceAnalyticsPage;
