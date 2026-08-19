import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '@/lib/api/client';
import type { TokenProvider } from '@/lib/api/token-provider';

function makeProvider(initial: string | null = 'token-1') {
  let token = initial;
  const cleared = vi.fn();
  return {
    provider: {
      getAccessToken: () => token,
      setAccessToken: (t: string) => {
        token = t;
      },
      clearAuth: cleared,
    } satisfies TokenProvider,
    getToken: () => token,
    cleared,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createApiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gắn Bearer token và trả JSON', async () => {
    const { provider } = makeProvider('tok-abc');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const api = createApiClient(provider);
    const data = await api.get<{ ok: boolean }>('/conversations');

    expect(data).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/conversations');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-abc');
  });

  it('401 → refresh thành công → retry dùng token mới', async () => {
    const { provider, getToken } = makeProvider('expired');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ token: 'fresh-token' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const api = createApiClient(provider);
    const data = await api.get<{ ok: boolean }>('/conversations');

    expect(data).toEqual({ ok: true });
    expect(getToken()).toBe('fresh-token');
    // call 1: GET /conversations (401) — call 2: POST /auth/refresh — call 3: GET retry
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retryInit = fetchMock.mock.calls[2][1] as RequestInit;
    expect((retryInit.headers as Record<string, string>).Authorization).toBe('Bearer fresh-token');
  });

  it('refresh thất bại → clearAuth + onSessionExpired + throw', async () => {
    const { provider, cleared } = makeProvider('expired');
    const onSessionExpired = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: 'nope' }, 401));
    vi.stubGlobal('fetch', fetchMock);

    const api = createApiClient(provider, { onSessionExpired });
    await expect(api.get('/conversations')).rejects.toThrow('Session expired');

    expect(cleared).toHaveBeenCalled();
    expect(onSessionExpired).toHaveBeenCalled();
  });

  it('non-401 error → throw với message', async () => {
    const { provider } = makeProvider();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'boom' }, 500)));

    const api = createApiClient(provider);
    await expect(api.get('/conversations')).rejects.toThrow('boom');
  });

  it('concurrent 401 dùng chung 1 refresh (single-flight)', async () => {
    const { provider, getToken } = makeProvider('expired');
    let refreshCount = 0;
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'POST' && url.includes('/auth/refresh')) {
        refreshCount += 1;
        return jsonResponse({ token: `fresh-${refreshCount}` });
      }
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      // Token 'expired' → 401 để kích hoạt refresh; token mới → 200
      return auth?.includes('expired') ? jsonResponse({ message: 'Unauthorized' }, 401) : jsonResponse({ ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);

    const api = createApiClient(provider);
    const [r1, r2] = await Promise.all([api.get('/a'), api.get('/b')]);

    expect(r1).toEqual({ ok: true });
    expect(r2).toEqual({ ok: true });
    expect(refreshCount).toBe(1);
    expect(getToken()).toBe('fresh-1');
  });
});
