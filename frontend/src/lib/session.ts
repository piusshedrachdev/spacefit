import type { Profile, Role, Session } from '@/types/api';

/**
 * localStorage-backed session, dev identity and cart ids.
 * Keys are shared verbatim with the legacy js/api.js so existing visitors
 * keep their session/cart across the migration.
 */

export const SESSION_KEY = 'spacefitSession';
export const CART_KEY = 'spacefitCartId';
/** Pre-cart-id cart payload (kept for parity; not read by the new client). */
export const LEGACY_CART_KEY = 'spacefitCart';
export const DEV_USER_KEY = 'spacefitDevUser';

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(session: Session | null): void {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable — behave as signed out */
  }
}

export function clearSession(): void {
  setSession(null);
}

/** Memory-mode dev identity (ignored by the server when Supabase is on). */
export function getDevUser(): string | null {
  try {
    return localStorage.getItem(DEV_USER_KEY);
  } catch {
    return null;
  }
}

export function setDevUser(id: string | null): void {
  try {
    if (id) localStorage.setItem(DEV_USER_KEY, id);
    else localStorage.removeItem(DEV_USER_KEY);
  } catch {
    /* noop */
  }
}

export function getCartId(): string | null {
  try {
    return localStorage.getItem(CART_KEY);
  } catch {
    return null;
  }
}

export function setCartId(id: string): void {
  try {
    localStorage.setItem(CART_KEY, id);
  } catch {
    /* noop */
  }
}

export function clearCartId(): void {
  try {
    localStorage.removeItem(CART_KEY);
  } catch {
    /* noop */
  }
}

export function isAuthenticated(): boolean {
  const session = getSession();
  return Boolean(session?.accessToken || getDevUser());
}

export function getProfile(): Profile | null {
  return getSession()?.profile ?? null;
}

/** Mirrors the legacy SpaceFitAPI.getRole() resolution order. */
export function getRole(): Role {
  const profile = getProfile();
  if (profile?.role) return profile.role;
  const devUser = getDevUser();
  if (devUser === 'dev-user-admin') return 'admin';
  if (devUser === 'dev-user-seller') return 'seller';
  return 'customer';
}
