// BAITUNA - market-service.js (v209)
// Pasar Umat: katalog produk & jasa jamaah, verifikasi penjual, iklan dengan kuota, langganan.
// Aturan sebenarnya dijaga database (pasar.sql + pasar_v2.sql): semua penulisan lewat fungsi mk_* di server.
// Ekspor lama (rp, priceText, listProducts, normalizeWa, waLink, waDisplay) tetap ada karena dipakai fitur lain.
import { request, db, getSession, storageUpload, storageRemove, storageBlobUrl } from './supabase.js';

export const MARKET_BUCKET = 'market-photos';
export const KTP_BUCKET = 'market-ktp';
export const PAGE = 12;
export const LIM = { title: 70, desc: 4096, descMin: 10, note: 40, halal: 200, address: 200, store: 80, bio: 400, other: 120, price: 10000000000, report: 300, detail: 60, detailLong: 300 };

// Kategori bawaan (cadangan bila daftar dari server belum termuat). Nama & urutan resmi dari tabel market_categories.
export const CATS = [
  { key: 'makanan', label: 'Makanan Halal' }, { key: 'pakaian', label: 'Pakaian Muslim' }, { key: 'buku', label: 'Buku' },
  { key: 'jasa', label: 'Jasa & Lowongan Kerja' }, { key: 'rumah_tangga', label: 'Rumah Tangga' }, { key: 'gadget', label: 'Handphone & Gadget' },
  { key: 'hobi', label: 'Hobi & Olahraga' }, { key: 'bayi_anak', label: 'Perlengkapan Bayi & Anak' }, { key: 'kantor', label: 'Kantor & Industri' },
  { key: 'kesehatan', label: 'Kesehatan & Kecantikan' }, { key: 'pertanian', label: 'Pertanian' }, { key: 'lainnya', label: 'Lainnya' }
];
let catCache = null;
export const setCategories = list => { if (Array.isArray(list) && list.length) catCache = list.map(c => ({ key: c.key, label: c.name, icon: c.icon, active: c.active !== false })); };
export const categories = (all = false) => (catCache || CATS.map(c => ({ ...c, icon: c.key, active: true }))).filter(c => all || c.active);
export const catLabel = k => ((catCache || CATS).find(c => c.key === k) || {}).label || 'Lainnya';
export const isService = k => k === 'jasa';

// Status iklan (nilai di database -> label untuk jamaah).
export const LISTING_STATUS = {
  pending: 'Menunggu Moderasi', approved: 'Aktif', revision: 'Perlu Perbaikan', rejected: 'Ditolak',
  inactive: 'Nonaktif', paused: 'Nonaktif (kuota)', blocked: 'Dinonaktifkan Admin'
};
export const listingLabel = l => (l && l.expired ? 'Nonaktif (langganan berakhir)' : LISTING_STATUS[l && l.status] || '-');
export const listingTone = l => l && l.expired ? 'off' : ({ approved: 'ok', pending: 'wait', revision: 'warn', rejected: 'bad', blocked: 'bad' }[l && l.status] || 'off');
export const VERIF_STATUS = { menunggu: 'Menunggu verifikasi', perbaikan: 'Perlu perbaikan', disetujui: 'Terverifikasi', ditolak: 'Ditolak' };
export const FILTERS = [['', 'Semua'], ['approved', 'Aktif'], ['pending', 'Menunggu'], ['revision', 'Perlu Perbaikan'], ['rejected', 'Ditolak'], ['off', 'Nonaktif']];
export const matchFilter = (l, f) => !f || (f === 'off' ? ['inactive', 'paused', 'blocked'].includes(l.status) || l.expired : f === 'approved' ? l.status === 'approved' && !l.expired : l.status === f);

export const REPORT_REASONS = [
  { key: 'haram', label: 'Barang/jasa haram atau melanggar syariat' },
  { key: 'menipu', label: 'Dugaan penipuan atau tidak sesuai deskripsi' },
  { key: 'tidak_pantas', label: 'Konten tidak pantas' },
  { key: 'spam', label: 'Spam atau iklan berulang' },
  { key: 'lainnya', label: 'Lainnya' }
];
export const reasonLabel = k => (REPORT_REASONS.find(r => r.key === k) || {}).label || 'Lainnya';
export const DETAIL_FIELDS = [['stock', 'Stok', 'Contoh: 25'], ['unit', 'Satuan', 'Contoh: botol, kg, paket'], ['brand', 'Merek', ''], ['size', 'Berat atau ukuran', 'Contoh: 500 gr'],
  ['shipping', 'Informasi pengiriman', 'Contoh: bisa COD area Sukoharjo, kirim via ekspedisi'], ['terms', 'Ketentuan jasa', 'Contoh: area layanan, jam kerja'], ['note', 'Catatan tambahan', '']];

const enc = encodeURIComponent;
const ctrl = /[\u0000-\u001F\u007F]/g;
export const clean = (s, max) => (typeof s === 'string' ? s.replace(ctrl, ' ').replace(/[ \t]+/g, ' ').trim() : '').slice(0, max);
export const cleanLong = (s, max) => (typeof s === 'string' ? s.replace(/\r/g, '').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim() : '').slice(0, max);
export const cleanSearch = q => String(q || '').replace(/[,()*%\\:"'&#;<>.]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
export const isUuid = s => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
export const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)));
export const userId = () => { const s = getSession(); return s && s.user ? s.user.id : null; };

/* ---------- nomor WhatsApp ---------- */
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
export const rp = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');
export function priceText(price, note) {
  if (price == null || price === '') return 'Hubungi penjual';
  const n = Number(price); if (!Number.isFinite(n) || n < 0) return 'Hubungi penjual';
  return rp(n) + (note ? ' / ' + note : '');
}
export const parsePrice = s => { const d = String(s == null ? '' : s).replace(/[^\d]/g, ''); return d ? Math.min(Number(d.slice(0, 11)), LIM.price) : null; };
export const fmtDate = iso => { try { return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } };
export const fmtShort = iso => { try { return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };
export const place = p => [p && p.loc_district, p && p.loc_city, p && p.loc_province].filter(Boolean).join(', ');

/* ---------- validasi (server memeriksa ulang semuanya) ---------- */
export function checkListing(d, cfg = {}) {
  const e = {}, v = {};
  v.title = clean(d.title, LIM.title + 1);
  if (v.title.length < 3) e.title = 'Judul iklan minimal 3 huruf.'; else if (v.title.length > LIM.title) e.title = 'Judul iklan maksimal ' + LIM.title + ' huruf.';
  v.description = cleanLong(d.description, LIM.desc + 1);
  if (v.description.length < LIM.descMin) e.description = 'Deskripsi minimal ' + LIM.descMin + ' huruf.'; else if (v.description.length > LIM.desc) e.description = 'Deskripsi maksimal 4.096 huruf.';
  v.price = parsePrice(d.price);
  if (!v.price || v.price < 1) e.price = 'Isi harga dengan angka lebih dari 0.';
  v.price_note = clean(d.price_note, LIM.note) || null;
  v.category = d.category && categories().some(c => c.key === d.category) ? d.category : null;
  if (!v.category) e.category = 'Pilih kategori.';
  v.condition = d.condition === 'baru' || d.condition === 'bekas' ? d.condition : null;
  v.halal_note = clean(d.halal_note, LIM.halal) || null;
  if (v.category === 'makanan' && (!v.halal_note || v.halal_note.length < 5)) e.halal_note = 'Makanan wajib menyebut keterangan halal (bahan atau nomor sertifikat halal).';
  v.loc_province = clean(d.loc_province, 80) || null; v.loc_city = clean(d.loc_city, 80) || null; v.loc_district = clean(d.loc_district, 80) || null;
  if (!v.loc_province || !v.loc_city) e.loc = 'Pilih provinsi dan kabupaten/kota lokasi barang atau jasa.';
  v.address = clean(d.address, LIM.address) || null;
  if (v.address && v.address.length < 3) e.address = 'Patokan lokasi minimal 3 huruf, atau kosongkan.';
  v.details = {};
  for (const [k] of DETAIL_FIELDS) {
    const val = clean(d.details && d.details[k], k === 'shipping' || k === 'terms' || k === 'note' ? LIM.detailLong : LIM.detail);
    if (val) v.details[k] = val;
  }
  v.photos = (d.photos || []).filter(p => p && p.path && !p.err && !p.busy).map(p => p.path);
  if (!v.photos.length) e.photos = 'Foto sampul wajib diunggah.';
  if (v.photos.length > (cfg.maxPhotos || 10)) e.photos = 'Maksimal ' + (cfg.maxPhotos || 10) + ' foto.';
  v.halal_declared = !!d.halal_declared;
  if (!v.halal_declared) e.halal_declared = 'Centang pernyataan sebelum melanjutkan.';
  return { ok: Object.keys(e).length === 0, errors: e, value: v };
}
export function checkVerification(f) {
  const e = {}, v = {};
  v.store_name = clean(f.store_name, LIM.store); if (v.store_name.length < 3) e.store_name = 'Nama toko minimal 3 huruf.';
  v.full_name = clean(f.full_name, 120); if (v.full_name.length < 3) e.full_name = 'Tulis nama lengkap sesuai KTP.';
  v.whatsapp = normalizeWa(f.whatsapp); if (!v.whatsapp) e.whatsapp = 'Nomor WhatsApp belum benar. Contoh: 0812 3456 7890.';
  v.province = clean(f.province, 80); v.regency = clean(f.regency, 80); v.district = clean(f.district, 80);
  if (v.province.length < 2 || v.regency.length < 2 || v.district.length < 2) e.loc = 'Lengkapi provinsi, kabupaten/kota, dan kecamatan.';
  if (!f.ktp) e.ktp = 'Unggah foto KTP.';
  v.consent = !!f.consent; if (!v.consent) e.consent = 'Centang persetujuan kebijakan privasi dan ketentuan Pasar Umat.';
  return { ok: Object.keys(e).length === 0, errors: e, value: v };
}

/* ---------- pesan galat server -> bahasa jamaah ---------- */
const ERR = {
  login: 'Silakan masuk dulu.', tutup: 'Pasar Umat sedang tidak menerima penjual/iklan baru untuk sementara.', persetujuan: 'Centang persetujuan kebijakan privasi dan ketentuan.',
  ktp: 'Foto KTP belum terunggah. Coba pilih foto lagi.', whatsapp: 'Nomor WhatsApp belum benar.', cepat: 'Pengajuan baru saja dikirim. Tunggu sebentar.',
  sudah_disetujui: 'Verifikasi Anda sudah disetujui.', batas_harian: 'Batas harian tercapai. Coba lagi besok.', belum_penjual: 'Lengkapi verifikasi penjual terlebih dahulu.',
  ditangguhkan: 'Toko Anda sedang ditangguhkan admin.', belum_terverifikasi: 'Pengajuan verifikasi sedang diperiksa. Anda dapat mulai berjualan setelah verifikasi disetujui.',
  kuota_penuh: 'Kuota iklan Anda sudah penuh. Pilih paket yang sesuai untuk menambahkan iklan.', batas_total: 'Jumlah iklan sudah mencapai batas maksimal. Hapus iklan lama terlebih dahulu.',
  tidak_ada: 'Iklan tidak ditemukan atau bukan milik Anda.', diblokir: 'Iklan ini dinonaktifkan admin dan tidak dapat diubah.', status: 'Status iklan tidak memungkinkan tindakan ini.',
  foto_sampul: 'Foto sampul wajib diunggah.', foto: 'Foto tidak valid atau lebih dari batas.', harga: 'Harga harus angka lebih dari 0.', kategori: 'Pilih kategori yang tersedia.',
  kondisi: 'Pilih kondisi Baru atau Bekas.', pernyataan: 'Centang pernyataan sebelum melanjutkan.', detail_panjang: 'Salah satu info tambahan terlalu panjang.', id: 'Gagal menyimpan. Coba lagi.',
  title_kosong: 'Judul iklan wajib diisi.', title_panjang: 'Judul iklan 3 sampai 70 huruf.', description_kosong: 'Deskripsi minimal 10 huruf.', description_panjang: 'Deskripsi maksimal 4.096 huruf.',
  halal_note_kosong: 'Makanan wajib menyebut keterangan halal.', halal_note_panjang: 'Keterangan halal 5 sampai 200 huruf.', loc_province_kosong: 'Pilih provinsi lokasi.', loc_city_kosong: 'Pilih kabupaten/kota lokasi.',
  store_name_panjang: 'Nama toko 3 sampai 80 huruf.', store_name_kosong: 'Nama toko wajib diisi.', full_name_kosong: 'Nama lengkap wajib diisi.', full_name_panjang: 'Nama lengkap 3 sampai 120 huruf.',
  district_kosong: 'Pilih kecamatan.', province_kosong: 'Pilih provinsi.', regency_kosong: 'Pilih kabupaten/kota.', bio_panjang: 'Deskripsi toko maksimal 400 huruf.', other_contact_panjang: 'Kontak lain maksimal 120 huruf.',
  izin: 'Hanya Super Admin yang boleh melakukan ini.', alasan: 'Tulis alasan (5 sampai 300 huruf).', aksi: 'Tindakan tidak dikenal.', slot: 'Iklan ini belum memiliki slot kuota.',
  angka: 'Isi dengan angka yang benar.', ukuran: 'Ukuran foto 50 sampai 1.000 KB.', kuota: 'Kuota 1 sampai 500 iklan.', wajib_ada: 'Kategori "Lainnya" harus tetap aktif.', name_panjang: 'Nama 3 sampai 60 huruf.', kuota_promo: 'Batas iklan mode gratis 1 sampai 50.'
};
export function errorText(e) {
  if (!e) return 'Belum berhasil. Coba lagi.';
  if (e.status === 0) return 'Tidak ada koneksi internet. Periksa jaringan Anda.';
  if (e.message && ERR[e.message]) return ERR[e.message];
  if (e.status === 401 || e.code === '28000') return 'Sesi Anda berakhir. Silakan masuk lagi.';
  if (e.status === 403 || e.code === '42501') return 'Anda tidak memiliki izin.';
  if (notReady(e)) return 'Pasar Umat versi baru belum aktif di server. Pengelola perlu menjalankan pasar_v2.sql.';
  return 'Belum berhasil. Coba lagi.';
}
export const notReady = e => !!e && (e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === '42P01' || e.code === '42883' || (e.status === 404 && !e.message));

/* ---------- server: status, iklan, toko ---------- */
const rpc = (name, body) => db('rpc/' + name, { method: 'POST', body: body || {} });
// Untuk pengunjung yang belum masuk: panggilan publik memakai kunci anon (tanpa token pengguna).
async function rpcAny(name, body) {
  if (getSession()) return rpc(name, body);
  const r = await request('/rest/v1/rpc/' + name, { method: 'POST', body: body || {} });
  if (!r.ok) throw fail(r);
  return r.data;
}
export async function state() { const s = await rpcAny('mk_state'); if (s && s.categories) setCategories(s.categories); return s; }
export const myListings = async () => (await rpc('mk_my_listings')) || [];
export const saveListing = (id, v) => rpc('mk_save_listing', { p_id: id || null, p: v });
export const setListing = (id, on) => rpc('mk_set_listing', { p_id: id, p_on: !!on });
export const setAvailable = (id, on) => rpc('mk_set_available', { p_id: id, p_available: !!on });
export async function deleteListing(id) {
  const r = await rpc('mk_delete_listing', { p_id: id });
  for (const p of (r && r.photos) || []) await storageRemove(p, MARKET_BUCKET).catch(() => {});   // file foto ikut dihapus
}
export const submitVerification = v => rpc('mk_submit_verification', { p: v });
export const saveStore = v => rpc('mk_save_store', { p: v });
export const track = (id, kind) => rpcAny('mk_track', { p_id: id, p_kind: kind }).catch(() => {});
export async function reportProduct(productId, reason, note) { await rpc('mk_report', { p_id: productId, p_reason: reason, p_note: clean(note, LIM.report) || null }); return 'ok'; }
export async function deleteStore(me, listings) {
  for (const l of listings || []) for (const p of l.photos || []) await storageRemove(p, MARKET_BUCKET).catch(() => {});
  const k = me && me.verification && me.verification.ktp_path; if (k) await storageRemove(k, KTP_BUCKET).catch(() => {});
  await rpc('mk_delete_store');
}

/* ---------- foto ---------- */
export const newPhotoPath = sellerId => sellerId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
export const newKtpPath = () => userId() + '/ktp-' + Date.now() + '.jpg';
export const uploadPhoto = (path, blob) => storageUpload(path, blob, MARKET_BUCKET);
export const removePhoto = path => storageRemove(path, MARKET_BUCKET).catch(() => {});
export const uploadKtp = (path, blob) => storageUpload(path, blob, KTP_BUCKET);
export const removeKtp = path => storageRemove(path, KTP_BUCKET).catch(() => {});
export const ktpBlobUrl = path => storageBlobUrl(path, KTP_BUCKET);
export const PHOTO_ERRORS = {
  type: 'Format foto harus JPG, PNG, atau WebP.', big: 'Berkas terlalu besar (maksimal 25 MB sebelum diperkecil).',
  decode: 'Foto tidak bisa dibaca. Coba foto lain.', size: 'Foto tetap terlalu besar setelah diperkecil. Coba foto lain.'
};
// Foto iklan: sisi terpanjang diperkecil bertahap dan kualitas diturunkan sampai <= batas KB dari Super Admin. EXIF/GPS terbuang.
export async function preparePhoto(file, maxKb = 300) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) throw { code: 'type' };
  if (file.size > 25 * 1024 * 1024) throw { code: 'big' };
  const limit = Math.max(50, Math.min(1000, Number(maxKb) || 300)) * 1024;
  let bmp;
  try { bmp = await createImageBitmap(file); } catch (e) { throw { code: 'decode' }; }
  try {
    for (const side of [1600, 1280, 1024, 800, 640]) {
      const scale = Math.min(1, side / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(bmp, 0, 0, w, h);
      for (const q of [0.85, 0.75, 0.65, 0.55, 0.45]) {
        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', q));
        if (blob && blob.size <= limit) return { blob, width: w, height: h };
      }
    }
  } finally { if (bmp.close) bmp.close(); }
  throw { code: 'size' };
}

/* ---------- publik ---------- */
const PCOLS = 'id,seller_id,title,category,description,price,price_note,halal_note,photos,address,available,status,approved_at,created_at,updated_at,condition,loc_province,loc_city,loc_district,details';
const SCOLS = 'id,name,bio,city,created_at';
const fail = r => Object.assign(new Error((r.data && r.data.message) || 'gagal memuat'), { status: r.status, code: r.data && r.data.code });
const idList = ids => '(' + [...new Set(ids)].filter(isUuid).join(',') + ')';
async function attachSellers(rows) {
  const ids = rows.map(r => r.seller_id).filter(isUuid);
  if (!ids.length) return rows.map(r => ({ ...r, seller: null }));
  const r = await request('/rest/v1/market_sellers?select=' + SCOLS + '&id=in.' + idList(ids));
  const map = new Map((r.ok && Array.isArray(r.data) ? r.data : []).map(s => [s.id, s]));
  return rows.map(p => ({ ...p, seller: map.get(p.seller_id) || null }));
}
// Hanya iklan yang tayang (disaring RLS: disetujui, penjual aktif & terverifikasi, kuota/langganan sah).
export async function listProducts({ category, q, sellerId, offset = 0 } = {}) {
  let path = '/rest/v1/market_products?select=' + PCOLS + '&status=eq.approved';
  if (category && /^[a-z][a-z0-9_]{1,30}$/.test(category)) path += '&category=eq.' + enc(category);
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
// Kontak: hanya terbaca bila sudah masuk (kolom ini tidak diberikan ke pengunjung anonim).
export async function getContact(sellerId) {
  const out = await db('market_sellers', { query: 'select=id,whatsapp,other_contact&id=eq.' + sellerId + '&limit=1' });
  return Array.isArray(out) && out[0] ? out[0] : null;
}
export const firstPhoto = p => (p && Array.isArray(p.photos) && p.photos[0]) || null;

/* ---------- Super Admin ---------- */
export const admin = {
  stats: () => rpc('mk_admin_stats'),
  verifications: status => rpc('mk_admin_verifications', { p_status: status || null }),
  ktpPath: uid => rpc('mk_admin_ktp', { p_user: uid }),
  verify: (uid, action, note) => rpc('mk_admin_verify', { p_user: uid, p_action: action, p_note: note || null }),
  suspend: (sellerId, on, reason) => rpc('mk_admin_suspend', { p_seller: sellerId, p_suspend: !!on, p_reason: reason || null }),
  listings: status => rpc('mk_admin_listings', { p_status: status || null }),
  moderate: (id, action, reason) => rpc('mk_admin_moderate', { p_id: id, p_action: action, p_reason: reason || null }),
  reports: () => rpc('mk_admin_reports'),
  reportDone: id => rpc('mk_admin_report_done', { p_id: id }),
  plan: (code, v) => rpc('mk_admin_plan', { p_code: code, p: v }),
  settings: v => rpc('mk_admin_settings', { p: v }),
  category: (key, v) => rpc('mk_admin_category', { p_key: key, p: v }),
  audit: n => rpc('mk_admin_audit', { p_limit: n || 150 })
};
export const AUDIT_LABEL = {
  ajukan_verifikasi: 'Pengajuan verifikasi', lihat_ktp: 'Membuka KTP', verifikasi_disetujui: 'Verifikasi disetujui', verifikasi_perbaikan: 'Verifikasi: minta perbaikan',
  verifikasi_ditolak: 'Verifikasi ditolak', tangguhkan_penjual: 'Penjual ditangguhkan', pulihkan_penjual: 'Penjual dipulihkan', buat_iklan: 'Iklan dibuat', ubah_iklan: 'Iklan diubah',
  nonaktifkan_iklan: 'Iklan dinonaktifkan penjual', aktifkan_iklan: 'Iklan diaktifkan kembali', hapus_iklan: 'Iklan dihapus', moderasi_approved: 'Iklan disetujui',
  moderasi_revision: 'Iklan: minta perbaikan', moderasi_rejected: 'Iklan ditolak', moderasi_blocked: 'Iklan dinonaktifkan admin', laporan_selesai: 'Laporan diselesaikan',
  ubah_paket: 'Paket diubah', ubah_pengaturan: 'Pengaturan diubah', ubah_kategori: 'Kategori diubah', langganan_aktif: 'Langganan aktif', hapus_toko: 'Toko dihapus pemilik'
};
