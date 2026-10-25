// BAITUNA - taaruf-ui.js
// BAITUNA Ta'aruf: halaman utama, ketentuan, CV bertahap (Profil -> Preferensi -> Verifikasi), rekomendasi calon (kuota 2 profil unik
// untuk pengguna gratis), detail profil, status perkenalan, agenda & topik, keputusan, keselamatan (laporan & blokir), Premium, dan Kelola (Super Admin).
// Semua data berasal dari server (taaruf.sql); tidak ada profil contoh. Tanpa foto, tanpa pendamping, tanpa unggah dokumen pada tahap ini.
import { h, toast, ask as confirmDlg } from './ui.js';
import { getSession } from './supabase.js';
import * as T from './taaruf-service.js';
import { membershipFlow } from './membership-ui.js';
import { membershipAdminPage } from './membership-admin-ui.js';
import { icon, ICONS } from './feed-ui.js';

const I = {
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  hands: '<path d="M7 11.5 10.5 8a2 2 0 0 1 2.8 0l3.2 3.2"/><path d="M3 12.5l3.5-3.5M21 12.5 17.5 9"/><path d="M6.5 13.5l3.2 3.2a1.6 1.6 0 0 0 2.3 0l4.5-4.5"/><path d="M9 15.5l-1 1M11 17.5l-1 1"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', checkc: '<circle cx="12" cy="12" r="9.5"/><path d="M7.5 12.5l3 3 6-6.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>', lock: ICONS.lock, shield: ICONS.shield, user: ICONS.user, users: ICONS.users, filter: ICONS.filter, clock: ICONS.clock,
  pin: ICONS.pin, book: ICONS.book, gear: ICONS.gear, help: ICONS.help, more: ICONS.more, eye: ICONS.eye, agenda: ICONS.agenda, chat: ICONS.chat,
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5L3 8z"/><path d="M5 21h14"/>',
  edu: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c1.5 1.5 3.5 2.2 5.5 2.2s4-.7 5.5-2.2V11M21.5 9v5"/>',
  work: '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V5.5h6v2M3.5 12.5h17"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', cake: '<path d="M4 20h16v-7H4zM4 15c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 4 0"/><path d="M12 13V9M12 6.5v.5"/>',
  id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.5 16.5c.6-1.6 2-2.4 3.5-2.4s2.9.8 3.5 2.4M14.5 10h4M14.5 13.5h3"/>',
  hourglass: '<path d="M7 3h10M7 21h10M8 3c0 4 8 5 8 9s-8 5-8 9M16 3c0 4-8 5-8 9"/>', flag: '<path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>', trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>', pause: '<path d="M9 5v14M15 5v14"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/>', note: '<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M8 12h8M8 16h5"/>',
  arch: '<path d="M4 21V11a8 8 0 0 1 16 0v10"/><path d="M8 21v-8a4 4 0 0 1 8 0v8M2 21h20"/><path d="M12 3.5V2"/>'
};
const ic = (n, cls) => icon(I[n] || n, cls);
const A = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== false));
const PREMIUM_BENEFITS = ['Lihat lebih banyak profil calon (kuota gratis: 2 profil)', 'Filter pencarian lengkap: pendidikan, kesiapan, status, nilai hidup',
  'Membaca informasi tambahan yang dibagikan pemilik CV', 'Agenda, daftar topik pembicaraan, catatan pribadi, dan usul jadwal', 'Hingga 3 proses perkenalan sekaligus (gratis: 1)',
  'Premium tidak menjamin diterima calon dan tidak membuka data pribadi tanpa izin pemiliknya'];

export function taarufPage({ go, onSignIn } = {}) {
  const wrap = h('div', { class: 'tf' });
  const S = { st: null, form: null, terms: false, recOffset: 0 };
  const draw = (...k) => { closeSheet(); wrap.replaceChildren(...k); window.scrollTo(0, 0); };
  const back = (label, fn, id) => h('button', { class: 'btn-ghost tf-back', type: 'button', id: id || 'tf-back', onclick: fn }, label);
  const btn = (text, cls, id, onclick, extra) => h('button', Object.assign({ class: cls, type: 'button', id, onclick }, extra || {}), text);
  const loading = () => draw(h('p', { class: 'muted', id: 'tf-loading' }, 'Memuat…'));
  const failView = (e, retry) => draw(back('← BAITUNA Ta’aruf', start), h('div', { class: 'empty', id: 'tf-fail' }, h('p', { class: 'muted' }, T.errorText(e)),
    T.notReady(e) ? '' : btn('Coba lagi', 'btn-sm', 'tf-retry', retry || start)));
  const chip = (t, cls) => h('span', { class: 'tf-chip ' + (cls || '') }, t);
  const avatar = (name, big) => h('span', { class: 'tf-av' + (big ? ' tf-av-lg' : ''), 'aria-hidden': 'true' }, T.initials(name));
  const prem = () => !!(S.st && S.st.premium);
  const P = () => (S.st && S.st.profile) || null;
  const info = (t, id, cls) => h('div', A({ class: 'tf-note ' + (cls || ''), id }), ic('shield', 'ic tf-nic'), h('span', {}, t));
  async function refresh() { S.st = await T.state(); return S.st; }

  /* ===== Lembar bawah (sheet) ===== */
  let ovEl = null;
  function closeSheet() { if (ovEl) { ovEl.remove(); ovEl = null; } }
  function sheet(title, id, ...kids) {
    closeSheet();
    const ov = h('div', { class: 'tf-ov', id, role: 'dialog', 'aria-modal': 'true', 'aria-label': title, onclick: e => { if (e.target === ov) closeSheet(); } },
      h('div', { class: 'tf-sheet' }, h('div', { class: 'tf-sh-head' }, h('b', {}, title), h('button', { class: 'tf-x', type: 'button', 'aria-label': 'Tutup', id: id + '-x', onclick: closeSheet }, ic('x'))), ...kids));
    document.body.append(ov); ovEl = ov; return ov;
  }

  /* ===== Masuk ===== */
  async function start() {
    if (!getSession()) { landing('tamu'); return; }
    loading();
    try { await refresh(); } catch (e) { if (T.notReady(e)) { landing('belum'); return; } failView(e); return; }
    const p = P();
    if (p && (p.status === 'aktif' || p.status === 'jeda' || p.status === 'nonaktif')) { hub(); return; }
    landing(p ? 'draf' : 'baru');
  }

  /* ===== Halaman 3: halaman utama Ta'aruf ===== */
  function landing(mode) {
    const s = S.st || {};
    const closed = s.open === false;
    const items = ['Terstruktur dan aman', 'Persetujuan dua pihak', 'Menjaga privasi (tanpa foto, kontak dibagikan atas izin Anda)', 'Diusahakan sesuai syariat'];
    const main = mode === 'tamu' ? btn('Masuk atau Daftar', 'btn-primary tf-cta', 'tf-start', () => { if (onSignIn) onSignIn(); })
      : mode === 'belum' ? h('p', { class: 'tf-warn', id: 'tf-notready' }, 'BAITUNA Ta’aruf belum aktif di server. Pengelola perlu menjalankan taaruf.sql.')
      : closed ? h('p', { class: 'tf-warn', id: 'tf-closed' }, 'BAITUNA Ta’aruf sedang ditutup sementara oleh pengelola.')
      : btn(mode === 'draf' ? 'Lanjutkan CV Ta’aruf' : 'Mulai Ta’aruf', 'btn-primary tf-cta', 'tf-start', () => { if (mode === 'draf') cvScreen(); else termsScreen(); });
    const statusRow = mode === 'draf' || mode === 'baru' ? h('div', { class: 'tf-statusrow', id: 'tf-status' },
      chip(mode === 'draf' ? 'CV: draf' : 'CV: belum dibuat', 'tf-c-off'), chip(s.verif && s.verif.identitas ? 'Identitas diperiksa' : 'Identitas belum diperiksa', s.verif && s.verif.identitas ? 'tf-c-ok' : 'tf-c-off'),
      chip(s.premium ? 'Premium' : 'Gratis', s.premium ? 'tf-c-gold' : 'tf-c-off')) : '';
    draw(h('div', { class: 'tf-hero', id: 'tf-hero' },
        h('div', { class: 'tf-brand' }, ic('arch', 'ic tf-brandic'), h('span', {}, h('b', {}, 'BAITUNA'), h('small', {}, 'Ta’aruf'))),
        h('div', { class: 'tf-arch' }, h('span', { class: 'tf-archic' }, ic('hands', 'ic')),
          h('h2', {}, 'Ikhtiar Menuju Keluarga Sakinah'), h('p', {}, 'Proses ta’aruf yang terarah, aman, dan berusaha sesuai syariat Islam.'))),
      h('div', { class: 'tf-land' },
        h('ul', { class: 'tf-checks' }, ...items.map(t => h('li', {}, ic('checkc', 'ic tf-okc'), h('span', {}, t)))),
        statusRow, main,
        btn('Pelajari Lebih Lanjut', 'btn-ghost tf-link', 'tf-learn', learnSheet),
        s.admin ? btn('Kelola Ta’aruf (Super Admin)', 'btn-sm ghost tf-cta2', 'tf-admin-entry', () => adminScreen('stat')) : '',
        h('p', { class: 'hint tf-small' }, 'Khusus usia ' + T.MIN_AGE + ' tahun ke atas. BAITUNA Ta’aruf membantu perkenalan; tidak menjanjikan jodoh atau kecocokan.')));
  }

  function learnSheet() {
    sheet('Tentang BAITUNA Ta’aruf', 'tf-learnsheet',
      h('ol', { class: 'tf-steps-list' }, ...['Lengkapi CV Ta’aruf (tanpa foto). Nama lengkap, alamat, dan nomor telepon tidak ditampilkan.',
        'Atur kriteria calon (preferensi).', 'Lihat rekomendasi calon yang sesuai. Pengguna gratis dapat membuka 2 profil calon (sekali seumur akun).',
        'Ajukan minat. Perkenalan berlanjut hanya bila calon juga setuju.', 'Bila keduanya setuju: bahas topik penting, usulkan jadwal, dan bagikan kontak (misalnya nomor wali) bila Anda mau.',
        'Libatkan wali atau keluarga, lalu putuskan: lanjut ke tahap keluarga, minta waktu, atau akhiri dengan baik.'].map(t => h('li', {}, t))),
      info('Anda bisa menolak, mengakhiri proses, melaporkan, dan memblokir kapan saja, gratis. Pendamping (ustaz/ustazah) belum tersedia pada tahap ini.'),
      h('p', { class: 'hint' }, 'Verifikasi di BAITUNA terbatas pada yang tertulis di masing-masing label. Tetap berhati-hati dan libatkan keluarga.'));
  }

  /* ===== Ketentuan ===== */
  function termsScreen() {
    const boxes = [['tf-t1', 'Saya berusia ' + T.MIN_AGE + ' tahun ke atas, tidak sedang terikat pernikahan, dan berniat menikah.'],
      ['tf-t2', 'Saya mengerti CV saya (tanpa nama lengkap, alamat, nomor telepon, dan foto) dapat dilihat calon lawan jenis yang memenuhi kriteria.'],
      ['tf-t3', 'Saya tidak akan meminta atau mengirim uang, dan akan melibatkan wali/keluarga sebelum bertemu.'],
      ['tf-t4', 'Saya mengerti BAITUNA tidak menjamin kebenaran semua data calon maupun keberhasilan perkenalan.']];
    const err = h('p', { class: 'mk-err', id: 'tf-err', role: 'alert' }, '');
    const inputs = boxes.map(([id]) => h('input', { type: 'checkbox', id }));
    draw(back('← BAITUNA Ta’aruf', start), h('h2', { class: 'wtitle' }, 'Ketentuan BAITUNA Ta’aruf'),
      h('p', { class: 'muted' }, 'Bacalah dan setujui ketentuan berikut sebelum membuat CV.'),
      h('div', { class: 'panel tf-terms' }, ...boxes.map(([id, t], i) => h('label', { class: 'tf-check', for: id }, inputs[i], h('span', {}, t)))),
      err, btn('Saya Setuju, Buat CV', 'btn-primary tf-cta', 'tf-agree', () => {
        if (!inputs.every(x => x.checked)) { err.textContent = 'Centang semua ketentuan untuk melanjutkan.'; return; }
        S.terms = true; cvScreen();
      }));
  }

  /* ===== Langkah (stepper) ===== */
  const steps = n => h('ol', { class: 'tf-steps', id: 'tf-steps' }, ...['Profil', 'Preferensi', 'Verifikasi'].map((t, i) =>
    h('li', A({ class: i + 1 < n ? 'done' : i + 1 === n ? 'on' : '', 'aria-current': i + 1 === n ? 'step' : null }), h('span', { class: 'tf-sn' }, i + 1 < n ? ic('check') : String(i + 1)), h('span', {}, t))));

  /* ===== Halaman 4: CV ===== */
  function formFrom(p) {
    p = p || {};
    return { display_name: p.display_name || '', gender: p.gender || '', birth_date: p.birth_date || '', province: p.province || '', city: p.city || '', education: p.education || '',
      job: p.job || '', marital: p.marital || '', dependents: p.dependents || '', readiness: p.readiness || '', residence: p.residence || '', kids: p.kids || '',
      about: p.about || '', family_hope: p.family_hope || '', vision: p.vision || '', extra: p.extra || '', life_values: (p.life_values || []).slice(), terms: !!(p.terms_at || S.terms) };
  }
  function cvScreen() {
    const p = P(), published = p && p.status !== 'draf';
    const f = S.form = formFrom(p);
    const err = h('p', { class: 'mk-err', id: 'tf-err', role: 'alert' }, '');
    const lab = (t, id, req) => h('label', { class: 'tf-lab', for: id }, t, req ? h('span', { class: 'tf-req' }, ' *') : '');
    const inp = (id, key, attrs) => { const e = h('input', Object.assign({ class: 'in', id, 'data-k': key }, attrs || {})); e.value = f[key] || ''; e.addEventListener('input', () => { f[key] = e.value; }); return e; };
    const area = (id, key, max, ph) => { const e = h('textarea', { class: 'in tf-ta', id, 'data-k': key, maxlength: String(max), rows: '4', placeholder: ph || '' }); e.value = f[key] || ''; e.addEventListener('input', () => { f[key] = e.value; }); return e; };
    const sel = (id, key, list, ph) => { const e = h('select', { class: 'in', id, 'data-k': key }, h('option', { value: '' }, ph || 'Pilih…'), ...list.map(([v, t]) => h('option', { value: v }, t))); e.value = f[key] || ''; e.addEventListener('change', () => { f[key] = e.value; }); return e; };
    const today = new Date(), maxBirth = new Date(today.getFullYear() - T.MIN_AGE, today.getMonth(), today.getDate());
    const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const genderBox = h('div', { class: 'tf-seg', id: 'tf-gender', role: 'radiogroup', 'aria-label': 'Jenis kelamin' }, ...[['L', 'Laki-laki (ikhwan)'], ['P', 'Perempuan (akhwat)']].map(([v, t]) => {
      const r = h('input', { type: 'radio', name: 'tf-g', value: v, id: 'tf-g-' + v }); r.checked = f.gender === v; if (published) r.disabled = true;
      r.addEventListener('change', () => { f.gender = v; }); return h('label', { class: 'tf-segi', for: 'tf-g-' + v }, r, h('span', {}, t));
    }));
    const values = chipGroup('tf-values', T.VALUES, f.life_values, false);
    const save = async publishNext => {
      const v = T.validateProfile(f, true);
      if (v.error && publishNext) { err.textContent = v.error; const el = wrap.querySelector('[data-k="' + v.field + '"]'); if (el) el.focus(); return; }
      const vb = T.validateProfile(f, false);
      if (vb.error) { err.textContent = vb.error; const el = wrap.querySelector('[data-k="' + vb.field + '"]'); if (el) el.focus(); return; }
      err.textContent = '';
      const b1 = wrap.querySelector('#tf-cv-next'), b2 = wrap.querySelector('#tf-cv-save'); b1.disabled = b2.disabled = true;
      try {
        await T.saveProfile(payload(f), published);
        await refresh();
        toast(published ? 'CV diperbarui.' : 'CV tersimpan sebagai draf.');
        if (publishNext) prefsScreen(true); else start();
      } catch (e) { err.textContent = T.errorText(e); b1.disabled = b2.disabled = false; }
    };
    draw(back(published ? '← BAITUNA Ta’aruf' : '← Kembali', published ? hub : start), h('h2', { class: 'wtitle' }, published ? 'CV Ta’aruf Saya' : 'Lengkapi CV Ta’aruf'),
      published ? '' : steps(1),
      info('Yang dilihat calon: nama tampilan, usia, kota/provinsi, pendidikan, pekerjaan, dan isian di bawah. Nama lengkap, alamat, nomor telepon, dan foto TIDAK ditampilkan.', 'tf-who'),
      h('div', { class: 'panel tf-form', id: 'tf-form' }, h('h3', {}, 'Data Diri'),
        lab('Nama tampilan', 'tf-name', true), inp('tf-name', 'display_name', { maxlength: '40', placeholder: 'Boleh nama panggilan, mis. Ahmad F.', autocomplete: 'off' }),
        lab('Jenis kelamin', 'tf-g-L', true), genderBox, published ? h('p', { class: 'hint' }, 'Jenis kelamin tidak bisa diubah setelah CV diterbitkan.') : '',
        lab('Tanggal lahir', 'tf-birth', true), inp('tf-birth', 'birth_date', { type: 'date', max: iso(maxBirth), min: '1940-01-01' }), h('p', { class: 'hint' }, 'Yang ditampilkan hanya usia. Minimal ' + T.MIN_AGE + ' tahun.'),
        lab('Provinsi domisili', 'tf-prov', true), sel('tf-prov', 'province', T.PROVINCES.map(x => [x, x]), 'Pilih provinsi…'),
        lab('Kota/kabupaten', 'tf-city', true), inp('tf-city', 'city', { maxlength: '60', placeholder: 'Mis. Bandung' }),
        lab('Pendidikan terakhir', 'tf-edu', true), sel('tf-edu', 'education', T.EDU),
        lab('Pekerjaan', 'tf-job'), inp('tf-job', 'job', { maxlength: '60', placeholder: 'Mis. Guru, Wirausaha' }),
        lab('Status pernikahan', 'tf-marital', true), sel('tf-marital', 'marital', T.MARITAL),
        lab('Tanggungan (opsional)', 'tf-dep'), inp('tf-dep', 'dependents', { maxlength: '200', placeholder: 'Mis. membiayai adik sekolah' })),
      h('div', { class: 'panel tf-form' }, h('h3', {}, 'Kesiapan & Rencana'),
        lab('Kesiapan menikah', 'tf-ready', true), sel('tf-ready', 'readiness', T.READY),
        lab('Rencana tempat tinggal', 'tf-res'), sel('tf-res', 'residence', T.RESIDENCE, 'Belum ditentukan'),
        lab('Harapan tentang anak', 'tf-kids'), sel('tf-kids', 'kids', T.KIDS, 'Belum ditentukan')),
      h('div', { class: 'panel tf-form' }, h('h3', {}, 'Tentang & Harapan'),
        lab('Tentang saya', 'tf-about', true), area('tf-about', 'about', 800, 'Ceritakan diri Anda dengan jujur dan santun (minimal 30 huruf).'),
        lab('Harapan tentang kehidupan keluarga', 'tf-hope'), area('tf-hope', 'family_hope', 800, 'Mis. keluarga yang saling mendukung dalam ibadah.'),
        lab('Visi dan tujuan hidup', 'tf-vision'), area('tf-vision', 'vision', 800, ''),
        h('span', { class: 'tf-lab' }, 'Nilai dan gaya hidup'), values),
      h('div', { class: 'panel tf-form' }, h('h3', {}, 'Informasi Tambahan (opsional)'),
        h('p', { class: 'hint' }, 'Hanya bisa dibaca calon yang berlangganan Ta’aruf Premium dan sudah membuka profil Anda. Jangan menulis kontak.'),
        area('tf-extra', 'extra', 800, 'Mis. hafalan, kegiatan, hal yang ingin calon ketahui.')),
      err,
      btn(published ? 'Simpan Perubahan' : 'Lanjutkan', 'btn-primary tf-cta', 'tf-cv-next', () => published ? save(false) : save(true)),
      h('div', { class: 'row-btns mt' }, published ? '' : btn('Simpan dan lanjut nanti', 'btn-sm ghost', 'tf-cv-save', () => save(false)), btn('Pratinjau profil', 'btn-sm ghost', 'tf-cv-preview', () => previewSheet(f))),
      published ? manageBox(p) : '');
    if (!wrap.querySelector('#tf-cv-save')) wrap.querySelector('.row-btns').prepend(h('span', { id: 'tf-cv-save', hidden: true }));
  }
  function payload(f) {
    return { display_name: f.display_name.trim(), gender: f.gender, birth_date: f.birth_date, province: f.province, city: f.city.trim(), education: f.education, job: f.job.trim(),
      marital: f.marital, dependents: f.dependents.trim(), readiness: f.readiness, residence: f.residence, kids: f.kids, about: f.about.trim(), family_hope: f.family_hope.trim(),
      vision: f.vision.trim(), extra: f.extra.trim(), life_values: f.life_values, terms: !!f.terms };
  }
  function chipGroup(id, list, arr, locked) {
    return h('div', { class: 'tf-chips' + (locked ? ' tf-locked' : ''), id, role: 'group' }, ...list.map(([v, t]) => {
      const b = h('button', { class: 'tf-pick' + (arr.includes(v) ? ' on' : ''), type: 'button', 'data-v': v, 'aria-pressed': String(arr.includes(v)) }, ic('check', 'ic tf-pickic'), t);
      if (locked) b.disabled = true;
      b.addEventListener('click', () => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); b.classList.toggle('on', i < 0); b.setAttribute('aria-pressed', String(i < 0)); });
      return b;
    }));
  }
  function manageBox(p) {
    const paused = p.status === 'jeda';
    return h('div', { class: 'panel tf-manage', id: 'tf-manage' }, h('h3', {}, 'Kelola profil'),
      h('p', { class: 'muted' }, paused ? 'Profil sedang dijeda: tidak tampil di rekomendasi. Proses yang sudah berjalan tetap ada.' : 'Profil aktif dan tampil di rekomendasi calon yang sesuai.'),
      h('div', { class: 'row-btns' },
        btn(paused ? 'Aktifkan lagi' : 'Jeda profil', 'btn-sm', 'tf-pause', async () => {
          try { await T.setStatus(paused ? 'aktif' : 'jeda'); await refresh(); toast(paused ? 'Profil aktif kembali.' : 'Profil dijeda.'); cvScreen(); } catch (e) { toast(T.errorText(e), true); }
        }),
        btn('Hapus CV Ta’aruf', 'btn-sm alt', 'tf-delete', async () => {
          if (!(await confirmDlg({ title: 'Hapus CV Ta’aruf?', text: 'CV, preferensi, dan catatan pribadi Anda dihapus. Proses perkenalan yang berjalan akan diakhiri. Tindakan ini tidak bisa dibatalkan.' }))) return;
          try { await T.deleteProfile(); await refresh(); toast('CV Ta’aruf dihapus.'); start(); } catch (e) { toast(T.errorText(e), true); }
        })));
  }
  function previewSheet(f) {
    const age = T.ageOf(f.birth_date);
    sheet('Pratinjau: begini calon melihat profil Anda', 'tf-preview', profileBody({ name: f.display_name || '(nama tampilan)', age, city: f.city, province: f.province, education: f.education, job: f.job,
      readiness: f.readiness, marital: f.marital, dependents: f.dependents, residence: f.residence, kids: f.kids, about: f.about, family_hope: f.family_hope, vision: f.vision,
      life_values: f.life_values, verified: !!(S.st && S.st.verif && S.st.verif.identitas), extra: f.extra, has_extra: !!f.extra, premium: true }, true));
  }

  /* ===== Halaman 5: preferensi ===== */
  function prefsScreen(wizard) {
    const pr = (S.st && S.st.prefs) || { age_min: 19, age_max: 45, same_province: false, edu_min: null, readiness: [], marital: [], life_values: [] };
    const f = { age_min: pr.age_min, age_max: pr.age_max, same_province: !!pr.same_province, edu_min: pr.edu_min || '', readiness: (pr.readiness || []).slice(), marital: (pr.marital || []).slice(), life_values: (pr.life_values || []).slice() };
    const locked = !prem();
    const err = h('p', { class: 'mk-err', id: 'tf-err', role: 'alert' }, '');
    const ages = []; for (let a = 19; a <= 80; a++) ages.push(a);
    const ageSel = (id, key) => { const e = h('select', { class: 'in tf-age', id, 'aria-label': key === 'age_min' ? 'Usia minimal' : 'Usia maksimal' }, ...ages.map(a => h('option', { value: String(a) }, a + ' tahun'))); e.value = String(f[key]); e.addEventListener('change', () => { f[key] = Number(e.value); }); return e; };
    const same = h('input', { type: 'checkbox', id: 'tf-sameprov' }); same.checked = f.same_province; same.addEventListener('change', () => { f.same_province = same.checked; });
    const edu = h('select', { class: 'in', id: 'tf-edumin' }, ...T.EDU_MIN.map(([v, t]) => h('option', { value: v }, t))); edu.value = f.edu_min; if (locked) edu.disabled = true; edu.addEventListener('change', () => { f.edu_min = edu.value; });
    const pbox = h('div', { class: 'panel tf-form' + (locked ? ' tf-lockbox' : ''), id: 'tf-premfilters' },
      h('h3', {}, 'Filter lengkap ', h('span', { class: 'tf-prem' }, ic('crown'), 'Premium')),
      locked ? h('p', { class: 'hint', id: 'tf-premnote' }, 'Filter berikut khusus Ta’aruf Premium. Membantu menemukan calon yang lebih sesuai kriteria Anda.') : '',
      h('label', { class: 'tf-lab', for: 'tf-edumin' }, 'Pendidikan'), edu,
      h('span', { class: 'tf-lab' }, 'Kesiapan menikah'), chipGroup('tf-fready', T.READY, f.readiness, locked),
      h('span', { class: 'tf-lab' }, 'Status pernikahan calon'), chipGroup('tf-fmarital', T.MARITAL, f.marital, locked),
      h('span', { class: 'tf-lab' }, 'Nilai dan gaya hidup (salah satu cocok)'), chipGroup('tf-fvalues', T.VALUES, f.life_values, locked),
      locked ? btn('Lihat Paket Premium', 'btn-sm tf-gold', 'tf-pref-premium', () => premium()) : '');
    const saveB = btn(wizard ? 'Lanjutkan' : 'Simpan Preferensi', 'btn-primary tf-cta', 'tf-pref-save', async () => {
      if (f.age_min > f.age_max) { err.textContent = 'Usia minimal tidak boleh lebih besar dari usia maksimal.'; return; }
      saveB.disabled = true; err.textContent = '';
      try { await T.savePrefs({ ...f, edu_min: f.edu_min || null }); await refresh(); toast('Preferensi disimpan.'); if (wizard) verifyScreen(true); else recScreen(); }
      catch (e) { err.textContent = T.errorText(e); saveB.disabled = false; }
    });
    draw(back(wizard ? '← Profil' : '← BAITUNA Ta’aruf', wizard ? cvScreen : hub), h('h2', { class: 'wtitle' }, 'Preferensi Pasangan'), wizard ? steps(2) : '',
      h('div', { class: 'panel tf-form' }, h('h3', {}, 'Kriteria utama'),
        h('span', { class: 'tf-lab' }, 'Rentang usia'), h('div', { class: 'tf-agerow' }, ageSel('tf-agemin', 'age_min'), h('span', { class: 'muted' }, 'sampai'), ageSel('tf-agemax', 'age_max')),
        h('label', { class: 'tf-check', for: 'tf-sameprov' }, same, h('span', {}, 'Hanya calon dari provinsi yang sama dengan saya'))),
      pbox, info('Rekomendasi hanya memakai kriteria di atas. BAITUNA tidak menilai kesalehan atau kelayakan seseorang.'), err, saveB);
  }

  /* ===== Halaman 6: verifikasi ===== */
  function verifyScreen(wizard) {
    const s = S.st || {}, p = P() || {}, v = s.verif || {};
    const row = (iconN, title, desc, ok, id) => h('div', { class: 'tf-vrow', id }, h('span', { class: 'tf-vic' }, ic(iconN)), h('div', {}, h('b', {}, title), h('span', { class: 'muted' }, desc)),
      h('span', { class: 'tf-vst ' + (ok ? 'ok' : 'off') }, ok ? ic('check') : '–'));
    const draft = p.status === 'draf';
    const err = h('p', { class: 'mk-err', id: 'tf-err', role: 'alert' }, '');
    draw(back(wizard ? '← Preferensi' : '← BAITUNA Ta’aruf', wizard ? () => prefsScreen(true) : hub), h('h2', { class: 'wtitle' }, 'Verifikasi Akun'), wizard ? steps(3) : '',
      h('div', { class: 'tf-vlist' },
        row('mail', 'Email akun', v.email ? 'Email sudah dikonfirmasi saat mendaftar.' : 'Email belum dikonfirmasi.', !!v.email, 'tf-v-email'),
        row('cake', 'Usia', (p.age ? p.age + ' tahun' : '-') + ' — dinyatakan sendiri, belum diperiksa dengan dokumen.', !!p.age, 'tf-v-age'),
        row('id', 'Identitas', v.identitas ? 'Sudah diperiksa langsung oleh pengurus BAITUNA.' : 'Belum diperiksa. Pemeriksaan identitas dilakukan pengurus secara langsung; unggah dokumen di aplikasi belum tersedia.', !!v.identitas, 'tf-v-id')),
      info('Label "Identitas diperiksa pengurus" hanya berarti pengurus pernah mencocokkan identitas. Tidak menjamin seluruh isi CV benar.'),
      err,
      draft ? btn('Terbitkan CV', 'btn-primary tf-cta', 'tf-publish', async e => {
        const f = formFrom(p); f.terms = f.terms || S.terms;
        const val = T.validateProfile(f, true); if (val.error) { err.textContent = val.error + ' (ubah di langkah Profil)'; return; }
        e.target.disabled = true;
        try { await T.saveProfile(payload(f), true); await refresh(); toast('Alhamdulillah, CV Ta’aruf Anda diterbitkan.'); hub(); }
        catch (x) { err.textContent = T.errorText(x); e.target.disabled = false; }
      }) : btn('Selesai', 'btn-primary tf-cta', 'tf-vdone', hub));
  }

  /* ===== Beranda Ta'aruf (setelah CV terbit) ===== */
  function hub() {
    const s = S.st || {}, p = P() || {};
    const tile = (id, iconN, title, sub, onclick, badge) => h('button', { class: 'tf-tile', type: 'button', id, onclick }, h('span', { class: 'tf-tic' }, ic(iconN)),
      h('span', { class: 'tf-tt' }, h('b', {}, title), h('span', { class: 'muted' }, sub)), badge ? h('span', { class: 'tf-badge', id: id + '-badge' }, String(badge)) : '', ic(ICONS.chev, 'ic tf-chev'));
    const quota = s.premium ? 'Premium aktif' : Math.min(s.quota_used || 0, s.free_quota) + ' dari ' + s.free_quota + ' profil gratis telah dilihat';
    draw(back('← Lainnya', () => go && go('more'), 'tf-exit'),
      h('div', { class: 'tf-hubhead' }, ic('arch', 'ic tf-hubic'), h('div', {}, h('h2', { class: 'wtitle' }, 'BAITUNA Ta’aruf'), h('p', { class: 'muted' }, 'Ikhtiar menuju keluarga sakinah'))),
      h('div', { class: 'tf-statusrow', id: 'tf-status' },
        chip(p.status === 'aktif' ? 'CV aktif' : p.status === 'jeda' ? 'CV dijeda' : 'CV dinonaktifkan pengelola', p.status === 'aktif' ? 'tf-c-ok' : 'tf-c-off'),
        chip(s.verif && s.verif.identitas ? 'Identitas diperiksa' : 'Identitas belum diperiksa', s.verif && s.verif.identitas ? 'tf-c-ok' : 'tf-c-off'),
        chip(s.premium ? 'Premium' : 'Gratis', s.premium ? 'tf-c-gold' : 'tf-c-off')),
      p.status === 'nonaktif' ? h('p', { class: 'tf-warn', id: 'tf-nonaktif' }, 'Profil Anda dinonaktifkan pengelola sehingga tidak tampil di rekomendasi. Hubungi admin BAITUNA bila ada pertanyaan.') : '',
      s.open === false ? h('p', { class: 'tf-warn', id: 'tf-closed' }, 'BAITUNA Ta’aruf sedang ditutup sementara. Proses yang berjalan tetap bisa dibuka.') : '',
      s.incoming ? h('button', { class: 'tf-alert', type: 'button', id: 'tf-incoming', onclick: () => introsScreen('masuk') }, ic('heart'), h('span', {}, 'Saudaraku, ada ' + s.incoming + ' permintaan perkenalan baru. Lihat sekarang.')) : '',
      h('div', { class: 'tf-tiles' },
        tile('tf-go-rec', 'users', 'Rekomendasi Calon', quota, () => recScreen()),
        tile('tf-go-intros', 'hands', 'Perkenalan Saya', s.running ? s.running + ' proses berjalan' : 'Status permintaan & proses', () => introsScreen(), s.incoming),
        tile('tf-go-cv', 'user', 'CV Ta’aruf Saya', 'Ubah, jeda, atau hapus CV', cvScreen),
        tile('tf-go-pref', 'filter', 'Preferensi Pasangan', 'Usia ' + ((s.prefs && s.prefs.age_min) || 19) + '–' + ((s.prefs && s.prefs.age_max) || 45) + ' tahun', () => prefsScreen(false)),
        tile('tf-go-verif', 'shield', 'Verifikasi', s.verif && s.verif.identitas ? 'Identitas sudah diperiksa' : 'Lihat status verifikasi', () => verifyScreen(false)),
        tile('tf-go-premium', 'crown', 'Ta’aruf Premium', s.premium ? 'Aktif sampai ' + T.fmtDate(s.member_ends) : 'Rp19.900/bulan • lihat manfaat', () => premium('auto')),
        tile('tf-go-guide', 'book', 'Panduan & Keselamatan', 'Adab umum, tanda bahaya, hak Anda', guideScreen),
        tile('tf-go-blocks', 'ban', 'Daftar Blokir', 'Kelola profil yang Anda blokir', blocksScreen),
        s.admin ? tile('tf-go-admin', 'gear', 'Kelola Ta’aruf', 'Super Admin: laporan, verifikasi, pengaturan', () => adminScreen('stat')) : ''));
  }

  /* ===== Halaman 7: rekomendasi ===== */
  async function recScreen() {
    loading();
    let r; try { [r] = await Promise.all([T.recommend(0), refresh()]); } catch (e) { failView(e, recScreen); return; }
    const s = S.st, isP = r.premium, used = Math.min(r.quota_used, r.free_quota), left = Math.max(r.free_quota - r.quota_used, 0);
    const list = h('div', { class: 'tf-list', id: 'tf-list' });
    const paint = items => items.forEach(c => list.append(card(c, isP, left)));
    paint(r.items);
    const lockCard = !isP && (r.locked > 0 || left === 0) ? h('div', { class: 'tf-lockcard', id: 'tf-lock' }, h('span', { class: 'tf-lockic' }, ic('lock')),
      h('div', {}, h('b', {}, left === 0 ? 'Kuota profil gratis telah habis' : 'Profil selanjutnya dapat diakses dengan Ta’aruf Premium'),
        h('span', { class: 'muted' }, r.locked > 0 ? r.locked + ' profil lain sesuai kriteria Anda.' : 'Gabung Premium untuk melihat lebih banyak profil.')),
      btn('Lihat Paket Premium', 'btn-sm tf-gold', 'tf-premium-btn', () => premium())) : '';
    let more = '';
    if (isP && r.items.length === 20) {
      let off = 20;
      more = btn('Muat lebih banyak', 'btn-sm ghost', 'tf-more', async () => { more.disabled = true; try { const n = await T.recommend(off); off += n.items.length; paint(n.items); if (n.items.length < 20) more.remove(); else more.disabled = false; } catch (e) { toast(T.errorText(e), true); more.disabled = false; } });
    }
    draw(back('← BAITUNA Ta’aruf', hub), h('h2', { class: 'wtitle' }, 'Rekomendasi Calon'),
      h('div', { class: 'tf-rectop' }, h('span', { class: 'tf-pill', id: 'tf-pill' }, isP ? 'Untuk Anda' : 'Untuk Anda (' + used + '/' + r.free_quota + ')'), btn([ic('filter'), ' Filter'], 'tf-filter', 'tf-filter', () => prefsScreen(false))),
      !isP ? h('div', { class: 'tf-quota', id: 'tf-quota' }, ic('help', 'ic'), h('span', {}, used + ' dari ' + r.free_quota + ' profil gratis telah dilihat. Membuka profil yang sama lagi tidak mengurangi kuota.')) : '',
      s.profile && s.profile.status === 'jeda' ? h('p', { class: 'hint' }, 'Profil Anda sedang dijeda: Anda tetap bisa melihat calon, tetapi tidak tampil bagi orang lain.') : '',
      r.items.length ? list : h('div', { class: 'empty', id: 'tf-empty' }, h('p', { class: 'muted' }, r.total ? 'Belum ada profil yang bisa ditampilkan.' : 'Belum ada profil calon yang cocok dengan kriteria Anda. Coba longgarkan preferensi atau periksa kembali nanti.'),
        btn('Ubah preferensi', 'btn-sm', 'tf-empty-pref', () => prefsScreen(false))),
      lockCard, more);
  }
  function card(c, isP, left) {
    const meta = [c.age ? c.age + ' tahun' : '', [c.city, c.province].filter(Boolean).join(', ')].filter(Boolean).join(' • ');
    return h('div', { class: 'tf-card', 'data-id': c.id }, avatar(c.name),
      h('div', { class: 'tf-cbody' }, h('b', { class: 'tf-cname' }, c.name), h('span', { class: 'muted' }, meta),
        h('span', {}, [T.eduLabel(c.education), c.job].filter(Boolean).join(' • ')), c.readiness ? h('span', {}, T.readyLabel(c.readiness)) : '',
        h('div', { class: 'tf-crow' }, c.verified ? chip([ic('check'), ' Identitas diperiksa'], 'tf-c-ok') : '', c.seen ? chip('Sudah dilihat', 'tf-c-off') : ''),
        c.why && c.why.length ? h('span', { class: 'hint tf-why' }, 'Direkomendasikan: ' + c.why.join(', ')) : '',
        btn('Lihat Profil', 'btn-sm tf-open', 'tf-open-' + c.id, async () => {
          if (!isP && !c.seen) {
            if (!(await confirmDlg({ title: 'Buka profil ini?', text: 'Membuka profil ' + c.name + ' memakai 1 kuota profil gratis (sisa ' + left + '). Membuka profil yang sama lagi tidak mengurangi kuota.' }))) return;
          }
          detailScreen(c.id, recScreen);
        })));
  }
  function premium(where) {
    membershipFlow({ draw: (...k) => draw(...k), product: 'taaruf', benefits: PREMIUM_BENEFITS, start: where || 'plans', backLabel: '← BAITUNA Ta’aruf', isAdmin: !!(S.st && S.st.admin),
      openAdmin: tab => tab === 'plans' ? adminScreen('atur') : membershipAdminPage({ draw, tab, backLabel: '← Ta’aruf Premium', exit: () => premium(where) }),
      signIn: () => { if (onSignIn) onSignIn(); }, exit: () => start() });
  }

  /* ===== Halaman 8: detail profil ===== */
  function profileBody(d, preview) {
    const tabs = [['tentang', 'Tentang'], ['keluarga', 'Keluarga'], ['visi', 'Visi Hidup']];
    const box = h('div', { class: 'tf-tabbody', id: 'tf-tabbody' });
    const para = (t, empty) => t ? h('p', { class: 'tf-para' }, t) : h('p', { class: 'muted' }, empty || 'Belum diisi.');
    const kv = (k, v) => v ? h('div', { class: 'tf-kv' }, h('span', { class: 'muted' }, k), h('b', {}, v)) : '';
    const content = {
      tentang: () => [h('h4', {}, 'Tentang Saya'), para(d.about), (d.life_values || []).length ? h('h4', {}, 'Nilai dan gaya hidup') : '',
        h('div', { class: 'tf-chips' }, ...(d.life_values || []).map(v => chip([ic('checkc'), ' ' + T.valueLabel(v)], 'tf-c-soft')))],
      keluarga: () => [kv('Status pernikahan', T.maritalLabel(d.marital)), kv('Tanggungan', d.dependents), kv('Rencana tempat tinggal', T.residenceLabel(d.residence)), kv('Tentang anak', T.kidsLabel(d.kids)),
        h('h4', {}, 'Harapan tentang kehidupan keluarga'), para(d.family_hope)],
      visi: () => [kv('Kesiapan menikah', T.readyLabel(d.readiness)), h('h4', {}, 'Visi dan tujuan hidup'), para(d.vision)]
    };
    const tabBar = h('div', { class: 'tf-tabs', role: 'tablist' }, ...tabs.map(([k, t], i) => {
      const b = h('button', { class: 'tf-tab', type: 'button', role: 'tab', id: 'tf-tab-' + k + (preview ? '-p' : ''), 'aria-selected': String(i === 0) }, t);
      b.addEventListener('click', () => { for (const x of tabBar.children) x.setAttribute('aria-selected', String(x === b)); box.replaceChildren(...content[k]()); });
      return b;
    }));
    box.replaceChildren(...content.tentang());
    const extra = d.extra ? h('div', { class: 'panel tf-extra', id: 'tf-extra' }, h('h4', {}, 'Informasi tambahan ', h('span', { class: 'tf-prem' }, ic('crown'), 'Premium')), para(d.extra))
      : d.has_extra && !d.premium ? h('div', { class: 'tf-lockcard tf-lock-sm', id: 'tf-extra-lock' }, h('span', { class: 'tf-lockic' }, ic('lock')), h('div', {}, h('b', {}, 'Ada informasi tambahan'), h('span', { class: 'muted' }, 'Hanya untuk Ta’aruf Premium.')),
        btn('Lihat Paket', 'btn-sm tf-gold', 'tf-extra-premium', () => premium())) : '';
    return h('div', { class: 'tf-prof' },
      h('div', { class: 'tf-phead' }, avatar(d.name, true), h('div', {}, h('h3', { class: 'tf-pname', id: 'tf-pname' }, d.name),
        d.age ? h('span', { class: 'muted' }, d.age + ' tahun') : '', [d.city, d.province].filter(Boolean).length ? h('span', { class: 'tf-meta' }, ic('pin'), [d.city, d.province].filter(Boolean).join(', ')) : '',
        d.education ? h('span', { class: 'tf-meta' }, ic('edu'), T.eduLabel(d.education)) : '', d.job ? h('span', { class: 'tf-meta' }, ic('work'), d.job) : '',
        d.verified ? chip([ic('check'), ' Identitas diperiksa pengurus'], 'tf-c-ok') : chip('Identitas belum diperiksa', 'tf-c-off'))),
      h('p', { class: 'hint tf-nophoto' }, 'Foto tidak ditampilkan untuk menjaga privasi.'),
      tabBar, box, extra);
  }
  async function detailScreen(id, backFn) {
    loading();
    let d; try { d = await T.open(id); } catch (e) { if (e && e.message === 'kuota') { quotaScreen(backFn); return; } failView(e, () => detailScreen(id, backFn)); return; }
    if (d.counted) toast('1 kuota profil gratis dipakai (' + d.quota_used + '/' + d.free_quota + ').');
    const more = btn(ic('more'), 'tf-iconbtn', 'tf-more-menu', () => sheet('Pilihan', 'tf-menu',
      btn([ic('flag'), ' Laporkan profil'], 'tf-mi', 'tf-report', () => reportSheet(d.id, d.intro && d.intro.id, d.name, () => detailScreen(id, backFn))),
      btn([ic('ban'), ' Blokir'], 'tf-mi tf-bad', 'tf-block', () => blockFlow(d.id, d.name, backFn))), { 'aria-label': 'Pilihan lain' });
    let actions;
    if (d.intro) actions = h('div', { class: 'tf-actions' }, btn('Lihat Status Perkenalan', 'btn-primary tf-cta', 'tf-see-intro', () => introScreen(d.intro.id)));
    else if (!d.available) actions = h('p', { class: 'muted' }, 'Profil ini sedang tidak menerima perkenalan.');
    else actions = h('div', { class: 'tf-actions tf-two' },
      btn('Tolak', 'tf-reject', 'tf-reject', async () => {
        if (!(await confirmDlg({ title: 'Tidak dilanjutkan?', text: d.name + ' tidak akan ditampilkan lagi di rekomendasi Anda. Calon tidak diberi tahu.' }))) return;
        try { await T.hide(d.id); toast('Profil tidak akan ditampilkan lagi.'); (backFn || recScreen)(); } catch (e) { toast(T.errorText(e), true); }
      }),
      btn('Ajukan Minat', 'btn-primary', 'tf-send', async () => {
        if (!(await confirmDlg({ title: 'Ajukan minat kepada ' + d.name + '?', text: 'Calon akan melihat ringkasan profil Anda dan dapat menerima atau menolak. Proses hanya berlanjut bila kedua pihak setuju.' }))) return;
        try { const iid = await T.send(d.id); await refresh(); toast('Minat terkirim. Menunggu respons.'); introScreen(iid); }
        catch (e) { if (e && e.message === 'batas_proses') limitSheet(); else toast(T.errorText(e), true); }
      }));
    draw(h('div', { class: 'tf-topbar' }, back('← Kembali', backFn || recScreen), more), h('h2', { class: 'wtitle' }, 'Detail Profil'), profileBody(d), actions,
      h('p', { class: 'hint' }, 'Jangan pernah mengirim uang atau data pribadi kepada calon. Laporkan bila ada yang mencurigakan.'));
  }
  function limitSheet() {
    const s = S.st || {};
    sheet('Batas proses perkenalan', 'tf-limit', h('p', {}, 'Pengguna gratis dapat menjalankan ' + s.free_active + ' proses perkenalan aktif sekaligus' + (prem() ? '' : '; Ta’aruf Premium hingga ' + s.premium_active + '.') + ' Selesaikan, batalkan, atau akhiri proses yang ada terlebih dahulu.'),
      h('div', { class: 'row-btns' }, btn('Perkenalan Saya', 'btn-sm', 'tf-limit-intros', () => introsScreen('proses')), prem() ? '' : btn('Lihat Paket Premium', 'btn-sm tf-gold', 'tf-limit-premium', () => premium())));
  }
  function quotaScreen(backFn) {
    draw(back('← Kembali', backFn || recScreen), h('div', { class: 'tf-hero2', id: 'tf-quota-out' }, h('span', { class: 'tf-bigic tf-goldbg' }, ic('lock')),
      h('h2', { class: 'wtitle' }, 'Kuota Profil Gratis Telah Digunakan'),
      h('p', { class: 'muted' }, 'Kuota dua profil gratis Saudaraku sudah digunakan. Bergabunglah dengan BAITUNA Ta’aruf Premium untuk melihat lebih banyak profil calon yang sesuai dengan kriteria.')),
      h('ul', { class: 'tf-checks' }, ...PREMIUM_BENEFITS.slice(0, 5).map(t => h('li', {}, ic('checkc', 'ic tf-okc'), h('span', {}, t)))),
      btn('Lihat Paket Premium', 'btn-primary tf-cta tf-gold', 'tf-premium-btn', () => premium()),
      btn('Kembali', 'btn-sm ghost tf-cta2', 'tf-quota-back', backFn || recScreen),
      h('p', { class: 'hint' }, 'Profil yang sudah Anda buka, proses perkenalan, laporan, dan blokir tetap bisa dipakai tanpa biaya.'));
  }

  /* ===== Keselamatan: laporan & blokir ===== */
  function reportSheet(target, introId, name, after) {
    let reason = '';
    const note = h('textarea', { class: 'in tf-ta', id: 'tf-rep-note', maxlength: '500', rows: '3', placeholder: 'Ceritakan singkat apa yang terjadi (wajib untuk "Lainnya").' });
    const err = h('p', { class: 'mk-err', id: 'tf-rep-err', role: 'alert' }, '');
    const opts = h('div', { class: 'tf-radios', id: 'tf-rep-reasons' }, ...T.REPORT_REASONS.map(([k, t]) => {
      const r = h('input', { type: 'radio', name: 'tf-rr', value: k, id: 'tf-rr-' + k }); r.addEventListener('change', () => { reason = k; });
      return h('label', { class: 'tf-radio', for: 'tf-rr-' + k }, r, h('span', {}, t));
    }));
    const send = btn('Kirim Laporan', 'btn-primary', 'tf-rep-send', async () => {
      if (!reason) { err.textContent = 'Pilih alasan laporan.'; return; }
      if (reason === 'lainnya' && note.value.trim().length < 5) { err.textContent = 'Jelaskan alasan laporan.'; return; }
      send.disabled = true;
      try { await T.report(target, introId, reason, note.value); closeSheet(); toast('Laporan terkirim. Terima kasih, pengelola akan meninjaunya.'); if (after) after(); }
      catch (e) { err.textContent = T.errorText(e); send.disabled = false; }
    });
    sheet('Laporkan ' + name, 'tf-repsheet', h('p', { class: 'muted' }, 'Laporan bersifat rahasia; pihak yang dilaporkan tidak diberi tahu siapa pelapornya.'), opts, note, err, send,
      h('p', { class: 'hint' }, 'Bila ada ancaman atau tindak pidana, hubungi pihak berwajib.'));
  }
  async function blockFlow(target, name, after) {
    closeSheet();
    if (!(await confirmDlg({ title: 'Blokir ' + name + '?', text: 'Kalian tidak akan saling melihat profil lagi dan proses perkenalan yang ada akan dihentikan. Anda bisa membuka blokir nanti di Daftar Blokir.' }))) return;
    try { await T.block(target); await refresh(); toast(name + ' diblokir.'); (after || hub)(); } catch (e) { toast(T.errorText(e), true); }
  }
  async function blocksScreen() {
    loading();
    let list; try { list = await T.blocks(); } catch (e) { failView(e, blocksScreen); return; }
    draw(back('← BAITUNA Ta’aruf', hub), h('h2', { class: 'wtitle' }, 'Daftar Blokir'),
      list.length ? h('div', { class: 'tf-list', id: 'tf-blocks' }, ...list.map(b => h('div', { class: 'tf-brow' }, avatar(b.name), h('div', {}, h('b', {}, b.name), h('span', { class: 'muted' }, 'Diblokir ' + T.fmtDate(b.at))),
        btn('Buka blokir', 'btn-sm ghost', 'tf-unblock-' + b.id, async () => { try { await T.unblock(b.id); toast('Blokir dibuka.'); blocksScreen(); } catch (e) { toast(T.errorText(e), true); } }))))
        : h('div', { class: 'empty', id: 'tf-noblocks' }, h('p', { class: 'muted' }, 'Belum ada profil yang Anda blokir.')));
  }

  /* ===== Halaman 9–12: perkenalan ===== */
  async function introsScreen(tab) {
    loading();
    let list; try { [list] = await Promise.all([T.intros(), refresh()]); } catch (e) { failView(e, () => introsScreen(tab)); return; }
    const groups = { masuk: list.filter(i => !i.mine && i.status === 'diajukan'), proses: list.filter(i => (i.mine && i.status === 'diajukan') || i.status === 'berjalan'),
      selesai: list.filter(i => !['diajukan', 'berjalan'].includes(i.status)) };
    let cur = tab || (groups.masuk.length ? 'masuk' : 'proses');
    const body = h('div', { class: 'tf-list', id: 'tf-intros' });
    const item = i => h('button', { class: 'tf-irow', type: 'button', 'data-id': i.id, 'data-status': i.status, onclick: () => introScreen(i.id) }, avatar(i.other.name),
      h('div', {}, h('b', {}, i.other.name), h('span', { class: 'muted' }, [i.other.age ? i.other.age + ' tahun' : '', i.other.city].filter(Boolean).join(' • ')),
        h('span', { class: 'tf-st tf-t-' + T.statusTone(i.status) }, !i.mine && i.status === 'diajukan' ? 'Ingin berkenalan dengan Anda' : T.statusLabel(i.status))), ic(ICONS.chev, 'ic tf-chev'));
    const paint = () => {
      for (const b of seg.children) b.setAttribute('aria-selected', String(b.dataset.k === cur));
      const g = groups[cur];
      body.replaceChildren(...(g.length ? g.map(item) : [h('p', { class: 'muted', id: 'tf-intros-empty' }, cur === 'masuk' ? 'Belum ada permintaan perkenalan masuk.' : cur === 'proses' ? 'Belum ada proses berjalan. Ajukan minat dari Rekomendasi Calon.' : 'Belum ada riwayat.')]));
    };
    const seg = h('div', { class: 'tf-tabs', role: 'tablist', id: 'tf-iseg' }, ...[['masuk', 'Masuk'], ['proses', 'Proses'], ['selesai', 'Selesai']].map(([k, t]) => {
      const b = h('button', { class: 'tf-tab', type: 'button', role: 'tab', 'data-k': k, id: 'tf-seg-' + k }, t + (groups[k].length ? ' (' + groups[k].length + ')' : ''));
      b.addEventListener('click', () => { cur = k; paint(); }); return b;
    }));
    draw(back('← BAITUNA Ta’aruf', hub), h('h2', { class: 'wtitle' }, 'Perkenalan Saya'), seg, body,
      h('p', { class: 'hint' }, 'Pemberitahuan perkenalan hanya tampil di dalam aplikasi. Buka halaman ini secara berkala.'));
    paint();
  }

  const STEPS5 = ['Ajukan Minat', 'Menunggu', 'Disetujui', 'Proses', 'Keputusan'];
  const stepOf = s => s === 'diajukan' ? 2 : s === 'berjalan' ? 4 : s === 'lanjut' ? 6 : 0;
  const tracker = n => h('ol', { class: 'tf-track', id: 'tf-track' }, ...STEPS5.map((t, i) => h('li', A({ class: i + 1 < n ? 'done' : i + 1 === n ? 'on' : '' }), h('span', { class: 'tf-dot' }, i + 1 < n ? ic('check') : String(i + 1)), h('small', {}, t))));

  async function introScreen(id) {
    loading();
    let it; try { [it] = await Promise.all([T.intro(id), refresh()]); } catch (e) { failView(e, () => introScreen(id)); return; }
    const o = it.other, name = o.name, again = () => introScreen(id);
    const menu = o.id ? btn(ic('more'), 'tf-iconbtn', 'tf-more-menu', () => sheet('Pilihan', 'tf-menu',
      o.available ? btn([ic('eye'), ' Lihat detail profil'], 'tf-mi', 'tf-m-profile', () => { closeSheet(); detailScreen(o.id, again); }) : '',
      btn([ic('flag'), ' Laporkan'], 'tf-mi', 'tf-report', () => reportSheet(o.id, it.id, name, again)),
      btn([ic('ban'), ' Blokir'], 'tf-mi tf-bad', 'tf-block', () => blockFlow(o.id, name, () => introsScreen('selesai')))), { 'aria-label': 'Pilihan lain' }) : '';
    const top = h('div', { class: 'tf-topbar' }, back('← Perkenalan', () => introsScreen()), menu);
    const head = h('div', { class: 'tf-ihead' }, avatar(name), h('div', {}, h('b', {}, name), h('span', { class: 'muted' }, [o.age ? o.age + ' tahun' : '', o.city].filter(Boolean).join(' • '))));
    const st = it.status;
    if (st === 'diajukan' && it.mine) {
      draw(top, h('h2', { class: 'wtitle' }, 'Status Perkenalan'), tracker(2),
        h('div', { class: 'tf-hero2', id: 'tf-waiting' }, h('span', { class: 'tf-bigic tf-goldbg' }, ic('hourglass')), h('h3', {}, 'Menunggu Respons'), h('p', { class: 'muted' }, 'Permintaan perkenalan Anda telah dikirim ke ' + name + '.')),
        info('Status akan berubah di halaman ini setelah ada respons. Tidak ada batas waktu; calon berhak menolak tanpa alasan.'),
        o.available ? btn('Lihat Detail Profil', 'btn-sm ghost tf-cta2', 'tf-see-profile', () => detailScreen(o.id, again)) : '',
        btn('Batalkan Permintaan', 'tf-dangerlink', 'tf-cancel', async () => {
          if (!(await confirmDlg({ title: 'Batalkan permintaan?', text: 'Permintaan perkenalan kepada ' + name + ' dibatalkan.' }))) return;
          try { await T.cancel(it.id); toast('Permintaan dibatalkan.'); introsScreen('selesai'); } catch (e) { toast(T.errorText(e), true); again(); }
        }));
      return;
    }
    if (st === 'diajukan') {
      draw(top, h('h2', { class: 'wtitle' }, 'Permintaan Perkenalan'), tracker(2), head,
        h('p', {}, name + ' ingin berkenalan dengan Anda. Buka profilnya terlebih dahulu (tidak memakai kuota), lalu putuskan dengan tenang.'),
        btn('Lihat Profil ' + name, 'btn-sm ghost tf-cta2', 'tf-see-profile', () => detailScreen(o.id, again)),
        h('div', { class: 'tf-actions tf-two' },
          btn('Tolak', 'tf-reject', 'tf-decline', async () => {
            if (!(await confirmDlg({ title: 'Tolak permintaan ini?', text: name + ' hanya akan melihat bahwa perkenalan belum dapat dilanjutkan, tanpa alasan.' }))) return;
            try { await T.respond(it.id, false); toast('Permintaan ditolak dengan baik.'); introsScreen('selesai'); } catch (e) { toast(T.errorText(e), true); again(); }
          }),
          btn('Terima', 'btn-primary', 'tf-accept', async () => {
            if (!(await confirmDlg({ title: 'Terima perkenalan?', text: 'Proses perkenalan dengan ' + name + ' dimulai. Anda tetap bisa mengakhirinya kapan saja.' }))) return;
            try { await T.respond(it.id, true); toast('Alhamdulillah, perkenalan dimulai.'); again(); } catch (e) { toast(T.errorText(e), true); again(); }
          })),
        h('p', { class: 'hint' }, 'Menerima tidak berarti setuju menikah. Libatkan wali atau keluarga sejak awal.'));
      return;
    }
    if (st === 'berjalan') { runningScreen(it, top, head); return; }
    if (st === 'lanjut') { doneScreen(it, top); return; }
    // ditolak / dibatalkan / diakhiri
    const msg = st === 'ditolak' ? (it.mine ? 'Perkenalan dengan ' + name + ' belum dapat dilanjutkan. Semoga Allah memberikan yang terbaik untuk Saudaraku.' : 'Anda telah menolak permintaan ini.')
      : st === 'dibatalkan' ? 'Permintaan ini telah dibatalkan.'
      : it.end_reason === 'lain' ? 'Proses ini telah berakhir.' : it.ended_by_me ? 'Anda telah mengakhiri proses ini.' : 'Proses perkenalan ini telah diakhiri.';
    draw(top, h('h2', { class: 'wtitle' }, 'Status Perkenalan'), head, h('div', { class: 'tf-hero2', id: 'tf-ended', 'data-status': st }, h('span', { class: 'tf-bigic' }, ic('heart')), h('p', {}, msg)),
      btn('Lihat Rekomendasi Calon', 'btn-sm tf-cta2', 'tf-to-rec', () => recScreen()));
  }

  function contactBox(it) {
    const inp = h('input', { class: 'in', id: 'tf-contact', maxlength: '200', placeholder: 'Mis. Bapak (wali): 0812xxxx atau email keluarga' }); inp.value = it.my_contact || '';
    const err = h('p', { class: 'mk-err', id: 'tf-contact-err', role: 'alert' }, '');
    return h('div', { class: 'panel tf-contactbox', id: 'tf-contactbox' }, h('h3', {}, ic('phone'), ' Kontak yang dibagikan'),
      it.their_contact ? h('div', { class: 'tf-kv', id: 'tf-their' }, h('span', { class: 'muted' }, 'Dari ' + it.other.name), h('b', {}, it.their_contact)) : h('p', { class: 'muted', id: 'tf-their' }, it.other.name + ' belum membagikan kontak.'),
      h('label', { class: 'tf-lab', for: 'tf-contact' }, 'Kontak Anda untuk ' + it.other.name + ' (opsional)'), inp,
      h('p', { class: 'hint' }, 'Hanya terlihat oleh ' + it.other.name + ' selama proses berjalan. Disarankan nomor wali/keluarga. Kosongkan lalu simpan untuk menarik kembali.'),
      err, btn(it.my_contact ? 'Perbarui kontak' : 'Bagikan kontak', 'btn-sm', 'tf-contact-save', async () => {
        const v = inp.value.trim();
        if (v && (v.length < 5 || v.length > 200)) { err.textContent = 'Kontak diisi 5 sampai 200 huruf.'; return; }
        if (v && !(await confirmDlg({ title: 'Bagikan kontak?', text: '"' + v + '" akan terlihat oleh ' + it.other.name + '.' }))) return;
        try { await T.shareContact(it.id, v); toast(v ? 'Kontak dibagikan.' : 'Kontak ditarik kembali.'); introScreen(it.id); } catch (e) { err.textContent = T.errorText(e); }
      }));
  }

  function runningScreen(it, top, head) {
    const isP = it.premium, again = () => introScreen(it.id);
    const doneT = new Set((it.topics || []).map(t => t.topic));
    const panel = h('div', { id: 'tf-agenda' });
    const lockNote = () => h('div', { class: 'tf-lockcard tf-lock-sm', id: 'tf-agenda-lock' }, h('span', { class: 'tf-lockic' }, ic('lock')),
      h('div', {}, h('b', {}, 'Agenda & topik pembicaraan'), h('span', { class: 'muted' }, 'Menandai topik, catatan pribadi, dan usul jadwal khusus Ta’aruf Premium. Menanggapi jadwal dari calon tetap gratis.')),
      btn('Lihat Paket', 'btn-sm tf-gold', 'tf-agenda-premium', () => premium()));
    const plan = () => {
      const sch = it.schedules || [];
      const items = sch.map(c => h('div', { class: 'tf-sch', 'data-status': c.status, 'data-id': c.id }, h('span', { class: 'tf-schdot' }, ic('agenda')),
        h('div', {}, h('b', {}, c.topic ? T.topicLabel(c.topic) : 'Pertemuan'), h('span', {}, T.fmtWhen(c.at)), h('span', { class: 'muted' }, c.mode),
          h('span', { class: 'tf-st tf-t-' + (c.status === 'disetujui' ? 'ok' : c.status === 'diusulkan' ? 'warn' : 'off') }, c.status === 'diusulkan' ? (c.mine ? 'Menunggu tanggapan' : 'Diusulkan calon') : c.status === 'disetujui' ? 'Disepakati' : c.status === 'ditolak' ? 'Tidak disepakati' : 'Dibatalkan')),
        h('div', { class: 'tf-schbtns' },
          !c.mine && c.status === 'diusulkan' ? btn('Setuju', 'btn-sm', 'tf-sch-ok-' + c.id, () => schSet(c.id, 'disetujui')) : '',
          !c.mine && c.status === 'diusulkan' ? btn('Tidak bisa', 'btn-sm ghost', 'tf-sch-no-' + c.id, () => schSet(c.id, 'ditolak')) : '',
          c.mine && (c.status === 'diusulkan' || c.status === 'disetujui') ? btn('Batalkan', 'btn-sm ghost', 'tf-sch-cancel-' + c.id, () => schSet(c.id, 'dibatalkan')) : '')));
      const kids = [items.length ? h('div', { class: 'tf-schlist', id: 'tf-schlist' }, ...items) : h('p', { class: 'muted', id: 'tf-nosch' }, 'Belum ada jadwal yang diusulkan.')];
      if (isP) {
        const at = h('input', { class: 'in', type: 'datetime-local', id: 'tf-sch-at' });
        const mode = h('input', { class: 'in', id: 'tf-sch-mode', maxlength: '120', placeholder: 'Mis. Video call bersama wali / di rumah keluarga' });
        const tp = h('select', { class: 'in', id: 'tf-sch-topic' }, h('option', { value: '' }, 'Topik (opsional)'), ...T.TOPICS.map(([k, t]) => h('option', { value: k }, t)));
        const err = h('p', { class: 'mk-err', id: 'tf-sch-err', role: 'alert' }, '');
        kids.push(h('div', { class: 'panel tf-form', id: 'tf-schform' }, h('h4', {}, 'Usulkan jadwal'), at, mode, tp, err, btn('Kirim Usulan', 'btn-sm', 'tf-sch-send', async () => {
          if (!at.value) { err.textContent = 'Pilih tanggal dan jam.'; return; }
          if (mode.value.trim().length < 3) { err.textContent = 'Tulis cara/tempat pertemuan.'; return; }
          try { await T.schedule(it.id, new Date(at.value).toISOString(), mode.value.trim(), tp.value); toast('Usulan jadwal terkirim.'); again(); } catch (e) { err.textContent = T.errorText(e); }
        })));
      } else kids.push(lockNote());
      return kids;
    };
    async function schSet(sid, status) { try { await T.scheduleSet(sid, status); toast('Jadwal diperbarui.'); again(); } catch (e) { toast(T.errorText(e), true); again(); } }
    const topics = () => [h('p', { class: 'muted' }, 'Tandai topik yang sudah dibahas. Tanda ini terlihat oleh kedua pihak.'),
      h('div', { class: 'tf-topics', id: 'tf-topics' }, ...T.TOPICS.map(([k, t], i) => {
        const cb = h('input', { type: 'checkbox', id: 'tf-topic-' + k }); cb.checked = doneT.has(k); if (!isP) cb.disabled = true;
        cb.addEventListener('change', async () => { try { await T.topic(it.id, k, cb.checked); if (cb.checked) doneT.add(k); else doneT.delete(k); } catch (e) { cb.checked = !cb.checked; toast(T.errorText(e), true); } });
        return h('label', { class: 'tf-topic', for: 'tf-topic-' + k }, cb, h('span', { class: 'tf-tnum' }, String(i + 1)), h('span', {}, t));
      })), isP ? '' : lockNote()];
    const notes = () => {
      if (!isP) return [it.note ? h('p', { class: 'tf-para', id: 'tf-note-old' }, it.note) : '', lockNote()];
      const ta = h('textarea', { class: 'in tf-ta', id: 'tf-note', maxlength: '2000', rows: '5', placeholder: 'Catatan untuk diri sendiri…' }); ta.value = it.note || '';
      return [h('p', { class: 'hint', id: 'tf-note-who' }, 'Catatan pribadi: hanya Anda yang bisa melihatnya. Tidak dibagikan kepada calon maupun pengelola.'), ta,
        btn('Simpan Catatan', 'btn-sm', 'tf-note-save', async () => { try { await T.note(it.id, ta.value); toast('Catatan disimpan.'); it.note = ta.value; } catch (e) { toast(T.errorText(e), true); } })];
    };
    const views = { rencana: plan, topik: topics, catatan: notes };
    const tabs = h('div', { class: 'tf-tabs', role: 'tablist', id: 'tf-atabs' }, ...[['rencana', 'Rencana'], ['topik', 'Topik Pembicaraan'], ['catatan', 'Catatan']].map(([k, t], i) => {
      const b = h('button', { class: 'tf-tab', type: 'button', role: 'tab', id: 'tf-at-' + k, 'aria-selected': String(i === 0) }, t);
      b.addEventListener('click', () => { for (const x of tabs.children) x.setAttribute('aria-selected', String(x === b)); panel.replaceChildren(...views[k]()); }); return b;
    }));
    panel.replaceChildren(...plan());
    const myDec = it.my_decision;
    const decide = async (choice, title, text) => {
      if (!(await confirmDlg({ title, text }))) return;
      try { const r = await T.decide(it.id, choice); toast(r === 'lanjut' ? 'Alhamdulillah, kedua pihak sepakat melanjutkan.' : r === 'diakhiri' ? 'Proses diakhiri.' : 'Keputusan Anda dicatat.'); again(); }
      catch (e) { toast(T.errorText(e), true); again(); }
    };
    draw(top, h('h2', { class: 'wtitle' }, 'Agenda Ta’aruf'), tracker(4), head, tabs, panel, contactBox(it),
      h('div', { class: 'panel tf-decide', id: 'tf-decide' }, h('h3', {}, 'Keputusan'),
        h('p', { class: 'muted', id: 'tf-mydec' }, myDec === 'lanjut' ? 'Anda memilih lanjut ke tahap keluarga. Menunggu keputusan ' + it.other.name + '.' : myDec === 'waktu' ? 'Anda meminta waktu. Ubah keputusan kapan saja.' : 'Belum ada keputusan. Tidak ada keharusan untuk menikah; putuskan setelah istikharah dan musyawarah dengan keluarga.'),
        h('div', { class: 'tf-declist' },
          myDec === 'lanjut' ? '' : btn([ic('users'), ' Lanjut ke tahap keluarga'], 'tf-mi', 'tf-dec-lanjut', () => decide('lanjut', 'Lanjut ke tahap keluarga?', 'Bila ' + it.other.name + ' juga memilih lanjut, proses masuk tahap keluarga. Pilihan Anda tidak ditampilkan kepada calon sebelum keduanya sepakat.')),
          myDec === 'waktu' ? '' : btn([ic('clock'), ' Minta waktu'], 'tf-mi', 'tf-dec-waktu', () => decide('waktu', 'Minta waktu?', 'Proses tetap berjalan. Anda bisa memutuskan nanti.')),
          btn([ic('x'), ' Akhiri proses'], 'tf-mi tf-bad', 'tf-dec-akhiri', () => decide('akhiri', 'Akhiri proses perkenalan?', 'Proses dengan ' + it.other.name + ' diakhiri dan kontak yang dibagikan ditutup. Anda tidak perlu menjelaskan alasannya. Tindakan ini tidak bisa dibatalkan.')))));
  }

  function doneScreen(it, top) {
    draw(top, h('div', { class: 'tf-done', id: 'tf-done' }, h('span', { class: 'tf-doneic' }, ic('hands')), h('h2', {}, 'Alhamdulillah'),
        h('p', {}, 'Kedua pihak sepakat melanjutkan ke tahap keluarga.'),
        h('p', { class: 'muted' }, 'Semoga Allah memudahkan langkah berikutnya. Teruslah menjaga komunikasi yang baik dan libatkan wali serta keluarga.')),
      contactBox(it),
      h('div', { class: 'tf-declist' },
        btn([ic('book'), ' Panduan tahap keluarga'], 'tf-mi', 'tf-done-guide', guideScreen),
        btn([ic('x'), ' Tutup proses'], 'tf-mi tf-bad', 'tf-done-close', async () => {
          if (!(await confirmDlg({ title: 'Tutup proses ini?', text: 'Proses dengan ' + it.other.name + ' ditutup dan kontak yang dibagikan disembunyikan.' }))) return;
          try { await T.decide(it.id, 'akhiri'); toast('Proses ditutup.'); introsScreen('selesai'); } catch (e) { toast(T.errorText(e), true); }
        })),
      h('p', { class: 'hint' }, 'Ketentuan keterlibatan wali dan tahap berikutnya mengikuti prosedur keluarga masing-masing. Panduan resmi BAITUNA masih dalam peninjauan ustaz.'));
  }

  /* ===== Panduan & keselamatan ===== */
  function guideScreen() {
    const sec = (title, list) => h('div', { class: 'panel tf-guide' }, h('h3', {}, title), h('ul', {}, ...list.map(t => h('li', {}, t))));
    draw(back('← BAITUNA Ta’aruf', hub), h('h2', { class: 'wtitle' }, 'Panduan & Keselamatan'),
      h('p', { class: 'tf-warn', id: 'tf-guide-draft' }, 'Panduan umum keselamatan, bukan fatwa. Ketentuan syariat yang lebih rinci sedang ditinjau ustaz sebelum dijadikan pedoman resmi.'),
      sec('Sebelum dan selama perkenalan', ['Libatkan wali atau keluarga sejak awal, terutama sebelum bertemu.', 'Bertemu di tempat umum atau di rumah keluarga, didampingi wali/keluarga.',
        'Bahas topik penting dengan jujur: visi pernikahan, tempat tinggal, keuangan, pekerjaan, anak, dan keluarga besar.', 'Putuskan dengan tenang setelah istikharah dan musyawarah dengan keluarga.']),
      sec('Tanda bahaya', ['Meminta uang, pulsa, atau transfer dengan alasan apa pun.', 'Mendesak bertemu berdua atau buru-buru menikah tanpa keluarga.',
        'Meminta foto pribadi, data KTP, atau nomor rekening.', 'Cerita yang berubah-ubah atau menolak melibatkan keluarga.']),
      sec('Hak Anda (gratis)', ['Menolak atau mengakhiri proses kapan saja tanpa harus menjelaskan alasan.', 'Melaporkan dan memblokir profil.',
        'Menjeda atau menghapus CV kapan saja.', 'Kontak Anda hanya dibagikan bila Anda sendiri yang membagikannya.']),
      info('Verifikasi BAITUNA terbatas: email dikonfirmasi saat mendaftar, usia dinyatakan sendiri, dan identitas hanya ditandai bila pengurus sudah memeriksanya langsung.'));
  }

  /* ===== Kelola (Super Admin) ===== */
  async function adminScreen(tab) {
    const tabs = [['stat', 'Ringkasan'], ['laporan', 'Laporan'], ['profil', 'Profil & Verifikasi'], ['atur', 'Pengaturan']];
    const bar = h('div', { class: 'tf-tabs', role: 'tablist', id: 'tf-admtabs' }, ...tabs.map(([k, t]) => h('button', { class: 'tf-tab', type: 'button', role: 'tab', id: 'tf-adm-' + k, 'aria-selected': String(k === tab), onclick: () => adminScreen(k) }, t)));
    const body = h('div', { id: 'tf-admbody' }, h('p', { class: 'muted' }, 'Memuat…'));
    draw(back('← BAITUNA Ta’aruf', start), h('h2', { class: 'wtitle' }, 'Kelola Ta’aruf'), bar, body);
    try {
      if (tab === 'stat') {
        const s = await T.adminStats();
        const box = (k, v, id) => h('div', { class: 'tf-statbox', id }, h('b', {}, String(v)), h('span', { class: 'muted' }, k));
        body.replaceChildren(h('div', { class: 'tf-stats' }, box('CV aktif', s.profiles, 'tf-s-prof'), box('Ikhwan', s.ikhwan), box('Akhwat', s.akhwat), box('CV draf', s.draf), box('Premium aktif', s.premium),
          box('Menunggu respons', s.waiting), box('Proses berjalan', s.running), box('Lanjut ke keluarga', s.lanjut), box('Laporan baru', s.reports_new, 'tf-s-rep')),
          h('p', { class: 'hint' }, 'Pembayaran Ta’aruf Premium diverifikasi di panel transaksi membership yang sama (paket bernama "Ta’aruf Premium").'),
          btn('Buka Transaksi Membership', 'btn-sm', 'tf-adm-pay', () => membershipAdminPage({ draw, tab: 'trx', backLabel: '← Kelola Ta’aruf', exit: () => adminScreen('stat') })));
      } else if (tab === 'laporan') {
        const list = await T.adminReports(null);
        body.replaceChildren(list.length ? h('div', { class: 'tf-list', id: 'tf-adm-reports' }, ...list.map(r => h('div', { class: 'panel tf-rep', 'data-id': r.id, 'data-status': r.status },
          h('div', { class: 'tf-rephead' }, h('b', {}, T.reasonLabel(r.reason)), h('span', { class: 'tf-st tf-t-' + (r.status === 'baru' ? 'warn' : r.status === 'selesai' ? 'ok' : 'off') }, r.status)),
          h('span', { class: 'muted' }, 'Dilaporkan: ' + r.target_name + ' (' + (r.target_status || 'tanpa CV') + ', ' + r.target_reports + ' laporan) • oleh ' + r.reporter + ' • ' + T.fmtDate(r.created_at)),
          r.note ? h('p', { class: 'tf-para' }, r.note) : '', r.admin_note ? h('p', { class: 'hint' }, 'Catatan admin: ' + r.admin_note) : '',
          h('div', { class: 'row-btns' },
            r.status !== 'ditinjau' ? btn('Tandai ditinjau', 'btn-sm ghost', 'tf-rep-rev-' + r.id, () => repSet(r.id, 'ditinjau')) : '',
            r.status !== 'selesai' ? btn('Selesai', 'btn-sm', 'tf-rep-done-' + r.id, () => repSet(r.id, 'selesai')) : '',
            r.target_status && r.target_status !== 'nonaktif' ? btn('Nonaktifkan profil', 'btn-sm alt', 'tf-rep-off-' + r.id, () => profSet(r.target, false, r.target_name, 'laporan')) : '',
            r.target_status === 'nonaktif' ? btn('Aktifkan kembali', 'btn-sm ghost', 'tf-rep-on-' + r.id, () => profSet(r.target, true, r.target_name, 'laporan')) : ''))))
          : h('p', { class: 'muted', id: 'tf-adm-norep' }, 'Belum ada laporan.'));
      } else if (tab === 'profil') {
        const q = h('input', { class: 'in', id: 'tf-adm-q', type: 'search', placeholder: 'Cari nama tampilan, email, atau kota…' });
        const res = h('div', { class: 'tf-list', id: 'tf-adm-profiles' });
        const find = async () => {
          try {
            const list = await T.adminFind(q.value.trim());
            res.replaceChildren(...(list.length ? list.map(p => h('div', { class: 'panel tf-admp', 'data-id': p.id }, h('div', { class: 'tf-rephead' }, h('b', {}, p.name + ' (' + (p.gender === 'L' ? 'ikhwan' : 'akhwat') + ', ' + p.age + ' th)'), h('span', { class: 'tf-st tf-t-' + (p.status === 'aktif' ? 'ok' : 'off') }, p.status)),
              h('span', { class: 'muted' }, p.email + ' • ' + [p.city, p.province].filter(Boolean).join(', ') + ' • ' + p.reports + ' laporan'),
              h('div', { class: 'row-btns' },
                btn(p.verified ? 'Cabut tanda identitas' : 'Tandai identitas diperiksa', 'btn-sm' + (p.verified ? ' ghost' : ''), 'tf-adm-ver-' + p.id, async () => {
                  const note = p.verified ? true : await confirmDlg({ title: 'Tandai identitas ' + p.name + ' sudah diperiksa?', text: 'Hanya bila Anda/pengurus sudah mencocokkan identitas secara langsung. Tulis catatan singkat (mis. dicek di sekretariat masjid).', reason: true });
                  if (!note) return;
                  try { await T.adminVerify(p.id, !p.verified, note === true ? null : note); toast('Status identitas diperbarui.'); find(); } catch (e) { toast(T.errorText(e), true); }
                }),
                p.status === 'nonaktif' ? btn('Aktifkan kembali', 'btn-sm ghost', 'tf-adm-on-' + p.id, () => profSet(p.id, true, p.name, 'profil')) : btn('Nonaktifkan', 'btn-sm alt', 'tf-adm-off-' + p.id, () => profSet(p.id, false, p.name, 'profil')))))
              : [h('p', { class: 'muted' }, 'Tidak ada profil.')]));
          } catch (e) { res.replaceChildren(h('p', { class: 'mk-err' }, T.errorText(e))); }
        };
        let tm = null; q.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(find, 300); });
        body.replaceChildren(q, h('p', { class: 'hint' }, 'Email hanya terlihat oleh Super Admin untuk mencocokkan identitas. Semua tindakan tercatat di log.'), res); find();
      } else {
        const [set, plans] = await Promise.all([T.settings(), T.plans()]);
        const num = (id, v, min, max) => { const e = h('input', { class: 'in tf-num', id, type: 'number', min: String(min), max: String(max) }); e.value = v == null ? '' : String(v); return e; };
        const open = h('input', { type: 'checkbox', id: 'tf-set-open' }); open.checked = !!set.is_open;
        const fq = num('tf-set-quota', set.free_quota, 0, 20), fa = num('tf-set-free', set.free_active, 1, 10), pa = num('tf-set-prem', set.premium_active, 1, 10);
        const price = {}; plans.forEach(p => { price[p.code] = num('tf-price-' + p.code, p.price, 1000, 100000000); });
        const err = h('p', { class: 'mk-err', id: 'tf-set-err', role: 'alert' }, '');
        const lab = (t, el) => h('label', { class: 'tf-lab' }, t, el);
        body.replaceChildren(h('div', { class: 'panel tf-form', id: 'tf-settings' },
          h('label', { class: 'tf-check', for: 'tf-set-open' }, open, h('span', {}, 'Layanan dibuka (matikan untuk menutup sementara; proses yang berjalan tetap bisa dibuka)')),
          lab('Kuota profil gratis (seumur akun)', fq), lab('Proses aktif maksimal — gratis', fa), lab('Proses aktif maksimal — Premium', pa),
          h('h4', {}, 'Harga paket Ta’aruf Premium (Rp)'), ...plans.map(p => lab(p.name, price[p.code])),
          h('p', { class: 'hint' }, 'Perubahan harga berlaku untuk pesanan baru; pesanan lama tetap memakai harga saat dipesan.'), err,
          btn('Simpan Pengaturan', 'btn-primary', 'tf-set-save', async () => {
            const p = { is_open: open.checked, free_quota: Number(fq.value), free_active: Number(fa.value), premium_active: Number(pa.value) };
            for (const k in price) p['price_' + k] = price[k].value ? Number(price[k].value) : null;
            if (!(await confirmDlg({ title: 'Simpan pengaturan?', text: 'Perubahan langsung berlaku untuk semua pengguna BAITUNA Ta’aruf.' }))) return;
            try { await T.adminSettings(p); await refresh(); toast('Pengaturan disimpan.'); adminScreen('atur'); } catch (e) { err.textContent = T.errorText(e); }
          })));
      }
    } catch (e) { body.replaceChildren(h('p', { class: 'mk-err', id: 'tf-adm-err' }, T.errorText(e))); }
    async function repSet(id, status) { try { await T.adminReportSet(id, status, null); toast('Laporan diperbarui.'); adminScreen('laporan'); } catch (e) { toast(T.errorText(e), true); } }
    async function profSet(uid, active, name, back) {
      const note = await confirmDlg({ title: (active ? 'Aktifkan kembali ' : 'Nonaktifkan ') + name + '?', text: active ? 'Profil kembali dalam status jeda; pemilik bisa mengaktifkannya sendiri.' : 'Profil disembunyikan dan semua proses perkenalannya diakhiri. Tulis alasan singkat untuk log.', reason: !active });
      if (!note) return;
      try { await T.adminProfile(uid, active, note === true ? null : note); toast('Status profil diperbarui.'); adminScreen(back); } catch (e) { toast(T.errorText(e), true); }
    }
  }

  start();
  return wrap;
}
