import { baseAPI } from "./_baseAPI";

export const healthLiteracyHubApi = baseAPI.injectEndpoints({
  endpoints: (builder) => ({
    fetchHealthLiteracyContent: builder.query({
      query: (contentType) => `/health-literacy-hub/${contentType}`,
      providesTags: (result, error, contentType) => [
        { type: "HealthLiteracyContent", id: contentType },
      ],
    }),
    createHealthLiteracyContent: builder.mutation({
      query: ({ contentType, data }) => ({
        url: `/health-literacy-hub/${contentType}`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (result, error, { contentType }) => [
        { type: "HealthLiteracyContent", id: contentType },
        "HealthLiteracyAnalyticsOverview",
      ],
    }),
    updateHealthLiteracyContent: builder.mutation({
      query: ({ contentType, contentId, data }) => ({
        url: `/health-literacy-hub/${contentType}/${contentId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { contentType }) => [
        { type: "HealthLiteracyContent", id: contentType },
        "HealthLiteracyAnalyticsOverview",
      ],
    }),
    applyHealthLiteracyContentReviewAction: builder.mutation({
      query: ({ contentType, contentId, data }) => ({
        url: `/health-literacy-hub/${contentType}/${contentId}/review-action`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (result, error, { contentType }) => [
        { type: "HealthLiteracyContent", id: contentType },
        "HealthLiteracyAnalyticsOverview",
      ],
    }),
    fetchHealthLiteracyAnalyticsOverview: builder.query({
      query: ({ timeRange, contentType, region }) => ({
        url: "/health-literacy-hub/analytics/overview",
        params: { timeRange, contentType, region },
      }),
      providesTags: ["HealthLiteracyAnalyticsOverview"],
    }),
    fetchHealthLiteracyFactCheckAnalytics: builder.query({
      query: ({ timeRange, contentType, region }) => ({
        url: "/health-literacy-hub/analytics/fact-check",
        params: { timeRange, contentType, region },
      }),
      providesTags: ["HealthLiteracyAnalyticsOverview"],
    }),
    createHealthLiteracyAnalyticsEvent: builder.mutation({
      query: (data) => ({
        url: "/health-literacy-hub/analytics/events",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["HealthLiteracyAnalyticsOverview"],
    }),
    upsertHealthLiteracyContentFeedback: builder.mutation({
      query: ({ contentType, contentId, data }) => ({
        url: `/health-literacy-hub/content/${contentType}/${contentId}/feedback`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: [
        "HealthLiteracyAnalyticsOverview",
        "HealthLiteracyFeedback",
      ],
    }),
  }),
});

export const {
  useFetchHealthLiteracyContentQuery,
  useCreateHealthLiteracyContentMutation,
  useUpdateHealthLiteracyContentMutation,
  useApplyHealthLiteracyContentReviewActionMutation,
  useFetchHealthLiteracyAnalyticsOverviewQuery,
  useFetchHealthLiteracyFactCheckAnalyticsQuery,
  useCreateHealthLiteracyAnalyticsEventMutation,
  useUpsertHealthLiteracyContentFeedbackMutation,
} = healthLiteracyHubApi;
