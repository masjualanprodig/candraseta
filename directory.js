// BAITUNA - directory.js
// Direktori masjid publik + profil masjid. Bisa dibuka tanpa login.
// Hanya masjid berstatus aktif yang tampil (dijaga database).
import { $, h } from './ui.js';
import { show } from './router.js';
import { searchMosques, fetchProvinces, PAGE_SIZE } from './public-service.js';
import { prayerPanel } from './schedule-ui.js';
import { postsPublic } from './posts-ui.js';
import { calendarView, calendarSupported } from './calendar-ui.js';
import { publicPhotoUrl } from './supabase.js';

let onBack = () => {};
let state = { tab: 'dir', q: '', province: '', items: [], more: false, loaded: false, provinces: null, error: false };

export function openDirectory(from, back, tab) {
  onBack = back;
  if (tab) state.tab = tab;
  $('public-back').textContent = from === 'app' ? 'Kembali' : 'Masuk';
  show('public');
  if (state.tab === 'cal') { renderCalendar(); return; }
  if (!state.loaded) load(true); else renderList();
}

function tabs() {
  const t = (label, key) => h('button', {
    class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(state.tab === key),
    onclick: () => { state.tab = key; if (key === 'cal') renderCalendar(); else if (!state.loaded) load(true); else renderList(); }
  }, label);
  return h('div', { class: 'tabs', role: 'tablist' }, t('Masjid', 'dir'), t('Kalender Islam', 'cal'));
}

function renderCalendar() {
  const box = $('public-content');
  if (!calendarSupported()) {
    box.replaceChildren(tabs(), h('div', { class: 'panel' }, h('p', { class: 'muted' }, 'Peramban ini belum mendukung kalender Hijriah. Tanggal Hijriah perlu dikonfirmasi dari pengumuman resmi.')));
    return;
  }
  const v = calendarView();
  box.replaceChildren(tabs(), v.el);
  v.mount();
}
$('public-back').addEventListener('click', () => onBack());

async function load(reset) {
  const box = $('public-content');
  if (reset) { state.items = []; state.more = false; }
  state.error = false; state.loaded = true;
  box.replaceChildren(tabs(), h('p', { class: 'muted center' }, 'Memuat…'));
  try {
    if (!state.provinces) state.provinces = await fetchProvinces();
    const rows = await searchMosques({ q: state.q, province: state.province, offset: state.items.length });
    state.items = state.items.concat(rows);
    state.more = rows.length === PAGE_SIZE;
  } catch (e) { state.error = true; }
  renderList();
}

function renderList() {
  const box = $('public-content');
  const q = h('input', { class: 'in', type: 'search', placeholder: 'Cari nama masjid atau kota', maxlength: '60', value: state.q, autocomplete: 'off' });
  const prov = h('select', { class: 'in', 'aria-label': 'Provinsi' },
    h('option', { value: '' }, 'Semua provinsi'),
    (state.provinces || []).map(p => h('option', { value: p }, p)));
  prov.value = state.province;
  const search = h('form', {
    class: 'panel', novalidate: 'novalidate',
    onsubmit: ev => { ev.preventDefault(); state.q = q.value; state.province = prov.value; load(true); }
  }, h('div', { class: 'grid2' }, q, prov), h('div', { class: 'mt' }, h('button', { class: 'btn-sm', type: 'submit' }, 'Cari')));

  let body;
  if (state.error) {
    body = h('div', { class: 'panel center' }, h('p', {}, 'Direktori belum bisa dimuat. Periksa koneksi, lalu coba lagi.'),
      h('button', { class: 'btn-sm', onclick: () => load(true) }, 'Coba lagi'));
  } else if (!state.items.length) {
    body = h('div', { class: 'panel' }, h('p', { class: 'muted' }, state.q || state.province
      ? 'Tidak ada masjid yang cocok. Coba kata kunci atau provinsi lain.'
      : 'Belum ada masjid terverifikasi yang ditampilkan.'));
  } else {
    body = h('div', { class: 'panel' },
      state.items.map(m => h('div', { class: 'mrow' },
        thumb(m),
        h('div', { class: 'minfo' },
          h('strong', {}, m.name),
          h('div', { class: 'muted' }, [m.city, m.province].filter(Boolean).join(', ') || 'Lokasi belum diisi')),
        h('div', { class: 'macts' },
          h('span', { class: 'badge b-active' }, 'Terverifikasi'),
          h('button', { class: 'btn-sm ghost', onclick: () => renderDetail(m) }, 'Lihat profil')))),
      state.more ? h('div', { class: 'mt center' }, h('button', { class: 'btn-sm ghost', onclick: () => loadMore() }, 'Muat lebih banyak')) : '');
  }
  box.replaceChildren(tabs(), search, body);
}

async function loadMore() {
  try {
    const rows = await searchMosques({ q: state.q, province: state.province, offset: state.items.length });
    state.items = state.items.concat(rows); state.more = rows.length === PAGE_SIZE;
  } catch (e) { state.error = true; }
  renderList();
}

// Hanya angka/tanda telepon yang boleh masuk ke tautan tel:.
function thumb(m) {
  const u = publicPhotoUrl(m.photo_path);
  return u ? h('img', { class: 'thumb', src: u, alt: 'Foto ' + m.name, loading: 'lazy' }) : h('div', { class: 'thumb thumb-empty', 'aria-hidden': 'true' });
}

const telHref = p => /^[0-9+\-\s()]{5,30}$/.test(p || '') ? 'tel:' + p.replace(/[^0-9+]/g, '') : null;

function renderDetail(m) {
  const chips = String(m.facilities || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);
  const lat = Number(m.latitude), lng = Number(m.longitude);
  const hasMap = m.latitude !== null && m.longitude !== null && isFinite(lat) && isFinite(lng);
  const tel = telHref(m.contact_phone);
  const row = (label, content) => h('div', { class: 'drow' }, h('div', { class: 'muted' }, label), h('div', {}, content));
  $('public-content').replaceChildren(
    h('button', { class: 'btn-sm ghost', onclick: renderList }, '← Daftar masjid'),
    publicPhotoUrl(m.photo_path) ? h('img', { class: 'hero', src: publicPhotoUrl(m.photo_path), alt: 'Foto ' + m.name }) : '',
    h('h2', { class: 'mt' }, m.name),
    h('span', { class: 'badge b-active' }, 'Terverifikasi'),
    h('div', { class: 'panel' },
      row('Alamat', m.address || 'Belum diisi'),
      row('Wilayah', [m.city, m.province].filter(Boolean).join(', ') || 'Belum diisi'),
      row('Kontak resmi', m.contact_phone ? (tel ? h('a', { class: 'link', href: tel }, m.contact_phone) : m.contact_phone) : 'Belum diisi'),
      hasMap ? row('Lokasi', h('a', { class: 'link', href: 'https://www.google.com/maps?q=' + lat + ',' + lng, target: '_blank', rel: 'noopener noreferrer' }, 'Buka di Google Maps')) : ''),
    prayerPanel(m),
    postsPublic(m),
    m.description ? h('div', { class: 'panel' }, h('h3', {}, 'Tentang masjid'), h('p', { class: 'prewrap' }, m.description)) : '',
    chips.length ? h('div', { class: 'panel' }, h('h3', {}, 'Fasilitas'), h('div', { class: 'chips' }, chips.map(c => h('span', { class: 'chip' }, c)))) : '');
  window.scrollTo(0, 0);
}
