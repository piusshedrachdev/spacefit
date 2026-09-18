import { Router } from 'express';
import { store } from '../store.js';
import { asyncHandler, ok } from '../utils/http.js';
import { validate } from '../utils/validate.js';

/**
 * Newsletter routes.
 *
 * Frontend coverage:
 *   - index.html footer "Journal & Spatial Digest" email capture form
 *     (currently a hidden/static input with no submit handler).
 */
const router = Router();

/** POST /api/newsletter -> subscribe an email address */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = validate(req.body, {
      email: { required: true, type: 'email' }
    });

    const result = store.subscribe(payload.email);
    return ok(res, result, result.alreadySubscribed ? 200 : 201);
  })
);

export default router;
