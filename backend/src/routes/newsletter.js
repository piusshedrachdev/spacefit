import { Router } from 'express';
import * as db from '../db/index.js';
import { asyncHandler, ok } from '../utils/http.js';
import { validate } from '../utils/validate.js';

/**
 * Newsletter routes.
 *
 * Frontend coverage:
 *   - index.html footer "Journal & Spatial Digest" email capture form.
 */
const router = Router();

/** POST /api/newsletter -> subscribe an email address */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = validate(req.body, {
      email: { required: true, type: 'email' }
    });

    const result = await db.subscribe(payload.email);
    return ok(res, result, result.alreadySubscribed ? 200 : 201);
  })
);

export default router;
