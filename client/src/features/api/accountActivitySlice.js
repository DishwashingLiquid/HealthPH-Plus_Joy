import { baseAPI } from "./_baseAPI";

export const accountActivityApi = baseAPI.injectEndpoints({
  endpoints: (builder) => ({
    fetchAccountAnalytics: builder.query({
      query: () => "/activity-logs/account-analytics",
      providesTags: ["AccountAnalytics"],
    }),
    fetchRecentAccountActivity: builder.query({
      query: ({ limit = 25, offset = 0 } = {}) => ({
        url: "/activity-logs/recent",
        params: { limit, offset },
      }),
      providesTags: ["AccountActivity"],
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
  useFetchRecentAccountActivityQuery,
  useCreateAccountActivityMutation
} = accountActivityApi;
