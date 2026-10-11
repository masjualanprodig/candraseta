// BAITUNA - rukun-service.js
// Rukun Islam & Rukun Iman. Dibaca siapa saja; ditulis hanya oleh Super Admin (dijaga RLS, lihat rukun.sql).
// Ayat Al-Qur'an HANYA disimpan sebagai rujukan (surat:ayat); teksnya diambil dari layanan Al-Qur'an (quran-service.js).
import { request, db } from './supabase.js';

export const PILLARS = [
  { key: 'islam_syahadat', group: 'islam', name: 'Syahadat' },
  { key: 'islam_salat', group: 'islam', name: 'Salat' },
  { key: 'islam_zakat', group: 'islam', name: 'Zakat' },
  { key: 'islam_puasa', group: 'islam', name: 'Puasa Ramadan' },
  { key: 'islam_haji', group: 'islam', name: 'Haji ke Baitullah' },
  { key: 'iman_allah', group: 'iman', name: 'Iman kepada Allah' },
  { key: 'iman_malaikat', group: 'iman', name: 'Iman kepada Malaikat' },
  { key: 'iman_kitab', group: 'iman', name: 'Iman kepada Kitab-kitab Allah' },
  { key: 'iman_rasul', group: 'iman', name: 'Iman kepada Rasul' },
  { key: 'iman_akhir', group: 'iman', name: 'Iman kepada Hari Akhir' },
  { key: 'iman_qadar', group: 'iman', name: 'Iman kepada Qada dan Qadar' }
];
export const GROUPS = { islam: 'Rukun Islam', iman: 'Rukun Iman' };
export const KINDS = { ayat: 'Dalil Al-Qur’an', hadits: 'Hadits', tuntunan: 'Tuntunan' };

const COLS = 'id,pillar,kind,title,arabic,body,source,grade,surah,ayah_from,ayah_to,created_at';
const enc = encodeURIComponent;

export async function listPillarItems() {
  const r = await request('/rest/v1/pillar_items?select=' + COLS + '&order=sort_order.asc,created_at.asc&limit=500');
  if (!r.ok) throw Object.assign(new Error('gagal memuat'), { status: r.status, code: r.data && r.data.code });
  return Array.isArray(r.data) ? r.data : [];
}
const one = out => { if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak berubah'), { status: 403 }); return out[0]; };
// Hanya kolom yang relevan untuk jenisnya yang dikirim (kolom lain harus kosong sesuai aturan database).
const fieldsOf = (kind, f) => kind === 'ayat' ? { surah: f.surah, ayah_from: f.ayah_from, ayah_to: f.ayah_to }
  : kind === 'hadits' ? { arabic: f.arabic, body: f.body, source: f.source, grade: f.grade || null }
  : { title: f.title || null, body: f.body };

export async function createPillarItem(pillar, kind, f) {
  return one(await db('pillar_items', { method: 'POST', prefer: 'return=representation', body: { pillar, kind, ...fieldsOf(kind, f) } }));
}
export async function updatePillarItem(id, kind, f) {
  return one(await db('pillar_items', { method: 'PATCH', query: 'id=eq.' + enc(id), prefer: 'return=representation', body: fieldsOf(kind, f) }));
}
export async function deletePillarItem(id) {
  one(await db('pillar_items', { method: 'DELETE', query: 'id=eq.' + enc(id), prefer: 'return=representation' }));
}
