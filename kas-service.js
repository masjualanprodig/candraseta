// BAITUNA - kas-service.js
// Kas Masjid (Tahap 4A): PENCATATAN saja; BAITUNA tidak memegang uang. Aturan sebenarnya dijaga server (kas.sql):
// hanya Bendahara yang mencatat, catatan tidak bisa diubah/dihapus (koreksi lewat catatan pembalik), bulan bisa ditutup.
import { request, db, storageUpload, storageBlobUrl } from './supabase.js';
import { prepareProductPhoto } from './photo.js';
import { rp } from './market-service.js';

export const BUCKET = 'cash-proofs';
export const KINDS = [['umum', 'Kas umum'], ['infak', 'Infak dan sedekah'], ['zakat', 'Zakat (dana terikat)'], ['kegiatan', 'Dana kegiatan'], ['lainnya', 'Lainnya']];
export const kindLabel = k => (KINDS.find(x => x[0] === k) || [0, 'Lainnya'])[1];
export const LIMIT = { amountMax: 1000000000000, descMax: 200, itemMax: 100, qtyMax: 100000, favMax: 30, partyMax: 100, reasonMin: 3, reasonMax: 150, nameMin: 2, nameMax: 60 };
const oneLine = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
const pad = n => String(n).padStart(2, '0');

export const money = n => { const v = Number(n) || 0; return (v < 0 ? '-' : '') + rp(Math.abs(v)); };

/* ===== Bulan (kunci 'YYYY-MM-01'; tanpa zona waktu agar tidak bergeser) ===== */
export const monthKey = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-01';
export const dayKey = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export function addMonths(key, n) {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(key || '')); if (!m) return null;
  const t = (Number(m[1]) * 12 + Number(m[2]) - 1) + n; return Math.floor(t / 12) + '-' + pad(t % 12 + 1) + '-01';
}
export const monthLabel = key => {
  const m = /^(\d{4})-(\d{2})/.exec(String(key || '')); if (!m) return '';
  return ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][Number(m[2]) - 1] + ' ' + m[1];
};
export const dayLabel = key => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(key || '')); return m ? Number(m[3]) + ' ' + monthLabel(key).split(' ')[0].slice(0, 3) + ' ' + m[1] : ''; };
export const nextDay = key => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || '')); if (!m) return null; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };

/* ===== Angka ===== */
// "Rp 1.250.000", "1250000", "1.250.000" -> angka bulat > 0. Selain itu null.
export function parseAmount(input) {
  const d = String(input == null ? '' : input).trim().toLowerCase().replace(/^rp\.?\s*/, '').replace(/[\s.]/g, '');
  if (!/^\d{1,13}$/.test(d)) return null;
  const n = Number(d); return n >= 1 && n <= LIMIT.amountMax ? n : null;
}
// Pengaruh pada saldo: masuk +, keluar -, dan baris koreksi berlawanan arah.
export const effect = e => (e.direction === 'masuk' ? 1 : -1) * Number(e.amount) * (e.reverses ? -1 : 1);

/* ===== Pemeriksaan isian (hasil: { ok } | { error, field }) ===== */
export function validateEntry(f) {
  const amount = parseAmount(f.amount), description = oneLine(f.description), party = oneLine(f.party), itemName = oneLine(f.itemName);
  const qtyRaw = String(f.qty == null ? '' : f.qty).trim();
  if (!f.accountId) return { error: 'Pilih akun kas.', field: 'account' };
  if (!f.categoryId) return { error: 'Pilih kategori.', field: 'category' };
  if (amount == null) return { error: 'Jumlah belum benar. Isi angka, mis. 150000.', field: 'amount' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date || '')) return { error: 'Isi tanggal.', field: 'date' };
  if (f.maxDate && f.date > f.maxDate) return { error: 'Tanggal tidak boleh di masa depan.', field: 'date' };
  if (f.minDate && f.date < f.minDate) return { error: 'Bulan itu sudah ditutup. Pilih tanggal setelah penutupan.', field: 'date' };
  if (itemName.length > LIMIT.itemMax) return { error: 'Nama barang atau keperluan maksimal ' + LIMIT.itemMax + ' huruf.', field: 'item' };
  let qty = null;
  if (qtyRaw !== '') { if (!/^\d{1,6}$/.test(qtyRaw) || Number(qtyRaw) < 1 || Number(qtyRaw) > LIMIT.qtyMax) return { error: 'Jumlah barang harus angka 1 sampai ' + LIMIT.qtyMax + ', atau kosongkan.', field: 'qty' }; qty = Number(qtyRaw); }
  if (description.length > LIMIT.descMax) return { error: 'Keterangan maksimal ' + LIMIT.descMax + ' huruf.', field: 'description' };
  if (party.length > LIMIT.partyMax) return { error: 'Nama donatur atau penerima maksimal ' + LIMIT.partyMax + ' huruf.', field: 'party' };
  return { ok: { accountId: f.accountId, categoryId: f.categoryId, amount, date: f.date, description: description || null, party: party || null, itemName: itemName || null, qty } };
}
export function validateAccount(f) {
  const name = oneLine(f.name);
  if (name.length < LIMIT.nameMin || name.length > LIMIT.nameMax) return { error: 'Nama akun ' + LIMIT.nameMin + ' sampai ' + LIMIT.nameMax + ' huruf.', field: 'name' };
  if (!KINDS.some(k => k[0] === f.kind)) return { error: 'Pilih jenis akun.', field: 'kind' };
  const raw = String(f.opening == null ? '' : f.opening).trim();
  let opening = 0;
  if (raw !== '' && raw !== '0') { opening = parseAmount(raw); if (opening == null) return { error: 'Saldo awal belum benar. Isi angka, atau kosongkan bila nol.', field: 'opening' }; }
  if (f.date && !/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return { error: 'Tanggal saldo awal belum benar.', field: 'date' };
  return { ok: { name, kind: f.kind, opening, date: f.date || null } };
}
export function validateReason(r) {
  const s = oneLine(r); return s.length < LIMIT.reasonMin || s.length > LIMIT.reasonMax ? null : s;
}

/* ===== CSV (aman dari injeksi rumus; pemisah titik koma, BOM agar Excel membaca UTF-8) ===== */
export function csvCell(v) {
  let s = String(v == null ? '' : v).replace(/\r?\n/g, ' ');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[;"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function buildCsv(entries, accounts, categories) {
  const acc = new Map(accounts.map(a => [a.id, a.name])), cat = new Map(categories.map(c => [c.id, c.name]));
  const head = ['Tanggal', 'Akun', 'Jenis catatan', 'Kategori', 'Pemasukan', 'Pengeluaran', 'Keterangan', 'Nama barang', 'Jumlah barang', 'Donatur/Penerima', 'Ada bukti'];
  const rows = [...entries].sort((a, b) => (a.entry_date + a.created_at < b.entry_date + b.created_at ? -1 : 1)).map(e => {
    const v = Number(e.amount) * (e.reverses ? -1 : 1);
    return [e.entry_date, acc.get(e.account_id) || '', e.reverses ? 'Koreksi' : 'Catatan', cat.get(e.category_id) || '', e.direction === 'masuk' ? v : '', e.direction === 'keluar' ? v : '', e.description, e.item_name || '', e.item_qty || '', e.counterparty || '', e.proof_path ? 'Ya' : 'Tidak'];
  });
  return '﻿' + [head, ...rows].map(r => r.map((c, i) => (i === 4 || i === 5) && c !== '' ? String(c) : csvCell(c)).join(';')).join('\r\n') + '\r\n';
}
export function downloadText(name, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ===== Server ===== */
const rpc = (name, body) => db('rpc/' + name, { method: 'POST', body: body || {} });
const pub = async (name, body) => {
  const r = await request('/rest/v1/rpc/' + name, { method: 'POST', body: body || {} });
  if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status, code: r.data && r.data.code });
  return r.data;
};
export const notReady = e => !!e && (e.status === 404 || e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === '42P01');

export async function loadBook(mosqueId, { setup } = {}) {
  if (setup) await rpc('kas_init', { p_mosque: mosqueId });
  const q = 'mosque_id=eq.' + encodeURIComponent(mosqueId);
  // Mode input dan favorit baru ada setelah kas_baru.sql; bila belum dijalankan, layar tetap tampil dengan nilai bawaan.
  const fatal = e => !!e && (e.status === 401 || e.status === 0);
  const [accounts, categories, closings, settings, favorites] = await Promise.all([
    db('cash_accounts', { query: 'select=id,name,kind,opening_balance,opening_date,active&' + q + '&order=created_at.asc' }),
    db('cash_categories', { query: 'select=id,direction,name,active&' + q + '&order=direction.asc,created_at.asc' }),
    db('cash_closings', { query: 'select=month,saldo_akhir,note,closed_at&' + q + '&order=month.desc' }),
    db('cash_settings', { query: 'select=public_summary,input_mode&' + q }).catch(e => { if (fatal(e)) throw e; return db('cash_settings', { query: 'select=public_summary&' + q }); }),
    db('cash_favorites', { query: 'select=id,direction,name,category_id,item_name,amount,note&' + q + '&order=created_at.desc' }).catch(e => { if (fatal(e)) throw e; return null; })
  ]);
  const s0 = (settings && settings[0]) || {};
  return { accounts: accounts || [], categories: categories || [], closings: closings || [], publicSummary: !!s0.public_summary, inputMode: s0.input_mode === 'cepat' ? 'cepat' : 'standar', favorites: favorites || [], hasNew: favorites !== null };
}
export const lastClosed = book => (book.closings.length ? String(book.closings[0].month).slice(0, 10) : null);
export const minEntryDate = book => { const m = lastClosed(book); return m ? addMonths(m, 1) : null; };

export async function listEntries(mosqueId, month) {
  const tail = '&mosque_id=eq.' + encodeURIComponent(mosqueId) + '&entry_date=gte.' + month + '&entry_date=lt.' + addMonths(month, 1) + '&order=entry_date.desc,created_at.desc&limit=2000';
  const base = 'id,account_id,category_id,direction,amount,entry_date,description,counterparty,proof_path,reverses,created_at';
  try { return (await db('cash_entries', { query: 'select=' + base + ',item_name,item_qty' + tail })) || []; }
  catch (e) { if (e && (e.status === 401 || e.status === 0)) throw e; return (await db('cash_entries', { query: 'select=' + base + tail })) || []; }
}
export const listReversed = async mosqueId => ((await db('cash_entries', { query: 'select=reverses&mosque_id=eq.' + encodeURIComponent(mosqueId) + '&reverses=not.is.null&limit=5000' })) || []).map(r => r.reverses);
export const report = (mosqueId, month, anonymous) => (anonymous ? pub : rpc)('kas_report', { p_mosque: mosqueId, p_month: month });
export const publicOn = async mosqueId => { try { return !!(await pub('kas_public_on', { p_mosque: mosqueId })); } catch (e) { return false; } };

const entryArgs = (v, proofPath) => ({ p_account: v.accountId, p_category: v.categoryId, p_amount: v.amount, p_date: v.date, p_desc: v.description || null, p_party: v.party || null, p_proof: proofPath || null, p_item: v.itemName || null, p_qty: v.qty || null });
export const addEntry = (mosqueId, v, proofPath) => rpc('kas_catat', { p_mosque: mosqueId, ...entryArgs(v, proofPath) });
// "Ubah": catatan lama dibatalkan lewat koreksi dan yang baru dicatat, dalam satu langkah di server.
export const replaceEntry = (entryId, v, proofPath) => rpc('kas_replace', { p_entry: entryId, ...entryArgs(v, proofPath) });
export const saveFavorite = (mosqueId, f) => rpc('kas_fav_save', { p_mosque: mosqueId, p_direction: f.direction, p_name: f.name, p_category: f.categoryId, p_item: f.itemName || null, p_amount: f.amount || null, p_note: f.note || null });
export const deleteFavorite = id => rpc('kas_fav_delete', { p_id: id });
export const resetKas = (mosqueId, confirm) => rpc('kas_reset', { p_mosque: mosqueId, p_confirm: confirm });
export const setMode = (mosqueId, mode) => rpc('kas_set_mode', { p_mosque: mosqueId, p_mode: mode });
export const reverseEntry = (id, reason) => rpc('kas_reverse', { p_entry: id, p_reason: reason });
export const closeMonth = (mosqueId, month, note) => rpc('kas_close_month', { p_mosque: mosqueId, p_month: month, p_note: note || null });
export const reopenMonth = (mosqueId, month, reason) => rpc('kas_reopen_month', { p_mosque: mosqueId, p_month: month, p_reason: reason });
export const setPublic = (mosqueId, on) => rpc('kas_set_public', { p_mosque: mosqueId, p_on: !!on });
export const saveAccount = (mosqueId, id, v, active) => rpc('kas_account_save', { p_mosque: mosqueId, p_id: id || null, p_name: v.name, p_kind: v.kind, p_opening: v.opening, p_opening_date: v.date, p_active: active !== false });
export const saveCategory = (mosqueId, id, direction, name, active) => rpc('kas_category_save', { p_mosque: mosqueId, p_id: id || null, p_direction: direction, p_name: name, p_active: active !== false });

/* ===== Bukti foto (privat, maks 100 KB) ===== */
export const newProofPath = mosqueId => { let id = null; try { id = crypto.randomUUID ? crypto.randomUUID() : null; } catch (e) { /* abaikan */ } return mosqueId + '/' + (id || Math.random().toString(16).slice(2, 14)) + '-' + Date.now() + '.jpg'; };
export async function uploadProof(mosqueId, file) {
  const img = await prepareProductPhoto(file);
  const path = newProofPath(mosqueId);
  await storageUpload(path, img.blob, BUCKET);
  return path;
}
export const proofUrl = path => storageBlobUrl(path, BUCKET);

export function errorText(e) {
  if (e && e.status === 0) return 'Tidak ada koneksi internet. Coba lagi saat online.';
  if (notReady(e)) return 'Kas masjid belum aktif di server. Jalankan kas.sql lalu kas_baru.sql.';
  if (e && (e.status === 403 || e.code === '42501')) return 'Anda tidak memiliki izin untuk tindakan ini.';
  if (e && e.code === '22023' && e.message) return e.message.charAt(0).toUpperCase() + e.message.slice(1) + '.';
  if (e && e.code === '23505') return 'Nama itu sudah dipakai.';
  return 'Belum berhasil. Coba lagi.';
}

export const sizeLabel = n => { const k = Number(n) / 1024; return k < 1 ? Math.max(1, Number(n) || 0) + ' B' : k < 1000 ? Math.round(k) + ' KB' : (k / 1024).toFixed(1) + ' MB'; };
export const timeLabel = iso => { const d = new Date(iso); return isNaN(d) ? '' : pad(d.getHours()) + ':' + pad(d.getMinutes()); };
export const entryTitle = e => e.item_name || e.description;
