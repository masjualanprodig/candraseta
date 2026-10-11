// BAITUNA - profile-service.js
// Profil pengguna yang sedang masuk. Hanya nama dan telepon yang bisa diubah, dan hanya milik sendiri (dijaga RLS).
// Email dan peran tidak diubah dari sini.
import { db, request, getSession, storageUpload, storageRemove, storageBlobUrl, AVATAR_BUCKET } from './supabase.js';
import { newAvatarPath } from './photo.js';

const enc = encodeURIComponent;
export async function getMyProfile(userId) {
  const rows = await db('profiles', { query: 'select=full_name,phone,avatar_path&id=eq.' + enc(userId) });
  return Array.isArray(rows) && rows[0] ? rows[0] : { full_name: null, phone: null, avatar_path: null };
}
export async function updateMyProfile(userId, f) {
  const out = await db('profiles', { method: 'PATCH', query: 'id=eq.' + enc(userId), prefer: 'return=representation', body: { full_name: f.full_name || null, phone: f.phone || null } });
  if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak berubah'), { status: 403 });
  return out[0];
}

/* ===== Foto profil (bucket privat "avatars", folder = id pengguna) ===== */
const setAvatarPath = async (userId, path) => {
  const out = await db('profiles', { method: 'PATCH', query: 'id=eq.' + enc(userId), prefer: 'return=representation', body: { avatar_path: path } });
  if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak berubah'), { status: 403 });
  return out[0];
};
// Unggah foto baru lalu simpan lokasinya; bila penyimpanan lokasi gagal, file baru dibuang agar tidak menggantung. Foto lama dihapus terakhir.
export async function saveAvatar(userId, blob, oldPath) {
  const path = newAvatarPath(userId);
  await storageUpload(path, blob, AVATAR_BUCKET);
  try { await setAvatarPath(userId, path); }
  catch (e) { try { await storageRemove(path, AVATAR_BUCKET); } catch (x) { /* abaikan */ } throw e; }
  if (oldPath && oldPath !== path) { try { await storageRemove(oldPath, AVATAR_BUCKET); } catch (x) { /* abaikan */ } }
  return path;
}
export async function deleteAvatar(userId, oldPath) {
  await setAvatarPath(userId, null);
  if (oldPath) { try { await storageRemove(oldPath, AVATAR_BUCKET); } catch (x) { /* abaikan */ } }
}
const urlCache = new Map();
export async function avatarUrl(path) {
  if (!path) return null;
  if (!urlCache.has(path)) urlCache.set(path, storageBlobUrl(path, AVATAR_BUCKET).catch(e => { urlCache.delete(path); throw e; }));
  return urlCache.get(path);
}

/* ===== Murni (dites terpisah) ===== */
export const cleanName = v => String(v || '').replace(/\s+/g, ' ').trim();
export const nameOk = v => v.length === 0 || (v.length >= 2 && v.length <= 120);
export const phoneOk = v => v.length === 0 || (/^[0-9+()\s-]{6,30}$/.test(v) && v.replace(/\D/g, '').length >= 6);
export function initials(name, email) {
  const w = cleanName(name).split(' ').filter(Boolean);
  if (w.length >= 2) return (w[0][0] + w[1][0]).toUpperCase();
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return String(email || '?').trim().charAt(0).toUpperCase() || '?';
}
export function passwordProblem(cur, a, b) {
  if (!cur) return 'Isi password saat ini.';
  if (a.length < 8) return 'Password baru minimal 8 karakter.';
  if (a === cur) return 'Password baru harus berbeda dari yang lama.';
  if (a !== b) return 'Konfirmasi password baru tidak sama.';
  return '';
}

// Ganti password: password lama diperiksa dulu lewat proses masuk (sesi sekarang tidak diganti), lalu password baru disimpan.
export async function changePassword(current, next) {
  const s = getSession(); if (!s || !s.user || !s.user.email) return { ok: false, error: 'Sesi berakhir. Silakan masuk lagi.' };
  const chk = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: s.user.email, password: current } });
  if (chk.status === 0) return { ok: false, error: 'Tidak ada koneksi internet.' };
  if (!chk.ok) return { ok: false, error: chk.status === 429 ? 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' : 'Password saat ini salah.' };
  const r = await request('/auth/v1/user', { method: 'PUT', token: s.access_token, body: { password: next } });
  if (r.status === 0) return { ok: false, error: 'Tidak ada koneksi internet.' };
  if (!r.ok) return { ok: false, error: 'Password belum bisa diganti. Coba lagi, atau keluar lalu masuk kembali.' };
  return { ok: true };
}
