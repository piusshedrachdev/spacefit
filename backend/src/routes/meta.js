import { Router } from 'express';
import { store } from '../store.js';
import { config } from '../config.js';
import { asyncHandler, ok } from '../utils/http.js';

/**
 * Store metadata routes.
 *
 * Frontend coverage:
 *   - checkout.html city/state dropdowns and delivery-fee display
 *   - footer currency / locale ("\u20a6 NGN \u2022 Lagos, NG")
 *   - cart.html delivery and VAT line items
 */
const router = Router();

/** GET /api/meta/config -> checkout display configuration */
router.get(
  '/config',
  asyncHandler(async (req, res) => {
    return ok(res, {
      currency: config.currency,
      currencySymbol: config.currencySymbol,
      deliveryFee: config.deliveryFee,
      freeDeliveryThreshold: config.freeDeliveryThreshold,
      vatRate: config.vatRate,
      serviceableCities: config.serviceableCities,
      paymentMethods: [
        { id: 'card', label: 'Card (Visa, Mastercard)' },
        { id: 'transfer', label: 'Bank Transfer' },
        { id: 'cash', label: 'Cash on Delivery' }
      ]
    });
  })
);

/** GET /api/meta/categories -> category filter list */
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    return ok(res, store.listCategories());
  })
);

export default router;
