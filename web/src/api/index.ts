import { baseClient } from './apiClient';
import { authApi } from './auth';
import { lucyApi } from './lucy';
import { profileApi } from './profile';

const api = {
  ...baseClient,
  ...authApi,
  ...lucyApi,
  ...profileApi,
};

export { api };
