// BAITUNA - qa-service.js
// Tanya Jawab: jamaah (sudah masuk) bertanya; penjawab resmi (ditunjuk Super Admin) menjawab. Dibaca siapa saja
// (hanya pertanyaan yang SUDAH DIJAWAB). Aturan sebenarnya dijaga RLS dan fungsi di tanya.sql; di sini hanya pemeriksaan ramah.
import { request, db, getSession } from './supabase.js';

export const DEV_KEY = 'baituna.qa.v1';
export const VOTE_KEY = 'baituna.qa.vote.v1';
export const PAGE = 20;
export const LIMIT = { titleMin: 10, titleMax: 150, bodyMax: 1500, ansMin: 20, ansMax: 5000, srcMin: 3, srcMax: 500, reasonMin: 3, reasonMax: 200 };
export const STATUS_LABEL = { menunggu: 'Menunggu dijawab', dijawab: 'Sudah dijawab', ditolak: 'Tidak dapat dijawab', disembunyikan: 'Disembunyikan' };
const COLS = 'id,title,body,category_id,asker_label,status,view_count,helpful_count,popular_score,created_at,answered_at';

const oneLine = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
export const isUuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));

// Penanda acak per perangkat (bukan identitas). Dipakai agar satu perangkat dihitung sekali per pertanyaan.
export function deviceToken() {
  try {
    const v = localStorage.getItem(DEV_KEY);
    if (v && isUuid(v)) return v;
  } catch (e) { /* abaikan */ }
  let id = null;
  try { id = crypto.randomUUID ? crypto.randomUUID() : null; } catch (e) { /* abaikan */ }
  if (!id) id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  try { localStorage.setItem(DEV_KEY, id); } catch (e) { /* abaikan */ }
  return id;
}

// Daftar pertanyaan yang sudah ditandai "Bermanfaat" di perangkat ini (hanya untuk menampilkan keadaan tombol).
export function voted() { try { const a = JSON.parse(localStorage.getItem(VOTE_KEY) || '[]'); return Array.isArray(a) ? a.filter(isUuid) : []; } catch (e) { return []; } }
export function rememberVote(id, on) {
  const a = voted().filter(x => x !== id); if (on) a.push(id);
  try { localStorage.setItem(VOTE_KEY, JSON.stringify(a.slice(-500))); } catch (e) { /* abaikan */ }
}

// Kata pencarian untuk ilike: buang karakter yang berarti khusus bagi PostgREST dan pola.
export function searchTerm(q) {
  const s = oneLine(q).slice(0, 60).replace(/[%_*(),."\\]/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

// Susun query daftar. tab: 'terbaru' | 'populer' | 'kategori'.
export function listQuery({ tab = 'terbaru', category = '', q = '', offset = 0 } = {}) {
  const p = ['select=' + COLS, 'status=eq.dijawab'];
  if (category && isUuid(category)) p.push('category_id=eq.' + category);
  const s = searchTerm(q);
  if (s) p.push('title=ilike.' + encodeURIComponent('*' + s + '*'));
  p.push('order=' + (tab === 'populer' ? 'popular_score.desc,answered_at.desc' : 'answered_at.desc'));
  p.push('limit=' + PAGE, 'offset=' + Math.max(0, offset | 0));
  return p.join('&');
}

async function pub(path, opts) {
  const r = await request(path, opts);
  if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status, code: r.data && r.data.code });
  return r.data;
}
const rpc = (name, body) => db('rpc/' + name, { method: 'POST', body: body || {} });
const rpcPub = (name, body) => pub('/rest/v1/rpc/' + name, { method: 'POST', body: body || {} });

export const listCategories = async () => (await pub('/rest/v1/qa_categories?select=id,name,sort_order,active&active=eq.true&order=sort_order.asc,name.asc')) || [];
export const categoryCounts = async () => { const m = {}; ((await rpcPub('qa_category_counts')) || []).forEach(r => { m[r.category_id] = Number(r.n) || 0; }); return m; };
export const listQuestions = async o => (await pub('/rest/v1/qa_questions?' + listQuery(o))) || [];
export async function getAnswer(id) { const r = await pub('/rest/v1/qa_answers?select=question_id,answerer_name,body,sources,created_at,updated_at&question_id=eq.' + encodeURIComponent(id)); return r && r[0] || null; }
export async function getQuestion(id) { const r = await pub('/rest/v1/qa_questions?select=' + COLS + '&id=eq.' + encodeURIComponent(id)); return r && r[0] || null; }
export const markViewed = id => rpcPub('qa_view', { p_id: id, p_dev: deviceToken() }).catch(() => null);
export const setHelpful = (id, on) => rpcPub('qa_helpful', { p_id: id, p_dev: deviceToken(), p_on: !!on });

/* ===== Bertanya (harus masuk) ===== */
export function checkQuestion(v) {
  const title = oneLine(v.title), body = String(v.body == null ? '' : v.body).replace(/\r\n?/g, '\n').trim();
  if (title.length < LIMIT.titleMin || title.length > LIMIT.titleMax) return { error: 'Judul pertanyaan ' + LIMIT.titleMin + ' sampai ' + LIMIT.titleMax + ' huruf.', field: 'title' };
  if (body.length > LIMIT.bodyMax) return { error: 'Rincian maksimal ' + LIMIT.bodyMax + ' huruf.', field: 'body' };
  if (!isUuid(v.category)) return { error: 'Pilih kategori dulu.', field: 'category' };
  return { ok: { title, body, category: v.category, showName: !!v.showName } };
}
export const askQuestion = q => rpc('qa_ask', { p_title: q.title, p_body: q.body || '', p_category: q.category, p_show_name: !!q.showName });
export const myQuestions = async () => (await rpc('qa_my_questions')) || [];
export function askError(e) {
  if (e && e.status === 0) return 'Tidak ada koneksi. Coba lagi saat online.';
  if (e && e.code === '54000') return /harian/.test(e.message || '') ? 'Batas 5 pertanyaan per hari sudah tercapai. Coba lagi besok.' : 'Anda masih punya 3 pertanyaan yang menunggu dijawab. Tunggu salah satunya dijawab dulu.';
  if (e && e.code === '28000') return 'Silakan masuk dulu.';
  if (e && e.code === '42501') return 'Masuk dulu dengan akun Anda. Jika sudah masuk, minta admin menjalankan pembaruan database terbaru (tanpa_gerbang_jamaah.sql).';
  if (e && e.code === '22023') return e.message || 'Isian belum benar.';
  if (e && (e.status === 404 || e.code === 'PGRST202')) return 'Fitur Tanya Jawab belum aktif di server. Pengelola perlu menjalankan tanya.sql.';
  return 'Belum terkirim. Coba lagi sebentar lagi.';
}

/* ===== Penjawab dan Super Admin ===== */
export async function myRole() {
  if (!getSession()) return { answerer: false, admin: false, moderate: false };
  try { const r = await rpc('qa_me'); return { answerer: !!(r && r.answerer), admin: !!(r && r.super), moderate: !!(r && (r.answerer || r.super)), approved: !(r && r.approved === false) }; }
  catch (e) { return { answerer: false, admin: false, moderate: false }; }
}
export const queue = async () => (await rpc('qa_queue')) || [];
export function checkAnswer(v) {
  const body = String(v.body == null ? '' : v.body).replace(/\r\n?/g, '\n').trim(), sources = String(v.sources == null ? '' : v.sources).replace(/\r\n?/g, '\n').trim();
  if (body.length < LIMIT.ansMin || body.length > LIMIT.ansMax) return { error: 'Jawaban ' + LIMIT.ansMin + ' sampai ' + LIMIT.ansMax + ' huruf.', field: 'body' };
  if (sources.length < LIMIT.srcMin || sources.length > LIMIT.srcMax) return { error: 'Sumber atau rujukan wajib diisi (maks. ' + LIMIT.srcMax + ' huruf).', field: 'sources' };
  return { ok: { body, sources } };
}
export const answerQuestion = (id, a) => rpc('qa_answer', { p_id: id, p_body: a.body, p_sources: a.sources });
export const rejectQuestion = (id, reason) => rpc('qa_reject', { p_id: id, p_reason: String(reason || '').trim() });
export const setHidden = (id, hidden) => rpc('qa_set_hidden', { p_id: id, p_hidden: !!hidden });
// Daftar kelola (penjawab/Super Admin): yang sudah dijawab dan yang disembunyikan.
export const manageList = async () => (await db('qa_questions', { query: 'select=' + COLS + '&status=in.(dijawab,disembunyikan)&order=answered_at.desc&limit=100' })) || [];
export const deleteQuestion = id => rpc('qa_delete', { p_id: id });

/* ===== Super Admin ===== */
export const listAnswerers = async () => (await rpc('qa_list_answerers')) || [];
export const addAnswerer = (email, name, title) => rpc('qa_add_answerer', { p_email: String(email || '').trim(), p_name: oneLine(name), p_title: oneLine(title) });
export const setAnswererActive = (user_id, active) => db('qa_answerers', { method: 'PATCH', query: 'user_id=eq.' + encodeURIComponent(user_id), body: { active: !!active }, prefer: 'return=minimal' });
export const removeAnswerer = user_id => db('qa_answerers', { method: 'DELETE', query: 'user_id=eq.' + encodeURIComponent(user_id), prefer: 'return=minimal' });
export const allCategories = async () => (await db('qa_categories', { query: 'select=id,name,sort_order,active&order=sort_order.asc,name.asc' })) || [];
export const addCategory = (name, sort) => db('qa_categories', { method: 'POST', body: { name: oneLine(name), sort_order: sort | 0 }, prefer: 'return=minimal' });
export const updateCategory = (id, patch) => db('qa_categories', { method: 'PATCH', query: 'id=eq.' + encodeURIComponent(id), body: patch, prefer: 'return=minimal' });
export function adminError(e) {
  if (e && e.code === 'P0002') return 'Email itu belum punya akun BAITUNA. Minta orangnya mendaftar dulu.';
  if (e && e.code === '23505') return 'Nama kategori itu sudah ada.';
  if (e && e.code === '23503') return 'Kategori itu sudah dipakai pertanyaan. Nonaktifkan saja, jangan dihapus.';
  if (e && e.code === '22023') return e.message || 'Isian belum benar.';
  if (e && (e.status === 403 || e.code === '42501')) return 'Anda tidak memiliki izin.';
  return 'Belum berhasil. Coba lagi.';
}
