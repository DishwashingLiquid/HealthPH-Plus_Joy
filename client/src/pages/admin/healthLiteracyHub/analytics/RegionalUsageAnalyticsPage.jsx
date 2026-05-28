/* eslint-disable react/prop-types */
import { AnalyticsPanel, AnalyticsTable } from "../AnalyticsShared";
import { REGIONAL_USAGE_EMPTY_MESSAGE } from "../shared";

const RegionalUsageAnalyticsPage = ({ report }) => {
  return (
    <div className="flex flex-col gap-[16px]">
      <AnalyticsPanel title="Regional Usage">
        <AnalyticsTable
          columns={report.columns}
          rows={report.rows}
          emptyMessage={REGIONAL_USAGE_EMPTY_MESSAGE}
        />
      </AnalyticsPanel>
    </div>
  );
};

export default RegionalUsageAnalyticsPage;
