import React, { useEffect, useRef, useState } from "react";
import {
  REGIONS,
  regionalSentimentData,
} from "../../assets/data/sentimentMockData";
import StaticContainers from "./sentimentPulseTool/StaticContainers";
import SentimentTrends from "./sentimentPulseTool/SentimentTrends";
import RegionalAnalysis from "./sentimentPulseTool/RegionalAnalysis";
import MobileSurveys from "./sentimentPulseTool/MobileSurveys";

const getRegionLabel = (regionValue) =>
  REGIONS.find((region) => region.value === regionValue)?.label || regionValue;

const getVisibleRegionalRows = (selectedRegions) => {
  const visibleRegions =
    selectedRegions.length > 0
      ? REGIONS.filter((region) => selectedRegions.includes(region.value))
      : REGIONS;

  return visibleRegions
    .map((region) => ({
      ...region,
      data: regionalSentimentData[region.value],
    }))
    .filter((region) => region.data);
};

const escapeCsvValue = (value) => {
  const text = String(value ?? "");
  return text.includes(",") || text.includes('"') || text.includes("\n")
    ? `"${text.replace(/"/g, '""')}"`
    : text;
};

export default function SentimentPulseTool() {
  const [activeTab, setActiveTab] = useState("sentiment-trends");
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [timeRange, setTimeRange] = useState("last-30-days");
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

  // Handle region selection for multi-select
  const handleRegionChange = (regionValue) => {
    if (selectedRegions.includes(regionValue)) {
      setSelectedRegions(selectedRegions.filter((r) => r !== regionValue));
    } else {
      setSelectedRegions([...selectedRegions, regionValue]);
    }
  };

  // Select/Deselect all regions
  const handleSelectAllRegions = () => {
    if (selectedRegions.length === REGIONS.length) {
      setSelectedRegions([]);
    } else {
      setSelectedRegions(REGIONS.map((region) => region.value));
    }
  };

  // Export as CSV
  const handleExportCSV = () => {
    const timestamp = new Date().toLocaleString();
    const selectedRegionLabels =
      selectedRegions.length === 0
        ? "All"
        : selectedRegions.map(getRegionLabel).join(", ");
    const headers = [
      "Sentiment Pulse Tool Export",
      `Generated: ${timestamp}`,
      `Active Tab: ${activeTab}`,
      `Time Range: ${timeRange}`,
      `Selected Regions: ${selectedRegionLabels}`,
      "",
    ];

    let csvContent = headers.join("\n") + "\n";

    if (activeTab === "sentiment-trends") {
      csvContent +=
        "Date,Concerned (%),Proactive (%),Misinformed (%),Neutral (%)\n";
      // Mock data export
      csvContent += "2026-05-01,15,42,18,25\n";
      csvContent += "2026-05-02,14,44,17,25\n";
      csvContent += "2026-05-03,16,41,19,24\n";
    } else if (activeTab === "regional-analysis") {
      csvContent +=
        "Region,Responses,Previous Responses,Dominant Sentiment,Trend (%)\n";
      const regionalRows = getVisibleRegionalRows(selectedRegions);
      csvContent += regionalRows
        .map((region) =>
          [
            region.label,
            region.data.responses,
            region.data.previousResponses,
            region.data.dominantSentiment,
            region.data.trend,
          ]
            .map(escapeCsvValue)
            .join(",")
        )
        .join("\n");
      csvContent += regionalRows.length > 0 ? "\n" : "";
    } else if (activeTab === "mobile-surveys") {
      csvContent +=
        "Survey Title,Status,Responses,Target,Dominant Sentiment\n";
      csvContent +=
        "COVID-19 Vaccination Awareness,Active,2340,2500,Proactive\n";
      csvContent +=
        "Mental Health Support Services,Active,1856,2000,Proactive\n";
    }

    // Create and download file
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent)
    );
    element.setAttribute(
      "download",
      `sentiment-pulse-export-${activeTab}-${new Date().getTime()}.csv`
    );
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Export as PDF (placeholder for now - would use html2pdf in production)
  const handleExportPDF = () => {
    alert("PDF export will be available soon. Features would include visualizations of charts, applied filters, and professional formatting.");
  };

  const tabs = [
    { id: "sentiment-trends", label: "Sentiment Trends" },
    { id: "regional-analysis", label: "Regional Analysis" },
    { id: "mobile-surveys", label: "Mobile Surveys" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sentiment Pulse Tool</h1>
          <p className="text-gray-600 mt-2">
            Monitor public sentiment trends, regional analysis, and mobile survey responses.
          </p>
        </div>

        {/* Static Containers */}
        <StaticContainers />

        {/* Filters Section */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Time Range Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Time Range
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="last-7-days">Last 7 Days</option>
                <option value="last-30-days">Last 30 Days</option>
                <option value="last-90-days">Last 90 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Region Multi-Select */}
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
                  <span className="text-gray-600">▼</span>
                </button>

                {/* Dropdown Menu */}
                {showRegionDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                    {/* Select All Option */}
                    <div className="px-4 py-2 border-b border-gray-200">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRegions.length === REGIONS.length}
                          onChange={handleSelectAllRegions}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="ml-2 font-semibold text-gray-900">
                          Select All
                        </span>
                      </label>
                    </div>

                    {/* Region Options */}
                    {REGIONS.map((region) => (
                      <div key={region.value} className="px-4 py-2 hover:bg-gray-50">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedRegions.includes(region.value)}
                            onChange={() => handleRegionChange(region.value)}
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

            {/* Export Buttons */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Export Data
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleExportCSV}
                  className="prod-btn-base prod-btn-primary flex-1 min-h-[40px] flex items-center justify-center"
                >
                  <span className="text-white">CSV</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  className="prod-btn-base prod-btn-primary flex-1 min-h-[40px] flex items-center justify-center"
                >
                  <span className="text-white">PDF</span>
                </button>
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
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
                      onClick={() => handleRegionChange(region)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 bg-white rounded-t-lg overflow-hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-semibold transition-colors duration-200 ${
                activeTab === tab.id
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white shadow-sm rounded-b-lg p-6">
          {activeTab === "sentiment-trends" && <SentimentTrends />}
          {activeTab === "regional-analysis" && (
            <RegionalAnalysis
              selectedRegions={selectedRegions}
            />
          )}
          {activeTab === "mobile-surveys" && <MobileSurveys />}
        </div>
      </div>
    </div>
  );
}
