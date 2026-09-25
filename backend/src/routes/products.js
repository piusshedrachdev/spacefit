import { Router } from 'express';
import * as db from '../db/index.js';
import { asyncHandler, ok, ApiError } from '../utils/http.js';
import { validate } from '../utils/validate.js';
import { requireAuth, requireSellerOrAdmin, resolveRole } from '../middleware/auth.js';
import { parseProductImages } from '../middleware/productImages.js';
import {
  removeProductImageUploads,
  removeProductImageUrls,
  uploadProductImages
} from '../services/productImages.js';

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

const PRODUCT_IMAGE_FIELDS = ['images', 'image', 'imageUrl', 'imageURL', 'image_url'];
const JSON_ARRAY_FIELDS = ['features', 'specs', 'colors', 'sizes'];

const CREATE_PRODUCT_SCHEMA = {
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
  featured: {}
};

const UPDATE_PRODUCT_SCHEMA = {
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
  featured: {}
};

/**
 * Multipart form fields arrive as strings. JSON-encode arrays in the browser
 * and decode them here so the same validation rules apply to JSON and form
 * requests. Image URLs are deliberately not part of this contract.
 */
function normaliseProductBody(body) {
  const source = body && typeof body === 'object' ? { ...body } : {};

  // Accept a single `payload` JSON field as well as direct form fields. The
  // seller UI uses direct fields, while this keeps the multipart API pleasant
  // for other clients that already build a JSON product payload.
  if (source.payload !== undefined) {
    let payload = source.payload;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        throw ApiError.unprocessable('Invalid product data', {
          payload: 'payload must be valid JSON'
        });
      }
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw ApiError.unprocessable('Invalid product data', {
        payload: 'payload must be a JSON object'
      });
    }
    for (const [field, value] of Object.entries(payload)) {
      Object.defineProperty(source, field, {
        configurable: true,
        enumerable: true,
        value,
        writable: true
      });
    }
    delete source.payload;
  }

  for (const field of PRODUCT_IMAGE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      throw ApiError.unprocessable('Upload product images as files', {
        [field]: 'Image URLs are not accepted; upload one or more image files instead'
      });
    }
  }

  for (const field of JSON_ARRAY_FIELDS) {
    if (typeof source[field] !== 'string') continue;
    try {
      source[field] = JSON.parse(source[field]);
    } catch {
      throw ApiError.unprocessable('Invalid product data', {
        [field]: `${field} must be valid JSON`
      });
    }
  }

  return source;
}

function requestFiles(req) {
  if (Array.isArray(req.files)) return req.files;
  if (!req.files || typeof req.files !== 'object') return [];
  return [
    ...(Array.isArray(req.files.images) ? req.files.images : []),
    ...(Array.isArray(req.files.image) ? req.files.image : [])
  ];
}

async function cleanupUploads(uploads) {
  if (!uploads?.length) return;
  try {
    await removeProductImageUploads(uploads);
  } catch (error) {
    console.error('[storage] product image cleanup failed:', error);
  }
}

async function cleanupCreatedProduct(productId) {
  if (!productId) return;
  try {
    await db.deleteProduct(productId);
  } catch (error) {
    console.error('[products] failed to roll back product:', error);
  }
}

/** Authorize a product mutation before multer consumes any file bytes. */
async function loadOwnedProduct(req, _res, next) {
  try {
    const product = await db.getProduct(req.params.id);
    await assertCanModify(req, product);
    req.productForWrite = product;
    next();
  } catch (error) {
    next(error);
  }
}

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

/**
 * POST /api/products -> create a listing (seller or admin).
 *
 * Send `multipart/form-data` with product fields and one or more files in the
 * `images` field. The route uploads the bytes to the product-images bucket,
 * then passes only the generated public URLs to the product repository.
 */
router.post(
  '/',
  requireSellerOrAdmin,
  parseProductImages,
  asyncHandler(async (req, res) => {
    const body = normaliseProductBody(req.body);
    const payload = validate(body, CREATE_PRODUCT_SCHEMA);
    const files = requestFiles(req);
    const userId = actingUserId(req);
    const seller =
      req.seller || (userId ? await db.getSellerByUserId(userId) : null);
    const role = req.role || (req.user ? await resolveRole(req) : null);
    const effectiveSellerId = role === 'admin' ? null : seller?.id || null;
    const uploads = [];
    let product;

    try {
      // The seller/admin identity comes from the authenticated request; the
      // browser cannot choose a storage path or a public URL.
      const imageUploads = await uploadProductImages(files, {
        sellerId: effectiveSellerId,
        userId
      });
      uploads.push(...imageUploads);

      product = await db.createProduct({
        ...payload,
        images: uploads.map((image) => image.url),
        // Only admins may self-assign a featured flag.
        featured:
          role === 'admin' && (payload.featured === true || payload.featured === 'true'),
        sellerId: effectiveSellerId
      });

      return ok(res, product, 201);
    } catch (error) {
      // If either storage or the database write fails, do not leave a product
      // row or orphaned bucket objects behind.
      await cleanupCreatedProduct(product?.id);
      await cleanupUploads(uploads);
      throw error;
    }
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

/**
 * PATCH /api/products/:id -> edit a listing (owner or admin).
 *
 * Product fields may be JSON or multipart form fields. If files are supplied
 * in `images`, they replace the current gallery; otherwise the existing gallery
 * is preserved. A URL field is never accepted as a replacement.
 */
router.patch(
  '/:id',
  requireSellerOrAdmin,
  loadOwnedProduct,
  parseProductImages,
  asyncHandler(async (req, res) => {
    const product = req.productForWrite;

    const body = normaliseProductBody(req.body);
    const patch = validate(body, UPDATE_PRODUCT_SCHEMA);
    const files = requestFiles(req);
    if (Object.keys(patch).length === 0 && files.length === 0) {
      throw ApiError.badRequest('No product fields to update');
    }
    if (patch.featured !== undefined) {
      const role = req.role || (req.user ? await resolveRole(req) : null);
      if (role !== 'admin') delete patch.featured;
      else patch.featured = patch.featured === true || patch.featured === 'true';
    }

    const uploads = [];
    try {
      const imageUploads = await uploadProductImages(files, {
        sellerId: req.seller?.id || product.sellerId || null,
        userId: actingUserId(req)
      });
      uploads.push(...imageUploads);

      const updated = await db.updateProduct(
        product.id,
        files.length ? { ...patch, images: uploads.map((image) => image.url) } : patch
      );

      // The database now points at the new objects, so old bucket objects can
      // be removed. Seeded/external URLs are ignored by the helper.
      if (files.length) {
        await removeProductImageUrls(product.images).catch((error) => {
          console.error('[storage] old product image cleanup failed:', error);
        });
      }

      return ok(res, updated);
    } catch (error) {
      await cleanupUploads(uploads);
      throw error;
    }
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
    // Database cascade removes product_images; clean up only our own bucket
    // objects and leave seeded/external URLs untouched.
    await removeProductImageUrls(product.images).catch((error) => {
      console.error('[storage] deleted product image cleanup failed:', error);
    });
    return ok(res, { id: product.id, deleted: true });
  })
);

export default router;
