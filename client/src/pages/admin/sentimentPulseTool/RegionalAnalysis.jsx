import PropTypes from "prop-types";
import {
  REGIONS,
  formatNumber,
  formatPercentage,
  getTrendIndicator,
  regionalSentimentData,
  sentimentColors,
} from "../../../assets/data/sentimentMockData";
import { getRegionalSentimentCardData } from "./regionUtils";
import {
  DASHBOARD_CARD_TITLE_CLASS,
  DASHBOARD_SECTION_TITLE_CLASS,
} from "../dashboardTypography";

const MAP_CARD_STYLES = {
  Proactive: {
    cardClass:
      "border-[#BBF7D0] bg-gradient-to-br from-[#F0FDF4] via-[#F7FEF7] to-white",
    badgeClass: "border border-[#86EFAC] bg-[#DCFCE7] text-[#166534]",
    valueClass: "text-[#15803D]",
    labelClass: "text-[#166534]",
    accentClass: "bg-[#22C55E]",
  },
  Neutral: {
    cardClass:
      "border-[#FED7AA] bg-gradient-to-br from-[#FFF7ED] via-[#FFF9F1] to-white",
    badgeClass: "border border-[#FDBA74] bg-[#FFEDD5] text-[#C2410C]",
    valueClass: "text-[#EA580C]",
    labelClass: "text-[#9A3412]",
    accentClass: "bg-[#F97316]",
  },
  Concerned: {
    cardClass:
      "border-[#FECACA] bg-gradient-to-br from-[#FEF2F2] via-[#FFF5F5] to-white",
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
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className={`${DASHBOARD_SECTION_TITLE_CLASS} mb-4`}>
          Regional Sentiment Map
        </h3>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {visibleMapRegionData.map((region) => {
            const cardStyle = MAP_CARD_STYLES[region.sentimentGauge];

            return (
              <div
                key={region.value}
                className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm ${cardStyle.cardClass}`}
              >
                <div
                  className={`absolute right-0 top-0 h-24 w-24 -translate-y-6 translate-x-6 rounded-full opacity-10 ${cardStyle.accentClass}`}
                />

                <div className="relative flex h-full flex-col gap-5">
                  <div className="flex items-start justify-between gap-3">
                    <h4
                      className={`${DASHBOARD_CARD_TITLE_CLASS} max-w-[70%] leading-tight text-gray-900`}
                    >
                      {region.label}
                    </h4>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cardStyle.badgeClass}`}
                    >
                      {region.sentimentGauge}
                    </span>
                  </div>

                  <div>
                    <p className={`text-4xl font-bold leading-none ${cardStyle.valueClass}`}>
                      {region.sentimentScore}%
                    </p>
                    <p className={`mt-2 text-sm font-medium ${cardStyle.labelClass}`}>
                      Health sentiment score
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {visibleMapRegionData.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            No regional sentiment scores are available for the selected filters.
          </div>
        )}
      </section>

      <section className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px] shadow-[0_10px_30px_rgba(50,65,140,0.05)]">
        <h3 className={`${DASHBOARD_SECTION_TITLE_CLASS} mb-[16px]`}>
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
                className="grid grid-cols-1 items-center gap-2 rounded-[12px] border border-[#E8EDF5] bg-[linear-gradient(180deg,#FFFFFF_0%,#FBFCFE_100%)] px-[14px] py-[12px] shadow-[0_4px_14px_rgba(15,23,42,0.04)] sm:grid-cols-[minmax(120px,1fr)_minmax(160px,2fr)_90px_110px]"
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
