import { Children, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import { useReactToPrint } from "react-to-print";

import CSVReader from "react-csv-reader";

import EmptyState from "../../components/admin/EmptyState";
import SkeletonBody from "../../components/SkeletonBody";
import LoadingSkeleton from "../../components/LoadingSkeleton";
import Regions from "../../assets/data/regions.json";
import DataManagementPrint from "../../components/admin/DataManagementPrint";
import SummaryPrintReport from "../../components/admin/SummaryPrintReport";
import ModelEvaluationUpload from "../../components/admin/ModelEvaluationUpload";
import { loadSelfReportsForPrint } from "../../utils/selfReportPrintHelpers";
import { useFetchModelEvaluationsQuery } from "../../features/api/modelEvaluationsSlice";
import {
    EVALUATION_LANGUAGE_NAMES,
    buildModelEvaluationPrintReport,
    buildEvaluationLanguageRows,
    formatEvaluationDate,
    getComparisonIssue,
    getLanguageComparisonIssue,
} from "../../utils/modelEvaluationHelpers";
import useUrlTab from "../../hooks/useUrlTab";

import {
    useFetchDatasetsByUserQuery,
    useDownloadDatasetMutation,
    useDeleteDatasetMutation,
    useUploadFileMutation,
    useProcessDatasetMutation,
} from "../../features/api/datasetsSlice";

import { useCreateAccountActivityMutation } from "../../features/api/accountActivitySlice";

import {
    useFetchAnalyticsEntriesQuery,
    useLazyFetchAnalyticsEntriesQuery,
    useProcessAnalyticsEntriesMutation,
} from "../../features/api/analyticsEntriesSlice";

import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,  
} from "recharts";

import { ToolbarButton, ToolbarSearch, ToolbarSelect } from "../../components/ToolbarControls";
import { popup } from "leaflet";
import { current } from "@reduxjs/toolkit";

const ModelAccessToolkit = () => {
    const [activeTab, setActiveTab] = useUrlTab(
        "tab", ["comparison", "data", "logs"], "comparison"
    );

    return (
        <div className="flex flex-col gap-[10px]">
            {/* PAGE HEADER */}
            <div>
                <h1 className="text-[24px] font-semibold text-gray-800">
                    Model Access and Toolkit
                </h1>
                <p className="text-gray-500 text-[14px]">
                    Evaluate, compare, and manage machine learning models for health surveillance.
                </p>
            </div>

            {/* SUBTABS */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[12px]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-[8px] bg-[#F5F5F5] rounded-[10px] p-[6px]">
                    <TabButton
                        label="Model Comparison"
                        active={activeTab === "comparison"}
                        onClick={() => setActiveTab("comparison")}
                    />
                    <TabButton
                        label="Data Management"
                        active={activeTab === "data"}
                        onClick={() => setActiveTab("data")}
                    />
                    <TabButton
                        label="Training Logs"
                        active={activeTab === "logs"}
                        onClick={() => setActiveTab("logs")}
                    />
                </div>
            </div>
            {activeTab === "comparison" && <ModelComparison />}
            {activeTab === "data" && <DataManagement />}
            {activeTab === "logs" && <TrainingLogs />}
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

/* SUBTAB 1 = MODEL COMPARISON */
const DISEASE_MODEL_EVALUATIONS = [
    {
        id: "electra",
        name: "ELECTRA",
        modelVersion: null,
        evaluationSet: null,
        sampleCount: null,
        macroF1: null, 
        microF1: null,
        precisionMacro: null,
        recallMacro: null,
        hammingLoss: null,
    },
    {
        id: "xlmr",
        name: "XLM-RoBERTa",
        modelVersion: null,
        evaluationSet: null,
        sampleCount: null,
        macroF1: null,
        microF1: null,
        precisionMacro: null,
        recallMacro: null,
        hammingLoss: null,
    },
];

const hasEvaluationScore = (value) =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1;

const formatEvaluationScore = (value) =>
    hasEvaluationScore(value)
        ? `${(value * 100).toFixed(2)}%`
        : "Unavailable";

const toEvaluationPercent = (value) =>
    hasEvaluationScore(value) ? value * 100 : null;

const MODEL_CHART_SERIES = [
    { key: "electra", name: "ELECTRA", color: "#32418C" },
    { key: "xlmr", name: "XLM-RoBERTa", color: "#20C997" },
];

const COMPARISON_METRICS = [
    { 
        key: "macroF1", 
        label: "Macro F1", 
        color: "#32418C" },
    {
        key: "precisionMacro",
        label: "Macro Precision",
        color: "#2572A5",
    },
    {
        key: "recallMacro",
        label: "Macro Recall",
        color: "#9BCC33",
    },
];

const EvaluationChartPanel = ({
    title,
    description,
    available,
    unavailableMessage = "Recorded evaluation results have not been added.",
    children,
}) => (
    <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
        <h2 className="text-[18px] font-semibold text-gray-800">
            {title}
        </h2>

        <p className="text-sm text-gray-500 mb-[12px]">
            {description}
        </p>

        <div className="relative h-[360px]">
            {children}

            {!available && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div
                        role="status"
                        className="rounded-[10px] border border-gray-200 bg-white/95 px-5 py-4 text-center shadow-sm"
                    >
                        <p className="text-sm font-medium text-gray-700">
                            Evaluation unavailable
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                            {unavailableMessage}
                        </p>
                    </div>
                </div>
            )}
        </div>
    </div>
);

const ModelComparison = () => {
    const user = useSelector((state) => state.auth.user);
    const [search, setSearch] = useState("");
    const [selectedModel, setSelectedModel] = useState("all");
    const [selectedMetric, setSelectedMetric] = useState("all");
    const [modelPrintReport, setModelPrintReport] = useState(null);
    const [modelPrintError, setModelPrintError] = useState("");
    const [isModelPrinting, setIsModelPrinting] = useState(false);
    const modelPrintRef = useRef(null);
    const modelPrintPending = useRef(false);
    const modelPrintLock = useRef(false);
    const printModels = useReactToPrint({
        content: () => modelPrintRef.current,
        documentTitle: "HealthPH+ - Model Comparison",
        removeAfterPrint: false,
        pageStyle: "@page { size: A4 landscape; margin: 12mm; } @media print { html, body { height: auto !important; overflow: visible !important; margin: 0 !important; } }",
        onAfterPrint: () => { modelPrintLock.current = false; setIsModelPrinting(false); },
        onPrintError: () => {
            modelPrintLock.current = false;
            setIsModelPrinting(false);
            setModelPrintError("Unable to open the print dialog. Please try again.");
        },
    });
    useEffect(() => {
        if (modelPrintReport && modelPrintPending.current) {
            modelPrintPending.current = false;
            printModels();
        }
    }, [modelPrintReport, printModels]);
    const {
        currentData: evaluationData,
        isFetching: isEvaluationFetching,
        isError: isEvaluationError,
        refetch: refetchEvaluations,
    } = useFetchModelEvaluationsQuery(undefined, {
        refetchOnMountOrArgChange: true,
        refetchOnFocus: true,
    });

    const savedModels = DISEASE_MODEL_EVALUATIONS.map((model) => ({
        ...model,
        ...evaluationData?.models?.find((record) => record.id === model.id),
    }));
    const models = savedModels.filter((model) => {
        const matchesModel =
            selectedModel === "all" || model.id === selectedModel;

        const matchesSearch = model.name
            .toLowerCase()
            .includes(search.trim().toLowerCase());

        return matchesModel && matchesSearch;
    });
    const comparisonIssue = getComparisonIssue(models);
    const languageComparisonIssue = comparisonIssue || getLanguageComparisonIssue(models);
    const languageEvaluations = languageComparisonIssue ? [] : buildEvaluationLanguageRows(models);

    const metrics = COMPARISON_METRICS.filter(
        (metric) =>
            selectedMetric === "all" || metric.key === selectedMetric
    );

    const series = MODEL_CHART_SERIES.filter((item) =>
        models.some((model) => model.id === item.key)
    );

    const comparisonData = comparisonIssue ? [] : models.map((model) => ({
        model: model.name,
        ...Object.fromEntries(
            COMPARISON_METRICS.map(({ key }) => [
                key,
                toEvaluationPercent(model[key]),
            ])
        ),
    }));

    const radarData = COMPARISON_METRICS.map(({ key, label }) => ({
        metric: label,
        ...Object.fromEntries(
            models.map((model) => [
                model.id,
                toEvaluationPercent(model[key]),
            ])
        ),
    }));

    const hasComparisonData = !comparisonIssue && models.some((model) =>
        metrics.some(({ key }) => hasEvaluationScore(model[key]))
    );

    const radarSeries = comparisonIssue ? [] : series.filter(({ key }) => {
        const model = models.find((item) => item.id === key);

        return COMPARISON_METRICS.every((metric) =>
            hasEvaluationScore(model[metric.key])
        );
    });

    const hasLanguageData = languageEvaluations.some((row) =>
        series.some(({ key }) =>
            typeof row[key] === "number" &&
            Number.isFinite(row[key]) &&
            row[key] >= 0 &&
            row[key] <= 100
        )
    );

    const recordedModelCount = models.filter((model) => model.modelVersion).length;
    const handlePrintModels = () => {
        if (isEvaluationFetching || isEvaluationError || !recordedModelCount || modelPrintLock.current) return;
        const report = buildModelEvaluationPrintReport({ models: savedModels, selectedModel, selectedMetric, search, user });
        if (!report) return;
        modelPrintLock.current = true;
        modelPrintPending.current = true;
        setIsModelPrinting(true);
        setModelPrintError("");
        setModelPrintReport(report);
    };

    return (
        <div className="flex flex-col gap-[16px] rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
            <div>
                <ModelEvaluationUpload
                    canUpload={evaluationData?.canUpload === true && !isEvaluationError}
                    onPrint={handlePrintModels}
                    printDisabled={isEvaluationFetching || isEvaluationError || recordedModelCount === 0}
                    isPrinting={isModelPrinting}
                    printError={modelPrintError}
                >
                    <div className="flex flex-wrap items-start justify-between gap-x-[20px] gap-y-[8px]">
                        <div className="w-full sm:w-[280px] sm:shrink-0">
                            <ToolbarSearch id="model-comparison-search" aria-label="Search models" className="!w-full"
                                value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search models..." />
                        </div>
                        <div className="ml-auto flex max-w-full flex-col gap-[6px]">
                            <div className="flex h-[30px] items-center justify-end">
                                <button type="button" onClick={() => {
                                    setSearch(""); setSelectedModel("all"); setSelectedMetric("all"); setModelPrintError("");
                                }} className="rounded-[8px] border border-[#E5E5E5] px-[10px] py-[6px] text-xs font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500">
                                    Reset filters
                                </button>
                            </div>
                            <div className="flex max-w-full flex-wrap items-end justify-end gap-[10px]">
                                <label className="block min-w-0 max-w-full">
                                    <span className="sr-only">Model</span>
                                    <ToolbarSelect value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} className="h-[42px] w-auto max-w-full">
                                        <option value="all">All Models</option>
                                        {DISEASE_MODEL_EVALUATIONS.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                                    </ToolbarSelect>
                                </label>
                                <label className="block min-w-0 max-w-full">
                                    <span className="sr-only">Metric</span>
                                    <ToolbarSelect value={selectedMetric} onChange={(event) => setSelectedMetric(event.target.value)} className="h-[42px] w-auto max-w-full">
                                        <option value="all">All Metrics</option>
                                        {COMPARISON_METRICS.map((metric) => <option key={metric.key} value={metric.key}>{metric.label}</option>)}
                                    </ToolbarSelect>
                                </label>
                            </div>
                        </div>
                    </div>
                </ModelEvaluationUpload>
            </div>
            <div style={{ display: "none" }}>
                <SummaryPrintReport ref={modelPrintRef} report={modelPrintReport} />
            </div>

            {isEvaluationFetching ? (
                <div role="status" aria-label="Loading model evaluations" className="grid gap-[10px] xl:grid-cols-2">
                    {[0, 1].map((key) => <div key={key} className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
                        <LoadingSkeleton className="mb-[16px] h-[20px] w-[180px]" />
                        <LoadingSkeleton className="h-[240px] w-full" />
                    </div>)}
                </div>
            ) : isEvaluationError ? (
                <EmptyState iconName="Error" heading="Unable to Load Evaluation Records" content="Please try again.">
                    <button type="button" onClick={() => refetchEvaluations()} className="prod-btn-base prod-btn-secondary">Retry</button>
                </EmptyState>
            ) : models.length === 0 ? (
                <div className="rounded-[12px] border border-gray-200 bg-white p-5 text-sm text-gray-500">
                    No models match your filters.
                </div>
            ) : (
                <>
                    {/* PERFORMANCE BAR CHART */}
                    <EvaluationChartPanel
                        title="Model Performance Comparison"
                        description="Recorded disease-classification metrics. Compare results from the same labeled evaluation set, split and evaluation protocol."
                        available={hasComparisonData}
                        unavailableMessage={comparisonIssue || undefined}
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={comparisonData}
                                margin={{
                                    top: 20,
                                    right: 20,
                                    left: 0,
                                    bottom: 20,
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="model" />
                                <YAxis domain={[0, 100]} unit="%" />
                                <Tooltip
                                    formatter={(value) =>
                                        typeof value === "number"
                                            ? `${value.toFixed(2)}%`
                                            : "Unavailable"
                                    }
                                />
                                <Legend
                                    verticalAlign="bottom"
                                    iconType="circle"
                                />

                                {metrics.map((metric) => (
                                    <Bar
                                        key={metric.key}
                                        dataKey={metric.key}
                                        name={metric.label}
                                        fill={metric.color}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </EvaluationChartPanel>

                    {/* MODEL CARDS */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-[10px]">
                        {models.map((model) => (
                            <ModelCard
                                key={model.id}
                                name={model.name}
                                description={`Disease classification. Evaluation dataset: ${
                                    model.evaluationSet || "Unavailable"
                                }`}
                                score={formatEvaluationScore(model.macroF1)}
                                hammingLoss={
                                    hasEvaluationScore(model.hammingLoss)
                                        ? model.hammingLoss.toFixed(4)
                                        : "Unavailable"
                                }
                                precision={formatEvaluationScore(
                                    model.precisionMacro
                                )}
                                recall={formatEvaluationScore(
                                    model.recallMacro
                                )}
                                tag="Disease Classification"
                                languages={(model.languages || []).map((code) => EVALUATION_LANGUAGE_NAMES[code] || code)}
                                lastUpdated={formatEvaluationDate(model.evaluatedAt)}
                                modelVersion={model.modelVersion}
                                evaluationSplit={model.split}
                                sampleCount={model.sampleCount}
                            />
                        ))}
                    </div>

                    {/* MULTILINGUAL BAR CHART */}
                    <EvaluationChartPanel
                        title="Multilingual Performance"
                        description="Macro F1 by test language. Missing language evaluations are unavailable, not zero."
                        available={hasLanguageData}
                        unavailableMessage={languageComparisonIssue || undefined}
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={languageEvaluations}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="language" />
                                <YAxis domain={[0, 100]} unit="%" />
                                <Tooltip
                                    formatter={(value) =>
                                        typeof value === "number"
                                            ? `${value.toFixed(2)}%`
                                            : "Unavailable"
                                    }
                                />
                                <Legend iconType="square" />

                                {series.map((item) => (
                                    <Bar
                                        key={item.key}
                                        dataKey={item.key}
                                        name={item.name}
                                        fill={item.color}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </EvaluationChartPanel>

                    {/* RADAR DESIGN */}
                    <EvaluationChartPanel
                        title="Classification Performance Radar"
                        description="Macro F1, precision, and recall for disease classification. Complete metrics are required to draw a model."
                        available={radarSeries.length > 0}
                        unavailableMessage={comparisonIssue || undefined}
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart
                                data={radarData}
                                cx="50%"
                                cy="50%"
                                outerRadius="70%"
                            >
                                <PolarGrid />
                                <PolarAngleAxis dataKey="metric" />
                                <PolarRadiusAxis
                                    angle={30}
                                    domain={[0, 100]}
                                />

                                {radarSeries.map((item) => (
                                    <Radar
                                        key={item.key}
                                        name={item.name}
                                        dataKey={item.key}
                                        stroke={item.color}
                                        fill={item.color}
                                        fillOpacity={0.25}
                                    />
                                ))}

                                <Tooltip />
                                <Legend />
                            </RadarChart>
                        </ResponsiveContainer>
                    </EvaluationChartPanel>
                </>
            )}
        </div>
    );
};


const RAW_DATASET_REQUIRED_HEADERS = [
    "id",
    "text",
    "location",
    "date_posted",
    "source",
    "date_collected",
];

const ACTIVE_ANALYTICS_STATUSES = ["QUEUED", "PROCESSING"];
const ANALYTICS_PAGE_SIZE = 25;
const DATASET_PAGE_SIZE = 25;
const PROCESSABLE_ANALYTICS_STATUSES = ["SUBMITTED", "FAILED"];

const normalizeCsvHeader = (header) =>
    String(header || "").trim().toLowerCase().replace(/\s+/g, "_");    

const getDatasetRowError = (rows, headerLookup) => {
    for (const [index, row] of rows.entries()) {
        const value = (column) => String(row?.[headerLookup[column]] ?? "").trim();

        if (RAW_DATASET_REQUIRED_HEADERS.every((column) => !value(column))) continue;

        if (!value("text")) {
            return `Row ${index + 2}: Text is missing. Add the post text or remove this row.`;
        }
        if (!value("id")) {
            return `Row ${index + 2}: ID is missing. Add an ID or remove this row.`;
        }
    }
    return "";
};

const formatDatasetHeader = (header) =>
    String(header || "")
        .trim()
        .replace(/_/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map((word) =>
            word.toLowerCase() === "id"
                ? "ID"
                : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");

const formatBytes = (size = 0) => {
    if (size < 1024) return `${size} B`;

    const kb = size / 1024;
    if (kb < 1024) return `${kb.toFixed(2).replace(/\.?0+$/, "")} KB`;

    return `${(kb / 1024).toFixed(2).replace(/\.?0+$/, "")} MB`;
}

const getRequestErrorMessage = (error, fallback) => {
    const detail = error?.data?.detail;

    if (typeof detail === "string") {
        return detail;
    }

    if (Array.isArray(detail) && detail[0]?.msg) {
        return detail[0].msg;
    }

    return error?.error || fallback;
};

/* SUBTAB 2 = DATA MANAGEMENT */
const DataManagement = () => {
    const user = useSelector((state) => state.auth.user);

    const dataManagementPrintRef = useRef(null);
    const printRequestRef = useRef(null);
    const printMountedRef = useRef(true);
    const printLockRef = useRef(false);
    const pendingPrintRef = useRef(false);
    const [printReport, setPrintReport] = useState(null);
    const [isPreparingPrint, setIsPreparingPrint] = useState(false);
    const [printError, setPrintError] = useState("");
    const [fetchPrintEntries] = useLazyFetchAnalyticsEntriesQuery();

    const finishDataManagementPrint = () => {
        printLockRef.current = false;
        pendingPrintRef.current = false;
        if (printMountedRef.current) {
            setIsPreparingPrint(false);
            setPrintReport(null);
        }
    };

    const printDataManagement = useReactToPrint({
        content: () => dataManagementPrintRef.current,
        documentTitle: printReport?.sourceType === "social_media"
            ? "HealthPH+ - Social Media Datasets" : "HealthPH+ - Self Reports",
        // Safari can return from window.print before its preview has finished.
        removeAfterPrint: false,
        pageStyle: "@page { size: A4 landscape; margin: 12mm; } @media print { html, body { height: auto !important; overflow: visible !important; margin: 0 !important; } }",
        onAfterPrint: finishDataManagementPrint,
        onPrintError: () => {
            if (printMountedRef.current) {
                setPrintError("Unable to open the print dialog. Please try again.");
            }
            finishDataManagementPrint();
        },
    });

    useEffect(() => {
        printMountedRef.current = true;
        return () => {
            printMountedRef.current = false;
            pendingPrintRef.current = false;
            printLockRef.current = false;
            printRequestRef.current?.abort();
        };
    }, []);

    // React has committed the complete report before the print library clones it.
    useEffect(() => {
        if (printReport && pendingPrintRef.current) {
            pendingPrintRef.current = false;
            printDataManagement();
        }
    }, [printReport, printDataManagement]);

    /* API HOOKS */
    const [downloadDataset] = useDownloadDatasetMutation();
    const [processDataset, { isLoading: isProcessLoading }] = useProcessDatasetMutation();
    const [deleteDataset, { isLoading: isDeleteLoading }] = useDeleteDatasetMutation();

    const [createAccountActivity] = useCreateAccountActivityMutation();

    const [datasetPollingInterval, setDatasetPollingInterval] = useState(0);

    const {
        currentData: datasetsByUser,
        isLoading: isDatasetsByUserInitiallyLoading,
        isFetching: isDatasetsByUserFetching,
        isError: isDatasetsByUserError,
        refetch: refetchDatasetsByUser,
    } = useFetchDatasetsByUserQuery(user.id, {
        pollingInterval: datasetPollingInterval,
        skipPollingIfUnfocused: true,
    });

    const isDatasetsByUserLoading = (isDatasetsByUserInitiallyLoading || isDatasetsByUserFetching) && !datasetsByUser;
    const datasets = datasetsByUser || [];

    const hasActiveDataset = datasets.some((dataset) =>
        ["QUEUED", "PROCESSING"].includes(
            String(dataset.dataset_status || "").toUpperCase()
        )
    );

    useEffect(() => {
        setDatasetPollingInterval(hasActiveDataset ? 3000 : 0);
    }, [hasActiveDataset]);

    const [datasetSearch, setDatasetSearch] = useState("");
    const [datasetStatusFilter, setDatasetStatusFilter] = useState("all");
    const [datasetPage, setDatasetPage] = useState(1);
    const [selectedDatasetIds, setSelectedDatasetIds] = useState([]);

    const [dataSourceView, setDataSourceView] = useUrlTab(
        "source", ["self_report", "social_media"], "self_report"
    );

    const [selectedEntryIds, setSelectedEntryIds] = useState([]);

    const [analyticsPollingInterval, setAnalyticsPollingInterval] = useState(0);

    const [entrySearch, setEntrySearch] = useState("");
    const [entryStatusFilter, setEntryStatusFilter] = useState("all");
    const [entryPage, setEntryPage] = useState(1);

    const [dataDateFrom, setDataDateFrom] = useState("");
    const [dataDateTo, setDataDateTo] = useState("");
    const [dataLanguageFilter, setDataLanguageFilter] = useState("all");
    const [dataRegionFilter, setDataRegionFilter] = useState("all");

    const handleDataFilterChange = (setter, value) => {
        setter(value);
        setEntryPage(1);
        setDatasetPage(1);
        setSelectedEntryIds([]);
        setSelectedDatasetIds([]);
    };

    const {
        currentData: analyticsEntriesData,
        isLoading: isAnalyticsEntriesInitiallyLoading,
        isFetching: isAnalyticsEntriesFetching,
        isError: isAnalyticsEntriesError,
        error: analyticsEntriesError,
        refetch: refetchAnalyticsEntries,
    } = useFetchAnalyticsEntriesQuery(
        {
            sourceType: dataSourceView,
            analysisStatus: entryStatusFilter,
            datasetId: "all",
            search: entrySearch,
            limit: ANALYTICS_PAGE_SIZE,
            offset: (entryPage - 1) * ANALYTICS_PAGE_SIZE,
            language: dataLanguageFilter,
            dateFrom: dataDateFrom,
            dateTo: dataDateTo,
            region: dataRegionFilter,
        },
        {
            skip: dataSourceView === "social_media",
            pollingInterval: analyticsPollingInterval,
            skipPollingIfUnfocused: true,
        }
    );

    const isAnalyticsEntriesLoading = (isAnalyticsEntriesInitiallyLoading || isAnalyticsEntriesFetching) && !analyticsEntriesData;
    const analyticsEntries = analyticsEntriesData?.entries || [];
    const analyticsEntriesTotal = analyticsEntriesData?.total || 0;

    const entryPageCount = Math.max(
        1,
        Math.ceil(analyticsEntriesTotal / ANALYTICS_PAGE_SIZE)
    );

    const firstVisibleEntry =
        analyticsEntries.length > 0
            ? (entryPage - 1) * ANALYTICS_PAGE_SIZE + 1
            : 0;

    const lastVisibleEntry =
        analyticsEntries.length > 0
            ? firstVisibleEntry + analyticsEntries.length - 1
            : 0;

    useEffect(() => {
        if (
            dataSourceView === "social_media" ||
            isAnalyticsEntriesFetching ||
            isAnalyticsEntriesError ||
            !analyticsEntriesData
        ) {
            return;
        }

        const lastPage = Math.max(
            1,
            Math.ceil(
                analyticsEntriesData.total / ANALYTICS_PAGE_SIZE
            )
        );

        setEntryPage((currentPage) =>
            Math.min(currentPage, lastPage)
        );
    }, [
        dataSourceView,
        analyticsEntriesData,
        isAnalyticsEntriesFetching,
        isAnalyticsEntriesError,
    ]);

    const hasActiveAnalyticsEntries = analyticsEntries.some((entry) =>
        ACTIVE_ANALYTICS_STATUSES.includes(entry.analysis_status)
    );

    useEffect(() => {
        setAnalyticsPollingInterval(
            dataSourceView !== "social_media" && hasActiveAnalyticsEntries
                ? 3000
                : 0
        );
    }, [dataSourceView, hasActiveAnalyticsEntries]);

    const [processAnalyticsEntries, { isLoading: isProcessEntriesLoading }] =
        useProcessAnalyticsEntriesMutation();

    /* PREVIE MODAL STATE */
    const [entryDetailsModalActive, setEntryDetailsModalActive] = useState(false);
    const [entryDetailsModalData, setEntryDetailsModalData] = useState(null);

    const [entryProcessRequestError, setEntryProcessRequestError] = useState("");

    const [selectedEntriesProcessError, setSelectedEntriesProcessError] = useState("");

    const openEntryDetailsModal = (entry) => {
        setEntryProcessRequestError("");
        setEntryDetailsModalData(entry);
        setEntryDetailsModalActive(true);
    };

    const closeEntryDetailsModal = () => {
        setEntryProcessRequestError("");
        setEntryDetailsModalData(null);
        setEntryDetailsModalActive(false);
    };

    useEffect(() => {
        setSelectedEntryIds([]);
        setSelectedEntriesProcessError("");
    }, [
        dataSourceView,
        entryPage,
        entrySearch,
        entryStatusFilter,
        dataDateFrom,
        dataDateTo,
        dataLanguageFilter,
        dataRegionFilter,
    ]);

    /* UPLOAD MODAL STATE */
    const inputFile = useRef(null);
    const [uploadFile, { isLoading: isUploadLoading }] = useUploadFileMutation();

    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadModalActive, setUploadModalActive] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const [uploadPreviewData, setUploadPreviewData] = useState({
        filename: "",
        fileSize: 0,
        rows: 0,
        headers: [],
        data: [],
        missingHeaders: [],
        rowError: "",
    });

    /* DELETE MODAL STATE */
    const [deleteModalActive, setDeleteModalActive] = useState(false);
    const [deleteModalData, setDeleteModalData] = useState({
        id: "",
        filename: "",
    });
    const [deleteError, setDeleteError] = useState("");

    /* PREVIEW MODAL STATE */
    const [previewModalActive, setPreviewModalActive] = useState(false);

    const [previewModalData, setPreviewModalData] = useState({
        id: "",
        filename: "",
        dataset_type: "",
        num_of_rows: 0,
        dataset_status: "",
        processing_error: "",
        processed_at: "",
        preview_headers: [],
        preview_data: [],
    });

    /* BULK MODAL STATE */
    const [bulkActionModalActive, setBulkActionModalActive] = useState(false);
    const [bulkActionType, setBulkActionType] = useState("");
    const [bulkActionError, setBulkActionError] = useState("");

    /* UPLOAD HANDLER */
    const resetUploadState = () => {
        setSelectedFile(null);
        setUploadModalActive(false);
        setUploadError("");
        setUploadPreviewData({
            filename: "",
            fileSize: 0,
            rows: 0,
            headers: [],
            data: [],
            missingHeaders: [],
            rowError: "",
        });

        if (inputFile.current) {
            inputFile.current.value = "";
        }
    };

    const onFileSelect = (data, fileInfo, originalFile) => {
        const isCsv =
            fileInfo?.type === "text/csv" ||
            fileInfo?.name?.toLowerCase().endsWith(".csv");

        if (!isCsv) {
            setUploadError("Please select a valid CSV file.");
            resetUploadState();
            return;
        }

        const headers = data?.[0] ? Object.keys(data[0]) : [];

        const headerLookup = headers.reduce((lookup, header) => {
            lookup[normalizeCsvHeader(header)] = header;
            return lookup;
        }, {});

        const normalizedHeaders = headers.map(normalizeCsvHeader);

        const missingHeaders = RAW_DATASET_REQUIRED_HEADERS.filter(
            (requiredHeader) => !normalizedHeaders.includes(requiredHeader)
        );

        const validRows = data.filter((row) =>
            RAW_DATASET_REQUIRED_HEADERS.some((requiredHeader) => {
                const originalHeader = headerLookup[requiredHeader];
                return String(row?.[originalHeader] ?? "").trim() !== "";
            })
        );

        const rowError = missingHeaders.length > 0
            ? ""
            : validRows.length === 0
                ? "CSV file has no data rows."
                : getDatasetRowError(data, headerLookup);

        setSelectedFile(originalFile);
        setUploadPreviewData({
            filename: fileInfo.name,
            fileSize: originalFile?.size || 0,
            rows: validRows.length,
            headers,
            data: validRows.slice(0, 10),
            missingHeaders,
            rowError,
        });
        setUploadError(rowError);
        setUploadModalActive(true);
    };

    const handleUploadDataset = async () => {
        if (!selectedFile) {
            setUploadError("No CSV file selected.");
            return;
        }

        if (uploadPreviewData.missingHeaders.length > 0) {
            setUploadError(
                `Missing columns: ${uploadPreviewData.missingHeaders
                    .map(formatDatasetHeader)
                    .join(", ")}`
            );
            return;
        }

        if (uploadPreviewData.rowError) {
            setUploadError(uploadPreviewData.rowError);
            return;
        }

        try {
            const payload = new FormData();
            const uploadedFilename = uploadPreviewData.filename;

            payload.append("file", selectedFile);

            await uploadFile(payload).unwrap();

            //Close and clear the modal as soon as the upload succeeds.
            resetUploadState();

            try {
                await createAccountActivity({
                    user_id: user.id,
                    entry: `Uploaded dataset: ${uploadedFilename}`,
                    module: "Model Access and Toolkit",
                }).unwrap();
            } catch (activityError) {
                console.error("Failed to record upload activity", activityError);
            }
        } catch (error) {
            const message =
                error?.data?.detail ||
                error?.error ||
                "Failed to upload dataset. Please try again.";

            setUploadError(message);
            console.error("Failed to upload dataset", error);
        }
    };

    const handleDownloadTemplate = () => {
        const link = document.createElement("a");
        link.href = "/assets/dataset-template.csv";
        link.download = "healthph-plus-raw-dataset-template.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleProcessDataset = async ({ id, filename }) => {
        try {
            await processDataset(id).unwrap();

            setPreviewModalActive(false);

            try {
                await createAccountActivity({
                    user_id: user.id,
                    entry: `Started dataset processing: ${filename}`,
                    module: "Model Access and Toolkit",
                }).unwrap();
            } catch (activityError) {
                console.error("Failed to record processing activity", activityError);
            }
        } catch (error) {
            console.error("Failed to process dataset", error);
        }
    };

    /* HELPERS */
    const displayFileSize = (size) => {
        if (size < 1024) return `${size} B`;

        const newSize = size / 1024;

        if (newSize >= 1024) {
            return `${(newSize / 1024).toFixed(2).replace(/\.?0+$/, "")} MB`;
        }
        return `${newSize.toFixed(2).replace(/\.?0+$/, "")} KB`; 
    };

    const getDatasetStatus = (dataset) =>
        String(dataset.dataset_status || dataset.dataset_type || "UNKNOWN").toUpperCase();

    const displayDatasetDate = (value) => {
        if (!value) return "Unavailable";

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Unavailable";

        return format(date, "MMM dd, yyyy hh:mm a");
    };

    const normalizePreviewRows = (rows) => {
        let value = rows;

        for (let i = 0; i < 2; i += 1) {
            if (Array.isArray(value)) return value;
            if (typeof value !== "string") return [];

            try {
                value = JSON.parse(value);
            } catch {
                return [];
            }
        }
        return Array.isArray(value) ? value : [];
    };


    const getDatasetLanguages = (dataset) => {
        if (Array.isArray(dataset.languages) && dataset.languages.length > 0) {
            return dataset.languages;
        }

        const previewRows = normalizePreviewRows(dataset.preview_data);

        return [
            ...new Set(
                previewRows
                    .map((row) => row.language)
                    .filter(Boolean)
            ),
        ];
    };

    const filteredDatasets = datasets.filter((dataset) => {
        const searchValue = datasetSearch.trim().toLowerCase();
        const status = getDatasetStatus(dataset);

        const matchesSearch =
            !searchValue ||
            [
                dataset.filename,
                dataset.original_filename,
                dataset.user_name,
                dataset.dataset_status,
                dataset.dataset_type,
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(searchValue));

        const matchesStatus =
            datasetStatusFilter === "all" || status === datasetStatusFilter;

        const uploadedDate = String(dataset.created_at || "").slice(0, 10);
        const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(uploadedDate);

        const matchesDate =
            (!dataDateFrom && !dataDateTo) ||
            (
                hasValidDate &&
                (!dataDateFrom || uploadedDate >= dataDateFrom) &&
                (!dataDateTo || uploadedDate <= dataDateTo)
            );

        const matchesLanguage =
            dataLanguageFilter === "all" ||
            getDatasetLanguages(dataset).some(
                (language) =>
                    String(language).toLowerCase() === dataLanguageFilter
            );

        return (
            matchesSearch &&
            matchesStatus &&
            matchesDate &&
            matchesLanguage
        );
    });

    const datasetPageCount = Math.max(
        1,
        Math.ceil(filteredDatasets.length / DATASET_PAGE_SIZE)
    );
    const currentDatasetPage = Math.min(datasetPage, datasetPageCount);
    const datasetPageOffset = (currentDatasetPage - 1) * DATASET_PAGE_SIZE;
    const paginatedDatasets = filteredDatasets.slice(
        datasetPageOffset,
        datasetPageOffset + DATASET_PAGE_SIZE
    );
    const firstVisibleDataset = paginatedDatasets.length > 0 ? datasetPageOffset + 1 : 0;
    const lastVisibleDataset = paginatedDatasets.length > 0
        ? datasetPageOffset + paginatedDatasets.length
        : 0;

    useEffect(() => {
        if (isDatasetsByUserLoading || isDatasetsByUserError) return;
        setDatasetPage((page) => Math.min(page, datasetPageCount));
    }, [isDatasetsByUserLoading, isDatasetsByUserError, datasetPageCount]);

    useEffect(() => {
        setSelectedDatasetIds([]);
    }, [
        datasetPage,
        dataSourceView,
        datasetSearch,
        datasetStatusFilter,
        dataDateFrom,
        dataDateTo,
        dataLanguageFilter,
    ]);

    const toggleDatasetSelection = (id) => {
        setSelectedDatasetIds((currentIds) =>
            currentIds.includes(id)
                ? currentIds.filter((currentId) => currentId !== id)
                : [...currentIds, id]
        );
    };

    const toggleAllVisibleDatasets = () => {
        const visibleIds = paginatedDatasets.map((dataset) => dataset.id);

        const allVisibleSelected =
            visibleIds.length > 0 &&
            visibleIds.every((id) => selectedDatasetIds.includes(id));

        setSelectedDatasetIds((currentIds) =>
            allVisibleSelected
                ? currentIds.filter((id) => !visibleIds.includes(id))
                : [...new Set([...currentIds, ...visibleIds])]
        );
    };

    const allVisibleDatasetsSelected =
        paginatedDatasets.length > 0 &&
        paginatedDatasets.every((dataset) => selectedDatasetIds.includes(dataset.id));

    const selectedDatasets = datasets.filter((dataset) =>
        selectedDatasetIds.includes(dataset.id)
    );

    const selectedProcessableDatasets = selectedDatasets.filter((dataset) => {
        const status = String(dataset.dataset_status || "").toUpperCase();
        const type = String(dataset.dataset_type || "").toUpperCase();

        return type === "RAW" && ["UPLOADED", "FAILED"].includes(status);
    });

    const hasSelectedDatasets = selectedDatasetIds.length > 0;

    const normalizePreviewHeaders = (headers) => {
        if (Array.isArray(headers)) return headers;
        if (typeof headers === "string") return headers.split("+").filter(Boolean);
        return [];
    };


    const selectedEntries = analyticsEntries.filter((entry) =>
        selectedEntryIds.includes(entry.id)
    );

    const processableEntries = analyticsEntries.filter((entry) =>
        PROCESSABLE_ANALYTICS_STATUSES.includes(entry.analysis_status)
    );

    const selectedProcessableEntries = selectedEntries.filter((entry) =>
        PROCESSABLE_ANALYTICS_STATUSES.includes(entry.analysis_status)
    );

    const toggleEntrySelection = (id) => {
        setSelectedEntriesProcessError("");
        setSelectedEntryIds((currentIds) =>
            currentIds.includes(id)
                ? currentIds.filter((currentId) => currentId !== id)
                : [...currentIds, id]
        );
    };

    const toggleAllVisibleEntries = () => {
        const visibleProcessableIds = processableEntries.map((entry) => entry.id);

        const allVisibleSelected =
            visibleProcessableIds.length > 0 &&
            visibleProcessableIds.every((id) => selectedEntryIds.includes(id));

        setSelectedEntriesProcessError("");
        setSelectedEntryIds((currentIds) =>
            allVisibleSelected
                ? currentIds.filter((id) => !visibleProcessableIds.includes(id))
                : [...new Set([...currentIds, ...visibleProcessableIds])]
        );
    };

    const clearSelectedEntries = () => {
        setSelectedEntriesProcessError("");
        setSelectedEntryIds([]);
    };

    /* ACTION HANDLERS */
    const handleDownloadDataset = async ({ id, filename }) => {
        try {
            const blob = await downloadDataset(id).unwrap();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download = filename || "dataset.csv";
            document.body.appendChild(link);
            link.click();
            link.remove();

            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to download dataset", error);
        }
    };

    const openPreviewModal = (dataset) => {
        setPreviewModalData({
            id: dataset.id,
            filename: dataset.original_filename || dataset.filename || "Dataset",
            dataset_type: dataset.dataset_type || "RAW",
            num_of_rows: dataset.num_of_rows ?? 0,
            dataset_status: dataset.dataset_status || dataset.dataset_type || "Unknown",
            processing_error: dataset.processing_error || "",
            processed_at: dataset.processed_at || "",
            preview_headers: normalizePreviewHeaders(dataset.preview_headers),
            preview_data: normalizePreviewRows(dataset.preview_data),
        });

        setPreviewModalActive(true);
    };

    const openDeleteModal = ({ id, filename }) => {
        setDeleteModalData({ id, filename });
        setDeleteError("");
        setDeleteModalActive(true);
    };

    const closeDeleteModal = () => {
        if (isDeleteLoading) return;

        setDeleteModalActive(false);
        setDeleteModalData({ id: "", filename: ""});
        setDeleteError("");
    };

    const handleDeleteDataset = async () => {
        const deletedFilename = deleteModalData.filename;

        try {
            await deleteDataset(deleteModalData.id).unwrap();

            setDeleteModalActive(false);
            setDeleteModalData({ id: "", filename: "" });
            setDeleteError("");

            try {
                await createAccountActivity({
                    user_id: user.id,
                    entry: `Deleted dataset: ${deletedFilename}`,
                    module: "Model Access and Toolkit",
                }).unwrap();
            } catch (activityError) {
                console.error("Failed to record deletion activity", activityError);
            }
        } catch (error) {
            setDeleteError("Failed to delete dataset. Please try again.");
            console.error("Failed to delete dataset", error);
        }
    };

    const openBulkActionModal = (actionType) => {
        if (!hasSelectedDatasets) return;

        setBulkActionType(actionType);
        setBulkActionError("");
        setBulkActionModalActive(true);
    };

    const closeBulkActionModal = () => {
        setBulkActionModalActive(false);
        setBulkActionType("");
        setBulkActionError("");
    };

    const handleConfirmBulkAction = async () => {
        let activityEntry = "";

        try {
            if (bulkActionType === "download") {
                for (const dataset of selectedDatasets) {
                    await handleDownloadDataset({
                        id: dataset.id,
                        filename: dataset.filename,
                    });
                }

                activityEntry = `Downloaded ${selectedDatasets.length} datasets`;
            } else if (bulkActionType === "process") {
                if (selectedProcessableDatasets.length === 0) {
                    setBulkActionError(
                        "No selected datasets are ready for processing."
                    );
                    return;
                }

                for (const dataset of selectedProcessableDatasets) {
                    await processDataset(dataset.id).unwrap();
                }

                activityEntry =
                    `Started processing ${selectedProcessableDatasets.length} datasets`;
            } else if (bulkActionType === "delete") {
                for (const dataset of selectedDatasets) {
                    await deleteDataset(dataset.id).unwrap();
                }

                activityEntry = `Deleted ${selectedDatasets.length} datasets`;
            }

            setSelectedDatasetIds([]);
            closeBulkActionModal();

            if (activityEntry) {
                try {
                    await createAccountActivity({
                        user_id: user.id,
                        entry: activityEntry,
                        module: "Model Access and Toolkit",
                    }).unwrap();
                } catch (activityError) {
                    console.error(
                        "Failed to record bulk dataset activity",
                        activityError
                    );
                }
            }
        } catch (error) {
            setBulkActionError("Bulk action failed. Please try again.");
            console.error("Bulk action failed", error);
        }
    };

    const handleProcessSelectedEntries = async () => {
        const entryIds = selectedProcessableEntries.map((entry) => entry.id);

        if (entryIds.length === 0) return;

        setSelectedEntriesProcessError("");

        try {
            await processAnalyticsEntries(entryIds).unwrap();

            setSelectedEntryIds([]);

            try {
                await createAccountActivity({
                    user_id: user.id,
                    entry: `Queued ${entryIds.length} analytics entries for language processing`,
                    module: "Model Access and Toolkit",
                }).unwrap();
            } catch (activityError) {
                console.error(
                    "Failed to record analytics processing activity",
                    activityError
                );
            }
        } catch (error) {
            setSelectedEntriesProcessError(
                getRequestErrorMessage(
                    error,
                    "Unable to queue the selected entries. Please try again."
                )
            );

            console.error("Failed to process selected analytics entries", error);
        }
    };

    const handleProcessEntry = async (entry) => {
        if (
            !PROCESSABLE_ANALYTICS_STATUSES.includes(entry.analysis_status)
        ) {
            return;
        }

        setEntryProcessRequestError("");

        try {
            await processAnalyticsEntries([entry.id]).unwrap();

            closeEntryDetailsModal();

            try {
                await createAccountActivity({
                    user_id: user.id,
                    entry: "Queued 1 analytics entry for language processing",
                    module: "Model Access and Toolkit",
                }).unwrap();
            } catch (activityError) {
                console.error(
                    "Failed to record analytics processing activity",
                    activityError
                );
            }
        } catch (error) {
            setEntryProcessRequestError(
                getRequestErrorMessage(
                    error,
                    "Unable to queue this entry for processing. Please try again."
                )
            );

            console.error("Failed to process analytics entry", error);
        }
    };

    const dataSourceDetails = {
        social_media: {
            title: "Social Media Datasets",
            description: "Uploaded social media CSV files prepared for analytics and model processing.",
            totalLabel: "Total datasets",
        },
        self_report: {
            title: "Self Reports",
            description: "Mobile self-report entries prepared for analytics and NLP processing.",
            totalLabel: "Total entries",
        },
    };

    const activeDataSourceDetails = dataSourceDetails[dataSourceView];
    const activeDataSourceTotal =
        dataSourceView === "social_media"
            ? filteredDatasets.length
            : analyticsEntriesTotal;

    const pagination = dataSourceView === "social_media"
        ? {
            page: currentDatasetPage,
            pageCount: datasetPageCount,
            first: firstVisibleDataset,
            last: lastVisibleDataset,
            total: filteredDatasets.length,
            unit: "datasets",
            label: "Dataset",
            isLoading: isDatasetsByUserLoading,
            isFetching: isDatasetsByUserFetching,
            isError: isDatasetsByUserError,
            isBusy: isDeleteLoading || isProcessLoading,
            setPage: setDatasetPage,
        }
        : {
            page: entryPage,
            pageCount: entryPageCount,
            first: firstVisibleEntry,
            last: lastVisibleEntry,
            total: analyticsEntriesTotal,
            unit: "reports",
            label: "Report",
            isLoading: isAnalyticsEntriesLoading,
            isFetching: isAnalyticsEntriesFetching,
            isError: isAnalyticsEntriesError,
            isBusy: isProcessEntriesLoading,
            setPage: setEntryPage,
        };

    const handleResetDataFilters = () => {
        setDataDateFrom("");
        setDataDateTo("");
        setDataLanguageFilter("all");
        setDataRegionFilter("all");
        setDatasetPage(1);
        if (dataSourceView === "social_media") {
            setDatasetSearch("");
            setDatasetStatusFilter("all");
            setSelectedDatasetIds([]);
        } else {
            setEntrySearch("");
            setEntryStatusFilter("all");
            setSelectedEntryIds([]);
            setSelectedEntriesProcessError("");
            setEntryPage(1);
        }
    };

    const handleDataManagementPrint = async () => {
        if (printLockRef.current || !["self_report", "social_media"].includes(dataSourceView)) return;
        printLockRef.current = true;
        setIsPreparingPrint(true);
        setPrintError("");

        // Capture the source and filters once, including all matching table pages.
        const sourceType = dataSourceView;
        const isDatasetReport = sourceType === "social_media";
        const filters = {
            analysisStatus: isDatasetReport ? datasetStatusFilter : entryStatusFilter,
            datasetId: "all",
            search: (isDatasetReport ? datasetSearch : entrySearch).trim(),
            language: dataLanguageFilter,
            dateFrom: dataDateFrom,
            dateTo: dataDateTo,
            region: isDatasetReport ? "all" : dataRegionFilter,
        };

        try {
            // The dataset endpoint already returns the complete authorized inventory.
            const entries = isDatasetReport
                ? filteredDatasets.map((dataset) => ({
                    id: dataset.id,
                    filename: dataset.original_filename || dataset.filename,
                    num_of_rows: dataset.num_of_rows,
                    languages: [...getDatasetLanguages(dataset)],
                    created_at: dataset.created_at,
                    user_name: dataset.user_name,
                    dataset_status: getDatasetStatus(dataset),
                }))
                : await loadSelfReportsForPrint((args) => {
                    if (!printMountedRef.current) throw new Error("Print preparation cancelled.");
                    const request = fetchPrintEntries(args, false);
                    printRequestRef.current = request;
                    return request.unwrap();
                }, filters);

            if (!printMountedRef.current) return;
            if (entries.length === 0) {
                throw new Error(`No ${isDatasetReport ? "datasets" : "self reports"} match these filters. Refresh the table and try again.`);
            }

            pendingPrintRef.current = true;
            setPrintReport({
                sourceType,
                entries,
                filters,
                generatedAt: new Date().toISOString(),
                generatedBy: [user.first_name, user.last_name].filter(Boolean).join(" "),
            });
        } catch (error) {
            if (printMountedRef.current) {
                setPrintError(getRequestErrorMessage(
                    error,
                    error?.message || "Unable to prepare the report. Please try again."
                ));
            }
            finishDataManagementPrint();
        }
    };

    return (
        <>
        <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
            <div className="flex justify-center">
                <div className="flex flex-wrap items-center justify-center gap-[8px]">
                    <DataSourcePill
                        label="Self Reports"
                        active={dataSourceView === "self_report"}
                        onClick={() => {
                            setDataSourceView("self_report");
                            setEntryPage(1);
                            setDatasetPage(1);
                        }}
                    />
                    <DataSourcePill
                        label="Social Media Datasets"
                        active={dataSourceView === "social_media"}
                        onClick={() => {
                            setDataSourceView("social_media");
                            setEntryPage(1);
                            setDatasetPage(1);
                        }}
                    />
                </div>
            </div>

            <div className="mb-[20px] flex flex-col gap-[8px]">
                <div className="flex flex-col gap-[8px] md:flex-row md:items-end md:justify-between">
                    <div className="flex flex-col gap-[4px]">
                        <h2 className="text-[20px] font-semibold text-gray-800">
                            {activeDataSourceDetails.title}
                        </h2>
                        <p className="text-sm text-gray-500">
                            {activeDataSourceDetails.description}
                        </p>
                    </div>

                    {dataSourceView === "self_report" && (
                        <ToolbarButton
                            iconName="Printer"
                            variant="primary"
                            className="self-start md:self-auto"
                            onClick={handleDataManagementPrint}
                            disabled={isPreparingPrint || isAnalyticsEntriesFetching || isAnalyticsEntriesError || analyticsEntriesTotal === 0}
                            title="Print all self reports matching the current filters"
                        >
                            {isPreparingPrint ? "Preparing..." : "Print"}
                        </ToolbarButton>
                    )}

                    {dataSourceView === "social_media" && (
                        <div className="flex flex-col gap-[10px] sm:flex-row sm:items-center md:justify-end">
                            <ToolbarButton
                                iconName="Printer"
                                variant="primary"
                                onClick={handleDataManagementPrint}
                                disabled={isPreparingPrint || isDatasetsByUserFetching || isDatasetsByUserError || filteredDatasets.length === 0}
                                title="Print all datasets matching the current filters"
                            >
                                {isPreparingPrint ? "Preparing..." : "Print"}
                            </ToolbarButton>

                            <ToolbarButton
                                iconName="Download"
                                variant="primary"
                                onClick={handleDownloadTemplate}
                            >
                                Download Template
                            </ToolbarButton>

                            <ToolbarButton
                                iconName="Upload"
                                variant="primary"
                                onClick={() => inputFile.current.click()}
                            >
                                Upload Dataset
                            </ToolbarButton>

                            <CSVReader
                                parserOptions={{ header: true, skipEmptyLines: true }}
                                onFileLoaded={onFileSelect}
                                ref={inputFile}
                                cssInputClass="hidden"
                            />
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-start justify-between gap-x-[20px] gap-y-[8px]">
                    <div className="flex w-full flex-col gap-[4px] sm:w-[280px] sm:shrink-0">
                        <ToolbarSearch
                            className="!w-full"
                            placeholder={dataSourceView === "social_media"
                                ? "Search datasets..."
                                : "Search report text or location..."}
                            value={dataSourceView === "social_media" ? datasetSearch : entrySearch}
                            onChange={(event) => handleDataFilterChange(
                                dataSourceView === "social_media" ? setDatasetSearch : setEntrySearch,
                                event.target.value
                            )}
                        />
                        <p className="flex items-center gap-[4px] text-sm text-gray-500">
                            {activeDataSourceDetails.totalLabel}:{" "}
                            <span className="font-semibold text-gray-800">
                                {(dataSourceView === "social_media" ? isDatasetsByUserLoading : isAnalyticsEntriesLoading)
                                    ? <LoadingSkeleton className="h-[14px] w-[48px]" />
                                    : (dataSourceView === "social_media" ? isDatasetsByUserError : isAnalyticsEntriesError)
                                        ? "Unavailable"
                                        : Number(activeDataSourceTotal || 0).toLocaleString()}
                            </span>
                        </p>
                    </div>

                    <div className="ml-auto flex max-w-full flex-wrap items-end justify-end gap-[10px]">
                        <div className="flex max-w-full flex-wrap items-end gap-[10px]">
                            <label className="flex w-[145px] max-w-full flex-col gap-[6px] text-sm text-gray-600">
                                <span className="flex h-[30px] items-center">From date</span>
                                <input
                                    type="date"
                                    value={dataDateFrom}
                                    max={dataDateTo || undefined}
                                    onChange={(event) => handleDataFilterChange(setDataDateFrom, event.target.value)}
                                    className="h-[42px] w-full min-w-0 rounded-[10px] border border-[#E5E5E5] bg-white px-[12px] py-[10px] text-sm text-gray-800"
                                />
                            </label>

                            <label className="flex w-[145px] max-w-full flex-col gap-[6px] text-sm text-gray-600">
                                <span className="flex h-[30px] items-center">To date</span>
                                <input
                                    type="date"
                                    value={dataDateTo}
                                    min={dataDateFrom || undefined}
                                    onChange={(event) => handleDataFilterChange(setDataDateTo, event.target.value)}
                                    className="h-[42px] w-full min-w-0 rounded-[10px] border border-[#E5E5E5] bg-white px-[12px] py-[10px] text-sm text-gray-800"
                                />
                            </label>
                        </div>

                        <div className="flex max-w-full flex-col gap-[6px]">
                            <div className="flex h-[30px] items-center justify-end">
                                <button
                                    type="button"
                                    onClick={handleResetDataFilters}
                                    className="rounded-[8px] border border-[#E5E5E5] px-[10px] py-[6px] text-xs font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                                >
                                    Reset filters
                                </button>
                            </div>

                            <div className="flex max-w-full flex-wrap items-end justify-end gap-[10px]">
                                <label className="block min-w-0 max-w-full">
                                    <span className="sr-only">Language</span>
                                    <ToolbarSelect
                                        value={dataLanguageFilter}
                                        onChange={(event) => handleDataFilterChange(setDataLanguageFilter, event.target.value)}
                                        className="h-[42px] w-auto max-w-full"
                                    >
                                        <option value="all">All Languages</option>
                                        <option value="en">English</option>
                                        <option value="fil">Filipino</option>
                                        <option value="ceb">Cebuano</option>
                                        <option value="hil">Hiligaynon</option>
                                        <option value="ilo">Ilocano</option>
                                    </ToolbarSelect>
                                </label>

                                {dataSourceView === "self_report" && (
                                    <label className="block min-w-0 max-w-full">
                                        <span className="sr-only">Region</span>
                                        <ToolbarSelect
                                            value={dataRegionFilter}
                                            onChange={(event) => handleDataFilterChange(setDataRegionFilter, event.target.value)}
                                            className="h-[42px] w-auto max-w-full"
                                        >
                                            <option value="all">All Regions</option>
                                            {Regions.regions.map(({ value, label }) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </ToolbarSelect>
                                    </label>
                                )}

                                <label className="block min-w-0 max-w-full">
                                    <span className="sr-only">Status</span>
                                    <ToolbarSelect
                                        value={dataSourceView === "social_media" ? datasetStatusFilter : entryStatusFilter}
                                        onChange={(event) => handleDataFilterChange(
                                            dataSourceView === "social_media" ? setDatasetStatusFilter : setEntryStatusFilter,
                                            event.target.value
                                        )}
                                        className="h-[42px] w-auto max-w-full"
                                    >
                                        <option value="all">All Status</option>
                                        {dataSourceView === "social_media"
                                            ? <option value="UPLOADED">Uploaded</option>
                                            : <option value="SUBMITTED">Submitted</option>}
                                        <option value="QUEUED">Queued</option>
                                        <option value="PROCESSING">Processing</option>
                                        <option value="PROCESSED">Processed</option>
                                        <option value="FAILED">Failed</option>
                                    </ToolbarSelect>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
                {dataDateFrom && dataDateTo && dataDateFrom > dataDateTo && (
                    <p role="alert" className="text-sm text-red-700">
                        From date must be on or before To date.
                    </p>
                )}
            </div>

            {printError && (
                <p role="alert" className="mb-[16px] rounded-[8px] border border-[#FCA5A5] bg-[#FEF2F2] px-[12px] py-[10px] text-sm text-[#B42318]">
                    {printError}
                </p>
            )}

            {dataSourceView === "social_media" && (
                <>
                    {hasSelectedDatasets && (
                        <div className="mb-[16px] flex flex-col gap-[10px] rounded-[8px] border border-[#E5E5E5] bg-[#F8FAFC] px-[14px] py-[12px] md:flex-row md:items-center md:justify-between">
                            <p className="text-sm text-gray-600">
                                <span className="font-semibold text-gray-800">
                                    {selectedDatasetIds.length}
                                </span>{" "}
                                selected
                            </p>

                            <div className="flex flex-wrap gap-[8px]">
                                <button
                                    type="button"
                                    className="rounded-[8px] border border-[#E5E5E5] bg-white px-[12px] py-[8px] text-sm text-gray-700"
                                    onClick={() => openBulkActionModal("download")}
                                >
                                    Download
                                </button>
                                <button
                                    type="button"
                                    className="rounded-[8px] border border-[#E5E5E5] bg-white px-[12px] py-[8px] text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    disabled={selectedProcessableDatasets.length === 0}
                                    onClick={() => openBulkActionModal("process")}
                                >
                                    Process
                                </button>
                                <button
                                    type="button"
                                    className="rounded-[8px] border border-[#FCA5A5] bg-white px-[12px] py-[8px] text-sm text-[#B42318]"
                                    onClick={() => openBulkActionModal("delete")}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    )}

                    {isDatasetsByUserLoading ? (
                        <div className="min-w-full overflow-y-hidden h-[300px]">
                            <SkeletonBody headers={["", "File Name", "Records", "Languages", "Date Uploaded", "Uploaded by", "Status"]} />
                        </div>
                    ) : isDatasetsByUserError ? (
                        <EmptyState iconName="Error" heading="Unable to Load Datasets" content="Please try loading the datasets again.">
                            <button type="button" onClick={() => refetchDatasetsByUser()} className="prod-btn-base prod-btn-secondary">Retry</button>
                        </EmptyState>
                    ) : filteredDatasets.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[#E5E5E5] text-left text-gray-500">
                                        <th className="w-[44px] py-[12px] px-[10px] font-medium">
                                            <input
                                                type="checkbox"
                                                checked={allVisibleDatasetsSelected}
                                                onChange={toggleAllVisibleDatasets}
                                            />
                                        </th>
                                        <th className="py-[12px] px-[10px] font-medium">File Name</th>
                                        <th className="py-[12px] px-[10px] font-medium">Records</th>
                                        <th className="py-[12px] px-[10px] font-medium">Languages</th>
                                        <th className="py-[12px] px-[10px] font-medium">Date Uploaded</th>
                                        <th className="py-[12px] px-[10px] font-medium">Uploaded by</th>
                                        <th className="py-[12px] px-[10px] font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedDatasets.map((dataset) => {
                                        const languages = getDatasetLanguages(dataset);

                                        return (
                                            <tr
                                                key={dataset.id}
                                                className="cursor-pointer border-b border-[#F0F0F0] transition hover:bg-[#F8FAFC]"
                                                onClick={() => openPreviewModal(dataset)}
                                            >
                                                <td className="py-[14px] px-[10px]">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedDatasetIds.includes(dataset.id)}
                                                        onChange={() => toggleDatasetSelection(dataset.id)}
                                                        onClick={(event) => event.stopPropagation()}
                                                    />
                                                </td>
                                                <td className="max-w-[260px] truncate py-[14px] px-[10px] font-medium text-gray-800">
                                                    {dataset.original_filename || dataset.filename || "Unavailable"}
                                                </td>
                                                <td className="py-[14px] px-[10px] text-gray-600">
                                                    {Number(dataset.num_of_rows || 0).toLocaleString()}
                                                </td>
                                                <td className="py-[14px] px-[10px]">
                                                    <div className="flex max-w-[320px] flex-wrap gap-[6px]">
                                                        {languages.length > 0 ? (
                                                            languages.map((language) => (
                                                                <LanguagePill
                                                                    key={language}
                                                                    language={language}
                                                                    status={dataset.dataset_status}
                                                                />
                                                            ))
                                                        ) : (
                                                            <LanguagePill status={dataset.dataset_status} />
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-[14px] px-[10px] text-gray-600">
                                                    {displayDatasetDate(dataset.created_at)}
                                                </td>
                                                <td className="py-[14px] px-[10px] text-gray-600">
                                                    {dataset.user_name || "Unavailable"}
                                                </td>
                                                <td className="py-[14px] px-[10px]">
                                                    <DatasetStatusBadge status={dataset.dataset_status} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState
                            iconName="Document"
                            heading="No Datasets Yet"
                            content="Uploaded social media CSV files will appear here."
                        />
                    )}
                </>
            )}

            {dataSourceView !== "social_media" && (
                <AnalyticsEntriesPanel
                    sourceType={dataSourceView}
                    entries={analyticsEntries}
                    total={analyticsEntriesTotal}
                    isLoading={isAnalyticsEntriesLoading}
                    isError={isAnalyticsEntriesError}
                    error={analyticsEntriesError}
                    actionError={selectedEntriesProcessError}
                    selectedEntryIds={selectedEntryIds}
                    selectedProcessableCount={selectedProcessableEntries.length}
                    isProcessing={isProcessEntriesLoading}
                    onToggleEntry={toggleEntrySelection}
                    onToggleAllVisible={toggleAllVisibleEntries}
                    onClearSelected={clearSelectedEntries}
                    onProcessSelected={handleProcessSelectedEntries}
                    onViewDetails={openEntryDetailsModal}
                    onRetry={refetchAnalyticsEntries}
                />
            )}
            <div className="mt-[16px] flex flex-wrap items-center justify-between gap-[12px] border-t border-[#E5E5E5] pt-[16px]">
                <p className="text-sm text-gray-500">
                    {pagination.isLoading ? (
                        <LoadingSkeleton
                            className="h-[14px] w-[180px]"
                            label={`Loading ${pagination.unit} range...`}
                        />
                    ) : pagination.isError ? (
                        `${pagination.label} range unavailable`
                    ) : (
                        `Showing ${pagination.first.toLocaleString()}–${pagination.last.toLocaleString()} of ${pagination.total.toLocaleString()} ${pagination.unit}`
                    )}
                </p>

                <div className="flex items-center gap-[12px]">
                    <ToolbarButton
                        disabled={
                            pagination.isFetching ||
                            pagination.isError ||
                            pagination.isBusy ||
                            pagination.page <= 1
                        }
                        onClick={() =>
                            pagination.setPage((page) => Math.max(1, page -1))
                        }
                    >
                        Previous
                    </ToolbarButton>

                    <span className="text-sm text-gray-600">
                        Page{" "}
                        {pagination.isLoading ? (
                            <LoadingSkeleton
                                className="h-[14px] w-[48px]"
                                label="Loading page count..."
                            />
                        ) : pagination.isError ? (
                            "unavailable"
                        ) : (
                            `${pagination.page} of ${pagination.pageCount}`
                        )}
                    </span>

                    <ToolbarButton
                        disabled={
                            pagination.isFetching ||
                            pagination.isError ||
                            pagination.isBusy ||
                            pagination.page >= pagination.pageCount
                        }
                        onClick={() =>
                            pagination.setPage((page) =>
                                Math.min(pagination.pageCount, page + 1)
                            )
                        }
                    >
                        Next
                    </ToolbarButton>
                </div>
            </div>
        </div>
        <div style={{ display: "none" }}>
            <DataManagementPrint ref={dataManagementPrintRef} report={printReport} />
        </div>
        {bulkActionModalActive && (
            <BulkDatasetActionModal
                actionType={bulkActionType}
                selectedCount={selectedDatasetIds.length}
                processableCount={selectedProcessableDatasets.length}
                error={bulkActionError}
                isLoading={isDeleteLoading || isProcessLoading}
                onCancel={closeBulkActionModal}
                onConfirm={handleConfirmBulkAction}
            />
        )}
        {previewModalActive && (
            <DatasetPreviewModal
                data={previewModalData}
                isProcessLoading={isProcessLoading}
                onClose={() => setPreviewModalActive(false)}
                onDownload={() =>
                    handleDownloadDataset({
                        id: previewModalData.id,
                        filename: previewModalData.filename,
                    })
                }
                onDelete={() => {
                    setPreviewModalActive(false);
                    openDeleteModal({
                        id: previewModalData.id,
                        filename: previewModalData.filename,
                    });
                }}
                onProcess={() =>
                    handleProcessDataset({
                        id: previewModalData.id,
                        filename: previewModalData.filename,
                    })
                }
            />
        )}
        {entryDetailsModalActive && entryDetailsModalData && (
            <AnalyticsEntryDetailsModal
                entry={entryDetailsModalData}
                sourceType={dataSourceView}
                isProcessing={isProcessEntriesLoading}
                requestError={entryProcessRequestError}
                onClose={closeEntryDetailsModal}
                onProcess={() => handleProcessEntry(entryDetailsModalData)}
            />
        )}
        {deleteModalActive && (
            <DeleteDatasetModal
                filename={deleteModalData.filename}
                error={deleteError}
                isLoading={isDeleteLoading}
                onCancel={closeDeleteModal}
                onConfirm={handleDeleteDataset}
            />
        )}
        {uploadModalActive && (
            <UploadDatasetModal
                data={uploadPreviewData}
                error={uploadError}
                isLoading={isUploadLoading}
                onCancel={resetUploadState}
                onConfirm={handleUploadDataset}
            />
        )}
        </>
    );
};

const DataSourcePill = ({ label, active, onClick }) => {
    return (
        <button
            type="button"
            className={`rounded-full px-[16px] py-[8px] text-sm font-medium transition ${
                active
                    ? "bg-gray-900 text-white shadow-sm"
                    : "bg-[#F5F5F5] text-gray-600 hover:bg-[#EAEAEA] hover:text-gray-900"
            }`}
            onClick={onClick}
        >
            {label}
        </button>
    );
};

/* CHANGE THIS ONCE CSS AND UTILS ARE UPDATED */
const MODAL_PRIMARY_BUTTON_CLASSES =
    "inline-flex items-center justify-center rounded-[8px] !bg-[#32418C] px-[14px] py-[9px] text-sm font-medium !text-white shadow-sm transition hover:!bg-[#27346F] disabled:cursor-not-allowed disabled:!bg-[#98A2B3] disabled:!text-[#F8FAFC]";

const MODAL_DESTRUCTIVE_BUTTON_CLASSES =
    "inline-flex items-center justify-center rounded-[8px] !bg-[#DC2626] px-[14px] py-[9px] text-sm font-medium !text-white shadow-sm transition hover:!bg-[#B91C1C] disabled:cursor-not-allowed disabled:!bg-[#E87D7D] disabled:!text-[#FBE9E9]";

const getSelfReportReporterLabel = (entry) => {
    if (entry.reporter?.reporterType === "guest") return "GUEST";
    if (entry.reporter?.reporterType === "registered") return "Registered user";
    return "Unavailable";
};

const LanguagePill = ({ language, status, detectionStatus}) => {
    const code = String(language || "").trim();
    const normalizedStatus = String(status || "").toUpperCase();

    const isUnsupported = detectionStatus === "unsupported";
    const isFailed = normalizedStatus === "FAILED";

    const placeholder = isUnsupported
        ? "unsupported"
        : isFailed
            ? "Failed"
            : normalizedStatus === "PROCESSED"
                ? "unknown"
                : "unprocessed";

    const colorClasses =
        isUnsupported || isFailed
            ? "border-[#FECACA] bg-[#FEE2E2] text-[#B91C1C]"
            : code
                ? "border-[#A7F3D0] bg-[#D1FAE5] text-[#047857]"
                : "border-[#E5E5E5] bg-transparent text-gray-600";

    const description = isUnsupported
        ? "The detected language is not supported."
        : isFailed
            ? "Processing failed. Please retry."
            : code
                ? `Detected language: ${code}`
                : normalizedStatus === "PROCESSED"
                    ? "No language result is available."
                    : "Language detection has not finished yet.";

    return (
        <span
            className={`inline-flex whitespace-nowrap rounded-full border px-[8px] py-[3px] text-xs font-medium ${colorClasses}`}
            title={description}
        >
            {code || placeholder}
        </span>
    );
};

const EntryLanguagePill = ({ entry }) => (
    <LanguagePill
        language={entry.language}
        status={entry.analysis_status}
        detectionStatus={entry.analysis?.language_detection?.status}
    />
);

const AnalyticsEntriesPanel = ({
    sourceType,
    entries = [],
    isLoading = false,
    isError = false,
    error,
    actionError,
    selectedEntryIds = [],
    selectedProcessableCount = 0,
    isProcessing = false,
    onToggleEntry,
    onToggleAllVisible,
    onClearSelected,
    onProcessSelected,
    onViewDetails,
    onRetry
}) => {

    const processableEntries = entries.filter((entry) =>
        PROCESSABLE_ANALYTICS_STATUSES.includes(entry.analysis_status)
    );

    const allVisibleProcessableSelected =
        processableEntries.length > 0 &&
        processableEntries.every((entry) => selectedEntryIds.includes(entry.id));

    const selectedCount = selectedEntryIds.length;

    const isSurveySource = sourceType === "survey_response";

    const errorMessage = getRequestErrorMessage(
        error,
        isSurveySource
            ? "Unable to load survey responses. Please try again."
            : "Unable to load self reports. Please try again."
    );

    return (
        <div>
            {actionError && (
                <div
                    className="mb-[16px] rounded-[8px] border border-[#FCA5A5] bg-[#FEF2F2] px-[12px] py-[10px] text-sm text-[#B42318]"
                    role="alert"
                >
                    {actionError}
                </div>
            )}
            {selectedCount > 0 && (
                <div className="mb-[16px] flex flex-col gap-[10px] rounded-[8px] border border-[#E5E5E5] bg-[#F8FAFC] px-[14px] py-[12px] md:flex-row md:items-center md:justify-between">
                    <p className="text-sm text-gray-600">
                        <span className="font-semibold text-gray-800">
                            {selectedCount}
                        </span>{" "}
                        selected
                    </p>

                    <div className="flex flex-wrap gap-[8px]">
                        <button
                            type="button"
                            className="rounded-[8px] border border-[#E5E5E5] bg-white px-[12px] py-[8px] text-sm text-gray-700"
                            onClick={onClearSelected}
                        >
                            Clear
                        </button>
                        <button
                            type="button"
                            className="rounded-[8px] bg-[#2563EB] px-[12px] py-[8px] text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={selectedProcessableCount === 0 || isProcessing}
                            onClick={onProcessSelected}
                        >
                            {isProcessing ? "Processing..." : "Process Selected"}
                        </button>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="overflow-y-hidden min-w-full h-[300px]">
                    <SkeletonBody headers={isSurveySource
                        ? ["", "Survey ID", "Question ID", "ID", "Language", "Answer", "User ID", "User Location", "Date Answered", "Status"]
                        : ["", "Report ID", "Language", "Text", "Location", "Date Reported", "Status"]} />
                </div>
            ) : isError ? (
                <EmptyState
                    iconName="Error"
                    heading="Unable to Load Entries"
                    content={errorMessage}
                >
                    <button
                        type="button"
                        className="prod-btn-base prod-btn-secondary"
                        onClick={onRetry}
                    >
                        Retry
                    </button>
                </EmptyState>
            ) : entries.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#E5E5E5] text-left text-gray-500">
                                <th className="w-[44px] py-[12px] px-[10px] font-medium">
                                    <input
                                        type="checkbox"
                                        checked={allVisibleProcessableSelected}
                                        onChange={onToggleAllVisible}
                                        disabled={processableEntries.length === 0}
                                    />
                                </th>
                                {isSurveySource ? (
                                    <>
                                        <th className="py-[12px] px-[10px] font-medium">Survey ID</th>
                                        <th className="py-[12px] px-[10px] font-medium">Question ID</th>
                                        <th className="py-[12px] px-[10px] font-medium">ID</th>
                                        <th className="py-[12px] px-[10px] font-medium">Language</th>
                                        <th className="py-[12px] px-[10px] font-medium">Answer</th>
                                        <th className="py-[12px] px-[10px] font-medium">User ID</th>
                                        <th className="py-[12px] px-[10px] font-medium">User Location</th>
                                        <th className="py-[12px] px-[10px] font-medium">Date Answered</th>
                                        <th className="py-[12px] px-[10px] font-medium">Status</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="py-[12px] px-[10px] font-medium">Report ID</th>
                                        <th className="py-[12px] px-[10px] font-medium">Language</th>
                                        <th className="py-[12px] px-[10px] font-medium">Text</th>
                                        <th className="py-[12px] px-[10px] font-medium">Location</th>
                                        <th className="py-[12px] px-[10px] font-medium">Date Reported</th>
                                        <th className="py-[12px] px-[10px] font-medium">Status</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry) => {
                                const status = entry.analysis_status || "SUBMITTED";
                                const isProcessed = status === "PROCESSED";
                                const isProcessable =
                                    PROCESSABLE_ANALYTICS_STATUSES.includes(status);

                                return (
                                    <tr
                                        key={entry.id}
                                        className={`cursor-pointer border-b border-[#F0F0F0] transition hover:bg-[#F8FAFC] ${
                                            isProcessed ? "bg-[#F8FAFC] text-gray-400" : ""
                                        }`}
                                        onClick={() => onViewDetails(entry)}
                                    >
                                        <td className="py-[14px] px-[10px]">
                                            <input 
                                                type="checkbox"
                                                checked={selectedEntryIds.includes(entry.id)}
                                                onChange={() => onToggleEntry(entry.id)}
                                                onClick={(event) => event.stopPropagation()}
                                                disabled={!isProcessable}
                                            />
                                        </td>
                                        {isSurveySource ? (
                                            <>
                                                <td className="max-w-[140px] truncate py-[14px] px-[10px] text-gray-600">
                                                    {entry.survey_id || "Unavailable"}
                                                </td>
                                                <td className="max-w-[140px] truncate py-[14px] px-[10px] text-gray-600">
                                                    {entry.question_id || entry.metadata?.question_id || "Unavailable"}
                                                </td>
                                                <td className="max-w-[150px] truncate py-[14px] px-[10px] font-medium text-gray-800">
                                                    {entry.response_id || entry.source_id || entry.id || "Unavailable"}
                                                </td>
                                                <td className="py-[14px] px-[10px] text-gray-600">
                                                    {entry.language || "Unavailable"}
                                                </td>
                                                <td className="max-w-[360px] truncate py-[14px] px-[10px] text-gray-800">
                                                    {entry.text || "Unavailable"}
                                                </td>
                                                <td className="max-w-[150px] truncate py-[14px] px-[10px] text-gray-600">
                                                    {entry.user_id || entry.metadata?.user_id || entry.metadata?.visitor_id || "Unavailable"}
                                                </td>
                                                <td className="max-w-[260px] truncate py-[14px] px-[10px] text-gray-600">
                                                    {formatUserLocation(entry.user_location)}
                                                </td>
                                                <td className="py-[14px] px-[10px] text-gray-600">
                                                    {entry.event_time
                                                        ? format(new Date(entry.event_time), "MMM dd, yyyy hh:mm a")
                                                        : "Unavailable"
                                                    }
                                                </td>
                                                <td className="py-[14px] px-[10px]">
                                                    <DatasetStatusBadge status={entry.analysis_status || "SUBMITTED"} />
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="max-w-[150px] truncate py-[14px] px-[10px] font-medium text-gray-800">
                                                    {entry.sourcePublicId || entry.source_id || entry.report_id || entry.id || "Unavailable"}
                                                </td>
                                                <td className="whitespace-nowrap py-[14px] px-[10px]">
                                                    <EntryLanguagePill entry={entry} />
                                                </td>
                                                <td className="max-w-[420px] truncate py-[14px] px-[10px] text-gray-800">
                                                    {entry.text || "Unavailable"}
                                                </td>
                                                <td className="py-[14px] px-[10px] text-gray-600">
                                                    {entry.location?.raw || entry.location?.city || entry.location?.province || entry.location?.region || "Unavailable"}
                                                </td>
                                                <td className="py-[14px] px-[10px] text-gray-600">
                                                    {entry.created_at
                                                        ? format(new Date(entry.created_at), "MMM dd, yyyy hh:mm a")
                                                        : "Unavailable"
                                                    }
                                                </td>
                                                <td className="py-[14px] px-[10px]">
                                                    <DatasetStatusBadge status={entry.analysis_status || "SUBMITTED"} />
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <EmptyState
                    iconName="Document"
                    heading="No Analytics Entries Yet"
                    content={
                        sourceType === "survey_response"
                            ? "Survey responses with analyzable text will appear here."
                            : "Mobile self-report entries with analyzable text will appear here."
                    }
                />
            )}
        </div>
    );
};

const displayEntryDateTime = (value) => {
    if (!value) return "Unavailable";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Unavailable";
    }

    return format(date, "MMM dd, yyyy hh:mm a");
};

const formatUserLocation = (location = {}) => {
    const parts = [
        location.barangay,
        location.city,
        location.province,
        location.regionLabel,
        location.regionCode,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(", ") : "Unavailable";
};

const DetailRow = ({ label, value }) => (
    <div>
        <p className="text-xs font-medium uppercase text-gray-400">
            {label}
        </p>
        <p className="mt-[4px] break-words text-sm text-gray-800">
            {value === null || value === undefined || value === "" ? "Unavailable" : value}
        </p>
    </div>
);

const AnalyticsEntryDetailsModal = ({
    entry,
    sourceType,
    isProcessing,
    requestError,
    onClose,
    onProcess,
}) => {
    const isSurveySource = sourceType === "survey_response";

    const status = entry.analysis_status || "SUBMITTED";

    const canProcess =
        PROCESSABLE_ANALYTICS_STATUSES.includes(status);

    const processLabel =
        status === "FAILED" ? "Retry Processing" : "Process";

    const displayedError =
        requestError ||
        (status === "FAILED" ? entry.analysis_error : "");

    const location = isSurveySource
        ? formatUserLocation(entry.user_location)
        : entry.location?.raw ||
            entry.location?.city ||
            entry.location?.province ||
            entry.location?.region ||
            "Unavailable";

    const primaryId = isSurveySource
        ? entry.response_id || entry.source_id || entry.id
        : entry.sourcePublicId || entry.source_id || entry.report_id || entry.id;

    const title = isSurveySource
        ? "Survey Response Details"
        : "Self Report Details";

    const dateLabel = isSurveySource ? "Date Answered" : "Date Reported";
    const dateValue = isSurveySource
        ? entry.event_time || entry.date_answered || entry.created_at
        : entry.created_at || entry.event_time;

    return (
        <div className="fixed inset-x-0 bottom-0 top-[49px] z-50 flex items-center justify-center px-[20px] py-[32px]">
            <button 
                type="button"
                className="absolute inset-0 bg-[#34405499] backdrop-blur-sm"
                onClick={onClose}
                aria-label="Close Analytics entry details"
            />

            <div className="relative flex max-h-[calc(100vh-113px)] w-full max-w-[900px] flex-col overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white shadow-xl">
                <div className="border-b border-[#E5E5E5] px-[20px] py-[16px]">
                    <div className="flex items-start justify-between gap-[20px]">
                        <div>
                            <h3 className="text-[18px] font-semibold text-gray-800">
                                {title}
                            </h3>
                            <p className="mt-[4px] text-sm text-gray-500">
                                {primaryId || "Unavailable"}
                            </p>
                        </div>

                        <DatasetStatusBadge status={status} />
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-[20px]">
                    {displayedError && (
                        <div
                            className="mb-[16px] rounded-[8px] border border-[#FCA5A5] bg-[#FEF2F2] px-[12px] py-[10px] text-sm text-[#B42318]"
                            role="alert"
                        >
                            {displayedError}
                        </div>
                    )}

                    <div className="grid gap-[16px] md:grid-cols-2">
                        {isSurveySource && (
                            <>
                                <DetailRow label="Survey ID" value={entry.survey_id} />
                                <DetailRow label="Question ID" value={entry.question_id || entry.metadata?.question_id} />
                                <DetailRow label="Submission ID" value={entry.submission_id} />
                            </>
                        )}

                        <DetailRow label={isSurveySource ? "ID" : "Report ID"} value={primaryId} />
                        {!isSurveySource && (
                            <DetailRow label="Reporter" value={getSelfReportReporterLabel(entry)} />
                        )}
                        <DetailRow label="Language" value={entry.language} />
                        <DetailRow label={dateLabel} value={displayEntryDateTime(dateValue)} />
                        <DetailRow label="Location" value={location} />

                        {isSurveySource && (
                            <DetailRow
                                label="User ID"
                                value={entry.user_id || entry.metadata?.user_id || entry.metadata?.visitor_id}
                            />
                        )}

                        <DetailRow label="Source Type" value={entry.source_type} />
                    </div>

                    <div className="mt-[18px]">
                        <p className="text-xs font-medium uppercase text-gray-400">
                            {isSurveySource ? "Answer" : "Text"}
                        </p>
                        <div className="mt-[6px] rounded-[8px] border border-[#E5E5E5] bg-[#F8FAFC] p-[12px] text-sm leading-6 text-gray-800">
                            {entry.text || "Unavailable"}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-[10px] border-t border-[#E5E5E5] px-[20px] py-[16px]">
                    <button
                        type="button"
                        className="prod-btn-base prod-btn-secondary"
                        onClick={onClose}
                        disabled={isProcessing}
                    >
                        Close
                    </button>

                    {canProcess && (
                        <button
                            type="button"
                            className={MODAL_PRIMARY_BUTTON_CLASSES}
                            onClick={onProcess}
                            disabled={isProcessing}
                        >
                            {isProcessing ? "Processing..." : processLabel}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const DatasetStatusBadge = ({ status }) => {
    const label = status || "UNKNOWN";

    const statusColor = {
        UPLOADED: {
            backgroundColor: "#DBEAFE",
            color: "#2563EB",
        },
        SUBMITTED: {
            backgroundColor: "#DBEAFE",
            color: "#2563EB",
        },
        QUEUED: {
            backgroundColor: "#E0E7FF",
            color: "#4F46E5",
        },
        PROCESSING: {
            backgroundColor: "#FEF3C7",
            color: "#D97706",
        },
        PROCESSED: {
            backgroundColor: "#D1FAE5",
            color: "#059669",
        },
        FAILED: {
            backgroundColor: "#FEE2E2",
            color: "#DC2626",
        },
        UNKNOWN: {
            backgroundColor: "#F3F4F6",
            color: "#6B7280",
        },
    };

    return (
        <span
            className="rounded-full px-[8px] py-[4px] text-xs font-medium"
            style={statusColor[label] ?? statusColor.UNKNOWN}
        >
            {label}
        </span>
    );
};

/* MODALS */
const BulkDatasetActionModal = ({
    actionType,
    selectedCount,
    processableCount,
    error,
    isLoading,
    onCancel,
    onConfirm,
}) => {
    const config = {
        download: {
            title: "Download Selected Datasets",
            message: `Download ${selectedCount} selected dataset${selectedCount === 1 ? "" : "s"}?`,
            confirmLabel: "Download",
            confirmClass: MODAL_PRIMARY_BUTTON_CLASSES,
        },
        process: {
            title: "Process Selected Datasets",
            message: `Process ${processableCount} of ${selectedCount} selected dataset${selectedCount === 1 ? "" : "s"}? Only uploaded or failed raw datasets can be processed.`,
            confirmLabel: "Process",
            confirmClass: MODAL_PRIMARY_BUTTON_CLASSES,
        },
        delete: {
            title: "Delete Selected Datasets",
            message: `Delete ${selectedCount} selected dataset${selectedCount === 1 ? "" : "s"}? This action cannot be undone.`,
            confirmLabel: "Delete",
            confirmClass: MODAL_DESTRUCTIVE_BUTTON_CLASSES,
        },
    };

    const action = config[actionType] || config.download;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-[20px] py-[24px]">
            <button
                type="button"
                className="absolute inset-0 bg-[#34405499] backdrop-blur-sm"
                onClick={onCancel}
                aria-label="Close bulk action confirmation"
                disabled={isLoading}
            />
            <div className="relative w-full max-w-[460px] overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white shadow-xl">
                <div className="border-b border-[#E5E5E5] px-[20px] py-[16px]">
                    <h3 className="text-[18px] font-semibold text-gray-800">
                        {action.title}
                    </h3>
                </div>
                <div className="p-[20px]">
                    <p className="text-sm text-gray-600">
                        {action.message}
                    </p>
                    {error && (
                        <p className="mt-[12px] text-sm text-desctructive-600">
                            {error}
                        </p>
                    )}
                </div>
                <div className="flex justify-end gap-[10px] border-t border-[#E5E5E5] px-[20px] py-[16px]">
                    <button
                        type="button"
                        className="prod-btn-base prod-btn-secondary"
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={action.confirmClass}
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading ? "Working..." : action.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

const DatasetPreviewModal = ({ 
    data,
    isProcessLoading,
    onClose,
    onDownload,
    onDelete,
    onProcess,
}) => {
    const columns = data.preview_headers;
    const status = String(data.dataset_status || "").toUpperCase();

    const canProcess =
        String(data.dataset_type || "").toUpperCase() === "RAW" &&
        ["UPLOADED", "FAILED"].includes(String(data.dataset_status || "").toUpperCase());

    const processLabel =
        String(data.dataset_status || "").toUpperCase() === "FAILED"
            ? "Retry Processing"
            : "Process Dataset";

    const statusMessage = {
        UPLOADED: {
            text: "Dataset uploaded and ready for processing.",
            className: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]",
        },
        QUEUED: {
            text: "Dataset has been queued for processing.",
            className: "border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5]",
        },
        PROCESSING: {
            text: "Dataset processing is currently in progress.",
            className: "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]",
        },
        PROCESSED: {
            text: "Dataset has been processed and is ready for dashboard use.",
            className: "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]",
        },
        FAILED: {
            text: "Dataset processing failed. Review the error below or retry processing.",
            className: "border-[#FCA5A5] bg-[#FEF2F2] text-[#B42318]",
        },
    };

    const currentStatusMessage = statusMessage[status];

    return (
        <div className="fixed inset-x-0 bottom-0 top-[49px] z-50 flex items-center justify-center px-[20px] py-[32px]">
            <button
                type="button"
                className="absolute inset-0 bg-[#34405499] backdrop-blur-sm"
                onClick={onClose}
                aria-label="Close dataset preview"
            />

            <div className="relative flex max-h-[calc(100vh-113px)] w-full max-w-[1100px] flex-col overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white shadow-xl">
                <div className="border-b border-[#E5E5E5] px-[20px] py-[16px]">
                    <div className="flex items-start justify-between gap-[20px]">
                        <h3 className="shrink-0 text-[18px] font-semibold text-gray-800">
                            Dataset Preview
                        </h3>
                        <div className="min-w-0 text-right">
                            <p className="truncate text-sm font-medium text-gray-800">
                                {data.filename}
                            </p>
                            <p className="text-xs text-gray-500">
                                Previewing {data.preview_data.length} of{" "}
                                {Number(data.num_of_rows || 0).toLocaleString()} records.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-[20px]">
                    <div className="mb-[16px] flex flex-col gap-[8px] rounded-[8px] border border-[#E5E5E5] bg-[#F8FAFC] px-[12px] py-[10px] text-sm sm:flex-row sm:items-center">
                        <span className="text-gray-500">Status:</span>
                        <DatasetStatusBadge status={data.dataset_status} />
                        {currentStatusMessage && (
                            <span className="text-gray-500">
                                {currentStatusMessage.text}
                            </span>
                        )}
                    </div>

                    {status === "FAILED" && data.processing_error && (
                        <div className="mb-[16px] rounded-[8px] border border-[#FCA5A5] bg-[#FEF2F2] px-[12px] py-[10px] text-sm text-[#B42318]">
                            {data.processing_error}
                        </div>
                    )}

                    {columns.length > 0 && data.preview_data.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[#E5E5E5] text-left text-gray-500">
                                        {columns.map((column) => (
                                            <th
                                                key={column}
                                                className="py-[12px] px-[10px] font-medium capitalize"
                                            >
                                                {formatDatasetHeader(column)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.preview_data.map((row, index) => (
                                        <tr
                                            key={index}
                                            className="border-b border-[#F0F0F0]"
                                        >
                                            {columns.map((column) => (
                                                <td
                                                    key={column}
                                                    className="max-w-[220px] truncate py-[14px] px-[10px] text-gray-600"
                                                >
                                                    {row?.[column] ?? ""}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="rounded-[8px] border border-[#E5E5E5] bg-white px-[14px] py-[18px] text-sm text-gray-500">
                            No preview data available.
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap justify-end gap-[10px] border-t border-[#E5E5E5] px-[20px] py-[16px]">
                    <button
                        type="button"
                        className="prod-btn-base prod-btn-secondary"
                        onClick={onClose}
                    >
                        Close
                    </button>
                    <button
                        type="button"
                        className="prod-btn-base prod-btn-secondary"
                        onClick={onDownload}
                    >
                        Download
                    </button>
                    {canProcess && (
                        <button
                            type="button"
                            className={MODAL_PRIMARY_BUTTON_CLASSES}
                            onClick={onProcess}
                            disabled={isProcessLoading}
                        >
                            {isProcessLoading ? "Processing..." : processLabel}
                        </button>
                    )}
                    <button
                        type="button"
                        className={MODAL_DESTRUCTIVE_BUTTON_CLASSES}
                        onClick={onDelete}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

const DeleteDatasetModal = ({
    filename,
    error,
    isLoading,
    onCancel,
    onConfirm,
}) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-[20px] py-[24px]">
            <button
                type="button"
                className="absolute inset-0 bg-[#32205499] backdrop-blur-sm"
                onClick={onCancel}
                aria-label="Close delete dataset confirmation"
                disabled={isLoading}
            />

            <div className="relative w-full max-w-[480px] overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white shadow-xl">
                <div className="border-b border-[#E5E5E5] px-[20px] py-[16px]">
                    <h3 className="text-[18px] font-semibold text-gray-800">
                        Delete Dataset
                    </h3>
                    <p className="mt-[4px] text-sm text-gray-500">
                        This action cannot be undone.
                    </p>
                </div>

                <div className="p-[20px] text-sm text-gray-600">
                    <p>
                        Are you sure you want to delete{" "}
                        <span className="font-medium text-gray-800">
                            {filename}
                        </span>
                        ?
                    </p>

                    {error && (
                        <p className="mt-[12px] text-sm text-destructive-600">
                            {error}
                        </p>
                    )}
                </div>

                <div className="flex justify-end gap-[10px] border-t border-[#E5E5E5] px-[20px] py-[16px]">
                    <button
                        type="button"
                        className="prod-btn-base prod-btn-secondary"
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={MODAL_DESTRUCTIVE_BUTTON_CLASSES}
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading ? "Deleting..." : "Delete"}
                    </button>
                </div>
            </div>
        </div>
    );
};

const UploadDatasetModal = ({ data, error, isLoading, onCancel, onConfirm }) => {
    const columns = data.headers;
    const hasMissingHeaders = data.missingHeaders?.length > 0;

    return (
        <div className="fixed inset-x-0 bottom-0 top-[49px] z-50 flex items-center justify-center px-[20px] py-[32px]">
            <button
                type="button"
                className="absolute inset-0 bg-[#34405499] backdrop-blur-sm"
                onClick={onCancel}
                aria-label="Close upload dataset preview"
                disabled={isLoading}
            />

            <div className="relative flex max-h-[calc(100vh-113px)] w-full max-w-[1100px] flex-col overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white shadow-xl">
                <div className="border-b border-[#E5E5E5] px-[20px] py-[16px]">
                    <div className="flex items-start justify-between gap-[20px]">
                        <h3 className="shrink-0 text-[18px] font-semibold text-gray-800">
                            Upload Dataset
                        </h3>
                        <div className="min-w-0 text-right">
                            <p className="truncate text-sm font-medium text-gray-800">
                                {data.filename}
                            </p>
                            <p className="text-xs text-gray-500">
                                Previewing {data.data.length} of{" "}
                                {Number(data.rows || 0).toLocaleString()} records.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-[20px]">
                    <div className="mb-[8px] rounded-[8px] border border-[#E5E5E5] bg-[#F8F9FA] px-[12px] py-[10px] text-sm text-gray-600">
                        Required columns:{" "}
                        <span className="font-medium text-gray-800">
                            {RAW_DATASET_REQUIRED_HEADERS.map(formatDatasetHeader).join(", ")}
                        </span>
                        <p className="mt-2">
                            Enter dates as year-month-day, for example 2026-10-31.
                            Time is optional. If included, use 2026-10-31 09:30
                        </p>
                    </div>

                    {error && (
                        <div role="alert" className="mb-[16px] rounded-[8px] border border-[#FCA5A5] bg-[#FEF2F2] px-[12px] py-[10px] text-sm text-[#B42318]">
                            {error}
                        </div>
                    )}

                    {hasMissingHeaders && (
                        <div className="mb-[16px] rounded-[8px] border border-[#FCA5A5] bg-[#FEF2F2] px-[12px] py-[10px] text-sm text-[#B42318]">
                            Missing required columns: {data.missingHeaders.map(formatDatasetHeader).join(", ")}
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[#E5E5E5] text-left text-gray-500">
                                    {columns.map ((column) => (
                                        <th 
                                            key={column}
                                            className="py-[12px] px-[10px] font-medium"
                                        >
                                            {formatDatasetHeader(column)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.data.map((row, index) => (
                                    <tr
                                        key={index}
                                        className="border-b border-[#F0F0F0]"
                                    >   
                                        {columns.map((column) => (
                                            <td
                                                key={column}
                                                className="max-w-[220px] truncate py-[14px] px-[10px] text-gray-600"
                                            >
                                                {row?.[column] ?? ""}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-end gap-[10px] border-t border-[#E5E5E5] px-[20px] py-[16px]">
                    <button 
                        className="prod-btn-base prod-btn-secondary"
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        className={MODAL_PRIMARY_BUTTON_CLASSES}
                        onClick={onConfirm}
                        disabled={isLoading || hasMissingHeaders || Boolean(data.rowError) || data.rows === 0}
                    >
                        {isLoading ? "Uploading..." : "Upload"}
                    </button>
                </div>
            </div>
        </div>
    );
};



/* SUBTAB 3 = TRAINING LOGS */
const TrainingLogs = () => {
    const user = useSelector((state) => state.auth.user);

    const {
        data: datasetsByUser,
        isFetching: isTrainingLogsFetching,
        isError: isTrainingLogsError,
        refetch: refetchTrainingLogs,
    } = useFetchDatasetsByUserQuery(user.id);

    const datasets = datasetsByUser || [];

    const getTrainingStatus = (status) => {
        const normalizedStatus = String(status || "").toUpperCase();

        if (normalizedStatus === "PROCESSED") return "Completed";
        if (normalizedStatus === "PROCESSING") return "Running";
        if (normalizedStatus === "FAILED") return "Failed";
        if (normalizedStatus === "QUEUED") return "Queued";
        if (normalizedStatus === "UPLOADED") return "Uploaded";

        return "Queued";
    };

    const getDuration = ({ created_at, processed_at, dataset_status }) => {
        const normalizedStatus = String(dataset_status || "").toUpperCase();

        if (normalizedStatus === "PROCESSING") return "In progress";
        if (["UPLOADED", "QUEUED"].includes(normalizedStatus)) return "Pending";
        if (!created_at || !processed_at) return "Unavailable";

        const started = new Date(created_at);
        const ended = new Date(processed_at);
        if (Number.isNaN(started.getTime()) || Number.isNaN(ended.getTime())) return "Unavailable";
        const diffInMinutes = Math.max(1, Math.round((ended - started) / 60000));

        if (diffInMinutes >= 60) {
            const hours = Math.floor(diffInMinutes / 60);
            const minutes = diffInMinutes % 60;

            return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
        }

        return `${diffInMinutes}m`;
    };

    const trainingLogs = datasets.map((dataset) => ({
        runId: `TRN-${String(dataset.id).slice(-6).toUpperCase()}`,
        model: "HealthPH+ NLP Pipeline",
        dataset: dataset.original_filename || dataset.filename,
        status: getTrainingStatus(dataset.dataset_status),
        started: dataset.created_at
            ? format(new Date(dataset.created_at), "MMM dd, yyyy hh:mm a")
            : "Pending",
        duration: getDuration(dataset),
    }));

    return (
        <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-[12px] mb-[20px]">
                <div>
                    <h2 className="text-[20px] font-semibold text-gray-800">
                        Training Logs
                    </h2>
                    <p className="text-sm text-gray-500 mt-[4px]">
                        Track model training activity, evaluation runs, and dataset processing history.
                    </p>
                </div>
                <ToolbarButton iconName="Upload" variant="primary">
                    Export Logs
                </ToolbarButton>
            </div>

            {isTrainingLogsFetching ? (
                <div className="overflow-y-hidden min-w-full h-[300px]">
                    <SkeletonBody headers={["Run ID", "Model", "Dataset", "Status", "Started", "Duration", "Actions"]} />
                </div>
            ) : isTrainingLogsError ? (
                <EmptyState iconName="Error" heading="Unable to Load Training Logs" content="Please try loading the logs again.">
                    <button type="button" onClick={() => refetchTrainingLogs()} className="prod-btn-base prod-btn-secondary">Retry</button>
                </EmptyState>
            ) : (
                <div className="overflow-x-auto">
                    {trainingLogs.length > 0 ? (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[#E5E5E5] text-left text-gray-500">
                                    <th className="py-[12px] px-[10px] font-medium">Run ID</th>
                                    <th className="py-[12px] px-[10px] font-medium">Model</th>
                                    <th className="py-[12px] px-[10px] font-medium">Dataset</th>
                                    <th className="py-[12px] px-[10px] font-medium">Status</th>
                                    <th className="py-[12px] px-[10px] font-medium">Started</th>
                                    <th className="py-[12px] px-[10px] font-medium">Duration</th>
                                    <th className="py-[12px] px-[10px] font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trainingLogs.map((log) => (
                                    <TrainingLogRow
                                        key={log.runId}
                                        runId={log.runId}
                                        model={log.model}
                                        dataset={log.dataset}
                                        status={log.status}
                                        started={log.started}
                                        duration={log.duration}
                                    />
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <EmptyState
                            iconName={Document}
                            heading="No training Logs"
                            content="Upload and process a dataset to create pipeline activity history."
                        />
                    )}
                </div>
            )}
        </div>
    );
};

/* HELPERS */
const ModelCard = ({ 
    name,
    description,
    score,
    hammingLoss,
    precision,
    recall,
    tag,
    languages = [],
    lastUpdated,
    modelVersion,
    evaluationSplit,
    sampleCount,
}) => {
    return (
        <div className="bg-white rounded-[12px] border border-[#E5E5E5] overflow-hidden">
            <div className="p-[20px]">
                <div className="flex justify-between items-start gap-[12px] mb-[12px]">
                    <div>
                        <h3 className="text-[18px] font-semibold text-gray-800">
                            {name}
                        </h3>
                        <p className="text-sm text-gray-500">
                            {description}
                        </p>
                    </div>
                    <span className="border border-[#E5E5E5] rounded-full px-[10px] py-[4px] text-xs font-medium whitespace-nowrap">
                        {tag}
                    </span>
                </div>

                <div className="mb-[10px]">
                    <div className="flex justify-between text-sm mb-[6px]">
                        <span className="text-gray-500">Macro F1</span>
                        <span className="font-semibold text-gray-800">{score}</span>
                    </div>
                    <div className="h-[10px] bg-gray-100 rounded-full overflow-hidden">
                        {Number.isFinite(parseFloat(score)) && (
                            <div
                                className="h-full bg-[#32418C] rounded-full"
                                style={{
                                    width: `${Math.min(100, Math.max(0, parseFloat(score)))}%`,
                                }}
                            />
                        )}
                    </div>
                </div>

                <div className="mb-[10px]">
                    <div className="flex justify-between text-sm mb-[6px]">
                        <span className="text-gray-500">Hamming Loss</span>
                        <span className="font-semibold text-gray-800">{hammingLoss}</span>
                    </div>
                    <div className="h-[8px] bg-gray-100 rounded-full overflow-hidden">
                        {Number.isFinite(parseFloat(hammingLoss)) && (
                            <div
                                className="h-full bg-[#20C997] rounded-full"
                                style={{
                                    width: `${Math.min(
                                        100,
                                        Math.max(0, parseFloat(hammingLoss) * 100)
                                    )}`,
                                }}
                            />
                        )}
                    </div> 
                </div>

                <div className="grid grid-cols-2 gap-[16px] mb-[14px]">
                    <div>
                        <p className="text-sm font-medium text-gray-800">Precision</p>
                        <p className="text-[20px] font-semibold text-gray-900">
                            {precision}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm font-medium text-gray-800">Recall</p>
                        <p className="text-[20px] font-semibold text-gray-900">
                            {recall}
                        </p>
                    </div>
                </div>

                <div className="mb-[12px] space-y-[4px] break-words text-xs text-gray-500">
                    <p>Checkpoint: {modelVersion || "Unavailable"}</p>
                    <p>Evaluation split: {evaluationSplit || "Unavailable"} · Samples: {Number.isInteger(sampleCount) ? sampleCount.toLocaleString() : "Unavailable"}</p>
                    <p>Hamming loss: lower values indicate fewer label errors.</p>
                </div>
                <div className="flex flex-wrap gap-[6px]">
                    {languages.map((language) => (
                        <span
                            key={language}
                            className="rounded-full bg-[#EFF6FF] px-[10px] py-[3px] text-xs text-[#1D4ED8]"
                        >
                            {language}
                        </span>
                    ))}
                </div>
            </div>

            <div className="border-t border-[#E5E5E5] px-[20px] py-[14px] flex items-center justify-between">
                <p className="text-sm text-gray-500">
                    Evaluated: {lastUpdated}
                </p>

                <div className="flex gap-[8px]">
                    <button
                        title="Unavailable"
                        className="border border-[#E5E5E5] rounded-[8px] px-[12px] py-[8px] text-sm" 
                        disabled
                    >
                        Details
                    </button>

                    <button
                        title="Unavailable"
                        className="bg-[#32418C] text-white rounded-[8px] px-[12px] py-[8px] text-sm"
                        disabled
                    >
                        Compare
                    </button>
                </div>
            </div>
        </div>
    );
};

const TrainingLogRow = ({
    runId,
    model,
    dataset,
    status,
    started,
    duration,
}) => {
    const statusColor = {
        Completed: {
            backgroundColor: "#D1FAE5",
            color: "#059669",
        },
        Running: {
            backgroundColor: "#DBEAFE",
            color: "#2563EB",
        },
        Failed: {
            backgroundColor: "#FEE2E2",
            color: "#DC2626",
        },
        Queued: {
            backgroundColor: "#F3F4F6",
            color: "#6B7280",
        },
        Uploaded: {
            backgroundColor: "#DBEAFE",
            color: "#2563EB"
        }
    };

    return (
        <tr className="border-b border-[#F0F0F0]">
            <td className="py-[14px] px-[10px] font-medium text-gray-800">
                {runId}
            </td>
            <td className="py-[14px] px-[10px] text-gray-600">
                {model}
            </td>
            <td className="py-[14px] px-[10px] text-gray-600">
                {dataset}
            </td>
            <td className="py-[14px] px-[10px]">
                <span
                    className="px-[8px] py-[4px] rounded-full text-xs font-medium"
                    style={statusColor[status]}
                >
                    {status}
                </span>
            </td>
            <td className="py-[14px] px-[10px] text-gray-600">
                {started}
            </td>
            <td className="py-[14px] px-[10px] text-gray-600">
                {duration}
            </td>
            <td className="py-[14px] px-[10px]">
                <div className="flex gap-[10px]">
                    <button className="text-primary-600 text-sm">
                        View
                    </button>
                    <button className="text-gray-600 text-sm">
                        Export
                    </button>
                </div>
            </td>
        </tr>
    );
};

export default ModelAccessToolkit;
