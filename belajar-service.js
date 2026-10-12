// BAITUNA - belajar-service.js
// (1) Kemajuan belajar: disimpan HANYA di perangkat (localStorage), tidak dikirim ke server.
// (2) Materi tambahan: dibaca siapa saja, ditulis hanya Super Admin (dijaga RLS, lihat belajar.sql).
import { request, db } from './supabase.js';
import { PASS, LEVELS, PRACTICE_SURAHS } from './belajar-data.js';

export const KEY = 'baituna.belajar.v1';
const enc = encodeURIComponent;
const isoOk = s => typeof s === 'string' && s.length <= 40 && !Number.isNaN(Date.parse(s));

/* ===== Kemajuan (murni, dites terpisah) ===== */
export const emptyProgress = () => ({ v: 1, levels: {}, last: null, lancar: [] });
export function loadProgress() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!o || typeof o !== 'object') return emptyProgress();
    const p = emptyProgress();
    for (const L of LEVELS) {
      const r = o.levels && o.levels[L.id];
      if (r && Number.isFinite(r.best) && r.best >= 0 && r.best <= 100) p.levels[L.id] = { best: Math.round(r.best), attempts: Number.isInteger(r.attempts) && r.attempts > 0 && r.attempts < 100000 ? r.attempts : 1, lastAt: isoOk(r.lastAt) ? r.lastAt : null };
    }
    if (o.last && LEVELS.some(L => L.id === o.last.level) && isoOk(o.last.at)) p.last = { level: o.last.level, at: o.last.at };
    if (Array.isArray(o.lancar)) p.lancar = [...new Set(o.lancar.filter(n => PRACTICE_SURAHS.includes(n)))];
    return p;
  } catch (e) { return emptyProgress(); }
}
export function saveProgress(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); return true; } catch (e) { return false; } }
export const scoreOf = (correct, total) => total > 0 ? Math.round(correct / total * 100) : 0;
export const stars = score => score >= 90 ? 3 : score >= PASS ? 2 : score >= 60 ? 1 : 0;
export const passed = (p, id) => !!(p.levels[id] && p.levels[id].best >= PASS);
export function recordAttempt(p, id, score, now = new Date()) {
  const prev = p.levels[id], at = now.toISOString();
  return { ...p, levels: { ...p.levels, [id]: { best: Math.max(prev ? prev.best : 0, score), attempts: (prev ? prev.attempts : 0) + 1, lastAt: at } }, last: { level: id, at } };
}
export function touch(p, id, now = new Date()) { return { ...p, last: { level: id, at: now.toISOString() } }; }
export function toggleLancar(p, n, now = new Date()) {
  const has = p.lancar.includes(n), lancar = has ? p.lancar.filter(x => x !== n) : [...p.lancar, n];
  const best = scoreOf(lancar.length, PRACTICE_SURAHS.length), prev = p.levels[8];
  return { ...p, lancar, last: { level: 8, at: now.toISOString() }, levels: { ...p.levels, 8: { best, attempts: prev ? prev.attempts : 1, lastAt: now.toISOString() } } };
}
// Level yang disarankan berikutnya: level pertama yang belum lulus; null bila semua lulus.
export const activeLevel = p => { const L = LEVELS.find(x => !passed(p, x.id)); return L ? L.id : null; };
export const doneCount = p => LEVELS.filter(L => passed(p, L.id)).length;
export function agoText(iso, now = new Date()) {
  if (!isoOk(iso)) return '';
  const days = Math.floor((now.getTime() - Date.parse(iso)) / 86400000);
  return days <= 0 ? 'hari ini' : days === 1 ? 'kemarin' : days + ' hari lalu';
}
// Tanda pengingat di dalam aplikasi (bukan notifikasi): muncul saat halaman dibuka.
export function reminder(p, now = new Date()) {
  const next = activeLevel(p);
  if (next === null) return { kind: 'done' };
  if (!p.last) return { kind: 'start', level: next };
  const days = Math.floor((now.getTime() - Date.parse(p.last.at)) / 86400000);
  return { kind: days >= 3 ? 'late' : 'continue', level: next, days, lastLevel: p.last.level, ago: agoText(p.last.at, now) };
}

/* ===== Materi tambahan (Super Admin) ===== */
const COLS = 'id,level,title,body,arabic,latin,source,note,sort_order,created_at';
export async function listMateri() {
  const r = await request('/rest/v1/belajar_materi?select=' + COLS + '&order=level.asc,sort_order.asc,created_at.asc&limit=1000');
  if (!r.ok) throw Object.assign(new Error('gagal memuat'), { status: r.status, code: r.data && r.data.code });
  return Array.isArray(r.data) ? r.data : [];
}
const one = out => { if (!Array.isArray(out) || out.length !== 1) throw Object.assign(new Error('tidak berubah'), { status: 403 }); return out[0]; };
const fieldsOf = f => ({ level: f.level, title: f.title, body: f.body, arabic: f.arabic || null, latin: f.latin || null, source: f.source, note: f.note || null, sort_order: f.sort_order });
export const createMateri = async f => one(await db('belajar_materi', { method: 'POST', prefer: 'return=representation', body: fieldsOf(f) }));
export const updateMateri = async (id, f) => one(await db('belajar_materi', { method: 'PATCH', query: 'id=eq.' + enc(id), prefer: 'return=representation', body: fieldsOf(f) }));
export const deleteMateri = async id => { one(await db('belajar_materi', { method: 'DELETE', query: 'id=eq.' + enc(id), prefer: 'return=representation' })); };
