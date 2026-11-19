import { baseAPI } from "./_baseAPI";

const modelTrainingLogsApi = baseAPI.injectEndpoints({
    endpoints: (builder) => ({
        fetchModelTrainingLogs: builder.query({
            query: (params = {}) => ({ url: "/model-training-logs/", params }),
            providesTags: ["ModelTrainingLogs"],
        }),
        uploadModelTrainingLog: builder.mutation({
            query: (body) => ({ url: "/model-training-logs/upload", method: "POST", body }),
            invalidatesTags: (_result, error) => error ? [] : ["ModelTrainingLogs"],
        }),
    }),
});

export const {
    useFetchModelTrainingLogsQuery,
    useLazyFetchModelTrainingLogsQuery,
    useUploadModelTrainingLogMutation,
} = modelTrainingLogsApi;
