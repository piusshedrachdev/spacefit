import { qs, request } from '@/lib/api';
import type {
  CategoryCount,
  Product,
  ProductQuery,
  ProductReview,
  ProductWritePayload
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

/** Convert a product write payload to the backend's multipart contract. */
function productFormData(payload: ProductWritePayload): FormData {
  const form = new FormData();

  for (const [key, value] of Object.entries(payload)) {
    if (key === 'images' || value === undefined || value === null) continue;
    if (typeof value === 'object') {
      form.append(key, JSON.stringify(value));
    } else {
      form.append(key, String(value));
    }
  }

  for (const file of payload.images ?? []) {
    form.append('images', file, file.name);
  }

  return form;
}

/** Seller / admin product writes. Image files are uploaded, not URLs. */
export function createProduct(payload: ProductWritePayload): Promise<Product> {
  return request<Product>('/api/products', {
    method: 'POST',
    body: productFormData(payload)
  });
}

export function updateProduct(
  id: string,
  patch: ProductWritePayload
): Promise<Product> {
  return request<Product>(`/api/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: productFormData(patch)
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
