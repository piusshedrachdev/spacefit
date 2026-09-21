import { getUserFromToken } from '../lib/supabase.js';
import { ApiError } from '../utils/http.js';
import { usingSupabase } from '../db/index.js';

/**
 * Extract a bearer token from the Authorization header, if present.
 */
function bearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim() || null;
}

/**
 * Attach `req.user` (or null) and `req.accessToken` to every request without
 * rejecting unauthenticated callers. Use this on routes that behave differently
 * for signed-in users but are still public.
 */
export async function attachUser(req, _res, next) {
  try {
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
export async function requireAdmin(req, _res, next) {
  try {
    if (!usingSupabase()) return next();

    if (!req.user) {
      const token = bearerToken(req);
      req.accessToken = token;
      req.user = token ? await getUserFromToken(token) : null;
    }
    if (!req.user) return next(ApiError.unauthorized('Authentication required'));

    const role = req.user.app_metadata?.role || req.user.user_metadata?.role;
    if (role !== 'admin') return next(ApiError.unauthorized('Admin access required'));
    next();
  } catch (err) {
    next(err);
  }
}
