import React from "react";
import {
  mobileSurveys,
  sentimentColors,
  formatNumber,
} from "../../../assets/data/sentimentMockData";

export default function MobileSurveys() {
  const handleNewSurvey = () => {
    alert("New Survey button - Future integration with survey service");
  };

  const handleResults = (surveyId) => {
    alert(`View Results for Survey ID: ${surveyId} - Coming soon`);
  };

  const handleEdit = (surveyId) => {
    alert(`Edit Survey ID: ${surveyId} - Coming soon`);
  };

  return (
    <div className="space-y-6">
      {/* New Survey Button */}
      <div className="flex justify-end">
        <button
          onClick={handleNewSurvey}
          className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          + New Survey
        </button>
      </div>

      {/* Surveys Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {mobileSurveys.map((survey) => {
          const responsePercentage = (survey.responses / survey.target) * 100;
          const dominantColor = sentimentColors[survey.dominantSentiment] || "#9CA3AF";

          return (
            <div key={survey.id} className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
              {/* Header with Title and Status */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {survey.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{survey.subtitle}</p>
                </div>
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded text-white ${
                    survey.status === "Active"
                      ? "bg-green-500"
                      : "bg-gray-400"
                  }`}
                >
                  {survey.status}
                </span>
              </div>

              {/* Response Count Display */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <p className="text-sm text-gray-600 mb-2">
                  Responses: <span className="font-semibold">
                    {formatNumber(survey.responses)} / {formatNumber(survey.target)}
                  </span>
                </p>
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(responsePercentage, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {Math.round(responsePercentage)}% of target
                </p>
              </div>

              {/* Sentiment Breakdown */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Sentiment Distribution:</p>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="px-3 py-1 text-xs font-semibold text-white rounded"
                    style={{ backgroundColor: dominantColor }}
                  >
                    {survey.dominantSentiment}
                  </span>
                  <span className="text-xs text-gray-500">
                    (Dominant sentiment)
                  </span>
                </div>
                {/* Sentiment Bars */}
                <div className="space-y-1">
                  {Object.entries(survey.sentimentBreakdown).map(([sentiment, percentage]) => (
                    <div key={sentiment} className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-gray-600 capitalize">
                        {sentiment}:
                      </span>
                      <div className="flex-1 bg-gray-100 rounded h-1.5">
                        <div
                          className="h-1.5 rounded transition-all duration-300"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor:
                              sentimentColors[
                                sentiment.charAt(0).toUpperCase() +
                                sentiment.slice(1)
                              ] || "#9CA3AF",
                          }}
                        ></div>
                      </div>
                      <span className="w-8 text-right text-gray-600">
                        {percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleResults(survey.id)}
                  className="flex-1 px-3 py-2 bg-gray-100 text-gray-900 font-semibold rounded-lg hover:bg-gray-200 transition-colors duration-200 text-sm"
                >
                  Results
                </button>
                <button
                  onClick={() => handleEdit(survey.id)}
                  className="flex-1 px-3 py-2 bg-blue-100 text-blue-900 font-semibold rounded-lg hover:bg-blue-200 transition-colors duration-200 text-sm"
                >
                  Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
