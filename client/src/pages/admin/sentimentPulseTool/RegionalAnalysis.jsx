/* eslint-disable react-refresh/only-export-components */
import PropTypes from "prop-types";
import {
  DASHBOARD_REGIONS as REGIONS,
  getDashboardRegionLabel,
} from "../dashboardRegions";

export { REGIONS };

const EMPTY_METRICS = {
  surveyRespondents: 0,
  totalSubmissions: 0,
  healthSentimentScore: null,
  sentimentStatus: "Coming soon",
};

const formatNumber = (value) => new Intl.NumberFormat("en-PH").format(value || 0);

export const getRegionLabel = getDashboardRegionLabel;

export const normalizeRegionalApiData = (regionalAnalysis) => {
  if (!regionalAnalysis || !Array.isArray(regionalAnalysis.regions)) {
    return {};
  }
  return regionalAnalysis.regions.reduce((byRegion, row) => {
    if (row?.region) {
      byRegion[row.region] = row;
    }
    return byRegion;
  }, {});
};

export const getVisibleRegionalRows = (
  selectedRegions,
  regionalData = {},
  unknownRegion,
) => {
  const visibleRegions = selectedRegions.length
    ? REGIONS.filter(({ value }) => selectedRegions.includes(value))
    : REGIONS;
  const rows = visibleRegions.map((region) => ({
    ...region,
    data: regionalData[region.value] || EMPTY_METRICS,
  }));

  if (!selectedRegions.length && unknownRegion) {
    rows.push({ value: "unknown", label: "Unknown region", data: unknownRegion });
  }
  return rows;
};

const StateMessage = ({ children, error = false }) => (
  <div
    role={error ? "alert" : undefined}
    className={`rounded-[12px] border px-[20px] py-[32px] text-center text-sm ${
      error
        ? "border-red-200 bg-red-50 font-medium text-red-700"
        : "border-dashed border-[#D0D5DD] bg-[#F8FAFC] text-gray-500"
    }`}
  >
    {children}
  </div>
);

StateMessage.propTypes = {
  children: PropTypes.node,
  error: PropTypes.bool,
};

export default function RegionalAnalysis({
  selectedRegions = [],
  regionalAnalysis,
  isLoading = false,
  isError = false,
  isFetching = false,
}) {
  if (isLoading) {
    return <StateMessage>Loading regional survey statistics...</StateMessage>;
  }
  if (isError) {
    return (
      <StateMessage error>
        Unable to load regional survey statistics. Existing counts have not been replaced with zeros.
      </StateMessage>
    );
  }
  if (!regionalAnalysis) {
    return <StateMessage>No regional survey data is available.</StateMessage>;
  }

  const regionalData = normalizeRegionalApiData(regionalAnalysis);
  const rows = getVisibleRegionalRows(
    selectedRegions,
    regionalData,
    regionalAnalysis.unknownRegion,
  );
  const totals = regionalAnalysis.filteredTotals || EMPTY_METRICS;
  const allTotals = regionalAnalysis.totals || EMPTY_METRICS;
  const maxRespondents = Math.max(
    1,
    ...rows.map(({ data }) => Number(data.surveyRespondents || 0)),
  );
  const hasRegionFilter = selectedRegions.length > 0;

  return (
    <div className="flex flex-col gap-[10px]">
      {isFetching && (
        <p className="text-right text-xs font-medium text-[#475467]" aria-live="polite">
          Refreshing regional survey statistics...
        </p>
      )}

      <section className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-3">
          <SummaryMetric label="Survey respondents" value={totals.surveyRespondents} />
          <SummaryMetric label="Total submissions" value={totals.totalSubmissions} />
          <SummaryMetric label="Unlinked submissions" value={totals.unlinkedSubmissions} />
        </div>
        <p className="mt-[12px] text-xs leading-relaxed text-[#667085]">
          Respondents are distinct verified accounts, assigned to the region on their latest eligible response.
          Submissions are counted separately by each response&apos;s own resolved region. Unlinked submissions never
          count as respondents.
        </p>
        {hasRegionFilter ? (
          <p className="mt-[6px] text-xs leading-relaxed text-[#667085]">
            Region filters are applied after respondent assignment. Unknown-region respondents are excluded from
            this filtered view; the date range contains {formatNumber(allTotals.unknownRegionRespondents)} such
            respondents and {formatNumber(allTotals.unknownRegionSubmissions)} unknown-region submissions. Unlinked
            submissions shown above are those whose response region matches the selected regions.
          </p>
        ) : (
          <p className="mt-[6px] text-xs leading-relaxed text-[#667085]">
            Unknown region is included below. Account-region fallback is used only when the latest response has no
            usable region.
          </p>
        )}
      </section>

      {totals.totalSubmissions === 0 && (
        <StateMessage>No eligible survey responses were found for the selected filters.</StateMessage>
      )}

      <section className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <h3 className="mb-[14px] text-[18px] font-semibold text-gray-800">
          Regional Survey Summary
        </h3>
        <div className="grid grid-cols-1 gap-[10px] md:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ value, label, data }) => (
            <article
              key={value}
              className="rounded-[12px] border border-[#DDE3EA] bg-white p-[16px]"
            >
              <h4 className="text-[16px] font-semibold leading-tight text-gray-900">{label}</h4>
              <dl className="mt-[16px] grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <MetricTerm label="Survey respondents" value={formatNumber(data.surveyRespondents)} />
                <MetricTerm label="Total submissions" value={formatNumber(data.totalSubmissions)} />
                <MetricTerm label="Health sentiment score" value="—" />
                <MetricTerm label="Sentiment status" value="Coming soon" />
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <h3 className="mb-[16px] text-[18px] font-semibold text-gray-800">
          Survey Respondents by Region
        </h3>
        <div className="space-y-3">
          {rows.map(({ value, label, data }) => {
            const respondents = Number(data.surveyRespondents || 0);
            return (
              <div
                key={value}
                className="grid grid-cols-1 items-center gap-[10px] rounded-[12px] border border-[#E5E5E5] px-[14px] py-[12px] sm:grid-cols-[minmax(150px,1fr)_minmax(160px,2fr)_100px]"
              >
                <span className="text-[14px] font-semibold text-[#1F2A44]">{label}</span>
                <div className="h-[10px] overflow-hidden rounded-full bg-[#EDF2F7] ring-1 ring-inset ring-[#E2E8F0]">
                  <div
                    className="h-full rounded-full bg-[#6677B8]"
                    style={{ width: `${(respondents / maxRespondents) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold tabular-nums text-[#475467] sm:text-right">
                  {formatNumber(respondents)}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

const SummaryMetric = ({ label, value }) => (
  <div className="rounded-[10px] bg-[#F6F8FB] px-[14px] py-[12px]">
    <p className="text-xs font-medium text-[#667085]">{label}</p>
    <p className="mt-1 text-2xl font-semibold tabular-nums text-[#253052]">{formatNumber(value)}</p>
  </div>
);

SummaryMetric.propTypes = { label: PropTypes.string, value: PropTypes.number };

const MetricTerm = ({ label, value }) => (
  <div>
    <dt className="text-xs text-[#667085]">{label}</dt>
    <dd className="mt-1 font-semibold tabular-nums text-[#344054]">{value}</dd>
  </div>
);

MetricTerm.propTypes = { label: PropTypes.string, value: PropTypes.string };

RegionalAnalysis.propTypes = {
  selectedRegions: PropTypes.arrayOf(PropTypes.string),
  regionalAnalysis: PropTypes.shape({
    regions: PropTypes.arrayOf(PropTypes.object),
    unknownRegion: PropTypes.object,
    totals: PropTypes.object,
    filteredTotals: PropTypes.object,
  }),
  isLoading: PropTypes.bool,
  isError: PropTypes.bool,
  isFetching: PropTypes.bool,
};
