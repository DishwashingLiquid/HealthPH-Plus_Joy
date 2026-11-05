/* eslint-disable react/prop-types */
import SentimentPulseFilters from "./SentimentPulseFilters";

export default function SentimentTrendsToolbar({ surveys = [], surveyId, onSurveyChange,
  onRefresh, isFetching, isUninitialized, filterError, ...filters }) {
  return <section aria-label="Sentiment Trends filters" aria-busy={isFetching}>
    <SentimentPulseFilters {...filters} trailingAction={
      <button type="button" onClick={onRefresh} disabled={Boolean(filterError) || isFetching || isUninitialized}
        className="min-h-[40px] w-full whitespace-nowrap rounded-[10px] border border-[#E5E5E5] bg-white px-[14px] py-[10px] text-sm font-medium text-gray-800 outline-none focus:border-[#32418C] focus:ring-2 focus:ring-[#D9E3F2] disabled:opacity-50 sm:w-auto">
        {isFetching ? "Refreshing..." : "Refresh Results"}
      </button>
    }>
      <label className="w-full min-w-0 sm:min-w-[180px] sm:flex-[0.5]">
        <span className="sr-only">Survey</span>
        <select value={surveyId} onChange={(event) => onSurveyChange(event.target.value)}
          className="min-h-[40px] w-full rounded-[10px] border border-[#E5E5E5] bg-white px-[14px] py-[10px] text-sm text-gray-800 outline-none focus:border-[#32418C] focus:ring-2 focus:ring-[#D9E3F2]">
          <option value="">All surveys</option>
          {surveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.title} ({survey.id})</option>)}
        </select>
      </label>
    </SentimentPulseFilters>
  </section>;
}
