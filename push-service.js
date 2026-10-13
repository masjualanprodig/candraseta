// BAITUNA - push-service.js
// Notifikasi push: notifikasi tetap muncul walau BAITUNA tertutup. Dikirim server (Edge Function "baituna-push") tepat waktu.
// Yang dikirim ke server: alamat notifikasi HP ini, lokasi DIBULATKAN (~1 km), zona waktu, dan pilihan salat/adzan/Ramadan. Tanpa nama, email, atau akun.
// JUJUR: push memakai nada notifikasi bawaan HP. Suara adzan penuh hanya bisa diputar saat BAITUNA terbuka.
import { CONFIG } from './config.js';
import * as N from './notif-service.js';

export const KEY = 'baituna.push.v1';
export const VAPID_PUBLIC = 'BHFFuPm2KLYhYcFZkkKF5gty-k4-jZEGk5kea3UJWIDAzpOz-U1ndyOwp7WlhhSHgMp6HKh1SqaexkHt8W81GeQ';
export const FN_URL = CONFIG.SUPABASE_URL + '/functions/v1/baituna-push';
export const COVERS = 'waktu salat (pengingat), adzan, serta sahur dan berbuka saat Ramadan, sesuai pilihan Anda';
const DAY = 24 * 3600e3, WAIT_SW = 8000;
const KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export const supported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof PushManager !== 'undefined' && typeof Notification !== 'undefined';
export function state() { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); return o && typeof o.endpoint === 'string' ? { on: true, endpoint: o.endpoint, hash: String(o.hash || ''), at: Number(o.at) || 0 } : { on: false, endpoint: '', hash: '', at: 0 }; } catch (e) { return { on: false, endpoint: '', hash: '', at: 0 }; } }
const setState = o => { try { if (o) localStorage.setItem(KEY, JSON.stringify(o)); else localStorage.removeItem(KEY); } catch (e) { /* abaikan */ } };

// Isi yang dikirim ke server (tanpa endpoint & kunci). null bila lokasi belum dipilih.
export function payload(S = N.load(), loc = N.readLoc()) {
  if (!loc) return null;
  const pick = o => Object.fromEntries(KEYS.map(k => [k, !!(o && o[k])]));
  return {
    lat: Math.round(loc.lat * 100) / 100, lng: Math.round(loc.lng * 100) / 100, off: loc.off,
    settings: { salat: !!S.cats.salat, lead: S.lead, prayers: pick(S.prayers), adzan: { on: !!S.adzan.on, notify: !!S.adzan.notify, prayers: pick(S.adzan.prayers) }, ramOn: !!S.cats.ramadan, ram: { sahur: !!S.ram.sahur, berbuka: !!S.ram.berbuka, sahurMin: S.ram.sahurMin } }
  };
}
const hashOf = p => { const s = JSON.stringify(p); let x = 5381; for (let i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0; return String(x); };
const keyBytes = b64 => { const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); };

async function post(body) {
  try {
    const r = await fetch(FN_URL, { method: 'POST', headers: { 'content-type': 'application/json', apikey: CONFIG.SUPABASE_ANON_KEY }, body: JSON.stringify(body) });
    let j = null; try { j = await r.json(); } catch (e) { /* abaikan */ }
    return { ok: r.ok, status: r.status, data: j };
  } catch (e) { return { ok: false, status: 0, data: null }; }
}
async function registration() {
  const reg = navigator.serviceWorker.ready;
  return Promise.race([reg, new Promise((_, rej) => setTimeout(() => rej(new Error('sw')), WAIT_SW))]);
}

// Hasil: { ok:true } | { ok:false, reason: 'unsupported'|'noloc'|'denied'|'default'|'sw'|'server'|'net' }
export async function enable() {
  if (!supported()) return { ok: false, reason: 'unsupported' };
  const pl = payload(); if (!pl) return { ok: false, reason: 'noloc' };
  let perm = Notification.permission;
  if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch (e) { perm = 'denied'; } }
  if (perm !== 'granted') return { ok: false, reason: perm === 'denied' ? 'denied' : 'default' };
  let reg; try { reg = await registration(); } catch (e) { return { ok: false, reason: 'sw' }; }
  let sub; try { sub = await reg.pushManager.getSubscription(); if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }); } catch (e) { return { ok: false, reason: 'sw' }; }
  const j = sub.toJSON(), r = await post({ action: 'subscribe', endpoint: j.endpoint, keys: j.keys, ...pl });
  if (!r.ok) { if (r.status !== 0) { try { await sub.unsubscribe(); } catch (e) { /* abaikan */ } } return { ok: false, reason: r.status === 0 ? 'net' : 'server' }; }
  setState({ endpoint: j.endpoint, hash: hashOf(pl), at: Date.now() });
  return { ok: true };
}
export async function disable() {
  const st = state(); setState(null);
  if (!st.on || !supported()) return { ok: true };
  try {
    const reg = await registration(), sub = await reg.pushManager.getSubscription(), ep = (sub && sub.endpoint) || st.endpoint;
    if (ep) await post({ action: 'unsubscribe', endpoint: ep });
    if (sub) await sub.unsubscribe();
  } catch (e) { /* abaikan; langganan lama dibersihkan server saat kedaluwarsa */ }
  return { ok: true };
}
// Menyamakan pengaturan di server dengan pengaturan di HP (dipanggil otomatis).
export async function sync(force = false) {
  const st = state(); if (!st.on || !supported() || Notification.permission !== 'granted') return { ok: false, skipped: true };
  const pl = payload(); if (!pl) return { ok: false, skipped: true };
  const h = hashOf(pl); if (!force && h === st.hash && Date.now() - st.at < DAY) return { ok: true, skipped: true };
  let sub; try { const reg = await registration(); sub = await reg.pushManager.getSubscription(); if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }); } catch (e) { return { ok: false }; }
  const j = sub.toJSON(), r = await post({ action: 'subscribe', endpoint: j.endpoint, keys: j.keys, ...pl });
  if (r.ok) setState({ endpoint: j.endpoint, hash: h, at: Date.now() });
  return { ok: r.ok };
}
// Hasil: 'ok' | 'wait' | 'gone' | 'off' | 'server' | 'net'
export async function sendTest() {
  const st = state(); if (!st.on) return 'off';
  let r = await post({ action: 'test', endpoint: st.endpoint });
  if (r.status === 404) { await sync(true); r = await post({ action: 'test', endpoint: st.endpoint }); }
  if (r.ok) return 'ok';
  return r.status === 429 ? 'wait' : r.status === 410 ? 'gone' : r.status === 0 ? 'net' : 'server';
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  let tm = null;
  const soon = (ms = 2000) => { clearTimeout(tm); tm = setTimeout(() => { sync().catch(() => {}); }, ms); };
  window.addEventListener('baituna:settings', () => soon());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') soon(); });
  soon(4000);
}
