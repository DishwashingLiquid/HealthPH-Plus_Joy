import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { formatDistanceToNow } from "date-fns";
import RegionalSummaryList from "./RegionalSummaryList";
import {
  ALERT_AUTOMATION_INTERVALS,
  getRunEvaluationControlState,
  normalizeAlertAutomationInterval,
} from "./alertAutomation";

const REPORTS_PER_PAGE = 5;
const ENTITY_STYLES = { disease: { backgroundColor: "#32418C30", color: "#32418C" }, symptom: { backgroundColor: "#2572A530", color: "#2572A5" }, location: { backgroundColor: "#FBD11730", color: "#FBD117" } };
const relativeDate = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : formatDistanceToNow(date, { addSuffix: true }); };
const exactDate = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(); };
function Highlight({ label, tone }) { return <span className="rounded-[6px] px-[6px] py-[2px] text-sm font-medium" style={ENTITY_STYLES[tone]}>{label}</span>; }
Highlight.propTypes = { label: PropTypes.string.isRequired, tone: PropTypes.oneOf(["disease", "symptom", "location"]).isRequired };
function SelfReportCard({ alert }) { const parts = alert.summarySegments || []; return <article className="rounded-[12px] border border-[#E5E5E5] bg-white p-[16px]"><div className="mb-[8px] flex flex-wrap items-center gap-[8px]"><h3 className="text-[16px] font-semibold text-gray-800"><Highlight label={alert.disease} tone="disease" /></h3><span className="rounded-[4px] bg-[#FFF3CD] px-[8px] py-[2px] text-xs font-medium text-[#856404]">{alert.type}</span></div><p className="mb-[8px] text-[15px] leading-[1.8] text-gray-800">{parts.length ? parts.map((part, index) => part.type === "entity" ? <Highlight key={`${alert.id}-${index}`} label={part.label} tone={part.tone} /> : <span key={`${alert.id}-${index}`}>{part.value}</span>) : alert.summary}</p><div className="text-xs text-gray-500">Region: <Highlight label={alert.region} tone="location" /> · Updated: {relativeDate(alert.timestamp)}</div></article>; }
SelfReportCard.propTypes = { alert: PropTypes.object.isRequired };

function SummaryPreview({ preview }) {
  if (!preview) return null;
  const symptoms = (preview.symptomCounts || []).map((item) => `${item.symptom} (${Number(item.count || 0).toLocaleString()})`).join(", ");
  return <section aria-label="Reports counted for this alert" className="mt-3 rounded-[8px] border border-[#D5E3F0] bg-[#F8FBFF] p-3 text-xs leading-5 text-gray-700"><p className="font-semibold text-gray-800">Reports counted for this alert</p><p>{Number(preview.reportCount || 0).toLocaleString()} reports counted.</p>{symptoms && <p>Reported symptoms: {symptoms}</p>}{preview.windowStart && preview.windowEnd && <p>Reports from: {exactDate(preview.windowStart)} – {exactDate(preview.windowEnd)}</p>}<p className="mt-1 text-gray-500">This list goes away once the alert is prepared for users.</p></section>;
}
SummaryPreview.propTypes = { preview: PropTypes.shape({ reportCount: PropTypes.number, symptomCounts: PropTypes.arrayOf(PropTypes.shape({ symptom: PropTypes.string, count: PropTypes.number })), windowStart: PropTypes.string, windowEnd: PropTypes.string }) };
SummaryPreview.defaultProps = { preview: null };

const AUTOMATIC_STATUS_LABELS = {
  Preparing: "Being prepared",
  Published: "Prepared",
  "Preparation failed": "Could not prepare",
};

function AlertCards({ alerts, onCancel, cancellingId }) {
  if (!alerts.length) return <p className="text-sm text-gray-500">No alerts to show yet.</p>;
  return <div className="grid grid-cols-1 gap-[12px]">{alerts.map((alert) => {
    const intervalLabel = ALERT_AUTOMATION_INTERVALS.find(({ minutes }) => minutes === Number(alert.intervalMinutes))?.label || `${alert.intervalMinutes} minutes`;
    return <article key={alert.id} className="rounded-[12px] border border-[#E5E5E5] bg-white p-[16px]">
      <div className="flex gap-3">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF3CD] text-lg text-[#856404]">!</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[16px] font-semibold text-gray-800">{alert.title}</h3>
            <div className="flex gap-2">
              {alert.automated && <span className="rounded-full bg-[#F3E8FF] px-2 py-1 text-xs font-semibold text-[#7E22CE]">Made automatically</span>}
              <span className="rounded-full bg-[#EFF8FF] px-2 py-1 text-xs font-semibold text-[#175CD3]">{alert.automated ? AUTOMATIC_STATUS_LABELS[alert.status] || alert.status : alert.status}</span>
            </div>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{alert.message}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500">
            <span>Region: {alert.region}</span>
            {alert.automated ? <>
              <span>Made {relativeDate(alert.generatedAt)}</span>
              <span>Reports counted: {Number(alert.reportCount || 0).toLocaleString()}</span>
              <span>Reports from the last {intervalLabel}</span>
              <span className="font-medium text-gray-700">{alert.status === "Preparing" ? "Getting the alert ready for app users." : `Prepared for ${Number(alert.recipientCount || 0).toLocaleString()} app users.`} This does not mean they received it.</span>
            </> : <>
              <span>{alert.status === "Sent" ? `Marked as sent ${relativeDate(alert.sentAt)}` : alert.status === "Cancelled" ? `Cancelled ${exactDate(alert.cancelledAt)}` : `Scheduled for ${exactDate(alert.scheduledAt)}`}</span>
              <span className="font-medium text-gray-700">Marked as sent to {Number(alert.recipientCount || 0).toLocaleString()} users</span>
            </>}
          </div>
          <SummaryPreview preview={alert.summaryPreview} />
          {alert.deliveryError && <p role="alert" className="mt-2 text-xs text-[#B42318]">Problem getting the alert ready: {alert.deliveryError}</p>}
          {!alert.automated && alert.status === "Scheduled" && <button type="button" onClick={() => onCancel(alert.id)} disabled={cancellingId === alert.id} className="mt-3 rounded-[6px] border border-[#F04438] px-3 py-1.5 text-xs font-medium text-[#B42318] disabled:opacity-60">{cancellingId === alert.id ? "Cancelling..." : "Cancel alert"}</button>}
        </div>
      </div>
    </article>;
  })}</div>;
}
AlertCards.propTypes = { alerts: PropTypes.arrayOf(PropTypes.object).isRequired, onCancel: PropTypes.func.isRequired, cancellingId: PropTypes.string.isRequired };

export default function RecentAlertsTab({ alerts, summaries, sentAlerts, canSendAlert, onSendAlert, onCancelAlert, cancellingId, errorMessage, isLoading, isSummariesLoading, isSummariesFetching, summariesErrorMessage, alertSettings, onRunEvaluation, isEvaluationRunning, evaluationFeedback }) {
  const [page, setPage] = useState(1); const pageCount = Math.max(1, Math.ceil(alerts.length / REPORTS_PER_PAGE));
  const [evaluationInterval, setEvaluationInterval] = useState(String(normalizeAlertAutomationInterval(alertSettings?.intervalMinutes)));
  const evaluationControl = getRunEvaluationControlState(alertSettings, isEvaluationRunning);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  useEffect(() => { setEvaluationInterval(String(normalizeAlertAutomationInterval(alertSettings?.intervalMinutes))); }, [alertSettings?.intervalMinutes]);
  const currentReports = useMemo(() => alerts.slice((page - 1) * REPORTS_PER_PAGE, page * REPORTS_PER_PAGE), [alerts, page]);
  if (isLoading) return <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[16px] text-sm text-gray-500">Loading self-reports and alert history...</div>;
  if (errorMessage) return <div role="alert" className="rounded-[12px] border border-[#F2CACA] bg-[#FFF6F6] px-[20px] py-[18px] text-sm text-[#B42318]">{errorMessage}</div>;
  return (
    <div className="flex flex-col gap-[20px]">
      <section className="rounded-[12px] border border-[#E5E5E5] bg-[#FCFCFD] p-[16px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Self-Reports</h2>
            <p className="mt-1 text-sm text-gray-500">
              Submitted symptoms and saved regional administrative summaries. These are not diagnoses.
            </p>
          </div>
          {canSendAlert && (
            <button type="button" onClick={onSendAlert} className="prod-btn-base prod-btn-primary send-alert-button whitespace-nowrap" style={{ backgroundColor: "#27346f" }}>
              Set Up Alerts
            </button>
          )}
        </div>

        <RegionalSummaryList summaries={summaries} isLoading={isSummariesLoading} isFetching={isSummariesFetching} errorMessage={summariesErrorMessage} />

        <div className="mt-4 grid grid-cols-1 gap-[12px]">
          {currentReports.length
            ? currentReports.map((alert) => <SelfReportCard key={alert.id} alert={alert} />)
            : <p className="rounded-[10px] bg-white p-4 text-sm text-gray-500">No self-reports are available yet.</p>}
        </div>
        {alerts.length > REPORTS_PER_PAGE && (
          <nav aria-label="Self-report pages" className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Previous</button>
            <span className="px-3 py-1 text-sm">{page} / {pageCount}</span>
            <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page === pageCount} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Next</button>
          </nav>
        )}
      </section>

      <section className="rounded-[12px] border border-[#E5E5E5] bg-[#FCFCFD] p-[16px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Alert History</h2>
            <p className="mt-1 text-sm text-gray-500">See past alerts and alerts being prepared. A prepared alert may not have reached anyone yet.</p>
          </div>
          {canSendAlert && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="run-evaluation-interval">Evaluation interval</label>
              <select id="run-evaluation-interval" value={evaluationInterval} onChange={(event) => setEvaluationInterval(event.target.value)} disabled={evaluationControl.disabled} className="rounded-[6px] border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-60">
                {ALERT_AUTOMATION_INTERVALS.map(({ minutes, label }) => <option key={minutes} value={minutes}>{label}</option>)}
              </select>
              <button type="button" onClick={() => onRunEvaluation(Number(evaluationInterval))} disabled={evaluationControl.disabled} className="prod-btn-base prod-btn-primary whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60" style={{ backgroundColor: "#27346f" }}>
                {isEvaluationRunning ? "Checking reports..." : "Check reports now"}
              </button>
            </div>
          )}
        </div>
        {evaluationControl.helperText && <p className="mt-2 text-xs text-gray-500">{evaluationControl.helperText}</p>}
        {evaluationFeedback?.message && <p role={evaluationFeedback.type === "error" ? "alert" : "status"} className={`mt-3 rounded-[8px] p-3 text-sm ${evaluationFeedback.type === "error" ? "bg-[#FFF6F6] text-[#B42318]" : "bg-[#ECFDF3] text-[#027A48]"}`}>{evaluationFeedback.message}</p>}
        <div className="mt-4">
          <AlertCards alerts={sentAlerts} onCancel={onCancelAlert} cancellingId={cancellingId} />
        </div>
      </section>
    </div>
  );
}
RecentAlertsTab.propTypes = { alerts: PropTypes.arrayOf(PropTypes.object).isRequired, summaries: PropTypes.arrayOf(PropTypes.object), sentAlerts: PropTypes.arrayOf(PropTypes.object), canSendAlert: PropTypes.bool, onSendAlert: PropTypes.func, onCancelAlert: PropTypes.func, cancellingId: PropTypes.string, errorMessage: PropTypes.string, isLoading: PropTypes.bool, isSummariesLoading: PropTypes.bool, isSummariesFetching: PropTypes.bool, summariesErrorMessage: PropTypes.string, alertSettings: PropTypes.object, onRunEvaluation: PropTypes.func, isEvaluationRunning: PropTypes.bool, evaluationFeedback: PropTypes.shape({ type: PropTypes.oneOf(["success", "error"]), message: PropTypes.string }) };
RecentAlertsTab.defaultProps = { summaries: [], sentAlerts: [], canSendAlert: false, onSendAlert: () => {}, onCancelAlert: () => {}, cancellingId: "", errorMessage: "", isLoading: false, alertSettings: null, onRunEvaluation: () => {}, isEvaluationRunning: false, evaluationFeedback: null };
