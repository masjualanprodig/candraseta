# BAITUNA Design System v1.2 (ringkas)

Sumber kebenaran: `tokens.css` (warna, huruf, jarak, radius, bayangan) dan `ui-kit.css` (komponen dasar). Jangan membuat warna baru di file lain; tambahkan token di `tokens.css`.

## Token utama
| Fungsi | Token | Nilai |
|---|---|---|
| Aksi utama, navigasi aktif | `--emerald` | #086653 |
| Hero / gradien | `--green-deep`, `--green-dark` | #064B3D, #073F34 |
| Aksen (bukan teks kecil) | `--gold`, `--gold-soft`, `--gold-pale` | #D5A84B, #E8C879, #F7EAC7 |
| Latar halaman / kartu | `--bg`, `--surface` | #FAF8F1, #FFFFFF |
| Permukaan lembut | `--surface-green`, `--surface-gold` | #E8F2EE, #FBF3DF |
| Garis | `--border` | #E1E7E3 |
| Teks | `--text`, `--text-2`, `--text-muted` | #163D35, #687C76, #84928D |
| Status | `--success`, `--warning`, `--error`, `--info` | #247A54, #A96F17, #B42318, #2865A6 |
Nama lama (`--teal`, `--teal-d`, `--ivory`, `--sage`, `--line`, `--danger`) tetap ada sebagai alias supaya halaman lama ikut berubah warna tanpa ditulis ulang.

## Tipografi
`--font` = Plus Jakarta Sans, cadangan Segoe UI / system-ui. Arab: `--font-arabic` (Noto Sans Arabic, cadangan Amiri/Scheherazade yang sudah ada). Skala: display 30-36, judul halaman 24, seksi 18-22, kartu 15-18, isi 14-16, keterangan 12-13.
Untuk memakai Plus Jakarta Sans: unduh `PlusJakartaSans.woff2` (variabel, bobot 200-800) dari Google Fonts, taruh di folder utama bersama index.html. Tanpa berkas itu, aplikasi memakai font cadangan.

## Komponen dan kelas
| Komponen (master prompt) | Kelas / elemen |
|---|---|
| PrimaryButton | `.btn-primary` (lebar penuh), `.btn-sm` |
| SecondaryButton | `.btn-sm.ghost`, `.btn-gold` |
| Tombol bahaya | `.btn-sm.alt` |
| TextInput / SelectInput | `.in`, `.field` (+ `.auth .field` untuk kaca) |
| FilterChip | `.achip`, `.seg` + `.segb` |
| Badge / chip | `.chip`, `.badge` |
| Card | `.panel` |
| EmptyState | `.empty` |
| Pesan / Toast | `.msg`, `.err`, `#toast` |
| ConfirmationDialog | `ask()` di `ui.js` |
Tahap berikutnya menambah: GreetingHeader, PrayerTimesCard, QuickAccessGrid, ArticleCard, BottomNavigation, dll.

## Latar masjid (hanya splash, masuk, daftar, atur ulang password)
`.hero-bg` + `.hero-art` + `.hero-shade`. Bila berkas `bg-masjid.jpg` ada di folder utama, otomatis dipakai menggantikan ilustrasi (kelas `has-photo` pada `<html>`). Foto: sebaiknya potret 9:16, lebar 1080 px, maksimal sekitar 250 KB, area atas terang untuk logo.
