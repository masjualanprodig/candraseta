// BAITUNA - sunnah-import-ui.js
// Halaman "Import Amalan dari Excel" (Super Admin). Alur sama dengan impor doa: unduh template -> isi -> unggah -> pratinjau -> impor.
import { h, toast, hint, ask } from './ui.js';
import { SLOTS, GRADES, listSunnah, importSunnah } from './sunnah-service.js';
import { REMINDER_KEYS } from './sunnah-link.js';
import { LIMIT, fmtSize, buildTemplate, readSunnahXlsx, analyze, toPayload } from './sunnah-import.js';
import { reportCsv } from './doa-import.js';
import { XLSX_MIME, svg, P, saveBlob } from './doa-import-ui.js';

export const downloadSunnahTemplate = () => { saveBlob('template-amalan-sunnah-baituna.xlsx', buildTemplate(), XLSX_MIME); toast('Template Excel diunduh.'); };

const COLS = ['Waktu (Subuh, Pagi, Dhuha, …)', 'Judul amalan', 'Penjelasan', 'Teks Arab (opsional)', 'Teks Latin (opsional)', 'Sumber (perawi dan nomor)', 'Derajat hadis (Shahih/Hasan)', 'Keterangan derajat (penilai dan kitab)', 'Keterangan singkat (opsional)', 'Terkait pengingat (opsional)'];

export async function renderSunnahImport(box, { onBack, onDone }) {
  let existing = null, result = null, busy = false, file = null;
  const picker = h('input', { type: 'file', id: 'smi-file', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', hidden: true });
  const fileBox = h('div', { id: 'smi-fileinfo', class: 'dmi-file', hidden: true });
  const out = h('div', { id: 'smi-out' });
  const go = h('button', { class: 'dmi-go', type: 'button', id: 'smi-go', disabled: true }, svg(P.up), 'Import Data');
  const foot = h('p', { class: 'dmi-foot' }, 'Data akan diperiksa terlebih dahulu sebelum disimpan.');
  go.disabled = true; // h() menyalakan atribut disabled bila diberi nilai apa pun; pastikan nyata

  const drop = h('label', { class: 'dmi-drop', for: 'smi-file', id: 'smi-drop' }, svg(P.cloud, 'ic dmi-cloud'),
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
    fileBox.replaceChildren(svg(P.file, 'ic dmi-fic'), h('div', { class: 'dmi-fmain' }, h('b', { id: 'smi-fname' }, file.name), h('span', { class: 'muted' }, fmtSize(file.size))),
      h('button', { class: 'btn-sm ghost', type: 'button', id: 'smi-change', onclick: () => picker.click() }, 'Ganti'),
      h('button', { class: 'btn-sm ghost', type: 'button', id: 'smi-cancel', onclick: reset }, 'Batal'));
  }
  async function take(f) {
    if (busy) return;
    result = null; sync();
    if (!/\.xlsx$/i.test(f.name)) { reset(); out.replaceChildren(h('div', { class: 'dmi-note bad', id: 'smi-err', role: 'alert' }, 'Format file tidak didukung. Gunakan berkas Excel .xlsx (Google Sheets: Berkas > Unduh > Microsoft Excel). Format .xls lama belum didukung.')); return; }
    if (f.size > LIMIT.bytes) { reset(); out.replaceChildren(h('div', { class: 'dmi-note bad', id: 'smi-err', role: 'alert' }, 'Ukuran file ' + fmtSize(f.size) + ' melebihi batas ' + fmtSize(LIMIT.bytes) + '.')); return; }
    file = f; showFile(); out.replaceChildren(h('p', { class: 'muted', id: 'smi-wait' }, 'Memeriksa file…'));
    try {
      const rd = await readSunnahXlsx(new Uint8Array(await f.arrayBuffer()));
      if (existing === null) existing = await listSunnah();
      result = analyze(rd.rows, existing);
    } catch (e) {
      if (e && e.status === 401) return;
      const msg = e && e.status !== undefined ? 'Data amalan yang sudah ada belum bisa dimuat untuk pemeriksaan duplikat. ' + hint(e) : (e && e.message) || 'File tidak bisa dibaca.';
      out.replaceChildren(h('div', { class: 'dmi-note bad', id: 'smi-err', role: 'alert' }, msg)); result = null; sync(); return;
    }
    drawPreview();
  }

  function drawPreview() {
    const r = result;
    if (r.fatal) { out.replaceChildren(h('div', { class: 'dmi-note bad', id: 'smi-err', role: 'alert' }, r.fatal)); sync(); return; }
    const kids = [h('div', { class: 'dmi-sum', id: 'smi-sum' }, chip(r.total, 'baris ditemukan'), chip(r.valid, 'data valid', 'ok'), chip(r.bad, 'bermasalah', r.bad ? 'bad' : ''), chip(r.dup, 'diduga duplikat', r.dup ? 'warn' : ''))];
    if (r.errors.length) {
      const shown = r.errors.slice(0, 100);
      kids.push(h('div', { class: 'dmi-errs', id: 'smi-errs' }, h('h4', {}, 'Perlu diperbaiki atau dilewati'),
        h('ul', {}, ...shown.map(e => h('li', { class: e.dup ? 'warn' : 'bad' }, h('b', {}, 'Baris ' + e.row + (e.col ? ' · ' + e.col : '') + ': '), e.msg))),
        r.errors.length > shown.length ? h('p', { class: 'muted' }, '…dan ' + (r.errors.length - shown.length) + ' catatan lain (unduh laporan untuk lengkapnya).') : '',
        h('button', { class: 'btn-sm ghost', type: 'button', id: 'smi-report', onclick: () => saveBlob('laporan-impor-amalan.csv', reportCsv(r), 'text/csv;charset=utf-8') }, 'Unduh laporan kesalahan')));
    }
    const ok = r.items.filter(i => i.status === 'valid');
    if (ok.length) {
      kids.push(h('div', { class: 'dmi-prev', id: 'smi-prev' }, h('h4', {}, 'Pratinjau data yang akan diimpor'),
        ...ok.slice(0, 20).map(i => h('div', { class: 'dmi-pc' }, h('b', {}, i.f.title),
          h('span', { class: 'muted' }, ' · ' + SLOTS[i.f.time_slot] + ' · baris ' + i.row + ' · ' + GRADES[i.f.grade]),
          i.f.arabic ? h('p', { class: 'dmi-ar', lang: 'ar', dir: 'rtl' }, i.f.arabic.slice(0, 120)) : '',
          h('p', { class: 'muted' }, i.f.body.slice(0, 110) + (i.f.body.length > 110 ? '…' : '')),
          h('p', { class: 'hint' }, i.f.source + (i.f.reminder_key ? ' · Pengingat: ' + REMINDER_KEYS[i.f.reminder_key] : '')))),
        ok.length > 20 ? h('p', { class: 'muted' }, '…dan ' + (ok.length - 20) + ' data valid lainnya.') : ''));
    } else kids.push(h('div', { class: 'dmi-note bad', role: 'alert' }, 'Tidak ada data valid untuk diimpor. Perbaiki file lalu unggah kembali.'));
    out.replaceChildren(...kids); go.lastChild.textContent = 'Import ' + ok.length + ' Amalan'; sync();
  }

  go.addEventListener('click', async () => {
    if (busy || !result || result.valid < 1) return;
    const items = result.items.filter(i => i.status === 'valid');
    const skip = result.bad + result.dup;
    if (!(await ask({ title: 'Impor ' + items.length + ' amalan?', text: items.length + ' amalan akan disimpan.' + (skip ? ' ' + skip + ' baris bermasalah atau diduga duplikat dilewati (tidak disimpan, tidak menimpa data lama).' : '') + ' Sumber dan derajat disimpan persis seperti yang Anda isi; aplikasi tidak memeriksa kesahihan hadis.', reason: false }))) return;
    busy = true; go.disabled = true; go.lastChild.textContent = 'Menyimpan…'; fileBox.querySelectorAll('button').forEach(b => { b.disabled = true; });
    const prog = h('p', { class: 'muted', id: 'smi-prog' }, 'Menyimpan 0 dari ' + items.length + '…'); out.prepend(prog);
    let r2;
    const withRem = items.some(i => i.f.reminder_key);
    try { r2 = await importSunnah(items.map(i => toPayload(i.f, withRem)), (a, b) => { prog.textContent = 'Menyimpan ' + a + ' dari ' + b + '…'; }); }
    catch (e) { r2 = { saved: 0, failedFrom: 0, error: e }; }
    busy = false;
    if (r2.error && r2.error.status === 401) return;
    const snap = result, failed = items.length - r2.saved;
    existing = null; // muat ulang saat dipakai lagi
    const extra = [];
    if (failed) for (const i of items.slice(r2.saved)) extra.push({ row: i.row, col: '', msg: 'Gagal disimpan: ' + (r2.error && r2.error.status === 0 ? 'tidak ada koneksi' : (r2.error && r2.error.status === 403 ? 'tidak ada izin' : 'ditolak server')) + '.' });
    const lines = [h('h4', {}, failed ? (r2.saved ? 'Impor sebagian berhasil' : 'Impor gagal') : 'Impor selesai'),
      h('div', { class: 'dmi-sum', id: 'smi-done' }, chip(r2.saved, 'berhasil diimpor', 'ok'), chip(skip, 'dilewati', skip ? 'warn' : ''), chip(failed, 'gagal disimpan', failed ? 'bad' : ''))];
    if (failed) lines.push(h('div', { class: 'dmi-note bad', role: 'alert', id: 'smi-fail' }, (r2.error && r2.error.status === 0 ? 'Tidak ada koneksi internet. ' : r2.error && r2.error.code === 'PGRST204' ? 'Kolom pengingat belum aktif di server: jalankan sunnah_link.sql di Supabase SQL Editor, atau kosongkan kolom terkait_pengingat. ' : 'Penyimpanan berhenti. ' + hint(r2.error || {}) + ' ') + 'Amalan yang sudah tersimpan tidak hilang. Unggah file yang sama lagi: yang sudah masuk akan dilewati sebagai duplikat, sisanya diproses.'));
    if (skip || failed) lines.push(h('button', { class: 'btn-sm ghost', type: 'button', id: 'smi-report2', onclick: () => saveBlob('laporan-impor-amalan.csv', reportCsv(snap, extra), 'text/csv;charset=utf-8') }, 'Unduh laporan'));
    lines.push(h('div', { class: 'row-btns mt' }, h('button', { class: 'btn-sm', type: 'button', id: 'smi-finish', onclick: () => onDone && onDone() }, 'Lihat daftar amalan'), failed ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: reset }, 'Unggah ulang') : h('button', { class: 'btn-sm ghost', type: 'button', onclick: reset }, 'Impor file lain')));
    out.replaceChildren(h('div', { class: 'dmi-res' }, ...lines)); result = null; go.hidden = true; foot.hidden = true; fileBox.hidden = true;
    toast(failed ? 'Impor belum lengkap.' : r2.saved + ' amalan diimpor.', !!failed);
    window.scrollTo(0, 0);
  });

  const step = (n, title, desc, ...body) => h('div', { class: 'dmi-step' }, h('span', { class: 'dmi-n' }, String(n)), h('div', { class: 'dmi-sb' }, h('h3', {}, title), h('p', { class: 'muted' }, desc), ...body));
  box.replaceChildren(
    h('button', { class: 'btn-sm ghost', type: 'button', id: 'smi-back', onclick: onBack }, '← Kembali'),
    h('div', { class: 'dm-hero' }, h('div', {}, h('h2', {}, 'Import Amalan dari Excel'), h('p', { class: 'muted' }, 'Tambahkan banyak amalan sunnah harian sekaligus dengan file Excel atau Google Spreadsheet.')), svg(P.xl, 'ic dm-heroic')),
    h('div', { class: 'panel dmi-steps' },
      step(1, 'Download Template', 'Gunakan template Excel agar format sesuai.',
        h('button', { class: 'dmi-tile', type: 'button', id: 'smi-tpl', onclick: downloadSunnahTemplate }, svg(P.down), h('span', {}, h('b', {}, 'Download Template Excel'), h('small', {}, 'File berisi contoh isian, petunjuk, dan pilihan kolom.')))),
      step(2, 'Isi Data Amalan', 'Buka file template, isi data amalan di lembar "Amalan" sesuai kolom yang tersedia.',
        h('div', { class: 'dmi-cols' }, h('b', {}, 'Kolom pada template:'), h('ol', {}, ...COLS.map(c => h('li', {}, c))))),
      step(3, 'Upload File Excel', 'Setelah selesai, upload file untuk diimpor ke sistem.', picker, drop, fileBox, out)),
    h('div', { class: 'dmi-note info' }, svg(P.info), h('div', {}, h('b', {}, 'Catatan:'), h('ul', {},
      h('li', {}, 'Pastikan nama kolom di baris 1 tidak diubah.'), h('li', {}, 'Maksimal ' + LIMIT.rows + ' data per file.'),
      h('li', {}, 'Sistem memeriksa data sebelum disimpan; data duplikat dilewati, tidak menimpa.'),
      h('li', {}, 'Hanya amalan dengan data valid yang diimpor. Derajat hanya Shahih atau Hasan, dan sumber wajib ada.')))),
    go, foot);
  window.scrollTo(0, 0);
}
