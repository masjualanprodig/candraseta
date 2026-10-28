// BAITUNA - market-ui.js (v209)
// Pasar Umat: beranda + hero foto, daftar & detail produk, verifikasi penjual (KTP privat), pilih paket & bayar langganan,
// editor iklan 3 langkah (foto, kategori, detail) + pratinjau, Toko Saya, Langganan Saya, Aturan & Tips.
// Semua aturan (kuota, verifikasi, moderasi, kepemilikan) diperiksa ulang di server lewat fungsi mk_*.
import { h, toast, ask } from './ui.js';
import { icon, ICONS } from './feed-ui.js';
import { getSession, publicPhotoUrl } from './supabase.js';
import { prepareImage } from './photo.js';
import { listProvinces, listRegencies, listDistricts } from './wilayah-service.js';
import { membershipFlow } from './membership-ui.js';
import { membershipAdminPage } from './membership-admin-ui.js';
import { renderMarketManager } from './market-admin-ui.js';
import * as M from './market-service.js';

const A = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== false));
const I = {
  ...ICONS,
  cam: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7"/>', checkc: '<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.8 2.8L16.2 9.6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  left: '<path d="M14.5 6l-6 6 6 6"/>', right: '<path d="M9.5 6l6 6-6 6"/>', trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8c-1-.4-1.8-1.2-2.2-2.2l.8-1-1-2z"/>',
  flag: '<path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11"/>', gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3-5-3.5-5-1.2C7 8 12 8 12 8zm0 0c1.5-3 5-3.5 5-1.2C17 8 12 8 12 8z"/>',
  clip: '<rect x="6" y="4.5" width="12" height="16" rx="2"/><path d="M9 4.5V3h6v1.5M9 10h6M9 13.5h6M9 17h4"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  idc: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.5 16.5c.6-1.6 2-2.4 3.5-2.4s2.9.8 3.5 2.4M14.5 10h4M14.5 13.5h3"/>',
  store: '<path d="M4 9l1.5-4.5h13L20 9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/><path d="M5.5 12v7.5h13V12M10 19.5v-4h4v4"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 9.5h18M7 15h4"/>', chart: '<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>',
  pin: ICONS.pin, eye: ICONS.eye, user: ICONS.user, shield: ICONS.shield, share: ICONS.share, chat: ICONS.chat, help: ICONS.help, lock: ICONS.lock,
  dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'
};
// Ikon kategori (kunci ikon dari tabel market_categories).
const CAT_IC = {
  semua: ICONS.market,
  makanan: '<path d="M4 12h16a8 8 0 0 1-16 0z"/><path d="M8 8c0-1.5 1-2 1-3.5M12 8c0-1.5 1-2 1-3.5M16 8c0-1.5 1-2 1-3.5"/>',
  pakaian: '<path d="M8 4 4 7l2 4 2-1v10h8V10l2 1 2-4-4-3c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4z"/>',
  buku: ICONS.book,
  jasa: '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V5.5h6v2M3.5 12.5h17"/>',
  rumah_tangga: '<path d="M4 11l8-6 8 6M6 9.5V20h12V9.5M10 20v-5h4v5"/>',
  gadget: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  hobi: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17M6 6c3 3 3 9 0 12M18 6c-3 3-3 9 0 12"/>',
  bayi_anak: '<circle cx="12" cy="9" r="4.5"/><path d="M10.5 9h.01M13.5 9h.01M10.5 11c.8.7 2.2.7 3 0M6 20c.8-3 3.2-5 6-5s5.2 2 6 5"/>',
  kantor: '<rect x="4" y="3.5" width="10" height="17" rx="1"/><path d="M14 9h6v11.5h-6M7 7h4M7 10.5h4M7 14h4M17 12.5h1M17 15.5h1"/>',
  kesehatan: '<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/><path d="M12 10.5v4M10 12.5h4"/>',
  pertanian: '<path d="M12 21V11M12 11c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5zM12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5z"/>',
  lainnya: ICONS.more
};
const ic = (n, cls) => icon(I[n] || n, cls);
const catIc = (key, cls) => icon(CAT_IC[key] || ICONS.market, cls);
const photoUrl = p => (p ? publicPhotoUrl(p, M.MARKET_BUCKET) : null);
const DRAFT_KEY = 'baituna.pasar.draft.v1';
const VIEWED = new Set();

export function marketPage(opts = {}) {
  const wrap = h('div', { class: 'market pu' });
  const onLogin = opts.onLogin || (() => {});
  const S = { st: null, list: { cat: '', q: '', items: [], offset: 0, hasMore: false, loaded: false }, mine: null, filter: '', tab: 'iklan' };
  const me = () => (S.st && S.st.me) || null;
  const ver = () => (me() && me().verification) || null;
  const seller = () => (me() && me().seller) || null;
  const sub = () => (me() && me().subscription) || null;
  const subActive = () => !!(sub() && sub().active);
  const loggedIn = () => !!getSession();
  const draw = (...k) => { closeSheet(); wrap.replaceChildren(...k); window.scrollTo(0, 0); };
  const back = (label, fn, id) => h('button', { class: 'btn-ghost pu-back', type: 'button', id: id || 'pu-back', onclick: fn }, label);
  const btn = (text, cls, id, onclick, extra) => h('button', Object.assign(A({ class: cls, type: 'button', id }), { onclick }, extra || {}), text);
  const loading = () => draw(h('p', { class: 'muted pu-loading', id: 'pu-loading', role: 'status' }, 'Memuat…'));
  const note = (t, id, cls) => h('div', A({ class: 'pu-note ' + (cls || ''), id }), ic('shield', 'ic pu-nic'), h('span', {}, t));
  const chip = (t, tone, id) => h('span', A({ class: 'pu-chip pu-' + (tone || 'off'), id }), t);
  const field = (label, input, req, id, extra) => h('div', { class: 'pu-field' }, h('label', A({ class: 'pu-lab', for: id }), label, req ? h('span', { class: 'pu-req' }, ' *') : ''), input, extra || '');
  const errBox = id => h('p', { class: 'pu-err', id: id || 'pu-err', role: 'alert' }, '');
  const failView = (e, retry) => draw(back('← Pasar Umat', home), h('div', { class: 'empty', id: 'pu-fail' }, h('p', { class: 'muted' }, M.errorText(e)),
    M.notReady(e) ? '' : btn('Coba lagi', 'btn-sm', 'pu-retry', retry || home)));
  async function refresh() { S.st = await M.state(); return S.st; }
  const thumb = (path, alt, cls) => {
    const u = photoUrl(path), box = h('div', { class: 'pu-ph ' + (cls || '') });
    if (u) { const img = h('img', { src: u, alt: alt || '', loading: 'lazy', decoding: 'async' }); img.addEventListener('error', () => { img.remove(); box.append(icon(ICONS.market, 'ic-lg')); }); box.append(img); }
    else box.append(icon(ICONS.market, 'ic-lg'));
    return box;
  };
  const transactNote = () => h('p', { class: 'pu-tnote', id: 'pu-tnote' }, 'Transaksi barang/jasa dilakukan langsung antara pembeli dan penjual. BAITUNA tidak memproses pembayaran produk. Periksa barang dan penjual sebelum membayar.');

  /* ===== Lembar bawah ===== */
  let ovEl = null;
  function closeSheet() { if (ovEl) { ovEl.remove(); ovEl = null; } }
  function sheet(title, id, ...kids) {
    closeSheet();
    const ov = h('div', { class: 'pu-ov', id, role: 'dialog', 'aria-modal': 'true', 'aria-label': title, onclick: e => { if (e.target === ov) closeSheet(); } },
      h('div', { class: 'pu-sheet' }, h('div', { class: 'pu-sh-head' }, h('b', {}, title), h('button', { class: 'pu-x', type: 'button', 'aria-label': 'Tutup', id: id + '-x', onclick: closeSheet }, ic('x'))), ...kids));
    document.body.append(ov); ovEl = ov; return ov;
  }

  /* ===================== BERANDA ===================== */
  async function home() {
    if (!S.st) { loading(); try { await refresh(); } catch (e) { if (M.notReady(e)) { S.st = { plans: [], categories: [], me: null, notReady: true }; } else { failView(e); return; } } }
    const feats = [['market', 'Produk Jamaah'], ['shield', 'Penjual Terverifikasi'], ['checkc', 'Diperiksa Admin'], ['star', 'Berkah untuk Umat']];
    const search = h('input', { class: 'in pu-search', id: 'pu-search', type: 'search', maxlength: '40', placeholder: 'Cari produk atau jasa…', 'aria-label': 'Cari produk atau jasa' });
    search.value = S.list.q;
    let timer = null;
    search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { S.list.q = search.value; loadList(true); }, 350); });
    const cats = h('div', { class: 'pu-cats', id: 'pu-cats', role: 'group', 'aria-label': 'Kategori' },
      ...[{ key: '', label: 'Semua', icon: 'semua' }, ...M.categories()].map(c => {
        const b = btn([h('span', { class: 'pu-cic' }, catIc(c.icon || c.key || 'semua')), h('span', { class: 'pu-cl' }, c.label)], 'pu-cat' + (S.list.cat === c.key ? ' on' : ''), 'pu-c-' + (c.key || 'semua'),
          () => { S.list.cat = c.key; for (const x of cats.children) x.classList.toggle('on', x === b); for (const x of cats.children) x.setAttribute('aria-pressed', String(x === b)); loadList(true); });
        b.setAttribute('aria-pressed', String(S.list.cat === c.key)); return b;
      }));
    const ownBtn = seller() || ver() ? btn([ic('store', 'ic'), 'Toko Saya'], 'btn-sm ghost pu-own', 'pu-mystore', sellerEntry) : '';
    draw(
      h('section', { class: 'pu-hero', id: 'pu-hero' },
        h('div', { class: 'pu-hero-txt' }, h('h2', { class: 'pu-htitle' }, 'Pasar Umat'),
          h('p', { class: 'pu-hsub' }, 'Produk dan jasa usaha jamaah untuk kebutuhan sehari-hari. Belanja dari umat, untuk umat.'))),
      h('div', { class: 'pu-feats', id: 'pu-feats' }, ...feats.map(([k, t]) => h('div', { class: 'pu-feat' }, h('span', { class: 'pu-fic' }, ic(k)), h('span', {}, t)))),
      h('div', { class: 'pu-cta' }, btn([ic('store', 'ic'), 'Jualan di sini'], 'btn-primary pu-sell', 'pu-sell', sellerEntry), btn('Aturan & tips', 'btn-ghost pu-rulesb', 'pu-rules', rules)),
      ownBtn, me() && me().admin ? btn('Kelola Pasar Umat (Super Admin)', 'btn-sm ghost pu-adm', 'pu-admin', adminView) : '',
      S.st.notReady ? note('Pasar Umat versi baru belum aktif di server. Pengelola perlu menjalankan pasar_v2.sql.', 'pu-notready', 'pu-warnnote') : '',
      h('div', { class: 'pu-sbox' }, ic('search', 'ic pu-sic'), search), cats,
      h('div', { class: 'pu-grid', id: 'pu-grid' }), h('div', { id: 'pu-more-box' }), transactNote());
    if (!S.list.loaded) loadList(true); else paintList();
  }
  async function loadList(reset) {
    const grid = document.getElementById('pu-grid'); if (!grid) return;
    if (reset) { S.list.offset = 0; S.list.items = []; grid.replaceChildren(h('p', { class: 'muted', id: 'pu-gload', role: 'status' }, 'Memuat produk…')); }
    try {
      const r = await M.listProducts({ category: S.list.cat, q: S.list.q, offset: S.list.offset });
      S.list.items = reset ? r.items : S.list.items.concat(r.items); S.list.hasMore = r.hasMore; S.list.offset += r.items.length; S.list.loaded = true;
      paintList();
    } catch (e) {
      grid.replaceChildren(h('div', { class: 'empty', id: 'pu-gfail' }, h('p', { class: 'muted' }, 'Produk belum bisa dimuat. ' + M.errorText(e)), btn('Coba lagi', 'btn-sm', 'pu-gretry', () => loadList(true))));
    }
  }
  function card(p) {
    return h('button', { class: 'pu-card', type: 'button', 'data-id': p.id, onclick: () => detail(p.id) },
      thumb(M.firstPhoto(p), p.title), h('div', { class: 'pu-ct' }, h('b', { class: 'pu-t' }, p.title), h('span', { class: 'pu-p' }, M.priceText(p.price, p.price_note)),
        h('span', { class: 'pu-loc' }, ic('pin', 'ic'), p.loc_city || (p.seller && p.seller.city) || '-'), p.available === false ? chip('Stok habis', 'off') : ''));
  }
  function paintList() {
    const grid = document.getElementById('pu-grid'), more = document.getElementById('pu-more-box'); if (!grid) return;
    grid.replaceChildren(...(S.list.items.length ? S.list.items.map(card)
      : [h('div', { class: 'empty pu-empty', id: 'pu-empty' }, h('p', { class: 'muted' }, S.list.q || S.list.cat ? 'Belum ada produk yang cocok.' : 'Belum ada produk yang tayang. Jadilah penjual pertama!'))]));
    if (more) more.replaceChildren(S.list.hasMore ? btn('Muat lebih banyak', 'btn-sm ghost pu-more', 'pu-more', () => loadList(false)) : '');
  }

  /* ===================== DETAIL PRODUK (pembeli) ===================== */
  async function detail(id, backFn) {
    loading();
    let p; try { p = await M.getProduct(id); } catch (e) { failView(e, () => detail(id, backFn)); return; }
    const goBack = backFn || home;
    if (!p) { draw(back('← Pasar Umat', goBack), h('div', { class: 'empty', id: 'pu-gone' }, h('p', { class: 'muted' }, 'Iklan ini sudah tidak tayang.'))); return; }
    if (!VIEWED.has(p.id)) { VIEWED.add(p.id); M.track(p.id, 'view'); }
    const contact = h('div', { id: 'pu-contact' });
    const s = p.seller || {};
    const tabsBox = h('div', { class: 'pu-tabbody', id: 'pu-tabbody' });
    let tab = 'desc';
    const tabs = h('div', { class: 'pu-tabs', role: 'tablist', id: 'pu-dtabs' }, ...[['desc', 'Deskripsi'], ['seller', 'Info Penjual']].map(([k, l]) =>
      btn(l, 'pu-tab' + (tab === k ? ' on' : ''), 'pu-dt-' + k, () => { tab = k; for (const b of tabs.children) { b.classList.toggle('on', b.id === 'pu-dt-' + k); b.setAttribute('aria-selected', String(b.id === 'pu-dt-' + k)); } paintTab(); }, { role: 'tab', 'aria-selected': String(tab === k) })));
    const details = M.DETAIL_FIELDS.filter(([k]) => p.details && p.details[k]).map(([k, l]) => h('div', { class: 'pu-row' }, h('span', { class: 'muted' }, l), h('b', {}, p.details[k])));
    function paintTab() {
      if (tab === 'desc') tabsBox.replaceChildren(h('p', { class: 'pu-desc', id: 'pu-desc' }, p.description),
        p.halal_note ? h('div', { class: 'pu-row' }, h('span', { class: 'muted' }, 'Keterangan halal'), h('b', {}, p.halal_note)) : '', ...details,
        p.address ? h('div', { class: 'pu-row' }, h('span', { class: 'muted' }, 'Patokan lokasi'), h('b', {}, p.address)) : '');
      else tabsBox.replaceChildren(h('div', { class: 'pu-sellercard', id: 'pu-sellercard' }, h('span', { class: 'pu-sav' }, ic('store')), h('div', {}, h('b', {}, s.name || 'Penjual'),
        h('span', { class: 'muted' }, s.city || ''), chip('Penjual terverifikasi', 'ok')), btn('Lihat toko', 'btn-sm ghost', 'pu-toshop', () => shop(p.seller_id, () => detail(id, backFn)))),
        s.bio ? h('p', { class: 'muted' }, s.bio) : '', h('p', { class: 'hint' }, 'Label "terverifikasi" berarti identitas penjual sudah diperiksa admin BAITUNA. Ini bukan jaminan kualitas produk.'));
    }
    paintTab();
    async function showContact() {
      if (!loggedIn()) { contact.replaceChildren(h('p', { class: 'hint' }, 'Masuk untuk melihat tombol WhatsApp penjual.'), btn('Masuk atau Daftar', 'btn-sm', 'pu-login', onLogin)); return; }
      try {
        const c = await M.getContact(p.seller_id); const link = c && M.waLink(c.whatsapp, M.orderText(p.title, s.name));
        contact.replaceChildren(link ? h('a', { class: 'btn-primary pu-wa', id: 'pu-wa', href: link, target: '_blank', rel: 'noopener noreferrer', onclick: () => M.track(p.id, 'wa') }, ic('wa', 'ic'), 'Chat Penjual via WhatsApp') : h('p', { class: 'muted' }, 'Kontak penjual belum tersedia.'),
          c && c.other_contact ? h('p', { class: 'hint' }, 'Kontak lain: ' + c.other_contact) : '');
      } catch (e) { contact.replaceChildren(h('p', { class: 'muted' }, 'Kontak belum bisa dimuat. ' + M.errorText(e))); }
    }
    showContact();
    async function share() {
      const text = p.title + ' — ' + M.priceText(p.price, p.price_note) + ' di BAITUNA Pasar Umat';
      try { if (navigator.share) { await navigator.share({ title: p.title, text, url: location.origin + '/' }); return; } await navigator.clipboard.writeText(text + ' ' + location.origin + '/'); toast('Teks iklan disalin.'); }
      catch (e) { /* dibatalkan */ }
    }
    draw(back('← Kembali', goBack), gallery(p.photos, p.title),
      h('div', { class: 'pu-dhead', id: 'pu-detail' }, h('h2', { class: 'pu-dtitle' }, p.title), h('b', { class: 'pu-dprice', id: 'pu-price' }, M.priceText(p.price, p.price_note)),
        h('div', { class: 'pu-chips' }, chip(M.catLabel(p.category), 'tag'), p.condition ? chip(p.condition === 'baru' ? 'Baru' : 'Bekas', 'tag') : '', p.available === false ? chip('Stok habis', 'off') : ''),
        h('span', { class: 'pu-loc' }, ic('pin', 'ic'), M.place(p) || s.city || '-')),
      tabs, tabsBox, contact,
      h('div', { class: 'pu-row-btns' }, btn([ic('share', 'ic'), 'Bagikan'], 'btn-sm ghost', 'pu-share', share), btn([ic('flag', 'ic'), 'Laporkan'], 'btn-sm ghost', 'pu-report', () => reportSheet(p))),
      transactNote());
  }
  function gallery(list0, title) {
    const list = (list0 || []).filter(Boolean);
    if (!list.length) return thumb(null, title, 'pu-big');
    const main = h('div', { class: 'pu-ph pu-big', id: 'pu-main' });
    const strip = h('div', { class: 'pu-strip', role: 'group', 'aria-label': 'Foto' }, ...(list.length > 1 ? list.map((u, i) =>
      h('button', { class: 'pu-th', type: 'button', 'data-i': String(i), 'aria-label': 'Foto ' + (i + 1), onclick: () => show(i) }, h('img', { src: photoUrl(u), alt: '', loading: 'lazy' }))) : []));
    function show(i) {
      const img = h('img', { src: photoUrl(list[i]), alt: title + ' (foto ' + (i + 1) + ' dari ' + list.length + ')', decoding: 'async' });
      img.addEventListener('error', () => { img.remove(); main.append(icon(ICONS.market, 'ic-lg')); });
      main.replaceChildren(img, list.length > 1 ? h('span', { class: 'pu-count' }, (i + 1) + '/' + list.length) : '');
      strip.querySelectorAll('.pu-th').forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-pressed', String(j === i)); });
    }
    show(0);
    return h('div', { class: 'pu-gal' }, main, strip);
  }
  function reportSheet(p) {
    if (!loggedIn()) { toast('Masuk dulu untuk melaporkan iklan.'); onLogin(); return; }
    const sel = h('select', { class: 'in', id: 'pu-rep-reason', 'aria-label': 'Alasan' }, ...M.REPORT_REASONS.map(r => h('option', { value: r.key }, r.label)));
    const ta = h('textarea', { class: 'in', id: 'pu-rep-note', maxlength: '300', rows: '3', placeholder: 'Keterangan (opsional)' });
    const err = errBox('pu-rep-err');
    sheet('Laporkan iklan', 'pu-rep', h('p', { class: 'muted' }, 'Laporan dibaca admin BAITUNA. Identitas Anda tidak ditampilkan ke penjual.'), sel, ta, err,
      btn('Kirim laporan', 'btn-primary', 'pu-rep-send', async e => {
        e.target.disabled = true;
        try { await M.reportProduct(p.id, sel.value, ta.value); closeSheet(); toast('Terima kasih. Laporan Anda sudah kami terima.'); }
        catch (x) { err.textContent = M.errorText(x); e.target.disabled = false; }
      }));
  }
  async function shop(sellerId, backFn) {
    loading();
    let s, r; try { [s, r] = await Promise.all([M.getSeller(sellerId), M.listProducts({ sellerId })]); } catch (e) { failView(e); return; }
    if (!s) { draw(back('← Kembali', backFn || home), h('p', { class: 'muted', id: 'pu-gone' }, 'Toko ini belum memiliki iklan yang tayang.')); return; }
    draw(back('← Kembali', backFn || home), h('div', { class: 'pu-shophead', id: 'pu-shop' }, h('span', { class: 'pu-sav pu-sav-lg' }, ic('store')), h('div', {}, h('h2', { class: 'wtitle' }, s.name),
      h('span', { class: 'muted' }, s.city || ''), chip('Penjual terverifikasi', 'ok'))), s.bio ? h('p', { class: 'muted' }, s.bio) : '',
      h('div', { class: 'pu-grid', id: 'pu-shopgrid' }, ...r.items.map(p => { const c = card(p); c.onclick = null; c.addEventListener('click', () => detail(p.id, () => shop(sellerId, backFn))); return c; })));
  }

  /* ===================== MASUK SEBAGAI PENJUAL ===================== */
  async function sellerEntry() {
    if (!loggedIn()) {
      draw(back('← Pasar Umat', home), h('div', { class: 'panel pu-state', id: 'pu-loginbox' }, h('h2', { class: 'wtitle' }, 'Masuk dulu'),
        h('p', { class: 'muted' }, 'Untuk berjualan di Pasar Umat, silakan masuk atau daftar akun BAITUNA.'), btn('Masuk atau Daftar', 'btn-primary', 'pu-signin', onLogin)));
      return;
    }
    loading();
    try { await refresh(); } catch (e) { failView(e, sellerEntry); return; }
    const v = ver();
    if (!v) { verifyForm(); return; }
    if (v.status !== 'disetujui') { verifyStatus(); return; }
    store();
  }

  /* ----- Lokasi bertingkat (provinsi -> kab/kota -> kecamatan); jatuh ke isian teks bila daftar gagal dimuat ----- */
  function locationPicker(prefix, init, needDistrict) {
    const val = { province: (init && init.province) || '', regency: (init && init.regency) || '', district: (init && init.district) || '' };
    const box = h('div', { class: 'pu-locbox', id: prefix + '-loc' });
    const mkSel = (id, label) => h('select', { class: 'in', id, 'aria-label': label });
    const prov = mkSel(prefix + '-prov', 'Provinsi'), reg = mkSel(prefix + '-reg', 'Kabupaten/kota'), dis = mkSel(prefix + '-dis', 'Kecamatan');
    const opt = (list, cur, ph) => [h('option', { value: '' }, ph), ...list.map(x => { const o = h('option', { value: x.name, 'data-id': x.id }, x.name); if (x.name === cur) o.selected = true; return o; })];
    let manual = false;
    function textMode() {
      manual = true;
      const t = (id, ph, v, k) => { const i = h('input', { class: 'in', id, maxlength: '80', placeholder: ph }); i.value = v; i.addEventListener('input', () => { val[k] = i.value; }); return i; };
      box.replaceChildren(t(prefix + '-prov', 'Provinsi', val.province, 'province'), t(prefix + '-reg', 'Kabupaten/kota', val.regency, 'regency'),
        t(prefix + '-dis', needDistrict ? 'Kecamatan' : 'Kecamatan (opsional)', val.district, 'district'), h('p', { class: 'hint' }, 'Daftar wilayah belum bisa dimuat, silakan ketik manual.'));
    }
    const idOf = sel => { const o = sel.selectedOptions && sel.selectedOptions[0]; return o ? o.getAttribute('data-id') : null; };
    async function loadReg() {
      reg.replaceChildren(...opt([], '', 'Pilih kabupaten/kota')); dis.replaceChildren(...opt([], '', needDistrict ? 'Pilih kecamatan' : 'Kecamatan (opsional)'));
      const pid = idOf(prov); if (!pid) return;
      try { reg.replaceChildren(...opt(await listRegencies(pid), val.regency, 'Pilih kabupaten/kota')); if (val.regency) await loadDis(); } catch (e) { textMode(); }
    }
    async function loadDis() {
      dis.replaceChildren(...opt([], '', needDistrict ? 'Pilih kecamatan' : 'Kecamatan (opsional)'));
      const rid = idOf(reg); if (!rid) return;
      try { dis.replaceChildren(...opt(await listDistricts(rid), val.district, needDistrict ? 'Pilih kecamatan' : 'Kecamatan (opsional)')); } catch (e) { textMode(); }
    }
    prov.addEventListener('change', () => { val.province = prov.value; val.regency = ''; val.district = ''; loadReg(); });
    reg.addEventListener('change', () => { val.regency = reg.value; val.district = ''; loadDis(); });
    dis.addEventListener('change', () => { val.district = dis.value; });
    box.append(prov, reg, dis);
    prov.replaceChildren(h('option', { value: '' }, 'Memuat provinsi…'));
    listProvinces().then(list => { if (manual) return; prov.replaceChildren(...opt(list, val.province, 'Pilih provinsi')); if (val.province) loadReg(); }).catch(textMode);
    return { el: box, get: () => ({ ...val }) };
  }

  /* ===================== VERIFIKASI PENJUAL ===================== */
  function verifyForm() {
    const v = ver() || {}, s = seller() || {};
    const inp = (id, ph, value, extra) => { const i = h('input', Object.assign({ class: 'in', id, placeholder: ph }, extra || {})); i.value = value || ''; return i; };
    const store = inp('pu-v-store', 'Contoh: Madu Barokah', s.name, { maxlength: '80' });
    const name = inp('pu-v-name', 'Masukkan nama lengkap', v.full_name, { maxlength: '120', autocomplete: 'name' });
    const wa = inp('pu-v-wa', 'Contoh: 0812 3456 7890', M.waDisplay(v.whatsapp || s.whatsapp), { type: 'tel', inputmode: 'tel', maxlength: '20', autocomplete: 'tel' });
    const loc = locationPicker('pu-v', { province: v.province, regency: v.regency, district: v.district }, true);
    const file = h('input', { type: 'file', id: 'pu-v-ktp', accept: 'image/jpeg,image/png,image/webp', hidden: true, 'aria-label': 'Foto KTP' });
    let ktpFile = null, pu = null;
    const drop = h('label', { class: 'pu-drop', for: 'pu-v-ktp', id: 'pu-v-drop' }, ic('cam', 'ic pu-dropic'), h('b', {}, 'Unggah foto KTP'), h('span', { class: 'muted' }, 'JPG, PNG, atau WebP. Foto diperkecil otomatis.'));
    file.addEventListener('change', () => {
      const f = file.files && file.files[0]; if (!f) return;
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { err.textContent = 'Format foto KTP harus JPG, PNG, atau WebP.'; return; }
      ktpFile = f; if (pu) URL.revokeObjectURL(pu); pu = URL.createObjectURL(f);
      drop.replaceChildren(h('img', { class: 'pu-ktpprev', src: pu, alt: 'Pratinjau foto KTP' }), h('span', { class: 'muted' }, 'Ketuk untuk mengganti foto'));
    });
    const consent = h('input', { type: 'checkbox', id: 'pu-v-consent' });
    const err = errBox('pu-v-err'), prog = h('p', { class: 'muted', id: 'pu-v-prog', role: 'status' }, '');
    const send = btn('Kirim untuk Verifikasi', 'btn-primary pu-wide', 'pu-v-send', async () => {
      const c = M.checkVerification({ store_name: store.value, full_name: name.value, whatsapp: wa.value, ...loc.get(), ktp: ktpFile || (v.ktp_path && v.status !== 'ditolak' ? 'lama' : null), consent: consent.checked });
      if (!c.ok) { err.textContent = Object.values(c.errors)[0]; return; }
      send.disabled = true; err.textContent = '';
      let path = v.ktp_path || null, fresh = null;
      try {
        if (ktpFile) {
          prog.textContent = 'Menyiapkan foto KTP…'; const img = await prepareImage(ktpFile);
          fresh = M.newKtpPath(); prog.textContent = 'Mengunggah foto KTP…'; await M.uploadKtp(fresh, img.blob); path = fresh;
        }
        prog.textContent = 'Mengirim data…';
        const r = await M.submitVerification({ ...c.value, ktp_path: path });
        if (r && r.old_ktp) M.removeKtp(r.old_ktp);
        prog.textContent = ''; toast('Data verifikasi terkirim.');
        await refresh(); verifyStatus();
      } catch (e) {
        if (fresh) M.removeKtp(fresh);
        prog.textContent = ''; err.textContent = 'Gagal mengirim. ' + (e && e.code && M.PHOTO_ERRORS[e.code] ? M.PHOTO_ERRORS[e.code] : M.errorText(e)); send.disabled = false;
      }
    });
    const redo = v.status === 'perbaikan' || v.status === 'ditolak';
    draw(back('← Pasar Umat', home), h('h2', { class: 'wtitle' }, 'Verifikasi Penjual'), h('p', { class: 'muted' }, 'Lengkapi data berikut untuk mulai berjualan di Pasar Umat.'),
      redo ? note((v.status === 'perbaikan' ? 'Perlu perbaikan: ' : 'Pengajuan sebelumnya ditolak: ') + (v.note || '-'), 'pu-v-prevnote', 'pu-warnnote') : '',
      h('div', { class: 'panel pu-form', id: 'pu-vform' },
        field('Nama toko', store, true, 'pu-v-store', h('span', { class: 'hint' }, 'Ditampilkan kepada pembeli.')),
        field('Nama lengkap sesuai KTP', name, true, 'pu-v-name'),
        field('Nomor WhatsApp', wa, true, 'pu-v-wa', h('span', { class: 'hint' }, 'Dipakai sebagai tombol WhatsApp untuk pembeli yang sudah masuk, dan oleh admin bila perlu konfirmasi.')),
        field('Lokasi usaha', loc.el, true, 'pu-v-prov'),
        field('Foto KTP', h('div', {}, file, drop), true, 'pu-v-ktp', h('span', { class: 'hint pu-lockhint' }, ic('lock', 'ic'), v.ktp_path && !redo ? ' KTP sudah terunggah. Unggah lagi hanya bila ingin mengganti. ' : ' ',
          'KTP disimpan privat dan hanya dapat dilihat admin untuk verifikasi. Tidak ditampilkan ke pengguna lain.')),
        h('label', { class: 'pu-check', for: 'pu-v-consent' }, consent, h('span', {}, 'Saya menyetujui ', h('button', { class: 'pu-link', type: 'button', id: 'pu-v-privacy', onclick: () => opts.go ? opts.go('privasi') : rules() }, 'Kebijakan Privasi'),
          ' dan ', h('button', { class: 'pu-link', type: 'button', id: 'pu-v-terms', onclick: rules }, 'ketentuan Pasar Umat'), '. Data KTP dipakai hanya untuk memeriksa identitas penjual.'))),
      err, prog, send, h('p', { class: 'pu-statline' }, chip(v.status ? M.VERIF_STATUS[v.status] : 'Belum diverifikasi', v.status === 'perbaikan' ? 'warn' : 'wait', 'pu-v-chip')));
  }
  function verifyStatus() {
    const v = ver(); if (!v) { verifyForm(); return; }
    const wait = v.status === 'menunggu', ok = v.status === 'disetujui';
    const item = (t, id) => h('li', { id }, ic('checkc', 'ic pu-okc'), h('span', {}, t), h('b', { class: 'pu-ok-t' }, 'Terkirim'));
    draw(back('← Pasar Umat', home),
      h('div', { class: 'pu-hero2', id: 'pu-vstatus', 'data-status': v.status }, h('span', { class: 'pu-bigic' + (wait ? ' pu-goldbg' : ok ? '' : ' pu-badbg') }, ic(wait ? 'clip' : ok ? 'checkc' : 'x')),
        h('h2', { class: 'wtitle' }, wait ? 'Verifikasi Sedang Diproses' : ok ? 'Verifikasi Disetujui' : v.status === 'perbaikan' ? 'Data Perlu Diperbaiki' : 'Verifikasi Ditolak'),
        h('p', { class: 'muted' }, wait ? 'Data Anda telah kami terima. Admin BAITUNA akan memeriksa data Anda. Pengajuan verifikasi sedang diperiksa; Anda dapat mulai berjualan setelah verifikasi disetujui.'
          : ok ? 'Anda sudah bisa berjualan di Pasar Umat.' : 'Alasan: ' + (v.note || '-'))),
      h('ul', { class: 'pu-sent panel', id: 'pu-sentlist' }, item('Data diri', 'pu-s-data'), item('Foto KTP', 'pu-s-ktp'), item('Lokasi usaha', 'pu-s-loc')),
      h('div', { class: 'panel pu-row', id: 'pu-statrow' }, h('span', {}, ic('clock', 'ic'), ' Status'), chip(M.VERIF_STATUS[v.status], wait ? 'wait' : ok ? 'ok' : v.status === 'perbaikan' ? 'warn' : 'bad', 'pu-vchip')),
      h('p', { class: 'hint' }, 'Dikirim ' + M.fmtDate(v.submitted_at) + (v.reviewed_at ? ' · diperiksa ' + M.fmtDate(v.reviewed_at) : '')),
      note('Admin dapat menghubungi Anda lewat WhatsApp bila perlu informasi tambahan.', 'pu-v-info'),
      !wait && !ok ? btn('Perbaiki & kirim ulang', 'btn-primary pu-wide', 'pu-v-redo', verifyForm) : '',
      ok ? btn('Buka Toko Saya', 'btn-primary pu-wide', 'pu-v-tostore', store) : '',
      btn('Kembali ke Pasar Umat', 'btn-ghost pu-wide', 'pu-v-home', home));
  }

  /* ===================== TOKO SAYA ===================== */
  const quotaInfo = () => {
    const m = me() || {}, sb = sub(), act = subActive(), q = act ? sb.quota : 0, used = m.paid_used || 0;
    return { act, q, used, left: Math.max(0, q - used), free: !!m.free_available, freeUsed: !!m.free_used, sb };
  };
  const canPost = () => { const k = quotaInfo(); return k.free || (k.act && k.left > 0); };
  async function store(tab) {
    if (tab) S.tab = tab;
    loading();
    try { await refresh(); S.mine = await M.myListings(); } catch (e) { failView(e, () => store()); return; }
    const v = ver(), s = seller();
    if (!v || v.status !== 'disetujui') { verifyStatus(); return; }
    const k = quotaInfo();
    const head = h('div', { class: 'panel pu-storehead', id: 'pu-store' }, h('span', { class: 'pu-sav pu-sav-lg' }, ic('store')),
      h('div', { class: 'pu-sh-txt' }, h('h2', { class: 'pu-sname', id: 'pu-sname' }, s.name), h('span', { class: 'muted' }, v.full_name), h('span', { class: 'pu-loc' }, ic('pin', 'ic'), [v.regency, v.province].filter(Boolean).join(', ')),
        h('div', { class: 'pu-chips' }, chip('Terverifikasi', 'ok', 'pu-verchip'), s.status === 'suspended' ? chip('Ditangguhkan', 'bad', 'pu-suschip') : '')));
    const quota = h('div', { class: 'panel pu-quota', id: 'pu-quota' },
      h('div', { class: 'pu-qhead' }, h('b', {}, k.act ? k.sb.plan_name.replace(/^Pasar Umat /, '') : 'Belum berlangganan'), chip(k.act ? 'Aktif' : k.sb ? 'Berakhir' : 'Gratis', k.act ? 'ok' : 'off', 'pu-subchip')),
      k.act ? h('div', { class: 'pu-row' }, h('span', { class: 'muted' }, 'Kuota iklan aktif'), h('b', { id: 'pu-qnum' }, k.used + ' / ' + k.q)) : '',
      k.act ? h('div', { class: 'pu-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(k.q), 'aria-valuenow': String(k.used) }, h('span', { style: 'width:' + Math.min(100, Math.round(k.used / Math.max(1, k.q) * 100)) + '%' })) : '',
      k.act ? h('span', { class: 'hint' }, 'Berlaku sampai ' + M.fmtDate(k.sb.ends_at) + ' · sisa ' + k.left + ' iklan') : '',
      !k.act && k.sb ? h('span', { class: 'hint pu-warn-t', id: 'pu-subended' }, 'Langganan berakhir ' + M.fmtDate(k.sb.ends_at) + '. Iklan berbayar tidak tayang sampai diperpanjang.') : '',
      h('span', { class: 'hint', id: 'pu-freeinfo' }, k.free ? 'Iklan pertama GRATIS masih tersedia untuk Anda.' : k.freeUsed ? 'Iklan gratis sudah dipakai.' : 'Iklan gratis tidak tersedia.'),
      btn(k.act ? 'Langganan Saya' : 'Pilih Paket Langganan', 'btn-sm ghost', 'pu-sub', k.act || k.sb ? mySub : plans));
    const newBtn = btn([ic('plus', 'ic'), 'Buat Iklan Baru'], 'btn-primary pu-wide', 'pu-new', () => startEditor());
    const tabs = h('div', { class: 'pu-tabs', role: 'tablist', id: 'pu-stabs' }, ...[['iklan', 'Iklan Saya (' + S.mine.length + ')'], ['stat', 'Statistik'], ['profil', 'Profil']].map(([kk, l]) =>
      btn(l, 'pu-tab' + (S.tab === kk ? ' on' : ''), 'pu-st-' + kk, () => { S.tab = kk; for (const b of tabs.children) { b.classList.toggle('on', b.id === 'pu-st-' + kk); b.setAttribute('aria-selected', String(b.id === 'pu-st-' + kk)); } paint(); }, { role: 'tab', 'aria-selected': String(S.tab === kk) })));
    const body = h('div', { id: 'pu-sbody' });
    function paint() { if (S.tab === 'stat') body.replaceChildren(...statView()); else if (S.tab === 'profil') body.replaceChildren(...profileView()); else body.replaceChildren(...listView()); }
    function listView() {
      const fl = h('div', { class: 'pu-filters', id: 'pu-filters', role: 'group', 'aria-label': 'Saring iklan' }, ...M.FILTERS.map(([kk, l]) => {
        const n = S.mine.filter(x => M.matchFilter(x, kk)).length;
        return btn(l + ' (' + n + ')', 'pu-fchip' + (S.filter === kk ? ' on' : ''), 'pu-f-' + (kk || 'all'), () => { S.filter = kk; paint(); }, { 'aria-pressed': String(S.filter === kk) });
      }));
      const rows = S.mine.filter(x => M.matchFilter(x, S.filter));
      return [fl, rows.length ? h('div', { class: 'pu-mylist', id: 'pu-mylist' }, ...rows.map(myCard)) : h('p', { class: 'muted pu-empty', id: 'pu-myempty' }, S.mine.length ? 'Tidak ada iklan pada filter ini.' : 'Belum ada iklan. Tekan "Buat Iklan Baru" untuk mulai berjualan.')];
    }
    function myCard(l) {
      return h('div', { class: 'pu-mycard', 'data-id': l.id, 'data-status': l.status }, thumb(M.firstPhoto(l), l.title, 'pu-mth'),
        h('div', { class: 'pu-myt' }, h('b', {}, l.title), h('span', { class: 'pu-p' }, M.priceText(l.price, l.price_note)), chip(M.listingLabel(l), M.listingTone(l)),
          h('span', { class: 'hint' }, ic('eye', 'ic'), ' ' + (l.views || 0) + ' dilihat · ' + (l.wa_clicks || 0) + ' klik WhatsApp'),
          l.status_reason && ['revision', 'rejected', 'blocked'].includes(l.status) ? h('span', { class: 'pu-warn-t' }, 'Alasan: ' + l.status_reason) : '',
          l.slot === 'free' ? h('span', { class: 'hint' }, 'Iklan gratis') : ''),
        btn(ic('dots'), 'pu-menu', null, () => actions(l), { 'aria-label': 'Tindakan untuk ' + l.title, 'data-act': l.id }));
    }
    function statView() {
      const tv = S.mine.reduce((a, l) => a + (l.views || 0), 0), tw = S.mine.reduce((a, l) => a + (l.wa_clicks || 0), 0);
      const live = S.mine.filter(l => l.live).length;
      const top = [...S.mine].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
      return [h('div', { class: 'pu-stats', id: 'pu-stats' }, ...[['Iklan tayang', live], ['Dilihat', tv], ['Klik WhatsApp', tw]].map(([l, n]) => h('div', { class: 'panel pu-stat' }, h('b', {}, String(n)), h('span', { class: 'muted' }, l)))),
        h('p', { class: 'hint' }, 'Angka "dilihat" adalah jumlah halaman iklan dibuka (bukan jumlah orang). Klik WhatsApp dihitung saat tombol chat ditekan.'),
        top.length ? h('div', { class: 'panel' }, h('h3', {}, 'Paling banyak dilihat'), ...top.map(l => h('div', { class: 'pu-row' }, h('span', {}, l.title), h('b', {}, (l.views || 0) + ' · ' + (l.wa_clicks || 0) + ' WA')))) : ''];
    }
    function profileView() {
      const nm = h('input', { class: 'in', id: 'pu-p-store', maxlength: '80' }); nm.value = s.name || '';
      const bio = h('textarea', { class: 'in', id: 'pu-p-bio', maxlength: '400', rows: '3', placeholder: 'Ceritakan usaha Anda (opsional)' }); bio.value = s.bio || '';
      const oc = h('input', { class: 'in', id: 'pu-p-other', maxlength: '120', placeholder: 'Contoh: Instagram @madubarokah (opsional)' }); oc.value = s.other_contact || '';
      const err = errBox('pu-p-err');
      return [h('div', { class: 'panel pu-form', id: 'pu-profile' }, field('Nama toko', nm, true, 'pu-p-store'), field('Deskripsi toko', bio, false, 'pu-p-bio'), field('Kontak lain', oc, false, 'pu-p-other'),
        err, btn('Simpan profil', 'btn-primary', 'pu-p-save', async e => {
          e.target.disabled = true; err.textContent = '';
          try { await M.saveStore({ store_name: nm.value, bio: bio.value, other_contact: oc.value }); toast('Profil toko disimpan.'); store('profil'); }
          catch (x) { err.textContent = M.errorText(x); e.target.disabled = false; }
        })),
      h('div', { class: 'panel', id: 'pu-verdata' }, h('h3', {}, 'Data verifikasi'), h('div', { class: 'pu-row' }, h('span', { class: 'muted' }, 'Nama sesuai KTP'), h('b', {}, v.full_name)),
        h('div', { class: 'pu-row' }, h('span', { class: 'muted' }, 'WhatsApp'), h('b', {}, M.waDisplay(v.whatsapp))), h('div', { class: 'pu-row' }, h('span', { class: 'muted' }, 'Lokasi'), h('b', {}, [v.district, v.regency, v.province].join(', '))),
        h('p', { class: 'hint' }, 'Untuk mengubah nomor WhatsApp atau data KTP, hubungi admin BAITUNA.')),
      btn('Lihat toko saya (tampilan pembeli)', 'btn-sm ghost', 'pu-p-public', () => shop(s.id, () => store('profil'))),
      btn('Hapus toko & semua iklan', 'btn-sm alt pu-danger', 'pu-p-delete', async () => {
        if (!(await ask({ title: 'Hapus toko?', text: 'Profil toko, semua iklan beserta fotonya, dan foto KTP akan dihapus permanen. Hak iklan gratis yang sudah dipakai tidak kembali.' }))) return;
        try { await M.deleteStore(me(), S.mine); S.st = null; S.list.loaded = false; toast('Toko dihapus.'); home(); } catch (x) { toast('Gagal menghapus. ' + M.errorText(x), true); }
      })];
    }
    paint();
    draw(back('← Pasar Umat', home), head, quota, s.status === 'suspended' ? note('Toko ditangguhkan admin: ' + (s.status_reason || '-') + '. Iklan tidak tayang selama ditangguhkan.', 'pu-susnote', 'pu-warnnote') : '',
      newBtn, tabs, body);
  }
  function actions(l) {
    const run = async (fn, okMsg) => { closeSheet(); try { await fn(); toast(okMsg); store(); } catch (e) { if (e && e.message === 'kuota_penuh') { quotaFull(); return; } toast(M.errorText(e), true); } };
    const can = { edit: l.status !== 'blocked', off: ['pending', 'approved', 'revision', 'paused'].includes(l.status), on: ['inactive', 'paused'].includes(l.status) };
    sheet(l.title, 'pu-acts',
      can.edit ? btn([ic('edit', 'ic'), 'Edit iklan (foto, harga, kategori, lokasi)'], 'pu-act', 'pu-a-edit', () => { closeSheet(); startEditor(l); }) : '',
      can.edit ? h('p', { class: 'hint' }, 'Perubahan isi iklan akan diperiksa ulang admin sebelum tayang lagi.') : '',
      l.status === 'approved' ? btn(l.available === false ? 'Tandai stok tersedia' : 'Tandai stok habis', 'pu-act', 'pu-a-stock', () => run(() => M.setAvailable(l.id, l.available === false), 'Status stok diperbarui.')) : '',
      can.off ? btn('Nonaktifkan iklan', 'pu-act', 'pu-a-off', () => run(() => M.setListing(l.id, false), 'Iklan dinonaktifkan.')) : '',
      can.on ? btn('Aktifkan kembali', 'pu-act', 'pu-a-on', () => run(() => M.setListing(l.id, true), 'Iklan diaktifkan kembali.')) : '',
      btn([ic('trash', 'ic'), 'Hapus iklan'], 'pu-act pu-danger', 'pu-a-del', async () => {
        closeSheet();
        if (!(await ask({ title: 'Hapus iklan ini?', text: 'Iklan dan fotonya dihapus permanen.' + (l.slot === 'free' ? ' Ini iklan gratis Anda; hak gratis tidak kembali setelah dihapus.' : '') }))) return;
        try { await M.deleteListing(l.id); toast('Iklan dihapus.'); store(); } catch (e) { toast(M.errorText(e), true); }
      }));
  }
  function quotaFull() {
    draw(back('← Toko Saya', () => store()), h('div', { class: 'pu-hero2', id: 'pu-quotafull' }, h('span', { class: 'pu-bigic pu-goldbg' }, ic('lock')), h('h2', { class: 'wtitle' }, 'Kuota Iklan Penuh'),
      h('p', { class: 'muted' }, 'Kuota iklan Anda sudah penuh. Pilih paket yang sesuai untuk menambahkan iklan, atau nonaktifkan iklan lain.')),
      btn('Pilih Paket Langganan', 'btn-primary pu-wide', 'pu-qf-plans', plans), btn('Kembali ke Toko Saya', 'btn-ghost pu-wide', 'pu-qf-store', () => store()));
  }

  /* ===================== PAKET & LANGGANAN ===================== */
  async function plans() {
    loading();
    try { await refresh(); } catch (e) { failView(e, plans); return; }
    const v = ver();
    if (!v || v.status !== 'disetujui') { verifyStatus(); return; }
    const list = (S.st.plans || []).filter(p => p.active);
    let pick = (list.find(p => p.featured) || list[0] || {}).code;
    const k = quotaInfo();
    const cards = h('div', { class: 'pu-plans', id: 'pu-plans', role: 'radiogroup', 'aria-label': 'Paket langganan' }, ...list.map(p => {
      const inp = h('input', { type: 'radio', name: 'pu-plan', value: p.code, id: 'pu-plan-' + p.code }); inp.checked = p.code === pick;
      inp.addEventListener('change', () => { pick = p.code; for (const c of cards.children) c.classList.toggle('on', c.getAttribute('data-code') === pick); });
      return h('label', { class: 'pu-plan' + (p.code === pick ? ' on' : ''), 'data-code': p.code, for: 'pu-plan-' + p.code }, inp, h('span', { class: 'pu-pic' }, ic('market')),
        h('span', { class: 'pu-pbody' }, h('b', {}, p.name), h('span', { class: 'pu-pprice' }, M.rp(p.price), h('small', { class: 'muted' }, ' /bulan')),
          h('span', { class: 'pu-pli' }, ic('check', 'ic'), 'Maksimal ' + p.quota + ' iklan aktif'), p.description ? h('span', { class: 'pu-pli' }, ic('check', 'ic'), p.description) : '',
          h('span', { class: 'pu-pli' }, ic('check', 'ic'), 'Iklan tetap diperiksa admin')),
        p.featured ? h('span', { class: 'pu-pop' }, 'Populer') : '', h('span', { class: 'pu-radio', 'aria-hidden': 'true' }));
    }));
    draw(back('← Toko Saya', () => store()), h('h2', { class: 'wtitle' }, 'Pilih Paket Langganan'),
      h('p', { class: 'muted' }, 'Pilih paket sesuai kebutuhan usaha Anda.'),
      k.free ? h('div', { class: 'pu-free', id: 'pu-free' }, ic('gift', 'ic pu-gift'), h('div', {}, h('b', {}, 'Iklan pertama GRATIS'), h('span', { class: 'muted' }, 'Kesempatan satu kali untuk mencoba Pasar Umat, tanpa berlangganan.')),
        btn('Pakai', 'btn-sm', 'pu-usefree', () => startEditor())) : '',
      k.act ? note('Langganan Anda aktif sampai ' + M.fmtDate(k.sb.ends_at) + '. Paket baru menambah masa aktif dan memakai kuota paket yang baru.', 'pu-actnote') : '',
      list.length ? cards : h('p', { class: 'muted', id: 'pu-noplan' }, 'Belum ada paket yang tersedia.'),
      h('p', { class: 'hint', id: 'pu-pnote' }, 'Harga dan kuota dapat berubah sesuai pengaturan Super Admin. Perubahan tidak memengaruhi pesanan yang sudah dibuat. Langganan aktif setelah pembayaran diverifikasi admin; tanpa perpanjangan otomatis.'),
      btn('Lanjut ke Pembayaran', 'btn-primary pu-wide', 'pu-topay', () => { if (pick) pay(pick); }, list.length ? {} : { disabled: 'disabled' }),
      k.sb ? btn('Langganan Saya & riwayat pembayaran', 'btn-sm ghost', 'pu-tomysub', mySub) : '');
  }
  function payFlow(start, planCode) {
    membershipFlow({ draw: (...k) => draw(...k), product: 'pasar', start, planCode, backLabel: '← Pasar Umat', plans, isAdmin: !!(me() && me().admin),
      openAdmin: tab => tab === 'plans' ? adminView('paket') : membershipAdminPage({ draw, tab, backLabel: '← Pasar Umat', exit: () => store() }),
      signIn: onLogin, exit: () => store() });
  }
  const pay = code => payFlow('checkout', code);
  async function mySub() {
    loading();
    try { await refresh(); } catch (e) { failView(e, mySub); return; }
    const k = quotaInfo();
    const row = (l, v, id) => h('div', A({ class: 'pu-row', id }), h('span', { class: 'muted' }, l), h('b', {}, v));
    draw(back('← Toko Saya', () => store()), h('h2', { class: 'wtitle' }, 'Langganan Saya'),
      k.sb ? h('div', { class: 'panel pu-mysub', id: 'pu-mysub', 'data-active': String(k.act) },
        h('div', { class: 'pu-qhead' }, h('b', {}, k.sb.plan_name.replace(/^Pasar Umat /, '')), chip(k.act ? 'Aktif' : 'Berakhir', k.act ? 'ok' : 'off', 'pu-ms-chip')),
        row('Harga dibayar', M.rp(k.sb.price) + ' /bulan'), row('Mulai', M.fmtDate(k.sb.started_at)), row('Berlaku sampai', M.fmtDate(k.sb.ends_at), 'pu-ms-until'),
        row('Kuota', k.act ? k.used + ' dari ' + k.q + ' iklan aktif' : '-', 'pu-ms-quota'), row('Sisa kuota', k.act ? k.left + ' iklan' : '-')) : h('p', { class: 'muted', id: 'pu-ms-none' }, 'Anda belum berlangganan.'),
      !k.act && k.sb ? note('Langganan telah berakhir. Iklan berbayar tidak tayang (tidak dihapus) dan tayang lagi setelah diperpanjang.', 'pu-ms-ended', 'pu-warnnote') : '',
      btn(k.sb ? 'Perpanjang / Ganti Paket' : 'Pilih Paket', 'btn-primary pu-wide', 'pu-ms-renew', plans),
      btn('Riwayat pembayaran', 'btn-ghost pu-wide', 'pu-ms-hist', () => payFlow('mine')),
      h('p', { class: 'hint' }, 'Tidak ada perpanjangan otomatis. Masa aktif paket baru ditambahkan ke sisa masa aktif yang berjalan.'));
  }

  /* ===================== EDITOR IKLAN 3 LANGKAH ===================== */
  let D = null;   // draf iklan yang sedang diedit
  const saveDraft = () => { if (!D || D.id0) return; try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...D, photos: D.photos.filter(p => p.path && !p.err && !p.busy).map(p => ({ path: p.path, fresh: p.fresh })) })); } catch (e) { /* abaikan */ } };
  const loadDraft = () => { try { const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); return d && d.sid === (seller() || {}).id ? d : null; } catch (e) { return null; } };
  const clearDraft = () => { try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) { /* abaikan */ } };
  async function startEditor(listing) {
    loading();
    try { await refresh(); } catch (e) { failView(e, () => startEditor(listing)); return; }
    const v = ver(), s = seller();
    if (!v || v.status !== 'disetujui') { verifyStatus(); return; }
    if (s.status === 'suspended') { toast('Toko Anda sedang ditangguhkan admin.', true); store(); return; }
    if (listing) {
      D = { id0: listing.id, sid: s.id, step: 1, photos: (listing.photos || []).map(p => ({ path: p })), category: listing.category, title: listing.title, description: listing.description,
        price: String(listing.price || ''), price_note: listing.price_note || '', condition: listing.condition || '', halal_note: listing.halal_note || '', loc_province: listing.loc_province || v.province,
        loc_city: listing.loc_city || v.regency, loc_district: listing.loc_district || '', address: listing.address || '', details: { ...(listing.details || {}) }, halal_declared: false, status0: listing.status };
    } else {
      if (!canPost()) { quotaFull(); return; }
      const old = loadDraft();
      D = old && !(await ask({ title: 'Lanjutkan draf?', text: 'Ada draf iklan yang belum diterbitkan. Tekan "Ya" untuk melanjutkan, atau "Batal" untuk mulai baru.' })) ? null : old;
      if (old && !D) for (const p of old.photos || []) if (p.fresh) M.removePhoto(p.path);
      if (!D) D = { id: M.newId(), sid: s.id, step: 1, photos: [], category: '', title: '', description: '', price: '', price_note: '', condition: '', halal_note: '',
        loc_province: v.province, loc_city: v.regency, loc_district: v.district, address: '', details: {}, halal_declared: false };
    }
    stepPhotos();
  }
  function stepHead(n, title, sub) {
    return [back(n === 1 ? (D.id0 ? '← Toko Saya' : '← Batal') : '← Kembali', n === 1 ? cancelEditor : () => (n === 2 ? stepPhotos() : stepCategory()), 'pu-ed-back'),
      h('ol', { class: 'pu-steps', id: 'pu-ed-step', 'data-step': String(n), 'aria-label': 'Langkah' }, ...['Foto', 'Kategori', 'Detail'].map((t, i) =>
        h('li', A({ class: i + 1 < n ? 'done' : i + 1 === n ? 'on' : '', 'aria-current': i + 1 === n ? 'step' : null }), h('span', { class: 'pu-sn' }, i + 1 < n ? ic('check') : String(i + 1)), h('span', {}, t)))),
      h('h2', { class: 'wtitle' }, title), sub ? h('p', { class: 'muted' }, sub) : ''];
  }
  async function cancelEditor() {
    if (!D.id0 && D.photos.length && !(await ask({ title: 'Tinggalkan editor?', text: 'Draf iklan disimpan sementara di perangkat ini. Anda bisa melanjutkannya nanti dari "Buat Iklan Baru".' }))) return;
    saveDraft(); store();
  }

  /* ----- Langkah 1: foto ----- */
  function stepPhotos() {
    D.step = 1;
    const max = (S.st && S.st.max_photos) || 10, kb = (S.st && S.st.max_photo_kb) || 300;
    const file = h('input', { type: 'file', id: 'pu-ph-file', accept: 'image/jpeg,image/png,image/webp', multiple: true, hidden: true, 'aria-label': 'Pilih foto iklan' });
    const err = errBox('pu-ph-err');
    const grid = h('div', { class: 'pu-slots', id: 'pu-slots' });
    const next = btn('Lanjut', 'btn-primary pu-wide', 'pu-next', () => { if (ready()) { saveDraft(); stepCategory(); } });
    const ready = () => D.photos.length > 0 && D.photos[0].path && !D.photos[0].err && !D.photos.some(p => p.busy);
    async function addFiles(files) {
      err.textContent = '';
      const room = max - D.photos.length;
      const list = [...files].slice(0, Math.max(0, room));
      if (files.length > room) err.textContent = 'Maksimal ' + max + ' foto. Sebagian foto tidak ditambahkan.';
      for (const f of list) {
        const it = { busy: true, url: URL.createObjectURL(f) }; D.photos.push(it); paint();
        try {
          const img = await M.preparePhoto(f, kb); const path = M.newPhotoPath(D.sid);
          await M.uploadPhoto(path, img.blob); it.path = path; it.fresh = true; it.busy = false;
        } catch (e) { it.busy = false; it.err = e && e.code && M.PHOTO_ERRORS[e.code] ? M.PHOTO_ERRORS[e.code] : 'Gagal mengunggah. ' + M.errorText(e); }
        paint(); saveDraft();
      }
    }
    file.addEventListener('change', () => { if (file.files && file.files.length) addFiles(file.files); file.value = ''; });
    const move = (i, j) => { const [x] = D.photos.splice(i, 1); D.photos.splice(j, 0, x); paint(); saveDraft(); };
    const remove = i => { const [x] = D.photos.splice(i, 1); if (x && x.fresh && x.path) M.removePhoto(x.path); paint(); saveDraft(); };
    function paint() {
      const slots = [];
      for (let i = 0; i < max; i++) {
        const p = D.photos[i], label = i === 0 ? 'Sampul' : 'Foto ' + i;
        if (!p) { slots.push(h('button', { class: 'pu-slot pu-empty-slot', type: 'button', 'data-i': String(i), id: 'pu-slot-' + i, 'aria-label': 'Tambah ' + label, onclick: () => file.click() },
          i === 0 ? ic('cam', 'ic pu-slotic') : ic('plus', 'ic pu-slotic'), h('span', {}, label))); continue; }
        const src = p.path ? photoUrl(p.path) : p.url;
        slots.push(h('div', { class: 'pu-slot' + (i === 0 ? ' pu-cover' : '') + (p.err ? ' pu-slot-bad' : ''), 'data-i': String(i), id: 'pu-slot-' + i },
          src ? h('img', { src, alt: label }) : '', p.busy ? h('span', { class: 'pu-busy', role: 'status' }, 'Mengunggah…') : '', p.err ? h('span', { class: 'pu-slot-err' }, p.err) : '',
          i === 0 ? h('span', { class: 'pu-covtag' }, ic('star', 'ic'), 'Sampul') : h('span', { class: 'pu-slotlab' }, label),
          h('div', { class: 'pu-slotbar' }, i > 0 && !p.busy && !p.err ? btn(ic('star'), 'pu-sb', 'pu-cov-' + i, () => move(i, 0), { 'aria-label': 'Jadikan sampul', title: 'Jadikan sampul' }) : '',
            i > 0 && !p.busy ? btn(ic('left'), 'pu-sb', null, () => move(i, i - 1), { 'aria-label': 'Geser ke kiri' }) : '',
            i < D.photos.length - 1 && !p.busy ? btn(ic('right'), 'pu-sb', null, () => move(i, i + 1), { 'aria-label': 'Geser ke kanan' }) : '',
            !p.busy ? btn(ic('trash'), 'pu-sb', 'pu-del-' + i, () => remove(i), { 'aria-label': 'Hapus ' + label }) : '')));
      }
      grid.replaceChildren(...slots);
      next.disabled = !ready();
    }
    paint();
    draw(...stepHead(1, 'Unggah Foto Iklan', 'Foto Anda akan menjadi foto sampul/thumbnail dan membantu pembeli melihat produk dengan jelas.'),
      file, grid, err, h('p', { class: 'hint', id: 'pu-ph-hint' }, 'Foto sampul wajib, ' + (max - 1) + ' foto tambahan opsional. Format JPG, PNG, atau WebP; foto diperkecil otomatis (maks. ' + kb + ' KB). Gunakan foto milik sendiri yang jujur menggambarkan produk.'),
      next);
  }

  /* ----- Langkah 2: kategori ----- */
  function stepCategory() {
    D.step = 2;
    const q = h('input', { class: 'in pu-search', id: 'pu-catq', type: 'search', placeholder: 'Cari kategori…', 'aria-label': 'Cari kategori', maxlength: '40' });
    const grid = h('div', { class: 'pu-catgrid', id: 'pu-catgrid', role: 'radiogroup', 'aria-label': 'Kategori' });
    const next = btn('Lanjut', 'btn-primary pu-wide', 'pu-next', () => { if (D.category) { saveDraft(); stepDetail(); } });
    function paint() {
      const s = q.value.trim().toLowerCase();
      const list = M.categories().filter(c => !s || c.label.toLowerCase().includes(s));
      grid.replaceChildren(...(list.length ? list.map(c => btn([h('span', { class: 'pu-cic' }, catIc(c.icon || c.key)), h('span', {}, c.label)], 'pu-catcard' + (D.category === c.key ? ' on' : ''), 'pu-cat-' + c.key,
        () => { D.category = c.key; paint(); saveDraft(); }, { role: 'radio', 'aria-checked': String(D.category === c.key) }))
        : [h('p', { class: 'muted', id: 'pu-catnone' }, 'Kategori tidak ditemukan. Pilih "Lainnya".')]));
      next.disabled = !D.category;
    }
    q.addEventListener('input', paint);
    paint();
    draw(...stepHead(2, 'Mau jual apa hari ini?', 'Pilih kategori sesuai barang atau jasa yang Anda jual.'), h('div', { class: 'pu-sbox' }, ic('search', 'ic pu-sic'), q), grid, next);
  }

  /* ----- Langkah 3: detail ----- */
  function stepDetail() {
    D.step = 3;
    const counter = (el, max, id) => { const c = h('span', { class: 'pu-count-t', id }, ''); const up = () => { c.textContent = el.value.length + '/' + max; c.classList.toggle('pu-over', el.value.length > max); }; el.addEventListener('input', up); up(); return c; };
    const bind = (el, k) => { el.value = D[k] || ''; el.addEventListener('input', () => { D[k] = el.value; saveDraft(); }); return el; };
    const title = bind(h('input', { class: 'in', id: 'pu-f-title', maxlength: '80', placeholder: 'Contoh: Madu Murni Asli 500 gr' }), 'title');
    const desc = bind(h('textarea', { class: 'in pu-ta', id: 'pu-f-desc', rows: '6', maxlength: '4200', placeholder: 'Jelaskan produk/jasa: bahan, ukuran, kondisi, cara pemesanan, dan lainnya.' }), 'description');
    const price = h('input', { class: 'in', id: 'pu-f-price', inputmode: 'numeric', maxlength: '16', placeholder: 'Contoh: 120.000' });
    const fmt = v => { const n = M.parsePrice(v); return n ? n.toLocaleString('id-ID') : ''; };
    price.value = fmt(D.price);
    price.addEventListener('input', () => { D.price = price.value.replace(/[^\d]/g, ''); const f = fmt(D.price); if (price.value !== f) price.value = f; saveDraft(); });
    const pnote = bind(h('input', { class: 'in', id: 'pu-f-pnote', maxlength: '40', placeholder: 'Opsional, contoh: per botol, nego' }), 'price_note');
    const service = M.isService(D.category);
    const cond = h('div', { class: 'pu-seg', id: 'pu-f-cond', role: 'radiogroup', 'aria-label': 'Kondisi' }, ...[['baru', 'Baru'], ['bekas', 'Bekas']].map(([k, l]) =>
      btn(l, 'pu-segb' + (D.condition === k ? ' on' : ''), 'pu-cond-' + k, () => { D.condition = D.condition === k ? '' : k; for (const b of cond.children) { b.classList.toggle('on', b.id === 'pu-cond-' + D.condition); b.setAttribute('aria-checked', String(b.id === 'pu-cond-' + D.condition)); } saveDraft(); },
        { role: 'radio', 'aria-checked': String(D.condition === k) })));
    const halal = bind(h('input', { class: 'in', id: 'pu-f-halal', maxlength: '200', placeholder: 'Contoh: bahan halal, sertifikat halal BPJPH No. ...' }), 'halal_note');
    const loc = locationPicker('pu-f', { province: D.loc_province, regency: D.loc_city, district: D.loc_district }, false);
    const addr = bind(h('input', { class: 'in', id: 'pu-f-addr', maxlength: '200', placeholder: 'Opsional, contoh: dekat Masjid Al-Ikhlas (jangan tulis alamat rumah lengkap)' }), 'address');
    const det = h('details', { class: 'panel pu-more-det', id: 'pu-f-more' }, h('summary', {}, 'Info tambahan (opsional): stok, satuan, merek, pengiriman…'),
      ...M.DETAIL_FIELDS.filter(([k]) => service ? !['stock', 'unit', 'brand', 'size'].includes(k) : k !== 'terms').map(([k, l, ph]) => {
        const long = k === 'shipping' || k === 'terms' || k === 'note';
        const el = h(long ? 'textarea' : 'input', A({ class: 'in', id: 'pu-d-' + k, maxlength: long ? '300' : '60', placeholder: ph || null, rows: long ? '2' : null }));
        el.value = (D.details && D.details[k]) || ''; el.addEventListener('input', () => { D.details[k] = el.value; saveDraft(); });
        return field(l, el, false, 'pu-d-' + k);
      }));
    if (Object.values(D.details || {}).some(Boolean)) det.open = true;
    const decl = h('input', { type: 'checkbox', id: 'pu-f-decl' }); decl.checked = !!D.halal_declared; decl.addEventListener('change', () => { D.halal_declared = decl.checked; });
    const err = errBox('pu-f-err');
    const go = btn('Pratinjau Iklan', 'btn-primary pu-wide', 'pu-topreview', () => {
      const lv = loc.get(); D.loc_province = lv.province; D.loc_city = lv.regency; D.loc_district = lv.district;
      const c = M.checkListing(D, { maxPhotos: (S.st && S.st.max_photos) || 10 });
      if (!c.ok) { err.textContent = Object.values(c.errors)[0]; return; }
      saveDraft(); preview(c.value);
    });
    draw(...stepHead(3, 'Lengkapi detail iklan Anda', 'Tuliskan informasi lengkap agar pembeli memahami produk atau jasa Anda.'),
      h('div', { class: 'panel pu-form', id: 'pu-dform' },
        field('Judul iklan', title, true, 'pu-f-title', counter(title, M.LIM.title, 'pu-c-title')),
        field('Deskripsi', desc, true, 'pu-f-desc', counter(desc, M.LIM.desc, 'pu-c-desc')),
        field('Harga (Rp)', h('div', { class: 'pu-rp' }, h('span', {}, 'Rp'), price), true, 'pu-f-price'),
        field('Keterangan harga', pnote, false, 'pu-f-pnote'),
        field('Kategori', h('div', { class: 'pu-catpick' }, h('span', { class: 'pu-cic' }, catIc(D.category)), h('b', { id: 'pu-f-cat' }, M.catLabel(D.category)), btn('Ganti', 'btn-sm ghost', 'pu-f-catchange', stepCategory)), true),
        service ? '' : field('Kondisi', cond, false, 'pu-cond-baru'),
        D.category === 'makanan' ? field('Keterangan halal', halal, true, 'pu-f-halal', h('span', { class: 'hint' }, 'Pernyataan penjual, bukan sertifikasi dari BAITUNA.')) : '',
        field('Lokasi barang/jasa', loc.el, true, 'pu-f-prov', h('span', { class: 'hint' }, 'Yang tampil ke pembeli: kecamatan (bila diisi), kabupaten/kota, dan provinsi.')),
        field('Patokan lokasi', addr, false, 'pu-f-addr'), det,
        h('label', { class: 'pu-check', for: 'pu-f-decl' }, decl, h('span', {}, 'Saya menyatakan informasi iklan ini benar, barang/jasa halal dan tidak melanggar ', h('button', { class: 'pu-link', type: 'button', onclick: rules }, 'aturan Pasar Umat'), '.'))),
      err, go);
  }

  /* ----- Pratinjau & terbitkan ----- */
  function preview(val) {
    const s = seller() || {};
    const body = { ...val, id: D.id0 ? undefined : D.id, photos: val.photos };
    const pub = btn(D.id0 ? 'Simpan Perubahan' : 'Terbitkan Iklan', 'btn-primary', 'pu-publish', async () => {
      pub.disabled = true; err.textContent = '';
      try {
        const r = await M.saveListing(D.id0 || null, body);
        if (!D.id0) clearDraft();
        const wasEdit = !!D.id0; D = null; S.list.loaded = false;
        done(r, wasEdit);
      } catch (e) {
        if (e && e.message === 'kuota_penuh') { saveDraft(); quotaFull(); return; }
        err.textContent = 'Gagal menyimpan. ' + M.errorText(e); pub.disabled = false;
      }
    });
    const err = errBox('pu-pv-err');
    draw(back('← Kembali untuk Mengedit', stepDetail, 'pu-pv-back'), h('h2', { class: 'wtitle' }, 'Pratinjau Iklan'),
      h('div', { class: 'panel pu-pv', id: 'pu-preview' }, gallery(val.photos, val.title),
        h('h3', { class: 'pu-dtitle', id: 'pu-pv-title' }, val.title), h('b', { class: 'pu-dprice', id: 'pu-pv-price' }, M.priceText(val.price, val.price_note)),
        h('div', { class: 'pu-chips' }, chip(M.catLabel(val.category), 'tag'), val.condition ? chip(val.condition === 'baru' ? 'Baru' : 'Bekas', 'tag') : ''),
        h('span', { class: 'pu-loc', id: 'pu-pv-loc' }, ic('pin', 'ic'), M.place(val)), h('p', { class: 'pu-desc', id: 'pu-pv-desc' }, val.description),
        val.halal_note ? h('div', { class: 'pu-row' }, h('span', { class: 'muted' }, 'Keterangan halal'), h('b', {}, val.halal_note)) : '',
        ...M.DETAIL_FIELDS.filter(([k]) => val.details[k]).map(([k, l]) => h('div', { class: 'pu-row' }, h('span', { class: 'muted' }, l), h('b', {}, val.details[k]))),
        h('div', { class: 'pu-sellercard' }, h('span', { class: 'pu-sav' }, ic('store')), h('div', {}, h('b', {}, s.name), chip('Penjual terverifikasi', 'ok')))),
      note(D.id0 && D.status0 === 'approved' ? 'Perubahan isi iklan akan diperiksa ulang admin. Selama diperiksa, iklan tidak tayang.' : 'Iklan akan diperiksa admin sebelum tampil di Pasar Umat.', 'pu-pv-note'),
      err, h('div', { class: 'pu-pvbtns' }, btn('Kembali untuk Mengedit', 'btn-ghost', 'pu-pv-edit', stepDetail), pub));
  }
  function done(r, wasEdit) {
    const live = r && r.status === 'approved';
    draw(h('div', { class: 'pu-hero2', id: 'pu-done', 'data-status': r && r.status }, h('span', { class: 'pu-bigic' }, ic('checkc')),
      h('h2', { class: 'wtitle' }, live ? 'Iklan Berhasil Diterbitkan' : wasEdit ? 'Perubahan Berhasil Dikirim' : 'Iklan Berhasil Dikirim'),
      h('p', { class: 'muted' }, live ? 'Iklan Anda sekarang sudah tampil di Pasar Umat.' : 'Terima kasih. Iklan Anda telah diterima dan akan ditampilkan setelah proses pemeriksaan selesai.'),
      r && r.slot === 'free' && !wasEdit ? h('p', { class: 'hint', id: 'pu-done-free' }, 'Iklan ini memakai kesempatan iklan pertama GRATIS.') : ''),
      btn('Lihat Iklan Saya', 'btn-primary pu-wide', 'pu-done-mine', () => { S.filter = ''; store('iklan'); }),
      btn('Buat Iklan Baru', 'btn-ghost pu-wide', 'pu-done-new', () => startEditor()),
      btn('Kelola Toko Saya', 'btn-ghost pu-wide', 'pu-done-store', () => store('profil')));
  }

  /* ===================== ATURAN & TIPS ===================== */
  function rules() {
    const sec = (t, ...items) => h('div', { class: 'panel pu-rule' }, h('h3', {}, t), h('ul', {}, ...items.map(x => h('li', {}, x))));
    draw(back('← Pasar Umat', home), h('h2', { class: 'wtitle', id: 'pu-rules-title' }, 'Aturan & Tips Pasar Umat'),
      h('p', { class: 'muted' }, 'Pasar Umat adalah etalase produk dan jasa jamaah. Mohon dibaca sebelum berjualan atau membeli.'),
      sec('Ketentuan berjualan', 'Penjual wajib lolos verifikasi identitas (KTP) oleh admin sebelum iklannya tayang.', 'Iklan pertama gratis satu kali per penjual. Iklan berikutnya memakai paket langganan sesuai kuota.',
        'Setiap iklan baru atau yang diubah diperiksa admin sebelum tayang.', 'Satu iklan untuk satu produk/jasa. Jangan memasang iklan yang sama berulang kali.'),
      sec('Kejujuran informasi', 'Tulis judul, harga, kondisi, dan lokasi sesuai keadaan sebenarnya.', 'Makanan wajib menyebut keterangan halal. Itu pernyataan penjual, bukan sertifikasi dari BAITUNA.',
        'Gunakan foto milik sendiri atau foto yang Anda berhak memakainya. Jangan memakai foto yang menyesatkan.'),
      sec('Yang tidak diperbolehkan', 'Barang atau jasa yang haram, ilegal, berbahaya, atau melanggar hukum.', 'Penipuan, skema investasi/arisan berantai, dan janji keuntungan pasti.',
        'Konten tidak pantas, SARA, atau melanggar hak orang lain.', 'Meminta data pribadi pembeli di luar kebutuhan transaksi.'),
      sec('Proses moderasi', 'Admin dapat menyetujui, meminta perbaikan (dengan alasan), menolak, atau menonaktifkan iklan yang melanggar.', 'Penjual yang melanggar dapat ditangguhkan; selama ditangguhkan, iklannya tidak tayang.',
        'Pemeriksaan admin mengurangi risiko, tetapi tidak dapat menjamin semua penipuan terdeteksi.'),
      sec('Tips aman untuk pembeli', 'Transaksi dilakukan langsung antara pembeli dan penjual. BAITUNA tidak memproses pembayaran produk.', 'Periksa barang sebelum membayar bila memungkinkan, dan hindari transfer penuh kepada penjual yang belum Anda kenal.',
        'Waspadai harga yang terlalu murah atau permintaan mendesak.', 'Tekan "Laporkan" pada halaman iklan bila menemukan masalah. Laporan dibaca admin.'),
      sec('Batas tanggung jawab', 'BAITUNA menyediakan tempat iklan dan pemeriksaan identitas penjual. Kualitas barang, pengiriman, dan pembayaran produk menjadi tanggung jawab penjual dan pembeli.',
        'Langganan penjual dibayar ke BAITUNA dan terpisah dari pembayaran produk.'),
      h('p', { class: 'hint' }, 'Aturan ini dapat diperbarui pengelola. Untuk perkara syariat yang rinci, tanyakan kepada ustaz atau ulama yang Anda percaya.'));
  }

  /* ===================== SUPER ADMIN ===================== */
  function adminView(tab) {
    const box = h('div', { class: 'pu-admbox' });
    draw(box);
    renderMarketManager(box, () => { S.st = null; home(); }, tab || 'verif');
  }

  home();
  return wrap;
}
