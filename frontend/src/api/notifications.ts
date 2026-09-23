import { qs, request } from '@/lib/api';
import type { NotificationsPage } from '@/types/api';

export function getNotifications(limit?: number): Promise<NotificationsPage> {
  return request<NotificationsPage>(`/api/notifications${qs(limit ? { limit } : null)}`);
}

export function markNotificationRead(id: string): Promise<{ updated: number }> {
  return request<{ updated: number }>(
    `/api/notifications/${encodeURIComponent(id)}/read`,
    { method: 'PATCH' }
  );
}

export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return request<{ updated: number }>('/api/notifications/read-all', { method: 'POST' });
}
