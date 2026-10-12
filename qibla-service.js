// BAITUNA - qibla-service.js
// Arah kiblat dihitung di perangkat (rumus lingkaran besar) dari lokasi ke Ka'bah. Fungsi murni, tanpa jaringan.
// Lokasi dibaca dari pengaturan bersama Jadwal Salat dan tidak dikirim ke server.
export const KAABA = { lat: 21.4225, lng: 39.8262 }; // Masjidil Haram, Makkah (perkiraan titik Ka'bah)
const R = Math.PI / 180, EARTH_KM = 6371;
export const norm360 = d => ((d % 360) + 360) % 360;
// Selisih sudut bertanda terpendek dari a ke b, rentang (-180, 180].
export const angleDiff = (a, b) => { const d = norm360(b - a); return d > 180 ? d - 360 : d; };

// Arah awal (derajat searah jarum jam dari utara sebenarnya) dari (lat,lng) menuju Ka'bah.
export function qiblaBearing(lat, lng) {
  if (![lat, lng].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const p1 = lat * R, p2 = KAABA.lat * R, dl = (KAABA.lng - lng) * R;
  const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  if (Math.abs(x) < 1e-12 && Math.abs(y) < 1e-12) return null; // tepat di Ka'bah
  return norm360(Math.atan2(y, x) / R);
}
// Jarak garis lengkung ke Ka'bah (km).
export function qiblaDistanceKm(lat, lng) {
  if (![lat, lng].every(Number.isFinite)) return null;
  const a = Math.sin((KAABA.lat - lat) * R / 2) ** 2 + Math.cos(lat * R) * Math.cos(KAABA.lat * R) * Math.sin((KAABA.lng - lng) * R / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}
const WINDS = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
export const windName = d => WINDS[Math.round(norm360(d) / 45) % 8];

// Arah depan HP (derajat dari utara) dari sudut sensor DeviceOrientation. Mengembalikan null bila data tidak valid.
//  - HP dipegang datar (kebiasaan memakai kompas kiblat): arah ujung atas HP = 360 - alpha.
//  - HP ditegakkan (beta besar): arah yang dituju sisi belakang HP (rumus contoh W3C).
export function headingFrom(alpha, beta, gamma) {
  if (![alpha, beta, gamma].every(Number.isFinite)) return null;
  if (Math.abs(beta) < 50 && Math.abs(gamma) < 50) return norm360(360 - alpha);
  const a = alpha * R, b = beta * R, g = gamma * R;
  const rA = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g);
  const rB = -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(b) * Math.cos(g);
  let hd = Math.atan(rA / rB);
  if (rB < 0) hd += Math.PI; else if (rA < 0) hd += 2 * Math.PI;
  return norm360(hd / R);
}
// Perataan sudut agar jarum tidak bergetar (k = 0..1, makin kecil makin halus).
export const smoothAngle = (prev, next, k = 0.25) => prev == null ? norm360(next) : norm360(prev + angleDiff(prev, next) * k);
export const ALIGN_DEG = 3;
export const isAligned = (heading, bearing, tol = ALIGN_DEG) => heading != null && bearing != null && Math.abs(angleDiff(heading, bearing)) <= tol;
