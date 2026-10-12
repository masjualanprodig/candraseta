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
- pengaturan notifikasi, pengingat pribadi, dan pengaturan tampilan Al-Qur’an
Anda dapat menghapusnya kapan saja lewat Profil, Pengaturan, "Hapus data di perangkat ini".

## Data yang disimpan di server
- Data akun pengurus: email, nama, nomor telepon (bila diisi), foto profil (bila diunggah), dan peran. Hanya pemilik akun dan admin yang berwenang yang dapat mengubahnya.
- Konten yang dibuat pengurus: profil masjid, agenda, pengumuman, dan foto.
- Pasar Umat: data penjual, produk, foto produk, alamat, dan kontak yang dicantumkan penjual agar dapat dilihat pengguna lain.
BAITUNA tidak menjual data pribadi dan tidak menampilkan iklan.

## Lokasi
Lokasi dipakai di perangkat Anda untuk menghitung jadwal salat dan jarak ke masjid terdekat. Lokasi tidak dikirim atau disimpan di server.

## Layanan pihak ketiga
Teks Al-Qur’an dan audio dimuat dari layanan pihak ketiga. Peta menggunakan data OpenStreetMap. Layanan tersebut dapat menerima alamat IP perangkat Anda sesuai kebijakan masing-masing.

## Disclaimer keagamaan
- BAITUNA bukan lembaga fatwa. Isi aplikasi tidak menggantikan bimbingan ustaz atau ulama yang Anda percayai.
- Konten doa, dzikir, dan amalan sunnah diisi pengelola dengan menyebut sumber dan derajatnya. Tanyakan kepada ustaz untuk tata cara, waktu, dan keutamaannya.
- Waktu salat dihitung di perangkat dan dapat berbeda beberapa menit dari jadwal resmi. Ikuti jadwal masjid setempat.
- Tanggal Hijriah dan tanggal puasa adalah perkiraan dari kalender Umm al-Qura. Penetapan resmi di Indonesia mengikuti pemerintah (Kemenag).
- Pengingat dan notifikasi hanya berbunyi saat BAITUNA terbuka. Jangan mengandalkannya sebagai satu-satunya alarm ibadah.

## Pasar Umat
BAITUNA hanya mempertemukan penjual dan pembeli. Transaksi, pembayaran, pengiriman, dan klaim halal menjadi tanggung jawab penjual dan pembeli. BAITUNA tidak memproses pembayaran dan tidak menjamin kualitas produk. Laporkan produk yang tidak pantas kepada pengelola.

## Batas tanggung jawab
Aplikasi disediakan apa adanya untuk kemaslahatan umat. Pengelola berupaya menjaga ketepatan isi, tetapi tidak bertanggung jawab atas kerugian akibat kesalahan isi, gangguan layanan, atau penggunaan di luar tujuannya.

## Perubahan dan kontak
Halaman ini dapat diperbarui sewaktu-waktu. Pertanyaan tentang privasi dapat disampaikan kepada pengelola BAITUNA; kontak resmi akan dicantumkan oleh Super Admin di halaman ini.`
  }
};
