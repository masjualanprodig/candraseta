// BAITUNA - islamic-calendar.js
// Kalender Hijriah PERKIRAAN memakai kalender Umm al-Qura bawaan peramban (Intl).
// Penetapan resmi di Indonesia (awal Ramadan, Idulfitri, Iduladha) mengikuti sidang isbat
// Kemenag dan bisa berbeda 1-2 hari. Karena itu semua tanggal diberi status "perlu konfirmasi".
export const HIJRI_MONTH = ['Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir', 'Jumadil Awal', 'Jumadil Akhir',
  'Rajab', 'Syaban', 'Ramadan', 'Syawal', 'Zulkaidah', 'Zulhijah'];
export const MASEHI_MONTH = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const DAY_NAME = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// Hari besar yang dihitung otomatis dari tanggal Hijriah (bulan, hari).
export const EVENTS = [
  { m: 1, d: 1, name: 'Tahun Baru Islam' },
  { m: 3, d: 12, name: 'Maulid Nabi Muhammad SAW' },
  { m: 7, d: 27, name: "Isra Mi'raj" },
  { m: 8, d: 15, name: 'Nisfu Syaban' },
  { m: 9, d: 1, name: 'Awal Ramadan' },
  { m: 9, d: 17, name: 'Nuzulul Quran' },
  { m: 10, d: 1, name: 'Idulfitri' },
  { m: 12, d: 10, name: 'Iduladha' }
];

let fmt = null;
function formatter() {
  if (fmt === null) {
    try { fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' }); }
    catch (e) { fmt = false; }
  }
  return fmt;
}
export const supported = () => !!formatter() && !!hijriOf(2026, 1, 1);

// Tanggal Masehi (y, m, d) -> {d, m, y} Hijriah, atau null jika peramban tidak mendukung.
export function hijriOf(y, m, d) {
  const f = formatter();
  if (!f) return null;
  const parts = f.formatToParts(new Date(Date.UTC(y, m - 1, d, 12)));
  const get = t => Number((parts.find(p => p.type === t) || {}).value);
  const out = { d: get('day'), m: get('month'), y: get('year') };
  return out.d && out.m && out.y ? out : null;
}

export const hijriText = h => h.d + ' ' + HIJRI_MONTH[h.m - 1] + ' ' + h.y + ' H';
export const masehiText = (y, m, d) => {
  const w = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return DAY_NAME[w] + ', ' + d + ' ' + MASEHI_MONTH[m - 1] + ' ' + y;
};

// Hari besar berikutnya dalam rentang ~13 bulan ke depan (tiap hari besar: kemunculan pertama).
export function upcomingEvents(y, m, d, limit = 5) {
  const seen = new Set(), found = [];
  for (let i = 0; i < 400 && found.length < EVENTS.length; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i, 12));
    const gy = dt.getUTCFullYear(), gm = dt.getUTCMonth() + 1, gd = dt.getUTCDate();
    const h = hijriOf(gy, gm, gd);
    if (!h) return [];
    const ev = EVENTS.find(e => e.m === h.m && e.d === h.d);
    if (ev && !seen.has(ev.name)) { seen.add(ev.name); found.push({ name: ev.name, y: gy, m: gm, d: gd, hijri: h, inDays: i }); }
  }
  return found.sort((a, b) => a.inDays - b.inDays).slice(0, limit);
}
