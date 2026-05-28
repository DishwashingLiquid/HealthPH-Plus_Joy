/* eslint-disable react/prop-types */
import {
  AnalyticsMetricCard,
  AnalyticsPanel,
  AnalyticsTable,
} from "../AnalyticsShared";
import {
  HELPFUL_SCORE_FORMULA,
  formatAnalyticsTimestamp,
  formatHelpfulScore,
  formatNumber,
  sumBy,
} from "../shared";

const HelpfulAnalyticsPage = ({
  rows,
  report,
  onRefreshHelpfulAnalytics,
  isRefreshingHelpfulAnalytics,
  lastHelpfulRefreshAt,
}) => {
  const helpfulVotes = sumBy(rows, "helpful");
  const notHelpfulVotes = sumBy(rows, "notHelpful");
  const helpfulScoreLabel = formatHelpfulScore(helpfulVotes, notHelpfulVotes);

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex flex-col gap-[10px] rounded-[8px] border border-[#E5E5E5] bg-[#F8FAFC] p-[12px] sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] font-medium text-gray-600">
          Last updated: {formatAnalyticsTimestamp(lastHelpfulRefreshAt)}
        </p>
        <button
          type="button"
          onClick={onRefreshHelpfulAnalytics}
          disabled={isRefreshingHelpfulAnalytics || !onRefreshHelpfulAnalytics}
          className={`inline-flex min-h-[38px] items-center justify-center rounded-[8px] border px-[14px] text-[13px] font-semibold transition ${
            isRefreshingHelpfulAnalytics || !onRefreshHelpfulAnalytics
              ? "cursor-not-allowed border-[#D0D5DD] bg-white text-gray-400"
              : "border-[#6A8EB5] bg-white text-[#315F8C] hover:bg-[#F0F6FC] focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]/30"
          }`}
          aria-label="Refresh helpful analytics data"
        >
          {isRefreshingHelpfulAnalytics ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-[12px] md:grid-cols-3">
        <AnalyticsMetricCard
          label="Helpful Responses"
          value={formatNumber(helpfulVotes)}
        />
        <AnalyticsMetricCard
          label="Not Helpful Responses"
          value={formatNumber(notHelpfulVotes)}
        />
        <AnalyticsMetricCard
          label="Helpful Score"
          value={helpfulScoreLabel}
          detail={`Based on logged-in user feedback. ${HELPFUL_SCORE_FORMULA}`}
        />
      </div>
      <AnalyticsPanel title="Helpful/Not Helpful Analytics">
        <AnalyticsTable
          columns={report.columns}
          rows={report.rows}
          emptyMessage="No feedback data matches the selected filters."
        />
      </AnalyticsPanel>
    </div>
  );
};

export default HelpfulAnalyticsPage;
