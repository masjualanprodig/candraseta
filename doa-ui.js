// BAITUNA - doa-ui.js
// Kumpulan Doa Shahih: (1) tampilan jamaah (kategori, pencarian, favorit, salin), (2) pengelolaan oleh Super Admin.
// Teks doa ditulis Super Admin lengkap dengan sumber & derajat; ayat diambil otomatis. Favorit hanya disimpan di perangkat.
import { h, toast, hint, ask } from './ui.js';
import { CATS, GRADES, KINDS, listDuas, createDua, updateDua, deleteDua, matches, copyText, loadFavs, saveFavs, toggleFav } from './doa-service.js';
import { listSurahs, loadAyat } from './quran-service.js';
import { applyReadingPrefs } from './quran-ui.js';
import { ayatBlock, refLabel } from './rukun-ui.js';
import { icon, ICONS } from './feed-ui.js';

const notReady = e => e && (e.code === '42P01' || e.code === 'PGRST205' || e.status === 404);
const PAGE = 30;

// Bagikan: lembar bagikan perangkat bila ada; jika tidak, buka WhatsApp dengan teks yang sama seperti Salin.
async function share(text) {
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    const w = window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
    if (!w) toast('Tidak bisa membuka WhatsApp. Gunakan tombol Salin.', true);
  } catch (e) { if (e && e.name === 'AbortError') return; toast('Tidak bisa membagikan. Gunakan tombol Salin.', true); }
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Doa disalin.'); } catch (e) { toast('Tidak bisa menyalin di perangkat ini.', true); }
}

/* ===== 1. Jamaah ===== */
export function doaPage(opts = {}) {
  const wrap = h('div', { class: 'doa' });
  applyReadingPrefs(wrap);
  let items = null, surahs = null, loadErr = null;
  let cat = opts.cat === 'favorit' ? 'favorit' : 'semua', q = '', shown = PAGE, favs = loadFavs();
  const content = h('div');
  const search = h('input', { class: 'in', type: 'search', placeholder: 'Cari doa (judul, arti, atau sumber)', 'aria-label': 'Cari doa', maxlength: '80', autocomplete: 'off' });
  search.addEventListener('input', () => { q = search.value; shown = PAGE; drawList(); });
  const list = h('div');
  const chipsBox = h('div', { class: 'achips', role: 'tablist', 'aria-label': 'Kategori doa' });

  function card(it) {
    const fav = favs.includes(it.id);
    const favB = h('button', { class: 'btn-sm ghost dfav', type: 'button', 'aria-pressed': String(fav) }, fav ? '★ Favorit' : '☆ Favorit');
    favB.addEventListener('click', () => { favs = toggleFav(loadFavs(), it.id); saveFavs(favs); drawChips(); if (cat === 'favorit') drawList(); else { const on = favs.includes(it.id); favB.textContent = on ? '★ Favorit' : '☆ Favorit'; favB.setAttribute('aria-pressed', String(on)); } });
    const body = it.kind === 'ayat' ? ayatBlock(it, surahs) : h('div', { class: 'dalil' },
      h('p', { class: 'arab', lang: 'ar', dir: 'rtl' }, it.arabic),
      it.latin ? h('p', { class: 'dlatin' }, it.latin) : '',
      h('p', { class: 'atrans prewrap' }, it.body));
    // Desain v79: baris ringkas (ikon, judul, kategori); diketuk untuk membuka isi doa lengkap.
    return h('details', { class: 'dcard dua' },
      h('summary', { class: 'dua-sum' }, h('span', { class: 'dua-ic' }, icon(it.kind === 'ayat' ? ICONS.quran : ICONS.doa)),
        h('span', { class: 'dhead' }, h('b', { class: 'dtitle' }, it.title || (it.kind === 'ayat' ? refLabel(surahs, it) : 'Doa')),
          h('span', { class: 'dcat muted' }, CATS[it.category] || CATS.lainnya)),
        icon(ICONS.chev, 'dua-chev')),
      h('div', { class: 'dbody' },
      it.grade ? h('span', { class: 'hperiod grade ' + it.grade }, GRADES[it.grade]) : '',
      body,
      it.source ? h('p', { class: 'dsrc' }, h('b', {}, 'Sumber: '), it.source) : '',
      it.grading ? h('p', { class: 'dsrc' }, h('b', {}, 'Keterangan derajat: '), it.grading) : '',
      it.note ? h('p', { class: 'dnote prewrap' }, it.note) : '',
      h('div', { class: 'row-btns dctl' },
        it.kind === 'teks' ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => copy(copyText(it)) }, 'Salin') : '',
        it.kind === 'teks' ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => share(copyText(it)) }, 'Bagikan') : '', favB)));
  }

  function drawChips() {
    const mk = (k, l) => h('button', { class: 'achip', type: 'button', role: 'tab', 'aria-selected': String(cat === k), onclick: () => { cat = k; shown = PAGE; drawChips(); drawList(); } }, l);
    const present = new Set((items || []).map(i => i.category));
    chipsBox.replaceChildren(mk('semua', 'Semua'), mk('favorit', '★ Favorit' + (favs.length ? ' (' + favs.length + ')' : '')),
      ...Object.keys(CATS).filter(k => present.has(k)).map(k => mk(k, CATS[k])));
  }

  function drawList() {
    favs = loadFavs();
    if (loadErr) {
      list.replaceChildren(h('div', { class: 'empty' }, h('p', { class: 'muted' }, notReady(loadErr) ? 'Kumpulan doa belum aktif. Admin pusat perlu menjalankan doa.sql.' : 'Doa belum bisa dimuat. Periksa koneksi, lalu coba lagi.'),
        notReady(loadErr) ? '' : h('button', { class: 'btn-sm', type: 'button', onclick: load }, 'Coba lagi')));
      return;
    }
    if (!items) { list.replaceChildren(h('p', { class: 'muted center' }, 'Memuat doa…')); return; }
    if (!items.length) { list.replaceChildren(h('div', { class: 'empty' }, h('p', { class: 'muted' }, 'Doa belum ditambahkan oleh admin pusat. Setiap doa akan dicantumkan lengkap dengan sumber haditsnya dan derajatnya.'))); return; }
    let rows = items.filter(i => (cat === 'semua' || (cat === 'favorit' ? favs.includes(i.id) : i.category === cat)) && matches(i, q));
    if (!rows.length) {
      list.replaceChildren(h('div', { class: 'empty' }, h('p', { class: 'muted' }, cat === 'favorit' && !q.trim() ? 'Belum ada doa favorit. Ketuk ☆ Favorit pada doa yang ingin disimpan di perangkat ini.' : 'Tidak ada doa yang cocok.')));
      return;
    }
    const total = rows.length; rows = rows.slice(0, shown);
    list.replaceChildren(h('p', { class: 'muted dcount' }, total + ' doa'), ...rows.map(card),
      total > shown ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { shown += PAGE; drawList(); } }, 'Tampilkan lebih banyak') : '');
  }

  const note = () => h('div', { class: 'panel qnote' }, h('h3', {}, 'Tentang halaman ini'),
    h('p', { class: 'muted' }, 'Setiap doa ditulis oleh admin pusat BAITUNA dengan menyebut sumber hadits, derajat (shahih atau hasan), dan siapa yang menilai derajat tersebut. Doa yang derajatnya lemah tidak dimuat. Ayat Al-Qur’an diambil otomatis dari AlQuran Cloud dan tidak diubah. Untuk pertanyaan tentang tata cara dan keutamaan, tanyakan kepada ustaz atau ulama yang terpercaya. Favorit hanya tersimpan di perangkat Anda.'));

  function draw() {
    content.replaceChildren(h('h2', { class: 'wtitle' }, 'Doa Shahih'),
      h('p', { class: 'muted' }, 'Kumpulan doa sesuai sunnah, lengkap dengan sumber dan derajatnya.'),
      search, chipsBox, list, note());
    drawChips(); drawList();
  }
  function load() {
    loadErr = null; items = null; draw();
    Promise.all([listDuas(), listSurahs().catch(() => null)]).then(([rows, s]) => { items = rows; surahs = s; draw(); })
      .catch(e => { loadErr = e || new Error('x'); draw(); });
  }
  wrap.append(content);
  load();
  return wrap;
}

/* ===== 2. Super Admin ===== */
export async function renderDuaManager(box, onBack) {
  let rows, surahs = null;
  try { [rows, surahs] = await Promise.all([listDuas(), listSurahs().catch(() => null)]); }
  catch (e) {
    if (e && e.status === 401) return;
    box.replaceChildren(onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '',
      h('div', { class: 'panel center' }, h('p', {}, notReady(e) ? 'Fitur ini belum aktif. Jalankan doa.sql di Supabase SQL Editor.' : 'Data belum bisa dimuat. Periksa koneksi, lalu coba lagi.'),
        h('button', { class: 'btn-sm', type: 'button', onclick: () => renderDuaManager(box, onBack) }, 'Coba lagi')));
    return;
  }
  const reload = () => renderDuaManager(box, onBack);
  let editing = null;

  const category = h('select', { class: 'in', 'aria-label': 'Kategori' }, ...Object.keys(CATS).map(k => h('option', { value: k }, CATS[k])));
  const kind = h('select', { class: 'in', 'aria-label': 'Jenis' }, ...Object.keys(KINDS).map(k => h('option', { value: k }, KINDS[k])));
  const title = h('input', { class: 'in', placeholder: 'Judul, mis. nama situasi doa (opsional)', maxlength: '150', autocomplete: 'off' });
  const arabic = h('textarea', { class: 'in arab-in', lang: 'ar', dir: 'rtl', placeholder: 'Teks Arab (wajib)', maxlength: '4000' });
  const latin = h('textarea', { class: 'in', placeholder: 'Teks Latin (opsional)', maxlength: '4000' });
  const body = h('textarea', { class: 'in tall', placeholder: 'Terjemahan bahasa Indonesia (wajib)', maxlength: '4000' });
  const grade = h('select', { class: 'in', 'aria-label': 'Derajat hadits' }, h('option', { value: '' }, 'Pilih derajat hadits…'), ...Object.keys(GRADES).map(k => h('option', { value: k }, GRADES[k])));
  const grading = h('textarea', { class: 'in', placeholder: 'Keterangan derajat: siapa yang menilai dan di kitab apa (wajib), mis. nama ulama + judul kitab + nomor', maxlength: '500' });
  const surahSel = h('select', { class: 'in', 'aria-label': 'Surat' }, ...(surahs || Array.from({ length: 114 }, (_, i) => ({ number: i + 1, latin: 'Surat ' + (i + 1) }))).map(s => h('option', { value: String(s.number) }, s.number + '. ' + s.latin)));
  const from = h('input', { class: 'in', type: 'number', inputmode: 'numeric', min: '1', max: '286', placeholder: 'Ayat awal' });
  const to = h('input', { class: 'in', type: 'number', inputmode: 'numeric', min: '1', max: '286', placeholder: 'Ayat akhir (kosongkan bila satu ayat)' });
  const preview = h('div', { class: 'dalil', hidden: true });
  const previewBtn = h('button', { class: 'btn-sm ghost', type: 'button' }, 'Lihat pratinjau ayat');
  const source = h('textarea', { class: 'in', placeholder: 'Sumber, mis. HR. Bukhari no. … (wajib untuk teks)', maxlength: '500' });
  const note = h('textarea', { class: 'in', placeholder: 'Keterangan singkat (opsional)', maxlength: '1000' });
  const order = h('input', { class: 'in', type: 'number', inputmode: 'numeric', min: '0', max: '9999', value: '100', 'aria-label': 'Urutan' });
  const fTeks = h('div', {}, arabic, latin, body, source, grade, grading);
  const fAyat = h('div', {}, h('label', { class: 'hint' }, 'Ayat Al-Qur’an: hanya rujukan yang disimpan. Teks Arab dan terjemahnya diambil otomatis dari layanan Al-Qur’an.'), surahSel, from, to, previewBtn, preview);
  const place = () => { fTeks.hidden = kind.value !== 'teks'; fAyat.hidden = kind.value !== 'ayat'; };
  kind.addEventListener('change', place);

  function readAyat() {
    const a1 = Number(from.value), a2 = to.value.trim() === '' ? a1 : Number(to.value);
    if (!Number.isInteger(a1) || !Number.isInteger(a2) || a1 < 1 || a2 < a1) { toast('Isi nomor ayat dengan benar (ayat akhir tidak boleh lebih kecil dari ayat awal).', true); return null; }
    if (a2 - a1 > 5) { toast('Maksimal 6 ayat berurutan per rujukan.', true); return null; }
    return { surah: Number(surahSel.value), ayah_from: a1, ayah_to: a2 };
  }
  previewBtn.addEventListener('click', async () => {
    const f = readAyat(); if (!f) return;
    preview.hidden = false; preview.replaceChildren(h('p', { class: 'muted' }, 'Memuat…'));
    try {
      const r = await loadAyat(f.surah, f.ayah_from, f.ayah_to);
      preview.replaceChildren(h('p', { class: 'dref' }, refLabel(surahs, f)), ...r.map(a => h('div', {}, h('p', { class: 'arab', lang: 'ar', dir: 'rtl' }, a.ar), h('p', { class: 'atrans' }, a.n + '. ' + a.id))));
    } catch { preview.replaceChildren(h('p', { class: 'muted' }, 'Ayat tidak ditemukan atau belum bisa dimuat. Periksa nomor ayat dan koneksi.')); }
  });

  const formTitle = h('h3', {}, 'Tambah doa');
  const status = h('p', { class: 'hint' }, '');
  const save = h('button', { class: 'btn-sm', type: 'submit' }, 'Simpan');
  const cancel = h('button', { class: 'btn-sm ghost', type: 'button', hidden: true, onclick: reload }, 'Batal ubah');

  const form = h('form', {
    class: 'panel rform', novalidate: 'novalidate',
    onsubmit: async ev => {
      ev.preventDefault();
      const k = editing ? editing.kind : kind.value;
      const so = Number(order.value);
      if (!Number.isInteger(so) || so < 0 || so > 9999) { toast('Urutan harus bilangan bulat 0 sampai 9999.', true); return; }
      let f = { category: category.value, title: title.value.trim(), note: note.value.trim(), sort_order: so, source: source.value.trim() };
      if (k === 'ayat') { const a = readAyat(); if (!a) return; f = { ...f, ...a }; }
      else {
        f = { ...f, arabic: arabic.value.trim(), latin: latin.value.trim(), body: body.value.trim(), grade: grade.value, grading: grading.value.trim() };
        if (f.arabic.length < 3) { toast('Teks Arab wajib diisi.', true); return; }
        if (f.body.length < 3) { toast('Terjemahan wajib diisi.', true); return; }
        if (f.source.length < 3) { toast('Sumber wajib diisi (perawi dan nomor hadits).', true); return; }
        if (!GRADES[f.grade]) { toast('Pilih derajat hadits (shahih atau hasan). Hadits yang lemah tidak boleh dimuat.', true); return; }
        if (f.grading.length < 3) { toast('Keterangan derajat wajib diisi: siapa yang menilai dan di kitab apa.', true); return; }
      }
      save.disabled = true;
      try {
        if (editing) await updateDua(editing.id, k, f); else await createDua(k, f);
        toast(editing ? 'Perubahan disimpan.' : 'Doa ditambahkan.');
        await reload(); return;
      } catch (e) {
        if (e && e.status === 401) return;
        const msg = e && e.status === 0 ? 'Tidak ada koneksi internet.' : 'Belum tersimpan. ' + hint(e);
        status.textContent = msg; toast(msg, true);
      }
      save.disabled = false;
    }
  }, formTitle, h('div', { class: 'grid2' }, category, kind), title, fTeks, fAyat, note,
    status, h('div', { class: 'mt row-btns' }, save, cancel));
  place();

  function edit(e) {
    editing = e; formTitle.textContent = 'Ubah doa';
    kind.value = e.kind; kind.disabled = true; place();
    category.value = e.category; title.value = e.title || ''; source.value = e.source || ''; note.value = e.note || ''; order.value = String(e.sort_order);
    if (e.kind === 'ayat') { surahSel.value = String(e.surah); from.value = e.ayah_from; to.value = e.ayah_to === e.ayah_from ? '' : e.ayah_to; }
    else { arabic.value = e.arabic || ''; latin.value = e.latin || ''; body.value = e.body || ''; grade.value = e.grade || ''; grading.value = e.grading || ''; }
    cancel.hidden = false; form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const label = it => it.title || (it.kind === 'ayat' ? refLabel(surahs, it) : (it.source || 'Doa'));
  const item = it => h('div', { class: 'post' }, h('div', { class: 'fi-main' },
    it.grade ? h('span', { class: 'hperiod' }, GRADES[it.grade]) : '', ' ', h('b', {}, label(it)),
    h('div', { class: 'muted' }, it.kind === 'ayat' ? 'Ayat · teks diambil otomatis' : (it.body || '').slice(0, 90) + ((it.body || '').length > 90 ? '…' : '')),
    h('div', { class: 'row-btns mt' },
      h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => edit(it) }, 'Ubah'),
      h('button', { class: 'btn-sm alt', type: 'button', onclick: async () => {
        if (!(await ask({ title: 'Hapus doa ini?', text: label(it) + ' akan dihapus dan tidak bisa dikembalikan.', reason: false }))) return;
        try { await deleteDua(it.id); toast('Dihapus.'); await reload(); } catch (er) { if (er.status !== 401) toast('Gagal menghapus. ' + hint(er), true); }
      } }, 'Hapus'))));

  const group = k => { const list = rows.filter(r => r.category === k); return list.length ? h('div', { class: 'panel' }, h('h3', {}, CATS[k] + ' (' + list.length + ')'), list.map(item)) : ''; };
  box.replaceChildren(...[
    onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '',
    h('h2', { class: 'mt' }, 'Kelola Doa Shahih'),
    h('p', { class: 'muted' }, 'Hanya Super Admin yang bisa mengubah. Setiap doa dari hadits wajib memuat teks Arab, terjemahan, sumber (perawi dan nomor), derajat (shahih atau hasan), dan keterangan siapa yang menilai derajatnya. Hadits yang lemah tidak bisa disimpan. Sebaiknya diperiksa ustaz sebelum diumumkan.'),
    form, ...Object.keys(CATS).map(group), rows.length ? '' : h('div', { class: 'panel' }, h('p', { class: 'muted' }, 'Belum ada doa.'))
  ].flat());
  window.scrollTo(0, 0);
}
