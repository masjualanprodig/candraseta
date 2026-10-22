# BAITUNA — Perbaikan Doa Shahih dan Import Ayat

## File yang perlu diganti di repository
1. `doa-ui.js`
2. `doa-import-ui.js`
3. `service-worker.js`

## Perubahan
- Teks ayat Al-Qur'an dan terjemahan ditampilkan berdasarkan rujukan surah/ayat saat kartu dibuka.
- Ada status memuat dan tombol coba ulang bila layanan gagal; respons parsial atau teks kosong tidak dianggap berhasil.
- Penambahan ayat secara manual memverifikasi teks Arab dan terjemahan sebelum disimpan.
- Impor Excel memverifikasi rujukan ayat sebelum proses simpan. Baris yang gagal diverifikasi ditandai bermasalah dan tidak disimpan dalam percobaan tersebut.
- Pemuatan ayat pada daftar jamaah dilakukan saat kartu dibuka agar tidak mengirim banyak permintaan untuk kartu yang belum dibaca.
- Cache Service Worker dinaikkan dari `baituna-static-v107` menjadi `baituna-static-v108`.

## Pemeriksaan
- `node --check doa-ui.js` — lulus
- `node --check doa-import-ui.js` — lulus
- `node --check doa-import.js` — lulus
- `node --check doa-service.js` — lulus
- `node --check service-worker.js` — lulus

Pemeriksaan sintaks tidak menggantikan pengujian langsung pada deployment. Setelah mengganti file, uji koneksi ke Supabase dan AlQuran Cloud, lalu pastikan teks ayat tampil di perangkat nyata.
