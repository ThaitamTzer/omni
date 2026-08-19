import { api } from '@/lib/api';
import type { Staff } from '@/lib/auth/authStore';

export function login(email: string, password: string): Promise<{ token: string; staff: Staff }> {
  return api.post('/auth/login', { email, password });
}

export function logout(): Promise<unknown> {
  return api.post('/auth/logout', {});
}
