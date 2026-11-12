import { useEffect, useState } from "react";
import PropTypes from "prop-types";

import ModalWithBody from "../../../components/admin/ModalWithBody";
import {
  ALERT_AUTOMATION_INTERVALS,
  alertIntervalLabel,
  hasSavedAlertSettings,
} from "./alertAutomation";

const displayDate = (value) => {
  if (!value) return "No check planned yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No check planned yet" : date.toLocaleString();
};

export default function SendAlertModal({ onClose, onSave, isSaving, settings, isLoading }) {
  const [form, setForm] = useState(() => ({ enabled: settings?.enabled ?? false, threshold: settings?.threshold == null ? "" : String(settings.threshold), intervalMinutes: settings?.intervalMinutes == null ? "" : String(settings.intervalMinutes) }));
  const [error, setError] = useState("");
  useEffect(() => {
    if (hasSavedAlertSettings(settings)) setForm({
      enabled: settings.enabled,
      threshold: String(settings.threshold),
      intervalMinutes: String(settings.intervalMinutes),
    });
  }, [settings]);
  const submit = async () => {
    if (isLoading || !hasSavedAlertSettings(settings)) return;
    const threshold = Number(form.threshold);
    if (!Number.isInteger(threshold) || threshold < 1) { setError("Enter a whole number greater than 0."); return; }
    try {
      await onSave({ enabled: form.enabled, threshold, intervalMinutes: Number(form.intervalMinutes) });
    } catch (requestError) { setError(requestError?.data?.detail || "Could not save your alert choices. Please try again."); }
  };
  const inputClass = "w-full rounded-[8px] border border-[#E5E5E5] px-[12px] py-[10px] text-[14px] focus:border-[#6A8EB5] focus:outline-none";
  return <ModalWithBody onConfirm={submit} onConfirmDisabled={!hasSavedAlertSettings(settings)} onConfirmLabel="Save choices" onCancel={onClose} onLoading={isSaving || isLoading} onLoadingLabel="Saving..." heading="Set Up Alerts" color="brand" additionalClasses="health-literacy-content-modal admin-brand-modal !top-[68px] !h-[calc(100vh-68px)] !pt-[20px]">
    <div className="flex max-h-[60vh] flex-col gap-[16px] overflow-y-auto p-[20px]">
      <div className="rounded-[10px] border border-[#D5E3F0] bg-[#F8FBFF] p-[14px] text-[13px] leading-[19px] text-gray-700">
        <p className="font-medium text-gray-800">How alerts work</p>
        <p className="mt-1">Create an alert when a region has more symptom reports than the limit below. These are not confirmed diagnoses.</p>
      </div>
      {error && <p role="alert" className="rounded-[8px] bg-[#FFF6F6] p-[10px] text-[13px] text-[#B42318]">{error}</p>}
      <fieldset disabled={isLoading || isSaving || !hasSavedAlertSettings(settings)} className="flex flex-col gap-4">
      <label className="flex items-center justify-between rounded-[8px] border border-[#E5E5E5] p-[12px] text-[14px] font-medium text-gray-800"><span>Automatic alerts: {form.enabled ? "On" : "Off"}</span><input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} /></label>
      <p className="-mt-2 text-xs text-gray-500">Turning alerts off stops new checks. Alerts already being prepared may still become available.</p>
      <div>
        <label htmlFor="alert-report-limit" className="mb-[8px] block text-[14px] font-medium text-gray-800">Create an alert when reports exceed</label>
        <input id="alert-report-limit" aria-describedby="alert-report-limit-help" className={inputClass} type="number" min="1" step="1" value={form.threshold} onChange={(event) => setForm((current) => ({ ...current, threshold: event.target.value }))} />
        <p id="alert-report-limit-help" className="mt-[6px] text-[12px] text-gray-500">For example, enter 5 to allow an alert at 6 or more reports in a region.</p>
      </div>
      <div>
        <label htmlFor="alert-time-period" className="mb-[8px] block text-[14px] font-medium text-gray-800">Time period</label>
        <select id="alert-time-period" aria-describedby="alert-time-period-help" className={inputClass} value={form.intervalMinutes} onChange={(event) => setForm((current) => ({ ...current, intervalMinutes: event.target.value }))}><option value="" disabled>Unavailable</option>{ALERT_AUTOMATION_INTERVALS.map(({ minutes, label }) => <option key={minutes} value={minutes}>{label}</option>)}</select>
        <div id="alert-time-period-help" className="mt-[6px] text-[12px] leading-5 text-gray-500">
          {form.intervalMinutes ? <ul className="list-disc space-y-1 pl-5">
            <li>Count reports from the past {alertIntervalLabel(form.intervalMinutes)}.</li>
            <li>Run an automatic check every {alertIntervalLabel(form.intervalMinutes)}.</li>
            <li>Wait {alertIntervalLabel(form.intervalMinutes)} before another alert for the same symptom in the same region.</li>
          </ul> : <p>Load saved settings to see the time period.</p>}
        </div>
      </div>
      </fieldset>
      <details className="text-xs leading-5 text-gray-600">
        <summary className="w-fit cursor-pointer font-medium text-gray-800">More about report checks</summary>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>When automatic alerts are on, new reports are checked as they arrive. Scheduled checks also look for recent reports that may have been missed.</li>
          <li>Only reports within the selected time period that have not already been used for an alert count toward the limit. Reports stay in Self-Reports afterward.</li>
          <li>An alert is only created if at least one symptom is new or its waiting period has ended.</li>
          <li>Changing the time period also changes existing waits, measured from when each wait began.</li>
          <li>Check reports now uses your saved settings. Save changes before running a check.</li>
        </ul>
      </details>
      {hasSavedAlertSettings(settings) ? <div className="rounded-[8px] bg-[#F8FAFC] p-[12px] text-xs leading-5 text-gray-600"><p>Saved settings: Automatic alerts {settings.enabled ? "on" : "off"}; time period: {alertIntervalLabel(settings.intervalMinutes)}</p><p>Last checked: {settings.lastSuccessfulEvaluation ? displayDate(settings.lastSuccessfulEvaluation) : "Not checked yet"}</p><p>Next automatic check: {displayDate(settings.nextScheduledReconciliation)}</p>{settings.lastEvaluationError && <div className="text-[#B42318]">Last check could not finish. <details><summary className="w-fit cursor-pointer">View technical details</summary><p>{settings.lastEvaluationError}</p></details></div>}</div> : <p role="alert">Saved settings are unavailable. Close this window and retry loading settings.</p>}
    </div>
  </ModalWithBody>;
}

SendAlertModal.propTypes = { onClose: PropTypes.func.isRequired, onSave: PropTypes.func.isRequired, isSaving: PropTypes.bool, settings: PropTypes.object, isLoading: PropTypes.bool };
SendAlertModal.defaultProps = { isSaving: false, settings: null, isLoading: false };
