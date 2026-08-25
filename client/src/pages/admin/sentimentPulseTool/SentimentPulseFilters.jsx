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
    <div className="bg-white shadow-sm rounded-lg p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Time Range
          </label>
          <select
            value={timeRange}
            onChange={(event) => onTimeRangeChange(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="last-7-days">Last 7 Days</option>
            <option value="last-30-days">Last 30 Days</option>
            <option value="last-90-days">Last 90 Days</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Regions
          </label>
          <div className="relative" ref={regionDropdownRef}>
            <button
              onClick={() => setShowRegionDropdown(!showRegionDropdown)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white text-left flex items-center justify-between hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <span>
                {selectedRegions.length === 0
                  ? "All Regions"
                  : `${selectedRegions.length} Selected`}
              </span>
              <span className="text-gray-600">â–¼</span>
            </button>

            {showRegionDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                <div className="px-4 py-2 border-b border-gray-200">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRegions.length === REGIONS.length}
                      onChange={onSelectAllRegions}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="ml-2 font-semibold text-gray-900">
                      Select All
                    </span>
                  </label>
                </div>

                {REGIONS.map((region) => (
                  <div key={region.value} className="px-4 py-2 hover:bg-gray-50">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRegions.includes(region.value)}
                        onChange={() => onRegionChange(region.value)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-gray-900 text-sm">
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
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Export Data
          </label>
          <div className="flex gap-2">
            <button
              onClick={onExportCsv}
              className="prod-btn-base admin-module-brand-btn flex-1 min-h-[40px] flex items-center justify-center"
            >
              <span className="text-white">CSV</span>
            </button>
            <button
              onClick={onExportPdf}
              className="prod-btn-base admin-module-brand-btn flex-1 min-h-[40px] flex items-center justify-center"
            >
              <span className="text-white">PDF</span>
            </button>
          </div>
        </div>
      </div>

      {selectedRegions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-2">Active Filters:</p>
          <div className="flex flex-wrap gap-2">
            {selectedRegions.map((region) => (
              <span
                key={region}
                className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                {getRegionLabel(region)}
                <button
                  onClick={() => onRegionChange(region)}
                  className="text-blue-600 hover:text-blue-900"
                >
                  âœ•
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
