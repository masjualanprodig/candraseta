// BAITUNA - dashboard-member.js (v72)
// Beranda Jamaah Umum (Design System v1.2). Pengurus (Ketua Takmir / Bendahara) mendapat tambahan bagian "Kelola Masjid".
// Admin Masjid dari masjid aktif memakai dashboard pengelolaan (dashboard-mosque.js).
import { h, STATUS_LABEL } from './ui.js';
import { ROLE_LABEL } from './permissions.js';
import { renderMosque } from './dashboard-mosque.js';
import { getMosque } from './mosque-service.js';
import { renderPostsManager } from './posts-ui.js';
import { renderKasManager } from './kas-ui.js';
import { ICONS } from './feed-ui.js';
import { greetingHeader, bannerCarousel, promoBanner, prayerCard, quickGrid, articleSection, whoAmI, go, registerActs } from './home-ui.js';

export async function renderMember(box, memberships) {
  registerActs({});
  const rows = memberships.filter(m => m.mosques);
  const mine = rows.find(m => m.role === 'admin_masjid' && m.mosques.status === 'active');
  if (mine) { await renderMosque(box, mine.mosques.id); return; }

  const who = await whoAmI();
  const act = rows.filter(m => (m.role === 'ketua_takmir' || m.role === 'bendahara') && m.mosques.status === 'active');
  let manage = null, mosque = null;
  if (act.length) {
    const mid = act[0].mosques.id;
    const isKetua = act.some(m => m.mosques.id === mid && m.role === 'ketua_takmir');
    const isBend = act.some(m => m.mosques.id === mid && m.role === 'bendahara');
    mosque = await getMosque(mid);
    if (mosque) manage = { isKetua, isBend };
  }
  const home = () => renderMember(box, memberships);
  const articles = await articleSection(2);
  const body = [
    bannerCarousel([
      { art: 'banner_sejarah', kicker: 'Sejarah Islam', title: 'Bersama BAITUNA', text: 'Jelajahi kisah, pelajaran, dan nilai-nilai yang menginspirasi kehidupan sehari-hari.', cta: 'Pelajari Sekarang', onclick: () => go('sejarah') },
      { art: 'banner_belajar', title: 'Belajar Qur’an', text: 'Materi belajar membaca Al-Qur’an, dari dasar sampai lancar.', cta: 'Mulai Belajar', onclick: () => go('belajar'), tone: 'gold' },
      { art: 'banner_sunnah', title: 'Amalan Sunnah Harian', text: 'Pengingat amalan sunnah untuk dibiasakan setiap hari.', cta: 'Lihat Amalan', onclick: () => go('sunnah') }]),
    promoBanner({ id: 'pk', art: 'promo_buku', title: 'Pustaka Buku', text: 'Koleksi buku Islami digital untuk menambah ilmu dan wawasan.', cta: 'Jelajahi Buku', onclick: () => go('buku') }),
    promoBanner({ id: 'pb', art: 'promo_pasar', title: 'Pasar Umat', text: 'Dukung produk dan jasa umat yang sudah diperiksa pengelola.', cta: 'Lihat Produk', onclick: () => go('market') }),
    prayerCard(),
    quickGrid('Akses Cepat', [
      { key: 'open-quran', id: 'qa-quran', onclick: () => go('quran') },
      { key: 'open-jadwal', id: 'qa-jadwal', onclick: () => go('jadwal') },
      { key: 'open-nearby', id: 'qa-nearby', onclick: () => go('dir') },
      { key: 'open-doa', id: 'qa-doa', onclick: () => go('doa') },
      { key: 'open-zakat', id: 'qa-zakat', onclick: () => go('zakat') },
      { key: 'open-agenda', id: 'qa-agenda', onclick: () => go('info') },
      { key: 'open-market', id: 'qa-market', onclick: () => go('market') },
      { key: 'open-more', id: 'qa-more', onclick: () => go('more') }], { onAll: () => go('more') })];
  if (manage) {
    const openKas = () => renderKasManager(box, mosque, { onBack: home, roles: { write: manage.isBend, setup: manage.isBend, approve: manage.isKetua } });
    const items = [];
    if (manage.isKetua) items.push({ key: 'open-agenda', id: 'open-posts', label: 'Agenda', onclick: () => renderPostsManager(box, mosque, home) });
    items.push({ key: 'open-keuangan', id: 'open-kas', label: 'Kas Masjid', onclick: openKas });
    body.splice(3, 0, quickGrid('Kelola ' + mosque.name, items, { id: 'qm' }));
  } else if (rows.length) {
    body.push(h('div', { class: 'panel', id: 'jm-member' }, h('h3', {}, 'Keanggotaan Anda'),
      rows.map(m => h('div', { class: 'mrow' }, h('div', { class: 'minfo' }, h('strong', {}, m.mosques.name), h('div', { class: 'muted' }, ROLE_LABEL[m.role] || m.role)),
        h('span', { class: 'badge b-' + m.mosques.status }, STATUS_LABEL[m.mosques.status] || m.mosques.status)))));
  }
  if (articles) body.push(articles);
  box.replaceChildren(h('div', { class: 'home', id: 'home-jamaah' },
    greetingHeader({ title: 'Jamaahku', sub: manage ? (manage.isKetua ? 'Ketua Takmir' : 'Bendahara') + ' · ' + mosque.name : 'Mari perkuat iman, manfaatkan fitur BAITUNA untuk kehidupan Islami yang lebih baik.',
      name: who.name, email: who.email, avatar: false }),
    h('div', { class: 'home-body' }, ...body)));
  window.scrollTo(0, 0);
}
