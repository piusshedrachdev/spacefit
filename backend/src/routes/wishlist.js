import { Router } from 'express';
import * as db from '../db/index.js';
import { asyncHandler, ok, ApiError } from '../utils/http.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * Wishlist routes (mounted at /api/wishlist).
 *
 * Any authenticated role (customer, seller, admin) may save products for
 * their own account. Reads and writes are always scoped to the caller.
 */
const router = Router();

/** Resolve the acting user id, tolerating memory-mode requests without a session. */
function actingUserId(req) {
  return req.user?.id || req.headers['x-dev-user'] || null;
}

/** GET /api/wishlist -> the caller's saved products, newest first */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = actingUserId(req);
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const items = await db.listWishlist(userId);
    return ok(res, items, 200, { count: items.length });
  })
);

/** POST /api/wishlist/:productId -> save a product (idempotent) -> the saved product */
router.post(
  '/:productId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = actingUserId(req);
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const product = await db.addWishlistItem(userId, req.params.productId);
    return ok(res, product, 201);
  })
);

/** DELETE /api/wishlist/:productId -> remove a saved product -> { productId, removed } */
router.delete(
  '/:productId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = actingUserId(req);
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const result = await db.removeWishlistItem(userId, req.params.productId);
    return ok(res, result);
  })
);

export default router;
