import { Router } from 'express';
import { store } from '../store.js';
import { asyncHandler, ok, ApiError } from '../utils/http.js';
import { validate } from '../utils/validate.js';

/**
 * Cart routes.
 *
 * Frontend coverage:
 *   - index.html  -> triggerAddToCart() (currently localStorage only)
 *   - cart.html   -> displayCart(), changeQuantity(), removeItem(), saveCart()
 *   - checkout.html -> order summary reads cart contents
 *
 * The frontend currently persists carts in localStorage under "spacefitCart".
 * These endpoints let the same flows move server-side so carts survive across
 * devices. The cart id is returned on creation and can be stored client-side.
 */
const router = Router();

/** POST /api/cart -> create a new empty cart */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const cart = store.createCart();
    return ok(res, store.summariseCart(cart), 201);
  })
);

/** GET /api/cart/:cartId -> fetch cart with computed totals */
router.get(
  '/:cartId',
  asyncHandler(async (req, res) => {
    const cart = store.getCart(req.params.cartId);
    return ok(res, store.summariseCart(cart));
  })
);

/** POST /api/cart/:cartId/items -> add item (add-to-cart button) */
router.post(
  '/:cartId/items',
  asyncHandler(async (req, res) => {
    const payload = validate(req.body, {
      productId: { required: true, type: 'string' },
      quantity: { type: 'number', min: 1 },
      size: { type: 'string' },
      color: { type: 'string' }
    });

    const cart = store.addCartItem(req.params.cartId, payload);
    return ok(res, cart, 201);
  })
);

/** PATCH /api/cart/:cartId/items/:itemKey -> change quantity */
router.patch(
  '/:cartId/items/:itemKey',
  asyncHandler(async (req, res) => {
    const payload = validate(req.body, {
      quantity: { required: true, type: 'number', min: 0 }
    });

    const cart = store.updateCartItem(req.params.cartId, req.params.itemKey, payload.quantity);
    return ok(res, cart);
  })
);

/** DELETE /api/cart/:cartId/items/:itemKey -> remove one line item */
router.delete(
  '/:cartId/items/:itemKey',
  asyncHandler(async (req, res) => {
    const cart = store.removeCartItem(req.params.cartId, req.params.itemKey);
    return ok(res, cart);
  })
);

/** DELETE /api/cart/:cartId -> empty the cart */
router.delete(
  '/:cartId',
  asyncHandler(async (req, res) => {
    const cart = store.clearCart(req.params.cartId);
    return ok(res, cart);
  })
);

/** POST /api/cart/:cartId/validate -> pre-checkout validation */
router.post(
  '/:cartId/validate',
  asyncHandler(async (req, res) => {
    const cart = store.getCart(req.params.cartId);
    if (cart.items.length === 0) {
      throw ApiError.badRequest('Cart is empty');
    }
    return ok(res, { valid: true, summary: store.summariseCart(cart) });
  })
);

export default router;
