// BAITUNA - team-panel.js
// Komponen bersama (Super Admin dan Admin Masjid): daftar tim + undangan pengurus.
// Keamanan sebenarnya dijaga RLS & fungsi database; tombol di sini hanya kenyamanan tampilan.
import { h, toast, ask, hint } from './ui.js';
import { ROLE_LABEL } from './permissions.js';
import { createInvitation, revokeInvitation, revokeMember, POSITION_LABEL, positionRole, addOfficer, removeOfficer } from './mosque-service.js';

const INV_LABEL = { pending: 'Menunggu', accepted: 'Diterima', revoked: 'Dibatalkan' };
const MEMBER_LABEL = { active: 'Aktif', revoked: 'Dicabut' };
const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// opts: { mosqueId, team, invites, roles, canRevokeAdmin, selfId, onChange }
export function teamPanel(opts) {
  if (opts.officers !== undefined) return officerPanel(opts);
  const { mosqueId, team, invites, roles, canRevokeAdmin, selfId, onChange } = opts;

  const members = team.map(t => h('div', { class: 'irow' },
    h('div', { class: 'minfo' },
      h('strong', {}, t.full_name || t.email || 'Tanpa nama'),
      h('div', { class: 'muted' }, (t.full_name && t.email ? t.email + ' · ' : '') + (ROLE_LABEL[t.role] || t.role))),
    h('span', { class: 'badge b-inv-' + (t.status === 'active' ? 'accepted' : 'revoked') }, MEMBER_LABEL[t.status] || t.status),
    (t.status === 'active' && t.user_id !== selfId && (t.role !== 'admin_masjid' || canRevokeAdmin))
      ? h('button', {
          class: 'btn-sm alt', onclick: async () => {
            const ok = await ask({ title: 'Cabut peran?', text: (t.full_name || t.email || 'Anggota ini') + ' tidak akan lagi menjadi ' + (ROLE_LABEL[t.role] || t.role) + '.', reason: false });
            if (!ok) return;
            try { await revokeMember(t.member_id); toast('Peran dicabut.'); await onChange(); }
            catch (e) { if (e.status !== 401) toast('Gagal mencabut. ' + hint(e), true); }
          }
        }, 'Cabut') : ''));

  const email = h('input', { class: 'in', type: 'email', inputmode: 'email', placeholder: 'Email calon pengurus', maxlength: '254', autocomplete: 'off' });
  const role = h('select', { class: 'in' }, roles.map(r => h('option', { value: r }, ROLE_LABEL[r])));
  const btn = h('button', { class: 'btn-sm', type: 'submit' }, 'Kirim undangan');
  const form = h('form', {
    novalidate: 'novalidate',
    onsubmit: async ev => {
      ev.preventDefault();
      const v = email.value.trim().toLowerCase();
      if (!emailOk(v)) { toast('Masukkan email yang valid.', true); return; }
      btn.disabled = true;
      try {
        await createInvitation(mosqueId, v, role.value);
        toast('Undangan dicatat. Orangnya perlu punya akun BAITUNA (lihat petunjuk).');
        await onChange();
      } catch (e) {
        if (e.status === 401) return;
        toast(e.code === '23505' ? 'Undangan yang sama masih menunggu.' : 'Undangan gagal disimpan. ' + hint(e), true);
      }
      btn.disabled = false;
    }
  }, h('div', { class: 'grid2' }, email, role), h('div', { class: 'mt' }, btn));

  const inviteRows = invites.map(i => h('div', { class: 'irow' },
    h('div', { class: 'minfo' }, h('strong', {}, i.email), h('div', { class: 'muted' }, ROLE_LABEL[i.role] || i.role)),
    h('span', { class: 'badge b-inv-' + i.status }, INV_LABEL[i.status] || i.status),
    (i.status === 'pending' && (i.role !== 'admin_masjid' || canRevokeAdmin)) ? h('button', {
      class: 'btn-sm alt', onclick: async () => {
        if (!(await ask({ title: 'Batalkan undangan?', text: 'Undangan untuk ' + i.email + ' tidak bisa dipakai lagi.', reason: false }))) return;
        try { await revokeInvitation(i.id); toast('Undangan dibatalkan.'); await onChange(); }
        catch (e) { if (e.status !== 401) toast('Gagal membatalkan. ' + hint(e), true); }
      }
    }, 'Batalkan') : ''));

  return h('div', { class: 'mpanel' },
    h('h4', {}, 'Tim pengurus'),
    members.length ? members : h('p', { class: 'muted' }, 'Belum ada pengurus.'),
    h('h4', { class: 'mt2' }, 'Undang pengurus'),
    form,
    inviteRows.length ? inviteRows : h('p', { class: 'muted' }, 'Belum ada undangan.'));
}

// Admin Masjid: daftar pengurus langsung (Nama Lengkap + Jabatan), tanpa alur undangan.
// opts: { mosqueId, team, invites, officers (null = SQL belum dijalankan), selfId, onChange }
function officerPanel(opts) {
  const { mosqueId, team, invites, officers, selfId, onChange } = opts;
  if (officers === null) return h('div', { class: 'mpanel' }, h('h4', {}, 'Daftar pengurus'), h('p', { class: 'muted', id: 'off-nosql' }, 'Fitur ini belum aktif. Jalankan pengurus_daftar.sql di Supabase SQL Editor.'));
  const accessOf = o => {
    if (!o.email) return null;
    const role = positionRole(o.position);
    if (team.some(t => t.status === 'active' && t.role === role && (t.email || '').toLowerCase() === o.email)) return ['Akun aktif', 'ok'];
    if (invites.some(i => i.status === 'pending' && i.email === o.email && i.role === role)) return ['Menunggu akun', 'wait'];
    return ['Akses belum aktif', 'wait'];
  };
  const rows = officers.map(o => { const ac = accessOf(o); return h('div', { class: 'irow off-row', 'data-id': o.id },
    h('div', { class: 'minfo' }, h('strong', {}, o.full_name), h('div', { class: 'muted' }, POSITION_LABEL[o.position] || o.position + (o.email ? ' · ' + o.email : '')), o.email ? h('div', { class: 'muted' }, o.email) : ''),
    ac ? h('span', { class: 'badge off-' + ac[1] }, ac[0]) : '',
    h('button', { class: 'btn-sm alt off-del', type: 'button', onclick: async () => {
      if (!(await ask({ title: 'Hapus dari daftar pengurus?', text: o.full_name + ' (' + (POSITION_LABEL[o.position] || '') + ') dihapus dari daftar.' + (o.email ? ' Akses akun ini sebagai ' + ROLE_LABEL[positionRole(o.position)] + ' juga dicabut.' : ''), reason: false }))) return;
      try { await removeOfficer(o.id); toast('Pengurus dihapus.'); await onChange(); } catch (e) { if (e.status !== 401) toast('Gagal menghapus. ' + hint(e), true); }
    } }, 'Hapus')); });

  const name = h('input', { class: 'in', id: 'off-name', placeholder: 'Nama lengkap', maxlength: '80', autocomplete: 'off', 'aria-label': 'Nama lengkap' });
  const pos = h('select', { class: 'in', id: 'off-pos', 'aria-label': 'Jabatan' }, h('option', { value: '' }, 'Pilih jabatan…'), ...Object.keys(POSITION_LABEL).map(k => h('option', { value: k }, POSITION_LABEL[k])));
  const email = h('input', { class: 'in', id: 'off-email', type: 'email', inputmode: 'email', placeholder: 'Email akun BAITUNA (opsional)', maxlength: '254', autocomplete: 'off', 'aria-label': 'Email akun' });
  const btn = h('button', { class: 'btn-sm', type: 'submit', id: 'off-add' }, 'Tambah Pengurus');
  const form = h('form', { novalidate: 'novalidate', class: 'rform', onsubmit: async ev => {
    ev.preventDefault();
    const n = name.value.trim(), e = email.value.trim().toLowerCase();
    if (n.length < 2) { toast('Isi nama lengkap (minimal 2 huruf).', true); name.focus(); return; }
    if (!POSITION_LABEL[pos.value]) { toast('Pilih jabatan dari daftar.', true); pos.focus(); return; }
    if (e && !emailOk(e)) { toast('Email tidak valid. Kosongkan bila tidak perlu.', true); email.focus(); return; }
    btn.disabled = true;
    try { await addOfficer(mosqueId, n, pos.value, e); toast('Pengurus ditambahkan.'); await onChange(); return; }
    catch (er) { if (er.status === 401) return; toast('Belum tersimpan. ' + hint(er), true); }
    btn.disabled = false;
  } }, name, pos, email, h('p', { class: 'hint' }, 'Email diisi hanya bila orang ini perlu masuk ke BAITUNA untuk memakai fitur pengurus (mis. Bendahara mencatat kas). Orangnya harus mendaftar dengan email itu.'), h('div', { class: 'mt' }, btn));

  const accounts = team.filter(t => t.status === 'active').map(t => h('div', { class: 'irow' },
    h('div', { class: 'minfo' }, h('strong', {}, t.full_name || t.email || 'Tanpa nama'), h('div', { class: 'muted' }, (t.full_name && t.email ? t.email + ' · ' : '') + (ROLE_LABEL[t.role] || t.role))),
    (t.user_id !== selfId && t.role !== 'admin_masjid') ? h('button', { class: 'btn-sm alt', type: 'button', onclick: async () => {
      if (!(await ask({ title: 'Cabut akses akun?', text: (t.full_name || t.email || 'Akun ini') + ' tidak akan lagi memiliki akses sebagai ' + (ROLE_LABEL[t.role] || t.role) + '.', reason: false }))) return;
      try { await revokeMember(t.member_id); toast('Akses dicabut.'); await onChange(); } catch (e) { if (e.status !== 401) toast('Gagal mencabut. ' + hint(e), true); }
    } }, 'Cabut') : ''));

  return h('div', { class: 'mpanel' },
    h('h4', {}, 'Daftar pengurus'),
    rows.length ? rows : h('p', { class: 'muted', id: 'off-empty' }, 'Belum ada pengurus. Tambahkan di bawah.'),
    h('h4', { class: 'mt2' }, 'Tambah pengurus'), form,
    accounts.length ? h('h4', { class: 'mt2' }, 'Akun yang punya akses') : '', ...accounts);
}
