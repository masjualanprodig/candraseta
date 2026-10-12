// BAITUNA - gerhana-data.js
// Daftar gerhana yang SUDAH terverifikasi dari sumber (BMKG / Langit Selatan). Hanya yang `indonesia: true` ditandai
// sebagai hari salat gerhana di kalender. Tanggal gerhana TIDAK dihitung/ditebak di aplikasi: tambahkan baris baru
// hanya setelah ada pengumuman resmi (BMKG biasanya merilis jadwal setahun sebelumnya).
// date = tanggal di Indonesia (WIB) saat puncak gerhana, format YYYY-MM-DD.
export const ECLIPSES = [
  { date: '2026-02-17', kind: 'matahari', label: 'Gerhana Matahari Cincin', indonesia: false, note: 'Fase cincin hanya terlihat dari Antartika.', source: 'Langit Selatan, Fenomena Langit 2026' },
  { date: '2026-03-03', kind: 'bulan', label: 'Gerhana Bulan Total', indonesia: true, note: 'Puncak sekitar pukul 18.03 WIB; dapat diamati di seluruh Indonesia dengan syarat cuaca cerah dan arah pandang timur yang terbuka.', source: 'BMKG dan Langit Selatan' },
  { date: '2026-08-12', kind: 'matahari', label: 'Gerhana Matahari Total', indonesia: false, note: 'BMKG: tidak dapat diamati dari Indonesia.', source: 'BMKG' },
  { date: '2026-08-28', kind: 'bulan', label: 'Gerhana Bulan Sebagian', indonesia: false, note: 'BMKG: tidak dapat diamati dari Indonesia (terjadi pada siang hari di Indonesia).', source: 'BMKG' }
];
// Dasar daftar ini berakhir pada tahun:
export const ECLIPSE_DATA_UNTIL = 2026;
