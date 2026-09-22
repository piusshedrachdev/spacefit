import { getSupabaseAdmin } from '../lib/supabase.js';
import { config } from '../config.js';
import { ApiError } from '../utils/http.js';
import { throwIfError } from './errors.js';
import { DEFAULT_SETTINGS } from '../store.js';

/**
 * Supabase data-access functions for the seller ecosystem.
 *
 * Every function mirrors a method on the in-memory store (src/store.js) and
 * returns the same camelCase API shape, so `db/index.js` can dispatch between
 * the two backends transparently.
 */

/* ------------------------------------------------------------------ mapping */

function mapApplication(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    location: row.location || {},
    shopName: row.shop_name,
    deliveryPlaces: row.delivery_places || [],
    categories: row.categories || [],
    bio: row.bio,
    termsAccepted: row.terms_accepted,
    disclaimersAccepted: row.disclaimers_accepted,
    status: row.status,
    reviewNotes: row.review_notes,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSeller(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    applicationId: row.application_id,
    shopName: row.shop_name,
    deliveryPlaces: row.delivery_places || [],
    bio: row.bio ?? null,
    status: row.status,
    rating: Number(row.rating),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.read_at,
    createdAt: row.created_at
  };
}

function mapReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    productId: row.product_id,
    productTitle: row.products?.title || null,
    userId: row.user_id,
    rating: row.rating,
    comment: row.comment,
    status: row.status,
    createdAt: row.created_at
  };
}

function mapReturn(row) {
  if (!row) return null;
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    productTitle: row.products?.title || null,
    sellerId: row.seller_id,
    requestedBy: row.requested_by,
    reason: row.reason,
    status: row.status,
    resolutionNotes: row.resolution_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const APPLICATION_COLUMNS = `
  id, user_id, full_name, email, phone, location, shop_name, delivery_places,
  categories, bio, terms_accepted, disclaimers_accepted, status, review_notes,
  reviewed_at, reviewed_by, created_at, updated_at
`;

const SELLER_COLUMNS = 'id, user_id, application_id, shop_name, delivery_places, bio, status, rating, created_at, updated_at';

const NOTIFICATION_COLUMNS = 'id, user_id, type, title, body, link, read_at, created_at';

const RETURN_COLUMNS = `
  id, order_id, product_id, seller_id, requested_by, reason, status,
  resolution_notes, created_at, updated_at, products ( title )
`;

/* -------------------------------------------------------- seller applications */

export async function createApplication(payload) {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: existingError } = await supabase
    .from('seller_applications')
    .select('id')
    .eq('user_id', payload.userId)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();
  throwIfError({ error: existingError }, 'check pending seller application');
  if (existing) throw ApiError.conflict('You already have a pending seller application');

  const { data, error } = await supabase
    .from('seller_applications')
    .insert({
      user_id: payload.userId,
      full_name: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      location: payload.location || {},
      shop_name: payload.shopName,
      delivery_places: payload.deliveryPlaces || [],
      categories: payload.categories || [],
      bio: payload.bio || null,
      terms_accepted: Boolean(payload.termsAccepted),
      disclaimers_accepted: Boolean(payload.disclaimersAccepted)
    })
    .select(APPLICATION_COLUMNS)
    .single();
  throwIfError({ error }, 'create seller application');
  return mapApplication(data);
}

export async function listApplications({ status } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('seller_applications')
    .select(APPLICATION_COLUMNS)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  throwIfError({ error }, 'list seller applications');
  return (data || []).map(mapApplication);
}

export async function getApplication(id) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('seller_applications')
    .select(APPLICATION_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  throwIfError({ error }, `fetch application '${id}'`);
  if (!data) throw ApiError.notFound(`Application '${id}' not found`);
  return mapApplication(data);
}

export async function findApplicationByUser(userId, status) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('seller_applications')
    .select(APPLICATION_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (status) query = query.eq('status', status);

  const { data, error } = await query.maybeSingle();
  throwIfError({ error }, 'fetch seller application');
  return mapApplication(data);
}

export async function updateApplication(id, patch) {
  const supabase = getSupabaseAdmin();
  const row = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.reviewNotes !== undefined) row.review_notes = patch.reviewNotes;
  if (patch.reviewedAt !== undefined) row.reviewed_at = patch.reviewedAt;
  if (patch.reviewedBy !== undefined) row.reviewed_by = patch.reviewedBy;

  const { data, error } = await supabase
    .from('seller_applications')
    .update(row)
    .eq('id', id)
    .select(APPLICATION_COLUMNS)
    .single();
  throwIfError({ error }, `update application '${id}'`);
  return mapApplication(data);
}

/* ------------------------------------------------------------------- sellers */

export async function createSeller({ userId, applicationId, shopName }) {
  const supabase = getSupabaseAdmin();

  const existing = await getSellerByUserId(userId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('sellers')
    .insert({
      user_id: userId,
      application_id: applicationId || null,
      shop_name: shopName,
      status: 'active'
    })
    .select(SELLER_COLUMNS)
    .single();
  throwIfError({ error }, 'create seller');
  return mapSeller(data);
}

export async function getSellerById(id) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sellers')
    .select(SELLER_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  throwIfError({ error }, `fetch seller '${id}'`);
  return mapSeller(data);
}

export async function getSellerByUserId(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sellers')
    .select(SELLER_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  throwIfError({ error }, 'fetch seller by user');
  return mapSeller(data);
}

export async function listSellers() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sellers')
    .select(SELLER_COLUMNS)
    .order('created_at', { ascending: false });
  throwIfError({ error }, 'list sellers');
  return (data || []).map(mapSeller);
}

export async function updateSeller(id, patch) {
  const supabase = getSupabaseAdmin();
  const row = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.shopName !== undefined) row.shop_name = patch.shopName;
  if (patch.rating !== undefined) row.rating = patch.rating;
  if (patch.deliveryPlaces !== undefined) row.delivery_places = patch.deliveryPlaces;
  if (patch.bio !== undefined) row.bio = patch.bio;

  const { data, error } = await supabase
    .from('sellers')
    .update(row)
    .eq('id', id)
    .select(SELLER_COLUMNS)
    .single();
  throwIfError({ error }, `update seller '${id}'`);
  return mapSeller(data);
}

/* ---------------------------------------------------------------- profiles */

/** Flip a profile's role (e.g. 'customer' -> 'seller' on approval). */
export async function setProfileRole(userId, role) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select('id, full_name, phone, avatar_path, role, created_at, updated_at')
    .single();
  throwIfError({ error }, 'update profile role');
  return data;
}

export async function getProfileRow(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, avatar_path, role, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();
  throwIfError({ error }, 'fetch profile');
  return data || null;
}

/** Resolve a user's email (auth.users) — used for status-change emails. */
export async function getUserEmail(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) return null;
  return data?.user?.email || null;
}

/* -------------------------------------------------------------- notifications */

export async function createNotification({ userId, type, title, body, link }) {
  if (!userId) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, type, title, body: body || null, link: link || null })
    .select(NOTIFICATION_COLUMNS)
    .single();
  throwIfError({ error }, 'create notification');
  return mapNotification(data);
}

export async function listNotifications(userId, limit = 50) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  throwIfError({ error }, 'list notifications');
  return (data || []).map(mapNotification);
}

export async function unreadNotificationCount(userId) {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  throwIfError({ error }, 'count unread notifications');
  return count || 0;
}

export async function markNotificationRead(id, userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select(NOTIFICATION_COLUMNS)
    .maybeSingle();
  throwIfError({ error }, `mark notification '${id}' read`);
  if (!data) throw ApiError.notFound('Notification not found');
  return mapNotification(data);
}

export async function markAllNotificationsRead(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
    .select('id');
  throwIfError({ error }, 'mark all notifications read');
  return { updated: (data || []).length };
}

export async function listAdminUserIds() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('profiles').select('id').eq('role', 'admin');
  throwIfError({ error }, 'list admin profiles');
  return (data || []).map((row) => row.id);
}

/* ------------------------------------------------------------------ settings */

export async function getSettings() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('store_settings').select('key, value');
  throwIfError({ error }, 'read store settings');

  const stored = Object.fromEntries((data || []).map((row) => [row.key, row.value]));
  return {
    policies: { ...DEFAULT_SETTINGS.policies, ...(stored.policies || {}) },
    discounts: { ...DEFAULT_SETTINGS.discounts, ...(stored.discounts || {}) }
  };
}

export async function saveSettings(patch = {}) {
  const supabase = getSupabaseAdmin();
  const rows = [];
  if (patch.policies && typeof patch.policies === 'object') {
    const current = (await getSettings()).policies;
    rows.push({ key: 'policies', value: { ...current, ...patch.policies } });
  }
  if (patch.discounts && typeof patch.discounts === 'object') {
    const current = (await getSettings()).discounts;
    rows.push({ key: 'discounts', value: { ...current, ...patch.discounts } });
  }
  if (rows.length) {
    const { error } = await supabase.from('store_settings').upsert(rows, { onConflict: 'key' });
    throwIfError({ error }, 'save store settings');
  }
  return getSettings();
}

/* ------------------------------------------------------------ product reviews */

const REVIEW_COLUMNS = 'id, product_id, user_id, rating, comment, status, created_at, products ( title )';

export async function listProductReviews(productId, { includeHidden = false } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('product_reviews')
    .select(REVIEW_COLUMNS)
    .eq('product_id', productId)
    .order('created_at', { ascending: false });
  if (!includeHidden) query = query.eq('status', 'published');

  const { data, error } = await query;
  throwIfError({ error }, 'list product reviews');
  return (data || []).map(mapReview);
}

/** Reviews across every product belonging to a seller (dashboard tab). */
export async function listSellerReviews(sellerId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('product_reviews')
    .select(`${REVIEW_COLUMNS}, products!inner ( seller_id )`)
    .eq('products.seller_id', sellerId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(100);
  throwIfError({ error }, 'list seller reviews');
  return (data || []).map(mapReview);
}

export async function createProductReview({ productId, userId, rating, comment }) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('product_reviews')
    .insert({ product_id: productId, user_id: userId || null, rating, comment: comment || null })
    .select(REVIEW_COLUMNS)
    .single();
  throwIfError({ error }, 'create product review');

  // Roll the new rating into the product aggregate.
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, rating, reviews')
    .eq('id', productId)
    .single();
  if (!productError && product) {
    const count = product.reviews || 0;
    const current = Number(product.rating) || 0;
    await supabase
      .from('products')
      .update({
        reviews: count + 1,
        rating: Math.round(((current * count + rating) / (count + 1)) * 100) / 100
      })
      .eq('id', productId);
  }

  return mapReview(data);
}

/* ------------------------------------------------------------------ returns */

export async function createReturn({ orderId, productId, sellerId, requestedBy, reason }) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('return_requests')
    .insert({
      order_id: orderId || null,
      product_id: productId || null,
      seller_id: sellerId || null,
      requested_by: requestedBy || null,
      reason
    })
    .select(RETURN_COLUMNS)
    .single();
  throwIfError({ error }, 'create return request');
  return mapReturn(data);
}

export async function listReturns({ sellerId } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('return_requests')
    .select(RETURN_COLUMNS)
    .order('created_at', { ascending: false });
  if (sellerId) query = query.eq('seller_id', sellerId);

  const { data, error } = await query;
  throwIfError({ error }, 'list return requests');
  return (data || []).map(mapReturn);
}

export async function getReturn(id) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('return_requests')
    .select(RETURN_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  throwIfError({ error }, `fetch return '${id}'`);
  if (!data) throw ApiError.notFound(`Return '${id}' not found`);
  return mapReturn(data);
}

export async function updateReturn(id, patch) {
  const supabase = getSupabaseAdmin();
  const row = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.resolutionNotes !== undefined) row.resolution_notes = patch.resolutionNotes;

  const { data, error } = await supabase
    .from('return_requests')
    .update(row)
    .eq('id', id)
    .select(RETURN_COLUMNS)
    .single();
  throwIfError({ error }, `update return '${id}'`);
  return mapReturn(data);
}

/* --------------------------------------------------------- seller dashboard */

export async function sellerStats(sellerId) {
  const supabase = getSupabaseAdmin();
  const seller = await getSellerById(sellerId);

  const { data: productRows, error: productsError } = await supabase
    .from('products')
    .select('id, title')
    .eq('seller_id', sellerId);
  throwIfError({ error: productsError }, 'list seller products for stats');

  const productIds = (productRows || []).map((p) => p.id);

  let unitsSold = 0;
  let revenue = 0;
  const ordersById = new Map();

  if (productIds.length > 0) {
    const { data: lines, error: linesError } = await supabase
      .from('order_items')
      .select('quantity, price, order_id, orders ( id, reference, status, created_at )')
      .in('product_id', productIds);
    throwIfError({ error: linesError }, 'aggregate seller sales');

    for (const line of lines || []) {
      const order = Array.isArray(line.orders) ? line.orders[0] : line.orders;
      if (!order) continue;

      const entry = ordersById.get(order.id) || {
        id: order.id,
        reference: order.reference,
        status: order.status,
        createdAt: order.created_at,
        items: 0,
        units: 0,
        value: 0
      };
      entry.items += 1;
      entry.units += line.quantity;
      entry.value += Number(line.price) * line.quantity;
      ordersById.set(order.id, entry);

      if (order.status !== 'cancelled') {
        unitsSold += line.quantity;
        revenue += Number(line.price) * line.quantity;
      }
    }
  }

  const recentOrders = [...ordersById.values()]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  let reviewsCount = 0;
  let avgRating = Number(seller?.rating || 0);
  if (productIds.length > 0) {
    const { data: reviews, error: reviewsError } = await supabase
      .from('product_reviews')
      .select('rating')
      .in('product_id', productIds)
      .eq('status', 'published');
    throwIfError({ error: reviewsError }, 'aggregate seller reviews');
    if (reviews?.length) {
      reviewsCount = reviews.length;
      avgRating =
        Math.round((reviews.reduce((n, r) => n + r.rating, 0) / reviews.length) * 10) / 10;
    }
  }

  const { data: returns, error: returnsError } = await supabase
    .from('return_requests')
    .select('id, status')
    .eq('seller_id', sellerId);
  throwIfError({ error: returnsError }, 'aggregate seller returns');

  const returnsByStatus = (returns || []).reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return {
    sellerId,
    shopName: seller?.shopName || null,
    status: seller?.status || null,
    products: productIds.length,
    unitsSold,
    revenue,
    currency: config.currency,
    avgRating,
    reviewsCount,
    returns: {
      total: (returns || []).length,
      requested: returnsByStatus.requested || 0,
      approved: returnsByStatus.approved || 0,
      rejected: returnsByStatus.rejected || 0,
      completed: returnsByStatus.completed || 0
    },
    recentOrders
  };
}
