import { baseAPI } from "./_baseAPI";

export const miscApi = baseAPI.injectEndpoints({
  endpoints: (builder) => ({
    sendContactUs: builder.mutation({
      query: (data) => ({
        url: "/contact-us",
        method: "POST",
        body: data,
      }),
    }),
  }),
});

export const { useSendContactUsMutation } = miscApi;
