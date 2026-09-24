import { Router } from 'express';
import * as db from '../db/index.js';
import { asyncHandler, ok, ApiError } from '../utils/http.js';
import { validate } from '../utils/validate.js';
import { requireAuth, resolveRole } from '../middleware/auth.js';

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

async function isAdmin(req) {
  const role = req.role || (req.user ? await resolveRole(req) : null);
  return role === 'admin';
}

/**
 * Shared seller-or-admin gate for the read/update routes.
 *
 * `requireSeller` is deliberately seller-only (it 401s every non-seller in
 * Supabase mode, including admins), which made GET /api/returns — "admin sees
 * everything" — unreachable for admins. These handlers do their own
 * seller-or-admin resolution instead; `requireAuth` only guarantees the
 * session, and the error messages match the old guard's in both modes.
 */
async function sellerOrAdmin(req) {
  const userId = actingUserId(req);
  const seller = userId ? await db.getSellerByUserId(userId) : null;
  const admin = await isAdmin(req);

  if (!seller && !admin) throw ApiError.unauthorized('Seller access required');
  if (!admin && seller?.status === 'blocked') {
    throw new ApiError(403, 'Seller account is blocked');
  }
  return { seller, admin };
}

/** GET /api/returns -> seller's own returns, or all for an admin */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { seller, admin } = await sellerOrAdmin(req);

    // Admins see every request; a seller only their own shop's.
    const items = await db.listReturns(admin ? {} : { sellerId: seller.id });
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
  requireAuth,
  asyncHandler(async (req, res) => {
    // Authorise first: a caller without access gets 401/403 even for an
    // unknown id, instead of leaking whether the return exists (404).
    const { seller, admin } = await sellerOrAdmin(req);
    const record = await db.getReturn(req.params.id);

    if (!admin && record.sellerId !== seller.id) {
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
