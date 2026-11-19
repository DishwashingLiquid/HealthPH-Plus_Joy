/* eslint-disable react/prop-types */
import { formatCount, formatShare, isCount, isShare, SENTIMENT_COLORS, summaryState } from "./sentimentContract";

export default function SentimentSummary({ summary, row = summary, compact = false }) {
  const totals = summary?.totals || row;
  const state = summaryState(summary, row);
  if (!totals) return <p className="text-sm text-gray-500">Feedback sentiment: Unavailable</p>;
  return (
    <div className="space-y-3">
      <p className="font-semibold text-gray-800">Feedback sentiment: {state}</p>
      <p className="text-sm text-gray-600">{formatCount(totals.predictedAnswers)} feedback answers analyzed</p>
      {compact && totals.predictedAnswers > 0 && <p className="text-sm"><span style={{ color: SENTIMENT_COLORS.calm }}>Calm: {formatCount(totals.calm)}</span>{" · "}<span style={{ color: SENTIMENT_COLORS.worried }}>Worried: {formatCount(totals.worried)}</span></p>}
      {!compact && <>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[["Eligible text/choice answers", totals.eligibleAnswers], ["Analyzed text/choice answers", totals.predictedAnswers], ["Text/choice answers without results", totals.answersWithoutResults]].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-gray-50 p-3"><dt className="text-xs text-gray-600">{label}</dt><dd className="mt-1 text-xl font-semibold text-gray-900">{formatCount(value)}</dd></div>
          ))}
        </dl>
        {isCount(totals.predictedAnswers) && totals.predictedAnswers > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {["calm", "worried"].map((label) => <div key={label}>
              <p className="text-sm font-semibold" style={{ color: SENTIMENT_COLORS[label] }}>{label === "calm" ? "Calm" : "Worried"}: {formatCount(totals[label])} answers</p>
              <progress className="mt-1 h-2 w-full" style={{ accentColor: SENTIMENT_COLORS[label] }} value={totals[label]} max={totals.predictedAnswers} aria-label={`${label} answers`} />
            </div>)}
          </div>
        )}
        <p className="text-xs leading-relaxed text-gray-600">Worried share uses classified text/choice answers (calm + worried), not unique respondents. A model probability is neither a satisfaction score nor a verified confidence level.</p>
      </>}
      {isCount(totals.answersWithoutResults) && totals.answersWithoutResults > 0 && (
        <p className="text-sm text-warning-800">Incomplete coverage: {formatCount(totals.answersWithoutResults)} eligible text/choice answers have no available prediction. Their processing status is unknown.</p>
      )}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-sm font-semibold text-gray-800">Satisfaction: {row?.satisfactionStatus === "not_configured" ? "Not configured" : formatShare(totals.satisfactionShare)}</p>
        {compact && isShare(totals.satisfactionShare) && <p className="mt-1 text-xs text-gray-600">{formatCount(totals.satisfiedAnswers)} of {formatCount(totals.satisfactionAnswers)} valid scored answers</p>}
        {!compact && <p className="mt-1 text-xs text-gray-600">{isShare(totals.satisfactionShare) ? `${formatCount(totals.satisfiedAnswers)} satisfied answers out of ${formatCount(totals.satisfactionAnswers)} valid scored answers.` : "No satisfaction percentage is available for this scope."} Satisfaction is scored separately from calm/worried.</p>}
        {!compact && isCount(totals.satisfactionAnswers) && totals.satisfactionAnswers > 0 && <p className="mt-2 text-xs text-gray-600">Dissatisfied: {formatCount(totals.dissatisfiedAnswers)} · Neutral satisfaction: {formatCount(totals.neutralSatisfactionAnswers)}. For 1–5 ratings: 1–2 dissatisfied, 3 neutral, 4–5 satisfactory.</p>}
      </div>
    </div>
  );
}
