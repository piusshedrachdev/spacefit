import { request } from '@/lib/api';

/** Marketing form endpoints (newsletter + consultation booking). */

export function subscribe(email: string): Promise<{ subscribed: boolean }> {
  return request<{ subscribed: boolean }>('/api/newsletter', {
    method: 'POST',
    body: { email }
  });
}

export interface ConsultationPayload {
  fullName: string;
  email: string;
  phone?: string;
  /** Legacy booking prompt collected the visitor's city too. */
  city?: string;
  notes?: string;
}

export function bookConsultation(payload: ConsultationPayload): Promise<{ booked: boolean }> {
  return request<{ booked: boolean }>('/api/consultations', {
    method: 'POST',
    body: payload
  });
}
