// BAITUNA - schedule-ui.js
// Tampilan jadwal salat (per masjid) dan kalender Islam. Perhitungan ada di
// prayer-times.js dan islamic-calendar.js.
import { h } from './ui.js';
import { computePrayerTimes, fmt, todayIn, TZ_LABEL, METHOD } from './prayer-times.js';
import * as cal from './islamic-calendar.js';

const ROWS = [['fajr', 'Subuh'], ['sunrise', 'Terbit'], ['dhuhr', 'Dzuhur'], ['asr', 'Ashar'], ['maghrib', 'Maghrib'], ['isha', 'Isya']];

export function prayerPanel(m, now = Date.now()) {
  const lat = Number(m.latitude), lng = Number(m.longitude);
  if (m.latitude === null || m.longitude === null || m.latitude === undefined || !isFinite(lat) || !isFinite(lng)) {
    return ''; // koordinat belum diisi: panel disembunyikan di profil publik (pengurus mengisinya di Edit profil)
  }
  const tz = m.timezone || 'Asia/Jakarta';
  const day = todayIn(tz, now);
  const t = computePrayerTimes(day, lat, lng, tz);
  const zone = TZ_LABEL[tz] || 'WIB';
  return h('div', { class: 'panel' },
    h('h3', {}, 'Jadwal salat hari ini'),
    h('p', { class: 'muted' }, cal.masehiText(day.y, day.m, day.d) + ' · waktu ' + zone),
    h('div', { class: 'ptimes' }, ROWS.map(([k, label]) =>
      h('div', { class: 'ptime' + (k === 'sunrise' ? ' minor' : '') }, h('span', {}, label), h('b', {}, fmt(t[k]))))),
    h('p', { class: 'hint' }, 'Dihitung otomatis dari koordinat masjid: Subuh ' + METHOD.fajr + '°, Isya ' + METHOD.isha +
      '°, Ashar mazhab Syafi’i, ihtiyat ' + METHOD.ihtiyat + ' menit (acuan Kemenag RI). Bisa berbeda beberapa menit dari jadwal resmi; ikuti pengumuman masjid.'));
}
