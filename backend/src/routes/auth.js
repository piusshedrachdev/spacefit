import { Router } from 'express';
import * as authService from '../services/auth.js';
import { asyncHandler, ok, ApiError } from '../utils/http.js';
import { validate } from '../utils/validate.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * Authentication routes backed by Supabase Auth.
 *
 * The frontend may also talk to Supabase Auth directly with the publishable
 * key. These endpoints exist so the storefront can use a single, same-origin
 * API and so the server can attach profile data in one round-trip.
 */
const router = Router();

const passwordRule = { required: true, type: 'string', minLength: 8 };

/** POST /api/auth/signup */
router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const payload = validate(req.body, {
      email: { required: true, type: 'email' },
      password: passwordRule,
      fullName: { type: 'string' },
      phone: { type: 'string' },
      emailRedirectTo: { type: 'string' }
    });

    const result = await authService.signUp(payload);
    return ok(res, result, 201);
  })
);

/** POST /api/auth/login */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const payload = validate(req.body, {
      email: { required: true, type: 'email' },
      password: { required: true, type: 'string' }
    });

    const result = await authService.signIn(payload);
    return ok(res, result);
  })
);

/** POST /api/auth/logout */
router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await authService.signOut(req.accessToken);
    return ok(res, result);
  })
);

/** POST /api/auth/refresh -> exchange a refresh token for a new session */
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const payload = validate(req.body, {
      refreshToken: { required: true, type: 'string' }
    });

    const result = await authService.refreshSession(payload.refreshToken);
    return ok(res, result);
  })
);

/** POST /api/auth/forgot-password -> send a reset email */
router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const payload = validate(req.body, {
      email: { required: true, type: 'email' },
      redirectTo: { type: 'string' }
    });

    const result = await authService.requestPasswordReset(payload);
    return ok(res, result);
  })
);

/** POST /api/auth/reset-password -> set a new password for the current session */
router.post(
  '/reset-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = validate(req.body, {
      password: passwordRule
    });

    const result = await authService.updatePassword(req.accessToken, payload.password);
    return ok(res, result);
  })
);

/** GET /api/auth/me -> current user + profile */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }
    const profile = await authService.getProfile(req.user.id);
    return ok(res, {
      user: { id: req.user.id, email: req.user.email },
      profile: profile || null
    });
  })
);

/** PATCH /api/auth/me -> update the caller's profile */
router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }
    const payload = validate(req.body, {
      fullName: { type: 'string' },
      phone: { type: 'string' },
      avatarPath: { type: 'string' }
    });

    const profile = await authService.updateProfile(req.user.id, payload);
    return ok(res, profile);
  })
);

export default router;
