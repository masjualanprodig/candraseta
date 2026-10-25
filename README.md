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

## Tambahan v67: Pustaka Buku
- Kartu baru **Lainnya > Pustaka Buku** (tamu dan yang sudah masuk): katalog buku **fisik dan digital** yang dijual. Pembayaran **tidak diproses di BAITUNA**: tombol **Pesan** membuka **WhatsApp penjual** (dengan teks pesanan berisi judul dan harga) atau **link checkout** (https) di tab baru.
- **Tampilan**: pilihan **Grid** (2 kolom, hanya thumbnail penuh, tanpa teks) atau **List** (thumbnail kecil + judul + deskripsi singkat 2 baris + harga + jenis, seperti contoh foto). Pilihan diingat di perangkat (`baituna.books.v1`). Ada pencarian dan saringan Semua/Fisik/Digital. Detail buku: sampul, jenis, harga, deskripsi lengkap, tombol Pesan.
- **Editor hanya Super Admin** (tombol "Kelola buku" tampil hanya untuknya, dan dijaga RLS di server): nama buku (3-150), deskripsi (10-2.000), jenis (fisik/digital), harga (Rp, 0 = Gratis, maks Rp 100 juta), cara pesan (WhatsApp atau link checkout), tampil/sembunyikan, dan **banner maksimal 100 KB** (gambar lebih besar otomatis diperkecil dan dikompres menjadi JPEG; batas 100 KB juga dipasang di bucket `book-covers`). Admin masjid, pengurus, dan jamaah hanya melihat dan memesan.
- **Keamanan**: link checkout wajib `https://` tanpa spasi (tidak bisa `javascript:`/`http:`), nomor WA harus format 62; salah satu saja (WA atau URL); tamu hanya melihat buku yang tampil; semua perubahan hanya Super Admin. Tombol Pesan dinonaktifkan bila data dari server tidak sah.
- **Batas jujur**: nomor WA/link **tidak ditampilkan sebagai teks** (pembeli hanya melihat tombol Pesan), tetapi tetap bisa terbaca teknis oleh orang yang membuka alat pengembang, dan tampak saat tombol ditekan karena tujuan terbuka (gunakan nomor khusus jualan); belum ada keranjang, stok, ongkir, atau pelacakan pesanan; penjual dan pembeli bertransaksi di luar BAITUNA, jadi risiko penipuan ada pada transaksi tersebut (catatan peringatan sudah tampil). Banner terlalu rumit/penuh detail bisa gagal ditekan ke 100 KB; pakai gambar lain.
- **Pasang** (lihat `PANDUAN-BUKU-v67.md`): jalankan `buku.sql` → unggah aplikasi v67 → masuk Super Admin → Lainnya > Pustaka Buku > Kelola buku.
- Teks privasi diperbarui. Cache service worker v58.
- Tes: `unit_books.mjs` (35), `books_browser_test.py` (52), SQL `bk_tests.sql` (41).

## Tambahan v68: Kas Masjid (Tahap 4A)
- **Hanya pencatatan.** BAITUNA tidak memegang atau memindahkan uang, tidak menerima donasi; laporan dibuat pengurus, bukan audit independen (tertulis di setiap laporan).
- **Siapa**: Bendahara mencatat (satu-satunya yang bisa menulis catatan). Ketua Takmir, Admin Masjid, dan Super Admin melihat. Ketua, Admin Masjid, dan Super Admin boleh menutup buku; Admin Masjid dan Bendahara mengelola akun & kategori; Ketua/Admin Masjid mengatur ringkasan publik. Buka kembali bulan tertutup: Super Admin saja (tercatat di audit).
- **Menu**: Bendahara/Ketua mendapat tombol Kas masjid di dashboard (Ketua juga tetap punya Agenda); Admin Masjid tombol "Kas masjid"; Super Admin tombol "Kas" di tiap masjid aktif.
- **Isi**: tab Ringkasan (saldo awal, masuk, keluar, akhir, per kategori, per akun, cetak/simpan PDF, unduh CSV aman rumus, tutup buku), Catatan (daftar, saring per akun, bukti, koreksi), Catat (form), Pengaturan (akun, kategori, ringkasan publik).
- **Integritas**: catatan tidak bisa diubah/dihapus (dijaga trigger di database); salah catat dikoreksi dengan baris pembalik bertanggal hari ini; bulan yang ditutup tidak menerima catatan bertanggal di dalamnya; tanggal tidak boleh di masa depan (zona Jayapura); pengeluaran yang membuat saldo minus meminta konfirmasi.
- **Bukti**: foto nota maks 100 KB (otomatis diperkecil), bucket PRIVAT, hanya Bendahara/Ketua/Admin Masjid/Super Admin.
- **Ringkasan untuk jamaah**: MATI secara bawaan. Bila dihidupkan, profil masjid menampilkan hanya total bulanan; rincian, nama donatur, dan bukti tidak pernah terbuka.
- **Jejak audit**: tiap catatan, koreksi, tutup/buka bulan, ubah akun/kategori, dan pengaturan publik ditulis ke `audit_logs`.
- **Batas jujur**: dana zakat diberi jenis akun terpisah, tetapi aturan penyaluran dan istilahnya perlu ditinjau ustaz/amil; masjid tanpa Bendahara belum bisa mencatat (undang lewat panel Pengurus).
- Pasang: jalankan `kas.sql` → unggah v68. Cache service worker v59. Teks privasi diperbarui.
- Tes: `unit_kas.mjs` (24), `kas_browser_test.py` (61), SQL `kas_tests.sql` (140).

## Tambahan v69: Pendaftaran Jamaah (4B) dan Jejak Audit (4C)
**4B - Pendaftaran jamaah**
- **Daftar akun sendiri**: "Daftar sekarang" di halaman masuk kini membuka formulir (nama lengkap, email, password minimal 8 berisi huruf dan angka, ulangi password, centang persetujuan privasi). Nama dikirim sebagai data akun. Bila proyek Supabase meminta konfirmasi email, pengguna melihat pesan "cek email"; bila tidak, langsung masuk.
- **Keanggotaan jamaah**: Profil > Keanggotaan jamaah. Pengguna memilih masjid (opsional) dan menulis catatan (maks. 200), lalu mengajukan. Status: menunggu / disetujui / ditolak (dengan alasan). Boleh mengajukan ulang sampai 3 kali.
- **Persetujuan HANYA Super Admin** (dashboard > Pendaftaran jamaah, ada jumlah menunggu): setujui, tolak (alasan wajib), atau cabut. Admin Masjid tidak punya akses. Semua keputusan masuk jejak audit.
- **Tanya Jawab**: hanya jamaah yang disetujui yang boleh bertanya. Pengurus masjid aktif, penjawab, dan Super Admin otomatis boleh. Dijaga di server (`qa_ask`), bukan hanya di tampilan.
- Data pendaftaran tidak bisa dibaca langsung dari aplikasi (tanpa kebijakan tabel); semuanya lewat fungsi server.
**4C - Jejak audit**
- Super Admin: dashboard > Jejak audit (semua, saring jenis dan masjid). Admin Masjid: dashboard > Jejak audit (hanya masjidnya, tanpa email pelaku).
- **Tidak bisa diubah atau dihapus** oleh siapa pun, termasuk pemilik tabel (trigger; hanya pengosongan otomatis kunci asing saat masjid/akun dihapus yang diizinkan). Halaman hanya membaca.
- Kini juga tercatat: pendaftaran dan keputusan jamaah, buku (tambah/ubah/hapus, hanya nama bagian yang berubah, tanpa nomor WA/link), penjawab Tanya Jawab, penghapusan pertanyaan. Kejadian lama (kas, undangan, pengurus, status masjid) tetap tampil dengan label Indonesia.
- Halaman berikutnya memakai (waktu, id) agar tidak ada baris terlewat/ganda.
- Pasang: jalankan `daftar_audit.sql` (setelah tanya.sql; buku.sql dan kas.sql bila dipakai) → unggah v69. Bila `tanya.sql` dijalankan ulang, jalankan `daftar_audit.sql` lagi. Cache service worker v60. Teks privasi diperbarui.
- Tes: `unit_jamaah.mjs` (15), `daftar_browser_test.py` (49), SQL `dj_tests.sql` (93).

## Tambahan v70: Perombakan visual, Tahap 1 dan 2 (Design System v1.2)
- **Tahap 1 - fondasi**: `tokens.css` (palet resmi: Emerald #086653, Deep Green, Gold #D5A84B, latar #FAF8F1, status, jarak, radius, bayangan) dan `ui-kit.css` (tombol, input, kartu, chip, segmen). Nama warna lama dipetakan ke token baru, sehingga seluruh halaman lama otomatis berganti palet tanpa ditulis ulang. Panduan: `DESIGN-SYSTEM.md`.
- **Font**: Plus Jakarta Sans disiapkan dengan font cadangan sistem. Untuk mengaktifkan, taruh `PlusJakartaSans.woff2` di folder utama (belum disertakan: tidak bisa diunduh dari lingkungan kerja). Font Al-Qur'an (Amiri/Scheherazade) tidak diubah.
- **Tahap 2 - splash, masuk, daftar, atur ulang password**: latar masjid layar penuh dengan lapisan gradien hijau di bawah; logo dan nama di atas; kolom email/password gaya kaca; tombol **Masuk** zamrud bercahaya dengan panah; tombol **Buat Akun Baru** garis emas; tautan Kebijakan Privasi & Disclaimer (membuka halaman privasi) dan "Jelajahi tanpa masuk". Petak fitur untuk tamu dipindah ke bagian "Jelajahi tanpa masuk" di bawah layar masuk (semua tetap berfungsi).
- **Latar**: saat ini ilustrasi masjid buatan kode (`masjid-hero.svg`). Bila berkas foto `bg-masjid.jpg` diunggah ke folder utama, otomatis dipakai menggantikan ilustrasi.
- Target sentuh tombol Masuk, Buat Akun, mata password, dan Lupa password minimal 44 px; kontras warna teks diperiksa otomatis (>= 4.5).
- Perbaikan tes lama: `browser_test.py` kini ikut regresi.
- Cache service worker v61. Tes: `auth_visual_test.py` (38).

## Tambahan v71 - Editor Tampilan Aplikasi (khusus Super Admin)
- Dashboard Super Admin > **Tampilan aplikasi**: ganti foto latar splash/login/daftar, ganti ikon Akses Cepat tiap fitur, dan unggah font aplikasi.
- SQL: `tampilan.sql` (jalankan SETELAH `daftar_audit.sql`, aman diulang). Tabel `app_branding` (publik dibaca, tidak bisa ditulis langsung), fungsi `branding_set` / `branding_reset` (hanya Super Admin, tercatat di Jejak audit), bucket publik `branding` (maks 2 MB).
- Berkas: `branding-service.js`, `branding-ui.js`. Tampilan dipakai semua orang sebelum login; salinan disimpan di perangkat (`baituna.brand.v1`).
- Bila foto/ikon gagal dimuat, otomatis kembali ke bawaan. Font Al-Qur'an tidak ikut berubah.

## Tambahan v72 - Dashboard baru per peran (Tahap 3-5)
- Beranda Jamaah, Admin Masjid, dan Super Admin memakai komponen yang sama (`home-ui.js`, gaya di `home.css`): header sapaan, banner geser, banner Pasar Umat, kartu Jadwal Salat Hari Ini (dihitung di perangkat; hitung mundur berjalan), Akses Cepat, artikel / aktivitas / statistik.
- Menu bawah mengikuti peran. Jamaah: Beranda, Al-Qur'an, Masjid, Agenda, Akun. Admin Masjid: Beranda, Pengurus, Keuangan, Agenda, Lainnya. Super Admin: Beranda, Masjid, Pengguna, Audit, Akun.
- Ikon Akses Cepat memakai kunci `open-xxx` (`quick-catalog.js`), jadi bisa diganti dari editor Tampilan aplikasi.
- Semua angka dan daftar berasal dari data nyata (tanpa contoh palsu). Bagian tanpa data (artikel, aktivitas) disembunyikan.
- Tidak ada SQL baru di v72.
- Ketua Takmir/Bendahara: subjudul ajakan "Mari perkuat iman…" di bawah nama; "Ketua Takmir · <masjid>" jadi chip. Jamaah biasa tetap seperti semula.
- Super Admin: judul = nama akun, subjudul ajakan, chip "Super Admin". Tanpa SQL.

## Tambahan v108 (perombakan dashboard: Tasbih Digital + susunan sesuai desain baru)
- **Tasbih Digital** (bagian baru, setelah Pasar Umat) di dashboard Jamaah, Admin Masjid, dan Super Admin: lingkaran ketuk, target 33/99/100/tanpa target, −1, Ulang (dengan konfirmasi), pengaturan bunyi, dan "Buka Penuh" yang membuka halaman Dzikir langsung di tab Tasbih. Hitungan hanya di perangkat dan sama dengan tab Tasbih di Dzikir. Bagian ini wajib (tidak bisa dihapus di Builder); susunan Builder lama yang belum memuatnya disisipi otomatis setelah Pasar Umat. Tanpa SQL.
- **Header:** Super Admin = nama akun + "Super Admin BAITUNA". Admin Masjid = nama akun + "Admin <masjid>" + kartu masjid (nama, kota) yang membuka Profil Masjid. Ketua/Bendahara = "Ketua Takmir/Bendahara <masjid>". Jamaah tetap dengan kalimat "Mari perkuat iman…".
- **Admin Masjid:** Ringkasan Operasional 4 kolom (Pengurus Aktif, Agenda Mendatang, Pengumuman Aktif, Undangan Pending); Ringkasan Keuangan dengan tombol Catat Kas dan Lihat Laporan; Jadwal Salat dipindah setelah keuangan.
- **Super Admin:** menu "Editor Konten" dan "Pengaturan Tampilan"; Statistik Platform jadi satu kartu 4 kolom dengan "Lihat Detail"; Jadwal Salat dipindah ke bawah statistik.
- Menu bawah tiap peran sudah sama dengan desain, tidak diubah.
- Belum ada: menu "Pengguna" di Manajemen Platform (butuh halaman daftar pengguna; tahap tersendiri).
- Belum ada: menu "Pengguna" di Manajemen Platform (butuh halaman daftar pengguna; tahap tersendiri).

## Tambahan v109 (header: subjudul + kotak putih peran)
- Super Admin, Admin Masjid, Ketua Takmir/Bendahara: di bawah nama tampil kalimat "Mari perkuat iman…", lalu kotak putih membulat berisi peran ("Super Admin BAITUNA", "Admin <masjid>", "Ketua Takmir <masjid>"). Admin dan Ketua/Bendahara menampilkan kota di kotak; kotak Admin membuka Profil Masjid. Tanpa SQL.
## Tambahan v111
- Kotak peran di header disejajarkan dengan teks sapaan (bukan dengan foto profil). `pages.css`, `profil-ui.js`. Tanpa SQL.

## Tambahan v112 (tombol Kembali mundur satu langkah, Beranda ingat posisi gulir)
- Kembali bawaan HP (dan tombol "Kembali") dari halaman fitur: kembali ke halaman yang baru dilihat (mis. Lainnya → Doa → Kembali = daftar Lainnya, di posisi gulir yang sama), baru ke Beranda bila sudah di halaman pertama. Berlaku untuk semua akun.
- Di dalam halaman (detail, layar pengelolaan, Editor → Builder, Kas, Agenda, Audit): Kembali HP naik satu tingkat lewat tombol "←" halaman itu.
- Beranda mengingat posisi gulir: kembali dari fitur/pengelolaan, Beranda terbuka di tempat semula. Tombol "Beranda" di menu bawah dan logo tetap ke paling atas.
- Tanpa SQL.
- Di dalam halaman (detail, layar pengelolaan, Editor → Builder, Kas, Agenda, Audit): Kembali HP naik satu tingkat lewat tombol "←" halaman itu.
- Beranda mengingat posisi gulir: kembali dari fitur/pengelolaan, Beranda terbuka di tempat semula. Tombol "Beranda" di menu bawah dan logo tetap ke paling atas.
- Tanpa SQL.

## Tambahan v113 (Super Admin: Pengguna)
- **SQL BARU (jalankan dulu): `pengguna.sql`** (setelah daftar_audit.sql). 3 fungsi khusus Super Admin: `admin_users_list` (daftar akun + cari + saring), `admin_set_masjid_admin`, `admin_unset_masjid_admin`. Hanya peran Admin Masjid yang dapat diberikan/dicabut; peran pengurus lain tidak disentuh; akun Super Admin tidak bisa diubah; masjid harus aktif; tercatat di jejak audit. 27 tes SQL (`pengguna_tests.sql`).
- Menu **Pengguna** di Manajemen Platform (8 menu) membuka daftar akun; menu yang sama ada di Editor (urutan ke-2).
- Daftar: nama, email, status (Pengguna umum / Admin Masjid + nama masjid / Super Admin), pencarian nama/email, saringan, tombol "Jadikan Admin Masjid" (pilih masjid aktif) dan "Jadikan pengguna umum" (dengan konfirmasi).
- Statistik Platform: ikon "Ditolak / Nonaktif" kini masjid bercoret (bukan orang).
- Daftar: nama, email, status (Pengguna umum / Admin Masjid + nama masjid / Super Admin), pencarian nama/email, saringan, tombol "Jadikan Admin Masjid" (pilih masjid aktif) dan "Jadikan pengguna umum" (dengan konfirmasi).
- Statistik Platform: ikon "Ditolak / Nonaktif" kini masjid bercoret (bukan orang).

## Tambahan v114 (Admin Masjid melekat di akun; mendaftarkan masjid sendiri)
- **SQL BARU: `admin_akun.sql`** (jalankan SETELAH pengguna.sql dan mosque_register.sql). Tabel `admin_accounts` (status Admin Masjid per akun), `is_masjid_admin()`, `mosque_register` kini cukup berstatus Admin Masjid (tak perlu masjid aktif; batas 3 menunggu + nama/kota unik tetap), `admin_set_masjid_admin(user)` (langsung aktif, tanpa masjid), `admin_unset_masjid_admin(user)` (matikan status + cabut peran admin_masjid; masjid yang sudah didaftarkan tetap ada), `admin_users_list` memuat semua masjid milik akun beserta statusnya. 37 tes SQL (`admin_akun_tests.sql`).
- **Pengguna:** "Jadikan Admin Masjid" langsung aktif. Akun admin menampilkan nama, status, dan daftar masjid yang didaftarkan (Menunggu verifikasi / Aktif / Ditolak / Nonaktif + lokasi).
- **Admin Masjid tanpa masjid aktif:** dashboard admin sendiri (bukan jamaah) dengan kotak "Admin Masjid · status", daftar masjid miliknya, dan pendaftaran masjid. Fitur pengurus/kas/agenda aktif setelah ada masjid terverifikasi.
- **Masjid Saya** (kotak masjid di header / kartu "Daftarkan Masjid"): daftar masjid yang dikelola + status, tombol "Kelola masjid ini" untuk berpindah masjid, ketentuan pendaftaran + wajib centang persetujuan.
- **Header Admin Masjid:** kotak putih menampilkan nama masjid + lokasi singkat (kota, provinsi) seperti desain.

## Tambahan v115 (Artikel Terbaru tampil sebagai kartu artikel)
- Bagian "Artikel Terbaru" di dashboard Admin Masjid, Super Admin, dan ketua/bendahara kini bagian bawaan `artikel` (kartu artikel asli), bukan lagi tombol ikon "Berita & Artikel".
- Tata letak lama yang tersimpan (blok "Artikel Terbaru" berisi tombol berita) otomatis diubah ke bagian bawaan.
- Kartu hanya muncul bila sudah ada artikel yang diterbitkan. Tanpa SQL.

## Tambahan v116 (Daftar masjid: Provinsi → Kota/Kabupaten → Kecamatan)
- Form "Daftarkan masjid baru" (Admin Masjid): urutan Nama masjid, Provinsi, Kota/Kabupaten, Kecamatan, Telepon, Alamat. Ketiganya berupa daftar pilihan bertingkat.
- Daftar wilayah diambil dari API publik api-wilayah-indonesia (emsifa) lalu disimpan di HP. Bila gagal dimuat, otomatis jadi isian teks.
- SQL `wilayah.sql` (jalankan dulu): kolom `mosques.district`, `mosque_register` menerima `p_district`.

## Tambahan v117 (Galeri masjid dunia tanpa kolom lintang/bujur)
- Kolom Lintang, Bujur, dan petunjuk koordinat dihapus dari formulir Super Admin. Saat mengubah masjid lama, koordinat yang sudah tersimpan tetap dipertahankan. Tanpa SQL.

## Tambahan v118 (Super Admin: Hapus masjid nonaktif)
- Daftar masjid Super Admin: masjid berstatus Nonaktif atau Ditolak punya tombol "Hapus" (dengan konfirmasi). Masjid aktif/menunggu tidak bisa dihapus.
- Penghapusan permanen: pengurus, undangan, agenda, postingan ikut terhapus; foto masjid dibersihkan; tercatat di Audit ("Masjid dihapus").
- Masjid yang sudah punya catatan keuangan TIDAK bisa dihapus (catatan keuangan permanen); aplikasi menampilkan pesannya.
- SQL `masjid_hapus.sql` (jalankan dulu).

## Tambahan v119 (Daftar masjid: foto, tautan Google Maps, label telepon)
- Kolom telepon berlabel "No.HP/Telepon" (form daftar dan profil masjid).
- Sampai 10 foto per masjid, tiap foto otomatis diperkecil sampai maksimal 100 KB. Foto pertama jadi sampul; foto lain tampil sebagai galeri di profil publik masjid.
- Kolom tautan lokasi Google Maps: koordinat dibaca otomatis dari tautan panjang; tautan pendek (maps.app.goo.gl) disimpan apa adanya. Tombol "Buka di Google Maps" di profil publik memakai tautan itu.
- SQL `masjid_foto_peta.sql` (jalankan dulu, setelah wilayah.sql).

## Tambahan v120 (Pratinjau masjid, edit profil dirapikan, kotak foto pendaftaran)
- Masjid Saya: tiap masjid yang didaftarkan bisa diklik ("Lihat detail") untuk pratinjau: foto/galeri, status, wilayah, alamat, telepon, tombol Buka di Google Maps. Berlaku juga untuk masjid yang masih menunggu verifikasi.
- Edit profil masjid: kolom lintang/bujur dan tombol lokasi perangkat dihapus (diganti kolom tautan Google Maps); kotak unggah foto lama dihapus (foto diunggah saat mendaftar).
- Kotak foto pada form pendaftaran bergaya "Foto masjid" (kotak putus-putus "Belum ada foto"). Tanpa SQL baru.

## Tambahan v121 (Peta Google Maps tersemat)
- Di bawah baris "Lokasi" (pratinjau Masjid Saya dan profil publik masjid) tampil peta Google Maps sungguhan (tersemat) bila koordinat masjid ada. Tanpa kunci API, tanpa SQL.
- Tautan pendek (maps.app.goo.gl) tidak punya koordinat terbaca, jadi hanya tombol "Buka di Google Maps" yang tampil.

## Tambahan v122 (Peta perkiraan bila koordinat tidak ada)
- Bila masjid punya tautan Google Maps tetapi koordinatnya tidak terbaca (mis. tautan pendek), peta tersemat tetap tampil sebagai peta perkiraan dari nama + alamat masjid, dengan keterangan. Tanpa SQL.

## Tambahan v123 (Edit profil masjid: kelola foto lagi)
- Edit profil masjid (Admin Masjid) kembali punya panel "Foto masjid": lihat foto yang ada, tambah foto (total maksimal 10, tiap foto otomatis <= 100 KB), dan hapus foto satu per satu. Foto lama (1 foto versi awal) tampil sebagai "foto lama" dan bisa dihapus. Tanpa SQL baru.

## Tambahan v124 (Artikel Terbaru berupa daftar, 5 artikel)
- "Artikel Terbaru" di semua dashboard kini daftar satu kolom (bukan dua kartu berdampingan) dan menampilkan 5 artikel terbaru. Tanpa SQL.

## Tambahan v125 (Super Admin: halaman Periksa pendaftaran)
- Daftar masjid Super Admin: tiap baris punya tombol "Cek" menuju halaman khusus pemeriksaan: semua data yang diinput (nama, provinsi, kota, kecamatan, alamat, telepon, tautan & koordinat Google Maps, foto, pendaftar, tanggal), peta, pemeriksaan otomatis (kelengkapan data, foto, koordinat, nama ganda), lalu tombol keputusan (Setujui / Tolak / Nonaktifkan / dll.). Tanpa SQL.

## Tambahan v126 (Perombakan Keuangan Masjid) — JALANKAN `kas_baru.sql` DULU
- Layar Ringkasan baru: gambar masjid, navigasi bulan, empat kartu (Saldo awal, Kas masuk, Kas keluar, Saldo akhir), "Daftar Pengeluaran" (5 terbaru, "Lihat Semua"), tombol "+ Tambah Transaksi". Tab: Ringkasan, Transaksi, Pengaturan.
- Tambah Transaksi: tab Kas Masuk | Kas Keluar. Nama barang, jumlah barang, keterangan, donatur/penerima, dan foto nota semuanya OPSIONAL. Keterangan kosong diisi server dari nama barang atau nama kategori.
- Input cepat (Pengaturan): pilih kategori + isi nominal saja; ada tautan ke formulir lengkap. Mode tersimpan per masjid.
- Transaksi favorit: centang "Simpan sebagai transaksi favorit" saat mencatat; favorit tampil sebagai tombol di atas formulir (ketuk untuk mengisi, × untuk hapus).
- Upload nota: kotak putus-putus, pratinjau, nama, ukuran, tombol hapus; foto otomatis <= 100 KB, bucket privat cash-proofs.
- Rincian Transaksi: kategori, nama barang, jumlah barang, keterangan, foto nota (Lihat Foto), tombol Ubah dan Hapus. Catatan keuangan TETAP tidak bisa ditimpa: "Hapus" membuat catatan koreksi (pembatalan), "Ubah" membatalkan yang lama dan mencatat yang baru dalam satu langkah (kas_replace).
- Transparansi ke jamaah (Pengaturan): "Tampilkan ringkasan keuangan" / "Sembunyikan laporan keuangan". Jamaah dan tamu hanya melihat empat total; server tidak lagi mengirim rincian kategori/akun kepada mereka.
- Hak mencatat: Bendahara DAN Admin Masjid (Ketua Takmir dan Super Admin tetap hanya melihat/menyetujui).
- SQL: kas_baru.sql (kolom item_name, item_qty, input_mode; tabel cash_favorites; fungsi kas_catat, kas_replace, kas_fav_save, kas_fav_delete, kas_set_mode; can_cash_write; kas_report). Aman dijalankan ulang; jalankan SETELAH kas.sql. Uji: kas_baru_tests.sql.

## Tambahan v127 (Keuangan: tanpa tab Favorit, ikon di kolom isian)
- Tab Favorit dihapus. Favorit kini tombol kecil di atas formulir Tambah Transaksi (ketuk untuk mengisi; tanda × menghapus).
- Setiap kolom isian punya ikon di kiri (tanggal, kategori, akun, nama barang, jumlah barang, total/jumlah, keterangan, donatur/penerima, nama favorit). Tanpa SQL baru.

## Tambahan v128 (Admin Masjid: "Kelola Masjid" dan "Profil Masjid" membuka daftar masjid)
- Banner "Kelola Masjid" dan tombol "Profil Masjid" kini membuka halaman "Masjid Saya": daftar semua masjid yang didaftarkan admin itu (semua status). Ketuk satu masjid untuk profil lengkapnya (foto, alamat, wilayah, telepon, peta). Dari profil masjid yang sedang dikelola ada tombol "Edit profil masjid"; untuk masjid aktif lain ada "Kelola masjid ini". Ada juga "+ Daftarkan masjid baru". Tanpa SQL.

## Tambahan v129 (Beranda: "Kartu fitur" — kartu yang bisa diatur isinya)
- Super Admin: di Tampilan Beranda ada tombol "+ Kartu fitur". Pilih fitur, lalu atur judul, deskripsi singkat, gambar (thumbnail), teks tombol.
- Fitur berisi daftar (Berita/Artikel, Pustaka Buku, Sejarah Islam): pilih tampilan Kartu / Grid / Daftar dan jumlah isi (1-6). Isi diambil otomatis dari data asli.
- Fitur yang bisa disematkan (Kalkulator Zakat, Jadwal Salat, Al-Qur'an): pilih ukuran Ringkas (kartu + tombol) atau Penuh (tampil langsung di beranda).
- Fitur lain: kartu dengan judul, gambar, deskripsi, dan tombol buka.
- Berlaku untuk beranda Jamaah/Admin/Super sesuai tab peran yang diedit.
- Jalankan sql/beranda_kartu.sql (setelah beranda_banner.sql). Cache SW baituna-static-v103.

## Tambahan v130 (Keuangan Masjid: panel "Akun kas" dan "Kategori" dihapus dari Pengaturan)
- Pengaturan kini hanya berisi Transparansi laporan ke jamaah dan Pengaturan pencatatan. Kategori dan akun bawaan tetap dipakai apa adanya.
- Tidak ada perubahan SQL. Cache SW baituna-static-v104.

## Tambahan v131 (Admin Masjid: menu Pengurus kini membuka halaman sendiri)
- Menu Pengurus (Akses Cepat dan bilah bawah) membuka halaman "Pengurus Masjid" tersendiri, tidak lagi menggulir ke bagian di beranda (yang hilang bila susunan beranda tidak memuatnya). Undang pengurus/bendahara dari sini.
- Tidak ada perubahan SQL. Cache SW baituna-static-v105.

## Tambahan v132 (Super Admin: kolom "Urutan" dihapus dari formulir Doa dan Dzikir)
- Teks baru otomatis berurutan bawaan (100); teks lama tetap memakai urutannya. Tidak ada perubahan SQL. Cache SW baituna-static-v106.

## Tambahan v133 (Super Admin: perombakan Kelola Doa Shahih + Import dari Excel)
- Kelola Doa Shahih: tombol Import dari Excel/Spreadsheet, Download Template Excel, Tambah Doa Manual, pencarian, filter (derajat, jenis), chip kategori dengan jumlah, kartu doa (judul, Arab, terjemahan, sumber, derajat) dengan menu Lihat detail / Ubah / Hapus.
- Import Doa dari Excel: unduh template (.xlsx: lembar Doa, Contoh, Petunjuk; pilihan kategori/derajat/jenis), unggah, pratinjau (total, valid, bermasalah, duplikat, daftar kesalahan per baris dan kolom), konfirmasi, simpan per 100 baris, ringkasan hasil, laporan CSV.
- Aturan: derajat hanya Shahih/Hasan; sumber, terjemahan, penilai wajib untuk doa hadis; ayat hanya rujukan; nilai tak dikenali ditolak (tidak diubah diam-diam); duplikat (teks Arab tanpa harakat, judul, atau rujukan ayat) dilewati, tidak menimpa.
- Keamanan: hak akses tetap dijaga RLS di server (hanya Super Admin); berkas dibaca berdasarkan isi zip/xlsx; rumus tidak pernah dihitung; batas 2 MB, 1000 baris. Tanpa pustaka luar (pembaca xlsx sendiri, DecompressionStream bawaan peramban). Hanya .xlsx.
- Daftar doa dibaca per halaman 1000 baris (maks. 5000). Tidak ada perubahan SQL. Cache SW baituna-static-v107.

## Tambahan v134 (Admin Masjid: daftar pengurus tanpa undangan)
- Admin Masjid menambah pengurus langsung: Nama Lengkap + Jabatan (dropdown: Ketua Takmir, Sekretaris, Bendahara, Sarana & Prasarana, Pendidikan & Remaja Masjid) + email akun (opsional). Hapus dari daftar dengan satu tombol.
- Formulir dan daftar undangan dihilangkan dari tampilan Admin Masjid. Bila email diisi, izin akses dicatat di balik layar memakai mekanisme yang sudah ada (peran: Ketua Takmir, Bendahara, atau Pengurus Bagian) dan akun yang sudah ada tetap tampil di "Akun yang punya akses" dengan tombol Cabut.
- Super Admin tetap memakai panel undangan lama (untuk mengangkat Admin Masjid).
- Jalankan sql/pengurus_daftar.sql (setelah tahap3.sql). Tabel baru mosque_officers; tulis hanya lewat fungsi officer_add/officer_remove. Cache SW baituna-static-v108.

## Tambahan v135 (Pengurus: pilih masjid lewat dropdown)
- Halaman Pengurus Masjid (Admin Masjid) kini punya dropdown "Pilih masjid": berisi semua masjid aktif milik admin itu (bertambah saat admin mendaftarkan masjid baru). Memilih masjid memuat daftar pengurusnya; pengurus baru ditambahkan ke masjid yang dipilih. Judul bagian di beranda menyebut nama masjid. Tanpa perubahan SQL. Cache SW baituna-static-v109.

## Tambahan v136 (Perbaikan: Import Doa gagal saat berkas berisi hadis dan ayat bersamaan)
- Penyebab: impor massal ke server mensyaratkan semua baris memiliki kolom yang sama; baris hadis dan baris ayat sebelumnya berbeda sehingga seluruh kelompok ditolak. Kini semua baris dikirim dengan kolom seragam (nilai kosong = null). Diuji dengan berkas asli (47 doa valid, termasuk 9 ayat) terhadap batasan tabel duas. Tanpa perubahan SQL. Cache SW baituna-static-v110.

## Tambahan v137 (Keuangan: kartu Kas masuk/keluar rapi + tombol "Reset ke bulan ini")
- Kartu Kas masuk dan Kas keluar di Ringkasan sempat mepet karena kelas "in" bentrok dengan gaya kolom isian; diganti pos/neg. Tombol "Reset ke bulan ini" di Ringkasan (dan Transaksi) mengembalikan ke bulan sekarang; nonaktif bila sudah di bulan ini. Tidak ada data dihapus. Cache SW baituna-static-v111.

## Tambahan v138 (Keuangan: "Reset kas (mulai dari awal)" untuk Admin Masjid)
- Tombol di Ringkasan Kas (hanya Admin Masjid/Super Admin; Bendahara dan Ketua tidak melihatnya). Wajib mengetik RESET. Menghapus semua catatan kas, penutupan bulan, dan transaksi favorit masjid itu; saldo awal semua akun menjadi 0. Akun, kategori, dan pengaturan tetap. Tidak bisa dibatalkan. Tercatat di Jejak Audit (jumlah catatan dan total masuk/keluar sebelum dihapus). Foto nota lama tetap di penyimpanan (tidak lagi tertaut).
- Tombol "Reset ke bulan ini" (v137) diganti. Jalankan sql/kas_reset.sql setelah kas.sql dan kas_baru.sql (jangan menjalankan ulang kas.sql sesudahnya, atau jalankan kas_reset.sql lagi). Ubah/hapus catatan biasa tetap ditolak. Cache SW baituna-static-v112.

## Tambahan v139 (Agenda: tampilan baru di semua akun)
- Kartu fitur "Agenda & Info" sekarang menampilkan agenda mendatang yang nyata dari masjid-masjid: foto dengan lencana tanggal, judul, jam, tempat, nama masjid, dan panah. Tampilan bisa Geser (carousel dengan titik), Daftar, atau Grid, dengan 1-6 agenda. Berlaku untuk beranda Jamaah, Admin Masjid, dan Super Admin (layout yang sudah tersimpan ikut berubah otomatis).
- Halaman Agenda & Pengumuman: kartu tanggal (Masehi + Hijriah perkiraan), tab Semua / Kajian / Kegiatan / Pengumuman, daftar "Agenda mendatang" (kotak tanggal, jam, tempat, nama masjid, foto, panah), dan "Pengumuman Terbaru" dengan Lihat Semua. Tab Kajian = agenda berjenis "Kajian / pengajian"; Kegiatan = agenda berjenis lain.
- Kartu "Agenda Kegiatan" di beranda Admin Masjid bergaya sama. Editor Kartu fitur: isian tidak lagi melewati tepi kanan, pratinjau gambar lebih kecil, dan fitur Agenda punya pilihan Tampilan serta Jumlah agenda. Tanpa SQL baru.

## Tambahan v140
- Reset kas: pop-up konfirmasi dihilangkan; tombol "Reset kas (mulai dari awal)" langsung mereset.

## Tambahan v141
- Kartu Agenda di beranda dibuat lebih besar (foto, judul, jam, tempat, label masjid).

## Tambahan v142
- Ikon mata (tampilkan/sembunyikan) di kolom Password dan Ulangi password pada Daftar akun, reset password, dan Ganti Password di Profil.

## Tambahan v143 (Super Admin: statistik pengguna)
- Statistik Platform: bagian "Data Pengguna" (Total Pengguna, Admin Masjid, Pengguna Umum) di bawah "Data Masjid". Halaman Pengguna: bagian atas dengan 4 kartu angka (Total, Admin Masjid, Pengguna Umum, Baru Minggu Ini), ilustrasi masjid, dan jumlah di tiap saringan. Jalankan sql/pengguna_statistik.sql (setelah admin_akun.sql); tanpa SQL itu bagian angka pengguna disembunyikan dan halaman tetap berfungsi seperti biasa.

## Tambahan v144 (splash Android)
- Warna latar manifest (layar pembuka bawaan Android) diganti biru langit sama dengan splash BAITUNA, dan latar halaman awal memakai gradasi yang sama, agar peralihan ke splash tidak berkedip krem. Layar pembuka bawaan Android (ikon di tengah) dibuat oleh sistem Android dan tidak bisa diganti gambar sendiri.

## Tambahan v145
- Splash BAITUNA selalu memakai latar langit + ilustrasi masjid (seperti di iPhone), tidak lagi berganti ke foto latar di Android.

## Tambahan v146
- Layar pembuka bawaan Android: ikon "any" (192 dan 512) dibuat transparan sehingga logo menempel di latar krem; ikon maskable (peluncur) tetap berlatar putih. Latar manifest kembali krem.

## Tambahan v147
- Ikon maskable (yang dipakai Android untuk layar pembuka dan peluncur) kini berlatar krem sama dengan latar layar pembuka, jadi kotak putih tidak terlihat lagi.

## Tambahan v148
- Layar pembuka Android: latar manifest dan ikon maskable diputihkan agar kotak ikon menyatu dengan latar.

## Tambahan v149
- Editor (Super Admin): menu Notifikasi dan Audio Adzan (unggah & kelola). Unggah audio adzan: bila Nama atau Sumber/pelantun kosong, kolomnya bertanda merah dengan pesan jelas; daftar yang gagal dimuat menyebut adzan.sql.

## Tambahan v150
- Unggah audio adzan: tanda merah pada kolom hilang setelah isian benar. Panduan: jalankan sql/adzan.sql sebelum mengunggah audio.

## Tambahan v151
- Daftar audio adzan untuk semua pengguna gagal dimuat karena diurutkan memakai kolom created_at yang tidak boleh dibaca pengguna umum; kini diurutkan dengan sort_order lalu nama.

## Tambahan v152
- Keterangan di halaman Adzan diringkas menjadi 3 poin ("Perlu diketahui").

## Tambahan v153
- Notifikasi → Pengaturan dirapikan: panel (push, Waktu salat, Amalan harian, Puasa, Adzan, Ramadan, Pengingat pribadi, Pengingat di HP) kini bisa dilipat dan tertutup bawaan, teks dipersingkat (rincian data push di "Data & batasan"). Halaman jadi sekitar sepertiga panjang semula.
- "Pengingat pribadi saya": pilihan hari kini tombol kecil (Min–Sab) yang rapi; formulir ditata ulang.
- "Masjid terdekat" dipindah menjadi baris "Kabar masjid dalam jarak" di kartu Jenis notifikasi (muncul hanya bila kajian/sosial/pengumuman aktif).

## Tambahan v154
- Tampilan tablet & desktop (file baru `desktop.css`, dimuat paling akhir; tampilan HP di bawah 768px tidak berubah).
- Tablet (768px ke atas): menu bawah tidak lagi melebar penuh (di tengah, maks 600px); beranda dua kolom untuk Pustaka/Pasar, Agenda/Pengumuman, dan artikel; daftar "Lainnya" dua kolom.
- Desktop (1024px ke atas): menu pindah ke samping kiri (dengan logo BAITUNA), konten lebih lebar; beranda dua kolom (Tasbih/Jadwal, ringkasan, statistik); kepala halaman publik melayang membulat.
- Dicek otomatis di lebar 390, 768, 1024, 1280 px: tidak ada geser menyamping.

## Tambahan v155
- Statistik Platform (Super Admin): ikon dalam lingkaran berwarna seperti desain (Data Masjid: hijau, hijau, kuning, merah; Data Pengguna: biru, hijau, kuning) dengan angka lebih besar.
- "Data Pengguna" kini selalu tampil di bawah Data Masjid. Bila `sql/pengguna_statistik.sql` belum dijalankan, tampil petunjuk menjalankannya (sebelumnya bagian itu disembunyikan).

## Tambahan v156
- Halaman Data Masjid (Super Admin) dirombak: tombol Kembali membulat, judul dengan ilustrasi masjid, 4 kartu angka berikon lingkaran (Masjid Terdaftar, Aktif, Menunggu Verifikasi, Nonaktif), kolom cari (nama/kota/provinsi) + Filter provinsi, kartu "Daftar Masjid" dengan penyaring Semua/Aktif/Menunggu/Nonaktif berhitungan, dan tiap masjid tampil berfoto, lokasi, status, tanggal terdaftar, tombol "Lihat Detail" serta menu ⋮ (Setujui, Tolak, Nonaktifkan, Hapus, Kas, Pengurus). Foto diambil dari foto sampul/galeri masjid; tanpa foto tampil ikon masjid. Di tablet/desktop daftar dua kolom.

## Tambahan v157
- Statistik Platform (Super Admin): kepala "Data Pengguna" kini punya tombol "Lihat Detail >" yang membuka halaman Pengguna.

## Tambahan v158
- Kelola Amalan Sunnah Harian (Super Admin): tombol "Import dari Excel/Spreadsheet" dan "Download Template Excel", seperti Kelola Doa Shahih. Alur: unduh template → isi lembar "Amalan" → unggah → pratinjau (baris valid, bermasalah, diduga duplikat) → impor. Kolom: waktu, judul_amalan, penjelasan, teks_arab, teks_latin, sumber, derajat_hadis (Shahih/Hasan), penilai_derajat, keterangan, terkait_pengingat. Aturan sama dengan formulir (hadis lemah ditolak, sumber dan penilai wajib). Duplikat (judul sama di waktu yang sama, atau teks Arab sama) dilewati. Kolom terkait_pengingat butuh sunnah_link.sql; bila belum, tampil petunjuk.
- File baru: sunnah-import.js, sunnah-import-ui.js. doa-import.js kini membagikan pembuat .xlsx-nya (tanpa perubahan perilaku impor doa).

## Tambahan v159
- "Lihat Detail >" di Statistik Platform kini berada di dalam kotak (home.css).

## Tambahan v160
- Push adzan: getar, tetap tampil sampai diketuk, dan adzan diputar otomatis bila BAITUNA masih terbuka. Panduan "Agar HP berbunyi adzan" di Notifikasi.

## Tambahan v161
- "Lihat Detail >" Statistik Platform dipindah ke dalam kotak Data Masjid (seperti Data Pengguna); kotak terpisah v159 dihapus.

## Tambahan v162
- Ramadan Center: kartu utama (hitung mundur) kembali berlatar hijau; sebelumnya putih sehingga teks tidak terbaca.

## Tambahan v163
- Banner Jamaah "Bersama BAITUNA": tulisan kecil "SEJARAH ISLAM" di atas judul dihapus (tidak ada di editor Super Admin).

## Tambahan v164
- Tracker Ibadah Harian: tombol "Mulai Tracker Harian" di bagian bawah (pilih jam, otomatis membuat pengingat harian; bisa ubah jam, pasang alarm kalender HP, atau hentikan).
- Bagian "Hasil target": per hari (x dari y + daftar + ucapan) atau 7 hari terakhir (grafik batang, hijau ✓ = penuh) dengan pesan semangat. Tanpa skor/peringkat/streak. Data tetap hanya di perangkat.

## Tambahan v165
- Tracker: "Hasil target" kini langsung tampil sebagai grafik batang 7 hari (ketuk batang untuk rincian hari itu); "Ringkasan pribadi" dilipat.

## Tambahan v166
- Profil masjid (publik): daftar Pengurus masjid (nama + jabatan, tanpa email) tampil; butuh pengurus_publik.sql.
- Edit profil masjid: kolom Koordinat (lintang, bujur) + tombol "Isi dari lokasi HP ini". Tautan Google Maps pendek tidak memuat koordinat, jadi jadwal salat butuh koordinat ini. Mengganti tautan tidak lagi menghapus koordinat.

## Tambahan v167
- Formulir "Daftarkan masjid baru": kolom Koordinat + tombol "Isi dari lokasi HP ini".
- Profil masjid publik: kartu "Jadwal salat" disembunyikan bila masjid belum punya koordinat (tidak lagi menampilkan pesan "Lokasi belum diisi").

## Tambahan v168
- Tasbih Digital (kartu di beranda dan halaman penuh) + penghitung kartu Dzikir Pagi/Petang: HP bergetar saat target tercapai. Bawaan menyala; ada pilihan "Getar saat target tercapai" untuk mematikan. Pilihan disimpan di HP.
- Catatan: getar tidak ada di iPhone/Safari, dan di Android bergantung pengaturan getar HP. Bila peramban tidak mendukung, pilihan tidak ditampilkan.

## Tambahan v169
- Tasbih (beranda & halaman penuh): tombol "Coba getar" di samping pilihan getar. Menggetarkan HP 0,6 detik dan menampilkan apakah peramban menerima atau menolak perintah getar, untuk membedakan masalah aplikasi dengan pengaturan HP.

## Tambahan v170
- Fitur getar pada Tasbih dan Dzikir dihapus (di HP uji, peramban menerima perintah tetapi sistem HP tidak menggetarkan; tidak bisa dijamin di semua HP). Tanda target tercapai tetap lonceng, warna, dan tulisan. Pilihan getar dan tombol "Coba getar" dihilangkan.

## Tambahan v171 — Pustaka Buku Premium + Membership
- **SQL BARU (jalankan dulu): `membership.sql`** (setelah buku.sql; aman diulang; tidak menghapus data buku). Isi: kolom buku `access` (gratis/premium, bawaan gratis), `file_path`, `has_file`; tabel paket, pengaturan, rekening, membership, transaksi, komisi, log; fungsi server (buat pesanan, kirim bukti, verifikasi, status komisi, alamat berkas); bucket privat `book-files` (PDF) dan `payment-proofs` (bukti bayar), bucket publik `membership-assets` (gambar QRIS). 75 tes SQL (`membership_tests.sql`).
- Kondisi awal: SQL menandai Premium hanya untuk judul Amigdala Mabrur, Amigdala Sakinah, Tahfizhul…, Otak Ajaib, Energi Sholat, Amigdala Bebas Hutang, sekali saja dan hanya bila belum ada buku premium. Periksa di Kelola Pustaka Buku.
- Jamaah: filter Semua/Gratis/Premium, label dan gembok di sampul, detail buku terkunci untuk non-member, alur Pilih Paket → Isi Data → Pembayaran (transfer/QRIS) → Unggah Bukti → Menunggu Verifikasi, serta Membership Saya (status, tanggal, riwayat, kontak admin).
- Admin (Super Admin, dari Kelola Pustaka Buku → Membership): verifikasi (setujui/tolak + alasan), komisi masjid (pencatatan + status), pengaturan paket/rekening/QRIS/persentase komisi/WA admin. Editor buku: pilihan akses + unggah PDF.
- Keamanan: aktivasi hanya di server setelah Super Admin menyetujui; satu transaksi tidak bisa diaktifkan atau dikomisikan dua kali; PDF premium dijaga kebijakan Storage; bukti bayar hanya terlihat pemilik dan Super Admin.
- Tes: `membership_browser_test.py` (84).

## Tambahan v172
- Pustaka Buku: buku Gratis selalu di urutan paling atas (grid dan list), Premium sesudahnya.
- Super Admin: tombol "Atur Membership" di Pustaka Buku, serta pintasan "Ubah harga paket" (halaman pilih paket) dan "Atur rekening & QRIS" (halaman pembayaran) yang langsung membuka Pengaturan Membership. Jamaah biasa tidak melihatnya.

## Tambahan v173 — Import Dzikir Pagi & Petang dari Excel
- Kelola Dzikir (Super Admin) kini punya ubin "Import dari Excel/Spreadsheet" dan "Download Template Excel".
- Alur: unduh template -> isi -> unggah -> pratinjau (valid / bermasalah / diduga duplikat) -> konfirmasi -> simpan (100 baris per permintaan) -> laporan CSV.
- Validasi mengikuti dzikir.sql: jenis teks wajib Arab, terjemahan, sumber; jenis ayat wajib surah/ayat (maks. 6 ayat); jumlah 1-1000. Baris "CONTOH" ditolak. Tidak ada teks dzikir yang dibuat aplikasi.
- File baru: dzikir-import.js, dzikir-import-ui.js. Tidak ada SQL baru.

## Tambahan v174 — Perombakan Membership Premium Pustaka Buku
- Alur jamaah baru di dalam aplikasi: Pilih Paket -> Checkout (nama, WhatsApp, email opsional, masjid rujukan, ringkasan) -> Pilih Metode (QRIS/Transfer; yang belum dikonfigurasi tidak bisa dipilih) -> Bayar (nomor BTM-YYYYMMDD-XXXXXX, salin, QRIS + simpan, rekening + salin, cara bayar, batas waktu) -> Terima Kasih + Unggah Bukti (JPG/PNG/WebP, maks. 5 MB, pratinjau) -> Bukti Terkirim -> Riwayat & Status (timeline + riwayat bukti) -> Alhamdulillah (aktif) -> Membership Saya (detail, hampir berakhir, berakhir, perpanjang manual).
- Panel Super Admin "Atur Membership": tab Transaksi (8 filter, cari, ringkasan, detail + riwayat bukti + histori, verifikasi/tolak dengan alasan), konfirmasi ubah harga + histori harga, uji koneksi Telegram + log notifikasi + kirim ulang yang gagal.
- membership_v2.sql: harga awal 3 bulan Rp69.000 (bila kosong), checkout idempoten, metode wajib siap, bukti harus ada di Storage, riwayat bukti, histori harga, antrean notifikasi (kunci unik, klaim atomik, retry 5x), tanggal mulai diperbarui saat beli ulang setelah habis, bucket bukti 5 MB.
- Telegram dikirim fungsi server baituna-push (tg-core.js); token hanya di Secrets Supabase (TELEGRAM_BOT_TOKEN, TELEGRAM_SUPER_ADMIN_CHAT_ID).

## Tambahan v175 — Tampilan Pustaka Buku mengikuti mockup
- Header hijau (judul Pustaka Buku + tombol Premium), kolom cari "Cari judul buku, penulis, atau topik…", Grid/List dengan ikon, filter Semua/Gratis/Premium dan Semua Jenis/Buku digital/Buku fisik dalam satu baris (tidak menumpuk di layar 360 px).
- Penghitung "N buku tersedia" dan pilihan Urutkan (Terbaru, Terlama, Judul A–Z; buku Gratis tetap di atas Premium).
- Kartu Grid: sampul persegi, label Gratis/Premium, tombol titik tiga (Lihat detail; Super Admin juga Ubah buku), judul, penulis, chip Digital/Premium. List: kartu per buku dengan panah.
- Banner "Akses semua buku Premium" di bawah daftar (berubah menjadi status bila membership aktif). Kalimat "Pembayaran dan pengiriman diurus langsung dengan penjual…" dihapus dari daftar.
- Penulis (opsional): buku_penulis.sql menambah kolom author; tanpa SQL ini aplikasi tetap jalan, nama penulis hanya tidak tampil. Formulir Kelola buku punya isian Penulis bila kolom ada.

## Tambahan v176 — Filter Pustaka Buku lebih ringkas
- Filter jadi satu baris: dropdown "Semua Jenis" (Semua Jenis / Buku digital / Buku fisik) di kiri, lalu chip Gratis dan Premium. Chip "Semua" dihilangkan; tekan lagi chip yang aktif untuk melepas filter.

## Tambahan v177 — Ikon mahkota emas di filter Premium
- Ikon mahkota pada chip filter "Premium" (Pustaka Buku) kini berlatar lingkaran emas.

## Tambahan v178 — Perbaikan gagal daftar akun
- Penyebab utama: "Confirm email" aktif dengan server email bawaan Supabase (2 email/jam, hanya ke anggota tim) sehingga pendaftar kena batas (429) dan email konfirmasi tidak sampai. Matikan "Confirm email" di Authentication > Sign In / Providers > Email; untuk email reset password pasang SMTP sendiri (mis. Resend) lalu naikkan batas di Authentication > Rate Limits.
- Daftar ulang dengan nomor HP + email yang sama: aplikasi langsung mencoba masuk dengan password yang diketik (tidak lagi "Nomor HP sudah terdaftar"). Nomor milik akun lain: pesan "sudah dipakai akun lain".
- Pesan batas server dibedakan: batas kirim email vs terlalu banyak permintaan dari satu jaringan. Galat lain menampilkan kode untuk dilaporkan.
- aktifkan_akun_tertunda.sql: mengaktifkan akun yang tersangkut belum konfirmasi email (jalankan setelah Confirm email dimatikan).

## Tambahan v179 — Satu nomor HP untuk banyak akun
- Pendaftaran tidak lagi menolak nomor HP yang sudah dipakai akun lain: satu HP (mis. HP keluarga) boleh untuk beberapa akun dengan email berbeda. Yang harus unik hanya email.
- nomor_hp_bersama.sql: menghapus indeks unik nomor HP (diganti indeks biasa) dan menambah phone_account_count(p_phone).
- Masuk/Lupa password dengan nomor HP tetap bisa bila nomor itu hanya dipakai satu akun; bila dipakai beberapa akun, aplikasi meminta memakai email.

## Tambahan v180 — Baca buku langsung di aplikasi
- Pembaca PDF di dalam aplikasi (book-reader.js + pdf.js Mozilla 6.2.108 legacy di folder pdfjs/, lisensi Apache 2.0, dimuat hanya saat membaca). Buku tidak diunduh: isi PDF diambil ke memori lalu digambar ke kanvas; tanpa tombol unduh/cetak.
- Fitur pembaca: geser kiri/kanan, penggeser halaman (n / total), Daftar Isi (dari PDF), Thumbnail, Kecerahan + mode Terang/Sepia/Gelap, Pengaturan (ukuran 100–200%, ke halaman), cari teks, penanda halaman, lanjut dari halaman terakhir (disimpan di perangkat), tombol Kembali HP menutup pembaca.
- Detail buku baru: sampul + judul + penulis + chip, ringkasan (halaman, PDF, tahun — hanya data nyata), Tentang Buku + Baca Selengkapnya, info Penulis/Penerbit/Kategori/Tahun, simpan & bagikan. Tombol: Baca Buku (digital yang boleh dibaca), Buka dengan Membership (Premium belum aktif), Beli Buku (fisik, checkout di website).
- Editor: Jenis buku Digital/Fisik; "Cara pembacaan / pemesanan": Digital = Baca langsung di aplikasi (tanpa checkout, tanpa WhatsApp/link, PDF wajib); Fisik = Full checkout di website (link). WhatsApp hanya untuk buku fisik lama. Kolom penerbit, kategori, tahun, jumlah halaman.
- buku_baca.sql: order_type 'read', kolom info buku, aturan digital=baca/fisik=checkout; buku digital lama dipindah ke 'read' (WA/link dikosongkan).
- Layar paket: judul "Membership Premium", tombol "Lanjutkan ke Checkout".

## v181
- Pembaca PDF: pesan galat kini menyebut tahap gagal (pustaka / berkas / baca-pdf / tampil) agar penyebab mudah dilacak.

## v182
- Pembaca: bila pustaka pdf.js gagal dimuat, pesan menyebut sebabnya (berkas hilang / jenis salah / browser tidak cocok).

## v183
- Detail buku: jarak antar paragraf deskripsi dirapatkan (paragraf kosong dibuang, maksimal satu baris kosong).

## v184
- Checkout membership: label "Masjid Tujuan Donasi" + penjelasan donasi; QRIS/daftar rekening tampil langsung setelah memilih metode; Lanjutkan Pembayaran langsung ke halaman terima kasih + unggah bukti (cara pembayaran tetap bisa dibuka lagi).

## v185
- Deskripsi buku: jarak antar paragraf distandarkan (0,85 rem).

## v186
- Layar paket: poin ke-4 manfaat membership diganti "Setiap bulan ada 1-2 buku baru yang akan terbit dan GRATIS".

## v187
- Editor deskripsi buku: isi yang dibuka untuk diedit tidak lagi dirapatkan (jarak paragraf sama seperti saat disimpan); perapihan jarak hanya untuk tampilan baca.

## v188
- Membership: layar Pembayaran selalu memuat status pesanan terbaru; bila Batalkan pesanan gagal karena status sudah berubah di server, ditampilkan status terbaru (bukan galat buntu).

## v189
- Membership: "Pesanan saya" dan riwayat bukti hanya memuat milik akun yang sedang masuk (Super Admin tidak lagi melihat pesanan jamaah lain sebagai pesanannya sendiri).

## v190
- Tombol "Kembali" di pojok atas halaman fitur: dari dalam halaman detail/layar bertingkat naik SATU tingkat (seperti tombol Kembali bawaan HP), tidak lagi loncat ke Beranda.

## v191
- Pustaka Buku: banner animasi Membership Premium di atas kolom cari (WebP 407 KB + GIF cadangan 528 KB; responsif 320-1280 px). Anggota aktif melihat kartu status membership di posisi yang sama.

## v192
- Editor Tampilan Beranda (Super Admin): tombol "+ Banner gambar" (1 gambar, tanpa geser otomatis, bisa diberi tautan ke fitur). Gambar banner dikompres otomatis maksimal 100 KB.

## v193
- + Banner gambar: editor benar-benar satu gambar (tanpa Tambah slide, tanpa kecepatan geser, tanpa label Slide 1).

## v194
- Banner beranda (Banner gambar & Banner slide) mendukung GIF animasi: diunggah apa adanya, maksimal 600 KB. JPEG/PNG/WebP tetap dikompres maksimal 100 KB. SQL baru: banner_gif.sql (izinkan image/gif di bucket branding).

## v195
- Banner satu gambar (termasuk GIF) kini tampil utuh sesuai rasio aslinya, tidak terpotong, responsif di semua lebar layar. Banner slide (lebih dari 1 gambar) tetap 16:9.

## v196
- Banner satu gambar: bingkai putih dihilangkan (sudut membulat + bayangan lembut). Banner utama/slide tetap berbingkai.

## v197
- Banner satu gambar/GIF transparan menempel langsung di latar beranda (tanpa kartu, bayangan, potongan sudut). Pratinjau di editor menampilkan gambar utuh di atas pola kotak-kotak.
