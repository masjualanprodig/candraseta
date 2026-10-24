// BAITUNA - books-service.js
// Pustaka Buku: katalog buku fisik dan digital. Dibaca siapa saja (hanya yang tampil); hanya Super Admin yang mengelola (RLS di buku.sql).
// BAITUNA tidak memproses pembayaran: pembeli diarahkan ke WhatsApp penjual atau ke link checkout yang diisi Super Admin.
import { request, db, publicPhotoUrl, validToken } from './supabase.js';
import { normalizeWa, waLink, waDisplay, rp } from './market-service.js';

export const BUCKET = 'book-covers';
export const VIEW_KEY = 'baituna.books.v1';
export const KINDS = [{ key: 'fisik', label: 'Buku fisik' }, { key: 'digital', label: 'Buku digital' }];
// Status akses (v171): Gratis dibaca semua jamaah; Premium hanya untuk membership aktif.
export const ACCESS = [{ key: 'gratis', label: 'Gratis' }, { key: 'premium', label: 'Premium' }];
export const accessLabel = a => a === 'premium' ? 'Premium' : 'Gratis';
export const isPremium = b => !!b && b.access === 'premium';
export const FILE_BUCKET = 'book-files';
export const FILE_MAX = 50 * 1024 * 1024;
export const newFilePath = () => { let id = null; try { id = crypto.randomUUID ? crypto.randomUUID() : null; } catch (e) { /* abaikan */ } return (id || Math.random().toString(16).slice(2, 14)) + '-' + Date.now() + '.pdf'; };
// Alamat berkas hanya diberikan server bila pemanggil berhak (gratis / membership aktif / Super Admin).
export async function bookFilePath(id) {
  const r = await request('/rest/v1/rpc/book_file_path', { method: 'POST', body: { p_book: id }, token: await tokenOrNull() });
  return r.ok && typeof r.data === 'string' ? r.data : null;
}
const tokenOrNull = async () => { try { return await validToken(); } catch (e) { return null; } };
export const kindLabel = k => (KINDS.find(x => x.key === k) || {}).label || 'Buku';
export const LIMIT = { titleMin: 3, titleMax: 150, descMin: 10, descMax: 2000, htmlMax: 8000, labelMax: 30, priceMax: 100000000, urlMax: 500, authorMax: 80 };
const COLS = 'id,title,description,kind,price,order_type,order_label,order_wa,order_url,cover_path,active,created_at,updated_at,access,has_file';
const ADMIN_COLS = COLS + ',file_path';
const oneLine = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim();

export const priceText = p => { const n = Number(p); return !Number.isFinite(n) || n < 0 ? '' : n === 0 ? 'Gratis' : rp(n); };
export const coverUrl = b => (b && b.cover_path ? publicPhotoUrl(b.cover_path, BUCKET) : null);

/* ===== Deskripsi berformat (HTML terbatas) =====
   Hanya tag aman yang dipertahankan; semua atribut dibuang. Teks polos lama tetap tampil rapi. */
const ALLOW = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', UL: 'ul', OL: 'ol', LI: 'li', BR: 'br', P: 'p', DIV: 'p', MARK: 'mark', H4: 'h4', H3: 'h4', H2: 'h4', H1: 'h4' };
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'MATH', 'TITLE', 'HEAD']);
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const hasTags = t => /<\/?(b|strong|i|em|u|ul|ol|li|p|div|br|h[1-4]|mark|span)\b[^>]*>/i.test(String(t || ''));
export const plainToHtml = t => esc(String(t == null ? '' : t).replace(/\r\n?/g, '\n').trim()).replace(/\n/g, '<br>');
export function htmlToText(t) {
  return String(t == null ? '' : t).replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-4]|ul|ol)\s*>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
// Penanda stabilo: <span style="background-color:..."> (hasil peramban) atau <mark>; latar transparan/putih berarti tanpa stabilo.
function hiliteOn(style) {
  const m = /background(?:-color)?\s*:\s*([^;]+)/i.exec(String(style || '')); if (!m) return false;
  const v = m[1].trim().toLowerCase();
  return !(v === 'transparent' || v === 'inherit' || v === 'initial' || v === 'unset' || v === 'none' || v === 'white' || v === '#fff' || v === '#ffffff' || /^rgba?\(\s*255\s*,\s*255\s*,\s*255\s*(,\s*1(\.0)?\s*)?\)$/.test(v) || /^rgba\([^)]*,\s*0(\.0+)?\s*\)$/.test(v) || /^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(v));
}
export function sanitizeHtml(input) {
  const src = String(input == null ? '' : input);
  if (!hasTags(src)) return plainToHtml(src);
  if (typeof DOMParser === 'undefined') return plainToHtml(htmlToText(src));
  const doc = new DOMParser().parseFromString('<!doctype html><body>' + src, 'text/html');
  const walk = n => {
    let out = '';
    for (const c of n.childNodes) {
      if (c.nodeType === 3) out += esc(c.nodeValue.replace(/\u00a0/g, ' '));
      else if (c.nodeType === 1) {
        if (DROP.has(c.nodeName.toUpperCase())) continue;
        let tag = ALLOW[c.nodeName.toUpperCase()];
        if (!tag && c.nodeName.toUpperCase() === 'SPAN' && hiliteOn(c.getAttribute('style'))) tag = 'mark';
        if (!tag) out += walk(c);
        else if (tag === 'br') out += '<br>';
        else out += '<' + tag + '>' + walk(c) + '</' + tag + '>';
      }
    }
    return out;
  };
  return walk(doc.body).replace(/<(b|i|u|p|h4|mark)><\/\1>/g, '').replace(/(<br>){3,}/g, '<br><br>').replace(/^(<br>)+|(<br>)+$/g, '').replace(/<mark><mark>/g, '<mark>').replace(/<\/mark><\/mark>/g, '</mark>').trim();
}
export const descToHtml = t => sanitizeHtml(t);

// Deskripsi singkat untuk tampilan list: dipotong di batas kata.
export function shortDesc(t, max = 110) {
  const s = oneLine(htmlToText(t).replace(/\n/g, ' ')); if (s.length <= max) return s;
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
export const orderLabel = b => (b && b.order_label) || (b && b.order_type === 'wa' ? 'Pesan via WhatsApp' : 'Pesan lewat link checkout');
export const orderTarget = b => b.order_type === 'wa' ? 'WhatsApp ' + waDisplay(b.order_wa) : 'link checkout';

// Hasil: { ok:{...} } | { error, field }
export function validate(f) {
  const title = oneLine(f.title), description = sanitizeHtml(f.description), plain = htmlToText(description);
  if (title.length < LIMIT.titleMin || title.length > LIMIT.titleMax) return { error: 'Nama buku ' + LIMIT.titleMin + ' sampai ' + LIMIT.titleMax + ' huruf.', field: 'title' };
  if (plain.length < LIMIT.descMin || plain.length > LIMIT.descMax || description.length > LIMIT.htmlMax) return { error: 'Deskripsi ' + LIMIT.descMin + ' sampai ' + LIMIT.descMax + ' huruf (format yang terlalu banyak juga bisa melewati batas).', field: 'description' };
  if (!KINDS.some(k => k.key === f.kind)) return { error: 'Pilih jenis buku.', field: 'kind' };
  const price = parsePrice(f.price);
  if (price == null) return { error: 'Harga belum benar. Isi angka, mis. 85000 (atau 0 / "gratis"). Maksimal Rp 100.000.000.', field: 'price' };
  const author = oneLine(f.author);
  if (author.length > LIMIT.authorMax) return { error: 'Nama penulis maksimal ' + LIMIT.authorMax + ' huruf.', field: 'author' };
  const label = oneLine(f.orderLabel);
  if (label.length > LIMIT.labelMax) return { error: 'Teks tombol maksimal ' + LIMIT.labelMax + ' huruf.', field: 'label' };
  const out = { title, description, kind: f.kind, price, access: f.access === 'premium' ? 'premium' : 'gratis', active: f.active !== false, order_type: f.orderType, order_label: label || null };
  if (f.author !== undefined) out.author = author || null; // hanya dikirim bila kolom penulis ada di server
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
// Kolom penulis (buku_penulis.sql) opsional: bila belum dijalankan, daftar tetap dimuat tanpa penulis.
let authorOk = false;
export const authorSupported = () => authorOk;
export async function listBooks() {
  const q = c => '/rest/v1/books?select=' + c + '&active=eq.true&order=created_at.desc&limit=300';
  let r = await request(q(COLS + ',author')); authorOk = r.ok;
  if (!r.ok && r.status === 400) r = await request(q(COLS));
  if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status, code: r.data && r.data.code });
  return r.data || [];
}
export const notReady = e => !!e && (e.status === 404 || e.code === 'PGRST205' || e.code === '42P01');

// Pencarian, penyaring, dan pengurutan di perangkat (jumlah buku kecil).
export const SORTS = [{ key: 'terbaru', label: 'Terbaru' }, { key: 'terlama', label: 'Terlama' }, { key: 'judul', label: 'Judul A–Z' }];
export function filterBooks(items, { kind = '', q = '', access = '', sort = 'terbaru' } = {}) {
  const s = oneLine(q).toLowerCase();
  const out = items.filter(b => (!kind || b.kind === kind) && (!access || (b.access || 'gratis') === access) && (!s || (b.title + ' ' + (b.author || '') + ' ' + htmlToText(b.description)).toLowerCase().includes(s)));
  const ts = b => Date.parse(b.created_at) || 0;
  const cmp = sort === 'judul' ? (x, y) => String(x.title).localeCompare(String(y.title), 'id') : sort === 'terlama' ? (x, y) => ts(x) - ts(y) : (x, y) => ts(y) - ts(x);
  // Buku Gratis selalu di atas Premium; di dalam tiap kelompok mengikuti urutan pilihan (urutan asli bila sama).
  return out.map((b, i) => [b, i]).sort((x, y) => ((x[0].access === 'premium') - (y[0].access === 'premium')) || cmp(x[0], y[0]) || (x[1] - y[1])).map(x => x[0]);
}

/* ===== Tampilan pilihan pengguna (disimpan di perangkat) ===== */
export function loadView() { try { const v = JSON.parse(localStorage.getItem(VIEW_KEY) || '{}'); return v && v.view === 'list' ? 'list' : 'grid'; } catch (e) { return 'grid'; } }
export function saveView(view) { try { localStorage.setItem(VIEW_KEY, JSON.stringify({ view: view === 'list' ? 'list' : 'grid' })); } catch (e) { /* abaikan */ } }

/* ===== Kelola (Super Admin) ===== */
export const listAllBooks = async () => {
  try { const r = (await db('books', { query: 'select=' + ADMIN_COLS + ',author&order=created_at.desc&limit=500' })) || []; authorOk = true; return r; }
  catch (e) { if (e && e.status !== 400) throw e; authorOk = false; return (await db('books', { query: 'select=' + ADMIN_COLS + '&order=created_at.desc&limit=500' })) || []; }
};
export const createBook = (f, coverPath, filePath) => db('books', { method: 'POST', body: { ...f, cover_path: coverPath || null, file_path: filePath || null }, prefer: 'return=minimal' });
export const updateBook = (id, patch) => db('books', { method: 'PATCH', query: 'id=eq.' + encodeURIComponent(id), body: patch, prefer: 'return=minimal' });
export const setBookFile = (id, path) => db('books', { method: 'PATCH', query: 'id=eq.' + encodeURIComponent(id), body: { file_path: path }, prefer: 'return=minimal' });
export const deleteBook = id => db('books', { method: 'DELETE', query: 'id=eq.' + encodeURIComponent(id), prefer: 'return=minimal' });
export const newCoverPath = () => { let id = null; try { id = crypto.randomUUID ? crypto.randomUUID() : null; } catch (e) { /* abaikan */ } return (id || Math.random().toString(16).slice(2, 14)) + '-' + Date.now() + '.jpg'; };
export function saveError(e) {
  if (e && e.status === 0) return 'Tidak ada koneksi internet.';
  if (e && (e.status === 403 || e.code === '42501')) return 'Hanya Super Admin yang boleh mengelola buku.';
  if (notReady(e)) return 'Pustaka Buku belum aktif di server. Jalankan buku.sql.';
  if (e && e.code === '23514') return 'Ada isian yang ditolak server. Periksa harga, link, dan nomor WhatsApp.';
  return 'Belum tersimpan. Coba lagi.';
}
