import { qs, request } from '@/lib/api';
import type {
  ApplicationStatus,
  Seller,
  SellerApplication,
  SellerApplicationPayload,
  SellerContext,
  SellerDashboard,
  SellerStatus
} from '@/types/api';

/** Seller ecosystem — applications, own context, and admin review endpoints. */

export function submitSellerApplication(
  payload: SellerApplicationPayload
): Promise<SellerApplication> {
  return request<SellerApplication>('/api/sellers/applications', {
    method: 'POST',
    body: payload
  });
}

export function getMySellerContext(): Promise<SellerContext> {
  return request<SellerContext>('/api/sellers/me');
}

export function updateMySellerProfile(patch: Partial<Seller>): Promise<Seller> {
  return request<Seller>('/api/sellers/me', { method: 'PATCH', body: patch });
}

export function getSellerDashboard(): Promise<SellerDashboard> {
  return request<SellerDashboard>('/api/sellers/me/dashboard');
}

/** Admin review queue. */
export function getApplications(status?: ApplicationStatus): Promise<SellerApplication[]> {
  return request<SellerApplication[]>(
    `/api/sellers/applications${qs(status ? { status } : null)}`
  );
}

export function getApplication(id: string): Promise<SellerApplication> {
  return request<SellerApplication>(`/api/sellers/applications/${encodeURIComponent(id)}`);
}

/** approve | reject — returns the updated application (plus seller on approve). */
export function reviewApplication(
  id: string,
  decision: 'approve' | 'reject',
  reviewNotes?: string | null
): Promise<{ application: SellerApplication; seller?: Seller }> {
  return request<{ application: SellerApplication; seller?: Seller }>(
    `/api/sellers/applications/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: { decision, reviewNotes } }
  );
}

export function getSellers(): Promise<Seller[]> {
  return request<Seller[]>('/api/sellers');
}

export function setSellerStatus(
  id: string,
  status: SellerStatus,
  reason?: string
): Promise<Seller> {
  return request<Seller>(`/api/sellers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { status, reason }
  });
}
