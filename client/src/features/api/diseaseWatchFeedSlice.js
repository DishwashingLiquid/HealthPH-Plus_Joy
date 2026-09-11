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
    getMobileSelfReportsMapPins: builder.query({
      query: (params = {}) => ({
        url: "/mobile/self-reports/map-pins",
        params: buildParams(params),
      }),
    }),
    getMobileSelfReportsExport: builder.query({
      query: (params = {}) => ({
        url: "/mobile/self-reports/export",
        params: buildParams(params),
      }),
    }),
    getDiseaseWatchFeedUserAnalytics: builder.query({
      query: (params = {}) => ({
        url: "/mobile/disease-watch-feed/user-analytics",
        params: buildParams(params),
      }),
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
    cancelRegionalAlert: builder.mutation({
      query: (alertId) => ({
        url: `/mobile/disease-watch-feed/alerts/${alertId}/cancel`,
        method: "PATCH",
      }),
      invalidatesTags: ["RegionalAlerts"],
    }),
  }),
});

export const {
  useGetDiseaseWatchFeedUserAnalyticsQuery,
  useGetMobileSelfReportsExportQuery,
  useGetMobileSelfReportsMapPinsQuery,
  useGetRegionalAlertsQuery,
  useGetRegionalAlertSettingsQuery,
  useGetRegionalSymptomSummariesQuery,
  useSaveRegionalAlertSettingsMutation,
  useCancelRegionalAlertMutation,
} = diseaseWatchFeedApi;
