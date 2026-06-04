import { useState } from "react";
import { useSelector } from "react-redux";
import { format } from "date-fns";

import Datatable from "../../components/admin/Datatable";
import EmptyState from "../../components/admin/EmptyState";
import SkeletonBody from "../../components/SkeletonBody";

import {
    useFetchDatasetsByUserQuery,
} from "../../features/api/datasetsSlice";

import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";

import { ToolbarSearch } from "../../components/ToolbarControls";

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
                    precision="85%"
                    recall="89%"
                    tag="Multilingual BERT"
                />
                <ModelCard
                    name="XLM-RoBERTa"
                    description="Cross-lingual RoBERTa model adapted for health terminology extraction and classification."
                    score="92%"
                    precision="93%"
                    recall="91%"
                    tag="Cross-lingual RoBERTa"
                />
            </div>
        </div>
    ); 
};

/* SUBTAB 2 = DATA MANAGEMENT */
const DataManagement = () => {
    const user = useSelector((state) => state.auth.user);

    const {
        data: datasetsByUser,
        isFetching: isDatasetsByUserFetching,
    } = useFetchDatasetsByUserQuery(user.id);

    const [rows, setRows] = useState([]);

    const displayFileSize = (size) => {
        if (size < 1024) return `${size} B`;

        const newSize = size / 1024;

        if (newSize >= 1024) {
            return `${(newSize / 1024).toFixed(2).replace(/\.?0+$/, "")} MB`;
        }
        return `${newSize.toFixed(2).replace(/\.?0+$/, "")} KB`;
    };

    return (
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
                <button className="bg-[#2563EB] text-white rounded-[10px] px-[14px] py-[9px] text-sm">
                    Upload Dataset
                </button>
            </div>

            {isDatasetsByUserFetching ? (
                <div className="overflow-y-hidden min-w-full h-[500px]">
                    <SkeletonBody columns={5} />
                </div>
            ) : (
                <div className="h-[500px] overflow-hidden">
                    <Datatable
                        datatableHeader="Datasets"
                        datatableColumns={[
                            { label: "File Name" },
                            { label: "File Size (Status)" },
                            { label: "Uploaded By" },
                            { label: "Date Uploaded" },
                            { label: "Actions" },
                        ]}
                        datatableData={datasetsByUser || []}
                        setDatatableData={setRows}
                        rowsPerPage={10}
                        withActions={true}
                        actionsWidth="260px"
                    >
                        {datasetsByUser?.length > 0 ? (
                            rows.map(
                                ({
                                    id,
                                    user_name,
                                    filename,
                                    file_size,
                                    dataset_status,
                                    created_at,
                                }) => (
                                    <div className="content-row" key={id}>
                                        <div className="row-item">{filename}</div>

                                        <div className="row-item">
                                            {displayFileSize(file_size)}
                                            <span className="font-medium ms-1">
                                                ({dataset_status})
                                            </span>
                                        </div>

                                        <div className="row-item">{user_name}</div>
                                        
                                        <div className="row-item">
                                            {format(new Date(created_at), "MMM dd, yyyy hh:mm a")}
                                        </div>
                                            
                                        <div className="row-item">
                                            <div className="flex items-center">
                                                <button className="prod-push-btn-sm prod-btn-primary me-[8px] min-w-[70px]">
                                                    Preview
                                                </button>
                                                <button className="prod-push-btn-sm prod-btn-secondary me-[8px] min-w-[70px]">
                                                    Download
                                                </button>
                                                <button className="prod-push-btn-sm prod-btn-destructive min-w-[70px]">
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )
                        ) : (
                            <EmptyState
                                iconName="Document"
                                heading="No Datasets Uploaded"
                                content="There are no datasets uploaded. Upload a dataset to prepare it for model processing."
                            />
                        )}
                    </Datatable>
                </div>
            )}
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
                            starter="May 08, 2026 09:10 AM"
                            duration="14m"
                        />
                        <TrainingLogRow
                            runId="TRN-002"
                            model="XLM-RoBERTa"
                            dataset="Social Media Health Mentions"
                            status="Running"
                            starter="May 08, 2026 10:24 AM"
                            duration="7m"
                        />
                        <TrainingLogRow
                            runId="TRN-003"
                            model="GPT-based Classifier"
                            dataset="COVID-19 Symptoms Database"
                            status="Failed"
                            starter="May 08, 2026 11:03 AM"
                            duration="2m"
                        />
                        <TrainingLogRow
                            runId="TRN-004"
                            model="LSTM Model"
                            dataset="TB Cases 2022"
                            status="Queued"
                            starter="Pending"
                            duration="—"
                        />
                    </tbody>
                </table>
            </div>
        </div>
    );
};

/* HELPERS */

const ModelCard = ({ name, description, score, precision, recall, tag }) => {
    return (
        <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
            <div className="flex justify-between items-start mb-[12px]">
                <div>
                    <h3 className="text-[18px] font-semibold text-gray-800">
                        {name}
                    </h3>
                    <p className="text-sm text-gray-500">
                        {description}
                    </p>
                </div>
                <span className="bg-[#32418C30] text-[#32418C] rounded-full px-[10px] py-[4px] text-xs font-medium">
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
                    >
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-[16px] mb-[10px]">
                <div>
                    <p className="text-sm text-gray-500">Precision</p>
                    <p className="text-[20px] font-semibold text-gray-800">{precision}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-500">Recall</p>
                    <p className="text-[20px] font-semibold text-gray-800">{recall}</p>
                </div> 
            </div>

            <div className="flex justify-end gap-[10px]">
                <button className="border border-[#E5E5E5] rounded-[8px] px-[12px] py-[8px] text-sm">
                    Details
                </button>
                <button className="bg-[#32418C] text-white rounded-[8px] px-[12px] py-[8px] text-sm">
                    Compare
                </button>
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