import {
  sentimentStats,
  getTrendIndicator,
  formatPercentage,
  formatNumber,
  getTimeDifference,
} from "../../../assets/data/sentimentMockData";

export default function StaticContainers() {
  const trendSentiment = getTrendIndicator(sentimentStats.comparisonRate);
  const trendResponses = getTrendIndicator(sentimentStats.responsesComparisonRate);
  const trendRegions = getTrendIndicator(sentimentStats.regionsComparisonRate);

  return (
    <div className="grid grid-cols-1 gap-[10px] md:grid-cols-2 xl:grid-cols-4">
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
              {formatNumber(sentimentStats.surveyResponses)}
            </p>
            <p className="mt-[4px] text-xs text-gray-500">total responses</p>
          </div>
          <div className={`text-right ${trendResponses.color}`}>
            <p className="text-sm font-semibold">
              {trendResponses.arrow} {formatPercentage(sentimentStats.responsesComparisonRate)}%
            </p>
            <p className="text-xs text-gray-500">vs previous</p>
          </div>
        </div>
      </div>

      <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <h3 className="mb-[8px] text-sm text-gray-500">Active Regions</h3>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[32px] font-semibold leading-none text-gray-800">
              {sentimentStats.activeRegions}/{sentimentStats.totalRegions}
            </p>
            <p className="mt-[4px] text-xs text-gray-500">regions active</p>
          </div>
          <div className={`text-right ${trendRegions.color}`}>
            <p className="text-sm font-semibold">
              {trendRegions.arrow} {formatPercentage(sentimentStats.regionsComparisonRate)}%
            </p>
            <p className="text-xs text-gray-500">vs previous</p>
          </div>
        </div>
      </div>

      <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <h3 className="mb-[8px] text-sm text-gray-500">Latest Update</h3>
        <div className="space-y-3">
          <div>
            <p className="text-[28px] font-semibold leading-none text-gray-800">
              {sentimentStats.lastUpdateTime}
            </p>
            <p className="mt-[4px] text-xs text-gray-500">from last update</p>
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
