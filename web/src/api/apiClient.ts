import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const API_TAGS = {
  AGENTS: 'Agents',
};

export const baseClient = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: `${import.meta.env.VITE_APP_API_URL}/api`,
    credentials: 'include',
  }),
  endpoints: () => ({}),
  tagTypes: [API_TAGS.AGENTS],
});
