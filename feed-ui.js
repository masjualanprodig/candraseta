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
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5M9 7.5h7"/>',
  quran: '<path d="M12 6.5C9.8 4.9 6.8 4.4 4 5v13c2.8-.6 5.8-.1 8 1.5 2.2-1.6 5.2-2.1 8-1.5V5c-2.8-.6-5.8-.1-8 1.5z"/><path d="M12 6.5v13M7 9.5h2M15 9.5h2"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  more: '<circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  zakat: '<circle cx="12" cy="12" r="8.5"/><path d="M12 6.8v10.4M9.4 9.5c0-1 1.2-1.6 2.6-1.6s2.6.6 2.6 1.6-1.2 1.5-2.6 1.8-2.6.8-2.6 1.8 1.2 1.7 2.6 1.7 2.6-.7 2.6-1.7"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  bell: '<path d="M6 17.5V11a6 6 0 0 1 12 0v6.5l1.5 1.5h-15z"/><path d="M10 21h4"/>',
  market: '<path d="M4 9l1.5-4.5h13L20 9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/><path d="M5.5 12v7.5h13V12M10 19.5v-4h4v4"/>',
  tracker: '<rect x="4" y="4.5" width="16" height="16" rx="3"/><path d="M8 3v3M16 3v3M8 13l2.6 2.6L16 10"/>',
  asma: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l1.3 3 3.2.3-2.4 2.1.8 3.1L12 14.4l-2.9 1.6.8-3.1-2.4-2.1 3.2-.3z"/>',
  belajar: '<path d="M12 4 2.5 9 12 14l9.5-5z"/><path d="M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5"/><path d="M21.5 9v5"/>',
  sunnah: '<path d="M12 3.5l2.4 5 5.4.7-4 3.7 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.7 5.4-.7z"/>',
  doa: '<path d="M12 20.5c-4.4-3-7.5-5.6-7.5-9A4.3 4.3 0 0 1 12 8.6a4.3 4.3 0 0 1 7.5 2.9c0 3.4-3.1 6-7.5 9z"/>',
  dzikir: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.2"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/>',
  news: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 12.5h8M8 16h5"/>',
  share: '<circle cx="6.5" cy="12" r="2.2"/><circle cx="17.5" cy="6.5" r="2.2"/><circle cx="17.5" cy="17.5" r="2.2"/><path d="M8.5 11l7-3.5M8.5 13l7 3.5"/>',
  home: '<path d="M4 11.5L12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  user: '<circle cx="12" cy="8.5" r="3.6"/><path d="M4.5 20c.6-3.6 3.7-5.7 7.5-5.7s6.9 2.1 7.5 5.7"/>',
  bookmark: '<path d="M6.5 4h11a1 1 0 0 1 1 1v15l-6.5-4-6.5 4V5a1 1 0 0 1 1-1z"/>',
  progress: '<path d="M4 19V9M10 19V5M16 19v-7M21 19H3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.9M12 17v.2"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.2"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  out: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/>',
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
