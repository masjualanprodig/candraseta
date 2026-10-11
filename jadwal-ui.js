// BAITUNA - jadwal-ui.js
// Halaman Jadwal Salat: dihitung di perangkat dari lokasi (GPS perangkat atau pilihan kota). Tanpa layanan berbayar,
// tanpa kunci API, dan lokasi pengguna TIDAK dikirim ke server.
import { h, toast } from './ui.js';
import { getPosition } from './nearby-service.js';
import { CITIES } from './cities-id.js';
import { computePrayerTimes, nextPrayer, fmt, fmtCountdown, zoneLabel, inIndonesia, isValidTimes, todayIn, METHOD } from './prayer-times.js';
import * as cal from './islamic-calendar.js';

const LKEY = 'baituna.loc.v1';
const NAMES = { fajr: 'Subuh', sunrise: 'Terbit', dhuhr: 'Dzuhur', asr: 'Ashar', maghrib: 'Maghrib', isha: 'Isya' };
const ROWS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
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

export function jadwalPage() {
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
    const np = nextPrayer(now, loc.lat, loc.lng, off);
    const place = loc.mode === 'city' ? loc.city : 'Lokasi perangkat (' + loc.lat.toFixed(3) + ', ' + loc.lng.toFixed(3) + ')';
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
          return h('div', { class: 'jrow' + (k === 'sunrise' ? ' minor' : '') + (isNext ? ' next' : '') + (np.current === k ? ' now' : '') },
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
    kids.push(note());
    return kids;
  }

  const note = () => h('div', { class: 'panel qnote' }, h('h3', {}, 'Tentang jadwal ini'),
    h('p', { class: 'muted' }, 'Dihitung di perangkat Anda dengan rumus astronomi, memakai acuan Kemenag RI: Subuh ' + METHOD.fajr + '°, Isya ' + METHOD.isha +
      '°, Ashar mazhab Syafi’i, ditambah ihtiyat ' + METHOD.ihtiyat + ' menit. Hasilnya bisa berbeda beberapa menit dari jadwal resmi atau pengumuman masjid, jadi ikuti jadwal masjid setempat. Di luar Indonesia, acuan ini bisa berbeda dari otoritas setempat. Aplikasi ini tidak membunyikan adzan atau pengingat otomatis.'));

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
