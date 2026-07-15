import { baseAPI } from "./_baseAPI";

export const datasetsApi = baseAPI.injectEndpoints({
  endpoints: (builder) => ({
    uploadFile: builder.mutation({
      query: (data) => ({
        url: "/datasets/upload",
        method: "POST",
        body: data,
      }),
      invalidatesTags: [
        "Datasets",
        "AnalyticsSuspected",
        "AnalyticsFrequent",
        "AnalyticsPercentage",
        "AnalyticsWordcloud",
      ],
    }),
    fetchDatasets: builder.query({
      query: () => "/datasets",
      providesTags: ["Datasets"],
    }),
    fetchDatasetsByUser: builder.query({
      query: (id) => `/datasets/user/${id}`,
      providesTags: ["Datasets"],
    }),
    downloadDataset: builder.mutation({
      query: (id) => ({
        url: `/datasets/download/${id}`,
        method: "GET",
        responseHandler: (response) => response.blob(),
      }),
    }),
    processDataset: builder.mutation({
      query: (id) => ({
        url: `/datasets/process/${id}`,
        method: "POST",
      }),
      invalidatesTags: [
        "Datasets",
        "Points",
        "PointsDisease",
        "AnalyticsSuspected",
        "AnalyticsFrequent",
        "AnalyticsPercentage",
        "AnalyticsWordcloud",
      ],
    }),
    deleteDataset: builder.mutation({
      query: (id) => ({
        url: `/datasets/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [
        "Datasets",
        "Points",
        "PointsDisease",
        "AnalyticsSuspected",
        "AnalyticsFrequent",
        "AnalyticsPercentage",
        "AnalyticsWordcloud",
      ],
    }),
  }),
});

export const {
  useUploadFileMutation,
  useFetchDatasetsQuery,
  useFetchDatasetsByUserQuery,
  useDeleteDatasetMutation,
  useDownloadDatasetMutation,
  useProcessDatasetMutation,
} = datasetsApi;
