/* eslint-disable react/prop-types */
import {
  AnalyticsBarList,
  AnalyticsMetricCard,
  AnalyticsPanel,
  AnalyticsTable,
} from "../AnalyticsShared";
import {
  buildTopContentTagItems,
  formatNumber,
  formatPercent,
  sumBy,
} from "../shared";

const ContentPerformanceAnalyticsPage = ({ rows, report }) => {
  const totalViews = sumBy(rows, "views");
  const totalShares = sumBy(rows, "shares");
  const helpfulVotes = sumBy(rows, "helpful");
  const notHelpfulVotes = sumBy(rows, "notHelpful");
  const totalFeedback = helpfulVotes + notHelpfulVotes;
  const helpfulRate = (helpfulVotes / Math.max(totalFeedback, 1)) * 100;
  const topContentTags = buildTopContentTagItems(rows);

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
      <AnalyticsPanel title="Top Content Tags">
        {topContentTags.length > 0 ? (
          <AnalyticsBarList
            items={topContentTags}
            labelKey="label"
            valueKey="value"
          />
        ) : (
          <p className="text-[14px] text-gray-500">
            No tag data matches the selected filters.
          </p>
        )}
      </AnalyticsPanel>
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
