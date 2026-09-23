import { request } from '@/lib/api';
import { clearCartId, getCartId, setCartId } from '@/lib/session';
import { getProducts } from '@/api/products';
import type { Cart } from '@/types/api';

/**
 * Cart helpers — the server cart id lives in localStorage
 * (`spacefitCartId`), exactly like the legacy client.
 */

export function createCart(): Promise<Cart> {
  return request<Cart>('/api/cart', { method: 'POST' }).then((cart) => {
    setCartId(cart.id);
    return cart;
  });
}

export function getCart(id: string): Promise<Cart> {
  return request<Cart>(`/api/cart/${encodeURIComponent(id)}`);
}

/** Return the stored cart, creating (or re-creating) it as needed. */
export async function ensureCart(): Promise<Cart> {
  const id = getCartId();
  if (!id) return createCart();
  try {
    return await getCart(id);
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      clearCartId();
      return createCart();
    }
    throw err;
  }
}

/**
 * Accepts a product id/slug or a full title (legacy convenience: a value
 * containing whitespace is resolved via a search).
 */
export async function resolveProductId(productIdOrTitle: string): Promise<string> {
  if (!productIdOrTitle) throw new Error('Missing product id');
  if (!/\s/.test(productIdOrTitle)) return productIdOrTitle;
  const items = await getProducts({ search: productIdOrTitle });
  const match = items?.[0];
  if (!match) throw new Error(`Product not found: ${productIdOrTitle}`);
  return match.id;
}

export async function addToCart(
  productIdOrTitle: string,
  quantity = 1,
  size?: string,
  color?: string
): Promise<Cart> {
  const cart = await ensureCart();
  const id = await resolveProductId(productIdOrTitle);
  return request<Cart>(`/api/cart/${encodeURIComponent(cart.id)}/items`, {
    method: 'POST',
    body: { productId: id, quantity: quantity || 1, size, color }
  });
}

export function updateCartItem(
  cartId: string,
  itemKey: string,
  quantity: number
): Promise<Cart> {
  return request<Cart>(
    `/api/cart/${encodeURIComponent(cartId)}/items/${encodeURIComponent(itemKey)}`,
    { method: 'PATCH', body: { quantity } }
  );
}

export function removeCartItem(cartId: string, itemKey: string): Promise<Cart> {
  return request<Cart>(
    `/api/cart/${encodeURIComponent(cartId)}/items/${encodeURIComponent(itemKey)}`,
    { method: 'DELETE' }
  );
}

export function validateCart(cartId: string): Promise<Cart> {
  return request<Cart>(`/api/cart/${encodeURIComponent(cartId)}/validate`, {
    method: 'POST'
  });
}
