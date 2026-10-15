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

## Tanya Jawab
Untuk bertanya Anda harus masuk. Judul, rincian, kategori, dan nama depan (bila Anda memilih menampilkannya) disimpan di server BAITUNA; identitas akun penanya tidak ditampilkan ke publik. Menandai "Bermanfaat" dan penghitung dibaca memakai penanda acak di perangkat Anda (bukan identitas) agar satu perangkat dihitung sekali. Pertanyaan baru tampil ke publik hanya setelah dijawab penjawab resmi. Mohon tidak menuliskan data pribadi yang sensitif.

## Pustaka Buku
Pustaka Buku menampilkan buku yang dijual pengelola. BAITUNA tidak memproses pembayaran dan tidak menyimpan data pembeli: tombol Pesan membuka WhatsApp penjual atau link checkout milik penjual, yang berlaku kebijakan privasi mereka sendiri. Nomor WhatsApp atau link yang diisi pengelola tidak ditampilkan sebagai teks, tetapi terbuka saat tombol Pesan ditekan. Tampilan Grid atau List yang Anda pilih disimpan di perangkat.

## Kas Masjid
Pengurus masjid dapat mencatat pemasukan dan pengeluaran kas di BAITUNA. Aplikasi hanya mencatat, tidak memegang atau memindahkan uang. Catatan berisi akun kas, kategori, jumlah, tanggal, keterangan, dan (bila diisi) nama pihak terkait serta foto bukti. Catatan hanya dapat dilihat Bendahara, Ketua Takmir, Admin Masjid masjid itu, dan admin pusat. Catatan tidak dapat dihapus; kesalahan dikoreksi dengan catatan pembatalan, dan setiap perubahan penting terekam di jejak audit. Foto bukti disimpan privat. Ringkasan total bulanan baru tampil kepada jamaah jika pengurus mengaktifkannya; rincian dan nama pihak tidak ikut ditampilkan.

## Akun dan Pendaftaran Jamaah
Untuk membuat akun Anda mengisi nama lengkap, email, dan password (password disimpan terenkripsi oleh layanan autentikasi, bukan terbaca oleh pengelola). Untuk bertanya di Tanya Jawab Anda cukup masuk dengan akun. Data pendaftaran keanggotaan jamaah dari versi sebelumnya (bila ada) hanya dapat dilihat oleh admin pusat dan terhapus saat akun dihapus.

## Jejak Audit
Perubahan penting (mis. kas, pengurus, undangan, status masjid, keputusan pendaftaran, buku) dicatat otomatis berisi jenis kejadian, waktu, pelaku, dan ringkasan. Catatan tidak dapat diubah atau dihapus. Admin pusat melihat semuanya; Admin Masjid hanya melihat catatan masjidnya.

## Layanan pihak ketiga
Teks Al-Qur’an dan audio dimuat dari layanan pihak ketiga. Email kritik dan saran diteruskan lewat penyedia layanan email (Resend). Peta menggunakan data OpenStreetMap. Layanan tersebut dapat menerima alamat IP perangkat Anda sesuai kebijakan masing-masing.

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
