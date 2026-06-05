import { baseAPI } from "./_baseAPI";

export const sentimentPulseApi = baseAPI.injectEndpoints({
  endpoints: (builder) => ({
    fetchSentimentPulseSurveys: builder.query({
      query: () => "/sentiment-pulse/surveys",
      providesTags: ["SentimentPulseSurveys"],
    }),
    createSentimentPulseSurvey: builder.mutation({
      query: (data) => ({
        url: "/sentiment-pulse/surveys",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["SentimentPulseSurveys"],
    }),
    scheduleSentimentPulseSurvey: builder.mutation({
      query: ({ surveyId, scheduledAt }) => ({
        url: `/sentiment-pulse/surveys/${surveyId}/schedule`,
        method: "PATCH",
        body: { scheduledAt },
      }),
      invalidatesTags: ["SentimentPulseSurveys"],
    }),
    fetchSentimentPulseRegionalAnalysis: builder.query({
      query: ({ timeRange = "last-30-days", regions = [] } = {}) => ({
        url: "/sentiment-pulse/regional-analysis",
        params: {
          timeRange,
          ...(regions.length > 0 ? { regions: regions.join(",") } : {}),
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
      invalidatesTags: ["SentimentPulseSurveys"],
    }),
  }),
});

export const {
  useCreateSentimentPulseSurveyMutation,
  useFetchPublicSentimentPulseSurveysQuery,
  useFetchSentimentPulseRegionalAnalysisQuery,
  useFetchSentimentPulseSurveysQuery,
  useScheduleSentimentPulseSurveyMutation,
  useSubmitPublicSentimentPulseSurveyResponseMutation,
} = sentimentPulseApi;
