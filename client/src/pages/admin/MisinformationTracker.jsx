import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    PieChart,
    Pie,
    Cell,
} from "recharts";

const MisinformationTracker = () => {
    return (
        <div className="flex flex-col gap-[20px]">
            {/* PAGE HEADER */}
            <div>
                <h1 className="text-[28px] font-semibold text-gray-800">
                    Misinformation Tracker
                </h1>
                <p className="text-gray-500 mt-[4px]">
                    Monitor and respond to health misinformation across the Philippines.
                </p>
            </div>

            {/* FILTESR SECTION */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-[16px]">
                    {/* LEFT */}
                    <div className="flex flex-wrap gap-[12px]">
                        <select className="border border-[#E5E5E5] rounded-[10px] px-[14px] py-[10px] text-sm">
                            <option>Last 7 Days</option>
                        </select>
                        <select className="border border-[#E5E5E5] rounded-[10px] px-[14px] py-[10px] text-sm">
                            <option>All Regions</option>
                        </select>

                        <button className="border border-[#E5E5E5] rounded-[10px] px-[16px] py-[10px] text-sm bg-[#F8F9FA]">
                            All Impacts
                        </button>
                        <button className="border border-[#E5E5E5] rounded-[10px] px-[16px] py-[10px] text-sm bg-[#F8F9FA]">
                            More Filters
                        </button>
                    </div>

                    {/* RIGHT */}
                    <input
                        type="text"
                        placeholder="Search misinformation claims..."
                        className="border border-[#E5E5E5] rounded-[10px] px-[14px] py-[10px] text-sm w-full xl:w-[320px]"
                    />
                </div>

                {/* SUMMARY CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-[16px] mt-[20px]">
                    <MisinfoSummaryCard
                        label="Active Misinformation"
                        value="18"
                        change="-23%"
                        color="#DC2626"
                    />
                    <MisinfoSummaryCard
                        label="Daily Mentions"
                        value="247"
                        change="+23%"
                        color="#2563EB"
                    />
                    <MisinfoSummaryCard
                        label="Response Rate"
                        value="72%"
                        change="+5%"
                        color="#20C997"
                    />
                    <MisinfoSummaryCard
                        label="Social Reach"
                        value="1.2M"
                        change="+23%"
                        color="#F97316"
                    />
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-[20px]">
                {/* TRENDING MISINFORMATION */}
                <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
                    <div className="mb-[20px]">
                        <h2 className="text-[20px] font-semibold text-gray-800">
                            Trending Misinformation
                        </h2>
                        <p className="text-sm text-gray-500 mt-[4px]">
                            Number of new misinformation claims over time.
                        </p>
                    </div>

                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart
                            data={[
                                { date: "Mar 1", claims: 12 },
                                { date: "Mar 8", claims: 16 },
                                { date: "Mar 15", claims: 14 },
                                { date: "Mar 22", claims: 18 },
                                { date: "Mar 29", claims: 16 },
                                { date: "Mar 5", claims: 22 },
                                { date: "Mar 12", claims: 19 },
                            ]}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line 
                                type="monotone"
                                dataKey="claims"
                                name="Misinformation Claims"
                                stroke="#F97316"
                                strokeWidth={3}
                                dot={{ r: 4 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                
                {/* MISINFORMATION BY SOURCE */}
                <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
                    <div className="mb-[20px]">
                        <h2 className="text-[20px] font-semibold text-gray-800">
                            Misinformation by Source
                        </h2>
                        <p className="text-sm text-gray-500 mt-[4px]">
                            Distribution of misinformation by source channel.
                        </p>
                    </div>

                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={[
                                    { name: "Social Media", value: 58 },
                                    { name: "Messaging Apps", value: 24 },
                                    { name: "Local News", value: 10 },
                                    { name: "Word of Mouth", value: 8 },
                                ]}
                                cx="50%"
                                cy="50%"
                                outerRadius={90}
                                dataKey="value"
                                label={({ percent }) => 
                                    `${(percent * 100).toFixed(0)}%`
                                }
                            >
                                <Cell fill="#2563EB" />
                                <Cell fill="#F97316" />
                                <Cell fill="#9CA3AF" />
                                <Cell fill="#20C997" />
                            </Pie>
                            <Tooltip />
                            <Legend
                                verticalAlign="bottom"
                                align="center"
                                height={36}
                                iconType="circle"
                                wrapperStyle={{
                                    paddingTop: "20px",
                                    lineHeight: "28px",
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
            {/* ALL MISINFORMATION CLAIMS */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-[12px] mb-[20px]">
                    <div>
                        <h2 className="text-[20px] font-semibold text-gray-800">
                            All Misinformation Claims
                        </h2>
                        <p className="text-sm text-gray-500 mt-[4px]">
                            Comprehensive list of detected misinformation claims across the Philippines.
                        </p>
                    </div>

                    <div className="flex gap-[10px]">
                        <button className="border border-[#E5E5E5] rounded-[10px] px-[14px] py-[9px] text-sm bg-[#F8F9FA]">
                            Export
                        </button>
                        <button className="bg-[#2563EB] text-white rounded-[10px] px-[14px] py-[9px] text-sm">
                            Create Alert
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#E5E5E5] text-left text-gray-500">
                                <th className="py-[12px] px-[10px] font-medium">Claim</th>
                                <th className="py-[12px] px-[10px] font-medium">Source</th>
                                <th className="py-[12px] px-[10px] font-medium">Region</th>
                                <th className="py-[12px] px-[10px] font-medium">Impact</th>
                                <th className="py-[12px] px-[10px] font-medium">Status</th>
                                <th className="py-[12px] px-[10px] font-medium">Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            <MisinfoClaimRow
                                claim="Drinking bleach prevents viral infection"
                                source="Social Media"
                                region="NCR"
                                impact="High"
                                status="Increasing"
                            />
                            <MisinfoClaimRow
                                claim="Herbal supplement cures all diseases"
                                source="Messaging Apps"
                                region="Region I"
                                impact="Medium"
                                status="Declining"
                            />
                            <MisinfoClaimRow
                                claim="Vaccines cause long-term infertility"
                                source="Social Media"
                                region="Region IV-A"
                                impact="High"
                                status="Monitoring"
                             />
                         </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const MisinfoSummaryCard = ({
    label,
    value,
    change,
    color,
}) => {
    return (
        <div className="bg-[#F8F9FA] border border-[#E5E5E5] rounded-[12px] p-[18px]">
            <p className="text-sm text-gray-500 mb-[10px]">
                {label}
            </p>

            <div className="flex items-end justify-between">
                <h2
                    className="text-[32px] font-semibold"
                    style={{ color }}
                >
                    {value}
                </h2>
                <span
                    className="text-sm font-medium"
                    style={{ color }}
                >
                    {change}
                </span>
            </div>
        </div>
    );
};

const MisinfoClaimRow = ({
    claim,
    source,
    region,
    impact,
    status,
}) => {
    const impactColor = {
        High: {
            backgroundColor: "#FEE2E2",
            color: "#DC2626",
        },
        Medium: {
            backgroundColor: "#FFEDD5",
            color: "#EA580C",
        },
        Low: {
            backgroundColor: "#D1FAE5",
            color: "#059669",
        },
    };

    const statusColor = {
        Increasing: {
            backgroundColor: "#FFEDD5",
            color: "#EA580C",
        },
        Declining: {
            backgroundColor: "#D1FAE5",
            color: "#059669",
        },
        Monitoring: {
            backgroundColor: "#DBEAFE",
            color: "#2563EB",
        },
    };

    return (
        <tr className="border-b border-[#F0F0F0]">
            <td className="py-[14px] px-[10px]">
                <p className="font-medium text-gray-800">{claim}</p>
                <p className="text-xs text-gray-400">First reported: Today</p>
            </td>
            <td className="py-[14px] px-[10px] text-gray-600">{source}</td>
            <td className="py-[14px] px-[10px] text-gray-600">{region}</td>
            <td className="py-[14px] px-[10px]">
                <span className="px-[8px] py-[4px] rounded-full text-xs font-medium" style={impactColor[impact]}>
                    {impact}
                </span>
            </td>
            <td className="py-[14px] px-[10px]">
                <span className="px-[8px] py-[4px] rounded-full text-xs font-medium" style={statusColor[status]}>
                    {status}
                </span>
            </td>
            <td className="py-[14px] px-[10px]">
                <div className="flex gap-[10px]">
                    <button className="text-blue-600 text-sm">View</button>
                    <button className="text-red-600 text-sm">Respond</button>
                </div>
            </td>
        </tr>
    );
};

export default MisinformationTracker;