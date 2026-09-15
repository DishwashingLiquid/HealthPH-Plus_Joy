import { useEffect, useState } from "react";
import PropTypes from "prop-types";

import ModalWithBody from "../../../components/admin/ModalWithBody";

const INTERVALS = [
  [15, "15 minutes"], [30, "30 minutes"], [60, "1 hour"],
  [480, "8 hours"], [720, "12 hours"], [1440, "24 hours"],
];

const displayDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not yet scheduled" : date.toLocaleString();
};

export default function SendAlertModal({ onClose, onSave, isSaving, settings, isLoading }) {
  const [form, setForm] = useState({ enabled: false, threshold: "5", intervalMinutes: "1440" });
  const [error, setError] = useState("");
  useEffect(() => {
    if (settings) setForm({ enabled: Boolean(settings.enabled), threshold: String(settings.threshold || 5), intervalMinutes: String(settings.intervalMinutes || 1440) });
  }, [settings]);
  const submit = async () => {
    const threshold = Number(form.threshold);
    if (!Number.isInteger(threshold) || threshold < 1) { setError("Threshold must be a positive whole number."); return; }
    try {
      await onSave({ enabled: form.enabled, threshold, intervalMinutes: Number(form.intervalMinutes) });
    } catch (requestError) { setError(requestError?.data?.detail || "The alert settings could not be saved."); }
  };
  const inputClass = "w-full rounded-[8px] border border-[#E5E5E5] px-[12px] py-[10px] text-[14px] focus:border-[#6A8EB5] focus:outline-none";
  return <ModalWithBody onConfirm={submit} onConfirmLabel="Save settings" onCancel={onClose} onLoading={isSaving || isLoading} onLoadingLabel="Saving..." heading="Alert Settings" color="primary" additionalClasses="health-literacy-content-modal admin-brand-modal !top-[68px] !h-[calc(100vh-68px)] !pt-[20px]">
    <div className="flex max-h-[60vh] flex-col gap-[16px] overflow-y-auto p-[20px]">
      <div className="rounded-[10px] border border-[#D5E3F0] bg-[#F8FBFF] p-[14px] text-[13px] leading-[19px] text-gray-700">When enabled, eligible regional self-report totals are evaluated immediately and at the selected interval. Alerts are aggregate early-warning notices, not diagnoses.</div>
      {error && <p role="alert" className="rounded-[8px] bg-[#FFF6F6] p-[10px] text-[13px] text-[#B42318]">{error}</p>}
      <label className="flex items-center justify-between rounded-[8px] border border-[#E5E5E5] p-[12px] text-[14px] font-medium text-gray-800"><span>Automation {form.enabled ? "enabled" : "paused"}</span><input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} /></label>
      <div><label className="mb-[8px] block text-[14px] font-medium text-gray-800">Regional report threshold</label><input className={inputClass} type="number" min="1" step="1" value={form.threshold} onChange={(event) => setForm((current) => ({ ...current, threshold: event.target.value }))} /><p className="mt-[6px] text-[12px] text-gray-500">An alert triggers only when the regional total is greater than this threshold.</p></div>
      <div><label className="mb-[8px] block text-[14px] font-medium text-gray-800">Reporting window and reconciliation interval</label><select className={inputClass} value={form.intervalMinutes} onChange={(event) => setForm((current) => ({ ...current, intervalMinutes: event.target.value }))}>{INTERVALS.map(([minutes, label]) => <option key={minutes} value={minutes}>{label}</option>)}</select></div>
      <div className="rounded-[8px] bg-[#F8FAFC] p-[12px] text-xs leading-5 text-gray-600"><p>Status: {settings?.status || "Paused"}</p><p>Last successful evaluation: {settings?.lastSuccessfulEvaluation ? displayDate(settings.lastSuccessfulEvaluation) : "Not yet evaluated"}</p><p>Next scheduled reconciliation: {displayDate(settings?.nextScheduledReconciliation)}</p>{settings?.lastEvaluationError && <p className="text-[#B42318]">Latest operational issue: {settings.lastEvaluationError}</p>}</div>
    </div>
  </ModalWithBody>;
}

SendAlertModal.propTypes = { onClose: PropTypes.func.isRequired, onSave: PropTypes.func.isRequired, isSaving: PropTypes.bool, settings: PropTypes.object, isLoading: PropTypes.bool };
SendAlertModal.defaultProps = { isSaving: false, settings: null, isLoading: false };
