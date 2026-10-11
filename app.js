// BAITUNA - app.js
// Titik masuk aplikasi: menyambungkan halaman login, reset password, dashboard, dan logout.
import { $, h, toast } from './ui.js';
import { show } from './router.js';
import { onSessionExpired, restoreSession, getSession, setSession, validToken } from './supabase.js';
import { signIn, signOut, requestPasswordReset, updatePassword, readEmailLink } from './auth.js';
import { loadAccess } from './permissions.js';
import { acceptMyInvitations } from './mosque-service.js';
import { renderAdmin } from './dashboard-admin.js';
import { renderMember } from './dashboard-member.js';
import { openDirectory, openMosque } from './directory.js';
import { feedPanel } from './feed-ui.js';

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
    if (access.isAdmin) await renderAdmin(box);
    else await renderMember(box, access.memberships);
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

$('register').addEventListener('click', e => {
  e.preventDefault();
  say('Akun pengurus dibuat lewat undangan admin pusat. Pendaftaran jamaah dibuka di tahap berikutnya.', 'info');
});

/* ===== Direktori publik ===== */
$('open-directory').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'dir'); });
$('open-agenda').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'info'); });
$('open-world').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'world'); });
$('open-rukun').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'rukun'); });
$('open-berita').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'berita'); });
$('open-jadwal').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'jadwal'); });
$('open-doa').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'doa'); });
$('open-dzikir').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'dzikir'); });
$('open-history').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'sejarah'); });
$('open-quran').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'quran'); });
$('open-calendar').addEventListener('click', e => { e.preventDefault(); openDirectory('login', () => show('login'), 'cal'); });
$('nav-dir').addEventListener('click', () => openDirectory('app', () => enterApp(), 'dir'));
$('nav-info').addEventListener('click', () => openDirectory('app', () => enterApp(), 'info'));
$('nav-world').addEventListener('click', () => openDirectory('app', () => enterApp(), 'world'));
$('nav-rukun').addEventListener('click', () => openDirectory('app', () => enterApp(), 'rukun'));
$('nav-berita').addEventListener('click', () => openDirectory('app', () => enterApp(), 'berita'));
$('nav-jadwal').addEventListener('click', () => openDirectory('app', () => enterApp(), 'jadwal'));
$('nav-profil').addEventListener('click', () => openDirectory('app', () => enterApp(), 'profil'));
$('nav-doa').addEventListener('click', () => openDirectory('app', () => enterApp(), 'doa'));
$('nav-dzikir').addEventListener('click', () => openDirectory('app', () => enterApp(), 'dzikir'));
$('nav-history').addEventListener('click', () => openDirectory('app', () => enterApp(), 'sejarah'));
$('nav-quran').addEventListener('click', () => openDirectory('app', () => enterApp(), 'quran'));
$('nav-cal').addEventListener('click', () => openDirectory('app', () => enterApp(), 'cal'));

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
