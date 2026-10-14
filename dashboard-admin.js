// BAITUNA - dashboard-admin.js
// Dashboard Super Admin: ringkasan, tambah masjid, dan verifikasi/penonaktifan masjid.
// Keamanan sebenarnya dijaga RLS; tombol di sini hanya kenyamanan tampilan.
import { h, toast, ask, hint, STATUS_LABEL } from './ui.js';
import { listMosques, createMosque, updateMosqueStatus, listInvitations, fetchTeam } from './mosque-service.js';
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
import { renderJamaahManager } from './jamaah-ui.js';
import { renderAuditLog } from './audit-ui.js';
import { renderBrandingEditor } from './branding-ui.js';
import { greetingHeader, bannerCarousel, promoBanner, prayerCard, quickGrid, statGrid, sectionHead, whoAmI, go, registerActs, scrollToEl } from './home-ui.js';
import { pendingCount } from './jamaah-service.js';

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
    await renderAdmin(box);
  } catch (e) {
    if (e.status === 401) return;
    toast('Perubahan gagal disimpan. ' + hint(e), true);
  }
}

export async function renderAdmin(box) {
  const [list, invites, pending] = await Promise.all([listMosques(), listInvitations().catch(e => { if (e.status === 401) throw e; return null; }), pendingCount().catch(e => { if (e && e.status === 401) throw e; return null; })]);
  const openList = list.filter(m => m.status === 'active' && invites && openPanels.has(m.id));
  const teams = {};
  await Promise.all(openList.map(async m => { try { teams[m.id] = await fetchTeam(m.id); } catch (e) { if (e.status === 401) throw e; teams[m.id] = []; } }));
  const me = getSession() && getSession().user;
  const count = s => list.filter(m => m.status === s).length;

  const field = (ph, max) => h('input', { class: 'in', placeholder: ph, maxlength: String(max), autocomplete: 'off' });
  const name = field('Nama masjid *', 150), city = field('Kota/Kabupaten', 80), prov = field('Provinsi', 80), phone = field('Telepon resmi', 30);
  const addr = h('textarea', { class: 'in mt', placeholder: 'Alamat', maxlength: '300' });
  const btn = h('button', { class: 'btn-sm', type: 'submit' }, 'Tambah masjid');
  const form = h('form', {
    class: 'panel', novalidate: 'novalidate',
    onsubmit: async ev => {
      ev.preventDefault();
      const n = name.value.trim();
      if (n.length < 3) { toast('Nama masjid minimal 3 karakter.', true); return; }
      btn.disabled = true;
      try {
        await createMosque({
          name: n, city: city.value.trim() || null, province: prov.value.trim() || null,
          contact_phone: phone.value.trim() || null, address: addr.value.trim() || null
        });
        toast('Masjid ditambahkan dengan status menunggu verifikasi.');
        await renderAdmin(box);
      } catch (e) {
        if (e.status !== 401) toast('Gagal menambah masjid. ' + hint(e), true);
      }
      btn.disabled = false;
    }
  }, h('h3', {}, 'Tambah masjid'), h('div', { class: 'grid2' }, name, city, prov, phone), addr, btn);

  const rows = list.map(m => h('div', { class: 'mrow' },
    h('div', { class: 'minfo' },
      h('strong', {}, m.name),
      h('div', { class: 'muted' }, [m.city, m.province].filter(Boolean).join(', ') || 'Lokasi belum diisi'),
      m.status_reason ? h('div', { class: 'muted' }, 'Alasan: ' + m.status_reason) : ''),
    h('div', { class: 'macts' },
      h('span', { class: 'badge b-' + m.status }, STATUS_LABEL[m.status] || m.status),
      (BUTTONS[m.status] || []).map(([label, key, alt]) =>
        h('button', { class: 'btn-sm' + (alt ? ' alt' : ''), onclick: () => changeStatus(m, ACTIONS[key], box) }, label)),
      m.status === 'active' ? h('button', { class: 'btn-sm ghost adm-kas', type: 'button', onclick: () => renderKasManager(box, m, { onBack: () => renderAdmin(box), roles: { admin: true, approve: true } }) }, 'Kas') : '',
      m.status === 'active' && invites ? h('button', {
        class: 'btn-sm ghost',
        onclick: () => { openPanels.has(m.id) ? openPanels.delete(m.id) : openPanels.add(m.id); renderAdmin(box); }
      }, openPanels.has(m.id) ? 'Tutup pengurus' : 'Pengurus') : ''),
    m.status === 'active' && invites && openPanels.has(m.id) ? teamPanel({ mosqueId: m.id, team: teams[m.id] || [], invites: invites.filter(i => i.mosque_id === m.id), roles: INVITE_ROLES, canRevokeAdmin: true, selfId: me && me.id, onChange: () => renderAdmin(box) }) : ''));

  const who = await whoAmI();
  const openJamaah = () => renderJamaahManager(box, () => renderAdmin(box));
  const openAudit = () => renderAuditLog(box, { onBack: () => renderAdmin(box), mosques: list.map(m => ({ id: m.id, name: m.name })) });
  const openMarket = () => renderMarketManager(box, () => renderAdmin(box));
  const openBrand = () => renderBrandingEditor(box, () => renderAdmin(box));
  const kontenBox = h('section', { class: 'konten', id: 'konten' }, h('h2', {}, 'Kelola Konten & Fitur'),
    h('div', { class: 'actions' },
      h('button', { class: 'act', type: 'button', onclick: () => renderWorldManager(box, () => renderAdmin(box)) }, icon(ICONS.globe), h('span', {}, 'Galeri masjid dunia')),
      h('button', { class: 'act', type: 'button', onclick: () => renderHistoryManager(box, () => renderAdmin(box)) }, icon(ICONS.book), h('span', {}, 'Sejarah Islam')),
      h('button', { class: 'act', type: 'button', onclick: () => renderRukunManager(box, () => renderAdmin(box)) }, icon(ICONS.book), h('span', {}, 'Rukun Islam & Iman')),
      h('button', { class: 'act', type: 'button', onclick: () => renderArticleManager(box, () => renderAdmin(box)) }, icon(ICONS.news), h('span', {}, 'Berita & Artikel Islam')),
      h('button', { class: 'act', type: 'button', onclick: () => renderDhikrManager(box, () => renderAdmin(box)) }, icon(ICONS.dzikir), h('span', {}, 'Dzikir Pagi & Petang')),
      h('button', { class: 'act', type: 'button', onclick: () => renderDuaManager(box, () => renderAdmin(box)) }, icon(ICONS.doa), h('span', {}, 'Doa Shahih')),
      h('button', { class: 'act', type: 'button', onclick: () => renderSunnahManager(box, () => renderAdmin(box)) }, icon(ICONS.sunnah), h('span', {}, 'Amalan Sunnah Harian')),
      h('button', { class: 'act', type: 'button', onclick: () => renderBelajarManager(box, () => renderAdmin(box)) }, icon(ICONS.belajar), h('span', {}, 'Materi Belajar Qur’an')),
      h('button', { class: 'act', type: 'button', onclick: () => renderAsmaManager(box, () => renderAdmin(box)) }, icon(ICONS.asma), h('span', {}, 'Penjelasan & Audio Asmaul Husna'))));
  const listAnchor = h('div', { id: 'mosque-list' });
  registerActs({ jamaah: openJamaah, audit: openAudit, masjid: () => scrollToEl(listAnchor) });
  const badge = n => n ? h('em', { class: 'qk-badge', 'aria-label': n + ' menunggu' }, String(n)) : '';
  const grid = quickGrid('Manajemen Platform', [
    { key: 'open-datamasjid', id: 'qa-masjid', onclick: () => scrollToEl(listAnchor) },
    { key: 'open-pengguna', id: 'adm-jamaah', label: 'Pendaftaran Jamaah', onclick: openJamaah },
    { key: 'open-konten', id: 'qa-konten', onclick: () => scrollToEl(kontenBox) },
    { key: 'open-market', id: 'adm-market', label: 'Verifikasi Pasar', onclick: openMarket },
    { key: 'open-audit', id: 'adm-audit', onclick: openAudit },
    { key: 'open-tampilan', id: 'adm-tampilan', onclick: openBrand },
    { key: 'open-more', id: 'qa-more', onclick: () => go('more') }]);
  if (pending) { const t = grid.querySelector('#adm-jamaah .qk-ic'); if (t) t.append(badge(pending)); }
  box.replaceChildren(h('div', { class: 'home', id: 'home-super' },
    greetingHeader({ title: 'Super Admin', sub: 'BAITUNA', name: who.name, email: who.email }),
    h('div', { class: 'home-body' },
      bannerCarousel([
        { title: 'Satu Platform, Banyak Masjid', text: 'Kelola dan pantau masjid yang terdaftar di BAITUNA.', cta: 'Kelola Masjid', onclick: () => scrollToEl(listAnchor) },
        { title: 'Pendaftaran Jamaah', text: pending ? pending + ' pendaftaran menunggu keputusan Anda.' : 'Tidak ada pendaftaran yang menunggu.', cta: 'Buka Antrean', onclick: openJamaah, tone: 'gold' }]),
      promoBanner({ id: 'pb', title: 'Pasar Umat', text: 'Periksa dan setujui produk serta jasa sebelum tampil ke umat.', cta: 'Verifikasi', onclick: openMarket }),
      prayerCard(),
      grid,
      h('section', { class: 'sgw' }, sectionHead('Statistik Platform'), statGrid([
        [ICONS.mosque, list.length, 'Masjid terdaftar'], [ICONS.shield, count('active'), 'Masjid aktif'],
        [ICONS.clock, count('pending'), 'Menunggu verifikasi'], [ICONS.user, pending == null ? '–' : pending, 'Jamaah menunggu']])),
      kontenBox,
    form,
      listAnchor,
    h('div', { class: 'panel' },
      h('h3', {}, 'Daftar masjid (' + list.length + ')'),
      rows.length ? rows : h('p', { class: 'muted' }, 'Belum ada masjid. Tambahkan masjid pertama di atas.')),
    invites ? '' : h('p', { class: 'muted' }, 'Fitur undangan pengurus belum aktif: jalankan invitations.sql di Supabase SQL Editor.'))));
}
