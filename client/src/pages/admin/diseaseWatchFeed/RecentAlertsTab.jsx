/* eslint-disable react/prop-types */
import PropTypes from "prop-types";
import { formatDistanceToNow } from "date-fns";

import { DASHBOARD_CARD_TITLE_CLASS } from "../dashboardTypography";

const RECENT_ALERT_ENTITY_STYLES = {
  disease: {
    backgroundColor: "#32418C30",
    color: "#32418C",
  },
  symptom: {
    backgroundColor: "#2572A530",
    color: "#2572A5",
  },
  location: {
    backgroundColor: "#FBD11730",
    color: "#FBD117",
  },
};

function RecentAlertEntityHighlight({ label, tone }) {
  return (
    <span
      className="px-[6px] py-[2px] rounded-[6px] text-sm font-medium"
      style={RECENT_ALERT_ENTITY_STYLES[tone]}
    >
      {label}
    </span>
  );
}

RecentAlertEntityHighlight.propTypes = {
  label: PropTypes.string.isRequired,
  tone: PropTypes.oneOf(["disease", "symptom", "location"]).isRequired,
};

const renderSummary = (alert) => {
  if (
    !Array.isArray(alert.summarySegments) ||
    alert.summarySegments.length === 0
  ) {
    return alert.summary;
  }

  return alert.summarySegments.map((segment, index) => {
    if (segment.type === "entity") {
      return (
        <RecentAlertEntityHighlight
          key={`${alert.id}-segment-${index}`}
          label={segment.label}
          tone={segment.tone}
        />
      );
    }

    return <span key={`${alert.id}-segment-${index}`}>{segment.value}</span>;
  });
};

const formatAlertTimestamp = (value) => {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return formatDistanceToNow(parsedDate, { addSuffix: true });
};

export default function RecentAlertsTab({ alerts, errorMessage, isLoading }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-[12px]">
        {[0, 1, 2].map((index) => (
          <div
            key={`recent-alert-loading-${index}`}
            className="bg-white rounded-[12px] border border-[#E5E5E5] p-[16px]"
          >
            <p className="text-sm font-medium text-gray-700">
              Loading recent alerts...
            </p>
            <p className="mt-[6px] text-sm text-gray-500">
              Pulling the latest disease watch activity.
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

  if (alerts.length === 0) {
    return (
      <div className="rounded-[12px] border border-[#E5E5E5] bg-white px-[20px] py-[18px] text-sm text-gray-500">
        No recent alerts are available yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-[12px]">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="bg-white rounded-[12px] border border-[#E5E5E5] p-[16px] hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-start gap-[16px]">
            <div className="flex-1">
              <div className="flex items-center gap-[8px] mb-[8px]">
                <h3 className={DASHBOARD_CARD_TITLE_CLASS}>
                  <RecentAlertEntityHighlight
                    label={alert.disease}
                    tone="disease"
                  />
                </h3>
                <span className="px-[8px] py-[2px] bg-[#FFF3CD] text-[#856404] text-xs rounded-[4px] font-medium">
                  {alert.type}
                </span>
              </div>
              <p className="text-[15px] text-gray-800 leading-[1.8] mb-[8px]">
                {renderSummary(alert)}
              </p>
              <div className="flex gap-[16px] text-xs text-gray-500">
                <span>
                  Region:{" "}
                  <RecentAlertEntityHighlight
                    label={alert.region}
                    tone="location"
                  />
                </span>
                <span>Updated: {formatAlertTimestamp(alert.timestamp)}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

RecentAlertsTab.propTypes = {
  alerts: PropTypes.arrayOf(PropTypes.object).isRequired,
  errorMessage: PropTypes.string,
  isLoading: PropTypes.bool,
};

RecentAlertsTab.defaultProps = {
  errorMessage: "",
  isLoading: false,
};
