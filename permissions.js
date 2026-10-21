// BAITUNA - permissions.js
// Pemeriksaan hak akses untuk ANTARMUKA (kenyamanan pengguna).
// Keamanan sebenarnya dijaga RLS di database, bukan oleh file ini.
import { fetchIsSuperAdmin, fetchMemberships, fetchIsMasjidAdmin } from './mosque-service.js';

export const INVITE_ROLES = ['admin_masjid', 'ketua_takmir', 'bendahara', 'pengurus_bagian', 'pengelola_usaha'];

export const ROLE_LABEL = {
  admin_masjid: 'Admin Masjid', ketua_takmir: 'Ketua Takmir', bendahara: 'Bendahara',
  pengurus_bagian: 'Pengurus Bagian', pengelola_usaha: 'Pengelola Unit Usaha', jamaah: 'Jamaah'
};

// Mengambil hak akses pengguna: Super Admin platform atau anggota masjid tertentu.
export async function loadAccess(user) {
  const isAdmin = await fetchIsSuperAdmin(user.id);
  const memberships = isAdmin ? [] : await fetchMemberships(user.id);
  const isMasjidAdmin = isAdmin ? false : await fetchIsMasjidAdmin(user.id);
  return { isAdmin, memberships, isMasjidAdmin };
}

export const hasRole = (memberships, mosqueId, ...roles) =>
  memberships.some(m => m.mosques && m.mosques.id === mosqueId && roles.includes(m.role));
