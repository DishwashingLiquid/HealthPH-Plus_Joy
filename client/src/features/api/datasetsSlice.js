import { baseAPI } from "./_baseAPI";

export const datasetsApi = baseAPI.injectEndpoints({
  endpoints: (builder) => ({
    uploadFile: builder.mutation({
      query: (data) => ({
        url: "/datasets/upload",
        method: "POST",
        body: data,
      }),
    invalidatesTags: ["Datasets", "AnalyticsEntries"],
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
      invalidatesTags: ["Datasets", "AnalyticsEntries"],
    }),
    deleteDataset: builder.mutation({
      query: (id) => ({
        url: `/datasets/${id}`,
        method: "DELETE",
      }),
    invalidatesTags: ["Datasets", "AnalyticsEntries"],
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
