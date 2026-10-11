// BAITUNA - articles-service.js
// Berita & Artikel Islam. Dibaca siapa saja (hanya yang terbit); ditulis hanya oleh Super Admin (dijaga RLS, lihat berita.sql).
import { request, db } from './supabase.js';

export const CATS = [
  { key: 'khazanah', label: 'Khazanah Islam' },
  { key: 'tips', label: 'Tips Islami' },
  { key: 'artikel', label: 'Artikel' }
];
export const catLabel = k => (CATS.find(c => c.key === k) || {}).label || 'Artikel';

const LIST_COLS = 'id,title,category,summary,source_name,cover_path,status,published_at,created_at';
const FULL_COLS = LIST_COLS + ',body,source_url';
export const PAGE = 12;
const enc = encodeURIComponent;
const fail = r => Object.assign(new Error('gagal memuat'), { status: r.status, code: r.data && r.data.code });

// Daftar publik: hanya yang terbit (Super Admin yang login pun tetap hanya melihat yang terbit di sini).
export async function listArticles({ category, offset = 0 } = {}) {
  const cat = CATS.some(c => c.key === category) ? '&category=eq.' + enc(category) : '';
  const r = await request('/rest/v1/articles?select=' + LIST_COLS + '&status=eq.published' + cat +
    '&order=published_at.desc&limit=' + (PAGE + 1) + '&offset=' + Number(offset));
  if (!r.ok) throw fail(r);
  const rows = Array.isArray(r.data) ? r.data : [];
  return { items: rows.slice(0, PAGE), hasMore: rows.length > PAGE };
}

export async function getArticle(id) {
  const r = await request('/rest/v1/articles?select=' + FULL_COLS + '&status=eq.published&id=eq.' + enc(id) + '&limit=1');
  if (!r.ok) throw fail(r);
  return Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
}

// Pengelola (Super Admin): semua status, tanpa isi artikel agar ringan.
export async function listManagedArticles() {
  const out = await db('articles', { query: 'select=' + LIST_COLS + '&order=created_at.desc&limit=300' });
  return Array.isArray(out) ? out : [];
}
export async function getManagedArticle(id) {
  const out = await db('articles', { query: 'select=' + FULL_COLS + '&id=eq.' + enc(id) + '&limit=1' });
  if (!Array.isArray(out) || !out[0]) throw Object.assign(new Error('tidak ada'), { status: 404 });
  return out[0];
}

const one = out => { if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak berubah'), { status: 403 }); return out[0]; };
const fields = f => ({ title: f.title, category: f.category, summary: f.summary, body: f.body, source_name: f.source_name, source_url: f.source_url, status: f.status });

export const newArticleId = () => (crypto.randomUUID ? crypto.randomUUID() : null);

export async function createArticle(id, f, coverPath) {
  return one(await db('articles', { method: 'POST', prefer: 'return=representation', body: { id, ...fields(f), cover_path: coverPath || null } }));
}
export async function updateArticle(id, f) {
  return one(await db('articles', { method: 'PATCH', query: 'id=eq.' + enc(id), prefer: 'return=representation', body: fields(f) }));
}
export async function setArticleCover(id, path) {
  return one(await db('articles', { method: 'PATCH', query: 'id=eq.' + enc(id), prefer: 'return=representation', body: { cover_path: path } }));
}
export async function setArticleStatus(id, status) {
  return one(await db('articles', { method: 'PATCH', query: 'id=eq.' + enc(id), prefer: 'return=representation', body: { status } }));
}
export async function deleteArticle(id) {
  one(await db('articles', { method: 'DELETE', query: 'id=eq.' + enc(id), prefer: 'return=representation' }));
}
