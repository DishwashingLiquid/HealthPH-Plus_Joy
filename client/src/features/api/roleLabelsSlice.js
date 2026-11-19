import { baseAPI } from "./_baseAPI";

export const roleLabelsSlice = baseAPI.injectEndpoints({
  endpoints: (builder) => ({
    fetchRoleLabels: builder.query({
      query: () => "/role-labels",
      providesTags: ["RoleLabels"],
    }),
    createRoleLabel: builder.mutation({
      query: (formData) => ({
        url: "/role-labels",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["RoleLabels", "AccountAnalytics"],
    }),
    updateRoleLabel: builder.mutation({
      query: ({ id, ...formData }) => ({
        url: `/role-labels/${id}`,
        method: "PUT",
        body: formData,
      }),
      invalidatesTags: ["RoleLabels", "AccountAnalytics"],
    }),
    deleteRoleLabel: builder.mutation({
      query: (id) => ({
        url: `/role-labels/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["RoleLabels", "AccountAnalytics"],
    }),
  }),
});

export const {
  useFetchRoleLabelsQuery,
  useCreateRoleLabelMutation,
  useUpdateRoleLabelMutation,
  useDeleteRoleLabelMutation,
} = roleLabelsSlice;
