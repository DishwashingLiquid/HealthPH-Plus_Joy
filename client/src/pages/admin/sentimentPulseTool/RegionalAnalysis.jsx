import React from "react";
import {
  REGIONS,
  regionalSentimentData,
  sentimentColors,
  formatPercentage,
  formatNumber,
} from "../../../assets/data/sentimentMockData";

export default function RegionalAnalysis({ selectedRegions = [] }) {
  const visibleRegions =
    selectedRegions.length > 0
      ? REGIONS.filter((region) => selectedRegions.includes(region.value))
      : REGIONS;

  const visibleRegionData = visibleRegions
    .map((region) => ({
      ...region,
      data: regionalSentimentData[region.value],
    }))
    .filter((region) => region.data);

  return (
    <div className="space-y-6">
      <p className="text-gray-600 text-sm">
        Displaying sentiment data and survey response trends across all Philippine regions.
      </p>

      {/* Regional Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleRegionData.map((region) => {
          const { data } = region;
          const isActive = data.responses > 0;
          const trendValue = Math.min(Math.abs(data.trend), 100);
          const sentimentColor =
            sentimentColors[data.dominantSentiment] || "#9CA3AF";

          return (
            <div
              key={region.value}
              className={`bg-white shadow-sm rounded-lg p-4 border border-gray-200 ${
                !isActive ? "opacity-50" : ""
              }`}
            >
              {/* Region Header */}
              <div className="mb-3 flex items-start justify-between gap-3">
                <h4 className="text-lg font-semibold text-gray-900 leading-tight">
                  {region.label}
                </h4>
                {isActive ? (
                  <span
                    className="text-xs font-semibold whitespace-nowrap"
                    style={{ color: sentimentColor }}
                  >
                    {data.dominantSentiment}
                  </span>
                ) : (
                  <span className="inline-block mt-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                    Inactive
                  </span>
                )}
              </div>

              {/* Response Count */}
              <div className="mb-3 pb-3 border-b border-gray-200">
                <p className="text-sm text-gray-600">
                  Responses: <span className="font-semibold text-gray-900">
                    {formatNumber(data.responses)}
                  </span>
                </p>
              </div>

              {/* Response Difference */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">
                    Response Difference
                  </span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: sentimentColor }}
                  >
                    {data.trend > 0 ? "+" : data.trend < 0 ? "-" : ""}
                    {formatPercentage(data.trend)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${trendValue}%`,
                      backgroundColor: sentimentColor,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
