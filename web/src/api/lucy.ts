import { baseClient } from './apiClient';

export const lucyApi = baseClient.injectEndpoints({
  endpoints: (builder) => ({
    getSkills: builder.query({
      query: (query: string) => `lucy/skills${query ? `?query=${query}` : ''}`,
    }),
    getMessages: builder.query({
      query: (query: string) =>
        `lucy/messages${query ? `?query=${query}` : ''}`,
    }),
  }),
});
