// BAITUNA - dashboard-mosque.js
// Dashboard Admin Masjid: profil masjid, tim pengurus, dan undangan.
import { h, toast, hint } from './ui.js';
import { getMosque, updateMosqueProfile, fetchTeam, listInvitations } from './mosque-service.js';
import { teamPanel } from './team-panel.js';
import { getSession } from './supabase.js';

const ROLES_FOR_ADMIN_MASJID = ['ketua_takmir', 'bendahara', 'pengurus_bagian', 'pengelola_usaha'];

export async function renderMosque(box, mosqueId) {
  const [mosque, team, allInvites] = await Promise.all([getMosque(mosqueId), fetchTeam(mosqueId), listInvitations()]);
  if (!mosque) { box.replaceChildren(h('p', { class: 'muted' }, 'Masjid tidak ditemukan.')); return; }
  const me = getSession() && getSession().user;
  const refresh = () => renderMosque(box, mosqueId);

  const field = (ph, val, max) => h('input', { class: 'in', placeholder: ph, maxlength: String(max), autocomplete: 'off', value: val || '' });
  const name = field('Nama masjid *', mosque.name, 150), city = field('Kota/Kabupaten', mosque.city, 80),
        prov = field('Provinsi', mosque.province, 80), phone = field('Telepon resmi', mosque.contact_phone, 30);
  const addr = h('textarea', { class: 'in mt', placeholder: 'Alamat', maxlength: '300' }, mosque.address || '');
  const btn = h('button', { class: 'btn-sm', type: 'submit' }, 'Simpan profil');
  const form = h('form', {
    class: 'panel', novalidate: 'novalidate',
    onsubmit: async ev => {
      ev.preventDefault();
      const n = name.value.trim();
      if (n.length < 3) { toast('Nama masjid minimal 3 karakter.', true); return; }
      btn.disabled = true;
      try {
        await updateMosqueProfile(mosqueId, {
          name: n, city: city.value.trim() || null, province: prov.value.trim() || null,
          contact_phone: phone.value.trim() || null, address: addr.value.trim() || null
        });
        toast('Profil masjid disimpan.');
        await refresh();
      } catch (e) {
        if (e.status !== 401) toast('Profil belum tersimpan. ' + hint(e), true);
      }
      btn.disabled = false;
    }
  }, h('h3', {}, 'Profil masjid'), h('div', { class: 'grid2' }, name, city, prov, phone), addr, btn);

  box.replaceChildren(
    h('h2', {}, mosque.name),
    h('p', { class: 'muted' }, 'Dashboard Admin Masjid'),
    form,
    h('div', { class: 'panel' }, teamPanel({
      mosqueId, team, invites: allInvites.filter(i => i.mosque_id === mosqueId),
      roles: ROLES_FOR_ADMIN_MASJID, canRevokeAdmin: false, selfId: me && me.id, onChange: refresh
    })));
}
