// BAITUNA - jadwal-ui.js
// Halaman Jadwal Salat: dihitung di perangkat dari lokasi (GPS perangkat atau pilihan kota). Tanpa layanan berbayar,
// tanpa kunci API, dan lokasi pengguna TIDAK dikirim ke server.
import { h, toast } from './ui.js';
import { getPosition } from './nearby-service.js';
import { CITIES } from './cities-id.js';
import { computePrayerTimes, nextPrayer, fmt, fmtCountdown, zoneLabel, inIndonesia, isValidTimes, todayIn, METHOD, IMSAK_MIN } from './prayer-times.js';
import * as cal from './islamic-calendar.js';
import * as N from './notif-service.js';

const LKEY = 'baituna.loc.v1';
const NAMES = { imsak: 'Imsak', dhuha: 'Dhuha', fajr: 'Subuh', sunrise: 'Terbit', dhuhr: 'Dzuhur', asr: 'Ashar', maghrib: 'Maghrib', isha: 'Isya' };
const ROWS = ['imsak', 'fajr', 'sunrise', 'dhuha', 'dhuhr', 'asr', 'maghrib', 'isha'];
const PRAYER_ROWS = [['fajr', 'Subuh'], ['dhuhr', 'Dzuhur'], ['asr', 'Ashar'], ['maghrib', 'Maghrib'], ['isha', 'Isya'], ['dhuha', 'Salat Dhuha (sunnah)'], ['tahajud', 'Salat Tahajud (sunnah)']];
const MINOR = ['imsak', 'sunrise', 'dhuha']; // bukan waktu salat wajib / turunan perkiraan
// Imsak dan awal Dhuha: konstanta bersama di prayer-times.js (perkiraan, bukan penetapan resmi).
// Kota terdekat dari daftar (garis lurus). Hanya perkiraan nama; di luar 50 km tidak disebut.
function nearestCity(lat, lng) {
  const r = Math.PI / 180; let best = null, bd = Infinity;
  for (const c of CITIES) {
    const a = Math.sin((c.lat - lat) * r / 2) ** 2 + Math.cos(lat * r) * Math.cos(c.lat * r) * Math.sin((c.lng - lng) * r / 2) ** 2;
    const d = 12742 * Math.asin(Math.sqrt(a));
    if (d < bd) { bd = d; best = c; }
  }
  return best && bd <= 50 ? best.name : null;
}
const MSG = {
  denied: 'Izin lokasi ditolak. Anda bisa memilih kota di bawah, atau mengizinkan lokasi di pengaturan peramban lalu coba lagi.',
  unavailable: 'Lokasi belum bisa ditentukan. Pastikan GPS/lokasi HP menyala, lalu coba lagi, atau pilih kota.',
  timeout: 'Menentukan lokasi terlalu lama. Coba lagi di tempat terbuka, atau pilih kota.',
  unsupported: 'Peramban ini tidak mendukung lokasi. Silakan pilih kota.'
};

// Disimpan di perangkat saja. Koordinat GPS dibulatkan 3 desimal (sekitar 100 m).
function loadLoc() {
  try {
    const o = JSON.parse(localStorage.getItem(LKEY) || 'null');
    if (o && Number.isFinite(o.lat) && Number.isFinite(o.lng) && Math.abs(o.lat) <= 90 && Math.abs(o.lng) <= 180) {
      if (o.mode === 'city') { const c = CITIES.find(x => x.name === o.city); if (c) return { mode: 'city', city: c.name, lat: c.lat, lng: c.lng, tz: c.tz }; }
      else if (o.mode === 'gps') return { mode: 'gps', lat: o.lat, lng: o.lng };
    }
  } catch (e) {}
  return null;
}
const saveLoc = l => { try { localStorage.setItem(LKEY, JSON.stringify(l)); } catch (e) {} };
// Selisih jam zona: kota memakai zona resminya; lokasi GPS mengikuti jam HP pada tanggal tersebut.
const deviceOffset = (now = Date.now()) => -new Date(now).getTimezoneOffset() / 60;
const offsetFor = (loc, now = Date.now()) => loc.mode === 'city' ? loc.tz : deviceOffset(now);
const clock = (ms, off) => fmt(((ms + off * 3600000) / 60000) % 1440);

export function jadwalPage({ go } = {}) {
  const wrap = h('div', { class: 'jadwal' });
  let loc = loadLoc(), busy = false, picking = !loc, err = '';
  let shownKey = null; // salat berikutnya yang sedang tampil (untuk memuat ulang saat berganti)
  let shownDay = null;

  const cityIn = h('select', { class: 'in', 'aria-label': 'Pilih kota' }, h('option', { value: '' }, 'Pilih kota…'), ...CITIES.map(c => h('option', { value: c.name }, c.name)));

  async function useGps() {
    if (busy) return;
    busy = true; err = ''; draw();
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
    loc = { mode: 'city', city: c.name, lat: c.lat, lng: c.lng, tz: c.tz }; saveLoc({ mode: 'city', city: c.name, lat: c.lat, lng: c.lng });
    err = ''; picking = false; draw();
  }

  const chooser = () => h('div', { class: 'panel' },
    h('h3', {}, 'Tentukan lokasi'),
    h('p', { class: 'muted' }, 'Jadwal dihitung langsung di HP Anda. Lokasi tidak dikirim ke server dan hanya diingat di perangkat ini.'),
    (() => { const b = h('button', { class: 'btn-sm', type: 'button', onclick: useGps }, busy ? 'Mencari lokasi…' : 'Gunakan lokasi saya'); b.disabled = busy; return b; })(),
    err ? h('p', { class: 'hint jerr', role: 'alert' }, err) : '',
    h('p', { class: 'muted jor' }, 'atau pilih kota'),
    h('div', { class: 'row-btns tcus' }, cityIn, h('button', { class: 'btn-sm ghost', type: 'button', onclick: useCity }, 'Tampilkan')));

  function result() {
    const now = Date.now(), off = offsetFor(loc, now);
    const day = todayIn(off, now), times = computePrayerTimes(day, loc.lat, loc.lng, off);
    times.imsak = times.fajr - IMSAK_MIN; times.dhuha = times.sunrise + N.load().mine.dhuhaMin;
    const np = nextPrayer(now, loc.lat, loc.lng, off);
    const near = loc.mode === 'gps' ? nearestCity(loc.lat, loc.lng) : null;
    const place = loc.mode === 'city' ? loc.city : (near ? 'Dekat ' + near + ' · ' : 'Lokasi perangkat ') + '(' + loc.lat.toFixed(3) + ', ' + loc.lng.toFixed(3) + ')';
    const kids = [];
    if (!isValidTimes(times) || !np) {
      kids.push(h('div', { class: 'panel' }, h('h3', {}, 'Jadwal belum bisa dihitung'),
        h('p', { class: 'muted' }, 'Di lokasi ini matahari tidak mencapai sudut yang dibutuhkan untuk Subuh atau Isya pada tanggal ini, sehingga aplikasi tidak menebak waktunya. Ikuti ketetapan otoritas keagamaan setempat.')));
    } else {
      shownKey = np.key + (np.tomorrow ? '+' : ''); shownDay = day.d;
      const cd = h('b', { class: 'jcd' }, fmtCountdown(np.at - now));
      cd.dataset.at = String(np.at);
      kids.push(h('div', { class: 'jhero panel' },
        h('span', { class: 'jlab' }, 'Salat berikutnya' + (np.tomorrow ? ' (besok)' : '')),
        h('b', { class: 'jname' }, NAMES[np.key]),
        h('b', { class: 'jtime' }, clock(np.at, off)),
        h('p', { class: 'jin' }, 'dalam ', cd)));
      kids.push(h('div', { class: 'panel' },
        h('h3', {}, 'Jadwal hari ini'),
        h('p', { class: 'muted' }, cal.masehiText(day.y, day.m, day.d) + ' · waktu ' + zoneLabel(off)),
        h('div', { class: 'jrows' }, ROWS.map(k => {
          const isNext = !np.tomorrow && k === np.key;
          return h('div', { class: 'jrow' + (MINOR.includes(k) ? ' minor' : '') + (isNext ? ' next' : '') + (np.current === k ? ' now' : '') },
            h('span', {}, NAMES[k], np.current === k ? h('i', { class: 'jbadge' }, 'sedang berlangsung') : ''), h('b', {}, fmt(times[k])));
        }))));
      if (loc.mode === 'gps' && inIndonesia(loc.lat, loc.lng) && ![7, 8, 9].includes(off)) {
        kids.push(h('div', { class: 'panel jwarn', role: 'alert' }, h('b', {}, 'Periksa zona waktu HP. '),
          'Lokasi Anda di Indonesia, tetapi zona waktu HP adalah ' + zoneLabel(off) + '. Jam di jadwal ini mengikuti jam HP, jadi bisa meleset. Atur zona waktu HP ke WIB/WITA/WIT, atau pilih kota.'));
      }
    }
    kids.push(h('div', { class: 'panel jloc' },
      h('p', { class: 'jplace' }, h('b', {}, 'Lokasi: '), place),
      h('div', { class: 'row-btns' },
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: useGps }, busy ? 'Mencari…' : 'Perbarui lokasi'),
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { picking = true; draw(); } }, 'Ganti kota')),
      err ? h('p', { class: 'hint jerr', role: 'alert' }, err) : ''));
    kids.push(reminderPanel());
    kids.push(note());
    return kids;
  }

  // Pengingat salat memakai pengaturan yang SAMA dengan menu Notifikasi (satu sumber), jadi keduanya selalu sejalan.
  function reminderPanel() {
    let S = N.load();
    const commit = () => { N.save(S); S = N.load(); N.armReminders(); };
    const sw = (label, checked, onchange, id, disabled) => {
      const inp = h('input', { type: 'checkbox', id }); inp.checked = !!checked; inp.disabled = !!disabled;
      inp.addEventListener('change', () => onchange(inp.checked));
      return h('label', { class: 'nt-sw' }, inp, h('span', {}, label));
    };
    const box = h('div', { class: 'panel jrem', id: 'jr-panel' });
    const paint = () => {
      const dev = S.device && N.deviceSupported() && Notification.permission === 'granted';
      box.replaceChildren(h('h3', {}, 'Pengingat salat'),
        h('p', { class: 'muted' }, 'Pengingat di menu Notifikasi mengambil waktu dari jadwal ini secara otomatis. Pilihan di sini dan di Notifikasi selalu sama.'),
        sw('Aktifkan pengingat waktu salat', S.cats.salat, v => { S.cats.salat = v; commit(); paint(); }, 'jr-cat'),
        ...[...PRAYER_ROWS].map(([k, n]) => sw(n, S.prayers[k], v => { S.prayers[k] = v; commit(); paint(); }, 'jr-p-' + k, !S.cats.salat)),
        h('p', { class: 'hint', id: 'jr-state' }, dev ? 'Pengingat HP aktif: berbunyi ' + (S.lead ? S.lead + ' menit sebelum waktu' : 'tepat saat waktu masuk') + ', selama BAITUNA terbuka di peramban.' : 'Pengingat HP belum aktif. Daftar kabar tetap tampil di menu Notifikasi.'),
        go ? h('button', { class: 'btn-sm ghost', type: 'button', id: 'jr-go', onclick: () => go('notif') }, 'Buka Notifikasi') : '');
    };
    paint(); return box;
  }

  const note = () => h('div', { class: 'panel qnote' }, h('h3', {}, 'Tentang jadwal ini'),
    h('p', { class: 'muted' }, 'Dihitung di perangkat Anda dengan rumus astronomi, memakai acuan Kemenag RI: Subuh ' + METHOD.fajr + '°, Isya ' + METHOD.isha +
      '°, Ashar mazhab Syafi’i, ditambah ihtiyat ' + METHOD.ihtiyat + ' menit. Imsak dihitung ' + IMSAK_MIN + ' menit sebelum Subuh dan awal Dhuha sekitar ' + N.load().mine.dhuhaMin + ' menit setelah terbit (bisa Anda ubah di Notifikasi > Pengaturan > Kebiasaan saya); keduanya perkiraan. Nama kota pada lokasi GPS hanya perkiraan dari daftar kota. Hasilnya bisa berbeda beberapa menit dari jadwal resmi atau pengumuman masjid, jadi ikuti jadwal masjid setempat. Di luar Indonesia, acuan ini bisa berbeda dari otoritas setempat. Aplikasi ini tidak membunyikan adzan; pengingat opsional di menu Notifikasi hanya berbunyi saat BAITUNA terbuka.'));

  function draw() {
    const kids = [h('h2', { class: 'wtitle' }, 'Jadwal Salat'),
      h('p', { class: 'muted' }, 'Waktu salat sesuai lokasi Anda, dihitung otomatis.')];
    if (!loc || picking) { kids.push(chooser()); if (loc) kids.push(h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { picking = false; err = ''; draw(); } }, '← Kembali ke jadwal')); }
    else kids.push(...result());
    wrap.replaceChildren(...kids);
  }

  // Hitung mundur diperbarui tiap 15 detik; seluruh tampilan dimuat ulang saat salat berikutnya berganti atau hari berganti.
  const tick = setInterval(() => {
    if (!wrap.isConnected) { clearInterval(tick); return; }
    if (!loc || picking || shownKey === null) return;
    const now = Date.now(), off = offsetFor(loc, now), np = nextPrayer(now, loc.lat, loc.lng, off);
    if (!np || np.key + (np.tomorrow ? '+' : '') !== shownKey || todayIn(off, now).d !== shownDay) { draw(); return; }
    const cd = wrap.querySelector('.jcd'); if (cd) cd.textContent = fmtCountdown(np.at - now);
  }, 15000);

  draw();
  return wrap;
}
