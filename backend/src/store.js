import { randomUUID } from 'node:crypto';
import { SEED_PRODUCTS } from './data/products.js';
import { config } from './config.js';
import { slugify } from './utils/slugify.js';
import { ApiError } from './utils/http.js';

/**
 * In-memory data store. A real deployment would replace this with a database
 * (see README "To Be Provided Later"). Kept deliberately simple so the
 * frontend can be developed against a stable contract immediately.
 */
class Store {
  constructor() {
    this.products = SEED_PRODUCTS.map((p) => ({ ...p }));
    this.carts = new Map(); // cartId -> { id, items: [], createdAt, updatedAt }
    this.orders = new Map(); // orderId -> order
    this.consultations = []; // spatial measurement bookings
    this.newsletter = new Set(); // subscribed emails
    this.subscribers = [];
  }

  /* ---------------------------------------------------------------- products */

  listProducts({ category, search, featured, sort, limit, offset } = {}) {
    let items = [...this.products];

    if (category) {
      const c = String(category).toLowerCase();
      items = items.filter((p) => p.category.toLowerCase() === c);
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
      this.clearCart(cartId);
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

  reset() {
    this.products = SEED_PRODUCTS.map((p) => ({ ...p }));
    this.carts.clear();
    this.orders.clear();
    this.consultations = [];
    this.newsletter.clear();
    this.subscribers = [];
  }
}

export const store = new Store();
