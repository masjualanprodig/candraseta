// BAITUNA - tracker-service.js
// Tracker Ibadah Harian. PRIBADI: disimpan HANYA di perangkat (localStorage), tidak dikirim ke server.
// Tidak ada skor, peringkat, atau streak. Isi amalan dan pengingat ditulis sendiri oleh pengguna; aplikasi tidak menetapkan dalil.
import { dayKey } from './dzikir-service.js';
export { dayKey };
export const KEY = 'baituna.tracker.v1';
export const SALAT = [['subuh', 'Subuh'], ['dzuhur', 'Dzuhur'], ['ashar', 'Ashar'], ['maghrib', 'Maghrib'], ['isya', 'Isya']];
export const SALAT_KEYS = SALAT.map(s => s[0]);
export const DAILY_LABEL = 'Isi tracker ibadah hari ini';
export const MAX_ITEMS = 20, MAX_REMINDERS = 10, MAX_NOTE = 500, MAX_NAME = 40, MAX_QURAN = 200, KEEP_DAYS = 400, BACK_DAYS = 30;
// Hanya nama; tidak ada klaim keutamaan. Pengguna bebas memakai, mengubah, atau mengabaikannya.
export const SUGGESTIONS = ['Salat Dhuha', 'Salat Witir', 'Salat Tahajud', 'Puasa sunnah', 'Dzikir pagi', 'Dzikir petang', 'Sedekah', 'Membaca Al-Qur’an'];

const isKey = k => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);
const clean = (s, max) => typeof s === 'string' ? s.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const validId = s => typeof s === 'string' && /^[a-z0-9]{4,20}$/.test(s);
const validTime = s => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export const emptyData = () => ({ v: 1, show: { salat: true, quran: true, amalan: true }, quranTarget: 0, items: [], reminders: [], days: {}, daily: { on: false, since: '', time: '20:00', rid: '' } });
export const emptyDay = () => ({ salat: {}, off: false, quran: 0, items: [], note: '', rd: [] });

export function sanitize(o) {
  const d = emptyData();
  if (!o || typeof o !== 'object') return d;
  if (o.show && typeof o.show === 'object') for (const k of ['salat', 'quran', 'amalan']) if (typeof o.show[k] === 'boolean') d.show[k] = o.show[k];
  d.quranTarget = Number.isInteger(o.quranTarget) && o.quranTarget >= 0 && o.quranTarget <= MAX_QURAN ? o.quranTarget : 0;
  const seen = new Set();
  if (Array.isArray(o.items)) for (const it of o.items) {
    if (d.items.length >= MAX_ITEMS || !it || !validId(it.id) || seen.has(it.id)) continue;
    const name = clean(it.name, MAX_NAME); if (!name) continue;
    seen.add(it.id); d.items.push({ id: it.id, name });
  }
  const rs = new Set();
  if (Array.isArray(o.reminders)) for (const r of o.reminders) {
    if (d.reminders.length >= MAX_REMINDERS || !r || !validId(r.id) || rs.has(r.id) || !validTime(r.time)) continue;
    const label = clean(r.label, MAX_NAME); if (!label) continue;
    rs.add(r.id); d.reminders.push({ id: r.id, label, time: r.time, on: r.on !== false });
  }
  if (o.daily && typeof o.daily === 'object') {
    const q = o.daily, on = q.on === true && isKey(q.since);
    d.daily = { on, since: on ? q.since : '', time: validTime(q.time) ? q.time : '20:00', rid: on && rs.has(q.rid) ? q.rid : '' };
  }
  if (o.days && typeof o.days === 'object') {
    for (const [k, v] of Object.entries(o.days)) {
      if (!isKey(k) || !v || typeof v !== 'object') continue;
      const day = emptyDay();
      if (v.salat && typeof v.salat === 'object') for (const s of SALAT_KEYS) if (v.salat[s] === true) day.salat[s] = true;
      day.off = v.off === true;
      day.quran = Number.isInteger(v.quran) && v.quran >= 0 && v.quran <= MAX_QURAN ? v.quran : 0;
      if (Array.isArray(v.items)) day.items = [...new Set(v.items.filter(x => seen.has(x)))];
      day.note = clean(v.note, MAX_NOTE);
      if (Array.isArray(v.rd)) day.rd = [...new Set(v.rd.filter(x => rs.has(x)))];
      d.days[k] = day;
    }
  }
  return prune(d);
}
function prune(d, now = new Date()) {
  const cut = dayKey(new Date(now.getTime() - KEEP_DAYS * 86400000));
  for (const k of Object.keys(d.days)) if (k < cut) delete d.days[k];
  return d;
}
export function load() { try { return sanitize(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return emptyData(); } }
export function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { return false; } }

/* ---- operasi (tidak mengubah objek lama) ---- */
const isEmpty = x => !Object.keys(x.salat || {}).length && !x.off && !x.quran && !(x.items || []).length && !x.note && !(x.rd || []).length;
const compact = days => Object.fromEntries(Object.entries(days).filter(([, v]) => !isEmpty(v)));
const withDay = (d, k, f) => { const cur = d.days[k] ? { ...emptyDay(), ...d.days[k] } : emptyDay(); const nx = f(cur); const days = { ...d.days }; const empty = !Object.keys(nx.salat).length && !nx.off && !nx.quran && !nx.items.length && !nx.note && !nx.rd.length; if (empty) delete days[k]; else days[k] = nx; return { ...d, days }; };
export const getDay = (d, k) => d.days[k] ? { ...emptyDay(), ...d.days[k] } : emptyDay();
export const toggleSalat = (d, k, s) => SALAT_KEYS.includes(s) ? withDay(d, k, x => { const salat = { ...x.salat }; if (salat[s]) delete salat[s]; else salat[s] = true; return { ...x, salat }; }) : d;
export const setOff = (d, k, on) => withDay(d, k, x => ({ ...x, off: !!on }));
export const setQuran = (d, k, n) => withDay(d, k, x => ({ ...x, quran: Math.max(0, Math.min(MAX_QURAN, Math.round(Number(n) || 0))) }));
export const toggleItem = (d, k, id) => d.items.some(i => i.id === id) ? withDay(d, k, x => ({ ...x, items: x.items.includes(id) ? x.items.filter(i => i !== id) : [...x.items, id] })) : d;
export const setNote = (d, k, t) => withDay(d, k, x => ({ ...x, note: clean(t, MAX_NOTE) }));
export const setShow = (d, key, on) => ['salat', 'quran', 'amalan'].includes(key) ? { ...d, show: { ...d.show, [key]: !!on } } : d;
export const setTarget = (d, n) => ({ ...d, quranTarget: Number.isInteger(n) && n >= 0 && n <= MAX_QURAN ? n : d.quranTarget });
export function addItem(d, name) {
  const nm = clean(name, MAX_NAME);
  if (!nm || d.items.length >= MAX_ITEMS || d.items.some(i => i.name.toLowerCase() === nm.toLowerCase())) return d;
  return { ...d, items: [...d.items, { id: newId(), name: nm }] };
}
export const removeItem = (d, id) => ({ ...d, items: d.items.filter(i => i.id !== id), days: compact(Object.fromEntries(Object.entries(d.days).map(([k, v]) => [k, { ...v, items: (v.items || []).filter(x => x !== id) }]))) });
export function addReminder(d, label, time) {
  const lb = clean(label, MAX_NAME);
  if (!lb || !validTime(time) || d.reminders.length >= MAX_REMINDERS) return d;
  return { ...d, reminders: [...d.reminders, { id: newId(), label: lb, time, on: true }] };
}
export const toggleReminder = (d, id) => ({ ...d, reminders: d.reminders.map(r => r.id === id ? { ...r, on: !r.on } : r) });
export const removeReminder = (d, id) => ({ ...d, reminders: d.reminders.filter(r => r.id !== id), days: compact(Object.fromEntries(Object.entries(d.days).map(([k, v]) => [k, { ...v, rd: (v.rd || []).filter(x => x !== id) }]))) });

/* ---- pengingat dalam aplikasi: muncul saat aplikasi dibuka setelah jam yang dipilih, bisa ditutup untuk hari itu ---- */
export function dueReminders(d, now = new Date()) {
  const hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const rd = getDay(d, dayKey(now)).rd;
  return d.reminders.filter(r => r.on && r.time <= hm && !rd.includes(r.id));
}
export const dismissReminder = (d, id, now = new Date()) => d.reminders.some(r => r.id === id) ? withDay(d, dayKey(now), x => ({ ...x, rd: x.rd.includes(id) ? x.rd : [...x.rd, id] })) : d;

/* ---- ringkasan: hanya hitungan netral "tercatat", tanpa nilai ---- */
export function dayKeysBack(n, end = new Date()) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(dayKey(new Date(end.getFullYear(), end.getMonth(), end.getDate() - i, 12))); return out; }
export function summarize(d, n, end = new Date()) {
  const keys = dayKeysBack(n, end);
  let salat = 0, salatDays = 0, offDays = 0, quran = 0, quranDays = 0, targetDays = 0, recorded = 0;
  const items = Object.fromEntries(d.items.map(i => [i.id, 0]));
  const perDay = keys.map(k => {
    const x = getDay(d, k), sc = SALAT_KEYS.filter(s => x.salat[s]).length;
    const has = sc > 0 || x.quran > 0 || x.items.length > 0 || !!x.note;
    if (x.off) offDays++; else salatDays++;
    if (!x.off) salat += sc;
    quran += x.quran; if (x.quran > 0) quranDays++;
    if (d.quranTarget > 0 && x.quran >= d.quranTarget) targetDays++;
    for (const id of x.items) if (id in items) items[id]++;
    if (has) recorded++;
    return { key: k, salat: sc, off: x.off, quran: x.quran, items: x.items.length, has };
  });
  return { n, keys, perDay, salat, salatPossible: salatDays * 5, offDays, quran, quranDays, targetDays, recorded, items };
}

/* ---- kalender (.ics): alarm sungguhan lewat aplikasi kalender di HP, berulang setiap hari ---- */
const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
export function reminderIcs(r, now = new Date()) {
  if (!r || !validTime(r.time) || !clean(r.label, MAX_NAME)) return null;
  const p = n => String(n).padStart(2, '0'), [hh, mm] = r.time.split(':');
  const date = now.getFullYear() + p(now.getMonth() + 1) + p(now.getDate());
  const stamp = now.getUTCFullYear() + p(now.getUTCMonth() + 1) + p(now.getUTCDate()) + 'T' + p(now.getUTCHours()) + p(now.getUTCMinutes()) + p(now.getUTCSeconds()) + 'Z';
  const label = clean(r.label, MAX_NAME);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BAITUNA//Tracker Ibadah//ID', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    'UID:baituna-' + (validId(r.id) ? r.id : newId()) + '@baituna.vercel.app', 'DTSTAMP:' + stamp, 'DTSTART:' + date + 'T' + hh + mm + '00', 'DURATION:PT5M', 'RRULE:FREQ=DAILY',
    'SUMMARY:' + icsEsc(label), 'DESCRIPTION:' + icsEsc('Pengingat pribadi dari BAITUNA'), 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(label), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
}

/* ---- Tracker harian (v164): mulai/berhenti, target harian, hasil per hari & per pekan ----
   Target harian = semua bagian yang sedang ditampilkan: 5 salat (kecuali hari libur), halaman Al-Qur'an (bila ada target),
   dan setiap amalan di daftar. Hanya "x dari y"; tanpa nilai, peringkat, atau streak. */
export function startDaily(d, time, now = new Date()) {
  const t = validTime(time) ? time : '20:00';
  let rem = d.reminders.filter(r => r.label === DAILY_LABEL);
  let nx = d;
  if (!rem.length) { nx = addReminder(d, DAILY_LABEL, t); if (nx === d) return d; rem = nx.reminders.filter(r => r.label === DAILY_LABEL); }
  const rid = rem[0].id;
  return { ...nx, reminders: nx.reminders.map(r => r.id === rid ? { ...r, time: t, on: true } : r), daily: { on: true, since: dayKey(now), time: t, rid } };
}
export const setDailyTime = (d, time) => d.daily.on && validTime(time) ? { ...d, reminders: d.reminders.map(r => r.id === d.daily.rid ? { ...r, time } : r), daily: { ...d.daily, time } } : d;
export const stopDaily = d => ({ ...removeReminder(d, d.daily.rid), daily: { on: false, since: '', time: d.daily.time, rid: '' } });

export function dayGoal(d, k) {
  const x = getDay(d, k), parts = [];
  if (d.show.salat && !x.off) { const n = SALAT_KEYS.filter(s => x.salat[s]).length; parts.push({ key: 'salat', label: 'Salat wajib', done: n, need: 5, units: 5, got: n, text: n + ' dari 5' }); }
  if (d.show.quran && d.quranTarget > 0) parts.push({ key: 'quran', label: 'Al-Qur’an', done: Math.min(x.quran, d.quranTarget), need: d.quranTarget, units: 1, got: x.quran >= d.quranTarget ? 1 : 0, text: x.quran + ' dari ' + d.quranTarget + ' halaman' });
  if (d.show.amalan) for (const it of d.items) { const on = x.items.includes(it.id); parts.push({ key: 'i:' + it.id, label: it.name, done: on ? 1 : 0, need: 1, units: 1, got: on ? 1 : 0, text: on ? 'sudah' : 'belum' }); }
  const total = parts.reduce((a, p) => a + p.units, 0), done = parts.reduce((a, p) => a + p.got, 0);
  const state = !total ? 'notarget' : done === total ? 'full' : done > 0 ? 'part' : 'none';
  return { key: k, off: x.off, parts, total, done, pct: total ? Math.round(done / total * 100) : 0, state };
}
export function dayMessage(g) {
  if (g.state === 'notarget') return 'Belum ada target. Tambahkan amalan atau target halaman agar hasilnya bisa dilihat.';
  if (g.state === 'full') return 'Alhamdulillah, semua target hari ini sudah tercapai. Barakallahu fiik.';
  if (g.state === 'part') return 'Sedikit lagi, tersisa ' + (g.total - g.done) + '. Semangat, Anda sudah memulainya.';
  return 'Belum ada yang dicentang. Mulai dari yang paling mudah, ya.';
}
export function weekResult(d, end = new Date()) {
  const keys = dayKeysBack(7, end), days = keys.map(k => dayGoal(d, k));
  const counted = days.filter(g => g.state !== 'notarget').length, full = days.filter(g => g.state === 'full').length;
  const filled = days.filter(g => g.state === 'full' || g.state === 'part').length;
  return { days, counted, full, filled, message: weekMessage(full, counted) };
}
export function weekMessage(full, counted) {
  if (!counted) return 'Belum ada target. Tambahkan amalan atau target halaman, lalu centang setiap hari.';
  if (full >= counted && full >= 7) return 'Alhamdulillah, 7 hari target tercapai semua. Semoga istiqamah dan diberkahi.';
  if (full >= 5) return 'Masya Allah, hasil pekan ini sangat baik. Pertahankan, ya.';
  if (full >= 3) return 'Alhamdulillah, sudah baik. Pekan depan bisa ditambah sedikit demi sedikit.';
  if (full >= 1) return 'Terima kasih sudah berusaha. Tidak apa-apa belum penuh; besok kita coba lagi.';
  return 'Pekan ini belum ada target yang tercapai, dan itu tidak mengapa. Hari ini adalah kesempatan baru. Mulai dari satu amalan saja.';
}
