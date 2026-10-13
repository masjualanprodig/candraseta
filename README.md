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

## Zakat: tampilan ringkas & Zakat Fitrah (v48)
- Kotak "Harga emas & nisab" terlipat dengan ringkasan satu baris setelah harga diisi (terbuka otomatis bila belum diisi); lima tab tidak lagi terpotong di layar sempit.
- Tab **Zakat Fitrah**: jiwa × takaran beras × harga beras. Takaran 2,5 kg hanya acuan umum (bisa diubah, diingat di perangkat), ikuti BAZNAS/Kemenag setempat. Jumlah jiwa tidak disimpan. Dicatat perbedaan pendapat uang vs makanan pokok.

## Pasar Umat (v49) - tahap katalog
- **Jalankan `pasar.sql`** di Supabase SQL Editor SEBELUM memakai fitur ini (butuh schema, policies, dan direktori sudah terpasang). Tanpa itu halaman menampilkan "Pasar Umat belum aktif".
- Pengunjung: melihat katalog produk yang SUDAH DISETUJUI (kategori Makanan Halal, Pakaian Muslim, Buku, Jasa, Usaha Lainnya), mencari, melihat profil penjual. Nomor WhatsApp hanya terlihat oleh pengguna yang sudah masuk (dijaga database, bukan hanya tampilan).
- Pengguna masuk: membuat profil penjual (satu per akun), mengajukan produk (1 foto, maks 2 MB), mengubah stok, melapor produk.
- Verifikasi: produk baru dan setiap perubahan isi (nama, harga, deskripsi, foto, kategori, keterangan halal) menunggu Super Admin. Penjual tidak bisa menyetujui sendiri (dijaga trigger database). Makanan wajib memuat keterangan halal; semua produk wajib ada pernyataan halal/sah dari penjual.
- Super Admin: Dashboard -> "Verifikasi Pasar Umat": Menunggu / Laporan / Tayang / Ditolak. Menolak dan menangguhkan penjual wajib beralasan.
- Batas: 40 produk per penjual, maks 10 menunggu verifikasi, maks 10 laporan per pengguna per hari.
- Belum ada: pemesanan di dalam aplikasi, ulasan, riwayat transaksi, pembayaran online (tahap berikutnya).

## Pasar Umat: alamat & sampai 5 foto (v50)
- Setiap produk punya kolom **Alamat** (opsional, maks. 200 huruf) dan **sampai 5 foto** (foto toko atau produk), **masing-masing maksimal 100 KB**. Foto diperkecil otomatis di HP sebelum diunggah; data lokasi (EXIF) dibuang. Server juga membatasi ukuran berkas 100 KB.
- Transaksi tetap langsung ke WhatsApp penjual.
- **WAJIB** jalankan ulang `pasar.sql` di Supabase SQL Editor sebelum memakai v50 (aman diulang; foto lama otomatis dipindah ke kolom baru `photos`). Kolom `photo_path` tidak dipakai lagi.
- Mengubah alamat atau foto membuat produk kembali menunggu verifikasi.
- Catatan: bucket foto bersifat publik, jadi foto produk yang belum disetujui bisa dibuka jika alamat berkasnya diketahui.

## Penyempurnaan Pasar Umat (v51)
- Menu bawah dibuat solid (teks di belakangnya tidak tembus lagi).
- Tombol **Bagikan produk** di halaman produk (menu bagikan HP, atau WhatsApp jika tidak tersedia). Pesan memuat nama, harga, penjual, dan alamat aplikasi; belum ada tautan langsung ke produk.
- Catatan privasi nomor WhatsApp di formulir profil penjual.
- Tidak ada perubahan SQL.

## Notifikasi Terpusat & kalender puasa (v52)
**Pusat Notifikasi** (Lainnya → Notifikasi, juga ubin di halaman masuk):
- Berisi: waktu salat hari ini, pengingat puasa (Senin–Kamis, Ayyamul Bidh, Ramadan, Arafah, Tasu'a/Asyura, 6 Syawal, hari raya dan hari yang dilarang berpuasa), kajian dan program sosial dari masjid terdekat, pengumuman masjid, dan produk baru Pasar Umat.
- Pengguna mengatur sendiri: jenis notifikasi, waktu salat yang ditampilkan, kelompok puasa, jarak masjid (5–50 km), dan pengingat HP. Semua pengaturan disimpan di perangkat (`baituna.notif.v1`, status dibaca `baituna.notifseen.v1`).
- **Batasan jujur:** daftar dihitung saat halaman dibuka. Pengingat HP (opsional, perlu izin) hanya berbunyi **selama BAITUNA terbuka** di peramban. Notifikasi saat aplikasi tertutup membutuhkan server push (tahap tersendiri) dan belum ada. Azan yang pasti berbunyi tetap sebaiknya memakai aplikasi azan/alarm HP.
- Lokasi memakai pilihan di Jadwal Salat dan tidak dikirim ke server; hanya daftar id masjid terdekat yang diminta.

**SQL (jalankan sebelum memakai v52):** `notif.sql` menambah kolom `topic` (umum/kajian/sosial) pada `mosque_posts`. Pengurus memilih jenis kabar di formulir Agenda & Pengumuman. Aman diulang. Kabar lama otomatis "umum".

**Kalender Islam:** setiap tanggal kini bisa diketuk dan bertanda puasa (teal = wajib, emas = sunnah, berongga = dianjurkan, merah = dilarang). Tanggal tanpa puasa khusus menampilkan penjelasan tersendiri. Legenda bulan menampilkan daftar puasa. Isi keterangan puasa ringkas dan umum; **perlu ditinjau ustaz** sebelum rilis. Tanggal Hijriah tetap perkiraan (Umm al-Qura).

## Tambahan v53: amalan sunnah lain, Dhuha, Tahajud, hitung mundur Ramadan
- **Kalender:** tanda belah ketupat untuk salat gerhana, salat Id (1 Syawal, 10 Zulhijah), dan malam ganjil sepuluh malam terakhir Ramadan; hari Jumat punya keterangan amalan (tanpa tanda). Di atas kalender ada hitung mundur Ramadan (hari dan pekan, tanggal perkiraan).
- **Data gerhana (`gerhana-data.js`):** hanya memuat gerhana yang SUDAH terverifikasi dari sumber (BMKG/Langit Selatan); tanggal gerhana tidak dihitung atau ditebak. Saat ini hanya sampai 2026: tidak ada gerhana yang terlihat dari Indonesia setelah 3 Maret 2026. **Tambahkan baris baru** setelah BMKG mengumumkan gerhana berikutnya (tidak perlu SQL; cukup ubah berkas ini dan upload).
- **Notifikasi:** pengingat salat Dhuha (terbit + 20 menit sampai menjelang Dzuhur) dan Tahajud (awal sepertiga malam terakhir, dihitung dari Maghrib hingga Subuh; perkiraan), hitung mundur Ramadan (tonggak 100/60/30/14/7/3/1 hari, pengingat HP pukul 08.00), jenis baru "Salat gerhana dan amalan sunnah lain". Semua bisa dimatikan satu per satu.
- Tidak ada SQL baru. Keterangan amalan perlu ditinjau ustaz.

## Tambahan v54: fitur saling berkolaborasi (Jadwal Salat, Amalan Sunnah Harian, Notifikasi, Kalender)
- **Jalankan dulu `sunnah_link.sql`** di Supabase SQL Editor (butuh `sunnah.sql` sudah pernah dijalankan; aman diulang; tidak mengisi data). Menambah kolom opsional `reminder_key` pada Amalan Sunnah. Tanpa SQL ini aplikasi tetap jalan, tetapi keterangan memakai teks umum berlabel.
- **Salat wajib:** pengingat Notifikasi mengambil waktunya otomatis dari Jadwal Salat (lokasi dan hitungan yang sama; konstanta Imsak/Dhuha satu sumber di `prayer-times.js`). Jadwal Salat kini punya panel "Pengingat salat" yang memakai pengaturan yang SAMA dengan menu Notifikasi (Subuh, Dzuhur, Ashar, Maghrib, Isya, Dhuha, Tahajud).
- **Amalan sunnah (puasa, Dhuha, Tahajud, gerhana, Id, malam ganjil, Jumat):** Super Admin memilih "Terkait pengingat (opsional)" pada tiap amalan di Kelola Amalan Sunnah Harian. Notifikasi dan Kalender lalu menampilkan isi, SUMBER, dan DERAJAT dari amalan itu. Bila belum diisi, tampil keterangan umum aplikasi dengan label: "Keterangan umum aplikasi; rujukan hadits belum diisi di Amalan Sunnah Harian."
- **Kategori baru "Amalan sunnah harian sesuai waktu":** kelompok waktu (Subuh, Pagi, Dhuha, Siang, Sore, Malam, Sebelum tidur) dari data Super Admin, dengan jam mulai mengikuti Jadwal Salat (hanya penanda awal, bukan batas ibadah), judul amalan, dan hitungan centang hari ini (centang dari halaman Amalan Sunnah Harian). Pengingat HP per kelompok bisa dimatikan satu per satu dan dilewati bila semua sudah dicentang.
- Batas jujur: pengingat HP tetap hanya berbunyi saat BAITUNA terbuka. Isi amalan 100% dari data admin; aplikasi tidak menambah dalil sendiri. Perlu ditinjau ustaz sebelum rilis.
- Tes: `unit_link.mjs` (22), `link_browser_test.py` (25), SQL `sl_tests.sql` (11).

## Tambahan v55: kebiasaan pribadi jamaah (tiap orang berbeda)
- Isi dalil/sumber tetap hanya diisi Super Admin. Namun **waktu dan pilihan ibadah diatur sendiri oleh setiap jamaah** di Notifikasi > Pengaturan > "Kebiasaan saya", tersimpan hanya di perangkat masing-masing (tanpa SQL, tanpa akun):
  - Awal waktu Dhuha: 15/20/30/45 menit setelah terbit (juga dipakai di Jadwal Salat).
  - Tahajud: sepertiga malam terakhir (otomatis) atau jam pilihan sendiri.
  - Puasa yang dikerjakan: Senin, Kamis, Ayyamul Bidh, Arafah, Tasu’a, Asyura, 6 Syawal, Ramadan masing-masing bisa dimatikan.
  - Pengingat pribadi: sampai 8 pengingat (nama, jam, hari) buatan sendiri; berbunyi saat BAITUNA terbuka dan tidak butuh lokasi.
- Tes: `unit_pribadi.mjs` (18), tambahan di `link_browser_test.py` (kini 37).

## Tambahan v56: pengingat Tracker menyatu dengan Notifikasi
- Pengingat yang aktif di Tracker Ibadah Harian (mis. "Shalat Tahajud 21:00") kini ikut tampil di Notifikasi > "Pengingat pribadi saya" dan berbunyi lewat mesin pengingat yang sama (saat BAITUNA terbuka). Tanpa SQL.
- Waktu Tahajud/Dhuha yang dihitung tetap diatur di Notifikasi > Pengaturan > Kebiasaan saya.

## Tambahan v57: halaman Privasi & Disclaimer
- Menu baru di Profil: **Privasi & Disclaimer** (tepat setelah Tentang BAITUNA; juga tombol di halaman Tentang). Bisa dibaca siapa saja, termasuk tamu.
- **Hanya Super Admin yang bisa mengubah** (tombol "Ubah halaman ini"; dijaga RLS di server, bukan hanya tombol). Format teks sederhana: `## Judul bagian`, `- butir daftar`, baris kosong = paragraf. Tidak ada HTML (tag ditampilkan sebagai teks biasa). Ada "Kembalikan ke teks bawaan".
- Jalankan `halaman.sql` di Supabase untuk mengaktifkan penyimpanan. Tanpa SQL itu, atau bila gagal memuat, halaman tetap menampilkan **teks bawaan sementara** (`page-defaults.js`). Teks bawaan adalah rancangan awal, bukan nasihat hukum; perlu ditinjau pengelola/penasihat hukum.
- Tes: `page_browser_test.py` (18), SQL `hl_tests.sql` (20).

## Tambahan v58: Arah Kiblat (kompas)
- Menu baru **Arah Kiblat** (ubin di halaman masuk, kartu di Lainnya, tombol di Jadwal Salat). Piringan kompas berputar mengikuti sensor HP; lambang Ka'bah muncul di arah kiblat; saat HP menghadap kiblat (selisih ≤ 3°) tampil "Arah kiblat tepat" dan HP bergetar singkat.
- Arah dihitung di perangkat dengan rumus lingkaran besar ke Ka'bah (21.4225° LU, 39.8262° BT) dari lokasi yang sama dengan Jadwal Salat (`baituna.loc.v1`); lokasi tidak dikirim ke server. Jakarta ≈ 295°, jarak ≈ 7.920 km.
- Sensor: Android memakai `deviceorientationabsolute`, iOS memakai `webkitCompassHeading` dan butuh ketukan "Aktifkan kompas" untuk izin. Tanpa sensor, aplikasi memberi arah dalam derajat untuk dipakai dengan kompas lain.
- Batas jujur: kompas HP menunjuk utara magnetik dan tidak dikoreksi; ketepatan bergantung sensor HP dan bisa meleset beberapa derajat. Selalu cocokkan dengan penanda kiblat masjid. Belum diuji di HP asli.
- Tanpa SQL. Tes: `unit_qibla.mjs` (15), `qibla_browser_test.py` (21).

## Perbaikan v59: kompas kiblat
- Perbaikan: di Android Chrome, sensor mengirim dua jenis peristiwa (absolut dan relatif). Peristiwa relatif ikut terbaca sehingga arah kompas bisa melenceng jauh. Kini hanya sumber absolut (terhadap utara) yang dipakai; bila hanya ada sumber relatif, aplikasi jujur menyatakan sensor kompas tidak terdeteksi.
- Ditambahkan tulisan "Arah HP sekarang: N°" agar bisa dibandingkan dengan aplikasi kompas lain.

## Tambahan v60: Ramadan Center (Tahap 1, MVP)
- Menu baru **Ramadan Center** (ubin di halaman masuk, kartu di Lainnya). Lima tab: **Beranda**, **Imsakiyah**, **Ibadah**, **Panduan**, **Agenda**.
- **Tanggal Ramadan** (`ramadan-service.js`): memakai perkiraan kalender Umm al-Qura dan selalu ditandai "Perkiraan, belum ditetapkan". Ramadan 1448 H diperkirakan mulai Senin 8 Februari 2027 (29 hari). **Super Admin** dapat menetapkan tanggal resmi (tahun Hijriah, awal, 29/30 hari, sumber wajib diisi untuk status "ditetapkan") dari panel di tab Beranda; semua pengguna lalu melihat "Ditetapkan · sumber". Aplikasi tidak menebak penetapan.
- **Beranda**: tanggal Masehi/Hijriah (perkiraan), hari ke-N atau hitung mundur, waktu hari ini (Imsak, Subuh, Terbit, Dzuhur, Ashar, Maghrib, Isya) dengan penanda sahur dan berbuka, hitung mundur Imsak/Subuh/berbuka saat Ramadan, progres pribadi, akses cepat ke menu lain.
- **Imsakiyah**: tabel semua hari Ramadan sesuai lokasi (lokasi sama dengan Jadwal Salat, kunci `baituna.loc.v1`; tidak dikirim ke server), baris hari ini disorot, metode dan sumber ditampilkan. Imsak = Subuh - 10 menit sebagai tanda kehati-hatian; berbuka = Maghrib. Bila matahari tidak mencapai sudut Subuh/Isya, hari itu ditandai tidak bisa dihitung (tidak menebak).
- **Ibadah**: checklist harian (Puasa, Tarawih, Tilawah, Sedekah, Qiyamul lail, Dzikir; bisa disembunyikan; sampai 8 kegiatan sendiri), pribadi dan hanya di perangkat (`baituna.ramadan.v1`, ikut terhapus oleh "Hapus data di perangkat ini"). Tanpa skor atau peringkat. **Rencana khatam**: target 1-10x, 604 halaman per khatam, hitung halaman per hari dari sisa hari; halaman terbaca diambil dari catatan Tracker Ibadah Harian (satu sumber, bisa diisi langsung dari tab ini).
- **Panduan**: tautan ke Doa Shahih, Dzikir, Amalan Sunnah, Al-Qur'an, Kalkulator Zakat, Kalender, Notifikasi. Tuntunan fikih Ramadan (niat, pembatal, uzur, qadha, fidyah, zakat fitrah) **sengaja belum diisi**; menunggu naskah yang ditinjau ustaz dengan sumber.
- **Agenda**: agenda masjid yang ditandai jenis kabar **Ramadan** (pilihan baru di form agenda/pengumuman masjid).
- **Jalankan `ramadan.sql`** di Supabase (aman diulang): tabel `ramadan_settings` (baca semua orang, tulis hanya Super Admin lewat RLS) dan jenis kabar `ramadan`. Tanpa SQL itu aplikasi tetap jalan dengan perkiraan; hanya penetapan tanggal dan penandaan agenda Ramadan yang belum aktif.
- Batas jujur: waktu dihitung di perangkat dan bisa beda beberapa menit dari jadwal masjid/Kemenag; belum ada notifikasi sahur yang berbunyi saat aplikasi tertutup (menunggu fitur push); belum diuji di HP sungguhan atau Supabase sungguhan. Belum termasuk (Tahap 2/3): komunitas, program/tantangan, direktori zakat, kelompok tadarus, audio, ringkasan pasca-Ramadan.
- Tes: `unit_ramadan.mjs` (36), `ramadan_browser_test.py` (49), SQL `rm_tests.sql` (23).

## Tambahan v61: penyempurnaan Ramadan Center
- **Imsakiyah**: kolom Hari dan Tanggal terkunci saat tabel digeser, kolom Maghrib (berbuka) disorot; tombol **Bagikan teks** (WhatsApp dll., atau disalin bila peramban tidak mendukung berbagi) dan **Cetak / simpan PDF** (hanya tabel dan catatan yang tercetak). Teks bagikan menandai tanggal "PERKIRAAN" bila belum ditetapkan.
- **Beranda**: angka hitung mundur lebih ringkas, tab muat satu baris, dan panel **Agenda Ramadan terdekat** (agenda masjid bertanda Ramadan).
- **Notifikasi > Pengaturan > Ramadan: sahur dan berbuka**: pengingat sahur (15/30/45/60 menit sebelum Imsak) dan berbuka (mengikuti "menit sebelum waktu"), memakai lokasi Jadwal Salat dan tanggal Ramadan. Hanya berbunyi saat BAITUNA terbuka dan "Pengingat HP" aktif; bukan pengganti alarm sahur.
- Penetapan tanggal dari Super Admin disalin ke perangkat (`baituna.ramadancache.v1`, data publik) agar pengingat tetap memakai penetapan walau offline. Ikut terhapus oleh "Hapus data di perangkat ini".
- Tes: `unit_ramadan2.mjs` (19), `ramadan_browser_test.py` kini 65. Tanpa SQL baru.

## Tambahan v62: agenda Ramadan menurut masjid terdekat
- Panel "Agenda Ramadan terdekat" (Beranda) dan tab Agenda kini hanya menampilkan agenda dari masjid **dalam radius** dari lokasi Jadwal Salat (radius sama dengan Notifikasi > Pengaturan, bawaan 15 km; sampai 15 masjid terdekat). Kartu menampilkan jarak. Jarak dihitung di perangkat; lokasi tidak dikirim ke server (server hanya menerima daftar id masjid).
- Bila belum memilih lokasi, atau tidak ada masjid terdaftar (yang punya titik lokasi) dalam radius, atau jarak gagal dihitung, ditampilkan agenda dari semua masjid dengan keterangan jelas.
- `feedPanel` kini punya opsi `near` dan `noLocNote`; `fetchFeed` menerima `mosqueIds` dan `topic` (disaring di server). Menu Agenda umum tidak berubah.
- Batas: masjid tanpa titik lokasi di profilnya tidak ikut mode terdekat. Tanpa SQL baru.
- Tes: `ramadan_browser_test.py` kini 71.

## Tambahan v63: Adzan (notifikasi + audio, terhubung ke Jadwal Salat)
- Menu baru **Adzan** (kartu di Lainnya; tombol "Atur adzan & audio" di Jadwal Salat dan di Notifikasi > Pengaturan). Waktu adzan diambil dari Jadwal Salat (lokasi dan hitungan yang sama).
- **Semua orang (jamaah, Admin Masjid)**: hanya **memilih**. Aktifkan adzan, pilih salat yang diadzankan, nyalakan notifikasi, pilih audio (umum, dan khusus Subuh), volume, putar contoh, simpan audio untuk offline, uji adzan. Pilihan tersimpan di HP (`baituna.notif.v1`, bagian `adzan`), tidak dikirim ke server.
- **Super Admin saja**: menambah (unggah), mengubah nama/sumber/jenis, mengaktifkan/menonaktifkan, dan menghapus audio. Sumber/pelantun/lisensi **wajib** diisi. Maksimal 30 audio, 10 MB per berkas (MP3, M4A, OGG, WAV).
- **BAITUNA tidak membawa rekaman adzan.** Super Admin yang mengunggah; pastikan berhak memakainya dan sebaiknya ditinjau ustaz.
- **Jalankan `adzan.sql`** di Supabase dulu (aman diulang): tabel `adzan_audio` (baca: semua orang untuk audio aktif; tulis: hanya Super Admin lewat RLS) dan bucket publik `adzan-audio` dengan kebijakan khusus Super Admin.
- Notifikasi memerlukan izin dari HP masing-masing. Bila izin ditolak, suara adzan tetap berbunyi saat aplikasi terbuka.
- Bila salat memakai pengingat "0 menit sebelum" dan adzan aktif, hanya satu notifikasi yang tampil (tidak ganda).
- **Batas jujur**: adzan, suara, dan notifikasi hanya berbunyi **selama BAITUNA terbuka** di peramban. Aplikasi web tidak bisa memutar suara saat tertutup; notifikasi push sungguhan belum dibuat (butuh server, dan push pun tidak bisa memutar audio adzan sendiri). Peramban menahan suara otomatis sebelum layar diketuk: bila tertahan muncul tombol "Putar adzan". HP bisa membekukan peramban di latar belakang. Waktu dihitung di perangkat dan bisa beda beberapa menit dari adzan masjid.
- "Hapus data di perangkat ini" kini juga menghapus pilihan dan salinan audio adzan. Teks privasi diperbarui. Cache service worker v54.
- Tes: `unit_adzan.mjs` (27), `adzan_browser_test.py` (60), SQL `az_tests.sql` (32).

## Tambahan v64: Notifikasi push (tampil walau BAITUNA tertutup)
- Panel baru **Notifikasi > Pengaturan > "Notifikasi saat aplikasi tertutup (push)"**: saklar Aktifkan push, tombol **Kirim push uji**, dan penjelasan jujur apa yang dikirim ke server dan batasnya.
- **Cakupan push**: pengingat waktu salat (5 waktu, "menit sebelum" sesuai pilihan), adzan (sesuai halaman Adzan), sahur dan berbuka saat Ramadan (tanggal Ramadan mengikuti penetapan Super Admin bila ada). Belum: puasa sunnah, amalan harian, pengingat pribadi, kabar masjid.
- **Arsitektur**: Edge Function tunggal `baituna-push` (aksi `subscribe`, `unsubscribe`, `test`, `tick`). Jadwal pg_cron memanggil `tick` tiap menit; server menghitung waktu salat per langganan (modul yang sama dengan aplikasi), lalu mengirim Web Push terenkripsi (VAPID + aes128gcm, hanya WebCrypto, tanpa pustaka luar). Penanda `tag` sama dengan pengingat di aplikasi sehingga tidak dobel bila aplikasi sedang terbuka.
- **Data di server** (tabel `push_subscriptions`, tertutup dari API publik; hanya fungsi dengan service role yang bisa membaca): alamat push, kunci, lokasi dibulatkan ±1 km, zona waktu, pilihan notifikasi. Tanpa nama/email/akun. Dihapus saat push dimatikan, saat "Hapus data di perangkat ini", saat layanan push menyatakan kedaluwarsa (404/410), atau setelah 20 kegagalan berturut-turut. Teks privasi sudah diperbarui.
- **Keamanan fungsi**: alamat push hanya diterima dari layanan push resmi (Google/FCM, Mozilla, Apple, Windows) agar server tidak bisa dipakai menembak alamat lain; `tick` menolak tanpa `CRON_SECRET`; push uji dibatasi 1 kali per 30 detik dan hanya untuk alamat yang sudah terdaftar; badan permintaan maks 4 KB.
- **Ketuk notifikasi adzan**: membuka BAITUNA dan memutar adzan (atau menampilkan tombol "Putar adzan" bila peramban menahan suara), hanya bila notifikasinya masih baru (10 menit).
- **Batas jujur**: nada notifikasi = nada bawaan HP (push tidak bisa memutar audio adzan sendiri); hemat baterai/Doze bisa menunda; server perlu fungsi dan jadwal aktif; skala besar (puluhan ribu langganan) perlu ditinjau ulang.
- **Pasang** (lihat `PANDUAN-PUSH-v64.md`): `push.sql` → pasang fungsi `baituna-push` (`baituna-push.ts`) + 4 rahasia → `push-cron.sql` → unggah aplikasi v64. Fungsi dibuat ulang dengan `fn/build.mjs` dari kode yang sama dengan aplikasi.
- Perbaikan kecil: tombol "Putar adzan" tidak lagi ikut hilang bila berkas audio gagal dimuat. Cache service worker v55.
- Tes: `unit_push.mjs` (109: validasi, penghitung, enkripsi push round-trip, VAPID, pengirim, tick, bundel, service worker), `push_browser_test.py` (40), SQL `px_tests.sql` (22).

## Tambahan v65: Kritik & Saran
- Halaman baru **Profil > Kritik & Saran** (baris terakhir, tepat di bawah Privasi & Disclaimer; juga untuk tamu): deskripsi singkat, lalu formulir **Nama**, **Email**, kolom luas **Kritik dan saran** (2.000 huruf, ada penghitung), dan tombol **Kirim**. Layar terima kasih sesudah terkirim. Nama dan email terisi otomatis bagi pengguna yang masuk (bisa diubah).
- **Alur**: aplikasi memanggil fungsi `baituna-push` (aksi `feedback`) → pesan **disimpan dulu** di tabel `feedback` (tertutup; hanya Super Admin yang bisa membaca) → lalu **diteruskan ke email Super Admin** lewat **Resend**, dengan Reply-To = email pengirim (tinggal Balas). Bila email gagal, pesan tetap aman di tabel (kolom `emailed` dan `mail_error` mencatatnya).
- **Anti spam**: kolom jebakan tak terlihat, maksimal 5 kiriman per perangkat per jam (memakai sidik SHA-256 satu arah dari IP, bukan IP asli) dan 100 kiriman per jam untuk semua, validasi nama/email/panjang di aplikasi dan di server. Email dikirim sebagai teks biasa (tanpa HTML) dan subjek satu baris, jadi tidak bisa disisipi header atau skrip.
- **Pasang** (lihat `PANDUAN-SARAN-v65.md`): `saran.sql` → akun Resend + kunci API → ganti kode fungsi `baituna-push` dengan versi baru → 2 rahasia baru (`RESEND_API_KEY`, `FEEDBACK_TO`) → unggah aplikasi v65.
- **Batas jujur**: dengan pengirim bawaan Resend (`onboarding@resend.dev`), email hanya bisa dikirim ke alamat pemilik akun Resend; gunakan email Super Admin yang sama untuk mendaftar. Email bisa masuk folder spam. Belum ada halaman Kotak Saran di aplikasi: pesan dibaca lewat email atau Table Editor Supabase (halaman Kotak Saran ada di rencana Tahap 4).
- Teks privasi diperbarui (bagian Kritik & saran, penyedia email). FAQ Bantuan diperbarui (adzan/push, cara kirim saran). Cache service worker v56.
- Tes: `unit_push.mjs` kini 152 (validasi saran, email, batas, Resend gagal, tabel belum ada), `saran_browser_test.py` (34), SQL `sr_tests.sql` (16).

## Tambahan v66: Tanya Jawab
- Kartu baru **Lainnya > Tanya Jawab** (tamu dan yang sudah masuk). Tiga tab: **Terbaru** (urut tanggal dijawab), **Populer** (skor = jumlah dibaca + 5 x tombol Bermanfaat), **Kategori** (daftar kategori + jumlah terjawab, lalu isi kategori). Ada pencarian judul dan "Muat lebih banyak" (20 per halaman).
- **Model**: jamaah bertanya, **penjawab resmi** (ditunjuk Super Admin lewat email akun) menjawab. Pertanyaan baru **tidak tampil ke publik** sebelum dijawab. Setiap jawaban **wajib memuat sumber/rujukan**, tampil dengan nama + gelar penjawab, dan disertai catatan bahwa itu bukan fatwa. Aplikasi tidak membuat isi agama sendiri.
- **Bertanya wajib masuk** (pilihan Anda). Karena pendaftaran jamaah umum baru ada di Tahap 4, saat ini hanya pemegang akun (pengurus) yang bisa bertanya; tamu melihat tombol Masuk dan penjelasan. Batas: 3 pertanyaan menunggu, 5 per 24 jam, judul 10-150 huruf, rincian maks 1.500.
- **Pertanyaan saya**: status Menunggu / Sudah dijawab / Tidak dapat dijawab (dengan alasan). Tidak ada pemberitahuan otomatis saat dijawab; penanya memeriksa halaman ini.
- **Kelola** (penjawab dan Super Admin): antrean (jawab dengan sumber wajib, atau tolak dengan alasan), sembunyikan/tampilkan jawaban. Super Admin juga bisa **menghapus**. **Pengaturan** (Super Admin): tambah/nonaktifkan/hapus penjawab, tambah/nonaktifkan kategori (9 kategori awal).
- **Dibaca dan Bermanfaat**: tanpa akun; memakai penanda acak per perangkat (`baituna.qa.v1`) sehingga satu perangkat dihitung sekali per pertanyaan; batas 300 baca/100 suara per 24 jam per perangkat. **Angka bersifat indikatif** (penanda bisa dipalsukan oleh orang yang sengaja). Penanda ikut terhapus oleh "Hapus data di perangkat ini".
- **Keamanan**: semua tabel tertutup dari API; baca publik lewat izin kolom (identitas penanya `asker_id` dan alasan penolakan tidak pernah terbaca publik); menulis hanya lewat fungsi server yang memeriksa peran. Pencarian membuang karakter khusus.
- **Pasang** (lihat `PANDUAN-TANYA-v66.md`): jalankan `tanya.sql` di Supabase, unggah aplikasi v66, lalu (Super Admin) tambahkan penjawab di Tanya Jawab > Pengaturan.
- Teks privasi diperbarui. Cache service worker v57.
- Tes: `unit_qa.mjs` (31), `qa_browser_test.py` (66), SQL `tq_tests.sql` (57).
