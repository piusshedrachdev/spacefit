import { getSupabaseAdmin } from '../lib/supabase.js';
import { throwIfError } from './errors.js';

/**
 * Subscribe an email address. Idempotent: re-subscribing reports
 * `alreadySubscribed: true` instead of failing on the unique constraint.
 */
export async function subscribe(email) {
  const supabase = getSupabaseAdmin();
  const normalised = String(email).toLowerCase().trim();

  // Try a plain insert first; the unique index makes this the fast path.
  const { error } = await supabase
    .from('newsletter_subscribers')
    .insert({ email: normalised });

  if (error) {
    // 23505 = unique_violation, meaning the email is already subscribed.
    if (error.code === '23505') {
      return { email: normalised, alreadySubscribed: true };
    }
    throwIfError({ error }, 'subscribe to newsletter');
  }

  return { email: normalised, alreadySubscribed: false };
}
