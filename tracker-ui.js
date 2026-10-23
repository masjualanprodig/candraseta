// BAITUNA - tracker-ui.js
// Tracker Ibadah Harian: pribadi, opsional, hanya di perangkat. Tidak ada skor, peringkat, atau streak.
import { h, toast, ask } from './ui.js';
import * as T from './tracker-service.js';

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const longDate = k => parseKey(k).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = k => parseKey(k).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

export function trackerPage() {
  const wrap = h('div', { class: 'tracker' });
  let data = T.load(), view = T.dayKey(), range = 7, hasil = 'pekan', openRing = false;
  const today = () => T.dayKey();
  const oldest = () => T.dayKeysBack(T.BACK_DAYS + 1)[0];
  const commit = next => { data = next; if (!T.save(data)) toast('Belum bisa disimpan di perangkat ini.', true); };
  const act = fn => { commit(fn(data)); draw(); };

  function section(title, ...kids) { return h('section', { class: 'panel tk-sec' }, h('h3', { class: 'tk-h' }, title), ...kids); }

  /* ---- pengingat yang sedang jatuh tempo (hanya saat aplikasi dibuka) ---- */
  function dueBox() {
    const due = T.dueReminders(data, new Date());
    if (!due.length) return '';
    return h('div', { class: 'tk-due', role: 'status' }, ...due.map(r => h('div', { class: 'tk-duerow' },
      h('span', {}, 'Pengingat Anda: ', h('b', {}, r.label), ' (jam ' + r.time + ')'),
      h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => act(d => T.dismissReminder(d, r.id)) }, 'Tutup'))));
  }

  function dateNav() {
    const k = view, isToday = k === today();
    const prev = h('button', { class: 'tk-nav', type: 'button', 'aria-label': 'Hari sebelumnya', onclick: () => { view = T.dayKey(new Date(parseKey(k).getTime() - 86400000)); draw(); } }, '‹');
    const next = h('button', { class: 'tk-nav', type: 'button', 'aria-label': 'Hari berikutnya', onclick: () => { view = T.dayKey(new Date(parseKey(k).getTime() + 86400000)); draw(); } }, '›');
    prev.disabled = k <= oldest(); next.disabled = isToday;
    return h('div', { class: 'tk-date' }, prev, h('div', { class: 'tk-dtx' }, h('b', {}, isToday ? 'Hari ini' : 'Catatan hari lalu'), h('span', { class: 'muted' }, longDate(k))), next);
  }

  function salatSec(day) {
    const done = T.SALAT_KEYS.filter(s => day.salat[s]).length;
    const btns = T.SALAT.map(([key, label]) => {
      const on = !!day.salat[key];
      const b = h('button', { class: 'tk-salat' + (on ? ' on' : ''), type: 'button', 'data-s': key, 'aria-pressed': String(on), onclick: () => act(d => T.toggleSalat(d, view, key)) },
        h('span', { class: 'tk-chk', 'aria-hidden': 'true' }, on ? '✓' : ''), h('span', {}, label));
      b.disabled = day.off; return b;
    });
    const off = h('label', { class: 'tk-off' }, h('input', { type: 'checkbox', id: 'tk-off', checked: day.off ? true : undefined, onchange: ev => act(d => T.setOff(d, view, ev.target.checked)) }), h('span', {}, 'Libur hari ini (udzur, sakit, atau safar) — tidak dihitung di ringkasan'));
    off.querySelector('input').checked = day.off;
    return section('Salat wajib', h('div', { class: 'tk-salats' }, ...btns),
      h('p', { class: 'muted tk-sum' }, day.off ? 'Hari ini tidak dihitung.' : done + ' dari 5 tercatat'), off);
  }

  function quranSec(day) {
    const n = day.quran, tg = data.quranTarget;
    const minus = h('button', { class: 'tk-step', type: 'button', 'aria-label': 'Kurangi satu halaman', onclick: () => act(d => T.setQuran(d, view, n - 1)) }, '−');
    minus.disabled = n <= 0;
    const plus = h('button', { class: 'tk-step', type: 'button', 'aria-label': 'Tambah satu halaman', onclick: () => act(d => T.setQuran(d, view, n + 1)) }, '+');
    const tin = h('input', { class: 'in tk-num', type: 'number', min: '0', max: String(T.MAX_QURAN), inputmode: 'numeric', 'aria-label': 'Target halaman per hari' }); tin.value = String(tg);
    return section('Membaca Al-Qur’an',
      h('div', { class: 'tk-stepper' }, minus, h('div', { class: 'tk-val' }, h('b', { id: 'tk-q' }, String(n)), h('span', { class: 'muted' }, 'halaman')), plus),
      tg > 0 ? h('div', {}, h('div', { class: 'dbar', role: 'img', 'aria-label': n + ' dari target ' + tg + ' halaman' }, h('i', { style: 'width:' + Math.min(100, Math.round(n / tg * 100)) + '%' })),
        h('p', { class: 'muted tk-sum' }, n >= tg ? 'Target ' + tg + ' halaman hari ini sudah tercapai. Barakallah.' : 'Target ' + tg + ' halaman · tersisa ' + (tg - n))) : h('p', { class: 'muted tk-sum' }, 'Belum ada target. Anda tetap bisa mencatat halaman yang dibaca.'),
      h('div', { class: 'tk-trow' }, h('label', { class: 'hint', for: 'tk-tg' }, 'Target harian (halaman, 0 = tanpa target)'), tin, h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => {
        const v = Number(tin.value); if (!Number.isInteger(v) || v < 0 || v > T.MAX_QURAN) { toast('Isi angka bulat 0 sampai ' + T.MAX_QURAN + '.', true); return; }
        act(d => T.setTarget(d, v)); toast(v ? 'Target disimpan.' : 'Target dihapus.');
      } }, 'Simpan target')));
  }

  function amalanSec(day) {
    const rows = data.items.map(it => {
      const on = day.items.includes(it.id);
      return h('div', { class: 'tk-item' },
        h('button', { class: 'tk-itog' + (on ? ' on' : ''), type: 'button', 'data-id': it.id, 'aria-pressed': String(on), onclick: () => act(d => T.toggleItem(d, view, it.id)) }, h('span', { class: 'tk-chk', 'aria-hidden': 'true' }, on ? '✓' : ''), h('span', {}, it.name)),
        h('button', { class: 'tk-x', type: 'button', 'aria-label': 'Hapus ' + it.name, onclick: async () => { if (!(await ask({ title: 'Hapus "' + it.name + '"?', text: 'Amalan ini dan centangnya di semua hari akan dihapus dari perangkat ini.', reason: false }))) return; act(d => T.removeItem(d, it.id)); } }, '✕'));
    });
    const name = h('input', { class: 'in', placeholder: 'Tambah amalan atau zikir (nama saja)', maxlength: String(T.MAX_NAME), autocomplete: 'off', 'aria-label': 'Nama amalan baru' });
    const add = nm => { const nx = T.addItem(data, nm); if (nx === data) { toast(data.items.length >= T.MAX_ITEMS ? 'Maksimal ' + T.MAX_ITEMS + ' amalan.' : 'Isi nama yang belum ada dalam daftar.', true); return; } commit(nx); draw(); };
    const sug = T.SUGGESTIONS.filter(s => !data.items.some(i => i.name.toLowerCase() === s.toLowerCase()));
    const note = h('textarea', { class: 'in', rows: '3', maxlength: String(T.MAX_NOTE), placeholder: 'Catatan pribadi, mis. zikir yang dibaca hari ini', 'aria-label': 'Catatan zikir dan amalan' }); note.value = day.note;
    note.addEventListener('input', () => { commit(T.setNote(data, view, note.value)); });
    return section('Zikir & amalan sunnah',
      rows.length ? h('div', { class: 'tk-items' }, ...rows) : h('p', { class: 'muted' }, 'Belum ada daftar. Tambahkan amalan yang ingin Anda catat, atau pilih contoh di bawah.'),
      h('form', { class: 'tk-add', novalidate: 'novalidate', onsubmit: ev => { ev.preventDefault(); add(name.value); } }, name, h('button', { class: 'btn-sm', type: 'submit' }, 'Tambah')),
      sug.length ? h('div', { class: 'tk-sug' }, ...sug.map(s => h('button', { class: 'achip', type: 'button', onclick: () => add(s) }, '+ ' + s))) : '',
      h('p', { class: 'hint' }, 'Daftar ini milik Anda sendiri; aplikasi tidak menilai atau menetapkan hukum amalan. Untuk dalil dan sumber, lihat halaman Amalan Sunnah Harian dan Doa Shahih.'),
      h('label', { class: 'flab' }, h('span', { class: 'hint' }, 'Catatan hari ini'), note));
  }


  /* ---- hasil target: per hari atau per pekan, sederhana ---- */
  function goalSec() {
    const chip = (k, l) => h('button', { class: 'achip', type: 'button', role: 'tab', 'data-hasil': k, 'aria-selected': String(hasil === k), onclick: () => { hasil = k; draw(); } }, l);
    const tabs = h('div', { class: 'achips', role: 'tablist', 'aria-label': 'Hasil per hari atau per pekan' }, chip('hari', view === today() ? 'Hari ini' : 'Hari dipilih'), chip('pekan', '7 hari terakhir'));
    if (hasil === 'hari') {
      const g = T.dayGoal(data, view);
      const body = g.state === 'notarget' ? [] : [
        h('div', { class: 'tg-big' }, h('b', { id: 'tg-done' }, g.done + ' dari ' + g.total), h('span', { class: 'muted' }, ' target tercapai')),
        h('div', { class: 'dbar tg-bar' + (g.state === 'full' ? ' full' : ''), role: 'img', 'aria-label': g.done + ' dari ' + g.total + ' target' }, h('i', { style: 'width:' + g.pct + '%' })),
        h('ul', { class: 'tg-parts' }, ...g.parts.map(p => h('li', { class: (p.got === p.units ? 'ok' : '') }, h('span', { class: 'tg-mk', 'aria-hidden': 'true' }, p.got === p.units ? '✓' : '○'), h('span', { class: 'tg-pl' }, p.label), h('span', { class: 'muted' }, p.text))))];
      return section('Hasil target', tabs, ...body, h('p', { class: 'tg-msg ' + g.state, id: 'tg-msg', role: 'status' }, T.dayMessage(g)),
        g.off ? h('p', { class: 'hint' }, 'Hari ini ditandai libur, jadi salat tidak dihitung.') : '');
    }
    const W = T.weekResult(data, new Date());
    const bars = h('div', { class: 'tg-week', role: 'group', 'aria-label': 'Hasil target 7 hari terakhir: ' + W.full + ' hari tercapai penuh' }, ...W.days.map(g => h('button', { class: 'tg-col ' + g.state, type: 'button', 'data-k': g.key, 'aria-label': longDate(g.key) + ': ' + (g.state === 'full' ? 'semua target tercapai' : g.state === 'notarget' ? 'belum ada target' : g.pct + ' persen'), onclick: () => { view = g.key; hasil = 'hari'; draw(); } },
      h('span', { class: 'tg-mark', 'aria-hidden': 'true' }, g.state === 'full' ? '✓' : g.state === 'notarget' ? '' : g.pct + '%'),
      h('span', { class: 'tg-track', 'aria-hidden': 'true' }, h('i', { style: 'height:' + Math.max(g.state === 'none' || g.state === 'notarget' ? 4 : 8, g.pct) + '%' })),
      h('span', { class: 'tg-day' }, DAYS[parseKey(g.key).getDay()]))));
    return section('Hasil target', tabs, bars,
      h('div', { class: 'tg-big' }, h('b', { id: 'tg-wk' }, W.full + ' dari 7'), h('span', { class: 'muted' }, ' hari target tercapai penuh')),
      h('p', { class: 'tg-msg ' + (W.full >= 3 ? 'full' : W.full >= 1 ? 'part' : 'none'), id: 'tg-msg', role: 'status' }, W.message),
      h('p', { class: 'hint' }, 'Hijau dengan ✓ = semua target hari itu tercapai. Kuning = sebagian. Abu-abu = belum dicentang. Ketuk satu batang untuk melihat rinciannya. Dihitung dari daftar target Anda saat ini.'));
  }

  /* ---- mulai tracker harian (di bagian bawah) ---- */
  function startSec() {
    const D = data.daily;
    const time = h('input', { class: 'in tk-time', type: 'time', id: 'td-time', 'aria-label': 'Jam pengingat harian' }); time.value = D.time;
    const dl = () => {
      const r = data.reminders.find(x => x.id === D.rid); const ics = r && T.reminderIcs(r, new Date()); if (!ics) { toast('Pengingat tidak valid.', true); return; }
      try { const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' })), a = h('a', { href: url, download: 'pengingat-baituna.ics' }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); toast('Berkas kalender diunduh. Buka berkasnya di aplikasi kalender HP.'); }
      catch (e) { toast('Tidak bisa membuat berkas kalender di perangkat ini.', true); }
    };
    if (!D.on) return section('Mulai Tracker Harian',
      h('p', {}, 'Mulai sekarang, lalu centang setiap hari apa yang sudah Anda lakukan. Anda akan diingatkan pada jam yang dipilih, dan bisa melihat hasilnya per hari atau per pekan.'),
      h('div', { class: 'tk-trow' }, h('label', { class: 'hint', for: 'td-time' }, 'Diingatkan setiap hari jam'), time),
      h('button', { class: 'btn-primary tg-start', type: 'button', id: 'td-start', onclick: () => {
        const nx = T.startDaily(data, time.value, new Date()); if (nx === data) { toast('Pengingat sudah penuh (maks. ' + T.MAX_REMINDERS + '). Hapus satu dulu.', true); return; }
        commit(nx); draw(); toast('Tracker harian dimulai. Selamat beribadah.');
      } }, 'Mulai Tracker Harian'),
      h('p', { class: 'hint' }, 'Tips: tambahkan dulu amalan atau target halaman di atas, agar ada yang dicentang.'));
    return section('Tracker Harian sedang berjalan',
      h('p', { id: 'td-state' }, 'Dimulai ', h('b', {}, longDate(D.since)), '. Pengingat setiap hari jam ', h('b', {}, D.time), '.'),
      h('div', { class: 'tk-trow' }, h('label', { class: 'hint', for: 'td-time' }, 'Ubah jam pengingat'), time, h('button', { class: 'btn-sm ghost', type: 'button', id: 'td-save', onclick: () => { act(d => T.setDailyTime(d, time.value)); toast('Jam pengingat disimpan.'); } }, 'Simpan jam')),
      h('div', { class: 'tk-racts' }, h('button', { class: 'btn-sm', type: 'button', id: 'td-cal', onclick: dl }, 'Pasang alarm di kalender HP'),
        h('button', { class: 'btn-sm ghost', type: 'button', id: 'td-stop', onclick: async () => { if (!(await ask({ title: 'Hentikan tracker harian?', text: 'Pengingat harian dihapus. Catatan yang sudah ada tetap tersimpan.', reason: false }))) return; act(d => T.stopDaily(d)); toast('Tracker harian dihentikan.'); } }, 'Hentikan')),
      h('p', { class: 'hint' }, 'Pengingat tampil di halaman ini dan menu Notifikasi saat BAITUNA dibuka. Agar HP berbunyi sendiri walau BAITUNA tertutup, ketuk "Pasang alarm di kalender HP" lalu buka berkasnya.'));
  }

  function summarySec() {
    const S = T.summarize(data, range, new Date());
    const chip = (n, l) => h('button', { class: 'achip', type: 'button', role: 'tab', 'aria-selected': String(range === n), onclick: () => { range = n; draw(); } }, l);
    const grid = range === 7
      ? h('div', { class: 'tk-week' }, ...S.perDay.map(p => h('button', { class: 'tk-wd' + (p.key === view ? ' cur' : '') + (p.has ? ' has' : ''), type: 'button', 'data-k': p.key, 'aria-label': longDate(p.key) + (p.has ? ': ada catatan' : ': belum ada catatan'), onclick: () => { view = p.key; draw(); window.scrollTo(0, 0); } },
        h('span', { class: 'tk-dn' }, DAYS[parseKey(p.key).getDay()]),
        h('span', { class: 'tk-dots', 'aria-hidden': 'true' }, ...T.SALAT_KEYS.map((_, i) => h('i', { class: i < p.salat && !p.off ? 'on' : '' }))),
        h('span', { class: 'tk-dq' }, p.off ? 'libur' : p.quran ? p.quran + ' hlm' : '·'))))
      : h('div', { class: 'tk-month', role: 'img', 'aria-label': 'Kalender 30 hari terakhir; kotak berisi berarti ada catatan' }, ...S.perDay.map(p => h('i', { class: p.has ? 'has' : '', title: shortDate(p.key) })));
    const lines = [
      data.show.salat ? h('li', {}, 'Salat tercatat: ', h('b', {}, S.salat + ' dari ' + S.salatPossible), S.offDays ? ' (' + S.offDays + ' hari libur tidak dihitung)' : '') : '',
      data.show.quran ? h('li', {}, 'Membaca Al-Qur’an: ', h('b', {}, S.quran + ' halaman'), ' dalam ' + S.quranDays + ' hari', data.quranTarget ? ' · target tercapai ' + S.targetDays + ' hari' : '') : '',
      ...(data.show.amalan ? data.items.map(it => h('li', {}, it.name + ': ', h('b', {}, S.items[it.id] + ' hari'))) : []),
      h('li', {}, 'Hari yang ada catatannya: ', h('b', {}, S.recorded + ' dari ' + S.n))];
    const det = h('details', { class: 'tk-fold', id: 'tk-ring' }, h('summary', {}, 'Ringkasan pribadi (catatan 7 atau 30 hari)'));
    det.open = openRing; det.addEventListener('toggle', () => { openRing = det.open; });
    det.append(h('div', { class: 'achips', role: 'tablist', 'aria-label': 'Rentang ringkasan' }, chip(7, '7 hari'), chip(30, '30 hari')), grid,
      h('ul', { class: 'tk-lines' }, ...lines),
      h('p', { class: 'hint' }, 'Hanya hitungan untuk Anda sendiri. Tidak ada nilai, peringkat, atau perbandingan. Hari kosong bukan berarti kekurangan: bisa jadi hanya belum dicatat.'));
    return h('section', { class: 'panel tk-sec' }, det);
  }

  function remindSec() {
    const label = h('input', { class: 'in', placeholder: 'Nama pengingat, mis. Baca Al-Qur’an', maxlength: String(T.MAX_NAME), autocomplete: 'off', 'aria-label': 'Nama pengingat' });
    const time = h('input', { class: 'in tk-time', type: 'time', value: '19:00', 'aria-label': 'Jam pengingat' }); time.value = '19:00';
    const dl = r => {
      const ics = T.reminderIcs(r, new Date()); if (!ics) { toast('Pengingat tidak valid.', true); return; }
      try {
        const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' })), a = h('a', { href: url, download: 'pengingat-baituna.ics' });
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
        toast('Berkas kalender diunduh. Buka berkasnya di aplikasi kalender HP.');
      } catch (e) { toast('Tidak bisa membuat berkas kalender di perangkat ini.', true); }
    };
    const rows = data.reminders.map(r => h('div', { class: 'tk-rem' + (r.on ? '' : ' off') },
      h('div', { class: 'tk-rtx' }, h('b', {}, r.time), ' ', h('span', {}, r.label)),
      h('div', { class: 'tk-racts' },
        h('button', { class: 'btn-sm ghost', type: 'button', 'aria-pressed': String(r.on), onclick: () => act(d => T.toggleReminder(d, r.id)) }, r.on ? 'Aktif' : 'Mati'),
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => dl(r) }, 'Tambah ke kalender'),
        h('button', { class: 'tk-x', type: 'button', 'aria-label': 'Hapus pengingat ' + r.label, onclick: async () => { if (!(await ask({ title: 'Hapus pengingat?', text: r.time + ' · ' + r.label, reason: false }))) return; act(d => T.removeReminder(d, r.id)); } }, '✕'))));
    return section('Pengingat', rows.length ? h('div', { class: 'tk-rems' }, ...rows) : h('p', { class: 'muted' }, 'Belum ada pengingat. Pengingat bersifat pilihan.'),
      h('form', { class: 'tk-add tk-rform', novalidate: 'novalidate', onsubmit: ev => {
        ev.preventDefault(); const nx = T.addReminder(data, label.value, time.value);
        if (nx === data) { toast(data.reminders.length >= T.MAX_REMINDERS ? 'Maksimal ' + T.MAX_REMINDERS + ' pengingat.' : 'Isi nama dan jam pengingat.', true); return; }
        commit(nx); draw();
      } }, label, time, h('button', { class: 'btn-sm', type: 'submit' }, 'Tambah')),
      h('p', { class: 'hint' }, 'Pengingat yang aktif di sini juga ikut tampil di menu Notifikasi. Pengingat muncul di halaman ini ketika Anda membuka BAITUNA setelah jam yang dipilih. Aplikasi web tidak bisa memastikan alarm berbunyi saat tertutup. Untuk alarm yang berbunyi sendiri, ketuk "Tambah ke kalender" lalu buka berkasnya di aplikasi kalender HP (berulang setiap hari).'));
  }

  function settingsSec() {
    const tg = (k, l) => h('button', { class: 'achip', type: 'button', 'aria-pressed': String(data.show[k]), 'data-show': k, onclick: () => act(d => T.setShow(d, k, !d.show[k])) }, (data.show[k] ? '✓ ' : '') + l);
    return section('Atur tampilan', h('p', { class: 'muted' }, 'Tampilkan hanya bagian yang Anda perlukan.'), h('div', { class: 'tk-sug' }, tg('salat', 'Salat wajib'), tg('quran', 'Al-Qur’an'), tg('amalan', 'Zikir & amalan')),
      h('button', { class: 'btn-sm ghost mt', type: 'button', onclick: async () => {
        if (!(await ask({ title: 'Hapus semua catatan tracker?', text: 'Semua catatan, amalan, target, dan pengingat di perangkat ini akan dihapus dan tidak bisa dikembalikan.', reason: false }))) return;
        try { localStorage.removeItem(T.KEY); } catch (e) {} data = T.emptyData(); view = today(); draw(); toast('Catatan tracker dihapus dari perangkat ini.');
      } }, 'Hapus semua catatan tracker'));
  }

  function draw() {
    const y = window.scrollY, day = T.getDay(data, view);
    wrap.replaceChildren(
      h('h2', { class: 'wtitle' }, 'Tracker Ibadah Harian'),
      h('p', { class: 'muted' }, 'Catatan pribadi Anda, bersifat pilihan. Hanya tersimpan di perangkat ini: tidak dikirim ke server dan tidak dilihat pengurus masjid. Tanpa nilai atau peringkat.'),
      dueBox(), dateNav(),
      data.show.salat ? salatSec(day) : '', data.show.quran ? quranSec(day) : '', data.show.amalan ? amalanSec(day) : '',
      !data.show.salat && !data.show.quran && !data.show.amalan ? h('div', { class: 'panel center' }, h('p', { class: 'muted' }, 'Semua bagian disembunyikan. Aktifkan kembali di "Atur tampilan" di bawah.')) : '',
      goalSec(), summarySec(), remindSec(), settingsSec(), startSec());
    window.scrollTo(0, y);
  }
  draw();
  return wrap;
}
