// BAITUNA - amalan-service.js
// Amalan sunnah selain puasa yang terkait tanggal: salat gerhana, salat Id, malam ganjil Ramadan, hari Jumat.
// Fungsi murni. Keterangan ringkas dan umum, tidak mengutip dalil dari ingatan; perlu ditinjau ustaz sebelum rilis.
import { ECLIPSES, ECLIPSE_DATA_UNTIL } from './gerhana-data.js';
export { ECLIPSE_DATA_UNTIL };

const p2 = n => String(n).padStart(2, '0');
export const dateKey = (y, m, d) => y + '-' + p2(m) + '-' + p2(d);
export const eclipseOn = (y, m, d) => ECLIPSES.find(e => e.date === dateKey(y, m, d)) || null;

export const GERHANA_INFO = 'Salat gerhana (salat khusuf untuk gerhana bulan, kusuf untuk gerhana matahari) disunnahkan ketika terjadi gerhana. Dikerjakan jika gerhana terlihat di tempat Anda; tanggalnya tidak tetap dan diumumkan BMKG. Ikuti pengumuman masjid setempat.';

// Item: { key, name, desc, mark } (mark = diberi tanda khusus di kisi kalender)
export function amalanFor(h, dow, y, m, d) {
  const out = [];
  const ec = eclipseOn(y, m, d);
  if (ec) {
    out.push(ec.indonesia
      ? { key: 'gerhana', name: 'Salat gerhana (' + ec.label + ')', mark: true, desc: ec.note + ' ' + GERHANA_INFO }
      : { key: 'gerhana_tidak', name: ec.label + ' (tidak terlihat di Indonesia)', mark: false, desc: ec.note + ' Salat gerhana dikerjakan ketika gerhana terlihat di tempat Anda.' });
  }
  if (h) {
    if (h.m === 10 && h.d === 1) out.push({ key: 'id_fitri', name: 'Salat Idulfitri', mark: true, desc: 'Salat Id berjamaah pada pagi hari raya. Tunaikan zakat fitrah sebelum salat Id. Waktu dan tempat mengikuti pengumuman masjid setempat.' });
    if (h.m === 12 && h.d === 10) out.push({ key: 'id_adha', name: 'Salat Iduladha', mark: true, desc: 'Salat Id berjamaah pada pagi hari raya, dilanjutkan penyembelihan kurban bagi yang mampu. Waktu dan tempat mengikuti pengumuman masjid setempat.' });
    if (h.m === 9 && h.d >= 21 && h.d % 2 === 1 && h.d <= 29) out.push({ key: 'malam_ganjil', name: 'Malam ganjil sepuluh malam terakhir Ramadan', mark: true, desc: 'Malam 21, 23, 25, 27, dan 29 Ramadan adalah malam-malam ganjil di sepuluh malam terakhir; dianjurkan memperbanyak ibadah dan mencari Lailatul Qadar. Malam dihitung mulai Maghrib sebelum tanggal ini, dan tanggalnya mengikuti penetapan awal Ramadan.' });
  }
  if (dow === 5) out.push({ key: 'jumat', name: 'Hari Jumat', mark: false, desc: 'Hari yang utama dalam sepekan. Dianjurkan memperbanyak selawat dan bersiap menuju salat Jumat (misalnya mandi, berpakaian rapi, dan datang lebih awal).' });
  return out;
}
export const hasMark = items => items.some(x => x.mark);
