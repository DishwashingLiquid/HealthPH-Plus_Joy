import { baseAPI } from "./_baseAPI";

export const accountActivityApi = baseAPI.injectEndpoints({
  endpoints: (builder) => ({
    fetchAccountAnalytics: builder.query({
      query: () => "/activity-logs/account-analytics",
      providesTags: ["AccountAnalytics"],
    }),
    createAccountActivity: builder.mutation({
      query: (data) => ({
        url: "/activity-logs",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["AccountActivity", "AccountAnalytics"],
    }),
  }),
});

export const {
  useFetchAccountAnalyticsQuery,
  useCreateAccountActivityMutation
} = accountActivityApi;
