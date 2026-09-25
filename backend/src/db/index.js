import { config } from '../config.js';
import { isSupabaseConfigured } from '../lib/supabase.js';
import { store } from '../store.js';
import * as productsRepo from './products.js';
import * as cartsRepo from './carts.js';
import * as ordersRepo from './orders.js';
import * as consultationsRepo from './consultations.js';
import * as newsletterRepo from './newsletter.js';
import * as sellersRepo from './sellers.js';
import * as wishlistRepo from './wishlist.js';

/**
 * Data-access facade used by the route handlers.
 *
 * When Supabase credentials are configured AND `USE_SUPABASE=true`, every call
 * is served from PostgreSQL via Supabase. Otherwise the in-memory store is used
 * so the API remains fully functional for local development and the test suite.
 *
 * Every method is async so callers behave identically regardless of the backend.
 */

/** True when the Supabase backend is active. */
export function usingSupabase() {
  return config.useSupabase && isSupabaseConfigured;
}

/** Resolve the effective backend, warning once if Supabase was requested but unusable. */
let warned = false;
function backend() {
  if (usingSupabase()) return 'supabase';
  if (config.useSupabase && !isSupabaseConfigured && !warned) {
    warned = true;
    console.warn(
      '[db] USE_SUPABASE=true but Supabase credentials are missing; ' +
        'falling back to the in-memory store.'
    );
  }
  return 'memory';
}

/* ---------------------------------------------------------------- products */

export async function listProducts(params = {}) {
  if (backend() === 'supabase') return productsRepo.listProducts(params);
  return store.listProducts(params);
}

export async function getProduct(id) {
  if (backend() === 'supabase') return productsRepo.getProduct(id);
  return store.getProduct(id);
}

export async function getRelatedProducts(id, limit = 4) {
  if (backend() === 'supabase') return productsRepo.getRelatedProducts(id, limit);
  return store.getRelatedProducts(id, limit);
}

export async function listCategories() {
  if (backend() === 'supabase') return productsRepo.listCategories();
  return store.listCategories();
}

/** Create a product listing (seller or admin). */
export async function createProduct(payload) {
  if (backend() === 'supabase') return productsRepo.createProduct(payload);
  return store.createProduct(payload);
}

/** Update editable fields on a product. */
export async function updateProduct(id, patch) {
  if (backend() === 'supabase') return productsRepo.updateProduct(id, patch);
  return store.updateProduct(id, patch);
}

/** Delete a product listing. */
export async function deleteProduct(id) {
  if (backend() === 'supabase') return productsRepo.deleteProduct(id);
  return store.removeProduct(id);
}

/** Find a product by id/slug or null (no throw). */
export async function findProduct(id) {
  if (backend() === 'supabase') {
    try {
      return await productsRepo.getProduct(id);
    } catch (err) {
      if (err && err.status === 404) return null;
      throw err;
    }
  }
  return store.findProduct(id);
}

/* -------------------------------------------------------------------- cart */

export async function createCart(opts = {}) {
  if (backend() === 'supabase') return cartsRepo.createCart(opts);
  return store.summariseCart(store.createCart());
}

export async function getCart(cartId) {
  if (backend() === 'supabase') return cartsRepo.getCart(cartId);
  return store.summariseCart(store.getCart(cartId));
}

export async function addCartItem(cartId, payload) {
  if (backend() === 'supabase') return cartsRepo.addCartItem(cartId, payload);
  return store.addCartItem(cartId, payload);
}

export async function updateCartItem(cartId, itemKey, quantity) {
  if (backend() === 'supabase') return cartsRepo.updateCartItem(cartId, itemKey, quantity);
  return store.updateCartItem(cartId, itemKey, quantity);
}

export async function removeCartItem(cartId, itemKey) {
  if (backend() === 'supabase') return cartsRepo.removeCartItem(cartId, itemKey);
  return store.removeCartItem(cartId, itemKey);
}

export async function clearCart(cartId) {
  if (backend() === 'supabase') return cartsRepo.clearCart(cartId);
  return store.clearCart(cartId);
}

/* ------------------------------------------------------------------ orders */

export async function createOrder(payload) {
  if (backend() === 'supabase') return ordersRepo.createOrder(payload);
  return store.createOrder(payload);
}

export async function getOrder(id) {
  if (backend() === 'supabase') return ordersRepo.getOrder(id);
  return store.getOrder(id);
}

export async function listOrders(opts = {}) {
  if (backend() === 'supabase') return ordersRepo.listOrders(opts);
  return store.listOrders(opts);
}

export async function updateOrderStatus(id, status) {
  if (backend() === 'supabase') return ordersRepo.updateOrderStatus(id, status);
  const order = store.getOrder(id);
  order.status = status;
  return order;
}

/* ----------------------------------------------------------- consultations */

export async function createConsultation(payload) {
  if (backend() === 'supabase') return consultationsRepo.createConsultation(payload);
  return store.createConsultation(payload);
}

export async function listConsultations(opts = {}) {
  if (backend() === 'supabase') return consultationsRepo.listConsultations(opts);
  return store.consultations;
}

/* -------------------------------------------------------------- newsletter */

export async function subscribe(email) {
  if (backend() === 'supabase') return newsletterRepo.subscribe(email);
  return store.subscribe(email);
}

/* -------------------------------------------------- seller ecosystem (apps) */

export async function createApplication(payload) {
  if (backend() === 'supabase') return sellersRepo.createApplication(payload);
  return store.createApplication(payload);
}

export async function listApplications({ status } = {}) {
  if (backend() === 'supabase') return sellersRepo.listApplications({ status });
  return store.listApplications({ status });
}

export async function getApplication(id) {
  if (backend() === 'supabase') return sellersRepo.getApplication(id);
  return store.getApplication(id);
}

export async function findApplicationByUser(userId, status) {
  if (backend() === 'supabase') return sellersRepo.findApplicationByUser(userId, status);
  return store.findApplicationByUser(userId, status);
}

export async function updateApplication(id, patch) {
  if (backend() === 'supabase') return sellersRepo.updateApplication(id, patch);
  return store.updateApplication(id, patch);
}

/* -------------------------------------------------------------- sellers */

export async function createSeller(payload) {
  if (backend() === 'supabase') return sellersRepo.createSeller(payload);
  return store.createSeller(payload);
}

export async function getSellerById(id) {
  if (backend() === 'supabase') return sellersRepo.getSellerById(id);
  return store.getSellerById(id);
}

export async function getSellerByUserId(userId) {
  if (backend() === 'supabase') return sellersRepo.getSellerByUserId(userId);
  return store.getSellerByUserId(userId);
}

export async function listSellers() {
  if (backend() === 'supabase') return sellersRepo.listSellers();
  return store.listSellers();
}

export async function updateSeller(id, patch) {
  if (backend() === 'supabase') return sellersRepo.updateSeller(id, patch);
  return store.updateSeller(id, patch);
}

export async function sellerStats(sellerId) {
  if (backend() === 'supabase') return sellersRepo.sellerStats(sellerId);
  return store.sellerStats(sellerId);
}

/* ------------------------------------------------- profiles (role changes) */

export async function setProfileRole(userId, role) {
  if (backend() === 'supabase') return sellersRepo.setProfileRole(userId, role);
  return store.setProfileRole(userId, role);
}

export async function getProfileRow(userId) {
  if (backend() === 'supabase') return sellersRepo.getProfileRow(userId);
  return store.getProfileRow(userId);
}

export async function getUserEmail(userId) {
  if (backend() === 'supabase') return sellersRepo.getUserEmail(userId);
  return store.findUserById(userId)?.email || null;
}

/* ------------------------------------------------------------ notifications */

export async function createNotification(payload) {
  if (backend() === 'supabase') return sellersRepo.createNotification(payload);
  return store.createNotification(payload);
}

export async function listNotifications(userId, limit) {
  if (backend() === 'supabase') return sellersRepo.listNotifications(userId, limit);
  return store.listNotifications(userId, limit);
}

export async function unreadNotificationCount(userId) {
  if (backend() === 'supabase') return sellersRepo.unreadNotificationCount(userId);
  return store.unreadNotificationCount(userId);
}

export async function markNotificationRead(id, userId) {
  if (backend() === 'supabase') return sellersRepo.markNotificationRead(id, userId);
  return store.markNotificationRead(id, userId);
}

export async function markAllNotificationsRead(userId) {
  if (backend() === 'supabase') return sellersRepo.markAllNotificationsRead(userId);
  return store.markAllNotificationsRead(userId);
}

export async function listAdminUserIds() {
  if (backend() === 'supabase') return sellersRepo.listAdminUserIds();
  return store.listAdminUserIds();
}

/* ---------------------------------------------------------------- settings */

export async function getSettings() {
  if (backend() === 'supabase') return sellersRepo.getSettings();
  return store.getSettings();
}

export async function saveSettings(patch) {
  if (backend() === 'supabase') return sellersRepo.saveSettings(patch);
  return store.saveSettings(patch);
}

/* ------------------------------------------------------------ prod. reviews */

export async function listProductReviews(productId, opts) {
  if (backend() === 'supabase') return sellersRepo.listProductReviews(productId, opts);
  return store.listProductReviews(productId, opts);
}

export async function listSellerReviews(sellerId) {
  if (backend() === 'supabase') return sellersRepo.listSellerReviews(sellerId);
  return store.listSellerReviews(sellerId);
}

export async function createProductReview(payload) {
  if (backend() === 'supabase') return sellersRepo.createProductReview(payload);
  return store.createProductReview(payload);
}

/* ----------------------------------------------------------------- returns */

export async function createReturn(payload) {
  if (backend() === 'supabase') return sellersRepo.createReturn(payload);
  return store.createReturn(payload);
}

export async function listReturns(opts = {}) {
  if (backend() === 'supabase') return sellersRepo.listReturns(opts);
  return store.listReturns(opts);
}

export async function getReturn(id) {
  if (backend() === 'supabase') return sellersRepo.getReturn(id);
  return store.getReturn(id);
}

export async function updateReturn(id, patch) {
  if (backend() === 'supabase') return sellersRepo.updateReturn(id, patch);
  return store.updateReturn(id, patch);
}

/* ---------------------------------------------------------------- wishlist */

export async function listWishlist(userId) {
  if (backend() === 'supabase') return wishlistRepo.listWishlist(userId);
  return store.listWishlist(userId);
}

export async function addWishlistItem(userId, productId) {
  if (backend() === 'supabase') return wishlistRepo.addWishlistItem(userId, productId);
  return store.addWishlistItem(userId, productId);
}

export async function removeWishlistItem(userId, productId) {
  if (backend() === 'supabase') return wishlistRepo.removeWishlistItem(userId, productId);
  return store.removeWishlistItem(userId, productId);
}
