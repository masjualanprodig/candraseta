// BAITUNA - asma-edit-service.js
// Perubahan Asmaul Husna oleh Super Admin: penjelasan/arti per nama dan audio lantunan lengkap.
// Dibaca siapa saja; ditulis hanya Super Admin (dijaga RLS, lihat asma.sql). Bila gagal dimuat, aplikasi memakai isi bawaan.
import { request, db, publicPhotoUrl, storageUpload, storageRemove, ASMA_BUCKET } from './supabase.js';
import { AUDIO_URL, parseFull, buildFullList, AUDIO_MAX_BYTES, AUDIO_EXT } from './asma-service.js';

export async function loadEdits() {
  try { const r = await request('/rest/v1/asma_names_edit?select=no,penjelasan,arti&limit=200'); return r.ok && Array.isArray(r.data) ? r.data : []; }
  catch (e) { return []; }
}
// Semua baris audio dari server (maks. 20). Gagal dimuat = daftar kosong (aplikasi memakai audio bawaan).
export async function loadAudioRows() {
  try { const r = await request('/rest/v1/asma_audio_setting?select=id,title,source,license,file_path&order=id.asc&limit=20'); return r.ok && Array.isArray(r.data) ? r.data : []; }
  catch (e) { return []; }
}
// Daftar audio siap putar. rows boleh diberikan bila sudah dimuat.
export async function loadFullList(rows) {
  let base = null;
  try { const r = await fetch(AUDIO_URL); if (r.ok) base = parseFull(await r.json()); } catch (e) {}
  return buildFullList(base, rows || await loadAudioRows(), p => publicPhotoUrl(p, ASMA_BUCKET));
}

const one = out => { if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak berubah'), { status: 403 }); return out[0]; };
export const saveEdit = async (no, penjelasan, arti) => one(await db('asma_names_edit', { method: 'POST', query: 'on_conflict=no', prefer: 'resolution=merge-duplicates,return=representation', body: { no, penjelasan, arti: arti || null } }));
export const resetEdit = async no => { await db('asma_names_edit', { method: 'DELETE', query: 'no=eq.' + Number(no), prefer: 'return=representation' }); };

export const audioFileOk = f => !!f && f.size > 0 && f.size <= AUDIO_MAX_BYTES && AUDIO_EXT.test(f.name || '');
const MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav' };
export const newAudioPath = name => { const m = AUDIO_EXT.exec(name || ''); const ext = m ? m[1].toLowerCase() : 'mp3'; return 'full/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '.' + ext; };
const cols = f => ({ title: f.title || null, source: f.source || null, license: f.license || null });
export const addAudio = async f => one(await db('asma_audio_setting', { method: 'POST', prefer: 'return=representation', body: { ...cols(f), file_path: f.file_path } }));
export const updateAudio = async (id, f) => one(await db('asma_audio_setting', { method: 'PATCH', query: 'id=eq.' + Number(id), prefer: 'return=representation', body: cols(f) }));
export const deleteAudio = async id => one(await db('asma_audio_setting', { method: 'DELETE', query: 'id=eq.' + Number(id), prefer: 'return=representation' }));
export async function uploadAudio(file, path) {
  const ext = path.split('.').pop();
  const blob = file.type && /^audio\//.test(file.type) && file.type !== 'audio/mp3' ? file : new Blob([file], { type: MIME[ext] || 'audio/mpeg' });
  await storageUpload(path, blob, ASMA_BUCKET);
}
export const removeAudio = path => storageRemove(path, ASMA_BUCKET);
