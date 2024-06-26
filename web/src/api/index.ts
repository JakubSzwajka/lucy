import { api as baseApi } from './apiClient';
import { authApi } from './auth';
import { lucyApi } from './lucy';

const api = {
  ...baseApi,
  ...authApi,
  ...lucyApi,
};

export { api };
