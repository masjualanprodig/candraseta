// BAITUNA - wilayah-service.js
// Daftar wilayah Indonesia (provinsi, kota/kabupaten, kecamatan) untuk form pendaftaran masjid.
// Sumber: API publik "api-wilayah-indonesia" (data kode wilayah resmi). Data diambil saat dibutuhkan lalu disimpan di HP (cache),
// jadi tidak membebani aplikasi. Bila gagal diambil (offline/layanan mati), form memakai isian teks biasa.
const BASE = 'https://www.emsifa.com/api-wilayah-indonesia/api/';
const CK = 'baituna.wilayah.v1:';
const mem = new Map();

// "KABUPATEN KEPULAUAN SERIBU" -> "Kabupaten Kepulauan Seribu"; singkatan DKI/DI/NTB/NTT tetap huruf besar.
const KEEP = new Set(['DKI', 'DI', 'NTB', 'NTT']);
export function titleCase(s) {
  return String(s || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
    .map(w => KEEP.has(w.toUpperCase()) ? w.toUpperCase() : w.replace(/(^|[-/(])([a-z])/g, (m, a, b) => a + b.toUpperCase())).join(' ');
}

function clean(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(r => r && r.id != null && r.name).map(r => ({ id: String(r.id), name: titleCase(r.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

async function load(path) {
  if (mem.has(path)) return mem.get(path);
  try { const c = localStorage.getItem(CK + path); if (c) { const v = JSON.parse(c); if (Array.isArray(v) && v.length) { mem.set(path, v); return v; } } } catch (e) { /* cache tidak wajib */ }
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), 12000) : null;
  try {
    const res = await fetch(BASE + path + '.json', ctl ? { signal: ctl.signal } : undefined);
    if (!res.ok) throw new Error('http ' + res.status);
    const rows = clean(await res.json());
    if (!rows.length) throw new Error('kosong');
    mem.set(path, rows);
    try { localStorage.setItem(CK + path, JSON.stringify(rows)); } catch (e) { /* penuh/diblokir: abaikan */ }
    return rows;
  } finally { if (timer) clearTimeout(timer); }
}

export const listProvinces = () => load('provinces');
export const listRegencies = provId => load('regencies/' + encodeURIComponent(provId));
export const listDistricts = regId => load('districts/' + encodeURIComponent(regId));
