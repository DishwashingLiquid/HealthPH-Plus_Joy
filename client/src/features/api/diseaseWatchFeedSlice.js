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
    getDiseaseWatchAlerts: builder.query({
      query: (params = {}) => ({
        url: "/disease-watch-feed/mobile/alerts",
        params: buildParams(params),
      }),
    }),
    getDiseaseWatchRegionalCoverage: builder.query({
      query: (params = {}) => ({
        url: "/disease-watch-feed/mobile/regional-coverage",
        params: buildParams(params),
      }),
    }),
    getDiseaseWatchUserAnalyticsSummary: builder.query({
      query: (params = {}) => ({
        url: "/disease-watch-feed/mobile/user-analytics-summary",
        params: buildParams(params),
      }),
    }),
    getDiseaseWatchTopMetrics: builder.query({
      query: (params = {}) => ({
        url: "/disease-watch-feed/mobile/top-metrics",
        params: buildParams(params),
      }),
    }),
    getDiseaseWatchFilterOptions: builder.query({
      query: () => ({
        url: "/disease-watch-feed/mobile/filter-options",
      }),
    }),
  }),
});

export const {
  useGetDiseaseWatchAlertsQuery,
  useGetDiseaseWatchRegionalCoverageQuery,
  useGetDiseaseWatchUserAnalyticsSummaryQuery,
  useGetDiseaseWatchTopMetricsQuery,
  useGetDiseaseWatchFilterOptionsQuery,
} = diseaseWatchFeedApi;
