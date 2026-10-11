// BAITUNA - doa-service.js
// Kumpulan Doa Shahih. Dibaca siapa saja; ditulis hanya oleh Super Admin (dijaga RLS, lihat doa.sql).
// Teks doa TIDAK dibuat oleh aplikasi: diisi Super Admin dengan sumber, derajat, dan penilai derajatnya.
// Ayat Al-Qur'an hanya disimpan sebagai rujukan; teksnya diambil dari layanan Al-Qur'an.
import { request, db } from './supabase.js';

export const CATS = { harian: 'Harian', tidur: 'Tidur & Bangun', makan: 'Makan & Minum', masjid: 'Masjid & Salat', bersuci: 'Bersuci & Toilet', pakaian: 'Pakaian & Rumah', perjalanan: 'Perjalanan', sakit: 'Sakit & Musibah', ampunan: 'Ampunan & Taubat', keluarga: 'Keluarga', lainnya: 'Lainnya' };
export const GRADES = { shahih: 'Shahih', hasan: 'Hasan' };
export const KINDS = { teks: 'Doa dari hadits (teks)', ayat: 'Ayat Al-Qur’an' };

const COLS = 'id,category,kind,title,arabic,latin,body,source,grade,grading,note,surah,ayah_from,ayah_to,sort_order,created_at';
const enc = encodeURIComponent;

export async function listDuas() {
  const r = await request('/rest/v1/duas?select=' + COLS + '&order=sort_order.asc,created_at.asc&limit=1000');
  if (!r.ok) throw Object.assign(new Error('gagal memuat'), { status: r.status, code: r.data && r.data.code });
  return Array.isArray(r.data) ? r.data : [];
}
const one = out => { if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak berubah'), { status: 403 }); return out[0]; };
const fieldsOf = (kind, f) => {
  const common = { category: f.category, title: f.title || null, note: f.note || null, sort_order: f.sort_order };
  return kind === 'ayat' ? { ...common, source: f.source || null, surah: f.surah, ayah_from: f.ayah_from, ayah_to: f.ayah_to }
    : { ...common, arabic: f.arabic, latin: f.latin || null, body: f.body, source: f.source, grade: f.grade, grading: f.grading };
};
export async function createDua(kind, f) {
  return one(await db('duas', { method: 'POST', prefer: 'return=representation', body: { kind, ...fieldsOf(kind, f) } }));
}
export async function updateDua(id, kind, f) {
  return one(await db('duas', { method: 'PATCH', query: 'id=eq.' + enc(id), prefer: 'return=representation', body: fieldsOf(kind, f) }));
}
export async function deleteDua(id) {
  one(await db('duas', { method: 'DELETE', query: 'id=eq.' + enc(id), prefer: 'return=representation' }));
}

/* ===== Murni (dites terpisah) ===== */
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
// Pencarian: setiap kata harus ada di judul, Latin, terjemahan, sumber, catatan, atau teks Arab.
export function matches(it, q) {
  const words = norm(q).split(' ').filter(Boolean);
  if (!words.length) return true;
  const hay = norm([it.title, it.latin, it.body, it.source, it.note, it.arabic].filter(Boolean).join(' '));
  return words.every(w => hay.includes(w));
}
export function copyText(it) {
  return [it.title, it.arabic, it.latin, it.body, it.source ? 'Sumber: ' + it.source : '', it.grade ? 'Derajat: ' + GRADES[it.grade] + (it.grading ? ' (' + it.grading + ')' : '') : '', 'BAITUNA']
    .filter(Boolean).join('\n\n');
}
const FKEY = 'baituna.doa.fav.v1';
export function loadFavs() {
  try {
    const a = JSON.parse(localStorage.getItem(FKEY) || '[]');
    return Array.isArray(a) ? a.filter(x => typeof x === 'string' && x.length <= 64).slice(0, 2000) : [];
  } catch (e) { return []; }
}
export function saveFavs(ids) { try { localStorage.setItem(FKEY, JSON.stringify(ids.slice(0, 2000))); } catch (e) {} }
export const toggleFav = (ids, id) => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
