// BAITUNA - page-defaults.js
// Teks BAWAAN SEMENTARA halaman Privasi & Disclaimer. Dipakai selama Super Admin belum menyimpan versi sendiri.
// Format: baris "## Judul bagian", baris "- butir daftar", sisanya paragraf (dipisah baris kosong).
// Teks ini rancangan awal, bukan nasihat hukum; sebaiknya ditinjau pengelola dan penasihat hukum sebelum rilis.
export const DEFAULT_PAGES = {
  privasi: {
    title: 'Privasi & Disclaimer',
    body: `Teks ini masih sementara dan akan disempurnakan oleh pengelola BAITUNA. Mohon dibaca bersama keterangan di setiap fitur.

## Data yang disimpan di perangkat Anda
Hal-hal berikut hanya disimpan di HP atau peramban Anda, tidak dikirim ke server BAITUNA:
- lokasi untuk jadwal salat dan masjid terdekat
- favorit doa, hitungan dzikir, centang amalan harian, dan catatan Tracker Ibadah Harian
- pengaturan notifikasi, pilihan adzan dan audio adzan yang Anda simpan, pengingat pribadi, dan pengaturan tampilan Al-Qur’an
Anda dapat menghapusnya kapan saja lewat Profil, Pengaturan, "Hapus data di perangkat ini".

## Data yang disimpan di server
- Data akun pengurus: email, nama, nomor telepon (bila diisi), foto profil (bila diunggah), dan peran. Hanya pemilik akun dan admin yang berwenang yang dapat mengubahnya.
- Konten yang dibuat pengurus: profil masjid, agenda, pengumuman, dan foto.
- Pasar Umat: data penjual, produk, foto produk, alamat, dan kontak yang dicantumkan penjual agar dapat dilihat pengguna lain.
BAITUNA tidak menjual data pribadi dan tidak menampilkan iklan.

## Lokasi
Lokasi dipakai di perangkat Anda untuk menghitung jadwal salat dan jarak ke masjid terdekat. Lokasi tidak dikirim atau disimpan di server, kecuali Anda sendiri mengaktifkan notifikasi push (lihat bagian berikutnya).

## Notifikasi push (opsional, mati bawaan)
Bila Anda mengaktifkan push agar notifikasi tampil walau BAITUNA tertutup, server BAITUNA menyimpan data berikut agar dapat mengirim tepat waktu:
- alamat notifikasi HP/peramban Anda (diberikan oleh peramban, bukan nomor telepon)
- lokasi yang dibulatkan sekitar 1 km dan zona waktu, untuk menghitung waktu salat
- pilihan Anda: salat dan adzan yang diingatkan, menit sebelum waktu, serta sahur dan berbuka
Tanpa nama, email, atau akun. Data ini dihapus saat push dimatikan atau saat Anda memilih "Hapus data di perangkat ini", dan otomatis saat peramban menyatakan alamat itu tidak berlaku lagi. Pesan dikirim lewat layanan push milik peramban/HP Anda (mis. Google, Mozilla, Apple), yang dapat menerima alamat IP perangkat.

## Kritik & saran
Bila Anda mengirim kritik dan saran lewat formulir, nama, email, dan isi pesan Anda disimpan di server BAITUNA dan diteruskan ke email pengelola agar dapat dibalas. Alamat IP tidak disimpan utuh; hanya sidik satu arah yang dipakai untuk membatasi spam. Mohon tidak menuliskan kata sandi, nomor kartu, atau data sensitif lain. Pesan dapat dihapus pengelola atas permintaan Anda.

## Forum Tanya Jawab
Forum Tanya Jawab khusus untuk akun dengan membership aktif, jadi Anda harus masuk. Pertanyaan dan jawaban disimpan di server BAITUNA sebagai riwayat percakapan akun Anda, dan hanya dapat dibuka dari akun Anda di aplikasi. Anda dapat menghapus percakapan kapan saja.
Teks pertanyaan Anda, beserta beberapa pesan sebelumnya dalam percakapan yang sama, dikirim ke layanan pemrosesan pihak ketiga (Google) untuk menyusun jawaban. Nama, email, dan nomor telepon akun Anda tidak ikut dikirim. Penyedia tersebut dapat memproses teks sesuai kebijakan mereka sendiri, sehingga mohon tidak menuliskan data pribadi atau rahasia dalam pertanyaan.
Jawaban disusun oleh asisten digital dan bukan fatwa. Ayat Al-Qur’an yang dikutip diperiksa ke teks Al-Qur’an, tetapi isi jawaban tetap dapat keliru. Untuk perkara penting, tanyakan langsung kepada ustaz atau ulama yang Anda percaya. Laporan yang Anda kirim tentang suatu jawaban dapat dibaca pengelola untuk perbaikan.

## Pustaka Buku dan Membership
Pustaka Buku menampilkan buku yang dijual pengelola. Untuk pembelian buku, BAITUNA tidak memproses pembayaran dan tidak menyimpan data pembeli: tombol Pesan membuka WhatsApp penjual atau link checkout milik penjual, yang berlaku kebijakan privasi mereka sendiri. Tampilan Grid atau List yang Anda pilih disimpan di perangkat.
Untuk Membership BAITUNA, pembayaran dilakukan manual lewat transfer atau QRIS dan diperiksa oleh pengelola. Data pesanan yang disimpan: nama lengkap, nomor telepon, paket, nominal, masjid (bila dipilih), status, dan foto bukti pembayaran. Bukti pembayaran disimpan di tempat penyimpanan privat yang hanya dapat dibuka oleh pemilik pesanan dan pengelola.

## BAITUNA Ta’aruf
BAITUNA Ta’aruf membantu jamaah berusia 19 tahun ke atas saling mengenal calon pasangan secara terarah. Untuk memakainya Anda harus masuk dengan akun BAITUNA. Fitur ini tidak memakai foto, tidak meminta unggah dokumen identitas, dan tidak mengirim data CV ke layanan kecerdasan buatan.

Data yang disimpan di server BAITUNA:
- CV Ta’aruf: nama tampilan, jenis kelamin, tanggal lahir, provinsi dan kota, pendidikan, pekerjaan, status pernikahan, tanggungan, kesiapan menikah, rencana tempat tinggal, harapan tentang anak, isian "Tentang saya", harapan keluarga, visi hidup, nilai dan gaya hidup, serta informasi tambahan (bila diisi)
- preferensi calon (rentang usia, wilayah, dan filter lain)
- daftar profil calon yang pernah Anda buka, untuk menghitung kuota profil gratis
- permintaan perkenalan, statusnya, dan keputusan Anda
- topik yang ditandai, jadwal yang diusulkan, kontak yang Anda bagikan, dan catatan pribadi
- daftar blokir dan laporan yang Anda kirim
- status Ta’aruf Premium dan transaksinya (nama, nomor WhatsApp, email bila diisi, masjid rujukan, dan bukti bayar, sama seperti Membership)

Yang dapat dilihat calon:
- Calon lawan jenis yang sesuai kriteria dapat melihat nama tampilan, usia (bukan tanggal lahir), kota dan provinsi, pendidikan, pekerjaan, status pernikahan, kesiapan menikah, serta isian tentang diri, keluarga, visi, dan nilai hidup Anda.
- Informasi tambahan hanya terlihat oleh calon yang berlangganan Ta’aruf Premium.
- Nama lengkap akun, email, nomor HP, alamat, dan tanggal lahir tidak ditampilkan kepada calon.
- Kontak hanya terlihat bila Anda sendiri membagikannya, hanya oleh calon dalam proses yang sedang berjalan, dan disembunyikan kembali saat proses diakhiri. Disarankan membagikan nomor wali atau keluarga.
- Topik yang ditandai dan jadwal yang diusulkan terlihat oleh kedua pihak. Catatan pribadi hanya untuk Anda: tidak ditampilkan kepada calon dan tidak ada di panel pengelola.
- Bila Anda menolak, calon hanya melihat bahwa perkenalan belum dapat dilanjutkan, tanpa alasan. Menyembunyikan profil dari rekomendasi tidak diberitahukan kepada calon. Pelapor tidak diberitahukan kepada pihak yang dilaporkan.

Pengelola (Super Admin) dapat melihat CV dan email akun untuk menangani laporan dan mencatat pemeriksaan identitas. Pemeriksaan identitas dilakukan langsung oleh pengurus; dokumen tidak disimpan di aplikasi. Setiap tindakan pengelola (menonaktifkan profil, menandai identitas, menindaklanjuti laporan, mengubah harga) tercatat di log.

Anda dapat mengubah CV, menjeda profil agar tidak tampil di rekomendasi, atau menghapus CV kapan saja di menu CV Ta’aruf Saya. Saat CV dihapus, CV, preferensi, dan catatan pribadi Anda langsung dihapus, proses yang berjalan diakhiri, dan kontak yang dibagikan disembunyikan. Riwayat status perkenalan, riwayat kuota, laporan, log pengelola, dan catatan transaksi tetap disimpan untuk keselamatan pengguna dan pencatatan pembayaran. Laporan dari pengguna lain tentang Anda tetap disimpan walaupun CV dihapus.

Label verifikasi memiliki batas: email dikonfirmasi saat mendaftar, usia dinyatakan sendiri, dan "Identitas diperiksa pengurus" hanya berarti pengurus pernah mencocokkan identitas secara langsung. BAITUNA tidak menjamin kebenaran seluruh isi CV, kecocokan, atau keberhasilan perkenalan, dan tidak dapat mencegah orang lain mencatat atau memotret layar. Jangan pernah mengirim uang atau data pribadi kepada calon. Libatkan wali atau keluarga, lalu laporkan dan blokir bila ada yang mencurigakan.

## Kas Masjid
Pengurus masjid dapat mencatat pemasukan dan pengeluaran kas di BAITUNA. Aplikasi hanya mencatat, tidak memegang atau memindahkan uang. Catatan berisi akun kas, kategori, jumlah, tanggal, keterangan, dan (bila diisi) nama pihak terkait serta foto bukti. Catatan hanya dapat dilihat Bendahara, Ketua Takmir, Admin Masjid masjid itu, dan admin pusat. Catatan tidak dapat dihapus; kesalahan dikoreksi dengan catatan pembatalan, dan setiap perubahan penting terekam di jejak audit. Foto bukti disimpan privat. Ringkasan total bulanan baru tampil kepada jamaah jika pengurus mengaktifkannya; rincian dan nama pihak tidak ikut ditampilkan.

## Akun dan Pendaftaran Jamaah
Untuk membuat akun Anda mengisi nama lengkap, nomor HP/WhatsApp, email, dan password. Nomor HP dipakai sebagai cara masuk alternatif dan tidak ditampilkan kepada pengguna lain (password disimpan terenkripsi oleh layanan autentikasi, bukan terbaca oleh pengelola). Untuk bertanya di Tanya Jawab Anda cukup masuk dengan akun. Data pendaftaran keanggotaan jamaah dari versi sebelumnya (bila ada) hanya dapat dilihat oleh admin pusat dan terhapus saat akun dihapus.

## Jejak Audit
Perubahan penting (mis. kas, pengurus, undangan, status masjid, keputusan pendaftaran, buku) dicatat otomatis berisi jenis kejadian, waktu, pelaku, dan ringkasan. Catatan tidak dapat diubah atau dihapus. Admin pusat melihat semuanya; Admin Masjid hanya melihat catatan masjidnya.

## Layanan pihak ketiga
Teks Al-Qur’an dan audio dimuat dari layanan pihak ketiga. Pertanyaan di Forum Tanya Jawab diproses oleh layanan Google, seperti dijelaskan di bagian Forum Tanya Jawab. Email kritik dan saran diteruskan lewat penyedia layanan email (Resend). Peta menggunakan data OpenStreetMap. Layanan tersebut dapat menerima alamat IP perangkat Anda sesuai kebijakan masing-masing.

## Disclaimer keagamaan
- BAITUNA bukan lembaga fatwa. Isi aplikasi tidak menggantikan bimbingan ustaz atau ulama yang Anda percayai.
- Konten doa, dzikir, dan amalan sunnah diisi pengelola dengan menyebut sumber dan derajatnya. Tanyakan kepada ustaz untuk tata cara, waktu, dan keutamaannya.
- Waktu salat dihitung di perangkat dan dapat berbeda beberapa menit dari jadwal resmi. Ikuti jadwal masjid setempat.
- Tanggal Hijriah dan tanggal puasa adalah perkiraan dari kalender Umm al-Qura. Penetapan resmi di Indonesia mengikuti pemerintah (Kemenag).
- Tanpa push, pengingat dan notifikasi hanya berbunyi saat BAITUNA terbuka. Dengan push pun, pengiriman bisa terlambat atau gagal (mode hemat baterai, jaringan, pengaturan HP), dan suara adzan penuh hanya terputar saat BAITUNA terbuka. Jangan mengandalkannya sebagai satu-satunya alarm ibadah.

## Pasar Umat
BAITUNA hanya mempertemukan penjual dan pembeli. Transaksi, pembayaran, pengiriman, dan klaim halal menjadi tanggung jawab penjual dan pembeli. BAITUNA tidak memproses pembayaran dan tidak menjamin kualitas produk. Laporkan produk yang tidak pantas kepada pengelola.

## Batas tanggung jawab
Aplikasi disediakan apa adanya untuk kemaslahatan umat. Pengelola berupaya menjaga ketepatan isi, tetapi tidak bertanggung jawab atas kerugian akibat kesalahan isi, gangguan layanan, atau penggunaan di luar tujuannya.

## Perubahan dan kontak
Halaman ini dapat diperbarui sewaktu-waktu. Pertanyaan tentang privasi dapat disampaikan kepada pengelola BAITUNA; kontak resmi akan dicantumkan oleh Super Admin di halaman ini.`
  }
};
