// BAITUNA - auth.js
// Proses autentikasi: masuk, keluar, reset password, dan tautan dari email.
import { request, getSession, setSession, persistSession, normalizeSession } from './supabase.js';

const codeOf = r => String((r && r.data && (r.data.error_code || r.data.code)) || '');
// Pesan batas server dibedakan: batas kirim email (pengaturan Supabase) vs terlalu banyak permintaan dari satu jaringan.
export const RL_EMAIL = 'Pendaftaran sedang ramai: batas kirim email konfirmasi di server BAITUNA tercapai. Coba lagi nanti, atau hubungi pengurus.';
export const RL_NET = 'Terlalu banyak percobaan dari jaringan internet ini. Tunggu sekitar 5 menit, atau coba pakai data seluler.';
const rateMsg = r => { const c = codeOf(r); return c === 'over_email_send_rate_limit' ? RL_EMAIL : (/rate_limit/.test(c) || r.status === 429) ? RL_NET : ''; };
export const NOT_CONFIRMED = 'Email akun ini belum dikonfirmasi. Periksa kotak masuk dan folder spam. Bila email tidak datang, hubungi pengurus BAITUNA untuk mengaktifkan akun.';

export function friendlyAuthError(r) {
  const code = codeOf(r);
  const raw = JSON.stringify(r.data || {});
  if (code === 'invalid_credentials' || /invalid login/i.test(raw)) return 'Email/No. HP atau password salah.';
  if (code === 'email_not_confirmed') return NOT_CONFIRMED;
  if (rateMsg(r)) return rateMsg(r);
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
// Satu nomor HP boleh dipakai beberapa akun (nomor_hp_bersama.sql). Jumlah akun pemakai nomor (null bila fungsi belum ada / galat).
export async function phoneAccountCount(phone) {
  const r = await request('/rest/v1/rpc/phone_account_count', { method: 'POST', body: { p_phone: phone } });
  return r.ok && typeof r.data === 'number' ? r.data : null;
}
export const SHARED_PHONE = 'Nomor HP ini dipakai lebih dari satu akun. Silakan masuk memakai email akun Anda.';
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
    if (!em) { const n = await phoneAccountCount(email); return { ok: false, error: n > 1 ? SHARED_PHONE : 'Email/No. HP atau password salah.' }; }
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
  if (!email.includes('@')) {
    const ph = email; email = await emailForPhone(ph);
    if (!email) { const n = await phoneAccountCount(ph); return n > 1 ? { ok: false, error: 'Nomor HP ini dipakai lebih dari satu akun. Isi email akun Anda, lalu pilih Lupa password lagi.' } : { ok: true }; }   // pesan netral
  }
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
  const code = codeOf(r);
  if (code === 'user_already_exists' || code === 'email_exists') return 'Email ini sudah terdaftar. Silakan masuk, atau pakai Lupa password.';
  if (code === 'weak_password') return 'Password terlalu lemah. Pakai minimal 8 karakter berisi huruf dan angka.';
  if (code === 'signup_disabled' || code === 'email_provider_disabled') return 'Pendaftaran akun sedang ditutup.';
  if (rateMsg(r)) return rateMsg(r);
  if (r.status === 0) return 'Tidak ada koneksi internet.';
  if (code === 'email_address_not_authorized') return 'Email konfirmasi belum bisa dikirim ke alamat ini (pengaturan server). Hubungi pengurus BAITUNA.';
  if (code === 'email_address_invalid') return 'Alamat email ini tidak diterima. Periksa lagi penulisannya.';
  if (code === 'validation_failed' || r.status === 400 || r.status === 422) return 'Email atau password belum sesuai. Periksa lagi isian Anda.' + (code ? ' (kode: ' + code + ')' : '');
  return 'Pendaftaran belum berhasil. Coba lagi.' + (code ? ' (kode: ' + code + ')' : r.status ? ' (kode: ' + r.status + ')' : '');
}
export function passwordIssue(pw, email) {
  if (String(pw || '').length < 8) return 'Password minimal 8 karakter.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password harus berisi huruf dan angka.';
  if (email && pw.toLowerCase() === String(email).toLowerCase()) return 'Password tidak boleh sama dengan email.';
  return '';
}
// Akun yang sebenarnya sudah terbuat di percobaan sebelumnya (mis. pendaftar menekan Daftar lagi):
// coba langsung masuk dengan password yang baru diketik, alih-alih menolak dengan "sudah terdaftar".
async function resumeExisting(email, password) {
  const r = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  if (r.ok && r.data && r.data.access_token) { setSession(normalizeSession(r.data)); return { ok: true, confirm: false, existed: true }; }
  if (codeOf(r) === 'email_not_confirmed') return { ok: false, error: 'Akun Anda sudah terbuat sebelumnya, tetapi email belum dikonfirmasi. Periksa email (juga folder spam), atau hubungi pengurus BAITUNA untuk mengaktifkan akun.' };
  if (rateMsg(r)) return { ok: false, error: rateMsg(r) };
  if (r.status === 0) return { ok: false, error: 'Tidak ada koneksi internet.' };
  return { ok: false, error: 'Akun dengan email ini sudah ada. Silakan Masuk (bisa pakai email atau nomor HP). Bila lupa password, pilih Lupa password.' };
}
export async function signUp({ name, email, phone, password }) {
  email = String(email || '').trim();
  // Nomor HP tidak lagi harus unik: satu HP boleh untuk beberapa akun dengan email berbeda. Yang unik hanya email.
  const r = await request('/auth/v1/signup?redirect_to=' + encodeURIComponent(location.origin + '/'), { method: 'POST', body: { email, password, data: { full_name: name, phone: phone || undefined } } });
  if (!r.ok) {
    const c = codeOf(r);
    if (c === 'user_already_exists' || c === 'email_exists') return resumeExisting(email, password);
    return { ok: false, error: signUpError(r) };
  }
  if (r.data && r.data.access_token) { setSession(normalizeSession(r.data)); return { ok: true, confirm: false }; }
  // Supabase menyamarkan email yang sudah ada (identities kosong) saat konfirmasi email aktif.
  if (r.data && Array.isArray(r.data.identities) && r.data.identities.length === 0) return resumeExisting(email, password);
  return { ok: true, confirm: true };
}
