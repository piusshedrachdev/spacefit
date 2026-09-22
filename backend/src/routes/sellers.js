import { Router } from 'express';
import * as db from '../db/index.js';
import { asyncHandler, ok, ApiError } from '../utils/http.js';
import { validate } from '../utils/validate.js';
import { requireAuth, requireAdmin, requireSeller } from '../middleware/auth.js';
import {
  buildApplicationReceivedEmail,
  buildApplicationApprovedEmail,
  buildApplicationRejectedEmail,
  buildSellerStatusEmail,
  sendEmailSafe
} from '../services/email.js';

/**
 * Seller ecosystem routes — applications, sellers and the seller dashboard.
 *
 * Mounted at /api/sellers. All persistence goes through the db facade so the
 * same handlers work against Supabase or the in-memory store.
 */
const router = Router();

/** Resolve the acting user id, tolerating memory-mode requests without a session. */
function actingUserId(req) {
  return req.user?.id || req.headers['x-dev-user'] || null;
}

/* --------------------------------------------------------- applications */

/** POST /api/sellers/applications -> submit a seller application */
router.post(
  '/applications',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = actingUserId(req);
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const payload = validate(req.body, {
      fullName: { required: true, type: 'string', minLength: 2 },
      email: { required: true, type: 'email' },
      phone: { required: true, type: 'string', minLength: 7 },
      shopName: { required: true, type: 'string', minLength: 2 },
      location: { type: 'string' },
      state: { type: 'string' },
      city: { type: 'string' },
      deliveryPlaces: { type: 'array' },
      categories: { type: 'array' },
      bio: { type: 'string' },
      termsAccepted: { required: true },
      disclaimersAccepted: { required: true }
    });

    const termsAccepted = payload.termsAccepted === true || payload.termsAccepted === 'true';
    const disclaimersAccepted =
      payload.disclaimersAccepted === true || payload.disclaimersAccepted === 'true';
    if (!termsAccepted || !disclaimersAccepted) {
      throw ApiError.unprocessable('You must accept the terms and disclaimers', {
        termsAccepted: termsAccepted ? undefined : 'Terms must be accepted',
        disclaimersAccepted: disclaimersAccepted ? undefined : 'Disclaimers must be accepted'
      });
    }

    const location =
      payload.city || payload.state
        ? { city: payload.city || null, state: payload.state || null }
        : payload.location || {};

    const application = await db.createApplication({
      userId,
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      location,
      shopName: payload.shopName,
      deliveryPlaces: payload.deliveryPlaces || [],
      categories: payload.categories || [],
      bio: payload.bio || null,
      termsAccepted,
      disclaimersAccepted
    });

    // Notify the admins and acknowledge the applicant.
    const adminIds = await db.listAdminUserIds();
    await Promise.all(
      adminIds.map((adminId) =>
        db.createNotification({
          userId: adminId,
          type: 'application_received',
          title: `New application: ${application.shopName}`,
          body: `${application.fullName} applied to sell on SpaceFit.`,
          link: 'admin.html#applications'
        })
      )
    );
    await db.createNotification({
      userId,
      type: 'application_received',
      title: 'Application received',
      body: 'We have received your seller application and will review it shortly.',
      link: 'seller-apply.html'
    });

    sendEmailSafe(
      buildApplicationReceivedEmail({
        to: application.email,
        fullName: application.fullName,
        shopName: application.shopName,
        reference: application.id
      })
    );

    return ok(res, application, 201);
  })
);

/** GET /api/sellers/applications?status= -> admin review queue */
router.get(
  '/applications',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    const items = await db.listApplications({ status: status || undefined });
    return ok(res, items, 200, { count: items.length });
  })
);

/** GET /api/sellers/applications/:id -> application detail */
router.get(
  '/applications/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    return ok(res, await db.getApplication(req.params.id));
  })
);

/** PATCH /api/sellers/applications/:id -> approve / reject an application */
router.patch(
  '/applications/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { decision, reviewNotes } = validate(req.body, {
      decision: { required: true, enum: ['approved', 'rejected'] },
      reviewNotes: { type: 'string' }
    });

    const application = await db.getApplication(req.params.id);
    if (application.status !== 'pending') {
      throw ApiError.conflict(`Application already ${application.status}`);
    }

    const reviewedBy = actingUserId(req);
    const updated = await db.updateApplication(application.id, {
      status: decision,
      reviewNotes: reviewNotes || null,
      reviewedAt: new Date().toISOString(),
      reviewedBy
    });

    if (decision === 'approved') {
      // Create the seller row and promote the profile to `seller`.
      const seller = await db.createSeller({
        userId: application.userId,
        applicationId: application.id,
        shopName: application.shopName,
        deliveryPlaces: application.deliveryPlaces,
        bio: application.bio
      });
      await db.setProfileRole(application.userId, 'seller');

      await db.createNotification({
        userId: application.userId,
        type: 'application_approved',
        title: 'Your seller account is approved',
        body: `Welcome aboard, ${application.shopName}! You can now list products.`,
        link: 'seller-dashboard.html'
      });

      sendEmailSafe(
        buildApplicationApprovedEmail({
          to: application.email,
          fullName: application.fullName,
          shopName: application.shopName
        })
      );

      return ok(res, { application: updated, seller });
    }

    await db.createNotification({
      userId: application.userId,
      type: 'application_rejected',
      title: 'Seller application update',
      body: reviewNotes || 'Your application was not approved at this time.',
      link: 'seller-apply.html'
    });

    sendEmailSafe(
      buildApplicationRejectedEmail({
        to: application.email,
        fullName: application.fullName,
        shopName: application.shopName,
        reviewNotes
      })
    );

    return ok(res, { application: updated });
  })
);

/* --------------------------------------------------------------- sellers */

/** GET /api/sellers -> admin seller list */
router.get(
  '/',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const sellers = await db.listSellers();
    // Annotate with product counts so the admin table is useful at a glance.
    const products = await db.listProducts({ limit: 1000 });
    const counts = new Map();
    for (const product of products.items) {
      if (!product.sellerId) continue;
      counts.set(product.sellerId, (counts.get(product.sellerId) || 0) + 1);
    }
    const enriched = sellers.map((s) => ({ ...s, products: counts.get(s.id) || 0 }));
    return ok(res, enriched, 200, { count: enriched.length });
  })
);

/** GET /api/sellers/me -> caller's seller context (drives dashboard gating) */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = actingUserId(req);
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const seller = await db.getSellerByUserId(userId);
    const application = await db.findApplicationByUser(userId);
    const profile = await db.getProfileRow(userId);

    return ok(res, {
      isSeller: Boolean(seller),
      role: profile?.role || (seller ? 'seller' : 'customer'),
      seller: seller || null,
      application: application || null
    });
  })
);

/** PATCH /api/sellers/me -> update own shop profile */
router.patch(
  '/me',
  requireSeller,
  asyncHandler(async (req, res) => {
    const userId = actingUserId(req);
    const seller = req.seller || (await db.getSellerByUserId(userId));
    if (!seller) throw ApiError.notFound('Seller profile not found');

    const patch = validate(req.body, {
      shopName: { type: 'string', minLength: 2 },
      deliveryPlaces: { type: 'array' },
      bio: { type: 'string' }
    });
    if (Object.keys(patch).length === 0) {
      throw ApiError.badRequest('No seller fields to update');
    }

    return ok(res, await db.updateSeller(seller.id, patch));
  })
);

/** GET /api/sellers/me/dashboard -> seller KPI dashboard */
router.get(
  '/me/dashboard',
  requireSeller,
  asyncHandler(async (req, res) => {
    const userId = actingUserId(req);
    const seller = req.seller || (await db.getSellerByUserId(userId));
    if (!seller) throw ApiError.notFound('Seller profile not found');

    const [stats, reviews, returns, notifications] = await Promise.all([
      db.sellerStats(seller.id),
      db.listSellerReviews(seller.id),
      db.listReturns({ sellerId: seller.id }),
      db.listNotifications(userId, 20)
    ]);

    return ok(res, { seller, stats, reviews, returns, notifications });
  })
);

/** PATCH /api/sellers/:id -> block / unblock a seller (admin) */
router.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { status, reason } = validate(req.body, {
      status: { required: true, enum: ['active', 'blocked'] },
      reason: { type: 'string' }
    });

    const seller = await db.getSellerById(req.params.id);
    if (!seller) throw ApiError.notFound(`Seller '${req.params.id}' not found`);

    const updated = await db.updateSeller(seller.id, { status });

    const email = await db.getUserEmail(seller.userId);
    await db.createNotification({
      userId: seller.userId,
      type: status === 'blocked' ? 'seller_blocked' : 'seller_unblocked',
      title: status === 'blocked' ? 'Seller account suspended' : 'Seller account reactivated',
      body:
        status === 'blocked'
          ? reason || 'Your seller account has been suspended.'
          : 'Your seller account is active again.',
      link: 'seller-dashboard.html'
    });

    if (email) {
      sendEmailSafe(
        buildSellerStatusEmail({
          to: email,
          fullName: seller.shopName,
          shopName: seller.shopName,
          status,
          reason
        })
      );
    }

    return ok(res, updated);
  })
);

export default router;
