// BAITUNA - books-service.js
// Pustaka Buku: katalog buku fisik dan digital. Dibaca siapa saja (hanya yang tampil); hanya Super Admin yang mengelola (RLS di buku.sql).
// BAITUNA tidak memproses pembayaran: pembeli diarahkan ke WhatsApp penjual atau ke link checkout yang diisi Super Admin.
import { request, db, publicPhotoUrl } from './supabase.js';
import { normalizeWa, waLink, waDisplay, rp } from './market-service.js';

export const BUCKET = 'book-covers';
export const VIEW_KEY = 'baituna.books.v1';
export const KINDS = [{ key: 'fisik', label: 'Buku fisik' }, { key: 'digital', label: 'Buku digital' }];
export const kindLabel = k => (KINDS.find(x => x.key === k) || {}).label || 'Buku';
export const LIMIT = { titleMin: 3, titleMax: 150, descMin: 10, descMax: 2000, priceMax: 100000000, urlMax: 500 };
const COLS = 'id,title,description,kind,price,order_type,order_wa,order_url,cover_path,active,created_at,updated_at';
const oneLine = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim();

export const priceText = p => { const n = Number(p); return !Number.isFinite(n) || n < 0 ? '' : n === 0 ? 'Gratis' : rp(n); };
export const coverUrl = b => (b && b.cover_path ? publicPhotoUrl(b.cover_path, BUCKET) : null);
// Deskripsi singkat untuk tampilan list: dipotong di batas kata.
export function shortDesc(t, max = 110) {
  const s = oneLine(t); if (s.length <= max) return s;
  const cut = s.slice(0, max), sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:-]+$/, '') + '…';
}
// "Rp 85.000", "85.000", "85000", "gratis", "0" -> angka. Selain itu null.
export function parsePrice(input) {
  const s = String(input == null ? '' : input).trim().toLowerCase();
  if (s === 'gratis') return 0;
  const d = s.replace(/^rp\.?\s*/, '').replace(/[\s.]/g, '');
  if (!/^\d{1,9}$/.test(d)) return null;
  const n = Number(d); return n <= LIMIT.priceMax ? n : null;
}
export const httpsOk = u => /^https:\/\/[^\s<>"']{4,}$/.test(String(u || '')) && String(u).length <= LIMIT.urlMax;
export const orderText = b => 'Assalamu’alaikum, saya ingin memesan buku “' + b.title + '”' + (b.price > 0 ? ' (' + priceText(b.price) + ')' : '') + ' dari Pustaka Buku BAITUNA. Apakah masih tersedia?';
// Alamat tujuan tombol Pesan; null bila data tidak sah.
export function orderHref(b) {
  if (!b) return null;
  if (b.order_type === 'wa') return waLink(b.order_wa, orderText(b));
  if (b.order_type === 'url') return httpsOk(b.order_url) ? b.order_url : null;
  return null;
}
export const orderTarget = b => b.order_type === 'wa' ? 'WhatsApp ' + waDisplay(b.order_wa) : 'link checkout';

// Hasil: { ok:{...} } | { error, field }
export function validate(f) {
  const title = oneLine(f.title), description = String(f.description == null ? '' : f.description).replace(/\r\n?/g, '\n').trim();
  if (title.length < LIMIT.titleMin || title.length > LIMIT.titleMax) return { error: 'Nama buku ' + LIMIT.titleMin + ' sampai ' + LIMIT.titleMax + ' huruf.', field: 'title' };
  if (description.length < LIMIT.descMin || description.length > LIMIT.descMax) return { error: 'Deskripsi ' + LIMIT.descMin + ' sampai ' + LIMIT.descMax + ' huruf.', field: 'description' };
  if (!KINDS.some(k => k.key === f.kind)) return { error: 'Pilih jenis buku.', field: 'kind' };
  const price = parsePrice(f.price);
  if (price == null) return { error: 'Harga belum benar. Isi angka, mis. 85000 (atau 0 / "gratis"). Maksimal Rp 100.000.000.', field: 'price' };
  const out = { title, description, kind: f.kind, price, active: f.active !== false, order_type: f.orderType };
  if (f.orderType === 'wa') {
    const wa = normalizeWa(f.orderTarget);
    if (!wa) return { error: 'Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890.', field: 'target' };
    out.order_wa = wa; out.order_url = null;
  } else if (f.orderType === 'url') {
    const u = String(f.orderTarget == null ? '' : f.orderTarget).trim();
    if (!httpsOk(u)) return { error: 'Link checkout harus diawali https:// tanpa spasi (maks. ' + LIMIT.urlMax + ' huruf).', field: 'target' };
    out.order_url = u; out.order_wa = null;
  } else return { error: 'Pilih cara pemesanan.', field: 'orderType' };
  return { ok: out };
}

/* ===== Baca (siapa saja) ===== */
export async function listBooks() {
  const r = await request('/rest/v1/books?select=' + COLS + '&active=eq.true&order=created_at.desc&limit=300');
  if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status, code: r.data && r.data.code });
  return r.data || [];
}
export const notReady = e => !!e && (e.status === 404 || e.code === 'PGRST205' || e.code === '42P01');

// Pencarian dan penyaring di perangkat (jumlah buku kecil).
export function filterBooks(items, { kind = '', q = '' } = {}) {
  const s = oneLine(q).toLowerCase();
  return items.filter(b => (!kind || b.kind === kind) && (!s || (b.title + ' ' + b.description).toLowerCase().includes(s)));
}

/* ===== Tampilan pilihan pengguna (disimpan di perangkat) ===== */
export function loadView() { try { const v = JSON.parse(localStorage.getItem(VIEW_KEY) || '{}'); return v && v.view === 'list' ? 'list' : 'grid'; } catch (e) { return 'grid'; } }
export function saveView(view) { try { localStorage.setItem(VIEW_KEY, JSON.stringify({ view: view === 'list' ? 'list' : 'grid' })); } catch (e) { /* abaikan */ } }

/* ===== Kelola (Super Admin) ===== */
export const listAllBooks = async () => (await db('books', { query: 'select=' + COLS + '&order=created_at.desc&limit=500' })) || [];
export const createBook = (f, coverPath) => db('books', { method: 'POST', body: { ...f, cover_path: coverPath || null }, prefer: 'return=minimal' });
export const updateBook = (id, patch) => db('books', { method: 'PATCH', query: 'id=eq.' + encodeURIComponent(id), body: patch, prefer: 'return=minimal' });
export const deleteBook = id => db('books', { method: 'DELETE', query: 'id=eq.' + encodeURIComponent(id), prefer: 'return=minimal' });
export const newCoverPath = () => { let id = null; try { id = crypto.randomUUID ? crypto.randomUUID() : null; } catch (e) { /* abaikan */ } return (id || Math.random().toString(16).slice(2, 14)) + '-' + Date.now() + '.jpg'; };
export function saveError(e) {
  if (e && e.status === 0) return 'Tidak ada koneksi internet.';
  if (e && (e.status === 403 || e.code === '42501')) return 'Hanya Super Admin yang boleh mengelola buku.';
  if (notReady(e)) return 'Pustaka Buku belum aktif di server. Jalankan buku.sql.';
  if (e && e.code === '23514') return 'Ada isian yang ditolak server. Periksa harga, link, dan nomor WhatsApp.';
  return 'Belum tersimpan. Coba lagi.';
}
