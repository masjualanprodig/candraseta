// BAITUNA - prayer-times.js
// Perhitungan waktu salat (astronomis, berjalan di perangkat, tanpa internet).
// Acuan: sudut Subuh 20° dan Isya 18° (Kemenag RI), Ashar mazhab Syafi'i (bayangan 1x),
// ihtiyat 2 menit. Hasil bisa berbeda beberapa menit dari jadwal resmi/pengumuman masjid.
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
const sin = d => Math.sin(rad(d)), cos = d => Math.cos(rad(d)), tan = d => Math.tan(rad(d));
const acos = x => deg(Math.acos(x)), atan = x => deg(Math.atan(x));
const fix = (a, b) => a - b * Math.floor(a / b);

export const TZ_OFFSET = { 'Asia/Jakarta': 7, 'Asia/Makassar': 8, 'Asia/Jayapura': 9 };
export const TZ_LABEL = { 'Asia/Jakarta': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' };
export const METHOD = { fajr: 20, isha: 18, asrFactor: 1, ihtiyat: 2 };

function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}
function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);          // anomali rata-rata
  const q = fix(280.459 + 0.98564736 * D, 360);          // bujur rata-rata
  const L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360); // bujur ekliptika
  const e = 23.439 - 0.00000036 * D;                     // kemiringan sumbu bumi
  const ra = fix(deg(Math.atan2(cos(e) * sin(L), cos(L))), 360) / 15; // jam
  const decl = deg(Math.asin(sin(e) * sin(L)));
  let eqt = q / 15 - ra;                                 // persamaan waktu (jam)
  eqt = eqt > 12 ? eqt - 24 : eqt < -12 ? eqt + 24 : eqt;
  return { decl, eqt };
}

// date: {y, m, d} tanggal lokal masjid. Mengembalikan menit sejak 00:00 waktu lokal (bilangan pecahan).
export function computePrayerTimes(date, lat, lng, tz, method = METHOD) {
  const off = TZ_OFFSET[tz] ?? 7;
  const jd = julian(date.y, date.m, date.d) - lng / (15 * 24);
  const { decl, eqt } = sunPosition(jd + 0.5);
  const mid = 12 + off - lng / 15 - eqt;
  const T = a => (1 / 15) * acos((-sin(a) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat)));
  // Ashar: tinggi matahari saat panjang bayangan = f x tinggi benda + bayangan saat tengah hari
  const asrT = f => { const alt = atan(1 / (f + tan(Math.abs(lat - decl)))); return (1 / 15) * acos((sin(alt) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))); };
  const ih = method.ihtiyat / 60;
  const h = {
    fajr: mid - T(method.fajr) + ih,
    sunrise: mid - T(0.833) - ih,
    dhuhr: mid + ih,
    asr: mid + asrT(method.asrFactor) + ih,
    maghrib: mid + T(0.833) + ih,
    isha: mid + T(method.isha) + ih
  };
  const out = {};
  for (const k in h) out[k] = fix(h[k], 24) * 60;
  return out;
}

// Pembulatan ke menit terdekat -> "HH:MM"
export function fmt(mins) {
  let t = Math.round(mins); t = ((t % 1440) + 1440) % 1440;
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}

// Tanggal "hari ini" menurut zona waktu masjid (zona tetap, tanpa DST di Indonesia).
export function todayIn(tz, now = Date.now()) {
  const d = new Date(now + (TZ_OFFSET[tz] ?? 7) * 3600000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}
