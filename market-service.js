// BAITUNA - market-service.js
// Pasar Umat: katalog produk & jasa jamaah. Dibaca siapa saja (hanya yang DISETUJUI Super Admin);
// nomor kontak penjual hanya untuk pengguna yang sudah masuk. Aturan sebenarnya dijaga RLS (lihat pasar.sql).
import { request, db, getSession } from './supabase.js';

export const CATS = [
  { key: 'makanan', label: 'Makanan Halal' },
  { key: 'pakaian', label: 'Pakaian Muslim' },
  { key: 'buku', label: 'Buku' },
  { key: 'jasa', label: 'Jasa' },
  { key: 'lainnya', label: 'Usaha Lainnya' }
];
export const catLabel = k => (CATS.find(c => c.key === k) || {}).label || 'Usaha Lainnya';
export const STATUS_LABEL = { pending: 'Menunggu verifikasi', approved: 'Tayang', rejected: 'Ditolak' };
export const REPORT_REASONS = [
  { key: 'haram', label: 'Barang/jasa haram atau melanggar syariat' },
  { key: 'menipu', label: 'Menipu atau tidak sesuai deskripsi' },
  { key: 'tidak_pantas', label: 'Konten tidak pantas' },
  { key: 'spam', label: 'Spam atau iklan berulang' },
  { key: 'lainnya', label: 'Lainnya' }
];
export const reasonLabel = k => (REPORT_REASONS.find(r => r.key === k) || {}).label || 'Lainnya';

export const MAX_PHOTOS = 5;
export const LIM = { title: [3, 100], desc: [10, 2000], note: 40, halal: 200, address: 200, sname: [3, 80], bio: 400, city: [2, 80], other: 120, price: 10000000000, report: 300 };
export const PAGE = 12;
export const MARKET_BUCKET = 'market-photos';

const enc = encodeURIComponent;
const ctrl = /[\u0000-\u001F\u007F]/g;
export const clean = (s, max) => (typeof s === 'string' ? s.replace(ctrl, ' ').replace(/[ \t]+/g, ' ').trim() : '').slice(0, max);
// Teks panjang: baris baru dipertahankan (maks. 2 berturut-turut).
export const cleanLong = (s, max) => (typeof s === 'string' ? s.replace(/\r/g, '').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim() : '').slice(0, max);
export const cleanSearch = q => String(q || '').replace(/[,()*%\\:"'&#;<>.]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
export const isUuid = s => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);

/* ---------- nomor WhatsApp ---------- */
// "0812-3456-7890", "+62 812 3456 7890", "62812...", "812..." -> "628123456789" (62 + 8 sampai 13 angka). Selain itu null.
export function normalizeWa(input) {
  let d = String(input == null ? '' : input).replace(/[\s().-]/g, '');
  if (/[^\d+]/.test(d) || (d.includes('+') && !d.startsWith('+')) || (d.match(/\+/g) || []).length > 1) return null;
  d = d.replace('+', '');
  if (d.startsWith('0062')) d = d.slice(2);
  else if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return /^62[0-9]{8,13}$/.test(d) ? d : null;
}
export const waDisplay = wa => (/^62\d{8,13}$/.test(wa || '') ? '0' + wa.slice(2) : '');
export const waLink = (wa, text) => /^62\d{8,13}$/.test(wa || '') ? 'https://wa.me/' + wa + (text ? '?text=' + enc(text) : '') : null;
export const orderText = (title, sellerName) => 'Assalamu’alaikum' + (sellerName ? ' ' + sellerName : '') + ', saya melihat “' + title + '” di BAITUNA Pasar Umat. Apakah masih tersedia?';

/* ---------- harga ---------- */
export const rp = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');
export function priceText(price, note) {
  if (price == null || price === '') return 'Hubungi penjual';
  const n = Number(price); if (!Number.isFinite(n) || n < 0) return 'Hubungi penjual';
  return rp(n) + (note ? ' / ' + note : '');
}
export const parsePrice = s => { const d = String(s == null ? '' : s).replace(/[^\d]/g, ''); return d ? Math.min(Number(d.slice(0, 11)), LIM.price) : null; };

/* ---------- validasi formulir ---------- */
// Mengembalikan { ok, errors: {kolom: pesan}, value }.
export function checkProduct(f) {
  const e = {}, v = {};
  v.title = clean(f && f.title, LIM.title[1]);
  if (v.title.length < LIM.title[0]) e.title = 'Nama produk minimal ' + LIM.title[0] + ' huruf.';
  v.category = CATS.some(c => c.key === (f && f.category)) ? f.category : null;
  if (!v.category) e.category = 'Pilih kategori.';
  v.description = cleanLong(f && f.description, LIM.desc[1]);
  if (v.description.length < LIM.desc[0]) e.description = 'Deskripsi minimal ' + LIM.desc[0] + ' huruf.';
  const raw = f && f.price != null ? String(f.price).trim() : '';
  v.price = raw === '' ? null : parsePrice(raw);
  if (raw !== '' && !/\d/.test(raw)) e.price = 'Harga harus berupa angka, atau kosongkan.';
  v.price_note = clean(f && f.price_note, LIM.note) || null;
  v.halal_note = clean(f && f.halal_note, LIM.halal) || null;
  if (v.category === 'makanan' && (!v.halal_note || v.halal_note.length < 5)) e.halal_note = 'Makanan wajib menyebut keterangan halal (bahan atau nomor sertifikat halal).';
  v.address = clean(f && f.address, LIM.address) || null;
  v.halal_declared = !!(f && f.halal_declared);
  if (!v.halal_declared) e.halal_declared = 'Centang pernyataan bahwa produk/jasa ini halal dan tidak melanggar aturan.';
  v.available = !(f && f.available === false);
  return { ok: Object.keys(e).length === 0, errors: e, value: v };
}
export function checkSeller(f) {
  const e = {}, v = {};
  v.name = clean(f && f.name, LIM.sname[1]);
  if (v.name.length < LIM.sname[0]) e.name = 'Nama usaha minimal ' + LIM.sname[0] + ' huruf.';
  v.bio = cleanLong(f && f.bio, LIM.bio) || null;
  v.city = clean(f && f.city, LIM.city[1]) || null;
  if (v.city && v.city.length < LIM.city[0]) e.city = 'Nama kota minimal ' + LIM.city[0] + ' huruf.';
  v.whatsapp = normalizeWa(f && f.whatsapp);
  if (!v.whatsapp) e.whatsapp = 'Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890.';
  v.other_contact = clean(f && f.other_contact, LIM.other) || null;
  v.mosque_id = f && isUuid(f.mosque_id) ? f.mosque_id : null;
  return { ok: Object.keys(e).length === 0, errors: e, value: v };
}

/* ---------- foto ---------- */
export const newPhotoPath = (sellerId, i = 0) => sellerId + '/' + Date.now() + (i ? '-' + i : '') + '.jpg';
export const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : null);

/* ---------- kolom ---------- */
const PCOLS = 'id,seller_id,title,category,description,price,price_note,halal_note,halal_declared,photos,address,available,status,approved_at,created_at,updated_at';
const MYCOLS = PCOLS + ',status_reason';
const SCOLS = 'id,name,bio,city,mosque_id,created_at';
const fail = r => Object.assign(new Error('gagal memuat'), { status: r.status, code: r.data && r.data.code });
const one = out => { if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak berubah'), { status: 403 }); return out[0]; };
const idList = ids => '(' + [...new Set(ids)].filter(isUuid).join(',') + ')';

async function attachSellers(rows) {
  const ids = rows.map(r => r.seller_id).filter(isUuid);
  if (!ids.length) return rows.map(r => ({ ...r, seller: null }));
  const r = await request('/rest/v1/market_sellers?select=' + SCOLS + '&id=in.' + idList(ids));
  const map = new Map((r.ok && Array.isArray(r.data) ? r.data : []).map(s => [s.id, s]));
  return rows.map(p => ({ ...p, seller: map.get(p.seller_id) || null }));
}

/* ---------- publik ---------- */
export async function listProducts({ category, q, sellerId, offset = 0 } = {}) {
  let path = '/rest/v1/market_products?select=' + PCOLS + '&status=eq.approved';
  if (CATS.some(c => c.key === category)) path += '&category=eq.' + enc(category);
  if (isUuid(sellerId)) path += '&seller_id=eq.' + sellerId;
  const s = cleanSearch(q); if (s) path += '&title=ilike.' + enc('*' + s + '*');
  path += '&order=approved_at.desc&limit=' + (PAGE + 1) + '&offset=' + Math.max(0, Number(offset) || 0);
  const r = await request(path);
  if (!r.ok) throw fail(r);
  const rows = Array.isArray(r.data) ? r.data : [];
  return { items: await attachSellers(rows.slice(0, PAGE)), hasMore: rows.length > PAGE };
}
export async function getProduct(id) {
  if (!isUuid(id)) return null;
  const r = await request('/rest/v1/market_products?select=' + PCOLS + '&status=eq.approved&id=eq.' + id + '&limit=1');
  if (!r.ok) throw fail(r);
  const p = Array.isArray(r.data) && r.data[0]; if (!p) return null;
  return (await attachSellers([p]))[0];
}
export async function getSeller(id) {
  if (!isUuid(id)) return null;
  const r = await request('/rest/v1/market_sellers?select=' + SCOLS + '&id=eq.' + id + '&limit=1');
  if (!r.ok) throw fail(r);
  return Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
}
export async function getMosqueName(id) {
  if (!isUuid(id)) return null;
  const r = await request('/rest/v1/mosques?select=id,name,city&id=eq.' + id + '&limit=1');
  return r.ok && Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
}
// Kontak: hanya terbaca bila sudah masuk (kolom ini tidak diberikan ke pengunjung anonim).
export async function getContact(sellerId) {
  const out = await db('market_sellers', { query: 'select=id,whatsapp,other_contact&id=eq.' + sellerId + '&limit=1' });
  return Array.isArray(out) && out[0] ? out[0] : null;
}

/* ---------- penjual (pemilik) ---------- */
export async function getMySeller() {
  const s = getSession(); const uid = s && s.user && s.user.id; if (!uid) return null;
  const out = await db('market_sellers', { query: 'select=id,user_id,name,bio,city,whatsapp,other_contact,mosque_id,status,status_reason,created_at&user_id=eq.' + uid + '&limit=1' });
  return Array.isArray(out) && out[0] ? out[0] : null;
}
export async function saveSeller(existing, v) {
  if (existing) return one(await db('market_sellers', { method: 'PATCH', query: 'id=eq.' + existing.id, prefer: 'return=representation', body: v }));
  return one(await db('market_sellers', { method: 'POST', prefer: 'return=representation', body: { id: newId() || undefined, ...v } }));
}
export async function deleteSeller(id) { one(await db('market_sellers', { method: 'DELETE', query: 'id=eq.' + id, prefer: 'return=representation' })); }
export async function listMyProducts(sellerId) {
  const out = await db('market_products', { query: 'select=' + MYCOLS + '&seller_id=eq.' + sellerId + '&order=created_at.desc&limit=100' });
  return Array.isArray(out) ? out : [];
}
const pfields = v => ({ title: v.title, category: v.category, description: v.description, price: v.price, price_note: v.price_note, halal_note: v.halal_note, halal_declared: v.halal_declared, address: v.address, available: v.available });
const photoList = ph => (Array.isArray(ph) ? ph.filter(x => typeof x === 'string').slice(0, MAX_PHOTOS) : []);
export const firstPhoto = p => (p && Array.isArray(p.photos) && p.photos[0]) || null;
export async function createProduct(id, sellerId, v, photos) {
  return one(await db('market_products', { method: 'POST', prefer: 'return=representation', body: { id, seller_id: sellerId, ...pfields(v), photos: photoList(photos) } }));
}
export async function updateProduct(id, v, photos) {
  const body = pfields(v); if (photos !== undefined) body.photos = photoList(photos);
  return one(await db('market_products', { method: 'PATCH', query: 'id=eq.' + id, prefer: 'return=representation', body }));
}
export async function setAvailable(id, available) {
  return one(await db('market_products', { method: 'PATCH', query: 'id=eq.' + id, prefer: 'return=representation', body: { available: !!available } }));
}
export async function deleteProduct(id) { one(await db('market_products', { method: 'DELETE', query: 'id=eq.' + id, prefer: 'return=representation' })); }

/* ---------- laporan ---------- */
export async function reportProduct(productId, reason, note) {
  try {
    await db('market_reports', { method: 'POST', prefer: 'return=minimal', body: { product_id: productId, reason, note: clean(note, LIM.report) || null } });
    return 'ok';
  } catch (e) { if (e && (e.status === 409 || e.code === '23505')) return 'dup'; throw e; }
}

/* ---------- Super Admin ---------- */
const ACOLS = PCOLS + ',status_reason';
export async function adminListProducts(status) {
  const f = ['pending', 'approved', 'rejected'].includes(status) ? '&status=eq.' + status : '';
  const out = await db('market_products', { query: 'select=' + ACOLS + f + '&order=created_at.desc&limit=200' });
  const rows = Array.isArray(out) ? out : [];
  const ids = rows.map(r => r.seller_id).filter(isUuid);
  let map = new Map();
  if (ids.length) { const s = await db('market_sellers', { query: 'select=id,name,city,whatsapp,other_contact,status,status_reason,mosque_id&id=in.' + idList(ids) }); map = new Map((Array.isArray(s) ? s : []).map(x => [x.id, x])); }
  return rows.map(p => ({ ...p, seller: map.get(p.seller_id) || null }));
}
export async function adminSetProduct(id, status, reason) {
  return one(await db('market_products', { method: 'PATCH', query: 'id=eq.' + id, prefer: 'return=representation', body: status === 'rejected' ? { status, status_reason: reason } : { status } }));
}
export async function adminListReports() {
  const out = await db('market_reports', { query: 'select=id,product_id,reason,note,status,created_at&order=created_at.desc&limit=200' });
  const rows = Array.isArray(out) ? out : [];
  const ids = [...new Set(rows.map(r => r.product_id))].filter(isUuid);
  let map = new Map();
  if (ids.length) { const p = await db('market_products', { query: 'select=id,title,status,seller_id&id=in.' + idList(ids) }); map = new Map((Array.isArray(p) ? p : []).map(x => [x.id, x])); }
  return rows.map(r => ({ ...r, product: map.get(r.product_id) || null }));
}
export async function adminHandleReport(id, handled = true) {
  return one(await db('market_reports', { method: 'PATCH', query: 'id=eq.' + id, prefer: 'return=representation', body: { status: handled ? 'handled' : 'open' } }));
}
export async function adminSetSeller(id, suspended, reason) {
  return one(await db('market_sellers', { method: 'PATCH', query: 'id=eq.' + id, prefer: 'return=representation', body: suspended ? { status: 'suspended', status_reason: reason } : { status: 'active' } }));
}
