// BAITUNA - kas-ui.js (v126: perombakan Keuangan Masjid)
// (1) renderKasManager untuk pengurus (Bendahara/Admin Masjid mencatat; Ketua dan Super Admin melihat/menyetujui),
// (2) kasPublicPanel untuk jamaah di profil masjid bila ringkasan dihidupkan (hanya total).
// PENCATATAN saja: tidak ada uang yang berpindah lewat BAITUNA. Catatan tidak pernah diubah/dihapus sungguhan:
// "Ubah" dan "Hapus" bekerja lewat catatan koreksi (jejak tetap ada).
import { h, toast, ask } from './ui.js';
import { PRODUCT_ERRORS } from './photo.js';
import * as K from './kas-service.js';

export const DISCLAIMER = 'BAITUNA hanya mencatat. Aplikasi tidak memegang atau memindahkan uang, dan laporan ini dibuat pengurus masjid, bukan audit independen.';
const TABS = [['ringkasan', 'Ringkasan'], ['catatan', 'Transaksi'], ['pengaturan', 'Pengaturan']];

/* ===== Ikon kecil (SVG sendiri agar tidak bergantung pada daftar ikon lain) ===== */
const NS = 'http://www.w3.org/2000/svg';
function svg(paths, size = 22) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', String(size)); s.setAttribute('height', String(size)); s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
  for (const d of paths) { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); s.appendChild(p); }
  return s;
}
const ICON = {
  camera: ['M4 8h3l1.5-2h7L17 8h3v11H4z', 'M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v6M14 11v6'],
  chev: ['M9 6l6 6-6 6'],
  cal: ['M5 6h14v14H5z', 'M5 10h14', 'M9 4v4M15 4v4'],
  tag: ['M4 4h7l9 9-7 7-9-9z', 'M8 8h.01'],
  box: ['M4 8l8-4 8 4v8l-8 4-8-4z', 'M4 8l8 4 8-4', 'M12 12v8'],
  hash: ['M5 9h14M5 15h14', 'M10 4L8 20M16 4l-2 16'],
  coin: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v10', 'M9.5 9.5c0-1 1-1.7 2.5-1.7s2.5.7 2.5 1.7-1 1.5-2.5 1.8S9.5 12.5 9.5 14c0 1 1 1.7 2.5 1.7s2.5-.7 2.5-1.7'],
  note: ['M6 3h9l4 4v14H6z', 'M15 3v4h4', 'M9 12h7M9 16h7'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21c0-4 3.5-6 8-6s8 2 8 6'],
  wallet: ['M4 7h15v12H4z', 'M4 7l12-3v3', 'M15 13h4'],
  star: ['M12 4l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z'],
  plus: ['M12 5v14M5 12h14'],
  out: ['M7 17L17 7', 'M9 7h8v8'],
  inn: ['M17 7L7 17', 'M15 17H7V9']
};
const ic = (n, s) => svg(ICON[n], s);
// Kolom isian dengan ikon di kiri dalam kolom.
const fld = (name, el) => h('div', { class: 'kas-field' }, h('span', { class: 'kas-fico' }, ic(name, 20)), el);

/* ===== Laporan bulanan: empat kartu (dipakai pengurus dan ringkasan jamaah) ===== */
function reportView(rep, { title, detail = true } = {}) {
  const stat = (id, label, v, cls) => h('div', { class: 'kas-stat ' + (cls || ''), id }, h('span', { class: 'muted' }, label), h('b', {}, K.money(v)));
  const kids = [title ? h('h3', { class: 'kas-rt' }, title) : '',
    h('div', { class: 'kas-stats' }, stat('kas-r-awal', 'Saldo awal', rep.saldo_awal), stat('kas-r-masuk', 'Kas masuk', rep.masuk, 'in'), stat('kas-r-keluar', 'Kas keluar', rep.keluar, 'out'), stat('kas-r-akhir', 'Saldo akhir', rep.saldo_akhir, 'end'))];
  if (rep.opening_added > 0) kids.push(h('p', { class: 'hint', id: 'kas-r-open' }, 'Termasuk saldo awal akun baru bulan ini: ' + K.money(rep.opening_added) + ' (tidak dihitung sebagai kas masuk).'));
  if (rep.closed) kids.push(h('p', { class: 'kas-closed', id: 'kas-r-closed' }, '✓ Bulan ini sudah ditutup' + (rep.closing_note ? ': ' + rep.closing_note : '') + '.'));
  const cats = d => (rep.categories || []).filter(c => c.direction === d);
  const list = (label, rows) => rows.length ? h('div', { class: 'kas-cats' }, h('h4', {}, label), ...rows.map(c => h('div', { class: 'kas-crow' }, h('span', {}, c.name), h('b', {}, K.money(c.total))))) : '';
  if (detail) {
    kids.push(list('Kas masuk per kategori', cats('masuk')), list('Kas keluar per kategori', cats('keluar')));
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

/* ===== Ringkasan untuk jamaah (profil masjid): hanya total, tanpa rincian ===== */
export function kasPublicPanel(m) {
  const box = h('div', { class: 'panel kas-pub', id: 'kas-public', hidden: 'hidden' });
  const nowKey = K.monthKey();
  let month = nowKey;
  async function draw() {
    box.replaceChildren(h('h3', {}, 'Ringkasan keuangan masjid'), h('p', { class: 'muted' }, 'Memuat…'));
    let rep;
    try { rep = await K.report(m.id, month, true); } catch (e) { box.replaceChildren(h('h3', {}, 'Ringkasan keuangan masjid'), h('p', { class: 'muted' }, 'Ringkasan belum bisa dimuat.')); return; }
    box.replaceChildren(h('h3', {}, 'Ringkasan keuangan masjid'), monthNav(month, mm => { month = mm; draw(); }, nowKey), reportView(rep, { detail: false }), h('p', { class: 'hint' }, 'Hanya total yang ditampilkan; rincian pengeluaran, nama penerima, dan nota tidak dibuka. ' + DISCLAIMER));
  }
  K.publicOn(m.id).then(on => { if (on) { box.hidden = false; draw(); } });
  return box;
}

/* ===== Pengelola ===== */
export async function renderKasManager(box, mosque, { onBack, roles = {}, tab: startTab } = {}) {
  const R = { write: !!roles.write, setup: !!(roles.setup || roles.write), approve: !!roles.approve, admin: !!roles.admin };
  const nowKey = K.monthKey(), today = K.dayKey();
  const st = { tab: startTab || 'ringkasan', month: nowKey, book: null, cache: {}, filter: 'semua', acc: '' };
  const back = h('button', { class: 'btn-sm ghost', type: 'button', id: 'kas-back', onclick: () => onBack && onBack() }, '← Kembali');
  const head = () => h('div', { class: 'kas-head' }, h('div', {}, h('h2', { class: 'mt' }, 'Kas Masjid'), h('p', { class: 'muted' }, mosque.name)), h('img', { class: 'kas-hero', src: 'masjid.svg', alt: '' }));
  box.replaceChildren(back, h('h2', { class: 'mt' }, 'Kas Masjid'), h('p', { class: 'muted', id: 'kas-loading' }, 'Memuat…'));
  try { st.book = await K.loadBook(mosque.id, { setup: R.setup }); }
  catch (e) { if (e && e.status === 401) return; box.replaceChildren(back, h('h2', { class: 'mt' }, 'Kas Masjid'), h('div', { class: 'panel' }, h('p', {}, K.errorText(e)), K.notReady(e) ? '' : h('button', { class: 'btn-sm', type: 'button', id: 'kas-retry', onclick: () => renderKasManager(box, mosque, { onBack, roles, tab: st.tab }) }, 'Coba lagi'))); return; }
  const book = () => st.book;
  const accName = id => (book().accounts.find(a => a.id === id) || {}).name || '?';
  const catName = id => (book().categories.find(c => c.id === id) || {}).name || '?';
  const reload = async (tab) => { st.cache = {}; try { st.book = await K.loadBook(mosque.id, { setup: R.setup }); } catch (e) { toast(K.errorText(e), true); } show(tab || st.tab); };
  const monthData = async month => {
    if (st.cache['d' + month]) return st.cache['d' + month];
    const [rows, rev] = await Promise.all([K.listEntries(mosque.id, month), K.listReversed(mosque.id)]);
    return (st.cache['d' + month] = { rows, reversed: new Set(rev) });
  };
  const tabList = () => TABS.filter(([k]) => k !== 'pengaturan' || R.setup || R.approve);
  const tabsEl = () => h('div', { class: 'seg kas-seg', id: 'kas-tabs', role: 'tablist', 'aria-label': 'Bagian kas' }, ...tabList().map(([k, l]) =>
    h('button', { class: 'segb', type: 'button', role: 'tab', 'data-tab': k, 'aria-selected': String(st.tab === k), onclick: () => { if (st.tab !== k) { if (k === 'catatan') st.filter = 'semua'; show(k); } } }, l)));
  const frame = (...body) => { box.replaceChildren(back, head(), tabsEl(), ...body, h('p', { class: 'hint' }, DISCLAIMER)); };
  // Layar tanpa tab (formulir, rincian): tombol kembali ke layar asal.
  const sub = (title, from, ...body) => { box.replaceChildren(h('button', { class: 'btn-sm ghost', type: 'button', id: 'kas-back2', onclick: () => show(from || st.tab) }, '← Kembali'), h('h2', { class: 'mt', id: 'kas-subtitle' }, title), ...body, h('p', { class: 'hint' }, DISCLAIMER)); window.scrollTo(0, 0); };
  function show(tab) { st.tab = tab; ({ ringkasan: showSummary, catatan: showEntries, pengaturan: showSettings }[tab] || showSummary)(); window.scrollTo(0, 0); }

  /* --- Baris transaksi (dipakai ringkasan dan daftar) --- */
  function itemRow(e, reversed, from) {
    const rev = !!e.reverses, done = reversed.has(e.id), v = K.effect(e);
    return h('button', { class: 'kas-item' + (done ? ' done' : '') + (rev ? ' rev' : ''), type: 'button', 'data-id': e.id, onclick: () => showDetail(e, reversed, from) },
      h('span', { class: 'kas-ico ' + (e.direction === 'masuk' ? 'pos' : 'neg') }, ic(e.direction === 'masuk' ? 'inn' : 'out', 20)),
      h('span', { class: 'kas-imain' }, h('b', { class: 'kas-desc' }, K.entryTitle(e)), h('span', { class: 'muted kas-r2' }, K.dayLabel(e.entry_date) + ' · ' + catName(e.category_id) + (rev ? ' · Koreksi' : '') + (done ? ' · Sudah dikoreksi' : ''))),
      h('b', { class: 'kas-amt ' + (v >= 0 ? 'pos' : 'neg') }, (v > 0 ? '+ ' : v < 0 ? '- ' : '') + K.money(Math.abs(v))),
      h('span', { class: 'kas-go' }, ic('chev', 16)));
  }

  /* --- Ringkasan (layar 1) --- */
  async function showSummary() {
    frame(h('p', { class: 'muted', id: 'kas-loading' }, 'Memuat…'));
    let rep, data; try { rep = st.cache['r' + st.month] || (st.cache['r' + st.month] = await K.report(mosque.id, st.month)); data = await monthData(st.month); } catch (e) { frame(h('div', { class: 'panel' }, h('p', {}, K.errorText(e)))); return; }
    const canClose = R.approve && !rep.closed && st.month < nowKey;
    const lc = K.lastClosed(book());
    const spend = data.rows.filter(r => r.direction === 'keluar' && !r.reverses && !data.reversed.has(r.id));
    const listBox = h('div', { class: 'kas-list', id: 'kas-recent' }, ...(spend.length ? spend.slice(0, 5).map(r => itemRow(r, data.reversed, 'ringkasan')) : [h('p', { class: 'muted kas-empty' }, 'Belum ada pengeluaran di bulan ini.')]));
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
      h('div', { class: 'kas-sechead' }, h('h3', {}, 'Daftar Pengeluaran'), h('button', { class: 'kas-seeall', type: 'button', id: 'kas-seeall', onclick: () => { st.filter = 'keluar'; show('catatan'); } }, 'Lihat Semua ›')),
      listBox,
      R.write ? h('button', { class: 'btn-primary kas-add', type: 'button', id: 'kas-add', onclick: () => openForm({}) }, '+ Tambah Transaksi') : '',
      acts);
  }

  /* --- Semua transaksi --- */
  async function showEntries() {
    frame(monthNav(st.month, m => { st.month = m; showEntries(); }, nowKey), h('p', { class: 'muted', id: 'kas-loading' }, 'Memuat…'));
    let data;
    try { data = await monthData(st.month); } catch (e) { frame(h('div', { class: 'panel' }, h('p', {}, K.errorText(e)))); return; }
    const body = h('div', { id: 'kas-entries' });
    const flt = h('div', { class: 'seg kas-flt', role: 'group', 'aria-label': 'Saring jenis' }, ...[['semua', 'Semua'], ['masuk', 'Kas Masuk'], ['keluar', 'Kas Keluar']].map(([k, l]) =>
      h('button', { class: 'segb', type: 'button', id: 'kas-flt-' + k, 'aria-pressed': String(st.filter === k), 'aria-selected': String(st.filter === k), onclick: () => { st.filter = k; flt.querySelectorAll('.segb').forEach(b => { const on = b.id === 'kas-flt-' + k; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-selected', String(on)); }); paint(); } }, l)));
    const sel = h('select', { class: 'in', id: 'kas-f-acc', 'aria-label': 'Saring akun' }, h('option', { value: '' }, 'Semua akun'), ...book().accounts.map(a => h('option', { value: a.id }, a.name)));
    sel.value = st.acc;
    function paint() {
      const list = data.rows.filter(r => (!st.acc || r.account_id === st.acc) && (st.filter === 'semua' || r.direction === st.filter));
      const inT = list.reduce((s, r) => s + (r.direction === 'masuk' ? K.effect(r) : 0), 0), outT = list.reduce((s, r) => s + (r.direction === 'keluar' ? -K.effect(r) : 0), 0);
      body.replaceChildren(h('p', { class: 'muted', id: 'kas-sum' }, list.length + ' transaksi · kas masuk ' + K.money(inT) + ' · kas keluar ' + K.money(outT)),
        ...(list.length ? [h('div', { class: 'kas-list' }, ...list.map(r => itemRow(r, data.reversed, 'catatan')))] : [h('div', { class: 'empty' }, h('p', { class: 'muted' }, 'Belum ada transaksi di bulan ini.'))]));
    }
    sel.addEventListener('change', () => { st.acc = sel.value; paint(); });
    frame(monthNav(st.month, m => { st.month = m; showEntries(); }, nowKey), flt, book().accounts.length > 1 ? sel : '', body,
      R.write ? h('button', { class: 'btn-primary kas-add', type: 'button', id: 'kas-add', onclick: () => openForm({}) }, '+ Tambah Transaksi') : ''); paint();
  }

  /* --- Rincian transaksi (layar 8) --- */
  async function showDetail(e, reversed, from) {
    const rev = !!e.reverses, done = reversed.has(e.id), v = K.effect(e);
    const row = (label, val, id) => h('div', { class: 'kas-drow', ...(id ? { id } : {}) }, h('span', { class: 'muted' }, label), h('b', {}, val));
    const rows = [row('Kategori', catName(e.category_id), 'kas-d-cat')];
    if (e.item_name) rows.push(row('Nama barang', e.item_name, 'kas-d-item'));
    if (e.item_qty) rows.push(row('Jumlah barang', String(e.item_qty), 'kas-d-qty'));
    rows.push(row('Keterangan', e.description, 'kas-d-desc'));
    if (book().accounts.length > 1) rows.push(row('Akun', accName(e.account_id)));
    if (e.counterparty) rows.push(row(e.direction === 'masuk' ? 'Donatur' : 'Penerima', e.counterparty));
    const chips = [rev ? h('span', { class: 'chip' }, 'Catatan koreksi') : '', done ? h('span', { class: 'chip chip-draft', id: 'kas-d-done' }, 'Sudah dikoreksi') : ''];
    const proofBox = h('div', { class: 'kas-dproof', id: 'kas-d-proof' });
    if (e.proof_path) {
      proofBox.append(h('span', { class: 'muted' }, 'Foto nota'));
      const holder = h('div', { class: 'kas-pthumb' }, h('span', { class: 'muted' }, 'Memuat…'));
      proofBox.append(holder);
      K.proofUrl(e.proof_path).then(u => {
        const img = h('img', { class: 'kas-proofimg thumb', src: u, alt: 'Foto nota' });
        holder.replaceChildren(img, h('button', { class: 'btn-sm ghost', type: 'button', id: 'kas-d-view', onclick: () => { img.classList.toggle('big'); } }, 'Lihat Foto'));
      }).catch(() => holder.replaceChildren(h('span', { class: 'muted' }, 'Nota belum bisa dibuka.')));
    }
    const canAct = R.write && !rev && !done;
    sub('Detail Transaksi', from,
      h('div', { class: 'panel kas-detail', 'data-id': e.id },
        h('div', { class: 'kas-dtop' }, h('span', { class: 'kas-ico big ' + (e.direction === 'masuk' ? 'pos' : 'neg') }, ic(e.direction === 'masuk' ? 'inn' : 'out', 26)),
          h('div', {}, h('b', { class: 'kas-dtitle', id: 'kas-d-title' }, K.entryTitle(e)), h('b', { class: 'kas-damt ' + (v >= 0 ? 'pos' : 'neg'), id: 'kas-d-amt' }, (v > 0 ? '+ ' : '- ') + K.money(Math.abs(v))),
            h('span', { class: 'muted kas-r2' }, K.dayLabel(e.entry_date) + ' · ' + K.timeLabel(e.created_at)))),
        h('div', { class: 'chips' }, ...chips), ...rows, e.proof_path ? proofBox : ''),
      canAct ? h('div', { class: 'qa-acts kas-dacts' },
        h('button', { class: 'btn-primary', type: 'button', id: 'kas-d-edit', onclick: () => openForm({ edit: e, from }) }, 'Ubah'),
        h('button', { class: 'btn-sm alt', type: 'button', id: 'kas-d-del', onclick: async () => {
          const why = await ask({ title: 'Hapus transaksi ini?', text: '“' + K.entryTitle(e) + '” (' + K.money(e.amount) + ') tidak dihapus dari buku, tetapi dibatalkan dengan catatan koreksi hari ini agar jejaknya tetap ada. Tulis alasannya.', reason: true });
          if (!why) return; const r = K.validateReason(why); if (!r) { toast('Alasan 3 sampai 150 huruf.', true); return; }
          try { await K.reverseEntry(e.id, r); toast('Transaksi dibatalkan dengan koreksi.'); await reload(from || 'catatan'); } catch (er) { toast(K.errorText(er), true); } } }, 'Hapus')) : '',
      canAct ? h('p', { class: 'hint' }, '“Ubah” dan “Hapus” tidak menimpa catatan lama: keduanya membuat catatan koreksi, supaya riwayat keuangan tetap utuh.') : '');
  }

  /* --- Formulir transaksi (layar 2, 3, 5, 7) --- */
  function openForm(init) {
    if (!R.write) { show('ringkasan'); return; }
    const accs = book().accounts.filter(a => a.active), minDate = K.minEntryDate(book());
    const from = init.from || st.tab;
    if (!accs.length) { sub('Tambah Transaksi', from, h('div', { class: 'empty' }, h('p', { class: 'muted' }, 'Belum ada akun kas aktif. Buat di Pengaturan.'))); return; }
    const e0 = init.edit || null, fv = init.fav || null;
    const f = {
      dir: (e0 && e0.direction) || (fv && fv.direction) || init.dir || 'keluar',
      cat: (e0 && e0.category_id) || (fv && fv.category_id) || '',
      account: (e0 && e0.account_id) || (accs.find(a => a.kind === 'umum') || accs[0]).id,
      amount: e0 ? String(e0.amount) : fv && fv.amount ? String(fv.amount) : '',
      date: e0 ? e0.entry_date : today,
      item: (e0 && e0.item_name) || (fv && fv.item_name) || '', qty: e0 && e0.item_qty ? String(e0.item_qty) : '',
      desc: e0 ? e0.description : (fv && fv.note) || '', party: (e0 && e0.counterparty) || '',
      proof: e0 && e0.proof_path ? e0.proof_path : null, file: null, fav: false, favName: ''
    };
    if (e0 && f.date < (minDate || '')) f.date = minDate;
    let mode = e0 || fv || init.full ? 'standar' : book().inputMode;
    let busy = false;
    const title = () => e0 ? 'Ubah Transaksi' : 'Tambah Transaksi';
    const catsFor = d => book().categories.filter(c => c.active && c.direction === d);
    if (f.cat && !catsFor(f.dir).some(c => c.id === f.cat)) f.cat = '';

    function paint() {
      const err = h('p', { class: 'mk-err', id: 'kas-f-err', role: 'alert' }, '');
      const bind = (el, key) => { el.addEventListener('input', () => { f[key] = el.value; }); return el; };
      const lab = (txt, id) => h('label', { class: 'hint kas-lab', for: id }, txt);
      const seg = h('div', { class: 'seg kas-dirseg', role: 'group', 'aria-label': 'Jenis transaksi' }, ...[['masuk', 'Kas Masuk'], ['keluar', 'Kas Keluar']].map(([d, l]) =>
        h('button', { class: 'segb', type: 'button', id: 'kas-dir-' + d, 'aria-pressed': String(f.dir === d), 'aria-selected': String(f.dir === d), ...(e0 ? { disabled: 'disabled' } : {}), onclick: () => { f.dir = d; f.cat = ''; paint(); } }, l)));
      const amount = bind(h('input', { class: 'in', id: 'kas-f-amount', inputmode: 'numeric', maxlength: '18', placeholder: 'Contoh: 150000', autocomplete: 'off', value: f.amount }), 'amount');
      const amountLab = lab(f.dir === 'masuk' || mode === 'cepat' ? 'Jumlah (Rp)' : 'Total pengeluaran (Rp)', 'kas-f-amount');
      const subtitle = f.dir === 'masuk' ? 'Catat setiap pemasukan masjid' : 'Catat setiap pengeluaran masjid';
      const kids = [];
      let cat = null, date = null, item = null, qty = null, desc = null, party = null, acc = null;
      if (mode === 'cepat') {
        const tiles = h('div', { class: 'kas-tiles', id: 'kas-tiles', role: 'radiogroup', 'aria-label': 'Kategori' }, ...catsFor(f.dir).map(c =>
          h('button', { class: 'kas-tile' + (f.cat === c.id ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': String(f.cat === c.id), 'data-id': c.id, onclick: () => { f.cat = c.id; tiles.querySelectorAll('.kas-tile').forEach(t => { const on = t.dataset.id === c.id; t.classList.toggle('on', on); t.setAttribute('aria-checked', String(on)); }); } },
            h('span', { class: 'kas-tico' }, (c.name || '?').trim().charAt(0).toUpperCase()), h('span', {}, c.name))));
        kids.push(h('p', { class: 'muted' }, 'Pilih kategori dan isi nominal saja.'), tiles, amountLab, fld('coin', amount),
          h('button', { class: 'linkbtn', type: 'button', id: 'kas-more', onclick: () => { mode = 'standar'; paint(); } }, 'Isi detail lengkap (nama barang, keterangan, nota)'));
      } else {
        cat = h('select', { class: 'in', id: 'kas-f-category' }, h('option', { value: '' }, 'Pilih kategori…'), ...catsFor(f.dir).map(c => h('option', { value: c.id }, c.name)));
        cat.value = f.cat; cat.addEventListener('change', () => { f.cat = cat.value; });
        date = bind(h('input', { class: 'in', id: 'kas-f-date', type: 'date', max: today, ...(minDate ? { min: minDate } : {}), value: f.date }), 'date');
        item = bind(h('input', { class: 'in', id: 'kas-f-item', maxlength: String(K.LIMIT.itemMax), placeholder: 'Contoh: Sapu lidi', autocomplete: 'off', value: f.item }), 'item');
        qty = bind(h('input', { class: 'in', id: 'kas-f-qty', inputmode: 'numeric', maxlength: '6', placeholder: 'Contoh: 3', autocomplete: 'off', value: f.qty }), 'qty');
        desc = bind(h('input', { class: 'in', id: 'kas-f-desc', maxlength: String(K.LIMIT.descMax), placeholder: 'Tambahkan catatan bila perlu', autocomplete: 'off', value: f.desc }), 'desc');
        party = bind(h('input', { class: 'in', id: 'kas-f-party', maxlength: String(K.LIMIT.partyMax), placeholder: f.dir === 'masuk' ? 'Nama atau "Hamba Allah"' : 'Nama toko atau penerima', autocomplete: 'off', value: f.party }), 'party');
        const accList = book().accounts.filter(a => a.active);
        if (accList.length > 1) { acc = h('select', { class: 'in', id: 'kas-f-account' }, ...accList.map(a => h('option', { value: a.id }, a.name + ' (' + K.kindLabel(a.kind) + ')'))); acc.value = f.account; acc.addEventListener('change', () => { f.account = acc.value; }); }
        kids.push(lab('Tanggal transaksi', 'kas-f-date'), fld('cal', date), lab(f.dir === 'masuk' ? 'Kategori pemasukan' : 'Kategori pengeluaran', 'kas-f-category'), fld('tag', cat));
        if (acc) kids.push(lab('Akun kas', 'kas-f-account'), fld('wallet', acc));
        if (f.dir === 'keluar') kids.push(lab('Nama barang atau keperluan (opsional)', 'kas-f-item'), fld('box', item), lab('Jumlah barang (opsional)', 'kas-f-qty'), fld('hash', qty));
        kids.push(amountLab, fld('coin', amount), lab('Keterangan (opsional)', 'kas-f-desc'), fld('note', desc), lab((f.dir === 'masuk' ? 'Donatur' : 'Penerima') + ' (opsional)', 'kas-f-party'), fld('user', party), photoBox());
      }
      const save = h('button', { class: 'btn-primary', type: 'submit', id: 'kas-f-save' }, 'Simpan Transaksi');
      const favBox = h('div', { class: 'kas-favbox' }, h('label', { class: 'kas-chk' }, h('input', { type: 'checkbox', id: 'kas-f-fav', ...(f.fav ? { checked: 'checked' } : {}), onchange: ev => { f.fav = ev.target.checked; favWrap.hidden = !f.fav; } }), h('span', {}, 'Simpan sebagai transaksi favorit')));
      const favName = bind(h('input', { class: 'in', id: 'kas-f-favname', maxlength: '60', placeholder: 'Nama favorit, mis. Listrik masjid', autocomplete: 'off', value: f.favName, }), 'favName');
      const favWrap = fld('star', favName); favWrap.hidden = !f.fav;
      favBox.append(favWrap);
      const form = h('form', { class: 'panel rform kas-form', id: 'kas-form', novalidate: 'novalidate' },
        h('p', { class: 'muted kas-fsub' }, subtitle), seg, favChips(), ...kids, favBox, err, save,
        h('p', { class: 'hint' }, 'Catatan yang sudah disimpan tidak bisa ditimpa. Jika salah, gunakan “Ubah” atau “Hapus” di rincian transaksi: keduanya membuat catatan koreksi.'));
      form.addEventListener('submit', async ev => {
        ev.preventDefault(); if (busy) return;
        const quick = mode === 'cepat';
        const v = K.validateEntry({ accountId: f.account, categoryId: f.cat, amount: f.amount, date: quick ? today : f.date, description: quick ? '' : f.desc, party: quick ? '' : f.party, itemName: quick ? '' : f.item, qty: quick ? '' : f.qty, maxDate: today, minDate });
        if (v.error) {
          err.textContent = v.error;
          const target = quick ? { category: form.querySelector('#kas-tiles .kas-tile'), amount }[v.field] : { account: acc, category: cat, amount, date, description: desc, party, item, qty }[v.field];
          if (target && target.focus) target.focus(); return;
        }
        if (f.fav && f.favName.trim().length < 2) { err.textContent = 'Nama favorit minimal 2 huruf.'; form.querySelector('#kas-f-favname').focus(); return; }
        if (f.dir === 'keluar') {
          let nowRep = null; try { nowRep = await K.report(mosque.id, nowKey); } catch (x) { /* abaikan */ }
          const a = nowRep && (nowRep.accounts || []).find(x => x.id === v.ok.accountId);
          const base = a ? a.saldo_akhir + (e0 && e0.direction === 'keluar' && e0.account_id === a.id && e0.entry_date.slice(0, 7) === nowKey.slice(0, 7) ? Number(e0.amount) : 0) : 0;
          if (a && base - v.ok.amount < 0 && !(await ask({ title: 'Saldo akun akan minus', text: 'Saldo "' + a.name + '" sekarang ' + K.money(base) + '. Setelah pengeluaran ini menjadi ' + K.money(base - v.ok.amount) + '. Tetap simpan?' }))) return;
        }
        err.textContent = ''; busy = true; save.disabled = true;
        try {
          let proof = quick ? null : f.proof;
          if (!quick && f.file) { setStatus('Memproses dan mengunggah nota…'); proof = await K.uploadProof(mosque.id, f.file); }
          if (e0) await K.replaceEntry(e0.id, v.ok, proof); else await K.addEntry(mosque.id, v.ok, proof);
          if (f.fav) {
            try { await K.saveFavorite(mosque.id, { direction: f.dir, name: f.favName.trim(), categoryId: f.cat, itemName: v.ok.itemName, amount: v.ok.amount, note: v.ok.description }); }
            catch (x) { toast('Transaksi tersimpan, tetapi favorit belum: ' + K.errorText(x), true); }
          }
          toast(e0 ? 'Transaksi diubah (catatan lama dikoreksi).' : 'Transaksi disimpan.');
          st.cache = {}; st.month = v.ok.date.slice(0, 7) + '-01'; busy = false; await reload(init.after || (e0 ? from : 'ringkasan')); return;
        } catch (x) { err.textContent = x && PRODUCT_ERRORS[x.code] ? PRODUCT_ERRORS[x.code] : K.errorText(x); setStatus(''); }
        busy = false; save.disabled = false;
      });
      sub(title(), from, form);
    }
    // Favorit dipakai lewat tombol cepat di atas formulir (tanpa tab sendiri).
    function favChips() {
      const list = (book().favorites || []).filter(x => x.direction === f.dir);
      if (e0 || !list.length) return '';
      return h('div', { class: 'kas-favchips', id: 'kas-favchips' }, h('span', { class: 'hint' }, 'Favorit:'), ...list.map(x => h('span', { class: 'kas-favchip', 'data-id': x.id },
        h('button', { class: 'kas-use', type: 'button', onclick: () => { f.cat = x.category_id; f.item = x.item_name || ''; f.desc = x.note || ''; f.amount = x.amount ? String(x.amount) : ''; f.qty = ''; mode = 'standar'; paint(); } }, x.name),
        h('button', { class: 'kas-fav-del', type: 'button', 'aria-label': 'Hapus favorit ' + x.name, onclick: async () => {
          if (!(await ask({ title: 'Hapus favorit?', text: '“' + x.name + '” dihapus dari daftar favorit. Transaksi yang sudah tercatat tidak terpengaruh.' }))) return;
          try { await K.deleteFavorite(x.id); book().favorites = book().favorites.filter(y => y.id !== x.id); toast('Favorit dihapus.'); paint(); } catch (er) { toast(K.errorText(er), true); } } }, '×'))));
    }
    let statusEl = null;
    const setStatus = t => { if (statusEl) statusEl.textContent = t || 'Format JPG atau PNG. Foto otomatis diperkecil (maks 100 KB).'; };

    // Kotak unggah nota (layar 7): foto opsional, ada pratinjau, nama, ukuran, dan tombol hapus.
    function photoBox() {
      const wrap = h('div', { class: 'kas-photo', id: 'kas-photo' });
      const input = h('input', { type: 'file', id: 'kas-f-file', class: 'kas-file-in', accept: 'image/jpeg,image/png,image/webp', 'aria-label': 'Foto nota' });
      statusEl = h('p', { class: 'hint', id: 'kas-f-status' }, 'Format JPG atau PNG. Foto otomatis diperkecil (maks 100 KB).');
      const filesEl = h('div', { class: 'kas-files', id: 'kas-files' });
      function drawFiles() {
        const out = [];
        if (f.file) {
          const url = URL.createObjectURL(f.file);
          out.push(h('div', { class: 'kas-frow' }, h('img', { class: 'kas-fthumb', src: url, alt: '' }), h('span', { class: 'kas-fname' }, h('b', {}, f.file.name || 'foto'), h('span', { class: 'muted' }, K.sizeLabel(f.file.size))),
            h('button', { class: 'kas-trash', type: 'button', id: 'kas-f-del', 'aria-label': 'Hapus foto', onclick: () => { f.file = null; input.value = ''; drawFiles(); } }, ic('trash', 18))));
        } else if (f.proof) {
          out.push(h('div', { class: 'kas-frow' }, h('span', { class: 'kas-fthumb ph' }, ic('camera', 20)), h('span', { class: 'kas-fname' }, h('b', {}, 'Nota sebelumnya'), h('span', { class: 'muted' }, 'Tetap dipakai bila tidak diganti')),
            h('button', { class: 'kas-trash', type: 'button', id: 'kas-f-del-old', 'aria-label': 'Lepas nota sebelumnya', onclick: () => { f.proof = null; drawFiles(); } }, ic('trash', 18))));
        }
        filesEl.replaceChildren(...out);
      }
      input.addEventListener('change', () => { const x = input.files && input.files[0]; if (x) { f.file = x; drawFiles(); } });
      wrap.append(h('span', { class: 'hint kas-lab' }, f.dir === 'masuk' ? 'Foto bukti (opsional)' : 'Foto nota (opsional)'),
        h('div', { class: 'kas-dz' }, h('span', { class: 'kas-dzico' }, ic('camera', 28)), h('p', { class: 'muted' }, 'Ambil foto nota atau pilih dari galeri'),
          h('button', { class: 'btn-sm', type: 'button', id: 'kas-f-pick', onclick: () => input.click() }, 'Pilih Foto'), statusEl), input, filesEl);
      drawFiles();
      return wrap;
    }
    paint();
  }

  /* --- Pengaturan (layar 4) --- */
  function radioCard(id, on, title, text, onPick, extra) {
    return h('button', { class: 'kas-radio' + (on ? ' on' : ''), type: 'button', id, role: 'radio', 'aria-checked': String(on), onclick: onPick },
      h('span', { class: 'kas-dot' }), h('span', { class: 'kas-rtxt' }, h('b', {}, title), h('span', { class: 'muted' }, text)), extra || '');
  }
  function showSettings() {
    const kids = [];
    if (R.approve) {
      const on = book().publicSummary;
      const pick = async want => {
        if (want === on) return;
        if (want && !(await ask({ title: 'Tampilkan ringkasan ke jamaah?', text: 'Total kas masuk, kas keluar, dan saldo akhir tiap bulan akan terlihat oleh semua pengunjung profil masjid ini. Rincian pengeluaran, penerima, dan nota tetap tertutup. Pastikan pengurus sepakat.' }))) return;
        try { await K.setPublic(mosque.id, want); toast(want ? 'Ringkasan keuangan ditampilkan ke jamaah.' : 'Laporan keuangan disembunyikan dari jamaah.'); await reload('pengaturan'); } catch (e) { toast(K.errorText(e), true); }
      };
      kids.push(h('div', { class: 'panel', id: 'kas-pubset' }, h('h3', {}, 'Transparansi laporan ke jamaah'),
        h('div', { class: 'kas-radios', role: 'radiogroup', 'aria-label': 'Transparansi laporan' },
          radioCard('kas-pub-on', on, 'Tampilkan ringkasan keuangan', 'Jamaah dapat melihat total kas masuk, kas keluar, dan saldo akhir. Rincian pengeluaran, penerima, dan nota tetap tertutup.', () => pick(true)),
          radioCard('kas-pub-off', !on, 'Sembunyikan laporan keuangan', 'Laporan keuangan hanya dapat dilihat oleh pengurus.', () => pick(false))),
        h('p', { class: 'hint', id: 'kas-pubstate' }, on ? 'Saat ini: ringkasan ditampilkan ke jamaah.' : 'Saat ini: laporan disembunyikan dari jamaah.')));
    }
    if (R.setup || R.approve) {
      const mode = book().inputMode;
      const pickMode = async m => {
        if (m === mode) return;
        try { await K.setMode(mosque.id, m); toast(m === 'cepat' ? 'Input cepat dipakai.' : 'Input standar dipakai.'); await reload('pengaturan'); } catch (e) { toast(K.errorText(e), true); }
      };
      kids.push(h('div', { class: 'panel', id: 'kas-modeset' }, h('h3', {}, 'Pengaturan pencatatan'),
        h('div', { class: 'kas-radios', role: 'radiogroup', 'aria-label': 'Cara mencatat' },
          radioCard('kas-mode-standar', mode === 'standar', 'Input standar', 'Formulir sederhana: tanggal, kategori, jumlah. Nama barang, keterangan, dan nota boleh dikosongkan.', () => pickMode('standar')),
          radioCard('kas-mode-cepat', mode === 'cepat', 'Input cepat (tanpa detail)', 'Pilih kategori dan isi nominal saja. Nama barang dan keterangan bersifat opsional.', () => pickMode('cepat'))),
        book().hasNew ? '' : h('p', { class: 'mk-err' }, 'Mode input belum aktif di server. Jalankan kas_baru.sql.')));
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
    const dirSel = h('select', { class: 'in', id: 'kas-c-dir', 'aria-label': 'Arah kategori' }, h('option', { value: 'masuk' }, 'Kas masuk'), h('option', { value: 'keluar' }, 'Kas keluar'));
    const name = h('input', { class: 'in', id: 'kas-c-name', maxlength: String(K.LIMIT.nameMax), placeholder: 'Nama kategori baru', autocomplete: 'off' });
    const err = h('p', { class: 'mk-err', id: 'kas-c-err', role: 'alert' }, '');
    const add = h('button', { class: 'btn-sm', type: 'button', id: 'kas-c-add', onclick: async () => {
      const n = name.value.trim(); if (n.length < 2) { err.textContent = 'Nama kategori minimal 2 huruf.'; return; }
      err.textContent = ''; add.disabled = true;
      try { await K.saveCategory(mosque.id, null, dirSel.value, n, true); toast('Kategori ditambahkan.'); await reload('pengaturan'); return; } catch (e) { err.textContent = K.errorText(e); }
      add.disabled = false; } }, 'Tambah kategori');
    const group = (d, label) => [h('h4', {}, label), ...book().categories.filter(c => c.direction === d).map(c => h('div', { class: 'kas-arow', 'data-id': c.id }, h('span', {}, c.name, c.active ? '' : h('span', { class: 'muted' }, ' · nonaktif')),
      h('button', { class: 'btn-sm ghost kas-c-toggle', type: 'button', onclick: async () => { try { await K.saveCategory(mosque.id, c.id, c.direction, c.name, !c.active); await reload('pengaturan'); } catch (e) { toast(K.errorText(e), true); } } }, c.active ? 'Nonaktifkan' : 'Aktifkan')))];
    return h('div', { class: 'panel rform', id: 'kas-categories' }, h('h3', {}, 'Kategori'), ...group('masuk', 'Kas masuk'), ...group('keluar', 'Kas keluar'), dirSel, name, err, add);
  }

  show(st.tab);
}
