// Cache HANYA aset statis. Data pengguna/Supabase tidak pernah disimpan di sini.
const CACHE = 'baituna-static-v1';
const ASSETS = ['/', '/index.html', '/manifest.json', '/css/style.css', '/css/components.css', '/css/responsive.css',
  '/js/app.js', '/js/config.js', '/js/supabase.js', '/js/auth.js', '/js/router.js', '/js/permissions.js',
  '/assets/logo/logo.png', '/assets/images/masjid.svg', '/assets/icons/icon-192.png', '/assets/icons/icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // jangan sentuh API/Supabase
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then(r => r || caches.match('/index.html'))));
});
