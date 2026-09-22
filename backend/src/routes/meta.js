import { Router } from 'express';
import { store } from '../store.js';
import { config } from '../config.js';
import * as db from '../db/index.js';
import { asyncHandler, ok, ApiError } from '../utils/http.js';
import { requireAdmin } from '../middleware/auth.js';

/**
 * Store metadata routes.
 *
 * Frontend coverage:
 *   - checkout.html city/state dropdowns and delivery-fee display
 *   - footer currency / locale ("\u20a6 NGN \u2022 Lagos, NG")
 *   - cart.html delivery and VAT line items
 *   - footer policy links + sitewide discount banner (admin-editable settings)
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

/** GET /api/meta/settings -> public policies + discounts */
router.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    return ok(res, await db.getSettings());
  })
);

/** PUT /api/meta/settings -> persist admin edits from the admin dashboard */
router.put(
  '/settings',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { policies, discounts } = req.body || {};
    if ((policies && typeof policies !== 'object') || (discounts && typeof discounts !== 'object')) {
      throw ApiError.badRequest('policies and discounts must be objects');
    }
    if (!policies && !discounts) {
      throw ApiError.badRequest('Provide policies and/or discounts to update');
    }
    const patch = {};
    if (policies) patch.policies = policies;
    if (discounts) patch.discounts = discounts;
    return ok(res, await db.saveSettings(patch));
  })
);

export default router;
