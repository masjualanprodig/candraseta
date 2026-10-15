// BAITUNA - home-builder.js (v92)
// Menyusun beranda dari daftar blok (lihat home-layout-service.js). Tanpa susunan tersimpan => beranda bawaan.
import { h } from './ui.js';
import { bannerCarousel, quickGrid, go } from './home-ui.js';
import { CATALOG } from './quick-catalog.js';
import { LINKS, defaultBlocks, cleanBlocks, fetchLayout, builtinLabel } from './home-layout-service.js';
import { urlFor } from './branding-service.js';

let seq = 0;
function slideNode(s, preview) {
  const link = LINKS[s.link];
  const img = s._url || (s.img && urlFor(s.img));
  return { art: 'custom', img: img || '', title: s.title, text: s.text, tone: s.tone, cta: link && s.cta ? s.cta : '', onclick: () => { if (!preview && link) go(link[2]); } };
}

// builtins: { id: Node | '' } (bagian bawaan yang sudah dibuat oleh beranda peran itu).
// preview: tampilkan penanda untuk bagian bawaan dan matikan tautan.
export function layoutNodes(role, saved, builtins, { preview = false } = {}) {
  const blocks = preview ? (saved || []) : (cleanBlocks(role, saved) || defaultBlocks(role));
  const used = new Set(), out = [];
  for (const b of blocks) {
    if (b.t === 'b') {
      if (used.has(b.id)) continue; used.add(b.id);
      if (preview) out.push(h('div', { class: 'hb-ph' }, h('b', {}, builtinLabel(role, b.id)), h('small', {}, 'Bagian bawaan')));
      else { const n = builtins[b.id]; if (n) out.push(n); }
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
