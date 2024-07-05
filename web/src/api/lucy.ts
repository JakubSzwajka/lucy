import { API_TAGS, baseClient } from './apiClient';

export const lucyApi = baseClient.injectEndpoints({
  endpoints: (builder) => ({
    getSkills: builder.query({
      query: (query: string) => `lucy/skills${query ? `?query=${query}` : ''}`,
      providesTags: [API_TAGS.SKILLS],
    }),
    getMessages: builder.query({
      query: (query: string) =>
        `lucy/messages${query ? `?query=${query}` : ''}`,
      providesTags: [API_TAGS.MESSAGES],
    }),
    deleteMessage: builder.mutation({
      query: () => ({
        url: `lucy/messages`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: API_TAGS.MESSAGES }],
    }),
    toogleSkill: builder.mutation({
      query: (skill: { skillId: string }) => ({
        url: `lucy/skills/${skill.skillId}/toggle`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: API_TAGS.SKILLS }],
    }),
    getMemories: builder.query({
      query: (query: string) =>
        `lucy/memories${query ? `?query=${query}` : ''}`,
      providesTags: [API_TAGS.MEMORIES],
    }),
    deleteMemories: builder.mutation({
      query: () => ({
        url: `lucy/memories`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: API_TAGS.MEMORIES }],
    }),
    deleteMemory: builder.mutation({
      query: (memoryId: string) => ({
        url: `lucy/memories/${memoryId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: API_TAGS.MEMORIES }],
    }),
  }),
});
