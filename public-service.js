// BAITUNA - public-service.js
// Data PUBLIK (tanpa login): hanya masjid berstatus aktif dan kolom yang boleh dilihat umum.
// Dibatasi di database (RLS + hak kolom untuk anon), bukan hanya di sini.
import { request } from './supabase.js';

const COLS = 'id,name,address,city,province,contact_phone,description,facilities,latitude,longitude,timezone,photo_path,photos,maps_url';
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

// Agenda & pengumuman TERBARU dari semua masjid aktif (beranda umum).
const PCOLS = 'id,mosque_id,kind,title,body,location,starts_at,ends_at,published_at,created_at';
const EMBED = 'mosques!inner(' + COLS + ')';
export async function fetchFeed(nowMs = Date.now(), opts = {}) {
  const since = new Date(nowMs - 36 * 3600e3).toISOString(); // agenda yang baru lewat masih dicek lagi di perangkat (isUpcoming)
  const ids = Array.isArray(opts.mosqueIds) ? opts.mosqueIds.filter(x => /^[0-9a-f-]{36}$/i.test(x)) : [];
  const topic = opts.topic && /^[a-z]{3,20}$/.test(opts.topic) ? opts.topic : null; // jenis kabar (mis. 'ramadan'); disaring di server
  const base = '/rest/v1/mosque_posts?select=' + PCOLS + (topic ? ',topic' : '') + ',' + EMBED + '&status=eq.published' + (topic ? '&topic=eq.' + topic : '') + (ids.length ? '&mosque_id=in.(' + ids.join(',') + ')' : '');
  const [a, i] = await Promise.all([
    request(base + '&kind=eq.agenda&starts_at=gte.' + encodeURIComponent(since) + '&order=starts_at.asc&limit=40'),
    request(base + '&kind=eq.pengumuman&order=published_at.desc&limit=15')
  ]);
  if (!a.ok || !i.ok) throw Object.assign(new Error('gagal memuat'), { status: (a.ok ? i : a).status });
  return { agenda: Array.isArray(a.data) ? a.data : [], info: Array.isArray(i.data) ? i.data : [] };
}
