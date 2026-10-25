// BAITUNA - taaruf-service.js
// BAITUNA Ta'aruf: semua aturan penting (usia, kuota 2 profil unik, Premium, persetujuan dua arah, privasi) dijaga SERVER (taaruf.sql).
// File ini hanya memanggil fungsi server dan menyiapkan label/validasi untuk tampilan.
import { db } from './supabase.js';

const rpc = (name, body) => db('rpc/' + name, { method: 'POST', body: body || {} });

/* ===== Label ===== */
export const PROVINCES = ['Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau', 'Jambi', 'Bengkulu', 'Sumatera Selatan', 'Kepulauan Bangka Belitung', 'Lampung',
  'Banten', 'DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur', 'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur',
  'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara',
  'Sulawesi Utara', 'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Barat', 'Sulawesi Selatan', 'Sulawesi Tenggara',
  'Maluku', 'Maluku Utara', 'Papua', 'Papua Barat', 'Papua Barat Daya', 'Papua Tengah', 'Papua Pegunungan', 'Papua Selatan'];
export const EDU = [['sd', 'SD'], ['smp', 'SMP'], ['sma', 'SMA/SMK/MA'], ['d3', 'Diploma'], ['s1', 'S1'], ['s2', 'S2'], ['s3', 'S3'], ['lainnya', 'Lainnya']];
export const EDU_MIN = [['', 'Tidak masalah'], ['sma', 'Minimal SMA'], ['d3', 'Minimal Diploma'], ['s1', 'Minimal S1'], ['s2', 'Minimal S2']];
export const MARITAL = [['lajang', 'Belum pernah menikah'], ['duda', 'Duda'], ['janda', 'Janda']];
export const READY = [['siap', 'Siap menikah'], ['6bln', 'Dalam 6 bulan'], ['1th', 'Dalam 1 tahun'], ['2th', 'Dalam 1–2 tahun']];
export const RESIDENCE = [['sendiri', 'Tinggal mandiri'], ['ortu', 'Bersama orang tua'], ['mertua', 'Bersama mertua'], ['fleksibel', 'Fleksibel / dimusyawarahkan']];
export const KIDS = [['ingin', 'Ingin segera punya anak'], ['belum', 'Belum dalam waktu dekat'], ['fleksibel', 'Dimusyawarahkan']];
export const VALUES = [['salat_waktu', 'Salat tepat waktu'], ['mengaji', 'Mengaji rutin'], ['kajian', 'Rutin ikut kajian'], ['hafalan', 'Menghafal Al-Qur’an'],
  ['ingin_anak', 'Ingin punya anak'], ['sederhana', 'Hidup sederhana'], ['sosial', 'Aktif kegiatan sosial']];
export const TOPICS = [['kenal', 'Pengenalan awal'], ['visi', 'Visi dan tujuan pernikahan'], ['tinggal', 'Tempat tinggal dan rencana keluarga'], ['keuangan', 'Keuangan dan tanggung jawab'],
  ['kerja', 'Pekerjaan dan rencana masa depan'], ['anak', 'Anak dan pola pengasuhan'], ['keluarga', 'Hubungan dengan keluarga besar'], ['komunikasi', 'Komunikasi dan penyelesaian konflik'],
  ['lanjut', 'Tahap keluarga / pertemuan berikutnya']];
export const REPORT_REASONS = [['palsu', 'Profil palsu atau data tidak benar'], ['tidak_sopan', 'Perilaku tidak sopan'], ['minta_uang', 'Meminta uang atau transfer'], ['penipuan', 'Dugaan penipuan'],
  ['di_bawah_umur', 'Diduga belum cukup umur'], ['sudah_menikah', 'Diduga masih terikat pernikahan'], ['lainnya', 'Lainnya (jelaskan)']];
export const INTRO_STATUS = {
  diajukan: { label: 'Menunggu respons', tone: 'warn' }, berjalan: { label: 'Proses berjalan', tone: 'ok' }, lanjut: { label: 'Lanjut ke tahap keluarga', tone: 'ok' },
  ditolak: { label: 'Belum dapat dilanjutkan', tone: 'off' }, dibatalkan: { label: 'Dibatalkan', tone: 'off' }, diakhiri: { label: 'Proses diakhiri', tone: 'off' }
};
const lab = (list, k) => (list.find(x => x[0] === k) || [k, ''])[1];
export const eduLabel = k => lab(EDU, k), maritalLabel = k => lab(MARITAL, k), readyLabel = k => lab(READY, k), residenceLabel = k => lab(RESIDENCE, k),
  kidsLabel = k => lab(KIDS, k), valueLabel = k => lab(VALUES, k), topicLabel = k => lab(TOPICS, k), reasonLabel = k => lab(REPORT_REASONS, k);
export const statusLabel = s => (INTRO_STATUS[s] || { label: s }).label;
export const statusTone = s => (INTRO_STATUS[s] || { tone: 'off' }).tone;
export const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

/* ===== Validasi (cermin aturan server; server tetap memeriksa ulang) ===== */
export const MIN_AGE = 19;   // UU No. 16 Tahun 2019 (perubahan UU Perkawinan): batas usia perkawinan 19 tahun
export function ageOf(dateStr, now = new Date()) {
  const d = new Date(dateStr + 'T00:00:00'); if (isNaN(d)) return null;
  let a = now.getFullYear() - d.getFullYear(); const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--; return a;
}
const hasContact = t => /\d{9,}/.test(String(t || '').replace(/[^0-9]/g, '')) || /(https?:\/\/|www\.|wa\.me|t\.me\/|instagram\.com)/i.test(String(t || ''));
export function validateProfile(f, publish) {
  const name = String(f.display_name || '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 40) return { error: 'Nama tampilan diisi 2 sampai 40 huruf (boleh nama panggilan).', field: 'display_name' };
  if (/\d{6,}/.test(name) || /(https?:\/\/|www\.|@)/i.test(name)) return { error: 'Nama tampilan tidak boleh berisi nomor atau alamat kontak.', field: 'display_name' };
  if (!['L', 'P'].includes(f.gender)) return { error: 'Pilih jenis kelamin.', field: 'gender' };
  const age = ageOf(f.birth_date);
  if (age == null) return { error: 'Isi tanggal lahir.', field: 'birth_date' };
  if (age < MIN_AGE) return { error: 'BAITUNA Ta’aruf hanya untuk usia ' + MIN_AGE + ' tahun ke atas.', field: 'birth_date' };
  if (age > 80) return { error: 'Tanggal lahir belum benar.', field: 'birth_date' };
  for (const k of ['about', 'family_hope', 'vision', 'extra', 'dependents', 'job', 'city']) if (hasContact(f[k])) return { error: 'Jangan menulis nomor telepon atau tautan di CV. Kontak hanya dibagikan setelah kedua pihak setuju.', field: k };
  if (publish) {
    if (!f.terms) return { error: 'Setujui ketentuan BAITUNA Ta’aruf terlebih dahulu.', field: 'terms' };
    if (!f.province) return { error: 'Pilih provinsi domisili.', field: 'province' };
    if (!String(f.city || '').trim()) return { error: 'Isi kota/kabupaten domisili.', field: 'city' };
    if (!f.education) return { error: 'Pilih pendidikan terakhir.', field: 'education' };
    if (!f.marital) return { error: 'Pilih status pernikahan.', field: 'marital' };
    if (!f.readiness) return { error: 'Pilih kesiapan menikah.', field: 'readiness' };
    if (String(f.about || '').trim().length < 30) return { error: 'Tulis "Tentang saya" minimal 30 huruf.', field: 'about' };
  }
  return { ok: true };
}

export function errorText(e) {
  const m = e && e.message;
  if (e && e.status === 0) return 'Tidak ada koneksi internet.';
  const map = {
    masuk: 'Silakan masuk dulu.', tutup: 'BAITUNA Ta’aruf sedang ditutup sementara oleh pengelola.', nonaktif: 'Profil Anda sedang dinonaktifkan pengelola. Hubungi admin bila ada pertanyaan.',
    nama: 'Nama tampilan diisi 2 sampai 40 huruf.', nama_kontak: 'Nama tampilan tidak boleh berisi nomor atau alamat kontak.', gender: 'Pilih jenis kelamin.',
    gender_tetap: 'Jenis kelamin tidak bisa diubah setelah CV diterbitkan.', lahir: 'Tanggal lahir belum benar.', usia: 'BAITUNA Ta’aruf hanya untuk usia ' + MIN_AGE + ' tahun ke atas.',
    kontak_di_cv: 'Jangan menulis nomor telepon atau tautan di CV.', ketentuan: 'Setujui ketentuan terlebih dahulu.', belum_lengkap: 'Lengkapi isian wajib sebelum menerbitkan CV.',
    belum_terbit: 'Terbitkan CV terlebih dahulu.', cv_dulu: 'Lengkapi dan terbitkan CV Ta’aruf Anda terlebih dahulu.', cv_aktif: 'Aktifkan profil Anda (tidak sedang jeda) untuk mengajukan minat.',
    usia_pref: 'Rentang usia belum benar.', kuota: 'Kuota profil gratis Saudaraku sudah digunakan.', tidak_ada: 'Profil atau data tidak tersedia.',
    buka_dulu: 'Buka profil calon terlebih dahulu.', sudah_ada: 'Sudah ada proses perkenalan dengan calon ini.', batas_proses: 'Batas proses perkenalan aktif sudah tercapai.',
    terlalu_sering: 'Terlalu banyak permintaan hari ini. Coba lagi besok.', sudah_diproses: 'Status sudah berubah. Muat ulang untuk melihat status terbaru.',
    tidak_tersedia: 'Profil calon sudah tidak tersedia.', premium: 'Fitur ini khusus Ta’aruf Premium.', kontak: 'Kontak diisi 5 sampai 200 huruf.',
    waktu: 'Pilih waktu paling cepat 1 jam lagi dan paling lambat 180 hari ke depan.', cara: 'Tulis cara/tempat pertemuan (3–120 huruf).', terlalu_banyak: 'Masih ada 5 usulan jadwal yang belum ditanggapi.',
    catatan_panjang: 'Catatan terlalu panjang.', alasan: 'Pilih alasan laporan.', alasan_isi: 'Jelaskan alasan laporan.', izin: 'Anda tidak memiliki izin untuk tindakan ini.',
    pilihan: 'Pilihan tidak dikenal.', harga: 'Harga tidak masuk akal (minimal Rp1.000).', pengaturan: 'Isian pengaturan belum benar.', topik: 'Topik tidak dikenal.', status: 'Status tidak dikenal.'
  };
  if (m && map[m]) return map[m];
  if (e && (e.status === 404 || e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === '42P01' || e.code === '42883')) return 'BAITUNA Ta’aruf belum aktif di server. Pengelola perlu menjalankan taaruf.sql.';
  if (e && (e.status === 403 || e.code === '42501')) return 'Anda tidak memiliki izin.';
  return 'Belum berhasil. Coba lagi.';
}
export const notReady = e => !!e && (e.status === 404 || e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === '42P01' || e.code === '42883');

/* ===== Server ===== */
export const state = () => rpc('tf_state');
export const saveProfile = (p, publish) => rpc('tf_save_profile', { p, p_publish: !!publish });
export const setStatus = s => rpc('tf_set_status', { p_status: s });
export const deleteProfile = () => rpc('tf_delete_profile');
export const savePrefs = p => rpc('tf_save_prefs', { p });
export const recommend = (offset = 0) => rpc('tf_recommend', { p_offset: offset });
export const open = id => rpc('tf_open', { p_target: id });
export const hide = id => rpc('tf_hide', { p_target: id });
export const send = id => rpc('tf_send', { p_target: id });
export const respond = (id, accept) => rpc('tf_respond', { p_id: id, p_accept: !!accept });
export const cancel = id => rpc('tf_cancel', { p_id: id });
export const decide = (id, choice) => rpc('tf_decide', { p_id: id, p_choice: choice });
export const shareContact = (id, contact) => rpc('tf_share_contact', { p_id: id, p_contact: contact || null });
export const intros = () => rpc('tf_intros');
export const intro = id => rpc('tf_intro', { p_id: id });
export const topic = (id, t, done) => rpc('tf_topic', { p_id: id, p_topic: t, p_done: !!done });
export const note = (id, body) => rpc('tf_note', { p_id: id, p_body: body || '' });
export const schedule = (id, at, mode, t) => rpc('tf_schedule', { p_id: id, p_at: at, p_mode: mode, p_topic: t || null });
export const scheduleSet = (sid, status) => rpc('tf_schedule_set', { p_sid: sid, p_status: status });
export const block = id => rpc('tf_block', { p_target: id });
export const unblock = id => rpc('tf_unblock', { p_target: id });
export const blocks = () => rpc('tf_blocks');
export const report = (target, introId, reason, note) => rpc('tf_report', { p_target: target, p_intro: introId || null, p_reason: reason, p_note: note || null });
/* Super Admin */
export const adminReports = status => rpc('tf_admin_reports', { p_status: status || null });
export const adminReportSet = (id, status, note) => rpc('tf_admin_report_set', { p_id: id, p_status: status, p_note: note || null });
export const adminFind = q => rpc('tf_admin_find', { p_q: q || '' });
export const adminVerify = (uid, ok, note) => rpc('tf_admin_verify', { p_user: uid, p_ok: !!ok, p_note: note || null });
export const adminProfile = (uid, active, note) => rpc('tf_admin_profile', { p_user: uid, p_active: !!active, p_note: note || null });
export const adminSettings = p => rpc('tf_admin_settings', { p });
export const adminStats = () => rpc('tf_admin_stats');
export const plans = async () => (await db('taaruf_plans', { query: 'select=code,name,months,price,active,sort&order=sort.asc' })) || [];
export const settings = async () => { const r = await db('taaruf_settings', { query: 'select=is_open,free_quota,free_active,premium_active' }); return r && r[0] || null; };

/* ===== Waktu ===== */
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const two = n => String(n).padStart(2, '0');
export const fmtDate = v => { const d = new Date(v); return isNaN(d) ? '' : d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear(); };
export const fmtWhen = v => { const d = new Date(v); return isNaN(d) ? '' : HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear() + ' • ' + two(d.getHours()) + '.' + two(d.getMinutes()); };
