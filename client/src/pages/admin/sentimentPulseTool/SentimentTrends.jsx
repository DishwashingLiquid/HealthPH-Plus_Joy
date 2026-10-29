/* eslint-disable react/prop-types */
import { ComposedChart, LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import SentimentSummary from "./SentimentSummary";
import { dailySeries, formatCount, formatShare, isShare, reportingScope, SENTIMENT_COLORS, summaryState } from "./sentimentContract";

export default function SentimentTrends({ report, surveys = [], isLoading, isFetching, isError, filterError, onRefresh }) {
  if (filterError) return <Message error>{filterError}</Message>;
  if (isError) return <Message error>Unable to load sentiment aggregates. <button type="button" onClick={onRefresh} className="underline">Try again</button></Message>;
  if (isLoading || !report) return <Message>{isLoading ? "Loading sentiment aggregates..." : "Sentiment aggregates are unavailable."}</Message>;
  const series = dailySeries(report);
  const hasPredictions = report.totals?.predictedAnswers > 0;
  const hasSatisfaction = isShare(report.totals?.satisfactionShare);
  const titles = new Map(surveys.map((survey) => [survey.id, survey.title]));
  return (
    <div className="space-y-3" aria-busy={isFetching}>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <p>{reportingScope(report)}</p>
        <button type="button" onClick={onRefresh} disabled={isFetching} className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-medium text-gray-800 disabled:opacity-50">{isFetching ? "Refreshing..." : "Refresh results"}</button>
      </div>
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Feedback distribution and coverage</h2>
        <SentimentSummary summary={report} />
        {report.sentimentStatus === "not_configured" && <p className="mt-3 text-sm text-gray-600">No text or multiple-choice questions are enabled for sentiment in this scope.</p>}
        {report.mixedModelVersions && <p className="mt-3 text-sm text-warning-800">Results include multiple model versions, each using its saved decision threshold.</p>}
        {report.excludedInvalidSubmissionDates > 0 && <p className="mt-3 text-sm text-gray-600">{formatCount(report.excludedInvalidSubmissionDates)} scoped entries were excluded because their original submission dates are invalid.</p>}
      </section>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-800">Worried share over time</h2>
          <p className="mb-4 text-sm text-gray-600">Percent of classified text/choice answers, with the analyzed answer count for each Philippine submission date.</p>
          {hasPredictions ? <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={series} margin={{ top: 10, right: 5, left: 0, bottom: 15 }} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="share" domain={[0, 100]} unit="%" width={45} />
              <YAxis yAxisId="count" orientation="right" allowDecimals={false} width={40} />
              <Tooltip formatter={(value, name) => [name === "Worried share" ? formatShare(value) : formatCount(value), name]} />
              <Legend />
              <Bar yAxisId="count" dataKey="predictedAnswers" name="Analyzed text/choice answers" fill="#D9E3F2" maxBarSize={35} />
              <Line yAxisId="share" type="linear" dataKey="worriedShare" name="Worried share" stroke={SENTIMENT_COLORS.worried} strokeWidth={3} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer> : <Message>{summaryState(report)}. No worried-share series is available.</Message>}
          <p className="mt-2 text-xs text-gray-500">Missing observations are gaps, not zero. Exact daily counts are listed below.</p>
        </section>
        <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-800">Satisfaction over time</h2>
          <p className="mb-4 text-sm text-gray-600">Satisfied answers as a percentage of valid scored answers, separately from sentiment.</p>
          {hasSatisfaction ? <ResponsiveContainer width="100%" height={300}>
            <LineChart data={series} margin={{ top: 10, right: 20, left: 0, bottom: 15 }} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} unit="%" width={45} />
              <Tooltip formatter={(value) => formatShare(value)} />
              <Legend />
              <Line type="linear" dataKey="satisfactionShare" name="Satisfaction share" stroke={SENTIMENT_COLORS.satisfaction} strokeWidth={3} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer> : <Message>{report.satisfactionStatus === "not_configured" ? "Satisfaction scoring is not configured." : "No configured valid satisfaction answers in this scope."}</Message>}
          <p className="mt-3 text-xs text-gray-500">A filtered rating distribution is unavailable from the current reporting API. Whole-survey rating/choice counts remain in Mobile Surveys results.</p>
        </section>
      </div>
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-800">Survey breakdown</h2>
        <p className="mb-4 text-sm text-gray-600">Same date, region, and survey scope as the totals above. Question-level sentiment and a question filter are unavailable from this API.</p>
        {report.surveys?.length ? <div className="overflow-x-auto" role="region" aria-label="Survey breakdown table" tabIndex={0}><table className="w-full text-left text-sm">
          <caption className="sr-only">Date-filtered mobile survey sentiment and satisfaction</caption>
          <thead><tr>{["Survey", "Feedback", "Eligible text/choice answers", "Analyzed text/choice answers", "Without results", "Calm", "Worried", "Satisfaction", "Valid satisfaction answers"].map((name) => <th className="whitespace-nowrap border-b p-3 font-semibold text-gray-600" key={name}>{name}</th>)}</tr></thead>
          <tbody>{report.surveys.map((row) => <tr key={row.surveyId}>
            <th scope="row" className="border-b p-3 font-medium text-gray-800"><span className="block">{titles.get(row.surveyId) || row.surveyId}</span><span className="text-xs text-gray-500">{row.surveyId}</span></th>
            <td className="border-b p-3">{summaryState(row)}</td>
            {[row.eligibleAnswers, row.predictedAnswers, row.answersWithoutResults, row.calm, row.worried].map((value, index) => <td className="border-b p-3" key={index}>{formatCount(value)}</td>)}
            <td className="border-b p-3">{row.satisfactionStatus === "not_configured" ? "Not configured" : formatShare(row.satisfactionShare)}</td>
            <td className="border-b p-3">{formatCount(row.satisfactionAnswers)}</td>
          </tr>)}</tbody>
        </table></div> : <Message>No surveys are available for this scope.</Message>}
      </section>
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Daily answer counts</h2>
        {report.daily?.length ? <div className="overflow-x-auto" role="region" aria-label="Daily counts table" tabIndex={0}><table className="w-full text-left text-sm">
          <caption className="sr-only">Original submission dates in Asia/Manila</caption>
          <thead><tr>{["Philippine date", "Eligible", "Analyzed", "Without results", "Calm", "Worried", "Worried share", "Satisfied answers", "Valid satisfaction answers", "Satisfaction share"].map((name) => <th key={name} className="whitespace-nowrap border-b p-3 text-gray-600">{name}</th>)}</tr></thead>
          <tbody>{report.daily.map((row) => <tr key={row.date}>
            <th scope="row" className="whitespace-nowrap border-b p-3 font-medium">{row.date}</th>
            {[row.eligibleAnswers, row.predictedAnswers, row.answersWithoutResults, row.calm, row.worried].map((value, index) => <td key={index} className="border-b p-3">{formatCount(value)}</td>)}
            <td className="border-b p-3">{formatShare(row.worriedShare)}</td><td className="border-b p-3">{formatCount(row.satisfiedAnswers)}</td><td className="border-b p-3">{formatCount(row.satisfactionAnswers)}</td><td className="border-b p-3">{formatShare(row.satisfactionShare)}</td>
          </tr>)}</tbody>
        </table></div> : <Message>No answer observations were returned for these filters.</Message>}
      </section>
    </div>
  );
}

function Message({ children, error = false }) {
  return <div role={error ? "alert" : undefined} className={`rounded-lg border p-5 text-sm ${error ? "border-destructive-200 bg-destructive-50 text-destructive-700" : "border-dashed border-gray-300 bg-gray-50 text-gray-600"}`}>{children}</div>;
}
