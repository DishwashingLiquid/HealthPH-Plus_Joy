import { baseAPI } from "./_baseAPI";

export const analyticsEntriesApi = baseAPI.injectEndpoints({
    endpoints: (builder) => ({
        fetchNlpEntitySummary: builder.query({
            query: () => "/analytics-entries/nlp-entity-summary",
            providesTags: ["AnalyticsEntries"],
        }),
        fetchSurveillanceSummary: builder.query({
            query: ({
                region = "all",
                disease = "all",
                days = 7,
                hours,
            } = {}) => ({
                url: "/analytics-entries/surveillance-summary",
                params: { region, disease, days, hours },
            }),
            providesTags: ["AnalyticsEntries"],
        }),
        fetchAnalyticsEntries: builder.query({
            query: ({
                sourceType = "all",
                analysisStatus = "all",
                datasetId = "all",
                search = "",
                limit = 100,
                offset = 0,
                language = "all",
                dateFrom = "",
                dateTo = "",
                region = "all",
            } = {}) => ({
                url: "/analytics-entries/",
                params: {
                    source_type: sourceType,
                    analysis_status: analysisStatus,
                    dataset_id: datasetId,
                    search,
                    limit,
                    offset,
                    language,
                    date_from: dateFrom || undefined,
                    date_to: dateTo || undefined,
                    region,
                },
            }),
            providesTags: ["AnalyticsEntries"],
        }),
        fetchSelfReportLanguageSummary: builder.query({
            query: () => "/analytics-entries/language-summary",
            providesTags: ["AnalyticsEntries"],
        }),
        fetchAnalyticsMapPoints: builder.query({
            query: ({ days = 7, hours } = {}) => ({
                url: "/analytics-entries/map-points",
                params: { days, hours },
            }),
            providesTags: ["AnalyticsEntries"],
        }),
        processAnalyticsEntries: builder.mutation({
            query: (entryIds) => ({
                url: "/analytics-entries/process",
                method: "POST",
                body: entryIds,
            }),
            invalidatesTags: ["AnalyticsEntries"],
        }),
    }),
});

export const {
    useFetchSurveillanceSummaryQuery,
    useFetchAnalyticsEntriesQuery,
    useLazyFetchAnalyticsEntriesQuery,
    useFetchAnalyticsMapPointsQuery,
    useFetchSelfReportLanguageSummaryQuery,
    useProcessAnalyticsEntriesMutation,
    useFetchNlpEntitySummaryQuery,
} = analyticsEntriesApi;
