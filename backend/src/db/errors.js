import { ApiError } from '../utils/http.js';

/**
 * Translate a Supabase/PostgREST error into an ApiError so the global error
 * handler can render a consistent response.
 * @param {{ message?: string, code?: string, details?: string, hint?: string }} error
 * @param {string} context - human readable operation, e.g. 'list products'
 */
export function toApiError(error, context = 'database operation') {
  if (!error) return null;

  const code = error.code || '';
  const message = error.message || 'Database error';

  // Unique violation
  if (code === '23505') {
    return ApiError.conflict(`Conflict while trying to ${context}`, { code, message });
  }
  // Foreign key violation
  if (code === '23503') {
    return ApiError.badRequest(`Related record not found while trying to ${context}`, {
      code,
      message
    });
  }
  // Check constraint violation
  if (code === '23514') {
    return ApiError.unprocessable(`Invalid value while trying to ${context}`, { code, message });
  }
  // Not-null violation
  if (code === '23502') {
    return ApiError.badRequest(`Missing required field while trying to ${context}`, {
      code,
      message
    });
  }
  // PostgREST: no rows returned when one was expected
  if (code === 'PGRST116') {
    return ApiError.notFound(`Nothing found while trying to ${context}`);
  }

  // Unknown (network failures, auth issues, etc.): log the real cause so it is
  // not swallowed, but return a generic 500 so internals never leak to clients.
  console.error(`[db] ${context} failed:`, { code, message, hint: error.hint, details: error.details });
  return new ApiError(500, `Failed to ${context}`);
}

/**
 * Throw when a Supabase call returns an error.
 * @param {{ error: any }} response
 * @param {string} context
 */
export function throwIfError({ error }, context) {
  if (error) throw toApiError(error, context);
}
