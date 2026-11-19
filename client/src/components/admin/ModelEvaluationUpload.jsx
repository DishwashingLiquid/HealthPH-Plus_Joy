/* eslint-disable react/prop-types */
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ToolbarButton } from "../ToolbarControls";
import ModalWithBody from "./ModalWithBody";
import { useUploadModelEvaluationsMutation } from "../../features/api/modelEvaluationsSlice";
import {
    EVALUATION_MODEL_NAMES, MAX_EVALUATION_BYTES, parseEvaluationPreview,
} from "../../utils/modelEvaluationHelpers";

export default function ModelEvaluationUpload({
    canUpload = false, onPrint, printDisabled = false, isPrinting = false, printError = "", children,
}) {
    const input = useRef(null);
    const reading = useRef(0);
    const [selection, setSelection] = useState(null);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [isReading, setIsReading] = useState(false);
    const [upload, { isLoading }] = useUploadModelEvaluationsMutation();

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
            if (!file.name.toLowerCase().endsWith(".json")) throw new Error("Choose a JSON evaluation file.");
            if (file.size > MAX_EVALUATION_BYTES) throw new Error("Evaluation JSON must be 256 KB or smaller.");
            const text = await file.text();
            const report = parseEvaluationPreview(text.replace(/^\uFEFF/, ""));
            if (readId === reading.current) setSelection({ file, report });
        } catch (failure) {
            if (readId === reading.current) setError(failure.message || "Unable to read this file. Please try again.");
        } finally {
            if (readId === reading.current) setIsReading(false);
        }
    };

    const save = async () => {
        if (!selection || isLoading) return;
        setError("");
        try {
            const form = new FormData();
            form.append("file", selection.file);
            await upload(form).unwrap();
            setMessage("Evaluation records saved. The charts will refresh with the uploaded results.");
            setSelection(null);
        } catch (failure) {
            const detail = failure?.data?.detail;
            setError(typeof detail === "string" ? detail : "Unable to save evaluation records. Please try again.");
        }
    };

    return (
        <div className="flex flex-col gap-[8px]">
            <div className="flex flex-col gap-[8px] md:flex-row md:items-end md:justify-between">
                <div className="flex flex-col gap-[4px]">
                    <h2 className="text-[20px] font-semibold text-gray-800">Model Comparison</h2>
                    <p className="text-sm text-gray-500">Compare recorded evaluation results for disease classification models.</p>
                </div>
                <div className="flex flex-col gap-[10px] sm:flex-row sm:items-center md:justify-end">
                    <ToolbarButton iconName="Printer" variant="primary" onClick={onPrint} disabled={printDisabled || isPrinting} title="Print evaluation results matching the current filters">
                        {isPrinting ? "Preparing..." : "Print"}
                    </ToolbarButton>
                    <ToolbarButton iconName="Download" variant="primary" onClick={() => {
                        const link = document.createElement("a");
                        link.href = "/assets/model-evaluation-template.json";
                        link.download = "healthph-model-evaluation-template.json";
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                    }}>
                        Download JSON Template
                    </ToolbarButton>
                    {canUpload && (
                        <>
                            <input ref={input} type="file" accept=".json,application/json" className="hidden" onChange={chooseFile} aria-label="Evaluation JSON file" />
                            <ToolbarButton iconName="Upload" variant="primary" onClick={() => input.current?.click()} disabled={isReading || isLoading}>
                                {isReading ? "Reading..." : "Upload JSON"}
                            </ToolbarButton>
                        </>
                    )}
                </div>
            </div>
            {children}
            {printError && <p role="alert" className="text-sm text-[#B42318]">{printError}</p>}
            {message && <p role="status" className="mt-[12px] rounded-[8px] border border-[#A7F3D0] bg-[#ECFDF5] px-[12px] py-[10px] text-sm text-[#047857]">{message}</p>}
            {error && !selection && <p role="alert" className="mt-[12px] rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] px-[12px] py-[10px] text-sm text-[#B42318]">{error}</p>}
            {selection && createPortal(
                <ModalWithBody heading="Upload Evaluation Records" onConfirm={save} onConfirmLabel="Save evaluations"
                    onLoading={isLoading} onLoadingLabel="Saving..." closeOnBackdrop={false}
                    onCancel={() => { if (!isLoading) { setSelection(null); setError(""); } }}>
                    <div className="max-h-[60dvh] overflow-y-auto p-[20px] text-sm text-gray-700">
                        <p className="break-words font-medium">{selection.file.name}</p>
                        <p className="mt-[8px]">This replaces the saved evaluation for each model listed below. Other model records are kept.</p>
                        <p className="mt-[8px]">Use the template format. Include one or both models and remove any unmeasured per-language rows.</p>
                        <p className="mt-[8px]">Use decimal scores such as 0.85 for 85%, null for unmeasured scores, and dates in YYYY-MM-DD format. Maximum file size: 256 KB.</p>
                        <ul className="mt-[12px] space-y-[8px]">
                            {selection.report.models.map((model) => (
                                <li key={model.id} className="rounded-[8px] border border-[#E5E5E5] p-[12px]">
                                    <strong>{EVALUATION_MODEL_NAMES[model.id]}</strong>
                                    <p className="mt-[4px] break-words">Evaluation dataset: {typeof model.evaluationSet === "string" ? model.evaluationSet : "Not provided"}</p>
                                    <p>Samples: {typeof model.sampleCount === "number" ? model.sampleCount.toLocaleString() : "Not provided"}</p>
                                </li>
                            ))}
                        </ul>
                        {error && <p role="alert" className="mt-[12px] rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] p-[12px] text-[#B42318]">{error}</p>}
                    </div>
                </ModalWithBody>, document.body
            )}
        </div>
    );
}
