import PropTypes from "prop-types";

const reportLabel = (count) => `${count} ${count === 1 ? "report" : "reports"}`;
const joinSymptoms = (items) => items.length < 3
  ? items.join(" and ")
  : `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;

function SummaryCard({ summary }) {
  const regionName = summary.regionName || `Region ${summary.region}`;
  const symptoms = summary.symptomCounts || [];
  const leading = symptoms.slice(0, 3);
  const sentence = `${regionName} has ${summary.reportCount} submitted ${summary.reportCount === 1 ? "self-report" : "self-reports"}. `
    + (leading.length
      ? `The most frequently reported ${leading.length === 1 ? "symptom is" : "symptoms are"} ${joinSymptoms(leading.map((item) => `${item.symptom} (${reportLabel(item.count)})`))}.`
      : "No symptom data was provided in these reports.");

  return <article className="rounded-[10px] border border-[#D5E3F0] bg-[#F8FBFF] p-[14px]">
    <h3 className="font-semibold text-gray-800">{regionName}</h3>
    <p className="mt-2 text-sm leading-6 text-gray-700">{sentence}</p>
    <p className="mt-2 text-xs text-gray-500">Counts reflect submitted symptoms only and are not diagnoses.</p>
    {symptoms.length > 0 && <details className="mt-2 text-xs text-gray-700">
      <summary className="cursor-pointer font-medium">View all symptom counts ({symptoms.length})</summary>
      <ul className="mt-2 flex flex-wrap gap-2">
        {symptoms.map((item) => <li key={item.symptom} className="rounded-full bg-white px-2 py-1">{item.symptom}: {reportLabel(item.count)}</li>)}
      </ul>
    </details>}
  </article>;
}
SummaryCard.propTypes = { summary: PropTypes.object.isRequired };

export default function RegionalSummaryList({ summaries = [], isLoading = false, isFetching = false, errorMessage = "" }) {
  if (isLoading) return <p role="status" className="text-sm text-gray-500">Loading regional summaries...</p>;
  if (errorMessage) return <p role="alert" className="text-sm text-[#B42318]">{errorMessage}</p>;
  if (!summaries.length) return <p role="status" className="text-sm text-gray-500">{isFetching
    ? "Loading regional summaries..."
    : "No regional summary is ready yet. A summary becomes ready after a region reaches five submitted reports."}</p>;
  return <div>
    {isFetching && <p role="status" className="mb-2 text-xs text-gray-500">Refreshing regional summaries...</p>}
    <div className="grid grid-cols-1 gap-[10px] lg:grid-cols-2">
      {summaries.map((summary) => <SummaryCard key={summary.region} summary={summary} />)}
    </div>
  </div>;
}
RegionalSummaryList.propTypes = {
  summaries: PropTypes.arrayOf(PropTypes.object), isLoading: PropTypes.bool,
  isFetching: PropTypes.bool, errorMessage: PropTypes.string,
};
