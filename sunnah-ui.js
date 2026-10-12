// BAITUNA - sunnah-ui.js
// Amalan Sunnah Harian: (1) tampilan jamaah (kelompok waktu, pencarian, centang harian di perangkat), (2) pengelolaan oleh Super Admin.
// Isi ditulis Super Admin dengan sumber, derajat, dan penilai derajat. Centang hanya tersimpan di perangkat pengguna.
import { h, toast, hint, ask } from './ui.js';
import { SLOTS, GRADES, listSunnah, createSunnah, updateSunnah, deleteSunnah, matches, copyText, loadDone, saveDone, toggleDone } from './sunnah-service.js';
import { applyReadingPrefs } from './quran-ui.js';

const notReady = e => e && (e.code === '42P01' || e.code === 'PGRST205' || e.status === 404);
const PAGE = 30;

async function copy(text) { try { await navigator.clipboard.writeText(text); toast('Amalan disalin.'); } catch (e) { toast('Tidak bisa menyalin di perangkat ini.', true); } }
async function share(text) {
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    const w = window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
    if (!w) toast('Tidak bisa membuka WhatsApp. Gunakan tombol Salin.', true);
  } catch (e) { if (e && e.name === 'AbortError') return; toast('Tidak bisa membagikan. Gunakan tombol Salin.', true); }
}

/* ===== 1. Jamaah ===== */
export function sunnahPage() {
  const wrap = h('div', { class: 'sunnah' });
  applyReadingPrefs(wrap);
  let items = null, loadErr = null, slot = 'semua', q = '', shown = PAGE, done = loadDone();
  const content = h('div');
  const search = h('input', { class: 'in', type: 'search', placeholder: 'Cari amalan (judul, isi, atau sumber)', 'aria-label': 'Cari amalan', maxlength: '80', autocomplete: 'off' });
  search.addEventListener('input', () => { q = search.value; shown = PAGE; drawList(); });
  const chipsBox = h('div', { class: 'achips', role: 'tablist', 'aria-label': 'Waktu amalan' });
  const sum = h('div', { class: 'dsum panel' }), list = h('div');

  function paintSum() {
    if (!items || !items.length) { sum.hidden = true; return; }
    done = loadDone(); sum.hidden = false;
    const n = items.filter(i => done.ids.includes(i.id)).length;
    sum.replaceChildren(h('p', { class: 'dsum-t' }, n === items.length ? 'Alhamdulillah, semua amalan hari ini sudah Anda centang (' + n + ' dari ' + items.length + ').' : n + ' dari ' + items.length + ' amalan sudah dicentang hari ini.'),
      h('div', { class: 'dbar', role: 'img', 'aria-label': n + ' dari ' + items.length + ' amalan dicentang' }, h('i', { style: 'width:' + Math.round(n / items.length * 100) + '%' })),
      h('p', { class: 'muted sunnah-priv' }, 'Centang hanya tersimpan di perangkat ini dan kosong lagi besok.'));
  }

  function card(it) {
    const cb = h('input', { type: 'checkbox', 'aria-label': 'Sudah dikerjakan hari ini: ' + it.title });
    cb.checked = done.ids.includes(it.id);
    const art = h('article', { class: 'dcard panel sunnah-card' + (cb.checked ? ' done' : '') });
    cb.addEventListener('change', () => { done = toggleDone(loadDone(), it.id); saveDone(done); art.classList.toggle('done', cb.checked); paintSum(); });
    art.append(
      h('div', { class: 'dhead' }, h('b', { class: 'dtitle' }, it.title), h('span', { class: 'hperiod grade ' + it.grade }, GRADES[it.grade] || '')),
      h('span', { class: 'dcat muted' }, SLOTS[it.time_slot] || SLOTS.harian),
      h('p', { class: 'atrans prewrap' }, it.body),
      it.arabic ? h('p', { class: 'arab', lang: 'ar', dir: 'rtl' }, it.arabic) : '',
      it.latin ? h('p', { class: 'dlatin' }, it.latin) : '',
      h('p', { class: 'dsrc' }, h('b', {}, 'Sumber: '), it.source),
      h('p', { class: 'dsrc' }, h('b', {}, 'Keterangan derajat: '), it.grading),
      it.note ? h('p', { class: 'dnote prewrap' }, it.note) : '',
      h('label', { class: 'dopt sunnah-check' }, cb, h('span', {}, 'Sudah saya kerjakan hari ini')),
      h('div', { class: 'row-btns dctl' },
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => copy(copyText(it)) }, 'Salin'),
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => share(copyText(it)) }, 'Bagikan')));
    return art;
  }

  function drawChips() {
    const mk = (k, l) => h('button', { class: 'achip', type: 'button', role: 'tab', 'aria-selected': String(slot === k), onclick: () => { slot = k; shown = PAGE; drawChips(); drawList(); } }, l);
    const present = new Set((items || []).map(i => i.time_slot));
    chipsBox.replaceChildren(mk('semua', 'Semua'), ...Object.keys(SLOTS).filter(k => present.has(k)).map(k => mk(k, SLOTS[k])));
  }

  function drawList() {
    if (loadErr) { list.replaceChildren(h('div', { class: 'empty' }, h('p', { class: 'muted' }, notReady(loadErr) ? 'Amalan sunnah belum aktif. Admin pusat perlu menjalankan sunnah.sql.' : 'Amalan belum bisa dimuat. Periksa koneksi, lalu coba lagi.'), notReady(loadErr) ? '' : h('button', { class: 'btn-sm', type: 'button', onclick: load }, 'Coba lagi'))); return; }
    if (!items) { list.replaceChildren(h('p', { class: 'muted center' }, 'Memuat amalan…')); return; }
    if (!items.length) { list.replaceChildren(h('div', { class: 'empty' }, h('p', { class: 'muted' }, 'Amalan sunnah belum ditambahkan oleh admin pusat. Setiap amalan akan dicantumkan lengkap dengan sumber haditsnya dan derajatnya.'))); return; }
    let rows = items.filter(i => (slot === 'semua' || i.time_slot === slot) && matches(i, q));
    if (!rows.length) { list.replaceChildren(h('div', { class: 'empty' }, h('p', { class: 'muted' }, 'Tidak ada amalan yang cocok.'))); return; }
    const total = rows.length; rows = rows.slice(0, shown);
    list.replaceChildren(h('p', { class: 'muted dcount' }, total + ' amalan'), ...rows.map(card),
      total > shown ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { shown += PAGE; drawList(); } }, 'Tampilkan lebih banyak') : '');
  }

  const note = () => h('div', { class: 'panel qnote' }, h('h3', {}, 'Tentang halaman ini'),
    h('p', { class: 'muted' }, 'Amalan sunnah adalah amalan yang dianjurkan, bukan pengganti kewajiban. Setiap amalan ditulis oleh admin pusat BAITUNA dengan menyebut sumber hadits, derajat (shahih atau hasan), dan siapa yang menilai derajat tersebut. Amalan yang derajatnya lemah tidak dimuat. Tanyakan kepada ustaz atau ulama yang terpercaya untuk tata cara, waktu, dan keutamaannya. BAITUNA tidak menentukan batas waktu ibadah dan tidak mengirim pengingat otomatis.'));

  function draw() { content.replaceChildren(h('h2', { class: 'wtitle' }, 'Amalan Sunnah Harian'), h('p', { class: 'muted' }, 'Amalan yang dianjurkan, lengkap dengan sumber dan derajatnya.'), sum, search, chipsBox, list, note()); paintSum(); drawChips(); drawList(); }
  function load() { loadErr = null; items = null; draw(); listSunnah().then(r => { items = r; draw(); }).catch(e => { loadErr = e || new Error('x'); draw(); }); }
  wrap.append(content); load();
  return wrap;
}

/* ===== 2. Super Admin ===== */
export async function renderSunnahManager(box, onBack) {
  let rows;
  try { rows = await listSunnah(); }
  catch (e) {
    if (e && e.status === 401) return;
    box.replaceChildren(onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '',
      h('div', { class: 'panel center' }, h('p', {}, notReady(e) ? 'Fitur ini belum aktif. Jalankan sunnah.sql di Supabase SQL Editor.' : 'Data belum bisa dimuat. Periksa koneksi, lalu coba lagi.'),
        h('button', { class: 'btn-sm', type: 'button', onclick: () => renderSunnahManager(box, onBack) }, 'Coba lagi')));
    return;
  }
  const reload = () => renderSunnahManager(box, onBack);
  let editing = null;
  const slotSel = h('select', { class: 'in', 'aria-label': 'Waktu' }, ...Object.keys(SLOTS).map(k => h('option', { value: k }, SLOTS[k])));
  const title = h('input', { class: 'in', placeholder: 'Judul amalan (wajib)', maxlength: '150', autocomplete: 'off', 'aria-label': 'Judul amalan' });
  const body = h('textarea', { class: 'in tall', placeholder: 'Penjelasan amalan dalam bahasa Indonesia (wajib)', maxlength: '4000', 'aria-label': 'Penjelasan' });
  const arabic = h('textarea', { class: 'in arab-in', lang: 'ar', dir: 'rtl', placeholder: 'Teks Arab (opsional, bila berupa doa/dzikir)', maxlength: '4000' });
  const latin = h('textarea', { class: 'in', placeholder: 'Teks Latin (opsional)', maxlength: '4000' });
  const source = h('textarea', { class: 'in', rows: '2', placeholder: 'Sumber, mis. HR. Muslim no. … (wajib)', maxlength: '500', 'aria-label': 'Sumber' });
  const grade = h('select', { class: 'in', 'aria-label': 'Derajat hadits' }, h('option', { value: '' }, 'Pilih derajat hadits…'), ...Object.keys(GRADES).map(k => h('option', { value: k }, GRADES[k])));
  const grading = h('textarea', { class: 'in', rows: '2', placeholder: 'Keterangan derajat: siapa yang menilai dan di kitab apa (wajib)', maxlength: '500', 'aria-label': 'Keterangan derajat' });
  const note = h('textarea', { class: 'in', placeholder: 'Keterangan singkat (opsional)', maxlength: '1000' });
  const lab = (t, el) => h('label', { class: 'flab' }, h('span', { class: 'hint' }, t), el);
  const formTitle = h('h3', {}, 'Tambah amalan'), status = h('p', { class: 'hint' }, '');
  const save = h('button', { class: 'btn-sm', type: 'submit' }, 'Simpan');
  const cancel = h('button', { class: 'btn-sm ghost', type: 'button', hidden: true, onclick: reload }, 'Batal ubah');
  const form = h('form', { class: 'panel rform', novalidate: 'novalidate', onsubmit: async ev => {
    ev.preventDefault();
    const f = { time_slot: slotSel.value, title: title.value.trim(), body: body.value.trim(), arabic: arabic.value.trim(), latin: latin.value.trim(), source: source.value.trim(), grade: grade.value, grading: grading.value.trim(), note: note.value.trim() };
    if (!editing) f.sort_order = 100; // urutan otomatis: yang lama tampil dulu
    if (f.title.length < 3) { toast('Judul minimal 3 huruf.', true); return; }
    if (f.body.length < 10) { toast('Penjelasan minimal 10 huruf.', true); return; }
    if (f.source.length < 3) { toast('Sumber wajib diisi (perawi dan nomor hadits).', true); return; }
    if (!GRADES[f.grade]) { toast('Pilih derajat hadits (shahih atau hasan). Hadits yang lemah tidak boleh dimuat.', true); return; }
    if (f.grading.length < 3) { toast('Keterangan derajat wajib diisi: siapa yang menilai dan di kitab apa.', true); return; }
    save.disabled = true;
    try { if (editing) await updateSunnah(editing.id, f); else await createSunnah(f); toast(editing ? 'Perubahan disimpan.' : 'Amalan ditambahkan.'); await reload(); return; }
    catch (e) { if (e && e.status === 401) return; const m = e && e.status === 0 ? 'Tidak ada koneksi internet.' : 'Belum tersimpan. ' + hint(e); status.textContent = m; toast(m, true); }
    save.disabled = false;
  } }, formTitle, lab('Waktu', slotSel), lab('Judul amalan *', title), lab('Penjelasan *', body), lab('Teks Arab (opsional)', arabic), lab('Teks Latin (opsional)', latin), lab('Sumber (perawi dan nomor) *', source), lab('Derajat hadits *', grade), lab('Keterangan derajat (penilai dan kitab) *', grading), lab('Keterangan singkat (opsional)', note),
    status, h('div', { class: 'mt row-btns' }, save, cancel));

  function edit(e) {
    editing = e; formTitle.textContent = 'Ubah amalan';
    slotSel.value = e.time_slot; title.value = e.title; body.value = e.body; arabic.value = e.arabic || ''; latin.value = e.latin || '';
    source.value = e.source; grade.value = e.grade; grading.value = e.grading; note.value = e.note || '';
    cancel.hidden = false; form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const item = it => h('div', { class: 'post' }, h('div', { class: 'fi-main' },
    h('span', { class: 'hperiod' }, GRADES[it.grade]), ' ', h('b', {}, it.title),
    h('div', { class: 'muted' }, (it.body || '').slice(0, 90) + ((it.body || '').length > 90 ? '…' : '')),
    h('div', { class: 'row-btns mt' },
      h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => edit(it) }, 'Ubah'),
      h('button', { class: 'btn-sm alt', type: 'button', onclick: async () => {
        if (!(await ask({ title: 'Hapus amalan ini?', text: it.title + ' akan dihapus dan tidak bisa dikembalikan.', reason: false }))) return;
        try { await deleteSunnah(it.id); toast('Dihapus.'); await reload(); } catch (er) { if (er.status !== 401) toast('Gagal menghapus. ' + hint(er), true); }
      } }, 'Hapus'))));
  const group = k => { const l = rows.filter(r => r.time_slot === k); return l.length ? h('div', { class: 'panel' }, h('h3', {}, SLOTS[k] + ' (' + l.length + ')'), l.map(item)) : ''; };
  box.replaceChildren(...[
    onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '',
    h('h2', { class: 'mt' }, 'Kelola Amalan Sunnah Harian'),
    h('p', { class: 'muted' }, 'Hanya Super Admin yang bisa menambah, mengubah, dan menghapus. Setiap amalan wajib memuat judul, penjelasan, sumber (perawi dan nomor), derajat (shahih atau hasan), dan keterangan siapa yang menilai derajatnya. Hadits yang lemah tidak bisa disimpan. Sebaiknya diperiksa ustaz sebelum diumumkan.'),
    form, ...Object.keys(SLOTS).map(group), rows.length ? '' : h('div', { class: 'panel' }, h('p', { class: 'muted' }, 'Belum ada amalan.'))
  ].flat());
  window.scrollTo(0, 0);
}
