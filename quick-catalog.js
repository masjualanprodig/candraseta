// BAITUNA - quick-catalog.js (v72)
// Daftar ikon Akses Cepat di beranda tiap peran. Kuncinya sama dengan kartu di halaman masuk (open-xxx),
// sehingga ikon yang diganti Super Admin lewat editor Tampilan berlaku di semua tempat.
import { ICONS } from './feed-ui.js';

export const CATALOG = {
  'open-quran': ['Al-Qur’an', ICONS.quran], 'open-jadwal': ['Jadwal Salat', ICONS.clock], 'open-nearby': ['Masjid Terdekat', ICONS.pin],
  'open-doa': ['Doa Harian', ICONS.doa], 'open-zakat': ['Zakat', ICONS.zakat], 'open-agenda': ['Agenda', ICONS.agenda],
  'open-market': ['Pasar Umat', ICONS.market], 'open-more': ['Lainnya', ICONS.more],
  'open-pengurus': ['Pengurus', ICONS.user], 'open-keuangan': ['Keuangan', ICONS.zakat], 'open-profilmasjid': ['Profil Masjid', ICONS.mosque],
  'open-audit': ['Jejak Audit', ICONS.shield], 'open-pengumuman': ['Pengumuman', ICONS.horn],
  'open-datamasjid': ['Data Masjid', ICONS.mosque], 'open-pengguna': ['Pengguna', ICONS.users], 'open-konten': ['Editor Konten', ICONS.book], 'open-tampilan': ['Pengaturan Tampilan', ICONS.gear], 'open-notif': ['Notifikasi', ICONS.bell]
};
