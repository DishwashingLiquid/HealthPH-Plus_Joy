/* eslint-disable react/prop-types */
import PropTypes from "prop-types";

const formatNumber = (value) =>
  new Intl.NumberFormat("en-US").format(value ?? 0);

export default function TopMetricCards({ cards, errorMessage, isLoading }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-[20px]">
        {[0, 1, 2].map((cardIndex) => (
          <div
            key={`top-metric-loading-${cardIndex}`}
            className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]"
          >
            <p className="text-gray-500 text-sm mb-[8px]">Loading metric...</p>
            <h2 className="text-[32px] font-semibold text-gray-800 leading-none">
              --
            </h2>
            <p className="text-xs text-gray-500 mt-[4px]">
              Refreshing disease watch totals
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-[12px] border border-[#F2CACA] bg-[#FFF6F6] px-[20px] py-[18px] text-sm text-[#B42318]">
        {errorMessage}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-[12px] border border-[#E5E5E5] bg-white px-[20px] py-[18px] text-sm text-gray-500">
        No top metrics are available yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-[20px]">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm mb-[8px]">{card.label}</p>
              <h2 className="text-[32px] font-semibold text-gray-800 leading-none">
                {formatNumber(card.value)}
              </h2>
              <p className="text-xs text-gray-500 mt-[4px]">{card.helper}</p>
            </div>
            <div
              className="flex h-[40px] w-[40px] shrink-0 items-center justify-center"
              style={{ color: card.iconColor }}
            >
              <card.icon aria-hidden="true" className="h-[34px] w-[34px]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

TopMetricCards.propTypes = {
  cards: PropTypes.arrayOf(
    PropTypes.shape({
      helper: PropTypes.string.isRequired,
      icon: PropTypes.elementType.isRequired,
      iconColor: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    })
  ).isRequired,
  errorMessage: PropTypes.string,
  isLoading: PropTypes.bool,
};

TopMetricCards.defaultProps = {
  errorMessage: "",
  isLoading: false,
};
