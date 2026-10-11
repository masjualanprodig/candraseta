// BAITUNA - feed-ui.js
// Beranda umum: agenda mendatang & pengumuman terbaru dari semua masjid aktif (tanpa login).
import { h } from './ui.js';
import { fetchFeed } from './public-service.js';
import { fmtWhen, isUpcoming, dateParts, dayDiff, fmtTimes } from './post-time.js';
import { publicPhotoUrl } from './supabase.js';
import * as cal from './islamic-calendar.js';

const tzOf = p => (p.mosques && p.mosques.timezone) || 'Asia/Jakarta';
const where = p => p.mosques ? [p.mosques.name, p.mosques.city].filter(Boolean).join(' · ') : '';
const NS = 'http://www.w3.org/2000/svg';
export function icon(paths, cls) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
  s.innerHTML = paths; // path statis dari kode ini, bukan dari data pengguna
  return s;
}
export const ICONS = {
  mosque: '<path d="M12 3c1.2 1.3 1.8 2.4 1.8 3.6A1.8 1.8 0 0 1 12 8.4a1.8 1.8 0 0 1-1.8-1.8C10.2 5.4 10.8 4.3 12 3z"/><path d="M5 21v-8a7 7 0 0 1 14 0v8M3 21h18M9.5 21v-4a2.5 2.5 0 0 1 5 0v4"/>',
  agenda: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17M8 14h3M8 17.5h6"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/><path d="M17 4v3M15.5 5.5h3"/>',
  horn: '<path d="M4 10v4h3l7 4V6l-7 4H4z"/><path d="M17.5 9.5a4 4 0 0 1 0 5"/>'
};

// Keadaan kosong yang ramah: gambar kecil + satu kalimat tentang apa yang terjadi.
export const emptyState = text => h('div', { class: 'empty' }, icon(ICONS.mosque, 'ic-lg'), h('p', { class: 'muted' }, text));

// Kartu tanggal hari ini (Masehi + Hijriah perkiraan) di atas beranda.
export function todayHero(now = new Date()) {
  let hij = null;
  try { if (cal.supported()) hij = cal.hijriOf(now.getFullYear(), now.getMonth() + 1, now.getDate()); } catch (e) {}
  return h('div', { class: 'today' },
    h('div', { class: 'today-main' },
      h('div', { class: 'today-day' }, cal.masehiText(now.getFullYear(), now.getMonth() + 1, now.getDate()).split(',')[0]),
      h('div', { class: 'today-date' }, now.getDate() + ' ' + cal.MASEHI_MONTH[now.getMonth()] + ' ' + now.getFullYear())),
    hij ? h('div', { class: 'today-hij' }, h('b', {}, cal.hijriText(hij)), h('span', {}, 'perkiraan, perlu dikonfirmasi')) : '');
}

// opts: { limit, only ('agenda'|'pengumuman'), onOpen(mosque), more (elemen penutup), hero (tampilkan tanggal hari ini) }
export function feedPanel(opts = {}) {
  const limit = opts.limit || 20, now = Date.now();
  const box = h('div', { class: 'feed' }, h('p', { class: 'muted center' }, 'Memuat agenda…'));
  const wrap = (p, cls, kids) => {
    const open = opts.onOpen && p.mosques ? () => opts.onOpen(p.mosques) : null;
    return open ? h('button', { class: 'feed-item ' + cls, type: 'button', onclick: open }, kids) : h('div', { class: 'feed-item ' + cls }, kids);
  };
  const agendaItem = p => {
    const tz = tzOf(p), dp = dateParts(p.starts_at, tz), diff = dayDiff(p.starts_at, tz, now);
    const soon = diff <= 0 ? 'Hari ini' : diff === 1 ? 'Besok' : '';
    const img = publicPhotoUrl(p.mosques && p.mosques.photo_path);
    return wrap(p, 'ag', [
      h('div', { class: 'datebox' + (soon ? ' now' : ''), 'aria-hidden': 'true' }, h('span', { class: 'dw' }, dp.dow), h('b', { class: 'dd' }, String(dp.d)), h('span', { class: 'dm' }, dp.mon)),
      h('div', { class: 'fi-main' },
        soon ? h('span', { class: 'fi-soon' }, soon) : '',
        h('b', { class: 'fi-title' }, p.title),
        h('div', { class: 'fi-time' }, h('span', { class: 'sr-only' }, dp.dow + ' ' + dp.d + ' ' + dp.mon + ', '), fmtTimes(p.starts_at, p.ends_at, tz)),
        h('div', { class: 'feed-where' }, where(p)),
        p.location ? h('div', { class: 'fi-place' }, p.location) : ''),
      img ? h('img', { class: 'fi-thumb', src: img, alt: '', loading: 'lazy' }) : ''
    ]);
  };
  const infoItem = p => wrap(p, 'inf', [
    h('div', { class: 'infoic', 'aria-hidden': 'true' }, icon(ICONS.horn)),
    h('div', { class: 'fi-main' },
      h('b', { class: 'fi-title' }, p.title),
      p.body ? h('p', { class: 'fi-body' }, p.body) : '',
      h('div', { class: 'feed-where' }, where(p) + ' · ' + fmtWhen(p.published_at || p.created_at, tzOf(p)).split(' · ')[0]))
  ]);
  fetchFeed(now).then(({ agenda, info }) => {
    const ag = agenda.filter(p => p.starts_at && p.mosques && isUpcoming(p, now, tzOf(p))).slice(0, limit);
    const inf = info.filter(p => p.mosques).slice(0, limit);
    box.replaceChildren(...[
      opts.hero ? todayHero() : '',
      opts.only === 'pengumuman' ? '' : h('section', { class: 'fsec' }, h('h3', {}, 'Agenda mendatang'),
        ag.length ? ag.map(agendaItem) : emptyState('Belum ada agenda mendatang. Agenda yang diterbitkan masjid akan muncul di sini.')),
      opts.only === 'agenda' ? '' : h('section', { class: 'fsec' }, h('h3', {}, 'Pengumuman terbaru'),
        inf.length ? inf.map(infoItem) : emptyState('Belum ada pengumuman.')),
      opts.more || ''
    ].flat());
  }).catch(() => box.replaceChildren(h('div', { class: 'empty' }, h('p', { class: 'muted' }, 'Agenda belum bisa dimuat. Periksa koneksi, lalu coba lagi.'))));
  return box;
}
