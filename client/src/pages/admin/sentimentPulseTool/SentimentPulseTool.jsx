import { useMemo, useState } from "react";
import {
  useCreateSentimentPulseSurveyMutation,
  useDeleteSentimentPulseSurveyMutation,
  useFetchSentimentPulseRegionalAnalysisQuery,
  useFetchSentimentPulseSurveysQuery,
  useScheduleSentimentPulseSurveyMutation,
  useUpdateSentimentPulseSurveyMutation,
} from "../../../features/api/sentimentPulseSlice";
import { ToolbarButton } from "../../../components/ToolbarControls";
import ModalWithBody from "../../../components/admin/ModalWithBody";
import MobileSurveys, {
  MobileSurveyCreateModal,
  MobileSurveyScheduleModal,
  buildSurveyJson,
  createDraftFromSurvey,
  createQuestion,
  emptyDraft,
  getDefaultScheduleDateTime,
  validateDraft,
} from "./MobileSurveys";
import RegionalAnalysis, {
  normalizeRegionalApiData,
  REGIONS,
} from "./RegionalAnalysis";
import SentimentPulseFilters from "./SentimentPulseFilters";
import SentimentTrends from "./SentimentTrends";
import StaticContainers from "./StaticContainers";
import {
  exportSentimentPulseCsv,
  showSentimentPulsePdfExportNotice,
} from "./exportUtils";
import { SENTIMENT_PULSE_TABS } from "./tabs";

export default function SentimentPulseTool() {
  const [activeTab, setActiveTab] = useState("sentiment-trends");
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [timeRange, setTimeRange] = useState("last-30-days");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [draftError, setDraftError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [editingSurvey, setEditingSurvey] = useState(null);
  const [scheduleItems, setScheduleItems] = useState([]);
  const [scheduleError, setScheduleError] = useState("");
  const { data: regionalAnalysisData } =
    useFetchSentimentPulseRegionalAnalysisQuery({
      timeRange,
      regions: selectedRegions,
    });
  const {
    data: surveysData = [],
    isLoading: isSurveysLoading,
    isError: isSurveysError,
  } = useFetchSentimentPulseSurveysQuery();
  const [createSentimentPulseSurvey, { isLoading: isCreatingSurvey }] =
    useCreateSentimentPulseSurveyMutation();
  const [updateSentimentPulseSurvey, { isLoading: isUpdatingSurvey }] =
    useUpdateSentimentPulseSurveyMutation();
  const [deleteSentimentPulseSurvey, { isLoading: isDeletingSurvey }] =
    useDeleteSentimentPulseSurveyMutation();
  const [scheduleSentimentPulseSurvey, { isLoading: isSchedulingSurvey }] =
    useScheduleSentimentPulseSurveyMutation();
  const regionalData = useMemo(
    () => normalizeRegionalApiData(regionalAnalysisData),
    [regionalAnalysisData]
  );
  const surveys = useMemo(
    () => (Array.isArray(surveysData) ? surveysData : surveysData?.surveys ?? []),
    [surveysData]
  );
  const draftSurveys = useMemo(
    () => surveys.filter((survey) => survey.status === "Draft"),
    [surveys]
  );
  const hasDraftSurveys = draftSurveys.length > 0;
  const scheduleButtonLabel = hasDraftSurveys
    ? "Schedule Survey"
    : "Create Draft Survey";
  const scheduleButtonHelper = isSurveysLoading
    ? "Loading surveys..."
    : isSurveysError
      ? "Unable to load surveys. Try again before scheduling."
      : hasDraftSurveys
        ? ""
        : "Create a draft survey before scheduling publication.";

  const resetDraft = () => {
    setDraft(emptyDraft);
    setDraftError("");
  };

  const handleNewSurvey = () => {
    setEditingSurvey(null);
    setIsDeleteModalOpen(false);
    setDeleteError("");
    resetDraft();
    setIsCreateModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingSurvey(null);
    setIsDeleteModalOpen(false);
    setDeleteError("");
    setIsCreateModalOpen(false);
    resetDraft();
  };

  const handleEditSurvey = (survey) => {
    setEditingSurvey(survey);
    setIsDeleteModalOpen(false);
    setDeleteError("");
    setDraft(createDraftFromSurvey(survey));
    setDraftError("");
    setIsCreateModalOpen(true);
  };

  const resetScheduleForm = () => {
    setScheduleItems([]);
    setScheduleError("");
  };

  const handleOpenScheduleModal = () => {
    const defaultScheduledAt = getDefaultScheduleDateTime();

    setScheduleItems(
      draftSurveys.map((survey, index) => ({
        surveyId: survey.id,
        title: survey.title || "Untitled survey",
        target: survey.target,
        scheduledAt: defaultScheduledAt,
        selected: index === 0,
        status: "idle",
        error: "",
      }))
    );
    setScheduleError("");
    setIsScheduleModalOpen(true);
  };

  const handleScheduleButtonClick = () => {
    if (hasDraftSurveys) {
      handleOpenScheduleModal();
      return;
    }

    handleNewSurvey();
  };

  const handleCloseScheduleModal = () => {
    setIsScheduleModalOpen(false);
    resetScheduleForm();
  };

  const handleScheduleItemSelectedChange = (surveyId, selected) => {
    setScheduleItems((currentItems) =>
      currentItems.map((item) =>
        item.surveyId === surveyId
          ? {
              ...item,
              selected,
              status: item.status === "success" ? "success" : "idle",
              error: "",
            }
          : item
      )
    );
    setScheduleError("");
  };

  const handleScheduleItemDateChange = (surveyId, scheduledAtValue) => {
    setScheduleItems((currentItems) =>
      currentItems.map((item) =>
        item.surveyId === surveyId
          ? {
              ...item,
              scheduledAt: scheduledAtValue,
              status: item.status === "success" ? "success" : "idle",
              error: "",
            }
          : item
      )
    );
    setScheduleError("");
  };

  const handleDraftFieldChange = (field, value) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
    setDraftError("");
  };

  const handleAddQuestion = (type) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      questions: [...currentDraft.questions, createQuestion(type)],
    }));
    setDraftError("");
  };

  const handleQuestionChange = (questionId, field, value) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      questions: currentDraft.questions.map((question) =>
        question.id === questionId ? { ...question, [field]: value } : question
      ),
    }));
    setDraftError("");
  };

  const handleChoiceChange = (questionId, choiceIndex, value) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      questions: currentDraft.questions.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        return {
          ...question,
          choices: question.choices.map((choice, index) =>
            index === choiceIndex ? value : choice
          ),
        };
      }),
    }));
    setDraftError("");
  };

  const handleAddChoice = (questionId) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      questions: currentDraft.questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              choices: [
                ...question.choices,
                `Option ${question.choices.length + 1}`,
              ],
            }
          : question
      ),
    }));
  };

  const handleRemoveChoice = (questionId, choiceIndex) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      questions: currentDraft.questions.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        return {
          ...question,
          choices: question.choices.filter((_, index) => index !== choiceIndex),
        };
      }),
    }));
  };

  const handleRemoveQuestion = (questionId) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      questions: currentDraft.questions.filter(
        (question) => question.id !== questionId
      ),
    }));
    setDraftError("");
  };

  const handleCreateSurvey = async () => {
    const validationMessage = validateDraft(draft);

    if (validationMessage) {
      setDraftError(validationMessage);
      return;
    }

    const surveyPayload = {
      title: draft.title.trim(),
      subtitle: draft.subtitle.trim() || "Draft mobile sentiment survey",
      target: Number(draft.target),
      questions: draft.questions,
      surveyJson: buildSurveyJson(draft),
    };

    try {
      await createSentimentPulseSurvey(surveyPayload).unwrap();
      setActiveTab("mobile-surveys");
      handleCloseModal();
    } catch (error) {
      setDraftError(
        error?.data?.detail ||
          "Unable to create the survey draft. Please try again."
      );
    }
  };

  const handleUpdateSurvey = async () => {
    if (!editingSurvey) {
      return;
    }

    const validationMessage = validateDraft(draft);

    if (validationMessage) {
      setDraftError(validationMessage);
      return;
    }

    const surveyPayload = {
      title: draft.title.trim(),
      subtitle: draft.subtitle.trim() || "Draft mobile sentiment survey",
      target: Number(draft.target),
      questions: draft.questions,
      surveyJson: buildSurveyJson(draft),
    };

    try {
      await updateSentimentPulseSurvey({
        surveyId: editingSurvey.id,
        data: surveyPayload,
      }).unwrap();
      setActiveTab("mobile-surveys");
      handleCloseModal();
    } catch (error) {
      setDraftError(
        error?.data?.detail || "Unable to update the survey. Please try again."
      );
    }
  };

  const handleDeleteSurvey = async () => {
    if (!editingSurvey) {
      return;
    }

    try {
      await deleteSentimentPulseSurvey(editingSurvey.id).unwrap();
      setActiveTab("mobile-surveys");
      handleCloseModal();
    } catch (error) {
      setDeleteError(
        error?.data?.detail || "Unable to delete the survey. Please try again."
      );
    }
  };

  const handleScheduleSurvey = async () => {
    if (scheduleItems.length === 0) {
      setScheduleError("Create a draft survey before scheduling publication.");
      return;
    }

    const selectedItems = scheduleItems.filter((item) => item.selected);

    if (selectedItems.length === 0) {
      setScheduleError("Select at least one draft survey to schedule.");
      return;
    }

    const hasMissingDate = selectedItems.some((item) => !item.scheduledAt);

    if (hasMissingDate) {
      setScheduleItems((currentItems) =>
        currentItems.map((item) =>
          item.selected && !item.scheduledAt
            ? {
                ...item,
                status: "error",
                error: "Set a publish date and time.",
              }
            : item
        )
      );
      setScheduleError("Set the publish date and time for each selected survey.");
      return;
    }

    setScheduleError("");
    setScheduleItems((currentItems) =>
      currentItems.map((item) =>
        item.selected ? { ...item, status: "idle", error: "" } : item
      )
    );

    const scheduleResults = await Promise.allSettled(
      selectedItems.map((item) =>
        scheduleSentimentPulseSurvey({
          surveyId: item.surveyId,
          scheduledAt: item.scheduledAt,
        }).unwrap()
      )
    );
    const resultsBySurveyId = selectedItems.reduce((results, item, index) => {
      results[item.surveyId] = scheduleResults[index];
      return results;
    }, {});
    const failedResults = scheduleResults.filter(
      (result) => result.status === "rejected"
    );

    if (failedResults.length === 0) {
      handleCloseScheduleModal();
      return;
    }

    setScheduleItems((currentItems) =>
      currentItems.map((item) => {
        const result = resultsBySurveyId[item.surveyId];

        if (!result) {
          return item;
        }

        if (result.status === "fulfilled") {
          return {
            ...item,
            selected: false,
            status: "success",
            error: "",
          };
        }

        return {
          ...item,
          selected: true,
          status: "error",
          error:
            result.reason?.data?.detail ||
            "Unable to schedule this survey. Please try again.",
        };
      })
    );
    setScheduleError(
      failedResults.length === selectedItems.length
        ? "Unable to schedule the selected surveys. Please try again."
        : "Some surveys were scheduled. Review the failed rows and try again."
    );
  };

  const handleRegionChange = (regionValue) => {
    if (selectedRegions.includes(regionValue)) {
      setSelectedRegions(selectedRegions.filter((region) => region !== regionValue));
    } else {
      setSelectedRegions([...selectedRegions, regionValue]);
    }
  };

  const handleSelectAllRegions = () => {
    if (selectedRegions.length === REGIONS.length) {
      setSelectedRegions([]);
    } else {
      setSelectedRegions(REGIONS.map((region) => region.value));
    }
  };

  return (
    <div className="flex flex-col gap-[10px]">
      <div>
        <div className="flex flex-col gap-[12px] sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[24px] font-semibold text-gray-800">
              Sentiment Pulse Tool
            </h1>
            <p className="text-[14px] text-gray-500">
              Monitor public sentiment trends, regional analysis, and mobile
              survey responses.
            </p>
          </div>
          <ToolbarButton
            type="button"
            onClick={handleNewSurvey}
            iconName="Plus"
            variant="primary"
            className="sm:w-auto"
          >
            New Survey
          </ToolbarButton>
        </div>
      </div>

      <StaticContainers />

      <SentimentPulseFilters
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        selectedRegions={selectedRegions}
        onRegionChange={handleRegionChange}
        onSelectAllRegions={handleSelectAllRegions}
        onExportCsv={() =>
          exportSentimentPulseCsv({
            activeTab,
            timeRange,
            selectedRegions,
            regionalData,
            surveys,
          })
        }
        onExportPdf={showSentimentPulsePdfExportNotice}
      />

      <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[12px]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[8px] bg-[#F5F5F5] rounded-[10px] p-[6px]">
          {SENTIMENT_PULSE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-[16px] py-[10px] rounded-[8px] text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "sentiment-trends" ? (
        <SentimentTrends />
      ) : (
        <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
          {activeTab === "regional-analysis" && (
            <RegionalAnalysis
              selectedRegions={selectedRegions}
              regionalData={regionalData}
            />
          )}
          {activeTab === "mobile-surveys" && (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-[18px] font-semibold text-gray-800">
                    Mobile Surveys
                  </h2>
                </div>
                <ToolbarButton
                  type="button"
                  onClick={handleScheduleButtonClick}
                  disabled={isSurveysLoading || isSurveysError}
                  iconName="Plus"
                  variant="primary"
                  className="sm:w-auto"
                >
                  {scheduleButtonLabel}
                </ToolbarButton>
              </div>
              {scheduleButtonHelper && (
                <p
                  className={`text-sm font-medium ${
                    isSurveysError ? "text-red-700" : "text-gray-500"
                  }`}
                >
                  {scheduleButtonHelper}
                </p>
              )}
              <MobileSurveys
                surveys={surveys}
                isLoading={isSurveysLoading}
                isError={isSurveysError}
                onEdit={handleEditSurvey}
              />
            </div>
          )}
        </div>
      )}

      {isCreateModalOpen && (
        <MobileSurveyCreateModal
          draft={draft}
          draftError={draftError}
          onFieldChange={handleDraftFieldChange}
          onAddQuestion={handleAddQuestion}
          onQuestionChange={handleQuestionChange}
          onChoiceChange={handleChoiceChange}
          onAddChoice={handleAddChoice}
          onRemoveChoice={handleRemoveChoice}
          onRemoveQuestion={handleRemoveQuestion}
          onSubmitSurvey={editingSurvey ? handleUpdateSurvey : handleCreateSurvey}
          submitLabel={editingSurvey ? "Update Survey" : "Create Draft"}
          submitLoadingLabel={editingSurvey ? "Updating..." : "Creating..."}
          heading={
            editingSurvey ? "Edit Mobile Survey" : "Create New Mobile Survey"
          }
          mode={editingSurvey ? "edit" : "create"}
          onDelete={() => {
            setDeleteError("");
            setIsDeleteModalOpen(true);
          }}
          onDeleteDisabled={isUpdatingSurvey || isDeletingSurvey}
          isSubmitting={editingSurvey ? isUpdatingSurvey : isCreatingSurvey}
          onClose={handleCloseModal}
        />
      )}
      {isDeleteModalOpen && editingSurvey && (
        <ModalWithBody
          onConfirm={handleDeleteSurvey}
          onConfirmLabel="Delete"
          onCancel={() => {
            if (isDeletingSurvey) {
              return;
            }

            setDeleteError("");
            setIsDeleteModalOpen(false);
          }}
          onLoading={isDeletingSurvey}
          onLoadingLabel="Deleting..."
          heading="Delete Survey"
          color="destructive"
          additionalClasses="!z-[70]"
        >
          <div className="p-[20px]">
            <p className="text-[14px] text-gray-700">
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-gray-900">
                {editingSurvey.title || "this survey"}
              </span>
              ? This action cannot be undone.
            </p>
            {deleteError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {deleteError}
              </div>
            )}
          </div>
        </ModalWithBody>
      )}
      {isScheduleModalOpen && (
        <MobileSurveyScheduleModal
          scheduleItems={scheduleItems}
          scheduleError={scheduleError}
          isScheduling={isSchedulingSurvey}
          onSelectionChange={handleScheduleItemSelectedChange}
          onScheduledAtChange={handleScheduleItemDateChange}
          onConfirm={handleScheduleSurvey}
          onClose={handleCloseScheduleModal}
        />
      )}
    </div>
  );
}
