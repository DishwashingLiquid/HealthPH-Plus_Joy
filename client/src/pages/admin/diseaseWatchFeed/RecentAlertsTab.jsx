import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { formatDistanceToNow } from "date-fns";
import {
  alertIntervalLabel,
  getRunEvaluationControlState,
} from "./alertAutomation";
import { alertStatusLabel, recipientAssignmentLabel } from "./alertHistory";

const REPORTS_PER_PAGE = 5;
const ENTITY_STYLES = { disease: { backgroundColor: "#32418C30", color: "#32418C" }, symptom: { backgroundColor: "#2572A530", color: "#2572A5" }, location: { backgroundColor: "#FBD11730", color: "#FBD117" } };
const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const relativeDate = (value) => { const date = parseDate(value); return date ? formatDistanceToNow(date, { addSuffix: true }) : "Unavailable"; };
const exactDate = (value) => { const date = parseDate(value); return date ? date.toLocaleString() : "Unavailable"; };
function Highlight({ label, tone }) { return <span className="rounded-[6px] px-[6px] py-[2px] text-sm font-medium" style={ENTITY_STYLES[tone]}>{label}</span>; }
Highlight.propTypes = { label: PropTypes.string.isRequired, tone: PropTypes.oneOf(["disease", "symptom", "location"]).isRequired };
function SelfReportCard({ alert }) { const parts = alert.summarySegments || []; return <article className="rounded-[12px] border border-[#E5E5E5] bg-white p-[16px]"><div className="mb-[8px] flex flex-wrap items-center gap-[8px]"><h3 className="text-[16px] font-semibold text-gray-800"><Highlight label={alert.disease} tone="disease" /></h3><span className="rounded-[4px] bg-[#FFF3CD] px-[8px] py-[2px] text-xs font-medium text-[#856404]">{alert.type}</span></div><p className="mb-[8px] text-[15px] leading-[1.8] text-gray-800">{parts.length ? parts.map((part, index) => part.type === "entity" ? <Highlight key={`${alert.id}-${index}`} label={part.label} tone={part.tone} /> : <span key={`${alert.id}-${index}`}>{part.value}</span>) : alert.summary}</p><div className="text-xs text-gray-500">Region: <Highlight label={alert.region} tone="location" /> · Updated: {relativeDate(alert.timestamp)}</div></article>; }
SelfReportCard.propTypes = { alert: PropTypes.object.isRequired };

function AlertCards({ alerts, onCancel, cancellingId, canCancel }) {
  if (!alerts.length) return <p className="text-sm text-gray-500">No alerts to show yet.</p>;
  return <div className="grid grid-cols-1 gap-[12px]">{alerts.map((alert) => {
    const intervalLabel = alertIntervalLabel(alert.intervalMinutes);
    const reportCount = alert.reportCount == null ? "Report count unavailable" : `${Number(alert.reportCount).toLocaleString()} symptom ${Number(alert.reportCount) === 1 ? "report" : "reports"}`;
    // Historical messages describe the period recorded for the alert, not now.
    const message = alert.automated ? (alert.message || "").replace(/^\d+ self-reports were recorded in [^\r\n]+ during the last \d+ (?:minutes?|hours?)\.\s*/, "") : alert.message;
    return <article key={alert.id} className="rounded-[12px] border border-[#E5E5E5] bg-white p-[16px]">
      <div className="flex gap-3">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF3CD] text-lg text-[#856404]">!</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[16px] font-semibold text-gray-800">{alert.automated ? `${alert.region || "Region unavailable"} · ${reportCount}` : alert.title}</h3>
            <div className="flex gap-2">
              {alert.automated && <span className="rounded-full bg-[#F3E8FF] px-2 py-1 text-xs font-semibold text-[#7E22CE]">Made automatically</span>}
              <span className="rounded-full bg-[#EFF8FF] px-2 py-1 text-xs font-semibold text-[#175CD3]">{alertStatusLabel(alert)}</span>
            </div>
          </div>
          {alert.automated && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
            <span>Reports from: {exactDate(alert.windowStart)}</span>
            <span>Reports to: {exactDate(alert.windowEnd)}</span>
          </div>}
          {message && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{message}</p>}
          <p role={alert.status === "Preparation failed" ? "alert" : undefined} className={`mt-3 text-sm font-medium ${alert.status === "Preparation failed" ? "text-[#B42318]" : "text-gray-700"}`}>{recipientAssignmentLabel(alert)}</p>
          <details className="mt-3 text-xs text-gray-500">
            <summary className="w-fit cursor-pointer font-medium text-gray-700">View alert details</summary>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500">
            <span>Alert title: {alert.title || "Unavailable"}</span>
            <span>Region: {alert.region || "Unavailable"}</span>
            <span>Alert created: {exactDate(alert.generatedAt)}{parseDate(alert.generatedAt) && ` (${relativeDate(alert.generatedAt)})`}</span>
            {alert.automated ? <>
              <span>Reports counted: {alert.reportCount == null ? "Unavailable" : Number(alert.reportCount).toLocaleString()}</span>
              <span>Report period: {intervalLabel}</span>
            </> : <>
              <span>{alert.status === "Sent" ? `Recipients queued ${relativeDate(alert.sentAt)}` : alert.status === "Cancelled" ? `Cancelled ${exactDate(alert.cancelledAt)}` : `Scheduled for ${exactDate(alert.scheduledAt)}`}</span>
            </>}
          </div>
          {alert.deliveryError && <p className="mt-2 text-xs text-[#B42318]">Technical details: {alert.deliveryError}</p>}
          </details>
          {!alert.automated && alert.status === "Scheduled" && new Date(alert.scheduledAt) > new Date() && <button type="button" onClick={() => onCancel(alert.id)} disabled={!canCancel || cancellingId === alert.id} className="mt-3 rounded-[6px] border border-[#F04438] px-3 py-1.5 text-xs font-medium text-[#B42318] disabled:opacity-60">{cancellingId === alert.id ? "Cancelling..." : "Cancel alert"}</button>}
        </div>
      </div>
    </article>;
  })}</div>;
}
AlertCards.propTypes = { alerts: PropTypes.arrayOf(PropTypes.object).isRequired, onCancel: PropTypes.func.isRequired, cancellingId: PropTypes.string.isRequired, canCancel: PropTypes.bool };

function SectionData({ label, hasData, isLoading, isFetching, errorMessage, onRetry, children }) {
  return <>
    {errorMessage && <div role="alert" className="mb-3 text-sm text-[#B42318]">{errorMessage} {hasData && `Showing last loaded ${label.toLowerCase()}; this data may be out of date.`} <button type="button" onClick={onRetry} className="underline">Retry {label.toLowerCase()}</button></div>}
    {!hasData && !errorMessage && (isLoading || isFetching) && <p role="status" className="text-sm text-gray-500">Loading {label.toLowerCase()}...</p>}
    {hasData && <>{isFetching && <p role="status" className="mb-2 text-xs text-gray-500">Refreshing {label.toLowerCase()}...</p>}{children}</>}
  </>;
}
SectionData.propTypes = { label: PropTypes.string.isRequired, hasData: PropTypes.bool, isLoading: PropTypes.bool, isFetching: PropTypes.bool, errorMessage: PropTypes.string, onRetry: PropTypes.func, children: PropTypes.node };

export default function RecentAlertsTab({ alerts, sentAlerts, canSendAlert, onSendAlert, onCancelAlert, cancellingId, reportsErrorMessage, historyErrorMessage, hasReportsData, hasHistoryData, isReportsLoading, isReportsFetching, isHistoryLoading, isHistoryFetching, onRetryReports, onRetryHistory, alertSettings, settingsErrorMessage, isSettingsLoading, onRetrySettings, onRunEvaluation, isEvaluationRunning, evaluationFeedback }) {
  const [page, setPage] = useState(1); const pageCount = Math.max(1, Math.ceil(alerts.length / REPORTS_PER_PAGE));
  const evaluationControl = getRunEvaluationControlState(settingsErrorMessage || isSettingsLoading ? null : alertSettings, isEvaluationRunning);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const currentReports = useMemo(() => alerts.slice((page - 1) * REPORTS_PER_PAGE, page * REPORTS_PER_PAGE), [alerts, page]);
  return (
    <div className="flex flex-col gap-[20px]">
      {isSettingsLoading && <p role="status" className="text-sm text-gray-500">Loading saved alert settings...</p>}
      {settingsErrorMessage && <p role="alert" className="text-sm text-[#B42318]">{settingsErrorMessage} Alert controls are unavailable until settings load. <button type="button" onClick={onRetrySettings} className="underline">Retry settings</button></p>}
      <section className="rounded-[12px] border border-[#E5E5E5] bg-[#FCFCFD] p-[16px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 basis-[320px]">
            <h2 className="text-lg font-semibold text-gray-800">Self-Reports</h2>
            <p className="mt-1 text-sm text-gray-500">
              Symptoms reported by app users. These are not confirmed diagnoses.
            </p>
            <details className="mt-2 text-xs text-gray-500"><summary className="w-fit cursor-pointer">About these reports</summary><p className="mt-1">Reports stay in this list after an alert is created. Each alert shows the reports counted at the time it was created.</p></details>
          </div>
          <button type="button" onClick={onSendAlert} disabled={!canSendAlert} className="prod-btn-base prod-btn-primary send-alert-button ml-auto shrink-0 whitespace-nowrap disabled:opacity-60" style={{ backgroundColor: "#27346f" }}>
              Set Up Alerts
            </button>
        </div>

        <SectionData label="Self-reports" hasData={hasReportsData} isLoading={isReportsLoading} isFetching={isReportsFetching} errorMessage={reportsErrorMessage} onRetry={onRetryReports}>
        <div className="mt-4 grid grid-cols-1 gap-[12px]">
          {currentReports.length
            ? currentReports.map((alert) => <SelfReportCard key={alert.id} alert={alert} />)
            : <p className="rounded-[10px] bg-white p-4 text-sm text-gray-500">{reportsErrorMessage ? "The last successful response contained no self-reports." : "No self-reports are available yet."}</p>}
        </div>
        {alerts.length > REPORTS_PER_PAGE && (
          <nav aria-label="Self-report pages" className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Previous</button>
            <span className="px-3 py-1 text-sm">{page} / {pageCount}</span>
            <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page === pageCount} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Next</button>
          </nav>
        )}
        </SectionData>
      </section>

      <section className="rounded-[12px] border border-[#E5E5E5] bg-[#FCFCFD] p-[16px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 basis-[320px]">
            <h2 className="text-lg font-semibold text-gray-800">Alert History</h2>
            <p className="mt-1 text-sm text-gray-500">Past alerts and their availability in app inboxes.</p>
            <p className="mt-1 text-xs text-gray-500">This page does not show whether notifications were received or alerts were read.</p>
          </div>
            <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
              <p className="text-xs text-gray-500">{evaluationControl.intervalMinutes == null ? "Report period: Unavailable" : `Checks reports from the past ${alertIntervalLabel(evaluationControl.intervalMinutes)}.`}</p>
              <button type="button" onClick={() => onRunEvaluation()} disabled={!canSendAlert || evaluationControl.disabled} className="prod-btn-base prod-btn-primary whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60" style={{ backgroundColor: "#27346f" }}>
                {isEvaluationRunning ? "Checking reports..." : "Check reports now"}
              </button>
            </div>
        </div>
        {evaluationControl.helperText && <p className="mt-2 text-xs text-gray-500">{evaluationControl.helperText}</p>}
        {evaluationFeedback?.message && <p role={evaluationFeedback.type === "error" ? "alert" : "status"} className={`mt-3 rounded-[8px] p-3 text-sm ${evaluationFeedback.type === "error" ? "bg-[#FFF6F6] text-[#B42318]" : "bg-[#ECFDF3] text-[#027A48]"}`}>{evaluationFeedback.message}</p>}
        <div className="mt-4">
          <SectionData label="Alert history" hasData={hasHistoryData} isLoading={isHistoryLoading} isFetching={isHistoryFetching} errorMessage={historyErrorMessage} onRetry={onRetryHistory}>
            {historyErrorMessage && !sentAlerts.length ? <p className="text-sm text-gray-500">The last successful response contained no alerts.</p> : <AlertCards alerts={sentAlerts} onCancel={onCancelAlert} cancellingId={cancellingId} canCancel={canSendAlert} />}
          </SectionData>
        </div>
      </section>
    </div>
  );
}
RecentAlertsTab.propTypes = {
  alerts: PropTypes.arrayOf(PropTypes.object).isRequired, sentAlerts: PropTypes.arrayOf(PropTypes.object),
  canSendAlert: PropTypes.bool, onSendAlert: PropTypes.func, onCancelAlert: PropTypes.func, cancellingId: PropTypes.string,
  reportsErrorMessage: PropTypes.string, historyErrorMessage: PropTypes.string, hasReportsData: PropTypes.bool, hasHistoryData: PropTypes.bool,
  isReportsLoading: PropTypes.bool, isReportsFetching: PropTypes.bool, isHistoryLoading: PropTypes.bool, isHistoryFetching: PropTypes.bool,
  onRetryReports: PropTypes.func, onRetryHistory: PropTypes.func,
  alertSettings: PropTypes.object, settingsErrorMessage: PropTypes.string, isSettingsLoading: PropTypes.bool, onRetrySettings: PropTypes.func,
  onRunEvaluation: PropTypes.func, isEvaluationRunning: PropTypes.bool,
  evaluationFeedback: PropTypes.shape({ type: PropTypes.oneOf(["success", "error"]), message: PropTypes.string }),
};
RecentAlertsTab.defaultProps = { sentAlerts: [], canSendAlert: false, onSendAlert: () => {}, onCancelAlert: () => {}, cancellingId: "", alertSettings: null, onRunEvaluation: () => {}, isEvaluationRunning: false, evaluationFeedback: null };
