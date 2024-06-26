import { baseClient } from './apiClient';

export const authApi = baseClient.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (data: { email: string; password: string }) => ({
        url: 'auth/login',
        method: 'POST',
        body: data,
      }),
    }),
    logout: builder.mutation({
      query: () => ({
        url: 'auth/logout',
        method: 'POST',
      }),
    }),
    register: builder.mutation({
      query: (data: { email: string; password: string }) => ({
        url: 'auth/register',
        method: 'POST',
        body: data,
      }),
    }),
    profile: builder.query({
      query: () => ({
        url: 'auth/profile',
        method: 'GET',
      }),
    }),
  }),
});
