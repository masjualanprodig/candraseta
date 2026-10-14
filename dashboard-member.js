// BAITUNA - dashboard-member.js
// Tampilan sementara untuk pengguna non-Super Admin (dashboard per peran dibangun di tahap berikutnya).
import { h, STATUS_LABEL } from './ui.js';
import { ROLE_LABEL } from './permissions.js';
import { renderMosque } from './dashboard-mosque.js';
import { getMosque } from './mosque-service.js';
import { renderPostsManager } from './posts-ui.js';
import { feedPanel, icon, ICONS } from './feed-ui.js';
import { openMosque } from './directory.js';
import { renderKasManager } from './kas-ui.js';


export async function renderMember(box, memberships) {
  const rows = memberships.filter(m => m.mosques);
  // Admin Masjid dari masjid aktif: tampilkan dashboard pengelolaan (satu masjid; jika lebih, yang pertama).
  const mine = rows.find(m => m.role === 'admin_masjid' && m.mosques.status === 'active');
  if (mine) { await renderMosque(box, mine.mosques.id); return; }
  // Ketua Takmir / Bendahara dari masjid aktif: agenda & pengumuman (Ketua) dan kas masjid.
  const act = rows.filter(m => (m.role === 'ketua_takmir' || m.role === 'bendahara') && m.mosques.status === 'active');
  if (act.length) {
    const mid = act[0].mosques.id;
    const isKetua = act.some(m => m.mosques.id === mid && m.role === 'ketua_takmir');
    const isBend = act.some(m => m.mosques.id === mid && m.role === 'bendahara');
    const mosque = await getMosque(mid);
    if (mosque) {
      const home = () => renderMember(box, memberships);
      const openKas = () => renderKasManager(box, mosque, { onBack: home, roles: { write: isBend, setup: isBend, approve: isKetua } });
      box.replaceChildren(h('h2', {}, mosque.name), h('p', { class: 'muted' }, 'Dashboard ' + (isKetua ? 'Ketua Takmir' : 'Bendahara')),
        h('div', { class: 'actions' },
          isKetua ? h('button', { class: 'act primary', type: 'button', id: 'open-posts', onclick: () => renderPostsManager(box, mosque, home) }, icon(ICONS.agenda), h('span', {}, 'Agenda & pengumuman')) : '',
          h('button', { class: 'act' + (isKetua ? '' : ' primary'), type: 'button', id: 'open-kas', onclick: openKas }, icon(ICONS.market), h('span', {}, 'Kas masjid'))));
      return;
    }
  }
  box.replaceChildren(
    h('h2', {}, 'Selamat datang'),
    rows.length
      ? h('div', { class: 'panel' }, h('h3', {}, 'Keanggotaan Anda'),
          rows.map(m => h('div', { class: 'mrow' },
            h('div', { class: 'minfo' }, h('strong', {}, m.mosques.name), h('div', { class: 'muted' }, ROLE_LABEL[m.role] || m.role)),
            h('span', { class: 'badge b-' + m.mosques.status }, STATUS_LABEL[m.mosques.status] || m.mosques.status))))
      : h('div', { class: 'panel' }, h('p', {}, 'Akun Anda belum ditugaskan ke masjid mana pun. Hubungi admin pusat untuk mendapatkan undangan.')),
    h('h3', { class: 'mt' }, 'Kegiatan masjid terbaru'),
    feedPanel({ limit: 10, onOpen: m => openMosque(m, 'app', () => renderMember(box, memberships)) }),
    h('p', { class: 'muted' }, 'Dashboard sesuai peran dibangun di tahap berikutnya.'));
}
