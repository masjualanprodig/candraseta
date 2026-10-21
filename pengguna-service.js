// BAITUNA - pengguna-service.js
// Super Admin: daftar akun terdaftar dan penetapan Admin Masjid. Semua lewat fungsi database (lihat pengguna.sql);
// keamanan sebenarnya dijaga di database.
import { db } from './supabase.js';

export const PAGE = 30;
export const FILTERS = [['semua', 'Semua'], ['admin', 'Admin Masjid'], ['umum', 'Pengguna umum']];
export const ROLE_NAME = { ketua_takmir: 'Ketua Takmir', bendahara: 'Bendahara', pengurus_bagian: 'Pengurus Bagian', pengelola_usaha: 'Pengelola Unit Usaha', jamaah: 'Jamaah' };

export const listUsers = async ({ q = '', filter = 'semua', offset = 0, limit = PAGE } = {}) =>
  (await db('rpc/admin_users_list', { method: 'POST', body: { p_q: q.trim().slice(0, 60) || null, p_filter: filter, p_limit: limit, p_offset: offset } })) || [];
export const setMasjidAdmin = (userId, mosqueId) => db('rpc/admin_set_masjid_admin', { method: 'POST', body: { p_user: userId, p_mosque: mosqueId } });
export const unsetMasjidAdmin = userId => db('rpc/admin_unset_masjid_admin', { method: 'POST', body: { p_user: userId } });

// Status tampilan sebuah akun: 'super' | 'admin' | 'umum'
export const statusOf = u => u.is_super ? 'super' : (Array.isArray(u.admins) && u.admins.length ? 'admin' : 'umum');
export const otherRoles = u => (u.other_roles || []).map(r => ROLE_NAME[r] || r);

export const notReady = e => !!e && (e.status === 404 || e.code === 'PGRST202');
export function errorText(e) {
  if (e && e.status === 0) return 'Tidak ada koneksi internet. Coba lagi saat online.';
  if (notReady(e)) return 'Fitur Pengguna belum aktif di server. Jalankan pengguna.sql di Supabase.';
  if (e && (e.status === 403 || e.code === '42501')) return 'Hanya Super Admin yang boleh mengelola pengguna.';
  if (e && e.code === '22023' && e.message) return e.message.charAt(0).toUpperCase() + e.message.slice(1) + '.';
  return 'Belum berhasil. Coba lagi.';
}
