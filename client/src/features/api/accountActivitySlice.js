import { baseAPI } from "./_baseAPI";

export const accountActivityApi = baseAPI.injectEndpoints({
  endpoints: (builder) => ({
    fetchAccountAnalytics: builder.query({
      query: () => "/activity-logs/account-analytics",
      providesTags: ["AccountAnalytics"],
    }),
    fetchRecentAccountActivity: builder.query({
      query: ({ limit = 25, offset = 0, accountId = "all", dateFrom = "", dateTo = "", search = "" } = {}) => ({
        url: "/activity-logs/recent",
        params: { limit, offset, account_id: accountId, date_from: dateFrom || undefined, date_to: dateTo || undefined, search },
      }),
      providesTags: ["AccountActivity"],
    }),
    fetchRecentActivityAccounts: builder.query({
      query: ({ search = "", limit = 50 } = {}) => ({
        url: "/activity-logs/recent/accounts",
        params: { search, limit },
      }),
      providesTags: ["AccountActivity", "Users", "Admins"],
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
  useFetchRecentActivityAccountsQuery,
  useLazyFetchRecentAccountActivityQuery,
  useCreateAccountActivityMutation
} = accountActivityApi;
