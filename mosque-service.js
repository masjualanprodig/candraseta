// BAITUNA - mosque-service.js
// Komunikasi data dengan backend untuk masjid dan keanggotaan.
// (Nanti dipindah ke js/services/ saat struktur folder dipulihkan.)
import { db, storageUpload, storageRemove, GALLERY_BUCKET } from './supabase.js';

const enc = encodeURIComponent;

export async function fetchIsSuperAdmin(userId) {
  const rows = await db('platform_admins', { query: 'select=user_id&user_id=eq.' + enc(userId) });
  return Array.isArray(rows) && rows.length > 0;
}

// Status Admin Masjid yang melekat di akun (admin_akun.sql). Bila fiturnya belum dipasang di server: dianggap tidak ada.
export async function fetchIsMasjidAdmin(userId) {
  try { const rows = await db('admin_accounts', { query: 'select=user_id&status=eq.active&user_id=eq.' + enc(userId) }); return Array.isArray(rows) && rows.length > 0; }
  catch (e) { if (e && e.status === 401) throw e; return false; }
}

export async function fetchMemberships(userId) {
  const rows = await db('mosque_members', { query: 'select=role,mosques(id,name,status)&status=eq.active&user_id=eq.' + enc(userId) });
  return rows || [];
}

export async function listMosques() {
  const rows = await db('mosques', { query: 'select=id,name,city,province,status,status_reason,created_at&order=created_at.desc' });
  return Array.isArray(rows) ? rows : [];
}

// Admin Masjid mendaftarkan masjid baru (status menunggu verifikasi Super Admin). Dijaga fungsi database mosque_register.
export async function registerMosque(f) {
  return db('rpc/mosque_register', { method: 'POST', body: { p_name: f.name, p_city: f.city || null, p_province: f.province || null, p_district: f.district || null, p_phone: f.phone || null, p_address: f.address || null, p_maps_url: f.mapsUrl || null, p_lat: f.lat == null ? null : f.lat, p_lng: f.lng == null ? null : f.lng } });
}
// Super Admin: data lengkap satu masjid untuk pemeriksaan pendaftaran (termasuk pendaftar & tanggal).
export async function getMosqueReview(id) {
  const cols = 'id,name,address,city,province,district,contact_phone,status,status_reason,latitude,longitude,photo_path,photos,maps_url,created_at,created_by';
  const rows = await db('mosques', { query: 'select=' + cols + '&id=eq.' + enc(id) });
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
export async function getRegistrant(userId) {
  const rows = await db('profiles', { query: 'select=id,full_name,phone&id=eq.' + enc(userId) });
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
// Super Admin menghapus permanen masjid yang nonaktif/ditolak (fungsi database admin_mosque_delete). Mengembalikan path foto lama (bila ada).
export async function deleteMosque(id) {
  return db('rpc/admin_mosque_delete', { method: 'POST', body: { p_id: id } });
}
// Foto galeri masjid (maks 10, tiap foto <= 100 KB): diunggah ke bucket "mosque-gallery" lalu daftarnya disimpan lewat mosque_set_photos.
export const MAX_GALLERY = 10;
export async function setGallery(mosqueId, paths) {
  return db('rpc/mosque_set_photos', { method: 'POST', body: { p_id: mosqueId, p_photos: paths } });
}
// existing = foto yang sudah ada (dipertahankan); blobs = foto baru yang ditambahkan.
export async function saveGallery(mosqueId, blobs, existing = []) {
  const paths = [], stamp = Date.now();
  let failed = 0;
  for (let i = 0; i < blobs.length; i++) {
    const path = mosqueId + '/' + (stamp + i) + '.jpg';
    try { await storageUpload(path, blobs[i], GALLERY_BUCKET); paths.push(path); } catch (e) { failed++; }
  }
  if (paths.length) {
    try { await setGallery(mosqueId, existing.concat(paths)); }
    catch (e) { for (const p of paths) storageRemove(p, GALLERY_BUCKET).catch(() => {}); throw e; } // unggahan yatim dibersihkan
  }
  return { saved: paths.length, failed };
}
// Masjid yang saya kelola (semua status), termasuk yang masih menunggu verifikasi.
export async function myAdminMosques(userId) {
  const rows = await db('mosque_members', { query: 'select=role,mosques(id,name,city,province,status,status_reason,created_at)&status=eq.active&role=eq.admin_masjid&user_id=eq.' + enc(userId) });
  return (Array.isArray(rows) ? rows : []).map(r => r.mosques).filter(Boolean).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

// RLS bisa membuat perubahan "berhasil" tanpa mengubah baris; karena itu hasilnya diperiksa.
export async function updateMosqueStatus(id, status, reason) {
  const out = await db('mosques', {
    method: 'PATCH', query: 'id=eq.' + enc(id), prefer: 'return=representation',
    body: { status, status_reason: reason || null }
  });
  if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak berubah'), { status: 403 });
}

/* ===== Undangan pengurus ===== */
export async function listInvitations() {
  const rows = await db('mosque_invitations', { query: 'select=id,mosque_id,email,role,status,expires_at,created_at&order=created_at.desc' });
  return Array.isArray(rows) ? rows : [];
}

export async function createInvitation(mosqueId, email, role) {
  await db('mosque_invitations', { method: 'POST', prefer: 'return=minimal', body: { mosque_id: mosqueId, email: email.trim().toLowerCase(), role, status: 'pending' } });
}

export async function revokeInvitation(id) {
  const out = await db('mosque_invitations', {
    method: 'PATCH', query: 'id=eq.' + enc(id) + '&status=eq.pending', prefer: 'return=representation', body: { status: 'revoked' }
  });
  if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak berubah'), { status: 403 });
}

// Dipanggil setelah login. Mengembalikan jumlah undangan yang baru diterima (0 jika tidak ada/belum tersedia).
export async function acceptMyInvitations() {
  try {
    const n = await db('rpc/accept_my_invitations', { method: 'POST', body: {} });
    return Number(n) || 0;
  } catch (e) { if (e.status === 401) throw e; return 0; }
}

/* ===== Tahap 3: pengelolaan masjid oleh Admin Masjid ===== */
export async function getMosque(id) {
  const rows = await db('mosques', { query: 'select=id,name,address,city,province,district,contact_phone,status,status_reason,description,facilities,latitude,longitude,timezone,photo_path,photos,maps_url&id=eq.' + enc(id) });
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

// Hanya data umum. Status tidak dikirim (database juga menolak perubahan status oleh non-Super Admin).
export async function updateMosqueProfile(id, f) {
  const out = await db('mosques', {
    method: 'PATCH', query: 'id=eq.' + enc(id), prefer: 'return=representation',
    body: {
      name: f.name, address: f.address, city: f.city, province: f.province, contact_phone: f.contact_phone,
      description: f.description, facilities: f.facilities, timezone: f.timezone,
      // Lokasi hanya dikirim bila tautan Google Maps diubah (koordinat ikut dari tautan).
      ...(f.maps_url !== undefined ? { maps_url: f.maps_url, latitude: f.latitude, longitude: f.longitude } : {})
    }
  });
  if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak berubah'), { status: 403 });
}

export async function fetchTeam(mosqueId) {
  const rows = await db('rpc/mosque_team', { method: 'POST', body: { p_mosque: mosqueId } });
  return Array.isArray(rows) ? rows : [];
}

export async function revokeMember(memberId) {
  await db('rpc/revoke_member', { method: 'POST', body: { p_member: memberId } });
}

// Menyimpan lokasi foto (atau null untuk menghapus). Hasilnya diperiksa agar tidak ada "sukses palsu".
export async function setMosquePhoto(id, path) {
  const out = await db('mosques', { method: 'PATCH', query: 'id=eq.' + enc(id), prefer: 'return=representation', body: { photo_path: path } });
  if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak berubah'), { status: 403 });
}

/* ===== Daftar pengurus (tanpa undangan; lihat pengurus_daftar.sql) ===== */
export const POSITION_LABEL = { ketua_takmir: 'Ketua Takmir', sekretaris: 'Sekretaris', bendahara: 'Bendahara', sarana_prasarana: 'Sarana & Prasarana', pendidikan_remaja: 'Pendidikan & Remaja Masjid' };
export const positionRole = p => p === 'ketua_takmir' ? 'ketua_takmir' : p === 'bendahara' ? 'bendahara' : 'pengurus_bagian';
// null bila tabel belum ada (pengurus_daftar.sql belum dijalankan).
export async function listOfficers(mosqueId) {
  try {
    const rows = await db('mosque_officers', { query: 'select=id,full_name,position,email,created_at&mosque_id=eq.' + enc(mosqueId) + '&order=created_at.asc' });
    return Array.isArray(rows) ? rows : [];
  } catch (e) { if (e && e.status === 401) throw e; return null; }
}
export async function addOfficer(mosqueId, name, position, email) {
  await db('rpc/officer_add', { method: 'POST', body: { p_mosque: mosqueId, p_name: name, p_position: position, p_email: email || null } });
}
export async function removeOfficer(id) { await db('rpc/officer_remove', { method: 'POST', body: { p_id: id } }); }
