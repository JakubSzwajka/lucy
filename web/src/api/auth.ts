import { baseClient } from './apiClient';
import { z } from 'zod';
import { RegisterSchema, LoginSchema } from 'shared-dto';

export const authApi = baseClient.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (data: z.infer<typeof LoginSchema>) => ({
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
      query: (data: z.infer<typeof RegisterSchema>) => ({
        url: 'auth/register',
        method: 'POST',
        body: data,
      }),
    }),
  }),
});
