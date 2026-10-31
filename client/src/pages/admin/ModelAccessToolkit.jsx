import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import { useReactToPrint } from "react-to-print";

import CSVReader from "react-csv-reader";

import EmptyState from "../../components/admin/EmptyState";
import SkeletonBody from "../../components/SkeletonBody";
import LoadingSkeleton from "../../components/LoadingSkeleton";
import Regions from "../../assets/data/regions.json";
import DataManagementPrint from "../../components/admin/DataManagementPrint";
import { loadSelfReportsForPrint } from "../../utils/selfReportPrintHelpers";
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
const ModelComparison = () => {
    return (
        <div className="flex flex-col gap-[10px]">
            {/* FILTERS */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[10px]">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-[16px]">
                    <div className="flex flex-wrap gap-[12px]">
                        <select className="border border-[#E5E5E5] rounded-[10px] px-[14px] py-[10px] text-sm">
                            <option value="">All Models</option>
                        </select>
                        <select className="border border-[#E5E5E5] rounded-[10px] px-[14px] py-[10px] text-sm">
                            <option value="">F1 Score</option>
                        </select>
                    </div>
                    <ToolbarSearch placeholder="Search models by name or description..." />
                </div>
            </div>

            {/* PERFORMANCE CHART */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
                <h2 className="text-[18px] font-semibold text-gray-800">
                    Model Performance Comparison
                </h2>
                <p className="text-sm text-gray-500 mb-[12px]">
                    Comparative analysis of model metrics across different tasks and languages.
                </p>

                <ResponsiveContainer width="100%" height={360}>
                    <BarChart
                        data={[
                            { model: "mBERT", f1: 87, precision: 91, recall: 89, accuracy: 92 },
                            { model: "XLM-RoBERTa", f1: 92, precision: 93, recall: 91, accuracy: 95 },
                            { model: "GPT-based", f1: 94, precision: 95, recall: 92, accuracy: 96 },
                            { model: "LSTM", f1: 84, precision: 88, recall: 82, accuracy: 90 },
                            { model: "XGBoost", f1: 89, precision: 91, recall: 87, accuracy: 93 },
                        ]}
                        margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="model" />
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
                        <Bar dataKey="f1" name="F1 Score" fill="#32418C" />
                        <Bar dataKey="precision" name="Precision" fill="#2572A5" />
                        <Bar dataKey="recall" name="Recall" fill="#9BCC33" />
                        <Bar dataKey="accuracy" name="Accuracy" fill="#FBD117" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* MODEL CARDS */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-[10px]">
                <ModelCard
                    name="mBERT"
                    description="Pretrained multilingual BERT model fine-tuned for disease entity recognition."
                    score="87%"
                    hammingLoss="0.15"
                    precision="85%"
                    recall="89%"
                    tag="Multilingual BERT"
                    languages={["English", "Filipino", "Cebuano", "Ilocano", "Hiligaynon"]}
                    lastUpdated="3/15/2026"
                />
                <ModelCard
                    name="XLM-RoBERTa"
                    description="XLM-RoBERTa model adapted for health terminology extraction and classification."
                    score="92%"
                    hammingLoss="0.09"
                    precision="93%"
                    recall="91%"
                    tag="Cross-lingual RoBERTa"
                    languages={["English", "Filipino", "Cebuano", "Ilocano", "Hiligaynon"]}
                    lastUpdated="4/2/2026"
                />
                <ModelCard
                    name="GPT-based"
                    description="Local fine-tuned GPT model for healthcare content analysis and summarization."
                    score="94%"
                    hammingLoss="0.07"
                    precision="95%"
                    recall="93%"
                    tag="Transformer LLM"
                    languages={["English", "Filipino"]}
                    lastUpdated="4/14/2026"
                />
                <ModelCard
                    name="LSTM Model"
                    description="LSTM-based model for time-series disease trend forecasting."
                    score="82%"
                    hammingLoss="0.22"
                    precision="84%"
                    recall="80%"
                    tag="Recurrent Neural Network"
                    languages={["English"]}
                    lastUpdated="4/27/2026"
                />
                <ModelCard
                    name="XGBoost"
                    description="XGBoost ensemble model for regional outbreak prediction."
                    score="85%"
                    hammingLoss="0.18"
                    precision="86%"
                    recall="84%"
                    tag="Gradient Boosting"
                    languages={["All"]}
                    lastUpdated="4/29/2026"
                />
            </div>

            {/* MULTILINGUAL PERFORMANCE */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-[12px]">
                    <div>
                        <h2 className="text-[18px] font-semibold text-gray-800">
                            Multilingual Performance
                        </h2>
                        <p className="text-sm text-gray-500 mb-[12px]">
                            Model accuracy across different Philippine languages. 
                        </p>
                    </div>
                    <ToolbarButton iconName="Upload" variant="primary">
                        Export
                    </ToolbarButton>
                </div>

                <ResponsiveContainer width="100%" height={320}>
                    <BarChart
                        data={[
                            { language: "English", mbert: 87, xlm: 93, gpt: 95 },
                            { language: "Filipino", mbert: 85, xlm: 91, gpt: 92 },
                            { language: "Cebuano", mbert: 82, xlm: 88, gpt: 0 },
                            { language: "Ilocano", mbert: 80, xlm: 86, gpt: 0 },
                            { language: "Hiligaynon", mbert: 79, xlm: 85, gpt: 0 },
                        ]}
                        margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="language" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend
                            verticalAlign="bottom"
                            align="center"
                            iconType="square"
                            wrapperStyle={{
                                paddingTop: "20px",
                                lineHeight: "28px"
                            }}
                        />

                        <Bar dataKey="mbert" name="mBERT" fill="#32418C" />
                        <Bar dataKey="xlm" name="XLM-R" fill="#20C997" />
                        <Bar dataKey="gpt" name="GPT" fill="#FBD117" />
                    </BarChart>
                </ResponsiveContainer>
                <p className="text-sm text-gray-500 mt-[12px]">
                    Based on evaluation with standardized test sets.
                </p>
            </div>

            {/* TASK PERFORMANCE RADAR */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
                <div>
                    <h2 className="text-[18px] font-semibold text-gray-800">
                        Task Performance Radar
                    </h2>
                    <p className="text-sm text-gray-500">
                        Model capabilities across different NLP tasks.
                    </p>
                </div>

                <ResponsiveContainer width="100%" height={360}>
                    <RadarChart
                        cx="50%"
                        cy="50%"
                        outerRadius="70%"
                        data={[
                            { task: "NER", mbert: 87, xlm: 92, gpt: 94 },
                            { task: "Sentiment", mbert: 82, xlm: 88, gpt: 91 },
                            { task: "Classification", mbert: 84, xlm: 89, gpt: 93 },
                            { task: "QA", mbert: 78, xlm: 84, gpt: 92 },
                            { task: "Summarization", mbert: 72, xlm: 80, gpt: 95 },
                        ]}
                    >
                        <PolarGrid />
                        <PolarAngleAxis dataKey="task" />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar
                            name="mBERT"
                            dataKey="mbert"
                            stroke="#32418C"
                            fill="#32418C"
                            fillOpacity={0.25}
                        />
                        <Radar
                            name="XLM-R"
                            dataKey="xlm"
                            stroke="#20C997"
                            fill="#20C997"
                            fillOpacity={0.25}
                        />
                        <Radar
                            name="GPT"
                            dataKey="gpt"
                            stroke="#FBD117"
                            fill="#FBD117"
                            fillOpacity={0.25}
                        />
                        <Legend
                            verticalAlign="bottom"
                            align="center"
                            wrapperStyle={{
                                paddingTop: "20px"
                            }}
                        />
                        <Tooltip />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
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

        setSelectedFile(originalFile);
        setUploadPreviewData({
            filename: fileInfo.name,
            fileSize: originalFile?.size || 0,
            rows: validRows.length,
            headers,
            data: validRows.slice(0, 10),
            missingHeaders,
        });
        setUploadError("");
        setUploadModalActive(true);
    };

    const handleUploadDataset = async () => {
        if (!selectedFile) {
            setUploadError("No CSV file selected.");
            return;
        }

        if (uploadPreviewData.missingHeaders.length > 0) {
            setUploadError(
                `Missing required columns: ${uploadPreviewData.missingHeaders.join(", ")}`
            );
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
        const sampleRows = [
            {
                id: "0001",
                text: "Sample post text about lung-related diseases.",
                location: "Manila",
                date_posted: "2026-01-15",
                source: "Facebook",
                date_collected: "2026-01-16",
            },  
        ];

        const headers = RAW_DATASET_REQUIRED_HEADERS;
        const csvRows = [
            headers.join(","),
            ...sampleRows.map((row) =>
                headers
                    .map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`)
                    .join(",")
            ),
        ];

        const blob = new Blob([csvRows.join("\n")], {
            type: "text/csv;charset=utf-8;",
        });

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "healthph-plus-raw-dataset-template.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();

        window.URL.revokeObjectURL(url);
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

            <div className="mb-[20px] flex flex-col gap-[14px]">
                <div className="flex flex-col gap-[12px] md:flex-row md:items-start md:justify-between">
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
                                parserOptions={{ header: true }}
                                onFileLoaded={onFileSelect}
                                ref={inputFile}
                                cssInputClass="hidden"
                            />
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-end justify-between gap-x-[20px] gap-y-[14px]">
                    <div className="flex w-full flex-col gap-[6px] sm:w-[280px] sm:shrink-0">
                        <p className="flex h-[30px] items-center gap-[4px] text-sm text-gray-500">
                            {activeDataSourceDetails.totalLabel}:{" "}
                            <span className="font-semibold text-gray-800">
                                {(dataSourceView === "social_media" ? isDatasetsByUserLoading : isAnalyticsEntriesLoading)
                                    ? <LoadingSkeleton className="h-[14px] w-[48px]" />
                                    : (dataSourceView === "social_media" ? isDatasetsByUserError : isAnalyticsEntriesError)
                                        ? "Unavailable"
                                        : Number(activeDataSourceTotal || 0).toLocaleString()}
                            </span>
                        </p>
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
                                                                <span
                                                                    key={language}
                                                                    className="rounded-full border border-[#E5E5E5] bg-white px-[8px] py-[3px] text-xs font-medium text-gray-600"
                                                                >
                                                                    {language}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
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
                                                <td className="py-[14px] px-[10px] text-gray-600">
                                                    {entry.language || "Unavailable"}
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
                                                {column}
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
                            {RAW_DATASET_REQUIRED_HEADERS.join(", ")}
                        </span>
                    </div>

                    {hasMissingHeaders && (
                        <div className="mb-[16px] rounded-[8px] border border-[#FCA5A5] bg-[#FEF2F2] px-[12px] py-[10px] text-sm text-[#B42318]">
                            Missing required columns: {data.missingHeaders.join(", ")}
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
                                            {column}
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
                        disabled={isLoading}
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
                        <span className="text-gray-500">F1 Score</span>
                        <span className="font-semibold text-gray-800">{score}</span>
                    </div>
                    <div className="h-[10px] bg-gray-100 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-[#32418C] rounded-full" 
                            style={{ width: score }}
                        />
                    </div>
                </div>

                <div className="mb-[10px]">
                    <div className="flex justify-between text-sm mb-[6px]">
                        <span className="text-gray-500">Hamming Loss</span>
                        <span className="font-semibold text-gray-800">{score}</span>
                    </div>
                    <div className="h-[8px] bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-[#32418C] rounded-full"
                            style={{
                                width: `${Math.max(10, 100 - Number(hammingLoss) * 100)}%`,
                            }}
                        />
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

                <div className="flex flex-wrap gap-[6px]">
                    {languages.map((language) => (
                        <span
                            key={language}
                            className="bg-primary-50 text-primary-700 rounded-full px-[10px] py-[3px] text-xs"
                        >
                            {language}
                        </span>
                    ))}
                </div>
            </div>

            <div className="border-t border-[#E5E5E5] px-[20px] py-[14px] flex items-center justify-between">
                <p className="text-sm text-gray-500">
                    Last updated: {lastUpdated}
                </p>

                <div className="flex gap-[8px]">
                    <button className="border border-[#E5E5E5] rounded-[8px] px-[12px] py-[8px] text-sm">
                        Details
                    </button>

                    <button className="bg-[#32418C] text-white rounded-[8px] px-[12px] py-[8px] text-sm">
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
