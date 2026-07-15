import {
  DASHBOARD_CARD_TITLE_CLASS,
  DASHBOARD_METRIC_LABEL_CLASS,
} from "../dashboardTypography";

/* eslint-disable react/prop-types */
export const AnalyticsSelect = ({ label, value, options, onChange }) => {
  return (
    <label className="flex flex-col gap-[6px]">
      <span className="text-[13px] font-semibold text-gray-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[40px] rounded-[8px] border border-[#D0D5DD] bg-white px-[12px] text-[14px] text-gray-800 outline-none focus:border-[#6A8EB5] focus:ring-2 focus:ring-[#6A8EB5]/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
};

export const AnalyticsMetricCard = ({ label, value, detail }) => {
  return (
    <div className="rounded-[8px] border border-[#E5E5E5] bg-white p-[16px]">
      <p className={DASHBOARD_METRIC_LABEL_CLASS}>{label}</p>
      <p className="mt-[6px] text-[24px] font-semibold text-gray-900">{value}</p>
      {detail && <p className="mt-[4px] text-[12px] text-gray-500">{detail}</p>}
    </div>
  );
};

export const AnalyticsPanel = ({ title, children }) => {
  return (
    <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[16px]">
      <h3 className={`${DASHBOARD_CARD_TITLE_CLASS} mb-[14px]`}>
        {title}
      </h3>
      {children}
    </div>
  );
};
