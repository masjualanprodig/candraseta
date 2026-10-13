// BAITUNA - adzan-service.js
// Adzan: daftar audio (dikelola Super Admin, dibaca siapa saja), pilihan pengguna (di perangkat), pemutar, dan
// penyimpanan audio agar bisa diputar tanpa internet. BAITUNA tidak membawa rekaman adzan sendiri.
// JUJUR: aplikasi web hanya bisa memutar audio dan menampilkan notifikasi SELAMA BAITUNA terbuka. Saat tertutup,
// tidak ada suara dan tidak ada notifikasi tanpa server push (belum ada).
import { request, db, publicPhotoUrl, storageUpload, storageRemove } from './supabase.js';
import { h } from './ui.js';

export const BUCKET = 'adzan-audio';
export const KINDS = { umum: 'Adzan (umum)', subuh: 'Adzan Subuh' };
export const PRAYER_NAMES = { fajr: 'Subuh', dhuhr: 'Dzuhur', asr: 'Ashar', maghrib: 'Maghrib', isha: 'Isya' };
export const PRAYER_KEYS = Object.keys(PRAYER_NAMES);
export const VOLUMES = [0.3, 0.5, 0.7, 1];
export const MAX_BYTES = 10 * 1024 * 1024; // sama dengan batas bucket
export const EXT = /\.(mp3|m4a|ogg|wav)$/i;
const MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav' };
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH_RE = /^adzan\/[A-Za-z0-9._-]{1,80}$/;

/* ===== Pengaturan pengguna (disimpan di dalam pengaturan Notifikasi, hanya di perangkat) ===== */
export const defaults = () => ({ on: false, notify: true, prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true }, audio: null, subuhAudio: null, volume: 1 });
export function sanitize(o) {
  const d = defaults(); if (!o || typeof o !== 'object') return d;
  const p = o.prayers && typeof o.prayers === 'object' ? o.prayers : {};
  for (const k of PRAYER_KEYS) d.prayers[k] = typeof p[k] === 'boolean' ? p[k] : true;
  d.on = o.on === true; d.notify = o.notify !== false;
  d.audio = typeof o.audio === 'string' && ID_RE.test(o.audio) ? o.audio : null;
  d.subuhAudio = typeof o.subuhAudio === 'string' && ID_RE.test(o.subuhAudio) ? o.subuhAudio : null;
  d.volume = VOLUMES.includes(o.volume) ? o.volume : 1;
  return d;
}
// Audio yang dipakai untuk satu salat. Audio "Subuh" hanya untuk Subuh; audio "umum" untuk semua salat.
// Mengembalikan null bila belum memilih (atau pilihan sudah tidak ada di daftar): hanya notifikasi, tanpa suara.
export function pickFor(S, key, items) {
  const A = S.adzan || defaults(), find = id => (items || []).find(i => i.id === id) || null;
  if (key === 'fajr') { const s = find(A.subuhAudio); if (s && s.kind === 'subuh') return s; }
  const u = find(A.audio); return u && u.kind === 'umum' ? u : null;
}

/* ===== Daftar audio ===== */
const LKEY = 'baituna.adzanlib.v1';
const COLS = 'id,name,kind,credit,file_path,size_bytes,sort_order';
export function cleanItems(a) {
  return (Array.isArray(a) ? a : []).filter(x => x && typeof x.id === 'string' && ID_RE.test(x.id) && typeof x.file_path === 'string' && PATH_RE.test(x.file_path) && typeof x.name === 'string' && x.name.trim())
    .map(x => ({ id: x.id, name: x.name.trim().slice(0, 80), kind: x.kind === 'subuh' ? 'subuh' : 'umum', credit: String(x.credit || '').slice(0, 200), file_path: x.file_path, size_bytes: Number.isFinite(x.size_bytes) ? x.size_bytes : null, sort_order: Number.isFinite(x.sort_order) ? x.sort_order : 100, active: x.active !== false }));
}
export function cachedItems() { try { return cleanItems(JSON.parse(localStorage.getItem(LKEY) || '[]')); } catch (e) { return []; } }
const saveLib = items => { try { localStorage.setItem(LKEY, JSON.stringify(items)); } catch (e) { /* abaikan */ } };
// Daftar audio aktif untuk semua orang. Gagal memuat -> salinan terakhir di perangkat.
export async function listAudio() {
  try {
    const r = await request('/rest/v1/adzan_audio?select=' + COLS + '&order=sort_order.asc,created_at.asc&limit=60');
    if (!r.ok) return { items: cachedItems(), error: r.status === 404 || (r.data && (r.data.code === '42P01' || r.data.code === 'PGRST205')) ? 'sql' : 'net' };
    const items = cleanItems(r.data); saveLib(items); return { items, error: null };
  } catch (e) { return { items: cachedItems(), error: 'net' }; }
}
// Khusus Super Admin: termasuk yang dinonaktifkan.
export async function listAudioAdmin() {
  const out = await db('adzan_audio', { query: 'select=' + COLS + ',active&order=sort_order.asc,created_at.asc&limit=60' });
  return cleanItems(out);
}
export const audioUrl = it => publicPhotoUrl(it.file_path, BUCKET);

/* ===== Simpan audio di perangkat (agar bisa diputar tanpa internet) ===== */
export const CACHE = 'baituna-adzan-v1';
const hasCache = () => typeof caches !== 'undefined';
export async function isCached(it) { try { return hasCache() && !!(await (await caches.open(CACHE)).match(audioUrl(it))); } catch (e) { return false; } }
export async function cacheAudio(it) {
  if (!hasCache()) throw Object.assign(new Error('tidak didukung'), { code: 'unsupported' });
  let res; try { res = await fetch(audioUrl(it)); } catch (e) { throw Object.assign(new Error('offline'), { code: 'net' }); }
  if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { code: 'net' });
  await (await caches.open(CACHE)).put(audioUrl(it), res);
}
export async function uncacheAudio(it) { try { if (hasCache()) await (await caches.open(CACHE)).delete(audioUrl(it)); } catch (e) { /* abaikan */ } }
export async function clearAudioCache() { try { if (hasCache()) await caches.delete(CACHE); } catch (e) { /* abaikan */ } }
async function sourceFor(it) {
  try { if (hasCache()) { const m = await (await caches.open(CACHE)).match(audioUrl(it)); if (m) return URL.createObjectURL(await m.blob()); } } catch (e) { /* pakai jaringan */ }
  return audioUrl(it);
}

/* ===== Pemutar (satu saja, tidak pernah dua suara bersamaan) ===== */
let el = null, cur = null, blobUrl = null, banner = null, primed = false;
const subs = new Set();
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const emit = () => subs.forEach(f => { try { f(cur); } catch (e) { /* abaikan */ } });
export const onChange = f => { subs.add(f); return () => subs.delete(f); };
export const nowPlaying = () => cur;
function audioEl() {
  if (!el && typeof Audio !== 'undefined') {
    el = new Audio(); el.preload = 'auto';
    el.addEventListener('ended', () => finish());
    el.addEventListener('error', () => finish());
  }
  return el;
}
function finish() {
  cur = null; if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch (e) { /* abaikan */ } blobUrl = null; }
  if (banner && banner.id === 'adzan-now') dropBanner(); // tombol "Putar adzan" (suara ditahan) tetap ada sampai diketuk atau ditutup
  emit();
}
function dropBanner() { if (banner) { try { banner.remove(); } catch (e) { /* abaikan */ } banner = null; } }
// Peramban hanya mengizinkan suara otomatis setelah pengguna mengetuk halaman. Ketukan pertama "membuka kunci" pemutar.
export function primeAudio() {
  const a = audioEl(); if (!a || primed || cur) return; primed = true;
  try { a.src = SILENT; a.muted = true; const p = a.play(); if (p && p.then) p.then(() => { a.pause(); a.muted = false; }).catch(() => { a.muted = false; primed = false; }); else { a.pause(); a.muted = false; } }
  catch (e) { a.muted = false; primed = false; }
}
if (typeof document !== 'undefined') ['pointerdown', 'keydown', 'touchend'].forEach(ev => document.addEventListener(ev, primeAudio, { once: true, passive: true }));
export function stop() {
  if (el) { try { el.pause(); el.currentTime = 0; } catch (e) { /* abaikan */ } }
  finish(); dropBanner();
}
// opts: { volume, label }  label -> tampilkan pita "sedang diputar" dengan tombol Hentikan (untuk adzan terjadwal)
// Hasil: { ok:true } | { ok:false, reason:'none'|'blocked'|'error' }
export async function play(it, opts = {}) {
  const a = audioEl(); if (!a || !it) return { ok: false, reason: 'none' };
  stop();
  let src; try { src = await sourceFor(it); } catch (e) { src = audioUrl(it); }
  if (src.startsWith('blob:')) blobUrl = src;
  a.muted = false; a.volume = VOLUMES.includes(opts.volume) ? opts.volume : 1; a.src = src; cur = it; emit();
  try { await a.play(); primed = true; }
  catch (e) { const blocked = !!e && e.name === 'NotAllowedError'; finish(); return { ok: false, reason: blocked ? 'blocked' : 'error' }; }
  if (opts.label && typeof document !== 'undefined' && document.body) {
    dropBanner();
    banner = h('div', { id: 'adzan-now', class: 'adzan-banner', role: 'status' }, h('span', {}, opts.label), h('button', { class: 'btn-sm', type: 'button', id: 'adzan-stop', onclick: () => stop() }, 'Hentikan'));
    document.body.appendChild(banner);
  }
  return { ok: true };
}

/* ===== Dipanggil mesin pengingat saat waktu adzan tiba ===== */
function blockedBanner(key, it, volume) {
  if (typeof document === 'undefined' || !document.body) return;
  dropBanner();
  const b = h('div', { id: 'adzan-blocked', class: 'adzan-banner', role: 'alert' },
    h('span', {}, 'Waktu ' + PRAYER_NAMES[key] + '. Peramban menahan suara otomatis; ketuk untuk memutar adzan.'),
    h('button', { class: 'btn-sm', type: 'button', id: 'adzan-play-now', onclick: async () => { const r = await play(it, { volume, label: 'Adzan ' + PRAYER_NAMES[key] + ' sedang diputar' }); if (r.ok) b.remove(); } }, 'Putar adzan'),
    h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { b.remove(); if (banner === b) banner = null; } }, 'Tutup'));
  document.body.appendChild(b); banner = b;
}
export async function onAdzan(S, key) {
  let items = cachedItems();
  if (!items.length) { try { items = (await listAudio()).items; } catch (e) { items = []; } }
  const it = pickFor(S, key, items);
  if (!it) return { ok: false, reason: 'none' };
  const vol = (S.adzan || defaults()).volume;
  const r = await play(it, { volume: vol, label: 'Adzan ' + PRAYER_NAMES[key] + ' sedang diputar' });
  if (!r.ok && r.reason === 'blocked') blockedBanner(key, it, vol);
  return r;
}

/* ===== Super Admin: kelola daftar audio ===== */
export const fileOk = f => !!f && f.size > 0 && f.size <= MAX_BYTES && EXT.test(f.name || '');
export const newPath = name => { const m = EXT.exec(name || ''); return 'adzan/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '.' + (m ? m[1].toLowerCase() : 'mp3'); };
export function validate(f) {
  const name = String(f.name || '').replace(/\s+/g, ' ').trim(), credit = String(f.credit || '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 80) return { error: 'Nama audio 2 sampai 80 huruf.' };
  if (credit.length < 3 || credit.length > 200) return { error: 'Isi sumber / pelantun / lisensi rekaman (3 sampai 200 huruf).' };
  if (f.kind !== 'umum' && f.kind !== 'subuh') return { error: 'Jenis audio tidak valid.' };
  return { ok: { name, credit, kind: f.kind } };
}
const one = out => { if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak berubah'), { status: 403 }); return out[0]; };
export async function addAudio(file, f) {
  const v = validate(f); if (v.error) throw Object.assign(new Error(v.error), { code: 'invalid' });
  if (!fileOk(file)) throw Object.assign(new Error('Berkas harus MP3, M4A, OGG, atau WAV, maksimal ' + Math.round(MAX_BYTES / 1048576) + ' MB.'), { code: 'file' });
  const path = newPath(file.name), ext = path.split('.').pop();
  const blob = file.type && /^audio\//.test(file.type) && file.type !== 'audio/mp3' ? file : new Blob([file], { type: MIME[ext] || 'audio/mpeg' });
  await storageUpload(path, blob, BUCKET);
  try { return one(await db('adzan_audio', { method: 'POST', prefer: 'return=representation', body: { ...v.ok, file_path: path, size_bytes: file.size } })); }
  catch (e) { try { await storageRemove(path, BUCKET); } catch (x) { /* abaikan */ } throw e; }
}
export async function updateAudio(id, f) {
  if (!ID_RE.test(id)) throw new Error('id tidak valid');
  const body = {};
  if (f.name !== undefined || f.credit !== undefined || f.kind !== undefined) { const v = validate(f); if (v.error) throw Object.assign(new Error(v.error), { code: 'invalid' }); Object.assign(body, v.ok); }
  if (typeof f.active === 'boolean') body.active = f.active;
  if (Number.isInteger(f.sort_order) && f.sort_order >= 0 && f.sort_order <= 100000) body.sort_order = f.sort_order;
  return one(await db('adzan_audio', { method: 'PATCH', query: 'id=eq.' + id, prefer: 'return=representation', body }));
}
export async function deleteAudio(it) {
  one(await db('adzan_audio', { method: 'DELETE', query: 'id=eq.' + it.id, prefer: 'return=representation' }));
  try { await storageRemove(it.file_path, BUCKET); } catch (e) { /* baris sudah terhapus; berkas yatim tidak berbahaya */ }
  await uncacheAudio(it);
}
