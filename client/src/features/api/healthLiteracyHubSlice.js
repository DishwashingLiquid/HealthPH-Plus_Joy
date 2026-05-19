import { baseAPI } from "./_baseAPI";

export const healthLiteracyHubApi = baseAPI.injectEndpoints({
  endpoints: (builder) => ({
    fetchHealthLiteracyContent: builder.query({
      query: (contentType) => `/health-literacy-hub/${contentType}`,
      providesTags: (result, error, contentType) => [
        { type: "HealthLiteracyContent", id: contentType },
      ],
    }),
    createHealthLiteracyContent: builder.mutation({
      query: ({ contentType, data }) => ({
        url: `/health-literacy-hub/${contentType}`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (result, error, { contentType }) => [
        { type: "HealthLiteracyContent", id: contentType },
      ],
    }),
    updateHealthLiteracyContent: builder.mutation({
      query: ({ contentType, contentId, data }) => ({
        url: `/health-literacy-hub/${contentType}/${contentId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { contentType }) => [
        { type: "HealthLiteracyContent", id: contentType },
      ],
    }),
  }),
});

export const {
  useFetchHealthLiteracyContentQuery,
  useCreateHealthLiteracyContentMutation,
  useUpdateHealthLiteracyContentMutation,
} = healthLiteracyHubApi;
