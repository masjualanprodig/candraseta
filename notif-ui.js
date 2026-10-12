// BAITUNA - notif-ui.js
// Pusat Notifikasi: kabar yang relevan (salat, puasa, kajian & program sosial masjid terdekat, produk baru) + pengaturan.
// Dihitung saat halaman dibuka. Tidak ada notifikasi saat aplikasi tertutup (lihat notif-service.js).
import { h, toast } from './ui.js';
import * as N from './notif-service.js';
import { FAST_GROUPS } from './puasa-service.js';
import { PRAYERS } from './prayer-times.js';

const notReady = e => e && (e.code === '42703' || e.code === 'PGRST204' || e.status === 400);

export function notifPage({ go } = {}) {
  const root = h('div', { class: 'notif' });
  let S = N.load(), seen = N.loadSeen(), tab = 'kabar';
  const model = { local: [], near: null, market: null };
  let loc = N.readLoc();

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
    model.local = [...N.prayerItems(now, loc, S), ...N.fastingItems(now, off, S), ...N.ramadanItems(now, off, S), ...N.amalanItems(now, off, S)];
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
  function itemCard(it) {
    const card = h('article', { class: 'nt-item nt-' + it.cat + (unread(it) ? ' unread' : '') + (it.state ? ' st-' + it.state : ''), 'data-id': it.id },
      h('div', { class: 'nt-ttl' }, unread(it) ? h('i', { class: 'nt-dot', 'aria-label': 'Belum dibaca' }) : '', h('b', {}, it.title), it.state === 'next' ? h('span', { class: 'badge b-active' }, 'Berikutnya') : ''),
      h('p', { class: 'nt-tx' }, it.text));
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

  function settingsView() {
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
        h('label', { class: 'hint' }, 'Ingatkan salat (termasuk Dhuha dan Tahajud yang dipilih; hitung mundur Ramadan pukul 08.00)'), sel('ns-lead', N.LEADS.map(m => [m, m ? m + ' menit sebelum waktu' : 'tepat saat waktu masuk']), S.lead, v => { S.lead = Number(v); commit(); }, 'Pengingat salat'),
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
      S.cats.salat ? h('div', { class: 'panel' }, h('h3', {}, 'Waktu salat'), ...[...PRAYERS, ['dhuha', 'Salat Dhuha (sunnah)'], ['tahajud', 'Salat Tahajud (sepertiga malam terakhir, sunnah)']].map(([k, n]) => sw(n, S.prayers[k], upd(v => { S.prayers[k] = v; }), 'ns-p-' + k))) : '',
      S.cats.puasa ? h('div', { class: 'panel' }, h('h3', {}, 'Puasa'), ...Object.entries(FAST_GROUPS).map(([k, n]) => sw(n, S.fasts[k], upd(v => { S.fasts[k] = v; }), 'ns-f-' + k))) : '',
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
  N.armReminders();
  return root;
}
