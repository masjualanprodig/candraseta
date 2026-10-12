// BAITUNA - market-ui.js
// Pasar Umat (tahap katalog): lihat produk, profil penjual, hubungi penjual (khusus yang sudah masuk), lapor, dan kelola toko sendiri.
// Setiap produk baru/diubah menunggu verifikasi Super Admin. Belum ada pembayaran di dalam aplikasi.
import { h, toast, hint, ask } from './ui.js';
import { icon, ICONS } from './feed-ui.js';
import { getSession, publicPhotoUrl, storageUpload, storageRemove } from './supabase.js';
import { prepareProductPhoto, PRODUCT_ERRORS } from './photo.js';
import { searchMosques } from './public-service.js';
import * as M from './market-service.js';

const msgOf = e => e && e.status === 0 ? 'Tidak ada koneksi internet.' : 'Belum berhasil. ' + hint(e);
const notReady = e => e && (e.code === '42P01' || e.code === 'PGRST205' || e.status === 404);
const photoUrl = p => (p ? publicPhotoUrl(p, M.MARKET_BUCKET) : null);
const fmtDate = iso => { try { return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; } };

export function marketPage(opts = {}) {
  const wrap = h('div', { class: 'market' });
  const onLogin = opts.onLogin || (() => {});
  let view = { name: 'list' }, cat = '', q = '';
  const loggedIn = () => !!getSession();
  const go = (name, extra) => { view = { name, ...(extra || {}) }; draw(); window.scrollTo(0, 0); };

  /* ---------- bagian umum ---------- */
  const thumb = (p, cls) => {
    const u = photoUrl(M.firstPhoto(p)), box = h('div', { class: 'mk-ph ' + (cls || '') });
    if (u) { const img = h('img', { src: u, alt: p.title, loading: 'lazy', decoding: 'async' }); img.addEventListener('error', () => { img.remove(); box.append(icon(ICONS.market, 'ic-lg')); }); box.append(img); }
    else box.append(icon(ICONS.market, 'ic-lg'));
    return box;
  };
  const notice = () => h('p', { class: 'mk-note' }, 'Transaksi dilakukan langsung antara pembeli dan penjual. BAITUNA belum memproses pembayaran. Tetap waspada, dan jangan transfer uang sebelum yakin.');
  const back = (label, fn) => h('button', { class: 'btn-sm ghost', type: 'button', onclick: fn }, label);

  function gallery(p) {
    const list = (p.photos || []).filter(Boolean);
    if (!list.length) return thumb(p, 'mk-big');
    const main = h('div', { class: 'mk-ph mk-big', id: 'mk-main' });
    const show = i => {
      const img = h('img', { src: photoUrl(list[i]), alt: p.title + ' (foto ' + (i + 1) + ' dari ' + list.length + ')', decoding: 'async' });
      img.addEventListener('error', () => { img.remove(); main.append(icon(ICONS.market, 'ic-lg')); });
      main.replaceChildren(img);
      strip.querySelectorAll('.mk-th').forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-pressed', String(j === i)); });
    };
    const strip = h('div', { class: 'mk-strip', role: 'group', 'aria-label': 'Foto' }, ...(list.length > 1 ? list.map((u, i) =>
      h('button', { class: 'mk-th', type: 'button', 'data-i': String(i), 'aria-label': 'Foto ' + (i + 1), onclick: () => show(i) }, h('img', { src: photoUrl(u), alt: '', loading: 'lazy' }))) : []));
    show(0);
    return h('div', { class: 'mk-gal' }, main, strip);
  }

  function card(p) {
    const b = h('button', { class: 'mk-card', type: 'button', 'data-id': p.id, onclick: () => go('product', { id: p.id }) },
      thumb(p), h('div', { class: 'mk-ct' }, h('b', { class: 'mk-t' }, p.title), h('span', { class: 'mk-p' }, M.priceText(p.price, p.price_note)),
        h('span', { class: 'mk-s' }, [p.seller && p.seller.name, p.seller && p.seller.city].filter(Boolean).join(' · ')),
        p.available === false ? h('span', { class: 'mk-out' }, 'Stok habis') : ''));
    return b;
  }

  /* ---------- daftar ---------- */
  function listView() {
    const grid = h('div', { class: 'mk-grid', 'aria-live': 'polite' }), more = h('div', { class: 'mk-more' });
    let offset = 0, token = 0;
    async function load(reset) {
      const my = ++token;
      if (reset) { offset = 0; grid.replaceChildren(h('p', { class: 'muted center mk-wide' }, 'Memuat…')); more.replaceChildren(); }
      try {
        const r = await M.listProducts({ category: cat, q, offset });
        if (my !== token) return;
        if (reset) grid.replaceChildren();
        if (!r.items.length && reset) grid.replaceChildren(h('div', { class: 'mk-empty mk-wide' }, icon(ICONS.market, 'ic-lg'),
          h('p', { class: 'muted' }, q || cat ? 'Belum ada produk yang cocok.' : 'Belum ada produk yang tayang. Jadilah penjual pertama!')));
        grid.append(...r.items.map(card)); offset += r.items.length;
        more.replaceChildren(r.hasMore ? h('button', { class: 'btn-sm ghost', type: 'button', id: 'mk-more', onclick: () => load(false) }, 'Muat lebih banyak') : '');
      } catch (e) {
        if (my !== token) return;
        grid.replaceChildren(h('div', { class: 'mk-empty mk-wide' }, h('p', { class: 'muted' }, notReady(e) ? 'Pasar Umat belum aktif. Admin perlu menjalankan pasar.sql.' : 'Produk belum bisa dimuat. Periksa koneksi.'),
          notReady(e) ? '' : h('button', { class: 'btn-sm', type: 'button', onclick: () => load(true) }, 'Coba lagi')));
      }
    }
    const search = h('input', { class: 'in', type: 'search', id: 'mk-q', placeholder: 'Cari produk atau jasa…', maxlength: '40', autocomplete: 'off', 'aria-label': 'Cari produk' });
    search.value = q; let tm = null;
    search.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { q = search.value.trim(); load(true); }, 350); });
    const chips = h('div', { class: 'mk-chips', role: 'group', 'aria-label': 'Kategori' }, ...[{ key: '', label: 'Semua' }, ...M.CATS].map(c =>
      h('button', { class: 'mk-chip' + (cat === c.key ? ' on' : ''), type: 'button', 'data-cat': c.key, 'aria-pressed': String(cat === c.key), onclick: () => { cat = c.key; chips.querySelectorAll('.mk-chip').forEach(x => { const on = x.dataset.cat === cat; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); }); load(true); } }, c.label)));
    setTimeout(() => load(true), 0);
    return [
      h('p', { class: 'muted mk-intro' }, 'Produk dan jasa usaha jamaah. Setiap produk diperiksa Super Admin sebelum tayang.'),
      h('div', { class: 'mk-actions' }, h('button', { class: 'btn-sm', type: 'button', id: 'mk-sell', onclick: () => go('my') }, 'Jualan di sini'), h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => go('rules') }, 'Aturan & tips')),
      search, chips, grid, more, notice()
    ];
  }

  /* ---------- detail produk ---------- */
  function productView() {
    const box = h('div', {}, h('p', { class: 'muted center' }, 'Memuat…'));
    (async () => {
      let p;
      try { p = await M.getProduct(view.id); } catch (e) { box.replaceChildren(h('p', { class: 'muted center' }, 'Produk belum bisa dimuat. Periksa koneksi.')); return; }
      if (!p) { box.replaceChildren(h('div', { class: 'mk-empty' }, h('p', { class: 'muted' }, 'Produk ini tidak ditemukan atau sudah tidak tayang.'))); return; }
      const s = p.seller;
      const contactBox = h('div', { class: 'mk-contact' });
      const contactBtn = h('button', { class: 'btn-sm', type: 'button', id: 'mk-wa', onclick: async () => {
        contactBtn.disabled = true;
        try {
          const c = await M.getContact(p.seller_id), link = c && M.waLink(c.whatsapp, M.orderText(p.title, s && s.name));
          if (!link) { toast('Kontak penjual belum tersedia.', true); return; }
          contactBox.replaceChildren(h('p', { class: 'muted' }, 'WhatsApp: ', h('b', {}, M.waDisplay(c.whatsapp))), c.other_contact ? h('p', { class: 'muted' }, 'Kontak lain: ', c.other_contact) : '');
          window.open(link, '_blank', 'noopener');
        } catch (e) { toast(e && e.status === 0 ? 'Tidak ada koneksi internet.' : 'Kontak belum bisa dimuat.', true); }
        contactBtn.disabled = false;
      } }, 'Hubungi penjual via WhatsApp');
      const reportBox = h('div', { class: 'mk-report' });
      const reportBtn = h('button', { class: 'btn-sm ghost', type: 'button', id: 'mk-report', onclick: () => { if (!loggedIn()) { onLogin(); return; } openReport(reportBox, p); } }, 'Laporkan produk ini');
      box.replaceChildren(
        back('← Daftar produk', () => go('list')),
        h('article', { class: 'panel mk-detail' }, gallery(p),
          h('div', { class: 'mk-chips1' }, h('span', { class: 'mk-badge' }, M.catLabel(p.category)), p.available === false ? h('span', { class: 'mk-badge out' }, 'Stok habis') : ''),
          h('h2', { class: 'mk-h' }, p.title), h('p', { class: 'mk-price' }, M.priceText(p.price, p.price_note)),
          h('p', { class: 'mk-desc' }, p.description),
          p.address ? h('div', { class: 'mk-addr', id: 'mk-addr' }, h('b', {}, 'Alamat'), h('p', {}, p.address)) : '',
          h('div', { class: 'mk-halal' }, h('b', {}, 'Pernyataan penjual'), h('p', {}, 'Penjual menyatakan produk/jasa ini halal dan tidak melanggar aturan.' + (p.halal_note ? ' Keterangan: ' + p.halal_note : '')),
            h('p', { class: 'mk-fine' }, 'Ini pernyataan penjual. Pemeriksaan Super Admin menilai kelayakan tayang, bukan sertifikasi halal. Pembeli tetap dianjurkan memastikan sendiri.'))),
        s ? h('section', { class: 'panel mk-seller' }, h('h3', {}, 'Penjual'), h('b', {}, s.name), s.city ? h('p', { class: 'muted' }, s.city) : '', s.mosque_id ? h('p', { class: 'muted', id: 'mk-mosque' }) : '',
          s.bio ? h('p', { class: 'mk-desc' }, s.bio) : '',
          h('div', { class: 'mk-actions' }, h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => go('seller', { id: s.id }) }, 'Produk lain dari penjual ini'))) : '',
        h('section', { class: 'panel' }, h('h3', {}, 'Hubungi penjual'),
          loggedIn() ? [contactBtn, contactBox] : [h('p', { class: 'muted' }, 'Nomor penjual hanya ditampilkan untuk pengguna yang sudah masuk, demi menjaga privasi penjual.'), h('button', { class: 'btn-sm', type: 'button', id: 'mk-login', onclick: onLogin }, 'Masuk untuk menghubungi')],
          notice()),
        h('div', { class: 'mk-actions' }, reportBtn), reportBox);
      if (s && s.mosque_id) M.getMosqueName(s.mosque_id).then(m => { const el = box.querySelector('#mk-mosque'); if (el && m) el.textContent = 'Jamaah ' + m.name; });
    })();
    return [box];
  }

  function openReport(box, p) {
    const sel = h('select', { class: 'in', id: 'mk-rreason', 'aria-label': 'Alasan laporan' }, ...M.REPORT_REASONS.map(r => h('option', { value: r.key }, r.label)));
    const note = h('textarea', { class: 'in', id: 'mk-rnote', rows: '3', maxlength: String(M.LIM.report), placeholder: 'Keterangan tambahan (opsional)', 'aria-label': 'Keterangan laporan' });
    const send = h('button', { class: 'btn-sm', type: 'button', id: 'mk-rsend', onclick: async () => {
      send.disabled = true;
      try {
        const r = await M.reportProduct(p.id, sel.value, note.value);
        box.replaceChildren(h('p', { class: 'mk-ok', role: 'status' }, r === 'dup' ? 'Anda sudah pernah melaporkan produk ini. Terima kasih.' : 'Laporan terkirim ke Super Admin. Terima kasih sudah menjaga Pasar Umat.'));
      } catch (e) { toast(msgOf(e), true); send.disabled = false; }
    } }, 'Kirim laporan');
    box.replaceChildren(h('div', { class: 'panel' }, h('h3', {}, 'Laporkan produk'), sel, note, h('div', { class: 'mk-actions' }, send, h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => box.replaceChildren() }, 'Batal'))));
  }

  /* ---------- halaman penjual ---------- */
  function sellerView() {
    const box = h('div', {}, h('p', { class: 'muted center' }, 'Memuat…')), grid = h('div', { class: 'mk-grid' });
    (async () => {
      try {
        const s = await M.getSeller(view.id);
        if (!s) { box.replaceChildren(back('← Daftar produk', () => go('list')), h('div', { class: 'mk-empty' }, h('p', { class: 'muted' }, 'Penjual tidak ditemukan.'))); return; }
        const r = await M.listProducts({ sellerId: s.id });
        grid.replaceChildren(...r.items.map(card));
        box.replaceChildren(back('← Daftar produk', () => go('list')), h('section', { class: 'panel' }, h('h2', { class: 'mk-h' }, s.name), s.city ? h('p', { class: 'muted' }, s.city) : '', h('p', { class: 'muted', id: 'mk-mosque' }),
          s.bio ? h('p', { class: 'mk-desc' }, s.bio) : '', h('p', { class: 'muted' }, 'Bergabung ' + fmtDate(s.created_at))), h('h3', { class: 'mk-sub' }, 'Produk'), grid);
        if (s.mosque_id) M.getMosqueName(s.mosque_id).then(m => { const el = box.querySelector('#mk-mosque'); if (el && m) el.textContent = 'Jamaah ' + m.name; });
      } catch (e) { box.replaceChildren(h('p', { class: 'muted center' }, 'Belum bisa dimuat. Periksa koneksi.')); }
    })();
    return [box];
  }

  /* ---------- aturan ---------- */
  function rulesView() {
    const ul = (...items) => h('ul', { class: 'mk-ul' }, ...items.map(t => h('li', {}, t)));
    return [back('← Daftar produk', () => go('list')),
      h('section', { class: 'panel' }, h('h3', {}, 'Aturan Pasar Umat'),
        h('p', { class: 'mk-desc' }, 'Pasar Umat dibuat untuk saling menolong dan menguatkan usaha jamaah. Agar tetap terjaga, setiap produk diperiksa Super Admin sebelum tayang.'),
        h('b', {}, 'Boleh dijual'), ul('Makanan dan minuman halal', 'Pakaian Muslim', 'Buku', 'Jasa yang halal dan sah', 'Usaha lain yang halal dan sah menurut hukum'),
        h('b', {}, 'Tidak boleh'), ul('Barang atau jasa yang haram atau melanggar syariat dan hukum (mis. minuman keras, narkoba, perjudian, riba)', 'Makanan tanpa keterangan kehalalan', 'Konten tidak pantas atau menyesatkan', 'Barang bajakan, palsu, atau hasil kejahatan', 'Penipuan, spam, atau iklan berulang'),
        h('b', {}, 'Kewajiban penjual'), ul('Deskripsi dan foto jujur sesuai barang/jasa yang sebenarnya', 'Mencantumkan keterangan halal untuk makanan (bahan atau nomor sertifikat halal)', 'Menjawab pembeli dengan sopan dan menepati janji', 'Mengubah isi produk akan membutuhkan verifikasi ulang'),
        h('b', {}, 'Tips pembeli'), ul('Tanyakan detail langsung ke penjual sebelum membeli', 'Lebih aman bertemu langsung atau bayar di tempat bila memungkinkan', 'Jangan transfer uang sebelum yakin', 'Laporkan produk yang mencurigakan dengan tombol "Laporkan produk ini"'),
        h('p', { class: 'mk-fine' }, 'BAITUNA hanya menyediakan etalase. Transaksi dan pembayaran terjadi langsung antara pembeli dan penjual. Super Admin berhak menolak produk dan menangguhkan penjual yang melanggar aturan. Aturan ini sebaiknya ditinjau pengurus/ustaz sebelum dipakai luas.'))];
  }

  /* ---------- toko saya ---------- */
  function myView() {
    const box = h('div', {});
    if (!loggedIn()) {
      box.append(back('← Daftar produk', () => go('list')), h('section', { class: 'panel center' }, h('h3', {}, 'Jualan di Pasar Umat'),
        h('p', { class: 'muted' }, 'Masuk dengan akun BAITUNA Anda untuk membuat profil penjual dan mengajukan produk. Setiap produk akan diperiksa Super Admin sebelum tayang.'),
        h('button', { class: 'btn-sm', type: 'button', id: 'mk-login', onclick: onLogin }, 'Masuk')));
      return [box];
    }
    box.append(h('p', { class: 'muted center' }, 'Memuat…'));
    (async () => {
      let seller;
      try { seller = await M.getMySeller(); } catch (e) {
        box.replaceChildren(back('← Daftar produk', () => go('list')), h('div', { class: 'mk-empty' }, h('p', { class: 'muted' }, notReady(e) ? 'Pasar Umat belum aktif.' : 'Belum bisa dimuat. Periksa koneksi.'))); return;
      }
      if (!seller) { go('sellerForm', { seller: null }); return; }
      let prods = [];
      try { prods = await M.listMyProducts(seller.id); } catch (e) { toast(msgOf(e), true); }
      const susp = seller.status === 'suspended';
      const rows = prods.map(p => h('div', { class: 'mk-mine', 'data-id': p.id },
        thumb(p, 'mk-sm'),
        h('div', { class: 'mk-mt' }, h('b', {}, p.title), h('span', { class: 'mk-p' }, M.priceText(p.price, p.price_note)),
          h('span', { class: 'mk-st ' + p.status }, M.STATUS_LABEL[p.status] || p.status),
          p.status === 'rejected' && p.status_reason ? h('span', { class: 'mk-why' }, 'Alasan: ' + p.status_reason) : '',
          p.status === 'pending' ? h('span', { class: 'mk-fine' }, 'Belum tampil di katalog sampai disetujui.') : '',
          h('div', { class: 'mk-rowact' },
            h('button', { class: 'btn-sm ghost', type: 'button', 'data-act': 'edit', onclick: () => go('productForm', { seller, product: p }) }, 'Ubah'),
            h('button', { class: 'btn-sm ghost', type: 'button', 'data-act': 'stock', onclick: async () => { try { await M.setAvailable(p.id, p.available === false); toast(p.available === false ? 'Ditandai tersedia.' : 'Ditandai stok habis.'); myView.reload(); } catch (e) { toast(msgOf(e), true); } } }, p.available === false ? 'Tandai tersedia' : 'Tandai habis'),
            h('button', { class: 'btn-sm alt', type: 'button', 'data-act': 'del', onclick: async () => {
              const ok = await ask({ title: 'Hapus produk?', text: '“' + p.title + '” akan dihapus permanen.' }); if (!ok) return;
              try { await M.deleteProduct(p.id); (p.photos || []).forEach(x => storageRemove(x, M.MARKET_BUCKET).catch(() => {})); toast('Produk dihapus.'); myView.reload(); } catch (e) { toast(msgOf(e), true); }
            } }, 'Hapus')))));
      box.replaceChildren(back('← Daftar produk', () => go('list')),
        h('section', { class: 'panel' }, h('h3', {}, seller.name), h('p', { class: 'muted' }, [seller.city, 'WhatsApp ' + M.waDisplay(seller.whatsapp)].filter(Boolean).join(' · ')),
          susp ? h('p', { class: 'mk-warn', role: 'status' }, 'Toko Anda sedang ditangguhkan Super Admin' + (seller.status_reason ? ': ' + seller.status_reason : '.') + ' Produk Anda tidak tampil di katalog. Hubungi pengurus untuk keterangan.') : '',
          h('div', { class: 'mk-actions' }, h('button', { class: 'btn-sm ghost', type: 'button', id: 'mk-editseller', onclick: () => go('sellerForm', { seller }) }, 'Ubah profil'),
            h('button', { class: 'btn-sm', type: 'button', id: 'mk-add', onclick: () => go('productForm', { seller, product: null }) }, 'Tambah produk'))),
        h('p', { class: 'mk-fine' }, 'Produk baru dan setiap perubahan isi (nama, harga, deskripsi, foto, kategori) menunggu verifikasi Super Admin sebelum tampil. Mengubah status stok tidak perlu verifikasi.'),
        rows.length ? h('div', { class: 'mk-minelist' }, ...rows) : h('div', { class: 'mk-empty' }, h('p', { class: 'muted' }, 'Belum ada produk. Ketuk "Tambah produk" untuk memulai.')),
        h('div', { class: 'mk-actions' }, h('button', { class: 'btn-sm alt', type: 'button', id: 'mk-delseller', onclick: async () => {
          const ok = await ask({ title: 'Hapus toko?', text: 'Profil penjual dan SEMUA produk Anda akan dihapus permanen.' }); if (!ok) return;
          try { prods.forEach(p => (p.photos || []).forEach(x => storageRemove(x, M.MARKET_BUCKET).catch(() => {}))); await M.deleteSeller(seller.id); toast('Toko dihapus.'); go('list'); } catch (e) { toast(msgOf(e), true); }
        } }, 'Hapus toko saya')));
      if (susp) box.querySelector('#mk-add').disabled = true;
    })();
    myView.reload = () => go('my');
    return [box];
  }

  /* ---------- formulir penjual ---------- */
  function sellerForm() {
    const ex = view.seller, vals = ex || {};
    const inp = (id, label, value, props = {}) => h('label', { class: 'flab' }, h('span', { class: 'hint' }, label), h('input', { class: 'in', id, value: value || '', autocomplete: 'off', ...props }));
    const err = h('p', { class: 'mk-err', role: 'alert', hidden: 'true' });
    const name = inp('mk-name', 'Nama usaha / penjual', vals.name, { maxlength: String(M.LIM.sname[1]) });
    const wa = inp('mk-wa-in', 'Nomor WhatsApp (hanya terlihat oleh pengguna yang sudah masuk)', vals.whatsapp ? M.waDisplay(vals.whatsapp) : '', { inputmode: 'tel', placeholder: '0812 3456 7890' });
    const city = inp('mk-city', 'Kota (opsional)', vals.city, { maxlength: String(M.LIM.city[1]) });
    const other = inp('mk-other', 'Kontak lain, mis. Instagram (opsional)', vals.other_contact, { maxlength: String(M.LIM.other) });
    const bio = h('textarea', { class: 'in', id: 'mk-bio', rows: '4', maxlength: String(M.LIM.bio), 'aria-label': 'Tentang usaha' }); bio.value = vals.bio || '';
    let mosqueId = vals.mosque_id || null;
    const mq = h('input', { class: 'in', id: 'mk-mq', type: 'search', placeholder: 'Cari nama masjid (opsional)', maxlength: '40', autocomplete: 'off', 'aria-label': 'Cari masjid' });
    const mres = h('div', { class: 'mk-mres' }), mcur = h('p', { class: 'muted', id: 'mk-mcur' });
    const showCur = async () => { if (!mosqueId) { mcur.textContent = 'Belum memilih masjid.'; return; } const m = await M.getMosqueName(mosqueId); mcur.textContent = m ? 'Masjid dipilih: ' + m.name : 'Masjid dipilih.'; };
    showCur(); let tm = null;
    mq.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(async () => {
      const t = mq.value.trim(); if (t.length < 2) { mres.replaceChildren(); return; }
      try { const r = await searchMosques({ q: t, province: '', offset: 0 }); const list = (r.items || r || []).slice(0, 6);
        mres.replaceChildren(...(list.length ? list.map(m => h('button', { class: 'mk-mpick', type: 'button', 'data-id': m.id, onclick: () => { mosqueId = m.id; mres.replaceChildren(); mq.value = ''; showCur(); } }, m.name + (m.city ? ' · ' + m.city : ''))) : [h('p', { class: 'muted' }, 'Masjid tidak ditemukan.')]));
      } catch { mres.replaceChildren(h('p', { class: 'muted' }, 'Pencarian belum bisa dimuat.')); }
    }, 350); });
    const clearM = h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { mosqueId = null; showCur(); } }, 'Hapus pilihan masjid');
    const agree = h('input', { type: 'checkbox', id: 'mk-agree' });
    const save = h('button', { class: 'btn-sm', type: 'button', id: 'mk-save', onclick: async () => {
      const r = M.checkSeller({ name: name.querySelector('input').value, bio: bio.value, city: city.querySelector('input').value, whatsapp: wa.querySelector('input').value, other_contact: other.querySelector('input').value, mosque_id: mosqueId });
      if (!r.ok) { err.textContent = Object.values(r.errors)[0]; err.hidden = false; return; }
      if (!ex && !agree.checked) { err.textContent = 'Centang persetujuan Aturan Pasar Umat.'; err.hidden = false; return; }
      err.hidden = true; save.disabled = true;
      try { await M.saveSeller(ex, r.value); toast(ex ? 'Profil diperbarui.' : 'Profil penjual dibuat. Sekarang tambahkan produk.'); go('my'); }
      catch (e) { err.textContent = e && e.code === '23505' ? 'Anda sudah punya profil penjual.' : msgOf(e); err.hidden = false; save.disabled = false; }
    } }, ex ? 'Simpan perubahan' : 'Buat profil penjual');
    return [back('← Kembali', () => go(ex ? 'my' : 'list')),
      h('section', { class: 'panel' }, h('h3', {}, ex ? 'Ubah profil penjual' : 'Buat profil penjual'), name, wa, city, other,
        h('label', { class: 'flab' }, h('span', { class: 'hint' }, 'Tentang usaha (opsional)'), bio),
        h('div', { class: 'mk-sub2' }, h('span', { class: 'hint' }, 'Jamaah masjid (opsional)'), mq, mres, mcur, clearM),
        ex ? '' : h('label', { class: 'mk-chk' }, agree, h('span', {}, ['Saya setuju dengan ', h('a', { href: '#', onclick: e => { e.preventDefault(); go('rules'); } }, 'Aturan Pasar Umat'), ' dan bertanggung jawab atas keaslian produk/jasa saya.'])),
        err, save)];
  }

  /* ---------- formulir produk ---------- */
  function productForm() {
    const { seller, product: ex } = view, v0 = ex || {};
    const err = h('p', { class: 'mk-err', role: 'alert', hidden: 'true' });
    const inp = (id, label, value, props = {}) => h('label', { class: 'flab' }, h('span', { class: 'hint' }, label), h('input', { class: 'in', id, value: value == null ? '' : String(value), autocomplete: 'off', ...props }));
    const title = inp('mk-title', 'Nama produk / jasa', v0.title, { maxlength: String(M.LIM.title[1]) });
    const catSel = h('select', { class: 'in', id: 'mk-cat', 'aria-label': 'Kategori' }, h('option', { value: '' }, 'Pilih kategori…'), ...M.CATS.map(c => h('option', { value: c.key }, c.label)));
    catSel.value = v0.category || '';
    const price = inp('mk-price', 'Harga dalam Rupiah (kosongkan bila "hubungi penjual")', v0.price, { inputmode: 'numeric', placeholder: 'mis. 25000' });
    const pnote = inp('mk-pnote', 'Keterangan harga (opsional)', v0.price_note, { maxlength: String(M.LIM.note), placeholder: 'mis. per porsi, mulai dari, per jam' });
    const addr = inp('mk-addr-in', 'Alamat usaha / tempat pengambilan (opsional)', v0.address, { maxlength: String(M.LIM.address) });
    const desc = h('textarea', { class: 'in', id: 'mk-desc', rows: '6', maxlength: String(M.LIM.desc[1]), 'aria-label': 'Deskripsi' }); desc.value = v0.description || '';
    const halalLabel = h('span', { class: 'hint' }, 'Keterangan halal (bahan / nomor sertifikat halal)');
    const halal = h('input', { class: 'in', id: 'mk-halal', value: v0.halal_note || '', maxlength: String(M.LIM.halal), autocomplete: 'off' });
    const syncHalal = () => { halalLabel.textContent = catSel.value === 'makanan' ? 'Keterangan halal, WAJIB untuk makanan (bahan / nomor sertifikat halal)' : 'Keterangan halal (opsional)'; };
    catSel.addEventListener('change', syncHalal); syncHalal();
    const decl = h('input', { type: 'checkbox', id: 'mk-decl' }); decl.checked = !!v0.halal_declared;
    const avail = h('input', { type: 'checkbox', id: 'mk-avail' }); avail.checked = v0.available !== false;
    const orig = (v0.photos || []).filter(Boolean);
    let keep = [...orig], added = [];
    const grid = h('div', { class: 'mk-pgrid', id: 'mk-pgrid' });
    const pick = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: 'true', id: 'mk-file', 'aria-label': 'Tambah foto' });
    const count = h('p', { class: 'mk-fine', id: 'mk-pcount' });
    const drawPhotos = () => {
      const tot = keep.length + added.length;
      grid.replaceChildren(
        ...keep.map((path, i) => h('div', { class: 'mk-pitem', 'data-kind': 'old' }, h('img', { src: photoUrl(path), alt: 'Foto tersimpan ' + (i + 1) }), h('button', { class: 'mk-px', type: 'button', 'aria-label': 'Hapus foto ' + (i + 1), onclick: () => { keep.splice(i, 1); drawPhotos(); } }, '×'))),
        ...added.map((a, i) => h('div', { class: 'mk-pitem', 'data-kind': 'new' }, h('img', { src: a.url, alt: 'Foto baru ' + (i + 1), class: 'mk-previmg' }), h('button', { class: 'mk-px', type: 'button', 'aria-label': 'Hapus foto baru ' + (i + 1), onclick: () => { URL.revokeObjectURL(a.url); added.splice(i, 1); drawPhotos(); } }, '×'))));
      count.textContent = tot + ' dari ' + M.MAX_PHOTOS + ' foto. Tiap foto otomatis diperkecil hingga maksimal 100 KB.';
      pick.disabled = tot >= M.MAX_PHOTOS;
    };
    pick.addEventListener('change', async () => {
      const files = [...(pick.files || [])]; pick.value = ''; err.hidden = true;
      let room = M.MAX_PHOTOS - keep.length - added.length, skipped = 0;
      for (const f of files) {
        if (room <= 0) { skipped++; continue; }
        try { const r = await prepareProductPhoto(f); added.push({ blob: r.blob, url: URL.createObjectURL(r.blob) }); room--; }
        catch (e) { err.textContent = PRODUCT_ERRORS[e && e.code] || 'Foto belum bisa dipakai.'; err.hidden = false; }
      }
      if (skipped) { err.textContent = 'Maksimal ' + M.MAX_PHOTOS + ' foto. Sisanya tidak dipakai.'; err.hidden = false; }
      drawPhotos();
    });
    drawPhotos();
    const save = h('button', { class: 'btn-sm', type: 'button', id: 'mk-save', onclick: async () => {
      const r = M.checkProduct({ title: title.querySelector('input').value, category: catSel.value, description: desc.value, price: price.querySelector('input').value, price_note: pnote.querySelector('input').value, address: addr.querySelector('input').value, halal_note: halal.value, halal_declared: decl.checked, available: avail.checked });
      if (!r.ok) { err.textContent = Object.values(r.errors)[0]; err.hidden = false; return; }
      err.hidden = true; save.disabled = true;
      const uploaded = [];
      try {
        for (let i = 0; i < added.length; i++) { const path = M.newPhotoPath(seller.id, i); await storageUpload(path, added[i].blob, M.MARKET_BUCKET); uploaded.push(path); }
        const finalList = [...keep, ...uploaded];
        if (ex) {
          await M.updateProduct(ex.id, r.value, finalList);
          orig.filter(x => !keep.includes(x)).forEach(x => storageRemove(x, M.MARKET_BUCKET).catch(() => {}));
          toast('Perubahan disimpan. Produk menunggu verifikasi ulang.');
        } else {
          await M.createProduct(M.newId(), seller.id, r.value, finalList);
          toast('Produk diajukan. Akan tampil setelah disetujui Super Admin.');
        }
        go('my');
      } catch (e) {
        uploaded.forEach(x => storageRemove(x, M.MARKET_BUCKET).catch(() => {}));
        err.textContent = e && /10 produk|40 produk/.test(e.message || '') ? e.message : msgOf(e); err.hidden = false; save.disabled = false;
      }
    } }, ex ? 'Simpan & ajukan ulang' : 'Ajukan produk');
    return [back('← Kembali', () => go('my')),
      h('section', { class: 'panel' }, h('h3', {}, ex ? 'Ubah produk' : 'Tambah produk'),
        ex ? h('p', { class: 'mk-fine' }, 'Setelah disimpan, produk menunggu verifikasi ulang dan tidak tampil di katalog sampai disetujui.') : '',
        title, h('label', { class: 'flab' }, h('span', { class: 'hint' }, 'Kategori'), catSel), price, pnote,
        h('label', { class: 'flab' }, h('span', { class: 'hint' }, 'Deskripsi (jujur dan jelas)'), desc),
        h('label', { class: 'flab' }, halalLabel, halal),
        addr, h('p', { class: 'mk-fine' }, 'Alamat tampil di halaman produk. Isi alamat usaha atau tempat pengambilan; jangan isi alamat rumah bila tidak ingin dikunjungi.'),
        h('div', { class: 'mk-sub2' }, h('span', { class: 'hint' }, 'Foto produk atau toko (opsional, maksimal 5)'), grid, count, pick),
        h('label', { class: 'mk-chk' }, decl, h('span', {}, 'Saya menyatakan produk/jasa ini halal, sah menurut hukum, dan sesuai Aturan Pasar Umat.')),
        ex ? h('label', { class: 'mk-chk' }, avail, h('span', {}, 'Tersedia')) : '',
        err, save)];
  }

  function draw() {
    const v = view.name;
    const body = v === 'product' ? productView() : v === 'seller' ? sellerView() : v === 'rules' ? rulesView() : v === 'my' ? myView() : v === 'sellerForm' ? sellerForm() : v === 'productForm' ? productForm() : listView();
    wrap.replaceChildren(h('h2', { class: 'wtitle' }, 'Pasar Umat'), ...body);
  }
  draw();
  return wrap;
}
