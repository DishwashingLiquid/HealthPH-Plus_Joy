import PropTypes from "prop-types";
import {
  sentimentStats,
  getTrendIndicator,
  formatPercentage,
  formatNumber,
} from "../../../assets/data/sentimentMockData";

const formatPhDate = (value, options) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    ...options,
  }).format(new Date(value));

export default function StaticContainers({ summary, isLoading, isError }) {
  const trendSentiment = getTrendIndicator(sentimentStats.comparisonRate);
  const unavailable = isLoading ? "Loading..." : "Unavailable";
  const trendResponses = getTrendIndicator(summary?.responseChangePercent ?? 0);
  const monthLabel = (month) => formatPhDate(`${month}-01T00:00:00+08:00`, {
    month: "short", year: "numeric",
  });

  return (
    <div className="grid grid-cols-1 gap-[10px] md:grid-cols-2 xl:grid-cols-4" aria-busy={isLoading}>
      {isError && (
        <p role="alert" className="text-sm text-red-700 md:col-span-2 xl:col-span-4">
          {summary
            ? "Unable to refresh survey summary. Showing the last loaded values."
            : "Unable to load survey summary. Retrying automatically."}
        </p>
      )}
      <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <h3 className="mb-[8px] text-sm text-gray-500">Sentiment Score</h3>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[32px] font-semibold leading-none text-gray-800">
              {sentimentStats.currentScore}
            </p>
            <p className="mt-[4px] text-xs text-gray-500">out of 100</p>
          </div>
          <div className={`text-right ${trendSentiment.color}`}>
            <p className="text-sm font-semibold">
              {trendSentiment.arrow} {formatPercentage(sentimentStats.comparisonRate)}%
            </p>
            <p className="text-xs text-gray-500">vs previous</p>
          </div>
        </div>
      </div>

      <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <h3 className="mb-[8px] text-sm text-gray-500">Survey Responses</h3>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[32px] font-semibold leading-none text-gray-800">
              {summary ? formatNumber(summary.surveyResponses) : unavailable}
            </p>
            <p className="mt-[4px] text-xs text-gray-500">
              {summary ? `Surveys published in ${monthLabel(summary.currentPublicationMonth)}` : "By survey publication month"}
            </p>
          </div>
          <div className={`text-right ${trendResponses.color}`}>
            <p className="text-sm font-semibold">
              {summary && (summary.responseChangePercent === null
                ? summary.surveyResponses === 0
                  ? "No responses in either group"
                  : "No previous-month responses"
                : `${trendResponses.arrow} ${formatPercentage(summary.responseChangePercent)}%`)}
            </p>
            <p className="text-xs text-gray-500">
              {summary && `vs surveys published in ${monthLabel(summary.previousPublicationMonth)} (${formatNumber(summary.previousMonthResponses)} responses)`}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <h3 className="mb-[8px] text-sm text-gray-500">Active Regions</h3>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[32px] font-semibold leading-none text-gray-800">
              {summary ? `${summary.activeRegions}/${summary.totalRegions}` : unavailable}
            </p>
            <p className="mt-[4px] text-xs text-gray-500">regions active</p>
          </div>
        </div>
        <p className="mt-[8px] text-xs text-gray-500">
          {summary?.publishedSurveyCount === 0
            ? "No published surveys yet."
            : summary
              ? `Across the latest ${summary.publishedSurveyCount} published ${summary.publishedSurveyCount === 1 ? "survey" : "surveys"}.`
              : "Across the latest five published surveys."}
        </p>
        {summary?.unknownRegionResponses > 0 && (
          <p className="mt-[4px] text-xs text-gray-500">
            {formatNumber(summary.unknownRegionResponses)} responses have an unknown region in these surveys.
          </p>
        )}
      </div>

      <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <h3 className="mb-[8px] text-sm text-gray-500">Last Update</h3>
        <div className="space-y-3">
          <div>
            <p className="text-lg font-semibold text-gray-800">
              {summary
                ? summary.responseCutoff
                  ? formatPhDate(summary.responseCutoff, {
                      dateStyle: "medium", timeStyle: "medium",
                    })
                  : "No responses yet"
                : unavailable}
            </p>
            <p className="mt-[4px] text-xs text-gray-500">Latest response · Philippine time</p>
          </div>
          <div className="pt-2 border-t border-gray-200">
            <p className="text-sm text-gray-700">
              Next reporting period: <span className="font-semibold text-blue-600">
                {summary
                  ? formatPhDate(summary.nextReportingPeriod, { dateStyle: "medium" })
                  : unavailable}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

StaticContainers.propTypes = {
  summary: PropTypes.shape({
    activeRegions: PropTypes.number.isRequired,
    unknownRegionResponses: PropTypes.number,
    totalRegions: PropTypes.number.isRequired,
    publishedSurveyCount: PropTypes.number.isRequired,
    surveyResponses: PropTypes.number.isRequired,
    previousMonthResponses: PropTypes.number.isRequired,
    responseChangePercent: PropTypes.number,
    currentPublicationMonth: PropTypes.string.isRequired,
    previousPublicationMonth: PropTypes.string.isRequired,
    responseCutoff: PropTypes.string,
    nextReportingPeriod: PropTypes.string.isRequired,
  }),
  isLoading: PropTypes.bool,
  isError: PropTypes.bool,
};
