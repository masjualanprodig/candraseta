// BAITUNA - membership-service.js
// Membership Premium untuk Pustaka Buku. Semua aturan penting (harga, aktivasi, komisi, izin baca) dijaga SERVER (membership.sql);
// file ini hanya memanggilnya dan menyiapkan teks/validasi untuk tampilan. Pembayaran manual: transfer bank / QRIS + verifikasi admin.
import { db, getSession, validToken, storageUpload, storageBlobUrl, publicPhotoUrl } from './supabase.js';
import { CONFIG } from './config.js';

export const PROOF_BUCKET = 'payment-proofs';
export const ASSET_BUCKET = 'membership-assets';
export const rp = n => 'Rp ' + Number(n).toLocaleString('id-ID');
const enc = encodeURIComponent;

export const STATUS = {
  menunggu_pembayaran: { label: 'Menunggu Pembayaran', tone: 'warn' },
  menunggu_verifikasi: { label: 'Menunggu Verifikasi', tone: 'warn' },
  disetujui: { label: 'Terverifikasi', tone: 'ok' },
  ditolak: { label: 'Ditolak', tone: 'bad' },
  kedaluwarsa: { label: 'Kedaluwarsa', tone: 'off' },
  dibatalkan: { label: 'Dibatalkan', tone: 'off' },
};
export const statusLabel = s => (STATUS[s] || { label: s }).label;
export const METHODS = { qris: 'QRIS', transfer: 'Transfer Bank' };
export const methodLabel = m => METHODS[m] || 'Belum dipilih';
export const PROOF_STATUS = { menunggu: 'Menunggu verifikasi', diterima: 'Diterima', ditolak: 'Ditolak' };
export const PROOF_MAX = 5 * 1024 * 1024;
export const PROOF_TYPES = /^image\/(jpeg|png|webp)$/;
export const COMMISSION_STATUS = { menunggu: 'Menunggu', dapat_dibayarkan: 'Dapat dibayarkan', sudah_dibayarkan: 'Sudah dibayarkan', dibatalkan: 'Dibatalkan' };

// Manfaat yang ditampilkan: hanya hal yang memang dilakukan aplikasi (tidak menjanjikan hal yang belum ada).
export const BENEFITS = [
  'Membaca semua buku Premium di Pustaka Buku',
  'Buku Gratis tetap bisa dibaca siapa saja',
  'Dibayar sekali untuk satu periode, tidak diperpanjang otomatis',
  'Setiap bulan ada 1-2 buku baru yang akan terbit dan GRATIS',
  'Forum Tanya Jawab BAITUNA: tanya jawab keislaman dibantu AI beserta rujukannya (maksimal 20 pertanyaan per hari)',
];

/* ===== Tanggal ===== */
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export function fmtDateTime(v) { const d = new Date(v); return isNaN(d) ? '' : fmtDate(d) + ', ' + String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0'); }
export const daysLeft = (m, now = new Date()) => m && m.ends_at ? Math.ceil((new Date(m.ends_at) - now) / 86400000) : null;
export function fmtDate(v) { const d = new Date(v); return isNaN(d) ? '' : d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear(); }
export function addMonths(date, n) { const d = new Date(date); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return d; }
// Perkiraan tanggal berakhir: mulai dari sekarang, atau dari akhir membership aktif bila ada (menumpuk).
export function estimateEnd(months, currentEnds, now = new Date()) {
  const base = currentEnds && new Date(currentEnds) > now ? new Date(currentEnds) : now;
  return addMonths(base, months);
}
export const isActive = m => !!m && !!m.ends_at && new Date(m.ends_at) > new Date();

/* ===== Validasi (cermin aturan server) ===== */
export const cleanName = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
export function normalizePhone(v) {
  let d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1); else if (d.startsWith('8')) d = '62' + d;
  return /^62[0-9]{8,13}$/.test(d) ? d : null;
}
export const phoneShow = p => p ? '+' + String(p).replace(/^(62)(\d{3})(\d{4})(\d+)$/, '$1 $2-$3-$4') : '';
export function validateData(f) {
  const name = cleanName(f.name);
  if (name.length < 2 || name.length > 120) return { error: 'Nama lengkap diisi 2 sampai 120 huruf.', field: 'name' };
  const phone = normalizePhone(f.phone);
  if (!phone) return { error: 'Nomor WhatsApp belum benar. Contoh: 0812 3456 7890.', field: 'phone' };
  return { ok: { name, phone } };
}
// Pesan galat server -> bahasa jamaah.
export function errorText(e) {
  const m = e && e.message;
  if (e && e.status === 0) return 'Tidak ada koneksi internet.';
  if (e && e.status === 401) return 'Silakan masuk dulu.';
  const map = {
    nama: 'Nama lengkap diisi 2 sampai 120 huruf.', telepon: 'Nomor WhatsApp belum benar.', paket: 'Paket ini belum tersedia. Pilih paket lain.',
    masjid: 'Masjid yang dipilih tidak ditemukan. Pilih lagi.', order_terbuka: 'Anda masih punya pesanan yang belum selesai. Selesaikan atau batalkan dulu.',
    tidak_bisa: 'Pesanan ini sudah tidak bisa diubah.', berkas: 'Berkas bukti tidak sah. Coba pilih gambar lagi.', metode: 'Pilih metode pembayaran.',
    sudah_diproses: 'Pembayaran ini sudah diproses sebelumnya.', email: 'Alamat email belum benar (boleh dikosongkan).', metode_belum: 'Metode pembayaran ini belum dikonfigurasi admin. Pilih metode lain.', gagal_nomor: 'Gagal membuat transaksi. Coba lagi.', alasan: 'Tulis alasan penolakan (minimal 5 huruf).', izin: 'Hanya Super Admin yang boleh melakukan ini.', tidak_ada: 'Data tidak ditemukan.',
  };
  if (m && map[m]) return map[m];
  if (e && (e.status === 403 || e.code === '42501')) return 'Anda tidak memiliki izin.';
  if (e && (e.status === 404 || e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === '42P01')) return 'Membership belum aktif di server. Pengelola perlu menjalankan membership.sql.';
  return 'Belum berhasil. Coba lagi.';
}
export const notReady = e => !!e && (e.status === 404 || e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === '42P01');

/* ===== Jamaah ===== */
export const userId = () => { const s = getSession(); return s && s.user ? s.user.id : null; };
export async function listPlans() { return (await db('membership_plans', { query: 'select=id,code,name,months,price,active,sort&order=sort.asc' })) || []; }
export async function myMembership() {
  const id = userId(); if (!id) return null;
  const r = await db('memberships', { query: 'select=started_at,ends_at&user_id=eq.' + enc(id) });
  return Array.isArray(r) && r[0] ? r[0] : null;
}
export async function myOrders() {
  await db('rpc/membership_expire_mine', { method: 'POST', body: {} }).catch(() => {});
  return (await db('membership_orders', { query: 'select=id,ref_code,plan_code,plan_name,months,amount,full_name,phone,mosque_id,mosque_name,method,status,proof_path,reject_reason,reviewed_at,starts_at,ends_at,expires_at,created_at&user_id=eq.' + enc(userId() || '') + '&order=created_at.desc&limit=50' })) || [];
}
export const openOrder = list => (list || []).find(o => o.status === 'menunggu_pembayaran' || o.status === 'menunggu_verifikasi') || null;
export const settingsPublic = async () => { const r = await db('rpc/membership_settings_public', { method: 'POST', body: {} }); return Array.isArray(r) && r[0] ? r[0] : {}; };
export const listAccounts = async () => (await db('membership_accounts', { query: 'select=id,bank,number,holder,active,sort&order=sort.asc,created_at.asc' })) || [];
export const qrisUrl = s => s && s.qris_path ? publicPhotoUrl(s.qris_path, ASSET_BUCKET) : null;
export const createOrder = f => db('rpc/membership_create_order', { method: 'POST', body: { p_plan: f.plan, p_name: f.name, p_phone: f.phone, p_mosque: f.mosque || null, p_email: f.email || null, p_method: f.method } });
export const setMethod = (id, method) => db('rpc/membership_set_method', { method: 'POST', body: { p_order: id, p_method: method } });
export const myProofs = async orderId => (await db('membership_payment_proofs', { query: 'select=id,order_id,method,status,reject_reason,uploaded_at,reviewed_at&user_id=eq.' + enc(userId() || '') + '&order=uploaded_at.desc&limit=50' + (orderId ? '&order_id=eq.' + enc(orderId) : '') })) || [];
// Metode yang siap dipakai: hanya bila data resminya sudah diisi Super Admin (tidak ada data contoh). Server memeriksa ulang.
export const methodsReady = (settings, accounts) => ({ qris: !!(settings && settings.qris_path), transfer: (accounts || []).some(a => a.active !== false) });
// Minta server segera mengirim antrean notifikasi Telegram (tidak wajib berhasil; jadwal tiap menit menjadi cadangan).
export const FN_URL = CONFIG.SUPABASE_URL + '/functions/v1/baituna-push';
export function pingNotify() {
  try { fetch(FN_URL, { method: 'POST', headers: { 'content-type': 'application/json', apikey: CONFIG.SUPABASE_ANON_KEY }, body: JSON.stringify({ action: 'tg-flush' }), keepalive: true }).catch(() => {}); } catch (e) { /* abaikan */ }
}
// Validasi berkas bukti di perangkat (server/Storage memeriksa ulang tipe dan ukuran).
export function checkProofFile(f) {
  if (!f) return 'Pilih gambar bukti pembayaran.';
  if (!PROOF_TYPES.test(f.type)) return 'Format tidak didukung. Gunakan JPG, PNG, atau WebP.';
  if (f.size > PROOF_MAX) return 'Ukuran gambar melebihi 5 MB. Pilih gambar yang lebih kecil.';
  return null;
}
export function validEmail(v) { const e = String(v || '').trim().toLowerCase(); if (!e) return { ok: null }; return e.length <= 120 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? { ok: e } : { error: 'Alamat email belum benar (boleh dikosongkan).' }; }
export const cancelOrder = id => db('rpc/membership_cancel_order', { method: 'POST', body: { p_order: id } });
export const attachProof = (id, path, method) => db('rpc/membership_attach_proof', { method: 'POST', body: { p_order: id, p_path: path, p_method: method } });
export const newProofPath = () => userId() + '/' + Date.now() + '.jpg';
export const uploadProof = (path, blob) => storageUpload(path, blob, PROOF_BUCKET);
export const proofBlobUrl = path => storageBlobUrl(path, PROOF_BUCKET);
export const adminWaLink = (wa, text) => wa ? 'https://wa.me/' + wa + (text ? '?text=' + enc(text) : '') : null;

/* ===== Super Admin ===== */
const ORDER_COLS = 'id,ref_code,user_id,plan_code,plan_name,months,amount,full_name,phone,email,mosque_id,mosque_name,method,status,proof_path,proof_at,reject_reason,reviewed_by,reviewed_at,starts_at,ends_at,expires_at,created_at';
export const adminOrders = async status => (await db('membership_orders', { query: 'select=' + ORDER_COLS + (status ? '&status=eq.' + enc(status) : '') + '&order=created_at.desc&limit=300' })) || [];
export const expireDue = () => db('rpc/membership_expire_due', { method: 'POST', body: {} });
export const adminMemberships = async () => (await db('memberships', { query: 'select=user_id,started_at,ends_at&limit=1000' })) || [];
export const adminProofs = async () => (await db('membership_payment_proofs', { query: 'select=id,order_id,path,method,status,reject_reason,uploaded_at,reviewed_at&order=uploaded_at.desc&limit=1000' })) || [];
export const adminLog = async orderId => (await db('membership_log', { query: 'select=id,action,note,at&order_id=eq.' + enc(orderId) + '&order=at.asc&limit=100' })) || [];
export const adminNotifications = async () => (await db('membership_notifications', { query: 'select=id,kind,status,attempts,last_error,created_at,sent_at,payload&order=created_at.desc&limit=30' })) || [];
export const retryNotifications = () => db('rpc/membership_notify_retry', { method: 'POST', body: {} });
export const planHistory = async () => (await db('membership_plan_history', { query: 'select=id,plan_code,old_price,new_price,old_active,new_active,changed_at&order=changed_at.desc&limit=20' })) || [];
// Uji koneksi Telegram (server memeriksa bahwa pemanggil Super Admin). Mengembalikan { ok, configured, error }.
export async function testTelegram() {
  const token = await validToken(); if (!token) throw Object.assign(new Error('login'), { status: 401 });
  let r; try { r = await fetch(FN_URL, { method: 'POST', headers: { 'content-type': 'application/json', apikey: CONFIG.SUPABASE_ANON_KEY, authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'tg-test' }) }); }
  catch (e) { throw Object.assign(new Error('offline'), { status: 0 }); }
  let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
  if (r.status === 404) return { ok: false, error: 'Fungsi server baituna-push belum diperbarui.' };
  if (!r.ok) return { ok: false, error: j.error === 'sql' ? 'Jalankan membership_v2.sql dulu.' : (j.error || 'HTTP ' + r.status) };
  return j;
}
// Status membership seorang pengguna untuk panel admin (dihitung dari tanggal berakhir, sama seperti server).
export const memberStatus = (m, now = new Date()) => !m ? 'none' : new Date(m.ends_at) > now ? 'aktif' : 'berakhir';
export const reviewOrder = (id, approve, reason) => db('rpc/membership_review', { method: 'POST', body: { p_order: id, p_approve: !!approve, p_reason: reason || null } });
export const adminSettings = async () => { const r = await db('membership_settings', { query: 'select=qris_path,qris_merchant,commission_pct,admin_wa,pay_note&id=eq.1' }); return Array.isArray(r) && r[0] ? r[0] : {}; };
export const saveSettings = patch => db('membership_settings', { method: 'PATCH', query: 'id=eq.1', body: patch, prefer: 'return=minimal' });
export const savePlan = (id, patch) => db('membership_plans', { method: 'PATCH', query: 'id=eq.' + enc(id), body: patch, prefer: 'return=minimal' });
export const adminAccounts = listAccounts;
export const addAccount = f => db('membership_accounts', { method: 'POST', body: f, prefer: 'return=minimal' });
export const setAccountActive = (id, active) => db('membership_accounts', { method: 'PATCH', query: 'id=eq.' + enc(id), body: { active }, prefer: 'return=minimal' });
export const deleteAccount = id => db('membership_accounts', { method: 'DELETE', query: 'id=eq.' + enc(id), prefer: 'return=minimal' });
export const adminCommissions = async () => (await db('membership_commissions', { query: 'select=id,order_id,mosque_id,base_amount,pct,amount,status,created_at&order=created_at.desc&limit=200' })) || [];
export const setCommissionStatus = (id, status) => db('rpc/membership_commission_status', { method: 'POST', body: { p_id: id, p_status: status } });
export const newQrisPath = () => 'qris-' + Date.now() + '.png';
export const uploadQris = (path, blob) => storageUpload(path, blob, ASSET_BUCKET);
export function validateAccount(f) {
  const bank = cleanName(f.bank), holder = cleanName(f.holder), number = String(f.number || '').trim();
  if (bank.length < 2 || bank.length > 40) return { error: 'Nama bank 2 sampai 40 huruf.', field: 'bank' };
  if (!/^[0-9 -]{5,30}$/.test(number)) return { error: 'Nomor rekening hanya angka (5 sampai 30 digit).', field: 'number' };
  if (holder.length < 3 || holder.length > 80) return { error: 'Nama pemilik rekening 3 sampai 80 huruf.', field: 'holder' };
  return { ok: { bank, number, holder } };
}
export function parsePct(v) { const s = String(v == null ? '' : v).trim().replace(',', '.'); if (s === '') return { ok: null }; const n = Number(s); return /^\d{1,3}(\.\d{1,2})?$/.test(s) && n >= 0 && n <= 100 ? { ok: n } : { error: 'Persentase 0 sampai 100 (boleh dua angka desimal).' }; }
export function parsePrice(v) { const d = String(v == null ? '' : v).replace(/^rp\.?\s*/i, '').replace(/[\s.]/g, ''); if (d === '') return { ok: null }; return /^\d{4,9}$/.test(d) && Number(d) >= 1000 && Number(d) <= 100000000 ? { ok: Number(d) } : { error: 'Harga 1.000 sampai 100.000.000 (angka saja).' }; }
// Hemat (%) paket dibanding membeli per bulan 1 bulan; null bila tidak ada hemat atau data belum lengkap.
export function savingPct(plan, plans) {
  const one = (plans || []).find(p => p.months === 1 && p.price);
  if (!one || !plan.price || plan.months <= 1) return null;
  const full = one.price * plan.months, pct = Math.round((1 - plan.price / full) * 100);
  return pct > 0 ? pct : null;
}
