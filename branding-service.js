// BAITUNA - branding-service.js (v71)
// Tampilan yang diatur Super Admin: foto latar splash, ikon Akses Cepat, dan font aplikasi.
// Dibaca semua orang (tanpa login) dan disimpan di perangkat sebagai cadangan agar tampil cepat / saat offline.
import { request, db, storageUpload, storageRemove, publicPhotoUrl } from './supabase.js';
import { prepareImage } from './photo.js';
import { CATALOG } from './quick-catalog.js';

export const BUCKET = 'branding';
export const CACHE_KEY = 'baituna.brand.v1';
export const FONT_MAX = 1536 * 1024;     // 1,5 MB (batas bucket 2 MB)
export const ICON_MAX = 192;             // ikon raster diperkecil ke sisi terpanjang 192 px
export const SVG_MAX = 50 * 1024;
export const FONT_FORMATS = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' };
export const FONT_FAMILY = 'BT Custom';  // nama keluarga font di CSS (tetap), nama tampilan disimpan terpisah
export const DEFAULT_FONT_STACK = '"Plus Jakarta Sans","Segoe UI",system-ui,-apple-system,Roboto,"Helvetica Neue",Arial,sans-serif';

const PATH_RE = /^[A-Za-z0-9._-]{1,80}$/;
const KEY_RE = /^open-[a-z]{2,20}$/;
export const ART_SLOTS = [['banner_masjid', 'Banner utama Admin Masjid dan Super Admin'], ['banner_kas', 'Banner kedua Admin Masjid dan Super Admin'], ['banner_sejarah', 'Banner Jamaah: Sejarah Islam'], ['banner_belajar', 'Banner Jamaah: Belajar Qur’an'], ['banner_sunnah', 'Banner Jamaah: Amalan Sunnah'], ['promo_buku', 'Kartu Pustaka Buku'], ['promo_pasar', 'Kartu Pasar Umat']];
const SLOT_RE = /^(banner|promo)_[a-z]{2,12}$/;
const NAME_RE = /^[A-Za-z0-9 ._-]{1,40}$/;

export const urlFor = p => (typeof p === 'string' && PATH_RE.test(p) && !p.includes('..')) ? publicPhotoUrl(p, BUCKET) : null;

// Bersihkan konfigurasi dari server/cadangan: hanya bentuk yang dikenal yang dipakai.
export function clean(rows) {
  const out = { splash_bg: null, font: null, icons: {}, arts: {} };
  const list = Array.isArray(rows) ? rows : [];
  for (const r of list) {
    if (!r || typeof r !== 'object' || !r.value || typeof r.value !== 'object') continue;
    const v = r.value;
    if (r.key === 'splash_bg' && PATH_RE.test(v.path || '')) out.splash_bg = { path: v.path };
    else if (r.key === 'font' && PATH_RE.test(v.path || '') && Object.values(FONT_FORMATS).includes(v.format) && NAME_RE.test(v.name || '')) out.font = { path: v.path, format: v.format, name: v.name };
    else if (r.key === 'arts') { for (const k of Object.keys(v)) if (SLOT_RE.test(k) && typeof v[k] === 'string' && PATH_RE.test(v[k]) && !v[k].includes('..')) out.arts[k] = v[k]; }
    else if (r.key === 'icons') for (const k of Object.keys(v)) if (KEY_RE.test(k) && typeof v[k] === 'string' && PATH_RE.test(v[k]) && !v[k].includes('..')) out.icons[k] = v[k];
  }
  return out;
}

export function readCache() {
  try { const j = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); return j ? clean([{ key: 'splash_bg', value: j.splash_bg || {} }, { key: 'font', value: j.font || {} }, { key: 'icons', value: j.icons || {} }, { key: 'arts', value: j.arts || {} }]) : null; } catch (e) { return null; }
}
function writeCache(cfg) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cfg)); } catch (e) { /* abaikan */ } }

// null bila server tidak terjangkau / tabel belum dibuat (tampilan bawaan tetap dipakai).
export async function fetchConfig() {
  const r = await request('/rest/v1/app_branding?select=key,value');
  if (!r.ok || !Array.isArray(r.data)) return null;
  const cfg = clean(r.data); writeCache(cfg); return cfg;
}

/* ---------- Menerapkan ke tampilan ---------- */
let current = { splash_bg: null, font: null, icons: {}, arts: {} };
export const getCurrent = () => current;

function applyBackground(cfg) {
  const root = document.documentElement;
  const url = cfg.splash_bg && urlFor(cfg.splash_bg.path);
  const tryUrl = (u, ok, fail) => { const im = new Image(); im.onload = ok; im.onerror = fail; im.src = u; };
  const fallback = () => tryUrl('bg-masjid.jpg', () => { root.style.removeProperty('--hero-img'); root.classList.add('has-photo'); }, () => { root.style.removeProperty('--hero-img'); root.classList.remove('has-photo'); });
  if (!url) return fallback();
  tryUrl(url, () => { root.style.setProperty('--hero-img', 'url("' + url + '")'); root.classList.add('has-photo'); }, fallback);
}

function applyFont(cfg) {
  const root = document.documentElement;
  let st = document.getElementById('brand-font');
  const url = cfg.font && urlFor(cfg.font.path);
  if (!url) { if (st) st.remove(); root.style.removeProperty('--font'); return; }
  if (!st) { st = document.createElement('style'); st.id = 'brand-font'; document.head.appendChild(st); }
  st.textContent = '@font-face{font-family:"' + FONT_FAMILY + '";font-style:normal;font-weight:100 900;font-display:swap;src:url("' + url + '") format("' + cfg.font.format + '")}';
  root.style.setProperty('--font', '"' + FONT_FAMILY + '",' + DEFAULT_FONT_STACK);
}

// Daftar kartu Akses Cepat yang ada di halaman (untuk editor).
export function tileList() {
  const out = [], seen = new Set();
  for (const k of Object.keys(CATALOG)) if (!seen.has(k)) { seen.add(k); out.push({ id: k, label: CATALOG[k][0], ic: CATALOG[k][1] }); }
  return out;
}

function applyIcons(cfg) {
  document.querySelectorAll('a.tile[id],[data-ic]').forEach(a => {
    const key = a.dataset.ic || a.id;
    if (!KEY_RE.test(key)) return;
    const url = urlFor(cfg.icons[key]);
    const img = a.querySelector('img.ic-img');
    const svg = a.querySelector('svg.ic');
    if (!url) { if (img) { img.remove(); if (svg) svg.removeAttribute('hidden'); } return; }
    if (img) { if (img.getAttribute('src') !== url) img.setAttribute('src', url); return; }
    const n = document.createElement('img');
    n.className = 'ic-img'; n.alt = ''; n.setAttribute('aria-hidden', 'true'); n.decoding = 'async'; n.setAttribute('src', url);
    n.onerror = () => { n.remove(); if (svg) svg.removeAttribute('hidden'); };   // gagal dimuat -> ikon bawaan kembali
    if (svg) { svg.setAttribute('hidden', ''); svg.before(n); } else a.prepend(n);
  });
}

// Beranda digambar ulang saat berpindah halaman: pasang lagi ikon kustom pada elemen baru.
export const refreshIcons = () => applyIcons(current);

function applyArts(cfg) {
  const root = document.documentElement;
  for (const [k] of ART_SLOTS) {
    const u = cfg.arts && cfg.arts[k] && urlFor(cfg.arts[k]);
    if (u) root.style.setProperty('--art-' + k, 'url("' + u + '")'); else root.style.removeProperty('--art-' + k);
  }
}
export function applyBranding(cfg) {
  current = cfg || { splash_bg: null, font: null, icons: {}, arts: {} };
  applyBackground(current); applyFont(current); applyIcons(current); applyArts(current);
}

// Dipanggil sekali saat aplikasi mulai: pakai cadangan dulu (cepat), lalu segarkan dari server.
export async function initBranding() {
  const c = readCache(); applyBranding(c || undefined);
  const fresh = await fetchConfig();
  if (fresh) applyBranding(fresh);
  return current;
}

/* ---------- Penyiapan berkas (editor) ---------- */
export const ERR = {
  type: 'Jenis berkas tidak didukung.', big: 'Berkas terlalu besar.', bad: 'Isi berkas tidak valid.',
  decode: 'Gambar tidak bisa dibaca. Coba gambar lain.', size: 'Gambar tetap lebih dari 2 MB setelah diperkecil. Coba gambar lain.',
  svg: 'SVG tidak aman atau tidak valid. Pakai SVG sederhana tanpa skrip.', font: 'Font tidak bisa dibaca. Coba berkas font lain.'
};

const ext = n => ((String(n).match(/\.([A-Za-z0-9]+)$/) || [])[1] || '').toLowerCase();

// Font: cek ekstensi, ukuran, tanda berkas (magic bytes), lalu coba benar-benar dimuat sebelum disimpan.
export async function prepareFont(file) {
  const e = ext(file && file.name);
  if (!file || !FONT_FORMATS[e]) throw { code: 'type' };
  if (file.size > FONT_MAX) throw { code: 'big' };
  const buf = await file.arrayBuffer();
  const sig = String.fromCharCode(...new Uint8Array(buf.slice(0, 4)));
  const okSig = e === 'woff2' ? sig === 'wOF2' : e === 'woff' ? sig === 'wOFF' : e === 'ttf' ? (sig === '\u0000\u0001\u0000\u0000' || sig === 'true') : sig === 'OTTO' || sig === '\u0000\u0001\u0000\u0000';
  if (!okSig) throw { code: 'bad' };
  try { const f = new FontFace('BT Check', buf); await f.load(); } catch (x) { throw { code: 'font' }; }
  const name = (file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9 ._-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Font').slice(0, 40);
  return { blob: new Blob([buf], { type: e === 'woff2' ? 'font/woff2' : e === 'woff' ? 'font/woff' : e === 'ttf' ? 'font/ttf' : 'font/otf' }), ext: e, format: FONT_FORMATS[e], name, buf };
}

// Ikon: raster diperkecil ke PNG transparan; SVG hanya jika sederhana dan tanpa skrip.
export async function prepareIcon(file) {
  if (!file) throw { code: 'type' };
  if (file.type === 'image/svg+xml' || ext(file.name) === 'svg') {
    if (file.size > SVG_MAX) throw { code: 'big' };
    const txt = await file.text();
    if (!/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)?<svg[\s>]/i.test(txt) || /<\s*(script|foreignObject|iframe|object|embed)|\son[a-z]+\s*=|javascript:|<!ENTITY|<!DOCTYPE/i.test(txt)) throw { code: 'svg' };
    return { blob: new Blob([txt], { type: 'image/svg+xml' }), ext: 'svg' };
  }
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw { code: 'type' };
  if (file.size > 10 * 1024 * 1024) throw { code: 'big' };
  let bmp; try { bmp = await createImageBitmap(file); } catch (e) { throw { code: 'bad' }; }
  const s = Math.min(1, ICON_MAX / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * s)), hh = Math.max(1, Math.round(bmp.height * s));
  const c = document.createElement('canvas'); c.width = w; c.height = hh;
  c.getContext('2d').drawImage(bmp, 0, 0, w, hh); if (bmp.close) bmp.close();
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  if (!blob) throw { code: 'bad' };
  return { blob, ext: 'png' };
}

export async function prepareBackground(file) { return { ...(await prepareImage(file)), ext: 'jpg' }; }

export const errorText = e => {
  if (e && ERR[e.code]) return ERR[e.code];
  if (e && e.status === 0) return 'Tidak ada koneksi internet. Coba lagi saat online.';
  if (e && (e.status === 403 || e.status === 401)) return 'Hanya Super Admin yang boleh mengubah tampilan.';
  if (e && (e.status === 404 || e.code === 'PGRST202' || e.code === 'PGRST205')) return 'Fitur belum aktif: jalankan tampilan.sql di Supabase dulu.';
  return 'Belum berhasil disimpan. Coba lagi.';
};

/* ---------- Simpan ke server ---------- */
const stamp = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
export async function upload(prefix, blob, extn) {
  const name = prefix + '-' + stamp() + '.' + extn;
  await storageUpload(name, blob, BUCKET);
  return name;
}
const rpc = (fn, body) => db('rpc/' + fn, { method: 'POST', body });
export const dropFile = p => p ? storageRemove(p, BUCKET).catch(() => {}) : Promise.resolve();
const live = async () => (await fetchConfig()) || current;   // ambil kondisi terbaru agar tidak menimpa perubahan lain

export async function setBackground(prepared) {
  const old = (await live()).splash_bg;
  const name = await upload('bg', prepared.blob, 'jpg');
  try { await rpc('branding_set', { p_key: 'splash_bg', p_value: { path: name } }); } catch (e) { await dropFile(name); throw e; }
  await dropFile(old && old.path);
  const cfg = await fetchConfig(); if (cfg) applyBranding(cfg);
}
export async function resetBackground() {
  const old = (await live()).splash_bg;
  await rpc('branding_reset', { p_key: 'splash_bg' }); await dropFile(old && old.path);
  const cfg = await fetchConfig(); if (cfg) applyBranding(cfg);
}
export async function setFont(prepared) {
  const old = (await live()).font;
  const name = await upload('font', prepared.blob, prepared.ext);
  try { await rpc('branding_set', { p_key: 'font', p_value: { path: name, format: prepared.format, name: prepared.name } }); } catch (e) { await dropFile(name); throw e; }
  await dropFile(old && old.path);
  const cfg = await fetchConfig(); if (cfg) applyBranding(cfg);
}
export async function resetFont() {
  const old = (await live()).font;
  await rpc('branding_reset', { p_key: 'font' }); await dropFile(old && old.path);
  const cfg = await fetchConfig(); if (cfg) applyBranding(cfg);
}
export async function setIcon(key, prepared) {
  if (!KEY_RE.test(key)) throw { code: 'bad' };
  const icons = { ...(await live()).icons }; const old = icons[key];
  const name = await upload('ic-' + key.slice(5), prepared.blob, prepared.ext);
  icons[key] = name;
  try { await rpc('branding_set', { p_key: 'icons', p_value: icons }); } catch (e) { await dropFile(name); throw e; }
  await dropFile(old);
  const cfg = await fetchConfig(); if (cfg) applyBranding(cfg);
}
export async function resetIcon(key) {
  const icons = { ...(await live()).icons }; const old = icons[key]; if (!old) return;
  delete icons[key];
  if (Object.keys(icons).length) await rpc('branding_set', { p_key: 'icons', p_value: icons }); else await rpc('branding_reset', { p_key: 'icons' });
  await dropFile(old);
  const cfg = await fetchConfig(); if (cfg) applyBranding(cfg);
}
export async function resetAllIcons() {
  const icons = (await live()).icons; const files = Object.values(icons);
  await rpc('branding_reset', { p_key: 'icons' });
  await Promise.all(files.map(dropFile));
  const cfg = await fetchConfig(); if (cfg) applyBranding(cfg);
}

export async function setArt(slot, prepared) {
  if (!SLOT_RE.test(slot)) throw { code: 'bad' };
  const arts = { ...((await live()).arts || {}) }; const old = arts[slot];
  const name = await upload('art-' + slot.replace('_', '-'), prepared.blob, 'jpg');
  arts[slot] = name;
  try { await rpc('branding_set', { p_key: 'arts', p_value: arts }); } catch (e) { await dropFile(name); throw e; }
  await dropFile(old);
  const cfg = await fetchConfig(); if (cfg) applyBranding(cfg);
}
export async function resetArt(slot) {
  const arts = { ...((await live()).arts || {}) }; const old = arts[slot]; if (!old) return;
  delete arts[slot];
  if (Object.keys(arts).length) await rpc('branding_set', { p_key: 'arts', p_value: arts }); else await rpc('branding_reset', { p_key: 'arts' });
  await dropFile(old);
  const cfg = await fetchConfig(); if (cfg) applyBranding(cfg);
}
