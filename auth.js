// BAITUNA - auth.js
// Proses autentikasi: masuk, keluar, reset password, dan tautan dari email.
import { request, getSession, setSession, persistSession, normalizeSession } from './supabase.js';

export function friendlyAuthError(r) {
  const code = (r.data && (r.data.error_code || r.data.code)) || '';
  const raw = JSON.stringify(r.data || {});
  if (code === 'invalid_credentials' || /invalid login/i.test(raw)) return 'Email/No. HP atau password salah.';
  if (code === 'email_not_confirmed') return 'Email belum dikonfirmasi. Periksa kotak masuk Anda.';
  if (/rate_limit/.test(code) || r.status === 429) return 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.';
  if (r.status === 0) return 'Tidak ada koneksi internet.';
  return 'Gagal masuk. Periksa koneksi lalu coba lagi.';
}

// Nomor HP Indonesia/internasional sederhana: 9-15 angka, boleh diawali +, spasi, tanda hubung, kurung.
export const phoneDigits = v => String(v || '').replace(/\D/g, '');
export const phoneValid = v => /^[0-9+()\s-]{9,30}$/.test(String(v || '').trim()) && phoneDigits(v).length >= 9 && phoneDigits(v).length <= 15;
// Email akun pemilik nomor HP (null bila tidak ada / lebih dari satu / galat jaringan).
export async function emailForPhone(phone) {
  const r = await request('/rest/v1/rpc/login_email_for_phone', { method: 'POST', body: { p_phone: phone } });
  return r.ok && typeof r.data === 'string' && r.data.includes('@') ? r.data : null;
}
export async function phoneAvailable(phone) {
  const r = await request('/rest/v1/rpc/phone_available', { method: 'POST', body: { p_phone: phone } });
  if (r.status === 0) return { ok: false, error: 'Tidak ada koneksi internet.' };
  if (!r.ok) return { ok: true, free: true };   // fungsi belum dipasang / galat lain: biarkan server yang memutuskan
  return { ok: true, free: r.data !== false };
}
// identifier = email ATAU nomor HP
export async function signIn(identifier, password) {
  let email = String(identifier || '').trim();
  if (!email.includes('@')) {
    const em = await emailForPhone(email);
    if (!em) return { ok: false, error: 'Email/No. HP atau password salah.' };
    email = em;
  }
  return signInEmail(email, password);
}
async function signInEmail(email, password) {
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

export async function requestPasswordReset(identifier) {
  let email = String(identifier || '').trim();
  if (!email.includes('@')) { email = await emailForPhone(email); if (!email) return { ok: true }; }   // pesan netral
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

// Pendaftaran akun jamaah. Jika proyek meminta konfirmasi email, hasilnya { ok:true, confirm:true }.
export function signUpError(r) {
  const code = (r.data && (r.data.error_code || r.data.code)) || '';
  if (code === 'user_already_exists' || code === 'email_exists') return 'Email ini sudah terdaftar. Silakan masuk, atau pakai Lupa password.';
  if (code === 'weak_password') return 'Password terlalu lemah. Pakai minimal 8 karakter berisi huruf dan angka.';
  if (code === 'signup_disabled' || code === 'email_provider_disabled') return 'Pendaftaran akun sedang ditutup.';
  if (code === 'over_email_send_rate_limit' || /rate_limit/.test(code) || r.status === 429) return 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.';
  if (r.status === 0) return 'Tidak ada koneksi internet.';
  if (code === 'validation_failed' || r.status === 400 || r.status === 422) return 'Email atau password belum sesuai. Periksa lagi isian Anda.';
  return 'Pendaftaran belum berhasil. Coba lagi.';
}
export function passwordIssue(pw, email) {
  if (String(pw || '').length < 8) return 'Password minimal 8 karakter.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password harus berisi huruf dan angka.';
  if (email && pw.toLowerCase() === String(email).toLowerCase()) return 'Password tidak boleh sama dengan email.';
  return '';
}
export async function signUp({ name, email, phone, password }) {
  if (phone) { const a = await phoneAvailable(phone); if (!a.ok) return { ok: false, error: a.error }; if (!a.free) return { ok: false, error: 'Nomor HP ini sudah terdaftar. Silakan masuk, atau pakai nomor lain.' }; }
  const r = await request('/auth/v1/signup?redirect_to=' + encodeURIComponent(location.origin + '/'), { method: 'POST', body: { email, password, data: { full_name: name, phone: phone || undefined } } });
  if (!r.ok) return { ok: false, error: signUpError(r) };
  if (r.data && r.data.access_token) { setSession(normalizeSession(r.data)); return { ok: true, confirm: false }; }
  return { ok: true, confirm: true };
}
