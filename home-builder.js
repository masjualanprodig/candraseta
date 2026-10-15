// BAITUNA - home-builder.js (v92)
// Menyusun beranda dari daftar blok (lihat home-layout-service.js). Tanpa susunan tersimpan => beranda bawaan.
import { h } from './ui.js';
import { bannerCarousel, quickGrid, go, sectionHead } from './home-ui.js';
import { CATALOG } from './quick-catalog.js';
import { LINKS, defaultBlocks, cleanBlocks, fetchLayout, builtinLabel, defaultsOf, kindOf, cleanOverride } from './home-layout-service.js';
import { promoBanner } from './home-ui.js';
import { urlFor } from './branding-service.js';

let seq = 0;

// ---- Ubahan bagian bawaan: dipasang langsung pada simpul yang sudah jadi ----
function setTitle(node, title) {
  const hd = node && node.querySelector && (node.matches('h2, h3') ? node : node.querySelector('.sh h2, h2, h3'));
  if (!hd || !title) return;
  [...hd.childNodes].filter(n => n.nodeType === 3).forEach(n => n.remove());
  hd.append(title);
}
const setImg = (el, url) => { if (el && url) el.style.setProperty('--art-x', 'url("' + url + '")'); };
function rebind(btn, link, preview) {
  if (!btn || !LINKS[link]) return btn;
  const c = btn.cloneNode(true); btn.replaceWith(c);
  c.addEventListener('click', () => { if (!preview) go(LINKS[link][2]); });
  return c;
}
export function applyOverride(role, id, node, o, { preview = false } = {}) {
  if (!node || !o) return node;
  const kind = kindOf(role, id);
  if (kind === 'title') { setTitle(node, o.title); return node; }
  if (kind === 'grid') {
    setTitle(node, o.title);
    if (o.items) {
      const grid = node.querySelector('.qk-grid'); if (!grid) return node;
      const byId = {}; [...grid.children].forEach(c => { byId[c.id] = c; });
      grid.replaceChildren(...o.items.map(k => byId[k]).filter(Boolean));
    }
    return node;
  }
  if (kind === 'promo') {
    setTitle(node.querySelector('.pb-txt') || node, o.title);
    if (o.text) { const p = node.querySelector('.pb-txt p'); if (p) p.textContent = o.text; }
    if (o.cta) { const b = node.querySelector('.bn-cta'); if (b) { const ic = b.querySelector('svg'); [...b.childNodes].filter(n => n.nodeType === 3).forEach(n => n.remove()); b.prepend(o.cta); if (!ic) b.append(''); } }
    if (o.link) rebind(node.querySelector('.bn-cta'), o.link, preview);
    if (o.img) setImg(node, urlFor(o.img) || o._url);
    return node;
  }
  if (kind === 'slides' && o.slides) {
    const slides = [...node.querySelectorAll('.bn-slide')];
    slides.forEach((el, k) => {
      const r = o.slides[k]; if (!r) return;
      if (r.hide) { el.remove(); return; }
      if (r.title) el.querySelector('h2').textContent = r.title;
      if (r.text) { let p = el.querySelector('.bn-txt p'); if (!p) { p = h('p', {}); el.querySelector('h2').after(p); } p.textContent = r.text; }
      if (r.cta) { const b = el.querySelector('.bn-cta'); if (b) { [...b.childNodes].filter(n => n.nodeType === 3).forEach(n => n.remove()); b.prepend(r.cta); } }
      if (r.link) rebind(el.querySelector('.bn-cta'), r.link, preview);
      if (r.tone) { el.classList.remove('green', 'gold'); el.classList.add(r.tone); }
      if (r.img || r._url) setImg(el, r._url || urlFor(r.img));
    });
    const left = node.querySelectorAll('.bn-slide');
    if (!left.length) return null;
    left.forEach((el, i) => { el.dataset.i = String(i); el.setAttribute('aria-label', (i + 1) + ' dari ' + left.length); });
    const dots = node.querySelector('.bn-dots'); if (dots) { if (left.length < 2) dots.remove(); else dots.replaceChildren(...[...left].map((_, i) => h('i', { class: i === 0 ? 'on' : '' }))); }
  }
  return node;
}

// Bagian bawaan versi contoh (untuk pratinjau): memakai teks bawaan; bagian berisi data nyata tampil sebagai kerangka berjudul.
export function mockBuiltin(role, id) {
  const d = defaultsOf(role, id), kind = kindOf(role, id);
  if (kind === 'slides') return bannerCarousel(d.slides.map(s => ({ art: s.art, kicker: s.kicker, title: s.title, text: s.text, tone: s.tone, cta: s.cta, onclick: () => {} })), { id: 'mk' + (++seq) });
  if (kind === 'promo') return promoBanner({ id: 'mk' + (++seq), art: d.art, title: d.title, text: d.text, cta: d.cta, onclick: () => {} });
  if (kind === 'grid') return quickGrid(d.title, d.items.map(([iid, label, key]) => ({ key, label, id: iid, onclick: () => {} })), { id: 'mk' + (++seq) });
  return h('section', { class: 'hb-mock' }, sectionHead(d.title || builtinLabel(role, id)), h('small', { class: 'muted' }, 'Isi diambil dari data nyata saat beranda tampil.'));
}
function slideNode(s, preview) {
  const link = LINKS[s.link];
  const img = s._url || (s.img && urlFor(s.img));
  return { art: 'custom', img: img || '', title: s.title, text: s.text, tone: s.tone, cta: link && s.cta ? s.cta : '', onclick: () => { if (!preview && link) go(link[2]); } };
}

// Pratinjau memakai ubahan apa adanya (termasuk gambar yang baru dipilih dan belum diunggah).
function cleanOverrideForPreview(role, b) {
  const o = b.o; if (!o) return null;
  const c = cleanOverride(role, b.id, JSON.parse(JSON.stringify(o, (k, v) => (k === '_file' || k === '_url') ? undefined : v))) || {};
  if (o._url) c._url = o._url;
  (o.slides || []).forEach((x, k) => { if (x && x._url) { c.slides = c.slides || (defaultsOf(role, b.id).slides || []).map(() => ({})); c.slides[k] = { ...(c.slides[k] || {}), _url: x._url }; } });
  return c;
}

// builtins: { id: Node | '' } (bagian bawaan yang sudah dibuat oleh beranda peran itu).
// preview: tampilkan penanda untuk bagian bawaan dan matikan tautan.
export function layoutNodes(role, saved, builtins, { preview = false } = {}) {
  const blocks = preview ? (saved || []) : (cleanBlocks(role, saved) || defaultBlocks(role));
  const used = new Set(), out = [];
  for (const b of blocks) {
    if (b.t === 'b') {
      if (used.has(b.id)) continue; used.add(b.id);
      const base = preview ? mockBuiltin(role, b.id) : builtins[b.id];
      if (!base) continue;
      const o = preview ? cleanOverrideForPreview(role, b) : b.o;
      const n = applyOverride(role, b.id, base, o, { preview });
      if (n) out.push(n);
    } else if (b.t === 'banner') { if (b.slides.some(s => s.title && s.title.trim())) out.push(bannerCarousel(b.slides.filter(s => s.title && s.title.trim()).map(s => slideNode(s, preview)), { id: 'cb' + (++seq) })); }
    else if (b.t === 'fitur') { if (b.items.length) out.push(quickGrid(b.title || 'Akses Cepat', b.items.map(k => ({ key: LINKS[k][1], label: LINKS[k][0], id: 'cf-' + k + '-' + seq, onclick: () => { if (!preview) go(LINKS[k][2]); } })), { id: 'cq' + (++seq) })); }
    else if (b.t === 'text') { if (b.text && b.text.trim()) out.push(h(b.style === 'p' ? 'p' : b.style === 'h1' ? 'h2' : 'h3', { class: 'hb-text hb-' + b.style, style: 'text-align:' + b.align }, b.text)); }
  }
  return out;
}

// Dipakai beranda peran: ambil susunan tersimpan lalu kembalikan simpul-simpulnya.
export async function homeBody(role, builtins) {
  const saved = await fetchLayout(role);
  const nodes = layoutNodes(role, saved, builtins);
  return nodes.length ? nodes : layoutNodes(role, null, builtins);
}
