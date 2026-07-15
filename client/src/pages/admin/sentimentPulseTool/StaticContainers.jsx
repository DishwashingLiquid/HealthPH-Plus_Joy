import {
  sentimentStats,
  getTrendIndicator,
  formatPercentage,
  formatNumber,
  getTimeDifference,
} from "../../../assets/data/sentimentMockData";
import { DASHBOARD_METRIC_LABEL_CLASS } from "../dashboardTypography";

export default function StaticContainers() {
  const trendSentiment = getTrendIndicator(sentimentStats.comparisonRate);
  const trendResponses = getTrendIndicator(sentimentStats.responsesComparisonRate);
  const trendRegions = getTrendIndicator(sentimentStats.regionsComparisonRate);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Sentiment Score Card */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h3 className={`${DASHBOARD_METRIC_LABEL_CLASS} mb-2`}>Sentiment Score</h3>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-gray-900">
              {sentimentStats.currentScore}
            </p>
            <p className="text-xs text-gray-500 mt-1">out of 100</p>
          </div>
          <div className={`text-right ${trendSentiment.color}`}>
            <p className="text-xl font-semibold">
              {trendSentiment.arrow} {formatPercentage(sentimentStats.comparisonRate)}%
            </p>
            <p className="text-xs text-gray-500">vs previous</p>
          </div>
        </div>
      </div>

      {/* Survey Responses Card */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h3 className={`${DASHBOARD_METRIC_LABEL_CLASS} mb-2`}>Survey Responses</h3>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-gray-900">
              {formatNumber(sentimentStats.surveyResponses)}
            </p>
            <p className="text-xs text-gray-500 mt-1">total responses</p>
          </div>
          <div className={`text-right ${trendResponses.color}`}>
            <p className="text-xl font-semibold">
              {trendResponses.arrow} {formatPercentage(sentimentStats.responsesComparisonRate)}%
            </p>
            <p className="text-xs text-gray-500">vs previous</p>
          </div>
        </div>
      </div>

      {/* Active Regions Card */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h3 className={`${DASHBOARD_METRIC_LABEL_CLASS} mb-2`}>Active Regions</h3>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-gray-900">
              {sentimentStats.activeRegions}/{sentimentStats.totalRegions}
            </p>
            <p className="text-xs text-gray-500 mt-1">regions active</p>
          </div>
          <div className={`text-right ${trendRegions.color}`}>
            <p className="text-xl font-semibold">
              {trendRegions.arrow} {formatPercentage(sentimentStats.regionsComparisonRate)}%
            </p>
            <p className="text-xs text-gray-500">vs previous</p>
          </div>
        </div>
      </div>

      {/* Latest Update Card */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h3 className={`${DASHBOARD_METRIC_LABEL_CLASS} mb-2`}>Latest Update</h3>
        <div className="space-y-3">
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {sentimentStats.lastUpdateTime}
            </p>
            <p className="text-xs text-gray-500 mt-1">from last update</p>
          </div>
          <div className="pt-2 border-t border-gray-200">
            <p className="text-sm text-gray-700">
              Next update in <span className="font-semibold text-blue-600">
                {getTimeDifference(sentimentStats.nextUpdateTimestamp)}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
