import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { SEED_PRODUCTS } from './data/products.js';
import { config } from './config.js';
import { slugify } from './utils/slugify.js';
import { ApiError } from './utils/http.js';

/**
 * In-memory data store. A real deployment would replace this with a database
 * (see README "To Be Provided Later"). Kept deliberately simple so the
 * frontend can be developed against a stable contract immediately.
 *
 * Beyond the storefront data this also emulates the pieces of Supabase the
 * seller-ecosystem flows need: dev users/sessions (when no Supabase project is
 * configured), profiles, seller applications, sellers, notifications, store
 * settings, product reviews and return requests. Everything is re-seeded on
 * `reset()` so the demo scenario (admin + seller + pending application) is
 * always available locally and in tests.
 */

const ACCESS_TOKEN_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Hash a password with scrypt + random salt ("salt:hex" storage format). */
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(String(password), salt, 64).toString('hex')}`;
}

/** Verify a password against a stored "salt:hash" value. */
function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/** Default storefront settings (mirrors supabase/migrations/0007_seller_seed.sql). */
export const DEFAULT_SETTINGS = {
  policies: {
    returnPolicy:
      'SpaceFit accepts returns within 7 days of delivery for items in original condition. Custom-made pieces are final sale. Approved refunds are issued to the original payment method within 10 business days.',
    sellerPolicy:
      'Sellers on SpaceFit are reviewed before approval. Sellers must list authentic, accurately described goods, respond to buyer enquiries within 48 hours, and honour the SpaceFit return window. Breaches may lead to suspension.',
    deliveryPolicy:
      'Standard delivery is 2-5 business days within Lagos, Abuja and Ibadan. Nationwide delivery is 5-9 business days. Delivery is free on orders above the free-delivery threshold.',
    privacyPolicy:
      'SpaceFit stores only the data needed to fulfil orders and improve your experience. We never sell personal data. Payment details are processed by Paystack and never touch our servers.'
  },
  discounts: {
    sitewidePercent: 0,
    promoCode: '',
    freeDeliveryThreshold: config.freeDeliveryThreshold,
    bannerEnabled: false
  }
};

/** Demo password for every seeded development account. */
export const DEMO_PASSWORD = 'spacefit123';

/** Ids of the seeded development accounts. */
const DEMO_USERS = {
  admin: 'dev-user-admin',
  seller: 'dev-user-seller',
  customer: 'dev-user-customer',
  applicant: 'seed-user-amara' // synthetic (no login) — owns the pending application
};
const DEMO_SELLER_ID = 'seed-seller-1';

class Store {
  constructor() {
    this.products = [];
    this.carts = new Map(); // cartId -> { id, items: [], createdAt, updatedAt }
    this.orders = new Map(); // orderId -> order
    this.consultations = []; // spatial measurement bookings
    this.newsletter = new Set(); // subscribed emails
    this.subscribers = [];

    // --- dev auth (used when Supabase is not configured) ---
    this.users = new Map(); // id -> { id, email, password, fullName, phone, role, createdAt }
    this.profiles = new Map(); // userId -> profile row (API shape)
    this.sessions = new Map(); // accessToken -> { userId, expiresAt }
    this.refreshTokens = new Map(); // refreshToken -> { userId, expiresAt }

    // --- seller ecosystem ---
    this.sellerApplications = new Map(); // id -> application
    this.sellers = new Map(); // id -> seller
    this.notifications = []; // newest first on read
    this.settings = new Map(); // key -> value
    this.productReviews = []; // review rows
    this.returnRequests = new Map(); // id -> return request

    this.seed();
  }

  /* ---------------------------------------------------------------- products */

  listProducts({ category, search, featured, sort, limit, offset, sellerId } = {}) {
    let items = [...this.products];

    if (category) {
      const c = String(category).toLowerCase();
      items = items.filter((p) => p.category.toLowerCase() === c);
    }

    if (sellerId !== undefined) {
      items = items.filter((p) => (p.sellerId || null) === (sellerId || null));
    }

    if (search) {
      const q = String(search).toLowerCase();
      items = items.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    if (featured !== undefined) {
      const want = featured === true || featured === 'true';
      items = items.filter((p) => Boolean(p.featured) === want);
    }

    switch (sort) {
      case 'price_asc':
        items.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        items.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        items.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        break;
      default:
        break;
    }

    const total = items.length;
    const start = Number(offset) || 0;
    const end = limit !== undefined ? start + Number(limit) : undefined;

    return { items: items.slice(start, end), total };
  }

  getProduct(id) {
    const product = this.products.find((p) => p.id === id || slugify(p.title) === id);
    if (!product) throw ApiError.notFound(`Product '${id}' not found`);
    return product;
  }

  getRelatedProducts(id, limit = 4) {
    const product = this.getProduct(id);
    const sameCategory = this.products.filter(
      (p) => p.id !== product.id && p.category === product.category
    );
    const others = this.products.filter(
      (p) => p.id !== product.id && p.category !== product.category
    );
    return [...sameCategory, ...others].slice(0, limit).map((p) => ({
      id: p.id,
      title: p.title,
      price: p.price,
      category: p.category,
      image: p.images[0] || null
    }));
  }

  listCategories() {
    const counts = new Map();
    for (const p of this.products) {
      counts.set(p.category, (counts.get(p.category) || 0) + 1);
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count }));
  }

  /** Create a product listing. Generates a unique slug-based id. */
  createProduct(payload) {
    const baseId = slugify(payload.slug || payload.title);
    if (!baseId) throw ApiError.badRequest('A product title is required');

    let id = baseId;
    let suffix = 2;
    while (this.products.some((p) => p.id === id)) {
      id = `${baseId}-${suffix++}`;
    }

    const now = new Date().toISOString();
    const product = {
      id,
      title: payload.title,
      slug: id,
      category: payload.category || 'Uncategorised',
      price: Number(payload.price) || 0,
      origPrice: payload.origPrice ?? null,
      currency: payload.currency || config.currency,
      rating: 0,
      reviews: 0,
      availability: payload.availability || 'In stock',
      shortDescription: payload.shortDescription || '',
      description: payload.description || '',
      features: payload.features || [],
      specs: payload.specs || [],
      colors: payload.colors || [],
      sizes: payload.sizes || [],
      images: payload.images || [],
      featured: Boolean(payload.featured),
      sellerId: payload.sellerId || null,
      createdAt: now,
      updatedAt: now
    };

    this.products.push(product);
    return { ...product };
  }

  /** Update editable fields on an existing product (in place). */
  updateProduct(id, patch) {
    const product = this.products.find((p) => p.id === id || slugify(p.title) === id);
    if (!product) throw ApiError.notFound(`Product '${id}' not found`);

    const editable = [
      'title', 'category', 'price', 'origPrice', 'availability', 'shortDescription',
      'description', 'features', 'specs', 'colors', 'sizes', 'images', 'featured'
    ];
    for (const key of editable) {
      if (patch[key] !== undefined) product[key] = patch[key];
    }
    if (patch.slug !== undefined) product.slug = slugify(patch.slug) || product.slug;
    product.updatedAt = new Date().toISOString();
    return { ...product };
  }

  /** Delete a product listing. */
  removeProduct(id) {
    const before = this.products.length;
    const product = this.products.find((p) => p.id === id);
    this.products = this.products.filter((p) => p.id !== id);
    if (this.products.length === before) {
      throw ApiError.notFound(`Product '${id}' not found`);
    }
    // Drop dependent demo data as well.
    this.productReviews = this.productReviews.filter((r) => r.productId !== product.id);
    return true;
  }

  /** Find a product by id/slug or return null (no throw). */
  findProduct(id) {
    return this.products.find((p) => p.id === id || slugify(p.title) === id) || null;
  }

  /* -------------------------------------------------------------------- cart */

  createCart() {
    const id = randomUUID();
    const now = new Date().toISOString();
    const cart = { id, items: [], createdAt: now, updatedAt: now };
    this.carts.set(id, cart);
    return cart;
  }

  getCart(cartId, { createIfMissing = false } = {}) {
    let cart = this.carts.get(cartId);
    if (!cart && createIfMissing) {
      cart = this.createCart();
      this.carts.set(cart.id, cart);
      return cart;
    }
    if (!cart) throw ApiError.notFound(`Cart '${cartId}' not found`);
    return cart;
  }

  addCartItem(cartId, { productId, quantity = 1, size, color }) {
    const product = this.getProduct(productId);
    const cart = this.getCart(cartId, { createIfMissing: true });

    const key = [product.id, size || '', color || ''].join('::');
    const existing = cart.items.find((i) => i.key === key);

    if (existing) {
      existing.quantity += Number(quantity);
    } else {
      cart.items.push({
        key,
        productId: product.id,
        name: product.title,
        price: product.price,
        image: product.images[0] || null,
        quantity: Number(quantity),
        size: size || product.sizes?.[0] || null,
        color: color || product.colors?.[0]?.name || null
      });
    }

    cart.updatedAt = new Date().toISOString();
    return this.summariseCart(cart);
  }

  updateCartItem(cartId, itemKey, quantity) {
    const cart = this.getCart(cartId);
    const item = cart.items.find((i) => i.key === itemKey);
    if (!item) throw ApiError.notFound(`Cart item '${itemKey}' not found`);

    if (Number(quantity) <= 0) {
      cart.items = cart.items.filter((i) => i.key !== itemKey);
    } else {
      item.quantity = Number(quantity);
    }

    cart.updatedAt = new Date().toISOString();
    return this.summariseCart(cart);
  }

  removeCartItem(cartId, itemKey) {
    const cart = this.getCart(cartId);
    const before = cart.items.length;
    cart.items = cart.items.filter((i) => i.key !== itemKey);
    if (cart.items.length === before) {
      throw ApiError.notFound(`Cart item '${itemKey}' not found`);
    }
    cart.updatedAt = new Date().toISOString();
    return this.summariseCart(cart);
  }

  clearCart(cartId) {
    const cart = this.getCart(cartId);
    cart.items = [];
    cart.updatedAt = new Date().toISOString();
    return this.summariseCart(cart);
  }

  /**
   * Compute totals for a cart: subtotal, delivery, VAT and grand total.
   */
  summariseCart(cart) {
    const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const delivery = this.calculateDelivery(subtotal);
    const vat = Math.round(subtotal * config.vatRate);
    const total = subtotal + delivery + vat;

    return {
      id: cart.id,
      items: cart.items,
      itemCount: cart.items.reduce((n, i) => n + i.quantity, 0),
      currency: config.currency,
      subtotal,
      delivery,
      vat,
      total,
      freeDeliveryThreshold: config.freeDeliveryThreshold,
      updatedAt: cart.updatedAt
    };
  }

  calculateDelivery(subtotal) {
    if (subtotal >= config.freeDeliveryThreshold) return 0;
    return config.deliveryFee;
  }

  /* ------------------------------------------------------------------- orders */

  createOrder(payload) {
    const {
      cartId,
      items: rawItems,
      customer,
      delivery,
      paymentMethod,
      notes
    } = payload;

    let items = rawItems;
    if ((!items || items.length === 0) && cartId) {
      const cart = this.getCart(cartId);
      items = cart.items;
    }

    if (!items || items.length === 0) {
      throw ApiError.badRequest('Order must contain at least one item');
    }

    const resolved = items.map((i) => {
      const product = this.getProduct(i.productId || i.id);
      const quantity = Number(i.quantity) || 1;
      return {
        productId: product.id,
        name: product.title,
        price: product.price,
        quantity,
        size: i.size || null,
        color: i.color || null
      };
    });

    const subtotal = resolved.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const deliveryFee = this.calculateDelivery(subtotal);
    const vat = Math.round(subtotal * config.vatRate);
    const total = subtotal + deliveryFee + vat;

    const order = {
      id: randomUUID(),
      reference: `SF-${Date.now().toString(36).toUpperCase()}`,
      status: 'pending',
      items: resolved,
      customer,
      delivery,
      paymentMethod,
      notes: notes || null,
      currency: config.currency,
      subtotal,
      deliveryFee,
      vat,
      total,
      createdAt: new Date().toISOString()
    };

    this.orders.set(order.id, order);

    if (cartId && this.carts.has(cartId)) {
      this.carts.delete(cartId);
    }

    return order;
  }

  getOrder(id) {
    const order = this.orders.get(id);
    if (!order) throw ApiError.notFound(`Order '${id}' not found`);
    return order;
  }

  listOrders() {
    return [...this.orders.values()].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  /* ---------------------------------------------------- spatial consultations */

  createConsultation(payload) {
    const record = {
      id: randomUUID(),
      ...payload,
      status: 'requested',
      createdAt: new Date().toISOString()
    };
    this.consultations.push(record);
    return record;
  }

  /* --------------------------------------------------------------- newsletter */

  subscribe(email) {
    const normalised = String(email).toLowerCase();
    if (this.newsletter.has(normalised)) {
      return { email: normalised, alreadySubscribed: true };
    }
    this.newsletter.add(normalised);
    this.subscribers.push({ email: normalised, createdAt: new Date().toISOString() });
    return { email: normalised, alreadySubscribed: false };
  }

  /* ------------------------------------------------------------- dev auth */
  // Used when Supabase is not configured so the full seller flow can be
  // exercised locally and in tests. Profiles mirror the `profiles` table.

  createDevUser({ id, email, password, fullName, phone, role = 'customer' }) {
    const normalised = String(email).toLowerCase();
    if (this.findUserByEmail(normalised)) {
      throw ApiError.conflict('An account with this email already exists');
    }
    const userId = id || randomUUID();
    const now = new Date().toISOString();
    const user = {
      id: userId,
      email: normalised,
      password: password ? hashPassword(password) : null,
      fullName: fullName || null,
      phone: phone || null,
      role,
      createdAt: now
    };
    this.users.set(userId, user);
    this.profiles.set(userId, {
      id: userId,
      full_name: fullName || null,
      phone: phone || null,
      avatar_path: null,
      role,
      created_at: now,
      updated_at: now
    });
    return user;
  }

  findUserByEmail(email) {
    const normalised = String(email || '').toLowerCase();
    for (const user of this.users.values()) {
      if (user.email === normalised) return user;
    }
    return null;
  }

  findUserById(id) {
    return this.users.get(id) || null;
  }

  verifyUserPassword(user, password) {
    return Boolean(user && user.password && verifyPassword(password, user.password));
  }

  createDevSession(user) {
    const accessToken = `dev_at_${randomUUID()}`;
    const refreshToken = `dev_rt_${randomUUID()}`;
    const now = Date.now();
    this.sessions.set(accessToken, { userId: user.id, expiresAt: now + ACCESS_TOKEN_TTL });
    this.refreshTokens.set(refreshToken, { userId: user.id, expiresAt: now + REFRESH_TOKEN_TTL });
    return {
      accessToken,
      refreshToken,
      expiresAt: Math.floor((now + ACCESS_TOKEN_TTL) / 1000)
    };
  }

  /** Resolve a dev access token to a Supabase-shaped user (or null). */
  getSessionUser(token) {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    const user = this.users.get(session.userId);
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      app_metadata: { role: user.role },
      user_metadata: { role: user.role, full_name: user.fullName }
    };
  }

  refreshDevSession(refreshToken) {
    const entry = this.refreshTokens.get(refreshToken);
    if (!entry || entry.expiresAt < Date.now()) return null;
    const user = this.users.get(entry.userId);
    if (!user) return null;
    this.refreshTokens.delete(refreshToken);
    return { user: { id: user.id, email: user.email }, session: this.createDevSession(user) };
  }

  revokeAccessToken(token) {
    if (token) this.sessions.delete(token);
  }

  getProfileRow(userId) {
    const profile = this.profiles.get(userId);
    return profile ? { ...profile } : null;
  }

  updateProfileRow(userId, patch) {
    const profile = this.profiles.get(userId);
    if (!profile) return null;
    const fields = { fullName: 'full_name', phone: 'phone', avatarPath: 'avatar_path' };
    for (const [from, to] of Object.entries(fields)) {
      if (patch[from] !== undefined) profile[to] = patch[from];
    }
    profile.updated_at = new Date().toISOString();
    return { ...profile };
  }

  setProfileRole(userId, role) {
    const profile = this.profiles.get(userId);
    if (profile) {
      profile.role = role;
      profile.updated_at = new Date().toISOString();
    }
    const user = this.users.get(userId);
    if (user) user.role = role;
    return profile ? { ...profile } : null;
  }

  /* -------------------------------------------------- seller applications */

  createApplication(payload) {
    const existing = [...this.sellerApplications.values()].find(
      (a) => a.userId === payload.userId && a.status === 'pending'
    );
    if (existing) {
      throw ApiError.conflict('You already have a pending seller application');
    }

    const now = new Date().toISOString();
    const application = {
      id: randomUUID(),
      userId: payload.userId,
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      location: payload.location || {},
      shopName: payload.shopName,
      deliveryPlaces: payload.deliveryPlaces || [],
      categories: payload.categories || [],
      bio: payload.bio || null,
      termsAccepted: Boolean(payload.termsAccepted),
      disclaimersAccepted: Boolean(payload.disclaimersAccepted),
      status: 'pending',
      reviewNotes: null,
      reviewedAt: null,
      reviewedBy: null,
      createdAt: now,
      updatedAt: now
    };
    this.sellerApplications.set(application.id, application);
    return { ...application };
  }

  listApplications({ status } = {}) {
    let items = [...this.sellerApplications.values()];
    if (status) items = items.filter((a) => a.status === status);
    return items
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((a) => ({ ...a }));
  }

  getApplication(id) {
    const application = this.sellerApplications.get(id);
    if (!application) throw ApiError.notFound(`Application '${id}' not found`);
    return { ...application };
  }

  findApplicationByUser(userId, status) {
    const matches = [...this.sellerApplications.values()]
      .filter((a) => a.userId === userId && (!status || a.status === status))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return matches[0] ? { ...matches[0] } : null;
  }

  updateApplication(id, patch) {
    const application = this.sellerApplications.get(id);
    if (!application) throw ApiError.notFound(`Application '${id}' not found`);
    Object.assign(application, patch, { updatedAt: new Date().toISOString() });
    return { ...application };
  }

  /* ---------------------------------------------------------------- sellers */

  createSeller({ userId, applicationId, shopName, deliveryPlaces, bio }) {
    const existing = this.getSellerByUserId(userId);
    if (existing) return { ...existing };

    const now = new Date().toISOString();
    const seller = {
      id: randomUUID(),
      userId,
      applicationId: applicationId || null,
      shopName,
      deliveryPlaces: deliveryPlaces || [],
      bio: bio ?? null,
      status: 'active',
      rating: 0,
      createdAt: now,
      updatedAt: now
    };
    this.sellers.set(seller.id, seller);
    return { ...seller };
  }

  getSellerById(id) {
    const seller = this.sellers.get(id);
    return seller ? { ...seller } : null;
  }

  getSellerByUserId(userId) {
    for (const seller of this.sellers.values()) {
      if (seller.userId === userId) return { ...seller };
    }
    return null;
  }

  listSellers() {
    return [...this.sellers.values()]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((s) => ({ ...s }));
  }

  updateSeller(id, patch) {
    const seller = this.sellers.get(id);
    if (!seller) throw ApiError.notFound(`Seller '${id}' not found`);
    Object.assign(seller, patch, { updatedAt: new Date().toISOString() });
    return { ...seller };
  }

  /* ------------------------------------------------------------ notifications */

  createNotification({ userId, type, title, body, link }) {
    if (!userId) return null;
    const record = {
      id: randomUUID(),
      userId,
      type,
      title,
      body: body || null,
      link: link || null,
      readAt: null,
      createdAt: new Date().toISOString()
    };
    this.notifications.unshift(record);
    return { ...record };
  }

  listNotifications(userId, limit = 50) {
    return this.notifications
      .filter((n) => n.userId === userId)
      .slice(0, limit)
      .map((n) => ({ ...n }));
  }

  unreadNotificationCount(userId) {
    return this.notifications.filter((n) => n.userId === userId && !n.readAt).length;
  }

  markNotificationRead(id, userId) {
    const notification = this.notifications.find((n) => n.id === id && n.userId === userId);
    if (!notification) throw ApiError.notFound('Notification not found');
    if (!notification.readAt) notification.readAt = new Date().toISOString();
    return { ...notification };
  }

  markAllNotificationsRead(userId) {
    const now = new Date().toISOString();
    let updated = 0;
    for (const n of this.notifications) {
      if (n.userId === userId && !n.readAt) {
        n.readAt = now;
        updated += 1;
      }
    }
    return { updated };
  }

  listAdminUserIds() {
    return [...this.profiles.values()].filter((p) => p.role === 'admin').map((p) => p.id);
  }

  /* ---------------------------------------------------------------- settings */

  getSettings() {
    return {
      policies: { ...DEFAULT_SETTINGS.policies, ...(this.settings.get('policies') || {}) },
      discounts: { ...DEFAULT_SETTINGS.discounts, ...(this.settings.get('discounts') || {}) }
    };
  }

  saveSettings(patch = {}) {
    for (const key of ['policies', 'discounts']) {
      if (patch[key] && typeof patch[key] === 'object') {
        this.settings.set(key, { ...(this.settings.get(key) || {}), ...patch[key] });
      }
    }
    return this.getSettings();
  }

  /* ------------------------------------------------------------ product reviews */

  listProductReviews(productId, { includeHidden = false } = {}) {
    return this.productReviews
      .filter((r) => r.productId === productId && (includeHidden || r.status === 'published'))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((r) => ({ ...r }));
  }

  createProductReview({ productId, userId, rating, comment }) {
    const product = this.findProduct(productId);
    if (!product) throw ApiError.notFound(`Product '${productId}' not found`);

    const record = {
      id: randomUUID(),
      productId: product.id,
      userId: userId || null,
      rating: Number(rating),
      comment: comment || null,
      status: 'published',
      createdAt: new Date().toISOString()
    };
    this.productReviews.unshift(record);

    // Roll the new rating into the product aggregate (seeded counts included).
    const count = Number(product.reviews) || 0;
    const current = Number(product.rating) || 0;
    product.reviews = count + 1;
    product.rating = Math.round(((current * count + record.rating) / (count + 1)) * 100) / 100;

    return { ...record };
  }

  /* ---------------------------------------------------------------- returns */

  /** Reviews across every product belonging to a seller (dashboard tab). */
  listSellerReviews(sellerId) {
    const productIds = new Set(
      this.products.filter((p) => p.sellerId === sellerId).map((p) => p.id)
    );
    const titleFor = new Map(
      this.products.filter((p) => p.sellerId === sellerId).map((p) => [p.id, p.title])
    );
    return this.productReviews
      .filter((r) => productIds.has(r.productId) && r.status === 'published')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((r) => ({ ...r, productTitle: titleFor.get(r.productId) || null }));
  }

  createReturn({ orderId, productId, sellerId, requestedBy, reason }) {
    const now = new Date().toISOString();
    const record = {
      id: randomUUID(),
      orderId: orderId || null,
      productId: productId || null,
      sellerId: sellerId || null,
      requestedBy: requestedBy || null,
      reason,
      status: 'requested',
      resolutionNotes: null,
      createdAt: now,
      updatedAt: now
    };
    this.returnRequests.set(record.id, record);
    return { ...record };
  }

  listReturns({ sellerId } = {}) {
    let items = [...this.returnRequests.values()];
    if (sellerId) items = items.filter((r) => r.sellerId === sellerId);
    const titleFor = new Map(this.products.map((p) => [p.id, p.title]));
    return items
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((r) => ({ ...r, productTitle: titleFor.get(r.productId) || null }));
  }

  getReturn(id) {
    const record = this.returnRequests.get(id);
    if (!record) throw ApiError.notFound(`Return '${id}' not found`);
    return { ...record };
  }

  updateReturn(id, patch) {
    const record = this.returnRequests.get(id);
    if (!record) throw ApiError.notFound(`Return '${id}' not found`);
    Object.assign(record, patch, { updatedAt: new Date().toISOString() });
    return { ...record };
  }

  /* ------------------------------------------------------- seller dashboard */

  sellerStats(sellerId) {
    const seller = this.getSellerById(sellerId);
    const products = this.products.filter((p) => p.sellerId === sellerId);
    const productIds = new Set(products.map((p) => p.id));

    let unitsSold = 0;
    let revenue = 0;
    const recentOrders = [];

    for (const order of this.listOrders()) {
      const lines = order.items.filter((i) => productIds.has(i.productId));
      if (lines.length === 0) continue;
      if (order.status !== 'cancelled') {
        for (const line of lines) {
          unitsSold += line.quantity;
          revenue += line.price * line.quantity;
        }
      }
      recentOrders.push({
        id: order.id,
        reference: order.reference,
        status: order.status,
        createdAt: order.createdAt,
        items: lines.length,
        units: lines.reduce((n, l) => n + l.quantity, 0),
        value: lines.reduce((n, l) => n + l.price * l.quantity, 0)
      });
    }
    recentOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const reviews = this.productReviews.filter(
      (r) => productIds.has(r.productId) && r.status === 'published'
    );
    const returns = [...this.returnRequests.values()].filter((r) => r.sellerId === sellerId);
    const returnsByStatus = returns.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    const avgRating = reviews.length
      ? Math.round((reviews.reduce((n, r) => n + r.rating, 0) / reviews.length) * 10) / 10
      : Number(seller?.rating || 0);

    return {
      sellerId,
      shopName: seller?.shopName || null,
      status: seller?.status || null,
      products: products.length,
      unitsSold,
      revenue,
      currency: config.currency,
      avgRating,
      reviewsCount: reviews.length,
      returns: {
        total: returns.length,
        requested: returnsByStatus.requested || 0,
        approved: returnsByStatus.approved || 0,
        rejected: returnsByStatus.rejected || 0,
        completed: returnsByStatus.completed || 0
      },
      recentOrders: recentOrders.slice(0, 5)
    };
  }

  /* ------------------------------------------------------------------- seed */

  /** Populate the deterministic demo scenario. Called by the constructor and reset(). */
  seed() {
    const now = new Date().toISOString();
    const earlier = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Platform-owned catalogue.
    this.products = SEED_PRODUCTS.map((p) => ({ ...p, sellerId: null }));

    // Demo accounts (password: DEMO_PASSWORD).
    this.createDevUser({
      id: DEMO_USERS.admin,
      email: 'admin@spacefit.ng',
      password: DEMO_PASSWORD,
      fullName: 'SpaceFit Admin',
      phone: '+2348000000001',
      role: 'admin'
    });
    this.createDevUser({
      id: DEMO_USERS.seller,
      email: 'seller@spacefit.ng',
      password: DEMO_PASSWORD,
      fullName: 'Tolu Adebayo',
      phone: '+2348000000002',
      role: 'seller'
    });
    this.createDevUser({
      id: DEMO_USERS.customer,
      email: 'customer@spacefit.ng',
      password: DEMO_PASSWORD,
      fullName: 'Ada Obi',
      phone: '+2348000000003',
      role: 'customer'
    });
    // Synthetic applicant — owns the pending application shown in the admin
    // queue but has no login (cannot sign in, purely demo content).
    this.createDevUser({
      id: DEMO_USERS.applicant,
      email: 'amara@example.com',
      password: null,
      fullName: 'Amara Eze',
      phone: '+2348000000004',
      role: 'customer'
    });

    // Approved application (provenance for the demo seller) + the seller row.
    const approvedApplication = {
      id: 'seed-app-approved',
      userId: DEMO_USERS.seller,
      fullName: 'Tolu Adebayo',
      email: 'seller@spacefit.ng',
      phone: '+2348000000002',
      location: { city: 'Lagos', state: 'Lagos' },
      shopName: 'Adebayo Woodworks',
      deliveryPlaces: ['Lagos', 'Abuja', 'Ibadan'],
      categories: ['Storage', 'Lighting'],
      bio: 'Small-batch solid wood furniture and sculptural lighting, made in Lagos.',
      termsAccepted: true,
      disclaimersAccepted: true,
      status: 'approved',
      reviewNotes: null,
      reviewedAt: earlier,
      reviewedBy: DEMO_USERS.admin,
      createdAt: earlier,
      updatedAt: earlier
    };
    this.sellerApplications.set(approvedApplication.id, approvedApplication);

    this.sellers.set(DEMO_SELLER_ID, {
      id: DEMO_SELLER_ID,
      userId: DEMO_USERS.seller,
      applicationId: approvedApplication.id,
      shopName: 'Adebayo Woodworks',
      deliveryPlaces: ['Lagos', 'Abuja', 'Ibadan'],
      bio: 'Small-batch solid wood furniture and sculptural lighting, made in Lagos.',
      status: 'active',
      rating: 4.6,
      createdAt: earlier,
      updatedAt: earlier
    });

    // Pending application — fills the admin review queue on first load.
    this.sellerApplications.set('seed-app-pending', {
      id: 'seed-app-pending',
      userId: DEMO_USERS.applicant,
      fullName: 'Amara Eze',
      email: 'amara@example.com',
      phone: '+2348000000004',
      location: { city: 'Abuja', state: 'FCT' },
      shopName: "Amara's Light Studio",
      deliveryPlaces: ['Abuja', 'Lagos'],
      categories: ['Lighting'],
      bio: 'Contemporary hand-blown glass and brass lighting for homes and hospitality.',
      termsAccepted: true,
      disclaimersAccepted: true,
      status: 'pending',
      reviewNotes: null,
      reviewedAt: null,
      reviewedBy: null,
      createdAt: earlier,
      updatedAt: earlier
    });

    // Demo listings owned by the approved seller.
    const console_ = this.createProduct({
      title: 'Ikeja Solid Oak Console Table',
      category: 'Storage',
      price: 195000,
      origPrice: 220000,
      shortDescription: 'Solid oak console with a slatted lower shelf.',
      description:
        'A warm, solid oak console with a slatted lower shelf — sized for entryways, hallways and behind-sofa placement.',
      features: ['Solid oak construction', 'Slatted lower shelf', 'Hand-oiled finish', 'Wall-anchor included'],
      specs: [
        { label: 'Dimensions', value: '120 x 35 x 78 cm' },
        { label: 'Material', value: 'Solid oak' }
      ],
      colors: [{ name: 'Natural Oak', hex: '#c9a227' }],
      sizes: ['Standard'],
      images: [SEED_PRODUCTS[1].images[0]],
      availability: 'In stock',
      sellerId: DEMO_SELLER_ID
    });
    const lamp = this.createProduct({
      title: 'Zaria Sculptural Floor Lamp',
      category: 'Lighting',
      price: 120000,
      origPrice: null,
      shortDescription: 'Sculptural brass floor lamp with a linen drum shade.',
      description:
        'A slender brass floor lamp with a natural linen drum shade, casting warm ambient light for reading corners and living rooms.',
      features: ['Brushed brass stem', 'Linen drum shade', 'Foot dimmer switch', 'Weighted marble base'],
      specs: [
        { label: 'Dimensions', value: '40 x 40 x 158 cm' },
        { label: 'Material', value: 'Brass, linen, marble' }
      ],
      colors: [{ name: 'Brass', hex: '#b08d57' }],
      sizes: ['Standard'],
      images: [SEED_PRODUCTS[6].images[0]],
      availability: 'In stock',
      sellerId: DEMO_SELLER_ID
    });
    // Bake demo aggregates into the seller's listings.
    const consoleRow = this.products.find((p) => p.id === console_.id);
    consoleRow.rating = 4.7;
    consoleRow.reviews = 24;
    const lampRow = this.products.find((p) => p.id === lamp.id);
    lampRow.rating = 4.6;
    lampRow.reviews = 15;

    // Demo reviews for the seller's products.
    [
      { productId: console_.id, userId: DEMO_USERS.customer, rating: 5, comment: 'Gorgeous grain and rock solid. Delivery was flawless.' },
      { productId: console_.id, userId: null, rating: 4, comment: 'Beautiful piece — the oiled finish is even and warm.' },
      { productId: lamp.id, userId: DEMO_USERS.customer, rating: 5, comment: 'The dimmer is a lovely touch. Light is very warm.' }
    ].forEach((r) => {
      this.productReviews.unshift({
        id: randomUUID(),
        productId: r.productId,
        userId: r.userId,
        rating: r.rating,
        comment: r.comment,
        status: 'published',
        createdAt: earlier
      });
    });

    // A delivered demo order so the seller dashboard has sales to show.
    const demoItems = [
      {
        productId: console_.id,
        name: console_.title,
        price: console_.price,
        quantity: 2,
        size: null,
        color: null
      },
      {
        productId: lamp.id,
        name: lamp.title,
        price: lamp.price,
        quantity: 1,
        size: null,
        color: null
      }
    ];
    const demoSubtotal = demoItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const demoDelivery = demoSubtotal >= config.freeDeliveryThreshold ? 0 : config.deliveryFee;
    const demoVat = Math.round(demoSubtotal * config.vatRate);
    const demoOrder = {
      id: randomUUID(),
      reference: 'SF-DEMO01',
      status: 'delivered',
      items: demoItems,
      customer: { fullName: 'Chinedu Effiong', email: 'chinedu@example.com', phone: '+234805555555' },
      delivery: { address: '14 Admiralty Way', city: 'Lagos', state: 'Lagos', instructions: '' },
      paymentMethod: 'card',
      notes: null,
      currency: config.currency,
      subtotal: demoSubtotal,
      deliveryFee: demoDelivery,
      vat: demoVat,
      total: demoSubtotal + demoDelivery + demoVat,
      createdAt: earlier
    };
    this.orders.set(demoOrder.id, demoOrder);

    // Demo returns for the seller dashboard.
    this.createReturn({
      orderId: demoOrder.id,
      productId: lamp.id,
      sellerId: DEMO_SELLER_ID,
      requestedBy: DEMO_USERS.customer,
      reason: 'Shade arrived with a small dent on the rim.'
    });
    const completedReturn = this.createReturn({
      orderId: demoOrder.id,
      productId: console_.id,
      sellerId: DEMO_SELLER_ID,
      requestedBy: null,
      reason: 'Wrong colour delivered — customer ordered Natural Oak.'
    });
    this.updateReturn(completedReturn.id, {
      status: 'completed',
      resolutionNotes: 'Replacement dispatched within 48 hours.'
    });

    // Default storefront settings.
    this.settings.set('policies', { ...DEFAULT_SETTINGS.policies });
    this.settings.set('discounts', { ...DEFAULT_SETTINGS.discounts });

    // Seed notifications so the bell badge isn't empty on first load.
    this.createNotification({
      userId: DEMO_USERS.seller,
      type: 'application_approved',
      title: 'Welcome to SpaceFit sellers',
      body: 'Your seller account is active. List your first product to get started.',
      link: 'seller-dashboard.html'
    });
    this.createNotification({
      userId: DEMO_USERS.admin,
      type: 'application_received',
      title: "New application: Amara's Light Studio",
      body: 'Amara Eze applied to sell on SpaceFit.',
      link: 'admin.html#applications'
    });
  }

  reset() {
    this.carts.clear();
    this.orders.clear();
    this.consultations = [];
    this.newsletter.clear();
    this.subscribers = [];
    this.users.clear();
    this.profiles.clear();
    this.sessions.clear();
    this.refreshTokens.clear();
    this.sellerApplications.clear();
    this.sellers.clear();
    this.notifications = [];
    this.settings.clear();
    this.productReviews = [];
    this.returnRequests.clear();
    this.seed();
  }
}

export const store = new Store();
