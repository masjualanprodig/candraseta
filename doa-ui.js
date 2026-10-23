// BAITUNA - doa-ui.js
// Kumpulan Doa Shahih: (1) tampilan jamaah (kategori, pencarian, favorit, salin), (2) pengelolaan oleh Super Admin.
// Teks doa ditulis Super Admin lengkap dengan sumber & derajat; ayat diambil otomatis. Favorit hanya disimpan di perangkat.
import { h, toast, hint, ask } from './ui.js';
import { renderDuaImport, downloadTemplate, svg, P } from './doa-import-ui.js';
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
  const cancel = h('button', { class: 'btn-sm ghost', type: 'button', hidden: true, onclick: () => showList() }, 'Batal');

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

  function fillForm(e) {
    editing = e; formTitle.textContent = 'Ubah doa';
    kind.value = e.kind; kind.disabled = true; place();
    category.value = e.category; title.value = e.title || ''; source.value = e.source || ''; note.value = e.note || ''; order.value = String(e.sort_order);
    if (e.kind === 'ayat') { surahSel.value = String(e.surah); from.value = e.ayah_from; to.value = e.ayah_to === e.ayah_from ? '' : e.ayah_to; }
    else { arabic.value = e.arabic || ''; latin.value = e.latin || ''; body.value = e.body || ''; grade.value = e.grade || ''; grading.value = e.grading || ''; }
    cancel.hidden = false;
  }
  function showForm(e) {
    if (e) fillForm(e);
    box.replaceChildren(h('button', { class: 'btn-sm ghost', type: 'button', id: 'dm-formback', onclick: () => showList() }, '← Kembali ke daftar'),
      h('h2', { class: 'mt' }, e ? 'Ubah Doa' : 'Tambah Doa Manual'), form);
    window.scrollTo(0, 0);
  }
  function showImport() {
    renderDuaImport(box, { onBack: () => showList(), onDone: reload });
  }

  /* ----- Halaman daftar ----- */
  const CATIC = { harian: '☀️', tidur: '🌙', makan: '🍽️', masjid: '🕌', bersuci: '💧', pakaian: '🏠', perjalanan: '🧭', sakit: '🩺', ampunan: '🤲', keluarga: '👪', lainnya: '📿' };
  const label = it => it.title || (it.kind === 'ayat' ? refLabel(surahs, it) : (it.source || 'Doa'));
  const st = { q: '', cat: '', grade: '', kind: '', filt: false, open: new Set(), menu: null };
  function showList() {
    editing = null;
    const list = h('div', { id: 'dm-list' }), chips = h('div', { class: 'dm-chips', id: 'dm-chips' }), filt = h('div', { class: 'dm-filt', id: 'dm-filt', hidden: true });
    const search = h('input', { class: 'in', id: 'dm-q', type: 'search', placeholder: 'Cari judul atau kategori…', value: st.q, 'aria-label': 'Cari doa', autocomplete: 'off' });
    const gSel = h('select', { class: 'in', id: 'dm-fg', 'aria-label': 'Derajat' }, h('option', { value: '' }, 'Semua derajat'), ...Object.keys(GRADES).map(k => h('option', { value: k }, GRADES[k])));
    const kSel = h('select', { class: 'in', id: 'dm-fk', 'aria-label': 'Jenis' }, h('option', { value: '' }, 'Semua jenis'), ...Object.keys(KINDS).map(k => h('option', { value: k }, KINDS[k])));
    gSel.value = st.grade; kSel.value = st.kind; filt.hidden = !st.filt; filt.append(gSel, kSel);
    const pass = it => (!st.cat || it.category === st.cat) && (!st.grade || it.grade === st.grade) && (!st.kind || it.kind === st.kind) && matchQ(it, st.q);
    const matchQ = (it, q) => { if (!q.trim()) return true; return matches(it, q) || matches({ title: CATS[it.category] }, q) || (it.kind === 'ayat' && matches({ title: refLabel(surahs, it) }, q)); };
    function draw() {
      chips.replaceChildren(h('button', { class: 'dm-chip' + (!st.cat ? ' on' : ''), type: 'button', 'data-cat': '', onclick: () => { st.cat = ''; draw(); } }, 'Semua (' + rows.length + ')'),
        ...Object.keys(CATS).map(k => { const n = rows.filter(r => r.category === k).length; return n ? h('button', { class: 'dm-chip' + (st.cat === k ? ' on' : ''), type: 'button', 'data-cat': k, onclick: () => { st.cat = k; draw(); } }, CATS[k] + ' (' + n + ')') : ''; }));
      const shown = rows.filter(pass);
      list.replaceChildren(...(shown.length ? shown.map(card) : [h('div', { class: 'panel center', id: 'dm-empty' }, h('p', { class: 'muted' }, rows.length ? 'Tidak ada doa yang cocok dengan pencarian atau filter.' : 'Belum ada doa. Impor dari Excel atau tambah satu doa secara manual.'),
        rows.length ? '' : h('button', { class: 'btn-sm', type: 'button', onclick: showImport }, 'Import dari Excel'))]));
    }
    function card(it) {
      const open = st.open.has(it.id), menuOn = st.menu === it.id;
      const grd = it.grade ? h('span', { class: 'dm-badge ' + it.grade }, GRADES[it.grade]) : h('span', { class: 'dm-badge ayat' }, 'Ayat');
      const kids = [h('div', { class: 'dm-ic' }, CATIC[it.category] || '📿'),
        h('div', { class: 'dm-main' },
          h('div', { class: 'dm-top' }, h('b', { class: 'dm-t' }, label(it)),
            h('button', { class: 'dm-dots', type: 'button', 'aria-label': 'Menu tindakan', 'aria-expanded': String(menuOn), onclick: () => { st.menu = menuOn ? null : it.id; draw(); } }, svg(P.dots || '<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>'))),
          it.kind === 'ayat' ? '' : h('p', { class: 'dm-ar', lang: 'ar', dir: 'rtl' }, it.arabic || ''),
          h('p', { class: 'dm-tr' }, it.kind === 'ayat' ? 'Ayat Al-Qur’an · teks diambil otomatis' : (it.body || '')),
          h('div', { class: 'dm-meta' }, h('span', { class: 'muted' }, CATS[it.category]), it.source ? h('span', { class: 'muted' }, ' · ' + it.source) : '', ' ', grd))];
      const extra = [];
      if (menuOn) extra.push(h('div', { class: 'dm-menu' },
        h('button', { class: 'btn-sm ghost dm-m-detail', type: 'button', onclick: () => { st.menu = null; open ? st.open.delete(it.id) : st.open.add(it.id); draw(); } }, open ? 'Tutup detail' : 'Lihat detail'),
        h('button', { class: 'btn-sm ghost dm-m-edit', type: 'button', onclick: () => showForm(it) }, 'Ubah'),
        h('button', { class: 'btn-sm alt dm-m-del', type: 'button', onclick: async () => {
          if (!(await ask({ title: 'Hapus doa ini?', text: label(it) + ' akan dihapus dan tidak bisa dikembalikan.', reason: false }))) return;
          try { await deleteDua(it.id); toast('Dihapus.'); await reload(); } catch (er) { if (er.status !== 401) toast('Gagal menghapus. ' + hint(er), true); }
        } }, 'Hapus')));
      if (open) extra.push(h('dl', { class: 'dm-detail' },
        ...(it.kind === 'ayat' ? [h('dt', {}, 'Rujukan'), h('dd', {}, refLabel(surahs, it))] : [h('dt', {}, 'Teks Arab'), h('dd', { class: 'dm-ar', lang: 'ar', dir: 'rtl' }, it.arabic || ''), it.latin ? h('dt', {}, 'Latin') : '', it.latin ? h('dd', {}, it.latin) : '',
          h('dt', {}, 'Terjemahan'), h('dd', {}, it.body || ''), h('dt', {}, 'Sumber'), h('dd', {}, it.source || ''), h('dt', {}, 'Derajat'), h('dd', {}, (GRADES[it.grade] || '') + (it.grading ? ' · ' + it.grading : ''))]),
        it.note ? h('dt', {}, 'Keterangan') : '', it.note ? h('dd', {}, it.note) : ''));
      return h('div', { class: 'dm-card', 'data-id': it.id }, h('div', { class: 'dm-row' }, ...kids), ...extra);
    }
    search.addEventListener('input', () => { st.q = search.value; draw(); });
    gSel.addEventListener('change', () => { st.grade = gSel.value; draw(); });
    kSel.addEventListener('change', () => { st.kind = kSel.value; draw(); });
    const filBtn = h('button', { class: 'dm-fbtn', type: 'button', id: 'dm-fbtn', 'aria-expanded': String(st.filt), onclick: () => { st.filt = !st.filt; filt.hidden = !st.filt; filBtn.setAttribute('aria-expanded', String(st.filt)); } }, svg('<path d="M4 7h16M7 12h10M10 17h4"/>'), 'Filter');
    box.replaceChildren(
      onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '',
      h('div', { class: 'dm-hero' }, h('div', {}, h('h2', {}, 'Kelola Doa Shahih'), h('p', { class: 'muted' }, 'Kelola kumpulan doa berdasarkan hadis yang shahih untuk fitur Doa Harian di aplikasi BAITUNA. Hanya Super Admin yang bisa mengubah; sebaiknya ditinjau ustaz sebelum diumumkan.')), svg(P.mosque, 'ic dm-heroic')),
      h('div', { class: 'dm-tiles' },
        h('button', { class: 'dm-tile main', type: 'button', id: 'dm-import', onclick: showImport }, svg(P.xl, 'ic dm-tic'), h('span', {}, h('b', {}, 'Import dari Excel/Spreadsheet'), h('small', {}, 'Tambah banyak doa sekaligus'))),
        h('button', { class: 'dm-tile', type: 'button', id: 'dm-tpl', onclick: downloadTemplate }, svg(P.file, 'ic dm-tic'), h('span', {}, h('b', {}, 'Download Template Excel'), h('small', {}, 'Gunakan template untuk import')))),
      h('div', { class: 'dm-tools' }, h('div', { class: 'dm-search' }, svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>'), search), filBtn),
      filt, chips, list,
      h('div', { class: 'dm-fab' }, h('button', { class: 'dm-add', type: 'button', id: 'dm-add', onclick: () => showForm(null) }, svg('<path d="M12 5v14M5 12h14"/>'), 'Tambah Doa Manual')));
    draw(); window.scrollTo(0, 0);
  }
  showList();
}
