import { Router } from 'express';
import * as db from '../db/index.js';
import { asyncHandler, ok, ApiError } from '../utils/http.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * Notification routes (mounted at /api/notifications).
 *
 * Notifications are always scoped to the caller: list, mark-one-read and
 * mark-all-read never expose another user's rows.
 */
const router = Router();

/** Resolve the acting user id, tolerating memory-mode requests without a session. */
function actingUserId(req) {
  return req.user?.id || req.headers['x-dev-user'] || null;
}

/** GET /api/notifications -> own notifications, newest first + unreadCount */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = actingUserId(req);
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const limit = req.query.limit !== undefined ? Number(req.query.limit) : 50;
    const [items, unreadCount] = await Promise.all([
      db.listNotifications(userId, limit),
      db.unreadNotificationCount(userId)
    ]);

    return ok(res, { items, unreadCount }, 200, { count: items.length });
  })
);

/** PATCH /api/notifications/:id/read -> mark one notification read */
router.patch(
  '/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = actingUserId(req);
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const notification = await db.markNotificationRead(req.params.id, userId);
    return ok(res, notification);
  })
);

/** POST /api/notifications/read-all -> mark every notification read */
router.post(
  '/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = actingUserId(req);
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const result = await db.markAllNotificationsRead(userId);
    return ok(res, result);
  })
);

export default router;
