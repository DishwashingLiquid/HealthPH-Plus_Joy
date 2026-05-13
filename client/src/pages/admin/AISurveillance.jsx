import { useState } from "react";
import { useSelector } from "react-redux";
import ReactWordCloud from "react-wordcloud";

import Map from "../../components/admin/Map";

import Regions from "../../assets/data/regions.json";
import RegionsCenter from "../../assets/data/regions_center.json";
import DummyData from "../../assets/data/dummy_data_v3.json";

import { useFetchPointsQuery } from "../../features/api/pointsSlice";

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
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
} from "recharts";

import Report from "../../components/admin/Report";
import capitalizeSymptom from "../../hooks/useCapitalizeSymptom";

import {
    useGenerateSuspectedSymptomsQuery,
    useGenerateFrequentWordsQuery,
    useGenerateWordCloudQuery,
    useGeneratePercentageQuery,
} from "../../features/api/analyticsSlice";

const AISurveillance = () => {
    const user = useSelector((state) => state.auth.user);

    /* SUMMARY CARD/COUNTS */
    const { data: suspectedSymptoms, isFetching: isSuspectedSymptomsFetching } =
        useGenerateSuspectedSymptomsQuery();

    const formatCount = (value) => {
        if (isSuspectedSymptomsFetching || !value) return "0";
        return value["count"]?.toLocaleString() || "0";
    };

    /* MAP */
    const { data: points, isLoading: isPointsLoading } = useFetchPointsQuery();

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

    /* TOP WORDS */
    const [topWordsFilter, setTopWordsFilter] = useState(
        user.user_type == "USER" ? user.accessible_regions[0] : "all"
    );

    const { data: frequentWords, isFetching: isTopWordsFetching } =
        useGenerateFrequentWordsQuery(topWordsFilter);

    /* WORD CLOUD */
    const [wordCloudFilter, setWordCloudFilter] = useState(
        user.user_type == "USER" ? user.accessible_regions[0] : "all"
    );

    const { data: wordcloud, isFetching: isWordCloudFetching } =
        useGenerateWordCloudQuery(wordCloudFilter);
    
    const wordcloudOptions = {
        colors: ["#171E26", "#F5D76E", "#6A8EB5", "#F78C6B", "#78C6B2"],
        rotations: 0,
        deterministic: true,
        padding: 20,
        fontSizes: [20, 50],
        scale: "linear",
    };

    /* SUSPECTED CONDITIONS PERCENTAGE */
    const [percentageFilter, setPercentageFilter] = useState(
        user.user_type == "USER" ? user.accessible_regions[0] : "all"
    );

    const { data: percentage, isFetching: isPercentageFetching } =
        useGeneratePercentageQuery();
    
    const COLORS = ["#F5D76E", "#6A8EB5", "#F78C6B", "#78C6B2"];
    const RADIAN = Math.PI / 180;

    return (
        <div className="flex flex-col gap-[20px]">
            {/* PAGE HEADER */}
            <div>
                <h1 className="text-[28px] font-semibold text-gray-800">
                    AI Surveillance
                </h1>

                <p className="text-gray-500 mt-[4px]">
                    Real-time disease surveillance, outbreak monitoring, and AI-driven public health analytics.
                </p>
            </div>

            {/* FILTER SECTION */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[12px]">
                <div className="flex flex-wrap gap-[12px]">
                    <div className="bg-[#F5F5F5] px-[16px] py-[10px] rounded-[8px]">
                        Region Filter
                    </div>
                    <div className="bg-[#F5F5F5] px-[16px] py-[10px] rounded-[8px]">
                        Disease Filter
                    </div>
                    <div className="bg-[#F5F5F5] px-[16px] py-[10px] rounded-[8px]">
                        Time Range
                    </div>
                    <div className="bg-[#F5F5F5] px-[16px] py-[10px] rounded-[8px]">
                        Language
                    </div>
                </div>
            </div>

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-[20px]">
                {/* SUSPECTED CASES */}
                <div className="xl:col-span-1 bg-white rounded-[12px] border border-[#E5E5E5] p-[12px]">
                    <div className="flex justify-between items-center h-full">
                        {/* LEFT */}
                        <div className="flex flex-col justify-center">
                            <p className="text-gray-500 text-sm mb-[8px]">Suspected Cases</p>
                            <h2 className="text-[32px] font-semibold text-gray-800 leading-none">{formatCount(suspectedSymptoms?.total)}</h2>
                        </div>
                        {/* RIGHT */}
                        <div className="grid grid-cols-2 gap-x-[32px] gap-y-[8px]">
                            <div>
                                <p className="text-xs text-gray-500 uppercase">TB</p>
                                <p className="text-[12px] font-semibold text-gray-800">{formatCount(suspectedSymptoms?.TB)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase">COVID</p>
                                <p className="text-[12px] font-semibold text-gray-800">{formatCount(suspectedSymptoms?.COVID)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Pneumonia</p>
                                <p className="text-[12px] font-semibold text-gray-800">{formatCount(suspectedSymptoms?.PN)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase">AURI</p>
                                <p className="text-[12px] font-semibold text-gray-800">{formatCount(suspectedSymptoms?.AURI)}</p>
                            </div>
                        </div>
                    </div>
                </div>
                {/* ACTIVE REGIONS */}
                <SummaryCard label="Active Regions" value="15" />
                {/* RESPIRATORY ALERTS */}
                <SummaryCard label="Respiratory Alerts" value="3" />
                {/* HIGH RISK AREAS */}
                <SummaryCard label="High Risk Areas" value="5" />
            </div>

            {/* MAIN CONTENT */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-[20px]">
                {/* MAP SECTION */}
                <div className="xl:col-span-2 bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[520px]">
                    <h2 className="text-[20px] font-semibold text-gray-800 mb-[16px]">Real-time Outbreak Monitoring</h2>
                    <div className="trends-wrapper h-[450px] rounded-[12px] overflow-hidden border border-[#E5E5E5]">
                        <Map 
                            filters={filters}
                            data={DummyData}
                            mapCenter={getCenter}
                            points={points || []}
                            isPointsLoading={isPointsLoading}
                        />
                    </div>
                    
                </div>
                {/* RIGHT PANELS */}
                <div className="flex flex-col gap-[20px]">
                    <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
                        <h2 className="text-[18px] font-semibold text-gray-800 mb-[16px]">Environmental Data</h2>
                        <div className="flex flex-col gap-[12px]">
                            <MetricRow label="Air Quality Index" value="Moderate" />
                            <MetricRow label="Weather Pattern" value="Humid / Cloudy" />
                            <MetricRow label="Heat Index" value="38°C" />
                        </div>
                    </div>
                    <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
                        <h2 className="text-[18px] font-semibold text-gray-800 mb-[16px]">AI Insights</h2>
                        <div className="flex flex-col gap-[12px]">
                            <div className="bg-[#F5F5F5] rounded-[8px] p-[12px]">Increase flu-related mentions detected in NCR</div>
                            <div className="bg-[#F5F5F5] rounded-[8px] p-[12px]">Spike in respiratory symptom reports in Region IV-A</div>
                            <div className="bg-[#F5F5F5] rounded-[8px] p-[12px]">Misinformation alert volume increased by 12%</div>
                        </div>
                    </div>
                </div>
            </div>
            {/* HEALTH MONITORING */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-[20px]">
                {/* SYMPTOM FREQUENCY */}
                <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[24px] min-h-[260px]">
                    <h2 className="text-[18px] font-semibold text-gray-800 mb-[24px]">
                        Symptom Frequency    
                    </h2>

                    <div className="flex flex-col gap-[24px]">
                        <SymptomFrequencyRow 
                            symptom="Fever" 
                            reports="356"
                            progress="95%"
                            note="+8% from last week | Primarily in NCR, Region III"
                        />
                        <SymptomFrequencyRow 
                            symptom="Cough" 
                            reports="289"
                            progress="78%"
                            note="-3% from last week | Primarily in NCR, Region IV-A"
                        />
                        <SymptomFrequencyRow 
                            symptom="Headache" 
                            reports="201"
                            progress="60%"
                            note="+32% from last week | Region IV-A"
                        />
                        <SymptomFrequencyRow 
                            symptom="Rash" 
                            reports="99"
                            progress="35%"
                            note="+5% from last week | Multiple regions"
                        />
                    </div>
                </div>

                {/* RESPIRATORY MONITORING */}
                <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[260px]">
                    <h2 className="text-[18px] font-semibold text-gray-800">
                        Respiratory Monitoring
                    </h2>
                    <p className="text-sm text-gray-500 mt-[4px] mb-[16px]">
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

                            <Line type="monotone" dataKey="respiratoryRate" name="Respiratory Rate" stroke="#2563EB" />
                            <Line type="monotone" dataKey="aqi" name="AQI" stroke="#F97316" />
                            <Line type="monotone" dataKey="temperature" name="Temperature (°C)" stroke="#1D4ED8" />
                            <Line type="monotone" dataKey="coughFrequency" name="Cough Frequency" stroke="#9CA3AF" />
                            <Line type="monotone" dataKey="pm25" name="PM2.5" stroke="#FF0000" />
                            <Line type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#20C997" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>


                <Panel title="Trend Forecasting" />
            </div>

            {/* OLD ANALYTICS INTEGRATION */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-[20px]">
                {/* TOP WORDS */}
                <Report
                    heading="Top Words"
                    filter={topWordsFilter}
                    setFilter={setTopWordsFilter}
                    isLoading={isTopWordsFetching}
                >
                    <ResponsiveContainer width="100%" height={260}>
                        {frequentWords && frequentWords["frequent_words"]?.length > 0 ? (
                            <BarChart
                                data={frequentWords["frequent_words"]}
                                layout="vertical"
                                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" padding={{ left: 20, right: 20 }} tickLine={false} />
                                <YAxis hide={true} dataKey="word" type="category" tickLine={false} axisLine={false} />
                                <Tooltip />
                                <Legend verticalAlign="top" align="left" iconSize={20} height={40} />
                                <Bar dataKey="frequency" fill="#B5A8DE" maxBarSize={18} radius={[0, 8, 8, 0]}>
                                    <LabelList
                                        dataKey="word"
                                        content={({ x, y, value}) => (
                                            <text
                                                x={x}
                                                y={y - 5}
                                                className="recharts-text recharts-cartesian-axis-tick-value text-[14px]" fill="#666"  
                                            >
                                                <tspan>{capitalizeSymptom(value)}</tspan>
                                            </text>
                                        )}
                                    />
                                </Bar>
                            </BarChart>
                        ) : (
                            <div className="flex items-center justify-center h-[220px] text-gray-400">
                                No top words data available
                            </div>
                        )}
                    </ResponsiveContainer>
                </Report>

                {/* WORD CLOUD */}
                <Report
                    heading="Word Cloud"
                    filter={wordCloudFilter}
                    setFilter={setWordCloudFilter}
                    isLoading={isWordCloudFetching}
                >
                    <ResponsiveContainer width="100%" height={260}>
                        {wordcloud && wordcloud !== "No datasets" ? (
                            <ReactWordCloud 
                                className="dynamic-wordcloud"
                                style={{
                                    height: "100%",
                                    width: "100%",
                                }}
                                words={wordcloud}
                                options={wordcloudOptions}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-[220px] text-gray-400">
                                No word cloud data available
                            </div>
                        )}
                    </ResponsiveContainer>
                </Report>

                {/* SUSPECTED CONDITIONS PERCENTAGE */}
                <Report
                    heading="Suspected Conditions Percentage"
                    filter={percentageFilter}
                    setFilter={setPercentageFilter}
                    isLoading={isPercentageFetching}
                >
                    <ResponsiveContainer width="100%" height={260}>
                        {percentage && (
                            <PieChart>
                                <Legend 
                                    verticalAlign="top"
                                    align="left"
                                    iconSize={16}
                                    height={40}
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
        <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[12px]">
            <p className="text-gray-500 text-sm">{label}</p>
            <h2 className="text-[32px] font-semibold text-gray-800 mt-[8px]">{value}</h2>
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

const SymptomFrequencyRow = ({ symptom, reports, progress, note }) => {
    return (
        <div>
            <div className="flex justify-between items-center mb-[8px]">
                <p className="text-[16px] font-medium text-gray-800">{symptom}</p>
                <p className="text-[16px] font-semibold text-gray-800">{reports} reports</p>
            </div>
            <div className="h-[12px] bg-gray-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-[#1FB985] rounded-full"
                    style={{ width: progress}}
                ></div>
            </div>
            <p className="text-sm text-gray-500 mt-[6px]">{note}</p>
        </div>
    );
};

/* remove this later on after removing the placeholders */
const Panel = ({ title }) => {
    return (
        <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[260px]">
            <h2 className="text-[18px] font-semibold text-gray-800 mb-[16px]">{title}</h2>
            <div className="w-full h-[180px] bg-[#F5F5F5] rounded-[12px] flex items-center justify-center text-gray-400">{title} Placeholder</div>
        </div>
    );
};

export default AISurveillance;