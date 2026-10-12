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

### Pembaruan Doa (v33)
- Tombol **Bagikan** (lembar bagikan perangkat, atau WhatsApp bila tidak ada) di samping Salin; isinya sama dengan Salin.

## Profil & Pengaturan (v34)
- Menu **Lainnya → Profil & Pengaturan** (juga tombol **Profil** di bilah menu setelah masuk). Tanpa SQL baru.
- Sudah masuk: kartu profil (inisial, nama, email, peran + masjid), **Ubah profil** (nama, telepon; tabel `profiles`, hanya milik sendiri), **Ganti password** (password lama diperiksa dulu), **Keluar**.
- Semua pengguna: **Favorit** (doa ★), **Progres saya** (ringkasan di perangkat), **Pengaturan** (ukuran/gaya tulisan Arab, bunyi dzikir, hapus data di perangkat), **Bantuan** (FAQ), **Tentang BAITUNA** (versi, privasi singkat).
- Belum ada: foto profil, notifikasi (browser tidak bisa menjamin notifikasi/alarm), bookmark artikel.

## Bilah menu bawah (v35)
- Setelah masuk, deretan tombol di atas diganti **bilah menu bawah yang menempel** (tetap saat digulir): Beranda, Masjid, Qur'an, Lainnya, **Profil** (pojok kanan bawah). Agenda dan Kalender pindah ke menu Lainnya. Pengunjung yang belum masuk tetap memakai bilah lama (Masjid, Agenda, Kalender, Qur'an, Lainnya).

### Foto profil (v36)
- Ubah profil -> **Pilih/Ganti/Hapus foto**. Dipotong persegi dan diperkecil di HP sampai maksimal 100 KB (JPEG; EXIF/GPS terbuang). Langsung tersimpan saat dipilih.
- Jalankan **avatar.sql** (aman diulang): kolom `profiles.avatar_path`, bucket PRIVAT `avatars` (batas 100 KB), kebijakan: hanya pemilik yang bisa melihat/mengunggah/menghapus fotonya. Tidak ada tautan publik.
- Ubah Profil dirapikan: label tidak ganda dengan placeholder, "Ganti password" masuk kartu.

## Amalan Sunnah Harian (v37)
- Menu **Lainnya -> Amalan Sunnah Harian** (juga ubin di halaman masuk). Jamaah bisa mencari, memfilter per waktu (Subuh, Pagi, Dhuha, Siang, Sore, Malam, Sebelum tidur, Sepanjang hari), mencentang "Sudah saya kerjakan hari ini", Salin dan Bagikan.
- Centang hanya tersimpan di perangkat (`baituna.sunnah.v1`) dan kosong lagi besok. Tidak ada pengingat/alarm.
- **Hanya Super Admin** yang bisa menambah/mengubah/menghapus (Dasbor -> Amalan Sunnah Harian). Setiap amalan wajib: judul, penjelasan, sumber, derajat (shahih/hasan saja; dha'if ditolak database), dan keterangan siapa yang menilai.
- Jalankan **sunnah.sql** (aman diulang). Tabel awalnya KOSONG; isi dari sumber yang Anda periksa dan sebaiknya ditinjau ustaz sebelum diumumkan.

## Belajar Membaca Al-Qur'an (v38)
- Menu **Lainnya -> Belajar Membaca Al-Qur'an** (juga ubin di halaman masuk). 8 level: (1) 28 huruf hijaiyah + makhraj, (2) huruf bersambung, (3) harakat, (4) tanwin, (5) sukun & tasydid, (6) mad thabi'i, (7) hukum bacaan dasar (nun sukun/tanwin, mim sukun, qalqalah), (8) membaca 13 surat pendek.
- **Materi sudah ada di aplikasi** (tidak perlu diisi). Level 1-7 punya kuis 10 soal acak, lulus bila nilai >= 80%, ada bintang dan nilai terbaik. Level 8: tandai "sudah lancar" per surat (penilaian sendiri); ayat dimuat dari AlQuran Cloud, tidak diketik aplikasi.
- **Tanda pengingat**: banner "Lanjutkan di Level N" + "terakhir belajar ... lalu"; setelah 3 hari tidak belajar banner berubah jadi pengingat. Hanya tampil saat halaman dibuka (bukan notifikasi/alarm).
- Kemajuan hanya di perangkat (`baituna.belajar.v1`), ikut terhapus oleh "Hapus data di perangkat ini".
- **Super Admin hanya MENAMBAH materi tambahan** per level (Dasbor -> Materi Belajar Qur'an), wajib dengan sumber. Jalankan **belajar.sql** (aman diulang; tabel awalnya kosong).
- Belum ada: suara huruf, kemajuan antar-perangkat. Sebaiknya ustaz memeriksa materi sebelum diumumkan.

## Asmaul Husna (v39)
- Menu **Lainnya -> Asmaul Husna** (juga ubin di halaman masuk). **Tanpa SQL** (data statis).
- Daftar 99 nama (Arab, Latin, arti), pencarian (Arab tanpa harakat, Latin, arti), filter Favorit / Belum hafal, halaman detail (Arab besar, penjelasan singkat, sebelumnya/berikutnya), favorit, tandai hafal, Salin/Bagikan, kuis hafalan 10 soal. Kembali dari detail mengembalikan pencarian dan posisi gulir.
- Data: `asmaul-husna.json` (99 nama + sumber). Urutan, tulisan Arab, dan nama Latin dicocokkan dengan daftar NU Online dan CNBC Indonesia; arti dan penjelasan disusun tim BAITUNA dan **belum ditinjau ustaz**. Ayat umum (QS. 7:180 dan 59:22-24) dimuat dari AlQuran Cloud, bukan diketik.
- **Audio**: tombol suara hanya muncul untuk nomor yang terdaftar di `asmaul-husna-audio.json` (saat ini kosong). Cara menambah: taruh berkas (mp3/m4a/ogg/wav) di folder `audio/asma/`, lalu daftarkan, mis. `{"basePath":"audio/asma/","files":{"1":"001.mp3","2":"002.mp3"}}`. Gunakan rekaman yang berizin. Fitur Putar/Jeda/Berhenti/Ulang/Putar berurutan sudah ada. Audio tidak di-cache offline.
- Favorit, hafalan, nilai kuis hanya di perangkat (`baituna.asma.v1`).

## Lantunan Asmaul Husna lengkap (v40)
Satu tombol putar untuk seluruh lantunan (bukan per nama), lengkap dengan geser posisi, jeda, dan berhenti.
- Berkas: `audio/asma/full.mp3` (folder `audio` baru; unggah bersama berkas lain). Tidak disimpan offline (4,6 MB), jadi butuh internet.
- Pengaturan di `asmaul-husna-audio.json`, bagian `"full"`: `file`, `title`, `source`, `license`. Hapus bagian `"full"` bila ingin kartunya hilang.
- Penting: lisensi berkas ini BELUM terverifikasi (hanya klaim "no copyright" di judul). Isi `source` dan `license` dengan data asli (nama kanal/pelantun, tautan, izin) begitu diketahui, dan minta ustaz memeriksa isi serta pelafalannya.

## Penjelasan & audio Asmaul Husna bisa diubah Super Admin (v41)
- Jalankan `asma.sql` sekali di Supabase SQL Editor (membuat 2 tabel kosong + bucket publik `asma-audio`, maks. 15 MB).
- Dashboard Super Admin -> "Penjelasan & Audio Asmaul Husna":
  - Penjelasan dan arti tiap nama dapat diubah. Isi bawaan tidak ditimpa: tombol "Kembalikan ke bawaan" menghapus perubahan.
  - Audio lantunan: ganti berkas (MP3/M4A/OGG/WAV, maks. 15 MB) serta judul, sumber, dan lisensi. "Kembalikan ke audio bawaan" menghapus unggahan.
- Selama tabel kosong atau belum dibuat, aplikasi memakai isi bawaan (`asmaul-husna.json` dan `audio/asma/full.mp3`).
- Audio per nama (001.mp3 dst) masih lewat berkas di `audio/asma/` + `asmaul-husna-audio.json`.

## Tracker Ibadah Harian (v42)
Halaman pribadi dan opsional (Lainnya -> Tracker Ibadah Harian). Semua data hanya di perangkat (`baituna.tracker.v1`), tidak ada tabel server, tidak perlu SQL.
- Salat wajib: centang 5 waktu per hari; opsi "libur hari ini" (udzur/sakit/safar) yang tidak dihitung.
- Target membaca Al-Qur'an: dalam halaman per hari (0 = tanpa target), dicatat dengan tombol + dan -.
- Zikir & amalan: daftar milik pengguna sendiri (nama saja, ada contoh nama) plus catatan harian.
- Ringkasan 7 dan 30 hari: hanya hitungan "tercatat". Tanpa skor, peringkat, atau streak.
- Pengingat: banner di halaman saat aplikasi dibuka setelah jam yang dipilih, dan tombol "Tambah ke kalender" (.ics, berulang harian) untuk alarm sungguhan lewat aplikasi kalender HP. Aplikasi web tidak bisa menjamin alarm saat tertutup.
- Bagian bisa disembunyikan; data tidak hilang. "Hapus semua catatan tracker" dan "Hapus data di perangkat ini" menghapus semuanya.
- Catatan hanya bisa diisi sampai 30 hari ke belakang; data lebih dari 400 hari dipangkas otomatis.

## Mode Mushaf (v43)
Di tab Al-Qur'an ada dua mode: "Per ayat" (seperti sebelumnya) dan "Mushaf (per halaman)".
- Mushaf: teks Arab bersambung per halaman 1-604 (Mushaf Madinah), nomor ayat di ujung ayat, kotak judul surat, header Juz dan Halaman, justify rata kanan-kiri.
- Lompat ke surat, ke nomor halaman, atau pintasan (Al-Fatihah, Ayat Kursi, Al-Kahf, Yasin, Ar-Rahman, Al-Waqi'ah, Al-Mulk). Halaman terakhir dan mode tersimpan di perangkat.
- Ketuk ayat: terjemahan, putar ayat, putar dari ayat itu, tandai terakhir dibaca. "Putar halaman" memutar semua ayat halaman itu berurutan.
- Dari bacaan per ayat ada tombol "Buka di mode mushaf (per halaman)".
- Sumber: AlQuran Cloud (endpoint /page, /ayah). Surat tiap ayat dihitung dari nomor ayat global dan jumlah ayat 114 surat (total harus 6236); data yang janggal ditolak dan tidak ditampilkan.
- Ini bukan gambar mushaf cetak: pemenggalan baris mengikuti lebar layar. Tidak perlu SQL.

## Penanda "terakhir dibaca" di mode mushaf (v44)
- Ketuk ayat -> "Selesai baca di sini": nomor ayat berwarna emas dan ayat ber-highlight; tersimpan surat, ayat, dan halaman.
- Banner "Terakhir dibaca: ... · Hal. N" di atas halaman dengan tombol "Lanjutkan" (atau "Ke penanda" bila sedang di halamannya) dan "Hapus penanda".
- Satu penanda saja; menandai ayat lain memindahkannya. Dipakai bersama mode per ayat (kunci `baituna.quranlast.v1`).

## Mushaf: offline, tema, layar menyala, geser (v45)
- **Baca tanpa internet**: halaman mushaf yang pernah dibuka disimpan di perangkat (Cache API `baituna-quran-v1`, maks. 150 halaman). Halaman sebelum/sesudahnya diambil otomatis saat online. Halaman yang belum tersimpan memberi pesan jelas saat offline.
- **Tema baca**: terang, krem, gelap (hanya halaman baca).
- **Jaga layar tetap menyala** (Wake Lock; hanya jika browser mendukung), dilepas saat pindah mode.
- **Geser untuk pindah halaman**: bawaan mengikuti mushaf (geser ke kanan = halaman berikutnya); arah bisa dibalik. Tombol ‹ › kecil tetap ada sebagai cadangan.
- "Hapus data di perangkat ini" juga menghapus simpanan offline. Service worker tidak menghapus simpanan Qur'an saat pembaruan.

## Perbaikan geser (v46)
Saat halaman mushaf digeser dari tengah halaman, posisi gulir kini dipertahankan (tidak lagi loncat ke atas). Halaman lama tetap tampak redup selama halaman baru dimuat. Pindah lewat tombol ‹ › atau "Pergi" tetap kembali ke atas.

## Kalkulator Zakat (v47)
- Menu Lainnya → Kalkulator Zakat. Empat tab: **Zakat Maal**, **Penghasilan**, **Nisab & Haul**, **Dasar & Rujukan**.
- Nisab dari harga emas yang diisi pengguna (85 gram × harga); aplikasi tidak mengambil harga dari internet. Nilai acuan BAZNAS 2026 (dikutip dari pemberitaan, BELUM diverifikasi ke dokumen resmi) bisa diisi dengan satu tombol; pengguna diminta mengecek ke baznas.go.id.
- Zakat maal: status dibedakan (di bawah nisab / belum haul / wajib / wajib bila haul terpenuhi). Pilihan yang diperselisihkan ulama (perhiasan yang dipakai, pengurangan utang) menampilkan hasil pilihan pengguna beserta hasil pilihan sebaliknya.
- Zakat penghasilan: pilihan dasar (kotor / setelah kebutuhan pokok) dan periode (bulanan / tahunan); nisab bulanan = 1/12 nisab tahunan.
- Pembantu tanggal haul (Masehi + Hijriah, perkiraan).
- Privasi: hanya harga dan pilihan metode yang disimpan di perangkat (`baituna.zakat.v1`, ikut terhapus oleh "Hapus data di perangkat ini"); jumlah harta/penghasilan tidak disimpan dan tidak dikirim.
- Tanpa teks Qur'an/hadits dari ingatan: ayat hanya disebut nomornya. Isi sebaiknya ditinjau ustaz/amil sebelum rilis.
