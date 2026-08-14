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
  }),
});

export const {
  useGetMobileSelfReportsExportQuery,
  useGetMobileSelfReportsMapPinsQuery,
} = diseaseWatchFeedApi;
