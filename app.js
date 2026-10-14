// BAITUNA - app.js
// Titik masuk aplikasi: menyambungkan halaman login, reset password, dashboard, dan logout.
import { $, h, toast } from './ui.js';
import { show } from './router.js';
import { onSessionExpired, restoreSession, getSession, setSession, validToken } from './supabase.js';
import { signIn, signOut, signUp, passwordIssue, requestPasswordReset, updatePassword, readEmailLink } from './auth.js';
import { loadAccess } from './permissions.js';
import { initBranding, refreshIcons } from './branding-service.js';
import { go, runAct, setHomeBack, flushAct } from './home-ui.js';
import { setNavKind, navItems } from './nav-config.js';
import { acceptMyInvitations } from './mosque-service.js';
import { renderAdmin } from './dashboard-admin.js';
import { renderMember } from './dashboard-member.js';
import { openDirectory, openMosque } from './directory.js';
import { setProfilStart } from './profil-ui.js';
import { feedPanel, icon, ICONS } from './feed-ui.js';
import { armReminders } from './notif-service.js';

const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function say(text, kind) { const m = $('form-msg'); m.textContent = text || ''; m.className = 'msg ' + (kind || ''); m.hidden = !text; }
function fieldErr(id, text) { const e = $(id); e.textContent = text || ''; e.hidden = !text; }

function clearApp() {
  $('app-content').replaceChildren();
  $('app-email').textContent = '';
  $('app-role').hidden = true;
}

onSessionExpired(() => {
  clearApp(); show('login');
  toast('Sesi berakhir. Silakan masuk lagi.', true);
});

function errorPanel(e) {
  const notReady = e && (e.code === '42P01' || e.code === 'PGRST205' || e.status === 404);
  return h('div', { class: 'panel center' },
    h('p', {}, notReady
      ? 'Database belum siap. Jalankan schema.sql dan policies.sql di Supabase SQL Editor.'
      : 'Data belum bisa dimuat. Periksa koneksi, lalu coba lagi.'),
    h('button', { class: 'btn-sm', onclick: () => enterApp() }, 'Coba lagi'));
}

async function enterApp() {
  const s = getSession(), me = s && s.user;
  if (!me || !me.id) { show('login'); return; }
  $('app-email').textContent = me.email || '';
  $('app-role').hidden = true;
  const box = $('app-content');
  box.replaceChildren(h('p', { class: 'muted center' }, 'Memuat…'));
  show('app');
  try {
    const accepted = await acceptMyInvitations();
    if (accepted > 0) toast('Undangan diterima. Anda kini terdaftar sebagai pengurus.');
    const access = await loadAccess(me);
    if (access.isAdmin) { const role = $('app-role'); role.textContent = 'Super Admin'; role.hidden = false; }
    const isMosqueAdmin = !access.isAdmin && access.memberships.some(m => m.role === 'admin_masjid' && m.mosques && m.mosques.status === 'active');
    setNav(access.isAdmin ? 'super' : isMosqueAdmin ? 'admin' : 'jamaah');
    if (access.isAdmin) await renderAdmin(box);
    else await renderMember(box, access.memberships);
    refreshIcons(); flushAct();
  } catch (e) {
    if (e.status === 401) return;
    console.error(e);
    box.replaceChildren(errorPanel(e));
  }
}

/* ===== Login ===== */
$('toggle-pw').addEventListener('click', () => {
  const p = $('password'), hide = p.type === 'password';
  p.type = hide ? 'text' : 'password';
  $('toggle-pw').setAttribute('aria-label', hide ? 'Sembunyikan password' : 'Tampilkan password');
});

$('login-form').addEventListener('submit', async e => {
  e.preventDefault(); say('');
  const email = $('email').value.trim(), pw = $('password').value;
  fieldErr('email-err', emailOk(email) ? '' : 'Masukkan email yang valid.');
  fieldErr('pw-err', pw ? '' : 'Masukkan password.');
  if (!emailOk(email) || !pw) return;
  const btn = $('login-btn'); btn.disabled = true; btn.firstElementChild.textContent = 'Memproses…';
  const r = await signIn(email, pw);
  btn.disabled = false; btn.firstElementChild.textContent = 'Masuk';
  if (!r.ok) { say(r.error); return; }
  $('password').value = '';
  enterApp();
});

$('forgot').addEventListener('click', async e => {
  e.preventDefault();
  const email = $('email').value.trim();
  if (!emailOk(email)) { fieldErr('email-err', 'Isi email dulu, lalu pilih Lupa password.'); return; }
  fieldErr('email-err', '');
  const r = await requestPasswordReset(email);
  if (!r.ok) say(r.error);
  else say('Jika email terdaftar, tautan reset sudah dikirim. Periksa kotak masuk Anda.', 'ok');
});

$('register').addEventListener('click', e => { e.preventDefault(); $('su-msg').hidden = true; show('signup'); });
$('su-back').addEventListener('click', e => { e.preventDefault(); show('login'); });
$('signup-form').addEventListener('submit', async e => {
  e.preventDefault();
  const sm = (t, k) => { const m = $('su-msg'); m.textContent = t || ''; m.className = 'msg ' + (k || ''); m.hidden = !t; };
  const fe = (id, t) => { const x = $(id); x.textContent = t || ''; x.hidden = !t; };
  sm('');
  const name = $('su-name').value.replace(/\s+/g, ' ').trim(), email = $('su-email').value.trim(), pw = $('su-pw').value, pw2 = $('su-pw2').value, agree = $('su-agree').checked;
  const issues = [name.length < 2 ? 'Isi nama lengkap (minimal 2 huruf).' : '', emailOk(email) ? '' : 'Masukkan email yang valid.', passwordIssue(pw, email), pw && pw2 !== pw ? 'Ulangi password dengan benar.' : (pw2 ? '' : 'Ulangi password.'), agree ? '' : 'Centang persetujuan dulu.'];
  ['su-name-err', 'su-email-err', 'su-pw-err', 'su-pw2-err', 'su-agree-err'].forEach((id, i) => fe(id, issues[i]));
  if (issues.some(Boolean)) return;
  const btn = $('su-btn'); btn.disabled = true; btn.firstElementChild.textContent = 'Memproses…';
  const r = await signUp({ name, email, password: pw });
  btn.disabled = false; btn.firstElementChild.textContent = 'Daftar';
  if (!r.ok) { sm(r.error); return; }
  $('su-pw').value = $('su-pw2').value = '';
  if (r.confirm) { sm('Pendaftaran diterima. Kami mengirim tautan konfirmasi ke ' + email + '. Buka email itu (periksa juga folder spam), lalu masuk.', 'ok'); return; }
  toast('Akun dibuat. Selamat datang.'); enterApp();
});

/* ===== Tampilan yang diatur Super Admin (foto latar, font, ikon); bila kosong: bg-masjid.jpg atau ilustrasi bawaan ===== */
initBranding();
$('open-privacy').addEventListener('click', e => { e.preventDefault(); setProfilStart('privasi'); openDirectory('login', () => show('login'), 'profil'); });
$('scroll-explore').addEventListener('click', e => { e.preventDefault(); $('explore').scrollIntoView({ behavior: 'smooth', block: 'start' }); });

/* ===== Direktori publik ===== */
$('open-directory').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'dir'); });
$('open-agenda').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'info'); });
$('open-world').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'world'); });
$('open-rukun').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'rukun'); });
$('open-berita').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'berita'); });
$('open-jadwal').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'jadwal'); });
$('open-ramadan').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'ramadan'); });
$('open-kiblat').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'kiblat'); });
$('open-notif').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'notif'); });
$('open-market').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'market'); });
$('open-tracker').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'tracker'); });
$('open-asma').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'asma'); });
$('open-belajar').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'belajar'); });
$('open-sunnah').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'sunnah'); });
$('open-doa').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'doa'); });
$('open-dzikir').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'dzikir'); });
$('open-history').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'sejarah'); });
$('open-quran').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'quran'); });
$('open-calendar').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'cal'); });

/* Bilah menu bawah (tetap di bawah saat digulir), isinya mengikuti peran:
   Jamaah: Beranda, Al-Qur'an, Masjid, Agenda, Akun | Admin Masjid: Beranda, Pengurus, Keuangan, Agenda, Lainnya
   Super Admin: Beranda, Masjid, Pengguna, Audit, Akun */
const appTab = (id, label, ic, onclick, selected) => h('button', { id, class: 'atab', type: 'button', role: 'tab', 'aria-selected': String(!!selected), onclick }, icon(ic), h('span', {}, label));
const toHome = () => { enterApp(); window.scrollTo(0, 0); };
const navTap = t => t.home ? toHome() : t.tab ? go(t.tab) : runAct(t.act);
let navKindShown = '';
function setNav(kind) {
  if (kind === navKindShown) return;
  navKindShown = kind; setNavKind(kind);
  $('app-nav').replaceChildren(...navItems().map(t => appTab(t.id, t.label, t.ic, () => navTap(t), !!t.home)));
}
setHomeBack(() => enterApp());
setNav('jamaah');

/* Logo/nama di pojok kiri atas = kembali ke beranda */
$('home-app').addEventListener('click', e => { e.preventDefault(); enterApp(); window.scrollTo(0, 0); });
$('home-public').addEventListener('click', e => { e.preventDefault(); $('public-back').click(); window.scrollTo(0, 0); });

/* ===== Reset password ===== */
$('reset-form').addEventListener('submit', async e => {
  e.preventDefault();
  const p1 = $('new-pw').value, p2 = $('new-pw2').value, m = $('reset-msg');
  const bad = t => { m.textContent = t; m.className = 'msg'; m.hidden = false; };
  if (p1.length < 8) return bad('Password minimal 8 karakter.');
  if (p1 !== p2) return bad('Konfirmasi password tidak sama.');
  if (!getSession()) return bad('Tautan kedaluwarsa. Minta tautan reset baru.');
  m.hidden = true;
  const btn = $('reset-btn'); btn.disabled = true;
  const r = await updatePassword(p1);
  btn.disabled = false;
  if (!r.ok) return bad(r.error);
  $('new-pw').value = ''; $('new-pw2').value = '';
  toast('Password berhasil diganti.');
  enterApp();
});

/* ===== Logout ===== */
$('logout-btn').addEventListener('click', async () => {
  await signOut();
  clearApp(); show('login'); loginFeed();
});

/* ===== Agenda terdekat di halaman masuk (tanpa login) ===== */
function loginFeed() {
  $('login-feed').replaceChildren(feedPanel({
    limit: 3, only: 'agenda',
    onOpen: m => openMosque(m, 'login', () => show('login')),
    more: h('p', { class: 'muted center' }, h('a', { href: '#', class: 'link', onclick: e => { e.preventDefault(); openDirectory('login', () => show('login'), 'info'); } }, 'Lihat semua agenda & pengumuman'))
  }));
}

/* ===== Tombol Kembali bawaan HP / peramban =====
   Dari halaman fitur: kembali ke Beranda. Di Beranda atau halaman masuk: tekan dua kali untuk keluar. */
let exitArmed = 0;
const guard = () => { try { history.pushState({ baituna: 1 }, '', location.href); } catch (e) {} };
const shown = id => { const e = $(id); return !!e && !e.hidden; };
function handleBack() {
  if (shown('view-public')) { $('public-back').click(); return true; }
  if (shown('view-signup')) { $('su-back').click(); return true; }
  if (shown('view-app') && !$('hh')) { enterApp(); window.scrollTo(0, 0); return true; }
  return shown('view-splash') || shown('view-reset');
}
addEventListener('popstate', () => {
  if (handleBack()) { guard(); return; }
  const now = Date.now();
  if (now - exitArmed < 2500) { exitArmed = 0; history.back(); return; }
  exitArmed = now; toast('Tekan Kembali sekali lagi untuk keluar'); guard();
});
guard();

/* ===== Start ===== */
async function start() {
  const wait = new Promise(r => setTimeout(r, 900)); // agar splash tidak berkedip
  restoreSession();
  let link = null;
  try { link = await readEmailLink(); } catch (e) {}
  if (getSession() && !(link && link.recovery)) {
    try { if (!(await validToken())) setSession(null); } catch (e) { setSession(null); }
  }
  await wait;
  if (link && link.recovery) { show('reset'); return; }
  if (getSession()) { enterApp(); return; }
  show('login'); loginFeed();
  if (link && link.error) say(link.error);
}

const bar = $('offline-bar');
const syncOnline = () => { bar.hidden = navigator.onLine; };
addEventListener('online', syncOnline); addEventListener('offline', syncOnline); syncOnline();
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
start();

import './push-service.js';
import { onAdzan, nowPlaying } from './adzan-service.js';
import { load as loadNotifSettings } from './notif-service.js';
// Dibuka dari notifikasi push adzan: bila masih baru (<= 10 menit), putar adzan (atau tampilkan tombol "Putar adzan" bila peramban menahan suara).
function adzanFromPush(key, t) {
  if (!['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].includes(key) || !Number.isFinite(t)) return;
  const age = Date.now() - t; if (age < -60000 || age > 10 * 60000 || nowPlaying()) return;
  const S = loadNotifSettings(); if (S.adzan && S.adzan.on) onAdzan(S, key);
}
try {
  const q = new URLSearchParams(location.search);
  if (q.has('adzan')) { const k = q.get('adzan'), t = Number(q.get('t')); history.replaceState(null, '', location.pathname); adzanFromPush(k, t); }
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', ev => { const d = ev.data; if (d && d.type === 'baituna-adzan') adzanFromPush(String(d.key), Number(d.t)); });
} catch (e) { /* abaikan */ }

armReminders(); // pengingat HP hanya aktif jika pengguna mengizinkan, dan hanya selama aplikasi terbuka
