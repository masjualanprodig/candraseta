// BAITUNA - auth.js
// Proses autentikasi: masuk, keluar, reset password, dan tautan dari email.
import { request, getSession, setSession, persistSession, normalizeSession } from './supabase.js';

export function friendlyAuthError(r) {
  const code = (r.data && (r.data.error_code || r.data.code)) || '';
  const raw = JSON.stringify(r.data || {});
  if (code === 'invalid_credentials' || /invalid login/i.test(raw)) return 'Email atau password salah.';
  if (code === 'email_not_confirmed') return 'Email belum dikonfirmasi. Periksa kotak masuk Anda.';
  if (/rate_limit/.test(code) || r.status === 429) return 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.';
  if (r.status === 0) return 'Tidak ada koneksi internet.';
  return 'Gagal masuk. Periksa koneksi lalu coba lagi.';
}

export async function signIn(email, password) {
  const r = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  if (!r.ok || !r.data || !r.data.access_token) return { ok: false, error: friendlyAuthError(r) };
  setSession(normalizeSession(r.data));
  return { ok: true };
}

export async function signOut() {
  const s = getSession();
  if (s && s.access_token) await request('/auth/v1/logout?scope=local', { method: 'POST', token: s.access_token });
  setSession(null);
}

export async function requestPasswordReset(email) {
  const r = await request('/auth/v1/recover?redirect_to=' + encodeURIComponent(location.origin + '/'), { method: 'POST', body: { email } });
  if (r.status === 429) return { ok: false, error: 'Terlalu sering meminta tautan. Coba lagi beberapa menit lagi.' };
  if (r.status === 0) return { ok: false, error: 'Tidak ada koneksi internet.' };
  return { ok: true }; // pesan netral: tidak membocorkan apakah email terdaftar
}

export async function updatePassword(password) {
  const s = getSession();
  if (!s) return { ok: false, error: 'Tautan kedaluwarsa. Minta tautan reset baru.' };
  const r = await request('/auth/v1/user', { method: 'PUT', token: s.access_token, body: { password } });
  if (!r.ok) return { ok: false, error: 'Password belum bisa diganti. Tautan mungkin kedaluwarsa; minta tautan baru.' };
  persistSession(); // sesi baru disimpan setelah password berhasil diganti
  return { ok: true };
}

// Membaca tautan dari email (reset password). Mengembalikan {recovery:true}, {error:'...'}, atau null.
export async function readEmailLink() {
  const raw = location.hash.replace(/^#/, '');
  if (!raw) return null;
  const p = new URLSearchParams(raw);
  if (p.get('error')) {
    history.replaceState(null, '', location.pathname);
    return { error: p.get('error_code') === 'otp_expired' ? 'Tautan sudah kedaluwarsa. Minta tautan baru.' : 'Tautan tidak valid.' };
  }
  if ((p.get('type') === 'recovery' || p.get('type') === 'invite') && p.get('access_token')) {
    const tok = p.get('access_token');
    const r = await request('/auth/v1/user', { token: tok });
    history.replaceState(null, '', location.pathname);
    if (!r.ok) return { error: 'Tautan tidak valid atau sudah kedaluwarsa.' };
    // Sesi pemulihan hanya di memori sampai password baru berhasil dibuat.
    setSession({
      access_token: tok, refresh_token: p.get('refresh_token'),
      expires_at: Number(p.get('expires_at')) || Math.floor(Date.now() / 1000) + Number(p.get('expires_in') || 3600),
      user: r.data
    }, false);
    return { recovery: true };
  }
  return null;
}
