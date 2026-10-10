// BAITUNA - mosque-service.js
// Komunikasi data dengan backend untuk masjid dan keanggotaan.
// (Nanti dipindah ke js/services/ saat struktur folder dipulihkan.)
import { db } from './supabase.js';

const enc = encodeURIComponent;

export async function fetchIsSuperAdmin(userId) {
  const rows = await db('platform_admins', { query: 'select=user_id&user_id=eq.' + enc(userId) });
  return Array.isArray(rows) && rows.length > 0;
}

export async function fetchMemberships(userId) {
  const rows = await db('mosque_members', { query: 'select=role,mosques(id,name,status)&status=eq.active&user_id=eq.' + enc(userId) });
  return rows || [];
}

export async function listMosques() {
  const rows = await db('mosques', { query: 'select=id,name,city,province,status,status_reason,created_at&order=created_at.desc' });
  return Array.isArray(rows) ? rows : [];
}

// Masjid baru selalu berstatus pending. Database juga menolak status lain (RLS).
export async function createMosque(fields) {
  await db('mosques', { method: 'POST', prefer: 'return=minimal', body: { ...fields, status: 'pending' } });
}

// RLS bisa membuat perubahan "berhasil" tanpa mengubah baris; karena itu hasilnya diperiksa.
export async function updateMosqueStatus(id, status, reason) {
  const out = await db('mosques', {
    method: 'PATCH', query: 'id=eq.' + enc(id), prefer: 'return=representation',
    body: { status, status_reason: reason || null }
  });
  if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak berubah'), { status: 403 });
}
