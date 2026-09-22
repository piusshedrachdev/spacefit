import { Router } from 'express';
import * as db from '../db/index.js';
import { asyncHandler, ok, ApiError } from '../utils/http.js';
import { validate } from '../utils/validate.js';
import { requireAuth, requireSeller } from '../middleware/auth.js';

/**
 * Return-request routes (mounted at /api/returns).
 *
 * Sellers see returns for their own products; admins see everything.
 * Status updates are restricted to the owning seller or an admin.
 */
const router = Router();

function actingUserId(req) {
  return req.user?.id || req.headers['x-dev-user'] || null;
}

function isAdmin(req) {
  const role = req.user?.app_metadata?.role || req.user?.user_metadata?.role;
  return role === 'admin';
}

/** GET /api/returns -> seller's own returns, or all for an admin */
router.get(
  '/',
  requireSeller,
  asyncHandler(async (req, res) => {
    const userId = actingUserId(req);
    const seller = req.seller || (userId ? await db.getSellerByUserId(userId) : null);

    if (!seller && !isAdmin(req)) {
      throw ApiError.unauthorized('Seller access required');
    }

    const items = await db.listReturns(seller ? { sellerId: seller.id } : {});
    return ok(res, items, 200, { count: items.length });
  })
);

/** POST /api/returns -> raise a return request (order owner) */
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = validate(req.body, {
      orderId: { required: true, type: 'string' },
      productId: { required: true, type: 'string' },
      reason: { required: true, type: 'string', minLength: 3 }
    });

    const product = await db.getProduct(payload.productId);
    const record = await db.createReturn({
      orderId: payload.orderId,
      productId: product.id,
      sellerId: product.sellerId || null,
      requestedBy: actingUserId(req),
      reason: payload.reason
    });
    return ok(res, record, 201);
  })
);

/** PATCH /api/returns/:id -> seller/admin status update */
router.patch(
  '/:id',
  requireSeller,
  asyncHandler(async (req, res) => {
    const record = await db.getReturn(req.params.id);
    const userId = actingUserId(req);
    const seller = req.seller || (userId ? await db.getSellerByUserId(userId) : null);

    if (!isAdmin(req) && (!seller || record.sellerId !== seller.id)) {
      throw new ApiError(403, 'You can only manage returns for your own products');
    }

    const patch = validate(req.body, {
      status: { required: true, enum: ['requested', 'approved', 'rejected', 'completed'] },
      resolutionNotes: { type: 'string' }
    });

    return ok(res, await db.updateReturn(record.id, patch));
  })
);

export default router;
