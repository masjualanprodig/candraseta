// BAITUNA - world-service.js
// Galeri Masjid Dunia. Dilihat siapa saja; ditambah/diubah/dihapus hanya oleh Super Admin (dijaga RLS, lihat dunia.sql).
import { request, db } from './supabase.js';

const COLS = 'id,name,country,city,description,latitude,longitude,photo_path,created_at';
const enc = encodeURIComponent;

export async function listWorldMosques() {
  const r = await request('/rest/v1/world_mosques?select=' + COLS + '&order=country.asc,name.asc&limit=200');
  if (!r.ok) throw Object.assign(new Error('gagal memuat'), { status: r.status, code: r.data && r.data.code });
  return Array.isArray(r.data) ? r.data : [];
}

const one = out => { if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak berubah'), { status: 403 }); return out[0]; };
const fields = f => ({ name: f.name, country: f.country, city: f.city, description: f.description, latitude: f.latitude, longitude: f.longitude });

// id dibuat di perangkat agar foto bisa diunggah ke folder "<id>/..." sebelum barisnya disimpan.
export const newWorldId = () => (crypto.randomUUID ? crypto.randomUUID() : null);

export async function createWorldMosque(id, f, photoPath) {
  return one(await db('world_mosques', { method: 'POST', prefer: 'return=representation', body: { id, ...fields(f), photo_path: photoPath || null } }));
}
export async function updateWorldMosque(id, f) {
  return one(await db('world_mosques', { method: 'PATCH', query: 'id=eq.' + enc(id), prefer: 'return=representation', body: fields(f) }));
}
export async function setWorldPhoto(id, path) {
  return one(await db('world_mosques', { method: 'PATCH', query: 'id=eq.' + enc(id), prefer: 'return=representation', body: { photo_path: path } }));
}
export async function deleteWorldMosque(id) {
  one(await db('world_mosques', { method: 'DELETE', query: 'id=eq.' + enc(id), prefer: 'return=representation' }));
}
