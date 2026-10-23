// BAITUNA - sunnah-service.js
// Amalan Sunnah Harian. Dibaca siapa saja; ditulis hanya oleh Super Admin (dijaga RLS, lihat sunnah.sql).
// Isi amalan TIDAK dibuat oleh aplikasi: Super Admin mengisinya lengkap dengan sumber, derajat, dan penilai derajat.
import { request, db } from './supabase.js';
import { dayKey } from './dzikir-service.js';

// Urutan = urutan tampil. Hanya pengelompokan waktu; aplikasi tidak menetapkan batas waktu ibadah.
export const SLOTS = { subuh: 'Subuh', pagi: 'Pagi', dhuha: 'Dhuha', siang: 'Siang', sore: 'Sore', malam: 'Malam', tidur: 'Sebelum tidur', harian: 'Sepanjang hari' };
export const GRADES = { shahih: 'Shahih', hasan: 'Hasan' };

const COLS = 'id,time_slot,title,body,arabic,latin,source,grade,grading,note,sort_order,created_at';
const COLS_LINK = COLS + ',reminder_key'; // kolom v54 (sunnah_link.sql); bila belum dijalankan, dibaca tanpa kolom ini
const enc = encodeURIComponent;

export async function listSunnah() {
  const q = c => request('/rest/v1/sunnah_items?select=' + c + '&order=sort_order.asc,created_at.asc&limit=1000');
  let r = await q(COLS_LINK);
  if (!r.ok && r.status === 400) r = await q(COLS);
  if (!r.ok) throw Object.assign(new Error('gagal memuat'), { status: r.status, code: r.data && r.data.code });
  return Array.isArray(r.data) ? r.data : [];
}
const one = out => { if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak berubah'), { status: 403 }); return out[0]; };
// reminder_key hanya dikirim bila diisi/diubah (f.reminder_key undefined = jangan sentuh kolom, agar aman sebelum sunnah_link.sql dijalankan).
const fieldsOf = f => { const o = { time_slot: f.time_slot, title: f.title, body: f.body, arabic: f.arabic || null, latin: f.latin || null, source: f.source, grade: f.grade, grading: f.grading, note: f.note || null, sort_order: f.sort_order }; if (f.reminder_key !== undefined) o.reminder_key = f.reminder_key || null; return o; };
export const createSunnah = async f => one(await db('sunnah_items', { method: 'POST', prefer: 'return=representation', body: fieldsOf(f) }));
export const updateSunnah = async (id, f) => one(await db('sunnah_items', { method: 'PATCH', query: 'id=eq.' + enc(id), prefer: 'return=representation', body: fieldsOf(f) }));
export const deleteSunnah = async id => { one(await db('sunnah_items', { method: 'DELETE', query: 'id=eq.' + enc(id), prefer: 'return=representation' })); };

/* ===== Murni (dites terpisah) ===== */
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
export function matches(it, q) {
  const words = norm(q).split(' ').filter(Boolean);
  if (!words.length) return true;
  const hay = norm([it.title, it.body, it.latin, it.source, it.note, it.arabic].filter(Boolean).join(' '));
  return words.every(w => hay.includes(w));
}
export function copyText(it) {
  return [it.title, it.body, it.arabic, it.latin, it.source ? 'Sumber: ' + it.source : '', 'Derajat: ' + (GRADES[it.grade] || '') + (it.grading ? ' (' + it.grading + ')' : ''), 'BAITUNA'].filter(Boolean).join('\n\n');
}

// Centang "sudah dikerjakan" hanya di perangkat ini dan kosong lagi tiap ganti hari (jam perangkat).
const PKEY = 'baituna.sunnah.v1';
export function loadDone(now = new Date()) {
  try {
    const o = JSON.parse(localStorage.getItem(PKEY) || 'null');
    if (o && o.date === dayKey(now) && Array.isArray(o.ids)) return { date: o.date, ids: o.ids.filter(x => typeof x === 'string' && x.length <= 64).slice(0, 2000) };
  } catch (e) {}
  return { date: dayKey(now), ids: [] };
}
export function saveDone(d) { try { localStorage.setItem(PKEY, JSON.stringify(d)); } catch (e) {} }
export const toggleDone = (d, id) => ({ ...d, ids: d.ids.includes(id) ? d.ids.filter(x => x !== id) : [...d.ids, id] });

// Impor massal (Super Admin): per 100 baris. Berhenti pada kegagalan pertama; yang sudah tersimpan tetap ada.
export async function importSunnah(payloads, onProgress) {
  const res = { saved: 0, failedFrom: null, error: null };
  for (let i = 0; i < payloads.length; i += 100) {
    const part = payloads.slice(i, i + 100);
    try {
      const out = await db('sunnah_items', { method: 'POST', query: 'select=id', prefer: 'return=representation', body: part });
      if (!Array.isArray(out) || out.length !== part.length) throw Object.assign(new Error('jumlah tidak sesuai'), { status: 500 });
      res.saved += part.length;
    } catch (e) { res.failedFrom = i; res.error = e; break; }
    if (onProgress) onProgress(res.saved, payloads.length);
  }
  return res;
}
