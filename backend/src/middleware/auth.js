import { getUserFromToken } from '../lib/supabase.js';
import { ApiError } from '../utils/http.js';
import { usingSupabase, getProfileRow, getSellerByUserId } from '../db/index.js';
import { store } from '../store.js';

/**
 * Extract a bearer token from the Authorization header, if present.
 */
function bearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim() || null;
}

/**
 * In in-memory (dev/test) mode there is no Supabase session, so callers may
 * identify themselves with an `X-Dev-User` header. This mirrors the seeded
 * demo accounts (see store.js) and lets the seller/admin flows be exercised
 * end-to-end without a live Supabase project. It is intentionally ignored
 * whenever Supabase is configured.
 */
function devUser(req) {
  const id = req.headers['x-dev-user'];
  if (!id) return null;
  const user = store.findUserById(String(id));
  if (!user) return null;
  const profile = store.getProfileRow(user.id);
  return {
    id: user.id,
    email: user.email,
    app_metadata: { role: profile?.role || user.role || 'customer' },
    user_metadata: { role: profile?.role || user.role || 'customer' }
  };
}

/**
 * Attach `req.user` (or null) and `req.accessToken` to every request without
 * rejecting unauthenticated callers. Use this on routes that behave differently
 * for signed-in users but are still public.
 */
export async function attachUser(req, _res, next) {
  try {
    if (!usingSupabase()) {
      req.accessToken = null;
      req.user = devUser(req);
      return next();
    }
    const token = bearerToken(req);
    req.accessToken = token;
    req.user = token ? await getUserFromToken(token) : null;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Reject the request unless a valid Supabase session is present.
 * In in-memory mode (local dev without Supabase) this is a no-op so the API
 * stays fully usable.
 */
export async function requireAuth(req, _res, next) {
  try {
    if (!usingSupabase()) return next();

    if (!req.user) {
      const token = bearerToken(req);
      req.accessToken = token;
      req.user = token ? await getUserFromToken(token) : null;
    }
    if (!req.user) return next(ApiError.unauthorized('Authentication required'));
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Reject the request unless the authenticated user is an admin.
 * In in-memory mode this is a no-op so seeded local development still works.
 */
/**
 * Resolve the caller's effective role.
 *
 * `public.profiles.role` is the single source of truth. The JWT metadata is
 * only consulted as a fallback when the profile row is missing (e.g. a user
 * created before the profile trigger existed), so promoting an admin is a
 * one-line `update public.profiles set role='admin'` — no app_metadata edit.
 *
 * In in-memory mode the store's profile row is used (dev users always have one).
 *
 * @returns {Promise<string>} one of 'customer' | 'seller' | 'admin'
 */
export async function resolveRole(req, userId = req.user?.id) {
  if (!userId) return null;
  const profile = await getProfileRow(userId);
  if (profile?.role) return profile.role;
  return req.user?.app_metadata?.role || req.user?.user_metadata?.role || 'customer';
}

/**
 * Reject the request unless the authenticated user is an admin.
 *
 * The role is read from `profiles.role` (the authoritative store); the JWT
 * metadata is only a fallback when no profile row exists. This means an admin
 * can be promoted with a single SQL update — no Supabase dashboard edit needed.
 *
 * In in-memory mode the guard is relaxed (consistent with requireAuth) but
 * `req.role` is still resolved so downstream handlers behave identically.
 */
export async function requireAdmin(req, _res, next) {
  try {
    if (!usingSupabase()) {
      req.role = req.user ? await resolveRole(req) : null;
      return next();
    }

    if (!req.user) {
      const token = bearerToken(req);
      req.accessToken = token;
      req.user = token ? await getUserFromToken(token) : null;
    }
    if (!req.user) return next(ApiError.unauthorized('Authentication required'));

    const role = await resolveRole(req);
    req.role = role;
    if (role !== 'admin') return next(ApiError.unauthorized('Admin access required'));
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Reject the request unless the authenticated user is an active seller.
 *
 * Supabase mode resolves the caller's `profiles.role` and their `sellers.status`:
 *   - no session            -> 401
 *   - not a seller          -> 403 "Seller access required"
 *   - blocked seller        -> 403 "Seller account is blocked"
 * On success `req.seller` is attached for downstream handlers.
 *
 * In in-memory mode this is a no-op (consistent with requireAuth/requireAdmin)
 * and attaches the seeded seller row for the dev caller when it exists.
 */
export async function requireSeller(req, _res, next) {
  try {
    if (!usingSupabase()) {
      req.seller = req.user ? await getSellerByUserId(req.user.id) : null;
      return next();
    }

    if (!req.user) {
      const token = bearerToken(req);
      req.accessToken = token;
      req.user = token ? await getUserFromToken(token) : null;
    }
    if (!req.user) return next(ApiError.unauthorized('Authentication required'));

    const [profile, seller, role] = await Promise.all([
      getProfileRow(req.user.id),
      getSellerByUserId(req.user.id),
      resolveRole(req)
    ]);

    if (!seller || role !== 'seller') {
      return next(ApiError.unauthorized('Seller access required'));
    }
    if (seller.status === 'blocked') {
      return next(new ApiError(403, 'Seller account is blocked'));
    }

    req.seller = seller;
    req.profile = profile || null;
    req.role = role;
    next();
  } catch (err) {
    next(err);
  }
}
