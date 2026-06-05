/* eslint-disable react/prop-types */
import { useMemo } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/survey-core.css";
import ModalWithBody from "../../../components/admin/ModalWithBody";

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

export const createQuestion = (type = "text") => ({
  id: `question-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  type,
  title: "",
  required: false,
  choices: ["Option 1", "Option 2"],
  rateMin: 1,
  rateMax: 5,
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

export default function MobileSurveyCreateModal({
  draft,
  draftError,
  onFieldChange,
  onAddQuestion,
  onQuestionChange,
  onChoiceChange,
  onAddChoice,
  onRemoveChoice,
  onRemoveQuestion,
  onCreateSurvey,
  isCreating,
  onClose,
}) {
  const surveyModel = useMemo(() => {
    const model = new Model(buildSurveyJson(draft));
    model.showCompleteButton = false;
    return model;
  }, [draft]);

  return (
    <ModalWithBody
      onConfirm={onCreateSurvey}
      onConfirmLabel="Create Draft"
      onLoading={isCreating}
      onLoadingLabel="Creating..."
      onCancel={onClose}
      heading="Create New Mobile Survey"
      color="primary"
      additionalClasses="health-literacy-content-modal !top-[68px] !h-[calc(100vh-68px)] !pt-[20px]"
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
                <h4 className="text-sm font-semibold text-gray-900">
                  Questions
                </h4>
                <div className="flex flex-wrap gap-2">
                  {QUESTION_TYPES.map((questionType) => (
                    <button
                      key={questionType.value}
                      type="button"
                      onClick={() => onAddQuestion(questionType.value)}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
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
                        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
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
                              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
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
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  disabled={question.choices.length <= 2}
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
              <h4 className="mb-3 text-sm font-semibold text-gray-900">
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
