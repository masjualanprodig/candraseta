// BAITUNA - dashboard-member.js
// Tampilan sementara untuk pengguna non-Super Admin (dashboard per peran dibangun di tahap berikutnya).
import { h, STATUS_LABEL } from './ui.js';
import { ROLE_LABEL } from './permissions.js';
import { renderMosque } from './dashboard-mosque.js';
import { getMosque } from './mosque-service.js';
import { renderPostsManager } from './posts-ui.js';

export async function renderMember(box, memberships) {
  const rows = memberships.filter(m => m.mosques);
  // Admin Masjid dari masjid aktif: tampilkan dashboard pengelolaan (satu masjid; jika lebih, yang pertama).
  const mine = rows.find(m => m.role === 'admin_masjid' && m.mosques.status === 'active');
  if (mine) { await renderMosque(box, mine.mosques.id); return; }
  // Ketua Takmir dari masjid aktif: kelola agenda & pengumuman.
  const ketua = rows.find(m => m.role === 'ketua_takmir' && m.mosques.status === 'active');
  if (ketua) {
    const mosque = await getMosque(ketua.mosques.id);
    if (mosque) { await renderPostsManager(box, mosque); return; }
  }
  box.replaceChildren(
    h('h2', {}, 'Selamat datang'),
    rows.length
      ? h('div', { class: 'panel' }, h('h3', {}, 'Keanggotaan Anda'),
          rows.map(m => h('div', { class: 'mrow' },
            h('div', { class: 'minfo' }, h('strong', {}, m.mosques.name), h('div', { class: 'muted' }, ROLE_LABEL[m.role] || m.role)),
            h('span', { class: 'badge b-' + m.mosques.status }, STATUS_LABEL[m.mosques.status] || m.mosques.status))))
      : h('div', { class: 'panel' }, h('p', {}, 'Akun Anda belum ditugaskan ke masjid mana pun. Hubungi admin pusat untuk mendapatkan undangan.')),
    h('p', { class: 'muted' }, 'Dashboard sesuai peran dibangun di tahap berikutnya.'));
}
