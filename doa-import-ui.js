// BAITUNA - doa-import-ui.js
// Halaman "Import Doa dari Excel" (Super Admin). Alur: unduh template -> isi -> unggah -> periksa pratinjau -> impor.
import { h, toast, hint, ask } from './ui.js';
import { CATS, GRADES, listDuas, importDuas } from './doa-service.js';
import { HEADERS, LIMIT, fmtSize, buildTemplate, readXlsx, analyze, toPayload, reportCsv } from './doa-import.js';
import { loadAyat } from './quran-service.js';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const NS = 'http://www.w3.org/2000/svg';
export const svg = (paths, cls = 'ic') => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', cls); s.setAttribute('aria-hidden', 'true'); s.innerHTML = paths; return s; };
export const P = {
  down: '<path d="M12 4v10M8 10.5l4 4 4-4M5 19h14"/>', up: '<path d="M12 15V5M8 8.5l4-4 4 4M5 19h14"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z"/><path d="M12 17v-6M9.5 13l2.5-2.5 2.5 2.5"/>',
  file: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  mosque: '<path d="M12 3c1.2 1.3 1.8 2.4 1.8 3.6A1.8 1.8 0 0 1 12 8.4a1.8 1.8 0 0 1-1.8-1.8C10.2 5.4 10.8 4.3 12 3z"/><path d="M5 21v-8a7 7 0 0 1 14 0v8M3 21h18M9.5 21v-4a2.5 2.5 0 0 1 5 0v4"/>',
  xl: '<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8.5 9l7 6M15.5 9l-7 6"/>'
};
export function saveBlob(name, bytes, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type })), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export const downloadTemplate = () => { saveBlob('template-doa-baituna.xlsx', buildTemplate(), XLSX_MIME); toast('Template Excel diunduh.'); };

const COLS9 = [['Kategori doa', 0], ['Judul doa', 0], ['Teks Arab', 0], ['Teks Latin (opsional)', 0], ['Terjemahan Indonesia', 0], ['Sumber hadis', 0], ['Derajat hadis', 0], ['Nama penilai derajat', 0], ['Keterangan (opsional)', 0]];

function assertAyatResponse(rows, from, to) {
  const expected = to - from + 1;
  if (!Array.isArray(rows) || rows.length !== expected) throw new Error('Jumlah ayat yang diterima tidak sesuai rujukan.');
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i];
    if (!a || Number(a.n) !== from + i || typeof a.ar !== 'string' || !a.ar.trim() || typeof a.id !== 'string' || !a.id.trim()) throw new Error('Teks Arab atau terjemahan ayat ' + (from + i) + ' belum lengkap.');
  }
  return rows;
}

export async function renderDuaImport(box, { onBack, onDone }) {
  let existing = null, result = null, busy = false, file = null;
  const picker = h('input', { type: 'file', id: 'dmi-file', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', hidden: true });
  const fileBox = h('div', { id: 'dmi-fileinfo', class: 'dmi-file', hidden: true });
  const out = h('div', { id: 'dmi-out' });
  const go = h('button', { class: 'dmi-go', type: 'button', id: 'dmi-go', disabled: true }, svg(P.up), 'Import Data');
  const foot = h('p', { class: 'dmi-foot' }, 'Data akan diperiksa terlebih dahulu sebelum disimpan.');
  go.disabled = true; // h() menyalakan atribut disabled bila diberi nilai apa pun; pastikan nyata

  const drop = h('label', { class: 'dmi-drop', for: 'dmi-file', id: 'dmi-drop' }, svg(P.cloud, 'ic dmi-cloud'),
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
    fileBox.replaceChildren(svg(P.file, 'ic dmi-fic'), h('div', { class: 'dmi-fmain' }, h('b', { id: 'dmi-fname' }, file.name), h('span', { class: 'muted' }, fmtSize(file.size))),
      h('button', { class: 'btn-sm ghost', type: 'button', id: 'dmi-change', onclick: () => picker.click() }, 'Ganti'),
      h('button', { class: 'btn-sm ghost', type: 'button', id: 'dmi-cancel', onclick: reset }, 'Batal'));
  }
  async function take(f) {
    if (busy) return;
    result = null; sync();
    if (!/\.xlsx$/i.test(f.name)) { reset(); out.replaceChildren(h('div', { class: 'dmi-note bad', id: 'dmi-err', role: 'alert' }, 'Format file tidak didukung. Gunakan berkas Excel .xlsx (Google Sheets: Berkas > Unduh > Microsoft Excel). Format .xls lama belum didukung.')); return; }
    if (f.size > LIMIT.bytes) { reset(); out.replaceChildren(h('div', { class: 'dmi-note bad', id: 'dmi-err', role: 'alert' }, 'Ukuran file ' + fmtSize(f.size) + ' melebihi batas ' + fmtSize(LIMIT.bytes) + '.')); return; }
    file = f; showFile(); out.replaceChildren(h('p', { class: 'muted', id: 'dmi-wait' }, 'Memeriksa file…'));
    try {
      const rd = await readXlsx(new Uint8Array(await f.arrayBuffer()));
      if (existing === null) existing = await listDuas();
      result = analyze(rd.rows, existing);
    } catch (e) {
      if (e && e.status === 401) return;
      const msg = e && e.status !== undefined ? 'Data doa yang sudah ada belum bisa dimuat untuk pemeriksaan duplikat. ' + hint(e) : (e && e.message) || 'File tidak bisa dibaca.';
      out.replaceChildren(h('div', { class: 'dmi-note bad', id: 'dmi-err', role: 'alert' }, msg)); result = null; sync(); return;
    }
    drawPreview();
  }

  function drawPreview() {
    const r = result;
    if (r.fatal) { out.replaceChildren(h('div', { class: 'dmi-note bad', id: 'dmi-err', role: 'alert' }, r.fatal)); sync(); return; }
    const kids = [h('div', { class: 'dmi-sum', id: 'dmi-sum' }, chip(r.total, 'baris ditemukan'), chip(r.valid, 'data valid', 'ok'), chip(r.bad, 'bermasalah', r.bad ? 'bad' : ''), chip(r.dup, 'diduga duplikat', r.dup ? 'warn' : ''))];
    if (r.errors.length) {
      const shown = r.errors.slice(0, 100);
      kids.push(h('div', { class: 'dmi-errs', id: 'dmi-errs' }, h('h4', {}, 'Perlu diperbaiki atau dilewati'),
        h('ul', {}, ...shown.map(e => h('li', { class: e.dup ? 'warn' : 'bad' }, h('b', {}, 'Baris ' + e.row + (e.col ? ' · ' + e.col : '') + ': '), e.msg))),
        r.errors.length > shown.length ? h('p', { class: 'muted' }, '…dan ' + (r.errors.length - shown.length) + ' catatan lain (unduh laporan untuk lengkapnya).') : '',
        h('button', { class: 'btn-sm ghost', type: 'button', id: 'dmi-report', onclick: () => saveBlob('laporan-impor-doa.csv', reportCsv(r), 'text/csv;charset=utf-8') }, 'Unduh laporan kesalahan')));
    }
    const ok = r.items.filter(i => i.status === 'valid');
    if (ok.length) {
      kids.push(h('div', { class: 'dmi-prev', id: 'dmi-prev' }, h('h4', {}, 'Pratinjau data yang akan diimpor'),
        ...ok.slice(0, 20).map(i => h('div', { class: 'dmi-pc' }, h('b', {}, i.f.title || (i.f.kind === 'ayat' ? 'Ayat ' + i.f.surah + ':' + i.f.ayah_from + (i.f.ayah_to !== i.f.ayah_from ? '-' + i.f.ayah_to : '') : (i.f.source || 'Doa'))),
          h('span', { class: 'muted' }, ' · ' + CATS[i.f.category] + ' · baris ' + i.row + (i.f.grade ? ' · ' + GRADES[i.f.grade] : ' · ayat')),
          i.f.kind === 'ayat' ? h('p', { class: 'muted' }, 'Rujukan ayat; teks diambil otomatis.') : h('p', { class: 'dmi-ar', lang: 'ar', dir: 'rtl' }, i.f.arabic.slice(0, 120)),
          i.f.kind === 'ayat' ? '' : h('p', { class: 'muted' }, i.f.body.slice(0, 110) + (i.f.body.length > 110 ? '…' : '')),
          i.f.kind === 'ayat' ? '' : h('p', { class: 'hint' }, i.f.source))),
        ok.length > 20 ? h('p', { class: 'muted' }, '…dan ' + (ok.length - 20) + ' data valid lainnya.') : ''));
    } else kids.push(h('div', { class: 'dmi-note bad', role: 'alert' }, 'Tidak ada data valid untuk diimpor. Perbaiki file lalu unggah kembali.'));
    out.replaceChildren(...kids); go.lastChild.textContent = 'Import ' + ok.length + ' Doa'; sync();
  }

  go.addEventListener('click', async () => {
    if (busy || !result || result.valid < 1) return;
    busy = true; go.disabled = true; go.lastChild.textContent = 'Memeriksa rujukan ayat…';
    // Pastikan setiap rujukan ayat benar-benar menghasilkan teks Arab dan terjemahan lengkap sebelum ada data disimpan.
    const ayatItems = result.items.filter(i => i.status === 'valid' && i.f.kind === 'ayat');
    const checked = new Map();
    for (let start = 0; start < ayatItems.length; start += 6) {
      const batch = ayatItems.slice(start, start + 6);
      await Promise.all(batch.map(async item => {
        const f = item.f, key = [f.surah, f.ayah_from, f.ayah_to].join(':');
        if (!checked.has(key)) checked.set(key, loadAyat(f.surah, f.ayah_from, f.ayah_to).then(rows => assertAyatResponse(rows, f.ayah_from, f.ayah_to)));
        try { await checked.get(key); }
        catch (e) { item.status = 'error'; item.errors = [['surat', 'Rujukan ayat gagal diverifikasi: teks Arab/terjemahan tidak lengkap atau layanan tidak tersedia. Coba lagi setelah koneksi pulih.']]; result.valid--; result.bad++; result.errors.push({ row: item.row, col: 'surat/ayat', msg: item.errors[0][1] }); }
      }));
    }
    busy = false;
    if (result.valid < 1) { drawPreview(); return; }
    // Bila sebagian rujukan gagal, tampilkan baris bermasalah dan minta admin meninjau ulang sebelum impor.
    if (ayatItems.some(i => i.status === 'error')) { drawPreview(); return; }
    const items = result.items.filter(i => i.status === 'valid');
    const skip = result.bad + result.dup;
    if (!(await ask({ title: 'Impor ' + items.length + ' doa?', text: items.length + ' doa akan disimpan.' + (skip ? ' ' + skip + ' baris bermasalah atau diduga duplikat dilewati (tidak disimpan, tidak menimpa data lama).' : '') + ' Sumber dan derajat disimpan persis seperti yang Anda isi; aplikasi tidak memeriksa kesahihan hadis.', reason: false }))) { sync(); return; }
    busy = true; go.disabled = true; go.lastChild.textContent = 'Menyimpan…'; fileBox.querySelectorAll('button').forEach(b => { b.disabled = true; });
    const prog = h('p', { class: 'muted', id: 'dmi-prog' }, 'Menyimpan 0 dari ' + items.length + '…'); out.prepend(prog);
    let r2;
    try { r2 = await importDuas(items.map(i => toPayload(i.f)), (a, b) => { prog.textContent = 'Menyimpan ' + a + ' dari ' + b + '…'; }); }
    catch (e) { r2 = { saved: 0, failedFrom: 0, error: e }; }
    busy = false;
    if (r2.error && r2.error.status === 401) return;
    const snap = result, failed = items.length - r2.saved;
    existing = null; // muat ulang saat dipakai lagi
    const extra = [];
    if (failed) for (const i of items.slice(r2.saved)) extra.push({ row: i.row, col: '', msg: 'Gagal disimpan: ' + (r2.error && r2.error.status === 0 ? 'tidak ada koneksi' : (r2.error && r2.error.status === 403 ? 'tidak ada izin' : 'ditolak server')) + '.' });
    const lines = [h('h4', {}, failed ? (r2.saved ? 'Impor sebagian berhasil' : 'Impor gagal') : 'Impor selesai'),
      h('div', { class: 'dmi-sum', id: 'dmi-done' }, chip(r2.saved, 'berhasil diimpor', 'ok'), chip(skip, 'dilewati', skip ? 'warn' : ''), chip(failed, 'gagal disimpan', failed ? 'bad' : ''))];
    if (failed) lines.push(h('div', { class: 'dmi-note bad', role: 'alert', id: 'dmi-fail' }, (r2.error && r2.error.status === 0 ? 'Tidak ada koneksi internet. ' : 'Penyimpanan berhenti. ' + hint(r2.error || {}) + ' ') + 'Doa yang sudah tersimpan tidak hilang. Unggah file yang sama lagi: yang sudah masuk akan dilewati sebagai duplikat, sisanya diproses.'));
    if (skip || failed) lines.push(h('button', { class: 'btn-sm ghost', type: 'button', id: 'dmi-report2', onclick: () => saveBlob('laporan-impor-doa.csv', reportCsv(snap, extra), 'text/csv;charset=utf-8') }, 'Unduh laporan'));
    lines.push(h('div', { class: 'row-btns mt' }, h('button', { class: 'btn-sm', type: 'button', id: 'dmi-finish', onclick: () => onDone && onDone() }, 'Lihat daftar doa'), failed ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: reset }, 'Unggah ulang') : h('button', { class: 'btn-sm ghost', type: 'button', onclick: reset }, 'Impor file lain')));
    out.replaceChildren(h('div', { class: 'dmi-res' }, ...lines)); result = null; go.hidden = true; foot.hidden = true; fileBox.hidden = true;
    toast(failed ? 'Impor belum lengkap.' : r2.saved + ' doa diimpor.', !!failed);
    window.scrollTo(0, 0);
  });

  const step = (n, title, desc, ...body) => h('div', { class: 'dmi-step' }, h('span', { class: 'dmi-n' }, String(n)), h('div', { class: 'dmi-sb' }, h('h3', {}, title), h('p', { class: 'muted' }, desc), ...body));
  box.replaceChildren(
    h('button', { class: 'btn-sm ghost', type: 'button', id: 'dmi-back', onclick: onBack }, '← Kembali'),
    h('div', { class: 'dm-hero' }, h('div', {}, h('h2', {}, 'Import Doa dari Excel'), h('p', { class: 'muted' }, 'Tambahkan banyak doa sekaligus dengan file Excel atau Google Spreadsheet.')), svg(P.xl, 'ic dm-heroic')),
    h('div', { class: 'panel dmi-steps' },
      step(1, 'Download Template', 'Gunakan template Excel agar format sesuai.',
        h('button', { class: 'dmi-tile', type: 'button', id: 'dmi-tpl', onclick: downloadTemplate }, svg(P.down), h('span', {}, h('b', {}, 'Download Template Excel'), h('small', {}, 'File berisi contoh isian, petunjuk, dan pilihan kolom.')))),
      step(2, 'Isi Data Doa', 'Buka file template, isi data doa sesuai kolom yang tersedia.',
        h('div', { class: 'dmi-cols' }, h('b', {}, 'Kolom pada template:'), h('ol', {}, ...COLS9.map(([c]) => h('li', {}, c))),
          h('p', { class: 'hint' }, 'Rujukan ayat Al-Qur’an memakai kolom tambahan jenis_sumber, surat, ayat_awal, ayat_akhir (dijelaskan di lembar Petunjuk).'))),
      step(3, 'Upload File Excel', 'Setelah selesai, upload file untuk diimpor ke sistem.', picker, drop, fileBox, out)),
    h('div', { class: 'dmi-note info' }, svg(P.info), h('div', {}, h('b', {}, 'Catatan:'), h('ul', {},
      h('li', {}, 'Pastikan nama kolom di baris 1 tidak diubah.'), h('li', {}, 'Maksimal ' + LIMIT.rows + ' data per file.'),
      h('li', {}, 'Sistem memeriksa data sebelum disimpan; data duplikat dilewati, tidak menimpa.'),
      h('li', {}, 'Hanya doa dengan data valid yang diimpor. Derajat hanya Shahih atau Hasan, dan sumber wajib ada.')))),
    go, foot);
  window.scrollTo(0, 0);
}
