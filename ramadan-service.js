// BAITUNA - ramadan-service.js
// Logika Ramadan Center: tanggal Ramadan (perkiraan atau ditetapkan Super Admin), jadwal imsakiyah,
// checklist ibadah pribadi (hanya di perangkat), dan rencana khatam. Tanpa data karangan:
// semua waktu dihitung di perangkat dan tanggal berstatus "perkiraan" sampai Super Admin menetapkannya.
import { request, db } from './supabase.js';
import { hijriOf } from './islamic-calendar.js';
import { ramadanStatus } from './puasa-service.js';
import { computePrayerTimes, isValidTimes, IMSAK_MIN } from './prayer-times.js';

const pad = n => String(n).padStart(2, '0');
export const ymdKey = d => d.y + '-' + pad(d.m) + '-' + pad(d.d);
export const addDays = (d, n) => { const x = new Date(Date.UTC(d.y, d.m - 1, d.d + n)); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() }; };
export const daysBetween = (a, b) => Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export function parseYmd(s) {
  const m = DATE_RE.exec(String(s || '')); if (!m) return null;
  const d = { y: +m[1], m: +m[2], d: +m[3] }, c = addDays(d, 0);
  return c.y === d.y && c.m === d.m && c.d === d.d ? d : null;
}

/* ===== Tanggal Ramadan ===== */
// Perkiraan dari kalender Umm al-Qura. Mengembalikan { hijriYear, start, days, status:'estimasi', source } atau null.
export function estimateRamadan(today) {
  const h0 = hijriOf(today.y, today.m, today.d); if (!h0) return null;
  let start, hijriYear;
  if (h0.m === 9) { start = addDays(today, -(h0.d - 1)); hijriYear = h0.y; }
  else {
    const st = ramadanStatus(today.y, today.m, today.d);
    if (!st || st.phase !== 'sebelum') return null;
    start = { y: st.y, m: st.m, d: st.d }; hijriYear = st.hijriYear;
  }
  let days = 30;
  for (let i = 29; i <= 30; i++) {
    const e = addDays(start, i), h = hijriOf(e.y, e.m, e.d);
    if (h && h.m === 10 && h.d === 1) { days = i; break; }
  }
  return { hijriYear, start, days, status: 'estimasi', source: 'Kalender Umm al-Qura (perkiraan)', note: '' };
}

// Gabungkan perkiraan dengan penetapan Super Admin (baris ramadan_settings) bila ada untuk tahun Hijriah yang sama.
export function resolveRamadan(today, rows = []) {
  // Penetapan yang rentangnya mencakup hari ini selalu dipakai (kalender Umm al-Qura bisa sudah masuk Syawal lebih dulu).
  for (const r of rows || []) {
    const st = r && parseYmd(r.start_date), dd = r && (r.days === 29 || r.days === 30) ? r.days : 0;
    if (!st || !dd) continue;
    const n = daysBetween(st, today);
    if (n >= 0 && n < dd) return { hijriYear: r.hijri_year, start: st, days: dd, status: r.status === 'ditetapkan' ? 'ditetapkan' : 'estimasi', source: r.source || (r.status === 'ditetapkan' ? 'Penetapan pengelola' : 'Perkiraan pengelola'), note: r.note || '' };
  }
  const est = estimateRamadan(today); if (!est) return null;
  const row = (rows || []).find(r => r && r.hijri_year === est.hijriYear);
  if (!row) return est;
  const start = parseYmd(row.start_date), days = row.days === 29 || row.days === 30 ? row.days : est.days;
  if (!start) return est;
  return { hijriYear: est.hijriYear, start, days, status: row.status === 'ditetapkan' ? 'ditetapkan' : 'estimasi', source: row.source || (row.status === 'ditetapkan' ? 'Penetapan pengelola' : 'Perkiraan pengelola'), note: row.note || '' };
}

// Fase hari ini: sebelum | ramadan | selesai
export function phaseOf(info, today) {
  const n = daysBetween(info.start, today);
  if (n < 0) return { phase: 'sebelum', inDays: -n };
  if (n < info.days) return { phase: 'ramadan', day: n + 1, left: info.days - n - 1, total: info.days };
  return { phase: 'selesai', since: n - info.days + 1 };
}
export const ramadanDates = info => Array.from({ length: info.days }, (_, i) => ({ ...addDays(info.start, i), day: i + 1 }));

/* ===== Penyimpanan tanggal (Super Admin menulis, siapa pun membaca) ===== */
// Salinan terakhir penetapan tanggal (data publik, bukan data pribadi) agar pengingat dan tampilan tetap memakai penetapan saat offline.
export const RCACHE = 'baituna.ramadancache.v1';
export function cachedRows() {
  try {
    const a = JSON.parse(localStorage.getItem(RCACHE) || '[]');
    return (Array.isArray(a) ? a : []).filter(r => r && Number.isInteger(r.hijri_year) && parseYmd(r.start_date) && (r.days === 29 || r.days === 30) && (r.status === 'ditetapkan' || r.status === 'estimasi'))
      .map(r => ({ hijri_year: r.hijri_year, start_date: r.start_date, days: r.days, status: r.status, source: typeof r.source === 'string' ? r.source.slice(0, 120) : null, note: typeof r.note === 'string' ? r.note.slice(0, 300) : null })).slice(0, 10);
  } catch (e) { return []; }
}
export const cacheRows = rows => { try { localStorage.setItem(RCACHE, JSON.stringify(rows || [])); } catch (e) { /* abaikan */ } };
export async function fetchSettings() {
  try {
    const r = await request('/rest/v1/ramadan_settings?select=hijri_year,start_date,days,status,source,note,updated_at&order=hijri_year.desc&limit=10');
    if (!r.ok) return { rows: [], error: r.status === 404 || (r.data && (r.data.code === '42P01' || r.data.code === 'PGRST205')) ? 'sql' : 'net' };
    const rows = Array.isArray(r.data) ? r.data : []; cacheRows(rows);
    return { rows, error: null };
  } catch (e) { return { rows: [], error: 'net' }; }
}
export async function saveSetting(f) {
  const out = await db('ramadan_settings', { method: 'POST', query: 'on_conflict=hijri_year', prefer: 'resolution=merge-duplicates,return=representation', body: f });
  if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak tersimpan'), { status: 403 });
  return out[0];
}
export async function deleteSetting(year) {
  const out = await db('ramadan_settings', { method: 'DELETE', query: 'hijri_year=eq.' + encodeURIComponent(year), prefer: 'return=representation' });
  if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak terhapus'), { status: 403 });
}
export function settingFields(year, startStr, days, status, source, note) {
  const y = Number(year), start = parseYmd(startStr);
  if (!Number.isInteger(y) || y < 1400 || y > 1600) return { error: 'Tahun Hijriah tidak valid.' };
  if (!start) return { error: 'Tanggal mulai tidak valid.' };
  const dd = Number(days); if (dd !== 29 && dd !== 30) return { error: 'Jumlah hari harus 29 atau 30.' };
  if (status !== 'estimasi' && status !== 'ditetapkan') return { error: 'Status tidak valid.' };
  const src = String(source || '').trim().slice(0, 120), nt = String(note || '').trim().slice(0, 300);
  if (status === 'ditetapkan' && !src) return { error: 'Isi sumber penetapan (mis. nama lembaga dan tanggal sidang).' };
  return { ok: { hijri_year: y, start_date: ymdKey(start), days: dd, status, source: src || null, note: nt || null } };
}

/* ===== Jadwal imsakiyah ===== */
// Satu baris per hari Ramadan. Waktu dalam menit sejak 00:00 (waktu setempat). Imsak = Subuh - 10 menit.
export function scheduleFor(info, lat, lng, off) {
  return ramadanDates(info).map(dt => {
    const t = computePrayerTimes({ y: dt.y, m: dt.m, d: dt.d }, lat, lng, off);
    const ok = isValidTimes(t);
    if (ok) t.imsak = t.fajr - IMSAK_MIN;
    return { day: dt.day, y: dt.y, m: dt.m, d: dt.d, dow: new Date(Date.UTC(dt.y, dt.m - 1, dt.d)).getUTCDay(), ok, t: ok ? t : null };
  });
}

const DOWN = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'], MONN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
import { fmt } from './prayer-times.js';
// Teks ringkas untuk dibagikan (WhatsApp dll.). Tanggal perkiraan ditandai jelas; hari yang tidak bisa dihitung dilewati.
export function imsakText(info, rows, place, zone) {
  const L = ['Imsakiyah Ramadan ' + info.hijriYear + ' H · ' + place + ' (' + zone + ')',
    info.status === 'ditetapkan' ? 'Awal Ramadan ditetapkan: ' + info.source : 'Tanggal Ramadan masih PERKIRAAN, belum ditetapkan resmi.', ''];
  for (const r of rows) if (r.ok) L.push(r.day + '. ' + DOWN[r.dow] + ' ' + r.d + ' ' + MONN[r.m - 1] + ' · Imsak ' + fmt(r.t.imsak) + ' · Subuh ' + fmt(r.t.fajr) + ' · Maghrib ' + fmt(r.t.maghrib));
  L.push('', 'Dihitung di perangkat (BAITUNA); bisa beda beberapa menit dari jadwal masjid. Ikuti jadwal masjid setempat.');
  return L.join('\n');
}

/* ===== Checklist ibadah Ramadan (pribadi, hanya di perangkat) ===== */
export const RKEY = 'baituna.ramadan.v1';
export const DEFAULT_ACTS = [['puasa', 'Puasa'], ['tarawih', 'Salat tarawih'], ['tilawah', 'Tilawah Al-Qur’an'], ['sedekah', 'Sedekah'], ['qiyam', 'Qiyamul lail'], ['dzikir', 'Dzikir pagi & petang']].map(([id, label]) => ({ id, label }));
export const MAX_CUSTOM = 8, MAX_LABEL = 40, MAX_KHATAM = 10;
const ID_RE = /^[a-z0-9]{3,20}$/;
const cleanLabel = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
export const emptyData = () => ({ v: 1, hidden: [], custom: [], days: {}, khatam: 1 });
export function sanitize(o) {
  const d = emptyData(); if (!o || typeof o !== 'object') return d;
  const builtin = DEFAULT_ACTS.map(a => a.id);
  if (Array.isArray(o.hidden)) d.hidden = [...new Set(o.hidden.filter(x => builtin.includes(x)))];
  if (Array.isArray(o.custom)) {
    const seen = new Set();
    for (const c of o.custom) {
      if (!c || typeof c.id !== 'string' || !ID_RE.test(c.id) || builtin.includes(c.id) || seen.has(c.id)) continue;
      const label = cleanLabel(c.label); if (!label) continue;
      seen.add(c.id); d.custom.push({ id: c.id, label });
      if (d.custom.length >= MAX_CUSTOM) break;
    }
  }
  const ids = new Set([...builtin, ...d.custom.map(c => c.id)]);
  if (o.days && typeof o.days === 'object') {
    for (const k of Object.keys(o.days)) {
      if (!parseYmd(k) || !Array.isArray(o.days[k])) continue;
      const list = [...new Set(o.days[k].filter(x => typeof x === 'string' && ids.has(x)))];
      if (list.length) d.days[k] = list;
    }
  }
  if (Number.isInteger(o.khatam) && o.khatam >= 1 && o.khatam <= MAX_KHATAM) d.khatam = o.khatam;
  return d;
}
export function load() { try { return sanitize(JSON.parse(localStorage.getItem(RKEY) || 'null')); } catch (e) { return emptyData(); } }
export function save(d) { try { localStorage.setItem(RKEY, JSON.stringify(d)); return true; } catch (e) { return false; } }
export const activities = d => [...DEFAULT_ACTS.filter(a => !d.hidden.includes(a.id)), ...d.custom];
export const doneOn = (d, key) => d.days[key] || [];
export function toggle(d, key, id) {
  if (!parseYmd(key) || !activities(d).some(a => a.id === id)) return d;
  const cur = doneOn(d, key), next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
  const days = { ...d.days }; if (next.length) days[key] = next; else delete days[key];
  return { ...d, days };
}
export function addCustom(d, label) {
  const l = cleanLabel(label);
  if (!l) return { d, error: 'Tulis nama kegiatan.' };
  if (d.custom.length >= MAX_CUSTOM) return { d, error: 'Maksimal ' + MAX_CUSTOM + ' kegiatan tambahan.' };
  if (activities(d).some(a => a.label.toLowerCase() === l.toLowerCase())) return { d, error: 'Kegiatan itu sudah ada.' };
  const id = 'c' + Math.random().toString(36).slice(2, 8).padEnd(5, '0');
  return { d: { ...d, custom: [...d.custom, { id, label: l }] } };
}
export function removeCustom(d, id) {
  const days = {}; for (const k of Object.keys(d.days)) { const l = d.days[k].filter(x => x !== id); if (l.length) days[k] = l; }
  return { ...d, custom: d.custom.filter(c => c.id !== id), days };
}
export const setHidden = (d, id, hide) => DEFAULT_ACTS.some(a => a.id === id) ? { ...d, hidden: hide ? [...new Set([...d.hidden, id])] : d.hidden.filter(x => x !== id) } : d;
export const setKhatam = (d, n) => Number.isInteger(n) && n >= 1 && n <= MAX_KHATAM ? { ...d, khatam: n } : d;
// Hari yang sudah dicentang untuk satu kegiatan, dihitung hanya pada hari Ramadan yang sudah/sedang berjalan.
export function countFor(d, info, today, id) {
  let done = 0, passed = 0;
  for (const dt of ramadanDates(info)) {
    if (daysBetween(dt, today) < 0) break;
    passed++; if (doneOn(d, ymdKey(dt)).includes(id)) done++;
  }
  return { done, passed };
}

/* ===== Rencana khatam ===== */
export const MUSHAF_PAGES = 604, SALAT_PER_DAY = 5, PAGES_PER_JUZ = 20;
// target = berapa kali khatam; daysLeft = sisa hari termasuk hari ini; pagesDone = halaman yang sudah dibaca selama Ramadan.
export function khatamPlan({ target, daysLeft, pagesDone }) {
  const t = Number.isInteger(target) && target >= 1 && target <= MAX_KHATAM ? target : 1;
  const total = t * MUSHAF_PAGES, done = Math.max(0, Math.min(total, Math.floor(Number(pagesDone) || 0)));
  const remaining = total - done, dl = Math.max(0, Math.floor(Number(daysLeft) || 0));
  const perDay = remaining === 0 ? 0 : dl > 0 ? Math.ceil(remaining / dl) : remaining;
  return { total, done, remaining, perDay, perSalat: Math.ceil(perDay / SALAT_PER_DAY), juzPerDay: Math.round(perDay / PAGES_PER_JUZ * 10) / 10, percent: Math.floor(done / total * 100), daysLeft: dl };
}
