// BAITUNA - books-ui.js
// Halaman Pustaka Buku: daftar (tampilan Grid thumbnail penuh atau List thumbnail kecil + deskripsi singkat), detail, tombol Pesan
// (WhatsApp atau link checkout). Editor hanya untuk Super Admin. Pembayaran di luar BAITUNA.
import { h, toast, ask, hint } from './ui.js';
import { icon, ICONS } from './feed-ui.js';
import { getSession, storageUpload, storageRemove } from './supabase.js';
import { loadAccess } from './permissions.js';
import { prepareSquarePhoto, PRODUCT_ERRORS } from './photo.js';
import * as B from './books-service.js';

export const NOTE = 'Pembayaran dan pengiriman diurus langsung dengan penjual di luar BAITUNA. Periksa dulu penjual, harga, dan ongkos kirim sebelum membayar.';


/* ===== Editor teks sederhana (tebal, miring, garis bawah, daftar) ===== */
function richEditor(id, placeholder) {
  const el = h('div', { class: 'in rt-area', id, contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Deskripsi', 'data-placeholder': placeholder, spellcheck: 'true' });
  const run = cmd => { el.focus(); try { document.execCommand(cmd, false, null); } catch (e) { /* abaikan */ } sync(); };
  const SV = d => '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">' + d + '</svg>';
  const ICO = {
    ul: SV('<circle cx="4" cy="6" r="1.8"/><circle cx="4" cy="12" r="1.8"/><circle cx="4" cy="18" r="1.8"/><rect x="9" y="5" width="12" height="2.2" rx="1"/><rect x="9" y="11" width="12" height="2.2" rx="1"/><rect x="9" y="17" width="12" height="2.2" rx="1"/>'),
    ol: SV('<text x="1" y="8" font-size="7" font-weight="700" font-family="Arial,sans-serif">1</text><text x="1" y="14.5" font-size="7" font-weight="700" font-family="Arial,sans-serif">2</text><text x="1" y="21" font-size="7" font-weight="700" font-family="Arial,sans-serif">3</text><rect x="9" y="5" width="12" height="2.2" rx="1"/><rect x="9" y="11" width="12" height="2.2" rx="1"/><rect x="9" y="17" width="12" height="2.2" rx="1"/>'),
    clear: SV('<path d="M15.1 3.6a2 2 0 0 1 2.8 0l2.5 2.5a2 2 0 0 1 0 2.8L11.9 17.4H17v2H8.6L3.6 14.4a2 2 0 0 1 0-2.8l11.5-8zM9.1 17.4l7.5-7.5-3.7-3.7-8.1 8.1 3.1 3.1h1.2z"/>'),
  };
  const mk = (content, cmd, label, cls, svg) => { const b = h('button', { class: 'rt-b' + (cls ? ' ' + cls : ''), type: 'button', 'data-cmd': cmd, 'aria-label': label, title: label, 'aria-pressed': 'false',
    onmousedown: ev => ev.preventDefault(), onclick: () => run(cmd) }, svg ? '' : content); if (svg) b.innerHTML = svg; return b; };
  const bar = h('div', { class: 'rt-bar', role: 'toolbar', 'aria-label': 'Format teks' },
    mk('B', 'bold', 'Tebal', 'rt-bold'), mk('I', 'italic', 'Miring', 'rt-ital'), mk('U', 'underline', 'Garis bawah', 'rt-under'),
    h('span', { class: 'rt-sep', 'aria-hidden': 'true' }),
    mk('', 'insertUnorderedList', 'Daftar butir', '', ICO.ul), mk('', 'insertOrderedList', 'Daftar nomor', '', ICO.ol),
    h('span', { class: 'rt-sep', 'aria-hidden': 'true' }),
    mk('', 'removeFormat', 'Hapus format', '', ICO.clear));
  function sync() {
    for (const b of bar.querySelectorAll('[data-cmd]')) {
      const c = b.getAttribute('data-cmd'); let on = false;
      if (c !== 'removeFormat') { try { on = document.queryCommandState(c); } catch (e) { /* abaikan */ } }
      b.setAttribute('aria-pressed', String(!!on));
    }
  }
  el.addEventListener('keyup', sync); el.addEventListener('mouseup', sync); el.addEventListener('focus', sync);
  // Tempel selalu sebagai teks polos agar format dari tempat lain tidak ikut.
  el.addEventListener('paste', ev => {
    const t = ev.clipboardData && ev.clipboardData.getData('text/plain'); if (t == null) return;
    ev.preventDefault(); try { document.execCommand('insertText', false, t); } catch (e) { /* abaikan */ }
  });
  const box = h('div', { class: 'rt-box' }, bar, el);
  return {
    el, box,
    get: () => { const v = B.sanitizeHtml(el.innerHTML); return B.htmlToText(v) ? v : ''; },
    set: html => { el.innerHTML = B.descToHtml(html); },
  };
}

export function booksPage({ go } = {}) {
  const wrap = h('div', { class: 'books' });
  const st = { items: null, fail: null, kind: '', q: '', view: B.loadView(), isAdmin: false, open: '' };
  const draw = (...k) => wrap.replaceChildren(...k);
  const back = (label, fn) => h('button', { class: 'btn-ghost bk-back', type: 'button', id: 'bk-back', onclick: fn }, label);
  const empty = t => h('div', { class: 'empty' }, icon(ICONS.book, 'ic-lg'), h('p', { class: 'muted' }, t));

  const descNode = d => { const n = h('div', { class: 'bk-desc' }); n.innerHTML = B.descToHtml(d); return n; };
  const thumb = (b, cls) => {
    const u = B.coverUrl(b);
    return u ? h('img', { class: 'bk-img ' + cls, src: u, alt: 'Sampul ' + b.title, loading: 'lazy', decoding: 'async' })
      : h('span', { class: 'bk-img bk-ph ' + cls, 'aria-hidden': 'true' }, icon(ICONS.book, 'ic-lg'));
  };

  async function load() {
    st.fail = null;
    try { st.items = await B.listBooks(); } catch (e) { st.items = null; st.fail = e; }
  }

  /* ===== Daftar ===== */
  function viewSeg() {
    return h('div', { class: 'seg bk-seg', id: 'bk-view', role: 'group', 'aria-label': 'Tampilan' }, ...[['grid', 'Grid'], ['list', 'List']].map(([k, l]) =>
      h('button', { class: 'segb', type: 'button', id: 'bk-v-' + k, 'aria-pressed': String(st.view === k), 'aria-selected': String(st.view === k), onclick: () => { if (st.view !== k) { st.view = k; B.saveView(k); drawList(); } } }, l)));
  }
  const gridItem = b => h('button', { class: 'bk-gi', type: 'button', 'data-id': b.id, 'aria-label': b.title, onclick: () => showDetail(b.id) }, thumb(b, 'bk-g-img'));
  const listItem = b => h('button', { class: 'bk-li', type: 'button', 'data-id': b.id, onclick: () => showDetail(b.id) }, thumb(b, 'bk-l-img'),
    h('span', { class: 'bk-lt' }, h('b', { class: 'bk-title' }, b.title),
      h('span', { class: 'muted bk-sd' }, B.shortDesc(b.description)),
      h('span', { class: 'bk-meta' }, h('span', { class: 'bk-price' }, B.priceText(b.price)), h('span', { class: 'chip' }, b.kind === 'digital' ? 'Digital' : 'Fisik'))));
  function drawList() {
    const kids = [h('h2', { class: 'wtitle' }, 'Pustaka Buku'), h('p', { class: 'muted' }, 'Buku fisik dan digital pilihan. Pesan lewat WhatsApp atau link checkout penjual.')];
    if (st.isAdmin) kids.push(h('div', { class: 'bk-acts' }, h('button', { class: 'btn-sm', type: 'button', id: 'bk-manage', onclick: showManage }, 'Kelola buku')));
    if (st.fail) {
      kids.push(empty(B.notReady(st.fail) ? 'Pustaka Buku belum aktif. Pengelola perlu menjalankan buku.sql.' : 'Daftar buku belum bisa dimuat. Periksa koneksi.'));
      if (!B.notReady(st.fail)) kids.push(h('button', { class: 'btn-sm', type: 'button', id: 'bk-retry', onclick: async () => { draw(h('p', { class: 'muted', id: 'bk-loading' }, 'Memuat…')); await load(); drawList(); } }, 'Coba lagi'));
      draw(...kids); return;
    }
    const search = h('input', { class: 'in', id: 'bk-q', type: 'search', maxlength: '60', placeholder: 'Cari buku…', 'aria-label': 'Cari buku' }); search.value = st.q;
    search.addEventListener('input', () => { st.q = search.value; paintItems(); });
    const chips = h('div', { class: 'mk-chips', id: 'bk-kinds', role: 'group', 'aria-label': 'Jenis buku' }, ...[{ key: '', label: 'Semua' }, ...B.KINDS].map(c =>
      h('button', { class: 'mk-chip' + (st.kind === c.key ? ' on' : ''), type: 'button', 'data-kind': c.key, 'aria-pressed': String(st.kind === c.key), onclick: () => { st.kind = c.key; drawList(); } }, c.label)));
    const box = h('div', { id: 'bk-items' });
    kids.push(h('div', { class: 'bk-tools' }, search, viewSeg()), chips, box, h('p', { class: 'hint' }, NOTE));
    draw(...kids); paintItems();
    function paintItems() {
      const rows = B.filterBooks(st.items || [], { kind: st.kind, q: st.q });
      if (!rows.length) { box.replaceChildren(empty(st.q || st.kind ? 'Tidak ada buku yang cocok.' : 'Belum ada buku di pustaka.')); return; }
      box.replaceChildren(st.view === 'list' ? h('div', { class: 'bk-list', id: 'bk-list' }, ...rows.map(listItem)) : h('div', { class: 'bk-grid', id: 'bk-grid' }, ...rows.map(gridItem)));
    }
  }
  async function showList() {
    if (st.items === null && !st.fail) { draw(h('p', { class: 'muted', id: 'bk-loading' }, 'Memuat…')); await load(); }
    drawList();
  }

  /* ===== Detail ===== */
  async function showDetail(id) {
    st.open = id;
    let b = (st.items || []).find(x => x.id === id);
    if (!b) { await load(); b = (st.items || []).find(x => x.id === id); }
    if (!b) { draw(back('← Pustaka', showList), empty('Buku tidak ditemukan atau sudah tidak ditampilkan.')); return; }
    const href = B.orderHref(b);
    const order = h('button', { class: 'btn-primary', type: 'button', id: 'bk-order', onclick: () => { if (!href) { toast('Cara pemesanan buku ini belum benar.', true); return; } window.open(href, '_blank', 'noopener,noreferrer'); } },
      B.orderLabel(b));
    if (!href) order.setAttribute('disabled', 'disabled');
    const cu = B.coverUrl(b);
    draw(back('← Pustaka', showList),
      h('article', { class: 'panel bk-detail', id: 'bk-detail' },
        cu ? h('img', { class: 'bk-cover', src: cu, alt: 'Sampul ' + b.title, decoding: 'async' }) : h('div', { class: 'bk-cover bk-ph', 'aria-hidden': 'true' }, icon(ICONS.book, 'ic-lg')),
        h('div', { class: 'chips mt' }, h('span', { class: 'chip' }, B.kindLabel(b.kind))),
        h('h3', { class: 'bk-dt' }, b.title), h('p', { class: 'bk-price bk-dp' }, B.priceText(b.price)),
        descNode(b.description),
        order));
  }

  /* ===== Kelola (Super Admin) ===== */
  async function showManage(editing) {
    if (!st.isAdmin) { showList(); return; }
    draw(back('← Pustaka', async () => { await load(); drawList(); }), h('h2', { class: 'wtitle' }, 'Kelola Pustaka Buku'), h('p', { class: 'muted', id: 'bk-loading' }, 'Memuat…'));
    let all;
    try { all = await B.listAllBooks(); } catch (e) { draw(back('← Pustaka', showList), empty(B.saveError(e))); return; }
    const e0 = editing && typeof editing === 'object' && editing.id ? all.find(x => x.id === editing.id) || null : null;
    const reload = () => showManage();
    const lab = (t, f) => h('label', { class: 'hint bk-lab', for: f }, t);
    const title = h('input', { class: 'in', id: 'bk-f-title', maxlength: String(B.LIMIT.titleMax), placeholder: 'Contoh: Fiqih Salat Praktis', autocomplete: 'off' });
    const rt = richEditor('bk-f-desc', 'Tentang isi buku, penulis, jumlah halaman, dll.');
    const desc = rt.el;
    const kind = h('select', { class: 'in', id: 'bk-f-kind', 'aria-label': 'Jenis buku' }, ...B.KINDS.map(k => h('option', { value: k.key }, k.label)));
    const price = h('input', { class: 'in', id: 'bk-f-price', inputmode: 'numeric', maxlength: '14', placeholder: 'Contoh: 85000', autocomplete: 'off' });
    const otype = h('select', { class: 'in', id: 'bk-f-otype', 'aria-label': 'Cara pemesanan' }, h('option', { value: 'wa' }, 'Pesan via WhatsApp'), h('option', { value: 'url' }, 'Link checkout (URL)'));
    const label = h('input', { class: 'in', id: 'bk-f-label', maxlength: String(B.LIMIT.labelMax), placeholder: 'Kosongkan untuk teks bawaan', autocomplete: 'off' });
    const target = h('input', { class: 'in', id: 'bk-f-target', maxlength: String(B.LIMIT.urlMax), autocomplete: 'off' });
    const active = h('input', { type: 'checkbox', id: 'bk-f-active' }); active.checked = true;
    const file = h('input', { class: 'in', type: 'file', id: 'bk-f-file', accept: 'image/jpeg,image/png,image/webp', 'aria-label': 'Banner buku' });
    const fstat = h('p', { class: 'hint', id: 'bk-f-status' }, 'Banner otomatis dijadikan kotak 1080 × 1080 (gambar utuh, tidak terpotong; latar putih) dan dikompres maksimal 100 KB.');
    const prev = h('div', { id: 'bk-f-prev' });
    const err = h('p', { class: 'mk-err', id: 'bk-f-err', role: 'alert' }, '');
    const tlabel = h('label', { class: 'hint bk-lab', for: 'bk-f-target' }, 'Nomor WhatsApp penjual *');
    const sync = () => { const wa = otype.value === 'wa'; target.setAttribute('placeholder', wa ? 'Contoh: 0812 3456 7890' : 'Contoh: https://toko.id/buku'); tlabel.textContent = wa ? 'Nomor WhatsApp penjual *' : 'Link checkout (https://) *'; target.setAttribute('inputmode', wa ? 'tel' : 'url'); };
    otype.addEventListener('change', sync); sync();
    let removeCover = false;
    function fill(b) {
      title.value = b.title; rt.set(b.description); label.value = b.order_label || ''; kind.value = b.kind; price.value = String(b.price); otype.value = b.order_type; sync();
      target.value = b.order_type === 'wa' ? b.order_wa : b.order_url; active.checked = !!b.active;
      const u = B.coverUrl(b); prev.replaceChildren(u ? h('img', { class: 'bk-pv', src: u, alt: 'Banner saat ini' }) : '');
      if (u) prev.append(h('button', { class: 'btn-sm alt', type: 'button', id: 'bk-f-rmcover', onclick: ev => { removeCover = true; prev.replaceChildren(h('p', { class: 'hint' }, 'Banner akan dihapus saat disimpan.')); } }, 'Hapus banner'));
    }
    if (e0) fill(e0);
    const save = h('button', { class: 'btn-primary', type: 'submit', id: 'bk-f-save' }, e0 ? 'Simpan perubahan' : 'Tambah buku');
    let busy = false;
    const form = h('form', { class: 'panel rform', id: 'bk-form', novalidate: 'novalidate' },
      h('h3', {}, e0 ? 'Ubah: ' + e0.title : 'Tambah buku'),
      lab('Nama buku *', 'bk-f-title'), title, lab('Deskripsi *', 'bk-f-desc'), rt.box,
      h('div', { class: 'grid2' }, h('div', {}, lab('Jenis buku *', 'bk-f-kind'), kind), h('div', {}, lab('Harga (Rp) * — isi 0 bila gratis', 'bk-f-price'), price)),
      lab('Cara pemesanan *', 'bk-f-otype'), otype, tlabel, target,
      lab('Teks tombol pesan (opsional, maks. ' + B.LIMIT.labelMax + ' huruf)', 'bk-f-label'), label,
      h('label', { class: 'qa-check' }, active, ' Tampilkan di pustaka (hilangkan centang untuk menyembunyikan)'),
      h('label', { class: 'hint bk-lab', for: 'bk-f-file' }, 'Banner buku (opsional)'), file, prev, fstat, err,
      h('div', { class: 'mt row-btns' }, save, e0 ? h('button', { class: 'btn-sm ghost', type: 'button', id: 'bk-f-cancel', onclick: reload }, 'Batal ubah') : ''));
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); if (busy) return;
      const v = B.validate({ title: title.value, description: rt.get(), kind: kind.value, price: price.value, orderType: otype.value, orderTarget: target.value, orderLabel: label.value, active: active.checked });
      if (v.error) { err.textContent = v.error; ({ title, description: desc, kind, price, target, orderType: otype, label })[v.field].focus(); return; }
      err.textContent = ''; busy = true; save.disabled = true;
      let uploaded = null;
      try {
        let img = null;
        const f = file.files && file.files[0];
        if (f) { fstat.textContent = 'Memproses banner…'; img = await prepareSquarePhoto(f); }
        if (img) { uploaded = B.newCoverPath(); fstat.textContent = 'Mengunggah banner…'; await storageUpload(uploaded, img.blob, B.BUCKET); }
        if (e0) {
          const patch = { ...v.ok }; if (uploaded) patch.cover_path = uploaded; else if (removeCover) patch.cover_path = null;
          await B.updateBook(e0.id, patch);
          if ((uploaded || removeCover) && e0.cover_path) storageRemove(e0.cover_path, B.BUCKET).catch(() => {});
          toast('Perubahan disimpan.');
        } else { await B.createBook(v.ok, uploaded); toast('Buku ditambahkan.'); }
        uploaded = null; await reload(); return;
      } catch (e) {
        if (uploaded) storageRemove(uploaded, B.BUCKET).catch(() => {});
        if (e && e.status === 401) return;
        const msg = e && PRODUCT_ERRORS[e.code] ? PRODUCT_ERRORS[e.code] : B.saveError(e);
        err.textContent = msg; fstat.textContent = 'Banner kotak 1080 × 1080, maksimal 100 KB.';
      }
      busy = false; save.disabled = false;
    });
    const row = b => h('div', { class: 'panel bk-mrow', 'data-id': b.id, 'data-active': String(!!b.active) },
      h('span', { class: 'bk-mt' }, thumb(b, 'bk-l-img'), h('span', {}, h('b', { class: 'bk-title' }, b.title), h('span', { class: 'muted bk-sd' }, B.priceText(b.price) + ' · ' + B.kindLabel(b.kind) + (b.active ? '' : ' · disembunyikan')))),
      h('div', { class: 'qa-acts' },
        h('button', { class: 'btn-sm ghost bk-edit', type: 'button', onclick: () => { showManage(b); window.scrollTo(0, 0); } }, 'Ubah'),
        h('button', { class: 'btn-sm ghost bk-toggle', type: 'button', onclick: async () => { try { await B.updateBook(b.id, { active: !b.active }); toast(b.active ? 'Disembunyikan.' : 'Ditampilkan.'); reload(); } catch (e) { toast(B.saveError(e), true); } } }, b.active ? 'Sembunyikan' : 'Tampilkan'),
        h('button', { class: 'btn-sm alt bk-del', type: 'button', onclick: async () => {
          if (!(await ask({ title: 'Hapus buku ini?', text: '“' + b.title + '” dihapus permanen beserta bannernya. Untuk sementara, gunakan Sembunyikan.' }))) return;
          try { await B.deleteBook(b.id); if (b.cover_path) storageRemove(b.cover_path, B.BUCKET).catch(() => {}); toast('Buku dihapus.'); reload(); } catch (e) { toast(B.saveError(e), true); }
        } }, 'Hapus')));
    draw(back('← Pustaka', async () => { await load(); drawList(); }), h('h2', { class: 'wtitle' }, 'Kelola Pustaka Buku'),
      h('p', { class: 'muted' }, 'Hanya Super Admin yang bisa menambah, mengubah, menyembunyikan, dan menghapus buku. Admin masjid, pengurus, dan jamaah hanya melihat dan memesan.'),
      form, h('h3', {}, 'Semua buku (' + all.length + ')'), all.length ? h('div', { id: 'bk-managed' }, ...all.map(row)) : empty('Belum ada buku. Tambahkan lewat formulir di atas.'),
      h('p', { class: 'hint' }, 'Nomor WhatsApp dan link checkout tidak ditampilkan sebagai teks; pembeli hanya melihat tombol Pesan. Namun begitu tombol ditekan, tujuan (WhatsApp atau halaman toko) terbuka dan tampak di peramban pembeli, jadi gunakan nomor dan link khusus penjualan.'));
  }

  // Mulai
  const sess = getSession();
  if (sess && sess.user) loadAccess(sess.user).then(a => { if (a && a.isAdmin) { st.isAdmin = true; if (wrap.querySelector('#bk-items')) drawList(); } }).catch(() => {});
  showList();
  return wrap;
}
