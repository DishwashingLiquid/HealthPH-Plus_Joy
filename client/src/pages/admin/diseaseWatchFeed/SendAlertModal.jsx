import { useEffect, useState } from "react";
import PropTypes from "prop-types";

import ModalWithBody from "../../../components/admin/ModalWithBody";
import {
  ALERT_AUTOMATION_INTERVALS,
  normalizeAlertAutomationInterval,
} from "./alertAutomation";

const displayDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No check planned yet" : date.toLocaleString();
};

export default function SendAlertModal({ onClose, onSave, isSaving, settings, isLoading }) {
  const [form, setForm] = useState({ enabled: false, threshold: "5", intervalMinutes: "1440" });
  const [error, setError] = useState("");
  useEffect(() => {
    if (settings) setForm({
      enabled: Boolean(settings.enabled),
      threshold: String(settings.threshold || 5),
      intervalMinutes: String(normalizeAlertAutomationInterval(settings.intervalMinutes)),
    });
  }, [settings]);
  const submit = async () => {
    const threshold = Number(form.threshold);
    if (!Number.isInteger(threshold) || threshold < 1) { setError("Enter a whole number greater than 0."); return; }
    try {
      await onSave({ enabled: form.enabled, threshold, intervalMinutes: Number(form.intervalMinutes) });
    } catch (requestError) { setError(requestError?.data?.detail || "Could not save your alert choices. Please try again."); }
  };
  const inputClass = "w-full rounded-[8px] border border-[#E5E5E5] px-[12px] py-[10px] text-[14px] focus:border-[#6A8EB5] focus:outline-none";
  return <ModalWithBody onConfirm={submit} onConfirmLabel="Save choices" onCancel={onClose} onLoading={isSaving || isLoading} onLoadingLabel="Saving..." heading="Set Up Alerts" color="primary" additionalClasses="health-literacy-content-modal admin-brand-modal !top-[68px] !h-[calc(100vh-68px)] !pt-[20px]">
    <div className="flex max-h-[60vh] flex-col gap-[16px] overflow-y-auto p-[20px]">
      <div className="rounded-[10px] border border-[#D5E3F0] bg-[#F8FBFF] p-[14px] text-[13px] leading-[19px] text-gray-700"><p className="font-medium text-gray-800">How alerts work</p><p className="mt-1">The app counts health reports from each region. It checks new reports right away and checks again after the time you choose below. If a region has enough reports, the app prepares an alert. It waits 24 hours before making another alert about the same symptom in the same region. Reports are not confirmed illnesses.</p></div>
      {error && <p role="alert" className="rounded-[8px] bg-[#FFF6F6] p-[10px] text-[13px] text-[#B42318]">{error}</p>}
      <label className="flex items-center justify-between rounded-[8px] border border-[#E5E5E5] p-[12px] text-[14px] font-medium text-gray-800"><span>Automatic alerts: {form.enabled ? "On" : "Off"}</span><input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} /></label>
      <div><label className="mb-[8px] block text-[14px] font-medium text-gray-800">Make an alert when reports go above</label><input className={inputClass} type="number" min="1" step="1" value={form.threshold} onChange={(event) => setForm((current) => ({ ...current, threshold: event.target.value }))} /><p className="mt-[6px] text-[12px] text-gray-500">For example, if you enter 5, the app can make an alert when a region has 6 reports.</p></div>
      <div><label className="mb-[8px] block text-[14px] font-medium text-gray-800">How far back should we count reports?</label><select className={inputClass} value={form.intervalMinutes} onChange={(event) => setForm((current) => ({ ...current, intervalMinutes: event.target.value }))}>{ALERT_AUTOMATION_INTERVALS.map(({ minutes, label }) => <option key={minutes} value={minutes}>{label}</option>)}</select><p className="mt-[6px] text-[12px] text-gray-500">The app counts reports from this amount of time. It also checks again after this amount of time. New reports are checked right away.</p></div>
      <div className="rounded-[8px] bg-[#F8FAFC] p-[12px] text-xs leading-5 text-gray-600"><p>Saved choice: Automatic alerts are {settings?.enabled ? "on" : "off"}</p><p>Last checked: {settings?.lastSuccessfulEvaluation ? displayDate(settings.lastSuccessfulEvaluation) : "Not checked yet"}</p><p>Next automatic check: {displayDate(settings?.nextScheduledReconciliation)}</p>{settings?.lastEvaluationError && <p className="text-[#B42318]">Last problem: {settings.lastEvaluationError}</p>}</div>
    </div>
  </ModalWithBody>;
}

SendAlertModal.propTypes = { onClose: PropTypes.func.isRequired, onSave: PropTypes.func.isRequired, isSaving: PropTypes.bool, settings: PropTypes.object, isLoading: PropTypes.bool };
SendAlertModal.defaultProps = { isSaving: false, settings: null, isLoading: false };
