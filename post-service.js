// BAITUNA - post-service.js
// Agenda & pengumuman masjid. Hak akses dijaga RLS di database (agenda.sql).
import { request, db } from './supabase.js';

const PUB = 'id,mosque_id,kind,topic,title,body,location,starts_at,ends_at,status,published_at,created_at';
const enc = encodeURIComponent;

// PUBLIK (tanpa login): hanya yang terbit dari masjid aktif.
export async function listPublicPosts(mosqueId) {
  const r = await request('/rest/v1/mosque_posts?select=' + PUB + '&mosque_id=eq.' + enc(mosqueId) + '&status=eq.published&order=created_at.desc&limit=100');
  if (!r.ok) throw Object.assign(new Error('gagal memuat'), { status: r.status });
  return Array.isArray(r.data) ? r.data : [];
}

// PENGELOLA: semua, termasuk draf.
export async function listManagedPosts(mosqueId) {
  const rows = await db('mosque_posts', { query: 'select=' + PUB + '&mosque_id=eq.' + enc(mosqueId) + '&order=created_at.desc&limit=200' });
  return Array.isArray(rows) ? rows : [];
}

const one = out => { if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak berubah'), { status: 403 }); return out[0]; };
const fields = f => ({ kind: f.kind, topic: f.topic || 'umum', title: f.title, body: f.body, location: f.location, starts_at: f.starts_at, ends_at: f.ends_at, status: f.status });

export async function createPost(mosqueId, f) {
  return one(await db('mosque_posts', { method: 'POST', prefer: 'return=representation', body: { mosque_id: mosqueId, ...fields(f) } }));
}
export async function updatePost(id, f) {
  return one(await db('mosque_posts', { method: 'PATCH', query: 'id=eq.' + enc(id), prefer: 'return=representation', body: fields(f) }));
}
export async function setPostStatus(id, status) {
  return one(await db('mosque_posts', { method: 'PATCH', query: 'id=eq.' + enc(id), prefer: 'return=representation', body: { status } }));
}
export async function deletePost(id) {
  one(await db('mosque_posts', { method: 'DELETE', query: 'id=eq.' + enc(id), prefer: 'return=representation' }));
}
