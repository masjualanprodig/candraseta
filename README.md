# BAITUNA — Satu Masjid, Banyak Manfaat

Platform masjid multi-tenant. Stack: HTML5, CSS3, JavaScript modular, PWA, Supabase, GitHub, Vercel.

## Struktur sementara (datar, tanpa folder)
| File | Fungsi |
|---|---|
| index.html | Kerangka halaman |
| style.css, components.css, responsive.css | Tampilan |
| config.js | URL Supabase + publishable key (aman untuk frontend) |
| supabase.js | Klien Supabase tipis + sesi |
| auth.js | Login, logout, reset password |
| router.js | Pindah halaman (view) |
| permissions.js | Hak akses di tampilan (keamanan sebenarnya: RLS) |
| ui.js | Pembantu tampilan (elemen aman, toast, dialog) |
| mosque-service.js | Data masjid & keanggotaan |
| dashboard-admin.js | Dashboard Super Admin |
| dashboard-member.js | Tampilan anggota (non-admin) |
| dashboard-mosque.js | Dashboard Admin Masjid (profil, tim, undangan) |
| directory.js / public-service.js | Direktori & profil masjid publik (tanpa login) |
| prayer-times.js / islamic-calendar.js / schedule-ui.js | Jadwal salat (hitung di perangkat) dan kalender Islam (perkiraan) |
| calendar-ui.js | Kalender Islam bergaya carousel + popup hari besar |
| feed-ui.js | Beranda agenda & pengumuman semua masjid (halaman masuk, tab Agenda, beranda jamaah) |
| posts-ui.js / post-service.js / post-time.js | Agenda & pengumuman (jamaah melihat, pengurus mengelola); waktu mengikuti zona waktu masjid |
| world-ui.js / world-service.js | Galeri Masjid Dunia: publik melihat, hanya Super Admin yang mengelola |
| history-ui.js / history-service.js | Halaman Sejarah Islam: publik membaca, hanya Super Admin yang mengelola |
| photo.js | Foto masjid: cek format, perkecil otomatis ke ≤ 2 MB |
| team-panel.js | Komponen tim + undangan (dipakai dua dashboard) |
| app.js | Titik masuk |
| service-worker.js, manifest.json, icon-*.png, logo.png, masjid.svg | PWA & aset |

SQL (schema, policies, invitations, hardening, tahap3, direktori, jadwal, foto, agenda, dunia, sejarah, seed) ada di folder `sql/` pada repo (tidak dipakai browser).

Aturan: jangan pernah menaruh service_role / secret key di file mana pun.

## Al-Qur'an (tab "Qur'an")
- Sumber: AlQuran Cloud (gratis, tanpa kunci API): teks Utsmani (Tanzil), terjemahan `id.indonesian`, audio per ayat dari cdn.islamic.network (Alafasy, Husary).
- Teks tidak disimpan/diubah; data divalidasi sebelum tampil (jumlah ayat, nomor, host audio). Basmalah yang menempel di ayat 1 dipindah ke kepala surat (tampilan saja).
- Bukan mushaf bertashih Kemenag; lihat catatan "Tentang sumber" di halaman.
