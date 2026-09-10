/* eslint-disable react-refresh/only-export-components */
import PropTypes from "prop-types";
import {
  REGIONS,
  regionalSentimentData,
  formatNumber,
  formatPercentage,
  getTrendIndicator,
  sentimentColors,
} from "../../../assets/data/sentimentMockData";

export { REGIONS };

const REGIONAL_SCORE_FIELDS = [
  "healthSentimentScore",
  "health_sentiment_score",
  "sentimentScore",
  "sentiment_score",
  "score",
  "percentage",
];

const toFiniteNumber = (value) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const clampScore = (value) => {
  if (value === null) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
};

export const getRegionLabel = (regionValue) =>
  REGIONS.find((region) => region.value === regionValue)?.label || regionValue;

export const getVisibleRegionalRows = (
  selectedRegions,
  regionalData = regionalSentimentData
) => {
  const visibleRegions =
    selectedRegions.length > 0
      ? REGIONS.filter((region) => selectedRegions.includes(region.value))
      : REGIONS;

  return visibleRegions
    .map((region) => ({
      ...region,
      data: regionalData[region.value],
    }))
    .filter((region) => region.data);
};

export const getRegionalSentimentScore = (regionData = {}) => {
  const explicitScoreField = REGIONAL_SCORE_FIELDS.find(
    (field) => toFiniteNumber(regionData?.[field]) !== null
  );

  if (explicitScoreField) {
    return clampScore(toFiniteNumber(regionData[explicitScoreField]));
  }

  const proactive = toFiniteNumber(regionData?.sentimentBreakdown?.proactive) ?? 0;
  const neutral = toFiniteNumber(regionData?.sentimentBreakdown?.neutral) ?? 0;
  const concerned = toFiniteNumber(regionData?.sentimentBreakdown?.concerned) ?? 0;
  const totalGaugeResponses = proactive + neutral + concerned;

  if (totalGaugeResponses <= 0) {
    return null;
  }

  return clampScore(((proactive + neutral) / totalGaugeResponses) * 100);
};

export const getRegionalSentimentGauge = (score) => {
  const normalizedScore = toFiniteNumber(score);

  if (normalizedScore === null) {
    return null;
  }

  if (normalizedScore >= 75) {
    return "Proactive";
  }

  if (normalizedScore >= 65) {
    return "Neutral";
  }

  return "Concerned";
};

export const getRegionalSentimentCardData = (regionData = {}) => {
  const score = getRegionalSentimentScore(regionData);

  return {
    score,
    gauge: score === null ? null : getRegionalSentimentGauge(score),
  };
};

export const normalizeRegionalApiData = (regionalAnalysis) => {
  if (
    !Array.isArray(regionalAnalysis?.regions) ||
    regionalAnalysis.regions.length === 0
  ) {
    return regionalSentimentData;
  }

  return regionalAnalysis.regions.reduce(
    (regionalData, region) => {
      if (!region?.region) {
        return regionalData;
      }

      const mockRegionData = regionalSentimentData[region.region] || {};

      return {
        ...regionalData,
        [region.region]: {
          ...mockRegionData,
          ...region,
          previousResponses:
            region.previousResponses ?? mockRegionData.previousResponses ?? 0,
          trend: region.trend ?? mockRegionData.trend ?? 0,
        },
      };
    },
    { ...regionalSentimentData }
  );
};

const MAP_CARD_STYLES = {
  Proactive: {
    cardClass: "border-[#BBF7D0] bg-white",
    badgeClass: "border border-[#86EFAC] bg-[#DCFCE7] text-[#166534]",
    valueClass: "text-[#15803D]",
    labelClass: "text-[#166534]",
    accentClass: "bg-[#22C55E]",
  },
  Neutral: {
    cardClass: "border-[#FED7AA] bg-white",
    badgeClass: "border border-[#FDBA74] bg-[#FFEDD5] text-[#C2410C]",
    valueClass: "text-[#EA580C]",
    labelClass: "text-[#9A3412]",
    accentClass: "bg-[#F97316]",
  },
  Concerned: {
    cardClass: "border-[#FECACA] bg-white",
    badgeClass: "border border-[#FCA5A5] bg-[#FEE2E2] text-[#B91C1C]",
    valueClass: "text-[#DC2626]",
    labelClass: "text-[#991B1B]",
    accentClass: "bg-[#EF4444]",
  },
};

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
  const visibleMapRegionData = visibleRegionData
    .map((region) => {
      const cardData = getRegionalSentimentCardData(region.data);

      return {
        ...region,
        sentimentScore: cardData.score,
        sentimentGauge: cardData.gauge,
      };
    })
    .filter(
      (region) =>
        Number(region.data?.responses || 0) > 0 &&
        region.sentimentScore !== null &&
        region.sentimentGauge
    );

  return (
    <div className="flex flex-col gap-[10px]">
      <section className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <h3 className="mb-[14px] text-[18px] font-semibold text-gray-800">
          Regional Sentiment Map
        </h3>

        <div className="grid grid-cols-1 gap-[10px] md:grid-cols-2 lg:grid-cols-3">
          {visibleMapRegionData.map((region) => {
            const cardStyle = MAP_CARD_STYLES[region.sentimentGauge];

            return (
              <div
                key={region.value}
                className={`overflow-hidden rounded-[12px] border p-[16px] ${cardStyle.cardClass}`}
              >
                <div className="flex h-full flex-col gap-[18px]">
                  <div className="flex items-start justify-between gap-[12px]">
                    <h4
                      className="max-w-[70%] text-[16px] font-semibold leading-tight text-gray-900"
                    >
                      {region.label}
                    </h4>
                    <span
                      className={`rounded-full px-[10px] py-[4px] text-xs font-semibold ${cardStyle.badgeClass}`}
                    >
                      {region.sentimentGauge}
                    </span>
                  </div>

                  <div>
                    <p className={`text-[32px] font-semibold leading-none ${cardStyle.valueClass}`}>
                      {region.sentimentScore}%
                    </p>
                    <p className={`mt-[6px] text-sm font-medium ${cardStyle.labelClass}`}>
                      Health sentiment score
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {visibleMapRegionData.length === 0 && (
          <div className="rounded-[12px] border border-dashed border-[#D0D5DD] bg-[#F8FAFC] px-[20px] py-[32px] text-center text-sm text-gray-500">
            No regional sentiment scores are available for the selected filters.
          </div>
        )}
      </section>

      <section className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <h3 className="mb-[16px] text-[18px] font-semibold text-gray-800">
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
                className="grid grid-cols-1 items-center gap-[10px] rounded-[12px] border border-[#E5E5E5] bg-white px-[14px] py-[12px] sm:grid-cols-[minmax(120px,1fr)_minmax(160px,2fr)_90px_110px]"
              >
                <span className="text-[14px] font-semibold tracking-[0.01em] text-[#1F2A44]">
                  {region.label}
                </span>

                <div className="relative h-[10px] overflow-hidden rounded-full bg-[#EDF2F7] ring-1 ring-inset ring-[#E2E8F0]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${responsePercentage}%`,
                      backgroundColor: sentimentColor,
                      boxShadow: `0 6px 14px ${sentimentColor}33`,
                    }}
                  />
                </div>

                <span
                  className={`text-sm font-semibold tabular-nums tracking-[-0.01em] ${trend.color}`}
                >
                  {trend.arrow} {formatPercentage(data.trend || 0)}%
                </span>

                <span className="text-sm font-semibold tabular-nums text-[#475467] sm:text-right">
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
      sentimentScore: PropTypes.number,
      score: PropTypes.number,
      healthSentimentScore: PropTypes.number,
      sentimentBreakdown: PropTypes.shape({
        concerned: PropTypes.number,
        proactive: PropTypes.number,
        neutral: PropTypes.number,
        misinformed: PropTypes.number,
      }),
    })
  ),
};
