import { getSupabaseAdmin } from '../lib/supabase.js';
import { throwIfError } from './errors.js';

/** Insert a new spatial-consultation booking. */
export async function createConsultation(payload) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('consultations')
    .insert({
      user_id: payload.userId || null,
      full_name: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      city: payload.city,
      room_type: payload.roomType || null,
      preferred_date: payload.preferredDate || null,
      notes: payload.notes || null
    })
    .select('id, status, created_at')
    .single();

  throwIfError({ error }, 'create consultation');

  return {
    id: data.id,
    ...payload,
    status: data.status,
    createdAt: data.created_at
  };
}

/** List consultations, newest first. */
export async function listConsultations({ limit = 100 } = {}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('consultations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  throwIfError({ error }, 'list consultations');
  return data || [];
}
