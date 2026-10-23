// BAITUNA - dashboard-admin.js
// Dashboard Super Admin: ringkasan, tambah masjid, dan verifikasi/penonaktifan masjid.
// Keamanan sebenarnya dijaga RLS; tombol di sini hanya kenyamanan tampilan.
import { h, toast, ask, hint, STATUS_LABEL } from './ui.js';
import { listMosques, updateMosqueStatus, deleteMosque, listInvitations, fetchTeam } from './mosque-service.js';
import { INVITE_ROLES } from './permissions.js';
import { teamPanel } from './team-panel.js';
import { getSession, storageRemove, mosqueCover } from './supabase.js';
import { renderWorldManager } from './world-ui.js';
import { renderHistoryManager } from './history-ui.js';
import { renderRukunManager } from './rukun-ui.js';
import { renderArticleManager } from './articles-ui.js';
import { renderDhikrManager } from './dzikir-ui.js';
import { renderDuaManager } from './doa-ui.js';
import { renderSunnahManager } from './sunnah-ui.js';
import { renderAsmaManager } from './asma-admin-ui.js';
import { renderMarketManager } from './market-admin-ui.js';
import { renderBelajarManager } from './belajar-ui.js';
import { icon, ICONS } from './feed-ui.js';
import { renderKasManager } from './kas-ui.js';
import { renderAuditLog } from './audit-ui.js';
import { renderBrandingEditor } from './branding-ui.js';
import { renderUserManager } from './pengguna-ui.js';
import { userStats } from './pengguna-service.js';
import { renderMosqueReview } from './mosque-review-ui.js';
import { homeBody } from './home-builder.js';
import { renderHomeBuilder } from './home-builder-ui.js';
import { statGroupHead, userStatsBlock, greetingHeader, bannerCarousel, promoBanner, tasbihCard, prayerCard, quickGrid, summaryCard, articleSection, sectionHead, whoAmI, go, registerActs, scrollToEl } from './home-ui.js';

const ACTIONS = {
  approve: { title: 'Aktifkan masjid?', text: 'Masjid akan tampil sebagai masjid terverifikasi. Pastikan identitasnya sudah diperiksa.', reason: false, to: 'active', done: 'Masjid diaktifkan.' },
  reject: { title: 'Tolak pendaftaran?', text: 'Tulis alasan penolakan. Alasan ini tercatat.', reason: true, to: 'rejected', done: 'Pendaftaran ditolak.' },
  suspend: { title: 'Nonaktifkan masjid?', text: 'Akses operasional dihentikan. Data tetap tersimpan. Tulis alasannya.', reason: true, to: 'suspended', done: 'Masjid dinonaktifkan.' },
  reopen: { title: 'Aktifkan kembali?', text: 'Masjid akan aktif kembali.', reason: false, to: 'active', done: 'Masjid diaktifkan kembali.' },
  del: { title: 'Hapus masjid permanen?', text: 'Masjid beserta pengurus, agenda, undangan, dan postingannya akan dihapus selamanya dan tidak bisa dikembalikan. Masjid yang sudah punya catatan keuangan tidak bisa dihapus. Lanjutkan?', reason: false, del: true, done: 'Masjid dihapus.' },
  retry: { title: 'Kembalikan ke verifikasi?', text: 'Pendaftaran kembali berstatus menunggu verifikasi.', reason: false, to: 'pending', done: 'Dikembalikan ke menunggu verifikasi.' }
};
const BUTTONS = {
  draft: [['Setujui', 'approve'], ['Tolak', 'reject', 1]],
  pending: [['Setujui', 'approve'], ['Tolak', 'reject', 1]],
  active: [['Nonaktifkan', 'suspend', 1]],
  suspended: [['Aktifkan kembali', 'reopen'], ['Hapus', 'del', 1]],
  rejected: [['Kembalikan ke verifikasi', 'retry'], ['Hapus', 'del', 1]]
};

const mpState = { g: 'all', q: '', prov: '', open: false };
const openPanels = new Set(); // masjid yang panel pengurusnya sedang dibuka

async function changeStatus(m, cfg, box) {
  const answer = await ask(cfg);
  if (!answer) return;
  try {
    if (cfg.del) {
      const photo = await deleteMosque(m.id);
      if (photo) storageRemove(photo).catch(() => {});
    } else await updateMosqueStatus(m.id, cfg.to, cfg.reason ? answer : null);
    toast(cfg.done);
    await renderAdmin(box, 'masjid');
  } catch (e) {
    if (e.status === 401) return;
    toast(e && e.code === '22023' && e.message ? e.message.charAt(0).toUpperCase() + e.message.slice(1) + '.' : 'Perubahan gagal disimpan. ' + hint(e), true);
  }
}

export async function renderAdmin(box, view = 'home') {
  const [rawList, invites] = await Promise.all([listMosques(), listInvitations().catch(e => { if (e.status === 401) throw e; return null; })]);
  // Yang menunggu verifikasi tampil paling atas.
  const rank = m => (m.status === 'pending' ? 0 : m.status === 'draft' ? 1 : 2);
  const list = rawList.map((m, i) => [m, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(x => x[0]);
  const openList = list.filter(m => m.status === 'active' && invites && openPanels.has(m.id));
  const teams = {};
  await Promise.all(openList.map(async m => { try { teams[m.id] = await fetchTeam(m.id); } catch (e) { if (e.status === 401) throw e; teams[m.id] = []; } }));
  const me = getSession() && getSession().user;
  const count = s => list.filter(m => m.status === s).length;

  const openReview = id => renderMosqueReview(box, id, {
    list, onBack: () => renderAdmin(box, 'masjid'),
    buttons: (() => { const m0 = list.find(x => x.id === id); return m0 ? BUTTONS[m0.status] || [] : []; })(),
    onAction: (m, key) => changeStatus(m, ACTIONS[key], box)
  });
  const GROUP = { all: () => true, active: m => m.status === 'active', pending: m => m.status === 'pending' || m.status === 'draft', off: m => m.status === 'rejected' || m.status === 'suspended' };
  const fmtDate = d => { try { return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };
  const mrow = m => {
    const cover = mosqueCover(m), where = [m.city, m.province].filter(Boolean).join(', ') || 'Lokasi belum diisi';
    const acts = [...(BUTTONS[m.status] || []).map(([label, key, alt]) => h('button', { class: 'mk-mi' + (alt ? ' alt' : ''), type: 'button', onclick: () => changeStatus(m, ACTIONS[key], box) }, label)),
      m.status === 'active' ? h('button', { class: 'mk-mi adm-kas', type: 'button', onclick: () => renderKasManager(box, m, { onBack: () => renderAdmin(box, 'masjid'), roles: { admin: true, approve: true } }) }, 'Kas') : '',
      m.status === 'active' && invites ? h('button', { class: 'mk-mi', type: 'button', onclick: () => { openPanels.has(m.id) ? openPanels.delete(m.id) : openPanels.add(m.id); renderAdmin(box, 'masjid'); } }, openPanels.has(m.id) ? 'Tutup pengurus' : 'Pengurus') : ''];
    return h('div', { class: 'mrow mk-card', 'data-st': m.status },
      h('div', { class: 'mk-main' },
        cover ? h('img', { class: 'mk-img', src: cover, alt: '', loading: 'lazy' }) : h('span', { class: 'mk-img mk-ph' }, icon(ICONS.mosque)),
        h('div', { class: 'mk-txt' },
          h('strong', {}, m.name),
          h('span', { class: 'mk-where' }, icon(ICONS.pin), where),
          h('span', { class: 'badge b-' + m.status }, STATUS_LABEL[m.status] || m.status),
          m.created_at ? h('span', { class: 'mk-date' }, icon(ICONS.agenda), 'Terdaftar ' + fmtDate(m.created_at)) : '',
          m.status_reason ? h('span', { class: 'mk-date' }, 'Alasan: ' + m.status_reason) : '')),
      h('div', { class: 'mk-acts' },
        h('button', { class: 'mk-detail', type: 'button', 'data-act': 'check', 'aria-label': 'Lihat detail ' + m.name, onclick: () => openReview(m.id) }, icon(ICONS.eye), 'Lihat Detail'),
        acts.filter(Boolean).length ? h('details', { class: 'mk-menu' }, h('summary', { 'aria-label': 'Aksi lainnya untuk ' + m.name }, icon(ICONS.more)), h('div', { class: 'mk-pop' }, ...acts.filter(Boolean))) : ''),
      m.status === 'active' && invites && openPanels.has(m.id) ? teamPanel({ mosqueId: m.id, team: teams[m.id] || [], invites: invites.filter(i => i.mosque_id === m.id), roles: INVITE_ROLES, canRevokeAdmin: true, selfId: me && me.id, onChange: () => renderAdmin(box, 'masjid') }) : '');
  };
  const rows = list.map(mrow);

  const who = await whoAmI();
  const openAudit = () => renderAuditLog(box, { onBack: () => renderAdmin(box), mosques: list.map(m => ({ id: m.id, name: m.name })) });
  const openMarket = () => renderMarketManager(box, () => renderAdmin(box));
  const openBrand = () => renderBrandingEditor(box, () => renderAdmin(box));
  const openUsers = () => renderUserManager(box, { onBack: () => renderAdmin(box), mosques: list });
  const openKonten = () => box.replaceChildren(h('section', { class: 'konten', id: 'konten' },
    h('button', { class: 'btn-sm ghost', id: 'konten-back', type: 'button', onclick: () => renderAdmin(box) }, '← Kembali'), h('h2', {}, 'Editor'),
    h('div', { class: 'actions' },
      h('button', { class: 'act', id: 'act-beranda', type: 'button', onclick: () => renderHomeBuilder(box, () => openKonten()) }, icon(ICONS.gear), h('span', {}, 'Tampilan Beranda (Builder)')),
      h('button', { class: 'act', id: 'act-pengguna', type: 'button', onclick: () => renderUserManager(box, { onBack: () => openKonten(), mosques: list }) }, icon(ICONS.users), h('span', {}, 'Pengguna')),
      h('button', { class: 'act', type: 'button', onclick: () => renderWorldManager(box, () => openKonten()) }, icon(ICONS.globe), h('span', {}, 'Galeri masjid dunia')),
      h('button', { class: 'act', type: 'button', onclick: () => renderHistoryManager(box, () => openKonten()) }, icon(ICONS.book), h('span', {}, 'Sejarah Islam')),
      h('button', { class: 'act', type: 'button', onclick: () => renderRukunManager(box, () => openKonten()) }, icon(ICONS.book), h('span', {}, 'Rukun Islam & Iman')),
      h('button', { class: 'act', type: 'button', onclick: () => renderArticleManager(box, () => openKonten()) }, icon(ICONS.news), h('span', {}, 'Berita & Artikel Islam')),
      h('button', { class: 'act', type: 'button', onclick: () => renderDhikrManager(box, () => openKonten()) }, icon(ICONS.dzikir), h('span', {}, 'Dzikir Pagi & Petang')),
      h('button', { class: 'act', type: 'button', onclick: () => renderDuaManager(box, () => openKonten()) }, icon(ICONS.doa), h('span', {}, 'Doa Shahih')),
      h('button', { class: 'act', type: 'button', onclick: () => renderSunnahManager(box, () => openKonten()) }, icon(ICONS.sunnah), h('span', {}, 'Amalan Sunnah Harian')),
      h('button', { class: 'act', type: 'button', onclick: () => renderBelajarManager(box, () => openKonten()) }, icon(ICONS.belajar), h('span', {}, 'Materi Belajar Qur’an')),
      h('button', { class: 'act', type: 'button', onclick: () => renderAsmaManager(box, () => openKonten()) }, icon(ICONS.asma), h('span', {}, 'Penjelasan & Audio Asmaul Husna')),
      h('button', { class: 'act', id: 'act-notif', type: 'button', onclick: () => go('notif') }, icon(ICONS.bell), h('span', {}, 'Notifikasi')),
      h('button', { class: 'act', id: 'act-adzan', type: 'button', onclick: () => go('adzan') }, icon(ICONS.bell), h('span', {}, 'Audio Adzan (unggah & kelola)')))));
  const listAnchor = h('div', { id: 'mosque-list' });
  const openMasjid = () => renderAdmin(box, 'masjid');
  registerActs({ audit: openAudit, masjid: openMasjid });
  const badge = n => n ? h('em', { class: 'qk-badge', 'aria-label': n + ' menunggu' }, String(n)) : '';
  const waiting = count('pending');
  const ustats = await userStats().catch(() => null); // null bila SQL pengguna_statistik.sql belum dijalankan
  const grid = quickGrid('Manajemen Platform', [
    { key: 'open-datamasjid', id: 'qa-masjid', onclick: openMasjid },
    { key: 'open-konten', id: 'qa-konten', onclick: openKonten },
    { key: 'open-market', id: 'adm-market', label: 'Verifikasi Pasar', onclick: openMarket },
    { key: 'open-audit', id: 'adm-audit', onclick: openAudit },
    { key: 'open-tampilan', id: 'adm-tampilan', onclick: openBrand },
    { key: 'open-notif', id: 'adm-notif', onclick: () => go('notif') },
    { key: 'open-pengguna', id: 'adm-pengguna', onclick: openUsers },
    { key: 'open-more', id: 'qa-more', onclick: () => go('more') }]);
  if (waiting) { const t = grid.querySelector('#qa-masjid .qk-ic'); if (t) t.append(badge(waiting)); }
  if (view === 'masjid') {
    const prov = [...new Set(list.map(m => m.province).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
    const f = mpState; if (f.prov && !prov.includes(f.prov)) f.prov = '';
    const cnt = k => list.filter(GROUP[k]).length;
    const tile = (ic, tone, value, label, sub, id) => h('div', { class: 'mt-i ' + tone, id }, h('span', { class: 'mt-ic' }, icon(ic)), h('div', { class: 'mt-tx' }, h('b', {}, String(value)), h('strong', {}, label), h('small', {}, sub)));
    const listBox = h('div', { id: 'mp-rows' }), shown = h('span', { class: 'muted', id: 'mp-shown' });
    const chipBar = h('div', { class: 'mp-chips', role: 'tablist' });
    const apply = () => {
      const q = f.q.trim().toLowerCase();
      const vis = list.map((m, i) => [m, rows[i]]).filter(([m]) => GROUP[f.g](m) && (!f.prov || m.province === f.prov) && (!q || [m.name, m.city, m.province].filter(Boolean).join(' ').toLowerCase().includes(q)));
      listBox.replaceChildren(...(vis.length ? vis.map(x => x[1]) : [h('p', { class: 'muted mp-empty' }, list.length ? 'Tidak ada masjid yang cocok dengan pencarian atau saringan.' : 'Belum ada masjid. Masjid baru muncul di sini setelah didaftarkan Admin Masjid.')]));
      shown.textContent = vis.length + ' masjid ditampilkan';
      chipBar.replaceChildren(...[['all', 'Semua'], ['active', 'Aktif'], ['pending', 'Menunggu'], ['off', 'Nonaktif']].map(([k, l]) =>
        h('button', { class: 'mp-chip' + (f.g === k ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': String(f.g === k), 'data-g': k, onclick: () => { f.g = k; apply(); } }, l, h('i', {}, String(cnt(k))))));
    };
    const search = h('input', { class: 'in', id: 'mp-q', type: 'search', placeholder: 'Cari nama masjid atau wilayah…', 'aria-label': 'Cari masjid', value: f.q, oninput: e => { f.q = e.target.value; apply(); } });
    const provSel = h('select', { class: 'in', id: 'mp-prov', 'aria-label': 'Provinsi', onchange: e => { f.prov = e.target.value; apply(); } }, h('option', { value: '' }, 'Semua provinsi'), ...prov.map(x => h('option', { value: x }, x)));
    provSel.value = f.prov;
    const filterPanel = h('div', { class: 'mp-fp', id: 'mp-fp', hidden: !f.open }, h('label', { class: 'hint', for: 'mp-prov' }, 'Provinsi'), provSel);
    if (!f.open) filterPanel.setAttribute('hidden', '');
    const filterBtn = h('button', { class: 'mp-filter', id: 'mp-filter', type: 'button', 'aria-expanded': String(!!f.open), onclick: () => { f.open = !f.open; filterPanel.toggleAttribute('hidden', !f.open); filterBtn.setAttribute('aria-expanded', String(!!f.open)); } }, icon(ICONS.filter), 'Filter');
    box.replaceChildren(h('div', { class: 'home', id: 'masjid-page' },
      h('div', { class: 'home-body mp-body' },
        h('button', { class: 'mp-back', id: 'masjid-back', type: 'button', onclick: () => renderAdmin(box) }, icon(ICONS.chev, 'mp-bk'), 'Kembali'),
        h('div', { class: 'mp-hero' }, h('div', {}, h('h2', {}, 'Data Masjid'), h('p', { class: 'muted' }, 'Kelola dan verifikasi masjid di BAITUNA.')), h('img', { class: 'mp-art', src: 'art-masjid-list.svg', alt: '' })),
        h('div', { class: 'mt-grid', id: 'mp-tiles' },
          tile(ICONS.mosque, 'g', list.length, 'Masjid Terdaftar', 'Semua masjid di aplikasi', 'mt-all'),
          tile(ICONS.shield, 'g', count('active'), 'Masjid Aktif', 'Masjid yang sudah disetujui', 'mt-act'),
          tile(ICONS.clock, 'y', count('pending') + count('draft'), 'Menunggu Verifikasi', 'Perlu pemeriksaan', 'mt-pen'),
          tile(ICONS.mosqueoff, 'r', count('rejected') + count('suspended'), 'Nonaktif', 'Ditolak atau dinonaktifkan', 'mt-off')),
        h('div', { class: 'mp-tools' }, h('div', { class: 'mp-search' }, icon(ICONS.search), search), filterBtn),
        filterPanel,
        listAnchor,
        h('div', { class: 'panel mp-list' },
          h('div', { class: 'mp-lh' }, h('h3', {}, 'Daftar Masjid'), shown), chipBar, listBox),
        invites ? '' : h('p', { class: 'muted' }, 'Fitur undangan pengurus belum aktif: jalankan invitations.sql di Supabase SQL Editor.'))));
    apply();
    window.scrollTo(0, 0);
    return;
  }
  const B = {
    banner: bannerCarousel([
      { art: 'banner_masjid', title: 'Satu Platform, Banyak Masjid', text: 'Kelola dan pantau masjid bersama BAITUNA.', cta: 'Kelola Masjid', onclick: openMasjid },
      { art: 'banner_kas', title: 'Verifikasi Masjid', text: waiting ? waiting + ' masjid menunggu verifikasi Anda.' : 'Tidak ada masjid yang menunggu verifikasi.', cta: 'Buka Daftar Masjid', onclick: openMasjid, tone: 'gold' }]),
    buku: promoBanner({ id: 'pk', art: 'promo_buku', title: 'Pustaka Buku', text: 'Kelola koleksi buku Islami umat.', cta: 'Kelola Buku', onclick: () => go('buku') }),
    pasar: promoBanner({ id: 'pb', art: 'promo_pasar', title: 'Pasar Umat', text: 'Periksa produk dan jasa sebelum tampil.', cta: 'Verifikasi', onclick: openMarket }),
    tasbih: tasbihCard(),
    jadwal: prayerCard(),
    artikel: await articleSection(5) || '',
    mgmt: grid,
    stats: summaryCard({ id: 'sgw', title: 'Statistik Platform', onAll: openMasjid, allLabel: 'Lihat Detail', head: statGroupHead(ICONS.mosque, 'Data Masjid', 'Statistik masjid yang terdaftar di aplikasi.'), after: userStatsBlock(ustats, openUsers), items: [
        { ic: ICONS.mosque, value: list.length, label: 'Masjid Terdaftar', tone: 'mg' }, { ic: ICONS.shield, value: count('active'), label: 'Masjid Aktif', tone: 'mg' },
        { ic: ICONS.clock, value: count('pending'), label: 'Menunggu Verifikasi', tone: 'mo' }, { ic: ICONS.mosqueoff, value: count('rejected') + count('suspended'), label: 'Ditolak / Nonaktif', tone: 'mr' }] }) };
  const body = await homeBody('super', B);
  box.replaceChildren(h('div', { class: 'home', id: 'home-super' },
    greetingHeader({ title: who.name || 'Super Admin', sub: 'Mari perkuat iman, manfaatkan fitur BAITUNA untuk kehidupan Islami yang lebih baik.', place: { name: 'Super Admin BAITUNA', ic: ICONS.shield }, name: who.name, email: who.email, avatar: who.avatar || undefined }),
    h('div', { class: 'home-body' }, ...body)));
}
