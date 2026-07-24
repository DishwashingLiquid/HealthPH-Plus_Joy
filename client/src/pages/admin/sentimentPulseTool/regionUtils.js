import {
  REGIONS,
  regionalSentimentData,
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
