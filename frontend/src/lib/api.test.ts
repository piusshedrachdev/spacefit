import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE, ApiError, qs, request } from '@/lib/api';
import { clearSession, getSession, setDevUser, setSession } from '@/lib/session';

/** Unit tests for the typed fetch client (ported from js/api.js). */

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body)
  } as Response;
}

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('request()', () => {
  it('unwraps the success envelope and returns data', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { hello: 'world' } }));

    await expect(request('/api/thing')).resolves.toEqual({ hello: 'world' });
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/api/thing`,
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('throws an ApiError with status and details on a failure envelope', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: { message: 'Validation failed', details: { field: 'email' } }
        },
        422
      )
    );

    const error = await request('/api/thing').catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      message: 'Validation failed',
      status: 422,
      details: { field: 'email' }
    });
  });

  it('sends the bearer token when a session exists', async () => {
    setSession({
      accessToken: 'token-1',
      refreshToken: 'refresh-1',
      user: { id: 'u1' },
      profile: null
    });
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: null }));

    await request('/api/secure');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
    expect((init.headers as Record<string, string>)['X-Dev-User']).toBeUndefined();
  });

  it('passes FormData through without forcing a JSON content type', async () => {
    const form = new FormData();
    form.append('title', 'Uploaded product');
    form.append('images', new Blob(['image-bytes'], { type: 'image/png' }), 'product.png');
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: null }));

    await request('/api/products', { method: 'POST', body: form });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(form);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('sends X-Dev-User for memory-mode identities without a token', async () => {
    setDevUser('dev-user-seller');
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: null }));

    await request('/api/secure');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Dev-User']).toBe('dev-user-seller');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('refreshes once on 401 and retries the original request', async () => {
    setSession({
      accessToken: 'expired',
      refreshToken: 'refresh-1',
      user: { id: 'u1' },
      profile: null
    });

    fetchMock.mockImplementation((input: string) => {
      if (input.includes('/api/auth/refresh')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            data: { session: { accessToken: 'fresh', refreshToken: 'refresh-2' }, user: { id: 'u1' } }
          })
        );
      }
      // First attempt401s, the retry succeeds.
      const attempt = fetchMock.mock.calls.filter((call) =>
        String(call[0]).includes('/api/thing')
      ).length;
      return attempt === 1
        ? Promise.resolve(jsonResponse({ success: false, error: { message: 'Expired' } }, 401))
        : Promise.resolve(jsonResponse({ success: true, data: { retried: true } }));
    });

    await expect(request('/api/thing')).resolves.toEqual({ retried: true });

    // Session rotated to the fresh tokens.
    const raw = localStorage.getItem('spacefitSession');
    expect(raw).toContain('"accessToken":"fresh"');
    expect(raw).toContain('"refreshToken":"refresh-2"');
  });

  it('clears the session and rethrows when refresh fails', async () => {
    setSession({
      accessToken: 'expired',
      refreshToken: 'refresh-1',
      user: { id: 'u1' },
      profile: null
    });
    fetchMock.mockImplementation((input: string) =>
      input.includes('/api/auth/refresh')
        ? Promise.resolve(jsonResponse({ success: false, error: { message: 'Nope' } }, 401))
        : Promise.resolve(jsonResponse({ success: false, error: { message: 'Expired' } }, 401))
    );

    await expect(request('/api/thing')).rejects.toMatchObject({
      message: 'Expired',
      status: 401
    });
    expect(localStorage.getItem('spacefitSession')).toBeNull();
  });

  it('clears the session on a bare 401 without a refresh token', async () => {
    setSession({
      accessToken: 'expired',
      refreshToken: '',
      user: { id: 'u1' },
      profile: null
    });
    fetchMock.mockResolvedValue(
      jsonResponse({ success: false, error: { message: 'Unauthorized' } }, 401)
    );

    await expect(request('/api/thing')).rejects.toMatchObject({ status: 401 });
    expect(localStorage.getItem('spacefitSession')).toBeNull();
    // Only one attempt — no refresh round-trip.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('qs()', () => {
  it('builds a query string and drops empty values', () => {
    expect(qs({ a: 1, b: 'x' })).toBe('?a=1&b=x');
    expect(qs({ a: undefined, b: null, c: '' })).toBe('');
    expect(qs(null)).toBe('');
  });
});

describe('session edge cases', () => {
  it('returns null for corrupt session JSON', async () => {
    localStorage.setItem('spacefitSession', '{not json');
    expect(getSession()).toBeNull();

    // request must still work with the corrupt session present.
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: 'ok' }));
    await expect(request('/api/thing')).resolves.toBe('ok');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('clearSession removes the stored session', () => {
    setSession({
      accessToken: 'a',
      refreshToken: 'b',
      user: null,
      profile: null
    });
    clearSession();
    expect(localStorage.getItem('spacefitSession')).toBeNull();
  });
});
