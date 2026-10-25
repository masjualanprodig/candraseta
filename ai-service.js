// BAITUNA - ai-service.js
// Forum Tanya Jawab BAITUNA (dibantu AI, khusus membership aktif). File ini hanya memanggil server:
//  - pertanyaan dikirim ke Edge Function "baituna-tanya-ai" (kunci AI ada di server, BUKAN di sini);
//  - riwayat dibaca dari tabel ai_conversations / ai_messages (RLS: hanya milik sendiri).
// Hak akses, kuota harian, dan penyimpanan jawaban dijaga server (tanya_ai.sql + Edge Function).
import { db, validToken } from './supabase.js';
import { CONFIG } from './config.js';

export const FN_URL = CONFIG.SUPABASE_URL + '/functions/v1/baituna-tanya-ai';
export const DAILY_LIMIT = 20;      // cermin batas di server (Secrets AI_DAILY_LIMIT); angka dari server yang dipakai bila ada
export const Q_MAX = 1000;
export const DRAFT_KEY = 'baituna.ai.draft.v1';

export const CATEGORIES = [
  { key: 'salat', label: 'Salat' }, { key: 'puasa', label: 'Puasa dan Ramadan' }, { key: 'zakat', label: 'Zakat dan Sedekah' },
  { key: 'haji', label: 'Haji dan Umrah' }, { key: 'quran', label: 'Al-Qur’an' }, { key: 'keluarga', label: 'Keluarga' },
  { key: 'muamalah', label: 'Muamalah', sub: '(jual beli dan utang)' }, { key: 'akhlak', label: 'Akhlak dan Adab' }, { key: 'lainnya', label: 'Lainnya' }
];
export const catLabel = k => { const c = CATEGORIES.find(x => x.key === k); return c ? c.label + (c.sub ? ' ' + c.sub : '') : ''; };
export const EXAMPLES = ['Bagaimana cara menjaga khusyuk dalam salat?', 'Apa saja yang membatalkan wudu?', 'Bagaimana ketentuan zakat penghasilan?', 'Apakah boleh membaca Al-Qur’an dari HP?'];
export const REPORT_REASONS = [['keliru', 'Jawaban keliru'], ['rujukan', 'Rujukan tidak sesuai'], ['tidak_pantas', 'Bahasa tidak pantas'], ['lainnya', 'Lainnya']];
export const SOURCE_KINDS = [['quran', 'Al-Qur’an / terjemah'], ['hadis', 'Hadis'], ['fatwa', 'Fatwa'], ['tafsir', 'Tafsir'], ['fikih', 'Kitab fikih'], ['artikel', 'Artikel lembaga'], ['lainnya', 'Lainnya']];
export const kindLabel = k => (SOURCE_KINDS.find(x => x[0] === k) || [k, 'Sumber'])[1];
export const SOURCE_STATUS = [['draf', 'Draf (belum dipakai)'], ['disetujui', 'Disetujui (dipakai asisten)'], ['nonaktif', 'Nonaktif']];
export const REPORT_STATUS = [['baru', 'Baru'], ['ditinjau', 'Ditinjau'], ['selesai', 'Selesai']];

export const isUuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));
export function newId() {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* abaikan */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
}
export const cleanQuestion = t => String(t == null ? '' : t).replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
export function validateQuestion(t) {
  const q = cleanQuestion(t);
  if (q.length < 3) return { error: 'Tulis pertanyaan Anda terlebih dahulu.' };
  if (q.length > Q_MAX) return { error: 'Pertanyaan terlalu panjang (' + q.length + ' huruf). Ringkas menjadi paling banyak ' + Q_MAX.toLocaleString('id-ID') + ' huruf, ya.' };
  return { ok: q };
}
export const paragraphs = t => String(t || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
export const ayahLabel = a => 'QS. ' + (a.nama || 'Surah ' + a.surah) + ' (' + a.surah + '): ' + a.ayat + (a.sampai && a.sampai !== a.ayat ? '–' + a.sampai : '');
export const answerLength = a => !a ? 0 : [a.inti, a.penjelasan, a.perbedaan_pendapat, a.catatan].join('').length;

// Teks untuk dibagikan: HANYA pertanyaan (opsional) & jawaban yang dipilih, tanpa nama/akun pengguna.
export function shareText(ans, question) {
  const a = ans || {}, parts = [];
  if (question) parts.push('Pertanyaan: ' + question);
  parts.push(a.inti || '', a.penjelasan || '');
  if (a.perbedaan_pendapat) parts.push('Perbedaan pendapat: ' + a.perbedaan_pendapat);
  const refs = (a.ayat || []).map(ayahLabel).concat((a.sumber || []).map(s => s.title + (s.reference ? ' (' + s.reference + ')' : '')));
  if (refs.length) parts.push('Rujukan: ' + refs.join('; '));
  parts.push('— Dijawab asisten digital (kecerdasan buatan) di Forum Tanya Jawab BAITUNA. Bukan fatwa; periksa rujukannya dan tanyakan kepada ustaz bila ragu.');
  return parts.filter(Boolean).join('\n\n');
}

/* ===== Draf pertanyaan (per tab peramban; aman bila penyimpanan diblokir) ===== */
export function loadDraft() { try { const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); return d && typeof d === 'object' ? { q: String(d.q || '').slice(0, 2000), cat: CATEGORIES.some(c => c.key === d.cat) ? d.cat : '' } : { q: '', cat: '' }; } catch (e) { return { q: '', cat: '' }; } }
export function saveDraft(d) { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ q: String(d.q || '').slice(0, 2000), cat: d.cat || '' })); } catch (e) { /* abaikan */ } }

/* ===== Server ===== */
const rpc = (name, body) => db('rpc/' + name, { method: 'POST', body: body || {} });
export const myStatus = () => rpc('ai_my_status');

// Kirim pertanyaan. Melempar { status, error, message } bila gagal (pesan sudah ramah dari server bila ada).
export async function ask({ question, category, conversationId, clientId }) {
  const token = await validToken();
  if (!token) throw Object.assign(new Error('masuk'), { status: 401, error: 'masuk' });
  let res;
  try {
    res = await fetch(FN_URL, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token, apikey: CONFIG.SUPABASE_ANON_KEY },
      body: JSON.stringify({ action: 'ask', question, category: category || null, conversation_id: conversationId || null, client_id: clientId }) });
  } catch (e) { const off = typeof navigator !== 'undefined' && navigator.onLine === false; throw Object.assign(new Error(off ? 'offline' : 'tak_terjangkau'), { status: 0, error: off ? 'offline' : 'tak_terjangkau' }); }
  let j = null; try { j = await res.json(); } catch (e) { /* abaikan */ }
  if (!res.ok || !j || !j.ok) throw Object.assign(new Error((j && j.error) || 'http'), { status: res.status, error: (j && j.error) || 'http', message: j && j.message, limit: j && j.limit, conversationId: j && j.conversation_id || null });
  return j;
}
export function errorText(e) {
  if (!e) return 'Belum berhasil. Coba lagi.';
  if (e.status === 0 && e.error === 'tak_terjangkau') return 'Forum Tanya Jawab belum dapat dihubungi saat ini. Pertanyaan Anda tidak hilang; silakan coba lagi sebentar lagi. Jika terus berulang, hubungi pengelola.';
  if (e.status === 0) return 'Tidak ada koneksi internet. Pertanyaan Anda tidak hilang; silakan coba lagi.';
  if (e.status === 404 && !e.message && e.error === 'http') return 'Forum Tanya Jawab belum aktif di server. Pengelola perlu memasang fungsi baituna-tanya-ai.';
  if (e.error === 'ai_belum_diatur') return 'Layanan Forum Tanya Jawab belum diatur oleh pengelola. Silakan coba lagi nanti.';
  if (e.message) return e.message;
  if (e.status === 401) return 'Sesi Anda berakhir. Silakan masuk lagi.';
  return 'Maaf, Saudaraku. Jawaban belum dapat dimuat saat ini. Silakan coba kembali beberapa saat lagi.';
}
// Galat yang tidak layak dicoba ulang dengan pertanyaan yang sama.
export const final = e => !!e && ['premium', 'masuk', 'kuota', 'pertanyaan_pendek', 'pertanyaan_panjang', 'kategori', 'percakapan', 'percakapan_penuh', 'ai_belum_diatur', 'sql', 'ai_menolak'].includes(e.error);
export const notReady = e => !!e && (e.status === 404 || e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === '42P01');

export const listConversations = () => db('ai_conversations', { query: 'select=id,title,category,saved,updated_at&order=updated_at.desc&limit=50' });
export const loadMessages = id => db('ai_messages', { query: 'select=id,role,content,answer,status,created_at,reply_to&conversation_id=eq.' + encodeURIComponent(id) + '&status=eq.ok&order=created_at.asc&limit=120' });
export const getConversation = async id => { const r = await db('ai_conversations', { query: 'select=id,title,category,saved,updated_at&id=eq.' + encodeURIComponent(id) + '&limit=1' }); return r && r[0] || null; };
export const setSaved = (id, saved) => rpc('ai_set_saved', { p_conv: id, p_saved: !!saved });
export const deleteConversation = id => db('ai_conversations', { method: 'DELETE', query: 'id=eq.' + encodeURIComponent(id), prefer: 'return=minimal' });
export const report = (messageId, reason, note) => rpc('ai_report', { p_message: messageId, p_reason: reason, p_note: note || null });

/* ===== Super Admin ===== */
export const reportList = status => rpc('ai_report_list', { p_status: status || null });
export const reportSet = (id, status) => rpc('ai_report_set', { p_id: id, p_status: status });
export const listSources = () => db('ai_sources', { query: 'select=*&order=updated_at.desc&limit=200' });
export function validateSource(f) {
  const t = s => String(s == null ? '' : s).trim();
  const o = { title: t(f.title), kind: t(f.kind), author: t(f.author) || null, edition: t(f.edition) || null, reference: t(f.reference) || null, url: t(f.url) || null,
    excerpt: t(f.excerpt), keywords: t(f.keywords) || null, category: t(f.category) || null, license_note: t(f.license_note) || null, status: t(f.status) || 'draf' };
  if (o.title.length < 3 || o.title.length > 200) return { error: 'Judul diisi 3 sampai 200 huruf.', field: 'title' };
  if (!SOURCE_KINDS.some(k => k[0] === o.kind)) return { error: 'Pilih jenis sumber.', field: 'kind' };
  if (o.url && (!/^https:\/\/[^\s<>"']{4,}$/.test(o.url) || o.url.length > 500)) return { error: 'Tautan harus diawali https://', field: 'url' };
  if (o.excerpt.length < 20 || o.excerpt.length > 4000) return { error: 'Kutipan diisi 20 sampai 4.000 huruf (salin dari sumber aslinya).', field: 'excerpt' };
  if (o.category && !CATEGORIES.some(c => c.key === o.category)) return { error: 'Kategori tidak dikenal.', field: 'category' };
  for (const [k, n] of [['author', 200], ['edition', 200], ['reference', 200], ['keywords', 500], ['license_note', 300]]) if (o[k] && o[k].length > n) return { error: 'Isian terlalu panjang.', field: k };
  if (!SOURCE_STATUS.some(s => s[0] === o.status)) return { error: 'Status tidak dikenal.', field: 'status' };
  return { ok: o };
}
export const saveSource = (id, row) => id
  ? db('ai_sources', { method: 'PATCH', query: 'id=eq.' + encodeURIComponent(id), body: row, prefer: 'return=representation' })
  : db('ai_sources', { method: 'POST', body: row, prefer: 'return=representation' });
