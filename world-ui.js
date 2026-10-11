// BAITUNA - world-ui.js
// Galeri Masjid Dunia: (1) tampilan publik (foto, deskripsi, lokasi), (2) pengelolaan oleh Super Admin.
import { h, toast, hint, ask } from './ui.js';
import { listWorldMosques, createWorldMosque, updateWorldMosque, setWorldPhoto, deleteWorldMosque, newWorldId } from './world-service.js';
import { prepareImage, newPhotoPath, PHOTO_ERRORS } from './photo.js';
import { publicPhotoUrl, storageUpload, storageRemove, WORLD_BUCKET } from './supabase.js';
import { icon, ICONS, emptyState } from './feed-ui.js';

const photoUrl = m => publicPhotoUrl(m.photo_path, WORLD_BUCKET);
const placeText = m => [m.city, m.country].filter(Boolean).join(', ');
const norm = s => String(s || '').toLowerCase();

/* ===== 1. Publik ===== */
export function worldGallery() {
  const wrap = h('div', { class: 'world' }, h('p', { class: 'muted center' }, 'Memuat galeri…'));
  let items = [], q = '';

  const card = m => h('button', { class: 'wcard', type: 'button', onclick: () => detail(m) },
    photoUrl(m) ? h('img', { class: 'wimg', src: photoUrl(m), alt: 'Foto ' + m.name, loading: 'lazy' })
      : h('div', { class: 'wimg wimg-empty', 'aria-hidden': 'true' }, icon(ICONS.mosque, 'ic-lg')),
    h('div', { class: 'wbody' },
      h('b', { class: 'wname' }, m.name),
      h('div', { class: 'wplace' }, icon(ICONS.pin), h('span', {}, placeText(m))),
      m.description ? h('p', { class: 'wdesc' }, m.description) : ''));

  function list() {
    const search = h('input', { class: 'in', type: 'search', placeholder: 'Cari nama masjid atau negara', maxlength: '60', value: q, autocomplete: 'off', 'aria-label': 'Cari' });
    const grid = h('div', { class: 'wgrid' });
    const fill = () => {
      const t = norm(q).trim();
      const rows = t ? items.filter(m => norm(m.name + ' ' + m.country + ' ' + m.city).includes(t)) : items;
      grid.replaceChildren(...(rows.length ? rows.map(card) : [emptyState(t ? 'Tidak ada masjid yang cocok dengan pencarian Anda.' : 'Galeri masih kosong. Masjid dunia akan ditambahkan oleh admin pusat.')]));
    };
    search.addEventListener('input', () => { q = search.value; fill(); });
    wrap.replaceChildren(
      h('h2', { class: 'wtitle' }, 'Masjid dunia'),
      h('p', { class: 'muted' }, 'Kumpulan masjid terkenal dari berbagai negara, dipilih oleh admin pusat BAITUNA.'),
      items.length ? search : '', grid);
    fill();
  }

  function detail(m) {
    const lat = Number(m.latitude), lng = Number(m.longitude);
    const hasMap = m.latitude !== null && m.longitude !== null && isFinite(lat) && isFinite(lng);
    wrap.replaceChildren(
      h('button', { class: 'btn-sm ghost', type: 'button', onclick: list }, '← Galeri'),
      photoUrl(m) ? h('img', { class: 'hero mt', src: photoUrl(m), alt: 'Foto ' + m.name }) : '',
      h('h2', { class: 'mt' }, m.name),
      h('div', { class: 'wplace big' }, icon(ICONS.pin), h('span', {}, placeText(m))),
      m.description ? h('div', { class: 'panel' }, h('p', { class: 'prewrap' }, m.description)) : '',
      hasMap ? h('a', { class: 'btn-sm', href: 'https://www.google.com/maps?q=' + lat + ',' + lng, target: '_blank', rel: 'noopener noreferrer' }, 'Buka lokasi di Google Maps') : '');
    window.scrollTo(0, 0);
  }

  listWorldMosques().then(rows => { items = rows; list(); }).catch(e => {
    const notReady = e && (e.code === '42P01' || e.code === 'PGRST205' || e.status === 404);
    wrap.replaceChildren(h('div', { class: 'empty' }, h('p', { class: 'muted' },
      notReady ? 'Galeri belum aktif. Admin pusat perlu menjalankan dunia.sql.' : 'Galeri belum bisa dimuat. Periksa koneksi, lalu coba lagi.')));
  });
  return wrap;
}

/* ===== 2. Super Admin ===== */
export async function renderWorldManager(box, onBack) {
  let rows;
  try { rows = await listWorldMosques(); }
  catch (e) {
    const notReady = e && (e.code === '42P01' || e.code === 'PGRST205' || e.status === 404);
    box.replaceChildren(onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '',
      h('div', { class: 'panel center' }, h('p', {}, notReady ? 'Fitur galeri belum aktif. Jalankan dunia.sql di Supabase SQL Editor.' : 'Data belum bisa dimuat. Periksa koneksi, lalu coba lagi.'),
        h('button', { class: 'btn-sm', type: 'button', onclick: () => renderWorldManager(box, onBack) }, 'Coba lagi')));
    return;
  }
  const reload = () => renderWorldManager(box, onBack);
  let editing = null;

  const field = (ph, max) => h('input', { class: 'in', placeholder: ph, maxlength: String(max), autocomplete: 'off' });
  const name = field('Nama masjid *', 150), country = field('Negara *', 80), city = field('Kota', 80);
  const desc = h('textarea', { class: 'in', placeholder: 'Deskripsi (sejarah, keunikan, dll.)', maxlength: '2000' });
  const lat = field('Lintang (mis. 21.4225)', 12), lng = field('Bujur (mis. 39.8262)', 12);
  const pick = h('input', { class: 'in', type: 'file', accept: 'image/jpeg,image/png,image/webp', 'aria-label': 'Foto masjid' });
  const status = h('p', { class: 'hint' }, '1 foto, maksimal 2 MB (JPEG, PNG, atau WebP). Foto yang lebih besar otomatis diperkecil.');
  const formTitle = h('h3', {}, 'Tambah masjid dunia');
  const save = h('button', { class: 'btn-sm', type: 'submit' }, 'Simpan');
  const cancel = h('button', { class: 'btn-sm ghost', type: 'button', hidden: true, onclick: reload }, 'Batal ubah');

  const photoMsg = e => e && PHOTO_ERRORS[e.code] ? PHOTO_ERRORS[e.code] : e && e.status === 0 ? 'Tidak ada koneksi internet.' : 'Foto belum tersimpan. ' + hint(e);

  const form = h('form', {
    class: 'panel', novalidate: 'novalidate',
    onsubmit: async ev => {
      ev.preventDefault();
      const n = name.value.trim(), c = country.value.trim();
      if (n.length < 3) { toast('Nama masjid minimal 3 karakter.', true); return; }
      if (c.length < 2) { toast('Isi negara.', true); return; }
      const num = el => el.value.trim() === '' ? null : Number(el.value.trim().replace(',', '.'));
      const la = num(lat), lo = num(lng);
      if ((la === null) !== (lo === null)) { toast('Isi lintang DAN bujur, atau kosongkan keduanya.', true); return; }
      if (la !== null && (!isFinite(la) || !isFinite(lo) || la < -90 || la > 90 || lo < -180 || lo > 180)) { toast('Koordinat tidak valid.', true); return; }
      const f = { name: n, country: c, city: city.value.trim() || null, description: desc.value.trim() || null, latitude: la, longitude: lo };
      const file = pick.files && pick.files[0];
      save.disabled = true;
      let uploaded = null;
      try {
        let img = null;
        if (file) { status.textContent = 'Memproses foto…'; img = await prepareImage(file); }
        if (editing) {
          await updateWorldMosque(editing.id, f);
          if (img) {
            uploaded = newPhotoPath(editing.id);
            await storageUpload(uploaded, img.blob, WORLD_BUCKET);
            await setWorldPhoto(editing.id, uploaded);
            if (editing.photo_path) storageRemove(editing.photo_path, WORLD_BUCKET).catch(() => {});
            uploaded = null;
          }
          toast('Perubahan disimpan.');
        } else {
          const id = newWorldId();
          if (!id) throw Object.assign(new Error('peramban lama'), { status: 0 });
          if (img) { uploaded = newPhotoPath(id); await storageUpload(uploaded, img.blob, WORLD_BUCKET); }
          await createWorldMosque(id, f, uploaded);
          uploaded = null;
          toast('Masjid ditambahkan ke galeri.');
        }
        await reload(); return;
      } catch (e) {
        if (uploaded) storageRemove(uploaded, WORLD_BUCKET).catch(() => {}); // unggahan yatim dibersihkan
        if (e && e.status === 401) return;
        const msg = (e && (PHOTO_ERRORS[e.code])) ? photoMsg(e) : 'Belum tersimpan. ' + hint(e);
        status.textContent = msg; toast(msg, true);
      }
      save.disabled = false;
    }
  }, formTitle, name, h('div', { class: 'grid2' }, country, city), desc,
    h('p', { class: 'hint' }, 'Koordinat (opsional): buka Google Maps, tekan lama pada lokasi, lalu salin lintang dan bujurnya.'),
    h('div', { class: 'grid2' }, lat, lng),
    h('label', { class: 'hint' }, 'Foto'), pick, status,
    h('div', { class: 'mt row-btns' }, save, cancel));

  function edit(m) {
    editing = m; formTitle.textContent = 'Ubah: ' + m.name;
    name.value = m.name; country.value = m.country; city.value = m.city || ''; desc.value = m.description || '';
    lat.value = m.latitude == null ? '' : String(m.latitude); lng.value = m.longitude == null ? '' : String(m.longitude);
    status.textContent = m.photo_path ? 'Foto sudah ada. Pilih foto baru hanya jika ingin menggantinya.' : status.textContent;
    cancel.hidden = false; form.scrollIntoView({ behavior: 'smooth', block: 'start' }); name.focus();
  }

  const item = m => h('div', { class: 'post wrow' },
    photoUrl(m) ? h('img', { class: 'fi-thumb', src: photoUrl(m), alt: '', loading: 'lazy' }) : h('div', { class: 'fi-thumb wimg-empty', 'aria-hidden': 'true' }),
    h('div', { class: 'fi-main' }, h('b', {}, m.name), h('div', { class: 'muted' }, placeText(m)),
      h('div', { class: 'row-btns mt' },
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => edit(m) }, 'Ubah'),
        h('button', { class: 'btn-sm alt', type: 'button', onclick: async () => {
          if (!(await ask({ title: 'Hapus "' + m.name + '"?', text: 'Dihapus dari galeri dan tidak bisa dikembalikan.', reason: false }))) return;
          try {
            await deleteWorldMosque(m.id);
            if (m.photo_path) storageRemove(m.photo_path, WORLD_BUCKET).catch(() => {});
            toast('Dihapus.'); await reload();
          } catch (e) { if (e.status !== 401) toast('Gagal menghapus. ' + hint(e), true); }
        } }, 'Hapus'))));

  box.replaceChildren(...[
    onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '',
    h('h2', { class: 'mt' }, 'Galeri masjid dunia'),
    h('p', { class: 'muted' }, 'Hanya Super Admin yang bisa menambah, mengubah, dan menghapus. Semua orang bisa melihatnya di tab Dunia.'),
    form,
    h('div', { class: 'panel' }, h('h3', {}, 'Daftar (' + rows.length + ')'),
      rows.length ? rows.map(item) : h('p', { class: 'muted' }, 'Belum ada. Tambahkan masjid dunia pertama di atas.'))
  ].flat());
  window.scrollTo(0, 0);
}
