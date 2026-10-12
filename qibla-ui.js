// BAITUNA - qibla-ui.js
// Kompas Arah Kiblat: arah dihitung dari lokasi (dibagi dengan Jadwal Salat), jarum mengikuti sensor kompas HP.
// JUJUR: ketepatan bergantung sensor HP; selalu cocokkan dengan penanda kiblat masjid. Lokasi tidak dikirim ke server.
import { h, toast } from './ui.js';
import { getPosition } from './nearby-service.js';
import { CITIES } from './cities-id.js';
import { readLoc } from './notif-service.js';
import { qiblaBearing, qiblaDistanceKm, windName, headingFrom, smoothAngle, isAligned, angleDiff, norm360, KAABA } from './qibla-service.js';

const LKEY = 'baituna.loc.v1';
const saveLoc = l => { try { localStorage.setItem(LKEY, JSON.stringify(l)); } catch (e) {} };
const MSG = { denied: 'Izin lokasi ditolak. Pilih kota di bawah, atau izinkan lokasi di pengaturan peramban.', unavailable: 'Lokasi belum bisa ditentukan. Nyalakan GPS lalu coba lagi, atau pilih kota.', timeout: 'Menentukan lokasi terlalu lama. Coba lagi di tempat terbuka, atau pilih kota.', unsupported: 'Peramban ini tidak mendukung lokasi. Pilih kota.' };
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); kids.forEach(c => e.append(c)); return e; };
const polar = (deg, r) => [150 + r * Math.sin(deg * Math.PI / 180), 150 - r * Math.cos(deg * Math.PI / 180)];

// Lambang Ka'bah sederhana (gambar sendiri): kubus hitam dengan pita emas.
function kaaba(x, y, s) {
  return svg('g', { transform: 'translate(' + (x - s / 2) + ',' + (y - s / 2) + ')' },
    svg('rect', { width: s, height: s, rx: s * 0.12, fill: '#1c1c1c' }),
    svg('rect', { y: s * 0.28, width: s, height: s * 0.14, fill: '#D4981F' }),
    svg('rect', { x: s * 0.62, y: s * 0.5, width: s * 0.18, height: s * 0.34, rx: 1, fill: '#D4981F' }));
}

export function kiblatPage({ go } = {}) {
  const wrap = h('div', { class: 'qibla' });
  let loc = readLoc(), bearing = null, heading = null, sensor = 'idle', picking = false, err = '', busy = false, lastAligned = false;
  const readout = {};
  let dial = null, hint = null, headTxt = null, badge = null;

  const needsPermission = () => typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';

  function compute() { bearing = loc ? qiblaBearing(loc.lat, loc.lng) : null; }

  function buildDial() {
    const g = svg('g', { id: 'qb-dial' });
    g.append(svg('circle', { cx: 150, cy: 150, r: 128, fill: '#F1ECDD', stroke: '#C9D8D3', 'stroke-width': 2 }), svg('circle', { cx: 150, cy: 150, r: 96, fill: 'none', stroke: '#DDE6E2', 'stroke-width': 1 }));
    for (let d = 0; d < 360; d += 15) { const major = d % 90 === 0, [x1, y1] = polar(d, major ? 104 : 112), [x2, y2] = polar(d, 122); g.append(svg('line', { x1, y1, x2, y2, stroke: major ? '#066755' : '#9DB3AC', 'stroke-width': major ? 2.5 : 1.2 })); }
    for (const [d, t] of [[0, 'U'], [90, 'T'], [180, 'S'], [270, 'B']]) { const [x, y] = polar(d, 86), tx = svg('text', { x, y: y + 6, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, fill: d === 0 ? '#B3261E' : '#066755' }); tx.textContent = t; g.append(tx); }
    if (bearing != null) {
      const [kx, ky] = polar(bearing, 138), [lx, ly] = polar(bearing, 118);
      g.append(svg('line', { x1: 150, y1: 150, x2: lx, y2: ly, stroke: '#D4981F', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-dasharray': '2 6' }), kaaba(kx, ky, 26));
    }
    return g;
  }

  function dialSvg() {
    dial = buildDial();
    const s = svg('svg', { viewBox: '0 0 300 300', class: 'qb-svg', role: 'img', 'aria-label': 'Kompas arah kiblat' }, dial,
      svg('polygon', { points: '150,8 140,-6 160,-6', fill: '#066755', transform: 'translate(0,10)' }),
      svg('circle', { cx: 150, cy: 150, r: 6, fill: '#066755' }));
    s.setAttribute('overflow', 'visible');
    return s;
  }

  function paintDial() {
    if (!dial) return;
    const rot = sensor === 'on' && heading != null ? -heading : 0;
    dial.setAttribute('transform', 'rotate(' + rot.toFixed(1) + ' 150 150)');
    if (!readout.root) return;
    const al = sensor === 'on' && isAligned(heading, bearing);
    readout.root.classList.toggle('aligned', al);
    if (headTxt) headTxt.textContent = sensor === 'on' && heading != null ? Math.round(heading) + '° ' + windName(heading) : '—';
    if (hint) hint.textContent = sensor === 'on' && heading != null && bearing != null
      ? (al ? 'Anda sudah menghadap arah kiblat.' : 'Putar HP ke ' + (angleDiff(heading, bearing) > 0 ? 'kanan' : 'kiri') + ' sekitar ' + Math.round(Math.abs(angleDiff(heading, bearing))) + '° sampai Ka’bah tepat di atas.')
      : sensor === 'none' ? 'Sensor kompas tidak terdeteksi di perangkat ini. Hadapkan ke arah ' + (bearing != null ? Math.round(bearing) + '° (' + windName(bearing) + ') dari utara memakai kompas lain.' : 'kiblat memakai kompas lain.')
      : sensor === 'denied' ? 'Izin sensor ditolak. Izinkan akses sensor gerak di pengaturan peramban, lalu coba lagi.'
      : 'Putar HP hingga Ka’bah berada tepat di atas.';
    if (badge) badge.hidden = !al;
    if (al && !lastAligned) { try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) { /* abaikan */ } }
    lastAligned = al;
  }

  let timer = null;
  function onOrient(ev) {
    if (!wrap.isConnected) { stop(); return; }
    let hd = null;
    if (Number.isFinite(ev.webkitCompassHeading)) hd = norm360(ev.webkitCompassHeading); // iOS: sudah mengarah ke utara magnetik
    else if (ev.alpha != null) { if (ev.type === 'deviceorientation' && ev.absolute !== true && !absSeen) return; hd = headingFrom(ev.alpha, ev.beta, ev.gamma); }
    if (hd == null) return;
    if (timer) { clearTimeout(timer); timer = null; }
    sensor = 'on'; heading = smoothAngle(heading, hd, 0.3); paintDial(); updateBtn();
  }
  let absSeen = false;
  const onAbs = ev => { absSeen = true; onOrient(ev); };
  function stop() { window.removeEventListener('deviceorientationabsolute', onAbs, true); window.removeEventListener('deviceorientation', onOrient, true); if (timer) { clearTimeout(timer); timer = null; } }
  async function start() {
    if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') { sensor = 'none'; paintDial(); updateBtn(); return; }
    if (needsPermission()) {
      try { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') { sensor = 'denied'; paintDial(); updateBtn(); return; } } catch (e) { sensor = 'denied'; paintDial(); updateBtn(); return; }
    }
    stop(); sensor = 'wait'; absSeen = false;
    window.addEventListener('deviceorientationabsolute', onAbs, true);
    window.addEventListener('deviceorientation', onOrient, true);
    timer = setTimeout(() => { if (sensor !== 'on') { sensor = 'none'; paintDial(); updateBtn(); } }, 3500);
    updateBtn();
  }
  let btn = null;
  function updateBtn() { if (btn) { btn.textContent = sensor === 'on' ? 'Kompas aktif' : sensor === 'wait' ? 'Menunggu sensor…' : 'Aktifkan kompas'; btn.disabled = sensor === 'on' || sensor === 'wait'; } }

  async function useGps() {
    if (busy) return; busy = true; err = ''; draw();
    try { const p = await getPosition(); loc = { mode: 'gps', lat: Math.round(p.lat * 1000) / 1000, lng: Math.round(p.lng * 1000) / 1000 }; saveLoc(loc); loc = readLoc(); picking = false; }
    catch (e) { err = MSG[e && e.code] || MSG.unavailable; }
    busy = false; draw();
  }
  function chooser() {
    const cityIn = h('select', { class: 'in', id: 'qb-city', 'aria-label': 'Pilih kota' }, h('option', { value: '' }, 'Pilih kota…'), ...CITIES.map(c => h('option', { value: c.name }, c.name)));
    return h('div', { class: 'panel qb-loc' }, h('h3', {}, 'Tentukan lokasi Anda'),
      h('p', { class: 'muted' }, 'Arah kiblat dihitung dari lokasi Anda. Lokasi hanya dipakai di perangkat ini dan dibagi dengan Jadwal Salat.'),
      h('button', { class: 'btn-sm', type: 'button', id: 'qb-gps', onclick: useGps }, busy ? 'Mencari…' : 'Gunakan lokasi HP'),
      h('div', { class: 'qb-or muted' }, 'atau'), cityIn,
      h('button', { class: 'btn-sm ghost', type: 'button', id: 'qb-citybtn', onclick: () => { const c = CITIES.find(x => x.name === cityIn.value); if (!c) { toast('Pilih kota dulu.', true); return; } saveLoc({ mode: 'city', city: c.name, lat: c.lat, lng: c.lng }); loc = readLoc(); picking = false; err = ''; draw(); } }, 'Pakai kota ini'),
      err ? h('p', { class: 'hint', role: 'alert' }, err) : '',
      loc ? h('button', { class: 'linkbtn', type: 'button', onclick: () => { picking = false; draw(); } }, '← Kembali') : '');
  }

  function draw() {
    compute(); lastAligned = false;
    if (!loc || picking) { wrap.replaceChildren(h('h2', { class: 'wtitle' }, 'Arah Kiblat'), chooser()); dial = null; readout.root = null; return; }
    const km = qiblaDistanceKm(loc.lat, loc.lng);
    headTxt = h('b', { id: 'qb-heading' }, '—'); hint = h('p', { class: 'qb-hint', id: 'qb-hint', role: 'status' }, '');
    badge = h('div', { class: 'qb-badge', id: 'qb-ok', hidden: true }, 'Arah kiblat tepat');
    btn = h('button', { class: 'btn-sm', type: 'button', id: 'qb-start', onclick: start }, 'Aktifkan kompas');
    const stage = h('div', { class: 'qb-stage' }, h('div', { class: 'qb-top' }, h('b', { id: 'qb-bearing' }, bearing != null ? Math.round(bearing) + '°' : '—'), h('span', { class: 'muted' }, bearing != null ? windName(bearing) + ' dari utara' : '')), dialSvg(), badge);
    readout.root = stage;
    wrap.replaceChildren(h('h2', { class: 'wtitle' }, 'Arah Kiblat'), h('p', { class: 'muted' }, 'Putar HP hingga Ka’bah berada tepat di atas, dengan HP dipegang datar.'),
      stage, hint,
      h('div', { class: 'row-btns qb-ctl' }, btn),
      h('div', { class: 'panel qb-info' }, h('div', { class: 'qb-ic' }, (() => { const s = svg('svg', { viewBox: '0 0 30 30', width: 34, height: 34, 'aria-hidden': 'true' }, kaaba(15, 15, 26)); return s; })()),
        h('div', {}, h('b', { id: 'qb-arah' }, bearing != null ? Math.round(bearing) + '° ' + windName(bearing) : 'Anda berada di Makkah'), h('div', { class: 'muted' }, 'Makkah, Arab Saudi' + (km != null && km > 0.5 ? ' · sekitar ' + Math.round(km).toLocaleString('id-ID') + ' km' : '')),
          h('div', { class: 'muted' }, 'Lokasi: ' + loc.label + ' · ', h('button', { class: 'linkbtn', type: 'button', id: 'qb-change', onclick: () => { picking = true; draw(); } }, 'Ubah')))),
      go ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => go('jadwal') }, 'Buka Jadwal Salat') : '',
      h('div', { class: 'panel qnote' }, h('h3', {}, 'Catatan penting'),
        h('p', { class: 'muted' }, 'Arah dihitung dari lokasi Anda ke Ka’bah (' + KAABA.lat + '° LU, ' + KAABA.lng + '° BT) dengan rumus lingkaran besar, terhadap utara sebenarnya. Kompas HP menunjuk utara magnetik dan tidak dikoreksi di sini. Ketepatannya bergantung sensor HP: bisa meleset beberapa derajat, apalagi di dekat logam, magnet, casing magnetik, atau peralatan listrik.'),
        h('p', { class: 'muted' }, 'Bila jarum tampak melenceng, gerakkan HP membentuk angka 8 beberapa kali untuk kalibrasi, lalu jauhkan dari benda logam. Selalu cocokkan dengan penanda kiblat atau arahan pengurus masjid setempat. Lokasi tidak dikirim ke server.')));
    paintDial(); updateBtn();
    if (sensor === 'idle' && !needsPermission() && typeof DeviceOrientationEvent !== 'undefined') start(); // Android/desktop: langsung mencoba; iOS menunggu ketukan (izin)
  }

  draw();
  return wrap;
}
