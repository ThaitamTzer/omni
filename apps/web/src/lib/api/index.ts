import { createApiClient } from './client';
import { authTokenProvider } from '@/lib/auth/authStore';

export const api = createApiClient(authTokenProvider);

export function getToken(): string | null {
  return authTokenProvider.getAccessToken();
}
