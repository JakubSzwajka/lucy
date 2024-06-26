import { api } from './apiClient';

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (data: { email: string; password: string }) => ({
        url: 'auth/login',
        method: 'POST',
        body: data,
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
