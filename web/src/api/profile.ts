import { API_TAGS, baseClient } from './apiClient';

export const profileApi = baseClient.injectEndpoints({
  endpoints: (builder) => ({
    profile: builder.query({
      query: () => ({
        url: 'profile',
        method: 'GET',
      }),
    }),
    activeAgent: builder.query({
      query: () => ({
        url: 'profile/active-agent',
        method: 'GET',
      }),
      providesTags: [API_TAGS.AGENTS],
    }),
    createAgent: builder.mutation({
      query: (data: { name: string }) => ({
        url: 'profile/agents',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [API_TAGS.AGENTS],
    }),
    updateAgent: builder.mutation({
      query: (data: { id: string; name: string; defaultPrompt: string }) => ({
        url: `profile/agents/${data.id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: [API_TAGS.AGENTS],
    }),
  }),
});
