// BAITUNA - team-panel.js
// Komponen bersama (Super Admin dan Admin Masjid): daftar tim + undangan pengurus.
// Keamanan sebenarnya dijaga RLS & fungsi database; tombol di sini hanya kenyamanan tampilan.
import { h, toast, ask, hint } from './ui.js';
import { ROLE_LABEL } from './permissions.js';
import { createInvitation, revokeInvitation, revokeMember } from './mosque-service.js';

const INV_LABEL = { pending: 'Menunggu', accepted: 'Diterima', revoked: 'Dibatalkan' };
const MEMBER_LABEL = { active: 'Aktif', revoked: 'Dicabut' };
const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// opts: { mosqueId, team, invites, roles, canRevokeAdmin, selfId, onChange }
export function teamPanel(opts) {
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
