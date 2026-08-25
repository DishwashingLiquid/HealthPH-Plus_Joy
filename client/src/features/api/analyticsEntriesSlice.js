import { baseAPI } from "./_baseAPI";

export const analyticsEntriesApi = baseAPI.injectEndpoints({
    endpoints: (builder) => ({
        fetchAnalyticsEntries: builder.query({
            query: ({
                sourceType = "all",
                analysisStatus = "all",
                datasetId = "all",
                search = "",
                limit = 100,
            } = {}) => ({
                url: "/analytics-entries",
                params: {
                    source_type: sourceType,
                    analysis_status: analysisStatus,
                    dataset_id: datasetId,
                    search,
                    limit, 
                },
            }),
            providesTags: ["AnalyticsEntries"],
        }),
    }),
});

export const {
    useFetchAnalyticsEntriesQuery,
} = analyticsEntriesApi;