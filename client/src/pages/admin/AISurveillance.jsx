import { useState } from "react";
import { useSelector } from "react-redux";

import Map from "../../components/admin/Map";

import Regions from "../../assets/data/regions.json";
import RegionsCenter from "../../assets/data/regions_center.json";
import DummyData from "../../assets/data/dummy_data_v3.json";

import { useFetchPointsQuery } from "../../features/api/pointsSlice";

import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    AreaChart,
    Area,
} from "recharts";

import {
    ToolbarSearch,
    ToolbarButton,
    ToolbarSelect,
} from "../../components/ToolbarControls";

import Report from "../../components/admin/Report";

import {
    useGenerateSuspectedSymptomsQuery,
    useGeneratePercentageQuery,
} from "../../features/api/analyticsSlice";

const AISurveillance = () => {
    const user = useSelector((state) => state.auth.user);

    const { data: points, isLoading: isPointsLoading } = useFetchPointsQuery();

    const surveillancePoints = points || [];
    
    /* MAP */
    const [filters, setFilters] = useState({
        region: Regions.regions.filter((r) =>
            user.accessible_regions.includes(r.value)
        ),
        dateRange: 7,
        disease: "all",
    });

    const handleChangeFilter = (key, value) => {
        setFilters((filters) => ({
            ...filters,
            [key]: value,
        }));
    };

    const getCenter = () => {
        if (user.user_type === "USER") {
            return RegionsCenter.find((c) => c.region == user.region).center;
        }

        return [13, 122];
    };

    /* FILTERS */
    const diseaseCode = {
        tuberculosis: "TB",
        pneumonia: "PN",
        covid: "COVID",
        auri: "AURI",
    };

    const filteredSurveillancePoints = surveillancePoints.filter((point) => {
        const regionMatches =
            filters.region.length === Regions.regions.length ||
            filters.region.some((region) => region.value === point.region);

        const diseaseMatches =
            filters.disease === "all" ||
            point.annotations?.includes(diseaseCode[filters.disease]);

        return regionMatches && diseaseMatches;
    });

    /* SUMMARY CARD/COUNTS */
    const { data: suspectedSymptoms, isFetching: isSuspectedSymptomsFetching } =
        useGenerateSuspectedSymptomsQuery();

    const formatCount = (value) => Number(value || 0).toLocaleString();

    const selectedDiseaseCode = diseaseCode[filters.disease];

    const filteredSuspectedSymptoms = filteredSurveillancePoints.reduce(
        (counts, point) => {
            const pointCounts = point.annotations_count || {};

            ["TB", "PN", "COVID", "AURI"].forEach((code) => {
                const shouldIncludeDisease = 
                    filters.disease === "all" || code === selectedDiseaseCode;

                if (shouldIncludeDisease) {
                    counts[code] += Number(pointCounts[code] || 0);
                }
            });

            return counts;
        },
        {
            TB: 0,
            PN: 0,
            COVID: 0,
            AURI: 0,
        }
    );

    filteredSuspectedSymptoms.total =
        filteredSuspectedSymptoms.TB +
        filteredSuspectedSymptoms.PN +
        filteredSuspectedSymptoms.COVID +
        filteredSuspectedSymptoms.AURI;

    const filteredActiveRegionCount = new Set(
        filteredSurveillancePoints
            .map((point) => point.region)
            .filter(Boolean)
    ).size;

    const filteredRespiratoryAlertCount = filteredSurveillancePoints.filter((point) => {
        const counts = point.annotations_count || {};
        return Object.values(counts).some((count) => Number(count) > 0);
    }).length;

    /* SUSPECTED CONDITIONS PERCENTAGE */
    const [percentageFilter, setPercentageFilter] = useState(
        user.user_type == "USER" ? user.accessible_regions[0] : "all"
    );

    const { data: percentage, isFetching: isPercentageFetching } =
        useGeneratePercentageQuery();
    
    const COLORS = ["#32418C", "#2572A5", "#9BCC33", "#FBD117"];
    const RADIAN = Math.PI / 180;

    return (
        <div className="flex flex-col gap-[10px]">
            {/* PAGE HEADER */}
            <div>
                <h1 className="text-[24px] font-semibold text-gray-800">
                    AI Surveillance
                </h1>

                <p className="text-gray-500 text-[14px]">
                    Real-time disease surveillance, outbreak monitoring, and AI-driven public health analytics.
                </p>
            </div>

            {/* FILTER SECTION */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[10px]">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-[16px]">
                    {/* LEFT */}
                    <div className="flex flex-wrap gap-[12px]">
                        <ToolbarSelect
                            value={filters.dateRange}
                            onChange={(event) => handleChangeFilter("dateRange", Number(event.target.value))}
                        >
                            <option value={7}>Last 7 Days</option>
                            <option value={14}>Last 14 Days</option>
                            <option value={28}>Last 28 Days</option>
                        </ToolbarSelect>
                        <ToolbarSelect
                            value={
                                filters.region.length === Regions.regions.length
                                    ? "all"
                                    : filters.region[0]?.value || "all"   
                            }
                            onChange={(event) => {
                                const value = event.target.value;

                                handleChangeFilter(
                                    "region",
                                    value === "all"
                                        ? Regions.regions.filter((region) =>
                                            user.accessible_regions.includes(region.value)
                                        )
                                        : Regions.regions.filter((region) => region.value === value)
                                );
                            }}
                        >
                            <option value="all">All Regions</option>
                            {Regions.regions
                                .filter((region) => user.accessible_regions.includes(region.value))
                                .map((region) => (
                                    <option key={region.value} value={region.value}>
                                        {region.label}
                                    </option>
                                ))
                            }
                        </ToolbarSelect>
                        <ToolbarSelect
                            value={filters.disease}
                            onChange={(event) => handleChangeFilter("disease", event.target.value)}
                        >
                            <option value="all">All Impacts</option>
                            <option value="tuberculosis">Tuberculosis</option>
                            <option value="pneumonia">Pneumonia</option>
                            <option value="covid">COVID</option>
                            <option value="auri">AURI</option>
                        </ToolbarSelect>
                    </div>
                    {/* RIGHT */}
                    <div className="flex flex-wrap gap-[12px]">
                        <ToolbarSearch placeholder="Search regions, diseases..." />
                        <ToolbarButton iconName="Upload" variant="primary">
                            Export
                        </ToolbarButton>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-[10px]">
                {/* MAP SECTION */}
                <div className="xl:col-span-2 bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[630px]">
                    <h2 className="text-[18px] font-semibold text-gray-800 mb-[12px]">Real-time Outbreak Monitoring</h2>
                    <div className="trends-wrapper h-[595px] rounded-[12px] overflow-hidden border border-[#E5E5E5]">
                        <Map 
                            filters={filters}
                            data={DummyData}
                            mapCenter={getCenter}
                            points={filteredSurveillancePoints}
                            isPointsLoading={isPointsLoading}
                        />
                    </div>
                    
                </div>
                {/* RIGHT PANELS */}
                <div className="flex flex-col gap-[10px]">
                    {/* SUMMARY CARDS */}
                    <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
                        {/* SUSPECTED CASES */}
                        <div className="xl:col-span-1 bg-white rounded-[12px] border border-[#E5E5E5] p-[16px]">
                            <div className="flex justify-between items-center h-full">
                                {/* LEFT */}
                                <div className="flex flex-col justify-center">
                                    <p className="text-gray-500 text-sm mb-[8px]">Suspected Cases</p>
                                    <h2 className="text-[24px] font-semibold text-gray-800 leading-none">{formatCount(filteredSuspectedSymptoms?.total)}</h2>
                                </div>
                                {/* RIGHT */}
                                <div className="grid grid-cols-2 gap-x-[32px] gap-y-[8px]">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">TB</p>
                                        <p className="text-[12px] font-semibold text-gray-800">{formatCount(filteredSuspectedSymptoms?.TB)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">COVID</p>
                                        <p className="text-[12px] font-semibold text-gray-800">{formatCount(filteredSuspectedSymptoms?.COVID)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Pneumonia</p>
                                        <p className="text-[12px] font-semibold text-gray-800">{formatCount(filteredSuspectedSymptoms?.PN)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">AURI</p>
                                        <p className="text-[12px] font-semibold text-gray-800">{formatCount(filteredSuspectedSymptoms?.AURI)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* ACTIVE REGIONS */}
                        <SummaryCard label="Active Regions" value={filteredActiveRegionCount} />
                        {/* RESPIRATORY ALERTS */}
                        <SummaryCard label="Respiratory Alerts" value={filteredRespiratoryAlertCount} />
                        {/* HIGH RISK AREAS */}
                        <SummaryCard label="High Risk Areas" value="TBD" />
                    </div>
                    <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
                        <h2 className="text-[18px] font-semibold text-gray-800 mb-[12px]">Environmental Data</h2>
                        <div className="flex flex-col gap-[12px]">
                            <MetricRow label="Air Quality Index" value="Moderate" />
                            <MetricRow label="Weather Pattern" value="Humid / Cloudy" />
                            <MetricRow label="Heat Index" value="38°C" />
                        </div>
                    </div> 
                </div>
            </div>
            {/* HEALTH MONITORING */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-[10px]">
                {/* RESPIRATORY MONITORING */}
                <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[260px]">
                    <h2 className="text-[18px] font-semibold text-gray-800">
                        Respiratory Monitoring
                    </h2>
                    <p className="text-sm text-gray-500 mb-[12px]">
                        Air quality and respiratory metrics with environmental factors.
                    </p>

                    <ResponsiveContainer width="100%" height={360}>
                        <LineChart
                            data={[
                                {
                                    time: "13:00",
                                    respiratoryRate: 3.4,
                                    aqi: 13,
                                    temperature: 15,
                                    coughFrequency: 12,
                                    pm25: 2.9,
                                    humidity: 7,
                                },
                                {
                                    time: "13:01",
                                    respiratoryRate: 3.7,
                                    aqi: 13.3,
                                    temperature: 15.5,
                                    coughFrequency: 12.5,
                                    pm25: 3.5,
                                    humidity: 7.2,
                                },
                                {
                                    time: "13:02",
                                    respiratoryRate: 3.4,
                                    aqi: 13,
                                    temperature: 15,
                                    coughFrequency: 12,
                                    pm25: 2.9,
                                    humidity: 7,
                                },
                            ]}
                            margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                        >
                            <CartesianGrid strokeDasharray="3 3 " />
                            <XAxis dataKey="time" />
                            <YAxis/>
                            <Tooltip />
                            <Legend 
                                verticalAlign="bottom"
                                align="center"
                                layout="horizontal"
                                iconType="circle"
                                wrapperStyle={{
                                    paddingTop: "20px",
                                    width: "100%",
                                    lineHeight: "28px",
                                }}
                                formatter={(value) => (
                                    <span className="text-[13px] text-gray-700 mr-[24px] inline-block min-w-[160px]">
                                        {value}
                                    </span>
                                )}
                            />

                            <Line type="monotone" dataKey="respiratoryRate" name="Respiratory Rate" stroke="#32418C" />
                            <Line type="monotone" dataKey="aqi" name="AQI" stroke="#2572A5" />
                            <Line type="monotone" dataKey="temperature" name="Temperature (°C)" stroke="#1D8D9F" />
                            <Line type="monotone" dataKey="coughFrequency" name="Cough Frequency" stroke="#1ABC9C" />
                            <Line type="monotone" dataKey="pm25" name="PM2.5" stroke="#9BCC33" />
                            <Line type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#FBD117" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* TREND FORECASTING */}
                <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[300px]">
                    <h2 className="text-[18px] font-semibold text-gray-800">
                        Trend Forecasting
                    </h2>
                    <p className="text-sm text-gray-500 mb-[12px]">
                        Projected disease signal trends based on recent surveillance patterns.
                    </p>

                    <ResponsiveContainer width="100%" height={360}>
                        <AreaChart
                            data={[
                                { day: "Mon", actual: 120, forecast: 128 },
                                { day: "Tue", actual: 135, forecast: 142 },
                                { day: "Wed", actual: 150, forecast: 160 },
                                { day: "Thu", actual: 170, forecast: 182 },
                                { day: "Fri", actual: 185, forecast: 205 },
                                { day: "Sat", actual: null, forecast: 218 },
                                { day: "Sun", actual: null, forecast: 235 },
                            ]}
                            margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="day" />
                            <YAxis />
                            <Tooltip />
                            <Legend
                                verticalAlign="bottom"
                                align="center"
                                iconType="circle"
                                wrapperStyle={{
                                    paddingTop: "20px",
                                    width: "100%",
                                    lineHeight: "28px",
                                }}
                            />
                        <Area
                            type="monotone"
                            dataKey="actual"
                            name="Actual Reports"
                            stroke="#32418C"
                            fill="#DBEAFE"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                        />
                        <Area
                            type="monotone"
                            dataKey="forecast"
                            name="Forecasted Trend"
                            stroke="#FBD117"
                            fill="#FFEDD5"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                        />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* SUSPECTED CONDITIONS PERCENTAGE */}
                <Report
                    heading="Suspected Conditions Percentage"
                    filter={percentageFilter}
                    setFilter={setPercentageFilter}
                    isLoading={isPercentageFetching}
                >
                    <ResponsiveContainer width="100%" height={360}>
                        {percentage && (
                            <PieChart>
                                <Legend 
                                    verticalAlign="bottom"
                                    align="center"
                                    iconType="circle"
                                    wrapperStyle={{
                                        paddingTop: "20px",
                                        lineHeight: "28px",
                                    }}
                                    formatter={(value) => (
                                        <span className="text-[13px] text-gray-700 mr-[18px]">
                                            {value}
                                        </span>
                                    )}
                                />

                                <Pie
                                    data={percentage[percentageFilter]}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({
                                        cx,
                                        cy,
                                        midAngle,
                                        innerRadius,
                                        outerRadius,
                                        percent,
                                    }) => {
                                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                        const y = cy + radius * Math.sin(-midAngle * RADIAN);

                                        return (
                                            <text
                                                x={x}
                                                y={y}
                                                fill="white"
                                                textAnchor={x > cx ? "start" : "end"}
                                                dominantBaseline="central"
                                            >
                                                {`${(percent * 100).toFixed(0)}%`}
                                            </text>
                                        );
                                    }}
                                    fill="#8884d8"
                                    dataKey="count"
                                >
                                    {percentage[percentageFilter]?.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={COLORS[index % COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        )}
                    </ResponsiveContainer>
                </Report>
            </div>
        </div>
    );
};

const SummaryCard = ({ label, value }) => {
    return (
        <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[12px] mt-[10px]">
            <p className="text-gray-500 text-sm">{label}</p>
            <h2 className="text-[24px] font-semibold text-gray-800">{value}</h2>
        </div>
    );
};

const MetricRow = ({ label, value }) => {
    return (
        <div className="flex justify-between items-center bg-[#F5F5F5] rounded-[8px] p-[12px]">
            <span className="text-sm text-gray-500">{label}</span>
            <span className="text-sm font-medium text-gray-800">{value}</span>
        </div>
    );
};
 
export default AISurveillance;