/* eslint-disable react/prop-types */
import { formatCount, formatShare, isCount, SENTIMENT_COLORS } from "./sentimentContract";
import { answerShare, SATISFACTION_COLORS, surveySatisfaction, trendsFeedbackLabel } from "./trendsMetrics";

const dayFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
const displayDay = (day) => {
  const date = new Date(`${day}T00:00:00+08:00`);
  return Number.isNaN(date.getTime()) ? day : dayFormat.format(date);
};
const satisfactionCategories = (row) => [
  { label: "Satisfied", answers: row.satisfiedAnswers, share: row.satisfactionShare, color: SATISFACTION_COLORS.satisfied },
  { label: "Neutral", answers: row.neutralSatisfactionAnswers, share: answerShare(row.neutralSatisfactionAnswers, row.satisfactionAnswers), color: SATISFACTION_COLORS.neutral },
  { label: "Dissatisfied", answers: row.dissatisfiedAnswers, share: answerShare(row.dissatisfiedAnswers, row.satisfactionAnswers), color: SATISFACTION_COLORS.dissatisfied },
];

function AnalyzedCell({ row }) {
  return <td className="border-b p-3 align-top">
    <span className="block font-medium" aria-label={`${formatCount(row.predictedAnswers)} analyzed out of ${formatCount(row.eligibleAnswers)} eligible answers`}>
      {isCount(row.predictedAnswers) && isCount(row.eligibleAnswers)
        ? row.eligibleAnswers === 0 ? "No eligible answers" : `${formatCount(row.predictedAnswers)} of ${formatCount(row.eligibleAnswers)} analyzed`
        : "Analysis unavailable"}
    </span>
    {row.answersWithoutResults > 0 && <span className="mt-1 block text-xs text-warning-800">{formatCount(row.answersWithoutResults)} answers without results</span>}
    {!isCount(row.answersWithoutResults) && <span className="mt-1 block text-xs text-gray-500">Without results: Unavailable</span>}
  </td>;
}

function ProportionBar({ categories, total }) {
  // Draw a complete distribution only when all category counts are known.
  if (!isCount(total) || total === 0 || categories.some(({ answers }) => !isCount(answers)) ||
      categories.reduce((sum, { answers }) => sum + answers, 0) !== total) return null;
  return <div aria-hidden="true" className="mb-2 flex h-2 w-full overflow-hidden rounded-full bg-gray-50">
    {categories.map(({ label, answers, color }) => <span key={label} style={{ width: `${answers / total * 100}%`, backgroundColor: color }} />)}
  </div>;
}

function Percentages({ categories, context }) {
  return <details className="mt-2 text-xs text-gray-600">
    <summary className="cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600" aria-label={`Percentages for ${context}`}>Percentages</summary>
    <dl className="mt-1 space-y-1">{categories.map(({ label, share }) => <div key={label} className="flex flex-wrap gap-x-1">
      <dt>{label}:</dt><dd>{formatShare(share)}</dd>
    </div>)}</dl>
  </details>;
}

function SentimentCell({ row, counts = false, context }) {
  const categories = ["calm", "worried"].map((key) => ({ label: key === "calm" ? "Calm" : "Worried",
    answers: row[key], share: answerShare(row[key], row.predictedAnswers), color: SENTIMENT_COLORS[key] }));
  return <td className="border-b p-3 align-top">
    <ProportionBar categories={categories} total={row.predictedAnswers} />
    <ul className="space-y-1">{categories.map(({ label, answers, share, color }) => <li key={label}>
      <span style={{ color }}>{label}</span>{" "}<strong className="font-semibold">{counts ? formatCount(answers) : formatShare(share)}</strong>
      {!counts && <span className="text-xs text-gray-600"> · {formatCount(answers)} answers</span>}
    </li>)}</ul>
    {!row.predictedAnswers && <p className="mt-1 text-xs text-gray-500">{trendsFeedbackLabel(row)}</p>}
    {counts && <Percentages categories={categories} context={`${context} sentiment`} />}
  </td>;
}

function SatisfactionCell({ row, counts = false, context }) {
  const categories = satisfactionCategories(row);
  const leading = counts ? null : surveySatisfaction(row);
  const leadingShare = leading && answerShare(leading.count, row.satisfactionAnswers);
  return <td className="border-b p-3 align-top">
    {counts ? <>
      <ProportionBar categories={categories} total={row.satisfactionAnswers} />
      <ul className="space-y-1">{categories.map(({ label, answers, color }) => <li key={label}><span style={{ color }}>{label}</span>{" "}<strong className="font-semibold">{formatCount(answers)}</strong></li>)}</ul>
      <span className="mt-1 block text-xs text-gray-600">{row.satisfactionAnswers === 0 ? "No scored answers" : `${formatCount(row.satisfactionAnswers)} scored answers`}</span>
      <Percentages categories={categories} context={`${context} satisfaction`} />
    </> : <>
      {leading.count !== null && <ProportionBar categories={categories} total={row.satisfactionAnswers} />}
      <p className="font-medium">
        {leading.count !== null ? <>{leading.kind === "tie" ? "Most common (tie): " : "Most common: "}<span style={{ color: SATISFACTION_COLORS[leading.kind] }}>{leading.label.replace(" (tie)", "")}</span>{" · "}{formatShare(leadingShare)}{leading.kind === "tie" ? " each" : ""}</>
          : leading.label === "No answers" ? "No scored answers" : "Category unavailable"}
      </p>
      <p className="mt-1 text-xs text-gray-600" aria-label={leading.count !== null
        ? `${formatCount(leading.count)} answers ${leading.kind === "tie" ? "for each tied category" : `rated ${leading.label}`} out of ${formatCount(row.satisfactionAnswers)} valid scored answers`
        : `${formatCount(row.satisfactionAnswers)} valid scored answers`}>
        {leading.count !== null ? `${formatCount(leading.count)} of ${formatCount(row.satisfactionAnswers)} scored answers${leading.kind === "tie" ? " each" : ""}` : `${formatCount(row.satisfactionAnswers)} scored answers`}
      </p>
      <details className="mt-2 text-xs text-gray-600">
        <summary className="cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600" aria-label={`Satisfaction breakdown for ${context}`}>View all categories</summary>
        <dl className="mt-1 space-y-1">{categories.map(({ label, answers, share }) => <div key={label}>
          <dt className="inline">{label}: </dt><dd className="inline">{formatCount(answers)} answers ({formatShare(share)})</dd>
        </div>)}</dl>
      </details>
    </>}
  </td>;
}

export default function TrendsDetailedData({ report, surveys = [] }) {
  const titles = new Map(surveys.map((survey) => [survey.id, survey.title]));
  return <section aria-labelledby="sentiment-details" className="space-y-3">
    <h2 id="sentiment-details" className="text-xl font-semibold text-gray-800">Detailed Data</h2>
    <p id="sentiment-details-help" className="text-sm text-gray-600">Counts represent answers, not people. Sentiment uses analyzed answers; satisfaction uses scored answers.</p>
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-4 text-lg font-semibold text-gray-800">Survey Breakdown</h3>
      {report.surveys?.length ? <div className="overflow-x-auto" role="region" aria-label="Survey Breakdown table" tabIndex={0}><table aria-describedby="sentiment-details-help" className="w-full min-w-[680px] table-fixed text-left text-sm tabular-nums">
        <caption className="sr-only">Date-filtered mobile survey sentiment and satisfaction. Answer Analysis Coverage shows analyzed answers out of eligible answers. Sentiment percentages use analyzed answers. Satisfaction shows the most common rating category, including ties, with category counts out of valid scored answers. Expand View all categories for all satisfaction counts and percentages.</caption>
        <thead className="bg-gray-50"><tr>{["Survey", "Answer Analysis Coverage", "Sentiment", "Satisfaction"].map((name) => <th scope="col" className="border-b p-3 font-semibold text-gray-700" key={name}>{name}</th>)}</tr></thead>
        <tbody>{report.surveys.map((row) => <tr key={row.surveyId} className="even:bg-gray-10 hover:bg-gray-50">
          <th scope="row" className="break-words border-b p-3 align-top font-medium text-gray-800"><span className="block">{titles.get(row.surveyId) || row.surveyId}</span>{titles.has(row.surveyId) && <span className="text-xs text-gray-500">{row.surveyId}</span>}</th>
          <AnalyzedCell row={row} />
          <SentimentCell row={row} context={row.surveyId} />
          <SatisfactionCell row={row} context={row.surveyId} />
        </tr>)}</tbody>
      </table></div> : <Empty>No surveys found for these filters.</Empty>}
    </section>
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-1 text-lg font-semibold text-gray-800">Daily Answer Count</h3>
      <p className="mb-3 text-xs text-gray-600">Submission dates in Philippine time (Asia/Manila).</p>
      {report.daily?.length ? <div className="overflow-x-auto" role="region" aria-label="Daily Answer Count table" tabIndex={0}><table aria-describedby="sentiment-details-help" className="w-full min-w-[680px] table-fixed text-left text-sm tabular-nums">
        <caption className="sr-only">Original submission dates in Asia/Manila. Answer Analysis Coverage shows analyzed answers out of eligible answers. Sentiment and satisfaction cells show answer counts; expand Percentages for category shares.</caption>
        <thead className="bg-gray-50"><tr>{["Date", "Answer Analysis Coverage", "Sentiment answers", "Satisfaction answers"].map((name) => <th scope="col" key={name} className="border-b p-3 font-semibold text-gray-700">{name}</th>)}</tr></thead>
        <tbody>{report.daily.map((row) => <tr key={row.date} className="even:bg-gray-10 hover:bg-gray-50">
          <th scope="row" className="whitespace-nowrap border-b p-3 align-top font-medium"><time dateTime={row.date}>{displayDay(row.date)}</time></th>
          <AnalyzedCell row={row} />
          <SentimentCell row={row} counts context={row.date} />
          <SatisfactionCell row={row} counts context={row.date} />
        </tr>)}</tbody>
      </table></div> : <Empty>No answers found for these filters.</Empty>}
    </section>
  </section>;
}

function Empty({ children }) {
  return <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-5 text-sm text-gray-600">{children}</div>;
}
