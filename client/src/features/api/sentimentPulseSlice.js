import { baseAPI } from "./_baseAPI";
import { trendsRequest } from "../../pages/admin/sentimentPulseTool/sentimentContract";

export const sentimentPulseApi = baseAPI.injectEndpoints({
  endpoints: (builder) => ({
    fetchSentimentPulseRegionalAnalytics: builder.query({
      query: ({ timeRange, regions, startDate, endDate } = {}) => ({
        ...trendsRequest({ timeRange, regions, startDate, endDate }),
        url: "/sentiment-pulse/regional-analytics",
      }),
      providesTags: ["SentimentPulseRegionalAnalysis", { type: "SentimentPulseSurveys", id: "SENTIMENT_TRENDS" }],
    }),
    fetchSentimentPulseTrends: builder.query({
      query: trendsRequest,
      providesTags: [{ type: "SentimentPulseSurveys", id: "SENTIMENT_TRENDS" }],
    }),
    fetchSentimentPulseProcessing: builder.query({
      query: (surveyId) => `/sentiment-pulse/surveys/${encodeURIComponent(surveyId)}/processing`,
      providesTags: (_result, _error, surveyId) => [{ type: "SentimentPulseSurveys", id: `PROCESSING_${surveyId}` }],
    }),
    processSentimentPulseSurvey: builder.mutation({
      query: (surveyId) => ({ url: `/sentiment-pulse/surveys/${encodeURIComponent(surveyId)}/process`, method: "POST" }),
      invalidatesTags: (_result, _error, surveyId) => [
        { type: "SentimentPulseSurveys", id: `PROCESSING_${surveyId}` },
        { type: "SentimentPulseSurveys", id: "SENTIMENT_TRENDS" },
      ],
    }),
    fetchSentimentPulseSummary: builder.query({
      query: () => "/sentiment-pulse/summary",
      providesTags: ["SentimentPulseSurveys"],
    }),
    fetchSentimentPulseSurveys: builder.query({
      query: () => "/sentiment-pulse/surveys",
      providesTags: ["SentimentPulseSurveys"],
    }),
    fetchSentimentPulseSurveyResults: builder.query({
      query: (surveyId) => `/sentiment-pulse/surveys/${surveyId}/results`,
      providesTags: (_result, _error, surveyId) => [
        { type: "SentimentPulseSurveys", id: surveyId },
      ],
    }),
    createSentimentPulseSurvey: builder.mutation({
      query: (data) => ({
        url: "/sentiment-pulse/surveys",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["SentimentPulseSurveys"],
    }),
    updateSentimentPulseSurvey: builder.mutation({
      query: ({ surveyId, data }) => ({
        url: `/sentiment-pulse/surveys/${surveyId}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _error, { surveyId }) => [
        "SentimentPulseSurveys",
        "SentimentPulseRegionalAnalysis",
        { type: "SentimentPulseSurveys", id: surveyId },
      ],
    }),
    deleteSentimentPulseSurvey: builder.mutation({
      query: (surveyId) => ({
        url: `/sentiment-pulse/surveys/${surveyId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, surveyId) => [
        "SentimentPulseSurveys",
        "SentimentPulseRegionalAnalysis",
        { type: "SentimentPulseSurveys", id: surveyId },
      ],
    }),
    scheduleSentimentPulseSurvey: builder.mutation({
      query: ({ surveyId, scheduledAt }) => ({
        url: `/sentiment-pulse/surveys/${surveyId}/schedule`,
        method: "PATCH",
        body: { scheduledAt },
      }),
      invalidatesTags: ["SentimentPulseSurveys", "SentimentPulseRegionalAnalysis"],
    }),
    endSentimentPulseSurvey: builder.mutation({
      query: (surveyId) => ({
        url: `/sentiment-pulse/surveys/${surveyId}/end`,
        method: "PATCH",
      }),
      invalidatesTags: (_result, _error, surveyId) => [
        "SentimentPulseSurveys",
        "SentimentPulseRegionalAnalysis",
        { type: "SentimentPulseSurveys", id: surveyId },
      ],
    }),
    fetchSentimentPulseRegionalAnalysis: builder.query({
      query: ({
        timeRange = "last-30-days",
        regions = [],
        startDate,
        endDate,
      } = {}) => ({
        url: "/sentiment-pulse/regional-analysis",
        params: {
          timeRange,
          ...(regions.length > 0 ? { regions: regions.join(",") } : {}),
          ...(timeRange === "custom" ? { startDate, endDate } : {}),
        },
      }),
      providesTags: ["SentimentPulseRegionalAnalysis"],
    }),
    fetchPublicSentimentPulseSurveys: builder.query({
      query: (platform = "mobile") => ({
        url: "/sentiment-pulse/public-surveys",
        params: { platform },
      }),
      providesTags: ["SentimentPulseSurveys"],
    }),
    submitPublicSentimentPulseSurveyResponse: builder.mutation({
      query: ({ surveyId, data }) => ({
        url: `/sentiment-pulse/public-surveys/${surveyId}/responses`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["SentimentPulseSurveys", "SentimentPulseRegionalAnalysis"],
    }),
  }),
});

export const {
  useFetchSentimentPulseRegionalAnalyticsQuery,
  useFetchSentimentPulseTrendsQuery,
  useFetchSentimentPulseProcessingQuery,
  useProcessSentimentPulseSurveyMutation,
  useCreateSentimentPulseSurveyMutation,
  useDeleteSentimentPulseSurveyMutation,
  useEndSentimentPulseSurveyMutation,
  useFetchSentimentPulseSurveyResultsQuery,
  useFetchPublicSentimentPulseSurveysQuery,
  useFetchSentimentPulseRegionalAnalysisQuery,
  useFetchSentimentPulseSurveysQuery,
  useFetchSentimentPulseSummaryQuery,
  useScheduleSentimentPulseSurveyMutation,
  useSubmitPublicSentimentPulseSurveyResponseMutation,
  useUpdateSentimentPulseSurveyMutation,
} = sentimentPulseApi;
