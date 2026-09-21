import { Router } from 'express';
import * as db from '../db/index.js';
import { asyncHandler, ok } from '../utils/http.js';
import { validate } from '../utils/validate.js';
import { requireAdmin } from '../middleware/auth.js';

/**
 * Spatial consultation routes.
 *
 * Frontend coverage:
 *   - index.html -> "Book Spatial Measurement (Free)" CTA and the
 *     "Ask SpaceFit" concierge widget.
 */
const router = Router();

/** POST /api/consultations -> book an in-home / spatial measurement */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = validate(req.body, {
      fullName: { required: true, type: 'string', minLength: 2 },
      email: { required: true, type: 'email' },
      phone: { required: true, type: 'string', minLength: 7 },
      city: { required: true, type: 'string' },
      roomType: { type: 'string' },
      preferredDate: { type: 'string' },
      notes: { type: 'string' }
    });

    const consultation = await db.createConsultation({
      ...payload,
      userId: req.user?.id || null
    });
    return ok(res, consultation, 201);
  })
);

/** GET /api/consultations -> admin listing */
router.get(
  '/',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    return ok(res, await db.listConsultations());
  })
);

export default router;
