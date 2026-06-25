import { useRef, useState } from "react";
import { useSelector } from "react-redux";
import { format } from "date-fns";

import CSVReader from "react-csv-reader";

import EmptyState from "../../components/admin/EmptyState";
import SkeletonBody from "../../components/SkeletonBody";

import {
    useFetchDatasetsByUserQuery,
    useDownloadDatasetMutation,
    useDeleteDatasetMutation,
    useUploadFileMutation,
    useProcessDatasetMutation,
} from "../../features/api/datasetsSlice";

import { useCreateActivityLogMutation } from "../../features/api/activityLogsSlice";

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

const ModelAccessToolkit = () => {
    const [activeTab, setActiveTab] = useState("comparison");

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
    "language",
    "text",
    "location",
    "date_posted",
    "source",
    "date_collected",
];

const normalizeCsvHeader = (header) =>
    String(header || "").trim().toLowerCase().replace(/\s+/g, "_");    

/* SUBTAB 2 = DATA MANAGEMENT */
const DataManagement = () => {
    const user = useSelector((state) => state.auth.user);

    /* API HOOKS */
    const [downloadDataset] = useDownloadDatasetMutation();
    const [processDataset, { isLoading: isProcessLoading }] = useProcessDatasetMutation();
    const [deleteDataset, { isLoading: isDeleteLoading }] = useDeleteDatasetMutation();

    const [createActivityLog] = useCreateActivityLogMutation();

    const {
        data: datasetsByUser,
        isFetching: isDatasetsByUserFetching,
    } = useFetchDatasetsByUserQuery(user.id);

    const datasets = datasetsByUser || [];

    const [datasetSearch, setDatasetSearch] = useState("");
    const [datasetStatusFilter, setDatasetStatusFilter] = useState("all");

    /* UPLOAD MODAL STATE */
    const inputFile = useRef(null);
    const [uploadFile, { isLoading: isUploadLoading }] = useUploadFileMutation();

    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadModalActive, setUploadModalActive] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const [uploadPreviewData, setUploadPreviewData] = useState({
        filename: "",
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
        filename: "",
        num_of_rows: 0,
        dataset_status: "",
        processing_error: "",
        processed_at: "",
        preview_headers: [],
        preview_data: [],
    });

    /* UPLOAD HANDLER */
    const resetUploadState = () => {
        setSelectedFile(null);
        setUploadModalActive(false);
        setUploadError("");
        setUploadPreviewData({
            filename: "",
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

        const normalizedHeaders = headers.map(normalizeCsvHeader);

        const missingHeaders = RAW_DATASET_REQUIRED_HEADERS.filter(
            (requiredHeader) => !normalizedHeaders.includes(requiredHeader)
        );

        setSelectedFile(originalFile);
        setUploadPreviewData({
            filename: fileInfo.name,
            rows: data.length,
            headers,
            data: data.slice(0, 3),
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
            payload.append("file", selectedFile);

            await uploadFile(payload).unwrap();

            await createActivityLog({
                user_id: user.id,
                entry:  `Uploaded dataset: ${uploadPreviewData.filename}`,
                module: "Model Access and Toolkit",
            }).unwrap();

            resetUploadState();
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
                language: "english",
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

            await createActivityLog({
                user_id: user.id,
                entry: `started dataset processing: ${filename}`,
                module: "Model Access and Toolkit",
            }).unwrap();
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

        return matchesSearch && matchesStatus;
    });

    const datasetSummaryCards = [
        {
            label: "Total Datasets",
            value: datasets.length,
        },
        {
            label: "Uploaded / Raw",
            value: datasets.filter((dataset) =>
                ["UPLOADED", "RAW"].includes(getDatasetStatus(dataset))
            ).length,
        },
        {
            label: "Annotated",
            value: datasets.filter((dataset) => getDatasetStatus(dataset) === "ANNOTATED").length,
        },
        {
            label: "Total Rows",
            value: datasets
                .reduce((sum, dataset) => sum + Number(dataset.num_of_rows || 0), 0)
                .toLocaleString(),
        },
        {
            label: "Storage Used",
            value: displayFileSize(
                datasets.reduce((sum, dataset) => sum + Number(dataset.file_size || 0), 0)
            ),
        },
    ];

    const normalizePreviewHeaders = (headers) => {
        if (Array.isArray(headers)) return headers;
        if (typeof headers === "string") return headers.split("+").filter(Boolean);
        return [];
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
            filename: dataset.original_filename || dataset.filename || "Dataset",
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
        try {
            await deleteDataset(deleteModalData.id).unwrap();

            await createActivityLog({
                user_id: user.id,
                entry: `Deleted dataset: ${deleteModalData.filename}`,
                module: "Model Access and Toolkit",
            }).unwrap();

            closeDeleteModal();
        } catch (error) {
            setDeleteError("Failed to delete dataset. Please try again.");
            console.error("Failed to delete dataset", error);
        }
    };

    return (
        <>
        <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
            <div className="flex justify-between items-start mb-[20px]">
                <div>
                    <h2 className="text-[20px] font-semibold text-gray-800">
                        Data Upload and Augmentation Tools
                    </h2>
                    <p className="text-sm text-gray-500 mt-[4px]">
                        Datasets available for model training, validation, and evaluation.
                    </p>
                </div>
                <div className="flex flex-wrap justify-end gap-[10px]">
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
            </div>

            {/* SEARCH AND SUMMARY CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-[10px] mb-[18px]">
                {datasetSummaryCards.map(({ label, value }) => (
                    <div
                        key={label}
                        className="rounded-[8px] border border-[#E5E5E5] bg-white px-[14px] py-[12px]"
                    >
                        <p className="text-xs font-medium text-gray-500">{label}</p>
                        <p className="mt-[6px] text-[18px] font-semibold text-gray-800">{value}</p>
                    </div>
                ))}
            </div>

            <div className="mb-[16px] flex flex-col gap-[10px] md:flex-row md:items-center md:justify-between">
                <ToolbarSearch
                    placeholder="Search datasets..."
                    value={datasetSearch}
                    onChange={(event) => setDatasetSearch(event.target.value)}
                />

                <ToolbarSelect
                    value={datasetStatusFilter}
                    onChange={(event) => setDatasetStatusFilter(event.target.value)}
                    className="w-full md:w-[180px]"
                >
                    <option value="all">All Status</option>
                    <option value="UPLOADED">Uploaded</option>
                    <option value="RAW">Raw</option>
                    <option value="QUEUED">Queued</option>
                    <option value="PROCESSING">Processing</option>
                    <option value="ANNOTATED">Annotated</option>
                    <option value="FAILED">Failed</option>
                </ToolbarSelect>
            </div>

            {isDatasetsByUserFetching ? (
                <div className="overflow-y-hidden min-w-full h-[500px]">
                    <SkeletonBody columns={5} />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    {filteredDatasets.length > 0 ? (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[#E5E5E5] text-left text-gray-500">
                                    <th className="py-[12px] px-[10px] font-medium">File Name</th>
                                    <th className="py-[12px] px-[10px] font-medium">File Size</th>
                                    <th className="py-[12px] px-[10px] font-medium">Status</th>
                                    <th className="py-[12px] px-[10px] font-medium">Uploaded By</th>
                                    <th className="py-[12px] px-[10px] font-medium">Date Uploaded</th>
                                    <th className="py-[12px] px-[10px] font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDatasets.map(({
                                    id,
                                    user_name,
                                    filename,
                                    file_size,
                                    dataset_status,
                                    created_at,
                                    original_filename,
                                    dataset_type,
                                    num_of_rows,
                                    processing_error,
                                    processed_at,
                                    preview_headers,
                                    preview_data,
                                }) => (
                                    <tr className="border-b border-[#F0F0F0]" key={id}>
                                        <td className="max-w-[260px] truncate py-[14px] px-[10px] font-medium text-gray-800">
                                            {filename}
                                        </td>
                                        <td className="py-[14px] px-[10px] text-gray-600">
                                            {displayFileSize(file_size)}
                                        </td>
                                        <td className="py-[14px] px-[10px]">
                                            <DatasetStatusBadge status={dataset_status} />
                                        </td>
                                        <td className="py-[14px] px-[10px] text-gray-600">
                                            {user_name}
                                        </td>
                                        <td className="py-[14px] px-[10px] text-gray-600">
                                            {format(new Date(created_at), "MMM dd, yyyy hh:mm a")}
                                        </td>
                                        <td className="py-[14px] px-[10px]">
                                            <div className="flex gap-[10px]">
                                                <button
                                                    className="text-primary-600 text-sm"
                                                    onClick={() =>
                                                        openPreviewModal({
                                                            original_filename,
                                                            filename,
                                                            dataset_type,
                                                            dataset_status,
                                                            num_of_rows,
                                                            processing_error,
                                                            processed_at,
                                                            preview_headers,
                                                            preview_data,
                                                        })
                                                    }
                                                >
                                                    Preview
                                                </button>
                                                <button
                                                    className="text-gray-600 text-sm"
                                                    onClick={() => handleDownloadDataset({ id, filename })}
                                                >
                                                    Download
                                                </button>
                                                {["UPLOADED", "FAILED"].includes(String(dataset_status || "").toUpperCase()) &&
                                                    String(dataset_type || "").toUpperCase() === "RAW" && (
                                                        <button
                                                            className="text-[#4F46E5] text-sm disabled:text-gray-400"
                                                            onClick={() => handleProcessDataset({ id, filename })}
                                                            disabled={isProcessLoading}
                                                        >
                                                            {String(dataset_status).toUpperCase() === "FAILED" ? "Retry" : "Process"}
                                                        </button>
                                                    )
                                                }
                                                <button 
                                                    className="text-destructive-600 text-sm"
                                                    onClick={() => openDeleteModal({ id, filename })}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <EmptyState
                            iconName="Document"
                            heading={datasets.length > 0 ? "No Matching Datasets" : "No Datasets Uploaded"}
                            content={
                                datasets.length > 0
                                    ? "Try adjusting your search or status filter."
                                    : "There are no datasets uploaded. Upload a dataset to prepare it for model processing."
                            }
                        />
                    )}
                </div>
            )}
        </div>
        {previewModalActive && (
            <DatasetPreviewModal
                data={previewModalData}
                onClose={() => setPreviewModalActive(false)}
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

const DatasetStatusBadge = ({ status }) => {
    const label = status || "Unknown";
    const statusColor = {
        UPLOADED: {
            backgroundColor: "#DBEAFE",
            color: "#2563EB",
        },
        RAW: {
            backgroundColor: "#F3F4F6",
            color: "#6B7280",
        },
        QUEUED: {
            backgroundColor: "#E0E7FF",
            color: "#4F46E5",
        },
        PROCESSING: {
            backgroundColor: "#FEF3C7",
            color: "#D97706",
        },
        ANNOTATED: {
            backgroundColor: "#D1FAE5",
            color: "#059669",
        },
        FAILED: {
            backgroundColor: "#FEE2E2",
            color: "#DC2626",
        },
    };

    return (
        <span
            className="px-[8px] py-[4px] rounded-full text-xs font-medium"
            style={statusColor[label.toUpperCase()] ?? statusColor.RAW}
        >
            {label}
        </span>
    );
};

/* MODALS */
const UploadDatasetModal = ({ data, error, isLoading, onCancel, onConfirm }) => {
    const columns = data.headers.slice(0, 7);
    const hasMissingHeaders = data.missingHeaders?.length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-[20px] py-[24px]">
            <button
                type="button"
                className="absolute inset-0 bg-[#34405499] backdrop-blur-sm"
                onClick={onCancel}
                aria-label="Close upload dataset preview"
                disabled={isLoading || hasMissingHeaders}
            />

            <div className="relative w-full max-w-[680px] overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white shadow-xl">
                <div className="border-b border-[#E5E5E5] px-[20px] py-[16px]">
                    <h3 className="text-[18px] font-semibold text-gray-800">
                        Upload Dataset
                    </h3>
                    <p className="text-sm text-gray-500">{data.filename}</p>
                </div>

                <div className="p-[20px]">
                    <p className="mb-[16px] text-sm text-gray-500">
                        Rows: <span className="font-medium text-gray-800">{data.rows}</span>
                    </p>

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

                    {error && (
                        <p className="mt-[12px] text-sm text-destructive-600">
                            {error}
                        </p>
                    )}
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
                        className="prod-btn-base prod-btn-primary"
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
                        className="prod-btn-base prod-btn-destructive"
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

const DatasetPreviewModal = ({ data, onClose }) => {
    const columns = data.preview_headers.slice(0, 3);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-[20px] py-[24px]">
            <button
                type="button"
                className="absolute inset-0 bg-[#34405499] backdrop-blur-sm"
                onClick={onClose}
                aria-label="Close dataset preview"
            />

            <div className="relative w-full max-w-[680px] overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white shadow-xl">
                <div className="border-b border-[#E5E5E5] px-[20px] py-[16px]">
                    <h3 className="text-[18px] font-semibold text-gray-800">
                        Dataset Preview
                    </h3>
                    <p className="text-sm text-gray-500">{data.filename}</p>
                </div>

                <div className="p-[20px]">
                    <div className="mb-[16px] grid grid-cols-1 gap-[10px] text-sm sm:grid-cols-2">
                        <p className="text-gray-500">
                            Status:{" "}
                            <span className="font-medium text-gray-800">
                                {data.dataset_status}
                            </span>
                        </p>
                        <p className="text-gray-500">
                            Rows:{" "}
                            <span className="font-medium text-gray-800">
                                {data.num_of_rows}
                            </span>
                        </p>
                    </div>

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

                <div className="flex justify-end border-t border-[#E5E5E5] px-[20px] py-[16px]">
                    <button
                        type="button"
                        className="prod-btn-base prod-btn-secondary"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

/* SUBTAB 3 = TRAINING LOGS */
const TrainingLogs = () => {
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
                <button className="border border-[#E5E5E5] rounded-[10px] px-[14px] py-[9px] text-sm text-white bg-[#32418C]">
                    Download Logs
                </button>
            </div>

            <div className="overflow-x-auto">
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
                        <TrainingLogRow
                            runId="TRN-001"
                            model="mBERT"
                            dataset="DOH Disease Reports"
                            status="Completed"
                            started="May 08, 2026 09:10 AM"
                            duration="14m"
                        />
                        <TrainingLogRow
                            runId="TRN-002"
                            model="XLM-RoBERTa"
                            dataset="Social Media Health Mentions"
                            status="Running"
                            started="May 08, 2026 10:24 AM"
                            duration="7m"
                        />
                        <TrainingLogRow
                            runId="TRN-003"
                            model="GPT-based Classifier"
                            dataset="COVID-19 Symptoms Database"
                            status="Failed"
                            started="May 08, 2026 11:03 AM"
                            duration="2m"
                        />
                        <TrainingLogRow
                            runId="TRN-004"
                            model="LSTM Model"
                            dataset="TB Cases 2022"
                            status="Queued"
                            started="Pending"
                            duration="—"
                        />
                    </tbody>
                </table>
            </div>
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
