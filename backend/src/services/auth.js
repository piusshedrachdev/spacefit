import { getSupabaseAdmin, createUserClient } from '../lib/supabase.js';
import { ApiError } from '../utils/http.js';

/**
 * Translate a Supabase auth error into an ApiError, keeping messages generic
 * where leaking account existence would be a risk.
 */
function authError(error, fallbackStatus = 400) {
  const message = error?.message || 'Authentication failed';
  return new ApiError(fallbackStatus, message);
}

/**
 * Register a new user and create their profile row.
 * Supabase sends a confirmation email when confirmation is enabled.
 */
export async function signUp({ email, password, fullName, phone, emailRedirectTo }) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: { full_name: fullName || null, phone: phone || null }
    }
  });

  if (error) throw authError(error);

  // The `on_auth_user_created` trigger creates the profile row automatically.
  // If confirmation is required, `data.session` is null until the user verifies.
  return {
    user: data.user
      ? { id: data.user.id, email: data.user.email, confirmed: Boolean(data.user.email_confirmed_at) }
      : null,
    session: data.session
      ? { accessToken: data.session.access_token, refreshToken: data.session.refresh_token }
      : null,
    needsEmailConfirmation: !data.session
  };
}

/** Sign in with email + password. */
export async function signIn({ email, password }) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw authError(error, 401);

  return {
    user: { id: data.user.id, email: data.user.email },
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at
    }
  };
}

/** Sign out a user by revoking their access token. */
export async function signOut(accessToken) {
  if (!accessToken) return { success: true };
  const supabase = createUserClient(accessToken);
  const { error } = await supabase.auth.signOut();
  if (error) throw authError(error);
  return { success: true };
}

/** Send a password-reset email. Always reports success to avoid account enumeration. */
export async function requestPasswordReset({ email, redirectTo }) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  // Intentionally swallow "user not found" style errors.
  if (error && error.status && error.status >= 500) {
    throw authError(error, 500);
  }
  return { success: true };
}

/** Update the password for the user identified by the supplied access token. */
export async function updatePassword(accessToken, newPassword) {
  if (!accessToken) throw ApiError.unauthorized('Missing access token');
  const supabase = createUserClient(accessToken);
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw authError(error);
  return { user: { id: data.user.id, email: data.user.email } };
}

/** Refresh an expired session using a refresh token. */
export async function refreshSession(refreshToken) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error) throw authError(error, 401);
  return {
    user: { id: data.user.id, email: data.user.email },
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at
    }
  };
}

/** Fetch the profile row for a given user id. */
export async function getProfile(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, avatar_path, role, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw authError(error);
  return data;
}

/** Update the caller's own profile. */
export async function updateProfile(userId, { fullName, phone, avatarPath }) {
  const supabase = getSupabaseAdmin();
  const patch = {};
  if (fullName !== undefined) patch.full_name = fullName;
  if (phone !== undefined) patch.phone = phone;
  if (avatarPath !== undefined) patch.avatar_path = avatarPath;

  if (Object.keys(patch).length === 0) {
    throw ApiError.badRequest('No profile fields to update');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('id, full_name, phone, avatar_path, role, updated_at')
    .single();

  if (error) throw authError(error);
  return data;
}
