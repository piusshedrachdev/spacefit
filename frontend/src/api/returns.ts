import { request } from '@/lib/api';
import type { ReturnRequest, ReturnStatus } from '@/types/api';

export function getReturns(): Promise<ReturnRequest[]> {
  return request<ReturnRequest[]>('/api/returns');
}

export function updateReturnStatus(
  id: string,
  status: ReturnStatus,
  resolutionNotes?: string | null
): Promise<ReturnRequest> {
  return request<ReturnRequest>(`/api/returns/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { status, resolutionNotes }
  });
}
