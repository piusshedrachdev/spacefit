import { Router } from 'express';
import * as db from '../db/index.js';
import { asyncHandler, ok } from '../utils/http.js';
import { validate } from '../utils/validate.js';
import { requireAdmin } from '../middleware/auth.js';

/**
 * Order routes.
 *
 * Frontend coverage:
 *   - checkout.html   -> checkout form (customer + delivery + payment method)
 *   - order-succes.html -> order confirmation / reference lookup
 */
const router = Router();

/** POST /api/orders -> place an order from checkout.html */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const customer = body.customer || {
      fullName: body.fullName,
      email: body.email,
      phone: body.phone
    };
    const delivery = body.delivery || {
      address: body.address,
      city: body.city,
      state: body.state,
      instructions: body.instructions
    };

    validate(customer, {
      fullName: { required: true, type: 'string', minLength: 2 },
      email: { required: true, type: 'email' },
      phone: { required: true, type: 'string', minLength: 7 }
    });

    validate(delivery, {
      address: { required: true, type: 'string', minLength: 3 },
      city: { required: true, type: 'string' },
      state: { required: true, type: 'string' }
    });

    validate(body, {
      paymentMethod: { required: true, enum: ['card', 'transfer', 'cash'] }
    });

    const order = await db.createOrder({
      cartId: body.cartId,
      items: body.items,
      customer,
      delivery,
      paymentMethod: body.paymentMethod,
      notes: body.notes,
      userId: req.user?.id || null
    });

    return ok(res, order, 201);
  })
);

/** GET /api/orders -> admin listing (latest first) */
router.get(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const userId = req.query.userId || null;
    return ok(res, await db.listOrders({ userId }));
  })
);

/** GET /api/orders/:id -> order-succes.html lookup by id or reference */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    return ok(res, await db.getOrder(req.params.id));
  })
);

export default router;
