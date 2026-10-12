// BAITUNA - page-service.js
// Halaman teks yang bisa diubah Super Admin (saat ini: Privasi & Disclaimer). Dibaca siapa saja; ditulis hanya Super Admin (RLS, lihat halaman.sql).
// Bila tabel/baris belum ada atau gagal dimuat, dipakai teks bawaan sementara (page-defaults.js).
import { request, db } from './supabase.js';
import { DEFAULT_PAGES } from './page-defaults.js';

export const MAX_BODY = 20000;
const enc = encodeURIComponent;

// Mengembalikan { title, body, updated_at|null, custom: bool, error?: 'sql'|'net' }
export async function getPage(slug) {
  const def = DEFAULT_PAGES[slug]; if (!def) return null;
  try {
    const r = await request('/rest/v1/site_pages?select=slug,title,body,updated_at&slug=eq.' + enc(slug) + '&limit=1');
    if (!r.ok) return { ...def, updated_at: null, custom: false, error: r.status === 404 || (r.data && (r.data.code === '42P01' || r.data.code === 'PGRST205')) ? 'sql' : 'net' };
    const row = Array.isArray(r.data) ? r.data[0] : null;
    return row && row.title && row.body ? { title: row.title, body: row.body, updated_at: row.updated_at || null, custom: true } : { ...def, updated_at: null, custom: false };
  } catch (e) { return { ...def, updated_at: null, custom: false, error: 'net' }; }
}
export async function savePage(slug, f) {
  const out = await db('site_pages', { method: 'POST', query: 'on_conflict=slug', prefer: 'resolution=merge-duplicates,return=representation', body: { slug, title: f.title, body: f.body } });
  if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak tersimpan'), { status: 403 });
  return out[0];
}
export async function resetPage(slug) {
  const out = await db('site_pages', { method: 'DELETE', query: 'slug=eq.' + enc(slug), prefer: 'return=representation' });
  if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak terhapus'), { status: 403 });
}

// Teks sederhana -> blok: { t:'h'|'p'|'ul', text|items }. "## " = judul, "- " = butir, lainnya paragraf.
export function parseDoc(body) {
  const blocks = []; let ul = null, p = [];
  const flushP = () => { if (p.length) { blocks.push({ t: 'p', text: p.join('\n') }); p = []; } };
  const flushU = () => { if (ul) { blocks.push({ t: 'ul', items: ul }); ul = null; } };
  for (const raw of String(body || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    if (/^##\s+\S/.test(line)) { flushP(); flushU(); blocks.push({ t: 'h', text: line.replace(/^##\s+/, '').trim() }); }
    else if (/^-\s+\S/.test(line)) { flushP(); (ul = ul || []).push(line.replace(/^-\s+/, '').trim()); }
    else if (!line.trim()) { flushP(); flushU(); }
    else { flushU(); p.push(line.trim()); }
  }
  flushP(); flushU(); return blocks;
}
