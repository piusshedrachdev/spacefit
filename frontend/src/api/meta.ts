import { request } from '@/lib/api';
import type { StoreConfig, StoreSettings } from '@/types/api';

/** Store-wide config + the settings admins edit (policies/discounts). */

export function getConfig(): Promise<StoreConfig> {
  return request<StoreConfig>('/api/meta/config');
}

export function getSettings(): Promise<StoreSettings> {
  return request<StoreSettings>('/api/meta/settings');
}

export function saveSettings(patch: Partial<StoreSettings>): Promise<StoreSettings> {
  return request<StoreSettings>('/api/meta/settings', { method: 'PUT', body: patch });
}
