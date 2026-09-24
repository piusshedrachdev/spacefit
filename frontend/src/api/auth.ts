import { request } from '@/lib/api';
import { getSession, setSession } from '@/lib/session';
import type {
  AuthMeResult,
  AuthResult,
  Profile,
  ProfileUpdate,
  SignupPayload
} from '@/types/api';

/** Auth endpoints — session side effects mirror the legacy client. */

export async function login(email: string, password: string): Promise<AuthResult> {
  const data = await request<AuthResult>('/api/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  if (data.session) {
    setSession({
      accessToken: data.session.accessToken,
      refreshToken: data.session.refreshToken,
      user: data.user,
      profile: data.profile ?? null
    });
  }
  return data;
}

export async function signup(payload: SignupPayload): Promise<AuthResult> {
  const data = await request<AuthResult>('/api/auth/signup', {
    method: 'POST',
    body: payload
  });
  if (data.session) {
    setSession({
      accessToken: data.session.accessToken,
      refreshToken: data.session.refreshToken,
      user: data.user,
      profile: null
    });
  }
  return data;
}

export async function logout(): Promise<void> {
  try {
    await request('/api/auth/logout', { method: 'POST' });
  } catch {
    /* best effort — clear locally regardless */
  }
  setSession(null);
}

/** Refresh user + profile and persist them onto the stored session. */
export async function getMe(): Promise<AuthMeResult> {
  const data = await request<AuthMeResult>('/api/auth/me');
  const session = getSession();
  setSession({
    accessToken: session?.accessToken ?? '',
    refreshToken: session?.refreshToken ?? '',
    user: data.user ?? null,
    profile: data.profile ?? null
  });
  return data;
}

/** PATCH /api/auth/me — merges the updated profile into the session. */
export async function updateMe(patch: ProfileUpdate): Promise<AuthMeResult> {
  const data = await request<AuthMeResult>('/api/auth/me', {
    method: 'PATCH',
    body: patch
  });
  const session = getSession();
  if (session && data.profile) {
    setSession({ ...session, profile: data.profile as Profile });
  }
  return data;
}
