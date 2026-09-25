import { request } from '@/lib/api';
import { getDevUser, getSession, setDevUser, setSession } from '@/lib/session';
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

interface LogoutCredentials {
  accessToken?: string | null;
  devUser?: string | null;
}

export async function logout(credentials: LogoutCredentials = {}): Promise<void> {
  // Capture credentials for the best-effort server revoke, then clear the
  // browser identity before waiting on the network. A slow or unavailable
  // logout endpoint must not leave a seller/admin account active locally.
  const accessToken = credentials.accessToken ?? getSession()?.accessToken;
  const devUser = credentials.devUser ?? getDevUser();
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (devUser) {
    headers['X-Dev-User'] = devUser;
  }

  setSession(null);
  setDevUser(null);
  try {
    await request('/api/auth/logout', { method: 'POST', headers });
  } catch {
    /* best effort — the local session is already signed out */
  }
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
export async function updateMe(patch: ProfileUpdate): Promise<Profile> {
  const data = await request<Profile>('/api/auth/me', {
    method: 'PATCH',
    body: patch
  });
  const session = getSession();
  if (session) {
    setSession({ ...session, profile: data });
  }
  return data;
}
