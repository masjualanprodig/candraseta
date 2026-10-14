// BAITUNA - jamaah-service.js
// Pendaftaran jamaah (4B): pengguna mengajukan, HANYA Super Admin yang menyetujui atau menolak.
import { db, request } from './supabase.js';

export const LIMIT = { noteMax: 200, reasonMin: 3, reasonMax: 200, tries: 3 };
export const STATUS_LABEL = { pending: 'Menunggu persetujuan', approved: 'Disetujui', rejected: 'Ditolak' };
export const TABS = [['pending', 'Menunggu'], ['approved', 'Disetujui'], ['rejected', 'Ditolak']];

const rpc = (name, body) => db('rpc/' + name, { method: 'POST', body: body || {} });
export const clean = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
export const notReady = e => !!e && (e.status === 404 || e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === '42P01');

/* ===== Pemeriksaan isian ===== */
export function checkApply({ name, note }) {
  if (clean(name).length < 2) return { error: 'Isi nama lengkap di Ubah Profil dulu.' };
  const n = clean(note);
  if (n.length > LIMIT.noteMax) return { error: 'Catatan maksimal ' + LIMIT.noteMax + ' huruf.' };
  return { ok: { note: n || null } };
}
export function checkReason(r) { const s = clean(r); return s.length < LIMIT.reasonMin || s.length > LIMIT.reasonMax ? null : s; }
export const canReapply = s => !!s && s.status === 'rejected' && Number(s.attempts) < LIMIT.tries;

/* ===== Server ===== */
export const myStatus = async () => { const r = await rpc('jamaah_my_status'); return Array.isArray(r) && r[0] ? r[0] : null; };
export const apply = (mosqueId, note) => rpc('jamaah_apply', { p_mosque: mosqueId || null, p_note: clean(note) || null });
export const queue = async status => (await rpc('jamaah_queue', { p_status: status })) || [];
export const pendingCount = async () => Number(await rpc('jamaah_pending_count')) || 0;
export const decide = (userId, approve, reason) => rpc('jamaah_decide', { p_user: userId, p_approve: !!approve, p_reason: approve ? null : clean(reason) });

// Daftar masjid aktif untuk pilihan (publik, maksimal 300).
export async function activeMosques() {
  const r = await request('/rest/v1/mosques?select=id,name,city&status=eq.active&order=name.asc&limit=300');
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

export function errorText(e) {
  if (e && e.status === 0) return 'Tidak ada koneksi internet. Coba lagi saat online.';
  if (notReady(e)) return 'Fitur ini belum aktif di server. Jalankan daftar_audit.sql.';
  if (e && e.status === 401) return 'Sesi berakhir. Masuk lagi.';
  if (e && (e.status === 403 || e.code === '42501')) return 'Anda tidak memiliki izin untuk tindakan ini.';
  if (e && e.code === '54000') return 'Batas pendaftaran ulang tercapai. Hubungi admin pusat lewat Kritik & Saran.';
  if (e && (e.code === '22023' || e.code === 'P0002') && e.message) return e.message.charAt(0).toUpperCase() + e.message.slice(1) + '.';
  return 'Belum berhasil. Coba lagi.';
}
