/* eslint-disable react/prop-types */
import {
  AnalyticsMetricCard,
  AnalyticsPanel,
  AnalyticsTable,
} from "../AnalyticsShared";
import { formatNumber, sumBy } from "../shared";

const FactCheckUsageAnalyticsPage = ({ report, factCheckAnalytics = [] }) => {
  const factCheckRows = factCheckAnalytics ?? [];

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="grid grid-cols-1 gap-[12px] md:grid-cols-3">
        <AnalyticsMetricCard
          label="Fact Check Claims"
          value={formatNumber(factCheckRows.length)}
        />
        <AnalyticsMetricCard
          label="Total Views"
          value={formatNumber(sumBy(factCheckRows, "views"))}
        />
        <AnalyticsMetricCard
          label="Needs Update"
          value={formatNumber(
            factCheckRows.filter((row) => row.reviewStatus === "Needs Update")
              .length
          )}
        />
      </div>
      <AnalyticsPanel title="Fact-Check Usage Analytics">
        <AnalyticsTable
          columns={report.columns}
          rows={report.rows}
          emptyMessage="No fact-check usage matches the selected filters."
        />
      </AnalyticsPanel>
    </div>
  );
};

export default FactCheckUsageAnalyticsPage;
