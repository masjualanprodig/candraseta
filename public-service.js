// BAITUNA - public-service.js
// Data PUBLIK (tanpa login): hanya masjid berstatus aktif dan kolom yang boleh dilihat umum.
// Dibatasi di database (RLS + hak kolom untuk anon), bukan hanya di sini.
import { request } from './supabase.js';

const COLS = 'id,name,address,city,province,contact_phone,description,facilities,latitude,longitude,timezone,photo_path';
export const PAGE_SIZE = 24;

// Menghapus karakter yang merusak sintaks filter PostgREST (koma, kurung, bintang, kutip, dll.).
export const cleanQuery = q => String(q || '').replace(/[,()*%\\:"'&#;<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

export async function searchMosques({ q, province, offset }) {
  let path = '/rest/v1/mosques?select=' + COLS + '&status=eq.active&order=name.asc&limit=' + PAGE_SIZE + '&offset=' + (offset || 0);
  const term = cleanQuery(q);
  if (term) path += '&or=' + encodeURIComponent('(name.ilike.*' + term + '*,city.ilike.*' + term + '*,address.ilike.*' + term + '*)');
  if (province) path += '&province=eq.' + encodeURIComponent(province);
  const r = await request(path);
  if (!r.ok) throw Object.assign(new Error('gagal memuat'), { status: r.status });
  return Array.isArray(r.data) ? r.data : [];
}

export async function fetchProvinces() {
  const r = await request('/rest/v1/rpc/public_provinces', { method: 'POST', body: {} });
  return r.ok && Array.isArray(r.data) ? r.data.map(x => x.province).filter(Boolean) : [];
}
