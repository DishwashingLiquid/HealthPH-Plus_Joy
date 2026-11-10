/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useReactToPrint } from "react-to-print";
import {
    CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ToolbarButton, ToolbarSearch } from "../ToolbarControls";
import LoadingSkeleton, { ChartSkeleton } from "../LoadingSkeleton";
import EmptyState from "./EmptyState";
import ModelTrainingLogUpload from "./ModelTrainingLogUpload";
import SummaryPrintReport from "./SummaryPrintReport";
import {
    useFetchModelTrainingLogsQuery, useLazyFetchModelTrainingLogsQuery,
} from "../../features/api/modelTrainingLogsSlice";
import {
    TRAINING_METRICS, TRAINING_MODEL_NAMES, downloadTrainingJson, formatTrainingDate,
    formatTrainingDuration, formatTrainingMetric, trainingLogForExport, trainingRunKey,
    buildTrainingLogPrintReport, loadTrainingLogsForPrint,
} from "../../utils/modelTrainingLogHelpers";

const PAGE_SIZE = 10;
const SELECT_CLASSES = "max-w-full rounded-[10px] border border-[#E5E5E5] bg-white px-[14px] py-[10px] text-sm";
const STATUS_STYLES = {
    completed: { backgroundColor: "#D1FAE5", color: "#047857" },
    failed: { backgroundColor: "#FEE2E2", color: "#B91C1C" },
    cancelled: { backgroundColor: "#F3F4F6", color: "#4B5563" },
};

export default function ModelTrainingLogs() {
    const user = useSelector((state) => state.auth.user);
    const [search, setSearch] = useState("");
    const [querySearch, setQuerySearch] = useState("");
    const [model, setModel] = useState("all");
    const [status, setStatus] = useState("all");
    const [days, setDays] = useState("all");
    const [page, setPage] = useState(1);
    const [selectedRun, setSelectedRun] = useState("");
    const [selectedMetric, setSelectedMetric] = useState("validationMicroF1");
    const [isPrinting, setIsPrinting] = useState(false);
    const [printError, setPrintError] = useState("");
    const [printReport, setPrintReport] = useState(null);
    const printCycle = useRef(0);
    const printRequest = useRef(null);
    const printBusy = useRef(false);
    const printRef = useRef(null);
    const printPending = useRef(false);
    const printLogs = useReactToPrint({
        content: () => printRef.current,
        documentTitle: "HealthPH+ - Training Logs",
        removeAfterPrint: false,
        pageStyle: "@page { size: A4 landscape; margin: 12mm; } @media print { html, body { height: auto !important; overflow: visible !important; margin: 0 !important; } }",
        onAfterPrint: () => { printBusy.current = false; setIsPrinting(false); },
        onPrintError: () => {
            printBusy.current = false;
            setIsPrinting(false);
            setPrintError("Unable to open the print dialog. Please try again.");
        },
    });
    useEffect(() => {
        if (printReport && printPending.current) {
            printPending.current = false;
            printLogs();
        }
    }, [printReport, printLogs]);
    useEffect(() => () => {
        printCycle.current += 1;
        printPending.current = false;
        printRequest.current?.abort();
    }, []);
    useEffect(() => {
        const timer = setTimeout(() => { setQuerySearch(search.trim()); setPage(1); }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const filters = { model, status, days, search: querySearch };
    const { currentData, data, isFetching, isError, error, refetch } = useFetchModelTrainingLogsQuery({
        ...filters, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE,
    });
    const [fetchForPrint] = useLazyFetchModelTrainingLogsQuery();
    const logs = currentData?.logs ?? [];
    const total = currentData?.total ?? 0;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const isSearchPending = search.trim() !== querySearch;
    const busy = isFetching || isSearchPending;
    useEffect(() => {
        if (currentData && !isFetching && page > pages) setPage(pages);
    }, [currentData, isFetching, page, pages]);

    const run = logs.find((item) => trainingRunKey(item) === selectedRun) ?? logs[0];
    const availableMetrics = Object.keys(TRAINING_METRICS).filter((key) =>
        run?.epochs?.some((epoch) => typeof epoch.metrics?.[key] === "number")
    );
    const metric = availableMetrics.includes(selectedMetric) ? selectedMetric : availableMetrics[0];
    const curve = (run?.epochs ?? []).map((epoch) => ({ epoch: epoch.epoch, value: epoch.metrics?.[metric] ?? null }));

    const resetFilters = () => {
        setSearch(""); setQuerySearch(""); setModel("all"); setStatus("all"); setDays("all"); setPage(1);
        setSelectedRun(""); setPrintError("");
    };

    const handlePrint = async () => {
        if (printBusy.current || busy || isError || !total) return;
        printBusy.current = true;
        const cycle = ++printCycle.current;
        setIsPrinting(true);
        setPrintError("");
        try {
            const matching = await loadTrainingLogsForPrint(filters, async (params) => {
                const request = fetchForPrint(params, false);
                printRequest.current = request;
                const result = await request.unwrap();
                if (cycle !== printCycle.current) throw new Error("Print preparation cancelled.");
                return result;
            });
            if (cycle !== printCycle.current) return;
            const report = buildTrainingLogPrintReport({ logs: matching, filters, user });
            if (!report) throw new Error("No training logs match the selected filters. Please refresh and try again.");
            printPending.current = true;
            setPrintReport(report);
        } catch (failure) {
            if (cycle === printCycle.current) {
                setPrintError(typeof failure?.data?.detail === "string" ? failure.data.detail : failure.message || "Unable to prepare the print report. Please try again.");
                setIsPrinting(false);
                printBusy.current = false;
            }
        }
    };

    return (
        <div className="flex flex-col gap-[20px] rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
            <ModelTrainingLogUpload canUpload={data?.canUpload === true} onPrint={handlePrint}
                printDisabled={busy || isError || !total} isPrinting={isPrinting}>
                <div className="flex flex-col items-start justify-between gap-[8px] lg:flex-row">
                    <ToolbarSearch placeholder="Search runs, checkpoints, datasets..." maxLength={200} value={search} onChange={(event) => setSearch(event.target.value)} />
                    <div className="flex w-full flex-col items-end gap-[6px] lg:w-auto">
                        <button type="button" onClick={resetFilters} className="rounded-[8px] border border-[#D0D5DD] bg-white px-[10px] py-[6px] text-xs font-medium text-[#344054] hover:bg-[#F9FAFB]">Reset filters</button>
                        <div className="flex flex-wrap justify-end gap-[10px]">
                            <select aria-label="Filter training logs by model" value={model} onChange={(event) => { setModel(event.target.value); setPage(1); }} className={SELECT_CLASSES}>
                                <option value="all">All Models</option>
                                {Object.entries(TRAINING_MODEL_NAMES).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                            </select>
                            <select aria-label="Filter training logs by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className={SELECT_CLASSES}>
                                <option value="all">All Status</option>
                                <option value="completed">Completed</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option>
                            </select>
                            <select aria-label="Filter training logs by start time" value={days} onChange={(event) => { setDays(event.target.value); setPage(1); }} className={SELECT_CLASSES}>
                                <option value="all">All Dates</option><option value="7">Last 7 Days</option><option value="30">Last 30 Days</option><option value="90">Last 90 Days</option>
                            </select>
                        </div>
                    </div>
                </div>
            </ModelTrainingLogUpload>
            {printError && <p role="alert" className="text-sm text-[#B42318]">{printError}</p>}
            <div style={{ display: "none" }}>
                <SummaryPrintReport ref={printRef} report={printReport} />
            </div>

            {isError ? <EmptyState iconName="Error" heading="Unable to Load Training Logs"
                content={typeof error?.data?.detail === "string" ? error.data.detail : "Please try loading the logs again."}>
                <ToolbarButton onClick={refetch}>Retry</ToolbarButton>
            </EmptyState> : <>
                <section className="rounded-[12px] border border-[#E5E5E5] p-[16px] sm:p-[20px]">
                    <h3 className="text-[20px] font-semibold text-gray-800">Learning Curves</h3>
                    <p className="mt-[4px] text-sm text-gray-500">Recorded training or validation measurements over epochs for one run.</p>
                    {busy ? <ChartSkeleton /> : run ? <>
                        <div className="mt-[16px] flex flex-wrap gap-[12px]">
                            <label className="flex min-w-0 flex-1 flex-col gap-[4px] text-sm text-gray-600">Training run
                                <select value={trainingRunKey(run)} onChange={(event) => setSelectedRun(event.target.value)} className={SELECT_CLASSES}>
                                    {logs.map((item) => <option key={trainingRunKey(item)} value={trainingRunKey(item)}>{item.name} — {item.runId}</option>)}
                                </select>
                            </label>
                            {metric && <label className="flex flex-col gap-[4px] text-sm text-gray-600">Metric
                                <select value={metric} onChange={(event) => setSelectedMetric(event.target.value)} className={SELECT_CLASSES}>
                                    {availableMetrics.map((key) => <option key={key} value={key}>{TRAINING_METRICS[key]}</option>)}
                                </select>
                            </label>}
                        </div>
                        {metric ? <div className="mt-[16px] h-[300px] min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={curve} margin={{ top: 12, right: 20, left: 8, bottom: 24 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                    <XAxis dataKey="epoch" type="number" domain={["dataMin", "dataMax"]} allowDecimals={false} label={{ value: "Epoch", position: "bottom", offset: 4 }} />
                                    <YAxis domain={metric.endsWith("Loss") ? [0, "auto"] : [0, 1]} tickFormatter={(value) => metric.endsWith("Loss") ? value : `${Math.round(value * 100)}%`} />
                                    <Tooltip formatter={(value) => [formatTrainingMetric(metric, value), TRAINING_METRICS[metric]]} labelFormatter={(value) => `Epoch ${value}`} />
                                    <Line name={TRAINING_METRICS[metric]} type="linear" dataKey="value" stroke="#32418C" strokeWidth={2} dot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div> : <EmptyState iconName="Document" heading="Learning Curve Unavailable" content="No epoch measurements were recorded for this run." />}
                    </> : <EmptyState iconName="Document" heading="No Learning Curves" content="Upload a training log with recorded epoch measurements to display its curve." />}
                </section>

                <section className="rounded-[12px] border border-[#E5E5E5] p-[16px] sm:p-[20px]">
                    <div className="flex flex-wrap items-center justify-between gap-[10px]">
                        <div><h3 className="text-[20px] font-semibold text-gray-800">Training History</h3>
                            <p className="mt-[4px] text-sm text-gray-500">Expand a run to view its datasets, parameters, and recorded results.</p></div>
                        <ToolbarButton onClick={refetch} disabled={busy}>Refresh Logs</ToolbarButton>
                    </div>
                    {busy ? <div className="mt-[20px] space-y-[12px]">{[0, 1, 2, 3].map((key) => <div key={key} className="flex gap-[16px] rounded-[8px] border border-[#E5E5E5] p-[16px]"><LoadingSkeleton className="h-[20px] w-[25%]" /><LoadingSkeleton className="h-[20px] w-[50%]" /><LoadingSkeleton className="h-[20px] w-[15%]" /></div>)}</div>
                        : logs.length ? <div className="mt-[20px] space-y-[10px]">{logs.map((item) => <TrainingRunDetails key={trainingRunKey(item)} log={item} />)}</div>
                            : <EmptyState iconName="Document" heading="No Training Logs" content="No uploaded training runs match the current filters." />}
                    <div className="mt-[20px] flex flex-wrap items-center justify-between gap-[12px] border-t border-[#E5E5E5] pt-[16px] text-sm text-gray-500">
                        {busy ? <LoadingSkeleton className="h-[16px] w-[180px]" /> : <span>{total ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} runs` : "0 runs"}</span>}
                        <div className="flex items-center gap-[10px]">
                            <ToolbarButton disabled={busy || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</ToolbarButton>
                            <span>Page {page} of {pages}</span>
                            <ToolbarButton disabled={busy || page >= pages} onClick={() => setPage((value) => value + 1)}>Next</ToolbarButton>
                        </div>
                    </div>
                </section>
            </>}
            <section className="rounded-[12px] border border-[#E5E5E5] p-[16px] sm:p-[20px]">
                <h3 className="text-[20px] font-semibold text-gray-800">Model Audit Trail</h3>
                <EmptyState iconName="Document" heading="Audit History Unavailable" content="Model release and deployment records are not connected yet." />
            </section>
        </div>
    );
}

function TrainingRunDetails({ log }) {
    const [exportError, setExportError] = useState("");
    const lastEpoch = log.epochs?.[log.epochs.length - 1];
    const exportRun = () => {
        try {
            setExportError("");
            downloadTrainingJson(trainingLogForExport(log), `healthph-training-${log.modelId}-${log.runId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80)}.json`);
        } catch { setExportError("Unable to download this run. Please try again."); }
    };
    return (
        <details className="rounded-[10px] border border-[#E5E5E5]">
            <summary className="cursor-pointer p-[14px] text-sm text-gray-700">
                <span className="ml-[6px] font-semibold">{log.name}</span>
                <span className="ml-[10px] break-all">{log.runId}</span>
                <span className="ml-[10px] inline-block rounded-full px-[8px] py-[3px] text-xs font-medium capitalize" style={STATUS_STYLES[log.status]}>{log.status}</span>
                <span className="ml-[10px] inline-block text-gray-500">{formatTrainingDuration(log.durationSeconds)}</span>
            </summary>
            <div className="space-y-[16px] border-t border-[#E5E5E5] p-[16px] text-sm text-gray-600">
                <dl className="grid grid-cols-1 gap-[12px] break-words sm:grid-cols-2">
                    {[
                        ["Checkpoint", log.modelVersion], ["Training dataset", log.trainingDataset],
                        ["Validation dataset", log.validationDataset], ["Started", formatTrainingDate(log.startedAt)],
                        ["Ended", formatTrainingDate(log.endedAt)], ["Uploaded", formatTrainingDate(log.uploadedAt)],
                    ].map(([name, value]) => <div key={name}><dt className="font-medium text-gray-800">{name}</dt><dd className="mt-[4px]">{value ?? "Not recorded"}</dd></div>)}
                </dl>
                <div><h4 className="font-semibold text-gray-800">Hyperparameters</h4>
                    {Object.keys(log.hyperparameters ?? {}).length ? <dl className="mt-[8px] grid grid-cols-1 gap-[10px] break-words sm:grid-cols-2">
                        {Object.entries(log.hyperparameters).map(([name, value]) => <div key={name}><dt>{name.replace(/_/g, " ")}</dt><dd className="font-medium text-gray-800">{value === null ? "Not recorded" : String(value)}</dd></div>)}
                    </dl> : <p className="mt-[4px]">No hyperparameters recorded.</p>}
                </div>
                <div><h4 className="font-semibold text-gray-800">Last Recorded Epoch{lastEpoch ? ` (${lastEpoch.epoch})` : ""}</h4>
                    {lastEpoch ? <dl className="mt-[8px] grid grid-cols-1 gap-[10px] sm:grid-cols-2">
                        {Object.entries(lastEpoch.metrics).map(([name, value]) => <div key={name}><dt>{TRAINING_METRICS[name]}</dt><dd className="font-medium text-gray-800">{formatTrainingMetric(name, value)}</dd></div>)}
                    </dl> : <p className="mt-[4px]">No epoch measurements recorded.</p>}
                </div>
                {log.notes && <div><h4 className="font-semibold text-gray-800">Notes</h4><p className="mt-[4px] whitespace-pre-wrap break-words">{log.notes}</p></div>}
                <ToolbarButton iconName="Download" onClick={exportRun}>Download Run JSON</ToolbarButton>
                {exportError && <p role="alert" className="text-[#B42318]">{exportError}</p>}
            </div>
        </details>
    );
}
