/* eslint-disable react/prop-types */
import { formatCount, formatShare, isCount, isShare, SENTIMENT_COLORS } from "./sentimentContract";
import { trendsMetrics } from "./trendsMetrics";

const displayShare = (value) => formatShare(value).replace(/\.0%$/, "%");

export default function TrendsOverview({ report }) {
  const totals = report.totals || {};
  const { sentiment, dominant, dominantShare, analysisCoverage } = trendsMetrics(report);
  const hasSentiment = report.sentimentStatus !== "not_configured" && dominant !== null;
  const hasCoverage = report.sentimentStatus !== "not_configured" && isShare(analysisCoverage);
  const hasSatisfaction = report.satisfactionStatus !== "not_configured" &&
    isCount(totals.satisfactionAnswers) && totals.satisfactionAnswers > 0 &&
    isCount(totals.satisfiedAnswers) && totals.satisfiedAnswers <= totals.satisfactionAnswers && isShare(totals.satisfactionShare);
  const categories = sentiment.filter(({ label }) => label !== "Neutral");
  const leadingLabel = dominant === "calm" ? "Calm" : "Worried";
  const leadingCount = totals[dominant];
  const sentimentState = report.sentimentStatus === "not_configured" ? "Sentiment unavailable"
    : totals.eligibleAnswers === 0 ? "No eligible answers"
      : totals.predictedAnswers === 0 ? "No analyzed results yet" : "Sentiment unavailable";
  const satisfactionState = report.satisfactionStatus === "not_configured" ? "Satisfaction unavailable"
    : totals.satisfactionAnswers === 0 ? "No scored satisfaction answers" : "Satisfaction unavailable";
  return <div className="space-y-4">
    <h3 className="text-lg font-semibold text-gray-800">Overall Sentiment</h3>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <section aria-label="Feedback Sentiment" className="min-w-0 space-y-3 rounded-lg border border-gray-100 bg-gray-10 p-4">
        <h4 className="text-sm font-semibold text-gray-700">Feedback Sentiment</h4>
        {hasSentiment ? <>
          <p className={`font-semibold text-gray-900 ${dominant === "tie" ? "text-2xl" : "text-3xl sm:text-4xl"}`}>
            {dominant === "tie" ? "Calm and Worried are equal" : `${displayShare(dominantShare)} ${leadingLabel}`}
          </p>
          <p className="text-sm text-gray-600">{dominant === "tie"
            ? `${displayShare(dominantShare)} each · ${formatCount(totals.calm)} answers each out of ${formatCount(totals.predictedAnswers)} analyzed`
            : `${formatCount(leadingCount)} of ${formatCount(totals.predictedAnswers)} analyzed ${totals.predictedAnswers === 1 ? "answer" : "answers"} ${leadingCount === 1 ? "is" : "are"} ${leadingLabel}`}</p>
          <div aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-gray-100">
            {categories.map(({ label, share, color }) => <span key={label} style={{ width: `${share}%`, backgroundColor: color }} />)}
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-700">{categories.map(({ label, answers, color }) => <li key={label} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            {label}{" "}<strong className="tabular-nums">{formatCount(answers)}</strong>
          </li>)}</ul>
        </> : <p className="text-xl font-semibold text-gray-700">{sentimentState}</p>}
      </section>
      <section aria-label="Rating Satisfaction" className="min-w-0 space-y-3 rounded-lg border border-gray-100 bg-gray-10 p-4">
        <h4 className="text-sm font-semibold text-gray-700">Rating Satisfaction</h4>
        {hasSatisfaction ? <>
          <p className="text-3xl font-semibold text-gray-900 sm:text-4xl">{displayShare(totals.satisfactionShare)} <span style={{ color: SENTIMENT_COLORS.satisfaction }}>Satisfied</span></p>
          <p className="text-sm text-gray-600">{formatCount(totals.satisfiedAnswers)} of {formatCount(totals.satisfactionAnswers)} scored {totals.satisfactionAnswers === 1 ? "answer" : "answers"} {totals.satisfiedAnswers === 1 ? "is" : "are"} Satisfied</p>
          <p className="text-xs text-gray-600">Based on satisfaction ratings</p>
        </> : <p className="text-xl font-semibold text-gray-700">{satisfactionState}</p>}
      </section>
    </div>
    <section aria-label="Answer Analysis Coverage" className="space-y-2 border-t border-gray-100 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <h4 className="font-semibold text-gray-800">Answer Analysis Coverage</h4>
        <p className="text-gray-700">{hasCoverage
          ? `${formatCount(totals.predictedAnswers)} of ${formatCount(totals.eligibleAnswers)} eligible answers analyzed · ${displayShare(analysisCoverage)}`
          : report.sentimentStatus !== "not_configured" && totals.eligibleAnswers === 0 ? "No eligible answers" : "Analysis coverage unavailable"}</p>
      </div>
      {hasCoverage && <div role="progressbar" aria-label="Answer Analysis Coverage" aria-valuenow={analysisCoverage} aria-valuemin={0} aria-valuemax={100}
        aria-valuetext={`${formatCount(totals.predictedAnswers)} of ${formatCount(totals.eligibleAnswers)} eligible sentiment answers analyzed`}
        className="h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full bg-gray-600" style={{ width: `${analysisCoverage}%` }} />
      </div>}
      <p className={`text-xs ${totals.answersWithoutResults > 0 ? "text-warning-800" : "text-gray-600"}`}>
        {isCount(totals.answersWithoutResults) ? `${formatCount(totals.answersWithoutResults)} answers without results` : "Without-results count unavailable"}
      </p>
    </section>
    <p className="text-xs text-gray-600">Counts represent answers, not people. Sentiment and satisfaction use different answer sets.</p>
  </div>;
}
