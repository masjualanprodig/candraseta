// BAITUNA - book-reader.js
// Pembaca PDF di dalam aplikasi (Pustaka Buku). Memakai pdf.js (Mozilla, lisensi Apache 2.0) yang disimpan di folder pdfjs/,
// dimuat hanya saat pembaca dibuka. Isi PDF diambil sebagai data di memori lalu digambar ke kanvas:
// tidak ada tombol unduh/cetak dan berkas tidak disimpan sebagai unduhan. (Orang yang sangat niat tetap bisa memotret layar.)
// Fitur: halaman per halaman (geser kiri/kanan), penggeser halaman, daftar isi (bila PDF punya), thumbnail, kecerahan & mode baca,
// pembesaran, cari teks, penanda halaman, dan ingat halaman terakhir (disimpan di perangkat).
import { h, toast } from './ui.js';
import { icon, ICONS } from './feed-ui.js';

const KEY = 'baituna.reader.v1';
const IC = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  mark: '<path d="M7 4h10v16l-5-3.5L7 20V4z"/>',
  more: '<path d="M12 5h.01M12 12h.01M12 19h.01"/>',
  toc: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  thumbs: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M5.2 18.8l1.4-1.4M17.4 6.6l1.4-1.4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  prev: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>'
};
export const MODES = [{ key: 'terang', label: 'Terang' }, { key: 'sepia', label: 'Sepia' }, { key: 'gelap', label: 'Gelap' }];
export const ZOOMS = [{ key: 1, label: 'Pas lebar' }, { key: 1.25, label: '125%' }, { key: 1.5, label: '150%' }, { key: 2, label: '200%' }];

/* ===== Pengaturan per buku (di perangkat) ===== */
export function loadPrefs(id) {
  let all = {}; try { all = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { all = {}; }
  const p = all[id] || {}, g = all._ || {};
  return {
    page: Number.isInteger(p.page) && p.page > 0 ? p.page : 1,
    marks: Array.isArray(p.marks) ? p.marks.filter(n => Number.isInteger(n) && n > 0).slice(0, 200) : [],
    bright: Number(g.bright) >= 40 && Number(g.bright) <= 100 ? Number(g.bright) : 100,
    mode: MODES.some(m => m.key === g.mode) ? g.mode : 'terang',
    zoom: ZOOMS.some(z => z.key === Number(g.zoom)) ? Number(g.zoom) : 1
  };
}
export function savePrefs(id, p) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
    all[id] = { page: p.page, marks: p.marks.slice(0, 200), t: Date.now() };
    all._ = { bright: p.bright, mode: p.mode, zoom: p.zoom };
    // simpan maksimal 50 buku terakhir
    const ids = Object.keys(all).filter(k => k !== '_').sort((a, b) => (all[b].t || 0) - (all[a].t || 0));
    ids.slice(50).forEach(k => delete all[k]);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch (e) { /* abaikan */ }
}
export const modeFilter = (mode, bright) => {
  const b = 'brightness(' + (Math.max(40, Math.min(100, bright)) / 100) + ')';
  return mode === 'gelap' ? 'invert(0.92) hue-rotate(180deg) ' + b : mode === 'sepia' ? 'sepia(0.55) ' + b : b;
};
// Ringkasan teks di sekitar kata yang dicari.
export function snippet(text, q, pad = 40) {
  const t = String(text || '').replace(/\s+/g, ' '), i = t.toLowerCase().indexOf(String(q || '').toLowerCase());
  if (i < 0) return '';
  const a = Math.max(0, i - pad), b = Math.min(t.length, i + q.length + pad);
  return (a > 0 ? '…' : '') + t.slice(a, b).trim() + (b < t.length ? '…' : '');
}

let libP = null;
function loadLib() {
  if (!libP) libP = import('./pdfjs/pdf.min.js').then(lib => { lib.GlobalWorkerOptions.workerSrc = new URL('./pdfjs/pdf.worker.min.js', import.meta.url).href; return lib; })
    .catch(e => { libP = null; throw e; });
  return libP;
}

/* ===== Pembaca =====
   openReader({ id, title, load: () => Promise<ArrayBuffer> }) */
export function openReader({ id, title, load }) {
  const pref = loadPrefs(id);
  let doc = null, total = 0, page = pref.page, task = null, closed = false, textCache = new Map(), thumbObs = null;
  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';

  const ib = (ic, label, fn, extra = {}) => h('button', { class: 'rd-ib', type: 'button', 'aria-label': label, title: label, onclick: fn, ...extra }, icon(ic));
  const backBtn = ib(IC.back, 'Tutup pembaca', () => close(), { id: 'rd-back', 'data-overlay-back': '1' });
  const markBtn = ib(IC.mark, 'Tandai halaman ini', () => toggleMark(), { id: 'rd-mark', 'aria-pressed': 'false' });
  const top = h('div', { class: 'rd-top' }, backBtn, h('b', { class: 'rd-title', id: 'rd-title' }, title || 'Buku'),
    ib(IC.search, 'Cari di buku', () => openSearch(), { id: 'rd-search' }), markBtn, ib(IC.more, 'Lainnya', () => openMore(), { id: 'rd-more' }));
  const canvas = h('canvas', { class: 'rd-canvas', id: 'rd-canvas', 'aria-label': 'Halaman buku' });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  const pageBox = h('div', { class: 'rd-page' }, canvas);
  const stage = h('div', { class: 'rd-stage', id: 'rd-stage' }, pageBox);
  const status = h('div', { class: 'rd-status', id: 'rd-status', role: 'status' }, 'Membuka buku…');
  const prevBtn = ib(IC.prev, 'Halaman sebelumnya', () => go(page - 1), { id: 'rd-prev', class: 'rd-ib rd-nav rd-navl' });
  const nextBtn = ib(IC.next, 'Halaman berikutnya', () => go(page + 1), { id: 'rd-next', class: 'rd-ib rd-nav rd-navr' });
  const slider = h('input', { type: 'range', class: 'rd-slider', id: 'rd-slider', min: '1', max: '1', value: '1', 'aria-label': 'Pilih halaman' });
  const pnum = h('span', { class: 'rd-pnum', id: 'rd-pnum' }, '– / –');
  slider.addEventListener('input', () => { pnum.textContent = slider.value + ' / ' + total; });
  slider.addEventListener('change', () => go(Number(slider.value)));
  const tool = (ic, label, fn, idv) => h('button', { class: 'rd-tool', type: 'button', id: idv, onclick: fn }, icon(ic), h('span', {}, label));
  const bottom = h('div', { class: 'rd-bottom' },
    h('div', { class: 'rd-sl' }, slider, pnum),
    h('div', { class: 'rd-tools' }, tool(IC.toc, 'Daftar Isi', () => openToc(), 'rd-toc'), tool(IC.thumbs, 'Thumbnail', () => openThumbs(), 'rd-thumbs'),
      tool(IC.sun, 'Kecerahan', () => openBright(), 'rd-bright'), tool(IC.gear, 'Pengaturan', () => openSettings(), 'rd-settings')));
  const sheetBox = h('div', { class: 'rd-sheetbox', id: 'rd-sheetbox' });
  const root = h('div', { class: 'rd', id: 'rd', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Pembaca buku ' + (title || '') }, top, stage, prevBtn, nextBtn, status, bottom, sheetBox);
  document.body.append(root);
  applyLook();

  /* ----- gestur geser ----- */
  let sx = 0, sy = 0, st0 = 0, lastTap = 0;
  stage.addEventListener('touchstart', e => { if (e.touches.length !== 1) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; st0 = Date.now(); }, { passive: true });
  stage.addEventListener('touchend', e => {
    const t = e.changedTouches[0]; if (!t) return;
    const dx = t.clientX - sx, dy = t.clientY - sy, dt = Date.now() - st0;
    if (pref.zoom === 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 800) { go(page + (dx < 0 ? 1 : -1)); return; }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 300) {
      const now = Date.now();
      if (now - lastTap < 320) { setZoom(pref.zoom === 1 ? 2 : 1); lastTap = 0; } else lastTap = now;
    }
  }, { passive: true });
  const onKey = e => {
    if (e.key === 'ArrowRight') go(page + 1); else if (e.key === 'ArrowLeft') go(page - 1);
    else if (e.key === 'Escape') { if (sheetBox.firstChild) closeSheet(); else close(); }
  };
  document.addEventListener('keydown', onKey);
  const onResize = () => { if (doc) render(); };
  addEventListener('resize', onResize);

  /* ----- muat ----- */
  let stage0 = 'pustaka';
  (async () => {
    try {
      stage0 = 'pustaka';
      const [lib, data] = await Promise.all([loadLib().catch(e => { stage0 = 'pustaka'; throw e; }), (async () => { try { return await load(); } catch (e) { stage0 = 'berkas'; throw e; } })()]);
      if (closed) return;
      status.textContent = 'Menyiapkan halaman…';
      stage0 = 'baca-pdf';
      doc = await lib.getDocument({ data: new Uint8Array(data), isEvalSupported: false, enableXfa: false, stopAtErrors: false }).promise;
      if (closed) { doc.destroy(); return; }
      total = doc.numPages; page = Math.min(Math.max(1, page), total);
      slider.max = String(total); root.setAttribute('data-pages', String(total));
      if (pref.page > 1 && pref.page <= total) toast('Melanjutkan dari halaman ' + pref.page + '.');
      stage0 = 'tampil';
      await render();
    } catch (e) {
      if (closed) return;
      const msg = e && e.status === 0 ? 'Tidak ada koneksi internet.' : e && (e.status === 401 || e.status === 403) ? 'Anda belum berhak membaca buku ini.' : e && e.status === 404 ? 'Berkas buku tidak ditemukan.' : e && e.status === 415 ? 'Berkas buku bukan PDF yang sah.' : e && e.name === 'PasswordException' ? 'PDF ini dikunci password dan tidak bisa dibuka.' : 'Buku belum bisa dibuka. Coba lagi. (kode: ' + stage0 + (e && (e.name || e.message) ? ' – ' + String(e.name && e.name !== 'Error' ? e.name : e.message).slice(0, 60) : '') + ')';
      status.replaceChildren(h('span', { id: 'rd-err' }, msg), h('button', { class: 'btn-sm', type: 'button', id: 'rd-close2', onclick: () => close() }, 'Tutup'));
      status.classList.add('rd-errbox');
    }
  })();

  async function render() {
    if (!doc || closed) return;
    const n = page;
    status.textContent = ''; status.classList.remove('rd-errbox');
    slider.value = String(n); pnum.textContent = n + ' / ' + total;
    prevBtn.disabled = n <= 1; nextBtn.disabled = n >= total;
    markBtn.setAttribute('aria-pressed', String(pref.marks.includes(n))); markBtn.classList.toggle('on', pref.marks.includes(n));
    root.setAttribute('data-page', String(n));
    let pg;
    try { pg = await doc.getPage(n); } catch (e) { status.textContent = 'Halaman ini belum bisa ditampilkan.'; return; }
    if (closed || n !== page) return;
    const base = pg.getViewport({ scale: 1 });
    const availW = Math.max(200, stage.clientWidth - 16), availH = Math.max(200, stage.clientHeight - 16);
    const fit = Math.min(availW / base.width, (pref.zoom === 1 ? availH : Infinity) / base.height);
    const cssScale = fit * pref.zoom;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    let scale = cssScale * dpr;
    const maxPx = 16e6; // batas memori kanvas
    if (base.width * base.height * scale * scale > maxPx) scale = Math.sqrt(maxPx / (base.width * base.height));
    const vp = pg.getViewport({ scale });
    if (task) { try { task.cancel(); } catch (e) { /* abaikan */ } }
    const off = document.createElement('canvas'); off.width = Math.floor(vp.width); off.height = Math.floor(vp.height);
    task = pg.render({ canvasContext: off.getContext('2d', { alpha: false }), viewport: vp, background: '#ffffff' });
    try { await task.promise; } catch (e) { return; }
    if (closed || n !== page) return;
    canvas.width = off.width; canvas.height = off.height;
    canvas.getContext('2d').drawImage(off, 0, 0);
    canvas.style.width = Math.floor(base.width * cssScale) + 'px'; canvas.style.height = Math.floor(base.height * cssScale) + 'px';
    pageBox.classList.toggle('rd-zoomed', pref.zoom > 1);
    pref.page = n; savePrefs(id, pref);
  }
  function go(n) {
    if (!doc) return;
    n = Math.min(Math.max(1, Math.round(n)), total);
    if (n === page) { slider.value = String(n); pnum.textContent = n + ' / ' + total; return; }
    page = n; stage.scrollTo(0, 0); render();
  }
  function setZoom(z) { pref.zoom = z; savePrefs(id, pref); render(); }
  function applyLook() { canvas.style.filter = modeFilter(pref.mode, pref.bright); root.setAttribute('data-mode', pref.mode); }
  function toggleMark() {
    if (!doc) return;
    const i = pref.marks.indexOf(page);
    if (i >= 0) pref.marks.splice(i, 1); else pref.marks.push(page);
    pref.marks.sort((a, b) => a - b); savePrefs(id, pref);
    markBtn.setAttribute('aria-pressed', String(i < 0)); markBtn.classList.toggle('on', i < 0);
    toast(i < 0 ? 'Halaman ' + page + ' ditandai.' : 'Tanda halaman ' + page + ' dihapus.');
  }

  /* ----- lembar bawah (sheet) ----- */
  function sheet(titleText, idv, ...kids) {
    closeSheet();
    const s = h('div', { class: 'rd-sheet', id: idv, role: 'dialog', 'aria-label': titleText },
      h('div', { class: 'rd-sh' }, h('b', {}, titleText), h('button', { class: 'rd-ib', type: 'button', id: 'rd-sheetclose', 'aria-label': 'Tutup', onclick: closeSheet }, icon(IC.close))), ...kids);
    sheetBox.replaceChildren(h('div', { class: 'rd-scrim', onclick: closeSheet }), s);
    return s;
  }
  function closeSheet() { if (thumbObs) { thumbObs.disconnect(); thumbObs = null; } sheetBox.replaceChildren(); }
  const needDoc = () => { if (!doc) { toast('Buku masih dimuat.'); return false; } return true; };

  async function openToc() {
    if (!needDoc()) return;
    const body = h('div', { class: 'rd-list', id: 'rd-toclist' }, h('p', { class: 'muted' }, 'Memuat daftar isi…'));
    sheet('Daftar Isi', 'rd-sheet-toc', body);
    let outline = null; try { outline = await doc.getOutline(); } catch (e) { outline = null; }
    const rows = [];
    const walk = async (items, depth) => {
      for (const it of items || []) {
        if (rows.length >= 300) return;
        let n = null;
        try {
          let dest = it.dest; if (typeof dest === 'string') dest = await doc.getDestination(dest);
          if (Array.isArray(dest) && dest[0]) n = typeof dest[0] === 'number' ? dest[0] + 1 : (await doc.getPageIndex(dest[0])) + 1;
        } catch (e) { n = null; }
        const row = h('button', { class: 'rd-row', type: 'button', style: 'padding-left:' + (0.8 + depth * 0.9) + 'rem', onclick: () => { if (n) { closeSheet(); go(n); } } },
          h('span', {}, String(it.title || '').trim() || '(tanpa judul)'), h('span', { class: 'muted' }, n ? String(n) : ''));
        if (!n) row.disabled = true;
        rows.push(row);
        if (it.items && it.items.length && depth < 3) await walk(it.items, depth + 1);
      }
    };
    await walk(outline, 0);
    const marks = pref.marks.length ? [h('h4', { class: 'rd-h4' }, 'Penanda'), ...pref.marks.map(n => h('button', { class: 'rd-row', type: 'button', onclick: () => { closeSheet(); go(n); } }, h('span', {}, 'Halaman ' + n), h('span', { class: 'muted' }, '›')))] : [];
    body.replaceChildren(...(rows.length ? rows : [h('p', { class: 'muted', id: 'rd-notoc' }, 'Buku ini tidak memiliki daftar isi. Gunakan Thumbnail atau penggeser halaman.')]), ...marks);
  }

  function openThumbs() {
    if (!needDoc()) return;
    const grid = h('div', { class: 'rd-tgrid', id: 'rd-tgrid' });
    sheet('Thumbnail', 'rd-sheet-thumbs', grid);
    const queue = []; let busy = 0;
    const pump = () => {
      while (busy < 2 && queue.length) {
        const [n, cv] = queue.shift(); busy++;
        doc.getPage(n).then(pg => { const vp0 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: 150 / vp0.width }); cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height); return pg.render({ canvasContext: cv.getContext('2d'), viewport: vp, background: '#ffffff' }).promise; })
          .catch(() => {}).finally(() => { busy--; pump(); });
      }
    };
    thumbObs = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting && !en.target.dataset.done) { en.target.dataset.done = '1'; queue.push([Number(en.target.dataset.n), en.target.querySelector('canvas')]); pump(); }
    }), { root: grid, rootMargin: '200px' }) : null;
    for (let n = 1; n <= total; n++) {
      const cell = h('button', { class: 'rd-tc' + (n === page ? ' on' : ''), type: 'button', 'data-n': String(n), 'aria-label': 'Halaman ' + n, onclick: () => { closeSheet(); go(n); } }, h('canvas', {}), h('span', {}, String(n)));
      grid.append(cell);
      if (thumbObs) thumbObs.observe(cell); else if (n <= 30) { cell.dataset.done = '1'; queue.push([n, cell.querySelector('canvas')]); }
    }
    pump();
    const cur = grid.querySelector('.rd-tc.on'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'center' });
  }

  function openBright() {
    const r = h('input', { type: 'range', min: '40', max: '100', value: String(pref.bright), id: 'rd-brange', 'aria-label': 'Kecerahan' });
    r.addEventListener('input', () => { pref.bright = Number(r.value); applyLook(); savePrefs(id, pref); });
    const modes = h('div', { class: 'rd-seg', id: 'rd-modes', role: 'group', 'aria-label': 'Mode baca' }, ...MODES.map(m =>
      h('button', { class: 'rd-segb' + (pref.mode === m.key ? ' on' : ''), type: 'button', 'data-mode': m.key, 'aria-pressed': String(pref.mode === m.key), onclick: ev => {
        pref.mode = m.key; applyLook(); savePrefs(id, pref);
        modes.querySelectorAll('.rd-segb').forEach(b => { const on = b.dataset.mode === m.key; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      } }, m.label)));
    sheet('Kecerahan', 'rd-sheet-bright', h('label', { class: 'rd-lab', for: 'rd-brange' }, 'Kecerahan halaman'), r, h('p', { class: 'rd-lab' }, 'Mode baca'), modes);
  }

  function openSettings() {
    const zooms = h('div', { class: 'rd-seg', id: 'rd-zooms', role: 'group', 'aria-label': 'Ukuran halaman' }, ...ZOOMS.map(z =>
      h('button', { class: 'rd-segb' + (pref.zoom === z.key ? ' on' : ''), type: 'button', 'data-zoom': String(z.key), 'aria-pressed': String(pref.zoom === z.key), onclick: () => {
        setZoom(z.key); zooms.querySelectorAll('.rd-segb').forEach(b => { const on = Number(b.dataset.zoom) === z.key; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      } }, z.label)));
    const goIn = h('input', { class: 'in', id: 'rd-goto', type: 'number', inputmode: 'numeric', min: '1', max: String(total || 1), placeholder: 'No. halaman' });
    const goForm = h('form', { class: 'rd-goform', onsubmit: ev => { ev.preventDefault(); const n = Number(goIn.value); if (n >= 1 && n <= total) { closeSheet(); go(n); } else toast('Halaman 1 sampai ' + total + '.', true); } },
      goIn, h('button', { class: 'btn-sm', type: 'submit' }, 'Buka'));
    sheet('Pengaturan', 'rd-sheet-settings', h('p', { class: 'rd-lab' }, 'Ukuran halaman (bisa juga ketuk dua kali pada halaman)'), zooms,
      h('p', { class: 'rd-lab' }, 'Ke halaman'), goForm,
      h('p', { class: 'hint' }, 'Halaman terakhir dan penanda disimpan di perangkat ini saja. Buku dibaca di dalam aplikasi; tidak ada tombol unduh.'));
  }

  function openMore() {
    sheet('Lainnya', 'rd-sheet-more',
      h('button', { class: 'rd-row', type: 'button', id: 'rd-m-toc', onclick: () => openToc() }, h('span', {}, 'Daftar isi & penanda'), h('span', { class: 'muted' }, '›')),
      h('button', { class: 'rd-row', type: 'button', id: 'rd-m-first', onclick: () => { closeSheet(); go(1); } }, h('span', {}, 'Ke halaman pertama'), h('span', { class: 'muted' }, '›')),
      h('button', { class: 'rd-row', type: 'button', id: 'rd-m-close', onclick: () => close() }, h('span', {}, 'Tutup pembaca'), h('span', { class: 'muted' }, '›')));
  }

  async function pageText(n) {
    if (textCache.has(n)) return textCache.get(n);
    let t = '';
    try { const pg = await doc.getPage(n); const tc = await pg.getTextContent(); t = tc.items.map(i => i.str || '').join(' '); } catch (e) { t = ''; }
    textCache.set(n, t); return t;
  }
  function openSearch() {
    if (!needDoc()) return;
    const q = h('input', { class: 'in', id: 'rd-q', type: 'search', maxlength: '60', placeholder: 'Cari kata di buku ini…', autocomplete: 'off' });
    const out = h('div', { class: 'rd-list', id: 'rd-results', 'aria-live': 'polite' });
    let token = 0;
    const form = h('form', { class: 'rd-goform', onsubmit: async ev => {
      ev.preventDefault();
      const s = q.value.replace(/\s+/g, ' ').trim(); if (s.length < 2) { out.replaceChildren(h('p', { class: 'muted' }, 'Ketik minimal 2 huruf.')); return; }
      const my = ++token, found = [];
      out.replaceChildren(h('p', { class: 'muted', id: 'rd-searching' }, 'Mencari…'));
      for (let n = 1; n <= total && my === token && !closed; n++) {
        const t = await pageText(n);
        if (t.toLowerCase().includes(s.toLowerCase())) found.push([n, snippet(t, s)]);
        if (found.length >= 100) break;
        if (n % 20 === 0) { const p = out.querySelector('#rd-searching'); if (p) p.textContent = 'Mencari… halaman ' + n + ' / ' + total; }
      }
      if (my !== token) return;
      out.replaceChildren(...(found.length ? [h('p', { class: 'muted', id: 'rd-found' }, found.length + (found.length >= 100 ? '+' : '') + ' hasil')].concat(found.map(([n, sn]) =>
        h('button', { class: 'rd-row rd-res', type: 'button', onclick: () => { closeSheet(); go(n); } }, h('span', {}, sn || ('Halaman ' + n)), h('span', { class: 'muted' }, 'hlm ' + n))))
        : [h('p', { class: 'muted', id: 'rd-nofound' }, 'Tidak ditemukan. Catatan: PDF hasil pindaian (gambar) tidak bisa dicari.')]));
    } }, q, h('button', { class: 'btn-sm', type: 'submit', id: 'rd-qgo' }, 'Cari'));
    sheet('Cari di buku', 'rd-sheet-search', form, out);
    setTimeout(() => q.focus(), 50);
  }

  function close() {
    if (closed) return; closed = true;
    try { if (task) task.cancel(); } catch (e) { /* abaikan */ }
    if (thumbObs) thumbObs.disconnect();
    if (doc) { try { doc.destroy(); } catch (e) { /* abaikan */ } }
    document.removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
    root.remove(); document.documentElement.style.overflow = prevOverflow;
  }
  return { close, root, go: n => go(n), get page() { return page; }, get total() { return total; } };
}
