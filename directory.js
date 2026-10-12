// BAITUNA - directory.js
// Direktori masjid publik + profil masjid. Bisa dibuka tanpa login.
// Hanya masjid berstatus aktif yang tampil (dijaga database).
import { $, h } from './ui.js';
import { show } from './router.js';
import { getSession } from './supabase.js';
import { searchMosques, fetchProvinces, PAGE_SIZE } from './public-service.js';
import { prayerPanel } from './schedule-ui.js';
import { postsPublic } from './posts-ui.js';
import { feedPanel, icon, ICONS } from './feed-ui.js';
import { worldGallery } from './world-ui.js';
import { historyPage } from './history-ui.js';
import { rukunPage } from './rukun-ui.js';
import { articlesPage } from './articles-ui.js';
import { dzikirPage } from './dzikir-ui.js';
import { doaPage } from './doa-ui.js';
import { sunnahPage } from './sunnah-ui.js';
import { belajarPage } from './belajar-ui.js';
import { asmaPage } from './asma-ui.js';
import { trackerPage } from './tracker-ui.js';
import { zakatPage } from './zakat-ui.js';
import { marketPage } from './market-ui.js';
import { profilPage } from './profil-ui.js';
import { jadwalPage } from './jadwal-ui.js';
import { quranPage } from './quran-ui.js';
import { nearbyView } from './nearby-ui.js';
import { calendarView, calendarSupported } from './calendar-ui.js';
import { notifPage } from './notif-ui.js';
import { publicPhotoUrl } from './supabase.js';

let onBack = () => {};
let state = { tab: 'dir', view: 'list', q: '', province: '', items: [], more: false, loaded: false, provinces: null, error: false };

export function openDirectory(from, back, tab) {
  onBack = back;
  if (tab) state.tab = tab;
  $('public-back').textContent = from === 'app' ? 'Kembali' : 'Masuk';
  show('public');
  if (state.tab === 'cal') { renderCalendar(); return; }
  if (state.tab === 'info') { renderFeed(); return; }
  if (state.tab === 'world') { renderWorld(); return; }
  if (state.tab === 'quran') { renderQuran(); return; }
  if (state.tab === 'sejarah') { renderHistory(); return; }
  if (state.tab === 'rukun') { renderRukun(); return; }
  if (state.tab === 'berita') { renderBerita(); return; }
  if (state.tab === 'dzikir') { renderDzikir(); return; }
  if (state.tab === 'doa') { renderDoa(); return; }
  if (state.tab === 'sunnah') { renderSunnah(); return; }
  if (state.tab === 'belajar') { renderBelajar(); return; }
  if (state.tab === 'asma') { renderAsma(); return; }
  if (state.tab === 'tracker') { renderTracker(); return; }
  if (state.tab === 'zakat') { renderZakat(); return; }
  if (state.tab === 'market') { renderMarket(); return; }
  if (state.tab === 'notif') { renderNotif(); return; }
  if (state.tab === 'profil') { renderProfil(); return; }
  if (state.tab === 'jadwal') { renderJadwal(); return; }
  if (state.tab === 'more') { renderMore(); return; }
  if (!state.loaded) load(true); else renderList();
}

// Membuka profil satu masjid langsung (mis. dari beranda agenda).
export function openMosque(m, from, back) {
  onBack = back; state.tab = 'info';
  $('public-back').textContent = from === 'app' ? 'Kembali' : 'Masuk';
  show('public');
  renderDetail(m, renderFeed, '← Agenda');
}

const SUBS = { dir: 'Direktori Masjid', info: 'Agenda & Pengumuman', cal: 'Kalender Islam', quran: 'Al-Qur\u2019an', world: 'Galeri Masjid Dunia', sejarah: 'Sejarah Islam', rukun: 'Rukun Islam & Iman', berita: 'Berita & Artikel Islam', dzikir: 'Dzikir Pagi & Petang', doa: 'Doa Shahih', sunnah: 'Amalan Sunnah Harian', belajar: 'Belajar Membaca Al-Qur\u2019an', asma: 'Asmaul Husna', tracker: 'Tracker Ibadah Harian', zakat: 'Kalkulator Zakat', market: 'Pasar Umat', notif: 'Notifikasi', profil: 'Profil & Pengaturan', jadwal: 'Jadwal Salat', more: 'Lainnya' };
// Halaman yang dibuka dari tab "Lainnya" (tab itu tetap tampak terpilih).
const MORE = ['more', 'world', 'sejarah', 'rukun', 'berita', 'dzikir', 'doa', 'sunnah', 'belajar', 'asma', 'tracker', 'zakat', 'market', 'notif', 'profil', 'jadwal'];
// Setelah masuk, Profil ada di bilah bawah; Agenda dan Kalender pindah ke menu Lainnya.
const MORE_AUTH = ['more', 'info', 'cal', 'world', 'sejarah', 'rukun', 'berita', 'dzikir', 'doa', 'sunnah', 'belajar', 'asma', 'tracker', 'zakat', 'market', 'notif', 'jadwal'];
const go = key => { state.tab = key; if (key === 'cal') renderCalendar(); else if (key === 'info') renderFeed(); else if (key === 'quran') renderQuran(); else if (key === 'world') renderWorld(); else if (key === 'sejarah') renderHistory(); else if (key === 'rukun') renderRukun(); else if (key === 'berita') renderBerita(); else if (key === 'dzikir') renderDzikir(); else if (key === 'doa') renderDoa(); else if (key === 'sunnah') renderSunnah(); else if (key === 'belajar') renderBelajar(); else if (key === 'asma') renderAsma(); else if (key === 'tracker') renderTracker(); else if (key === 'zakat') renderZakat(); else if (key === 'market') renderMarket(); else if (key === 'notif') renderNotif(); else if (key === 'profil') renderProfil(); else if (key === 'jadwal') renderJadwal(); else if (key === 'more') renderMore(); else if (!state.loaded) load(true); else renderList(); window.scrollTo(0, 0); };

function tabs() {
  const sub = document.getElementById('public-sub');
  if (sub) sub.textContent = SUBS[state.tab] || SUBS.dir;
  const authed = !!getSession();
  const t = (label, key, ic, selected, onclick) => h('button', {
    class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(selected !== undefined ? selected : state.tab === key),
    onclick: onclick || (() => go(key))
  }, icon(ic), h('span', {}, label));
  if (authed) { // bilah bawah yang sama dengan halaman Beranda: Profil di pojok kanan bawah
    return h('nav', { class: 'tabs bottomnav', role: 'tablist', 'aria-label': 'Menu utama' },
      t('Beranda', 'home', ICONS.home, false, () => $('public-back').click()), t('Masjid', 'dir', ICONS.mosque), t('Qur\u2019an', 'quran', ICONS.quran),
      t('Lainnya', 'more', ICONS.more, MORE_AUTH.includes(state.tab)), t('Profil', 'profil', ICONS.user));
  }
  return h('nav', { class: 'tabs bottomnav', role: 'tablist', 'aria-label': 'Bagian' }, t('Masjid', 'dir', ICONS.mosque), t('Agenda', 'info', ICONS.agenda), t('Kalender', 'cal', ICONS.moon), t('Qur\u2019an', 'quran', ICONS.quran), t('Lainnya', 'more', ICONS.more, MORE.includes(state.tab)));
}

function renderMore() {
  const card = (key, ic, title, sub) => h('button', { class: 'morecard', type: 'button', onclick: () => go(key) },
    h('span', { class: 'mc-ic' }, icon(ic)), h('span', { class: 'mc-tx' }, h('b', {}, title), h('span', { class: 'muted' }, sub)));
  $('public-content').replaceChildren(tabs(), h('h2', { class: 'wtitle' }, 'Lainnya'),
    h('div', { class: 'qlist' },
      ...(getSession() ? [card('info', ICONS.agenda, 'Agenda & Pengumuman', 'Kegiatan dan kabar dari masjid'), card('cal', ICONS.moon, 'Kalender Islam', 'Tanggal Masehi dan Hijriah (perkiraan)')]
        : [card('profil', ICONS.user, 'Profil & Pengaturan', 'Akun, favorit, pengaturan, dan bantuan')]),
      card('notif', ICONS.bell, 'Notifikasi', 'Pengingat salat & puasa, kajian terdekat, kabar baru. Bisa diatur'),
      card('market', ICONS.market, 'Pasar Umat', 'Produk dan jasa usaha jamaah, diverifikasi admin'),
      card('belajar', ICONS.belajar, 'Belajar Membaca Al-Qur\u2019an', 'Dari huruf hijaiyah sampai lancar, ada kuis dan nilai'),
      card('asma', ICONS.asma, 'Asmaul Husna', '99 nama Allah: arti, favorit, dan kuis hafalan'),
      card('tracker', ICONS.tracker, 'Tracker Ibadah Harian', 'Catatan pribadi: salat, Al-Qur’an, amalan, dan pengingat'),
      card('zakat', ICONS.zakat, 'Kalkulator Zakat', 'Zakat maal dan penghasilan, nisab, haul, dan rujukan'),
      card('jadwal', ICONS.clock, 'Jadwal Salat', 'Waktu salat sesuai lokasi Anda'),
      card('dzikir', ICONS.dzikir, 'Dzikir Pagi & Petang', 'Bacaan dan penghitung ketukan'),
      card('doa', ICONS.doa, 'Doa Shahih', 'Doa sesuai sunnah, lengkap dengan sumber'),
      card('sunnah', ICONS.sunnah, 'Amalan Sunnah Harian', 'Amalan yang dianjurkan, lengkap dengan sumber'),
      card('berita', ICONS.news, 'Berita & Artikel Islam', 'Khazanah, tips, dan bacaan Islami'),
      card('rukun', ICONS.book, 'Rukun Islam & Rukun Iman', 'Dalil, hadits, dan tuntunan'),
      card('sejarah', ICONS.book, 'Sejarah Islam', 'Peristiwa dan tokoh penting'),
      card('world', ICONS.globe, 'Galeri Masjid Dunia', 'Masjid-masjid terkenal di dunia')));
}

function renderJadwal() {
  $('public-content').replaceChildren(tabs(), jadwalPage({ go }));
}

function renderProfil() {
  $('public-content').replaceChildren(tabs(), profilPage({ onSignIn: () => $('public-back').click(), onLogout: () => $('logout-btn').click() }));
}

function renderMarket() {
  $('public-content').replaceChildren(tabs(), marketPage({ onLogin: () => $('public-back').click() }));
}

function renderNotif() {
  $('public-content').replaceChildren(tabs(), notifPage({ go }));
}

function renderZakat() {
  $('public-content').replaceChildren(tabs(), zakatPage());
}

function renderTracker() {
  $('public-content').replaceChildren(tabs(), trackerPage());
}

function renderAsma() {
  $('public-content').replaceChildren(tabs(), asmaPage());
}

function renderBelajar() {
  $('public-content').replaceChildren(tabs(), belajarPage());
}

function renderSunnah() {
  $('public-content').replaceChildren(tabs(), sunnahPage());
}

function renderDoa() {
  $('public-content').replaceChildren(tabs(), doaPage());
}

function renderDzikir() {
  $('public-content').replaceChildren(tabs(), dzikirPage());
}

function renderBerita() {
  $('public-content').replaceChildren(tabs(), articlesPage());
}

function renderRukun() {
  $('public-content').replaceChildren(tabs(), rukunPage());
}

function renderQuran() {
  $('public-content').replaceChildren(tabs(), quranPage());
}

function renderHistory() {
  $('public-content').replaceChildren(tabs(), historyPage());
}

function renderWorld() {
  $('public-content').replaceChildren(tabs(), worldGallery());
}

function renderFeed() {
  $('public-content').replaceChildren(tabs(),
    feedPanel({ hero: true, onOpen: m => renderDetail(m, renderFeed, '← Agenda') }));
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

const seg = () => h('div', { class: 'seg', role: 'tablist', 'aria-label': 'Tampilan masjid' },
  ...[['list', 'Daftar'], ['near', 'Terdekat']].map(([k, label]) => h('button', {
    class: 'segb', type: 'button', role: 'tab', 'aria-selected': String(state.view === k), onclick: () => { state.view = k; renderList(); window.scrollTo(0, 0); }
  }, label)));

function renderList() {
  const box = $('public-content');
  if (state.view === 'near') { box.replaceChildren(tabs(), seg(), nearbyView({ onOpen: m => renderDetail(m, renderList, '← Masjid terdekat') })); return; }
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
  box.replaceChildren(tabs(), seg(), search, body);
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

function renderDetail(m, back = renderList, backLabel = '← Daftar masjid') {
  const chips = String(m.facilities || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);
  const lat = Number(m.latitude), lng = Number(m.longitude);
  const hasMap = m.latitude !== null && m.longitude !== null && isFinite(lat) && isFinite(lng);
  const tel = telHref(m.contact_phone);
  const row = (label, content) => h('div', { class: 'drow' }, h('div', { class: 'muted' }, label), h('div', {}, content));
  $('public-content').replaceChildren(
    h('button', { class: 'btn-sm ghost', onclick: back }, backLabel),
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
