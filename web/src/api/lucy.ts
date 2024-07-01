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
    createSkill: builder.mutation({
      query: (skill: {
        name: string;
        description: string;
        parameters: string;
      }) => ({
        url: `lucy/skills`,
        method: 'POST',
        body: skill,
      }),
      invalidatesTags: [{ type: API_TAGS.SKILLS }],
    }),
  }),
});
