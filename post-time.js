// BAITUNA - post-time.js
// Waktu agenda mengikuti zona waktu MASJID (bukan zona perangkat). Indonesia tidak memakai jam musim panas,
// jadi selisih jamnya tetap: WIB +7, WITA +8, WIT +9.
const OFFSET = { 'Asia/Jakarta': 7, 'Asia/Makassar': 8, 'Asia/Jayapura': 9 };
export const TZ_LABEL = { 'Asia/Jakarta': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' };
const DAY = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const off = tz => OFFSET[tz] || 7;
const p2 = n => String(n).padStart(2, '0');

// "2026-10-12T04:30" (jam dinding di zona masjid) -> ISO UTC. Mengembalikan null bila tidak valid.
export function localToIso(local, tz) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(local || ''));
  if (!m) return null;
  const [y, mo, d, hh, mi] = m.slice(1).map(Number);
  const t = Date.UTC(y, mo - 1, d, hh - off(tz), mi);
  const chk = new Date(t + off(tz) * 3600e3);
  if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== mo - 1 || chk.getUTCDate() !== d || chk.getUTCHours() !== hh) return null;
  return new Date(t).toISOString();
}

// ISO -> "2026-10-12T04:30" (jam dinding di zona masjid), untuk kolom datetime-local.
export function isoToLocal(iso, tz) {
  const t = Date.parse(iso); if (isNaN(t)) return '';
  const d = new Date(t + off(tz) * 3600e3);
  return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()) + 'T' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes());
}

// "Sen, 12 Okt 2026 · 04.30 WIB"
export function fmtWhen(iso, tz) {
  const t = Date.parse(iso); if (isNaN(t)) return '';
  const d = new Date(t + off(tz) * 3600e3);
  return DAY[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear() +
    ' · ' + p2(d.getUTCHours()) + '.' + p2(d.getUTCMinutes()) + ' ' + (TZ_LABEL[tz] || 'WIB');
}

// Rentang: bila selesai di hari yang sama, hanya jamnya yang ditambahkan.
export function fmtRange(startIso, endIso, tz) {
  const a = fmtWhen(startIso, tz); if (!endIso) return a;
  const b = fmtWhen(endIso, tz);
  const sameDay = isoToLocal(startIso, tz).slice(0, 10) === isoToLocal(endIso, tz).slice(0, 10);
  return sameDay ? a.replace(/ (WIB|WITA|WIT)$/, '') + '–' + b.split(' · ')[1] : a + ' → ' + b;
}

// Agenda dianggap "mendatang" sampai selesai (bila tak ada jam selesai: sampai akhir hari mulai).
export function isUpcoming(post, nowMs, tz) {
  const end = post.ends_at ? Date.parse(post.ends_at) : Date.parse(post.starts_at) + 0;
  if (isNaN(end)) return false;
  if (post.ends_at) return end >= nowMs;
  const d = isoToLocal(post.starts_at, tz).slice(0, 10);
  return localToIso(d + 'T23:59', tz) >= new Date(nowMs).toISOString();
}

// Bagian tanggal untuk blok tanggal: {dow:'Kam', d:15, mon:'Okt'} di zona masjid.
export function dateParts(iso, tz) {
  const t = Date.parse(iso); if (isNaN(t)) return null;
  const d = new Date(t + off(tz) * 3600e3);
  return { dow: DAY[d.getUTCDay()], d: d.getUTCDate(), mon: MON[d.getUTCMonth()] };
}

// Selisih hari kalender (zona masjid) antara iso dan sekarang: 0 = hari ini, 1 = besok.
export function dayDiff(iso, tz, nowMs) {
  const a = isoToLocal(iso, tz).slice(0, 10), b = isoToLocal(new Date(nowMs).toISOString(), tz).slice(0, 10);
  return Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400e3);
}

// "19.00–21.00 WIB" (bila beda hari: rentang lengkap)
export function fmtTimes(startIso, endIso, tz) {
  const full = fmtRange(startIso, endIso, tz);
  const i = full.indexOf(' · ');
  return i >= 0 && !full.includes('→') ? full.slice(i + 3) : full;
}
