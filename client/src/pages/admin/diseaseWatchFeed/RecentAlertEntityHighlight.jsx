/* eslint-disable react/prop-types */
import PropTypes from "prop-types";

import { RECENT_ALERT_ENTITY_STYLES } from "./formatters";

export default function RecentAlertEntityHighlight({ label, tone }) {
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
