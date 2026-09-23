import { qs, request } from '@/lib/api';
import type {
  CategoryCount,
  Product,
  ProductQuery,
  ProductReview
} from '@/types/api';

/** Catalogue reads. */
export function getProducts(params?: ProductQuery): Promise<Product[]> {
  return request<Product[]>(`/api/products${qs(params)}`);
}

export function getFeaturedProducts(): Promise<Product[]> {
  return request<Product[]>('/api/products/featured');
}

export function getProduct(id: string): Promise<Product> {
  return request<Product>(`/api/products/${encodeURIComponent(id)}`);
}

export function getRelatedProducts(id: string, limit?: number): Promise<Product[]> {
  return request<Product[]>(
    `/api/products/${encodeURIComponent(id)}/related${qs(limit ? { limit } : null)}`
  );
}

export function getCategories(): Promise<CategoryCount[]> {
  return request<CategoryCount[]>('/api/products/categories');
}

/** Seller / admin product writes. */
export function createProduct(payload: Partial<Product>): Promise<Product> {
  return request<Product>('/api/products', { method: 'POST', body: payload });
}

export function updateProduct(
  id: string,
  patch: Partial<Product>
): Promise<Product> {
  return request<Product>(`/api/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch
  });
}

export function deleteProduct(id: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/products/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

/** Reviews. */
export function getProductReviews(productId: string): Promise<ProductReview[]> {
  return request<ProductReview[]>(`/api/products/${encodeURIComponent(productId)}/reviews`);
}

export function createProductReview(
  productId: string,
  payload: { rating: number; comment?: string | null }
): Promise<ProductReview> {
  return request<ProductReview>(`/api/products/${encodeURIComponent(productId)}/reviews`, {
    method: 'POST',
    body: payload
  });
}
