// BAITUNA - dashboard-mosque.js
// Dashboard Admin Masjid: profil masjid, tim pengurus, dan undangan.
import { h, toast, hint, ask } from './ui.js';
import { getMosque, updateMosqueProfile, fetchTeam, listInvitations, setMosquePhoto } from './mosque-service.js';
import { prepareImage, newPhotoPath, PHOTO_ERRORS, MAX_BYTES } from './photo.js';
import { storageUpload, storageRemove, publicPhotoUrl } from './supabase.js';
import { teamPanel } from './team-panel.js';
import { getSession } from './supabase.js';

const ROLES_FOR_ADMIN_MASJID = ['ketua_takmir', 'bendahara', 'pengurus_bagian', 'pengelola_usaha'];

export async function renderMosque(box, mosqueId, view = 'home') {
  const [mosque, team, allInvites] = await Promise.all([getMosque(mosqueId), fetchTeam(mosqueId), listInvitations()]);
  if (!mosque) { box.replaceChildren(h('p', { class: 'muted' }, 'Masjid tidak ditemukan.')); return; }
  const me = getSession() && getSession().user;
  const refresh = () => renderMosque(box, mosqueId, view);
  const goHome = () => renderMosque(box, mosqueId, 'home');
  const goEdit = () => renderMosque(box, mosqueId, 'edit');

  const field = (ph, val, max) => h('input', { class: 'in', placeholder: ph, maxlength: String(max), autocomplete: 'off', value: val == null ? '' : String(val) });
  const name = field('Nama masjid *', mosque.name, 150), city = field('Kota/Kabupaten', mosque.city, 80),
        prov = field('Provinsi', mosque.province, 80), phone = field('Telepon resmi', mosque.contact_phone, 30);
  const addr = h('textarea', { class: 'in mt', placeholder: 'Alamat', maxlength: '300' }, mosque.address || '');
  const desc = h('textarea', { class: 'in mt', placeholder: 'Tentang masjid (sejarah, kegiatan, dll.)', maxlength: '1000' }, mosque.description || '');
  const fac = field('Fasilitas, pisahkan dengan koma (mis. Parkir, Toilet, Ruang wudhu)', mosque.facilities, 300);
  const tz = h('select', { class: 'in', 'aria-label': 'Zona waktu' },
    [['Asia/Jakarta', 'WIB (Waktu Indonesia Barat)'], ['Asia/Makassar', 'WITA (Waktu Indonesia Tengah)'], ['Asia/Jayapura', 'WIT (Waktu Indonesia Timur)']]
      .map(([v, l]) => h('option', { value: v }, l)));
  tz.value = mosque.timezone || 'Asia/Jakarta';
  const lat = field('Lintang (mis. -6.914744)', mosque.latitude, 12), lng = field('Bujur (mis. 107.609810)', mosque.longitude, 12);
  const btn = h('button', { class: 'btn-sm', type: 'submit' }, 'Simpan profil');
  const form = h('form', {
    class: 'panel', novalidate: 'novalidate',
    onsubmit: async ev => {
      ev.preventDefault();
      const n = name.value.trim();
      if (n.length < 3) { toast('Nama masjid minimal 3 karakter.', true); return; }
      const num = el => el.value.trim() === '' ? null : Number(el.value.trim().replace(',', '.'));
      const la = num(lat), lo = num(lng);
      if ((la === null) !== (lo === null)) { toast('Isi lintang DAN bujur, atau kosongkan keduanya.', true); return; }
      if (la !== null && (!isFinite(la) || !isFinite(lo) || la < -12 || la > 7 || lo < 94 || lo > 142)) {
        toast('Koordinat tidak valid untuk wilayah Indonesia. Periksa lintang dan bujur.', true); return;
      }
      btn.disabled = true;
      try {
        await updateMosqueProfile(mosqueId, {
          name: n, city: city.value.trim() || null, province: prov.value.trim() || null,
          contact_phone: phone.value.trim() || null, address: addr.value.trim() || null,
          description: desc.value.trim() || null, facilities: fac.value.trim() || null, latitude: la, longitude: lo, timezone: tz.value
        });
        toast('Profil masjid disimpan.');
        await goHome();
      } catch (e) {
        if (e.status !== 401) toast('Profil belum tersimpan. ' + hint(e), true);
      }
      btn.disabled = false;
    }
  }, h('h3', {}, 'Profil masjid'), h('div', { class: 'grid2' }, name, city, prov, phone), addr, desc, fac,
    h('p', { class: 'hint' }, 'Koordinat: buka Google Maps, tekan lama pada lokasi masjid, lalu salin dua angkanya (lintang lalu bujur). Boleh dikosongkan.'),
    h('div', { class: 'grid2' }, lat, lng),
    h('p', { class: 'hint' }, 'Zona waktu dipakai untuk menghitung jadwal salat masjid ini.'), tz, h('div', { class: 'mt' }, btn));

  // ----- Foto masjid (1 foto, maksimal 2 MB) -----
  const url = publicPhotoUrl(mosque.photo_path);
  const status = h('p', { class: 'hint' }, '1 foto, maksimal 2 MB (JPEG, PNG, atau WebP). Foto yang lebih besar otomatis diperkecil.');
  const pick = h('input', { class: 'in', type: 'file', accept: 'image/jpeg,image/png,image/webp', 'aria-label': 'Pilih foto masjid' });
  const del = mosque.photo_path ? h('button', { class: 'btn-sm alt', type: 'button' }, 'Hapus foto') : '';
  const lock = on => { pick.disabled = on; if (del) del.disabled = on; };
  pick.addEventListener('change', async () => {
    const file = pick.files && pick.files[0]; if (!file) return;
    lock(true); status.textContent = 'Memproses foto…';
    let uploaded = null;
    try {
      const img = await prepareImage(file);
      status.textContent = 'Mengunggah…';
      uploaded = newPhotoPath(mosqueId);
      await storageUpload(uploaded, img.blob);
      await setMosquePhoto(mosqueId, uploaded);
      if (mosque.photo_path) storageRemove(mosque.photo_path).catch(() => {}); // foto lama dibersihkan (jika gagal, tidak mengganggu)
      toast('Foto masjid disimpan.');
      await refresh(); return;
    } catch (e) {
      if (uploaded) storageRemove(uploaded).catch(() => {}); // unggahan yatim dibersihkan bila penyimpanan lokasi gagal
      if (e && e.status === 401) return;
      const msg = e && PHOTO_ERRORS[e.code] ? PHOTO_ERRORS[e.code]
        : e && e.status === 0 ? 'Tidak ada koneksi internet.'
        : e && (e.status === 413) ? 'Foto lebih dari 2 MB.'
        : 'Foto belum tersimpan. ' + hint(e);
      status.textContent = msg; toast(msg, true);
    }
    pick.value = ''; lock(false);
  });
  if (del) del.addEventListener('click', async () => {
    if (!(await ask({ title: 'Hapus foto masjid?', text: 'Foto tidak akan tampil lagi di direktori.', reason: false }))) return;
    lock(true);
    try {
      await setMosquePhoto(mosqueId, null);
      storageRemove(mosque.photo_path).catch(() => {});
      toast('Foto dihapus.'); await refresh(); return;
    } catch (e) { if (e.status !== 401) toast('Foto belum terhapus. ' + hint(e), true); }
    lock(false);
  });
  const photoPanel = h('div', { class: 'panel' }, h('h3', {}, 'Foto masjid'),
    url ? h('img', { class: 'photo-prev', src: url, alt: 'Foto ' + mosque.name }) : h('div', { class: 'photo-empty' }, 'Belum ada foto'),
    status, h('div', { class: 'mt' }, pick), del);

  const teamBox = h('div', { class: 'panel' }, teamPanel({
    mosqueId, team, invites: allInvites.filter(i => i.mosque_id === mosqueId),
    roles: ROLES_FOR_ADMIN_MASJID, canRevokeAdmin: false, selfId: me && me.id, onChange: refresh
  }));

  if (view === 'edit') {
    box.replaceChildren(
      h('button', { class: 'btn-sm ghost', type: 'button', onclick: goHome }, '← Kembali ke dashboard'),
      h('h2', { class: 'mt' }, 'Edit profil masjid'),
      h('p', { class: 'muted' }, mosque.name),
      photoPanel,
      form);
    window.scrollTo(0, 0);
    return;
  }

  const place = [mosque.address, mosque.city, mosque.province].filter(Boolean).join(', ');
  box.replaceChildren(
    h('h2', {}, mosque.name),
    h('p', { class: 'muted' }, 'Dashboard Admin Masjid'),
    h('div', { class: 'panel msum' },
      url ? h('img', { class: 'photo-prev', src: url, alt: 'Foto ' + mosque.name }) : '',
      h('p', {}, place || 'Alamat belum diisi.'),
      h('div', { class: 'mt' }, h('button', { class: 'btn-sm', type: 'button', onclick: goEdit }, 'Edit profil & foto masjid'))),
    teamBox);
  window.scrollTo(0, 0);
}
