// BAITUNA - history-service.js
// Halaman Sejarah Islam. Dibaca siapa saja; ditulis hanya oleh Super Admin (dijaga RLS, lihat sejarah.sql).
import { request, db } from './supabase.js';

const COLS = 'id,title,period,summary,body,source,sort_order,photo_path,created_at';
const enc = encodeURIComponent;

export async function listHistory() {
  const r = await request('/rest/v1/history_entries?select=' + COLS + '&order=sort_order.asc,created_at.asc&limit=300');
  if (!r.ok) throw Object.assign(new Error('gagal memuat'), { status: r.status, code: r.data && r.data.code });
  return Array.isArray(r.data) ? r.data : [];
}
const one = out => { if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak berubah'), { status: 403 }); return out[0]; };
const fields = f => ({ title: f.title, period: f.period, summary: f.summary, body: f.body, source: f.source, sort_order: f.sort_order });

export async function createHistory(id, f, photoPath) {
  return one(await db('history_entries', { method: 'POST', prefer: 'return=representation', body: { id, ...fields(f), photo_path: photoPath || null } }));
}
export async function updateHistory(id, f) {
  return one(await db('history_entries', { method: 'PATCH', query: 'id=eq.' + enc(id), prefer: 'return=representation', body: fields(f) }));
}
export async function setHistoryPhoto(id, path) {
  return one(await db('history_entries', { method: 'PATCH', query: 'id=eq.' + enc(id), prefer: 'return=representation', body: { photo_path: path } }));
}
export async function deleteHistory(id) {
  one(await db('history_entries', { method: 'DELETE', query: 'id=eq.' + enc(id), prefer: 'return=representation' }));
}
