/* eslint-disable react/prop-types */
// Keep worker-local job status separate from durable stored-answer coverage.
import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { sentimentPulseApi, useFetchSentimentPulseProcessingQuery, useProcessSentimentPulseSurveyMutation } from "../../../features/api/sentimentPulseSlice";
import SentimentSummary from "./SentimentSummary";
import { formatCount, formatShare, isActiveJob, jobLabel, processNotice, surveyAggregate, surveyCardSentiment } from "./sentimentContract";

const cardColors = { calm: "#15803D", worried: "#DC2626" };

export function SurveySentiment({ surveyId, ended }) {
  // Share the Process button's cached status and polling results; no raw-entry reads.
  const query = useFetchSentimentPulseProcessingQuery(surveyId, { skip: !ended });
  const summary = query.currentData?.summary;
  const assessment = !ended ? { label: "Not processed", share: null }
    : query.isError ? { label: "Unavailable", share: null }
      : !query.currentData ? { label: "Loading...", share: null }
        : surveyCardSentiment(summary);
  const color = cardColors[assessment.kind] || "#6B7280";
  return (
    <div className="w-fit max-w-[190px] self-center text-center lg:shrink-0" role="status" aria-live="polite" aria-atomic="true">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sentiment</p>
      <p className="mt-[6px] text-[28px] font-semibold leading-none" style={{ color }}>
        {assessment.share === null ? <>&mdash;</> : <>{formatShare(assessment.share)}{assessment.kind === "tie" && <span className="text-sm"> each</span>}</>}
      </p>
      <p className="mt-[4px] text-sm font-semibold" style={{ color }}>
        {assessment.kind === "tie" ? <><span style={{ color: cardColors.calm }}>Calm</span> / <span style={{ color: cardColors.worried }}>Worried</span></> : assessment.label}
      </p>
      {assessment.share !== null && <p className="mt-2 text-xs text-gray-500">
        {formatCount(summary.totals.predictedAnswers)} of {formatCount(summary.totals.eligibleAnswers)} answers analyzed
      </p>}
      <p className="sr-only">Whole-survey mobile text and choice answers, all dates and regions. Percentage of classified answers, not unique respondents or a satisfaction score.</p>
    </div>
  );
}

export default function SurveyFeedback({ surveyId, ended, onSnapshot, detailed = false, buttonOnly = false }) {
  const [fastPolling, setFastPolling] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [isActionPending, setIsActionPending] = useState(false);
  const inFlight = useRef(false);
  const previousCoverage = useRef();
  const dispatch = useDispatch();
  const query = useFetchSentimentPulseProcessingQuery(surveyId, {
    skip: !ended, pollingInterval: fastPolling ? 5000 : 60000,
    refetchOnMountOrArgChange: true, refetchOnFocus: true,
  });
  const [processSurvey, { isLoading: isSending }] = useProcessSentimentPulseSurveyMutation({ fixedCacheKey: `sentiment-process-${surveyId}` });
  const data = query.currentData;
  const job = data?.job;
  const active = isActiveJob(job);

  useEffect(() => { setFastPolling(active); }, [active, data]);
  useEffect(() => {
    if (onSnapshot) onSnapshot(surveyId, { data, isError: query.isError, isFetching: query.isFetching });
  }, [surveyId, data, query.isError, query.isFetching, onSnapshot]);
  useEffect(() => {
    const coverage = data?.summary?.totals?.predictedAnswers;
    if (previousCoverage.current !== undefined && coverage !== undefined && previousCoverage.current !== coverage) {
      dispatch(sentimentPulseApi.util.invalidateTags([{ type: "SentimentPulseSurveys", id: "SENTIMENT_TRENDS" }]));
    }
    previousCoverage.current = coverage;
  }, [data?.summary?.totals?.predictedAnswers, dispatch]);

  const handleProcess = async () => {
    if (inFlight.current || isSending || active) return;
    inFlight.current = true;
    setIsActionPending(true);
    setActionError("");
    setNotice("");
    try {
      const result = await processSurvey(surveyId).unwrap();
      setNotice(processNotice(result));
      setFastPolling(isActiveJob(result.job));
      const refreshed = await query.refetch();
      setFastPolling(isActiveJob(refreshed.data?.job));
    } catch (error) {
      setActionError(typeof error?.data?.detail === "string" ? error.data.detail : "Unable to request processing. Refresh status before retrying.");
    } finally { inFlight.current = false; setIsActionPending(false); }
  };

  if (!ended) return <p className="text-sm text-gray-500">Written-feedback analysis is available after the survey ends.</p>;
  const processButton = (
    <button type="button" onClick={handleProcess} disabled={isSending || isActionPending || active}
      className="min-h-[40px] rounded-[10px] bg-[#32418C] px-[12px] py-[10px] text-sm font-medium text-white shadow-sm transition hover:bg-[#27346F] disabled:cursor-not-allowed disabled:opacity-50">{isSending || isActionPending ? "Requesting..." : active ? "Processing..." : "Process"}</button>
  );
  if (buttonOnly) return <>
    {processButton}
    {(notice || actionError || job?.error) && <p className={`col-span-3 text-xs ${actionError || job?.error ? "text-destructive-700" : "text-primary-800"}`} role={actionError || job?.error ? "alert" : "status"}>{actionError || job?.error || notice}</p>}
  </>;
  const row = surveyAggregate(data?.summary, surveyId);
  return (
    <section className="min-w-0 space-y-3" aria-label="Whole-survey feedback answers">
      <p className="text-xs text-gray-500">Whole-survey mobile answers · All dates and regions</p>
      {query.isError ? <p role="alert" className="text-sm text-destructive-700">Unable to load feedback results. No current summary is available.</p>
        : data ? <SentimentSummary summary={data.summary} row={row} compact={!detailed} />
          : <p className="text-sm text-gray-500">Loading feedback results...</p>}
      {data?.summary?.mixedModelVersions && <p className="text-xs text-warning-800">Includes multiple model versions.</p>}
      <div className="flex flex-wrap gap-2">
        {processButton}
        <button type="button" onClick={query.refetch} disabled={query.isFetching} className="min-h-[40px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 disabled:opacity-50">{query.isFetching ? "Refreshing..." : "Refresh status"}</button>
      </div>
      {notice && <p role="status" className="text-sm text-primary-800">{notice}</p>}
      {actionError && <p role="alert" className="text-sm text-destructive-700">{actionError}</p>}
      {job && <p className="text-sm text-gray-700">{jobLabel(job)}. {formatCount(job.stored)} annotations stored by this job.</p>}
      {data && !job && <p className="text-xs text-gray-600">No current job status is available on this worker. Use stored prediction coverage above.</p>}
      {job?.error && <p role="alert" className="text-sm text-destructive-700">{job.error}</p>}
      {data?.state === "not_configured" && <p className="text-xs text-gray-600">No supported text/choice questions or satisfaction rules are available for this survey.</p>}
      <p className="text-xs leading-relaxed text-gray-500">Job status is local to one server worker and may disappear after restart. Missing predictions do not identify queued or failed answers. Refresh coverage if job status is unavailable.</p>
    </section>
  );
}
