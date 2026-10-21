// BAITUNA - home-ui.js (v72)
// Komponen bersama beranda tiap peran (Design System v1.2): header sapaan, banner, kartu jadwal salat,
// Akses Cepat, daftar artikel, kartu statistik, dan daftar aktivitas. Semua data berasal dari fitur yang sudah ada.
import { h, ask } from './ui.js';
import { icon, ICONS } from './feed-ui.js';
import { openDirectory } from './directory.js';
import { loadLoc, offsetFor, clock } from './jadwal-ui.js';
import { nextPrayer, PRAYERS, offsetOf, isValidTimes } from './prayer-times.js';
import { publicPhotoUrl, ARTICLE_BUCKET, getSession, request } from './supabase.js';
import { initials, getMyProfile, cleanName, avatarUrl } from './profile-service.js';
import { CATALOG } from './quick-catalog.js';
import { refreshIcons } from './branding-service.js';
import { intent, undo, loadTasbih, saveTasbih, loadSound, saveSound } from './dzikir-service.js';
import { canSound, tick, chime } from './dzikir-sound.js';

let backFn = () => {};
export const setHomeBack = fn => { backFn = fn; };
// Buka halaman fitur (direktori/Al-Qur'an/dll.) dan kembali ke beranda lewat tombol Kembali.
export const go = tab => openDirectory('app', () => backFn(), tab);

export const sectionHead = (title, onAll, id, ic, allLabel = 'Lihat Semua') => h('div', { class: 'sh' }, h('h2', {}, ic ? icon(ic) : '', title),
  onAll ? h('button', { class: 'sh-all', type: 'button', id, onclick: onAll }, allLabel, icon(ICONS.chev)) : '');

/* ===== Header sapaan ===== */
// avatar: undefined = inisial nama, false = tanpa avatar, string = alamat foto (mis. foto masjid)
// place: {name, sub, onclick} = kartu masjid di dalam header (Admin Masjid).
export function greetingHeader({ title, sub, chip, name, email, avatar, place }) {
  const av = avatar === false ? '' : h('button', { class: 'hh-av' + (avatar ? ' has-img' : ''), type: 'button', id: 'hh-av', 'aria-label': 'Akun saya', onclick: () => go('profil') },
    avatar ? h('img', { src: avatar, alt: '' }) : initials(name, email));
  return h('header', { class: 'hh' + (av ? '' : ' no-av') + (place ? ' has-place' : ''), id: 'hh' },
    h('div', { class: 'hh-row' }, av,
      h('div', { class: 'hh-txt' },
        h('span', { class: 'hh-hi' }, 'Assalamu’alaikum'),
        h('h1', { class: 'hh-title', id: 'hh-title' }, title),
        sub ? h('p', { class: 'hh-sub' }, sub) : '',
        chip ? h('span', { class: 'hh-chip', id: 'hh-chip' }, chip) : ''),
      h('button', { class: 'hh-bell', type: 'button', id: 'hh-bell', 'aria-label': 'Notifikasi', onclick: () => go('notif') }, icon(ICONS.bell))),
    place ? h('button', { class: 'hh-place', type: 'button', id: 'hh-place', onclick: place.onclick }, h('span', { class: 'hh-pi' }, icon(ICONS.mosque)), h('span', { class: 'hh-pl' }, h('b', {}, place.name), place.sub ? h('small', {}, place.sub) : ''), icon(ICONS.chev)) : '');
}

/* ===== Banner utama (geser ke samping; titik penanda) ===== */
// Geser otomatis tiap `seconds` detik (0 = mati). Berhenti saat disentuh, saat tab tersembunyi, dan bila banner sudah dilepas dari halaman.
export function autoplay(track, seconds) {
  const sec = Number(seconds);
  if (!(sec > 0) || !track) return;
  try { if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) { /* abaikan */ }
  let timer = null, seen = false, idle = 0, hold = false;
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  const tick = () => {
    if (!track.isConnected) { if (seen || ++idle > 20) stop(); return; }
    seen = true;
    if (hold || document.hidden) return;
    const n = track.querySelectorAll('.bn-slide').length, w = track.clientWidth;
    if (n < 2 || !w) return;
    const i = Math.round(track.scrollLeft / w);
    track.scrollTo({ left: ((i + 1) % n) * w, behavior: 'smooth' });
  };
  const start = () => { stop(); timer = setInterval(tick, Math.max(1, sec) * 1000); };
  const pause = () => { hold = true; };
  const resume = () => { hold = false; start(); };
  track.addEventListener('touchstart', pause, { passive: true }); track.addEventListener('touchend', resume, { passive: true }); track.addEventListener('touchcancel', resume, { passive: true });
  track.addEventListener('pointerdown', pause, { passive: true }); track.addEventListener('pointerup', resume, { passive: true });
  start();
}
export function bannerCarousel(slides, { id = 'banner', speed = 0 } = {}) {
  const track = h('div', { class: 'bn-track', id, role: 'group', 'aria-label': 'Banner' },
    ...slides.map((s, i) => s.imgOnly
      ? h('article', { class: 'bn-slide bn-img' + (s.onclick ? ' bn-link' : ''), 'data-i': String(i), 'aria-label': s.label || ((i + 1) + ' dari ' + slides.length), ...(s.onclick ? { role: 'button', tabindex: '0', onclick: s.onclick, onkeydown: ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); s.onclick(); } } } : {}) }, s.img ? h('img', { src: s.img, alt: s.alt || 'Banner ' + (i + 1), decoding: 'async', draggable: 'false' }) : '')
      : h('article', { class: 'bn-slide ' + (s.tone || 'green'), 'data-i': String(i), 'data-art': s.art || '', 'aria-label': (i + 1) + ' dari ' + slides.length, ...(s.art === 'custom' ? { style: '--art-x:' + (s.img ? 'url("' + s.img + '")' : 'url("art-banner.svg")') } : {}) },
      h('div', { class: 'bn-txt' }, s.kicker ? h('span', { class: 'bn-kick' }, s.kicker) : '', h('h2', {}, s.title), s.text ? h('p', {}, s.text) : '',
        s.cta ? h('button', { class: 'bn-cta', type: 'button', onclick: s.onclick }, s.cta, icon(ICONS.chev)) : ''))));
  const dots = slides.length > 1 ? h('div', { class: 'bn-dots', 'aria-hidden': 'true' }, ...slides.map((_, i) => h('i', { class: i === 0 ? 'on' : '' }))) : '';
  if (dots) track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
  }, { passive: true });
  autoplay(track, speed);
  return h('section', { class: 'bn' }, track, dots);
}
export const promoBanner = ({ title, text, cta, onclick, id, art }) =>
  h('section', { class: 'pb', id, 'data-art': art || '' }, h('div', { class: 'pb-txt' }, h('h2', {}, title), h('p', {}, text), h('button', { class: 'bn-cta gold', type: 'button', onclick }, cta, icon(ICONS.chev))));

/* ===== Tasbih Digital (hitungan hanya di perangkat; sama dengan tab Tasbih di Dzikir) ===== */
const BEADS = '<svg viewBox="0 0 64 120" aria-hidden="true" focusable="false"><path d="M32 6c-22 8-26 44-6 66 8 9 14 16 12 30" fill="none" stroke="#7A4A22" stroke-width="2"/>' +
  [[28,10],[16,20],[10,34],[10,48],[16,62],[26,73],[33,84],[34,96]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="7.5" fill="#A8622E" stroke="#6B3A18" stroke-width="1.2"/><circle cx="' + (x - 2.5) + '" cy="' + (y - 2.5) + '" r="2" fill="#E0A875" opacity=".7"/>').join('') +
  '<path d="M34 104l-4 14M34 104l2 14M34 104l8 12" stroke="#C99A2E" stroke-width="2.4" stroke-linecap="round"/></svg>';
export function tasbihCard() {
  let st = loadTasbih(), snd = loadSound();
  const num = h('b', { class: 'tb-n', id: 'tb-n' }), big = h('button', { class: 'tb-big', type: 'button', id: 'tb-big' }, num, h('span', { class: 'tb-l' }, 'ketuk'));
  const tgt = h('strong', { class: 'tb-tg', id: 'tb-tg' }), prog = h('b', { class: 'tb-pg', id: 'tb-pg' }), bar = h('div', { class: 'tb-bar' }, h('i'));
  const undoB = h('button', { class: 'tb-btn', type: 'button', id: 'tb-undo', 'aria-label': 'Kurangi satu hitungan' }, '−1');
  const resetB = h('button', { class: 'tb-btn', type: 'button', id: 'tb-reset' }, 'Ulang');
  const gear = h('button', { class: 'tb-btn tb-gear', type: 'button', id: 'tb-gear', 'aria-label': 'Pengaturan bunyi', 'aria-expanded': 'false' }, icon(ICONS.gear));
  const pre = h('div', { class: 'tb-pre', id: 'tb-pre', role: 'group', 'aria-label': 'Target hitungan' });
  const opts = h('div', { class: 'tb-opts', id: 'tb-opts', hidden: true });
  const paint = () => {
    num.textContent = String(st.count);
    big.setAttribute('aria-label', 'Ketuk untuk menambah. Hitungan sekarang ' + st.count);
    if (st.target > 0) { tgt.textContent = 'Target ' + st.target; prog.textContent = st.count + ' / ' + st.target; bar.hidden = false; bar.firstChild.style.width = Math.min(100, Math.round(st.count / st.target * 100)) + '%'; }
    else { tgt.textContent = 'Tanpa target'; prog.textContent = st.count + ' ketukan'; bar.hidden = true; }
    big.classList.toggle('hit', st.target > 0 && st.count >= st.target);
    undoB.disabled = st.count === 0; resetB.disabled = st.count === 0;
    pre.replaceChildren(...[[33, '33'], [99, '99'], [100, '100'], [0, 'Tanpa target']].map(([v, l]) =>
      h('button', { class: 'tb-chip', type: 'button', 'aria-pressed': String(st.target === v), onclick: () => { st = { ...st, target: v }; saveTasbih(st); paint(); } }, l)));
  };
  big.addEventListener('click', () => {
    st = { ...st, count: st.count + 1 }; saveTasbih(st);
    if (st.target > 0 && st.count === st.target) { if (snd.done) chime(); } else if (snd.tap) tick();
    paint();
  });
  undoB.addEventListener('click', () => { st = { ...st, count: undo(st.count) }; saveTasbih(st); paint(); });
  resetB.addEventListener('click', async () => {
    if (!(await ask({ title: 'Ulang hitungan dari nol?', text: 'Hitungan tasbih sekarang (' + st.count + ') akan dikosongkan.', reason: false }))) return;
    st = { ...st, count: 0 }; saveTasbih(st); paint();
  });
  const opt = (label, checked, onchange) => { const cb = h('input', { type: 'checkbox' }); cb.checked = checked; cb.addEventListener('change', () => onchange(cb.checked)); return h('label', { class: 'dopt' }, cb, h('span', {}, label)); };
  opts.append(...(canSound() ? [opt('Bunyi lonceng saat target tercapai', snd.done, v => { snd = { ...snd, done: v }; saveSound(snd); if (v) chime(); }),
    opt('Bunyi detak tiap ketukan (pelan)', snd.tap, v => { snd = { ...snd, tap: v }; saveSound(snd); if (v) tick(); })] : [h('p', { class: 'hint' }, 'Perangkat ini tidak mendukung bunyi.')]));
  gear.addEventListener('click', () => { opts.hidden = !opts.hidden; gear.setAttribute('aria-expanded', String(!opts.hidden)); });
  const art = h('span', { class: 'tb-art', 'aria-hidden': 'true' }); art.innerHTML = BEADS;   // gambar statis dari kode ini
  paint();
  return h('section', { class: 'tb', id: 'tb' },
    h('div', { class: 'sh' }, h('div', {}, h('h2', {}, 'Tasbih Digital'), h('p', { class: 'tb-sub' }, 'Hitung dzikir dengan mudah.')),
      h('button', { class: 'sh-all', type: 'button', id: 'tb-all', onclick: () => { intent.tasbih = true; go('dzikir'); } }, 'Buka Penuh', icon(ICONS.chev))),
    h('div', { class: 'tb-main' }, art, big,
      h('div', { class: 'tb-side' }, tgt, prog, bar, h('div', { class: 'tb-ctl' }, undoB, resetB, gear))),
    pre, opts);
}

/* ===== Jadwal salat hari ini (dihitung di perangkat) ===== */
import { PRAYER_IC as PC_IC } from './prayer-icons.js';
const two = n => String(n).padStart(2, '0');
const hms = ms => { const t = Math.max(0, Math.floor(ms / 1000)); return two(Math.floor(t / 3600)) + ':' + two(Math.floor(t % 3600 / 60)) + ':' + two(t % 60); };
// place: {lat,lng,tz,label} (mis. koordinat masjid). Tanpa itu dipakai lokasi yang dipilih pengguna di Jadwal Salat.
export function prayerCard({ place = null } = {}) {
  let spot = null;
  if (place && Number.isFinite(place.lat) && Number.isFinite(place.lng)) spot = { lat: place.lat, lng: place.lng, off: offsetOf(place.tz), label: place.label || '' };
  else { const l = loadLoc(); if (l) spot = { lat: l.lat, lng: l.lng, off: offsetFor(l), label: l.mode === 'city' ? l.city : 'Lokasi perangkat' }; }
  const date = new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const head = h('div', { class: 'pc-head' }, h('div', {}, h('h2', {}, 'Jadwal Salat Hari Ini'), h('p', { class: 'pc-date' }, date + (spot && spot.label ? ' · ' + spot.label : ''))),
    h('button', { class: 'sh-all', type: 'button', id: 'pc-all', onclick: () => go('jadwal') }, 'Lihat Semua', icon(ICONS.chev)));
  const card = h('section', { class: 'pc', id: 'pc' }, head);
  const n = spot ? nextPrayer(Date.now(), spot.lat, spot.lng, spot.off) : null;
  if (!spot || !n) {
    card.append(h('p', { class: 'pc-empty', id: 'pc-empty' }, spot ? 'Jadwal belum bisa dihitung untuk lokasi ini.' : 'Pilih kota atau izinkan lokasi agar jadwal salat tampil. Lokasi hanya dipakai di perangkat ini.'),
      h('button', { class: 'bn-cta gold', type: 'button', id: 'pc-set', onclick: () => go('jadwal') }, 'Atur lokasi', icon(ICONS.chev)));
    return card;
  }
  const label = h('span', { class: 'pc-next' }), count = h('div', { class: 'pc-count', id: 'pc-count', 'aria-live': 'off' });
  const row = h('div', { class: 'pc-row', id: 'pc-row' });
  let cur = n;
  const paint = () => {
    label.textContent = 'Menuju ' + (PRAYERS.find(p => p[0] === cur.key) || [0, ''])[1];
    row.replaceChildren(...PRAYERS.map(([k, name]) => h('div', { class: 'pc-t' + (k === cur.key ? ' on' : ''), 'data-k': k }, PC_IC[k] ? h('i', { class: 'pc-ic' }, icon(PC_IC[k])) : '', h('span', {}, name), h('b', {}, Number.isFinite(cur.moments[k]) ? clock(cur.moments[k], spot.off) : '--:--'))));
  };
  const tick = () => {
    if (!card.isConnected) { clearInterval(iv); return; }
    let left = cur.at - Date.now();
    if (left <= 0) { const m = nextPrayer(Date.now(), spot.lat, spot.lng, spot.off); if (m) { cur = m; paint(); left = cur.at - Date.now(); } }
    count.textContent = hms(left);
  };
  paint(); count.textContent = hms(cur.at - Date.now());
  const iv = setInterval(tick, 1000);
  card.append(h('div', { class: 'pc-mid' }, label, count), row);
  return card;
}

/* ===== Akses Cepat ===== */
// items: [{key,label?,id?,onclick}] ; key mengacu ke quick-catalog (ikon bisa diganti Super Admin).
export const BOLT = '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>';
export const quickBtn = it => { const c = CATALOG[it.key] || [it.label, ICONS.more];
  return h('button', { class: 'qk', type: 'button', id: it.id, 'data-ic': it.key, onclick: it.onclick }, h('span', { class: 'qk-ic' }, icon(c[1])), h('span', { class: 'qk-l' }, it.label || c[0])); };
export function quickGrid(title, items, { onAll, id = 'qa', ic } = {}) {
  const grid = h('div', { class: 'qk-grid', id }, ...items.map(quickBtn));
  setTimeout(refreshIcons, 0);
  return h('section', { class: 'qs' }, sectionHead(title, onAll, id + '-all', ic), grid);
}

/* ===== Artikel terbaru (hanya yang terbit; senyap bila belum ada atau gagal dimuat) ===== */
export async function articleSection(limit = 2) {
  let items = [];
  try {
    const r = await request('/rest/v1/articles?select=id,title,category,source_name,cover_path,published_at,body&status=eq.published&order=published_at.desc&limit=' + Number(limit));
    items = r.ok && Array.isArray(r.data) ? r.data : [];
  } catch (e) { return ''; }
  if (!items.length) return '';
  const mins = a => Math.max(1, Math.ceil(String(a.body || '').trim().split(/\s+/).filter(Boolean).length / 200));   // perkiraan: 200 kata per menit
  return h('section', { class: 'ar', id: 'ar' }, sectionHead('Artikel Terbaru', () => go('berita'), 'ar-all'),
    h('div', { class: 'ar-grid' }, ...items.map(a => { const u = a.cover_path ? publicPhotoUrl(a.cover_path, ARTICLE_BUCKET) : null;
      return h('button', { class: 'ar-item', type: 'button', onclick: () => go('berita') },
        u ? h('img', { src: u, alt: '', loading: 'lazy', class: 'ar-img' }) : h('span', { class: 'ar-img ar-ph' }, icon(ICONS.news)),
        h('span', { class: 'ar-t' }, h('b', {}, a.title), h('small', {}, mins(a) + ' menit membaca'))); })));
}

/* ===== Statistik & aktivitas ===== */
export const statGrid = (items, id = 'stg') => h('div', { class: 'sg', id }, ...items.map(([ic, n, l]) =>
  h('div', { class: 'sg-i' }, h('span', { class: 'sg-ic' }, icon(ic)), h('div', {}, h('b', {}, String(n)), h('small', {}, l)))));

export function relTime(iso, now = Date.now()) {
  const t = new Date(iso).getTime(); if (!Number.isFinite(t)) return '';
  const m = Math.floor((now - t) / 60000);
  if (m < 1) return 'baru saja'; if (m < 60) return m + ' menit lalu';
  const hh = Math.floor(m / 60); if (hh < 24) return hh + ' jam lalu';
  const d = Math.floor(hh / 24); if (d < 8) return d + ' hari lalu';
  return new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
export const activityList = (rows, labelOf, onAll) => h('section', { class: 'av', id: 'av' }, sectionHead('Aktivitas Terbaru', onAll, 'av-all'),
  rows.length ? h('ul', { class: 'av-list' }, ...rows.map(r => h('li', { class: 'av-i' }, h('span', { class: 'av-ic' }, icon(ICONS.clock)), h('div', {}, h('b', {}, labelOf(r.action)), h('small', {}, relTime(r.created_at)))))) : h('p', { class: 'muted av-empty' }, 'Belum ada aktivitas tercatat.'));

// Pegangan aksi beranda (dipakai menu bawah): tiap beranda mendaftarkan fungsinya.
const acts = {};
export const registerActs = o => { Object.keys(acts).forEach(k => delete acts[k]); Object.assign(acts, o); };
export const runAct = k => { if (acts[k]) acts[k](); };
// Dari halaman fitur: kembali ke beranda lalu buka bagian yang dipilih di menu bawah.
let pendingAct = '';
export const requestAct = k => { pendingAct = k; backFn(); };
export const flushAct = () => { const k = pendingAct; pendingAct = ''; if (k) runAct(k); };
export const scrollToEl = el => { if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

// Nama untuk sapaan/avatar (gagal memuat profil tidak menghalangi beranda).
export async function whoAmI() {
  const u = (getSession() && getSession().user) || {};
  let name = '', avatar = '';
  try {
    if (u.id) { const p = await getMyProfile(u.id); name = cleanName(p.full_name); if (p.avatar_path) avatar = (await avatarUrl(p.avatar_path).catch(() => '')) || ''; }
  } catch (e) { if (e && e.status === 401) throw e; }
  return { name, email: u.email || '', avatar };
}

/* ===== Kartu ringkasan (Admin Masjid): 3 angka berderet dengan garis pemisah ===== */
export const summaryCard = ({ id, title, sub, onAll, allLabel, items, hint, hintLabel, onHint, actions }) => h('section', { class: 'sm', id },
  sectionHead(title, onAll, id + '-all', null, allLabel),
  sub ? h('p', { class: 'sm-sub' }, sub) : '',
  h('div', { class: 'sm-row' + (items.length === 4 ? ' c4' : '') }, ...items.map(it => h('div', { class: 'sm-i' + (it.tone ? ' ' + it.tone : '') },
    h('span', { class: 'sm-ic' }, icon(it.ic)), h('b', {}, String(it.value)), h('small', {}, it.label)))),
  hint ? h('div', { class: 'sm-hint' }, h('p', {}, hint), onHint ? h('button', { class: 'sm-hint-btn', type: 'button', onclick: onHint }, hintLabel || 'Mulai') : '') : '',
  actions ? h('div', { class: 'sm-acts' }, ...actions.map(a => h('button', { class: 'sm-act' + (a.gold ? ' gold' : ''), type: 'button', id: a.id, onclick: a.onclick }, a.label, icon(ICONS.chev)))) : '');

/* ===== Agenda terdekat: blok tanggal + judul + jam + tempat ===== */
export const agendaCard = ({ post, parts, times, onAll }) => h('section', { class: 'ag', id: 'ag' },
  sectionHead('Agenda Kegiatan', onAll, 'ag-all', ICONS.agenda),
  post ? h('div', { class: 'ag-body' },
    h('div', { class: 'ag-date' }, h('span', {}, parts.dow), h('b', {}, String(parts.d)), h('span', {}, parts.mon)),
    h('div', { class: 'ag-txt' }, h('strong', {}, post.title),
      h('span', { class: 'ag-meta' }, icon(ICONS.clock), times),
      post.location ? h('span', { class: 'ag-meta' }, icon(ICONS.pin), post.location) : ''))
  : h('p', { class: 'ag-empty' }, 'Belum ada agenda mendatang.'));

/* ===== Pengumuman terbaru ===== */
export const announceCard = ({ post, when, onAll, onOpen, onCreate }) => h('section', { class: 'an', id: 'an' },
  sectionHead('Pengumuman Terbaru', onAll, 'an-all', ICONS.horn),
  post ? h('button', { class: 'an-item', type: 'button', onclick: onOpen },
    h('span', { class: 'an-img' }, icon(ICONS.horn)),
    h('span', { class: 'an-t' }, h('b', {}, post.title), h('small', {}, icon(ICONS.agenda), when)),
    icon(ICONS.chev))
  : h('div', { class: 'sm-hint' }, h('p', {}, 'Belum ada pengumuman.'), onCreate ? h('button', { class: 'sm-hint-btn', type: 'button', id: 'an-create', onclick: onCreate }, 'Buat Pengumuman') : ''));
