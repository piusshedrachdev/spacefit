import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

/**
 * Supabase clients.
 *
 * `supabaseAdmin` uses the secret (service-role) key and BYPASSES RLS. It must
 * only be used in trusted server code — never shipped to a browser.
 *
 * `createUserClient(accessToken)` returns a client scoped to a single user's
 * JWT so RLS policies apply exactly as they would for a direct frontend call.
 *
 * Supabase terminology note: newer projects call these keys `publishable` and
 * `secret`; older projects call them `anon` and `service_role`. We accept both
 * env var names.
 */

const SUPABASE_URL = config.supabase.url;
const SUPABASE_SECRET = config.supabase.secretKey;
const SUPABASE_PUBLISHABLE = config.supabase.publishableKey;

/** True when the minimum credentials for server-side DB access are present. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_SECRET);

let _adminClient = null;

/**
 * Lazily construct the service-role client. Throws a clear error if the
 * project has not been configured yet, rather than failing at import time.
 */
export function getSupabaseAdmin() {
  if (_adminClient) return _adminClient;
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY ' +
        '(or SUPABASE_SERVICE_ROLE_KEY) in the backend environment.'
    );
  }
  _adminClient = createClient(SUPABASE_URL, SUPABASE_SECRET, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return _adminClient;
}

/**
 * Build a client that acts as a specific user by forwarding their access token.
 * Useful when a request should be subject to RLS.
 * @param {string} accessToken - the user's Supabase JWT
 */
export function createUserClient(accessToken) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY ' +
        '(or SUPABASE_ANON_KEY) in the backend environment.'
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

/**
 * Verify a user access token and return the associated auth user, or null.
 * @param {string} accessToken
 */
export async function getUserFromToken(accessToken) {
  if (!accessToken || !isSupabaseConfigured) return null;
  const { data, error } = await getSupabaseAdmin().auth.getUser(accessToken);
  if (error) return null;
  return data?.user ?? null;
}
