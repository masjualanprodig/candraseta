// BAITUNA - adzan-ui.js
// Halaman Adzan: aktifkan adzan sesuai Jadwal Salat, pilih audio (semua orang), dan kelola daftar audio (khusus Super Admin).
// Pilihan pribadi disimpan di perangkat (di dalam pengaturan Notifikasi). Lokasi dan waktu salat memakai Jadwal Salat.
import { h, toast, ask } from './ui.js';
import { getSession } from './supabase.js';
import { loadAccess } from './permissions.js';
import { nextPrayer, fmtCountdown } from './prayer-times.js';
import { clock } from './jadwal-ui.js';
import * as N from './notif-service.js';
import * as A from './adzan-service.js';

const sizeText = b => b ? (b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB') : '';

export function adzanPage({ go } = {}) {
  const wrap = h('div', { class: 'adzan' });
  let S = N.load(), lib = { items: A.cachedItems(), error: null }, loading = true, cached = {}, isAdmin = false, adminItems = null, editing = null, busy = false;
  const commit = () => { N.save(S); S = N.load(); N.armReminders(); };
  const permState = () => N.deviceSupported() ? Notification.permission : 'unsupported';
  const sw = (label, checked, onchange, id, disabled) => {
    const inp = h('input', { type: 'checkbox', id }); inp.checked = !!checked; inp.disabled = !!disabled;
    inp.addEventListener('change', () => onchange(inp.checked));
    return h('label', { class: 'nt-sw' }, inp, h('span', {}, label));
  };
  async function askPerm() {
    if (!N.deviceSupported()) return 'unsupported';
    if (Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) { /* abaikan */ } }
    return Notification.permission;
  }
  async function refresh() {
    loading = true; draw();
    lib = await A.listAudio(); loading = false;
    cached = {}; await Promise.all(lib.items.map(async it => { cached[it.id] = await A.isCached(it); }));
    if (isAdmin) { try { adminItems = await A.listAudioAdmin(); } catch (e) { adminItems = null; } }
    draw();
  }
  // tombol di daftar mengikuti keadaan pemutar
  const unsub = A.onChange(() => { if (!wrap.isConnected) { unsub(); return; } paintPlayButtons(); });
  function paintPlayButtons() {
    const cur = A.nowPlaying();
    wrap.querySelectorAll('[data-play]').forEach(b => { b.textContent = cur && cur.id === b.dataset.play ? 'Hentikan' : 'Putar contoh'; });
  }
  async function togglePlay(it) {
    const cur = A.nowPlaying();
    if (cur && cur.id === it.id) { A.stop(); return; }
    const r = await A.play(it, { volume: S.adzan.volume });
    if (!r.ok) toast(r.reason === 'blocked' ? 'Peramban menahan suara. Ketuk sekali lagi.' : 'Audio belum bisa diputar. Periksa koneksi, atau simpan audio untuk offline.', true);
  }

  /* ---------- status & jadwal ---------- */
  function statusPanel() {
    const loc = N.readLoc(), ps = permState();
    const kids = [h('h3', {}, 'Adzan sesuai Jadwal Salat'),
      h('p', { class: 'muted' }, 'Waktu adzan diambil otomatis dari Jadwal Salat (lokasi dan hitungan yang sama). Pilihan di sini hanya tersimpan di HP Anda.'),
      sw('Aktifkan adzan', S.adzan.on, v => { S.adzan.on = v; commit(); draw(); if (v && S.adzan.notify && permState() === 'default') askPerm().then(draw); }, 'az-on')];
    if (S.adzan.on) {
      if (!loc) kids.push(h('div', { class: 'jwarn panel', id: 'az-noloc' }, h('b', {}, 'Lokasi belum dipilih. '), 'Adzan butuh lokasi dari Jadwal Salat.', ' ', go ? h('button', { class: 'btn-sm', type: 'button', onclick: () => go('jadwal') }, 'Pilih lokasi') : ''));
      else {
        const np = nextPrayer(Date.now(), loc.lat, loc.lng, loc.off), on = np && S.adzan.prayers[np.key];
        kids.push(h('p', { class: 'hint', id: 'az-next' }, np ? 'Adzan terdekat dari jadwal: ' + (A.PRAYER_NAMES[np.key]) + ' pukul ' + clock(np.at, loc.off) + (N.zoneName(loc.off) ? ' ' + N.zoneName(loc.off) : '') + ' (dalam ' + fmtCountdown(np.at - Date.now()) + ')' + (on ? '' : ', tapi dimatikan di pilihan bawah') + '.' : 'Jadwal belum bisa dihitung di lokasi ini.'));
      }
      kids.push(h('h4', {}, 'Salat yang diadzankan'), ...A.PRAYER_KEYS.map(k => sw(A.PRAYER_NAMES[k], S.adzan.prayers[k], v => { S.adzan.prayers[k] = v; commit(); draw(); }, 'az-p-' + k)));
      kids.push(h('h4', {}, 'Notifikasi'),
        sw('Tampilkan notifikasi saat waktu adzan', S.adzan.notify, v => { S.adzan.notify = v; commit(); draw(); if (v && permState() === 'default') askPerm().then(draw); }, 'az-notify'),
        h('p', { class: 'hint', id: 'az-perm-state' }, ps === 'granted' ? 'Izin notifikasi dari HP: sudah diberikan.' : ps === 'denied' ? 'Izin notifikasi diblokir di peramban/HP. Ubah lewat pengaturan situs di peramban, lalu muat ulang. Suara adzan tetap bisa berbunyi saat aplikasi terbuka.' : ps === 'unsupported' ? 'Peramban ini tidak mendukung notifikasi. Suara adzan tetap bisa berbunyi saat aplikasi terbuka.' : 'Izin notifikasi belum diberikan. Notifikasi baru tampil setelah Anda mengizinkannya di HP.'),
        ps === 'default' ? h('button', { class: 'btn-sm', type: 'button', id: 'az-perm', onclick: async () => { await askPerm(); draw(); } }, 'Izinkan notifikasi') : '');
    }
    return h('div', { class: 'panel', id: 'az-status' }, ...kids);
  }

  /* ---------- pilihan audio ---------- */
  function audioRow(it, group, checked, onPick) {
    const inp = h('input', { type: 'radio', name: group, id: 'az-' + (group === 'az-umum' ? 'audio' : 'subuh') + '-' + it.id }); inp.checked = checked; inp.addEventListener('change', () => onPick(it.id));
    const c = !!cached[it.id];
    return h('div', { class: 'az-opt' }, h('label', { class: 'az-optl' }, inp, h('span', {}, h('b', {}, it.name), h('span', { class: 'muted az-credit' }, 'Sumber: ' + it.credit + (it.size_bytes ? ' · ' + sizeText(it.size_bytes) : '')))),
      h('div', { class: 'row-btns' },
        h('button', { class: 'btn-sm ghost', type: 'button', 'data-play': it.id, id: 'az-play-' + it.id, onclick: () => togglePlay(it) }, A.nowPlaying() && A.nowPlaying().id === it.id ? 'Hentikan' : 'Putar contoh'),
        h('button', { class: 'btn-sm ghost', type: 'button', id: 'az-cache-' + it.id, onclick: async () => {
          if (cached[it.id]) { await A.uncacheAudio(it); cached[it.id] = false; draw(); return; }
          try { await A.cacheAudio(it); cached[it.id] = true; toast('Audio disimpan di HP. Bisa diputar tanpa internet.'); } catch (e) { toast(e && e.code === 'unsupported' ? 'Peramban ini tidak bisa menyimpan audio.' : 'Audio belum bisa diunduh. Periksa koneksi.', true); }
          draw();
        } }, c ? '✓ Tersimpan (hapus)' : 'Simpan untuk offline')));
  }
  function audioPanel() {
    const umum = lib.items.filter(i => i.kind === 'umum'), subuh = lib.items.filter(i => i.kind === 'subuh');
    const none = (group, id, label, checked, onPick) => { const inp = h('input', { type: 'radio', name: group, id }); inp.checked = checked; inp.addEventListener('change', onPick); return h('div', { class: 'az-opt' }, h('label', { class: 'az-optl' }, inp, h('span', {}, h('b', {}, label)))); };
    const vol = h('select', { class: 'in', id: 'az-vol', 'aria-label': 'Volume adzan' }, ...A.VOLUMES.map(v => h('option', { value: String(v) }, Math.round(v * 100) + '%')));
    vol.value = String(S.adzan.volume); vol.addEventListener('change', () => { S.adzan.volume = Number(vol.value); commit(); });
    const kids = [h('h3', {}, 'Audio adzan'),
      lib.error === 'sql' ? h('p', { class: 'hint jerr', role: 'alert' }, 'Daftar audio belum aktif di server. Pengelola perlu menjalankan adzan.sql di Supabase.') : lib.error === 'net' ? h('p', { class: 'hint' }, 'Daftar terbaru belum bisa dimuat; memakai salinan terakhir di HP.') : '',
      loading ? h('p', { class: 'muted' }, 'Memuat daftar audio…') : '',
      !loading && !lib.items.length ? h('p', { class: 'muted', id: 'az-empty' }, 'Belum ada audio adzan. BAITUNA tidak membawa rekaman sendiri; Super Admin yang mengunggahnya. Sampai ada, adzan hanya berupa notifikasi tanpa suara.') : '',
      h('h4', {}, 'Untuk semua waktu salat'),
      none('az-umum', 'az-audio-none', 'Tanpa suara (hanya notifikasi)', !S.adzan.audio || !umum.some(i => i.id === S.adzan.audio), () => { S.adzan.audio = null; commit(); draw(); }),
      ...umum.map(it => audioRow(it, 'az-umum', S.adzan.audio === it.id, id => { S.adzan.audio = id; commit(); draw(); })),
      h('h4', {}, 'Khusus Subuh'),
      subuh.length ? '' : h('p', { class: 'hint' }, 'Belum ada audio khusus Subuh. Adzan Subuh memiliki lafaz tambahan; sampai audionya ada, Subuh memakai pilihan di atas.'),
      none('az-subuh', 'az-subuh-same', 'Sama dengan pilihan di atas', !S.adzan.subuhAudio || !subuh.some(i => i.id === S.adzan.subuhAudio), () => { S.adzan.subuhAudio = null; commit(); draw(); }),
      ...subuh.map(it => audioRow(it, 'az-subuh', S.adzan.subuhAudio === it.id, id => { S.adzan.subuhAudio = id; commit(); draw(); })),
      h('label', { class: 'hint' }, 'Volume (sebagian HP, termasuk iPhone, mengatur volume lewat tombol HP)'), vol,
      h('div', { class: 'row-btns' }, h('button', { class: 'btn-sm', type: 'button', id: 'az-test', onclick: async () => {
        const it = A.pickFor(S, 'dhuhr', lib.items);
        if (permState() === 'granted') await N.show('Uji adzan BAITUNA', 'Jika Anda melihat ini, notifikasi berfungsi saat aplikasi terbuka.', 'adzan-uji');
        if (!it) { toast('Belum ada audio yang dipilih. Notifikasi uji dikirim tanpa suara.', true); return; }
        const r = await A.play(it, { volume: S.adzan.volume });
        if (!r.ok) toast('Audio belum bisa diputar. Ketuk sekali lagi, atau periksa koneksi.', true);
      } }, 'Uji adzan sekarang')),
      h('p', { class: 'hint' }, 'Yang dipilih di sini memengaruhi HP ini saja. Admin Masjid dan jamaah sama-sama hanya memilih; daftar audio hanya bisa diubah Super Admin.')];
    return h('div', { class: 'panel', id: 'az-audio' }, ...kids);
  }

  const limitsPanel = () => h('div', { class: 'panel', id: 'az-limits' }, h('h3', {}, 'Perlu diketahui'),
    h('ul', { class: 'az-list' },
      h('li', {}, 'Suara adzan hanya berbunyi ', h('b', {}, 'selama BAITUNA terbuka'), '. Ketuk layar sekali setelah membuka aplikasi.'),
      h('li', {}, 'Saat BAITUNA tertutup, aktifkan ', h('b', {}, 'push'), ' di Notifikasi > Pengaturan. Notifikasinya tanpa suara adzan.'),
      h('li', {}, 'Waktu dihitung di HP dan bisa beda beberapa menit. Tetap ikuti adzan masjid setempat.')));

  /* ---------- Super Admin ---------- */
  function adminPanel() {
    if (!isAdmin) return '';
    const name = h('input', { class: 'in', id: 'azm-name', maxlength: '80', placeholder: 'Nama audio, mis. Adzan Masjid Contoh' });
    const kind = h('select', { class: 'in', id: 'azm-kind' }, h('option', { value: 'umum' }, 'Adzan umum (semua waktu salat)'), h('option', { value: 'subuh' }, 'Adzan Subuh (dengan lafaz tambahan)'));
    const credit = h('input', { class: 'in', id: 'azm-credit', maxlength: '200', placeholder: 'Sumber / pelantun / lisensi rekaman (wajib)' });
    const file = h('input', { class: 'in', id: 'azm-file', type: 'file', accept: 'audio/mpeg,audio/mp4,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav', 'aria-label': 'Pilih berkas audio' });
    const msg = h('p', { class: 'hint', role: 'status', id: 'azm-msg' }, '');
    const add = h('button', { class: 'btn-sm', type: 'button', id: 'azm-add' }, 'Unggah audio');
    add.addEventListener('click', async () => {
      if (busy) return;
      const f = file.files && file.files[0];
      [name, credit, file].forEach(x => x.removeAttribute('aria-invalid'));
      const v = A.validate({ name: name.value, kind: kind.value, credit: credit.value });
      if (v.error) {
        msg.textContent = v.error; msg.className = 'hint jerr';
        const bad = /sumber|pelantun|lisensi/i.test(v.error) ? credit : /nama/i.test(v.error) ? name : null;
        [name, credit, file].forEach(x => x.removeAttribute('aria-invalid'));
        if (bad) { bad.setAttribute('aria-invalid', 'true'); bad.focus(); }
        toast(v.error, true); return;
      }
      if (!A.fileOk(f)) { const t = !f ? 'Pilih berkas audio dulu (MP3, M4A, OGG, atau WAV, maksimal ' + Math.round(A.MAX_BYTES / 1048576) + ' MB).' : 'Berkas harus MP3, M4A, OGG, atau WAV, maksimal ' + Math.round(A.MAX_BYTES / 1048576) + ' MB.'; msg.textContent = t; msg.className = 'hint jerr'; toast(t, true); return; }
      busy = true; add.disabled = true; msg.textContent = 'Mengunggah…'; msg.className = 'hint';
      try { await A.addAudio(f, { name: name.value, kind: kind.value, credit: credit.value }); toast('Audio ditambahkan.'); busy = false; await refresh(); }
      catch (e) { busy = false; add.disabled = false; msg.textContent = e && e.code ? e.message : e && e.status === 403 ? 'Hanya Super Admin yang boleh menambah audio.' : e && e.status === 413 ? 'Berkas terlalu besar.' : 'Belum tersimpan. Pastikan adzan.sql sudah dijalankan di Supabase, lalu coba lagi.'; msg.className = 'hint jerr'; }
    });
    const list = (adminItems || []);
    const rows = list.map(it => {
      if (editing === it.id) {
        const n = h('input', { class: 'in', id: 'aze-name', value: it.name, maxlength: '80' }), c = h('input', { class: 'in', id: 'aze-credit', value: it.credit, maxlength: '200' });
        const k = h('select', { class: 'in', id: 'aze-kind' }, h('option', { value: 'umum' }, KIND_L.umum), h('option', { value: 'subuh' }, KIND_L.subuh)); k.value = it.kind;
        const m = h('p', { class: 'hint jerr', role: 'alert' }, '');
        return h('div', { class: 'azm-row', 'data-id': it.id }, n, k, c, m, h('div', { class: 'row-btns' },
          h('button', { class: 'btn-sm', type: 'button', id: 'aze-save', onclick: async () => { try { await A.updateAudio(it.id, { name: n.value, credit: c.value, kind: k.value }); editing = null; toast('Disimpan.'); await refresh(); } catch (e) { m.textContent = e && e.code === 'invalid' ? e.message : 'Belum tersimpan.'; } } }, 'Simpan'),
          h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { editing = null; draw(); } }, 'Batal')));
      }
      return h('div', { class: 'azm-row' + (it.active ? '' : ' off'), 'data-id': it.id },
        h('div', {}, h('b', {}, it.name), ' ', h('span', { class: 'badge' }, KIND_L[it.kind]), ' ', h('span', { class: 'badge b-' + (it.active ? 'active' : 'draft') }, it.active ? 'Aktif' : 'Nonaktif')),
        h('p', { class: 'muted az-credit' }, 'Sumber: ' + it.credit + (it.size_bytes ? ' · ' + sizeText(it.size_bytes) : '')),
        h('div', { class: 'row-btns' },
          h('button', { class: 'btn-sm ghost', type: 'button', 'data-play': it.id, onclick: () => togglePlay(it) }, 'Putar contoh'),
          h('button', { class: 'btn-sm ghost', type: 'button', 'data-act': 'edit', onclick: () => { editing = it.id; draw(); } }, 'Ubah'),
          h('button', { class: 'btn-sm ghost', type: 'button', 'data-act': 'toggle', onclick: async () => { try { await A.updateAudio(it.id, { active: !it.active }); await refresh(); } catch (e) { toast('Belum tersimpan.', true); } } }, it.active ? 'Nonaktifkan' : 'Aktifkan'),
          h('button', { class: 'btn-sm ghost', type: 'button', 'data-act': 'delete', onclick: async () => {
            if (!(await ask({ title: 'Hapus audio ini?', text: '"' + it.name + '" dihapus untuk semua pengguna. Pengguna yang memilihnya kembali ke "tanpa suara".', ok: 'Hapus' }))) return;
            try { await A.deleteAudio(it); toast('Audio dihapus.'); await refresh(); } catch (e) { toast('Belum terhapus.', true); }
          } }, 'Hapus')));
    });
    return h('div', { class: 'panel', id: 'az-admin' }, h('h3', {}, 'Kelola audio adzan (khusus Super Admin)'),
      h('p', { class: 'muted' }, 'Unggah rekaman adzan (MP3, M4A, OGG, atau WAV, maksimal ' + Math.round(A.MAX_BYTES / 1048576) + ' MB). Catat sumber atau pelantun dan lisensinya, dan pastikan Anda berhak memakai rekaman itu. Sebaiknya audio ditinjau ustaz sebelum dipakai.'),
      name, kind, credit, file, msg, add,
      h('h4', {}, 'Daftar audio (' + list.length + ' dari maksimal 30)'),
      adminItems === null ? h('p', { class: 'hint jerr' }, 'Daftar belum bisa dimuat. Jika baru pertama dipakai, jalankan adzan.sql di Supabase SQL Editor, lalu muat ulang halaman ini.') : list.length ? h('div', { class: 'azm-list' }, ...rows) : h('p', { class: 'muted' }, 'Belum ada audio.'));
  }
  const KIND_L = A.KINDS;

  function draw() { wrap.replaceChildren(h('h2', { class: 'wtitle' }, 'Adzan'), statusPanel(), audioPanel(), limitsPanel(), adminPanel()); paintPlayButtons(); }

  draw();
  const sess = getSession();
  if (sess && sess.user) loadAccess(sess.user).then(a => { if (a && a.isAdmin) isAdmin = true; refresh(); }).catch(() => refresh());
  else refresh();
  return wrap;
}
