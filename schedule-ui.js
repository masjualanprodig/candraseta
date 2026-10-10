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
    return h('div', { class: 'panel' }, h('h3', {}, 'Jadwal salat'),
      h('p', { class: 'muted' }, 'Lokasi masjid belum diisi, jadi jadwal salat belum bisa dihitung. Pengurus dapat mengisi koordinat di profil masjid.'));
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

export function calendarPanel(now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
  if (!cal.supported()) {
    return h('div', { class: 'panel' }, h('h3', {}, 'Kalender Islam'),
      h('p', { class: 'muted' }, 'Peramban ini belum mendukung kalender Hijriah. Tanggal Hijriah perlu dikonfirmasi dari pengumuman resmi.'));
  }
  const today = cal.hijriOf(y, m, d);
  const events = cal.upcomingEvents(y, m, d, 5);
  return h('details', { class: 'panel calpanel' },
    h('summary', {},
      h('div', {}, h('strong', {}, 'Kalender Islam')),
      h('div', { class: 'caltoday' }, h('b', {}, cal.masehiText(y, m, d)), h('div', { class: 'muted' }, cal.hijriText(today) + ' (perkiraan)'))),
    h('h4', { class: 'mt2' }, 'Hari besar mendatang'),
    events.map(e => h('div', { class: 'irow' },
      h('div', { class: 'minfo' }, h('strong', {}, e.name), h('div', { class: 'muted' }, cal.masehiText(e.y, e.m, e.d) + ' \u00b7 ' + cal.hijriText(e.hijri))),
      h('span', { class: 'badge b-pending' }, e.inDays === 0 ? 'Hari ini' : e.inDays + ' hari lagi'))),
    h('p', { class: 'hint' }, 'Tanggal Hijriah adalah PERKIRAAN (kalender Umm al-Qura) dan perlu dikonfirmasi. Penetapan resmi di Indonesia mengikuti pengumuman Kemenag (sidang isbat) dan bisa berbeda 1\u20132 hari. Pergantian hari saat Maghrib belum diperhitungkan.'));
}
