import { Router } from 'express';
import { store } from '../store.js';
import { asyncHandler, ok } from '../utils/http.js';
import { validate } from '../utils/validate.js';

/**
 * Spatial consultation routes.
 *
 * Frontend coverage:
 *   - index.html -> "Book Spatial Measurement (Free)" CTA and the
 *     "Ask SpaceFit" concierge widget. The frontend currently exposes these as
 *     static buttons with no handler; these endpoints give them somewhere to post.
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

    const consultation = store.createConsultation(payload);
    return ok(res, consultation, 201);
  })
);

/** GET /api/consultations -> admin listing */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    return ok(res, store.consultations);
  })
);

export default router;
