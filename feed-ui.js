// BAITUNA - feed-ui.js
// Beranda umum: agenda mendatang & pengumuman terbaru dari semua masjid aktif (tanpa login).
import { h } from './ui.js';
import { fetchFeed } from './public-service.js';
import { fmtRange, fmtWhen, isUpcoming } from './post-time.js';

const tzOf = p => (p.mosques && p.mosques.timezone) || 'Asia/Jakarta';
const where = p => p.mosques ? [p.mosques.name, p.mosques.city].filter(Boolean).join(' · ') : '';

// opts: { limit (jumlah per bagian), only ('agenda' | 'pengumuman', opsional), onOpen(mosque) (opsional), more (elemen penutup, opsional) }
export function feedPanel(opts = {}) {
  const limit = opts.limit || 20, now = Date.now();
  const box = h('div', { class: 'feed' }, h('p', { class: 'muted center' }, 'Memuat agenda…'));
  const item = (p, when) => {
    const open = opts.onOpen && p.mosques ? () => opts.onOpen(p.mosques) : null;
    const kids = [
      h('b', {}, p.title),
      h('div', { class: 'muted' }, when),
      h('div', { class: 'feed-where' }, where(p)),
      p.location ? h('div', { class: 'muted' }, 'Tempat: ' + p.location) : ''
    ];
    return open ? h('button', { class: 'feed-item', type: 'button', onclick: open }, kids) : h('div', { class: 'feed-item' }, kids);
  };
  fetchFeed(now).then(({ agenda, info }) => {
    const ag = agenda.filter(p => p.starts_at && p.mosques && isUpcoming(p, now, tzOf(p))).slice(0, limit);
    const inf = info.filter(p => p.mosques).slice(0, limit);
    box.replaceChildren(...[
      opts.only === 'pengumuman' ? '' : h('div', { class: 'panel' }, h('h3', {}, 'Agenda mendatang'),
        ag.length ? ag.map(p => item(p, fmtRange(p.starts_at, p.ends_at, tzOf(p)))) : h('p', { class: 'muted' }, 'Belum ada agenda mendatang.')),
      opts.only === 'agenda' ? '' : h('div', { class: 'panel' }, h('h3', {}, 'Pengumuman terbaru'),
        inf.length ? inf.map(p => item(p, fmtWhen(p.published_at || p.created_at, tzOf(p)))) : h('p', { class: 'muted' }, 'Belum ada pengumuman.')),
      opts.more || ''
    ].flat());
  }).catch(() => box.replaceChildren(h('div', { class: 'panel center' }, h('p', { class: 'muted' }, 'Agenda belum bisa dimuat. Periksa koneksi, lalu coba lagi.'))));
  return box;
}
