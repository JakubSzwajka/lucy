import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const API_TAGS = {
  AGENTS: 'Agents',
  SKILLS: 'Skills',
  MESSAGES: 'Messages',
  MEMORIES: 'Memories',
};

export const baseClient = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: `${import.meta.env.VITE_APP_API_URL || ''}/api`,
    credentials: 'include',
  }),
  endpoints: () => ({}),
  tagTypes: [
    API_TAGS.AGENTS,
    API_TAGS.SKILLS,
    API_TAGS.MESSAGES,
    API_TAGS.MEMORIES,
  ],
});
