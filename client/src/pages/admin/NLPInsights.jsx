import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useReactToPrint } from "react-to-print";

import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    LabelList,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
} from "recharts";

import {
    useGenerateFrequentWordsQuery,
    useGenerateWordCloudQuery,
} from "../../features/api/analyticsSlice";

import { useFetchDatasetsByUserQuery } from "../../features/api/datasetsSlice";
import {
    useFetchSelfReportLanguageSummaryQuery,
    useFetchNlpEntitySummaryQuery,
} from "../../features/api/analyticsEntriesSlice";

import Report from "../../components/admin/Report";
import EntityFrequencyPanel from "../../components/admin/EntityFrequencyPanel";
import SummaryPrintReport from "../../components/admin/SummaryPrintReport";
import { ToolbarButton } from "../../components/ToolbarControls";
import LoadingSkeleton, { ChartSkeleton } from "../../components/LoadingSkeleton";
import capitalizeSymptom from "../../hooks/useCapitalizeSymptom";
import useUrlTab from "../../hooks/useUrlTab";
import { getRegionFromLocation } from "../../utils/locationRegionMap";

import EmptyState from "../../components/admin/EmptyState";

import ReactWordCloud from "react-wordcloud";

const NLPInsights = () => {
    const [activeTab, setActiveTab] = useUrlTab(
        "tab", ["ner", "sentiment", "language"], "ner"
    );

    const user = useSelector((state) => state.auth.user);
    const entityReport = useNlpEntityReport(activeTab === "ner");
    const printing = useSummaryPrint();

    const { data: datasets = [], isFetching: isDatasetsFetching, isError: isDatasetsError } =
        useFetchDatasetsByUserQuery(user?.id, {
            skip: !user?.id,
        });

    const {
        data: selfReportLanguageSummary,
        isFetching: isSelfReportLanguageSummaryFetching,
        isError: isSelfReportLanguageSummaryError,
    } = useFetchSelfReportLanguageSummaryQuery(undefined, {
        skip: activeTab !== "language" || !user?.id,
    });

    /* TOP WORDS */
    const wordRegion =
        user.user_type == "USER"
            ? user.accessible_regions[0]
            : "all";

    const { data: frequentWords, isFetching: isTopWordsFetching, isError: isTopWordsError } =
        useGenerateFrequentWordsQuery(wordRegion);

    /* WORD CLOUD */
    const { data: wordcloud, isFetching: isWordCloudFetching, isError: isWordCloudError } =
        useGenerateWordCloudQuery(wordRegion);

    const wordcloudOptions = {
        colors: ["#171E26", "#F5D76E", "#6A8EB5", "#F78C6B", "#78C6B2"],
        rotations: 0,
        deterministic: true,
        padding: 20,
        fontSizes: [20, 50],
        scale: "linear",
    };

    return (
        <div className="flex flex-col gap-[10px]">
            {/* PAGE HEADER */}
            <div>
                <h1 className="text-[24px] font-semibold text-gray-800">
                    NLP Insights
                </h1>
                <p className="text-gray-500 text-[14px]">
                    Multilingual natural language processing, entity recognitation, sentiment analysis, and language detection.
                </p>
            </div>
            <div style={{ display: "none" }}>
                <SummaryPrintReport ref={printing.printRef} report={printing.printReport} />
            </div>

            {/* SUBTABS */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[12px]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-[8px] bg-[#F5F5F5] rounded-[10px] p-[6px]">
                    <TabButton
                        label="Named Entity Recognition"
                        active={activeTab === "ner"}
                        onClick={() => setActiveTab("ner")}
                    />
                    <TabButton
                        label="Sentiment Analysis"
                        active={activeTab === "sentiment"}
                        onClick={() => setActiveTab("sentiment")}
                    />
                    <TabButton
                        label="Language Detection"
                        active={activeTab === "language"}
                        onClick={() => setActiveTab("language")}
                    />
                </div>
            </div>

            {activeTab === "ner" && (
                <NamedEntityRecognition 
                    entityReport={entityReport}
                    printing={printing}
                    frequentWords={frequentWords}
                    isTopWordsFetching={isTopWordsFetching}
                    isTopWordsError={isTopWordsError}
                    wordcloud={wordcloud}
                    isWordCloudFetching={isWordCloudFetching}
                    isWordCloudError={isWordCloudError}
                    wordcloudOptions={wordcloudOptions}
                />
            )}
            {activeTab === "sentiment" && <SentimentAnalysis />}
            {activeTab === "language" && (
                <LanguageDetection
                    printing={printing}
                    datasets={datasets}
                    selfReportLanguageSummary={selfReportLanguageSummary}
                    isLanguageDataError={isDatasetsError || isSelfReportLanguageSummaryError}
                    isLanguageDataFetching={
                        isDatasetsFetching ||
                        isSelfReportLanguageSummaryFetching
                    }
                />
            )}
        </div>
    );
};

const TabButton = ({ label, active, onClick }) => {
    return (
        <button
            type="button"
            className={`px-[16px] py-[10px] rounded-[8px] text-sm font-medium transition ${
                active
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
            }`}
            onClick={onClick}
        >
            {label}
        </button>
    );
};

const useSummaryPrint = () => {
    const [printReport, setPrintReport] = useState(null);
    const [printError, setPrintError] = useState("");
    const [isPrinting, setIsPrinting] = useState(false);
    const printRef = useRef(null);
    const printPending = useRef(false);
    const printLock = useRef(false);
    const printSummary = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `HealthPH+ - ${printReport?.title || "NLP Insights"}`,
        removeAfterPrint: false,
        pageStyle: "@page { size: A4 portrait; margin: 12mm; } @media print { html, body { height: auto !important; overflow: visible !important; margin: 0 !important; } }",
        onAfterPrint: () => {
            printLock.current = false;
            setIsPrinting(false);
        },
        onPrintError: () => {
            printLock.current = false;
            setIsPrinting(false);
            setPrintError("Unable to open the print dialog. Please try again.");
        },
    });

    useEffect(() => {
        if (printReport && printPending.current) {
            printPending.current = false;
            printSummary();
        }
    }, [printReport, printSummary]);

    const startPrint = (report) => {
        if (!report || printLock.current) return;
        printLock.current = true;
        printPending.current = true;
        setIsPrinting(true);
        setPrintError("");
        setPrintReport(report);
    };

    return { startPrint, printReport, printRef, printError, isPrinting };
};

const SubtabPrintButton = ({ printing, onPrint, disabled, label }) => (
    <div className="flex flex-col items-end gap-[8px] rounded-[12px] border border-[#E5E5E5] bg-white p-[12px]">
        <ToolbarButton
            iconName="Printer"
            variant="primary"
            aria-label={`Print ${label}`}
            onClick={onPrint}
            disabled={disabled || printing.isPrinting}
            className="min-h-[44px] shrink-0"
        >
            {printing.isPrinting ? "Preparing..." : "Print"}
        </ToolbarButton>
        {printing.printError && <p role="alert" className="text-sm text-[#B42318]">{printing.printError}</p>}
    </div>
);

const useNlpEntityReport = (enabled) => {
    const user = useSelector((state) => state.auth.user);
    const {
        currentData: entitySummary,
        isFetching: isEntityFetching,
        isError: isEntityError,
        refetch: refetchEntities,
    } = useFetchNlpEntitySummaryQuery(undefined, {
        skip: !enabled,
        refetchOnMountOrArgChange: true,
    });

    const totalReports = entitySummary?.processed_report_count ?? 0;

    const diseaseRows = [
        ["TB", "Tuberculosis", "#32418C"],
        ["PN", "Pneumonia", "#2572A5"],
        ["COVID", "COVID-19", "#9BCC33"],
        ["AURI", "AURI", "#FBD117"],
    ].map(([code, entity, color]) => ({
        entity,
        color,
        report_count: entitySummary?.disease_counts?.[code] ?? 0,
    }));

    const symptomRows = (entitySummary?.symptom_counts ?? []).map(
        ({ symptom, report_count }) => ({
            entity: symptom,
            report_count,
            color: "#2572A5",
        })
    );

    const regionRows = (entitySummary?.region_counts ?? []).map(
        ({ region, report_count }) => ({
            entity: region === "UNMAPPED"
                ? "Region unavailable"
                : ["NCR", "CAR", "BARMM"].includes(region)
                    ? region
                    : `Region ${
                        region === "IVA"
                            ? "IV-A"
                            : region === "IVB"
                                ? "IV-B"
                                : region
                    }`,
            report_count,
            color: "#6A8EB5",
        })
    );

    const buildPrintReport = () => {
        if (!entitySummary || isEntityFetching || isEntityError) return null;

        const toPrintRows = (rows) => rows.map(({ entity, report_count }) => ({
            label: entity,
            count: report_count,
            share: totalReports ? Number((report_count / totalReports * 100).toFixed(1)) : 0,
        }));
        return {
            title: "NLP Insights — Named Entity Recognition",
            subtitle: "Diseases, Symptom Frequency and Locations",
            generatedAt: new Date().toISOString(),
            generatedBy: [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Unavailable",
            totalReports,
            filters: [
                { label: "Data source", value: "Self Reports and Social Media Datasets" },
                { label: "Region access", value: "Account's permitted regions" },
            ],
            notes: [
                "Includes the complete lists, not only the five-row previews. Counts represent reports, not repeated mentions.",
                "One report can have multiple disease labels or symptoms; their shares may sum to more than 100%.",
                "Locations are based on submitted regions.",
            ],
            sections: [
                { title: "Diseases", rows: toPrintRows(diseaseRows) },
                { title: "Symptom Frequency", rows: toPrintRows(symptomRows) },
                { title: "Locations", rows: toPrintRows(regionRows) },
            ],
        };
    };

    return {
        entitySummary, isEntityFetching, isEntityError, refetchEntities,
        totalReports, diseaseRows, symptomRows, regionRows,
        buildPrintReport,
    };
};

const NamedEntityRecognition = ({
    entityReport,
    printing,
    frequentWords,
    isTopWordsFetching,
    isTopWordsError,
    wordcloud,
    isWordCloudFetching,
    isWordCloudError,
    wordcloudOptions,
}) => {
    const {
        isEntityFetching, isEntityError, refetchEntities,
        totalReports, diseaseRows, symptomRows, regionRows,
    } = entityReport;

    return (
        <div className="flex flex-col gap-[10px]">
            <SubtabPrintButton
                label="Named Entity Recognition summary"
                printing={printing}
                onPrint={() => printing.startPrint(entityReport.buildPrintReport())}
                disabled={isEntityFetching || isEntityError || !entityReport.entitySummary}
            />
            <div className="grid grid-cols-1 gap-[10px] xl:grid-cols-3">
                <EntityFrequencyPanel
                    title="Diseases"
                    description="Reports classified with each disease label. One report can have multiple labels."
                    rows={diseaseRows}
                    totalReports={totalReports}
                    isFetching={isEntityFetching}
                    isError={isEntityError}
                    onRetry={refetchEntities}
                    fixedLabels
                />

                <EntityFrequencyPanel
                    title="Symptom Frequency"
                    description="Selected symptoms and non-negated extracted symptoms. Each report counts once per symptom."
                    rows={symptomRows}
                    totalReports={totalReports}
                    isFetching={isEntityFetching}
                    isError={isEntityError}
                    onRetry={refetchEntities}
                />
                <EntityFrequencyPanel
                    title="Locations"
                    description="Reports grouped by their submitted location's region, not locations mentioned in the text."
                    rows={regionRows}
                    totalReports={totalReports}
                    isFetching={isEntityFetching}
                    isError={isEntityError}
                    onRetry={refetchEntities}
                    emptyMessage="No regional results available."                    
                />
            </div>
            {/* SECOND ROW */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-[10px]">
                {/* LEFT - NER DEMO PANEL OR LEFT - ENTITY HIGHLIGHTS */}
                <div className="flex min-h-[260px] flex-col rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
                    <h2 className="text-[18px] font-semibold text-gray-800">
                        Named Entity Recognition Demo
                    </h2>
                    <p className="my-auto py-[40px] text-center text-sm text-gray-500">
                        Named Entity Recognition is not yet available.
                        Specialist-reviewed annotations are being completed for model training.
                    </p>
                </div>
                {/* RIGHT */}
                <div className="flex flex-col gap-[10px]">
                    {/* TOP WORDS */}
                    <Report
                        heading="Top Words"
                        showFilter={false}
                        isLoading={isTopWordsFetching}
                        loadingContent={<ChartSkeleton height={260} label="Loading top words..." />}
                        errorMessage={isTopWordsError ? "Unable to load top words. Please try again." : ""}
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
                        showFilter={false}
                        isLoading={isWordCloudFetching}
                        loadingContent={<ChartSkeleton height={260} label="Loading word cloud..." />}
                        errorMessage={isWordCloudError ? "Unable to load the word cloud. Please try again." : ""}
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
                </div>
            </div>
        </div>
    );
};

const SHOW_SENTIMENT_PREVIEW = false;

const SentimentAnalysis = () => {
    if (!SHOW_SENTIMENT_PREVIEW) {
        return (
            <section
                role="status"
                className="flex min-h-[360px] items-center justify-center rounded-[12px] border border-[#E5E5E5] bg-white p-[16px] sm:p-[32px]"
            >
                <EmptyState
                    iconName="Information"
                    heading="Under development"
                    content="Sentiment analysis is not yet connected to self-reports and social media datasets. Results will be available once the integration is completed."
                />
            </section>
        );
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-[10px]">
            {/* SENTIMENT DISTRIBUTION */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[360px]">
                <h2 className="text-[18px] font-semibold text-gray-800">
                    Sentiment Distribution
                </h2>
                <p className="text-sm text-gray-500 mb-[12px]">
                    Overall public sentiment detected from multilingual health-related posts.
                </p>

                <ResponsiveContainer width="100%" height={280}>
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
                            data={[
                                { name: "Positive", value: 32 },
                                { name: "Neutral", value: 46 },
                                { name: "Negative", value: 22 },
                            ]}
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                            dataKey="value"
                            label
                        >
                            {["#32418C", "#1ABC9C", "#FBD117 "].map((color, index) => (
                                <Cell key={`sentiment-cell-${index}`} fill={color} />
                            ))}
                        </Pie>

                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            
            {/* SENTIMENT BY REGION */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[360px]">
                <h2 className="text-[18px] font-semibold text-gray-800">
                    Sentiment by Region
                </h2>
                <p className="text-sm text-gray-500 mb-[12px]">
                    Regional sentiment breakdown from detected public health conversations.
                </p>

                <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                        data={[
                            { region: "NCR", positive: 45, neutral: 30, negative: 25 },
                            { region: "III", positive: 30, neutral: 42, negative: 28 },
                            { region: "IV-A", positive: 25, neutral: 35, negative: 40 },
                            { region: "NCR", positive: 38, neutral: 40, negative: 22 },
                        ]}
                        margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3 " />
                        <XAxis dataKey="region" />
                        <YAxis />
                        <Tooltip />
                        <Legend
                            verticalAlign="bottom"
                            align="center"
                            iconType="circle"
                            wrapperStyle={{
                                paddingTop: "20px",
                                lineHeight: "28px",
                            }}
                        />

                        <Bar dataKey="positive" name="Positive" fill="#32418C" />
                        <Bar dataKey="neutral" name="Neutral" fill="#1ABC9C" />
                        <Bar dataKey="negative" name="Negative" fill="#FBD117" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            
            {/* SENTIMENT TRENDS OVER TIME */}
            <div className="xl:col-span-2 bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[380px]">
                <h2 className="text-[18px] font-semibold text-gray-800">
                    Sentiment Trends Over Time
                </h2>
                <p className="text-sm text-gray-500 mb-[12px]">
                    Weekly sentiment movement used to support public health communication monitoring.
                </p>

                <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                        data={[
                            { week: "Week 1", positive: 34, neutral: 42, negative: 24 },
                            { week: "Week 2", positive: 36, neutral: 39, negative: 25 },
                            { week: "Week 3", positive: 30, neutral: 37, negative: 33 },
                            { week: "Week 4", positive: 28, neutral: 35, negative: 37 },
                            { week: "Week 5", positive: 32, neutral: 40, negative: 28 },
                        ]}
                        margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="week" />
                        <YAxis />
                        <Tooltip />
                        <Legend
                            verticalAlign="bottom"
                            align="center"
                            iconType="circle"
                            wrapperStyle={{
                                paddingTop: "20px",
                                lineHeight: "28px",
                            }}
                        />

                        <Line type="monotone" dataKey="positive" name="Positive" stroke="#32418C" strokeWidth={2} />
                        <Line type="monotone" dataKey="neutral" name="Neutral" stroke="#1ABC9C" strokeWidth={2} />
                        <Line type="monotone" dataKey="negative" name="Negative" stroke="#FBD117" strokeWidth={2} />
                    </LineChart> 
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const SUPPORTED_LANGUAGES = [
    { key: "en", label: "English", color: "#32418C" },
    { key: "fil", label: "Filipino", color: "#2572A5" },
    { key: "hil", label: "Hiligaynon", color: "#1ABC9C" },
    { key: "ilo", label: "Ilocano", color: "#9BCC33" },
    { key: "ceb", label: "Cebuano", color: "#FBD117" },
];

const SUPPORTED_LANGUAGES_KEYS = new Set(
    SUPPORTED_LANGUAGES.map((language) => language.key)
);

const LANGUAGE_BY_KEY = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((language) => [language.key, language])
);

const normalizeLanguageKey = (language) =>
    String(language || "").trim().toLowerCase();

const formatLanguageLabel = (language) => {
    const key = normalizeLanguageKey(language);

    return LANGUAGE_BY_KEY[key]?.label || "Unknown";
};

const buildLanguageDistribution = (datasets = []) => {
    const totals = Object.fromEntries(
        SUPPORTED_LANGUAGES.map((language) => [language.key, 0])
    );

    datasets.forEach((dataset) => {
        const languageCounts = dataset.language_counts || {};

        Object.entries(languageCounts).forEach(([language, count]) => {
            const key = normalizeLanguageKey(language);

            if (!SUPPORTED_LANGUAGES_KEYS.has(key)) return;

            totals[key] += Number(count || 0);
        });
    });

    return SUPPORTED_LANGUAGES
        .map((language) => ({
            key: language.key,
            name: language.label,
            value: totals[language.key],
            color: language.color,
        }))
        .filter((language) => language.value > 0);
};

const formatLocationLabel = (location) => {
    const value = String(location || "Unknown").trim();

    if (!value) return "Unknown";

    return value
        .split(/[\s_-]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
};

const buildRegionLanguageDistribution = (datasets = [], limit = 8) => {
    const regionMap = {};

    datasets.forEach((dataset) => {
        const locationLanguageCounts = dataset.location_language_counts || {};

        Object.entries(locationLanguageCounts).forEach(([location, languageCounts]) => {
            const region = getRegionFromLocation(location);

            if (!regionMap[region]) {
                regionMap[region] = {
                    region,
                    total: 0,
                };
            }

            Object.entries(languageCounts || {}).forEach(([language, count]) => {
                const languageKey = normalizeLanguageKey(language);
                const value = Number(count || 0);

                if (
                    !SUPPORTED_LANGUAGES_KEYS.has(languageKey) ||
                    value <= 0
                ) {
                    return;
                }

                regionMap[region][languageKey] =
                    (regionMap[region][languageKey] || 0) + value;

                regionMap[region].total += value;
            });
        });
    });

    return Object.values(regionMap)
        .sort((a, b) => {
            if (a.region === "UNMAPPED") return 1;
            if (b.region === "UNMAPPED") return -1;
            return b.total - a.total;
        })
        .slice(0, limit ?? undefined);
};

const LanguageDetection = ({
    printing,
    datasets = [],
    selfReportLanguageSummary,
    isLanguageDataFetching = false,
    isLanguageDataError = false,
}) => {
    const user = useSelector((state) => state.auth.user);
    const languageSources = selfReportLanguageSummary
        ? [...datasets, selfReportLanguageSummary]
        : datasets;

    const languageDistribution = buildLanguageDistribution(languageSources);
    const totalLanguageRows = languageDistribution.reduce(
        (total, language) => total + language.value,
        0
    );

    const allRegionLanguageDistribution = buildRegionLanguageDistribution(languageSources, null);
    const regionLanguageDistribution = allRegionLanguageDistribution.slice(0, 8);

    const chartLanguageKeys = languageDistribution.map(
        (language) => language.key
    );

    const handlePrint = () => {
        if (isLanguageDataFetching || isLanguageDataError) return;
        printing.startPrint({
            title: "NLP Insights — Language Detection",
            subtitle: "Language Distribution and Language Distribution by Region",
            generatedAt: new Date().toISOString(),
            generatedBy: [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Unavailable",
            totalLabel: "Records with a supported detected language",
            totalReports: totalLanguageRows,
            filters: [{ label: "Data sources", value: "Self Reports and Social Media Datasets" }],
            notes: [
                "Counts use the same saved language results as the charts. Only English, Filipino, Hiligaynon, Ilocano and Cebuano are included.",
                "The regional list includes every available region, including those beyond the chart's eight-region preview. Unknown locations are listed as Region unavailable.",
                "Model evaluation results are unavailable; detection counts and percentages do not measure model accuracy.",
            ],
            sections: [
                {
                    title: "Language Distribution",
                    countLabel: "Records",
                    shareLabel: "Percentage of detected records",
                    rows: languageDistribution.map(({ name, value }) => ({
                        label: name,
                        count: value,
                        share: totalLanguageRows ? Number((value / totalLanguageRows * 100).toFixed(1)) : 0,
                    })),
                },
                {
                    title: "Language Distribution by Region",
                    countLabel: "Records",
                    showShare: false,
                    rows: allRegionLanguageDistribution.flatMap((region) => SUPPORTED_LANGUAGES
                        .filter(({ key }) => region[key] > 0)
                        .map(({ key, label }) => ({
                            label: `${region.region === "UNMAPPED" ? "Region unavailable" : region.region} — ${label}`,
                            count: region[key],
                        }))),
                },
            ],
        });
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-[10px]">
            <div className="xl:col-span-2">
                <SubtabPrintButton
                    label="Language Detection summary"
                    printing={printing}
                    onPrint={handlePrint}
                    disabled={isLanguageDataFetching || isLanguageDataError}
                />
            </div>
            {/* LANGUAGE DISTRIBUTION */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[360px]">
                <h2 className="text-[18px] font-semibold text-gray-800">
                    Language Distribution
                </h2>
                <p className="text-sm text-gray-500 mb-[12px]">
                    Detected languages across self reports and social media records.
                </p>

                {isLanguageDataFetching ? (
                    <ChartSkeleton variant="pie" label="Loading language distribution..." />
                ) : isLanguageDataError ? (
                    <p role="alert" className="flex h-[280px] items-center justify-center text-center text-sm text-gray-500">
                        Unable to load language distribution. Please try again.
                    </p>
                ) : languageDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                            <Legend
                                verticalAlign="bottom"
                                align="center"
                                iconType="circle"
                                wrapperStyle={{
                                    paddingTop: "20px",
                                    lineHeight: "28px",
                                }}
                            />

                            <Pie
                                data={languageDistribution}
                                cx="50%"
                                cy="50%"
                                outerRadius={90}
                                dataKey="value"
                                label={({ name, percent }) =>
                                    `${name} ${(percent * 100).toFixed(0)}%`
                                }
                            >
                                {languageDistribution.map((entry, index) => (
                                    <Cell
                                        key={`language-cell-${entry.name}`}
                                        fill={entry.color}
                                    />
                                ))}
                            </Pie>

                            <Tooltip
                                formatter={(value) => [
                                    `${Number(value).toLocaleString()} records`,
                                    "Rows",
                                ]}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-[280px] items-center justify-center rounded-[10px] border border-dashed border-[#D9E2EC] text-sm text-gray-500">
                        No processed language data yet.
                    </div>
                )}

                {(isLanguageDataFetching || (!isLanguageDataError && languageDistribution.length > 0)) && (
                    <p className="mt-[10px] text-center text-sm text-gray-500">
                        Based on {isLanguageDataFetching
                            ? <LoadingSkeleton className="h-[14px] w-[48px]" />
                            : Number(totalLanguageRows).toLocaleString()} processed records.
                    </p>
                )}
            </div>

            {/* LANGUAGE DISTRIBUTION BY REGION */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[360px]">
                <h2 className="text-[18px] font-semibold text-gray-800">
                    Language Distribution by Region
                </h2>
                <p className="text-sm text-gray-500 mb-[12px]">
                    Regional language patterns detected from records.
                </p>

                {isLanguageDataFetching ? (
                    <ChartSkeleton label="Loading regional language data..." />
                ) : isLanguageDataError ? (
                    <p role="alert" className="flex h-[280px] items-center justify-center text-center text-sm text-gray-500">
                        Unable to load regional language data. Please try again.
                    </p>
                ) : regionLanguageDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart
                            data={regionLanguageDistribution}
                            margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="region" />
                            <YAxis />
                            <Tooltip />
                            <Legend
                                verticalAlign="bottom"
                                align="center"
                                iconType="circle"
                                wrapperStyle={{
                                    paddingTop: "20px",
                                    lineHeight: "28px",
                                }}
                            />

                            {chartLanguageKeys.map((languageKey, index) => (
                                <Bar
                                    key={languageKey}
                                    dataKey={languageKey}
                                    name={formatLanguageLabel(languageKey)}
                                    fill={LANGUAGE_BY_KEY[languageKey].color}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-[280px] items-center justify-center rounded-[10px] border border-dashed border-[#D9E2EC] text-sm text-gray-500">
                        No processed regional language data yet.
                    </div>
                )}
            </div>

            {/* LANGUAGE PROCESSING MODEL PERFORMANCE */}
            <div className="xl:col-span-2 bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
                <h2 className="text-[18px] font-semibold text-gray-800 mb-[12px]">
                    Language Processing Model Performance
                </h2>
                <div
                    role="status"
                    className="flex min-h-[180px] flex-col items-center justify-center gap-[8px] px-[16px] py-[32px] text-center"
                >
                    <p className="text-sm font-medium text-gray-700">
                        Model evaluation results are not yet available.
                    </p>
                    <p className="max-w-[720px] text-sm text-gray-500">
                        Language detection is connected. Verified accuracy requires
                        comparing the model's predictions with correctly labeled test data.
                        Requires predictions compared against correctly labeled test data.
                    </p>
                </div>
            </div>
        </div>
    );
};

const LocationRow = ({ location, mentions, status, color, }) => {
    return (
        <div className="flex items-center justify-between bg-[#F5F5F5] rounded-[10px] p-[14px]">
            <div className="flex items-center gap-[12px]">
                <div 
                    className="h-[12px] w-[12px] rounded-full"
                    style={{ backgroundColor: color }}>
                </div>

                <div>
                    <p className="text-[15px] font-medium text-gray-800">
                        {location}
                    </p>

                    <p className="text-xs text-gray-500">
                        {status}
                    </p>
                </div>
            </div>

            <div className="text-right">
                <p className="text-[15px] font-semibold text-gray-800">
                    {mentions}
                </p>
                <p className="text-xs text-gray-500">
                    mentions
                </p>
            </div>
        </div>
    );
};

const LegendItem = ({ label, color }) => {
    return (
        <div className="flex items-center gap-[8px]">
            <span
                className="h-[10px] w-[10px] rounded-full"
                style={{ backgroundColor: color }}
            ></span>
            <span className="text-gray-600">{label}</span>
        </div>
    );
};

const NERPostCard = ({ language, postId, children }) => {
    return (
        <div className="border border-[#D5DDE5] rounded-[14px] p-[16px]">
            <div className="flex items-center gap-[10px] mb-[12px]">
                <span className="bg-gray-100 text-gray-700 px-[12px] py-[5px] rounded-full text-sm font-medium">
                    {language}
                </span>
                <span className="text-sm text-gray-400">
                    {postId}
                </span>
            </div>

            <p className="text-[15px] text-gray-800 leading-[1.8]">
                {children}
            </p>
        </div>
    );
};

const EntityHighlight = ({ label, backgroundColor, textColor, }) => {
    return (
        <span
            className="px-[6px] py-[2px] rounded-[6px] text-sm font-medium"
            style={{ 
                backgroundColor,
                color: textColor,
            }}
        >
            {label}
        </span>
    )
}

const ModelMetricCard = ({ label, value }) => {
    return (
        <div className="bg-[#F5F5F5] rounded-[12px] p-[16px]">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-[28px] font-semibold text-gray-800 mt-[8px]">
                {value}
            </p>
            <p className="text-xs text-gray-500 mt-[4px]">
                detection accuracy
            </p>
        </div>
    );
};

export default NLPInsights;
