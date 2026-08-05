import { baseAPI } from "./_baseAPI";

export const activityLogApi = baseAPI.injectEndpoints({
  endpoints: (builder) => ({
    fetchActivityLogs: builder.query({
      query: () => "/activity-logs",
      providesTags: ["ActivityLogs"],
    }),
    fetchAccountAnalytics: builder.query({
      query: () => "/activity-logs/account-analytics",
      providesTags: ["ActivityLogs"],
    }),
    createActivityLog: builder.mutation({
      query: (data) => ({
        url: "/activity-logs",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["ActivityLogs"],
    }),
  }),
});

export const {
  useFetchActivityLogsQuery,
  useFetchAccountAnalyticsQuery,
  useCreateActivityLogMutation
} = activityLogApi;
