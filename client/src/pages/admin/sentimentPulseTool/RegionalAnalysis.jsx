/* eslint-disable react-refresh/only-export-components */
import PropTypes from "prop-types";
import { formatCount, formatShare, isCount, SENTIMENT_COLORS } from "./sentimentContract";
import { normalizeRegionalKey, regionalAnswerRows, regionalCardRows, regionalRow, regionalAssessment, regionalDisplayLabel, REGIONAL_ANSWER_SCOPE, REGIONAL_SUBMISSION_SCOPE, REGIONAL_SATISFACTION_SCOPE } from "./regionalMetrics";
import {
  DASHBOARD_REGIONS as REGIONS,
  getDashboardRegionLabel,
} from "../dashboardRegions";

export { REGIONS };

const formatNumber = formatCount;
const REGION_ACCENTS = ["#32418C", "#2572A5", "#4D8FC4", "#9BCC33", "#FBD117"];
export const getRegionAccent = (value) => normalizeRegionalKey(value) === "unknown" ? "#687582"
  : REGION_ACCENTS[REGIONS.findIndex((region) => region.value === normalizeRegionalKey(value)) % REGION_ACCENTS.length];

export const getRegionLabel = getDashboardRegionLabel;

export const normalizeRegionalApiData = (regionalAnalysis) => {
  if (!regionalAnalysis || !Array.isArray(regionalAnalysis.regions)) {
    return {};
  }
  return regionalAnalysis.regions.reduce((byRegion, row) => {
    if (row) byRegion[normalizeRegionalKey(row.region)] = row;
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
    data: regionalData[region.value] || {},
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
  filterError = "",
  showEmptyRegions = false,
  onShowEmptyRegionsChange,
}) {
  if (filterError) return <StateMessage error>{filterError}</StateMessage>;

  const report = isError || isLoading ? undefined : regionalAnalysis;
  const regionalData = regionalAnswerRows(report);
  const rows = getVisibleRegionalRows(selectedRegions, regionalData, regionalData.unknown)
    .map((row) => ({ ...row, data: regionalRow(report, row.value) }));
  const totals = report?.totals;
  const hasRegionalData = Array.isArray(report?.regions) && report?.regionsComplete === true;
  const maxSubmissions = Math.max(1, ...rows.map(({ data }) =>
    isCount(data?.analyzedSubmissions) ? data.analyzedSubmissions : 0));
  const hasRegionFilter = selectedRegions.length > 0;
  const cardRows = regionalCardRows(rows, hasRegionFilter || showEmptyRegions);
  const incompleteLinks = report?.totals?.submissionCountStatus === "incomplete";

  return (
    <div className="flex flex-col gap-[14px]">
      {isLoading && <StateMessage>Loading regional analytics...</StateMessage>}
      {isError && <StateMessage error>Regional analytics could not be loaded. Try Refresh Results.</StateMessage>}
      {!isLoading && !isError && (!report || !totals || !Array.isArray(report.regions) || report.regionsComplete !== true) &&
        <StateMessage error>Some regional analytics fields are unavailable. Try Refresh Results.</StateMessage>}
      {isFetching && <p className="text-right text-xs font-medium text-[#475467]" aria-live="polite">Updating results...</p>}

      <section aria-labelledby="regional-overview" className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <h2 id="regional-overview" className="mb-4 text-[18px] font-semibold text-gray-800">Regional overview</h2>
        <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-3">
          <SummaryMetric label="Survey responses analyzed" value={totals?.analyzedSubmissions} />
          <AnswerMetrics report={report} row={totals} loading={isLoading} />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[#52607A]">All surveys | Mobile survey analytics | Stored results only. Anonymous and repeated submissions included.</p>
        <p className="mt-2 text-xs leading-relaxed text-[#52607A]">Satisfaction covers scored answers from linked submissions with sentiment results. Trends includes scored answers from submissions without sentiment results too.</p>
        {incompleteLinks && <p role="note" className="mt-2 rounded-lg bg-[#FFFAEB] px-3 py-2 text-sm leading-relaxed text-[#854A0E]">
          Exact submission counts are unavailable. {formatNumber(totals?.linkedAnalyzedSubmissions)} linked submissions analyzed in this view.
          {" "}{formatNumber(report.linkage?.missingAnalyzedAnswers)} analyzed answers have missing submission links and {formatNumber(report.linkage?.ambiguousAnalyzedAnswers)} have ambiguous links across all regions in these dates. Their answers remain in sentiment; unlinked scoring answers are excluded from satisfaction.
        </p>}
        <details className="mt-3 text-xs leading-relaxed text-[#667085]">
          <summary className="cursor-pointer rounded font-medium text-[#32418C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">How to read these numbers</summary>
          <p className="mt-2"><strong>Survey responses analyzed: </strong>{REGIONAL_SUBMISSION_SCOPE} Several analyzed answers from a submission count once. This count measures submissions.</p>
          <p className="mt-2"><strong>Sentiment:</strong> Calm or Worried among analyzed eligible answers; ties show both. Answers without valid results may be unprocessed, invalid or failed; their processing status is unknown.</p>
          <p className="mt-2"><strong>Satisfaction: </strong>{REGIONAL_SATISFACTION_SCOPE} Not set up means scoring rules are unavailable; no satisfaction answers means there are no valid scored answers in this view.</p>
          <p className="mt-2"><strong>Survey and regional scope: </strong>{REGIONAL_ANSWER_SCOPE}</p>
          <p className="mt-2">Philippine dates: {report?.filters ? `${report.filters.startDate} to ${report.filters.endDate}` : "Unavailable"}. Overall shares use aggregate answer counts.</p>
          <p className="mt-2">{hasRegionFilter ? "Region filters apply after submission assignment. Unknown Region is excluded from selected-region views." : "Unknown Region includes missing or conflicting processed locations."} Unlinked answers use their own normalized record locations. If any analyzed links are unresolved in these dates, exact regional counts are unavailable, including under region filters.</p>
        </details>
      </section>

      {totals?.eligibleAnswers === 0 && <StateMessage>No eligible survey answers in this view. Try another date range or region.</StateMessage>}

      <section className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[18px] font-semibold text-gray-800">By region</h3>
          {!hasRegionFilter && <label className="flex cursor-pointer items-center gap-2 text-xs text-[#52607A]">
            <input type="checkbox" checked={showEmptyRegions} onChange={(event) => onShowEmptyRegionsChange?.(event.target.checked)} className="h-4 w-4 accent-[#32418C]" />
            Show regions with no data
          </label>}
        </div>
        {cardRows.length === 0 && <p className="py-4 text-sm text-[#667085]">
          {isLoading ? "Loading regional results..." : hasRegionalData ? "No regional activity for these filters." : "Regional results are unavailable."}
        </p>}
        <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2 xl:grid-cols-4">
          {cardRows.map(({ value, label, data }) => (
            <article
              key={value}
              className="min-w-0 overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white"
            >
              <div className="h-[5px]" style={{ backgroundColor: getRegionAccent(value) }} />
              <header className="border-b border-[#EDF1F7] px-4 py-[14px]" style={{ backgroundColor: `${getRegionAccent(value)}0D` }}>
                <h4 className="text-[16px] font-semibold leading-tight text-gray-800">{label}</h4>
                {value === "unknown" && <p className="mt-1 text-xs text-[#52607A]">Location could not be identified</p>}
              </header>
              <div className="p-4">
                <p className="text-[28px] font-semibold leading-none tabular-nums text-gray-800">{isLoading ? "Loading..." : formatNumber(data?.analyzedSubmissions)}</p>
                <p className="mt-[6px] text-sm text-[#52607A]">Survey responses analyzed</p>
                <p className="mt-1 text-xs text-[#667085]">Distinct survey submissions</p>
                <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#EDF1F7] pt-3 text-sm">
                  <AnswerMetrics report={report} row={data} loading={isLoading} compact />
                </div>
                {data?.submissionCountStatus === "incomplete" && <p className="mt-4 text-xs text-[#854A0E]">{formatNumber(data.linkedAnalyzedSubmissions)} linked submissions; exact count unavailable.</p>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <details className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <summary className="cursor-pointer rounded text-sm font-semibold text-[#32418C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Compare analyzed survey responses</summary>
        <h3 className="my-[16px] text-[18px] font-semibold text-gray-800">
          Survey Responses Analyzed by Region
        </h3>
        {!hasRegionalData && <p className="mb-3 text-sm text-[#667085]">{isLoading ? "Loading comparison..." : "Comparison data unavailable. Try Refresh Results."}</p>}
        {incompleteLinks && <p className="mb-3 text-sm text-[#854A0E]">Exact regional comparison unavailable until submission links are resolved.</p>}
        <div className="space-y-3">
          {rows.map(({ value, label, data }) => {
            const submissions = isCount(data?.analyzedSubmissions) ? data.analyzedSubmissions : null;
            return (
              <div
                key={value}
                className="grid grid-cols-1 items-center gap-[10px] rounded-[12px] border border-[#E5E5E5] px-[14px] py-[12px] sm:grid-cols-[minmax(150px,1fr)_minmax(160px,2fr)_100px]"
              >
                <span className="text-[14px] font-semibold text-[#1F2A44]">{label}</span>
                <div className="h-[10px] overflow-hidden rounded-full bg-[#EDF2F7] ring-1 ring-inset ring-[#E2E8F0]">
                  <div
                    aria-hidden="true"
                    className="h-full rounded-full bg-[#6677B8]"
                    style={{ width: `${((submissions || 0) / maxSubmissions) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold tabular-nums text-[#475467] sm:text-right">
                  {formatNumber(data?.analyzedSubmissions)}
                </span>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}

const SummaryMetric = ({ label, value }) => (
  <div className="rounded-[10px] bg-[#F6F8FB] px-[14px] py-[12px]">
    <p className="text-xs font-medium text-[#667085]">{label}</p>
    <p className="mt-[6px] text-[28px] font-semibold leading-none tabular-nums text-[#253052]">{formatNumber(value)}</p>
    <p className="mt-2 text-xs text-[#667085]">Distinct survey submissions</p>
  </div>
);

SummaryMetric.propTypes = { label: PropTypes.string, value: PropTypes.number };

const AnswerMetrics = ({ report, row, loading = false, compact = false }) => {
  const { sentiment, satisfaction, coverage, incomplete } = regionalAssessment(report, row);
  const metricClass = compact ? "min-w-0" : "min-w-0 rounded-[10px] bg-[#F6F8FB] p-3";
  return <>
    <div className={metricClass}>
      <p className="text-xs font-medium text-[#52607A]">Sentiment</p>
      <p className="mt-[6px] text-lg font-semibold tabular-nums" style={{ color: SENTIMENT_COLORS[sentiment.kind] || "#344054" }}>
        {loading ? "Loading..." : sentiment.kind === "tie" ? <><span style={{ color: SENTIMENT_COLORS.calm }}>Calm</span> / <span style={{ color: SENTIMENT_COLORS.worried }}>Worried</span></> : regionalDisplayLabel(sentiment.label)}
      </p>
      {sentiment.share !== null && <p className="mt-1 text-sm font-semibold text-[#344054]">{formatShare(sentiment.share)}{sentiment.kind === "tie" ? " each" : " of analyzed answers"}</p>}
      <p className="mt-1 text-xs leading-relaxed text-[#667085]">{loading ? "" : coverage.replace("eligible answers", "answers")}</p>
      {incomplete && <p className="mt-1 text-xs font-medium text-[#B45309]">{formatCount(row?.eligibleAnswers - row?.predictedAnswers)} answers have no result.</p>}
    </div>
    <div className={metricClass}>
      <p className="text-xs font-medium text-[#52607A]">Satisfaction</p>
      <p className="mt-[6px] text-lg font-semibold tabular-nums" style={{ color: satisfaction.share === null ? "#344054" : SENTIMENT_COLORS.satisfaction }}>{loading ? "Loading..." : regionalDisplayLabel(satisfaction.label)}</p>
      {row && report?.satisfactionStatus === "configured" && <p className="mt-1 text-xs text-[#667085]">{formatCount(row ? row.satisfiedAnswers : 0)} satisfied answers out of {formatCount(row ? row.satisfactionAnswers : 0)}</p>}
    </div>
  </>;
};
AnswerMetrics.propTypes = { report: PropTypes.object, row: PropTypes.object, loading: PropTypes.bool, compact: PropTypes.bool };

RegionalAnalysis.propTypes = {
  selectedRegions: PropTypes.arrayOf(PropTypes.string),
  regionalAnalysis: PropTypes.object,
  isLoading: PropTypes.bool,
  isError: PropTypes.bool,
  isFetching: PropTypes.bool,
  filterError: PropTypes.string,
  showEmptyRegions: PropTypes.bool,
  onShowEmptyRegionsChange: PropTypes.func,
};
