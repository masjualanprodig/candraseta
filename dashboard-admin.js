// BAITUNA - dashboard-admin.js
// Dashboard Super Admin: ringkasan, tambah masjid, dan verifikasi/penonaktifan masjid.
// Keamanan sebenarnya dijaga RLS; tombol di sini hanya kenyamanan tampilan.
import { h, toast, ask, hint, STATUS_LABEL } from './ui.js';
import { listMosques, updateMosqueStatus, listInvitations, fetchTeam } from './mosque-service.js';
import { INVITE_ROLES } from './permissions.js';
import { teamPanel } from './team-panel.js';
import { getSession } from './supabase.js';
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
import { homeBody } from './home-builder.js';
import { renderHomeBuilder } from './home-builder-ui.js';
import { greetingHeader, bannerCarousel, promoBanner, tasbihCard, prayerCard, quickGrid, summaryCard, sectionHead, whoAmI, go, registerActs, scrollToEl } from './home-ui.js';

const ACTIONS = {
  approve: { title: 'Aktifkan masjid?', text: 'Masjid akan tampil sebagai masjid terverifikasi. Pastikan identitasnya sudah diperiksa.', reason: false, to: 'active', done: 'Masjid diaktifkan.' },
  reject: { title: 'Tolak pendaftaran?', text: 'Tulis alasan penolakan. Alasan ini tercatat.', reason: true, to: 'rejected', done: 'Pendaftaran ditolak.' },
  suspend: { title: 'Nonaktifkan masjid?', text: 'Akses operasional dihentikan. Data tetap tersimpan. Tulis alasannya.', reason: true, to: 'suspended', done: 'Masjid dinonaktifkan.' },
  reopen: { title: 'Aktifkan kembali?', text: 'Masjid akan aktif kembali.', reason: false, to: 'active', done: 'Masjid diaktifkan kembali.' },
  retry: { title: 'Kembalikan ke verifikasi?', text: 'Pendaftaran kembali berstatus menunggu verifikasi.', reason: false, to: 'pending', done: 'Dikembalikan ke menunggu verifikasi.' }
};
const BUTTONS = {
  draft: [['Setujui', 'approve'], ['Tolak', 'reject', 1]],
  pending: [['Setujui', 'approve'], ['Tolak', 'reject', 1]],
  active: [['Nonaktifkan', 'suspend', 1]],
  suspended: [['Aktifkan kembali', 'reopen']],
  rejected: [['Kembalikan ke verifikasi', 'retry']]
};

const openPanels = new Set(); // masjid yang panel pengurusnya sedang dibuka

async function changeStatus(m, cfg, box) {
  const answer = await ask(cfg);
  if (!answer) return;
  try {
    await updateMosqueStatus(m.id, cfg.to, cfg.reason ? answer : null);
    toast(cfg.done);
    await renderAdmin(box, 'masjid');
  } catch (e) {
    if (e.status === 401) return;
    toast('Perubahan gagal disimpan. ' + hint(e), true);
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

  const rows = list.map(m => h('div', { class: 'mrow' },
    h('div', { class: 'minfo' },
      h('strong', {}, m.name),
      h('div', { class: 'muted' }, [m.city, m.province].filter(Boolean).join(', ') || 'Lokasi belum diisi'),
      m.status_reason ? h('div', { class: 'muted' }, 'Alasan: ' + m.status_reason) : ''),
    h('div', { class: 'macts' },
      h('span', { class: 'badge b-' + m.status }, STATUS_LABEL[m.status] || m.status),
      (BUTTONS[m.status] || []).map(([label, key, alt]) =>
        h('button', { class: 'btn-sm' + (alt ? ' alt' : ''), onclick: () => changeStatus(m, ACTIONS[key], box) }, label)),
      m.status === 'active' ? h('button', { class: 'btn-sm ghost adm-kas', type: 'button', onclick: () => renderKasManager(box, m, { onBack: () => renderAdmin(box, 'masjid'), roles: { admin: true, approve: true } }) }, 'Kas') : '',
      m.status === 'active' && invites ? h('button', {
        class: 'btn-sm ghost',
        onclick: () => { openPanels.has(m.id) ? openPanels.delete(m.id) : openPanels.add(m.id); renderAdmin(box, 'masjid'); }
      }, openPanels.has(m.id) ? 'Tutup pengurus' : 'Pengurus') : ''),
    m.status === 'active' && invites && openPanels.has(m.id) ? teamPanel({ mosqueId: m.id, team: teams[m.id] || [], invites: invites.filter(i => i.mosque_id === m.id), roles: INVITE_ROLES, canRevokeAdmin: true, selfId: me && me.id, onChange: () => renderAdmin(box, 'masjid') }) : ''));

  const who = await whoAmI();
  const openAudit = () => renderAuditLog(box, { onBack: () => renderAdmin(box), mosques: list.map(m => ({ id: m.id, name: m.name })) });
  const openMarket = () => renderMarketManager(box, () => renderAdmin(box));
  const openBrand = () => renderBrandingEditor(box, () => renderAdmin(box));
  const openKonten = () => box.replaceChildren(h('section', { class: 'konten', id: 'konten' },
    h('button', { class: 'btn-sm ghost', id: 'konten-back', type: 'button', onclick: () => renderAdmin(box) }, '← Kembali'), h('h2', {}, 'Editor'),
    h('div', { class: 'actions' },
      h('button', { class: 'act', id: 'act-beranda', type: 'button', onclick: () => renderHomeBuilder(box, () => openKonten()) }, icon(ICONS.gear), h('span', {}, 'Tampilan Beranda (Builder)')),
      h('button', { class: 'act', type: 'button', onclick: () => renderWorldManager(box, () => openKonten()) }, icon(ICONS.globe), h('span', {}, 'Galeri masjid dunia')),
      h('button', { class: 'act', type: 'button', onclick: () => renderHistoryManager(box, () => openKonten()) }, icon(ICONS.book), h('span', {}, 'Sejarah Islam')),
      h('button', { class: 'act', type: 'button', onclick: () => renderRukunManager(box, () => openKonten()) }, icon(ICONS.book), h('span', {}, 'Rukun Islam & Iman')),
      h('button', { class: 'act', type: 'button', onclick: () => renderArticleManager(box, () => openKonten()) }, icon(ICONS.news), h('span', {}, 'Berita & Artikel Islam')),
      h('button', { class: 'act', type: 'button', onclick: () => renderDhikrManager(box, () => openKonten()) }, icon(ICONS.dzikir), h('span', {}, 'Dzikir Pagi & Petang')),
      h('button', { class: 'act', type: 'button', onclick: () => renderDuaManager(box, () => openKonten()) }, icon(ICONS.doa), h('span', {}, 'Doa Shahih')),
      h('button', { class: 'act', type: 'button', onclick: () => renderSunnahManager(box, () => openKonten()) }, icon(ICONS.sunnah), h('span', {}, 'Amalan Sunnah Harian')),
      h('button', { class: 'act', type: 'button', onclick: () => renderBelajarManager(box, () => openKonten()) }, icon(ICONS.belajar), h('span', {}, 'Materi Belajar Qur’an')),
      h('button', { class: 'act', type: 'button', onclick: () => renderAsmaManager(box, () => openKonten()) }, icon(ICONS.asma), h('span', {}, 'Penjelasan & Audio Asmaul Husna')))));
  const listAnchor = h('div', { id: 'mosque-list' });
  const openMasjid = () => renderAdmin(box, 'masjid');
  registerActs({ audit: openAudit, masjid: openMasjid });
  const badge = n => n ? h('em', { class: 'qk-badge', 'aria-label': n + ' menunggu' }, String(n)) : '';
  const waiting = count('pending');
  const grid = quickGrid('Manajemen Platform', [
    { key: 'open-datamasjid', id: 'qa-masjid', onclick: openMasjid },
    { key: 'open-konten', id: 'qa-konten', onclick: openKonten },
    { key: 'open-market', id: 'adm-market', label: 'Verifikasi Pasar', onclick: openMarket },
    { key: 'open-audit', id: 'adm-audit', onclick: openAudit },
    { key: 'open-tampilan', id: 'adm-tampilan', onclick: openBrand },
    { key: 'open-notif', id: 'adm-notif', onclick: () => go('notif') },
    { key: 'open-more', id: 'qa-more', onclick: () => go('more') }]);
  if (waiting) { const t = grid.querySelector('#qa-masjid .qk-ic'); if (t) t.append(badge(waiting)); }
  if (view === 'masjid') {
    box.replaceChildren(h('div', { class: 'home', id: 'masjid-page' },
      h('div', { class: 'home-body mp-body' },
        h('div', { class: 'mp-head' }, h('button', { class: 'btn-sm ghost', id: 'masjid-back', type: 'button', onclick: () => renderAdmin(box) }, '← Beranda'), h('h2', {}, 'Masjid')),
        h('p', { class: 'muted' }, 'Masjid baru didaftarkan oleh Admin Masjid. Periksa datanya, lalu setujui atau tolak di sini.'),
        listAnchor,
        h('div', { class: 'panel' },
          h('h3', {}, 'Daftar masjid (' + list.length + ')'),
          rows.length ? rows : h('p', { class: 'muted' }, 'Belum ada masjid. Masjid baru muncul di sini setelah didaftarkan Admin Masjid.')),
        invites ? '' : h('p', { class: 'muted' }, 'Fitur undangan pengurus belum aktif: jalankan invitations.sql di Supabase SQL Editor.'))));
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
    mgmt: grid,
    stats: summaryCard({ id: 'sgw', title: 'Statistik Platform', onAll: openMasjid, allLabel: 'Lihat Detail', items: [
        { ic: ICONS.mosque, value: list.length, label: 'Masjid Terdaftar' }, { ic: ICONS.shield, value: count('active'), label: 'Masjid Aktif' },
        { ic: ICONS.clock, value: count('pending'), label: 'Menunggu Verifikasi' }, { ic: ICONS.user, value: count('rejected') + count('suspended'), label: 'Ditolak / Nonaktif' }] }) };
  const body = await homeBody('super', B);
  box.replaceChildren(h('div', { class: 'home', id: 'home-super' },
    greetingHeader({ title: who.name || 'Super Admin', sub: 'Super Admin BAITUNA', name: who.name, email: who.email, avatar: who.avatar || undefined }),
    h('div', { class: 'home-body' }, ...body)));
}
