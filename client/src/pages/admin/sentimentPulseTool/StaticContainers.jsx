import PropTypes from "prop-types";
import {
  getTrendIndicator,
  formatPercentage,
  formatNumber,
} from "../../../assets/data/sentimentMockData";
import { formatShare, surveyCardSentiment, reportingScope, formatCount } from "./sentimentContract";

const formatPhDate = (value, options) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    ...options,
  }).format(new Date(value));

export default function StaticContainers({ summary, isLoading, isError, sentimentReport, isSentimentLoading, isSentimentError }) {
  const unavailable = isLoading ? "Loading..." : "Unavailable";
  const assessment = surveyCardSentiment(sentimentReport);
  const sentimentLabel = ({ "Not configured": "Not available", "No eligible feedback": "No answers to analyze",
    "Not processed": "No results yet" })[assessment.label] || assessment.label;
  const scope = sentimentReport && !isSentimentError ? reportingScope(sentimentReport) : "Sentiment Trends date, region, and survey filters";
  const trendResponses = getTrendIndicator(summary?.responseChangePercent ?? 0);
  const monthLabel = (month) => formatPhDate(`${month}-01T00:00:00+08:00`, {
    month: "short", year: "numeric",
  });

  return (
    <div className="grid grid-cols-1 gap-[10px] md:grid-cols-2 xl:grid-cols-4" aria-busy={isLoading}>
      {isError && (
        <p role="alert" className="text-sm text-red-700 md:col-span-2 xl:col-span-4">
          {summary
            ? "Refresh failed. Showing previous values."
            : "Unable to load summary. Retrying..."}
        </p>
      )}
      <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <h3 className="mb-[8px] text-sm text-gray-500">Sentiment Score</h3>
        <div className="flex items-end justify-between">
          <div>
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[32px] font-semibold leading-tight text-gray-800">
              {isSentimentLoading ? "Loading..." : isSentimentError ? "Unavailable" : <>
                <span>{sentimentLabel}</span>
                {assessment.share !== null && <span className="text-xl">· {formatShare(assessment.share)}{assessment.kind === "tie" ? " each" : ""}</span>}
              </>}
            </p>
            <p className="mt-[4px] text-xs text-gray-500">{!isSentimentLoading && !isSentimentError && sentimentReport ? `${formatCount(sentimentReport.totals?.predictedAnswers)} analyzed answers` : "Analyzed mobile answers"}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500" title={scope}>Current Trends filters<span className="sr-only">: {scope}</span></p>
        {sentimentReport && !isSentimentError && !isSentimentLoading && sentimentReport.totals?.answersWithoutResults > 0 &&
          <p className="mt-2 text-xs text-gray-600">{formatCount(sentimentReport.totals.answersWithoutResults)} without results</p>}
      </div>

      <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <h3 className="mb-[8px] text-sm text-gray-500">Survey Responses</h3>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[32px] font-semibold leading-none text-gray-800">
              {summary ? formatNumber(summary.surveyResponses) : unavailable}
            </p>
            <p className="mt-[4px] text-xs text-gray-500">
              {summary ? `Published surveys: ${monthLabel(summary.currentPublicationMonth)}` : "Published surveys"}
            </p>
          </div>
          <div className={`text-right ${trendResponses.color}`}>
            <p className="text-sm font-semibold">
              {summary && (summary.responseChangePercent === null
                ? summary.surveyResponses === 0
                  ? "No responses yet"
                  : "No comparison yet"
                : `${trendResponses.arrow} ${formatPercentage(summary.responseChangePercent)}%`)}
            </p>
            <p className="text-xs text-gray-500">
              {summary && `vs ${monthLabel(summary.previousPublicationMonth)} · ${formatNumber(summary.previousMonthResponses)} responses`}
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
            <p className="mt-[4px] text-xs text-gray-500">With responses</p>
          </div>
        </div>
        <p className="mt-[8px] text-xs text-gray-500">
          {summary?.publishedSurveyCount === 0
            ? "No published surveys"
            : summary
              ? `Latest ${summary.publishedSurveyCount} published ${summary.publishedSurveyCount === 1 ? "survey" : "surveys"}`
              : "Latest published surveys"}
        </p>
        {summary?.unknownRegionResponses > 0 && (
          <p className="mt-[4px] text-xs text-gray-500">
            {formatNumber(summary.unknownRegionResponses)} responses · region unknown
          </p>
        )}
      </div>

      <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <h3 className="mb-[8px] text-sm text-gray-500">Latest Response</h3>
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
            <p className="mt-[4px] text-xs text-gray-500">Philippine time</p>
          </div>
          <div className="pt-2 border-t border-gray-200">
            <p className="text-sm text-gray-700">
              Next month: <span className="font-semibold text-blue-600">
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
  sentimentReport: PropTypes.object,
  isSentimentLoading: PropTypes.bool,
  isSentimentError: PropTypes.bool,
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
