// BAITUNA - dzikir-service.js
// Dzikir Pagi & Petang. Dibaca siapa saja; ditulis hanya oleh Super Admin (dijaga RLS, lihat dzikir.sql).
// Ayat Al-Qur'an HANYA disimpan sebagai rujukan (surat:ayat); teksnya diambil dari layanan Al-Qur'an (quran-service.js).
import { request, db } from './supabase.js';

export const SESSIONS = { pagi: 'Dzikir Pagi', petang: 'Dzikir Petang', keduanya: 'Pagi & Petang' };
export const KINDS = { teks: 'Doa / dzikir (teks)', ayat: 'Ayat Al-Qur’an' };

const COLS = 'id,session,kind,title,arabic,latin,body,source,note,surah,ayah_from,ayah_to,target_count,sort_order,created_at';
const enc = encodeURIComponent;

export async function listDhikr() {
  const r = await request('/rest/v1/dhikr_items?select=' + COLS + '&order=sort_order.asc,created_at.asc&limit=500');
  if (!r.ok) throw Object.assign(new Error('gagal memuat'), { status: r.status, code: r.data && r.data.code });
  return Array.isArray(r.data) ? r.data : [];
}
const one = out => { if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak berubah'), { status: 403 }); return out[0]; };
// Hanya kolom yang relevan untuk jenisnya yang dikirim (kolom lain harus kosong sesuai aturan database).
const fieldsOf = (kind, f) => {
  const common = { session: f.session, title: f.title || null, source: f.source || null, note: f.note || null, target_count: f.target_count, sort_order: f.sort_order };
  return kind === 'ayat' ? { ...common, surah: f.surah, ayah_from: f.ayah_from, ayah_to: f.ayah_to }
    : { ...common, arabic: f.arabic, latin: f.latin || null, body: f.body };
};
export async function createDhikr(kind, f) {
  return one(await db('dhikr_items', { method: 'POST', prefer: 'return=representation', body: { kind, ...fieldsOf(kind, f) } }));
}
export async function updateDhikr(id, kind, f) {
  return one(await db('dhikr_items', { method: 'PATCH', query: 'id=eq.' + enc(id), prefer: 'return=representation', body: fieldsOf(kind, f) }));
}
export async function deleteDhikr(id) {
  one(await db('dhikr_items', { method: 'DELETE', query: 'id=eq.' + enc(id), prefer: 'return=representation' }));
}

/* ===== Penghitung (murni, tanpa tampilan; dites terpisah) ===== */
const pad = n => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
// Ketukan berikutnya: bertambah 1, tidak melewati target. target 0 = tanpa batas (hanya dipakai tasbih bebas).
export const bump = (cur, target) => { const c = Math.max(0, Math.floor(Number(cur) || 0)); return target > 0 ? Math.min(c + 1, target) : c + 1; };
export const undo = cur => Math.max(0, Math.floor(Number(cur) || 0) - 1);
export const clampCount = (v, target) => { const n = Math.max(0, Math.floor(Number(v) || 0)); return target > 0 ? Math.min(n, target) : n; };

const PKEY = 'baituna.dzikir.v1', TKEY = 'baituna.tasbih.v1', HKEY = 'baituna.haptic.v1', SKEY = 'baituna.sound.v1';
// Hitungan dzikir pagi/petang disimpan di perangkat dan otomatis kosong saat ganti hari (jam perangkat).
export function loadProgress(now = new Date()) {
  try {
    const o = JSON.parse(localStorage.getItem(PKEY) || 'null');
    if (o && o.date === dayKey(now) && o.c && typeof o.c === 'object' && !Array.isArray(o.c)) return o;
  } catch (e) {}
  return { date: dayKey(now), c: {} };
}
export function saveProgress(p) { try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch (e) {} }
export function loadTasbih() {
  try {
    const o = JSON.parse(localStorage.getItem(TKEY) || 'null');
    if (o) { const t = Math.floor(Number(o.target)); return { count: clampCount(o.count, 0), target: Number.isFinite(t) && t >= 0 && t <= 9999 ? t : 33 }; }
  } catch (e) {}
  return { count: 0, target: 33 };
}
export function saveTasbih(s) { try { localStorage.setItem(TKEY, JSON.stringify(s)); } catch (e) {} }
export function loadHaptic() { try { return localStorage.getItem(HKEY) !== '0'; } catch (e) { return true; } }
export function saveHaptic(on) { try { localStorage.setItem(HKEY, on ? '1' : '0'); } catch (e) {} }
// Bunyi: lonceng saat target tercapai (bawaan nyala), detak tiap ketukan (bawaan mati).
export function loadSound() {
  try { const o = JSON.parse(localStorage.getItem(SKEY) || 'null'); if (o && typeof o === 'object') return { done: o.done !== false, tap: o.tap === true }; } catch (e) {}
  return { done: true, tap: false };
}
export function saveSound(v) { try { localStorage.setItem(SKEY, JSON.stringify({ done: !!v.done, tap: !!v.tap })); } catch (e) {} }
