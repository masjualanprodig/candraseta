// BAITUNA - dashboard-admin.js
// Dashboard Super Admin: ringkasan, tambah masjid, dan verifikasi/penonaktifan masjid.
// Keamanan sebenarnya dijaga RLS; tombol di sini hanya kenyamanan tampilan.
import { h, toast, ask, hint, STATUS_LABEL } from './ui.js';
import { listMosques, createMosque, updateMosqueStatus } from './mosque-service.js';

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
  const list = await listMosques();
  const count = s => list.filter(m => m.status === s).length;

  const stats = h('div', { class: 'stats' },
    ['pending', 'active', 'rejected', 'suspended', 'draft'].map(s =>
      h('div', { class: 'stat' }, h('b', {}, String(count(s))), STATUS_LABEL[s])));

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
        h('button', { class: 'btn-sm' + (alt ? ' alt' : ''), onclick: () => changeStatus(m, ACTIONS[key], box) }, label)))));

  box.replaceChildren(
    h('h2', {}, 'Dashboard Super Admin'),
    stats,
    form,
    h('div', { class: 'panel' },
      h('h3', {}, 'Daftar masjid (' + list.length + ')'),
      rows.length ? rows : h('p', { class: 'muted' }, 'Belum ada masjid. Tambahkan masjid pertama di atas.')));
}
