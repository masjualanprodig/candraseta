// BAITUNA - puasa-service.js
// Aturan puasa (wajib, sunnah, dilarang) per tanggal Hijriah. Fungsi murni, tanpa jaringan.
// Tanggal Hijriah berasal dari kalender Umm al-Qura (perkiraan); penetapan resmi di Indonesia mengikuti Kemenag.
// Isi penjelasan sengaja ringkas dan umum; tidak mengutip dalil dari ingatan. Perlu ditinjau ustaz sebelum rilis.
import { HIJRI_MONTH, hijriOf } from './islamic-calendar.js';

// Kelompok pengaturan notifikasi puasa.
export const FAST_GROUPS = {
  senin_kamis: 'Puasa Senin & Kamis',
  ayyamul_bidh: 'Puasa Ayyamul Bidh (tanggal 13, 14, 15 Hijriah)',
  hari_utama: 'Arafah, Tasu’a, Asyura, 6 Syawal, dan hari utama lainnya',
  ramadan: 'Ramadan, hari raya, dan hari yang dilarang berpuasa'
};

export const LEVEL_LABEL = { wajib: 'Puasa wajib', sunnah: 'Puasa sunnah', anjuran: 'Dianjurkan', larangan: 'Dilarang berpuasa', none: 'Tidak ada puasa khusus' };

export const NONE_TEXT = 'Tidak ada puasa wajib atau puasa sunnah khusus yang terkait dengan tanggal ini. Puasa qadha, nazar, atau puasa Daud tetap dapat dikerjakan pada hari yang tidak dilarang.';

const it = (key, group, kind, name, desc) => ({ key, group, kind, name, desc });

// Semua puasa yang berlaku pada tanggal Hijriah h = {d, m, y} dan hari dalam pekan dow (0 = Minggu).
export function fastingFor(h, dow) {
  if (!h) return { level: 'none', items: [] };
  const items = [];
  const { d, m } = h;
  if (m === 9) {
    items.push(it('ramadan', 'ramadan', 'wajib', 'Puasa Ramadan',
      'Puasa wajib bagi muslim yang memenuhi syarat sepanjang bulan Ramadan. Awal dan akhir Ramadan ditetapkan pemerintah melalui sidang isbat, jadi bisa berbeda 1–2 hari dari perkiraan di sini.'));
  } else if (m === 10 && d === 1) {
    items.push(it('larang_idulfitri', 'ramadan', 'larangan', 'Idulfitri: tidak berpuasa', 'Berpuasa pada hari raya Idulfitri tidak diperbolehkan.'));
  } else if (m === 12 && d === 10) {
    items.push(it('larang_iduladha', 'ramadan', 'larangan', 'Iduladha: tidak berpuasa', 'Berpuasa pada hari raya Iduladha tidak diperbolehkan.'));
  } else if (m === 12 && d >= 11 && d <= 13) {
    items.push(it('larang_tasyrik', 'ramadan', 'larangan', 'Hari tasyrik: tidak berpuasa', 'Tanggal 11–13 Zulhijah adalah hari tasyrik, saat berpuasa tidak diperbolehkan. Jika ada kondisi khusus (misalnya sedang berhaji), tanyakan kepada ustaz.'));
  }
  if (!items.length) {
    if (m === 12 && d === 9) items.push(it('arafah', 'hari_utama', 'sunnah', 'Puasa Arafah', 'Puasa sunnah pada 9 Zulhijah bagi yang tidak sedang berhaji. Tanggalnya di Indonesia mengikuti penetapan pemerintah.'));
    if (m === 1 && d === 9) items.push(it('tasua', 'hari_utama', 'sunnah', 'Puasa Tasu’a', 'Puasa sunnah pada 9 Muharram, dianjurkan menyertai puasa Asyura (10 Muharram).'));
    if (m === 1 && d === 10) items.push(it('asyura', 'hari_utama', 'sunnah', 'Puasa Asyura', 'Puasa sunnah pada 10 Muharram, hari Asyura.'));
    if (m === 10 && d >= 2) items.push(it('syawal6', 'hari_utama', 'sunnah', 'Puasa 6 hari Syawal', 'Puasa sunnah enam hari di bulan Syawal setelah Ramadan. Dapat dikerjakan pada hari mana pun di bulan Syawal selain 1 Syawal.'));
    if (d >= 13 && d <= 15) items.push(it('ayyamul_bidh', 'ayyamul_bidh', 'sunnah', 'Puasa Ayyamul Bidh', 'Puasa sunnah pada tanggal 13, 14, dan 15 setiap bulan Hijriah (hari-hari bulan purnama).'));
    if (dow === 1 || dow === 4) items.push(it(dow === 1 ? 'senin' : 'kamis', 'senin_kamis', 'sunnah', 'Puasa ' + (dow === 1 ? 'Senin' : 'Kamis'), 'Puasa sunnah yang rutin dikerjakan setiap pekan pada hari Senin dan Kamis.'));
    if (m === 12 && d >= 1 && d <= 8) items.push(it('zulhijah', 'hari_utama', 'anjuran', 'Sepuluh hari pertama Zulhijah', 'Hari-hari yang utama untuk memperbanyak amal saleh. Sebagian ulama menganjurkan berpuasa pada 1–9 Zulhijah.'));
    if (m === 1) items.push(it('muharram', 'hari_utama', 'anjuran', 'Bulan Muharram', 'Muharram adalah salah satu bulan haram. Dianjurkan memperbanyak puasa sunnah di bulan ini.'));
    if (m === 8) items.push(it('syaban', 'hari_utama', 'anjuran', 'Bulan Syaban', 'Nabi Muhammad SAW banyak berpuasa di bulan Syaban, bulan sebelum Ramadan.'));
  }
  const kinds = items.map(x => x.kind);
  const level = kinds.includes('wajib') ? 'wajib' : kinds.includes('larangan') ? 'larangan' : kinds.includes('sunnah') ? 'sunnah' : kinds.includes('anjuran') ? 'anjuran' : 'none';
  return { level, items };
}

// Hari dalam pekan (0 = Minggu) untuk tanggal Masehi.
export const dowOf = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();

// Ringkasan satu baris, mis. "Puasa Senin, Puasa Ayyamul Bidh".
export const fastingLabel = f => f.items.filter(x => x.kind !== 'anjuran' || f.level === 'anjuran').map(x => x.name).join(', ');

export const hijriLabel = h => h ? h.d + ' ' + HIJRI_MONTH[h.m - 1] : '';

// Hitung mundur Ramadan. Mengembalikan:
//  { phase: 'sebelum', inDays, y, m, d, hijriYear }  (awal Ramadan berikutnya, perkiraan)
//  { phase: 'ramadan', day, daysToEid }               (sedang Ramadan: hari ke-, sisa hari menuju 1 Syawal)
//  null bila kalender Hijriah tidak tersedia
export function ramadanStatus(y, m, d) {
  const h0 = hijriOf(y, m, d); if (!h0) return null;
  if (h0.m === 9) {
    for (let i = 1; i <= 31; i++) {
      const dt = new Date(Date.UTC(y, m - 1, d + i, 12)), h = hijriOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
      if (h && h.m === 10 && h.d === 1) return { phase: 'ramadan', day: h0.d, daysToEid: i };
    }
    return { phase: 'ramadan', day: h0.d, daysToEid: null };
  }
  for (let i = 1; i <= 400; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i, 12)), gy = dt.getUTCFullYear(), gm = dt.getUTCMonth() + 1, gd = dt.getUTCDate(), h = hijriOf(gy, gm, gd);
    if (h && h.m === 9 && h.d === 1) return { phase: 'sebelum', inDays: i, y: gy, m: gm, d: gd, hijriYear: h.y };
  }
  return null;
}
// "128 hari lagi (sekitar 18 pekan 2 hari)"
export function daysText(n) {
  if (n < 7) return n + ' hari lagi';
  const w = Math.floor(n / 7), r = n % 7;
  return n + ' hari lagi (sekitar ' + w + ' pekan' + (r ? ' ' + r + ' hari' : '') + ')';
}
export const RAMADAN_MILESTONES = [100, 60, 30, 14, 7, 3, 1];
