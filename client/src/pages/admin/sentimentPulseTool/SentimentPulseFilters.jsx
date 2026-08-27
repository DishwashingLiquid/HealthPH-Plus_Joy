/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { getRegionLabel, REGIONS } from "./RegionalAnalysis";

export default function SentimentPulseFilters({
  timeRange,
  onTimeRangeChange,
  selectedRegions,
  onRegionChange,
  onSelectAllRegions,
  onExportCsv,
  onExportPdf,
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

  return (
    <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
      <div className="grid grid-cols-1 gap-[12px] lg:grid-cols-3">
        <div>
          <label className="mb-[6px] block text-[13px] font-semibold text-gray-700">
            Time Range
          </label>
          <select
            value={timeRange}
            onChange={(event) => onTimeRangeChange(event.target.value)}
            className="min-h-[40px] w-full rounded-[10px] border border-[#E5E5E5] bg-white px-[14px] py-[10px] text-sm text-gray-800 outline-none focus:border-[#32418C] focus:ring-2 focus:ring-[#D9E3F2]"
          >
            <option value="last-7-days">Last 7 Days</option>
            <option value="last-30-days">Last 30 Days</option>
            <option value="last-90-days">Last 90 Days</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        <div>
          <label className="mb-[6px] block text-[13px] font-semibold text-gray-700">
            Regions
          </label>
          <div className="relative" ref={regionDropdownRef}>
            <button
              type="button"
              onClick={() => setShowRegionDropdown(!showRegionDropdown)}
              className="flex min-h-[40px] w-full items-center justify-between gap-[12px] rounded-[10px] border border-[#E5E5E5] bg-white px-[14px] py-[10px] text-left text-sm text-gray-800 outline-none transition hover:bg-[#F8F9FA] focus:border-[#32418C] focus:ring-2 focus:ring-[#D9E3F2]"
            >
              <span>
                {selectedRegions.length === 0
                  ? "All Regions"
                  : `${selectedRegions.length} Selected`}
              </span>
              <span className="text-xs font-semibold text-gray-500">v</span>
            </button>

            {showRegionDropdown && (
              <div className="absolute left-0 right-0 top-full z-20 mt-[8px] max-h-[260px] overflow-y-auto rounded-[12px] border border-[#E5E5E5] bg-white shadow-lg">
                <div className="border-b border-[#E5E5E5] px-[14px] py-[10px]">
                  <label className="flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={selectedRegions.length === REGIONS.length}
                      onChange={onSelectAllRegions}
                      className="h-[16px] w-[16px] accent-[#32418C]"
                    />
                    <span className="ml-[10px] text-sm font-semibold text-gray-800">
                      Select All
                    </span>
                  </label>
                </div>

                {REGIONS.map((region) => (
                  <div
                    key={region.value}
                    className="px-[14px] py-[10px] hover:bg-[#F8F9FA]"
                  >
                    <label className="flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={selectedRegions.includes(region.value)}
                        onChange={() => onRegionChange(region.value)}
                        className="h-[16px] w-[16px] accent-[#32418C]"
                      />
                      <span className="ml-[10px] text-sm text-gray-800">
                        {region.label}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="mb-[6px] block text-[13px] font-semibold text-gray-700">
            Export Data
          </label>
          <div className="flex gap-[8px]">
            <button
              type="button"
              onClick={onExportCsv}
              className="flex min-h-[40px] flex-1 items-center justify-center rounded-[10px] bg-[#32418C] px-[14px] py-[10px] text-sm font-medium text-white shadow-sm transition hover:bg-[#27346F]"
            >
              CSV
            </button>
            <button
              type="button"
              onClick={onExportPdf}
              className="flex min-h-[40px] flex-1 items-center justify-center rounded-[10px] bg-[#32418C] px-[14px] py-[10px] text-sm font-medium text-white shadow-sm transition hover:bg-[#27346F]"
            >
              PDF
            </button>
          </div>
        </div>
      </div>

      {selectedRegions.length > 0 && (
        <div className="mt-[16px] border-t border-[#E5E5E5] pt-[14px]">
          <p className="mb-[8px] text-sm text-gray-500">Active filters:</p>
          <div className="flex flex-wrap gap-[8px]">
            {selectedRegions.map((region) => (
              <span
                key={region}
                className="inline-flex items-center gap-[8px] rounded-full border border-[#D9E3F2] bg-[#F5F8FD] px-[10px] py-[5px] text-xs font-semibold text-[#32418C]"
              >
                {getRegionLabel(region)}
                <button
                  type="button"
                  onClick={() => onRegionChange(region)}
                  className="text-[#32418C] hover:text-[#27346F]"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
