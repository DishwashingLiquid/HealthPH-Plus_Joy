import { baseAPI } from "./_baseAPI";

export const organizationSlice = baseAPI.injectEndpoints({
    endpoints: (builder) => ({
        fetchOrganizations: builder.query({
            query: () => "/organizations",
            providesTags: ["Organizations"],
        }),

        createOrganization: builder.mutation({
            query: (formData) => ({
                url: "/organizations",
                method: "POST",
                body: formData,
            }),
            invalidatesTags: ["Organizations"],
        }),

        updateOrganization: builder.mutation({
            query: ({ id, ...formData }) => ({
                url: `/organizations/${id}`,
                method: "PUT",
                body: formData,
            }),
            invalidatesTags: ["Organizations"],
        }),

        deleteOrganization: builder.mutation({
            query: (id) => ({
                url: `/organizations/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["Organizations"],
        }),
    }),
});

export const {
    useFetchOrganizationsQuery,
    useCreateOrganizationMutation,
    useUpdateOrganizationMutation,
    useDeleteOrganizationMutation,
} = organizationSlice;