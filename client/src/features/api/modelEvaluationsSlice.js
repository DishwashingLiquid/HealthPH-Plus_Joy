import { baseAPI } from "./_baseAPI";

const modelEvaluationsApi = baseAPI.injectEndpoints({
    endpoints: (builder) => ({
        fetchModelEvaluations: builder.query({
            query: () => "/model-evaluations/",
            providesTags: ["ModelEvaluations"],
        }),
        uploadModelEvaluations: builder.mutation({
            query: (body) => ({ url: "/model-evaluations/upload", method: "POST", body }),
            invalidatesTags: (_result, error) => error ? [] : ["ModelEvaluations"],
        }),
    }),
});

export const { useFetchModelEvaluationsQuery, useUploadModelEvaluationsMutation } = modelEvaluationsApi;
