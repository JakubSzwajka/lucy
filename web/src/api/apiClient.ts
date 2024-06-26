import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: `${process.env.REACT_APP_API_URL}/api`,
    prepareHeaders: (headers, { getState }) => {
      //   headers.set('Authorization', `Bearer ${process.env.REACT_APP_API_KEY}`);
      //   return headers;
    },
    // prepareHeaders: async (headers, { getState }) => {
    //   const token = (
    //     getState() as { auth: { userSession: { accessToken: string } } }
    //   ).auth?.userSession?.accessToken;

    //   let clientId = localStorage.getItem('clientId');
    //   if (!clientId || clientId === null) {
    //     clientId = Math.random().toString(36).slice(2);
    //     localStorage.setItem('clientId', clientId);
    //   }
    //   headers.set('x-client-id', clientId);
    //   headers.set('x-request-id', Math.random().toString(36).slice(2));

    //   if (token) {
    //     headers.set('Authorization', `Bearer ${token}`);
    //   }

    //   headers.set('Idempotent-key', Math.random().toString(36).slice(2));
    //   return headers;
    // },
    credentials: 'include',
  }),
  endpoints: (builder) => ({}),
});
