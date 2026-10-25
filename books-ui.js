// BAITUNA - books-ui.js
// Halaman Pustaka Buku: daftar (tampilan Grid thumbnail penuh atau List thumbnail kecil + deskripsi singkat), detail, tombol Pesan
// (WhatsApp atau link checkout). Editor hanya untuk Super Admin. Pembayaran di luar BAITUNA.
import { h, toast, ask, hint } from './ui.js';
import { icon, ICONS } from './feed-ui.js';
import { getSession, storageUpload, storageRemove, storagePdfBytes } from './supabase.js';
import { openReader } from './book-reader.js';
import { loadAccess } from './permissions.js';
import { prepareSquarePhoto, PRODUCT_ERRORS } from './photo.js';
import * as B from './books-service.js';
import * as MS from './membership-service.js';
import { membershipFlow } from './membership-ui.js';
import { membershipAdminPage } from './membership-admin-ui.js';

// Ikon tambahan (path statis, gaya sama dengan ICONS).
const IC = {
  crown: '<path d="M3.5 8.5l4.2 3.6L12 5l4.3 7.1 4.2-3.6-1.8 9.5H5.3L3.5 8.5z"/><path d="M5.5 21h13"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  sort: '<path d="M8 4v16M8 4L5 7M8 4l3 3M16 20V4M16 20l-3-3M16 20l3-3"/>',
  kebab: '<path d="M12 5h.01M12 12h.01M12 19h.01"/>',
  box: '<path d="M12 3l8 4v10l-8 4-8-4V7l8-4z"/><path d="M4 7l8 4 8-4M12 11v10"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/>',
  mark: '<path d="M7 4h10v16l-5-3.5L7 20V4z"/>',
  open: '<path d="M3 5.5c2.8-1 5.8-1 9 1 3.2-2 6.2-2 9-1V19c-2.8-1-5.8-1-9 1-3.2-2-6.2-2-9-1V5.5z"/><path d="M12 6.5V20"/>',
  cart: '<path d="M3 4h2.2l2.2 10.5h10.4L20 7H6.3"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  pub: '<path d="M4 20V6l8-3 8 3v14"/><path d="M8 20v-6h8v6M8 9.5h.01M12 9.5h.01M16 9.5h.01"/>',
  cat: '<path d="M4 5.5h6.5v6.5H4zM13.5 5.5H20v6.5h-6.5zM4 15h6.5v4.5H4zM13.5 15H20v4.5h-6.5z"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  pdf: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 16.5h4"/>'
};
// Buku yang disimpan pengguna (ikon penanda di detail) - hanya di perangkat.
const SAVED_KEY = 'baituna.books.saved';
const savedSet = () => { try { const a = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); return new Set(Array.isArray(a) ? a.slice(0, 500) : []); } catch (e) { return new Set(); } };
const saveSet = set => { try { localStorage.setItem(SAVED_KEY, JSON.stringify([...set].slice(0, 500))); } catch (e) { /* abaikan */ } };


/* ===== Editor teks sederhana (tebal, miring, garis bawah, daftar) ===== */
function richEditor(id, placeholder) {
  const el = h('div', { class: 'in rt-area', id, contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Deskripsi', 'data-placeholder': placeholder, spellcheck: 'true' });
  const HL = '#fff200';
  const hlOn = () => { try { const v = String(document.queryCommandValue('hiliteColor') || document.queryCommandValue('backColor')).toLowerCase().replace(/\s/g, ''); return !!v && v !== 'transparent' && v !== 'rgba(0,0,0,0)' && v !== 'rgb(255,255,255)' && v !== 'white' && v !== 'inherit'; } catch (e) { return false; } };
  const run = cmd => {
    el.focus();
    try {
      if (cmd === 'hilite') { document.execCommand('styleWithCSS', false, true); document.execCommand('hiliteColor', false, hlOn() ? 'transparent' : HL); document.execCommand('styleWithCSS', false, false); }
      else document.execCommand(cmd, false, null);
    } catch (e) { /* abaikan */ }
    sync();
  };
  const SV = d => '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">' + d + '</svg>';
  const ICO = {
    ul: SV('<circle cx="4" cy="6" r="1.8"/><circle cx="4" cy="12" r="1.8"/><circle cx="4" cy="18" r="1.8"/><rect x="9" y="5" width="12" height="2.2" rx="1"/><rect x="9" y="11" width="12" height="2.2" rx="1"/><rect x="9" y="17" width="12" height="2.2" rx="1"/>'),
    ol: SV('<text x="1" y="8" font-size="7" font-weight="700" font-family="Arial,sans-serif">1</text><text x="1" y="14.5" font-size="7" font-weight="700" font-family="Arial,sans-serif">2</text><text x="1" y="21" font-size="7" font-weight="700" font-family="Arial,sans-serif">3</text><rect x="9" y="5" width="12" height="2.2" rx="1"/><rect x="9" y="11" width="12" height="2.2" rx="1"/><rect x="9" y="17" width="12" height="2.2" rx="1"/>'),
    hl: SV('<path d="M3 20h18v3H3z" fill="#ffe600"/><path d="M12 3 6 16h2.4l1.1-2.8h5l1.1 2.8H18L12 3zm0 4.6 1.7 4.2h-3.4L12 7.6z"/>'),
    full: SV('<path d="M4 4h6v2.2H6.2V10H4V4zm10 0h6v6h-2.2V6.2H14V4zM4 14h2.2v3.8H10V20H4v-6zm13.8 0H20v6h-6v-2.2h3.8V14z"/>'),
    shrink: SV('<path d="M9.8 4v6H4V7.8h3.6V4h2.2zM14.2 4h2.2v3.8H20V10h-5.8V4zM4 14h5.8v6H7.6v-3.8H4V14zm10.2 0H20v2.2h-3.6V20h-2.2v-6z"/>'),
    clear: SV('<path d="M15.1 3.6a2 2 0 0 1 2.8 0l2.5 2.5a2 2 0 0 1 0 2.8L11.9 17.4H17v2H8.6L3.6 14.4a2 2 0 0 1 0-2.8l11.5-8zM9.1 17.4l7.5-7.5-3.7-3.7-8.1 8.1 3.1 3.1h1.2z"/>'),
  };
  const mk = (content, cmd, label, cls, svg) => { const b = h('button', { class: 'rt-b' + (cls ? ' ' + cls : ''), type: 'button', 'data-cmd': cmd, 'aria-label': label, title: label, 'aria-pressed': 'false',
    onmousedown: ev => ev.preventDefault(), onclick: () => run(cmd) }, svg ? '' : content); if (svg) b.innerHTML = svg; return b; };
  const bar = h('div', { class: 'rt-bar', role: 'toolbar', 'aria-label': 'Format teks' },
    mk('B', 'bold', 'Tebal', 'rt-bold'), mk('I', 'italic', 'Miring', 'rt-ital'), mk('U', 'underline', 'Garis bawah', 'rt-under'),
    h('span', { class: 'rt-sep', 'aria-hidden': 'true' }),
    mk('', 'insertUnorderedList', 'Daftar butir', '', ICO.ul), mk('', 'insertOrderedList', 'Daftar nomor', '', ICO.ol),
    h('span', { class: 'rt-sep', 'aria-hidden': 'true' }),
    mk('', 'hilite', 'Stabilo (sorot teks)', 'rt-hl', ICO.hl), mk('', 'removeFormat', 'Hapus format', '', ICO.clear));
  const fullBtn = h('button', { class: 'rt-b rt-full-btn', type: 'button', id: 'bk-f-expand', 'aria-label': 'Perbesar editor', title: 'Perbesar editor', 'aria-pressed': 'false', onmousedown: ev => ev.preventDefault() });
  fullBtn.innerHTML = ICO.full; bar.append(h('span', { class: 'rt-sep', 'aria-hidden': 'true' }), fullBtn);
  function sync() {
    for (const b of bar.querySelectorAll('[data-cmd]')) {
      const c = b.getAttribute('data-cmd'); let on = false;
      if (c === 'hilite') on = hlOn(); else if (c !== 'removeFormat') { try { on = document.queryCommandState(c); } catch (e) { /* abaikan */ } }
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
  const setFull = on => {
    box.classList.toggle('rt-full', on); document.documentElement.classList.toggle('rt-lock', on);
    fullBtn.innerHTML = on ? ICO.shrink : ICO.full; const t = on ? 'Perkecil editor' : 'Perbesar editor';
    fullBtn.setAttribute('aria-label', t); fullBtn.setAttribute('title', t); fullBtn.setAttribute('aria-pressed', String(on));
    if (on) el.focus();
  };
  fullBtn.addEventListener('click', () => setFull(!box.classList.contains('rt-full')));
  el.addEventListener('keydown', ev => { if (ev.key === 'Escape' && box.classList.contains('rt-full')) { ev.preventDefault(); setFull(false); } });
  // Bila halaman diganti saat editor penuh layar, kunci gulir dilepas.
  new MutationObserver(() => { if (!box.isConnected) document.documentElement.classList.remove('rt-lock'); }).observe(document.body, { childList: true, subtree: true });
  return {
    el, box,
    get: () => { const v = B.sanitizeHtml(el.innerHTML); return B.htmlToText(v) ? v : ''; },
    set: html => { el.innerHTML = B.sanitizeHtml(html); },
  };
}

export function booksPage({ go, onSignIn } = {}) {
  const wrap = h('div', { class: 'books' });
  const st = { items: null, fail: null, kind: '', access: '', q: '', sort: 'terbaru', view: B.loadView(), isAdmin: false, open: '', member: null };
  const canRead = b => !B.isPremium(b) || st.isAdmin || MS.isActive(st.member);
  const draw = (...k) => wrap.replaceChildren(...k);
  const back = (label, fn) => h('button', { class: 'btn-ghost bk-back', type: 'button', id: 'bk-back', onclick: fn }, label);
  const empty = t => h('div', { class: 'empty' }, icon(ICONS.book, 'ic-lg'), h('p', { class: 'muted' }, t));

  const descNode = d => { const n = h('div', { class: 'bk-desc' }); n.innerHTML = B.descToHtml(d); return n; };
  const thumb = (b, cls) => {
    const u = B.coverUrl(b);
    return u ? h('img', { class: 'bk-img ' + cls, src: u, alt: 'Sampul ' + b.title, loading: 'lazy', decoding: 'async' })
      : h('span', { class: 'bk-img bk-ph ' + cls, 'aria-hidden': 'true' }, icon(ICONS.book, 'ic-lg'));
  };

  /* ===== Membership: alur (digambar di halaman ini) ===== */
  const refreshMember = async () => { try { st.member = getSession() && getSession().user ? await MS.myMembership() : null; } catch (e) { st.member = null; } };
  function openMembership(start) {
    membershipFlow({ draw, start, isAdmin: st.isAdmin, openAdmin: tab => membershipAdminPage({ draw, tab, exit: () => openMembership(start) }), signIn: () => { if (onSignIn) onSignIn(); }, exit: async () => { await refreshMember(); st.open ? showDetail(st.open) : showList(); } });
  }
  // Banner di bawah daftar: ajakan bergabung (belum aktif) atau status membership (aktif).
  function premiumBanner() {
    const act = MS.isActive(st.member), left = act ? MS.daysLeft(st.member) : null;
    const sub = act ? 'Berlaku sampai ' + MS.fmtDate(st.member.ends_at) + (left != null && left <= 7 ? ' (tinggal ' + Math.max(left, 0) + ' hari). Ketuk untuk memperpanjang.' : '. Ketuk untuk melihat detail.')
      : 'Dapatkan membership untuk membaca seluruh buku Premium di Pustaka Buku BAITUNA.';
    return h('div', { id: 'bk-mem', 'data-active': String(act) },
      h('button', { class: 'bk-promo', type: 'button', id: act ? 'bk-promo-open' : 'bk-join', onclick: () => { st.open = ''; openMembership(act ? 'mine' : 'plans'); } },
        h('span', { class: 'bk-promo-ic' }, icon(IC.crown, 'ic-sm')),
        h('span', { class: 'bk-promo-t' }, h('b', {}, act ? 'Membership Premium aktif' : 'Akses semua buku Premium'), h('span', {}, sub)),
        icon(ICONS.chev, 'bk-chev')));
  }
  // Header hijau: judul + tombol Premium (membership saya bila sudah masuk, pilihan paket bila belum).
  function hero() {
    const logged = !!(getSession() && getSession().user);
    return h('header', { class: 'bk-hero' },
      h('span', { class: 'bk-hero-ic' }, icon(ICONS.book, 'ic-sm')),
      h('span', { class: 'bk-hero-t' }, h('h2', { class: 'bk-hero-h' }, 'Pustaka Buku'), h('span', { class: 'bk-hero-s' }, 'BAITUNA')),
      h('button', { class: 'bk-pill', type: 'button', id: 'bk-mine', 'aria-label': logged ? 'Membership Premium saya' : 'Lihat paket Membership Premium', onclick: () => { st.open = ''; openMembership(logged ? 'mine' : 'plans'); } }, icon(IC.crown, 'ic-sm'), 'Premium'));
  }

  async function load() {
    st.fail = null;
    try { st.items = await B.listBooks(); } catch (e) { st.items = null; st.fail = e; }
  }

  /* ===== Daftar ===== */
  function viewSeg() {
    return h('div', { class: 'seg bk-seg', id: 'bk-view', role: 'group', 'aria-label': 'Tampilan' }, ...[['grid', 'Grid', IC.grid], ['list', 'List', IC.list]].map(([k, l, ic]) =>
      h('button', { class: 'segb', type: 'button', id: 'bk-v-' + k, 'aria-pressed': String(st.view === k), 'aria-selected': String(st.view === k), onclick: () => { if (st.view !== k) { st.view = k; B.saveView(k); drawList(); } } }, icon(ic, 'ic-sm'), l)));
  }
  // Label di sampul: Premium (mahkota, sama dengan mockup; gembok hanya di halaman detail) atau Gratis untuk buku yang bisa dibaca di aplikasi.
  const badge = b => {
    if (B.isPremium(b)) return h('span', { class: 'bk-badge bk-b-prem', 'data-access': 'premium' }, icon(IC.crown, 'ic-sm'), 'Premium');
    return b.has_file ? h('span', { class: 'bk-badge bk-b-free', 'data-access': 'gratis' }, 'Gratis') : '';
  };
  const kindChip = b => h('span', { class: 'bk-k' }, b.kind === 'digital' ? 'Digital' : 'Fisik');
  const premChip = b => h('span', { class: 'bk-k bk-kp' }, icon(IC.crown, 'ic-sm'), 'Premium');
  const freeChip = () => h('span', { class: 'bk-k bk-kf' }, 'Gratis');
  const author = b => b.author ? h('span', { class: 'bk-au' }, b.author) : '';
  const closeMenus = () => wrap.querySelectorAll('.bk-menu').forEach(m => m.remove());
  const onDoc = ev => { if (!wrap.isConnected) { document.removeEventListener('click', onDoc); return; } if (!ev.target.closest || !ev.target.closest('.bk-kb, .bk-menu')) closeMenus(); };
  document.addEventListener('click', onDoc);
  function kebab(b) {
    const btn = h('button', { class: 'bk-kb', type: 'button', 'aria-label': 'Menu ' + b.title, 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, icon(IC.kebab, 'ic-sm'));
    btn.addEventListener('click', ev => {
      ev.stopPropagation();
      const had = btn.parentNode.querySelector('.bk-menu'); closeMenus(); btn.setAttribute('aria-expanded', 'false');
      if (had) return;
      const it = (label, fn) => h('button', { class: 'bk-mi', type: 'button', role: 'menuitem', onclick: () => { closeMenus(); fn(); } }, label);
      const menu = h('div', { class: 'bk-menu', role: 'menu' }, it('Lihat detail', () => showDetail(b.id)), st.isAdmin ? it('Ubah buku', () => { showManage(b); window.scrollTo(0, 0); }) : '');
      btn.after(menu); btn.setAttribute('aria-expanded', 'true');
    });
    return btn;
  }
  const gridItem = b => h('div', { class: 'bk-gc', 'data-id': b.id },
    h('button', { class: 'bk-gi', type: 'button', 'data-id': b.id, 'aria-label': b.title + (B.isPremium(b) ? ' (Premium)' : ''), onclick: () => showDetail(b.id) }, thumb(b, 'bk-g-img'), badge(b)),
    kebab(b),
    h('div', { class: 'bk-gt', onclick: () => showDetail(b.id) }, h('b', { class: 'bk-title' }, b.title), author(b), h('span', { class: 'bk-chips' }, kindChip(b), B.isPremium(b) ? premChip(b) : '')));
  const listItem = b => h('button', { class: 'bk-li', type: 'button', 'data-id': b.id, onclick: () => showDetail(b.id) }, thumb(b, 'bk-l-img'),
    h('span', { class: 'bk-lt' }, h('b', { class: 'bk-title' }, b.title), author(b),
      h('span', { class: 'muted bk-sd' }, B.shortDesc(b.description)),
      h('span', { class: 'bk-chips' }, b.has_file || B.isPremium(b) ? '' : h('span', { class: 'bk-price' }, B.priceText(b.price)), B.isPremium(b) ? '' : b.has_file ? freeChip() : '', kindChip(b), B.isPremium(b) ? premChip(b) : '')),
    icon(ICONS.chev, 'bk-chev'));
  function drawList() {
    const kids = [hero()];
    if (st.isAdmin) kids.push(h('div', { class: 'bk-acts' }, h('button', { class: 'btn-sm', type: 'button', id: 'bk-manage', onclick: showManage }, 'Kelola buku'),
      h('button', { class: 'btn-sm ghost', type: 'button', id: 'bk-atur', onclick: () => membershipAdminPage({ draw, tab: 'atur', exit: () => { showList(); } }) }, 'Atur Membership')));
    if (st.fail) {
      kids.push(empty(B.notReady(st.fail) ? 'Pustaka Buku belum aktif. Pengelola perlu menjalankan buku.sql.' : 'Daftar buku belum bisa dimuat. Periksa koneksi.'));
      if (!B.notReady(st.fail)) kids.push(h('button', { class: 'btn-sm', type: 'button', id: 'bk-retry', onclick: async () => { draw(h('p', { class: 'muted', id: 'bk-loading' }, 'Memuat…')); await load(); drawList(); } }, 'Coba lagi'));
      draw(...kids); return;
    }
    const search = h('input', { class: 'bk-qin', id: 'bk-q', type: 'search', maxlength: '60', placeholder: 'Cari judul buku, penulis, atau topik…', 'aria-label': 'Cari buku' }); search.value = st.q;
    search.addEventListener('input', () => { st.q = search.value; paintItems(); });
    const chip = (on, attrs, ic, label, fn) => h('button', { class: 'bk-fc' + (on ? ' on' : ''), type: 'button', 'aria-pressed': String(on), ...attrs, onclick: fn }, ic ? (ic === IC.crown ? h('span', { class: 'bk-gico' }, icon(ic, 'ic-sm')) : icon(ic, 'ic-sm')) : '', label);
    // Satu baris: dropdown jenis (Semua Jenis / Buku digital / Buku fisik) di kiri, lalu Gratis dan Premium. Tekan lagi chip yang aktif untuk melepas.
    const kindSel = h('select', { class: 'bk-ksel', id: 'bk-kind', 'aria-label': 'Jenis buku' }, h('option', { value: '' }, 'Semua Jenis'), h('option', { value: 'digital' }, 'Buku digital'), h('option', { value: 'fisik' }, 'Buku fisik'));
    kindSel.value = st.kind; kindSel.addEventListener('change', () => { st.kind = kindSel.value; drawList(); });
    const filters = h('div', { class: 'bk-fr', id: 'bk-filters' },
      h('label', { class: 'bk-fc bk-kwrap' + (st.kind ? ' on' : ''), for: 'bk-kind' }, kindSel, icon(IC.down, 'ic-sm')),
      h('span', { class: 'bk-acc', id: 'bk-access', role: 'group', 'aria-label': 'Akses buku' },
        chip(st.access === 'gratis', { 'data-access': 'gratis' }, null, 'Gratis', () => { st.access = st.access === 'gratis' ? '' : 'gratis'; drawList(); }),
        chip(st.access === 'premium', { 'data-access': 'premium' }, IC.crown, 'Premium', () => { st.access = st.access === 'premium' ? '' : 'premium'; drawList(); })));
    const count = h('span', { class: 'bk-count', id: 'bk-count', 'aria-live': 'polite' }, '');
    const sortSel = h('select', { class: 'bk-sort', id: 'bk-sort', 'aria-label': 'Urutkan buku' }, ...B.SORTS.map(o => h('option', { value: o.key }, o.label)));
    sortSel.value = st.sort; sortSel.addEventListener('change', () => { st.sort = sortSel.value; paintItems(); });
    const bar = h('div', { class: 'bk-bar' }, count, h('label', { class: 'bk-sortl', for: 'bk-sort' }, icon(IC.sort, 'ic-sm'), h('span', {}, 'Urutkan'), sortSel, icon(IC.down, 'ic-sm')));
    const box = h('div', { id: 'bk-items' });
    kids.push(h('label', { class: 'bk-search' }, icon(ICONS.search, 'ic-sm'), search), viewSeg(), filters, bar, box, premiumBanner());
    draw(...kids); paintItems();
    function paintItems() {
      const rows = B.filterBooks(st.items || [], { kind: st.kind, q: st.q, access: st.access, sort: st.sort });
      count.textContent = rows.length + ' buku tersedia';
      if (!rows.length) { box.replaceChildren(empty(st.q || st.kind || st.access ? 'Tidak ada buku yang cocok.' : 'Belum ada buku di pustaka.')); return; }
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
    const cu = B.coverUrl(b), prem = B.isPremium(b), ok = canRead(b), digital = b.kind === 'digital';
    const chev = () => icon(ICONS.chev, 'bk-cta-chev');
    // Tombol utama sesuai jenis & akses: Baca Buku (digital yang boleh dibaca), Buka dengan Membership (Premium belum aktif), Beli Buku (fisik).
    let cta, ctaNote = '';
    if (digital && b.has_file && ok) {
      cta = h('button', { class: 'bk-cta', type: 'button', id: 'bk-read', onclick: () => openReader({ id: b.id, title: b.title, load: async () => {
        const path = await B.bookFilePath(b.id);
        if (!path) throw Object.assign(new Error('forbidden'), { status: 403 });
        return storagePdfBytes(path, B.FILE_BUCKET);
      } }) }, icon(IC.open), h('span', {}, 'Baca Buku'), chev());
    } else if (prem && !ok) {
      cta = h('button', { class: 'bk-cta bk-cta-gold', type: 'button', id: 'bk-gabung', onclick: () => openMembership('plans') }, icon(IC.crown), h('span', {}, 'Buka dengan Membership'));
      ctaNote = h('p', { class: 'bk-cta-note', id: 'bk-lock' }, 'Buku Premium. Akses semua buku Premium dengan satu membership.');
    } else if (digital && !b.has_file && !href) {
      cta = h('button', { class: 'bk-cta', type: 'button', id: 'bk-nofile', disabled: 'disabled' }, h('span', {}, 'Berkas buku belum tersedia'));
    } else {
      cta = h('button', { class: 'bk-cta', type: 'button', id: 'bk-order', onclick: () => { if (!href) { toast('Cara pemesanan buku ini belum benar.', true); return; } window.open(href, '_blank', 'noopener,noreferrer'); } },
        icon(IC.cart), h('span', {}, B.orderLabel(b)), chev());
      if (!href) cta.setAttribute('disabled', 'disabled');
    }
    // Penanda (simpan buku) & bagikan
    const saved = savedSet();
    const markBtn = h('button', { class: 'bk-tbtn' + (saved.has(b.id) ? ' on' : ''), type: 'button', id: 'bk-save', 'aria-label': 'Simpan buku', 'aria-pressed': String(saved.has(b.id)), onclick: () => {
      const s2 = savedSet(), on = !s2.has(b.id); if (on) s2.add(b.id); else s2.delete(b.id); saveSet(s2);
      markBtn.classList.toggle('on', on); markBtn.setAttribute('aria-pressed', String(on)); toast(on ? 'Buku disimpan di perangkat ini.' : 'Buku dihapus dari simpanan.');
    } }, icon(IC.mark));
    const shareBtn = h('button', { class: 'bk-tbtn', type: 'button', id: 'bk-share', 'aria-label': 'Bagikan', onclick: async () => {
      const text = 'Baca buku “' + b.title + '” di Pustaka Buku BAITUNA', url = location.origin + '/';
      try { if (navigator.share) { await navigator.share({ title: b.title, text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      try { await navigator.clipboard.writeText(text + ' ' + url); toast('Tautan disalin.'); } catch (e) { toast('Bagikan belum didukung di perangkat ini.', true); }
    } }, icon(IC.share));
    const stats = [b.pages ? [String(b.pages), 'halaman'] : null, digital && b.has_file ? [icon(IC.pdf), 'PDF'] : null, b.published_year ? [String(b.published_year), 'terbit'] : null, !digital && b.price > 0 ? [B.priceText(b.price), 'harga'] : null].filter(Boolean);
    const info = [[IC.user, 'Penulis', b.author], [IC.pub, 'Penerbit', b.publisher], [IC.cat, 'Kategori', b.category], [IC.cal, 'Tahun Terbit', b.published_year]].filter(x => x[2]);
    const desc = descNode(b.description); desc.classList.add('bk-clamp');
    const more = h('button', { class: 'bk-more', type: 'button', id: 'bk-moredesc', onclick: () => { const open = desc.classList.toggle('bk-clamp'); more.firstChild.textContent = open ? 'Baca Selengkapnya' : 'Tutup'; more.classList.toggle('up', !open); } }, h('span', {}, 'Baca Selengkapnya'), icon(IC.down, 'ic-sm'));
    draw(h('div', { class: 'bk-dtop' }, h('button', { class: 'bk-tbtn bk-back', type: 'button', id: 'bk-back', 'aria-label': 'Kembali ke Pustaka', onclick: showList }, '←'), h('span', { class: 'bk-dsp' }), markBtn, shareBtn),
      h('article', { class: 'bk-detail', id: 'bk-detail', 'data-access': prem ? 'premium' : 'gratis', 'data-kind': b.kind },
        h('div', { class: 'bk-dhead' },
          cu ? h('img', { class: 'bk-cover', src: cu, alt: 'Sampul ' + b.title, decoding: 'async' }) : h('div', { class: 'bk-cover bk-ph', 'aria-hidden': 'true' }, icon(ICONS.book, 'ic-lg')),
          h('div', { class: 'bk-dmeta' }, h('h3', { class: 'bk-dt' }, b.title), b.author ? h('p', { class: 'bk-au bk-dau', id: 'bk-dauthor' }, b.author) : '',
            h('div', { class: 'bk-chips' }, prem ? h('span', { class: 'bk-k bk-kp' }, icon(IC.crown, 'ic-sm'), 'Premium') : digital ? h('span', { class: 'bk-k bk-kf' }, 'Gratis') : '', h('span', { class: 'bk-k' }, digital ? 'Digital' : 'Buku fisik')),
            !digital ? h('p', { class: 'bk-price bk-dp' }, B.priceText(b.price)) : '')),
        stats.length ? h('div', { class: 'bk-stats', id: 'bk-stats' }, ...stats.map(([v, l]) => h('div', { class: 'bk-stat' }, h('b', {}, v), h('span', {}, l)))) : '',
        h('h4', { class: 'bk-sec' }, 'Tentang Buku'), desc, more,
        info.length ? h('div', { class: 'bk-info', id: 'bk-info' }, ...info.map(([ic, l, v]) => h('div', { class: 'bk-irow' }, icon(ic), h('span', {}, h('small', {}, l), h('b', {}, String(v)))))) : ''),
      h('div', { class: 'bk-ctabar', id: 'bk-ctabar' }, cta, ctaNote));
    requestAnimationFrame(() => { if (desc.scrollHeight <= desc.clientHeight + 4) more.hidden = true; });
    if (ctaNote) wrap.querySelector('#bk-detail').setAttribute('data-cta2', '1');
    // Tombol utama menempel tepat di atas bilah menu bawah (tinggi bilah berbeda antara tamu dan pengguna masuk).
    const bar = wrap.querySelector('#bk-ctabar');
    const place = () => {
      if (!bar.isConnected) { removeEventListener('resize', place); return; }
      const nav = [...document.querySelectorAll('#app-nav, .bottomnav')].find(n => n.getBoundingClientRect().height > 0 && getComputedStyle(n).position === 'fixed' && !n.closest('[hidden]'));
      const top = nav ? nav.getBoundingClientRect().top : innerHeight;
      bar.style.setProperty('--bk-cta-b', Math.max(8, Math.round(innerHeight - top + 10)) + 'px');
    };
    requestAnimationFrame(place); addEventListener('resize', place);
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
    const authorIn = h('input', { class: 'in', id: 'bk-f-author', maxlength: String(B.LIMIT.authorMax), placeholder: 'Contoh: Candra Seta (opsional)', autocomplete: 'off' });
    const title = h('input', { class: 'in', id: 'bk-f-title', maxlength: String(B.LIMIT.titleMax), placeholder: 'Contoh: Fiqih Salat Praktis', autocomplete: 'off' });
    const rt = richEditor('bk-f-desc', 'Tentang isi buku, penulis, jumlah halaman, dll.');
    const desc = rt.el;
    const kind = h('select', { class: 'in', id: 'bk-f-kind', 'aria-label': 'Jenis buku' }, h('option', { value: 'digital' }, 'Digital (PDF, dibaca di aplikasi)'), h('option', { value: 'fisik' }, 'Fisik (dikirim ke alamat)'));
    const infoIn = (idv, ph, extra = {}) => h('input', { class: 'in', id: idv, placeholder: ph, autocomplete: 'off', ...extra });
    const pubIn = infoIn('bk-f-pub', 'Contoh: Sholih Sehat Sejahtera', { maxlength: '80' }), catIn = infoIn('bk-f-cat', 'Contoh: Motivasi Islami', { maxlength: '40' });
    const yearIn = infoIn('bk-f-year', 'Contoh: 2024', { inputmode: 'numeric', maxlength: '4' }), pagesIn = infoIn('bk-f-pages', 'Contoh: 120', { inputmode: 'numeric', maxlength: '4' });
    const accessSel = h('select', { class: 'in', id: 'bk-f-access', 'aria-label': 'Akses buku' }, ...B.ACCESS.map(a => h('option', { value: a.key }, a.label)));
    const pdf = h('input', { class: 'in', type: 'file', id: 'bk-f-pdf', accept: 'application/pdf', 'aria-label': 'Berkas buku (PDF)' });
    const pdfPrev = h('div', { id: 'bk-f-pdfprev' });
    let removePdf = false;
    const price = h('input', { class: 'in', id: 'bk-f-price', inputmode: 'numeric', maxlength: '14', placeholder: 'Contoh: 85000', autocomplete: 'off' });
    const otype = h('select', { class: 'in', id: 'bk-f-otype', 'aria-label': 'Cara pembacaan / pemesanan' });
    const label = h('input', { class: 'in', id: 'bk-f-label', maxlength: String(B.LIMIT.labelMax), placeholder: 'Kosongkan untuk teks bawaan', autocomplete: 'off' });
    const target = h('input', { class: 'in', id: 'bk-f-target', maxlength: String(B.LIMIT.urlMax), autocomplete: 'off' });
    const active = h('input', { type: 'checkbox', id: 'bk-f-active' }); active.checked = true;
    const file = h('input', { class: 'in', type: 'file', id: 'bk-f-file', accept: 'image/jpeg,image/png,image/webp', 'aria-label': 'Banner buku' });
    const fstat = h('p', { class: 'hint', id: 'bk-f-status' }, 'Banner otomatis dijadikan kotak 1080 × 1080 (gambar utuh, tidak terpotong; latar putih) dan dikompres maksimal 100 KB.');
    const prev = h('div', { id: 'bk-f-prev' });
    const err = h('p', { class: 'mk-err', id: 'bk-f-err', role: 'alert' }, '');
    const tlabel = h('label', { class: 'hint bk-lab', for: 'bk-f-target' }, 'Link checkout website (https://) *');
    const priceBox = h('div', {}, lab('Harga (Rp) *', 'bk-f-price'), price);
    const orderBox = h('div', { id: 'bk-f-orderbox' }, tlabel, target, lab('Teks tombol (opsional, maks. ' + B.LIMIT.labelMax + ' huruf)', 'bk-f-label'), label);
    const readNote = h('div', { class: 'bk-fnote', id: 'bk-f-readnote' }, 'Untuk buku digital, pembaca langsung diarahkan ke halaman pembaca PDF di aplikasi. Tidak ada nomor WhatsApp, link, dan proses pengiriman. Gratis: dibaca semua jamaah. Premium: terbuka setelah membership aktif.');
    const fisikNote = h('div', { class: 'bk-fnote bk-fnote-w', id: 'bk-f-fisiknote' }, 'Buku fisik dibeli lewat checkout di website toko Anda (link). Pengiriman diurus di sana.');
    let legacyWa = false;
    const fillModes = () => {
      const k = kind.value, cur = otype.value;
      const opts = (B.ORDER_MODES[k] || []).slice(); if (k === 'fisik' && legacyWa) opts.push({ key: 'wa', label: 'Pesan via WhatsApp (cara lama)' });
      otype.replaceChildren(...opts.map(o => h('option', { value: o.key }, o.label)));
      if (opts.some(o => o.key === cur)) otype.value = cur;
    };
    const sync = () => {
      fillModes();
      const dig = kind.value === 'digital', wa = otype.value === 'wa';
      priceBox.hidden = dig; orderBox.hidden = dig; readNote.hidden = !dig; fisikNote.hidden = dig;
      target.setAttribute('placeholder', wa ? 'Contoh: 0812 3456 7890' : 'Contoh: https://toko.id/buku'); tlabel.textContent = wa ? 'Nomor WhatsApp penjual *' : 'Link checkout website (https://) *'; target.setAttribute('inputmode', wa ? 'tel' : 'url');
      label.setAttribute('placeholder', 'Kosongkan untuk "Beli Buku"');
    };
    kind.addEventListener('change', sync); otype.addEventListener('change', sync);
    let removeCover = false;
    function fill(b) {
      title.value = b.title; authorIn.value = b.author || ''; rt.set(b.description); accessSel.value = b.access === 'premium' ? 'premium' : 'gratis';
      pubIn.value = b.publisher || ''; catIn.value = b.category || ''; yearIn.value = b.published_year ? String(b.published_year) : ''; pagesIn.value = b.pages ? String(b.pages) : '';
      legacyWa = b.kind === 'fisik' && b.order_type === 'wa';
      pdfPrev.replaceChildren(b.file_path ? h('p', { class: 'hint', id: 'bk-f-hasfile' }, 'Berkas PDF sudah terunggah. ', h('button', { class: 'btn-sm alt', type: 'button', id: 'bk-f-rmpdf', onclick: () => { removePdf = true; pdfPrev.replaceChildren(h('p', { class: 'hint' }, 'Berkas PDF akan dihapus saat disimpan.')); } }, 'Hapus berkas')) : h('p', { class: 'hint' }, 'Belum ada berkas PDF.')); label.value = b.order_label || ''; kind.value = b.kind; price.value = String(b.price); sync(); otype.value = b.order_type; sync();
      target.value = b.order_type === 'wa' ? (b.order_wa || '') : (b.order_url || ''); active.checked = !!b.active;
      const u = B.coverUrl(b); prev.replaceChildren(u ? h('img', { class: 'bk-pv', src: u, alt: 'Banner saat ini' }) : '');
      if (u) prev.append(h('button', { class: 'btn-sm alt', type: 'button', id: 'bk-f-rmcover', onclick: ev => { removeCover = true; prev.replaceChildren(h('p', { class: 'hint' }, 'Banner akan dihapus saat disimpan.')); } }, 'Hapus banner'));
    }
    sync();
    if (e0) fill(e0);
    const save = h('button', { class: 'btn-primary', type: 'submit', id: 'bk-f-save' }, e0 ? 'Simpan perubahan' : 'Tambah buku');
    let busy = false;
    const form = h('form', { class: 'panel rform', id: 'bk-form', novalidate: 'novalidate' },
      h('h3', {}, e0 ? 'Ubah: ' + e0.title : 'Tambah buku'),
      lab('Nama buku *', 'bk-f-title'), title, B.authorSupported() ? lab('Penulis (opsional)', 'bk-f-author') : '', B.authorSupported() ? authorIn : h('p', { class: 'hint', id: 'bk-f-noauthor' }, 'Kolom penulis belum aktif di server. Jalankan buku_penulis.sql bila ingin menampilkan nama penulis.'), lab('Deskripsi *', 'bk-f-desc'), rt.box,
      B.infoSupported() ? h('div', { class: 'grid2' }, h('div', {}, lab('Penerbit (opsional)', 'bk-f-pub'), pubIn), h('div', {}, lab('Kategori (opsional)', 'bk-f-cat'), catIn)) : '',
      B.infoSupported() ? h('div', { class: 'grid2' }, h('div', {}, lab('Tahun terbit (opsional)', 'bk-f-year'), yearIn), h('div', {}, lab('Jumlah halaman (opsional)', 'bk-f-pages'), pagesIn)) : h('p', { class: 'hint bk-fnote bk-fnote-w', id: 'bk-f-noinfo' }, 'Kolom penerbit, kategori, tahun, halaman, dan cara "Baca langsung di aplikasi" belum aktif di server. Jalankan buku_baca.sql.'),
      lab('Jenis buku *', 'bk-f-kind'), kind,
      lab('Akses buku *', 'bk-f-access'), accessSel, h('p', { class: 'hint' }, 'Gratis: dibaca semua jamaah. Premium: hanya anggota membership aktif (dijaga di server).'),
      lab('Cara pembacaan / pemesanan *', 'bk-f-otype'), otype, readNote, fisikNote,
      priceBox, orderBox,
      h('label', { class: 'hint bk-lab', for: 'bk-f-pdf' }, 'Berkas buku PDF (wajib untuk buku digital, maks. 50 MB)'), pdf, pdfPrev,
      h('label', { class: 'qa-check' }, active, ' Tampilkan di pustaka (hilangkan centang untuk menyembunyikan)'),
      h('label', { class: 'hint bk-lab', for: 'bk-f-file' }, 'Banner buku (opsional)'), file, prev, fstat, err,
      h('div', { class: 'mt row-btns' }, save, e0 ? h('button', { class: 'btn-sm ghost', type: 'button', id: 'bk-f-cancel', onclick: reload }, 'Batal ubah') : ''));
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); if (busy) return;
      const v = B.validate({ info: B.infoSupported() ? { publisher: pubIn.value, category: catIn.value, year: yearIn.value, pages: pagesIn.value } : undefined, author: B.authorSupported() ? authorIn.value : undefined, title: title.value, description: rt.get(), kind: kind.value, price: price.value, orderType: otype.value, orderTarget: target.value, orderLabel: label.value, active: active.checked, access: accessSel.value });
      if (v.error) { err.textContent = v.error; ({ title, description: desc, kind, price, target, orderType: otype, label, author: authorIn, publisher: pubIn, category: catIn, year: yearIn, pages: pagesIn })[v.field].focus(); return; }
      const pf = pdf.files && pdf.files[0];
      if (kind.value === 'digital' && !pf && !(e0 && e0.file_path && !removePdf)) { err.textContent = 'Buku digital wajib punya berkas PDF agar bisa dibaca di aplikasi.'; pdf.focus(); return; }
      if (pf && (pf.type !== 'application/pdf' || pf.size > B.FILE_MAX)) { err.textContent = 'Berkas buku harus PDF dan maksimal 50 MB.'; pdf.focus(); return; }
      err.textContent = ''; busy = true; save.disabled = true;
      let uploaded = null, uploadedPdf = null;
      try {
        let img = null;
        const f = file.files && file.files[0];
        if (f) { fstat.textContent = 'Memproses banner…'; img = await prepareSquarePhoto(f); }
        if (img) { uploaded = B.newCoverPath(); fstat.textContent = 'Mengunggah banner…'; await storageUpload(uploaded, img.blob, B.BUCKET); }
        if (pf) { uploadedPdf = B.newFilePath(); fstat.textContent = 'Mengunggah berkas buku…'; await storageUpload(uploadedPdf, pf, B.FILE_BUCKET); }
        if (e0) {
          const patch = { ...v.ok }; if (uploadedPdf) patch.file_path = uploadedPdf; else if (removePdf) patch.file_path = null; if (uploaded) patch.cover_path = uploaded; else if (removeCover) patch.cover_path = null;
          await B.updateBook(e0.id, patch);
          if ((uploaded || removeCover) && e0.cover_path) storageRemove(e0.cover_path, B.BUCKET).catch(() => {});
          if ((uploadedPdf || removePdf) && e0.file_path) storageRemove(e0.file_path, B.FILE_BUCKET).catch(() => {});
          toast('Perubahan disimpan.');
        } else { await B.createBook(v.ok, uploaded, uploadedPdf); toast('Buku ditambahkan.'); }
        uploaded = null; uploadedPdf = null; await reload(); return;
      } catch (e) {
        if (uploaded) storageRemove(uploaded, B.BUCKET).catch(() => {});
        if (uploadedPdf) storageRemove(uploadedPdf, B.FILE_BUCKET).catch(() => {});
        if (e && e.status === 401) return;
        const msg = e && PRODUCT_ERRORS[e.code] ? PRODUCT_ERRORS[e.code] : B.saveError(e);
        err.textContent = msg; fstat.textContent = 'Banner kotak 1080 × 1080, maksimal 100 KB.';
      }
      busy = false; save.disabled = false;
    });
    const row = b => h('div', { class: 'panel bk-mrow', 'data-id': b.id, 'data-active': String(!!b.active) },
      h('span', { class: 'bk-mt' }, thumb(b, 'bk-l-img'), h('span', {}, h('b', { class: 'bk-title' }, b.title), h('span', { class: 'muted bk-sd' }, B.priceText(b.price) + ' · ' + B.kindLabel(b.kind) + ' · ' + B.accessLabel(b.access) + (b.file_path ? ' · ada PDF' : '') + (b.active ? '' : ' · disembunyikan')))),
      h('div', { class: 'qa-acts' },
        h('button', { class: 'btn-sm ghost bk-edit', type: 'button', onclick: () => { showManage(b); window.scrollTo(0, 0); } }, 'Ubah'),
        h('button', { class: 'btn-sm ghost bk-toggle', type: 'button', onclick: async () => { try { await B.updateBook(b.id, { active: !b.active }); toast(b.active ? 'Disembunyikan.' : 'Ditampilkan.'); reload(); } catch (e) { toast(B.saveError(e), true); } } }, b.active ? 'Sembunyikan' : 'Tampilkan'),
        h('button', { class: 'btn-sm alt bk-del', type: 'button', onclick: async () => {
          if (!(await ask({ title: 'Hapus buku ini?', text: '“' + b.title + '” dihapus permanen beserta bannernya. Untuk sementara, gunakan Sembunyikan.' }))) return;
          try { await B.deleteBook(b.id); if (b.cover_path) storageRemove(b.cover_path, B.BUCKET).catch(() => {}); toast('Buku dihapus.'); reload(); } catch (e) { toast(B.saveError(e), true); }
        } }, 'Hapus')));
    draw(back('← Pustaka', async () => { await load(); drawList(); }), h('h2', { class: 'wtitle' }, 'Kelola Pustaka Buku'),
      h('p', { class: 'muted' }, 'Hanya Super Admin yang bisa menambah, mengubah, menyembunyikan, dan menghapus buku. Admin masjid, pengurus, dan jamaah hanya melihat dan memesan.'),
      h('div', { class: 'panel bk-mem', id: 'bk-memadmin' }, h('span', {}, h('b', {}, 'Membership'), h('span', { class: 'muted bk-sd' }, 'Verifikasi pembayaran, komisi masjid, rekening, QRIS, dan harga paket.')),
        h('button', { class: 'btn-sm', type: 'button', id: 'bk-memopen', onclick: () => membershipAdminPage({ draw, exit: () => showManage() }) }, 'Buka')),
      form, h('h3', {}, 'Semua buku (' + all.length + ')'), all.length ? h('div', { id: 'bk-managed' }, ...all.map(row)) : empty('Belum ada buku. Tambahkan lewat formulir di atas.'),
      h('p', { class: 'hint' }, 'Nomor WhatsApp dan link checkout tidak ditampilkan sebagai teks; pembeli hanya melihat tombol Pesan. Namun begitu tombol ditekan, tujuan (WhatsApp atau halaman toko) terbuka dan tampak di peramban pembeli, jadi gunakan nomor dan link khusus penjualan.'));
  }

  // Mulai
  const sess = getSession();
  if (sess && sess.user) loadAccess(sess.user).then(a => { if (a && a.isAdmin) { st.isAdmin = true; if (wrap.querySelector('#bk-items')) drawList(); } }).catch(() => {});
  refreshMember().then(() => { if (wrap.querySelector('#bk-items')) drawList(); });
  showList();
  return wrap;
}
