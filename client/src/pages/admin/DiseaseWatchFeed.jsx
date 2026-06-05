import { useEffect, useRef, useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LabelList,
} from "recharts";

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

    // Metric Card Component
    const MetricCard = ({ label, value, change, percentage, trend }) => (
        <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
            <p className="text-gray-500 text-sm mb-[8px]">{label}</p>
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
                                <h3 className="text-[16px] font-semibold text-gray-800">{alert.disease}</h3>
                                <span className="px-[8px] py-[2px] bg-[#FFF3CD] text-[#856404] text-xs rounded-[4px] font-medium">
                                    {alert.type}
                                </span>
                            </div>
                            <p className="text-gray-600 text-sm mb-[8px]">{alert.summary}</p>
                            <div className="flex gap-[16px] text-xs text-gray-500">
                                <span>📍 {alert.region}</span>
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
        <div>
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] mb-[20px]">
                <h3 className="text-[18px] font-semibold text-gray-800 mb-[16px]">Registered Users by Region</h3>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                        data={regionUserData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                        <XAxis
                            dataKey="region"
                            angle={-45}
                            textAnchor="end"
                            height={100}
                            tick={{ fontSize: 12 }}
                        />
                        <YAxis />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "#fff",
                                border: "1px solid #E5E5E5",
                                borderRadius: "8px",
                            }}
                            formatter={(value) => value.toLocaleString()}
                        />
                        <Bar dataKey="users" fill="#6A8EB5" radius={[8, 8, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Regional Grid Cards */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[12px] mb-[16px]">
                <h3 className="text-[18px] font-semibold text-gray-800">Regional Cards</h3>
                <div className="relative w-full sm:w-auto" ref={regionDropdownRef}>
                    <button
                        type="button"
                        onClick={() => setShowRegionDropdown((isOpen) => !isOpen)}
                        className="w-full sm:w-auto min-h-[40px] px-[14px] py-[8px] border border-[#D8DDE3] rounded-[8px] bg-white text-gray-800 text-sm font-medium flex items-center justify-between gap-[12px] hover:border-[#6A8EB5] transition"
                        aria-expanded={showRegionDropdown}
                        aria-haspopup="true"
                    >
                        <span>
                            Filter Regions
                            {selectedRegions.length > 0 ? ` (${selectedRegions.length})` : ""}
                        </span>
                        <span className="text-gray-500 text-xs">v</span>
                    </button>

                    {showRegionDropdown && (
                        <div className="absolute right-0 top-full mt-[6px] w-full sm:w-[240px] max-h-[280px] overflow-y-auto bg-white border border-[#D8DDE3] rounded-[8px] shadow-lg z-20">
                            {regionUserData.map((region) => (
                                <label
                                    key={region.region}
                                    className="flex items-center gap-[10px] px-[12px] py-[10px] text-sm text-gray-800 cursor-pointer hover:bg-[#F5F5F5]"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedRegions.includes(region.region)}
                                        onChange={() => handleRegionChange(region.region)}
                                        className="w-[16px] h-[16px] accent-[#6A8EB5]"
                                    />
                                    <span>{region.region}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[12px]">
                {visibleRegionCards.map((region) => (
                    <div
                        key={region.region}
                        className="bg-white rounded-[12px] border border-[#E5E5E5] p-[16px]"
                    >
                        <h4 className="text-[14px] font-semibold text-gray-800 mb-[12px]">{region.region}</h4>
                        <p className="text-[20px] font-semibold text-gray-800 mb-[8px]">{region.users.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 mb-[12px]">registered users</p>
                        
                        {/* Percentage Bar Graph */}
                        <div className="flex items-center gap-[8px]">
                            <div className="flex-1 bg-[#F0F0F0] rounded-[4px] h-[6px] overflow-hidden">
                                <div
                                    className="bg-[#6A8EB5] h-full rounded-[4px]"
                                    style={{ width: `${region.percentage}%` }}
                                ></div>
                            </div>
                            <span className="text-xs font-semibold text-gray-700 min-w-[28px] text-right">{region.percentage}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

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
                <h1 className="text-[28px] font-semibold text-gray-800">Disease Watch Feed</h1>
                <p className="text-gray-500 mt-[4px]">
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
