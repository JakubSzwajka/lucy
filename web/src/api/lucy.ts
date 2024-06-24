import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const lucyApi = createApi({
  reducerPath: 'lucyApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${process.env.REACT_APP_API_URL}/api`,
    prepareHeaders: (headers) => {
      headers.set('Authorization', `Bearer ${process.env.REACT_APP_API_KEY}`);
      return headers;
    },
  }),
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

export const { useGetSkillsQuery, useGetMessagesQuery } = lucyApi;
