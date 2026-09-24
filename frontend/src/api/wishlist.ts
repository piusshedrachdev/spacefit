import { request } from '@/lib/api';
import type { Product } from '@/types/api';

/** The signed-in caller's saved products, newest first. */
export function getWishlist(): Promise<Product[]> {
  return request<Product[]>('/api/wishlist');
}

/** Save a product (idempotent). Resolves to the saved product. */
export function addWishlistItem(productId: string): Promise<Product> {
  return request<Product>(`/api/wishlist/${encodeURIComponent(productId)}`, {
    method: 'POST'
  });
}

/** Remove a saved product (idempotent). Resolves to `{ productId, removed }`. */
export function removeWishlistItem(
  productId: string
): Promise<{ productId: string; removed: boolean }> {
  return request<{ productId: string; removed: boolean }>(
    `/api/wishlist/${encodeURIComponent(productId)}`,
    { method: 'DELETE' }
  );
}
