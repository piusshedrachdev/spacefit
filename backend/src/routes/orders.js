import { Router } from 'express';
import { store } from '../store.js';
import { asyncHandler, ok } from '../utils/http.js';
import { validate } from '../utils/validate.js';

/**
 * Order routes.
 *
 * Frontend coverage:
 *   - checkout.html   -> checkout form (customer + delivery + payment method)
 *   - order-succes.html -> order confirmation / reference lookup
 */
const router = Router();

const customerSchema = {
  'customer.fullName': { required: true, type: 'string', minLength: 2 },
  'customer.email': { required: true, type: 'email' },
  'customer.phone': { required: true, type: 'string', minLength: 7 }
};

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

    const order = store.createOrder({
      cartId: body.cartId,
      items: body.items,
      customer,
      delivery,
      paymentMethod: body.paymentMethod,
      notes: body.notes
    });

    return ok(res, order, 201);
  })
);

/** GET /api/orders -> admin listing (latest first) */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    return ok(res, store.listOrders());
  })
);

/** GET /api/orders/:id -> order-succes.html lookup by id */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    return ok(res, store.getOrder(req.params.id));
  })
);

export default router;
