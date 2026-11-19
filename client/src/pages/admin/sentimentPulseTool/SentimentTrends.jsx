/* eslint-disable react/prop-types */
import { ComposedChart, BarChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import TrendsOverview from "./TrendsOverview";
import TrendsDistribution from "./TrendsDistribution";
import TrendsDetailedData from "./TrendsDetailedData";
import { SATISFACTION_COLORS, satisfactionTrendSeries, trendsMetrics } from "./trendsMetrics";
import { dailySeries, formatCount, formatShare, isShare, reportingScope, SENTIMENT_COLORS } from "./sentimentContract";

export default function SentimentTrends({ report, surveys = [], isLoading, isFetching, isError, filterError, onRefresh }) {
  if (filterError) return <Message error>{filterError}</Message>;
  if (isError) return <Message error>Unable to load results. <button type="button" onClick={onRefresh} className="underline">Try again</button></Message>;
  if (isLoading || !report) return <Message>{isLoading ? "Loading results..." : "Results are unavailable."}</Message>;
  const series = dailySeries(report);
  const satisfactionSeries = satisfactionTrendSeries(report);
  const distributions = trendsMetrics(report);
  const hasPredictions = report.totals?.predictedAnswers > 0;
  const hasSatisfaction = isShare(report.totals?.satisfactionShare);
  return (
    <div className="space-y-3" aria-busy={isFetching}>
      <p className="text-sm text-gray-600">{reportingScope(report)}</p>
      <section aria-labelledby="sentiment-overview" className="space-y-3">
      <h2 id="sentiment-overview" className="text-xl font-semibold text-gray-800">Overview</h2>
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <TrendsOverview report={report} />
        {report.excludedInvalidSubmissionDates > 0 && <p className="mt-3 text-sm text-gray-600">{formatCount(report.excludedInvalidSubmissionDates)} answers left out due to missing or invalid dates.</p>}
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">Worried Share Over Time</h3>
          {hasPredictions ? <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={series} margin={{ top: 10, right: 5, left: 0, bottom: 15 }} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="share" domain={[0, 100]} unit="%" width={45} />
              <YAxis yAxisId="count" orientation="right" allowDecimals={false} width={40} />
              <Tooltip formatter={(value, name) => [name === "Worried share" ? formatShare(value) : formatCount(value), name]} />
              <Legend />
              <Bar yAxisId="count" dataKey="predictedAnswers" name="Analyzed answers" fill="#5A6876" maxBarSize={35} />
              <Line yAxisId="share" type="linear" dataKey="worriedShare" name="Worried share" stroke={SENTIMENT_COLORS.worried} strokeWidth={3} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer> : <Message>No analyzed answers to show.</Message>}
        </section>
        <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">Satisfaction Answers Over Time</h3>
          {hasSatisfaction ? <ResponsiveContainer width="100%" height={300}>
            <BarChart data={satisfactionSeries} margin={{ top: 10, right: 20, left: 0, bottom: 15 }} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, "auto"]} allowDecimals={false} width={55} label={{ value: "Answers", angle: -90, position: "insideLeft" }} />
              <Tooltip formatter={(value, name) => [`${formatCount(value)} answers`, name]} />
              <Legend />
              <Bar dataKey="satisfiedAnswers" name="Satisfied" stackId="satisfaction" fill={SATISFACTION_COLORS.satisfied} maxBarSize={35} />
              <Bar dataKey="neutralSatisfactionAnswers" name="Neutral" stackId="satisfaction" fill={SATISFACTION_COLORS.neutral} maxBarSize={35} />
              <Bar dataKey="dissatisfiedAnswers" name="Dissatisfied" stackId="satisfaction" fill={SATISFACTION_COLORS.dissatisfied} maxBarSize={35} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer> : <Message>{report.satisfactionStatus === "not_configured" ? "Satisfaction is not available for these surveys." : "No satisfaction answers to show."}</Message>}
          {hasSatisfaction && satisfactionSeries.some((row) => row.satisfactionAnswers > 0 &&
            (row.neutralSatisfactionAnswers === null || row.dissatisfiedAnswers === null)) &&
            <p className="mt-2 text-xs text-gray-600">Some category results are not available.</p>}
        </section>
      </div>
      </section>
      <section aria-labelledby="sentiment-distributions" className="space-y-3">
        <h2 id="sentiment-distributions" className="text-xl font-semibold text-gray-800">Trends</h2>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <TrendsDistribution title="Sentiment Distribution" rows={distributions.sentiment}
            unavailable="No analyzed answers to show." />
          <TrendsDistribution title="Satisfaction Distribution" rows={distributions.satisfaction}
            unavailable={report.satisfactionStatus === "not_configured" ? "Satisfaction is not available for these surveys." : "No satisfaction answers to show."} />
        </div>
      </section>
      <TrendsDetailedData report={report} surveys={surveys} />
    </div>
  );
}

function Message({ children, error = false }) {
  return <div role={error ? "alert" : undefined} className={`rounded-lg border p-5 text-sm ${error ? "border-destructive-200 bg-destructive-50 text-destructive-700" : "border-dashed border-gray-300 bg-gray-50 text-gray-600"}`}>{children}</div>;
}
