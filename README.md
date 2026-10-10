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
| dashboard-admin.js / dashboard-member.js | Dashboard |
| app.js | Titik masuk |
| service-worker.js, manifest.json, icon-*.png, logo.png, masjid.svg | PWA & aset |

SQL (schema, policies, seed) ada di folder `sql/` pada repo (tidak dipakai browser).

Aturan: jangan pernah menaruh service_role / secret key di file mana pun.
