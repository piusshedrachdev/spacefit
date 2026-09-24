import { Router } from 'express';
import * as db from '../db/index.js';
import { asyncHandler, ok, ApiError } from '../utils/http.js';
import { validate } from '../utils/validate.js';
import { requireAuth, requireAdmin, requireSellerOrAdmin, resolveRole } from '../middleware/auth.js';

/**
 * Product routes.
 *
 * Frontend coverage:
 *   - index.html  -> featured product grid, "Shop" section, category filters
 *   - product-details.html -> full PDP data, gallery, colours, specs, related
 *   - seller-dashboard.html -> create/edit/delete own listings
 *   - admin.html -> edit featured/price/availability, delete any listing
 */
const router = Router();

/** Resolve the acting user id, tolerating memory-mode requests without a session. */
function actingUserId(req) {
  return req.user?.id || req.headers['x-dev-user'] || null;
}

/**
 * Assert the caller may modify a product: admins may touch anything, sellers
 * only their own listings. Works in both memory and Supabase modes.
 */
async function assertCanModify(req, product) {
  const role = req.role || (req.user ? await resolveRole(req) : null);
  if (role === 'admin') return;

  const userId = actingUserId(req);
  const seller = req.seller || (userId ? await db.getSellerByUserId(userId) : null);
  if (seller && product.sellerId && product.sellerId === seller.id) return;

  throw new ApiError(403, 'You can only manage your own listings');
}

/** GET /api/products -> list + filter + sort + paginate */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { category, search, featured, sort, limit, offset, sellerId } = req.query;
    const { items, total } = await db.listProducts({
      category,
      search,
      featured,
      sellerId,
      sort,
      limit: limit !== undefined ? Number(limit) : undefined,
      offset: offset !== undefined ? Number(offset) : undefined
    });

    return ok(res, items, 200, {
      total,
      count: items.length,
      limit: limit !== undefined ? Number(limit) : null,
      offset: offset !== undefined ? Number(offset) : 0
    });
  })
);

/** GET /api/products/featured -> homepage "featured" row */
router.get(
  '/featured',
  asyncHandler(async (_req, res) => {
    const { items } = await db.listProducts({ featured: true });
    return ok(res, items);
  })
);

/** GET /api/products/categories -> filter chips */
router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    return ok(res, await db.listCategories());
  })
);

/** POST /api/products -> create a listing (seller or admin) */
router.post(
  '/',
  requireSellerOrAdmin,
  asyncHandler(async (req, res) => {
    const payload = validate(req.body, {
      title: { required: true, type: 'string', minLength: 2 },
      category: { required: true, type: 'string' },
      price: { required: true, type: 'number', min: 0 },
      origPrice: { type: 'number' },
      availability: { type: 'string' },
      shortDescription: { type: 'string' },
      description: { type: 'string' },
      features: { type: 'array' },
      specs: { type: 'array' },
      colors: { type: 'array' },
      sizes: { type: 'array' },
      images: { type: 'array' },
      featured: {}
    });

    const userId = actingUserId(req);
    const seller =
      req.seller || (userId ? await db.getSellerByUserId(userId) : null);
    const role = req.role || (req.user ? await resolveRole(req) : null);

    const product = await db.createProduct({
      ...payload,
      featured: payload.featured === true || payload.featured === 'true',
      sellerId: seller?.id || null
    });

    // Only admins may self-assign a featured flag; sellers get the default.
    if (role !== 'admin' && product.featured) {
      await db.updateProduct(product.id, { featured: false });
      product.featured = false;
    }

    return ok(res, product, 201);
  })
);

/** GET /api/products/:id/reviews -> published reviews for a product */
router.get(
  '/:id/reviews',
  asyncHandler(async (req, res) => {
    const reviews = await db.listProductReviews(req.params.id);
    return ok(res, reviews, 200, { count: reviews.length });
  })
);

/** POST /api/products/:id/reviews -> leave a review (authenticated) */
router.post(
  '/:id/reviews',
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = validate(req.body, {
      rating: { required: true, type: 'number', min: 1 },
      comment: { type: 'string' }
    });
    if (payload.rating > 5) {
      throw ApiError.unprocessable('Validation failed', {
        rating: 'rating must be between 1 and 5'
      });
    }

    const review = await db.createProductReview({
      productId: req.params.id,
      userId: actingUserId(req),
      rating: payload.rating,
      comment: payload.comment || null
    });
    return ok(res, review, 201);
  })
);

/** GET /api/products/:id -> product-details.html?id=... */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await db.getProduct(req.params.id);
    return ok(res, product);
  })
);

/** GET /api/products/:id/related -> "You may also like" row */
router.get(
  '/:id/related',
  asyncHandler(async (req, res) => {
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : 4;
    return ok(res, await db.getRelatedProducts(req.params.id, limit));
  })
);

/** PATCH /api/products/:id -> edit a listing (owner or admin) */
router.patch(
  '/:id',
  requireSellerOrAdmin,
  asyncHandler(async (req, res) => {
    const product = await db.getProduct(req.params.id);
    await assertCanModify(req, product);

    const patch = validate(req.body, {
      title: { type: 'string' },
      category: { type: 'string' },
      price: { type: 'number', min: 0 },
      origPrice: { type: 'number' },
      availability: { type: 'string' },
      shortDescription: { type: 'string' },
      description: { type: 'string' },
      features: { type: 'array' },
      specs: { type: 'array' },
      colors: { type: 'array' },
      sizes: { type: 'array' },
      images: { type: 'array' },
      featured: {}
    });
    if (Object.keys(patch).length === 0) {
      throw ApiError.badRequest('No product fields to update');
    }
    if (patch.featured !== undefined) {
      const role = req.role || (req.user ? await resolveRole(req) : null);
      if (role !== 'admin') delete patch.featured;
      else patch.featured = patch.featured === true || patch.featured === 'true';
    }

    return ok(res, await db.updateProduct(product.id, patch));
  })
);

/** DELETE /api/products/:id -> remove a listing (owner or admin) */
router.delete(
  '/:id',
  requireSellerOrAdmin,
  asyncHandler(async (req, res) => {
    const product = await db.getProduct(req.params.id);
    await assertCanModify(req, product);
    await db.deleteProduct(product.id);
    return ok(res, { id: product.id, deleted: true });
  })
);

export default router;
