// BAITUNA - nearby-service.js
// Masjid terdekat. Lokasi pengguna HANYA dipakai di perangkat (tidak dikirim ke server): server memberi daftar
// masjid aktif yang punya titik lokasi, lalu jarak dihitung di perangkat.
import { request } from './supabase.js';

const COLS = 'id,name,address,city,province,contact_phone,description,facilities,latitude,longitude,timezone,photo_path,photos,maps_url';

export async function fetchMosquesWithCoords() {
  const r = await request('/rest/v1/mosques?select=' + COLS + '&status=eq.active&latitude=not.is.null&longitude=not.is.null&order=name.asc&limit=500');
  if (!r.ok) throw Object.assign(new Error('gagal memuat'), { status: r.status });
  const rows = Array.isArray(r.data) ? r.data : [];
  return rows.map(m => ({ ...m, lat: Number(m.latitude), lng: Number(m.longitude) }))
    .filter(m => Number.isFinite(m.lat) && Number.isFinite(m.lng) && Math.abs(m.lat) <= 90 && Math.abs(m.lng) <= 180);
}

// Jarak garis lurus (rumus haversine), dalam km.
export function distanceKm(a, b) {
  const R = 6371, rad = d => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

export function fmtDistance(km) {
  if (km < 0.05) return 'kurang dari 50 m';
  if (km < 1) return Math.round(km * 100) * 10 + ' m';
  if (km < 10) return km.toFixed(1).replace('.', ',') + ' km';
  return Math.round(km).toLocaleString('id-ID') + ' km';
}

export function sortByDistance(mosques, pos) {
  return mosques.map(m => ({ m, km: distanceKm(pos, m) })).sort((a, b) => a.km - b.km || a.m.name.localeCompare(b.m.name));
}

// Lokasi perangkat. Galat: unsupported | denied | unavailable | timeout
export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(Object.assign(new Error('x'), { code: 'unsupported' })); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      e => reject(Object.assign(new Error('x'), { code: e && e.code === 1 ? 'denied' : e && e.code === 3 ? 'timeout' : 'unavailable' })),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
  });
}

export const directionsUrl = m => 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(m.lat + ',' + m.lng);
