/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const REGIONAL_COVERAGE_PALETTE = [
  "#32418C",
  "#2572A5",
  "#4D8FC4",
  "#9BCC33",
  "#FBD117",
];

const formatCompactNumber = (value) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const getRegionAccentColor = (regionName, regionUserData) =>
  REGIONAL_COVERAGE_PALETTE[
    regionUserData.findIndex((region) => region.region === regionName) %
      REGIONAL_COVERAGE_PALETTE.length
  ];

export default function RegionalCoverageTab({
  availableRegions,
  errorMessage,
  isLoading,
  onRegionChange,
  regionUserData,
  selectedRegions,
}) {
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const regionDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        regionDropdownRef.current &&
        !regionDropdownRef.current.contains(event.target)
      ) {
        setShowRegionDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const visibleRegionCards = useMemo(
    () =>
      selectedRegions.length === 0
        ? regionUserData
        : regionUserData.filter((region) => selectedRegions.includes(region.region)),
    [regionUserData, selectedRegions]
  );

  if (isLoading) {
    return (
      <div className="rounded-[12px] border border-[#E5E5E5] bg-white px-[20px] py-[18px] text-sm text-gray-600">
        Loading regional coverage...
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

  if (regionUserData.length === 0) {
    return (
      <div className="rounded-[12px] border border-[#E5E5E5] bg-white px-[20px] py-[18px] text-sm text-gray-500">
        No regional coverage data is available yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[10px]">
      <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-[14px] mb-[18px]">
          <div>
            <h3 className="text-[18px] font-semibold text-gray-800">
              Distinct Mobile Reporters by Region
            </h3>
            <p className="mt-[4px] text-sm text-gray-500">
              Regional distribution of distinct mobile self-report actors across
              the monitored coverage areas.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-[#D9E3F2] bg-[#F5F8FD] px-[12px] py-[6px] text-xs font-semibold uppercase tracking-[0.08em] text-[#32418C]">
            {availableRegions.length || regionUserData.length} regions tracked
          </span>
        </div>

        <div className="rounded-[12px] border border-[#E8EDF5] bg-[#F8FAFC] p-[14px]">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={regionUserData}
              margin={{ top: 24, right: 12, left: 0, bottom: 92 }}
            >
              <CartesianGrid
                strokeDasharray="4 4"
                stroke="#D9E3F2"
                vertical={false}
              />
              <XAxis
                dataKey="region"
                angle={-40}
                textAnchor="end"
                height={88}
                tick={{ fontSize: 12, fill: "#52607A" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#52607A" }}
                tickFormatter={formatCompactNumber}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #D9E3F2",
                  borderRadius: "12px",
                  boxShadow: "0 12px 30px rgba(50, 65, 140, 0.14)",
                  color: "#1F2A44",
                }}
                labelStyle={{ color: "#32418C", fontWeight: 600 }}
                formatter={(value) => value.toLocaleString()}
              />
              <Bar dataKey="users" radius={[10, 10, 0, 0]} barSize={30}>
                {regionUserData.map((region) => (
                  <Cell
                    key={region.region}
                    fill={getRegionAccentColor(region.region, regionUserData)}
                  />
                ))}
                <LabelList
                  dataKey="users"
                  position="top"
                  offset={8}
                  formatter={formatCompactNumber}
                  className="fill-[#32418C] text-[11px] font-semibold"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-[14px]">
        <div>
          <h3 className="text-[18px] font-semibold text-gray-800">Regional Cards</h3>
          <p className="mt-[4px] text-sm text-gray-500">
            Detailed reporter totals and share of mobile self-report coverage by
            region.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-[12px]">
          <span className="inline-flex items-center rounded-full border border-[#D9E3F2] bg-[#F5F8FD] px-[12px] py-[6px] text-xs font-semibold uppercase tracking-[0.08em] text-[#2572A5]">
            Showing {visibleRegionCards.length} region
            {visibleRegionCards.length !== 1 ? "s" : ""}
          </span>
          <div className="relative w-full sm:w-auto" ref={regionDropdownRef}>
            <button
              type="button"
              onClick={() => setShowRegionDropdown((isOpen) => !isOpen)}
              className="flex min-h-[42px] w-full items-center justify-between gap-[12px] rounded-[10px] border border-[#E5E5E5] bg-white px-[14px] py-[10px] text-sm font-medium text-[#1F2A44] shadow-sm transition hover:border-[#32418C] focus:outline-none focus:ring-2 focus:ring-[#D9E3F2] sm:w-auto"
              aria-expanded={showRegionDropdown}
              aria-haspopup="true"
            >
              <span>
                Filter Regions
                {selectedRegions.length > 0
                  ? ` (${selectedRegions.length})`
                  : ""}
              </span>
              <span className="text-[#32418C] text-xs">v</span>
            </button>

            {showRegionDropdown && (
              <div className="absolute right-0 top-full z-20 mt-[8px] w-full rounded-[12px] border border-[#D9E3F2] bg-white shadow-[0_18px_40px_rgba(50,65,140,0.14)] sm:w-[260px]">
                <div className="border-b border-[#EDF1F7] px-[14px] py-[10px]">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#32418C]">
                    Select regions
                  </p>
                </div>
                <div className="max-h-[280px] overflow-y-auto py-[6px]">
                  {availableRegions.map((region) => (
                    <label
                      key={region}
                      className="flex cursor-pointer items-center gap-[10px] px-[14px] py-[10px] text-sm text-[#1F2A44] transition hover:bg-[#F8FAFC]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRegions.includes(region)}
                        onChange={() => onRegionChange(region)}
                        className="h-[16px] w-[16px] accent-[#32418C]"
                      />
                      <span>{region}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2 xl:grid-cols-4">
        {visibleRegionCards.length === 0 && (
          <div className="rounded-[12px] border border-[#E5E5E5] bg-white px-[20px] py-[18px] text-sm text-gray-500 md:col-span-2 xl:col-span-4">
            No regional cards match the selected filters.
          </div>
        )}
        {visibleRegionCards.map((region) => {
          const accentColor = getRegionAccentColor(region.region, regionUserData);

          return (
            <div
              key={region.region}
              className="overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white"
            >
              <div
                className="h-[5px] w-full"
                style={{ backgroundColor: accentColor }}
              />
              <div className="border-b border-[#EDF1F7] bg-[#F8FAFC] px-[16px] py-[14px]">
                <div className="flex items-start justify-between gap-[12px]">
                  <div>
                    <h4 className="text-[16px] font-semibold text-gray-800">
                      {region.region}
                    </h4>
                    <p className="mt-[4px] text-xs uppercase tracking-[0.08em] text-[#6B7A90]">
                      Regional coverage
                    </p>
                  </div>
                  <span
                    className="rounded-full px-[10px] py-[4px] text-xs font-semibold"
                    style={{
                      backgroundColor: `${accentColor}18`,
                      color: accentColor,
                    }}
                  >
                    {region.percentage}% share
                  </span>
                </div>
              </div>

              <div className="p-[16px]">
                <p className="text-[28px] font-semibold leading-none text-[#1F2A44]">
                  {region.users.toLocaleString()}
                </p>
                <p className="mt-[6px] text-sm text-gray-500">
                  distinct mobile reporters
                </p>

                <div className="mt-[18px]">
                  <div className="mb-[8px] flex items-center justify-between text-sm">
                    <span className="font-medium text-[#52607A]">
                      Coverage share
                    </span>
                    <span className="font-semibold text-[#1F2A44]">
                      {region.percentage}%
                    </span>
                  </div>
                  <div className="h-[10px] overflow-hidden rounded-full bg-[#E6EDF7]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${region.percentage}%`,
                        backgroundColor: accentColor,
                      }}
                    />
                  </div>
                </div>

                <div className="mt-[16px] flex items-center justify-between rounded-[10px] border border-[#EEF2F8] bg-[#FBFCFE] px-[12px] py-[10px]">
                  <span className="text-xs font-medium uppercase tracking-[0.08em] text-[#6B7A90]">
                    Distribution
                  </span>
                  <span className="text-sm font-semibold text-[#2572A5]">
                    {formatCompactNumber(region.users)} reporters
                  </span>
                </div>

                <div className="mt-[12px] grid grid-cols-2 gap-[10px]">
                  <div className="rounded-[10px] border border-[#EEF2F8] bg-[#FBFCFE] px-[12px] py-[10px]">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7A90]">
                      Alerts
                    </p>
                    <p className="mt-[6px] text-sm font-semibold text-[#1F2A44]">
                      {formatCompactNumber(region.alertCount)}
                    </p>
                  </div>
                  <div className="rounded-[10px] border border-[#EEF2F8] bg-[#FBFCFE] px-[12px] py-[10px]">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7A90]">
                      Reports
                    </p>
                    <p className="mt-[6px] text-sm font-semibold text-[#1F2A44]">
                      {formatCompactNumber(region.reportCount)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

RegionalCoverageTab.propTypes = {
  availableRegions: PropTypes.arrayOf(PropTypes.string),
  errorMessage: PropTypes.string,
  isLoading: PropTypes.bool,
  onRegionChange: PropTypes.func.isRequired,
  regionUserData: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedRegions: PropTypes.arrayOf(PropTypes.string).isRequired,
};

RegionalCoverageTab.defaultProps = {
  availableRegions: [],
  errorMessage: "",
  isLoading: false,
};
