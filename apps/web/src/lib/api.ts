import {
  getStoredAccessToken,
  setStoredToken,
  clearStoredAuth,
} from './authStore';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

let refreshPromise: Promise<boolean> | null = null;

/**
 * Call /auth/refresh (HttpOnly cookie carries the refresh token).
 * Concurrent 401s share the same refresh call. Resolves true on success.
 */
async function doRefresh(): Promise<boolean> {
  const resp = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!resp.ok) return false;
  const data = (await resp.json()) as { token: string };
  setStoredToken(data.token);
  return true;
}

function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const doFetch = (t: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (t) headers.Authorization = `Bearer ${t}`;
    return fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' });
  };

  let resp = await doFetch(getStoredAccessToken());

  // Token expired → refresh once and retry
  if (resp.status === 401) {
    const ok = await refreshAccessToken();
    if (ok) {
      resp = await doFetch(getStoredAccessToken());
    } else {
      clearStoredAuth();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(text || `HTTP ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export function getToken(): string | null {
  return getStoredAccessToken();
}
