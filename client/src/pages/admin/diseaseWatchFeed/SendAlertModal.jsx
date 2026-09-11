import { useState } from "react";
import PropTypes from "prop-types";

import ModalWithBody from "../../../components/admin/ModalWithBody";

const REGIONS = ["NCR", "I", "II", "III", "IVA", "IVB", "V", "CAR", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "BARMM"];

export default function SendAlertModal({ onClose, onSchedule, isScheduling }) {
  const [form, setForm] = useState({ title: "", region: "", message: "", scheduledAt: "" });
  const [error, setError] = useState("");
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async () => {
    if (!form.title.trim() || !form.region || !form.message.trim() || !form.scheduledAt) {
      setError("Alert Description, Region, Alert Text, and an exact date and time are required.");
      return;
    }
    try {
      await onSchedule(form);
    } catch (requestError) {
      setError(requestError?.data?.detail || "The alert could not be scheduled.");
    }
  };
  const inputClass = "w-full rounded-[8px] border border-[#E5E5E5] px-[12px] py-[10px] text-[14px] focus:border-[#6A8EB5] focus:outline-none";
  return (
    <ModalWithBody
      onConfirm={submit}
      onConfirmLabel="Schedule Alert"
      onCancel={onClose}
      onLoading={isScheduling}
      onLoadingLabel="Scheduling..."
      heading="Send Alert"
      color="primary"
      additionalClasses="health-literacy-content-modal admin-brand-modal !top-[68px] !h-[calc(100vh-68px)] !pt-[20px]"
    >
      <div className="flex max-h-[60vh] flex-col gap-[16px] overflow-y-auto p-[20px]">
        <div className="rounded-[10px] border border-[#D5E3F0] bg-[#F8FBFF] p-[14px] text-[13px] leading-[19px] text-gray-700">
          Review submitted-symptom summaries before composing this alert. They are administrative counts, not diagnoses; alerts are only sent after your manual review.
        </div>
        {error && <p role="alert" className="rounded-[8px] bg-[#FFF6F6] p-[10px] text-[13px] text-[#B42318]">{error}</p>}
        <div><label className="mb-[8px] block text-[14px] font-medium text-gray-800">Alert Description *</label><input className={inputClass} name="title" value={form.title} onChange={update} maxLength="160" placeholder="Enter alert title" /></div>
        <div><label className="mb-[8px] block text-[14px] font-medium text-gray-800">Region *</label><select className={inputClass} name="region" value={form.region} onChange={update}><option value="">Select a region</option>{REGIONS.map((region) => <option key={region} value={region}>{region}</option>)}</select></div>
        <div><label className="mb-[8px] block text-[14px] font-medium text-gray-800">Alert Text *</label><textarea className={inputClass} name="message" value={form.message} onChange={update} maxLength="2000" rows="5" placeholder="Compose the reviewed mobile alert" /></div>
        <div><label className="mb-[8px] block text-[14px] font-medium text-gray-800">Scheduled date and time *</label><input className={inputClass} type="datetime-local" name="scheduledAt" value={form.scheduledAt} onChange={update} step="60" /><p className="mt-[6px] text-[12px] text-gray-500">Use an exact future Philippine date and time. Sent notifications cannot be withdrawn.</p></div>
      </div>
    </ModalWithBody>
  );
}

SendAlertModal.propTypes = { onClose: PropTypes.func.isRequired, onSchedule: PropTypes.func.isRequired, isScheduling: PropTypes.bool };
SendAlertModal.defaultProps = { isScheduling: false };
