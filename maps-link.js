// BAITUNA - maps-link.js
// Membaca tautan lokasi dari Google Maps (hasil "Bagikan" -> "Salin link").
// Hanya tautan Google Maps yang diterima. Koordinat dibaca dari tautan panjang bila ada; tautan pendek
// (maps.app.goo.gl) diterima apa adanya, tetapi koordinatnya tidak bisa dibaca tanpa server, jadi hanya disimpan sebagai tautan.
export const MAPS_RE = /^https:\/\/((www\.)?google\.(com|co\.id|[a-z]{2})\/maps|maps\.google\.(com|co\.id|[a-z]{2})\/|maps\.app\.goo\.gl\/|goo\.gl\/maps)/i;
const SHORT_RE = /^https:\/\/(maps\.app\.goo\.gl\/|goo\.gl\/maps)/i;

const okLat = n => Number.isFinite(n) && n >= -90 && n <= 90;
const okLng = n => Number.isFinite(n) && n >= -180 && n <= 180;
function pair(a, b) { const lat = Number(a), lng = Number(b); return okLat(lat) && okLng(lng) ? { lat, lng } : null; }

export const MAPS_HELP = 'Buka Google Maps, cari masjid Anda, tekan Bagikan, Salin link, lalu tempel di sini.';
// Kalimat status di bawah kolom tautan.
export function mapsText(p) {
  if (p.empty) return MAPS_HELP;
  if (!p.ok) return 'Tautan ini bukan tautan Google Maps.';
  if (p.lat != null) return 'Tautan diterima. Koordinat terbaca: ' + p.lat + ', ' + p.lng + '.';
  return 'Tautan diterima. Koordinat tidak terbaca dari tautan ini, tetapi tombol "Buka di Google Maps" tetap memakai tautan Anda.';
}

// Hasil: { ok:false } | { ok:true, url, short:boolean, lat, lng } (lat/lng null bila tidak terbaca)
export function parseMapsUrl(input) {
  const url = String(input || '').trim();
  if (!url) return { ok: false, empty: true };
  if (url.length > 500 || !MAPS_RE.test(url)) return { ok: false };
  if (SHORT_RE.test(url)) return { ok: true, url, short: true, lat: null, lng: null };
  let dec = url; try { dec = decodeURIComponent(url); } catch (e) { /* biarkan apa adanya */ }
  const num = '(-?\\d{1,3}(?:\\.\\d+)?)';
  // 1) titik penanda (pin) !3d<lintang>!4d<bujur>: paling tepat. 2) pusat peta @lintang,bujur. 3) q= / ll= / query=
  const pats = [new RegExp('!3d' + num + '!4d' + num), new RegExp('@' + num + ',' + num), new RegExp('[?&](?:q|ll|query|destination)=' + num + ',\\s*' + num)];
  for (const re of pats) { const m = dec.match(re); if (m) { const p = pair(m[1], m[2]); if (p) return { ok: true, url, short: false, ...p }; } }
  return { ok: true, url, short: false, lat: null, lng: null };
}

// Peta Google Maps tersemat (iframe) untuk koordinat masjid. Tanpa kunci API: memakai tautan sematan publik Google Maps.
// Hanya angka koordinat yang masuk ke alamat iframe. Bila koordinat belum ada (mis. tautan pendek), hasilnya null.
export function mapEmbed(m) {
  if (!m || m.latitude == null || m.longitude == null) return null;
  const lat = Number(m.latitude), lng = Number(m.longitude);
  if (!okLat(lat) || !okLng(lng)) return null;
  const f = document.createElement('iframe');
  f.className = 'map-embed'; f.id = 'map-embed';
  f.src = 'https://www.google.com/maps?q=' + lat + ',' + lng + '&z=16&output=embed';
  f.title = 'Peta lokasi ' + (m.name || 'masjid');
  f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade';
  f.setAttribute('allowfullscreen', '');
  f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  return f;
}
