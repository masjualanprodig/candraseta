// BAITUNA - service-worker.js
// Cache aset statis agar aplikasi cepat dan bisa dibuka offline (hanya tampilan dasar).
// Data Supabase TIDAK pernah disimpan di cache.
const CACHE = 'baituna-static-v22';
const ASSETS = [
  './', 'index.html', 'style.css', 'components.css', 'responsive.css',
  'config.js', 'supabase.js', 'auth.js', 'router.js', 'permissions.js', 'ui.js',
  'mosque-service.js', 'public-service.js', 'directory.js', 'schedule-ui.js', 'calendar-ui.js', 'photo.js', 'posts-ui.js', 'feed-ui.js', 'world-ui.js', 'history-ui.js', 'history-service.js', 'quran-ui.js', 'nearby-ui.js', 'nearby-service.js', 'leaflet.js', 'leaflet.css', 'dzikir-ui.js', 'dzikir-service.js', 'articles-ui.js', 'articles-service.js', 'rukun-ui.js', 'rukun-service.js', 'quran-service.js', 'world-service.js', 'post-service.js', 'post-time.js', 'prayer-times.js', 'islamic-calendar.js', 'team-panel.js', 'dashboard-admin.js', 'dashboard-member.js', 'dashboard-mosque.js', 'app.js',
  'AmiriQuran-Regular.ttf', 'ScheherazadeNew-Regular.ttf', 'logo.png', 'masjid.svg', 'manifest.json', 'icon-192.png', 'icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
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
