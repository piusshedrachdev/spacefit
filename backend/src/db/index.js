import { config } from '../config.js';
import { isSupabaseConfigured } from '../lib/supabase.js';
import { store } from '../store.js';
import * as productsRepo from './products.js';
import * as cartsRepo from './carts.js';
import * as ordersRepo from './orders.js';
import * as consultationsRepo from './consultations.js';
import * as newsletterRepo from './newsletter.js';

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
  return store.listOrders();
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
