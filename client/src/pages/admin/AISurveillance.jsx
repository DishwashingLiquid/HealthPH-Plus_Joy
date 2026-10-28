import { useState } from "react";
import { useSelector } from "react-redux";

import SurveillanceMap from "../../components/admin/SurveillanceMap";

import Regions from "../../assets/data/regions.json";
import RegionsCenter from "../../assets/data/regions_center.json";

import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
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
    ToolbarButton,
    ToolbarSelect,
} from "../../components/ToolbarControls";

import {
    useFetchSurveillanceSummaryQuery,
    useFetchAnalyticsMapPointsQuery,
} from "../../features/api/analyticsEntriesSlice";

const RESPIRATORY_SERIES = [
    { key: "respiratoryRate", name: "Respiratory Rate", color: "#32418C" },
    { key: "aqi", name: "AQI", color: "#2572A5" },
    { key: "temperature", name: "Temperature (°C)", color: "#1D8D9F" },
    { key: "coughFrequency", name: "Cough Frequency", color: "#1ABC9C" },
    { key: "pm25", name: "PM2.5", color: "#9BCC33" },
    { key: "humidity", name: "Humidity (%)", color: "#FBD117" },
];

const FORECAST_SERIES = [
    { key: "actual", name: "Actual Reports", color: "#32418C", fill: "#DBEAFE" },
    { key: "forecast", name: "Forecasted Trend", color: "#FBD117", fill: "#FFEDD5", strokeDasharray: "5 5" },
];

const AISurveillance = () => {
    const user = useSelector((state) => state.auth.user);

    const accessibleRegionValues =
        user?.accessible_regions?.length > 0
            ? user.accessible_regions
            : Regions.regions.map((region) => region.value);

    const accessibleRegions = Regions.regions.filter((region) =>
        accessibleRegionValues.includes(region.value)
    );

    /* MAP */
    const [filters, setFilters] = useState({
        region: accessibleRegions,
        dateRange: 7,
        disease: "all",
    });

    const {
        currentData: points,
        isFetching: isPointsLoading,
        isError: isPointsError,
        refetch: refetchMapPoints,
    } = useFetchAnalyticsMapPointsQuery(
        { days: filters.dateRange },
        {
            refetchOnMountOrArgChange: true,
            refetchOnFocus: true,
        }
    );

    const surveillancePoints = points || [];

    const handleChangeFilter = (key, value) => {
        setFilters((filters) => ({
            ...filters,
            [key]: value,
        }));
    };

    const handleResetFilters = () => {
        setFilters({
            region: accessibleRegions,
            dateRange: 7,
            disease: "all",
        });
    };

    const getCenter = () => {
        const defaultCenter = [13, 122];

        if (user?.user_type === "USER") {
            const regionCenter = RegionsCenter.find((c) => c.region == user.region);
            return regionCenter?.center || defaultCenter;
        }

        return defaultCenter;
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
            filters.region.length === accessibleRegions.length ||
            filters.region.some((region) => region.value === point.region);

        const diseaseMatches =
            filters.disease === "all" ||
            point.annotations?.includes(diseaseCode[filters.disease]);

        return regionMatches && diseaseMatches;
    });

    /* SUMMARY CARDS */
    const selectedRegion =
        filters.region.length === accessibleRegions.length
            ? "all"
            : filters.region[0]?.value || "all";

    const selectedDisease =
        filters.disease === "all"
            ? "all"
            : diseaseCode[filters.disease];

    const {
        currentData: surveillanceSummary,
        isFetching: isSummaryFetching,
        isError: isSummaryError,
        error: summaryError,
        refetch: refetchSummary,
    } = useFetchSurveillanceSummaryQuery(
        {
            region: selectedRegion,
            disease: selectedDisease,
            days: filters.dateRange,
        },
        {
            refetchOnMountOrArgChange: true,
            refetchOnFocus: true,
        }
    );

    const summaryReady =
        !isSummaryFetching &&
        !isSummaryError &&
        Boolean(surveillanceSummary);

    const formatCount = (value) =>
        typeof value === "number"
            ? value.toLocaleString()
            : value ?? "-";

    const renderDiseaseCount = (value, isTotal = false) =>
        isSummaryFetching ? (
            <>
                <span
                    aria-hidden="true"
                    className={`inline-block animate-pulse rounded-[6px] bg-[#E4E7EB] align-middle motion-reduce:animate-none ${
                        isTotal ? "h-[24px] w-[64px]" : "h-[12px] w-[24px]"
                    }`}
                />
                <span className="sr-only">Loading...</span>
            </>
        ) : formatCount(value);

    const filteredSuspectedSymptoms = {
        TB: summaryReady ? surveillanceSummary.disease_counts.TB : "-",
        PN: summaryReady ? surveillanceSummary.disease_counts.PN : "-",
        COVID: summaryReady ? surveillanceSummary.disease_counts.COVID : "-",
        AURI: summaryReady ? surveillanceSummary.disease_counts.AURI: "-",
        total: summaryReady
            ? surveillanceSummary.disease_label_count
            : "-",
    };

    const symptomCounts = summaryReady
        ? surveillanceSummary.symptom_counts || []
        : [];

    const surveillanceDataStatusMessage = isSummaryFetching
        ? "Loading surveillance summary..."
        : isSummaryError
            ? typeof summaryError?.data?.detail === "string"
                ? summaryError.data.detail
                : "Unable to load surveillance data. Please try again."
            : summaryReady
                ? `${formatCount(
                    surveillanceSummary.processed_entry_count
                )} processed entries match the selected filters in the last ${filters.dateRange} days.`
                : "Surveillance Summary is unavailable.";

    /* SUSPECTED CONDITIONS PERCENTAGE */
    const percentageData = summaryReady
        ? [
            { code: "TB", name: "Tuberculosis", color: "#32418C" },
            { code: "PN", name: "Pneumonia", color: "#2572A5" },
            { code: "COVID", name: "COVID-19", color: "#9BCC33" },
            { code: "AURI", name: "AURI", color: "#FBD117" },
        ].map((condition) => ({
            ...condition,
            count: surveillanceSummary.disease_counts[condition.code] || 0,
        })).filter((condition) => condition.count > 0)
        : [];

    const percentageTotal = percentageData.reduce(
        (total, condition) => total + condition.count,
        0
    );
    const RADIAN = Math.PI / 180;

    return (
        <div className="flex flex-col gap-[10px]">
            {/* PAGE HEADER */}
            <div className="flex items-start justify-between gap-[12px]">
                <div className="min-w-0">
                    <h1 className="text-[24px] font-semibold text-gray-800">
                        AI Surveillance
                    </h1>

                    <p className="text-gray-500 text-[14px]">
                        Real-time disease surveillance, outbreak monitoring, and AI-driven public health analytics.
                    </p>
                </div>

                <ToolbarButton
                    iconName="Upload"
                    variant="primary"
                    className="min-h-[48px] shrink-0 !text-[16px]"
                >
                    Export
                </ToolbarButton>
            </div>

            {/* MAIN CONTENT */}
            <div className="grid grid-cols-1 items-stretch gap-[10px] xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
                {/* MAP SECTION */}
                <div className="flex min-w-0 flex-col rounded-[12px] border border-[#E5E5E5] bg-white p-[16px]">
                    <h2 className="text-[18px] font-semibold text-gray-800 mb-[12px]">Real-time Outbreak Monitoring</h2>
                    <div className="relative h-[720px] flex-none overflow-hidden rounded-[12px] border border-[#E5E5E5]">
                        <SurveillanceMap
                            filters={filters}
                            center={getCenter()}
                            points={filteredSurveillancePoints}
                            isPointsLoading={isPointsLoading}
                            isPointsError={isPointsError}
                            onRetry={() => refetchMapPoints()}
                        />
                    </div>

                </div>
                {/* RIGHT PANELS */}
                <div className="flex min-h-0 flex-col gap-[10px] xl:[contain:size]">
                    {/* FILTERS AND STATUS */}
                    <div className="flex flex-col gap-[12px] rounded-[12px] border border-[#E5E5E5] bg-white p-[14px]">
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="rounded-[8px] border border-[#E5E5E5] px-[10px] py-[6px] text-xs font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                            >
                                Reset filters
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-3">
                            <ToolbarSelect
                                className="min-h-[48px] w-full min-w-0 !px-[8px] !text-[16px] font-medium"
                                value={filters.dateRange}
                                onChange={(event) =>
                                    handleChangeFilter("dateRange", Number(event.target.value))
                                }
                            >
                                <option value={7}>Last 7 Days</option>
                                <option value={14}>Last 14 Days</option>
                                <option value={28}>Last 28 Days</option>
                            </ToolbarSelect>

                            <ToolbarSelect
                                className="min-h-[48px] w-full min-w-0 !px-[8px] !text-[16px] font-medium"
                                value={
                                    filters.region.length === accessibleRegions.length
                                        ? "all"
                                        : filters.region[0]?.value || "all"
                                }
                                onChange={(event) => {
                                    const value = event.target.value;

                                    handleChangeFilter(
                                        "region",
                                        value === "all"
                                            ? accessibleRegions
                                            : accessibleRegions.filter(
                                                (region) => region.value === value
                                            )
                                    );
                                }}
                            >
                                <option value="all">All Regions</option>
                                {accessibleRegions.map((region) => (
                                    <option key={region.value} value={region.value}>
                                        {region.label}
                                    </option>
                                ))}
                            </ToolbarSelect>

                            <ToolbarSelect
                                className="min-h-[48px] w-full min-w-0 !px-[8px] !text-[16px] font-medium"
                                value={filters.disease}
                                onChange={(event) =>
                                    handleChangeFilter("disease", event.target.value)
                                }
                            >
                                <option value="all">All Impacts</option>
                                <option value="tuberculosis">Tuberculosis</option>
                                <option value="pneumonia">Pneumonia</option>
                                <option value="covid">COVID</option>
                                <option value="auri">AURI</option>
                            </ToolbarSelect>

                        </div>

                        <div
                            role={isSummaryError ? "alert" : "status"}
                            className={`rounded-[8px] border px-[12px] py-[10px] text-sm ${
                                isSummaryError
                                    ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#B42318]"
                                    : "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]"
                            }`}
                        >
                            <p>{surveillanceDataStatusMessage}</p>

                            {isSummaryError && (
                                <button
                                    type="button"
                                    onClick={() => refetchSummary()}
                                    className="mt-[8px] font-semibold underline"
                                >
                                    Retry
                                </button>
                            )}
                        </div>
                    </div>
                    {/* SUMMARY CARDS */}
                    <div className="flex min-h-0 flex-1 flex-col rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
                        {/* SUSPECTED CASES */}
                        <div aria-busy={isSummaryFetching} className="xl:col-span-1 bg-white rounded-[12px] border border-[#E5E5E5] p-[16px]">
                            <div className="flex justify-between items-center h-full">
                                {/* LEFT */}
                                <div className="flex flex-col justify-center">
                                    <p className="text-gray-500 text-sm mb-[8px]">Disease Label Detections</p>
                                    <h2 className="text-[24px] font-semibold text-gray-800 leading-none">{renderDiseaseCount(filteredSuspectedSymptoms?.total, true)}</h2>
                                </div>
                                {/* RIGHT */}
                                <div className="grid grid-cols-2 gap-x-[32px] gap-y-[8px]">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">TB</p>
                                        <p className="text-[12px] font-semibold text-gray-800">{renderDiseaseCount(filteredSuspectedSymptoms?.TB)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">COVID</p>
                                        <p className="text-[12px] font-semibold text-gray-800">{renderDiseaseCount(filteredSuspectedSymptoms?.COVID)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Pneumonia</p>
                                        <p className="text-[12px] font-semibold text-gray-800">{renderDiseaseCount(filteredSuspectedSymptoms?.PN)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">AURI</p>
                                        <p className="text-[12px] font-semibold text-gray-800">{renderDiseaseCount(filteredSuspectedSymptoms?.AURI)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <section
                            aria-labelledby="symptom-frequency-title"
                            className="mt-[12px] flex min-h-0 flex-1 flex-col overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white"
                        >
                            <div className="border-b border-[#E5E5E5] px-[16px] py-[12px]">
                                <h2 id="symptom-frequency-title" className="text-[18px] font-semibold text-gray-800">
                                    Symptom Frequency
                                </h2>
                                <p className="mt-[4px] text-xs leading-relaxed text-gray-500">
                                    Processed self reports matching these filters. Each report counts once per symptom.
                                </p>
                            </div>
                            <div
                                role="region"
                                aria-labelledby="symptom-frequency-title"
                                aria-busy={isSummaryFetching}
                                tabIndex={0}
                                className="min-h-0 max-h-[280px] overflow-y-auto overscroll-contain rounded-b-[12px] px-[16px] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#32418C] xl:max-h-none xl:flex-1"
                            >
                                <div className="flex justify-between gap-[12px] pb-[8px] pt-[12px] text-xs font-medium text-gray-500" aria-hidden="true">
                                    <span>Symptom</span>
                                    <span>Reports</span>
                                </div>
                                {isSummaryFetching ? (
                                    <div role="status">
                                        <span className="sr-only">Loading symptom counts...</span>
                                        <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
                                            <div className="divide-y divide-[#E5E5E5]">
                                                {[
                                                    "w-[45%]", "w-[60%]", "w-[38%]", "w-[52%]",
                                                    "w-[64%]", "w-[46%]", "w-[56%]", "w-[40%]",
                                                ].map((width, index) => (
                                                    <div key={index} className="flex min-h-[44px] items-center justify-between gap-[16px] py-[12px]">
                                                        <div className={`h-[16px] rounded-[6px] bg-[#E4E7EB] ${width}`} />
                                                        <div className="h-[16px] w-[24px] shrink-0 rounded-[6px] bg-[#E4E7EB]" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : isSummaryError ? (
                                    <div className="py-[20px] text-sm text-[#B42318]">
                                        <p>Unable to load symptom frequency.</p>
                                        <button type="button" onClick={() => refetchSummary()} className="mt-[8px] font-semibold underline">Retry</button>
                                    </div>
                                ) : !summaryReady ? (
                                    <p className="py-[20px] text-sm text-gray-500">Symptom frequency is unavailable.</p>
                                ) : symptomCounts.length === 0 ? (
                                    <p className="py-[20px] text-sm leading-relaxed text-gray-500">No reported symptoms in the processed self reports matching these filters.</p>
                                ) : (
                                    <dl className="divide-y divide-[#E5E5E5]">
                                        {symptomCounts.map(({ symptom, report_count }) => (
                                            <div key={symptom} className="flex items-center justify-between gap-[16px] py-[12px] text-sm">
                                                <dt className="min-w-0 break-words text-gray-700">{symptom}</dt>
                                                <dd className="shrink-0 font-semibold tabular-nums text-[#32418C]">
                                                    {formatCount(report_count)}<span className="sr-only"> reports</span>
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
            {/* HEALTH MONITORING */}
            <div className="grid grid-cols-1 items-stretch xl:grid-cols-3 gap-[10px]">
                {/* RESPIRATORY MONITORING */}
                <div className="flex min-w-0 flex-col bg-white rounded-[12px] border border-[#E5E5E5] px-[20px] pt-[20px] pb-[12px]">
                    <h2 className="text-[18px] font-semibold text-gray-800">
                        Respiratory Monitoring
                    </h2>
                    <p className="text-sm text-gray-500 mb-[12px]">
                        Air quality and respiratory metrics with environmental factors.
                    </p>

                    <ResponsiveContainer width="100%" height={280}>
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
                            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3 " />
                            <XAxis dataKey="time" />
                            <YAxis/>
                            <Tooltip />


                            {RESPIRATORY_SERIES.map((series) => (
                                <Line
                                    key={series.key}
                                    type="monotone"
                                    dataKey={series.key}
                                    name={series.name}
                                    stroke={series.color}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                    <ChartLegend items={RESPIRATORY_SERIES} columns />
                </div>

                {/* TREND FORECASTING */}
                <div className="flex min-w-0 flex-col bg-white rounded-[12px] border border-[#E5E5E5] px-[20px] pt-[20px] pb-[12px]">
                    <h2 className="text-[18px] font-semibold text-gray-800">
                        Trend Forecasting
                    </h2>
                    <p className="text-sm text-gray-500 mb-[12px]">
                        Projected disease signal trends based on recent surveillance patterns.
                    </p>

                    <ResponsiveContainer width="100%" height={280}>
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
                            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="day" />
                            <YAxis />
                            <Tooltip />

                            {FORECAST_SERIES.map((series) => (
                                <Area
                                    key={series.key}
                                    type="monotone"
                                    dataKey={series.key}
                                    name={series.name}
                                    stroke={series.color}
                                    fill={series.fill}
                                    strokeWidth={2}
                                    strokeDasharray={series.strokeDasharray}
                                    dot={{ r: 3 }}
                                    activeDot={{ r: 5 }}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                    <ChartLegend items={FORECAST_SERIES} />
                </div>

                {/* SUSPECTED CONDITIONS PERCENTAGE */}
                <div className="flex min-w-0 flex-col bg-white rounded-[12px] border border-[#E5E5E5] px-[20px] pt-[20px] pb-[12px]">
                    <h2 className="text-[18px] font-semibold text-gray-800 mb-[12px]">
                        Suspected Conditions Percentage
                    </h2>
                    <p className="mb-[12px] text-sm text-gray-500">
                        Share of disease label detections for the selected filters.
                        A report may contribute more than one label.
                    </p>
                    {isSummaryFetching ? (
                        <p role="status" className="flex h-[280px] items-center justify-center text-sm text-gray-500">
                            Loading condition percentages...
                        </p>
                    ) : isSummaryError ? (
                        <div role="alert" className="flex h-[280px] flex-col items-center justify-center gap-3 text-center text-sm text-red-700">
                            <p>{surveillanceDataStatusMessage}</p>
                            <button
                                type="button"
                                onClick={() => refetchSummary()}
                                className="font-semibold underline"
                            >
                                Retry
                            </button>
                        </div>
                    ) : !summaryReady || percentageTotal === 0 ? (
                        <p role="status" className="flex h-[280px] items-center justify-center text-center text-sm text-gray-500">
                            {summaryReady
                                ? "No disease detections match the selected filters."
                                : "Surveillance summary is unavailable."}
                        </p>
                    ) : (
                        <>
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>


                                <Pie
                                    data={percentageData}
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius="95%"
                                    paddingAngle={0}
                                    labelLine={false}
                                    label={({
                                        cx,
                                        cy,
                                        midAngle,
                                        innerRadius,
                                        outerRadius,
                                        percent,
                                    }) => {
                                        if (percent < 0.05) return null;

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
                                    {percentageData.map((entry) => (
                                        <Cell
                                            key={entry.code}
                                            fill={entry.color}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value, name) => [
                                        `${Number(value).toLocaleString()} detections (${(
                                            Number(value) / percentageTotal * 100
                                        ).toFixed(1)}%)`,
                                        name,
                                    ]}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <ChartLegend items={percentageData} />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const ChartLegend = ({ items, columns = false }) => (
    <ul
        aria-label="Chart legend"
        className={`mt-4 shrink-0 text-[13px] leading-5 text-gray-700 ${
            columns
                ? "grid grid-cols-2 gap-x-4 gap-y-2"
                : "flex flex-wrap justify-center gap-x-3 gap-y-2"
        }`}
    >
        {items.map((item) => (
            <li key={item.key || item.code} className="flex min-w-0 items-center gap-2">
                <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                />
                <span>{item.name}</span>
            </li>
        ))}
    </ul>
);

export default AISurveillance;
