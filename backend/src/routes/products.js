import { Router } from 'express';
import * as db from '../db/index.js';
import { asyncHandler, ok } from '../utils/http.js';

/**
 * Product routes.
 *
 * Frontend coverage:
 *   - index.html  -> featured product grid, "Shop" section, category filters
 *   - product-details.html -> full PDP data, gallery, colours, specs, related
 */
const router = Router();

/** GET /api/products -> list + filter + sort + paginate */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { category, search, featured, sort, limit, offset } = req.query;
    const { items, total } = await db.listProducts({
      category,
      search,
      featured,
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

export default router;
