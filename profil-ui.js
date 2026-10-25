// BAITUNA - profil-ui.js
// Halaman Profil & Pengaturan. Bagian akun (nama, telepon, password) hanya untuk yang sudah masuk.
// Favorit, progres, dan pengaturan tampilan hanya tersimpan di perangkat ini (tidak dikirim ke server).
import { clearOfflineQuran } from './quran-service.js';
import { clearAudioCache } from './adzan-service.js';
import { disable as disablePush } from './push-service.js';
import { h, toast, hint, ask } from './ui.js';
import { icon, ICONS } from './feed-ui.js';
import { saranPage } from './saran-ui.js';
import { getSession } from './supabase.js';
import { loadAccess, ROLE_LABEL } from './permissions.js';
import { getMyProfile, updateMyProfile, changePassword, saveAvatar, deleteAvatar, avatarUrl, cleanName, nameOk, phoneOk, initials, passwordProblem } from './profile-service.js';
import { prepareAvatar, AVATAR_ERRORS } from './photo.js';
import { doaPage } from './doa-ui.js';
import { loadFavs } from './doa-service.js';
import { loadProgress, loadTasbih, loadSound, saveSound } from './dzikir-service.js';
import { canSound, chime } from './dzikir-sound.js';
import { READING_SIZES, readingPrefs, saveReadingPrefs, lastRead } from './quran-ui.js';
import { listSurahs } from './quran-service.js';
import { legalView } from './page-ui.js';

export const APP_VERSION = 'v179';
// Semua data yang disimpan di perangkat (tanpa sesi masuk). Dihapus lewat "Hapus data di perangkat ini".
const DEVICE_KEYS = ['baituna.dzikir.v1', 'baituna.tasbih.v1', 'baituna.sound.v1', 'baituna.loc.v1', 'baituna.doa.fav.v1', 'baituna.sunnah.v1', 'baituna.belajar.v1', 'baituna.asma.v1', 'baituna.zakat.v1', 'baituna.tracker.v1', 'baituna.quranpref.v1', 'baituna.qari.v1', 'baituna.quranlast.v1', 'baituna.quranpage.v1', 'baituna.mushaftheme.v1', 'baituna.mushafawake.v1', 'baituna.mushafswipe.v1', 'baituna.quranmode.v1', 'baituna.notif.v1', 'baituna.notifseen.v1', 'baituna.ramadan.v1', 'baituna.ramadancache.v1', 'baituna.adzanlib.v1', 'baituna.push.v1', 'baituna.qa.v1', 'baituna.qa.vote.v1', 'baituna.books.v1', 'baituna.brand.v1'];
const SIZE_LABEL = ['Kecil', 'Sedang', 'Besar', 'Lebih besar', 'Terbesar'];

// Lingkaran foto profil: inisial dulu, lalu diganti foto bila ada (foto privat diunduh dengan token pengguna).
function avatarEl(name, email, path, extra) {
  const el = h('span', { class: 'pav' + (extra ? ' ' + extra : '') }, initials(name, email));
  if (path) avatarUrl(path).then(url => { if (url && el.isConnected !== false) { el.replaceChildren(h('img', { src: url, alt: 'Foto profil' })); el.classList.add('has-img'); } }).catch(() => {});
  return el;
}

let startView = null;
// Membuka Profil langsung di subhalaman tertentu (mis. 'privasi' dari halaman masuk). Dipakai sekali.
export const setProfilStart = v => { startView = v; };

export function profilPage({ onSignIn, onLogout } = {}) {
  const wrap = h('div', { class: 'profil' });
  startView = null;
  const me = (getSession() || {}).user || null;
  let view = startView || 'main', profile = null, access = null, loadErr = false;

  const row = (ic, label, onclick, extra) => h('button', { class: 'prow', type: 'button', onclick },
    h('span', { class: 'prow-ic' }, icon(ic)), h('span', { class: 'prow-tx' }, label), extra || '', icon(ICONS.chev, 'prow-chev'));
  const back = () => h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { view = 'main'; draw(); window.scrollTo(0, 0); } }, '← Kembali');
  const sub = (title, ...kids) => [back(), h('h2', { class: 'wtitle' }, title), ...kids];
  const go = v => () => { view = v; draw(); window.scrollTo(0, 0); };

  /* --- Kartu profil --- */
  function headCard() {
    if (!me) {
      return h('div', { class: 'panel pcard' }, h('span', { class: 'pav' }, icon(ICONS.user)),
        h('div', { class: 'pwho' }, h('b', {}, 'Tamu'), h('span', { class: 'muted' }, 'Belum masuk. Masuk untuk mengelola akun pengurus.')),
        h('button', { class: 'btn-sm', type: 'button', onclick: () => onSignIn && onSignIn() }, 'Masuk'));
    }
    const roles = !access ? [] : access.isAdmin ? ['Super Admin'] : access.memberships.map(m => (ROLE_LABEL[m.role] || m.role) + (m.mosques ? ' · ' + m.mosques.name : ''));
    const name = profile && cleanName(profile.full_name);
    const card = h('button', { class: 'panel pcard pcard-btn', type: 'button', onclick: go('edit'), 'aria-label': 'Ubah profil' },
      avatarEl(name, me.email, profile && profile.avatar_path),
      h('div', { class: 'pwho' }, h('b', {}, name || 'Nama belum diisi'), h('span', { class: 'muted' }, me.email || ''),
        roles.length ? h('div', { class: 'proles' }, ...roles.map(r => h('span', { class: 'hperiod' }, r))) : ''),
      h('span', { class: 'pedit', 'aria-hidden': 'true' }, 'Edit Profil'));
    return card;
  }

  /* --- Edit profil --- */
  function editView() {
    const name = h('input', { class: 'in', value: (profile && profile.full_name) || '', maxlength: '120', placeholder: 'mis. Budi Santoso', autocomplete: 'name', 'aria-label': 'Nama lengkap' });
    const phone = h('input', { class: 'in', value: (profile && profile.phone) || '', maxlength: '30', placeholder: 'mis. 0812 3456 7890 (bisa dipakai untuk masuk)', inputmode: 'tel', autocomplete: 'tel', 'aria-label': 'Nomor telepon' });
    const email = h('input', { class: 'in', value: me.email || '', disabled: 'disabled', 'aria-label': 'Email' });
    const status = h('p', { class: 'hint' });
    const save = h('button', { class: 'btn-sm', type: 'submit' }, 'Simpan');
    // Foto profil: langsung diunggah saat dipilih (tidak menunggu tombol Simpan), maksimal 100 KB.
    const holder = h('div', { class: 'avwrap' }), avMsg = h('p', { class: 'hint', role: 'status' });
    let busy = false;
    const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'sr-only', 'aria-label': 'Pilih foto profil' });
    const pick = h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => file.click() }, 'Pilih foto');
    const del = h('button', { class: 'btn-sm ghost', type: 'button' }, 'Hapus foto');
    const paintAv = () => {
      holder.replaceChildren(avatarEl(cleanName(name.value), me.email, profile && profile.avatar_path, 'pav-lg'));
      del.hidden = !(profile && profile.avatar_path); pick.textContent = profile && profile.avatar_path ? 'Ganti foto' : 'Pilih foto';
      pick.disabled = del.disabled = busy;
    };
    file.addEventListener('change', async () => {
      const f = file.files && file.files[0]; file.value = ''; if (!f || busy) return;
      busy = true; avMsg.textContent = 'Memproses foto…'; paintAv();
      try {
        const img = await prepareAvatar(f);
        const path = await saveAvatar(me.id, img.blob, profile && profile.avatar_path);
        profile = { ...(profile || {}), avatar_path: path }; avMsg.textContent = ''; toast('Foto profil disimpan.');
      } catch (e) {
        if (e && e.status === 401) return;
        avMsg.textContent = e && e.code && AVATAR_ERRORS[e.code] ? AVATAR_ERRORS[e.code] : e && e.status === 0 ? 'Tidak ada koneksi internet.' : 'Foto belum tersimpan. ' + hint(e);
      }
      busy = false; paintAv();
    });
    del.addEventListener('click', async () => {
      if (busy || !(await ask({ title: 'Hapus foto profil?', text: 'Foto Anda akan dihapus. Yang tampil kembali berupa inisial.', reason: false }))) return;
      busy = true; paintAv();
      try { await deleteAvatar(me.id, profile && profile.avatar_path); profile = { ...profile, avatar_path: null }; avMsg.textContent = ''; toast('Foto dihapus.'); }
      catch (e) { if (e && e.status === 401) return; avMsg.textContent = 'Foto belum terhapus. ' + hint(e); }
      busy = false; paintAv();
    });
    name.addEventListener('input', () => { if (!(profile && profile.avatar_path)) paintAv(); });
    const avBlock = h('div', { class: 'avblock' }, holder, h('div', { class: 'avact' }, h('div', { class: 'row-btns' }, pick, del, file),
      h('p', { class: 'muted avnote' }, 'Maksimal 100 KB. Foto dipotong persegi dan diperkecil otomatis.'), avMsg));
    paintAv();
    const form = h('form', { class: 'panel rform', novalidate: 'novalidate', onsubmit: async ev => {
      ev.preventDefault();
      const f = { full_name: cleanName(name.value), phone: phone.value.trim() };
      if (!nameOk(f.full_name)) { toast('Nama 2 sampai 120 huruf.', true); return; }
      if (!phoneOk(f.phone)) { toast('Nomor telepon tidak valid (angka, +, spasi, tanda hubung; minimal 6 angka).', true); return; }
      save.disabled = true;
      try { profile = await updateMyProfile(me.id, f); toast('Profil disimpan.'); view = 'main'; draw(); window.scrollTo(0, 0); return; }
      catch (e) { if (e && e.status === 401) return; const m = e && e.status === 0 ? 'Tidak ada koneksi internet.' : (e && (e.status === 409 || e.code === '23505')) ? 'Nomor HP ini sudah dipakai akun lain.' : 'Belum tersimpan. ' + hint(e); status.textContent = m; toast(m, true); }
      save.disabled = false;
    } }, avBlock, h('label', { class: 'hint' }, 'Nama lengkap'), name, h('label', { class: 'hint' }, 'Nomor telepon'), phone,
      h('label', { class: 'hint' }, 'Email (tidak bisa diubah di sini)'), email, status, h('div', { class: 'mt row-btns' }, save));
    return sub('Ubah Profil', form, h('div', { class: 'panel plist' }, row(ICONS.lock, 'Ganti password', go('password'))));
  }

  // Kolom password dengan ikon mata (tampilkan / sembunyikan)
  const EYE = '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>';
  const EYE_OFF = '<path d="M3 3l18 18"/><path d="M10.6 6.2A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.4 7.6C3.8 9.4 2 12 2 12s3.5 6 10 6c1.6 0 3-.4 4.2-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>';
  function pwBox(input) {
    const btn = h('button', { class: 'pw-eye', type: 'button' });
    const sync = () => { const on = input.type === 'text'; btn.replaceChildren(icon(on ? EYE_OFF : EYE)); btn.setAttribute('aria-label', on ? 'Sembunyikan password' : 'Tampilkan password'); btn.setAttribute('aria-pressed', on ? 'true' : 'false'); };
    btn.addEventListener('click', () => { input.type = input.type === 'password' ? 'text' : 'password'; sync(); input.focus(); });
    sync();
    return h('div', { class: 'pw-box' }, input, btn);
  }

  function passwordView() {
    const cur = h('input', { class: 'in', type: 'password', autocomplete: 'current-password', placeholder: 'Password saat ini', 'aria-label': 'Password saat ini' });
    const n1 = h('input', { class: 'in', type: 'password', autocomplete: 'new-password', placeholder: 'Password baru (minimal 8 karakter)', 'aria-label': 'Password baru' });
    const n2 = h('input', { class: 'in', type: 'password', autocomplete: 'new-password', placeholder: 'Ulangi password baru', 'aria-label': 'Ulangi password baru' });
    const status = h('p', { class: 'hint', role: 'alert' });
    const save = h('button', { class: 'btn-sm', type: 'submit' }, 'Ganti password');
    const form = h('form', { class: 'panel rform', novalidate: 'novalidate', onsubmit: async ev => {
      ev.preventDefault(); status.textContent = '';
      const p = passwordProblem(cur.value, n1.value, n2.value); if (p) { status.textContent = p; return; }
      save.disabled = true;
      const r = await changePassword(cur.value, n1.value);
      if (r.ok) { toast('Password berhasil diganti.'); cur.value = n1.value = n2.value = ''; view = 'main'; draw(); window.scrollTo(0, 0); return; }
      status.textContent = r.error; save.disabled = false;
    } }, pwBox(cur), pwBox(n1), pwBox(n2), status, h('div', { class: 'mt row-btns' }, save));
    return sub('Ganti Password', h('p', { class: 'muted' }, 'Untuk keamanan, masukkan password saat ini lebih dulu.'), form);
  }

  /* --- Favorit (doa) --- */
  const favView = () => sub('Favorit', h('p', { class: 'muted' }, 'Doa yang Anda tandai ★. Tersimpan di perangkat ini.'), doaPage({ cat: 'favorit' }));

  /* --- Progres di perangkat ini --- */
  function progresView() {
    const prog = loadProgress(), counted = Object.values(prog.c || {}).filter(n => Number(n) > 0).length;
    const t = loadTasbih(), last = lastRead(), favs = loadFavs().length;
    const lastEl = h('b', {}, last ? 'Surat ' + last.n + ', ayat ' + last.ayah : 'Belum ada');
    if (last) listSurahs().then(s => { const x = s.find(v => v.number === last.n); if (x) lastEl.textContent = x.latin + ' [' + last.n + '], ayat ' + last.ayah; }).catch(() => {});
    const stat = (label, el) => h('div', { class: 'pstat' }, h('span', { class: 'muted' }, label), el);
    return sub('Progres Saya',
      h('p', { class: 'muted' }, 'Ringkasan aktivitas Anda. Semua hanya tersimpan di perangkat ini dan tidak dikirim ke server.'),
      h('div', { class: 'panel' },
        stat('Dzikir pagi/petang hari ini', h('b', {}, counted + ' bacaan sudah dihitung')),
        stat('Hitungan Tasbih sekarang', h('b', {}, String(t.count))),
        stat('Terakhir dibaca di Al-Qur’an', lastEl),
        stat('Doa favorit', h('b', {}, favs + ' doa'))));
  }

  /* --- Pengaturan --- */
  function settingsView() {
    const p = readingPrefs(); let sound = loadSound();
    const sizeBox = h('div', { class: 'achips', role: 'group', 'aria-label': 'Ukuran tulisan Arab' });
    const fontBox = h('div', { class: 'achips', role: 'group', 'aria-label': 'Gaya tulisan Arab' });
    const paint = () => {
      sizeBox.replaceChildren(...READING_SIZES.map((s, i) => h('button', { class: 'achip', type: 'button', 'aria-pressed': String(p.size === s), 'aria-selected': String(p.size === s), onclick: () => { p.size = s; saveReadingPrefs(p); paint(); } }, SIZE_LABEL[i])));
      fontBox.replaceChildren(...[['amiri', 'Amiri Quran'], ['sch', 'Scheherazade']].map(([k, l]) => h('button', { class: 'achip', type: 'button', 'aria-pressed': String(p.font === k), 'aria-selected': String(p.font === k), onclick: () => { p.font = k; saveReadingPrefs(p); paint(); } }, l)));
    };
    paint();
    const opt = (label, checked, onchange) => { const cb = h('input', { type: 'checkbox' }); cb.checked = checked; cb.addEventListener('change', () => onchange(cb.checked)); return h('label', { class: 'dopt' }, cb, h('span', {}, label)); };
    const sounds = canSound()
      ? [opt('Bunyi lonceng saat target dzikir tercapai', sound.done, v => { sound = { ...sound, done: v }; saveSound(sound); if (v) chime(); }),
         opt('Bunyi detak tiap ketukan (pelan)', sound.tap, v => { sound = { ...sound, tap: v }; saveSound(sound); })]
      : [h('p', { class: 'hint' }, 'Perangkat atau peramban ini tidak mendukung bunyi.')];
    const wipe = h('button', { class: 'btn-sm alt', type: 'button', onclick: async () => {
      if (!(await ask({ title: 'Hapus data di perangkat ini?', text: 'Favorit, hitungan dzikir dan tasbih, lokasi jadwal salat, serta pengaturan tampilan dan halaman Al-Qur’an yang tersimpan untuk dibaca tanpa internet akan dihapus dari perangkat ini. Bila notifikasi push aktif, langganannya juga dimatikan dan dihapus dari server. Akun Anda tidak terpengaruh.', reason: false }))) return;
      try { await disablePush(); } catch (e) { /* abaikan */ }
      DEVICE_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } });
      await clearOfflineQuran(); await clearAudioCache();
      toast('Data di perangkat ini dihapus.'); draw();
    } }, 'Hapus data di perangkat ini');
    return sub('Pengaturan',
      h('div', { class: 'panel' }, h('h3', {}, 'Tulisan Arab'),
        h('p', { class: 'muted' }, 'Berlaku di Al-Qur’an, Rukun Islam & Iman, Dzikir, dan Doa.'), h('p', { class: 'hint' }, 'Ukuran'), sizeBox, h('p', { class: 'hint' }, 'Gaya'), fontBox),
      h('div', { class: 'panel' }, h('h3', {}, 'Bunyi'), h('div', { class: 'dopts' }, ...sounds)),
      h('div', { class: 'panel' }, h('h3', {}, 'Data di perangkat'),
        h('p', { class: 'muted' }, 'Aplikasi menyimpan favorit, hitungan dzikir, lokasi jadwal salat, dan pengaturan ini hanya di perangkat Anda.'), wipe));
  }

  /* --- Bantuan & Tentang --- */
  const FAQ = [
    ['Bagaimana jadwal salat dihitung?', 'Dihitung di HP Anda dengan rumus astronomi memakai acuan Kemenag RI. Hasilnya bisa berbeda beberapa menit dari jadwal resmi atau pengumuman masjid; ikuti jadwal masjid setempat. Buka Lainnya → Jadwal Salat.'],
    ['Apakah lokasi saya dikirim ke server?', 'Tidak. Lokasi hanya dipakai di HP Anda untuk menghitung jadwal dan menampilkan masjid terdekat, dan hanya disimpan di perangkat ini.'],
    ['Bagaimana menjadi pengurus masjid?', 'Akun pengurus dibuat lewat undangan dari Admin Masjid atau admin pusat. Gunakan email yang diundang untuk masuk. Jamaah umum bisa mendaftar sendiri lewat Daftar di halaman masuk dan langsung dapat bertanya di Tanya Jawab.'],
    ['Saya lupa password.', 'Di halaman masuk, isi email lalu pilih "Lupa password". Tautan reset dikirim ke email Anda. Jika masih bisa masuk, ganti password di Profil → Ubah Profil → Ganti password.'],
    ['Mengapa doa atau dzikir masih kosong?', 'Isi doa dan dzikir dimasukkan oleh admin pusat dengan sumber dan derajatnya, sehingga baru tampil setelah diisi.'],
    ['Apakah aplikasi membunyikan adzan atau pengingat?', 'Ya, dengan batas. Adzan dan pengingat berbunyi selama BAITUNA terbuka (menu Adzan dan Notifikasi). Agar notifikasi tetap tampil saat aplikasi tertutup, aktifkan push di Notifikasi > Pengaturan; nadanya memakai nada bawaan HP dan bisa tertunda mode hemat baterai. Jangan jadikan satu-satunya alarm ibadah.'],
    ['Bagaimana menyampaikan kritik dan saran?', 'Buka Profil lalu pilih Kritik & Saran di bawah Privasi & Disclaimer. Isi nama, email, dan pesan; pengelola membacanya langsung.']
  ];
  const helpView = () => sub('Bantuan', ...FAQ.map(([q, a]) => h('details', { class: 'panel faq' }, h('summary', {}, q), h('p', { class: 'muted' }, a))));
  const aboutView = () => sub('Tentang BAITUNA',
    h('div', { class: 'panel' }, h('h3', {}, 'BAITUNA'), h('p', { class: 'muted' }, 'Satu Masjid, Banyak Manfaat.'),
      h('p', {}, 'Platform digital untuk masjid: direktori, agenda dan pengumuman, jadwal salat, Al-Qur’an, dzikir, doa, dan bacaan Islami.'),
      h('p', { class: 'muted' }, 'Versi ' + APP_VERSION)),
    h('div', { class: 'panel' }, h('h3', {}, 'Privasi singkat'),
      h('p', { class: 'muted' }, 'Lokasi, favorit, hitungan dzikir, dan pengaturan tampilan hanya disimpan di perangkat Anda. Data akun (nama, telepon, peran) disimpan di server dan hanya bisa diubah oleh pemiliknya. Teks Al-Qur’an dimuat dari AlQuran Cloud dan tidak diubah. Konten doa, dzikir, dan artikel dimasukkan admin pusat dengan sumber yang jelas dan sebaiknya diperiksa ustaz.'),
      h('button', { class: 'btn-sm ghost', type: 'button', id: 'about-privasi', onclick: go('privasi') }, 'Baca Privasi & Disclaimer lengkap')));

  let legal = null;
  const privasiView = () => { legal = legalView('privasi', () => !!(access && access.isAdmin)); return [back(), legal]; };

  const saranView = () => [back(), saranPage({ name: (profile && cleanName(profile.full_name)) || '', email: (me && me.email) || '' })];

  function main() {
    const items = [];
    if (me) items.push(row(ICONS.user, 'Ubah profil', go('edit')), row(ICONS.lock, 'Ganti password', go('password')));
    items.push(row(ICONS.bookmark, 'Favorit', go('fav')), row(ICONS.progress, 'Progres saya', go('progres')),
      row(ICONS.gear, 'Pengaturan', go('settings')), row(ICONS.help, 'Bantuan', go('help')), row(ICONS.about, 'Tentang BAITUNA', go('about')), row(ICONS.shield, 'Privasi & Disclaimer', go('privasi')), row(ICONS.chat, 'Kritik & Saran', go('saran')));
    return [h('h2', { class: 'wtitle' }, 'Profil'), loadErr ? h('p', { class: 'hint' }, 'Data profil belum bisa dimuat. Periksa koneksi.') : '', headCard(),
      h('div', { class: 'panel plist' }, ...items),
      me ? h('button', { class: 'btn-sm alt pout', type: 'button', onclick: () => onLogout && onLogout() }, icon(ICONS.out), 'Keluar') : '',
      h('div', { class: 'panel ptag' }, h('b', {}, 'BAITUNA'), h('span', { class: 'muted' }, 'Satu Masjid, Banyak Manfaat'))];
  }

  function draw() {
    const kids = view === 'edit' && me ? editView() : view === 'password' && me ? passwordView() : view === 'fav' ? favView() : view === 'progres' ? progresView()
      : view === 'settings' ? settingsView() : view === 'help' ? helpView() : view === 'about' ? aboutView() : view === 'privasi' ? privasiView() : view === 'saran' ? saranView() : view === 'jamaah' && me ? jamaahView() : main();
    wrap.replaceChildren(...kids);
  }
  draw();
  if (me) {
    Promise.all([getMyProfile(me.id).catch(() => { loadErr = true; return null; }), loadAccess(me).catch(() => null)]).then(([p, a]) => { if (p) profile = p; access = a; if (view === 'main') draw(); else if (view === 'privasi' && legal) legal.redraw(); });
  }
  return wrap;
}
