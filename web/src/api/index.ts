import { baseClient } from './apiClient';
import { authApi } from './auth';
import { lucyApi } from './lucy';

const api = {
  ...baseClient,
  ...authApi,
  ...lucyApi,
};

export { api };
