/* eslint-disable react/prop-types */
import { useState } from "react";
import {
  sentimentColors,
  formatNumber,
} from "../../../assets/data/sentimentMockData";
import MobileSurveyResultsModal from "./MobileSurveyResultsModal";

const statusStyles = {
  Draft: "bg-blue-50 text-blue-700",
  Scheduled: "bg-amber-50 text-amber-700",
  Published: "bg-green-50 text-green-700",
  Active: "bg-green-50 text-green-700",
  Inactive: "bg-gray-100 text-gray-700",
};

const formatSurveyDate = (value) => {
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

export default function MobileSurveys({ surveys = [], isLoading, isError }) {
  const [selectedResultsSurveyId, setSelectedResultsSurveyId] = useState("");

  const handleResults = (surveyId) => {
    setSelectedResultsSurveyId(surveyId);
  };

  const handleEdit = (surveyId) => {
    alert(`Edit Survey ID: ${surveyId} - Coming soon`);
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
                    <h3 className="text-lg font-semibold text-gray-900">
                      {survey.title}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}
                    >
                      {survey.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
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
                    onClick={() => handleEdit(survey.id)}
                    className="min-h-[40px] px-3 py-2 bg-[#2563EB] text-white border border-[#1D4ED8] shadow-sm font-semibold rounded-lg hover:bg-[#1D4ED8] transition-colors duration-200 text-sm"
                    style={{ backgroundColor: "#2563EB", color: "#FFFFFF" }}
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
