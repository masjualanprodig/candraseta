// BAITUNA - supabase.js
// Klien Supabase tipis: memanggil API resmi Supabase (Auth + REST) langsung dengan fetch.
// Tidak memakai pustaka luar. Keamanan data sebenarnya dijaga RLS di database.
import { CONFIG } from './config.js';

const API = CONFIG.SUPABASE_URL;
const KEY = CONFIG.SUPABASE_ANON_KEY;
const STORE = 'baituna.session.v1';

let session = null;
let refreshing = null;
let expiredHandler = () => {};

// app.js mendaftarkan fungsi yang dipanggil saat sesi habis (kembali ke halaman login).
export function onSessionExpired(fn) { expiredHandler = fn; }
export function getSession() { return session; }

export function restoreSession() {
  try { session = JSON.parse(localStorage.getItem(STORE)); } catch (e) { session = null; }
  return session;
}
// persist=false: simpan di memori saja (dipakai untuk sesi pemulihan password).
export function setSession(s, persist = true) {
  session = s;
  try {
    if (!s) localStorage.removeItem(STORE);
    else if (persist) localStorage.setItem(STORE, JSON.stringify(s));
  } catch (e) {}
}
export function persistSession() {
  try { if (session) localStorage.setItem(STORE, JSON.stringify(session)); } catch (e) {}
}
export function normalizeSession(d) {
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
    user: d.user || (session && session.user) || null
  };
}

export async function request(path, opts = {}) {
  const headers = { apikey: KEY };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
  if (opts.prefer) headers.Prefer = opts.prefer;
  let res;
  try {
    res = await fetch(API + path, {
      method: opts.method || 'GET', headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
  } catch (e) { return { ok: false, status: 0, data: null }; }
  let data = null;
  try { const txt = await res.text(); data = txt ? JSON.parse(txt) : null; } catch (e) {}
  return { ok: res.ok, status: res.status, data };
}

export async function validToken() {
  if (!session) return null;
  if (session.expires_at * 1000 - Date.now() > 60000) return session.access_token;
  if (!refreshing) {
    refreshing = (async () => {
      const r = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } });
      if (r.ok && r.data && r.data.access_token) setSession(normalizeSession(r.data));
      else if (r.status !== 0) setSession(null);
    })().finally(() => { refreshing = null; });
  }
  await refreshing;
  return session ? session.access_token : null;
}

// Akses tabel lewat REST dengan token pengguna yang sedang login.
export async function db(table, opts = {}) {
  const token = await validToken();
  if (!token) { expiredHandler(); throw Object.assign(new Error('Tidak ada sesi'), { status: 401 }); }
  const r = await request('/rest/v1/' + table + (opts.query ? '?' + opts.query : ''),
    { method: opts.method, body: opts.body, prefer: opts.prefer, token });
  if (r.status === 401) { setSession(null); expiredHandler(); }
  if (!r.ok) {
    const e = new Error((r.data && r.data.message) || 'HTTP ' + r.status);
    e.status = r.status; e.code = r.data && r.data.code;
    throw e;
  }
  return r.data;
}
