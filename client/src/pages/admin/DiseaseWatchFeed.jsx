import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
    BarChart,
    Bar,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LabelList,
} from "recharts";
import {
    DASHBOARD_CARD_TITLE_CLASS,
    DASHBOARD_METRIC_LABEL_CLASS,
    DASHBOARD_PAGE_SUBTITLE_CLASS,
    DASHBOARD_PAGE_TITLE_CLASS,
    DASHBOARD_SECTION_SUBTITLE_CLASS,
    DASHBOARD_SECTION_TITLE_CLASS,
} from "./dashboardTypography";

const REGIONAL_COVERAGE_PALETTE = ["#32418C", "#2572A5", "#4D8FC4", "#9BCC33", "#FBD117"];
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

const formatCompactNumber = (value) =>
    new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(value);

const DiseaseWatchFeed = () => {
    const [activeTab, setActiveTab] = useState("recent-alerts");
    const [selectedRegions, setSelectedRegions] = useState([]);
    const [showRegionDropdown, setShowRegionDropdown] = useState(false);
    const regionDropdownRef = useRef(null);

    // Mock data for Regional Coverage
    const regionUserData = [
        { region: "NCR", users: 2450, percentage: 15 },
        { region: "Region I", users: 1200, percentage: 7 },
        { region: "Region II", users: 1800, percentage: 11 },
        { region: "Region III", users: 2100, percentage: 13 },
        { region: "Region IV-A", users: 1900, percentage: 11 },
        { region: "Region IV-B", users: 950, percentage: 6 },
        { region: "Region V", users: 1400, percentage: 8 },
        { region: "Region CAR", users: 1100, percentage: 7 },
        { region: "Region VI", users: 1550, percentage: 9 },
        { region: "Region VII", users: 1300, percentage: 8 },
        { region: "Region VIII", users: 980, percentage: 6 },
        { region: "Region IX", users: 1050, percentage: 6 },
        { region: "Region X", users: 1200, percentage: 7 },
        { region: "Region XI", users: 1450, percentage: 9 },
        { region: "Region XII", users: 1100, percentage: 7 },
        { region: "Region XIII (CARAGA)", users: 900, percentage: 5 },
        { region: "BARMM", users: 750, percentage: 4 },
    ];

    // Mock data for Recent Alerts
    const recentAlerts = [
        {
            id: 1,
            disease: "Dengue Fever",
            region: "NCR",
            type: "Alert Distribution",
            timestamp: "2 hours ago",
            summary: "Significant spike in dengue cases detected in Manila area",
        },
        {
            id: 2,
            disease: "COVID-19",
            region: "Region IV-A",
            type: "Early Warning",
            timestamp: "4 hours ago",
            summary: "New variant mentions increasing across social media in Calabarzon",
        },
        {
            id: 3,
            disease: "Tuberculosis",
            region: "Region III",
            type: "Symptom Report",
            timestamp: "6 hours ago",
            summary: "Respiratory symptoms trending in Central Luzon region",
        },
        {
            id: 4,
            disease: "Influenza",
            region: "NCR",
            type: "Alert Distribution",
            timestamp: "8 hours ago",
            summary: "Seasonal flu activity elevated in Metro Manila",
        },
        {
            id: 5,
            disease: "Measles",
            region: "Region VII",
            type: "Early Warning",
            timestamp: "12 hours ago",
            summary: "Outbreak potential detected in Cebu area based on community reports",
        },
    ];

    // Mock data for User Analytics
    const userAnalytics = {
        totalUsers: {
            current: 16380,
            previous: 14920,
            change: 1460,
            percentage: 9.8,
            trend: "up",
        },
        alertOpenRate: {
            current: 68,
            previous: 61,
            change: 7,
            percentage: 11.5,
            trend: "up",
        },
        symptomReports: {
            current: 4250,
            previous: 3890,
            change: 360,
            percentage: 9.2,
            trend: "up",
        },
    };

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

    const handleRegionChange = (regionName) => {
        setSelectedRegions((currentRegions) =>
            currentRegions.includes(regionName)
                ? currentRegions.filter((region) => region !== regionName)
                : [...currentRegions, regionName]
        );
    };

    const visibleRegionCards =
        selectedRegions.length === 0
            ? regionUserData
            : regionUserData.filter((region) =>
                  selectedRegions.includes(region.region)
              );

    const getRegionAccentColor = (regionName) =>
        REGIONAL_COVERAGE_PALETTE[
            regionUserData.findIndex((region) => region.region === regionName) %
                REGIONAL_COVERAGE_PALETTE.length
        ];

    const RecentAlertEntityHighlight = ({ label, tone }) => (
        <span
            className="px-[6px] py-[2px] rounded-[6px] text-sm font-medium"
            style={RECENT_ALERT_ENTITY_STYLES[tone]}
        >
            {label}
        </span>
    );

    RecentAlertEntityHighlight.propTypes = {
        label: PropTypes.string.isRequired,
        tone: PropTypes.oneOf(["disease", "symptom", "location"]).isRequired,
    };

    const renderRecentAlertSummary = (alert) => {
        switch (alert.id) {
            case 1:
                return (
                    <>
                        Significant spike in{" "}
                        <RecentAlertEntityHighlight label="dengue" tone="disease" /> cases
                        detected in{" "}
                        <RecentAlertEntityHighlight label="Manila area" tone="location" />
                    </>
                );
            case 2:
                return (
                    <>
                        New variant mentions increasing across social media in{" "}
                        <RecentAlertEntityHighlight label="Calabarzon" tone="location" />
                    </>
                );
            case 3:
                return (
                    <>
                        <RecentAlertEntityHighlight
                            label="Respiratory symptoms"
                            tone="symptom"
                        />{" "}
                        trending in{" "}
                        <RecentAlertEntityHighlight
                            label="Central Luzon region"
                            tone="location"
                        />
                    </>
                );
            case 4:
                return (
                    <>
                        Seasonal{" "}
                        <RecentAlertEntityHighlight label="flu" tone="disease" /> activity
                        elevated in{" "}
                        <RecentAlertEntityHighlight label="Metro Manila" tone="location" />
                    </>
                );
            case 5:
                return (
                    <>
                        Outbreak potential detected in{" "}
                        <RecentAlertEntityHighlight label="Cebu area" tone="location" /> based
                        on community reports
                    </>
                );
            default:
                return alert.summary;
        }
    };

    // Metric Card Component
    const MetricCard = ({ label, value, percentage, trend }) => (
        <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
            <p className={`${DASHBOARD_METRIC_LABEL_CLASS} mb-[8px]`}>{label}</p>
            <div className="flex items-end justify-between">
                <h2 className="text-[32px] font-semibold text-gray-800 leading-none">{value.toLocaleString()}</h2>
                <div className="text-right">
                    <p className={`text-sm font-semibold ${trend === "up" ? "text-green-600" : "text-red-600"}`}>
                        {trend === "up" ? "↑" : "↓"} {percentage}%
                    </p>
                    <p className="text-xs text-gray-500">vs last month</p>
                </div>
            </div>
        </div>
    );

    // Recent Alerts Sub-page
    const RecentAlerts = () => (
        <div className="grid grid-cols-1 gap-[12px]">
            {recentAlerts.map((alert) => (
                <div
                    key={alert.id}
                    className="bg-white rounded-[12px] border border-[#E5E5E5] p-[16px] hover:shadow-md transition-shadow"
                >
                    <div className="flex justify-between items-start gap-[16px]">
                        <div className="flex-1">
                            <div className="flex items-center gap-[8px] mb-[8px]">
                                <h3 className={DASHBOARD_CARD_TITLE_CLASS}>
                                    <RecentAlertEntityHighlight label={alert.disease} tone="disease" />
                                </h3>
                                <span className="px-[8px] py-[2px] bg-[#FFF3CD] text-[#856404] text-xs rounded-[4px] font-medium">
                                    {alert.type}
                                </span>
                            </div>
                            <p className="text-[15px] text-gray-800 leading-[1.8] mb-[8px]">
                                {renderRecentAlertSummary(alert)}
                            </p>
                            <div className="flex gap-[16px] text-xs text-gray-500">
                                <span>
                                    📍 <RecentAlertEntityHighlight label={alert.region} tone="location" />
                                </span>
                                <span>🕐 {alert.timestamp}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    // Regional Coverage Sub-page
    const RegionalCoverage = () => (
        <div className="flex flex-col gap-[18px]">
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] shadow-[0_10px_30px_rgba(50,65,140,0.06)]">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-[14px] mb-[18px]">
                    <div>
                        <h3 className={DASHBOARD_SECTION_TITLE_CLASS}>
                            Registered Users by Region
                        </h3>
                        <p className={`${DASHBOARD_SECTION_SUBTITLE_CLASS} mt-[4px]`}>
                            Regional distribution of registered users across the monitored coverage areas.
                        </p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-[#D9E3F2] bg-[#F5F8FD] px-[12px] py-[6px] text-xs font-semibold uppercase tracking-[0.08em] text-[#32418C]">
                        {regionUserData.length} regions tracked
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
                                        fill={getRegionAccentColor(region.region)}
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

            {/* Regional Grid Cards */}
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-[14px]">
                <div>
                    <h3 className={DASHBOARD_SECTION_TITLE_CLASS}>
                        Regional Cards
                    </h3>
                    <p className={`${DASHBOARD_SECTION_SUBTITLE_CLASS} mt-[4px]`}>
                        Detailed user totals and share of registered coverage by region.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-[12px]">
                    <span className="inline-flex items-center rounded-full border border-[#D9E3F2] bg-[#F5F8FD] px-[12px] py-[6px] text-xs font-semibold uppercase tracking-[0.08em] text-[#2572A5]">
                        Showing {visibleRegionCards.length} region{visibleRegionCards.length !== 1 ? "s" : ""}
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
                                {selectedRegions.length > 0 ? ` (${selectedRegions.length})` : ""}
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
                                    {regionUserData.map((region) => (
                                        <label
                                            key={region.region}
                                            className="flex cursor-pointer items-center gap-[10px] px-[14px] py-[10px] text-sm text-[#1F2A44] transition hover:bg-[#F8FAFC]"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedRegions.includes(region.region)}
                                                onChange={() => handleRegionChange(region.region)}
                                                className="h-[16px] w-[16px] accent-[#32418C]"
                                            />
                                            <span>{region.region}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2 xl:grid-cols-4">
                {visibleRegionCards.map((region) => {
                    const accentColor = getRegionAccentColor(region.region);

                    return (
                    <div
                        key={region.region}
                        className="overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white shadow-[0_10px_28px_rgba(37,114,165,0.08)]"
                    >
                        <div
                            className="h-[5px] w-full"
                            style={{ backgroundColor: accentColor }}
                        />
                        <div className="border-b border-[#EDF1F7] bg-[#F8FAFC] px-[16px] py-[14px]">
                            <div className="flex items-start justify-between gap-[12px]">
                                <div>
                                    <h4 className={DASHBOARD_CARD_TITLE_CLASS}>
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
                                registered users
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
                                    {formatCompactNumber(region.users)} users
                                </span>
                            </div>
                        </div>
                    </div>
                    );
                })}
            </div>
        </div>
    );

    MetricCard.propTypes = {
        label: PropTypes.string.isRequired,
        value: PropTypes.number.isRequired,
        percentage: PropTypes.number.isRequired,
        trend: PropTypes.oneOf(["up", "down"]).isRequired,
    };

    // User Analytics Sub-page
    const UserAnalytics = () => (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-[20px]">
            <MetricCard
                label="Total Users"
                value={userAnalytics.totalUsers.current}
                change={userAnalytics.totalUsers.change}
                percentage={userAnalytics.totalUsers.percentage}
                trend={userAnalytics.totalUsers.trend}
            />
            <MetricCard
                label="Alert Open Rate"
                value={userAnalytics.alertOpenRate.current}
                change={userAnalytics.alertOpenRate.change}
                percentage={userAnalytics.alertOpenRate.percentage}
                trend={userAnalytics.alertOpenRate.trend}
            />
            <MetricCard
                label="Symptom Reports"
                value={userAnalytics.symptomReports.current}
                change={userAnalytics.symptomReports.change}
                percentage={userAnalytics.symptomReports.percentage}
                trend={userAnalytics.symptomReports.trend}
            />
        </div>
    );

    return (
        <div className="flex flex-col gap-[20px]">
            {/* PAGE HEADER */}
            <div>
                <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>Disease Watch Feed</h1>
                <p className={`${DASHBOARD_PAGE_SUBTITLE_CLASS} mt-[4px]`}>
                    Real-time disease alerts, regional coverage analytics, and user engagement metrics.
                </p>
            </div>

            {/* TOP METRIC CONTAINERS */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-[20px]">
                {/* Alert Distribution */}
                <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm mb-[8px]">Alert Distribution</p>
                            <h2 className="text-[32px] font-semibold text-gray-800 leading-none">847</h2>
                            <p className="text-xs text-gray-500 mt-[4px]">alerts this week</p>
                        </div>
                        <div className="text-4xl">🚨</div>
                    </div>
                </div>

                {/* Early Warning */}
                <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm mb-[8px]">Early Warning</p>
                            <h2 className="text-[32px] font-semibold text-gray-800 leading-none">23</h2>
                            <p className="text-xs text-gray-500 mt-[4px]">potential outbreaks</p>
                        </div>
                        <div className="text-4xl">⚠️</div>
                    </div>
                </div>

                {/* Symptom Report */}
                <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm mb-[8px]">Symptom Report</p>
                            <h2 className="text-[32px] font-semibold text-gray-800 leading-none">4,250</h2>
                            <p className="text-xs text-gray-500 mt-[4px]">reports submitted</p>
                        </div>
                        <div className="text-4xl">📋</div>
                    </div>
                </div>
            </div>

            {/* TAB NAVIGATION */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[12px]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-[8px] bg-[#F5F5F5] rounded-[10px] p-[6px]">
                    <button
                        type="button"
                        onClick={() => setActiveTab("recent-alerts")}
                        className={`px-[16px] py-[10px] rounded-[8px] text-sm font-medium transition ${
                            activeTab === "recent-alerts"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-500 hover:text-gray-800"
                        }`}
                    >
                        Recent Alerts
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("regional-coverage")}
                        className={`px-[16px] py-[10px] rounded-[8px] text-sm font-medium transition ${
                            activeTab === "regional-coverage"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-500 hover:text-gray-800"
                        }`}
                    >
                        Regional Coverage
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("user-analytics")}
                        className={`px-[16px] py-[10px] rounded-[8px] text-sm font-medium transition ${
                            activeTab === "user-analytics"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-500 hover:text-gray-800"
                        }`}
                    >
                        User Analytics
                    </button>
                </div>
            </div>

            {/* TAB CONTENT */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[400px]">
                {activeTab === "recent-alerts" && <RecentAlerts />}
                {activeTab === "regional-coverage" && <RegionalCoverage />}
                {activeTab === "user-analytics" && <UserAnalytics />}
            </div>
        </div>
    );
};

export default DiseaseWatchFeed;
