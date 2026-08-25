/* eslint-disable react-refresh/only-export-components, react/prop-types */
import { useMemo, useState } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/survey-core.css";
import ModalWithBody from "../../../components/admin/ModalWithBody";
import {
  formatNumber,
  sentimentColors,
} from "../../../assets/data/sentimentMockData";
import { useFetchSentimentPulseSurveyResultsQuery } from "../../../features/api/sentimentPulseSlice";

export const QUESTION_TYPES = [
  { value: "text", label: "Text" },
  { value: "multipleChoice", label: "Multiple Choice" },
  { value: "rating", label: "Rating Scale" },
];

export const emptyDraft = {
  title: "",
  subtitle: "",
  target: 500,
  questions: [],
};

export const formatDateTimeLocalValue = (date) => {
  const pad = (value) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const getDefaultScheduleDateTime = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 15);
  date.setSeconds(0, 0);

  return formatDateTimeLocalValue(date);
};

export const formatSurveyDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export const createQuestion = (type = "text") => ({
  id: `question-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  type,
  title: "",
  required: false,
  choices: ["Option 1", "Option 2"],
  rateMin: 1,
  rateMax: 5,
});

const normalizeQuestion = (question = {}, index = 0) => ({
  id:
    question.id ||
    question.name ||
    `question-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
  type: question.type || "text",
  title: question.title || "",
  required: Boolean(question.required),
  choices:
    question.type === "multipleChoice"
      ? Array.isArray(question.choices) && question.choices.length > 0
        ? question.choices
        : ["Option 1", "Option 2"]
      : ["Option 1", "Option 2"],
  rateMin: question.type === "rating" ? Number(question.rateMin) || 1 : 1,
  rateMax: question.type === "rating" ? Number(question.rateMax) || 5 : 5,
});

export const createDraftFromSurvey = (survey = {}) => ({
  title: survey.title || "",
  subtitle: survey.subtitle || "",
  target: Number(survey.target) || emptyDraft.target,
  questions: Array.isArray(survey.questions)
    ? survey.questions.map((question, index) => normalizeQuestion(question, index))
    : [],
});

const getQuestionTypeLabel = (type) =>
  QUESTION_TYPES.find((questionType) => questionType.value === type)?.label ??
  "Question";

export const buildSurveyJson = (draft) => ({
  title: draft.title.trim() || "Untitled Survey",
  description: draft.subtitle.trim(),
  showQuestionNumbers: "off",
  showCompleteButton: false,
  pages: [
    {
      name: "survey-details",
      elements: draft.questions.map((question, index) => {
        const baseQuestion = {
          name: question.id,
          title:
            question.title.trim() ||
            `${getQuestionTypeLabel(question.type)} question ${index + 1}`,
          isRequired: question.required,
        };

        if (question.type === "multipleChoice") {
          const choices = question.choices
            .map((choice) => choice.trim())
            .filter(Boolean);

          return {
            ...baseQuestion,
            type: "radiogroup",
            choices: choices.length > 0 ? choices : ["Option 1"],
          };
        }

        if (question.type === "rating") {
          const rateMin = Number(question.rateMin) || 1;
          const rateMax = Number(question.rateMax) || 5;

          return {
            ...baseQuestion,
            type: "rating",
            rateMin: Math.min(rateMin, rateMax),
            rateMax: Math.max(rateMin, rateMax),
          };
        }

        return {
          ...baseQuestion,
          type: "text",
        };
      }),
    },
  ],
});

export const validateDraft = (draft) => {
  if (!draft.title.trim()) {
    return "Enter a survey title before saving.";
  }

  if (!Number(draft.target) || Number(draft.target) < 1) {
    return "Set a target response count of at least 1.";
  }

  if (draft.questions.length === 0) {
    return "Add at least one survey question.";
  }

  const incompleteQuestionIndex = draft.questions.findIndex(
    (question) => !question.title.trim()
  );

  if (incompleteQuestionIndex >= 0) {
    return `Add a title for question ${incompleteQuestionIndex + 1}.`;
  }

  const incompleteChoicesIndex = draft.questions.findIndex((question) => {
    if (question.type !== "multipleChoice") {
      return false;
    }

    return question.choices.filter((choice) => choice.trim()).length < 2;
  });

  if (incompleteChoicesIndex >= 0) {
    return `Add at least two options for question ${
      incompleteChoicesIndex + 1
    }.`;
  }

  const invalidRatingIndex = draft.questions.findIndex((question) => {
    if (question.type !== "rating") {
      return false;
    }

    return Number(question.rateMin) >= Number(question.rateMax);
  });

  if (invalidRatingIndex >= 0) {
    return `Set the rating maximum higher than the minimum for question ${
      invalidRatingIndex + 1
    }.`;
  }

  return "";
};

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

const statusStyles = {
  Draft: "bg-blue-50 text-blue-700",
  Scheduled: "bg-amber-50 text-amber-700",
  Published: "bg-green-50 text-green-700",
  Active: "bg-green-50 text-green-700",
  Inactive: "bg-gray-100 text-gray-700",
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

function MobileSurveyResultsModal({ surveyId, onClose }) {
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
                <h3 className="text-[18px] font-semibold text-gray-800">
                  {survey.title}
                </h3>
                {survey.status && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                    {survey.status}
                  </span>
                )}
              </div>
              {survey.subtitle && (
                <p className="mt-1 text-sm text-gray-500">
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
              <h4 className="text-[16px] font-semibold text-gray-800">
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
                      <h4 className="mt-1 text-[16px] font-semibold text-gray-800">
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

export function MobileSurveyCreateModal({
  draft,
  draftError,
  onFieldChange,
  onAddQuestion,
  onQuestionChange,
  onChoiceChange,
  onAddChoice,
  onRemoveChoice,
  onRemoveQuestion,
  onSubmitSurvey,
  submitLabel = "Create Draft",
  submitLoadingLabel = "Creating...",
  heading = "Create New Mobile Survey",
  mode = "create",
  onDelete,
  onDeleteDisabled,
  isSubmitting,
  onClose,
}) {
  const surveyModel = useMemo(() => {
    const model = new Model(buildSurveyJson(draft));
    model.showCompleteButton = false;
    return model;
  }, [draft]);
  const secondaryButtonStyle = {
    backgroundColor: "#ffffff",
    color: "#465360",
    boxShadow:
      "0px 0px 0px 1px rgba(70, 83, 96, 0.16), 0px 1px 1px 0px rgba(0, 0, 0, 0.1)",
  };
  const submitButtonStyle = isSubmitting
    ? {
        backgroundColor: "#98a2c7",
        borderColor: "#98a2c7",
        color: "#f8fafc",
        boxShadow:
          "0px 0px 0px 1px #98a2c7, 0px 1px 1px 0px rgba(0, 0, 0, 0.1)",
      }
    : {
        backgroundColor: "#32418c",
        borderColor: "#32418c",
        color: "#ffffff",
        boxShadow:
          "0px 0px 0px 1px #32418c, 0px 1px 1px 0px rgba(0, 0, 0, 0.1)",
      };
  const destructiveButtonStyle =
    isSubmitting || onDeleteDisabled
      ? {
          backgroundColor: "#e87d7d",
          borderColor: "#e87d7d",
          color: "#fef2f2",
          boxShadow:
            "0px 0px 0px 1px #e87d7d, 0px 1px 1px 0px rgba(0, 0, 0, 0.1)",
        }
      : {
          backgroundColor: "#d82727",
          borderColor: "#d82727",
          color: "#ffffff",
          boxShadow:
            "0px 0px 0px 1px #d82727, 0px 1px 1px 0px rgba(0, 0, 0, 0.1)",
        };
  const addQuestionButtonStyle = {
    backgroundColor: "#32418c",
    borderColor: "#32418c",
    color: "#ffffff",
    boxShadow:
      "0px 0px 0px 1px #32418c, 0px 1px 1px 0px rgba(0, 0, 0, 0.1)",
  };
  const questionRemoveButtonStyle = {
    backgroundColor: "#ffffff",
    borderColor: "#fecaca",
    color: "#dc2626",
  };

  return (
    <ModalWithBody
      onConfirm={onSubmitSurvey}
      onConfirmLabel={submitLabel}
      confirmButtonStyle={submitButtonStyle}
      cancelButtonStyle={secondaryButtonStyle}
      onLoading={isSubmitting}
      onLoadingLabel={submitLoadingLabel}
      onCancel={onClose}
      heading={heading}
      color="primary"
      additionalClasses="health-literacy-content-modal admin-brand-modal !top-[68px] !h-[calc(100vh-68px)] !pt-[20px]"
      leadingActions={
        mode === "edit" && onDelete ? (
          <button
            type="button"
            className="prod-btn-base prod-btn-destructive"
            onClick={onDelete}
            disabled={isSubmitting || onDeleteDisabled}
            style={destructiveButtonStyle}
          >
            Delete
          </button>
        ) : null
      }
    >
      <div className="max-h-[calc(100vh-230px)] overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Survey Title
                </label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(event) =>
                    onFieldChange("title", event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex. Dengue prevention awareness"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Target Responses
                </label>
                <input
                  type="number"
                  min="1"
                  value={draft.target}
                  onChange={(event) =>
                    onFieldChange("target", event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Description
              </label>
              <textarea
                value={draft.subtitle}
                onChange={(event) =>
                  onFieldChange("subtitle", event.target.value)
                }
                className="min-h-[88px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                placeholder="Briefly describe the survey purpose"
              />
            </div>

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-[16px] font-semibold text-gray-800">
                  Questions
                </h4>
                <div className="flex flex-wrap gap-2">
                  {QUESTION_TYPES.map((questionType) => (
                    <button
                      key={questionType.value}
                      type="button"
                      onClick={() => onAddQuestion(questionType.value)}
                      className="admin-module-brand-btn rounded-lg border px-3 py-2 text-xs font-semibold"
                      style={addQuestionButtonStyle}
                    >
                      + {questionType.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {draft.questions.length === 0 && (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                    Add a text, multiple choice, or rating scale question to
                    build the survey.
                  </div>
                )}

                {draft.questions.map((question, index) => (
                  <div
                    key={question.id}
                    className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Question {index + 1}
                        </p>
                        <p className="text-xs text-gray-500">
                          {getQuestionTypeLabel(question.type)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveQuestion(question.id)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600"
                        style={questionRemoveButtonStyle}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_190px]">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-2">
                            Question Text
                          </label>
                          <input
                            type="text"
                            value={question.title}
                            onChange={(event) =>
                              onQuestionChange(
                                question.id,
                                "title",
                                event.target.value
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter question"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-2">
                            Type
                          </label>
                          <select
                            value={question.type}
                            onChange={(event) =>
                              onQuestionChange(
                                question.id,
                                "type",
                                event.target.value
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                          >
                            {QUESTION_TYPES.map((questionType) => (
                              <option
                                key={questionType.value}
                                value={questionType.value}
                              >
                                {questionType.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <label className="flex w-fit items-center gap-2 text-sm font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={question.required}
                          onChange={(event) =>
                            onQuestionChange(
                              question.id,
                              "required",
                              event.target.checked
                            )
                          }
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Required
                      </label>

                      {question.type === "multipleChoice" && (
                        <div>
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <label className="block text-xs font-semibold text-gray-700">
                              Options
                            </label>
                            <button
                              type="button"
                              onClick={() => onAddChoice(question.id)}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700"
                              style={secondaryButtonStyle}
                            >
                              + Option
                            </button>
                          </div>
                          <div className="space-y-2">
                            {question.choices.map((choice, choiceIndex) => (
                              <div
                                key={`${question.id}-${choiceIndex}`}
                                className="grid grid-cols-[minmax(0,1fr)_80px] gap-2"
                              >
                                <input
                                  type="text"
                                  value={choice}
                                  onChange={(event) =>
                                    onChoiceChange(
                                      question.id,
                                      choiceIndex,
                                      event.target.value
                                    )
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                  placeholder={`Option ${choiceIndex + 1}`}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    onRemoveChoice(question.id, choiceIndex)
                                  }
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  disabled={question.choices.length <= 2}
                                  style={secondaryButtonStyle}
                                >
                                  Delete
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {question.type === "rating" && (
                        <div className="grid grid-cols-2 gap-3 sm:w-[280px]">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-2">
                              Minimum
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={question.rateMin}
                              onChange={(event) =>
                                onQuestionChange(
                                  question.id,
                                  "rateMin",
                                  event.target.value
                                )
                              }
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-2">
                              Maximum
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={question.rateMax}
                              onChange={(event) =>
                                onQuestionChange(
                                  question.id,
                                  "rateMax",
                                  event.target.value
                                )
                              }
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {draftError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {draftError}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="sticky top-0 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="mb-3 text-[16px] font-semibold text-gray-800">
                SurveyJS Preview
              </h4>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                {draft.questions.length > 0 ? (
                  <Survey model={surveyModel} />
                ) : (
                  <div className="px-3 py-8 text-center text-sm text-gray-500">
                    Survey preview will appear after adding a question.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModalWithBody>
  );
}

export function MobileSurveyScheduleModal({
  scheduleItems,
  scheduleError,
  isScheduling,
  onSelectionChange,
  onScheduledAtChange,
  onConfirm,
  onClose,
}) {
  const hasScheduleItems = scheduleItems.length > 0;
  const selectedCount = scheduleItems.filter((item) => item.selected).length;

  return (
    <ModalWithBody
      onConfirm={onConfirm}
      onConfirmLabel="Schedule Selected"
      onConfirmDisabled={!hasScheduleItems || selectedCount === 0}
      onCancel={onClose}
      onLoading={isScheduling}
      onLoadingLabel="Scheduling..."
      heading="Schedule Mobile Surveys"
      color="primary"
      additionalClasses="health-literacy-content-modal admin-brand-modal !top-[68px] !h-[calc(100vh-68px)] !pt-[20px]"
    >
      <div className="space-y-5 px-5 py-5">
        {!hasScheduleItems && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            Create a draft survey before scheduling publication.
          </div>
        )}

        {hasScheduleItems && (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[16px] font-semibold text-gray-800">
                  Draft Surveys
                </p>
                <p className="text-[14px] text-gray-500">
                  {selectedCount} of {scheduleItems.length} selected
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200">
              <div className="hidden grid-cols-[minmax(0,1fr)_220px] gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase text-gray-500 md:grid">
                <span>Survey</span>
                <span>Publish Date and Time</span>
              </div>

              <div className="divide-y divide-gray-200">
                {scheduleItems.map((item) => {
                  const isScheduledSuccessfully = item.status === "success";

                  return (
                    <div
                      key={item.surveyId}
                      className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-start md:gap-4"
                    >
                      <label className="flex min-w-0 items-start gap-3">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          disabled={isScheduling || isScheduledSuccessfully}
                          onChange={(event) =>
                            onSelectionChange(
                              item.surveyId,
                              event.target.checked
                            )
                          }
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-gray-900">
                            {item.title || "Untitled survey"}
                          </span>
                          <span className="mt-1 block text-xs text-gray-500">
                            {Number(item.target || 0).toLocaleString()} target responses
                          </span>
                          {isScheduledSuccessfully && (
                            <span className="mt-2 inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                              Scheduled
                            </span>
                          )}
                          {item.error && (
                            <span className="mt-2 block text-xs font-semibold text-red-700">
                              {item.error}
                            </span>
                          )}
                        </span>
                      </label>

                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase text-gray-500 md:hidden">
                          Publish Date and Time
                        </label>
                        <input
                          type="datetime-local"
                          value={item.scheduledAt}
                          disabled={isScheduling || isScheduledSuccessfully}
                          onChange={(event) =>
                            onScheduledAtChange(
                              item.surveyId,
                              event.target.value
                            )
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {scheduleError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {scheduleError}
          </div>
        )}
      </div>
    </ModalWithBody>
  );
}

export default function MobileSurveys({
  surveys = [],
  isLoading,
  isError,
  onEdit = () => {},
}) {
  const [selectedResultsSurveyId, setSelectedResultsSurveyId] = useState("");

  const handleResults = (surveyId) => {
    setSelectedResultsSurveyId(surveyId);
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
        Loading mobile surveys...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center text-sm font-semibold text-red-700">
        Unable to load mobile surveys.
      </div>
    );
  }

  if (surveys.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        Create a draft survey to start scheduling mobile and website publication.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {surveys.map((survey) => {
          const responses = Number(survey.responses || 0);
          const target = Number(survey.target || 0);
          const responsePercentage =
            target > 0 ? (responses / target) * 100 : 0;
          const responseDifference = responses - target;
          const responseDifferenceLabel =
            responseDifference === 0
              ? "On target"
              : `${formatNumber(Math.abs(responseDifference))} ${
                  responseDifference > 0 ? "over" : "short"
                }`;
          const dominantSentiment = survey.dominantSentiment || "Neutral";
          const dominantColor = sentimentColors[dominantSentiment] || "#9CA3AF";
          const sentimentScore =
            survey.sentimentBreakdown?.[dominantSentiment.toLowerCase()] ?? 0;
          const scheduledAtLabel = formatSurveyDate(survey.scheduledAt);
          const publishedAtLabel = formatSurveyDate(survey.publishedAt);
          const statusClass =
            statusStyles[survey.status] || "bg-gray-100 text-gray-700";

          return (
            <div
              key={survey.id}
              className="bg-white shadow-sm rounded-lg p-6 border border-gray-200"
            >
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[16px] font-semibold text-gray-800">
                      {survey.title}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}
                    >
                      {survey.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[14px] text-gray-500">
                    {survey.subtitle}
                  </p>
                  {(scheduledAtLabel || publishedAtLabel) && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      {scheduledAtLabel && (
                        <span>
                          Scheduled:{" "}
                          <span className="font-semibold text-gray-700">
                            {scheduledAtLabel}
                          </span>
                        </span>
                      )}
                      {publishedAtLabel && (
                        <span>
                          Published:{" "}
                          <span className="font-semibold text-gray-700">
                            {publishedAtLabel}
                          </span>
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-5">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-gray-500">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>
                          Responses:{" "}
                          <span className="font-semibold text-gray-700">
                            {formatNumber(responses)}
                          </span>
                        </span>
                        <span>
                          Target:{" "}
                          <span className="font-semibold text-gray-700">
                            {formatNumber(target)}
                          </span>
                        </span>
                      </div>
                      <span className="font-semibold text-gray-800">
                        {responseDifferenceLabel}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(responsePercentage, 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="w-fit self-center text-center lg:shrink-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Sentiment
                  </p>
                  <p
                    className="mt-2 text-3xl font-bold"
                    style={{ color: dominantColor }}
                  >
                    {sentimentScore}%
                  </p>
                  <p
                    className="mt-1 text-sm font-semibold"
                    style={{ color: dominantColor }}
                  >
                    {dominantSentiment}
                  </p>
                </div>

                <div className="grid w-full grid-cols-2 gap-2 lg:w-44 lg:shrink-0">
                  <button
                    onClick={() => handleResults(survey.id)}
                    className="px-3 py-2 bg-white text-gray-900 border border-gray-300 font-semibold rounded-lg hover:bg-gray-50 transition-colors duration-200 text-sm"
                  >
                    Results
                  </button>
                  <button
                    onClick={() => onEdit(survey)}
                    className="admin-module-brand-btn min-h-[40px] rounded-lg border px-3 py-2 text-sm font-semibold transition-colors duration-200"
                    style={{ color: "#FFFFFF" }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedResultsSurveyId && (
        <MobileSurveyResultsModal
          surveyId={selectedResultsSurveyId}
          onClose={() => setSelectedResultsSurveyId("")}
        />
      )}
    </>
  );
}
