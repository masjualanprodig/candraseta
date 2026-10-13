// BAITUNA - notif-service.js
// Pusat Notifikasi: pengaturan di perangkat, penyusun daftar kabar, dan pengingat saat aplikasi terbuka.
// JUJUR: aplikasi web TIDAK bisa membunyikan notifikasi saat ditutup tanpa server khusus. Karena itu:
//  - daftar di Pusat Notifikasi dihitung saat halaman dibuka, dan
//  - pengingat HP (opsional) hanya berbunyi selama BAITUNA terbuka di peramban.
// Lokasi dipakai hanya di perangkat (tidak dikirim ke server).
import { prayerMoments, todayIn, PRAYERS, fmt, DHUHA_MIN, DHUHA_END_MIN } from './prayer-times.js';
import { hijriOf, HIJRI_MONTH, DAY_NAME, MASEHI_MONTH } from './islamic-calendar.js';
import { fastingFor, dowOf, FAST_GROUPS, ramadanStatus, daysText, RAMADAN_MILESTONES } from './puasa-service.js';
import { amalanFor } from './amalan-service.js';
import { CITIES } from './cities-id.js';
import { fetchMosquesWithCoords, sortByDistance, fmtDistance } from './nearby-service.js';
import { request } from './supabase.js';
import { fmtWhen, isUpcoming, dayDiff } from './post-time.js';
import { listProducts, priceText } from './market-service.js';
import { rkeyOf, loadLinks, slotAnchors, SLOT_ORDER } from './sunnah-link.js';
import { SLOTS, loadDone } from './sunnah-service.js';
import { load as loadTracker } from './tracker-service.js';
import { resolveRamadan, phaseOf, cachedRows } from './ramadan-service.js';

export const KEY = 'baituna.notif.v1', SEEN_KEY = 'baituna.notifseen.v1', LOC_KEY = 'baituna.loc.v1';

export const CATS = {
  salat: 'Waktu salat',
  puasa: 'Puasa sunnah dan wajib',
  ramadan: 'Hitung mundur Ramadan',
  amalan: 'Salat gerhana dan amalan sunnah lain',
  harian: 'Amalan sunnah harian sesuai waktu',
  pribadi: 'Pengingat pribadi saya',
  kajian: 'Kajian di masjid terdekat',
  sosial: 'Program sosial',
  info: 'Pengumuman masjid terdekat',
  pasar: 'Produk baru Pasar Umat'
};
export const CAT_ORDER = ['salat', 'puasa', 'ramadan', 'amalan', 'harian', 'pribadi', 'kajian', 'sosial', 'info', 'pasar'];
export const LEADS = [0, 5, 10, 15, 30];
export const RADII = [5, 10, 15, 25, 50];
export const FAST_HOURS = [18, 19, 20, 21];
export const DHUHA_OPTIONS = [15, 20, 30, 45]; // menit setelah terbit (pilihan pribadi)
export const FAST_KEYS = { senin: 'Senin', kamis: 'Kamis', ayyamul_bidh: 'Ayyamul Bidh', arafah: 'Arafah', tasua: 'Tasu’a', asyura: 'Asyura', syawal6: '6 hari Syawal', ramadan: 'Ramadan' };
export const SAHUR_OPTIONS = [15, 30, 45, 60]; // menit sebelum Imsak
export const MAX_CUSTOM = 8;
export const PRAYER_KEYS = PRAYERS.map(p => p[0]);

export const defaults = () => ({
  v: 1,
  cats: { salat: true, puasa: true, ramadan: true, amalan: true, harian: true, pribadi: true, kajian: true, sosial: true, info: true, pasar: true },
  prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true, dhuha: true, tahajud: true },
  slots: { subuh: true, pagi: true, dhuha: true, siang: true, sore: true, malam: true, tidur: true },
  fasts: { senin_kamis: true, ayyamul_bidh: true, hari_utama: true, ramadan: true },
  fastKeys: Object.fromEntries(Object.keys(FAST_KEYS).map(k => [k, true])),
  mine: { dhuhaMin: 20, tahajudMode: 'third', tahajudTime: '03:00' }, // kebiasaan pribadi, hanya di perangkat ini
  ram: { sahur: true, berbuka: true, sahurMin: 30 }, // pengingat sahur & berbuka (hari Ramadan)
  custom: [], // pengingat buatan sendiri: { id, label, time 'HH:MM', days [0..6] }
  lead: 10, fastHour: 20, radius: 15, device: false
});
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const cleanCustom = a => (Array.isArray(a) ? a : []).map(x => {
  if (!x || typeof x !== 'object') return null;
  const label = String(x.label || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40), time = String(x.time || ''), id = String(x.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 12);
  const days = [...new Set((Array.isArray(x.days) ? x.days : []).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  return label && TIME_RE.test(time) && id && days.length ? { id, label, time, days } : null;
}).filter(Boolean).slice(0, MAX_CUSTOM);

const bool = (v, d) => typeof v === 'boolean' ? v : d;
export function sanitize(o) {
  const d = defaults(); if (!o || typeof o !== 'object') return d;
  const out = defaults();
  for (const k in d.cats) out.cats[k] = bool(o.cats && o.cats[k], d.cats[k]);
  for (const k in d.prayers) out.prayers[k] = bool(o.prayers && o.prayers[k], d.prayers[k]);
  for (const k in d.slots) out.slots[k] = bool(o.slots && o.slots[k], d.slots[k]);
  for (const k in d.fasts) out.fasts[k] = bool(o.fasts && o.fasts[k], d.fasts[k]);
  for (const k in d.fastKeys) out.fastKeys[k] = bool(o.fastKeys && o.fastKeys[k], true);
  const m = o.mine && typeof o.mine === 'object' ? o.mine : {};
  out.mine = { dhuhaMin: DHUHA_OPTIONS.includes(m.dhuhaMin) ? m.dhuhaMin : DHUHA_MIN, tahajudMode: m.tahajudMode === 'custom' ? 'custom' : 'third', tahajudTime: TIME_RE.test(m.tahajudTime) ? m.tahajudTime : '03:00' };
  const r = o.ram && typeof o.ram === 'object' ? o.ram : {};
  out.ram = { sahur: bool(r.sahur, true), berbuka: bool(r.berbuka, true), sahurMin: SAHUR_OPTIONS.includes(r.sahurMin) ? r.sahurMin : 30 };
  out.custom = cleanCustom(o.custom);
  out.lead = LEADS.includes(o.lead) ? o.lead : d.lead;
  out.fastHour = FAST_HOURS.includes(o.fastHour) ? o.fastHour : d.fastHour;
  out.radius = RADII.includes(o.radius) ? o.radius : d.radius;
  out.device = o.device === true;
  return out;
}
export function load() { try { return sanitize(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return defaults(); } }
export function save(s) { try { localStorage.setItem(KEY, JSON.stringify(sanitize(s))); } catch (e) { /* abaikan */ } }

// ---- sudah dibaca (di perangkat) ----
export function loadSeen(now = Date.now()) {
  try {
    const o = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null'), ids = {};
    if (o && o.ids && typeof o.ids === 'object') for (const k in o.ids) if (Number.isFinite(o.ids[k]) && now - o.ids[k] < 90 * 864e5) ids[String(k).slice(0, 80)] = o.ids[k];
    return ids;
  } catch (e) { return {}; }
}
export function markSeen(ids, list, now = Date.now()) {
  const out = { ...ids }; for (const x of list) out[x] = now;
  const keys = Object.keys(out).sort((a, b) => out[b] - out[a]).slice(0, 300), res = {}; keys.forEach(k => { res[k] = out[k]; });
  try { localStorage.setItem(SEEN_KEY, JSON.stringify({ v: 1, ids: res })); } catch (e) { /* abaikan */ }
  return res;
}

// ---- lokasi (dibagi dengan Jadwal Salat) ----
// { lat, lng, off (selisih jam), label } atau null
export function readLoc(now = Date.now()) {
  try {
    const o = JSON.parse(localStorage.getItem(LOC_KEY) || 'null');
    if (!o || !Number.isFinite(o.lat) || !Number.isFinite(o.lng) || Math.abs(o.lat) > 90 || Math.abs(o.lng) > 180) return null;
    if (o.mode === 'city') { const c = CITIES.find(x => x.name === o.city); return c ? { lat: c.lat, lng: c.lng, off: c.tz, label: c.name } : null; }
    if (o.mode === 'gps') return { lat: o.lat, lng: o.lng, off: -new Date(now).getTimezoneOffset() / 60, label: 'lokasi HP' };
  } catch (e) { /* abaikan */ }
  return null;
}

const p2 = n => String(n).padStart(2, '0');
const clock = (ms, off) => fmt(((ms + off * 3600000) / 60000) % 1440);
const dayAdd = (d, n) => { const x = new Date(Date.UTC(d.y, d.m - 1, d.d + n)); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() }; };
const dayKey = d => d.y + p2(d.m) + p2(d.d);
const dayLabel = d => DAY_NAME[dowOf(d.y, d.m, d.d)] + ', ' + d.d + ' ' + MASEHI_MONTH[d.m - 1];
const startOfDay = (d, off) => Date.UTC(d.y, d.m - 1, d.d) - off * 3600000;
export const zoneName = off => off === 7 ? 'WIB' : off === 8 ? 'WITA' : off === 9 ? 'WIT' : '';

// ---- 1. Waktu salat hari ini ----
// Sepertiga malam terakhir: malam dihitung dari Maghrib hingga Subuh berikutnya (perkiraan; ada pendapat lain tentang awal malam).
export function tahajudWindow(day, loc, mine) {
  const a = prayerMoments(day, loc.lat, loc.lng, loc.off), b = prayerMoments(dayAdd(day, 1), loc.lat, loc.lng, loc.off);
  if (!Number.isFinite(a.maghrib) || !Number.isFinite(b.fajr)) return null;
  if (mine && mine.tahajudMode === 'custom' && TIME_RE.test(mine.tahajudTime)) { // jam pilihan sendiri: dini hari (sebelum 12.00) = malam itu berlanjut ke hari berikutnya
    const [hh, mm] = mine.tahajudTime.split(':').map(Number), st = startOfDay(dayAdd(day, hh < 12 ? 1 : 0), loc.off) + (hh * 60 + mm) * 60000;
    return st > a.maghrib && st < b.fajr ? { start: st, end: b.fajr, custom: true } : null;
  }
  const start = Math.round((a.maghrib + (b.fajr - a.maghrib) * 2 / 3) / 60000) * 60000;
  return { start, end: b.fajr };
}
export const dhuhaWindow = (mo, min = DHUHA_MIN) => Number.isFinite(mo.sunrise) && Number.isFinite(mo.dhuhr) ? { start: mo.sunrise + min * 60000, end: mo.dhuhr - DHUHA_END_MIN * 60000 } : null;

export function prayerItems(now, loc, S) {
  if (!loc || !S.cats.salat) return [];
  const day = todayIn(loc.off, now), mo = prayerMoments(day, loc.lat, loc.lng, loc.off), z = zoneName(loc.off), list = [];
  for (const [k, name] of PRAYERS) {
    if (!S.prayers[k] || !Number.isFinite(mo[k])) continue;
    list.push({ k, name, at: mo[k], end: null, ttl: name + ' ' + clock(mo[k], loc.off) + ' ' + z });
  }
  const dh = dhuhaWindow(mo, S.mine.dhuhaMin);
  if (S.prayers.dhuha && dh && dh.end > dh.start) list.push({ k: 'dhuha', name: 'Dhuha', at: dh.start, end: dh.end, ttl: 'Salat Dhuha ' + clock(dh.start, loc.off) + ' ' + z, rkey: 'salat_dhuha', note: 'Waktu Dhuha sekitar ' + clock(dh.start, loc.off) + ' sampai menjelang Dzuhur (' + (S.mine.dhuhaMin === DHUHA_MIN ? 'perkiraan' : 'pilihan Anda') + ': terbit + ' + S.mine.dhuhaMin + ' menit).' });
  if (S.prayers.tahajud) {
    // sebelum Subuh: malam yang sedang berjalan dimulai kemarin; selain itu malam ini
    let tw = mo.fajr > now ? tahajudWindow(dayAdd(day, -1), loc, S.mine) : null;
    if (!tw || tw.end <= now) tw = tahajudWindow(day, loc, S.mine);
    if (tw) list.push({ k: 'tahajud', name: 'Tahajud', at: tw.start, end: tw.end, ttl: 'Salat Tahajud ' + clock(tw.start, loc.off) + ' ' + z, rkey: 'salat_tahajud', note: tw.custom ? 'Jam Tahajud pilihan Anda: ' + clock(tw.start, loc.off) + ' (sampai Subuh).' : 'Sepertiga malam terakhir (dini hari): mulai ' + clock(tw.start, loc.off) + ' sampai Subuh (perkiraan dari waktu Maghrib hingga Subuh).' });
  }
  list.sort((a, b) => a.at - b.at);
  let nextDone = false;
  return list.map(x => {
    let state;
    if (x.end) state = now >= x.end ? 'past' : now >= x.at ? 'now' : 'later'; else state = x.at <= now ? 'past' : 'later';
    if (state === 'later' && !nextDone) { state = 'next'; nextDone = true; }
    const text = x.note ? (state === 'now' ? 'Sedang berlangsung. ' : '') + x.note : state === 'past' ? 'Waktu sudah masuk.' : state === 'next' ? 'Waktu salat berikutnya.' : 'Akan masuk hari ini.';
    return { id: 'salat-' + dayKey(day) + '-' + x.k, cat: 'salat', title: x.ttl, text, at: x.at, state, silent: true, rkey: x.rkey || null };
  });
}

// ---- 2. Puasa ----
const upcomingKeys = ['ramadan', 'arafah', 'tasua', 'asyura', 'syawal6', 'ayyamul_bidh', 'larang_idulfitri', 'larang_iduladha'];
export function fastingItems(now, off, S) {
  if (!S.cats.puasa) return [];
  const today = todayIn(off, now), out = [], seen = new Set();
  for (let k = 0; k <= 30; k++) {
    const dt = dayAdd(today, k), h = hijriOf(dt.y, dt.m, dt.d); if (!h) return out;
    const f = fastingFor(h, dowOf(dt.y, dt.m, dt.d));
    for (const x of f.items) {
      if (x.kind === 'anjuran' || !S.fasts[x.group] || S.fastKeys[x.key] === false) continue;
      const near = k <= 1, special = upcomingKeys.includes(x.key);
      if (special && !near && seen.has(x.key)) continue;
      if (!near && !special) continue;
      if (x.key === 'ramadan' && k > 1 && h.d !== 1) continue;
      if (special) seen.add(x.key);
      if (k === 1 && x.key === 'ramadan' && out.some(o => o.fastKey === 'ramadan')) continue;
      const when = k === 0 ? 'Hari ini' : k === 1 ? 'Besok' : dayLabel(dt) + ' (' + k + ' hari lagi)';
      const hj = h.d + ' ' + HIJRI_MONTH[h.m - 1];
      let title = when + ': ' + x.name, text = x.desc, info = '';
      if (x.key === 'ramadan' && k > 1) title = 'Ramadan dimulai ' + dayLabel(dt) + ' (' + k + ' hari lagi, perkiraan)';
      if (x.key === 'ramadan' && k <= 1 && h.d !== 1) title = when + ': Puasa Ramadan (hari ke-' + h.d + ')';
      if (x.key === 'ayyamul_bidh' && k > 1) { info = 'Tanggal ' + (h.m === 12 ? '14–15' : '13–15') + ' ' + HIJRI_MONTH[h.m - 1] + ' (perkiraan).'; text = info + ' ' + x.desc; }
      out.push({ id: 'puasa-' + x.key + '-' + dayKey(dt), cat: 'puasa', title, text: text + ' Tanggal Hijriah: ' + hj + ' (perkiraan).', info: (info ? info + ' ' : '') + 'Tanggal Hijriah: ' + hj + ' (perkiraan).', desc: x.kind === 'larangan' ? '' : x.desc, rkey: rkeyOf(x.key), at: startOfDay(dt, off), fastKey: x.key, kind: x.kind, group: x.group, daysAhead: k });
    }
  }
  return out;
}

// ---- 2b. Hitung mundur Ramadan ----
export function ramadanItems(now, off, S) {
  if (!S.cats.ramadan) return [];
  const today = todayIn(off, now), st = ramadanStatus(today.y, today.m, today.d); if (!st) return [];
  if (st.phase === 'ramadan') return [{ id: 'ramadan-hari-' + dayKey(today), cat: 'ramadan', title: 'Ramadan hari ke-' + st.day, text: (st.daysToEid ? 'Sekitar ' + st.daysToEid + ' hari menuju 1 Syawal (perkiraan). ' : '') + 'Tanggal mengikuti penetapan pemerintah (sidang isbat).', rkey: 'puasa_ramadan' }];
  const bucket = RAMADAN_MILESTONES.slice().reverse().find(x => x >= st.inDays) || 'jauh';
  const when = DAY_NAME[dowOf(st.y, st.m, st.d)] + ', ' + st.d + ' ' + MASEHI_MONTH[st.m - 1] + ' ' + st.y;
  return [{ id: 'ramadan-' + st.hijriYear + '-' + bucket, cat: 'ramadan', title: 'Menuju Ramadan ' + st.hijriYear + ' H: ' + daysText(st.inDays), text: 'Perkiraan awal Ramadan: ' + when + '. Penetapan resmi menunggu sidang isbat Kemenag, jadi bisa berbeda 1–2 hari. Persiapkan diri: lunasi puasa qadha bila ada dan perbanyak amal.', rkey: 'puasa_ramadan' }];
}

// ---- 2c. Salat gerhana & amalan sunnah lain (dalam 14 hari) ----
export function amalanItems(now, off, S) {
  if (!S.cats.amalan) return [];
  const today = todayIn(off, now), out = [], seen = new Set();
  for (let k = 0; k <= 14; k++) {
    const dt = dayAdd(today, k), h = hijriOf(dt.y, dt.m, dt.d);
    for (const x of amalanFor(h, dowOf(dt.y, dt.m, dt.d), dt.y, dt.m, dt.d)) {
      if (!x.mark || seen.has(x.key)) continue; seen.add(x.key);
      const when = k === 0 ? 'Hari ini' : k === 1 ? 'Besok' : dayLabel(dt) + ' (' + k + ' hari lagi)';
      out.push({ id: 'amalan-' + x.key + '-' + dayKey(dt), cat: 'amalan', title: when + ': ' + x.name, text: x.desc, info: '', desc: x.desc, rkey: rkeyOf(x.key), at: startOfDay(dt, off), daysAhead: k });
    }
  }
  return out;
}

// ---- 2d. Amalan sunnah harian (dari data Super Admin) sesuai waktu Jadwal Salat ----
// Isi amalan 100% dari tabel sunnah_items. Waktu mulai tiap kelompok mengikuti Jadwal Salat (hanya penanda awal,
// bukan batas ibadah). idx = indexItems(...); done = loadDone().
export function harianItems(now, loc, S, idx, done) {
  if (!S.cats.harian || !idx || !idx.all || !idx.all.length) return [];
  const off = loc ? loc.off : -new Date(now).getTimezoneOffset() / 60, day = todayIn(off, now);
  const mo = loc ? prayerMoments(day, loc.lat, loc.lng, off) : null;
  const dh = mo ? dhuhaWindow(mo, S.mine.dhuhaMin) : null, anch = mo ? slotAnchors(mo, dh ? dh.start : NaN) : {};
  const ids = (done && done.ids) || [], out = [], z = loc ? zoneName(off) : '';
  const mk = (slot, at) => {
    const list = idx.bySlot[slot] || []; if (!list.length) return null;
    const n = list.filter(i => ids.includes(i.id)).length, titles = list.slice(0, 3).map(i => i.title).join(', ') + (list.length > 3 ? ' dan ' + (list.length - 3) + ' lainnya' : '');
    const head = Number.isFinite(at) ? 'Mulai sekitar ' + clock(at, off) + ' ' + z + ' (mengikuti Jadwal Salat). ' : '';
    return { id: 'harian-' + dayKey(day) + '-' + slot, cat: 'harian', slot, title: 'Amalan ' + (SLOTS[slot] || slot).toLowerCase() + ' (' + list.length + ')', text: head + titles + '. ' + (n === list.length ? 'Semua sudah Anda centang hari ini.' : n + ' dari ' + list.length + ' sudah dicentang hari ini.'), at: Number.isFinite(at) ? at : startOfDay(day, off), count: list.length, doneCount: n, allDone: n === list.length, state: 'later', silent: true };
  };
  for (const slot of SLOT_ORDER) { if (!S.slots[slot]) continue; const x = mk(slot, anch[slot]); if (x) out.push(x); }
  const hr = S.slots.harian !== false ? mk('harian', NaN) : null; if (hr) out.push(hr);
  out.sort((a, b) => a.at - b.at);
  let nextDone = false;
  for (const x of out) { if (x.slot !== 'harian' && x.at <= now) x.state = 'past'; else if (!nextDone && x.slot !== 'harian') { x.state = 'next'; nextDone = true; } }
  return out;
}

// Pengingat dari Tracker Ibadah Harian (jam harian, tiap hari) ikut digabung agar semua pengingat pribadi satu tempat.
export function trackerReminders() {
  try { return loadTracker().reminders.filter(r => r.on).map(r => ({ id: 'tr-' + String(r.id).replace(/[^a-z0-9]/gi, '').slice(0, 14), label: r.label, time: r.time, days: [0, 1, 2, 3, 4, 5, 6], src: 'tracker' })); } catch (e) { return []; }
}
export const allCustom = S => [...S.custom, ...trackerReminders()];

// ---- 2e. Pengingat pribadi buatan pengguna (hari ini) ----
export function customItems(now, loc, S) {
  const all = allCustom(S); if (!S.cats.pribadi || !all.length) return [];
  const off = loc ? loc.off : -new Date(now).getTimezoneOffset() / 60, day = todayIn(off, now), dow = dowOf(day.y, day.m, day.d);
  const list = all.filter(c => c.days.includes(dow)).map(c => { const [hh, mm] = c.time.split(':').map(Number); return { c, at: startOfDay(day, off) + (hh * 60 + mm) * 60000 }; }).sort((a, b) => a.at - b.at);
  let nextDone = false;
  return list.map(({ c, at }) => { let state = at <= now ? 'past' : 'later'; if (state === 'later' && !nextDone) { state = 'next'; nextDone = true; }
    return { id: 'pribadi-' + c.id + '-' + dayKey(day), cat: 'pribadi', title: c.label + ' · ' + c.time, text: (state === 'past' ? 'Waktu pengingat sudah lewat.' : 'Pengingat pribadi hari ini.') + (c.src === 'tracker' ? ' (dibuat di Tracker Ibadah Harian)' : ''), at, state, silent: true }; });
}

// ---- 3. Pengingat yang bisa berbunyi saat aplikasi terbuka ----
// Mengembalikan [{ id, at, title, body }] dalam (now, now + horizon], urut waktu.
export function dueReminders(now, loc, S, horizon = 26 * 3600e3, ctx = null) {
  const out = [];
  const off = loc ? loc.off : -new Date(now).getTimezoneOffset() / 60, today = todayIn(off, now);
  for (let k = 0; k <= 2; k++) {
    const dt = dayAdd(today, k);
    if (S.cats.pribadi) for (const c of allCustom(S)) {
      if (!c.days.includes(dowOf(dt.y, dt.m, dt.d))) continue;
      const [hh, mm] = c.time.split(':').map(Number), at = startOfDay(dt, off) + (hh * 60 + mm) * 60000;
      if (at > now && at <= now + horizon) out.push({ id: 'rem-pribadi-' + c.id + '-' + dayKey(dt), at, title: c.label, body: 'Pengingat pribadi Anda (' + c.time + ').' });
    }
    if (loc && S.cats.salat) {
      const mo = prayerMoments(dt, loc.lat, loc.lng, loc.off);
      for (const [key, name] of PRAYERS) {
        if (!S.prayers[key] || !Number.isFinite(mo[key])) continue;
        const at = mo[key] - S.lead * 60000;
        if (at > now && at <= now + horizon) out.push({ id: 'rem-salat-' + dayKey(dt) + '-' + key, at, title: S.lead ? name + ' sekitar ' + S.lead + ' menit lagi' : 'Waktu ' + name, body: name + ' ' + clock(mo[key], loc.off) + ' ' + zoneName(loc.off) + ' (perkiraan, sesuai lokasi Anda).' });
      }
      const extra = [];
      const dh = dhuhaWindow(mo, S.mine.dhuhaMin); if (S.prayers.dhuha && dh && dh.end > dh.start) extra.push(['dhuha', 'Dhuha', dh.start]);
      const tw = S.prayers.tahajud ? tahajudWindow(dt, loc, S.mine) : null; if (tw) extra.push(['tahajud', tw.custom ? 'Tahajud' : 'Tahajud (sepertiga malam terakhir)', tw.start]);
      for (const [key, name, st0] of extra) {
        const at = st0 - S.lead * 60000;
        if (at > now && at <= now + horizon) out.push({ id: 'rem-salat-' + dayKey(dt) + '-' + key, at, title: S.lead ? name + ' sekitar ' + S.lead + ' menit lagi' : 'Waktu ' + name, body: name + ' mulai ' + clock(st0, loc.off) + ' ' + zoneName(loc.off) + ' (perkiraan, sesuai lokasi Anda).' });
      }
    }
    if (loc && S.cats.harian && ctx && ctx.idx && ctx.idx.all.length) {
      const mo2 = prayerMoments(dt, loc.lat, loc.lng, loc.off), dh2 = dhuhaWindow(mo2, S.mine.dhuhaMin), an = slotAnchors(mo2, dh2 ? dh2.start : NaN), ids = (ctx.done && ctx.done.ids) || [];
      for (const slot of SLOT_ORDER) {
        const list = ctx.idx.bySlot[slot] || []; if (!S.slots[slot] || !list.length || !Number.isFinite(an[slot])) continue;
        if (k === 0 && list.every(i => ids.includes(i.id))) continue; // hari ini: lewati bila semua sudah dicentang
        const at = an[slot] - S.lead * 60000;
        if (at > now && at <= now + horizon) out.push({ id: 'rem-harian-' + dayKey(dt) + '-' + slot, at, title: 'Amalan ' + (SLOTS[slot] || slot).toLowerCase() + ' (' + list.length + ')', body: list.slice(0, 3).map(i => i.title).join(', ') + (list.length > 3 ? ' dan ' + (list.length - 3) + ' lainnya' : '') + '. Buka Amalan Sunnah Harian untuk isi dan sumbernya.' });
      }
    }
    if (loc && S.cats.ramadan && (S.ram.sahur || S.ram.berbuka)) {
      const info = resolveRamadan(dt, cachedRows()), ph = info && phaseOf(info, dt);
      if (ph && ph.phase === 'ramadan') {
        const mo = prayerMoments(dt, loc.lat, loc.lng, loc.off), z = zoneName(loc.off), zs = z ? ' ' + z : '';
        if (Number.isFinite(mo.fajr) && S.ram.sahur) {
          const imsak = mo.fajr - 10 * 60000, at = imsak - S.ram.sahurMin * 60000;
          if (at > now && at <= now + horizon) out.push({ id: 'rem-sahur-' + dayKey(dt), at, title: 'Sahur: Imsak ' + S.ram.sahurMin + ' menit lagi', body: 'Ramadan hari ke-' + ph.day + '. Imsak ' + clock(imsak, loc.off) + zs + ', Subuh ' + clock(mo.fajr, loc.off) + zs + ' (perkiraan; ikuti jadwal masjid).' });
        }
        if (Number.isFinite(mo.maghrib) && S.ram.berbuka) {
          const at = mo.maghrib - S.lead * 60000;
          if (at > now && at <= now + horizon) out.push({ id: 'rem-berbuka-' + dayKey(dt), at, title: S.lead ? 'Berbuka sekitar ' + S.lead + ' menit lagi' : 'Waktu berbuka (Maghrib)', body: 'Maghrib ' + clock(mo.maghrib, loc.off) + zs + ' (perkiraan; ikuti jadwal masjid).' });
        }
      }
    }
    if (S.cats.ramadan) {
      const rs = ramadanStatus(dt.y, dt.m, dt.d);
      if (rs && rs.phase === 'sebelum' && RAMADAN_MILESTONES.includes(rs.inDays)) {
        const at = startOfDay(dt, off) + 8 * 3600e3;
        if (at > now && at <= now + horizon) out.push({ id: 'rem-ramadan-' + dayKey(dt), at, title: 'Menuju Ramadan: ' + daysText(rs.inDays), body: 'Perkiraan awal Ramadan ' + rs.d + ' ' + MASEHI_MONTH[rs.m - 1] + ' ' + rs.y + '. Tunggu penetapan resmi pemerintah.' });
      }
    }
    if (S.cats.puasa && k >= 1) {
      const h = hijriOf(dt.y, dt.m, dt.d); if (!h) continue;
      const f = fastingFor(h, dowOf(dt.y, dt.m, dt.d));
      const x = f.items.find(i => i.kind !== 'anjuran' && S.fasts[i.group] && S.fastKeys[i.key] !== false);
      if (!x) continue;
      const at = startOfDay(dt, off) - (24 - S.fastHour) * 3600e3;
      if (at > now && at <= now + horizon) out.push({ id: 'rem-puasa-' + dayKey(dt), at, title: 'Besok: ' + x.name, body: x.kind === 'larangan' ? x.desc : 'Pengingat malam sebelumnya (tanggal perkiraan). Siapkan niat dan sahur.' });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

// ---- 4. Kabar dari masjid terdekat ----
const PCOLS = 'id,mosque_id,kind,topic,title,body,location,starts_at,ends_at,published_at';
export async function fetchNear(loc, S, now = Date.now()) {
  const all = await fetchMosquesWithCoords();
  const near = sortByDistance(all, loc).filter(x => x.km <= S.radius).slice(0, 15);
  if (!near.length) return { near: [], posts: [] };
  const ids = near.map(x => x.m.id).join(',');
  const base = '/rest/v1/mosque_posts?select=' + PCOLS + '&status=eq.published&mosque_id=in.(' + ids + ')';
  const since = new Date(now - 12 * 3600e3).toISOString(), recent = new Date(now - 30 * 864e5).toISOString();
  const [a, i] = await Promise.all([
    request(base + '&kind=eq.agenda&starts_at=gte.' + encodeURIComponent(since) + '&order=starts_at.asc&limit=60'),
    request(base + '&kind=eq.pengumuman&published_at=gte.' + encodeURIComponent(recent) + '&order=published_at.desc&limit=40')
  ]);
  if (!a.ok || !i.ok) throw Object.assign(new Error('gagal memuat'), { status: (a.ok ? i : a).status, code: ((a.ok ? i : a).data || {}).code });
  return { near, posts: [...(Array.isArray(a.data) ? a.data : []), ...(Array.isArray(i.data) ? i.data : [])] };
}

export function postItems(data, S, now = Date.now()) {
  const byId = {}; (data.near || []).forEach(x => { byId[x.m.id] = x; });
  const out = [];
  for (const p of data.posts || []) {
    const n = byId[p.mosque_id]; if (!n) continue;
    const tz = n.m.timezone || 'Asia/Jakarta', topic = p.topic === 'kajian' || p.topic === 'sosial' ? p.topic : 'umum';
    const cat = topic === 'umum' ? 'info' : topic; if (!S.cats[cat]) continue;
    const where = n.m.name + ' · ' + fmtDistance(n.km);
    if (p.kind === 'agenda') {
      if (!p.starts_at || !isUpcoming(p, now, tz)) continue;
      const dd = dayDiff(p.starts_at, tz, now); if (dd > 14) continue;
      const lead = dd <= 0 ? 'Hari ini' : dd === 1 ? 'Besok' : 'Dalam ' + dd + ' hari';
      out.push({ id: 'post-' + p.id, cat, title: p.title, text: lead + ' · ' + fmtWhen(p.starts_at, tz) + (p.location ? ' · ' + p.location : '') + '\n' + where, at: Date.parse(p.starts_at), mosqueId: n.m.id });
    } else {
      out.push({ id: 'post-' + p.id, cat, title: p.title, text: (p.body ? String(p.body).slice(0, 140) + (String(p.body).length > 140 ? '…' : '') + '\n' : '') + where, at: Date.parse(p.published_at) || 0, mosqueId: n.m.id, recent: true });
    }
  }
  const lim = {}; // maksimal 6 per jenis
  return out.sort((a, b) => (a.recent === b.recent ? 0 : a.recent ? 1 : -1) || (a.recent ? b.at - a.at : a.at - b.at)).filter(x => (lim[x.cat] = (lim[x.cat] || 0) + 1) <= 6);
}

// ---- 5. Produk baru di Pasar Umat ----
export async function fetchMarket(S, now = Date.now()) {
  if (!S.cats.pasar) return [];
  const { items } = await listProducts();
  return items.filter(p => p.approved_at && now - Date.parse(p.approved_at) < 7 * 864e5 && p.available !== false).slice(0, 6)
    .map(p => ({ id: 'pasar-' + p.id, cat: 'pasar', title: 'Produk baru: ' + p.title, text: priceText(p.price, p.price_note) + (p.seller ? ' · ' + p.seller.name : '') + (p.seller && p.seller.city ? ' (' + p.seller.city + ')' : ''), at: Date.parse(p.approved_at) }));
}

// ---- Pengingat saat aplikasi terbuka ----
let timer = null; const fired = new Set();
export const deviceSupported = () => typeof Notification !== 'undefined';
export async function show(title, body, tag) {
  try {
    const reg = navigator.serviceWorker && navigator.serviceWorker.getRegistration ? await navigator.serviceWorker.getRegistration() : null;
    if (reg && reg.showNotification) { await reg.showNotification(title, { body, tag, icon: 'icon-192.png', badge: 'icon-192.png' }); return true; }
    new Notification(title, { body, tag, icon: 'icon-192.png' }); return true;
  } catch (e) { return false; }
}
let linkIdx = null, linkLoading = false;
function ensureLinks() { // memuat amalan harian sekali; setelah itu pengingat dipasang ulang
  if (linkIdx || linkLoading) return;
  linkLoading = true;
  loadLinks().then(i => { linkIdx = i; linkLoading = false; armReminders(); }).catch(() => { linkLoading = false; });
}
export function armReminders(now = Date.now()) {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!deviceSupported() || Notification.permission !== 'granted') return null;
  const S = load(); if (!S.device) return null;
  const loc = readLoc(now); // tanpa lokasi, hanya pengingat pribadi & puasa yang bisa berbunyi
  if (S.cats.harian && loc) ensureLinks();
  const next = dueReminders(now, loc, S, undefined, linkIdx ? { idx: linkIdx, done: loadDone(new Date(now)) } : null).find(r => !fired.has(r.id)); if (!next) return null;
  timer = setTimeout(async () => { fired.add(next.id); await show(next.title, next.body, next.id); armReminders(Date.now()); }, Math.min(next.at - now, 2 ** 31 - 1));
  return next;
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') armReminders(); });
