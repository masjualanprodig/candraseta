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
// Zona waktu boleh berupa nama (Asia/Jakarta, dst.) atau selisih jam dari UTC berupa angka (mis. 7, 8, 9, 5.5).
export const offsetOf = tz => typeof tz === 'number' && isFinite(tz) ? tz : (TZ_OFFSET[tz] ?? 7);

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
  const off = offsetOf(tz);
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
  const d = new Date(now + offsetOf(tz) * 3600000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

/* ===== Salat berikutnya & hitung mundur (v30) ===== */
export const PRAYERS = [['fajr', 'Subuh'], ['dhuhr', 'Dzuhur'], ['asr', 'Ashar'], ['maghrib', 'Maghrib'], ['isha', 'Isya']];

// Semua nilai terhitung berhingga? (di lintang sangat tinggi matahari bisa tak mencapai sudut Subuh/Isya)
export const isValidTimes = t => !!t && Object.values(t).every(v => Number.isFinite(v));

// Waktu tiap salat sebagai penanda waktu mutlak (ms sejak epoch), dibulatkan ke menit agar sama dengan yang ditampilkan.
export function prayerMoments(date, lat, lng, tz, method = METHOD) {
  const off = offsetOf(tz), t = computePrayerTimes(date, lat, lng, tz, method);
  const base = Date.UTC(date.y, date.m - 1, date.d) - off * 3600000;
  const out = {};
  for (const k in t) out[k] = Number.isFinite(t[k]) ? base + Math.round(t[k]) * 60000 : NaN;
  return out;
}
const nextDay = d => { const x = new Date(Date.UTC(d.y, d.m - 1, d.d + 1)); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() }; };

// Salat berikutnya (Subuh, Dzuhur, Ashar, Maghrib, Isya; Terbit bukan waktu salat).
// Setelah Isya: Subuh esok hari. `current` = salat yang waktunya sedang berlangsung, atau null (sebelum Subuh, dan antara Terbit–Dzuhur).
export function nextPrayer(now, lat, lng, tz, method = METHOD) {
  const day = todayIn(tz, now), m = prayerMoments(day, lat, lng, tz, method);
  if (!PRAYERS.every(([k]) => Number.isFinite(m[k]))) return null;
  let next = null, current = null;
  for (const [k] of PRAYERS) { if (m[k] > now) { next = { key: k, at: m[k], tomorrow: false }; break; } current = k; }
  // Waktu Subuh berakhir saat Terbit; setelah itu sampai Dzuhur tidak ada salat yang sedang berlangsung.
  if (current === 'fajr' && Number.isFinite(m.sunrise) && now >= m.sunrise) current = null;
  if (!next) {
    const m2 = prayerMoments(nextDay(day), lat, lng, tz, method);
    if (!Number.isFinite(m2.fajr)) return null;
    next = { key: 'fajr', at: m2.fajr, tomorrow: true };
  }
  return { ...next, current, day, moments: m };
}

// "1 j 12 m", "12 m", "kurang dari 1 menit"
export function fmtCountdown(ms) {
  const mins = Math.ceil(Math.max(0, ms) / 60000);
  if (mins < 1) return 'kurang dari 1 menit';
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? h + ' j' + (m ? ' ' + m + ' m' : '') : m + ' m';
}

// Label zona dari selisih jam: 7 -> WIB, 8 -> WITA, 9 -> WIT, selainnya "UTC+x".
export function zoneLabel(off) {
  if (off === 7) return 'WIB'; if (off === 8) return 'WITA'; if (off === 9) return 'WIT';
  const sign = off < 0 ? '-' : '+', a = Math.abs(off), h = Math.floor(a), mm = Math.round((a - h) * 60);
  return 'UTC' + sign + h + (mm ? ':' + String(mm).padStart(2, '0') : '');
}
// Perkiraan kasar: apakah koordinat berada di wilayah Indonesia?
export const inIndonesia = (lat, lng) => lat >= -11.5 && lat <= 6.5 && lng >= 94.5 && lng <= 141.5;
