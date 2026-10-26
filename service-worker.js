// BAITUNA - service-worker.js
// Cache aset statis agar aplikasi cepat dan bisa dibuka offline (hanya tampilan dasar).
// Data Supabase TIDAK pernah disimpan di cache.
const CACHE = 'baituna-static-v182';
const ASSETS = [
  './', 'index.html', 'style.css', 'ai.css', 'ai-ui.js', 'ai-service.js', 'taaruf.css', 'taaruf-ui.js', 'taaruf-service.js', 'components.css', 'responsive.css',
  'config.js', 'supabase.js', 'auth.js', 'router.js', 'permissions.js', 'ui.js',
  'mosque-service.js', 'public-service.js', 'directory.js', 'schedule-ui.js', 'calendar-ui.js', 'photo.js', 'posts-ui.js', 'feed-ui.js', 'world-ui.js', 'history-ui.js', 'history-service.js', 'quran-ui.js', 'mushaf-ui.js', 'nearby-ui.js', 'nearby-service.js', 'leaflet.js', 'leaflet.css', 'jadwal-ui.js', 'cities-id.js', 'profil-ui.js', 'profile-service.js', 'sunnah-ui.js', 'belajar-ui.js', 'asma-ui.js', 'asma-service.js', 'tracker-ui.js', 'tracker-service.js', 'zakat-ui.js', 'zakat-service.js', 'market-ui.js', 'puasa-service.js', 'amalan-service.js', 'gerhana-data.js', 'notif-service.js', 'sunnah-link.js', 'page-ui.js', 'qibla-service.js', 'qibla-ui.js', 'ramadan-service.js', 'ramadan-ui.js', 'adzan-service.js', 'adzan-ui.js', 'push-service.js', 'saran-ui.js', 'qa-ui.js', 'qa-service.js', 'books-ui.js', 'books-service.js', 'membership-ui.js', 'membership-service.js', 'membership-admin-ui.js', 'tokens.css','home.css','pages.css','desktop.css','pasang.html','prayer-icons.js','nav-config.js','home-ui.js','home-builder.js','home-kartu.js','home-builder-ui.js','home-layout-service.js','quick-catalog.js','branding-service.js','branding-ui.js', 'ui-kit.css', 'masjid-hero.svg', 'art-banner.svg', 'art-masjid-list.svg', 'art-buku.svg', 'art-pasar.svg', 'art-taaruf-hero.webp', 'kas-ui.js', 'kas-service.js', 'audit-ui.js', 'pengguna-ui.js', 'pengguna-service.js', 'wilayah-service.js', 'maps-link.js', 'mosque-review-ui.js', 'audit-service.js', 'page-service.js', 'page-defaults.js', 'notif-ui.js', 'market-service.js', 'market-admin-ui.js', 'asma-edit-service.js', 'asma-admin-ui.js', 'asmaul-husna.json', 'asmaul-husna-audio.json', 'belajar-service.js', 'belajar-data.js', 'sunnah-service.js', 'doa-ui.js', 'doa-service.js', 'doa-import.js', 'doa-import-ui.js', 'sunnah-import.js', 'sunnah-import-ui.js', 'dzikir-ui.js', 'dzikir-import.js', 'dzikir-import-ui.js', 'dzikir-service.js', 'dzikir-sound.js', 'articles-ui.js', 'articles-service.js', 'rukun-ui.js', 'rukun-service.js', 'quran-service.js', 'world-service.js', 'post-service.js', 'post-time.js', 'prayer-times.js', 'islamic-calendar.js', 'team-panel.js', 'dashboard-admin.js', 'dashboard-member.js', 'dashboard-mosque.js', 'app.js',
  'AmiriQuran-Regular.ttf', 'ScheherazadeNew-Regular.ttf', 'logo.png', 'masjid.svg', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && !k.startsWith('baituna-quran')).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Jaringan dulu (agar versi terbaru selalu dipakai), cache sebagai cadangan saat offline.
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // Supabase & situs lain tidak disentuh
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html')))
  );
});

// ---- Notifikasi push (dikirim server baituna-push; tampil walau BAITUNA tertutup) ----
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'BAITUNA', body: e.data ? e.data.text() : '' }; }
  if (!d || typeof d !== 'object') d = {};
  const url = typeof d.url === 'string' && d.url.length < 200 ? d.url : './';
  let adz = null, at = 0;
  try { const u = new URL(url, self.registration.scope); if (u.origin === self.location.origin) { adz = u.searchParams.get('adzan'); at = Number(u.searchParams.get('t')); } } catch (x) { /* abaikan */ }
  const opts = { body: String(d.body || '').slice(0, 300), tag: String(d.tag || 'baituna').slice(0, 80), icon: 'icon-192.png', badge: 'icon-192.png', data: { url } };
  if (adz) { opts.vibrate = [300, 150, 300, 150, 300]; opts.renotify = true; opts.requireInteraction = true; }
  e.waitUntil(Promise.all([
    self.registration.showNotification(String(d.title || 'BAITUNA').slice(0, 100), opts),
    // BAITUNA masih terbuka (walau di latar): putar adzan langsung, tanpa menunggu notifikasi diketuk
    adz ? self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => list.forEach(c => c.postMessage({ type: 'baituna-adzan', key: adz, t: at }))) : null
  ]));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  let target; try { target = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope); } catch (x) { target = new URL('./', self.registration.scope); }
  if (target.origin !== self.location.origin) target = new URL('./', self.registration.scope);
  const adz = target.searchParams.get('adzan'), at = Number(target.searchParams.get('t'));
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const c = list.find(x => 'focus' in x);
    if (c) { if (adz) c.postMessage({ type: 'baituna-adzan', key: adz, t: at }); return c.focus(); }
    return self.clients.openWindow(target.href);
  }));
});
