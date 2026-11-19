/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ToolbarButton } from "../ToolbarControls";
import ModalWithBody from "./ModalWithBody";
import { useUploadModelTrainingLogMutation } from "../../features/api/modelTrainingLogsSlice";
import {
    MAX_TRAINING_LOG_BYTES, TRAINING_MODEL_NAMES, formatTrainingDate, parseTrainingLogPreview,
} from "../../utils/modelTrainingLogHelpers";

export default function ModelTrainingLogUpload({ canUpload, onPrint, printDisabled, isPrinting, children }) {
    const input = useRef(null);
    const reading = useRef(0);
    const saving = useRef(false);
    const [selection, setSelection] = useState(null);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [isReading, setIsReading] = useState(false);
    const [upload, { isLoading }] = useUploadModelTrainingLogMutation();
    useEffect(() => () => { reading.current += 1; }, []);

    const chooseFile = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        const readId = ++reading.current;
        setError("");
        setMessage("");
        setSelection(null);
        setIsReading(true);
        try {
            if (!file.name.toLowerCase().endsWith(".json")) throw new Error("Choose a JSON training-log file.");
            if (file.size > MAX_TRAINING_LOG_BYTES) throw new Error("Training-log JSON must be 2 MB or smaller.");
            const report = parseTrainingLogPreview(await file.text());
            if (readId === reading.current) setSelection({ file, report });
        } catch (failure) {
            if (readId === reading.current) setError(failure.message || "Unable to read this file. Please try again.");
        } finally {
            if (readId === reading.current) setIsReading(false);
        }
    };

    const save = async () => {
        if (!selection || saving.current) return;
        saving.current = true;
        setError("");
        try {
            const form = new FormData();
            form.append("file", selection.file);
            await upload(form).unwrap();
            setMessage("Training log saved. Existing runs were kept. Active filters still apply to the list.");
            setSelection(null);
        } catch (failure) {
            setError(typeof failure?.data?.detail === "string" ? failure.data.detail : "Unable to save the training log. Please try again.");
        } finally {
            saving.current = false;
        }
    };

    return (
        <div className="flex flex-col gap-[8px]">
            <div className="flex flex-col gap-[8px] md:flex-row md:items-end md:justify-between">
                <div className="flex flex-col gap-[4px]">
                    <h2 className="text-[20px] font-semibold text-gray-800">Training Logs</h2>
                    <p className="text-sm text-gray-500">Recorded model training runs, parameters, and learning curves.</p>
                </div>
                <div className="flex flex-wrap items-center gap-[10px] md:justify-end">
                    <ToolbarButton iconName="Printer" variant="primary" onClick={onPrint} disabled={printDisabled || isPrinting}>
                        {isPrinting ? "Preparing..." : "Print"}
                    </ToolbarButton>
                    <ToolbarButton iconName="Download" variant="primary" onClick={() => {
                        const link = document.createElement("a");
                        link.href = "/assets/model-training-log-template.json";
                        link.download = "healthph-model-training-log-template.json";
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                    }}>Download JSON Template</ToolbarButton>
                    {canUpload && <>
                        <input ref={input} type="file" accept=".json,application/json" className="hidden" onChange={chooseFile} aria-label="Training-log JSON file" />
                        <ToolbarButton iconName="Upload" variant="primary" onClick={() => input.current?.click()} disabled={isReading || isLoading}>
                            {isReading ? "Reading..." : "Upload JSON"}
                        </ToolbarButton>
                    </>}
                </div>
            </div>
            {children}
            {message && <p role="status" className="rounded-[8px] border border-[#A7F3D0] bg-[#ECFDF5] px-[12px] py-[10px] text-sm text-[#047857]">{message}</p>}
            {error && !selection && <p role="alert" className="rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] px-[12px] py-[10px] text-sm text-[#B42318]">{error}</p>}
            {selection && createPortal(
                <ModalWithBody heading="Upload Training Log" onConfirm={save} onConfirmLabel="Save training log"
                    onLoading={isLoading} onLoadingLabel="Saving..." closeOnBackdrop={false}
                    onCancel={() => { if (!saving.current) { setSelection(null); setError(""); } }}>
                    <div className="max-h-[60dvh] overflow-y-auto p-[20px] text-sm text-gray-700">
                        <p className="break-words font-medium">{selection.file.name}</p>
                        <div className="mt-[12px] space-y-[6px] rounded-[8px] border border-[#E5E5E5] p-[12px] break-words">
                            <p><strong>Model:</strong> {TRAINING_MODEL_NAMES[selection.report.modelId]}</p>
                            <p><strong>Run ID:</strong> {selection.report.runId}</p>
                            <p><strong>Checkpoint:</strong> {selection.report.modelVersion}</p>
                            <p><strong>Training dataset:</strong> {selection.report.trainingDataset}</p>
                            <p><strong>Status:</strong> {selection.report.status}</p>
                            <p><strong>Started:</strong> {formatTrainingDate(selection.report.startedAt)}</p>
                            <p><strong>Ended:</strong> {formatTrainingDate(selection.report.endedAt)}</p>
                            <p><strong>Recorded epochs:</strong> {(selection.report.epochs ?? []).length}</p>
                        </div>
                        <p className="mt-[12px]">This adds one recorded training run. Existing runs are kept; duplicate model/run IDs are rejected.</p>
                        <p className="mt-[8px]">Importing this record does not start training or deploy a checkpoint.</p>
                        {error && <p role="alert" className="mt-[12px] rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] p-[12px] text-[#B42318]">{error}</p>}
                    </div>
                </ModalWithBody>, document.body
            )}
        </div>
    );
}
