/* eslint-disable react/prop-types */
import ModalWithBody from "../../../components/admin/ModalWithBody";
import {
  formatNumber,
  sentimentColors,
} from "../../../assets/data/sentimentMockData";
import { useFetchSentimentPulseSurveyResultsQuery } from "../../../features/api/sentimentPulseSlice";
import {
  DASHBOARD_CARD_TITLE_CLASS,
  DASHBOARD_SECTION_SUBTITLE_CLASS,
  DASHBOARD_SECTION_TITLE_CLASS,
} from "../dashboardTypography";

const SENTIMENT_ROWS = [
  { key: "concerned", label: "Concerned" },
  { key: "proactive", label: "Proactive" },
  { key: "misinformed", label: "Misinformed" },
  { key: "neutral", label: "Neutral" },
];

const QUESTION_TYPE_LABELS = {
  multipleChoice: "Multiple Choice",
  rating: "Rating Scale",
  text: "Text",
};

const formatPercent = (value) => `${Number(value || 0).toFixed(0)}%`;

const SummaryTile = ({ label, value, helper, color }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
      {label}
    </p>
    <p className="mt-2 text-2xl font-bold text-gray-900" style={{ color }}>
      {value}
    </p>
    {helper && <p className="mt-1 text-xs font-medium text-gray-500">{helper}</p>}
  </div>
);

const EmptyState = ({ message }) => (
  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
    {message}
  </div>
);

export default function MobileSurveyResultsModal({ surveyId, onClose }) {
  const { data, isFetching, isError, error } =
    useFetchSentimentPulseSurveyResultsQuery(surveyId, {
      skip: !surveyId,
    });
  const survey = data?.survey;
  const questions = data?.questions ?? [];
  const responses = Number(survey?.responses || 0);
  const target = Number(survey?.target || 0);
  const completion = target > 0 ? Math.min((responses / target) * 100, 100) : 0;
  const dominantSentiment = survey?.dominantSentiment || "Neutral";
  const dominantColor = sentimentColors[dominantSentiment] || "#9CA3AF";
  const sentimentBreakdown = survey?.sentimentBreakdown || {};
  const errorMessage =
    error?.data?.detail ||
    "Unable to load survey results. Please try again.";

  return (
    <ModalWithBody
      onConfirm={onClose}
      onConfirmLabel="Close"
      onBackdrop={onClose}
      heading="Survey Results"
      color="primary"
      additionalClasses="health-literacy-content-modal !top-[68px] !h-[calc(100vh-68px)] !pt-[20px]"
    >
      <div className="max-h-[calc(100vh-230px)] overflow-y-auto px-5 py-5">
        {isFetching && (
          <EmptyState message="Loading survey results..." />
        )}

        {!isFetching && isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        {!isFetching && !isError && survey && (
          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={DASHBOARD_SECTION_TITLE_CLASS}>
                  {survey.title}
                </h3>
                {survey.status && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                    {survey.status}
                  </span>
                )}
              </div>
              {survey.subtitle && (
                <p className={`${DASHBOARD_SECTION_SUBTITLE_CLASS} mt-1`}>
                  {survey.subtitle}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryTile
                label="Total Responses"
                value={formatNumber(responses)}
              />
              <SummaryTile
                label="Target Responses"
                value={formatNumber(target)}
              />
              <SummaryTile
                label="Completion"
                value={formatPercent(completion)}
                helper={`${formatNumber(responses)} of ${formatNumber(target)}`}
              />
              <SummaryTile
                label="Dominant Sentiment"
                value={dominantSentiment}
                helper={formatPercent(
                  sentimentBreakdown[dominantSentiment.toLowerCase()]
                )}
                color={dominantColor}
              />
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h4 className={DASHBOARD_CARD_TITLE_CLASS}>
                Sentiment
              </h4>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {SENTIMENT_ROWS.map((sentiment) => {
                  const value = Number(sentimentBreakdown[sentiment.key] || 0);
                  const color = sentimentColors[sentiment.label] || "#9CA3AF";

                  return (
                    <div key={sentiment.key}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-semibold text-gray-700">
                        <span>{sentiment.label}</span>
                        <span>{formatPercent(value)}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(value, 100)}%`,
                            backgroundColor: color,
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {questions.length === 0 && (
              <EmptyState message="No survey questions are available for this result." />
            )}

            {questions.map((question, index) => (
              <div
                key={question.id || `${question.title}-${index}`}
                className="rounded-lg border border-gray-200 bg-white"
              >
                <div className="border-b border-gray-100 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Question {index + 1}
                      </p>
                      <h4 className={`${DASHBOARD_CARD_TITLE_CLASS} mt-1`}>
                        {question.title}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        {QUESTION_TYPE_LABELS[question.type] || "Question"}
                      </span>
                      <p className="mt-1 text-xs font-medium text-gray-500">
                        {formatNumber(question.answeredResponses || 0)} answered
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Option / Response
                        </th>
                        <th className="w-36 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Responses
                        </th>
                        <th className="w-36 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                          % of Answered
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {(question.rows || []).map((row) => (
                        <tr key={row.label}>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {row.label}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {formatNumber(Number(row.count || 0))}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">
                            {formatPercent(row.percentage)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalWithBody>
  );
}
