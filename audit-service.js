// BAITUNA - audit-service.js
// Jejak audit (4C): hanya dibaca. Super Admin melihat semua; Admin Masjid hanya masjidnya.
import { db } from './supabase.js';
import { rp } from './market-service.js';

export const PAGE = 30;
export const GROUPS = [['', 'Semua'], ['kas', 'Kas'], ['invitation', 'Undangan'], ['member', 'Pengurus'], ['mosque', 'Masjid'], ['jamaah', 'Jamaah'], ['book', 'Buku'], ['qa', 'Tanya Jawab'], ['tampilan', 'Tampilan']];
export const LABEL = {
  mosque_created: 'Masjid didaftarkan', mosque_status_changed: 'Status masjid diubah', mosque_deleted: 'Masjid dihapus',
  invitation_created: 'Undangan dibuat', invitation_accepted: 'Undangan diterima', invitation_revoked: 'Undangan dibatalkan', member_revoked: 'Pengurus dicabut', member_admin_assigned: 'Dijadikan Admin Masjid', member_admin_removed: 'Admin Masjid dikembalikan jadi pengguna umum',
  kas_entry_added: 'Catatan kas ditambah', kas_entry_reversed: 'Catatan kas dikoreksi', kas_month_closed: 'Buku bulan ditutup', kas_month_reopened: 'Buku bulan dibuka kembali',
  kas_public_summary: 'Ringkasan kas publik diubah', kas_favorite_saved: 'Transaksi favorit disimpan', kas_favorite_deleted: 'Transaksi favorit dihapus', kas_input_mode: 'Mode input kas diubah', kas_account_created: 'Akun kas dibuat', kas_account_updated: 'Akun kas diubah', kas_category_created: 'Kategori kas dibuat', kas_category_updated: 'Kategori kas diubah',
  jamaah_applied: 'Pendaftaran jamaah diajukan', jamaah_approved: 'Jamaah disetujui', jamaah_rejected: 'Jamaah ditolak / dicabut',
  book_created: 'Buku ditambah', book_updated: 'Buku diubah', book_deleted: 'Buku dihapus',
  qa_answerer_added: 'Penjawab ditambah', qa_answerer_updated: 'Penjawab diubah', qa_answerer_removed: 'Penjawab dihapus', qa_question_deleted: 'Pertanyaan dihapus', tampilan_changed: 'Tampilan aplikasi diubah', tampilan_reset: 'Tampilan aplikasi dikembalikan ke bawaan'
};
export const actionLabel = a => LABEL[a] || String(a || '').replace(/_/g, ' ');

const MONEY = new Set(['amount', 'saldo_akhir', 'opening']);
const KEYNAME = { item: 'bagian', name: 'nama', title: 'judul', role: 'peran', status: 'status', from: 'dari', to: 'menjadi', reason: 'alasan', email: 'email', amount: 'jumlah', direction: 'arah', date: 'tanggal', month: 'bulan', saldo_akhir: 'saldo akhir', opening: 'saldo awal', active: 'aktif', on: 'aktif', fields: 'bagian', was: 'sebelumnya' };
const HIDE = k => /(^|_)id$/.test(k) || ['entry', 'account', 'category', 'reverses', 'user_id'].includes(k);
const val = (k, v) => {
  if (Array.isArray(v)) return v.map(x => String(x)).join(', ');
  if (typeof v === 'boolean') return v ? 'ya' : 'tidak';
  if (MONEY.has(k) && Number.isFinite(Number(v))) return rp(Number(v));
  return String(v == null ? '' : v);
};
// Ringkasan isi log yang aman: tanpa id, panjang dibatasi, hanya teks.
export function describe(details) {
  if (!details || typeof details !== 'object') return '';
  return Object.keys(details).filter(k => !HIDE(k) && details[k] != null && details[k] !== '').slice(0, 6)
    .map(k => (KEYNAME[k] || k) + ': ' + val(k, details[k]).slice(0, 120)).join(' · ');
}

// before: baris terakhir halaman sebelumnya ({created_at, id}); waktu dikirim apa adanya agar mikrodetik tidak hilang.
export const list = async ({ mosque = null, group = '', before = null, limit = PAGE } = {}) =>
  (await db('rpc/audit_list', { method: 'POST', body: { p_mosque: mosque || null, p_group: group || null, p_before: before ? before.created_at : null, p_before_id: before ? before.id : null, p_limit: limit } })) || [];
export const notReady = e => !!e && (e.status === 404 || e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === '42P01');
export function errorText(e) {
  if (e && e.status === 0) return 'Tidak ada koneksi internet. Coba lagi saat online.';
  if (notReady(e)) return 'Jejak audit belum aktif di server. Jalankan daftar_audit.sql.';
  if (e && (e.status === 403 || e.code === '42501')) return 'Anda tidak memiliki izin melihat jejak audit.';
  return 'Belum berhasil dimuat. Coba lagi.';
}
