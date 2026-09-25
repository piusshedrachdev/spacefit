import { qs, request } from '@/lib/api';
import type { Order, PlaceOrderPayload } from '@/types/api';

export function placeOrder(payload: PlaceOrderPayload): Promise<Order> {
  return request<Order>('/api/orders', { method: 'POST', body: payload });
}

export function getMyOrders(): Promise<Order[]> {
  return request<Order[]>('/api/orders/mine');
}

export function getOrder(id: string): Promise<Order> {
  return request<Order>(`/api/orders/${encodeURIComponent(id)}`);
}

export function getOrders(userId?: string): Promise<Order[]> {
  return request<Order[]>(`/api/orders${qs(userId ? { userId } : null)}`);
}
