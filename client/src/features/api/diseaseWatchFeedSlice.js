import { baseAPI } from "./_baseAPI";

const buildParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return [];
      }

      if (Array.isArray(value)) {
        return value.length > 0 ? [[key, value.join(",")]] : [];
      }

      return [[key, value]];
    })
  );

export const diseaseWatchFeedApi = baseAPI.injectEndpoints({
  endpoints: (builder) => ({
    getProcessedSelfReportDashboard: builder.query({
      query: (params = {}) => ({
        url: "/mobile/disease-watch-feed/processed-reports",
        params: buildParams(params),
      }),
      providesTags: ["ProcessedSelfReports"],
    }),
    getRegionalSymptomSummaries: builder.query({
      query: () => ({ url: "/mobile/disease-watch-feed/regional-summaries" }),
      providesTags: ["RegionalSymptomSummaries"],
    }),
    getRegionalAlerts: builder.query({
      query: () => ({ url: "/mobile/disease-watch-feed/alerts" }),
      providesTags: ["RegionalAlerts"],
    }),
    getRegionalAlertSettings: builder.query({
      query: () => ({ url: "/mobile/disease-watch-feed/alert-settings" }),
      providesTags: ["RegionalAlertSettings"],
    }),
    saveRegionalAlertSettings: builder.mutation({
      query: (body) => ({ url: "/mobile/disease-watch-feed/alert-settings", method: "PUT", body }),
      invalidatesTags: ["RegionalAlertSettings", "RegionalAlerts", "RegionalSymptomSummaries"],
    }),
    runRegionalAlertEvaluation: builder.mutation({
      query: (body) => ({ url: "/mobile/disease-watch-feed/alert-settings/run-evaluation", method: "POST", body }),
      invalidatesTags: ["RegionalAlertSettings", "RegionalAlerts", "RegionalSymptomSummaries"],
    }),

  }),
});

export const {
  useGetProcessedSelfReportDashboardQuery,
  useGetRegionalAlertsQuery,
  useGetRegionalAlertSettingsQuery,
  useGetRegionalSymptomSummariesQuery,
  useSaveRegionalAlertSettingsMutation,
  useRunRegionalAlertEvaluationMutation,
} = diseaseWatchFeedApi;
