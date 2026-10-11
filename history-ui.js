// BAITUNA - history-ui.js
// Sejarah Islam: (1) tampilan publik berurutan seperti lini masa, (2) pengelolaan oleh Super Admin.
// Isi tulisan sepenuhnya dari Super Admin; aplikasi tidak membuat konten sejarah sendiri.
import { h, toast, hint, ask } from './ui.js';
import { listHistory, createHistory, updateHistory, setHistoryPhoto, deleteHistory } from './history-service.js';
import { newWorldId } from './world-service.js';
import { prepareImage, newPhotoPath, PHOTO_ERRORS } from './photo.js';
import { publicPhotoUrl, storageUpload, storageRemove } from './supabase.js';
import { icon, ICONS, emptyState } from './feed-ui.js';

export const HISTORY_BUCKET = 'history-photos';
const photoUrl = e => publicPhotoUrl(e.photo_path, HISTORY_BUCKET);
const norm = s => String(s || '').toLowerCase();

/* ===== 1. Publik ===== */
export function historyPage() {
  const wrap = h('div', { class: 'hist' }, h('p', { class: 'muted center' }, 'Memuat sejarah…'));
  let items = [], q = '';

  const card = e => h('button', { class: 'hcard', type: 'button', onclick: () => detail(e) },
    photoUrl(e) ? h('img', { class: 'himg', src: photoUrl(e), alt: '', loading: 'lazy' }) : '',
    h('div', { class: 'hbody' },
      e.period ? h('span', { class: 'hperiod' }, e.period) : '',
      h('b', { class: 'hname' }, e.title),
      e.summary ? h('p', { class: 'hsum' }, e.summary) : ''));

  function list() {
    const search = h('input', { class: 'in', type: 'search', placeholder: 'Cari peristiwa atau tokoh', maxlength: '60', value: q, autocomplete: 'off', 'aria-label': 'Cari' });
    const col = h('div', { class: 'htimeline' });
    const fill = () => {
      const t = norm(q).trim();
      const rows = t ? items.filter(e => norm(e.title + ' ' + e.period + ' ' + e.summary).includes(t)) : items;
      col.replaceChildren(...(rows.length ? rows.map(card) : [emptyState(t ? 'Tidak ada yang cocok dengan pencarian Anda.' : 'Halaman sejarah masih kosong. Tulisan akan ditambahkan oleh admin pusat.')]));
    };
    search.addEventListener('input', () => { q = search.value; fill(); });
    wrap.replaceChildren(
      h('h2', { class: 'wtitle' }, 'Sejarah Islam'),
      h('p', { class: 'muted' }, 'Tulisan sejarah yang disusun dan dikelola oleh admin pusat BAITUNA.'),
      items.length ? search : '', col);
    fill();
  }

  function detail(e) {
    wrap.replaceChildren(
      h('button', { class: 'btn-sm ghost', type: 'button', onclick: list }, '← Sejarah Islam'),
      photoUrl(e) ? h('img', { class: 'hero mt', src: photoUrl(e), alt: '' }) : '',
      e.period ? h('span', { class: 'hperiod mt' }, e.period) : '',
      h('h2', { class: e.period ? '' : 'mt' }, e.title),
      e.summary ? h('p', { class: 'muted' }, e.summary) : '',
      e.body ? h('div', { class: 'panel' }, h('p', { class: 'prewrap hread' }, e.body)) : '',
      e.source ? h('div', { class: 'panel hsrc' }, h('h3', {}, 'Sumber / rujukan'), h('p', { class: 'prewrap' }, e.source)) : '');
    window.scrollTo(0, 0);
  }

  listHistory().then(rows => { items = rows; list(); }).catch(e => {
    const notReady = e && (e.code === '42P01' || e.code === 'PGRST205' || e.status === 404);
    wrap.replaceChildren(h('div', { class: 'empty' }, h('p', { class: 'muted' },
      notReady ? 'Halaman sejarah belum aktif. Admin pusat perlu menjalankan sejarah.sql.' : 'Sejarah belum bisa dimuat. Periksa koneksi, lalu coba lagi.')));
  });
  return wrap;
}

/* ===== 2. Super Admin ===== */
export async function renderHistoryManager(box, onBack) {
  let rows;
  try { rows = await listHistory(); }
  catch (e) {
    const notReady = e && (e.code === '42P01' || e.code === 'PGRST205' || e.status === 404);
    box.replaceChildren(onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '',
      h('div', { class: 'panel center' }, h('p', {}, notReady ? 'Fitur sejarah belum aktif. Jalankan sejarah.sql di Supabase SQL Editor.' : 'Data belum bisa dimuat. Periksa koneksi, lalu coba lagi.'),
        h('button', { class: 'btn-sm', type: 'button', onclick: () => renderHistoryManager(box, onBack) }, 'Coba lagi')));
    return;
  }
  const reload = () => renderHistoryManager(box, onBack);
  let editing = null;

  const title = h('input', { class: 'in', placeholder: 'Judul *', maxlength: '150', autocomplete: 'off' });
  const period = h('input', { class: 'in', placeholder: 'Periode / tahun (mis. abad ke-7 M)', maxlength: '80', autocomplete: 'off' });
  const order = h('input', { class: 'in', type: 'number', inputmode: 'numeric', min: '0', max: '9999', step: '1', value: '100', 'aria-label': 'Urutan' });
  const summary = h('textarea', { class: 'in', placeholder: 'Ringkasan singkat (tampil di daftar, maks. 400 karakter)', maxlength: '400' });
  const body = h('textarea', { class: 'in tall', placeholder: 'Isi tulisan (maks. 10.000 karakter)', maxlength: '10000' });
  const source = h('textarea', { class: 'in', placeholder: 'Sumber / rujukan (kitab, buku, tautan). Sangat disarankan.', maxlength: '500' });
  const pick = h('input', { class: 'in', type: 'file', accept: 'image/jpeg,image/png,image/webp', 'aria-label': 'Foto' });
  const status = h('p', { class: 'hint' }, 'Foto opsional: 1 foto, maksimal 2 MB (JPEG, PNG, atau WebP). Yang lebih besar otomatis diperkecil.');
  const formTitle = h('h3', {}, 'Tambah tulisan sejarah');
  const save = h('button', { class: 'btn-sm', type: 'submit' }, 'Simpan');
  const cancel = h('button', { class: 'btn-sm ghost', type: 'button', hidden: true, onclick: reload }, 'Batal ubah');

  const form = h('form', {
    class: 'panel', novalidate: 'novalidate',
    onsubmit: async ev => {
      ev.preventDefault();
      const t = title.value.trim();
      if (t.length < 3) { toast('Judul minimal 3 karakter.', true); return; }
      const so = order.value.trim() === '' ? 100 : Number(order.value);
      if (!Number.isInteger(so) || so < 0 || so > 9999) { toast('Urutan harus bilangan bulat 0 sampai 9999.', true); return; }
      const f = { title: t, period: period.value.trim() || null, summary: summary.value.trim() || null, body: body.value.trim() || null, source: source.value.trim() || null, sort_order: so };
      const file = pick.files && pick.files[0];
      save.disabled = true;
      let uploaded = null;
      try {
        let img = null;
        if (file) { status.textContent = 'Memproses foto…'; img = await prepareImage(file); }
        if (editing) {
          await updateHistory(editing.id, f);
          if (img) {
            uploaded = newPhotoPath(editing.id);
            await storageUpload(uploaded, img.blob, HISTORY_BUCKET);
            await setHistoryPhoto(editing.id, uploaded);
            if (editing.photo_path) storageRemove(editing.photo_path, HISTORY_BUCKET).catch(() => {});
            uploaded = null;
          }
          toast('Perubahan disimpan.');
        } else {
          const id = newWorldId();
          if (!id) throw Object.assign(new Error('peramban lama'), { status: 0 });
          if (img) { uploaded = newPhotoPath(id); await storageUpload(uploaded, img.blob, HISTORY_BUCKET); }
          await createHistory(id, f, uploaded);
          uploaded = null;
          toast('Tulisan ditambahkan.');
        }
        await reload(); return;
      } catch (e) {
        if (uploaded) storageRemove(uploaded, HISTORY_BUCKET).catch(() => {});
        if (e && e.status === 401) return;
        const msg = e && PHOTO_ERRORS[e.code] ? PHOTO_ERRORS[e.code] : e && e.status === 0 ? 'Tidak ada koneksi internet.' : 'Belum tersimpan. ' + hint(e);
        status.textContent = msg; toast(msg, true);
      }
      save.disabled = false;
    }
  }, formTitle, title, h('div', { class: 'grid2' }, period, order),
    h('p', { class: 'hint' }, 'Urutan: angka kecil tampil lebih dulu (mis. 10, 20, 30). Beri jarak agar mudah menyisipkan.'),
    summary, body, source, h('label', { class: 'hint' }, 'Foto'), pick, status,
    h('div', { class: 'mt row-btns' }, save, cancel));

  function edit(e) {
    editing = e; formTitle.textContent = 'Ubah: ' + e.title;
    title.value = e.title; period.value = e.period || ''; order.value = String(e.sort_order);
    summary.value = e.summary || ''; body.value = e.body || ''; source.value = e.source || '';
    if (e.photo_path) status.textContent = 'Foto sudah ada. Pilih foto baru hanya jika ingin menggantinya.';
    cancel.hidden = false; form.scrollIntoView({ behavior: 'smooth', block: 'start' }); title.focus();
  }

  const item = e => h('div', { class: 'post wrow' },
    photoUrl(e) ? h('img', { class: 'fi-thumb', src: photoUrl(e), alt: '', loading: 'lazy' }) : h('div', { class: 'fi-thumb wimg-empty', 'aria-hidden': 'true' }),
    h('div', { class: 'fi-main' }, h('b', {}, e.title), h('div', { class: 'muted' }, (e.period ? e.period + ' · ' : '') + 'urutan ' + e.sort_order),
      h('div', { class: 'row-btns mt' },
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => edit(e) }, 'Ubah'),
        h('button', { class: 'btn-sm alt', type: 'button', onclick: async () => {
          if (!(await ask({ title: 'Hapus "' + e.title + '"?', text: 'Dihapus dari halaman sejarah dan tidak bisa dikembalikan.', reason: false }))) return;
          try {
            await deleteHistory(e.id);
            if (e.photo_path) storageRemove(e.photo_path, HISTORY_BUCKET).catch(() => {});
            toast('Dihapus.'); await reload();
          } catch (er) { if (er.status !== 401) toast('Gagal menghapus. ' + hint(er), true); }
        } }, 'Hapus'))));

  box.replaceChildren(...[
    onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '',
    h('h2', { class: 'mt' }, 'Kelola Sejarah Islam'),
    h('p', { class: 'muted' }, 'Hanya Super Admin yang bisa menambah, mengubah, dan menghapus. Semua orang bisa membacanya di tab Sejarah. Cantumkan sumber untuk setiap tulisan.'),
    form,
    h('div', { class: 'panel' }, h('h3', {}, 'Daftar (' + rows.length + ')'),
      rows.length ? rows.map(item) : h('p', { class: 'muted' }, 'Belum ada. Tambahkan tulisan sejarah pertama di atas.'))
  ].flat());
  window.scrollTo(0, 0);
}
