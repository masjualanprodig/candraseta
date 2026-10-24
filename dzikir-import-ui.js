// BAITUNA - dzikir-import-ui.js
// Halaman "Import Dzikir dari Excel" (Super Admin). Alur sama dengan impor doa: unduh template -> isi -> unggah -> pratinjau -> impor.
import { h, toast, hint, ask } from './ui.js';
import { SESSIONS, listDhikr, importDhikr } from './dzikir-service.js';
import { LIMIT, fmtSize, buildTemplate, readDhikrXlsx, analyze, toPayload } from './dzikir-import.js';
import { reportCsv } from './doa-import.js';
import { XLSX_MIME, svg, P, saveBlob } from './doa-import-ui.js';

export const downloadDhikrTemplate = () => { saveBlob('template-dzikir-baituna.xlsx', buildTemplate(), XLSX_MIME); toast('Template Excel diunduh.'); };

const COLS = ['Sesi (pagi, petang, keduanya)', 'Jenis (teks atau ayat)', 'Judul (opsional)', 'Teks Arab (untuk jenis teks)', 'Latin (opsional)', 'Terjemahan (untuk jenis teks)', 'Sumber (perawi dan nomor)', 'Catatan (opsional)', 'Jumlah bacaan (1–1000)', 'Urutan (opsional)', 'Surah, Ayat dari, Ayat sampai (untuk jenis ayat)'];

export async function renderDhikrImport(box, { onBack, onDone }) {
  let existing = null, result = null, busy = false, file = null;
  const picker = h('input', { type: 'file', id: 'dzi-file', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', hidden: true });
  const fileBox = h('div', { id: 'dzi-fileinfo', class: 'dmi-file', hidden: true });
  const out = h('div', { id: 'dzi-out' });
  const go = h('button', { class: 'dmi-go', type: 'button', id: 'dzi-go', disabled: true }, svg(P.up), 'Import Data');
  const foot = h('p', { class: 'dmi-foot' }, 'Data akan diperiksa terlebih dahulu sebelum disimpan.');
  go.disabled = true; // h() menyalakan atribut disabled bila diberi nilai apa pun; pastikan nyata

  const drop = h('label', { class: 'dmi-drop', for: 'dzi-file', id: 'dzi-drop' }, svg(P.cloud, 'ic dmi-cloud'),
    h('b', {}, 'Pilih file Excel (.xlsx)'), h('span', { class: 'muted' }, 'atau seret file ke sini'), h('span', { class: 'hint' }, 'Maksimal ' + LIMIT.rows + ' baris dan ' + fmtSize(LIMIT.bytes)));
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('on'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('on'); }));
  drop.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) take(f); });
  picker.addEventListener('change', () => { const f = picker.files && picker.files[0]; if (f) take(f); });

  const reset = () => { file = null; result = null; picker.value = ''; fileBox.hidden = true; drop.hidden = false; out.replaceChildren(); sync(); };
  const sync = () => { go.disabled = !(result && !result.fatal && result.valid > 0) || busy; };
  const chip = (n, label, tone) => h('div', { class: 'dmi-chip ' + (tone || '') }, h('b', {}, String(n)), h('span', {}, label));

  function showFile() {
    fileBox.hidden = false; drop.hidden = true;
    fileBox.replaceChildren(svg(P.file, 'ic dmi-fic'), h('div', { class: 'dmi-fmain' }, h('b', { id: 'dzi-fname' }, file.name), h('span', { class: 'muted' }, fmtSize(file.size))),
      h('button', { class: 'btn-sm ghost', type: 'button', id: 'dzi-change', onclick: () => picker.click() }, 'Ganti'),
      h('button', { class: 'btn-sm ghost', type: 'button', id: 'dzi-cancel', onclick: reset }, 'Batal'));
  }
  async function take(f) {
    if (busy) return;
    result = null; sync();
    if (!/\.xlsx$/i.test(f.name)) { reset(); out.replaceChildren(h('div', { class: 'dmi-note bad', id: 'dzi-err', role: 'alert' }, 'Format file tidak didukung. Gunakan berkas Excel .xlsx (Google Sheets: Berkas > Unduh > Microsoft Excel). Format .xls lama belum didukung.')); return; }
    if (f.size > LIMIT.bytes) { reset(); out.replaceChildren(h('div', { class: 'dmi-note bad', id: 'dzi-err', role: 'alert' }, 'Ukuran file ' + fmtSize(f.size) + ' melebihi batas ' + fmtSize(LIMIT.bytes) + '.')); return; }
    file = f; showFile(); out.replaceChildren(h('p', { class: 'muted', id: 'dzi-wait' }, 'Memeriksa file…'));
    try {
      const rd = await readDhikrXlsx(new Uint8Array(await f.arrayBuffer()));
      if (existing === null) existing = await listDhikr();
      result = analyze(rd.rows, existing);
    } catch (e) {
      if (e && e.status === 401) return;
      const msg = e && e.status !== undefined ? 'Data dzikir yang sudah ada belum bisa dimuat untuk pemeriksaan duplikat. ' + hint(e) : (e && e.message) || 'File tidak bisa dibaca.';
      out.replaceChildren(h('div', { class: 'dmi-note bad', id: 'dzi-err', role: 'alert' }, msg)); result = null; sync(); return;
    }
    drawPreview();
  }

  function drawPreview() {
    const r = result;
    if (r.fatal) { out.replaceChildren(h('div', { class: 'dmi-note bad', id: 'dzi-err', role: 'alert' }, r.fatal)); sync(); return; }
    const kids = [h('div', { class: 'dmi-sum', id: 'dzi-sum' }, chip(r.total, 'baris ditemukan'), chip(r.valid, 'data valid', 'ok'), chip(r.bad, 'bermasalah', r.bad ? 'bad' : ''), chip(r.dup, 'diduga duplikat', r.dup ? 'warn' : ''))];
    if (r.errors.length) {
      const shown = r.errors.slice(0, 100);
      kids.push(h('div', { class: 'dmi-errs', id: 'dzi-errs' }, h('h4', {}, 'Perlu diperbaiki atau dilewati'),
        h('ul', {}, ...shown.map(e => h('li', { class: e.dup ? 'warn' : 'bad' }, h('b', {}, 'Baris ' + e.row + (e.col ? ' · ' + e.col : '') + ': '), e.msg))),
        r.errors.length > shown.length ? h('p', { class: 'muted' }, '…dan ' + (r.errors.length - shown.length) + ' catatan lain (unduh laporan untuk lengkapnya).') : '',
        h('button', { class: 'btn-sm ghost', type: 'button', id: 'dzi-report', onclick: () => saveBlob('laporan-impor-dzikir.csv', reportCsv(r), 'text/csv;charset=utf-8') }, 'Unduh laporan kesalahan')));
    }
    const ok = r.items.filter(i => i.status === 'valid');
    if (ok.length) {
      kids.push(h('div', { class: 'dmi-prev', id: 'dzi-prev' }, h('h4', {}, 'Pratinjau data yang akan diimpor'),
        ...ok.slice(0, 20).map(i => h('div', { class: 'dmi-pc' }, h('b', {}, i.f.title || (i.f.kind === 'ayat' ? 'QS ' + i.f.surah + ':' + i.f.ayah_from + (i.f.ayah_to > i.f.ayah_from ? '-' + i.f.ayah_to : '') : 'Bacaan')),
          h('span', { class: 'muted' }, ' · ' + SESSIONS[i.f.session] + ' · ' + i.f.target_count + '× · baris ' + i.row),
          i.f.kind === 'teks' ? h('p', { class: 'dmi-ar', lang: 'ar', dir: 'rtl' }, i.f.arabic.slice(0, 120)) : h('p', { class: 'muted' }, 'Ayat Al-Qur\'an (teks diambil otomatis)'),
          i.f.kind === 'teks' ? h('p', { class: 'muted' }, i.f.body.slice(0, 110) + (i.f.body.length > 110 ? '…' : '')) : '',
          h('p', { class: 'hint' }, i.f.source || ''))),
        ok.length > 20 ? h('p', { class: 'muted' }, '…dan ' + (ok.length - 20) + ' data valid lainnya.') : ''));
    } else kids.push(h('div', { class: 'dmi-note bad', role: 'alert' }, 'Tidak ada data valid untuk diimpor. Perbaiki file lalu unggah kembali.'));
    out.replaceChildren(...kids); go.lastChild.textContent = 'Import ' + ok.length + ' Bacaan'; sync();
  }

  go.addEventListener('click', async () => {
    if (busy || !result || result.valid < 1) return;
    const items = result.items.filter(i => i.status === 'valid');
    const skip = result.bad + result.dup;
    if (!(await ask({ title: 'Impor ' + items.length + ' bacaan dzikir?', text: items.length + ' bacaan akan disimpan.' + (skip ? ' ' + skip + ' baris bermasalah atau diduga duplikat dilewati (tidak disimpan, tidak menimpa data lama).' : '') + ' Teks, sumber, dan jumlah bacaan disimpan persis seperti yang Anda isi; aplikasi tidak memeriksa kesahihan hadis.', reason: false }))) return;
    busy = true; go.disabled = true; go.lastChild.textContent = 'Menyimpan…'; fileBox.querySelectorAll('button').forEach(b => { b.disabled = true; });
    const prog = h('p', { class: 'muted', id: 'dzi-prog' }, 'Menyimpan 0 dari ' + items.length + '…'); out.prepend(prog);
    let r2;
    try { r2 = await importDhikr(items.map(i => toPayload(i.f)), (a, b) => { prog.textContent = 'Menyimpan ' + a + ' dari ' + b + '…'; }); }
    catch (e) { r2 = { saved: 0, failedFrom: 0, error: e }; }
    busy = false;
    if (r2.error && r2.error.status === 401) return;
    const snap = result, failed = items.length - r2.saved;
    existing = null; // muat ulang saat dipakai lagi
    const extra = [];
    if (failed) for (const i of items.slice(r2.saved)) extra.push({ row: i.row, col: '', msg: 'Gagal disimpan: ' + (r2.error && r2.error.status === 0 ? 'tidak ada koneksi' : (r2.error && r2.error.status === 403 ? 'tidak ada izin' : 'ditolak server')) + '.' });
    const lines = [h('h4', {}, failed ? (r2.saved ? 'Impor sebagian berhasil' : 'Impor gagal') : 'Impor selesai'),
      h('div', { class: 'dmi-sum', id: 'dzi-done' }, chip(r2.saved, 'berhasil diimpor', 'ok'), chip(skip, 'dilewati', skip ? 'warn' : ''), chip(failed, 'gagal disimpan', failed ? 'bad' : ''))];
    if (failed) lines.push(h('div', { class: 'dmi-note bad', role: 'alert', id: 'dzi-fail' }, (r2.error && r2.error.status === 0 ? 'Tidak ada koneksi internet. ' : 'Penyimpanan berhenti. ' + hint(r2.error || {}) + ' ') + 'Bacaan yang sudah tersimpan tidak hilang. Unggah file yang sama lagi: yang sudah masuk akan dilewati sebagai duplikat, sisanya diproses.'));
    if (skip || failed) lines.push(h('button', { class: 'btn-sm ghost', type: 'button', id: 'dzi-report2', onclick: () => saveBlob('laporan-impor-dzikir.csv', reportCsv(snap, extra), 'text/csv;charset=utf-8') }, 'Unduh laporan'));
    lines.push(h('div', { class: 'row-btns mt' }, h('button', { class: 'btn-sm', type: 'button', id: 'dzi-finish', onclick: () => onDone && onDone() }, 'Lihat daftar dzikir'), failed ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: reset }, 'Unggah ulang') : h('button', { class: 'btn-sm ghost', type: 'button', onclick: reset }, 'Impor file lain')));
    out.replaceChildren(h('div', { class: 'dmi-res' }, ...lines)); result = null; go.hidden = true; foot.hidden = true; fileBox.hidden = true;
    toast(failed ? 'Impor belum lengkap.' : r2.saved + ' bacaan diimpor.', !!failed);
    window.scrollTo(0, 0);
  });

  const step = (n, title, desc, ...body) => h('div', { class: 'dmi-step' }, h('span', { class: 'dmi-n' }, String(n)), h('div', { class: 'dmi-sb' }, h('h3', {}, title), h('p', { class: 'muted' }, desc), ...body));
  box.replaceChildren(
    h('button', { class: 'btn-sm ghost', type: 'button', id: 'dzi-back', onclick: onBack }, '← Kembali'),
    h('div', { class: 'dm-hero' }, h('div', {}, h('h2', {}, 'Import Dzikir dari Excel'), h('p', { class: 'muted' }, 'Tambahkan banyak bacaan Dzikir Pagi & Petang sekaligus dengan file Excel atau Google Spreadsheet.')), svg(P.xl, 'ic dm-heroic')),
    h('div', { class: 'panel dmi-steps' },
      step(1, 'Download Template', 'Gunakan template Excel agar format sesuai.',
        h('button', { class: 'dmi-tile', type: 'button', id: 'dzi-tpl', onclick: downloadDhikrTemplate }, svg(P.down), h('span', {}, h('b', {}, 'Download Template Excel'), h('small', {}, 'File berisi contoh isian, petunjuk, dan pilihan kolom.')))),
      step(2, 'Isi Data Dzikir', 'Buka file template, isi bacaan di lembar "Dzikir" sesuai kolom yang tersedia.',
        h('div', { class: 'dmi-cols' }, h('b', {}, 'Kolom pada template:'), h('ol', {}, ...COLS.map(c => h('li', {}, c))))),
      step(3, 'Upload File Excel', 'Setelah selesai, upload file untuk diimpor ke sistem.', picker, drop, fileBox, out)),
    h('div', { class: 'dmi-note info' }, svg(P.info), h('div', {}, h('b', {}, 'Catatan:'), h('ul', {},
      h('li', {}, 'Pastikan nama kolom di baris 1 tidak diubah.'), h('li', {}, 'Maksimal ' + LIMIT.rows + ' data per file.'),
      h('li', {}, 'Sistem memeriksa data sebelum disimpan; data duplikat dilewati, tidak menimpa.'),
      h('li', {}, 'Hanya baris valid yang diimpor. Jenis teks wajib memuat teks Arab, terjemahan, sumber, dan jumlah bacaan; jenis ayat cukup surah dan ayat.')))),
    go, foot);
  window.scrollTo(0, 0);
}
