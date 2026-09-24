import { clearSession, getDevUser, getSession, setSession } from '@/lib/session';
import type { Envelope, Session } from '@/types/api';

/**
 * SpaceFit fetch client — a 1:1 port of the legacy js/api.js:
 * unwraps the { success, data, error } envelope, attaches the bearer token /
 * X-Dev-User header, and performs one transparent refresh on a 401.
 */

export const API_BASE: string =
  import.meta.env.VITE_API_BASE ??
  (typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)
    ? ''
    : 'http://localhost:4000');

export class ApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Internal: set after a transparent refresh to avoid looping. */
  _retry?: boolean;
}

function buildHeaders(options: RequestOptions): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const session = getSession();
  if (session?.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`;
  }
  // Memory-mode dev identity — the server ignores this when Supabase is set.
  const devUser = getDevUser();
  if (devUser && !session?.accessToken) {
    headers['X-Dev-User'] = devUser;
  }
  return headers;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const payload = (await res.json().catch(() => ({
    success: false,
    error: { message: 'Invalid server response' }
  }))) as Envelope<T>;

  if (!res.ok || payload.success === false) {
    const error = payload.success === false ? payload.error : undefined;
    throw new ApiError(error?.message || 'Request failed', res.status, error?.details);
  }
  return payload.data;
}

async function refreshAccessToken(): Promise<void> {
  const session = getSession();
  if (!session?.refreshToken) throw new ApiError('No refresh token', 401);

  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken })
  });
  const payload = (await res.json().catch(() => null)) as
    | (Envelope<{ session: { accessToken: string; refreshToken: string }; user: Session['user'] }>)
    | null;
  if (!payload || payload.success === false) throw new ApiError('Refresh failed', 401);

  setSession({
    accessToken: payload.data.session.accessToken,
    refreshToken: payload.data.session.refreshToken,
    user: payload.data.user,
    profile: session.profile ?? null
  });
}

/** Core request helper — every endpoint module goes through this. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      headers: buildHeaders(options),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
    return await parseResponse<T>(res);
  } catch (err) {
    const error = err as ApiError;
    // One transparent refresh attempt on an expired session.
    if (error?.status === 401 && !options._retry && getSession()?.refreshToken) {
      try {
        await refreshAccessToken();
        return await request<T>(path, { ...options, _retry: true });
      } catch {
        clearSession();
        throw error;
      }
    }
    if (error?.status === 401) clearSession();
    throw error;
  }
}

/** Query-string helper: drops undefined/null/empty values. */
export function qs(
  params: Record<string, string | number | boolean | null | undefined> | null | undefined
): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}
