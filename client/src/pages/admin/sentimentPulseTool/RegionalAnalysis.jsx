import PropTypes from "prop-types";
import {
  REGIONS,
  formatNumber,
  formatPercentage,
  getTrendIndicator,
  regionalSentimentData,
  sentimentColors,
} from "../../../assets/data/sentimentMockData";
import {
  DASHBOARD_CARD_TITLE_CLASS,
  DASHBOARD_SECTION_TITLE_CLASS,
} from "../dashboardTypography";

export default function RegionalAnalysis({
  selectedRegions = [],
  regionalData = regionalSentimentData,
}) {
  const visibleRegions =
    selectedRegions.length > 0
      ? REGIONS.filter((region) => selectedRegions.includes(region.value))
      : REGIONS;

  const visibleRegionData = visibleRegions
    .map((region) => ({
      ...region,
      data: regionalData[region.value],
    }))
    .filter((region) => region.data);

  const maxVisibleResponses = Math.max(
    1,
    ...visibleRegionData.map((region) => region.data.responses || 0)
  );

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className={`${DASHBOARD_SECTION_TITLE_CLASS} mb-4`}>
          Regional Sentiment Map
        </h3>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {visibleRegionData.map((region) => {
            const { data } = region;
            const isActive = data.responses > 0;
            const sentimentLabel = data.dominantSentiment || "Neutral";
            const sentimentColor =
              sentimentColors[data.dominantSentiment] || "#9CA3AF";

            return (
              <div
                key={region.value}
                className="flex min-h-[68px] items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm"
              >
                <h4 className={`${DASHBOARD_CARD_TITLE_CLASS} leading-tight`}>
                  {region.label}
                </h4>

                {isActive ? (
                  <span
                    className="rounded px-2 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: sentimentColor }}
                  >
                    {sentimentLabel}
                  </span>
                ) : (
                  <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                    Inactive
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className={`${DASHBOARD_SECTION_TITLE_CLASS} mb-4`}>
          Regional Sentiment Comparison
        </h3>

        <div className="space-y-3">
          {visibleRegionData.map((region) => {
            const { data } = region;
            const responses = data.responses || 0;
            const trend = getTrendIndicator(data.trend || 0);
            const sentimentColor =
              sentimentColors[data.dominantSentiment] || "#9CA3AF";
            const responsePercentage = (responses / maxVisibleResponses) * 100;

            return (
              <div
                key={region.value}
                className="grid grid-cols-1 items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 sm:grid-cols-[minmax(120px,1fr)_minmax(160px,2fr)_90px_110px]"
              >
                <span className="text-sm font-semibold text-gray-900">
                  {region.label}
                </span>

                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${responsePercentage}%`,
                      backgroundColor: sentimentColor,
                    }}
                  />
                </div>

                <span className={`text-sm font-semibold ${trend.color}`}>
                  {trend.arrow} {formatPercentage(data.trend || 0)}%
                </span>

                <span className="text-sm font-medium text-gray-700 sm:text-right">
                  {formatNumber(responses)}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

RegionalAnalysis.propTypes = {
  selectedRegions: PropTypes.arrayOf(PropTypes.string),
  regionalData: PropTypes.objectOf(
    PropTypes.shape({
      responses: PropTypes.number,
      previousResponses: PropTypes.number,
      dominantSentiment: PropTypes.string,
      trend: PropTypes.number,
    })
  ),
};
