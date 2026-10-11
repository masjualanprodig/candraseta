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

## Rukun Islam & Iman (menu "Lainnya" → Rukun)
- SQL: `rukun.sql`. Ayat = hanya rujukan (surat:ayat), teks diambil otomatis; hadits & tuntunan ditulis Super Admin dengan sumber.
- Bilah bawah kini 5 tab: Masjid, Agenda, Kalender, Qur'an, Lainnya (Rukun, Sejarah, Galeri Dunia).

## Masjid Terdekat (v23)
- Tab Masjid punya pilihan **Daftar | Terdekat**. Terdekat memakai lokasi perangkat (izin diminta saat tombol ditekan).
- Lokasi pengguna **tidak dikirim ke server**; jarak (garis lurus) dihitung di perangkat.
- Hanya masjid aktif yang sudah mengisi titik lokasi (latitude/longitude) yang tampil. Admin Masjid bisa mengisinya lewat tombol "Isi dari lokasi perangkat ini" di Edit profil.
- Peta: Leaflet (self-hosted, lisensi `LICENSE-Leaflet.txt`) + ubin OpenStreetMap. Pemakaian berat perlu penyedia ubin sendiri.
- Waktu tempuh berkendara belum ada (butuh layanan rute).

## Berita & Artikel Islam (v25)
- Menu **Lainnya → Berita & Artikel Islam**. Kartu artikel dengan filter kategori (Khazanah Islam, Tips Islami, Artikel), 12 artikel per muatan.
- Hanya **Super Admin** yang menulis (dasbor → "Berita & Artikel Islam"). Status Draf/Terbit; jamaah hanya melihat yang Terbit.
- Setiap artikel **wajib** mencantumkan penulis/sumber; tautan sumber opsional (hanya http/https).
- Isi artikel adalah teks biasa (bukan HTML). Gambar sampul opsional, maksimal 2 MB (otomatis diperkecil).
- Jalankan `berita.sql` sekali di Supabase SQL Editor (aman diulang). Tanpa itu halaman menampilkan petunjuk "belum aktif".

## Dzikir Pagi & Petang (v27)
- Menu **Lainnya → Dzikir Pagi & Petang**. Tiga tab: Pagi, Petang, Tasbih (penghitung bebas).
- Setiap bacaan punya tombol ketuk besar dengan target hitungan; hitungan tersimpan di perangkat (localStorage) dan kosong lagi saat ganti hari. Tidak ada hitungan yang dikirim ke server.
- Bacaan dikelola **Super Admin** (dasbor → "Dzikir Pagi & Petang"). Teks wajib punya Arab, terjemahan, dan sumber. Ayat Al-Qur'an hanya rujukan; teksnya diambil otomatis dari AlQuran Cloud.
- Jalankan `dzikir.sql` sekali. Tabel sengaja kosong: tidak ada bacaan agama yang diisi otomatis.
- "Jaga layar menyala" hanya muncul bila didukung perangkat.

### Pembaruan Dzikir (v28)
- Bunyi lonceng dua nada saat target tercapai (bawaan nyala) dan detak pelan tiap ketukan (bawaan mati), dibuat lewat Web Audio tanpa berkas audio. Di iPhone, tombol senyap menutup bunyi ini.
- Tasbih: info target di atas lingkaran, lingkaran lebih kecil agar tombol -1/Ulang tetap terlihat.

### Pembaruan Dzikir (v29)
- Fitur getar dihapus: di web tidak bisa diandalkan (bergantung pengaturan HP/peramban, tidak ada di iPhone). Tanda target tercapai: lonceng (opsional), warna emas, dan tulisan.

## Jadwal Salat Otomatis (v30)
- Menu **Lainnya → Jadwal Salat**. Waktu Subuh, Terbit, Dzuhur, Ashar, Maghrib, Isya dihitung **di HP sendiri** (rumus astronomi, parameter Kemenag RI), tanpa API berbayar dan tanpa layanan pihak ketiga.
- Lokasi: tombol "Gunakan lokasi saya" (GPS HP, hanya setelah diketuk) atau pilih dari 41 kota. Lokasi hanya disimpan di HP (localStorage), tidak dikirim ke server mana pun.
- Ada hitung mundur ke salat berikutnya. Aplikasi **tidak** membunyikan adzan/pengingat.
- Hasil hitungan bisa beda beberapa menit dari jadwal resmi Kemenag/masjid; ikuti pengumuman masjid. Koordinat kota adalah perkiraan pusat kota.

### Pembaruan Jadwal Salat (v31)
- Ditambah baris **Imsak** (10 menit sebelum Subuh) dan **Dhuha** (perkiraan 20 menit setelah terbit). Keduanya perkiraan dan tidak dihitung sebagai "salat berikutnya".
- Lokasi GPS kini menampilkan "Dekat <kota>" bila ada kota dalam daftar yang jaraknya ≤ 50 km (perkiraan garis lurus); jika tidak, hanya koordinat.

## Doa Shahih (v32)
- Menu **Lainnya → Doa Shahih**: kategori, pencarian, favorit (disimpan di perangkat), dan tombol Salin.
- Jalankan **doa.sql** di Supabase SQL Editor (aman diulang). Tabel `duas` kosong saat dibuat; tidak ada doa yang diisi otomatis.
- Dikelola **Super Admin** (dasbor → "Doa Shahih"). Doa dari hadits wajib: teks Arab, terjemahan, sumber (perawi + nomor), derajat (hanya shahih/hasan; dha'if ditolak database), dan keterangan penilai derajat. Ayat Al-Qur'an hanya rujukan; teksnya diambil otomatis dari AlQuran Cloud.
- Sebaiknya seluruh isi diperiksa ustaz sebelum diumumkan.
