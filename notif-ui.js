// BAITUNA - notif-ui.js
// Pusat Notifikasi: kabar yang relevan (salat, puasa, kajian & program sosial masjid terdekat, produk baru) + pengaturan.
// Dihitung saat halaman dibuka. Tidak ada notifikasi saat aplikasi tertutup (lihat notif-service.js).
import { h, toast } from './ui.js';
import * as N from './notif-service.js';
import { FAST_GROUPS } from './puasa-service.js';
import { PRAYERS } from './prayer-times.js';
import { loadLinks, refsFor, brief } from './sunnah-link.js';
import { GRADES, SLOTS, loadDone } from './sunnah-service.js';

const SLOT_LABEL = SLOTS;
const notReady = e => e && (e.code === '42703' || e.code === 'PGRST204' || e.status === 400);

export function notifPage({ go } = {}) {
  const root = h('div', { class: 'notif' });
  let S = N.load(), seen = N.loadSeen(), tab = 'kabar';
  const model = { local: [], near: null, market: null };
  let loc = N.readLoc();
  let idx = null; // amalan dari Amalan Sunnah Harian (null = sedang dimuat)

  const sw = (label, checked, onchange, id) => {
    const inp = h('input', { type: 'checkbox', id: id || '' }); inp.checked = !!checked;
    inp.addEventListener('change', () => onchange(inp.checked));
    return h('label', { class: 'nt-sw' }, inp, h('span', {}, label));
  };
  const sel = (id, options, value, onchange, label) => {
    const s = h('select', { class: 'in', id, 'aria-label': label }, ...options.map(([v, t]) => h('option', { value: String(v) }, t)));
    s.value = String(value); s.addEventListener('change', () => onchange(s.value)); return s;
  };
  const commit = () => { N.save(S); S = N.load(); N.armReminders(); };

  function localItems() {
    loc = N.readLoc();
    const now = Date.now(), off = loc ? loc.off : -new Date(now).getTimezoneOffset() / 60;
    model.local = [...N.prayerItems(now, loc, S), ...N.fastingItems(now, off, S), ...N.ramadanItems(now, off, S), ...N.amalanItems(now, off, S), ...N.harianItems(now, loc, S, idx, loadDone(new Date(now))), ...N.customItems(now, loc, S)];
  }

  async function loadRemote() {
    model.near = null; model.market = null;
    const now = Date.now();
    const tasks = [];
    if (loc && (S.cats.kajian || S.cats.sosial || S.cats.info)) tasks.push(N.fetchNear(loc, S, now).then(d => { model.near = N.postItems(d, S, now); model.nearCount = d.near.length; }).catch(e => { model.near = notReady(e) ? 'sql' : 'err'; }));
    else model.near = [];
    if (S.cats.pasar) tasks.push(N.fetchMarket(S, now).then(r => { model.market = r; }).catch(() => { model.market = 'err'; }));
    else model.market = [];
    render();
    await Promise.all(tasks);
    render();
  }

  const unread = it => it.cat !== 'salat' && !seen[it.id];
  // Rujukan dari Amalan Sunnah Harian (diisi Super Admin): isi ringkas, sumber, dan derajat.
  function refBox(it, refs) {
    return h('div', { class: 'nt-refs' }, ...refs.map(r => h('div', { class: 'nt-ref' },
      h('b', {}, r.title), h('p', { class: 'nt-tx prewrap' }, brief(r.body)),
      h('p', { class: 'muted' }, 'Sumber: ' + r.source), h('p', { class: 'muted' }, 'Derajat: ' + (GRADES[r.grade] || '') + (r.grading ? ' (' + r.grading + ')' : '')))),
      go ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => go('sunnah') }, 'Buka Amalan Sunnah Harian') : '');
  }
  function itemCard(it) {
    const refs = idx && it.rkey ? refsFor(idx, it.rkey) : [], linked = refs.length > 0;
    const body = linked && it.desc !== undefined ? it.info : it.text;
    const card = h('article', { class: 'nt-item nt-' + it.cat + (unread(it) ? ' unread' : '') + (it.state ? ' st-' + it.state : ''), 'data-id': it.id },
      h('div', { class: 'nt-ttl' }, unread(it) ? h('i', { class: 'nt-dot', 'aria-label': 'Belum dibaca' }) : '', h('b', {}, it.title), it.state === 'next' ? h('span', { class: 'badge b-active' }, 'Berikutnya') : ''),
      body ? h('p', { class: 'nt-tx' }, body) : '');
    if (linked) card.append(refBox(it, refs));
    else if (idx && it.desc) card.append(h('p', { class: 'muted nt-gen' }, 'Keterangan umum aplikasi; rujukan hadits belum diisi di Amalan Sunnah Harian.'));
    if (it.cat === 'harian' && go) card.append(h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => go('sunnah') }, 'Buka Amalan Sunnah Harian'));
    if (it.cat === 'pasar' && go) card.append(h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => go('market') }, 'Buka Pasar Umat'));
    if ((it.cat === 'kajian' || it.cat === 'sosial' || it.cat === 'info') && go) card.append(h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => go('info') }, 'Lihat Agenda & Pengumuman'));
    card.addEventListener('click', e => { if (e.target.closest('button') || !unread(it)) return; seen = N.markSeen(seen, [it.id]); render(); });
    return card;
  }

  function section(cat, items, state, emptyText) {
    const body = state === 'loading' ? h('p', { class: 'muted' }, 'Memuat…')
      : state === 'err' ? h('p', { class: 'muted', role: 'alert' }, 'Belum bisa dimuat. Periksa koneksi, lalu buka ulang halaman ini.')
      : state === 'sql' ? h('p', { class: 'muted', role: 'alert' }, 'Jenis kabar belum aktif di server. Pengelola perlu menjalankan notif.sql di Supabase SQL Editor.')
      : items.length ? items.map(itemCard) : h('p', { class: 'muted' }, emptyText);
    return h('section', { class: 'panel nt-sec', 'data-cat': cat }, h('h3', {}, N.CATS[cat]), body);
  }

  function kabarView() {
    const all = [...model.local, ...(Array.isArray(model.near) ? model.near : []), ...(Array.isArray(model.market) ? model.market : [])];
    const un = all.filter(unread);
    const bar = h('div', { class: 'nt-bar' }, h('span', { class: 'muted', id: 'nt-count' }, un.length ? un.length + ' kabar belum dibaca' : 'Semua sudah dibaca'),
      un.length ? h('button', { class: 'btn-sm ghost', type: 'button', id: 'nt-readall', onclick: () => { seen = N.markSeen(seen, un.map(x => x.id)); render(); } }, 'Tandai semua dibaca') : '');
    const locBox = loc
      ? h('p', { class: 'nt-loc muted', id: 'nt-loc' }, 'Lokasi: ' + loc.label + '. Dipakai di perangkat ini saja untuk waktu salat dan masjid terdekat.', ' ', go ? h('button', { class: 'linkbtn', type: 'button', onclick: () => go('jadwal') }, 'Ubah') : '')
      : h('div', { class: 'panel nt-noloc', id: 'nt-noloc' }, h('p', {}, 'Pilih lokasi lebih dulu agar waktu salat dan kabar masjid terdekat tampil. Lokasi hanya disimpan di perangkat Anda.'),
          go ? h('button', { class: 'btn-sm', type: 'button', onclick: () => go('jadwal') }, 'Pilih lokasi di Jadwal Salat') : '');
    const parts = [bar, locBox];
    const on = N.CAT_ORDER.filter(c => S.cats[c]);
    if (!on.length) parts.push(h('div', { class: 'panel center' }, h('p', {}, 'Semua jenis notifikasi sedang dimatikan. Aktifkan lagi di tab Pengaturan.')));
    for (const c of on) {
      if (c === 'salat') { if (loc) parts.push(section('salat', model.local.filter(x => x.cat === 'salat'), 'ok', 'Tidak ada waktu salat yang dipilih. Atur di tab Pengaturan.')); }
      else if (c === 'puasa') parts.push(section('puasa', model.local.filter(x => x.cat === 'puasa'), 'ok', 'Tidak ada puasa yang perlu diingat dalam 30 hari ke depan menurut pilihan Anda.'));
      else if (c === 'ramadan') parts.push(section('ramadan', model.local.filter(x => x.cat === 'ramadan'), 'ok', 'Hitung mundur Ramadan belum tersedia di peramban ini.'));
      else if (c === 'amalan') parts.push(section('amalan', model.local.filter(x => x.cat === 'amalan'), 'ok', 'Tidak ada salat gerhana, salat Id, atau malam ganjil Ramadan dalam 14 hari ke depan. Daftar gerhana hanya memuat yang sudah terverifikasi dan terlihat dari Indonesia.'));
      else if (c === 'harian') parts.push(section('harian', model.local.filter(x => x.cat === 'harian'), idx ? 'ok' : 'loading', 'Amalan sunnah harian belum diisi oleh admin pusat. Setelah diisi, amalan muncul di sini sesuai waktu Jadwal Salat.'));
      else if (c === 'pribadi') parts.push(section('pribadi', model.local.filter(x => x.cat === 'pribadi'), 'ok', 'Tidak ada pengingat pribadi untuk hari ini. Buat sendiri di tab Pengaturan, bagian "Pengingat pribadi saya".'));
      else if (c === 'pasar') parts.push(section('pasar', Array.isArray(model.market) ? model.market : [], model.market === null ? 'loading' : model.market === 'err' ? 'err' : 'ok', 'Belum ada produk baru dalam 7 hari terakhir.'));
      else {
        const st = !loc ? 'ok' : model.near === null ? 'loading' : model.near === 'err' ? 'err' : model.near === 'sql' ? 'sql' : 'ok';
        const items = Array.isArray(model.near) ? model.near.filter(x => x.cat === c) : [];
        const empty = !loc ? 'Pilih lokasi untuk melihat kabar masjid terdekat.' : model.nearCount === 0 ? 'Belum ada masjid terdaftar dalam radius ' + S.radius + ' km. Perluas radius di Pengaturan.'
          : c === 'kajian' ? 'Belum ada kajian dalam 14 hari ke depan di masjid terdekat.' : c === 'sosial' ? 'Belum ada program sosial dari masjid terdekat.' : 'Belum ada pengumuman baru dari masjid terdekat.';
        parts.push(section(c, items, st, empty));
      }
    }
    parts.push(h('p', { class: 'hint' }, 'Waktu salat dan tanggal puasa adalah perkiraan (hitungan di perangkat dan kalender Umm al-Qura). Ikuti jadwal resmi masjid setempat dan penetapan Kemenag.'));
    return parts;
  }

  function customPanel(upd) {
    const DN = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'], dayBoxes = DN.map((n, i) => { const c = h('input', { type: 'checkbox', id: 'ns-c-d' + i, 'aria-label': n }); return [c, h('label', { class: 'nt-day' }, c, h('span', {}, n))]; });
    const label = h('input', { class: 'in', id: 'ns-c-label', maxlength: '40', placeholder: 'Nama pengingat, mis. Dzikir pagi', 'aria-label': 'Nama pengingat', autocomplete: 'off' });
    const time = h('input', { class: 'in', type: 'time', id: 'ns-c-time', 'aria-label': 'Jam pengingat' });
    const add = h('button', { class: 'btn-sm', type: 'button', id: 'ns-c-add', onclick: () => {
      const days = dayBoxes.map(([c], i) => c.checked ? i : -1).filter(i => i >= 0), nm = label.value.trim();
      if (nm.length < 2) { toast('Isi nama pengingat.', true); return; }
      if (!time.value) { toast('Pilih jam pengingat.', true); return; }
      if (!days.length) { toast('Pilih minimal satu hari.', true); return; }
      if (S.custom.length >= N.MAX_CUSTOM) { toast('Maksimal ' + N.MAX_CUSTOM + ' pengingat pribadi.', true); return; }
      S.custom = [...S.custom, { id: Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), label: nm, time: time.value, days }];
      commit(); localItems(); render(); toast('Pengingat ditambahkan.');
    } }, 'Tambah pengingat');
    const list = S.custom.map(c => h('div', { class: 'nt-cust', 'data-id': c.id }, h('span', {}, h('b', {}, c.label), ' · ' + c.time + ' · ' + (c.days.length === 7 ? 'tiap hari' : c.days.map(d => DN[d]).join(', '))),
      h('button', { class: 'btn-sm alt', type: 'button', 'aria-label': 'Hapus pengingat ' + c.label, onclick: () => { S.custom = S.custom.filter(x => x.id !== c.id); commit(); localItems(); render(); } }, 'Hapus')));
    return h('div', { class: 'panel', id: 'ns-custom' }, h('h3', {}, 'Pengingat pribadi saya'),
      h('p', { class: 'muted' }, 'Buat pengingat sesuai kebiasaan Anda sendiri (mis. dzikir, tilawah, atau puasa pilihan). Hanya tersimpan di perangkat ini dan berbunyi saat BAITUNA terbuka.'),
      N.trackerReminders().length ? h('p', { class: 'muted', id: 'ns-tr-note' }, N.trackerReminders().length + ' pengingat dari Tracker Ibadah Harian ikut tampil di Kabar dan berbunyi di sini. ', go ? h('button', { class: 'linkbtn', type: 'button', onclick: () => go('tracker') }, 'Kelola di Tracker') : '') : '',
      ...list, label, time, h('div', { class: 'nt-days' }, ...dayBoxes.map(x => x[1])), add);
  }

  function settingsView() {
    const timeIn = (id, value, onchange, label) => { const i = h('input', { class: 'in', type: 'time', id, 'aria-label': label, required: 'required' }); i.value = value; i.addEventListener('change', () => { if (/^([01]\d|2[0-3]):[0-5]\d$/.test(i.value)) onchange(i.value); }); return i; };
    const upd = fn => v => { fn(v); commit(); localItems(); render(); if (needRemote) { needRemote = false; loadRemote(); } };
    let needRemote = false;
    const catRows = N.CAT_ORDER.map(c => sw(N.CATS[c], S.cats[c], upd(v => { S.cats[c] = v; needRemote = true; }), 'ns-cat-' + c));
    const devOk = N.deviceSupported(), perm = devOk ? Notification.permission : 'unsupported';
    const devBox = h('div', { class: 'panel' }, h('h3', {}, 'Pengingat di HP'),
      h('p', { class: 'muted' }, 'Aplikasi web tidak dapat membunyikan notifikasi saat BAITUNA ditutup. Pengingat di bawah hanya berbunyi selama BAITUNA masih terbuka di peramban (boleh di latar belakang, tetapi HP bisa menghentikannya). Untuk azan yang pasti berbunyi, gunakan aplikasi azan atau alarm bawaan HP.'),
      devOk ? [
        sw('Tampilkan pengingat sebagai notifikasi HP (saat aplikasi terbuka)', S.device && perm === 'granted', async v => {
          if (!v) { S.device = false; commit(); render(); return; }
          let p = Notification.permission;
          if (p === 'default') { try { p = await Notification.requestPermission(); } catch (e) { p = 'denied'; } }
          if (p !== 'granted') { S.device = false; commit(); toast('Izin notifikasi tidak diberikan. Aktifkan lewat pengaturan peramban jika ingin memakai pengingat.', true); render(); return; }
          S.device = true; commit(); toast('Pengingat aktif selama BAITUNA terbuka.'); render();
        }, 'ns-device'),
        h('label', { class: 'hint' }, 'Ingatkan salat dan amalan harian (termasuk Dhuha dan Tahajud yang dipilih; hitung mundur Ramadan pukul 08.00)'), sel('ns-lead', N.LEADS.map(m => [m, m ? m + ' menit sebelum waktu' : 'tepat saat waktu masuk']), S.lead, v => { S.lead = Number(v); commit(); }, 'Pengingat salat'),
        h('label', { class: 'hint' }, 'Pengingat puasa (malam sebelumnya)'), sel('ns-fh', N.FAST_HOURS.map(x => [x, 'pukul ' + x + '.00']), S.fastHour, v => { S.fastHour = Number(v); commit(); }, 'Jam pengingat puasa'),
        h('button', { class: 'btn-sm ghost', type: 'button', id: 'ns-test', onclick: async () => {
          if (perm !== 'granted') { toast('Aktifkan pengingat HP lebih dulu.', true); return; }
          const ok = await N.show('Uji notifikasi BAITUNA', 'Jika Anda melihat ini, notifikasi HP berfungsi saat aplikasi terbuka.', 'uji');
          toast(ok ? 'Notifikasi uji dikirim.' : 'Notifikasi tidak dapat ditampilkan di peramban ini.', !ok);
        } }, 'Coba kirim notifikasi uji'),
        perm === 'denied' ? h('p', { class: 'mk-err' }, 'Izin notifikasi diblokir di peramban. Ubah lewat pengaturan situs di peramban.') : ''
      ] : h('p', { class: 'muted' }, 'Peramban ini tidak mendukung notifikasi. Pusat Notifikasi di halaman ini tetap berfungsi.'));
    return [
      h('div', { class: 'panel' }, h('h3', {}, 'Jenis notifikasi'), h('p', { class: 'muted' }, 'Matikan yang tidak Anda perlukan agar tidak terganggu.'), ...catRows),
      S.cats.salat ? h('div', { class: 'panel' }, h('h3', {}, 'Waktu salat'), h('p', { class: 'muted' }, 'Waktu salat otomatis mengikuti Jadwal Salat (lokasi dan hitungan yang sama). Pilihan di sini juga tampil di halaman Jadwal Salat.'), go ? h('button', { class: 'linkbtn', type: 'button', onclick: () => go('jadwal') }, 'Buka Jadwal Salat') : '', ...[...PRAYERS, ['dhuha', 'Salat Dhuha (sunnah)'], ['tahajud', 'Salat Tahajud (sunnah)']].map(([k, n]) => sw(n, S.prayers[k], upd(v => { S.prayers[k] = v; }), 'ns-p-' + k)),
        h('h4', {}, 'Kebiasaan saya'), h('p', { class: 'muted' }, 'Setiap orang berbeda; atur sesuai kebiasaan Anda. Pilihan ini hanya tersimpan di perangkat ini.'),
        h('label', { class: 'hint' }, 'Awal waktu Dhuha bagi saya'), sel('ns-dhuha-min', N.DHUHA_OPTIONS.map(m => [m, m + ' menit setelah terbit' + (m === 20 ? ' (bawaan)' : '')]), S.mine.dhuhaMin, upd(v => { S.mine.dhuhaMin = Number(v); }), 'Awal Dhuha'),
        h('label', { class: 'hint' }, 'Waktu Tahajud bagi saya'), sel('ns-tj-mode', [['third', 'Sepertiga malam terakhir (bawaan, dihitung otomatis)'], ['custom', 'Jam pilihan saya']], S.mine.tahajudMode, upd(v => { S.mine.tahajudMode = v; }), 'Cara menentukan Tahajud'),
        S.mine.tahajudMode === 'custom' ? timeIn('ns-tj-time', S.mine.tahajudTime, upd(v => { S.mine.tahajudTime = v; }), 'Jam Tahajud') : '') : '',
      S.cats.harian ? h('div', { class: 'panel' }, h('h3', {}, 'Amalan sunnah harian'), h('p', { class: 'muted' }, 'Isi amalan diambil dari menu Amalan Sunnah Harian; waktu mulainya mengikuti Jadwal Salat (hanya penanda awal, bukan batas ibadah).'), ...Object.keys(S.slots).map(k => sw('Amalan ' + SLOT_LABEL[k].toLowerCase(), S.slots[k], upd(v => { S.slots[k] = v; }), 'ns-s-' + k))) : '',
      S.cats.puasa ? h('div', { class: 'panel' }, h('h3', {}, 'Puasa'), ...Object.entries(FAST_GROUPS).map(([k, n]) => sw(n, S.fasts[k], upd(v => { S.fasts[k] = v; }), 'ns-f-' + k)),
        h('h4', {}, 'Puasa yang saya kerjakan'), h('p', { class: 'muted' }, 'Matikan puasa yang tidak Anda kerjakan agar tidak diingatkan.'),
        ...Object.entries(N.FAST_KEYS).map(([k, n]) => sw('Puasa ' + n, S.fastKeys[k], upd(v => { S.fastKeys[k] = v; }), 'ns-fk-' + k))) : '',
      S.cats.pribadi ? customPanel(upd) : '',
      (S.cats.kajian || S.cats.sosial || S.cats.info) ? h('div', { class: 'panel' }, h('h3', {}, 'Masjid terdekat'), h('label', { class: 'hint' }, 'Jarak maksimal'), sel('ns-radius', N.RADII.map(r => [r, r + ' km']), S.radius, v => { S.radius = Number(v); commit(); needRemote = true; render(); loadRemote(); needRemote = false; }, 'Jarak masjid'),
        h('p', { class: 'muted' }, 'Jarak dihitung di perangkat dari lokasi yang Anda pilih di Jadwal Salat.')) : '',
      devBox
    ];
  }

  function render() {
    const tabs = h('div', { class: 'zk-tabs', role: 'tablist' }, ...[['kabar', 'Kabar'], ['atur', 'Pengaturan']].map(([k, l]) =>
      h('button', { class: 'zk-tab' + (tab === k ? ' on' : ''), type: 'button', role: 'tab', 'data-t': k, 'aria-selected': String(tab === k), onclick: () => { tab = k; render(); } }, l)));
    root.replaceChildren(h('h2', {}, 'Notifikasi'),
      h('p', { class: 'muted' }, 'Kabar yang sesuai pilihan Anda. Daftar dihitung saat halaman ini dibuka; BAITUNA tidak mengirim notifikasi saat aplikasi tertutup.'),
      tabs, ...(tab === 'kabar' ? kabarView() : settingsView()));
  }

  localItems(); render(); loadRemote();
  loadLinks().then(i => { idx = i; localItems(); render(); });
  N.armReminders();
  return root;
}
