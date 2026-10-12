// BAITUNA - calendar-ui.js
// Kalender Islam bergaya Google Kalender: kisi bulanan, geser ke kanan/kiri (carousel),
// nama hari besar di bawah tanggalnya, dan popup detail saat tanggal hari besar diketuk.
// Tanggal Hijriah adalah PERKIRAAN (lihat islamic-calendar.js).
import { $, h } from './ui.js';
import * as cal from './islamic-calendar.js';
import { fastingFor, LEVEL_LABEL, NONE_TEXT, FAST_GROUPS, fastingLabel, ramadanStatus, daysText } from './puasa-service.js';
import { amalanFor, hasMark, GERHANA_INFO, ECLIPSE_DATA_UNTIL } from './amalan-service.js';

const BEFORE = 12, AFTER = 24; // rentang bulan yang bisa digeser dari bulan ini
const DOW = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function fastingBox(f) {
  const lv = f.level;
  return h('div', { class: 'fast-box fl-' + lv },
    h('h4', {}, 'Amalan puasa'),
    h('span', { class: 'fast-badge fl-' + lv }, LEVEL_LABEL[lv]),
    f.items.length
      ? h('ul', { class: 'ev-ul' }, f.items.map(x => h('li', {}, h('b', {}, x.name + '. '), x.desc)))
      : h('p', { class: 'ev-p' }, NONE_TEXT));
}

function dayDialog(date) {
  const ev = date.ev, f = date.fast;
  const dlg = $('ev-dlg');
  const body = $('ev-body');
  body.replaceChildren(...[
    h('h3', { id: 'ev-title' }, ev ? ev.name : cal.masehiText(date.y, date.m, date.d)),
    h('span', { class: 'badge b-pending' }, 'Tanggal perkiraan · perlu dikonfirmasi'),
    h('div', { class: 'ev-dates' },
      h('div', {}, h('div', { class: 'muted' }, 'Masehi'), h('b', {}, cal.masehiText(date.y, date.m, date.d))),
      h('div', {}, h('div', { class: 'muted' }, 'Hijriah'), h('b', {}, date.h ? cal.hijriText(date.h) : 'Tidak tersedia'))),
    fastingBox(f),
    date.extra && date.extra.length ? h('div', { class: 'fast-box extra-box' }, h('h4', {}, 'Amalan sunnah lainnya'), h('ul', { class: 'ev-ul' }, date.extra.map(x => h('li', {}, h('b', {}, x.name + '. '), x.desc)))) : '',
    ev ? [h('h4', {}, 'Tentang'),
      ev.about.map(p => h('p', { class: 'ev-p' }, p)),
      h('h4', {}, 'Yang umumnya dilakukan'),
      h('ul', { class: 'ev-ul' }, ev.practices.map(p => h('li', {}, p))),
      ev.note ? h('div', { class: 'ev-note' }, ev.note) : ''] : '',
    h('p', { class: 'hint' }, 'Tanggal dihitung dari kalender Umm al-Qura dan bisa berbeda 1–2 hari dari penetapan resmi di Indonesia (Kemenag). Keterangan puasa bersifat ringkas; untuk rincian hukum, tanyakan kepada ustaz.')
  ].flat());
  if (!dlg.open) dlg.showModal();
  body.scrollTop = 0;
}
$('ev-close').addEventListener('click', () => $('ev-dlg').close());
$('ev-dlg').addEventListener('click', e => { if (e.target === $('ev-dlg')) $('ev-dlg').close(); }); // klik latar menutup

// Mengembalikan { el, mount }. Panggil mount() setelah el dimasukkan ke halaman.
export function calendarView(now = new Date()) {
  const y0 = now.getFullYear(), m0 = now.getMonth() + 1, d0 = now.getDate();
  const months = [];
  for (let i = -BEFORE; i <= AFTER; i++) {
    const t = new Date(Date.UTC(y0, m0 - 1 + i, 1, 12));
    const md = cal.monthData(t.getUTCFullYear(), t.getUTCMonth() + 1);
    md.days.forEach(c => { c.fast = fastingFor(c.h, c.dow); c.extra = amalanFor(c.h, c.dow, c.y, c.m, c.d); });
    months.push(md);
  }
  const openEv = c => dayDialog(c);

  const cell = c => {
    const isToday = c.y === y0 && c.m === m0 && c.d === d0;
    const cls = 'calcell' + (c.dow === 0 ? ' sun' : '') + (isToday ? ' today' : '') + (c.ev ? ' ev' : '') + ' fl-' + c.fast.level;
    const kids = [
      h('span', { class: 'g' }, String(c.d)),
      h('span', { class: 'hj' }, c.h ? (c.h.d === 1 ? '1 ' + cal.HIJRI_SHORT[c.h.m - 1] : String(c.h.d)) : ''),
      c.ev ? h('span', { class: 'evn' }, c.ev.short) : '',
      c.fast.level !== 'none' ? h('span', { class: 'fdot', 'aria-hidden': 'true' }) : '',
      hasMark(c.extra) ? h('span', { class: 'adot', 'aria-hidden': 'true' }) : ''
    ];
    const label = c.d + ' ' + cal.MASEHI_MONTH[c.m - 1] + ' ' + c.y + (c.h ? ', ' + cal.hijriText(c.h) : '') + (c.ev ? ', hari besar: ' + c.ev.name : '')
      + ', ' + (c.fast.level === 'none' ? LEVEL_LABEL.none.toLowerCase() : LEVEL_LABEL[c.fast.level].toLowerCase() + ': ' + fastingLabel(c.fast)) + (c.extra.length ? ', amalan sunnah lain: ' + c.extra.map(x => x.name).join(', ') : '') + (isToday ? ', hari ini' : '');
    return h('button', { class: cls, type: 'button', 'aria-label': label, 'data-fl': c.fast.level, 'data-ex': hasMark(c.extra) ? '1' : '0', onclick: () => openEv(c) }, kids);
  };

  const slide = data => h('section', { class: 'calslide', 'aria-label': cal.MASEHI_MONTH[data.m - 1] + ' ' + data.y },
    h('div', { class: 'calgrid' },
      DOW.map((n, i) => h('div', { class: 'caldow' + (i === 0 ? ' sun' : '') }, n)),
      Array.from({ length: data.startDow }, () => h('div', { class: 'calcell blank' })),
      data.days.map(cell)));

  const title = h('b', {}), sub = h('span', {});
  const legend = h('div', { class: 'callegend' });
  const prev = h('button', { class: 'calnav', type: 'button', 'aria-label': 'Bulan sebelumnya' }, '‹');
  const next = h('button', { class: 'calnav', type: 'button', 'aria-label': 'Bulan berikutnya' }, '›');
  const todayBtn = h('button', { class: 'btn-sm ghost', type: 'button' }, 'Hari ini');
  const track = h('div', { class: 'caltrack', tabindex: '0', role: 'region', 'aria-label': 'Kalender Islam. Geser ke kanan atau kiri untuk berpindah bulan.' }, months.map(slide));

  let idx = BEFORE;
  const widthNow = () => track.clientWidth || 1;
  const goTo = (i, smooth) => { track.scrollTo({ left: i * widthNow(), behavior: smooth ? 'smooth' : 'auto' }); };

  function show(i) {
    i = Math.max(0, Math.min(months.length - 1, i)); idx = i;
    const data = months[i];
    title.textContent = cal.MASEHI_MONTH[data.m - 1] + ' ' + data.y;
    sub.textContent = cal.hijriRangeLabel(data) + ' (perkiraan)';
    prev.disabled = i === 0; next.disabled = i === months.length - 1;
    const fd = data.days.filter(c => ['wajib', 'larangan'].includes(c.fast.level) || c.fast.items.some(x => ['arafah', 'tasua', 'asyura', 'ayyamul_bidh', 'syawal6'].includes(x.key)));
    const ex = data.days.filter(c => hasMark(c.extra));
    const exLegend = h('div', { class: 'fastlegend exlegend' },
      h('h4', {}, 'Amalan sunnah lain'),
      h('p', { class: 'muted' }, h('i', { class: 'adot' }), ' Tanda belah ketupat: salat gerhana, salat Id, atau malam ganjil Ramadan. Setiap hari Jumat juga ada keterangan amalannya (ketuk tanggalnya).'),
      ex.length ? ex.map(c => h('button', { class: 'legrow', type: 'button', onclick: () => openEv(c) },
          h('span', { class: 'legdate' }, String(c.d)),
          h('span', { class: 'leginfo' }, h('b', {}, c.extra.filter(x => x.mark).map(x => x.name).join(', ')), h('span', { class: 'muted' }, cal.masehiText(c.y, c.m, c.d) + ' · ' + (c.h ? cal.hijriText(c.h) : ''))),
          h('span', { class: 'legarrow', 'aria-hidden': 'true' }, '›'))) : h('p', { class: 'muted' }, 'Tidak ada tanda amalan sunnah lain pada bulan ini.'),
      h('p', { class: 'hint' }, GERHANA_INFO + ' Daftar gerhana di kalender ini baru mencakup yang sudah terverifikasi (sampai ' + ECLIPSE_DATA_UNTIL + ') dan hanya yang terlihat dari Indonesia yang ditandai; periksa pengumuman BMKG untuk gerhana berikutnya.'));
    const fastLegend = h('div', { class: 'fastlegend' },
      h('h4', {}, 'Puasa bulan ini'),
      h('p', { class: 'muted' }, 'Ketuk tanggal mana pun untuk melihat keterangan puasanya. Setiap Senin dan Kamis: puasa sunnah.'),
      h('div', { class: 'fl-key' },
        h('span', {}, h('i', { class: 'fdot fl-wajib' }), ' Wajib'), h('span', {}, h('i', { class: 'fdot fl-sunnah' }), ' Sunnah'),
        h('span', {}, h('i', { class: 'fdot fl-anjuran' }), ' Dianjurkan'), h('span', {}, h('i', { class: 'fdot fl-larangan' }), ' Dilarang'), h('span', {}, h('i', { class: 'fdot fl-none' }), ' Tidak ada')),
      fd.length ? fd.map(c => h('button', { class: 'legrow', type: 'button', onclick: () => openEv(c) },
          h('span', { class: 'legdate' }, String(c.d)),
          h('span', { class: 'leginfo' }, h('b', {}, fastingLabel(c.fast)), h('span', { class: 'muted' }, cal.masehiText(c.y, c.m, c.d) + ' · ' + cal.hijriText(c.h))),
          h('span', { class: 'legarrow', 'aria-hidden': 'true' }, '›'))) : h('p', { class: 'muted' }, 'Tidak ada puasa khusus (di luar Senin dan Kamis) pada bulan ini.'));
    const evs = data.days.filter(c => c.ev);
    legend.replaceChildren(...[
      h('h4', {}, 'Hari besar bulan ini'),
      evs.length
        ? evs.map(c => h('button', { class: 'legrow', type: 'button', onclick: () => openEv(c) },
            h('span', { class: 'legdate' }, String(c.d)),
            h('span', { class: 'leginfo' }, h('b', {}, c.ev.name), h('span', { class: 'muted' }, cal.masehiText(c.y, c.m, c.d) + ' · ' + cal.hijriText(c.h))),
            h('span', { class: 'legarrow', 'aria-hidden': 'true' }, '›')))
        : h('p', { class: 'muted' }, 'Tidak ada hari besar pada bulan ini.'), fastLegend, exLegend].flat());
  }
  let ticking = false;
  track.addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { ticking = false; const i = Math.round(track.scrollLeft / widthNow()); if (i !== idx) show(i); });
  });
  prev.addEventListener('click', () => goTo(idx - 1, true));
  next.addEventListener('click', () => goTo(idx + 1, true));
  todayBtn.addEventListener('click', () => goTo(BEFORE, true));
  track.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(idx + 1, true); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(idx - 1, true); }
  });

  const t0 = ramadanStatus(y0, m0, d0);
  const ramBox = t0 ? h('p', { class: 'ram-count', id: 'ram-count' }, t0.phase === 'ramadan'
    ? 'Ramadan hari ke-' + t0.day + (t0.daysToEid ? ', ' + daysText(t0.daysToEid).replace(' lagi', '') + ' menuju 1 Syawal (perkiraan)' : ' (perkiraan)')
    : 'Menuju Ramadan ' + t0.hijriYear + ' H: ' + daysText(t0.inDays) + ', sekitar ' + t0.d + ' ' + cal.MASEHI_MONTH[t0.m - 1] + ' ' + t0.y + ' (perkiraan, tunggu sidang isbat).') : '';
  const el = h('div', { class: 'calwrap' },
    h('div', { class: 'calbar' }, prev, h('div', { class: 'ct' }, title, sub), next),
    ramBox,
    h('div', { class: 'calbar2' }, todayBtn),
    track,
    h('p', { class: 'hint' }, 'Tanggal Hijriah adalah PERKIRAAN (kalender Umm al-Qura) dan perlu dikonfirmasi. Penetapan resmi di Indonesia mengikuti pengumuman Kemenag (sidang isbat) dan bisa berbeda 1–2 hari. Pergantian hari saat Maghrib belum diperhitungkan.'),
    legend);
  show(BEFORE);
  return { el, mount: () => goTo(BEFORE, false) };
}

export const calendarSupported = () => cal.supported();
