import type { TokenProvider } from './token-provider';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export interface ApiClientOptions {
  /** Gọi khi refresh token thất bại (session expired). Mặc định redirect /login. */
  onSessionExpired?: () => void;
}

/**
 * Fetch wrapper có auth: gắn Bearer token, single-flight refresh khi 401, retry 1 lần.
 * Phụ thuộc TokenProvider thay vì Recoil/authStore — test được độc lập.
 */
export function createApiClient(provider: TokenProvider, opts: ApiClientOptions = {}) {
  const { onSessionExpired = () => { window.location.href = '/login'; } } = opts;

  let refreshPromise: Promise<boolean> | null = null;

  async function doRefresh(): Promise<boolean> {
    const resp = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!resp.ok) return false;
    const data = (await resp.json()) as { token: string };
    provider.setAccessToken(data.token);
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

    let resp = await doFetch(provider.getAccessToken());

    // Token expired → refresh once and retry
    if (resp.status === 401) {
      const ok = await refreshAccessToken();
      if (ok) {
        resp = await doFetch(provider.getAccessToken());
      } else {
        provider.clearAuth();
        onSessionExpired();
        throw new Error('Session expired');
      }
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(text || `HTTP ${resp.status}`);
    }
    return resp.json() as Promise<T>;
  }

  return {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body: unknown) =>
      request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
    patch: <T>(path: string, body: unknown) =>
      request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
    del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
