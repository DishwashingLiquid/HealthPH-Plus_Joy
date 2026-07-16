import { useEffect, useMemo, useRef, useState } from "react";
import { REGIONS, regionalSentimentData } from "../../assets/data/sentimentMockData";
import {
  useCreateSentimentPulseSurveyMutation,
  useFetchSentimentPulseRegionalAnalysisQuery,
  useFetchSentimentPulseSurveysQuery,
  useScheduleSentimentPulseSurveyMutation,
} from "../../features/api/sentimentPulseSlice";
import StaticContainers from "./sentimentPulseTool/StaticContainers";
import SentimentTrends from "./sentimentPulseTool/SentimentTrends";
import RegionalAnalysis from "./sentimentPulseTool/RegionalAnalysis";
import MobileSurveys from "./sentimentPulseTool/MobileSurveys";
import MobileSurveyScheduleModal from "./sentimentPulseTool/MobileSurveyScheduleModal";
import MobileSurveyCreateModal, {
  buildSurveyJson,
  createQuestion,
  emptyDraft,
  validateDraft,
} from "./sentimentPulseTool/MobileSurveyCreateModal";
import {
  DASHBOARD_PAGE_SUBTITLE_CLASS,
  DASHBOARD_PAGE_TITLE_CLASS,
  DASHBOARD_SECTION_TITLE_CLASS,
} from "./dashboardTypography";

const getRegionLabel = (regionValue) =>
  REGIONS.find((region) => region.value === regionValue)?.label || regionValue;

const getVisibleRegionalRows = (
  selectedRegions,
  regionalData = regionalSentimentData
) => {
  const visibleRegions =
    selectedRegions.length > 0
      ? REGIONS.filter((region) => selectedRegions.includes(region.value))
      : REGIONS;

  return visibleRegions
    .map((region) => ({
      ...region,
      data: regionalData[region.value],
    }))
    .filter((region) => region.data);
};

const normalizeRegionalApiData = (regionalAnalysis) => {
  if (!Array.isArray(regionalAnalysis?.regions) || regionalAnalysis.regions.length === 0) {
    return regionalSentimentData;
  }

  return regionalAnalysis.regions.reduce(
    (regionalData, region) => {
      if (!region?.region) {
        return regionalData;
      }

      const mockRegionData = regionalSentimentData[region.region] || {};

      return {
        ...regionalData,
        [region.region]: {
          ...mockRegionData,
          ...region,
          previousResponses:
            region.previousResponses ?? mockRegionData.previousResponses ?? 0,
          trend: region.trend ?? mockRegionData.trend ?? 0,
        },
      };
    },
    { ...regionalSentimentData }
  );
};

const escapeCsvValue = (value) => {
  const text = String(value ?? "");
  return text.includes(",") || text.includes('"') || text.includes("\n")
    ? `"${text.replace(/"/g, '""')}"`
    : text;
};

const formatDateTimeLocalValue = (date) => {
  const pad = (value) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getDefaultScheduleDateTime = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 15);
  date.setSeconds(0, 0);

  return formatDateTimeLocalValue(date);
};

export default function SentimentPulseTool() {
  const [activeTab, setActiveTab] = useState("sentiment-trends");
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [timeRange, setTimeRange] = useState("last-30-days");
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [draftError, setDraftError] = useState("");
  const [scheduleItems, setScheduleItems] = useState([]);
  const [scheduleError, setScheduleError] = useState("");
  const regionDropdownRef = useRef(null);
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        regionDropdownRef.current &&
        !regionDropdownRef.current.contains(event.target)
      ) {
        setShowRegionDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const resetDraft = () => {
    setDraft(emptyDraft);
    setDraftError("");
  };

  const handleNewSurvey = () => {
    resetDraft();
    setIsCreateModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    resetDraft();
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

  // Handle region selection for multi-select
  const handleRegionChange = (regionValue) => {
    if (selectedRegions.includes(regionValue)) {
      setSelectedRegions(selectedRegions.filter((r) => r !== regionValue));
    } else {
      setSelectedRegions([...selectedRegions, regionValue]);
    }
  };

  // Select/Deselect all regions
  const handleSelectAllRegions = () => {
    if (selectedRegions.length === REGIONS.length) {
      setSelectedRegions([]);
    } else {
      setSelectedRegions(REGIONS.map((region) => region.value));
    }
  };

  // Export as CSV
  const handleExportCSV = () => {
    const timestamp = new Date().toLocaleString();
    const selectedRegionLabels =
      selectedRegions.length === 0
        ? "All"
        : selectedRegions.map(getRegionLabel).join(", ");
    const headers = [
      "Sentiment Pulse Tool Export",
      `Generated: ${timestamp}`,
      `Active Tab: ${activeTab}`,
      `Time Range: ${timeRange}`,
      `Selected Regions: ${selectedRegionLabels}`,
      "",
    ];

    let csvContent = headers.join("\n") + "\n";

    if (activeTab === "sentiment-trends") {
      csvContent +=
        "Date,Concerned (%),Proactive (%),Misinformed (%),Neutral (%)\n";
      // Mock data export
      csvContent += "2026-05-01,15,42,18,25\n";
      csvContent += "2026-05-02,14,44,17,25\n";
      csvContent += "2026-05-03,16,41,19,24\n";
    } else if (activeTab === "regional-analysis") {
      csvContent +=
        "Region,Responses,Previous Responses,Dominant Sentiment,Trend (%)\n";
      const regionalRows = getVisibleRegionalRows(selectedRegions, regionalData);
      csvContent += regionalRows
        .map((region) =>
          [
            region.label,
            region.data.responses,
            region.data.previousResponses,
            region.data.dominantSentiment,
            region.data.trend,
          ]
            .map(escapeCsvValue)
            .join(",")
        )
        .join("\n");
      csvContent += regionalRows.length > 0 ? "\n" : "";
    } else if (activeTab === "mobile-surveys") {
      csvContent +=
        "Survey Title,Status,Scheduled At,Responses,Target,Dominant Sentiment\n";
      csvContent += surveys
        .map((survey) =>
          [
            survey.title,
            survey.status,
            survey.scheduledAt || "",
            survey.responses,
            survey.target,
            survey.dominantSentiment,
          ]
            .map(escapeCsvValue)
            .join(",")
        )
        .join("\n");
      csvContent += surveys.length > 0 ? "\n" : "";
    }

    // Create and download file
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent)
    );
    element.setAttribute(
      "download",
      `sentiment-pulse-export-${activeTab}-${new Date().getTime()}.csv`
    );
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Export as PDF (placeholder for now - would use html2pdf in production)
  const handleExportPDF = () => {
    alert("PDF export will be available soon. Features would include visualizations of charts, applied filters, and professional formatting.");
  };

  const tabs = [
    { id: "sentiment-trends", label: "Sentiment Trends" },
    { id: "regional-analysis", label: "Regional Analysis" },
    { id: "mobile-surveys", label: "Mobile Surveys" },
  ];

  return (
    <div className="flex flex-col gap-[10px]">
      {/* Page Header */}
      <div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>
              Sentiment Pulse Tool
            </h1>
            <button
              onClick={handleNewSurvey}
              className="prod-btn-base admin-module-brand-btn flex min-h-[40px] items-center justify-center font-semibold sm:w-auto"
            >
              + New Survey
            </button>
          </div>
          <p className={`${DASHBOARD_PAGE_SUBTITLE_CLASS} mt-2`}>
            Monitor public sentiment trends, regional analysis, and mobile survey responses.
          </p>
      </div>

      {/* Static Containers */}
      <StaticContainers />

      {/* Filters Section */}
      <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Time Range Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Time Range
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="last-7-days">Last 7 Days</option>
                <option value="last-30-days">Last 30 Days</option>
                <option value="last-90-days">Last 90 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Region Multi-Select */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Regions
              </label>
              <div className="relative" ref={regionDropdownRef}>
                <button
                  onClick={() => setShowRegionDropdown(!showRegionDropdown)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white text-left flex items-center justify-between hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <span>
                    {selectedRegions.length === 0
                      ? "All Regions"
                      : `${selectedRegions.length} Selected`}
                  </span>
                  <span className="text-gray-600">▼</span>
                </button>

                {/* Dropdown Menu */}
                {showRegionDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                    {/* Select All Option */}
                    <div className="px-4 py-2 border-b border-gray-200">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRegions.length === REGIONS.length}
                          onChange={handleSelectAllRegions}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="ml-2 font-semibold text-gray-900">
                          Select All
                        </span>
                      </label>
                    </div>

                    {/* Region Options */}
                    {REGIONS.map((region) => (
                      <div key={region.value} className="px-4 py-2 hover:bg-gray-50">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedRegions.includes(region.value)}
                            onChange={() => handleRegionChange(region.value)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-gray-900 text-sm">
                            {region.label}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Export Buttons */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Export Data
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleExportCSV}
                  className="prod-btn-base admin-module-brand-btn flex-1 min-h-[40px] flex items-center justify-center"
                >
                  <span className="text-white">CSV</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  className="prod-btn-base admin-module-brand-btn flex-1 min-h-[40px] flex items-center justify-center"
                >
                  <span className="text-white">PDF</span>
                </button>
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {selectedRegions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-2">Active Filters:</p>
              <div className="flex flex-wrap gap-2">
                {selectedRegions.map((region) => (
                  <span
                    key={region}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    {getRegionLabel(region)}
                    <button
                      onClick={() => handleRegionChange(region)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[12px]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[8px] bg-[#F5F5F5] rounded-[10px] p-[6px]">
            {tabs.map((tab) => (
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

      {/* Tab Content */}
      {activeTab === "sentiment-trends" ? (
        <SentimentTrends />
      ) : (
        <div className="bg-white shadow-sm rounded-b-lg p-6">
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
                  <h2 className={DASHBOARD_SECTION_TITLE_CLASS}>
                    Mobile Surveys
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleScheduleButtonClick}
                  disabled={isSurveysLoading || isSurveysError}
                  className="prod-btn-base admin-module-brand-btn flex min-h-[40px] items-center justify-center font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {scheduleButtonLabel}
                </button>
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
          onCreateSurvey={handleCreateSurvey}
          isCreating={isCreatingSurvey}
          onClose={handleCloseModal}
        />
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
