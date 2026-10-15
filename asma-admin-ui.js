// BAITUNA - asma-admin-ui.js
// Pengelolaan Asmaul Husna oleh Super Admin: (1) ubah penjelasan/arti tiap nama, (2) ganti audio lantunan lengkap.
// Selama belum ada perubahan, aplikasi memakai isi bawaan. "Kembalikan ke bawaan" menghapus perubahan.
import { h, toast, hint, ask } from './ui.js';
import { loadAsma, applyEdits, EDIT_MAX, AUDIO_MAX_BYTES, AUDIO_MAX_COUNT } from './asma-service.js';
import { loadEdits, loadAudioRows, loadFullList, saveEdit, resetEdit, audioFileOk, newAudioPath, addAudio, updateAudio, deleteAudio, uploadAudio, removeAudio } from './asma-edit-service.js';

const lab = (t, el) => h('label', { class: 'flab' }, h('span', { class: 'hint' }, t), el);
const msgOf = e => e && e.status === 0 ? 'Tidak ada koneksi internet.' : 'Belum tersimpan. ' + hint(e);
const notReady = e => e && (e.code === '42P01' || e.code === 'PGRST205' || e.status === 404);

export async function renderAsmaManager(box, onBack) {
  const back = onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '';
  box.replaceChildren(back, h('div', { class: 'panel center' }, h('p', {}, 'Memuat…')));
  let base, edits, rows, items;
  try {
    base = await loadAsma();
    [edits, rows] = await Promise.all([loadEdits(), loadAudioRows()]);
    items = await loadFullList(rows);
  } catch (e) {
    box.replaceChildren(back, h('div', { class: 'panel center' }, h('p', {}, 'Data belum bisa dimuat. Periksa koneksi, lalu coba lagi.'), h('button', { class: 'btn-sm', type: 'button', onclick: () => renderAsmaManager(box, onBack) }, 'Coba lagi')));
    return;
  }
  const reload = () => renderAsmaManager(box, onBack);
  const merged = applyEdits(base.names, edits);
  const editedSet = new Set(merged.filter(n => n.edited).map(n => n.no));

  /* ---------- 1. Penjelasan ---------- */
  let cur = null, q = '';
  const listBox = h('div', { class: 'am-list' }), formBox = h('div');
  const search = h('input', { class: 'in', type: 'search', placeholder: 'Cari nomor atau nama (mis. 12 atau Rahman)', maxlength: '40', autocomplete: 'off', 'aria-label': 'Cari nama' });
  search.addEventListener('input', () => { q = search.value.trim().toLowerCase(); drawList(); });
  function drawList() {
    const rows = merged.filter(n => !q || String(n.no) === q || n.latin.toLowerCase().includes(q) || n.arti.toLowerCase().includes(q));
    listBox.replaceChildren(...(rows.length ? rows.map(n => h('button', { class: 'am-row' + (cur && cur.no === n.no ? ' on' : ''), type: 'button', 'data-no': String(n.no), onclick: () => pick(n.no) },
      h('span', { class: 'am-no' }, String(n.no)), h('span', { class: 'am-ar', lang: 'ar', dir: 'rtl' }, n.arab), h('span', { class: 'am-lt' }, n.latin),
      editedSet.has(n.no) ? h('span', { class: 'hperiod' }, 'Diubah') : '')) : [h('p', { class: 'muted' }, 'Tidak ada nama yang cocok.')]));
  }
  function pick(no) {
    cur = merged[no - 1]; const def = base.names[no - 1]; drawList();
    const arti = h('input', { class: 'in', maxlength: String(EDIT_MAX.arti), autocomplete: 'off', 'aria-label': 'Arti', value: cur.arti, placeholder: 'Arti singkat' });
    const pj = h('textarea', { class: 'in tall', maxlength: String(EDIT_MAX.penjelasan), 'aria-label': 'Penjelasan', placeholder: 'Penjelasan singkat (minimal 10 huruf)' }); pj.value = cur.penjelasan;
    const cnt = h('span', { class: 'hint' }, ''); const upd = () => { cnt.textContent = pj.value.length + ' / ' + EDIT_MAX.penjelasan; }; pj.addEventListener('input', upd); upd();
    const status = h('p', { class: 'hint' }, ''); const save = h('button', { class: 'btn-sm', type: 'submit' }, 'Simpan');
    const form = h('form', { class: 'panel rform', novalidate: 'novalidate', onsubmit: async ev => {
      ev.preventDefault();
      const p = pj.value.trim(), a = arti.value.trim();
      if (p.length < 10) { toast('Penjelasan minimal 10 huruf.', true); return; }
      if (a && a.length < 2) { toast('Arti minimal 2 huruf, atau kosongkan untuk memakai arti bawaan.', true); return; }
      save.disabled = true;
      try { await saveEdit(no, p, a && a !== def.arti ? a : null); toast('Perubahan disimpan.'); await reload(); return; }
      catch (e) { if (e && e.status === 401) return; const m = notReady(e) ? 'Fitur ini belum aktif. Jalankan asma.sql di Supabase SQL Editor.' : msgOf(e); status.textContent = m; toast(m, true); }
      save.disabled = false;
    } },
      h('h3', {}, no + '. ' + cur.latin), h('p', { class: 'am-big', lang: 'ar', dir: 'rtl' }, cur.arab),
      lab('Arti', arti), lab('Penjelasan', pj), cnt,
      h('p', { class: 'hint' }, 'Tulis penjelasan yang Anda yakini benar. Jangan memuat keutamaan atau khasiat tanpa dalil yang jelas; bila memuat dalil, tulis sumbernya.'),
      status,
      h('div', { class: 'mt row-btns' }, save,
        editedSet.has(no) ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: async () => {
          if (!(await ask({ title: 'Kembalikan ke bawaan?', text: 'Perubahan pada nama ini dihapus dan isi bawaan aplikasi dipakai lagi.', reason: false }))) return;
          try { await resetEdit(no); toast('Dikembalikan ke bawaan.'); await reload(); } catch (e) { if (e && e.status === 401) return; toast(msgOf(e), true); }
        } }, 'Kembalikan ke bawaan') : '',
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { cur = null; formBox.replaceChildren(); drawList(); } }, 'Tutup')));
    formBox.replaceChildren(form); form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- 2. Daftar audio lantunan (maks. AUDIO_MAX_COUNT) ---------- */
  const uploadedCount = items.filter(x => x.uploaded).length;
  const title = h('input', { class: 'in', id: 'au-title', maxlength: '150', autocomplete: 'off', 'aria-label': 'Judul audio', placeholder: 'Judul audio' });
  const source = h('textarea', { class: 'in', id: 'au-source', rows: '3', maxlength: '500', 'aria-label': 'Sumber audio', placeholder: 'Sumber: nama pelantun/kanal dan tautan' });
  const lic = h('textarea', { class: 'in', id: 'au-license', rows: '2', maxlength: '500', 'aria-label': 'Lisensi audio', placeholder: 'Lisensi / izin penggunaan' });
  const file = h('input', { class: 'in', id: 'au-file', type: 'file', accept: 'audio/mpeg,audio/mp4,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav', 'aria-label': 'Pilih berkas audio' });
  const aStatus = h('p', { class: 'hint', role: 'status' }, '');
  const fail = (e, fallback) => { if (e && e.status === 401) return; const m = notReady(e) ? 'Fitur ini belum aktif. Jalankan asma.sql dan asma_daftar_audio.sql di Supabase SQL Editor.' : e && e.status === 0 ? 'Tidak ada koneksi internet.' : (e && e.code === '22023' ? 'Daftar sudah penuh (maksimal ' + AUDIO_MAX_COUNT + ' audio).' : fallback + hint(e)); aStatus.textContent = m; toast(m, true); };
  const aAdd = h('button', { class: 'btn-sm', type: 'button', id: 'au-add', onclick: async () => {
    const f = file.files && file.files[0];
    if (uploadedCount >= AUDIO_MAX_COUNT) { toast('Daftar sudah penuh (maksimal ' + AUDIO_MAX_COUNT + ' audio). Hapus satu dulu.', true); return; }
    if (!f) { toast('Pilih berkas audio dulu.', true); return; }
    if (!audioFileOk(f)) { const m = 'Berkas harus MP3, M4A, OGG, atau WAV, maksimal ' + Math.round(AUDIO_MAX_BYTES / 1048576) + ' MB.'; aStatus.textContent = m; toast(m, true); return; }
    if (title.value.trim().length < 3) { toast('Isi judul audio dulu (minimal 3 huruf).', true); return; }
    if (!source.value.trim() || !lic.value.trim()) { if (!(await ask({ title: 'Sumber/lisensi masih kosong', text: 'Disarankan mengisi sumber dan lisensi audio. Tetap lanjutkan mengunggah?', reason: false }))) return; }
    aAdd.disabled = true; aStatus.textContent = 'Mengunggah… jangan tutup halaman ini.';
    const path = newAudioPath(f.name); let uploaded = false;
    try {
      await uploadAudio(f, path); uploaded = true;
      await addAudio({ title: title.value.trim(), source: source.value.trim(), license: lic.value.trim(), file_path: path });
      toast('Audio ditambahkan.'); await reload(); return;
    } catch (e) { if (uploaded) removeAudio(path).catch(() => {}); fail(e, 'Audio belum terunggah. '); }
    aAdd.disabled = false;
  } }, 'Tambah audio');

  function itemCard(it) {
    const box2 = h('div', { class: 'am-aitem', 'data-id': String(it.id == null ? 'bawaan' : it.id) });
    const view = () => {
      box2.replaceChildren(h('strong', { class: 'am-at' }, it.title), h('audio', { controls: true, preload: 'none', src: it.src, class: 'am-audio' }),
        it.source ? h('p', { class: 'muted' }, 'Sumber: ' + it.source) : '', it.license ? h('p', { class: 'muted' }, 'Lisensi: ' + it.license) : '',
        it.uploaded ? h('div', { class: 'row-btns' },
          h('button', { class: 'btn-sm ghost', type: 'button', 'data-act': 'edit', onclick: edit }, 'Ubah keterangan'),
          h('button', { class: 'btn-sm alt', type: 'button', 'data-act': 'del', onclick: remove }, 'Hapus')) : h('p', { class: 'hint' }, 'Audio bawaan aplikasi. Setelah Anda menambah audio sendiri, audio bawaan tidak dipakai lagi.'));
    };
    const edit = () => {
      const t2 = h('input', { class: 'in', maxlength: '150', 'aria-label': 'Judul', value: it.title }), s2 = h('textarea', { class: 'in', rows: '3', maxlength: '500', 'aria-label': 'Sumber' }), l2 = h('textarea', { class: 'in', rows: '2', maxlength: '500', 'aria-label': 'Lisensi' });
      s2.value = it.source || ''; l2.value = it.license || '';
      const save = h('button', { class: 'btn-sm', type: 'button', 'data-act': 'save', onclick: async () => {
        if (t2.value.trim().length < 3) { toast('Judul minimal 3 huruf.', true); return; }
        save.disabled = true;
        try { await updateAudio(it.id, { title: t2.value.trim(), source: s2.value.trim(), license: l2.value.trim() }); toast('Keterangan audio disimpan.'); await reload(); return; }
        catch (e) { fail(e, 'Belum tersimpan. '); }
        save.disabled = false;
      } }, 'Simpan');
      box2.replaceChildren(lab('Judul', t2), lab('Sumber', s2), lab('Lisensi / izin', l2), h('div', { class: 'row-btns' }, save, h('button', { class: 'btn-sm ghost', type: 'button', onclick: view }, 'Batal')));
    };
    const remove = async () => {
      if (!(await ask({ title: 'Hapus audio ini?', text: '"' + it.title + '" tidak akan tampil lagi untuk pengguna.', reason: false }))) return;
      try { await deleteAudio(it.id); removeAudio(it.path).catch(() => {}); toast('Audio dihapus.'); await reload(); }
      catch (e) { fail(e, 'Belum terhapus. '); }
    };
    view();
    return box2;
  }

  box.replaceChildren(back,
    h('div', { class: 'panel' }, h('h2', {}, 'Kelola Asmaul Husna'), h('p', { class: 'muted' }, 'Ubah penjelasan tiap nama dan kelola daftar audio lantunan. Perubahan langsung tampil untuk semua pengguna. Isi bawaan tetap aman: bisa dikembalikan kapan saja.')),
    h('div', { class: 'panel' }, h('h3', {}, 'Penjelasan nama (' + editedSet.size + ' diubah)'), search, listBox),
    formBox,
    h('div', { class: 'panel rform', id: 'am-audio' }, h('h3', {}, 'Audio lantunan lengkap (' + uploadedCount + ' dari ' + AUDIO_MAX_COUNT + ')'),
      h('p', { class: 'muted' }, items.length ? 'Pengguna memilih lantunan lewat daftar pilihan (dropdown) di halaman Asmaul Husna.' : 'Belum ada audio. Kartu lantunan tidak ditampilkan di halaman Asmaul Husna.'),
      h('div', { id: 'am-alist' }, ...items.map(itemCard)),
      h('h3', { class: 'mt' }, 'Tambah audio'),
      lab('Judul', title), lab('Sumber', source), lab('Lisensi / izin', lic),
      h('p', { class: 'hint' }, 'Pastikan Anda berhak memakai audio ini, dan mintalah ustaz memeriksa isi dan pelafalannya.'),
      lab('Berkas audio (MP3/M4A/OGG/WAV, maks. 15 MB)', file), aStatus,
      h('div', { class: 'row-btns' }, aAdd)));
  drawList();
}
