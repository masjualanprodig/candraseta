// BAITUNA - kas-ui.js
// Kas Masjid: (1) renderKasManager untuk Bendahara/Ketua/Admin Masjid/Super Admin (ringkasan, catatan, catat, pengaturan),
// (2) kasPublicPanel untuk jamaah di profil masjid bila ringkasan publik dihidupkan (hanya total).
// PENCATATAN saja: tidak ada uang yang berpindah lewat BAITUNA.
import { h, toast, ask } from './ui.js';
import { icon, ICONS } from './feed-ui.js';
import { PRODUCT_ERRORS } from './photo.js';
import * as K from './kas-service.js';

export const DISCLAIMER = 'BAITUNA hanya mencatat. Aplikasi tidak memegang atau memindahkan uang, dan laporan ini dibuat pengurus masjid, bukan audit independen.';
const TABS = [['ringkasan', 'Ringkasan'], ['catatan', 'Catatan'], ['catat', 'Catat'], ['pengaturan', 'Pengaturan']];

/* ===== Laporan bulanan (dipakai pengurus dan ringkasan publik) ===== */
function reportView(rep, { title, detail = true } = {}) {
  const stat = (id, label, v, cls) => h('div', { class: 'kas-stat ' + (cls || ''), id }, h('span', { class: 'muted' }, label), h('b', {}, K.money(v)));
  const kids = [title ? h('h3', { class: 'kas-rt' }, title) : '',
    h('div', { class: 'kas-stats' }, stat('kas-r-awal', 'Saldo awal', rep.saldo_awal), stat('kas-r-masuk', 'Pemasukan', rep.masuk, 'in'), stat('kas-r-keluar', 'Pengeluaran', rep.keluar, 'out'), stat('kas-r-akhir', 'Saldo akhir', rep.saldo_akhir, 'end'))];
  if (rep.opening_added > 0) kids.push(h('p', { class: 'hint', id: 'kas-r-open' }, 'Termasuk saldo awal akun baru bulan ini: ' + K.money(rep.opening_added) + ' (tidak dihitung sebagai pemasukan).'));
  if (rep.closed) kids.push(h('p', { class: 'kas-closed', id: 'kas-r-closed' }, '✓ Bulan ini sudah ditutup' + (rep.closing_note ? ': ' + rep.closing_note : '') + '.'));
  const cats = d => (rep.categories || []).filter(c => c.direction === d);
  const list = (label, rows) => rows.length ? h('div', { class: 'kas-cats' }, h('h4', {}, label), ...rows.map(c => h('div', { class: 'kas-crow' }, h('span', {}, c.name), h('b', {}, K.money(c.total))))) : '';
  if (detail) {
    kids.push(list('Pemasukan per kategori', cats('masuk')), list('Pengeluaran per kategori', cats('keluar')));
    if ((rep.accounts || []).length) kids.push(h('div', { class: 'kas-cats' }, h('h4', {}, 'Saldo per akun'), ...rep.accounts.map(a => h('div', { class: 'kas-crow' }, h('span', {}, a.name + ' · ' + K.kindLabel(a.kind)), h('b', {}, K.money(a.saldo_akhir))))));
  }
  return h('div', { class: 'kas-rep' }, ...kids);
}
function monthNav(month, set, nowKey) {
  return h('div', { class: 'kas-nav' },
    h('button', { class: 'btn-sm ghost', type: 'button', id: 'kas-prev', 'aria-label': 'Bulan sebelumnya', onclick: () => set(K.addMonths(month, -1)) }, '‹'),
    h('b', { id: 'kas-month' }, K.monthLabel(month)),
    h('button', { class: 'btn-sm ghost', type: 'button', id: 'kas-next', 'aria-label': 'Bulan berikutnya', ...(month >= nowKey ? { disabled: 'disabled' } : {}), onclick: () => set(K.addMonths(month, 1)) }, '›'));
}

/* ===== Ringkasan untuk jamaah (profil masjid) ===== */
export function kasPublicPanel(m) {
  const box = h('div', { class: 'panel kas-pub', id: 'kas-public', hidden: 'hidden' });
  const nowKey = K.monthKey();
  let month = nowKey;
  async function draw() {
    box.replaceChildren(h('h3', {}, 'Ringkasan kas masjid'), h('p', { class: 'muted' }, 'Memuat…'));
    let rep;
    try { rep = await K.report(m.id, month, true); } catch (e) { box.replaceChildren(h('h3', {}, 'Ringkasan kas masjid'), h('p', { class: 'muted' }, 'Ringkasan belum bisa dimuat.')); return; }
    box.replaceChildren(h('h3', {}, 'Ringkasan kas masjid'), monthNav(month, mm => { month = mm; draw(); }, nowKey), reportView(rep, {}), h('p', { class: 'hint' }, 'Hanya total yang ditampilkan; rincian catatan dan nama donatur tidak dibuka. ' + DISCLAIMER));
  }
  K.publicOn(m.id).then(on => { if (on) { box.hidden = false; draw(); } });
  return box;
}

/* ===== Pengelola ===== */
export async function renderKasManager(box, mosque, { onBack, roles = {}, tab: startTab } = {}) {
  const R = { write: !!roles.write, setup: !!(roles.setup || roles.write), approve: !!roles.approve, admin: !!roles.admin };
  const nowKey = K.monthKey(), today = K.dayKey();
  const st = { tab: startTab || 'ringkasan', month: nowKey, book: null, cache: {} };
  const back = h('button', { class: 'btn-sm ghost', type: 'button', id: 'kas-back', onclick: () => onBack && onBack() }, '← Kembali');
  box.replaceChildren(back, h('h2', { class: 'mt' }, 'Kas Masjid'), h('p', { class: 'muted', id: 'kas-loading' }, 'Memuat…'));
  try { st.book = await K.loadBook(mosque.id, { setup: R.setup }); }
  catch (e) { if (e && e.status === 401) return; box.replaceChildren(back, h('h2', { class: 'mt' }, 'Kas Masjid'), h('div', { class: 'panel' }, h('p', {}, K.errorText(e)), K.notReady(e) ? '' : h('button', { class: 'btn-sm', type: 'button', id: 'kas-retry', onclick: () => renderKasManager(box, mosque, { onBack, roles, tab: st.tab }) }, 'Coba lagi'))); return; }
  const book = () => st.book;
  const accName = id => (book().accounts.find(a => a.id === id) || {}).name || '?';
  const catName = id => (book().categories.find(c => c.id === id) || {}).name || '?';
  const reload = async (tab) => { st.cache = {}; try { st.book = await K.loadBook(mosque.id, { setup: R.setup }); } catch (e) { toast(K.errorText(e), true); } show(tab || st.tab); };

  const tabsEl = () => h('div', { class: 'seg kas-seg', id: 'kas-tabs', role: 'tablist', 'aria-label': 'Bagian kas' }, ...TABS.filter(([k]) => k !== 'catat' || R.write).filter(([k]) => k !== 'pengaturan' || R.setup || R.approve).map(([k, l]) =>
    h('button', { class: 'segb', type: 'button', role: 'tab', 'data-tab': k, 'aria-selected': String(st.tab === k), onclick: () => { if (st.tab !== k) show(k); } }, l)));
  const frame = (...body) => { box.replaceChildren(back, h('h2', { class: 'mt' }, 'Kas Masjid'), h('p', { class: 'muted' }, mosque.name), tabsEl(), ...body, h('p', { class: 'hint' }, DISCLAIMER)); };
  function show(tab) { st.tab = tab; ({ ringkasan: showSummary, catatan: showEntries, catat: showAdd, pengaturan: showSettings }[tab] || showSummary)(); window.scrollTo(0, 0); }

  /* --- Ringkasan --- */
  async function showSummary() {
    frame(h('p', { class: 'muted', id: 'kas-loading' }, 'Memuat…'));
    let rep; try { rep = st.cache['r' + st.month] || (st.cache['r' + st.month] = await K.report(mosque.id, st.month)); } catch (e) { frame(h('div', { class: 'panel' }, h('p', {}, K.errorText(e)))); return; }
    const canClose = R.approve && !rep.closed && st.month < nowKey;
    const lc = K.lastClosed(book());
    const acts = h('div', { class: 'qa-acts kas-noprint' },
      h('button', { class: 'btn-sm', type: 'button', id: 'kas-print', onclick: () => window.print() }, 'Cetak / simpan PDF'),
      h('button', { class: 'btn-sm ghost', type: 'button', id: 'kas-csv', onclick: async () => {
        try { const rows = await K.listEntries(mosque.id, st.month); K.downloadText('kas-' + mosque.name.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 30) + '-' + st.month.slice(0, 7) + '.csv', K.buildCsv(rows, book().accounts, book().categories)); toast('Berkas CSV diunduh.'); }
        catch (e) { toast(K.errorText(e), true); } } }, 'Unduh CSV'),
      canClose ? h('button', { class: 'btn-sm ghost', type: 'button', id: 'kas-close', onclick: async () => {
        const note = await ask({ title: 'Tutup buku ' + K.monthLabel(st.month) + '?', text: 'Setelah ditutup, tidak ada catatan baru yang bisa diberi tanggal di bulan ini atau sebelumnya. Kesalahan tetap dikoreksi lewat catatan koreksi di bulan berjalan. Tulis catatan penutupan (mis. nama pemeriksa).', reason: true });
        if (!note) return;
        try { await K.closeMonth(mosque.id, st.month, note); toast('Bulan ditutup.'); await reload('ringkasan'); } catch (e) { toast(K.errorText(e), true); } } }, 'Tutup buku bulan ini') : '',
      R.admin && rep.closed && lc === st.month ? h('button', { class: 'btn-sm alt', type: 'button', id: 'kas-reopen', onclick: async () => {
        const why = await ask({ title: 'Buka kembali ' + K.monthLabel(st.month) + '?', text: 'Hanya untuk kesalahan tutup buku. Alasan tercatat di audit log.', reason: true });
        if (!why) return;
        try { await K.reopenMonth(mosque.id, st.month, why); toast('Bulan dibuka kembali.'); await reload('ringkasan'); } catch (e) { toast(K.errorText(e), true); } } }, 'Buka kembali') : '');
    frame(monthNav(st.month, m => { st.month = m; showSummary(); }, nowKey),
      h('div', { class: 'kas-print', id: 'kas-report' }, h('h3', { class: 'kas-pt' }, 'Laporan kas ' + mosque.name), h('p', { class: 'muted' }, 'Periode: ' + K.monthLabel(st.month)), reportView(rep, {}),
        h('p', { class: 'hint kas-pfoot' }, DISCLAIMER)),
      acts);
  }

  /* --- Catatan --- */
  async function showEntries() {
    frame(monthNav(st.month, m => { st.month = m; showEntries(); }, nowKey), h('p', { class: 'muted', id: 'kas-loading' }, 'Memuat…'));
    let rows, reversed;
    try {
      rows = await K.listEntries(mosque.id, st.month);
      reversed = new Set(await K.listReversed(mosque.id));
    } catch (e) { frame(h('div', { class: 'panel' }, h('p', {}, K.errorText(e)))); return; }
    let filter = '';
    const body = h('div', { id: 'kas-entries' });
    const sel = h('select', { class: 'in', id: 'kas-f-acc', 'aria-label': 'Saring akun' }, h('option', { value: '' }, 'Semua akun'), ...book().accounts.map(a => h('option', { value: a.id }, a.name)));
    function paint() {
      const list = rows.filter(r => !filter || r.account_id === filter);
      const inT = list.reduce((s, r) => s + (r.direction === 'masuk' ? K.effect(r) : 0), 0), outT = list.reduce((s, r) => s + (r.direction === 'keluar' ? -K.effect(r) : 0), 0);
      body.replaceChildren(h('p', { class: 'muted', id: 'kas-sum' }, list.length + ' catatan · pemasukan ' + K.money(inT) + ' · pengeluaran ' + K.money(outT)),
        ...(list.length ? list.map(entryRow) : [h('div', { class: 'empty' }, h('p', { class: 'muted' }, 'Belum ada catatan di bulan ini.'))]));
    }
    function entryRow(e) {
      const rev = !!e.reverses, done = reversed.has(e.id), v = K.effect(e);
      const proof = h('div', { class: 'kas-proof' });
      const acts = [];
      if (e.proof_path) acts.push(h('button', { class: 'btn-sm ghost kas-proofbtn', type: 'button', onclick: async ev => {
        ev.target.disabled = true;
        try { const u = await K.proofUrl(e.proof_path); proof.replaceChildren(h('img', { class: 'kas-proofimg', src: u, alt: 'Bukti catatan' })); ev.target.remove(); }
        catch (er) { toast('Bukti belum bisa dibuka.', true); ev.target.disabled = false; } } }, 'Lihat bukti'));
      if (R.write && !rev && !done) acts.push(h('button', { class: 'btn-sm alt kas-rev', type: 'button', onclick: async () => {
        const why = await ask({ title: 'Koreksi catatan ini?', text: '“' + e.description + '” (' + K.money(e.amount) + ') tidak dihapus, tetapi dibatalkan dengan catatan koreksi hari ini. Tulis alasannya, lalu catat ulang yang benar.', reason: true });
        if (!why) return; const r = K.validateReason(why); if (!r) { toast('Alasan 3 sampai 150 huruf.', true); return; }
        try { await K.reverseEntry(e.id, r); toast('Koreksi dicatat.'); await reload('catatan'); } catch (er) { toast(K.errorText(er), true); } } }, 'Koreksi'));
      return h('div', { class: 'panel kas-row' + (done ? ' done' : '') + (rev ? ' rev' : ''), 'data-id': e.id },
        h('div', { class: 'kas-r1' }, h('b', { class: 'kas-desc' }, e.description), h('b', { class: 'kas-amt ' + (v >= 0 ? 'in' : 'out') }, (v > 0 ? '+' : '') + K.money(v))),
        h('div', { class: 'muted kas-r2' }, K.dayLabel(e.entry_date) + ' · ' + catName(e.category_id) + ' · ' + accName(e.account_id) + (e.counterparty ? ' · ' + e.counterparty : '')),
        h('div', { class: 'chips' }, rev ? h('span', { class: 'chip' }, 'Koreksi') : '', done ? h('span', { class: 'chip chip-draft' }, 'Sudah dikoreksi') : ''),
        acts.length ? h('div', { class: 'qa-acts' }, ...acts) : '', proof);
    }
    sel.addEventListener('change', () => { filter = sel.value; paint(); });
    frame(monthNav(st.month, m => { st.month = m; showEntries(); }, nowKey), sel, body); paint();
  }

  /* --- Catat (Bendahara) --- */
  async function showAdd() {
    if (!R.write) { show('ringkasan'); return; }
    const accs = book().accounts.filter(a => a.active), minDate = K.minEntryDate(book());
    if (!accs.length) { frame(h('div', { class: 'empty' }, h('p', { class: 'muted' }, 'Belum ada akun kas aktif. Buat di Pengaturan.'))); return; }
    let dir = 'masuk';
    const mk = (d, l) => h('button', { class: 'segb', type: 'button', id: 'kas-dir-' + d, 'aria-pressed': String(dir === d), 'aria-selected': String(dir === d), onclick: () => { dir = d; paintDir(); } }, l);
    const bIn = mk('masuk', 'Pemasukan'), bOut = mk('keluar', 'Pengeluaran');
    const dirSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Jenis catatan' }, bIn, bOut);
    const acc = h('select', { class: 'in', id: 'kas-f-account' }, ...accs.map(a => h('option', { value: a.id }, a.name + ' (' + K.kindLabel(a.kind) + ')')));
    const cat = h('select', { class: 'in', id: 'kas-f-category' });
    const amount = h('input', { class: 'in', id: 'kas-f-amount', inputmode: 'numeric', maxlength: '18', placeholder: 'Contoh: 150000', autocomplete: 'off' });
    const date = h('input', { class: 'in', id: 'kas-f-date', type: 'date', max: today, ...(minDate ? { min: minDate } : {}) }); date.value = today;
    const desc = h('input', { class: 'in', id: 'kas-f-desc', maxlength: String(K.LIMIT.descMax), placeholder: 'Contoh: Kotak amal Jumat', autocomplete: 'off' });
    const partyLab = h('label', { class: 'hint kas-lab', for: 'kas-f-party' }, 'Donatur (opsional)');
    const party = h('input', { class: 'in', id: 'kas-f-party', maxlength: String(K.LIMIT.partyMax), placeholder: 'Nama atau "Hamba Allah"', autocomplete: 'off' });
    const file = h('input', { class: 'in', id: 'kas-f-file', type: 'file', accept: 'image/jpeg,image/png,image/webp', 'aria-label': 'Foto bukti' });
    const err = h('p', { class: 'mk-err', id: 'kas-f-err', role: 'alert' }, '');
    const status = h('p', { class: 'hint', id: 'kas-f-status' }, 'Bukti (opsional): foto nota atau kuitansi, maksimal 100 KB (otomatis diperkecil). Bukti hanya terlihat oleh Bendahara, Ketua, dan Admin Masjid.');
    function paintDir() {
      [[bIn, 'masuk'], [bOut, 'keluar']].forEach(([b, d]) => { b.setAttribute('aria-pressed', String(dir === d)); b.setAttribute('aria-selected', String(dir === d)); });
      cat.replaceChildren(h('option', { value: '' }, 'Pilih kategori…'), ...book().categories.filter(c => c.active && c.direction === dir).map(c => h('option', { value: c.id }, c.name)));
      partyLab.textContent = dir === 'masuk' ? 'Donatur (opsional)' : 'Penerima (opsional)';
    }
    paintDir();
    const save = h('button', { class: 'btn-primary', type: 'submit', id: 'kas-f-save' }, 'Simpan catatan');
    let busy = false;
    const form = h('form', { class: 'panel rform', id: 'kas-form', novalidate: 'novalidate' },
      h('h3', {}, 'Catat kas'), dirSeg,
      h('label', { class: 'hint kas-lab', for: 'kas-f-account' }, 'Akun kas'), acc,
      h('label', { class: 'hint kas-lab', for: 'kas-f-category' }, 'Kategori'), cat,
      h('label', { class: 'hint kas-lab', for: 'kas-f-amount' }, 'Jumlah (Rp)'), amount,
      h('label', { class: 'hint kas-lab', for: 'kas-f-date' }, 'Tanggal'), date,
      h('label', { class: 'hint kas-lab', for: 'kas-f-desc' }, 'Keterangan'), desc, partyLab, party,
      h('label', { class: 'hint kas-lab', for: 'kas-f-file' }, 'Foto bukti (opsional)'), file, status, err, save,
      h('p', { class: 'hint' }, 'Catatan yang sudah disimpan tidak bisa diubah atau dihapus. Jika salah, gunakan "Koreksi" lalu catat ulang yang benar.'));
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); if (busy) return;
      const v = K.validateEntry({ accountId: acc.value, categoryId: cat.value, amount: amount.value, date: date.value, description: desc.value, party: party.value, maxDate: today, minDate });
      if (v.error) { err.textContent = v.error; ({ account: acc, category: cat, amount, date, description: desc, party })[v.field].focus(); return; }
      if (dir === 'keluar') {
        let nowRep = null; try { nowRep = await K.report(mosque.id, nowKey); } catch (e) { /* abaikan */ }
        const a = nowRep && (nowRep.accounts || []).find(x => x.id === v.ok.accountId);
        if (a && a.saldo_akhir - v.ok.amount < 0 && !(await ask({ title: 'Saldo akun akan minus', text: 'Saldo "' + a.name + '" sekarang ' + K.money(a.saldo_akhir) + '. Setelah pengeluaran ini menjadi ' + K.money(a.saldo_akhir - v.ok.amount) + '. Tetap simpan?' }))) return;
      }
      err.textContent = ''; busy = true; save.disabled = true;
      try {
        let proof = null; const f = file.files && file.files[0];
        if (f) { status.textContent = 'Memproses dan mengunggah bukti…'; proof = await K.uploadProof(mosque.id, f); }
        await K.addEntry(mosque.id, v.ok, proof);
        toast('Catatan disimpan.'); st.cache = {}; st.month = v.ok.date.slice(0, 7) + '-01'; busy = false; show('catatan'); return;
      } catch (e) { err.textContent = e && PRODUCT_ERRORS[e.code] ? PRODUCT_ERRORS[e.code] : K.errorText(e); status.textContent = 'Bukti (opsional): maksimal 100 KB.'; }
      busy = false; save.disabled = false;
    });
    frame(form);
  }

  /* --- Pengaturan --- */
  function showSettings() {
    const kids = [];
    if (R.approve) {
      const on = book().publicSummary;
      kids.push(h('div', { class: 'panel', id: 'kas-pubset' }, h('h3', {}, 'Ringkasan untuk jamaah'),
        h('p', { class: 'muted' }, 'Jika dihidupkan, siapa pun (termasuk tamu) dapat melihat total pemasukan, pengeluaran, saldo, dan total per kategori tiap bulan di profil masjid. Rincian catatan, nama donatur, dan bukti tetap tertutup.'),
        h('p', {}, h('b', { id: 'kas-pubstate' }, on ? 'Saat ini: DIHIDUPKAN' : 'Saat ini: dimatikan')),
        h('button', { class: 'btn-sm' + (on ? ' alt' : ''), type: 'button', id: 'kas-pubtoggle', onclick: async () => {
          if (!on && !(await ask({ title: 'Hidupkan ringkasan publik?', text: 'Total kas bulanan akan terlihat oleh semua pengunjung profil masjid ini. Pastikan pengurus sepakat.' }))) return;
          try { await K.setPublic(mosque.id, !on); toast(on ? 'Ringkasan publik dimatikan.' : 'Ringkasan publik dihidupkan.'); await reload('pengaturan'); } catch (e) { toast(K.errorText(e), true); } } }, on ? 'Matikan' : 'Hidupkan')));
    }
    if (R.setup) kids.push(accountPanel(), categoryPanel());
    else kids.push(h('p', { class: 'muted' }, 'Akun dan kategori kas dikelola Bendahara atau Admin Masjid.'));
    frame(...kids);
  }
  function accountPanel() {
    let editing = null;
    const name = h('input', { class: 'in', id: 'kas-a-name', maxlength: String(K.LIMIT.nameMax), placeholder: 'Contoh: Kas Kegiatan Ramadan', autocomplete: 'off' });
    const kind = h('select', { class: 'in', id: 'kas-a-kind' }, ...K.KINDS.map(([k, l]) => h('option', { value: k }, l)));
    const open = h('input', { class: 'in', id: 'kas-a-open', inputmode: 'numeric', placeholder: 'Saldo awal (Rp), kosongkan bila nol', autocomplete: 'off' });
    const od = h('input', { class: 'in', id: 'kas-a-date', type: 'date', max: today }); od.value = today;
    const err = h('p', { class: 'mk-err', id: 'kas-a-err', role: 'alert' }, '');
    const save = h('button', { class: 'btn-sm', type: 'button', id: 'kas-a-save' }, 'Tambah akun');
    const cancel = h('button', { class: 'btn-sm ghost', type: 'button', id: 'kas-a-cancel', hidden: 'hidden', onclick: () => { editing = null; name.value = ''; open.value = ''; od.value = today; save.textContent = 'Tambah akun'; cancel.hidden = true; } }, 'Batal ubah');
    save.addEventListener('click', async () => {
      const v = K.validateAccount({ name: name.value, kind: kind.value, opening: open.value, date: od.value });
      if (v.error) { err.textContent = v.error; ({ name, kind, opening: open, date: od })[v.field].focus(); return; }
      err.textContent = ''; save.disabled = true;
      try { await K.saveAccount(mosque.id, editing && editing.id, v.ok, editing ? editing.active : true); toast(editing ? 'Akun diperbarui.' : 'Akun ditambahkan.'); await reload('pengaturan'); return; }
      catch (e) { err.textContent = K.errorText(e); }
      save.disabled = false;
    });
    const row = a => h('div', { class: 'kas-arow', 'data-id': a.id },
      h('span', {}, h('b', {}, a.name), h('span', { class: 'muted' }, ' · ' + K.kindLabel(a.kind) + (a.active ? '' : ' · nonaktif') + ' · saldo awal ' + K.money(a.opening_balance))),
      h('span', { class: 'qa-acts' },
        h('button', { class: 'btn-sm ghost kas-a-edit', type: 'button', onclick: () => { editing = a; name.value = a.name; kind.value = a.kind; open.value = a.opening_balance ? String(a.opening_balance) : ''; od.value = a.opening_date; save.textContent = 'Simpan akun'; cancel.hidden = false; name.focus(); } }, 'Ubah'),
        h('button', { class: 'btn-sm ghost kas-a-toggle', type: 'button', onclick: async () => { try { await K.saveAccount(mosque.id, a.id, { name: a.name, kind: a.kind, opening: a.opening_balance, date: a.opening_date }, !a.active); toast(a.active ? 'Akun dinonaktifkan.' : 'Akun diaktifkan.'); await reload('pengaturan'); } catch (e) { toast(K.errorText(e), true); } } }, a.active ? 'Nonaktifkan' : 'Aktifkan')));
    return h('div', { class: 'panel rform', id: 'kas-accounts' }, h('h3', {}, 'Akun kas'),
      h('p', { class: 'muted' }, 'Pisahkan dana sesuai peruntukannya (mis. kas umum, infak, zakat, kegiatan). Dana zakat punya ketentuan penyaluran; konsultasikan dengan ustaz atau amil. Saldo awal dan jenis tidak bisa diubah setelah akun punya catatan; akun hanya bisa dinonaktifkan bila saldonya nol.'),
      ...book().accounts.map(row), name, kind, open, od, err, h('div', { class: 'qa-acts' }, save, cancel));
  }
  function categoryPanel() {
    const dirSel = h('select', { class: 'in', id: 'kas-c-dir', 'aria-label': 'Arah kategori' }, h('option', { value: 'masuk' }, 'Pemasukan'), h('option', { value: 'keluar' }, 'Pengeluaran'));
    const name = h('input', { class: 'in', id: 'kas-c-name', maxlength: String(K.LIMIT.nameMax), placeholder: 'Nama kategori baru', autocomplete: 'off' });
    const err = h('p', { class: 'mk-err', id: 'kas-c-err', role: 'alert' }, '');
    const add = h('button', { class: 'btn-sm', type: 'button', id: 'kas-c-add', onclick: async () => {
      const n = name.value.trim(); if (n.length < 2) { err.textContent = 'Nama kategori minimal 2 huruf.'; return; }
      err.textContent = ''; add.disabled = true;
      try { await K.saveCategory(mosque.id, null, dirSel.value, n, true); toast('Kategori ditambahkan.'); await reload('pengaturan'); return; } catch (e) { err.textContent = K.errorText(e); }
      add.disabled = false; } }, 'Tambah kategori');
    const group = (d, label) => [h('h4', {}, label), ...book().categories.filter(c => c.direction === d).map(c => h('div', { class: 'kas-arow', 'data-id': c.id }, h('span', {}, c.name, c.active ? '' : h('span', { class: 'muted' }, ' · nonaktif')),
      h('button', { class: 'btn-sm ghost kas-c-toggle', type: 'button', onclick: async () => { try { await K.saveCategory(mosque.id, c.id, c.direction, c.name, !c.active); await reload('pengaturan'); } catch (e) { toast(K.errorText(e), true); } } }, c.active ? 'Nonaktifkan' : 'Aktifkan')))];
    return h('div', { class: 'panel rform', id: 'kas-categories' }, h('h3', {}, 'Kategori'), ...group('masuk', 'Pemasukan'), ...group('keluar', 'Pengeluaran'), dirSel, name, err, add);
  }

  show(st.tab);
}
