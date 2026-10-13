// BAITUNA - ramadan-ui.js
// Ramadan Center (Tahap 1): Beranda, Imsakiyah, Ibadah (checklist + khatam), Panduan, Agenda.
// Jadwal dihitung di perangkat dari lokasi yang sama dengan Jadwal Salat (tidak dikirim ke server).
// Checklist ibadah bersifat pribadi dan hanya disimpan di perangkat.
import { h, toast, ask } from './ui.js';
import { getSession } from './supabase.js';
import { loadAccess } from './permissions.js';
import { getPosition } from './nearby-service.js';
import { CITIES } from './cities-id.js';
import { computePrayerTimes, prayerMoments, fmt, fmtCountdown, zoneLabel, isValidTimes, todayIn, IMSAK_MIN, METHOD } from './prayer-times.js';
import * as cal from './islamic-calendar.js';
import { daysText } from './puasa-service.js';
import { loadLoc, saveLoc, offsetFor, nearestCity, MSG } from './jadwal-ui.js';
import { feedPanel } from './feed-ui.js';
import * as T from './tracker-service.js';
import * as R from './ramadan-service.js';

const TABS = [['home', 'Beranda'], ['imsak', 'Imsakiyah'], ['ibadah', 'Ibadah'], ['panduan', 'Panduan'], ['agenda', 'Agenda']];
const DOW = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const longDate = d => cal.masehiText(d.y, d.m, d.d);
const deviceToday = () => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() }; };

export function ramadanPage({ go, onOpen } = {}) {
  const wrap = h('div', { class: 'rc' });
  let tab = 'home', loc = loadLoc(), busy = false, picking = false, err = '';
  let settings = { rows: [], error: null }, isAdmin = false;
  let view = null; // hari yang sedang dilihat di tab Ibadah (kunci tanggal)
  const cityIn = h('select', { class: 'in', 'aria-label': 'Pilih kota' }, h('option', { value: '' }, 'Pilih kota…'), ...CITIES.map(c => h('option', { value: c.name }, c.name)));

  const off = (now = Date.now()) => loc ? offsetFor(loc, now) : -new Date(now).getTimezoneOffset() / 60;
  const today = (now = Date.now()) => loc ? todayIn(off(now), now) : deviceToday();
  const infoNow = () => R.resolveRamadan(today(), settings.rows);
  const go2 = key => { if (go) go(key); };

  async function useGps() {
    if (busy) return; busy = true; err = ''; draw();
    try {
      const p = await getPosition();
      loc = { mode: 'gps', lat: Math.round(p.lat * 1000) / 1000, lng: Math.round(p.lng * 1000) / 1000 };
      saveLoc(loc); picking = false;
    } catch (e) { err = MSG[e && e.code] || MSG.unavailable; }
    busy = false; draw();
  }
  function useCity() {
    const c = CITIES.find(x => x.name === cityIn.value);
    if (!c) { toast('Pilih kota dulu.', true); return; }
    loc = { mode: 'city', city: c.name, lat: c.lat, lng: c.lng, tz: c.tz };
    saveLoc({ mode: 'city', city: c.name, lat: c.lat, lng: c.lng });
    err = ''; picking = false; draw();
  }
  const chooser = () => h('div', { class: 'panel', id: 'rc-chooser' },
    h('h3', {}, 'Tentukan lokasi'),
    h('p', { class: 'muted' }, 'Jadwal dihitung di HP Anda. Lokasi tidak dikirim ke server dan hanya diingat di perangkat ini (sama dengan menu Jadwal Salat).'),
    (() => { const b = h('button', { class: 'btn-sm', type: 'button', id: 'rc-gps', onclick: useGps }, busy ? 'Mencari lokasi…' : 'Gunakan lokasi saya'); b.disabled = busy; return b; })(),
    err ? h('p', { class: 'hint jerr', role: 'alert' }, err) : '',
    h('p', { class: 'muted jor' }, 'atau pilih kota'),
    h('div', { class: 'row-btns tcus' }, cityIn, h('button', { class: 'btn-sm ghost', type: 'button', id: 'rc-city', onclick: useCity }, 'Tampilkan')),
    loc ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { picking = false; err = ''; draw(); } }, '← Kembali') : '');

  const placeLine = () => {
    const near = loc.mode === 'gps' ? nearestCity(loc.lat, loc.lng) : null;
    return loc.mode === 'city' ? loc.city : (near ? 'Dekat ' + near + ' · ' : 'Lokasi perangkat ') + '(' + loc.lat.toFixed(3) + ', ' + loc.lng.toFixed(3) + ')';
  };
  const locCard = () => h('div', { class: 'panel jloc' },
    h('p', { class: 'jplace' }, h('b', {}, 'Lokasi: '), placeLine(), ' · waktu ' + zoneLabel(off())),
    h('div', { class: 'row-btns' },
      h('button', { class: 'btn-sm ghost', type: 'button', onclick: useGps }, busy ? 'Mencari…' : 'Perbarui lokasi'),
      h('button', { class: 'btn-sm ghost', type: 'button', id: 'rc-change', onclick: () => { picking = true; draw(); } }, 'Ganti kota')),
    err ? h('p', { class: 'hint jerr', role: 'alert' }, err) : '');
  const noLoc = () => h('div', { class: 'panel' }, h('h3', {}, 'Pilih lokasi dulu'), h('p', { class: 'muted' }, 'Jadwal imsakiyah butuh lokasi Anda.'),
    h('button', { class: 'btn-sm', type: 'button', id: 'rc-pick', onclick: () => { picking = true; draw(); } }, 'Tentukan lokasi'));

  /* ---------- status tanggal ---------- */
  const statusBadge = info => info.status === 'ditetapkan'
    ? h('span', { class: 'rc-badge ok' }, 'Ditetapkan · ' + info.source)
    : h('span', { class: 'rc-badge' }, 'Perkiraan, belum ditetapkan');

  function hero(info) {
    if (!info) return h('div', { class: 'panel' }, h('h3', {}, 'Ramadan'), h('p', { class: 'muted' }, 'Kalender Hijriah belum didukung peramban ini, jadi tanggal Ramadan tidak bisa dihitung.'));
    const ph = R.phaseOf(info, today());
    const t = longDate(today());
    const hij = (() => { try { const d = today(), x = cal.hijriOf(d.y, d.m, d.d); return x ? cal.hijriText(x) + ' (perkiraan)' : ''; } catch (e) { return ''; } })();
    const kids = [h('span', { class: 'jlab' }, t), hij ? h('span', { class: 'jlab' }, hij) : ''];
    if (ph.phase === 'sebelum') {
      kids.push(h('b', { class: 'jname' }, 'Ramadan ' + info.hijriYear + ' H'), h('b', { class: 'rc-big', id: 'rc-count' }, daysText(ph.inDays)),
        h('span', { class: 'jlab' }, 'Awal Ramadan: ' + longDate(info.start)));
    } else if (ph.phase === 'ramadan') {
      kids.push(h('b', { class: 'jname' }, 'Ramadan hari ke-' + ph.day), h('b', { class: 'rc-big', id: 'rc-count' }, ph.left === 0 ? 'Hari terakhir (menurut tanggal ini)' : 'Sisa ' + ph.left + ' hari'),
        h('span', { class: 'jlab' }, 'dari ' + ph.total + ' hari · mulai ' + longDate(info.start)));
    } else {
      kids.push(h('b', { class: 'jname' }, 'Ramadan ' + info.hijriYear + ' H telah berakhir'), h('span', { class: 'jlab' }, 'Semoga Allah menerima amal kita semua.'));
    }
    kids.push(statusBadge(info));
    return h('div', { class: 'jhero panel rc-hero' }, ...kids);
  }

  /* ---------- waktu hari ini ---------- */
  let cdAt = null, cdLabel = '';
  function timesCard(info) {
    const now = Date.now(), o = off(now), day = today(now), t = computePrayerTimes(day, loc.lat, loc.lng, o);
    if (!isValidTimes(t)) return h('div', { class: 'panel' }, h('h3', {}, 'Jadwal belum bisa dihitung'), h('p', { class: 'muted' }, 'Di lokasi ini matahari tidak mencapai sudut yang dibutuhkan untuk Subuh atau Isya pada tanggal ini. Ikuti ketetapan otoritas keagamaan setempat.'));
    t.imsak = t.fajr - IMSAK_MIN;
    const ph = info ? R.phaseOf(info, day) : null, m = prayerMoments(day, loc.lat, loc.lng, o);
    cdAt = null; cdLabel = '';
    if (ph && ph.phase === 'ramadan') {
      const imsakMs = m.fajr - IMSAK_MIN * 60000;
      if (now < imsakMs) { cdAt = imsakMs; cdLabel = 'Imsak dalam '; }
      else if (now < m.fajr) { cdAt = m.fajr; cdLabel = 'Subuh dalam '; }
      else if (now < m.maghrib) { cdAt = m.maghrib; cdLabel = 'Berbuka (Maghrib) dalam '; }
    }
    const rows = [['imsak', 'Imsak', 'sahur'], ['fajr', 'Subuh'], ['sunrise', 'Terbit'], ['dhuhr', 'Dzuhur'], ['asr', 'Ashar'], ['maghrib', 'Maghrib', 'berbuka'], ['isha', 'Isya']];
    const cd = ph && ph.phase === 'ramadan' ? (cdAt
      ? h('p', { class: 'rc-cd', id: 'rc-cd' }, cdLabel, h('b', {}, fmtCountdown(cdAt - now)))
      : h('p', { class: 'rc-cd', id: 'rc-cd' }, 'Waktu berbuka hari ini sudah masuk.')) : '';
    return h('div', { class: 'panel' },
      h('h3', {}, ph && ph.phase === 'ramadan' ? 'Waktu hari ini' : 'Jadwal salat hari ini'),
      cd,
      h('div', { class: 'jrows' }, rows.map(([k, name, tag]) => h('div', { class: 'jrow' + (k === 'imsak' || k === 'sunrise' ? ' minor' : '') + (tag ? ' rc-mark' : '') },
        h('span', {}, name, tag ? h('i', { class: 'jbadge' }, tag) : ''), h('b', {}, fmt(t[k]))))),
      h('p', { class: 'hint' }, 'Imsak = Subuh − ' + IMSAK_MIN + ' menit, sebagai tanda kehati-hatian. Berbuka mengikuti masuknya waktu Maghrib. Dihitung di perangkat, bisa berbeda beberapa menit dari jadwal masjid setempat; ikuti jadwal masjid Anda.'));
  }

  /* ---------- progres & akses cepat ---------- */
  function planFor(info, ph, tr) {
    let pagesDone = 0;
    for (const dt of R.ramadanDates(info)) { if (R.daysBetween(dt, today()) < 0) break; pagesDone += T.getDay(tr, R.ymdKey(dt)).quran || 0; }
    const daysLeft = ph.phase === 'ramadan' ? ph.left + 1 : ph.phase === 'sebelum' ? info.days : 0;
    return R.khatamPlan({ target: R.load().khatam, daysLeft, pagesDone });
  }
  function progressCard(info) {
    if (!info) return '';
    const ph = R.phaseOf(info, today()), rd = R.load(), acts = R.activities(rd);
    const kids = [h('h3', {}, 'Progres saya')];
    if (ph.phase === 'ramadan') {
      const key = R.ymdKey(today()), done = R.doneOn(rd, key).filter(id => acts.some(a => a.id === id)).length;
      const plan = planFor(info, ph, T.load());
      kids.push(h('p', {}, 'Ibadah dicentang hari ini: ', h('b', { id: 'rc-p-today' }, done + ' dari ' + acts.length)),
        h('p', {}, 'Khatam ' + rd.khatam + 'x: ', h('b', { id: 'rc-p-khatam' }, plan.done + ' dari ' + plan.total + ' halaman (' + plan.percent + '%)')),
        h('p', { class: 'hint' }, 'Catatan ini pribadi, hanya di perangkat ini. Tidak ada peringkat atau skor.'));
    } else kids.push(h('p', { class: 'muted' }, ph.phase === 'sebelum' ? 'Checklist ibadah mulai dipakai saat Ramadan. Anda bisa merencanakan target khatam dari sekarang.' : 'Catatan Ramadan tahun ini tersimpan di perangkat Anda.'));
    kids.push(h('button', { class: 'btn-sm', type: 'button', id: 'rc-to-ibadah', onclick: () => { tab = 'ibadah'; draw(); } }, ph.phase === 'ramadan' ? 'Buka checklist & khatam' : 'Rencanakan khatam'));
    return h('div', { class: 'panel' }, ...kids);
  }
  const QUICK = [['jadwal', 'Jadwal Salat'], ['kiblat', 'Arah Kiblat'], ['quran', 'Al-Qur’an'], ['doa', 'Doa Shahih'], ['dzikir', 'Dzikir Pagi & Petang'], ['sunnah', 'Amalan Sunnah'], ['zakat', 'Kalkulator Zakat'], ['tracker', 'Tracker Harian'], ['cal', 'Kalender Islam'], ['notif', 'Notifikasi']];
  const quickCard = () => h('div', { class: 'panel' }, h('h3', {}, 'Akses cepat'),
    h('div', { class: 'rc-quick' }, QUICK.map(([k, l]) => h('button', { class: 'btn-sm ghost', type: 'button', 'data-go': k, onclick: () => go2(k) }, l))));

  /* ---------- Super Admin: tanggal Ramadan ---------- */
  function adminCard(info) {
    if (!isAdmin) return '';
    const row = (settings.rows || []).find(r => info && r.hijri_year === info.hijriYear);
    const yr = h('input', { class: 'in', id: 'ra-year', type: 'number', min: '1400', max: '1600', value: String(info ? info.hijriYear : '') });
    const st = h('input', { class: 'in', id: 'ra-start', type: 'date', value: info ? R.ymdKey(info.start) : '' });
    const dy = h('select', { class: 'in', id: 'ra-days' }, h('option', { value: '29' }, '29 hari'), h('option', { value: '30' }, '30 hari'));
    const stt = h('select', { class: 'in', id: 'ra-status' }, h('option', { value: 'ditetapkan' }, 'Ditetapkan (resmi)'), h('option', { value: 'estimasi' }, 'Perkiraan'));
    const src = h('input', { class: 'in', id: 'ra-src', maxlength: '120', placeholder: 'Sumber penetapan, mis. Kemenag RI, sidang isbat, tanggal', value: row && row.source || '' });
    const nt = h('input', { class: 'in', id: 'ra-note', maxlength: '300', placeholder: 'Catatan (opsional)', value: row && row.note || '' });
    dy.value = String(row ? row.days : info ? info.days : 30); stt.value = row ? row.status : 'ditetapkan';
    const msg = h('p', { class: 'hint', role: 'status', id: 'ra-msg' }, '');
    const saveBtn = h('button', { class: 'btn-sm', type: 'button', id: 'ra-save' }, 'Simpan tanggal');
    saveBtn.addEventListener('click', async () => {
      const f = R.settingFields(yr.value, st.value, dy.value, stt.value, src.value, nt.value);
      if (f.error) { msg.textContent = f.error; msg.className = 'hint jerr'; return; }
      saveBtn.disabled = true; msg.textContent = 'Menyimpan…'; msg.className = 'hint';
      try { await R.saveSetting(f.ok); settings = await R.fetchSettings(); toast('Tanggal Ramadan disimpan.'); draw(); }
      catch (e) { msg.textContent = e && e.status === 403 ? 'Hanya Super Admin yang boleh menyimpan.' : 'Belum tersimpan. Jalankan ramadan.sql di Supabase bila belum, lalu coba lagi.'; msg.className = 'hint jerr'; saveBtn.disabled = false; }
    });
    const delBtn = row ? h('button', { class: 'btn-sm ghost', type: 'button', id: 'ra-del', onclick: async () => {
      if (!(await ask({ title: 'Hapus penetapan?', text: 'Tanggal kembali ke perkiraan kalender Umm al-Qura.', ok: 'Hapus' }))) return;
      try { await R.deleteSetting(row.hijri_year); settings = await R.fetchSettings(); toast('Penetapan dihapus.'); draw(); } catch (e) { toast('Belum terhapus.', true); }
    } }, 'Hapus penetapan') : '';
    return h('div', { class: 'panel', id: 'ra-panel' }, h('h3', {}, 'Tanggal Ramadan (khusus Super Admin)'),
      h('p', { class: 'muted' }, 'Tanpa penetapan, aplikasi memakai perkiraan kalender Umm al-Qura dan menandainya "perkiraan". Isi sesuai keputusan resmi (mis. sidang isbat) begitu tersedia; jamaah akan melihat status "ditetapkan" beserta sumbernya.'),
      settings.error === 'sql' ? h('p', { class: 'hint jerr', role: 'alert' }, 'Penyimpanan belum aktif. Jalankan ramadan.sql di Supabase SQL Editor.') : '',
      h('label', { class: 'hint' }, 'Tahun Hijriah'), yr, h('label', { class: 'hint' }, 'Awal Ramadan (1 Ramadan)'), st, h('label', { class: 'hint' }, 'Jumlah hari'), dy,
      h('label', { class: 'hint' }, 'Status'), stt, src, nt, msg, h('div', { class: 'row-btns' }, saveBtn, delBtn));
  }

  function home() {
    const info = infoNow();
    const kids = [hero(info)];
    if (picking || !loc) kids.push(chooser());
    else { kids.push(timesCard(info), locCard()); }
    kids.push(progressCard(info), quickCard(), adminCard(info));
    if (settings.error === 'net' && info) kids.push(h('p', { class: 'hint' }, 'Penetapan tanggal dari pengelola belum bisa dimuat; memakai perkiraan.'));
    return kids;
  }

  /* ---------- Imsakiyah ---------- */
  function imsakiyah() {
    const info = infoNow();
    if (!info) return [h('div', { class: 'panel' }, h('p', { class: 'muted' }, 'Kalender Hijriah belum didukung peramban ini.'))];
    if (picking || !loc) return [chooser()];
    const o = off(), rows = R.scheduleFor(info, loc.lat, loc.lng, o), td = R.ymdKey(today());
    const bad = rows.filter(r => !r.ok).length;
    const COLS = [['imsak', 'Imsak'], ['fajr', 'Subuh'], ['sunrise', 'Terbit'], ['dhuhr', 'Dzuhur'], ['asr', 'Ashar'], ['maghrib', 'Maghrib'], ['isha', 'Isya']];
    const head = h('tr', {}, h('th', {}, 'Hari'), h('th', {}, 'Tanggal'), ...COLS.map(([, l]) => h('th', {}, l)));
    const body = rows.map(r => h('tr', { class: R.ymdKey(r) === td ? 'rc-today' : '' },
      h('td', {}, String(r.day)), h('td', {}, DOW[r.dow] + ' ' + r.d + ' ' + MON[r.m - 1]),
      ...COLS.map(([k]) => h('td', {}, r.ok ? fmt(r.t[k]) : '–'))));
    return [
      h('div', { class: 'panel' }, h('h3', {}, 'Imsakiyah Ramadan ' + info.hijriYear + ' H'),
        h('p', { class: 'muted' }, placeLine() + ' · waktu ' + zoneLabel(o)), statusBadge(info),
        info.status !== 'ditetapkan' ? h('p', { class: 'hint' }, 'Tanggal mulai (' + longDate(info.start) + ') masih perkiraan. Jadwal ini akan menyesuaikan setelah pengelola menetapkan awal Ramadan resmi.' + (info.days === 29 ? ' Jumlah hari (29 atau 30) juga menunggu penetapan awal Syawal.' : '')) : '',
        bad ? h('p', { class: 'hint jerr', role: 'alert' }, bad + ' hari tidak bisa dihitung di lokasi ini (matahari tidak mencapai sudut Subuh/Isya). Ikuti otoritas setempat.') : ''),
      h('div', { class: 'rc-tablewrap', role: 'region', 'aria-label': 'Tabel imsakiyah', tabindex: '0' }, h('table', { class: 'rc-table', id: 'rc-table' }, h('thead', {}, head), h('tbody', {}, body))),
      h('div', { class: 'panel' }, h('h3', {}, 'Cara membaca'),
        h('p', { class: 'hint' }, 'Imsak = Subuh − ' + IMSAK_MIN + ' menit, sebagai tanda kehati-hatian menjelang Subuh. Berbuka mengikuti masuknya waktu Maghrib.'),
        h('p', { class: 'hint' }, 'Metode: hitungan astronomi di perangkat (sudut Subuh ' + METHOD.fajr + '°, Isya ' + METHOD.isha + '°, ihtiyat ' + METHOD.ihtiyat + ' menit; mirip pedoman Kemenag). Bisa berbeda beberapa menit dari jadwal resmi atau jadwal masjid Anda. Ikuti jadwal masjid setempat.')),
      locCard()
    ];
  }

  /* ---------- Ibadah: checklist + khatam ---------- */
  function ibadah() {
    const info = infoNow();
    if (!info) return [h('div', { class: 'panel' }, h('p', { class: 'muted' }, 'Kalender Hijriah belum didukung peramban ini.'))];
    const ph = R.phaseOf(info, today());
    let rd = R.load();
    const commit = next => { rd = next; if (!R.save(rd)) toast('Belum bisa disimpan di perangkat ini.', true); draw(); };
    const kids = [];
    // --- checklist ---
    if (ph.phase === 'ramadan') {
      const dates = R.ramadanDates(info).filter(d => R.daysBetween(d, today()) >= 0), keys = dates.map(R.ymdKey);
      if (!view || !keys.includes(view)) view = keys[keys.length - 1];
      const idx = keys.indexOf(view), vd = dates[idx], acts = R.activities(rd), done = R.doneOn(rd, view);
      const nav = h('div', { class: 'tk-date' },
        (() => { const b = h('button', { class: 'tk-nav', type: 'button', id: 'ri-prev', 'aria-label': 'Hari sebelumnya', onclick: () => { view = keys[idx - 1]; draw(); } }, '‹'); b.disabled = idx === 0; return b; })(),
        h('div', { class: 'tk-dtx' }, h('b', {}, 'Ramadan hari ke-' + vd.day + (idx === keys.length - 1 ? ' (hari ini)' : '')), h('span', { class: 'muted' }, longDate(vd))),
        (() => { const b = h('button', { class: 'tk-nav', type: 'button', id: 'ri-next', 'aria-label': 'Hari berikutnya', onclick: () => { view = keys[idx + 1]; draw(); } }, '›'); b.disabled = idx === keys.length - 1; return b; })());
      const list = h('div', { class: 'rc-acts' }, acts.map(a => {
        const inp = h('input', { type: 'checkbox', id: 'ri-a-' + a.id }); inp.checked = done.includes(a.id);
        inp.addEventListener('change', () => commit(R.toggle(rd, view, a.id)));
        const c = R.countFor(rd, info, today(), a.id);
        return h('label', { class: 'rc-act' }, inp, h('span', { class: 'rc-actl' }, a.label), h('span', { class: 'muted rc-actc' }, c.done + '/' + c.passed + ' hari'));
      }));
      kids.push(h('div', { class: 'panel' }, h('h3', {}, 'Checklist ibadah'), nav, list,
        h('p', { class: 'hint' }, 'Catatan pribadi, hanya di perangkat ini. Tidak ada peringkat. Tidak puasa karena uzur syar’i bukan kegagalan; kosongkan saja dan tanyakan ustaz soal qadha atau fidyah.')));
      // halaman Qur'an hari yang dilihat (tercatat di Tracker)
      const tr = T.load(), pg = h('input', { class: 'in', id: 'ri-pages', type: 'number', min: '0', max: String(T.MAX_QURAN), inputmode: 'numeric', value: String(T.getDay(tr, view).quran || 0), 'aria-label': 'Halaman Al-Qur’an dibaca' });
      pg.addEventListener('change', () => { const v = Math.max(0, Math.min(T.MAX_QURAN, Math.round(Number(pg.value) || 0))); if (!T.save(T.setQuran(T.load(), view, v))) toast('Belum bisa disimpan di perangkat ini.', true); draw(); });
      kids.push(h('div', { class: 'panel' }, h('h3', {}, 'Halaman Al-Qur’an dibaca'), h('p', { class: 'muted' }, 'Untuk hari ke-' + vd.day + '. Angka ini sama dengan catatan di Tracker Ibadah Harian.'), pg));
    } else {
      kids.push(h('div', { class: 'panel' }, h('h3', {}, 'Checklist ibadah'),
        h('p', { class: 'muted' }, ph.phase === 'sebelum' ? 'Checklist aktif mulai hari pertama Ramadan (' + longDate(info.start) + ', perkiraan).' : 'Ramadan tahun ini sudah berakhir.')));
    }
    // --- khatam ---
    const plan = planFor(info, ph, T.load());
    const sel = h('select', { class: 'in', id: 'ri-khatam', 'aria-label': 'Target khatam' }, ...Array.from({ length: R.MAX_KHATAM }, (_, i) => h('option', { value: String(i + 1) }, (i + 1) + 'x khatam')));
    sel.value = String(rd.khatam);
    sel.addEventListener('change', () => commit(R.setKhatam(rd, Number(sel.value))));
    kids.push(h('div', { class: 'panel', id: 'ri-plan' }, h('h3', {}, 'Rencana khatam'), sel,
      h('p', {}, 'Target ', h('b', {}, plan.total + ' halaman'), ' · terbaca ', h('b', { id: 'ri-done' }, plan.done + ' halaman (' + plan.percent + '%)')),
      plan.daysLeft > 0
        ? h('p', {}, 'Sisa ' + plan.daysLeft + ' hari: sekitar ', h('b', { id: 'ri-perday' }, plan.perDay + ' halaman per hari'), ' (≈ ' + plan.perSalat + ' halaman setelah tiap salat fardhu, ≈ ' + plan.juzPerDay + ' juz per hari).')
        : h('p', { class: 'muted' }, plan.remaining === 0 ? 'Target tercapai. Alhamdulillah.' : 'Ramadan telah berakhir.'),
      h('p', { class: 'hint' }, 'Hitungan sederhana: 604 halaman per khatam (Mushaf Madinah), 20 halaman per juz. Halaman terbaca dijumlahkan dari catatan Tracker selama Ramadan.'),
      h('button', { class: 'btn-sm', type: 'button', id: 'ri-quran', onclick: () => go2('quran') }, 'Buka Al-Qur’an')));
    // --- atur kegiatan ---
    const addIn = h('input', { class: 'in', id: 'ri-new', maxlength: String(R.MAX_LABEL), placeholder: 'Kegiatan baru, mis. Menyantuni anak yatim', autocomplete: 'off' });
    const addMsg = h('p', { class: 'hint jerr', role: 'alert', id: 'ri-msg' }, '');
    kids.push(h('div', { class: 'panel' }, h('h3', {}, 'Atur kegiatan'),
      h('p', { class: 'muted' }, 'Tampilkan hanya yang Anda perlukan, atau tambah kegiatan sendiri.'),
      h('div', { class: 'tk-sug' }, R.DEFAULT_ACTS.map(a => { const on = !rd.hidden.includes(a.id); const b = h('button', { class: 'btn-sm' + (on ? '' : ' ghost'), type: 'button', 'aria-pressed': String(on), 'data-act': a.id, onclick: () => commit(R.setHidden(rd, a.id, on)) }, (on ? '✓ ' : '') + a.label); return b; })),
      rd.custom.length ? h('div', { class: 'rc-custom' }, rd.custom.map(c => h('div', { class: 'rc-crow' }, h('span', {}, c.label), h('button', { class: 'btn-sm ghost', type: 'button', 'data-del': c.id, onclick: () => commit(R.removeCustom(rd, c.id)) }, 'Hapus')))) : '',
      h('div', { class: 'row-btns tcus' }, addIn, h('button', { class: 'btn-sm', type: 'button', id: 'ri-add', onclick: () => { const r = R.addCustom(rd, addIn.value); if (r.error) { addMsg.textContent = r.error; return; } commit(r.d); } }, 'Tambah')),
      addMsg));
    return kids;
  }

  /* ---------- Panduan ---------- */
  function panduan() {
    const L = [['imsak', 'Jadwal imsakiyah', 'Waktu sahur dan berbuka sesuai lokasi Anda', true], ['doa', 'Doa Shahih', 'Doa sesuai sunnah, lengkap dengan sumber'], ['dzikir', 'Dzikir Pagi & Petang', 'Bacaan dan penghitung ketukan'], ['sunnah', 'Amalan Sunnah Harian', 'Amalan yang dianjurkan, lengkap dengan sumber'], ['quran', 'Al-Qur’an', 'Baca dan dengarkan, ingat posisi terakhir'], ['zakat', 'Kalkulator Zakat', 'Zakat maal dan penghasilan, nisab, haul, dan rujukan'], ['cal', 'Kalender Islam', 'Tanggal Hijriah dan hari penting (perkiraan)'], ['notif', 'Notifikasi', 'Pengingat salat dan puasa; hanya berbunyi saat aplikasi terbuka']];
    return [
      h('div', { class: 'panel' }, h('h3', {}, 'Panduan Ramadan'),
        h('p', { class: 'muted' }, 'Isi doa, dzikir, dan amalan diambil dari menu yang sudah ada, masing-masing dengan sumber dan derajatnya.')),
      h('div', { class: 'qlist' }, L.map(([k, t, s, local]) => h('button', { class: 'morecard', type: 'button', 'data-go': k, onclick: () => { if (local) { tab = k; draw(); } else go2(k); } },
        h('span', { class: 'mc-tx' }, h('b', {}, t), h('span', { class: 'muted' }, s))))),
      h('div', { class: 'panel', id: 'rp-note' }, h('h3', {}, 'Belum tersedia'),
        h('p', { class: 'muted' }, 'Tuntunan fikih Ramadan (niat, syarat dan pembatal puasa, uzur, qadha, fidyah, zakat fitrah) belum diisi. Akan ditambahkan setelah ditinjau ustaz, lengkap dengan sumber dan status tinjauan. Untuk sementara, tanyakan kepada ustaz atau pengurus masjid Anda.'))
    ];
  }

  /* ---------- Agenda ---------- */
  function agenda() {
    return [
      h('div', { class: 'panel' }, h('h3', {}, 'Agenda Ramadan dari masjid'),
        h('p', { class: 'muted' }, 'Kegiatan yang ditandai "Ramadan" oleh pengurus masjid saat membuat agenda: buka puasa bersama, tarawih, kajian, santunan, dan lain-lain.')),
      feedPanel({ topic: 'ramadan', only: 'agenda', limit: 20, onOpen: onOpen, emptyAgenda: 'Belum ada agenda Ramadan dari masjid. Agenda muncul di sini setelah pengurus masjid menerbitkannya dengan jenis kabar "Ramadan".' }),
      go ? h('button', { class: 'btn-sm ghost', type: 'button', id: 'rg-all', onclick: () => go('info') }, 'Lihat semua agenda masjid') : ''
    ];
  }

  function draw() {
    const bar = h('div', { class: 'rc-tabs', role: 'tablist' }, TABS.map(([k, l]) => h('button', { class: 'rc-tab' + (k === tab ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': String(k === tab), id: 'rc-t-' + k, onclick: () => { tab = k; draw(); window.scrollTo(0, 0); } }, l)));
    const body = tab === 'imsak' ? imsakiyah() : tab === 'ibadah' ? ibadah() : tab === 'panduan' ? panduan() : tab === 'agenda' ? agenda() : home();
    wrap.replaceChildren(h('h2', { class: 'wtitle' }, 'Ramadan Center'), bar, ...body);
  }

  const tick = setInterval(() => {
    if (!wrap.isConnected) { clearInterval(tick); return; }
    if (tab !== 'home' || !loc || picking) return;
    const now = Date.now();
    if (cdAt !== null && now >= cdAt) { draw(); return; }
    const cd = wrap.querySelector('#rc-cd b'); if (cd && cdAt !== null) cd.textContent = fmtCountdown(cdAt - now);
  }, 15000);

  draw();
  // Penetapan tanggal dari pengelola + peran Super Admin dimuat setelah tampilan pertama.
  R.fetchSettings().then(s => { settings = s; draw(); });
  const sess = getSession();
  if (sess && sess.user) loadAccess(sess.user).then(a => { if (a && a.isAdmin) { isAdmin = true; draw(); } }).catch(() => {});
  return wrap;
}
