import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import type { ReactNode } from 'react';
import * as authService from '@/api/auth';
import { clearSession, getDevUser, getSession, setDevUser } from '@/lib/session';
import type {
  AuthMeResult,
  AuthResult,
  AuthUser,
  Profile,
  ProfileUpdate,
  Role,
  Session,
  SignupPayload
} from '@/types/api';

type AuthStatus = 'loading' | 'ready';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: AuthUser | null;
  profile: Profile | null;
  role: Role;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (payload: SignupPayload) => Promise<AuthResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthMeResult | null>;
  updateProfile: (patch: ProfileUpdate) => Promise<AuthMeResult>;
  /** Memory-mode demo sign-in (mirrors legacy setDevUser + clearSession). */
  applyDevUser: (id: string) => Promise<void>;
  clearDevUser: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Mirrors legacy SpaceFitAPI.getRole() resolution for a given dev user. */
function resolveRole(profile: Profile | null, devUser: string | null): Role {
  if (profile?.role) return profile.role;
  if (devUser === 'dev-user-admin') return 'admin';
  if (devUser === 'dev-user-seller') return 'seller';
  return 'customer';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(() => getSession());
  const [devUser, setDevUserState] = useState<string | null>(() => getDevUser());
  const [status, setStatus] = useState<AuthStatus>('loading');

  const profile = session?.profile ?? null;
  const isAuthenticated = Boolean(session?.accessToken || devUser);
  const role = resolveRole(profile, devUser);

  // Refresh user + profile once on mount when we appear signed in (same
  // behaviour as the legacy pages calling getMe() during boot).
  const refresh = useCallback(async (): Promise<AuthMeResult | null> => {
    if (!getSession()?.accessToken && !getDevUser()) return null;
    try {
      const data = await authService.getMe();
      setSessionState(getSession());
      return data;
    } catch {
      // 401 handling inside the client may have cleared the session already.
      setSessionState(getSession());
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refresh();
      if (!cancelled) setStatus('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authService.login(email, password);
    setSessionState(getSession());
    setDevUserState(getDevUser());
    return data;
  }, []);

  const signup = useCallback(async (payload: SignupPayload) => {
    const data = await authService.signup(payload);
    setSessionState(getSession());
    return data;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setSessionState(getSession());
  }, []);

  const updateProfile = useCallback(async (patch: ProfileUpdate) => {
    const data = await authService.updateMe(patch);
    setSessionState(getSession());
    return data;
  }, []);

  const applyDevUser = useCallback(async (id: string) => {
    setDevUser(id);
    clearSession();
    setSessionState(null);
    setDevUserState(id);
    await refresh();
  }, [refresh]);

  const clearDevUser = useCallback(() => {
    setDevUser(null);
    setDevUserState(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      profile,
      role,
      isAuthenticated,
      login,
      signup,
      logout,
      refresh,
      updateProfile,
      applyDevUser,
      clearDevUser
    }),
    [
      status,
      session,
      profile,
      role,
      isAuthenticated,
      login,
      signup,
      logout,
      refresh,
      updateProfile,
      applyDevUser,
      clearDevUser
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
