// BAITUNA - dashboard-mosque.js
// Dashboard Admin Masjid: profil masjid, tim pengurus, dan undangan.
import { h, toast, hint, ask, STATUS_LABEL } from './ui.js';
import { getMosque, updateMosqueProfile, fetchTeam, listInvitations, listOfficers, registerMosque, myAdminMosques, saveGallery, setGallery, setMosquePhoto, MAX_GALLERY } from './mosque-service.js';
import { prepareProductPhoto } from './photo.js';
import { parseMapsUrl, mapsText, MAPS_HELP, MAPS_RE, mapEmbed, parseCoords } from './maps-link.js';
import { publicPhotoUrl, mosqueCover, GALLERY_BUCKET, storageRemove } from './supabase.js';
import { teamPanel } from './team-panel.js';
import { renderPostsManager } from './posts-ui.js';
import { listManagedPosts } from './post-service.js';
import { listProvinces, listRegencies, listDistricts } from './wilayah-service.js';
import { icon, ICONS } from './feed-ui.js';
import { getSession } from './supabase.js';
import { renderKasManager } from './kas-ui.js';
import { renderAuditLog } from './audit-ui.js';
import { list as listAudit, actionLabel } from './audit-service.js';
import { homeBody } from './home-builder.js';
import { greetingHeader, bannerCarousel, promoBanner, tasbihCard, prayerCard, quickGrid, summaryCard, articleSection, agendaCard, announceCard, activityList, whoAmI, go, registerActs, scrollToEl, BOLT } from './home-ui.js';
import * as K from './kas-service.js';
import { isUpcoming, dateParts, fmtTimes, fmtWhen } from './post-time.js';

const ROLES_FOR_ADMIN_MASJID = ['ketua_takmir', 'bendahara', 'pengurus_bagian', 'pengelola_usaha'];


/* ===== Masjid Saya: daftar masjid yang dikelola + daftarkan masjid baru (Admin Masjid). Masjid baru berstatus "menunggu" sampai Super Admin memverifikasi. ===== */
const CHOSEN = 'baituna.mosque.v1';
const loc = m => [m.city, m.province].filter(Boolean).join(', ');
// Masjid yang sedang dikelola di dashboard: pilihan terakhir bila masih termasuk masjid aktif, kalau tidak yang pertama.
export function chosenMosque(ids) {
  let c = ''; try { c = localStorage.getItem(CHOSEN) || ''; } catch (e) { /* abaikan */ }
  return ids.includes(c) ? c : ids[0];
}
const rememberMosque = id => { try { localStorage.setItem(CHOSEN, id); } catch (e) { /* abaikan */ } };
export const TERMS = [
  'Isi data yang benar dan sesuai keadaan masjid.',
  'Masjid baru berstatus menunggu sampai diverifikasi Super Admin. Super Admin dapat menolak atau menonaktifkan masjid.',
  'Maksimal 3 masjid menunggu verifikasi sekaligus. Nama, kota, dan kecamatan yang sama tidak boleh didaftarkan dua kali.',
  'Anda otomatis menjadi Admin Masjid untuk masjid yang Anda daftarkan.'];

// Pratinjau masjid yang didaftarkan: data persis seperti yang akan dilihat pengunjung (juga selagi masih menunggu verifikasi).
async function renderMosquePreview(box, id, onBack, actions = []) {
  let m;
  try { m = await getMosque(id); } catch (e) { if (e && e.status === 401) return; toast('Detail masjid belum bisa dimuat. ' + hint(e), true); return; }
  if (!m) { toast('Masjid tidak ditemukan.', true); return; }
  const photos = (Array.isArray(m.photos) ? m.photos : []).map(p => publicPhotoUrl(p, GALLERY_BUCKET)).filter(Boolean);
  const cover = mosqueCover(m);
  const row = (label, content) => h('div', { class: 'drow' }, h('div', { class: 'muted' }, label), h('div', {}, content));
  const wilayah = [m.district, m.city, m.province].filter(Boolean).join(', ');
  const mapsHref = m.maps_url && MAPS_RE.test(m.maps_url) ? m.maps_url : null;
  box.replaceChildren(h('div', { class: 'home', id: 'mosque-preview' }, h('div', { class: 'home-body mp-body' },
    h('div', { class: 'mp-head' }, h('button', { class: 'btn-sm ghost', id: 'pv-back', type: 'button', onclick: onBack }, '← Masjid Saya'), h('h2', {}, 'Pratinjau')),
    photos.length ? h('div', { class: 'rg-gallery', id: 'pv-gallery' }, photos.map((u, i) => h('a', { href: u, target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'Foto ' + (i + 1) }, h('img', { src: u, alt: 'Foto ' + (i + 1) + ' ' + m.name, loading: 'lazy' }))))
      : cover ? h('img', { class: 'hero', src: cover, alt: 'Foto ' + m.name }) : h('div', { class: 'photo-empty' }, 'Belum ada foto'),
    h('h2', { class: 'mt' }, m.name),
    h('span', { class: 'badge b-' + m.status }, STATUS_LABEL[m.status] || m.status),
    m.status_reason ? h('p', { class: 'muted' }, 'Alasan: ' + m.status_reason) : '',
    m.status === 'pending' || m.status === 'draft' ? h('p', { class: 'muted' }, 'Masjid ini belum tampil di direktori publik sampai diverifikasi Super Admin.') : '',
    h('div', { class: 'panel' },
      row('Alamat', m.address || 'Belum diisi'),
      row('Wilayah', wilayah || 'Belum diisi'),
      row('No.HP/Telepon', m.contact_phone || 'Belum diisi'),
      row('Lokasi', mapsHref ? h('a', { class: 'link', id: 'pv-maps', href: mapsHref, target: '_blank', rel: 'noopener noreferrer' }, 'Buka di Google Maps') : 'Belum ada tautan Google Maps'),
      mapEmbed(m) || ''),
    m.description ? h('div', { class: 'panel' }, h('h3', {}, 'Tentang masjid'), h('p', { class: 'prewrap' }, m.description)) : '',
    actions.length ? h('div', { class: 'pv-acts mt' }, ...actions) : '')));
  window.scrollTo(0, 0);
}

// Daftar masjid milik Admin Masjid ini (semua status). Ketuk satu baris untuk melihat profil lengkapnya.
export async function renderMyMosques(box, { currentId, onBack, onEdit, onPick, onRegister }) {
  const me = getSession() && getSession().user;
  box.replaceChildren(h('p', { class: 'muted' }, 'Memuat…'));
  let mine = [];
  try { mine = me ? await myAdminMosques(me.id) : []; } catch (e) { if (e && e.status === 401) return; toast('Daftar masjid belum bisa dimuat. ' + hint(e), true); }
  const back = () => renderMyMosques(box, { currentId, onBack, onEdit, onPick, onRegister });
  const open = m => renderMosquePreview(box, m.id, back, [
    m.id === currentId ? h('button', { class: 'btn-primary', type: 'button', id: 'pv-edit', onclick: onEdit }, 'Edit profil masjid') : '',
    m.status === 'active' && m.id !== currentId ? h('button', { class: 'btn-primary', type: 'button', id: 'pv-pick', onclick: () => onPick(m.id) }, 'Kelola masjid ini') : '']);
  const rows = mine.map(m => h('div', { class: 'mrow', 'data-mosque': m.id },
    h('button', { class: 'minfo mrow-open', type: 'button', 'data-open': m.id, 'aria-label': 'Lihat profil ' + m.name, onclick: () => open(m) },
      h('strong', {}, m.name), h('div', { class: 'muted' }, loc(m) || 'Lokasi belum diisi'), m.status_reason ? h('div', { class: 'muted' }, 'Alasan: ' + m.status_reason) : '', h('span', { class: 'rg-see' }, 'Lihat profil lengkap ›')),
    h('div', { class: 'macts' }, h('span', { class: 'badge b-' + m.status }, STATUS_LABEL[m.status] || m.status), m.id === currentId ? h('span', { class: 'muted' }, 'Sedang dikelola') : '')));
  box.replaceChildren(h('div', { class: 'home', id: 'my-mosques' }, h('div', { class: 'home-body mp-body' },
    h('div', { class: 'mp-head' }, h('button', { class: 'btn-sm ghost', id: 'mm-back', type: 'button', onclick: onBack }, '← Kembali ke dashboard'), h('h2', {}, 'Masjid Saya')),
    h('div', { class: 'panel' }, h('h3', {}, 'Masjid yang Anda daftarkan (' + mine.length + ')'), rows.length ? rows : h('p', { class: 'muted' }, 'Belum ada masjid terdaftar.')),
    h('div', { class: 'mt' }, h('button', { class: 'btn-sm ghost', id: 'mm-register', type: 'button', onclick: onRegister }, '+ Daftarkan masjid baru')))));
  window.scrollTo(0, 0);
}


async function renderRegister(box, onBack, { currentId = null, onPick = null } = {}) {
  const me = getSession() && getSession().user;
  let mine = [];
  try { mine = me ? await myAdminMosques(me.id) : []; } catch (e) { if (e && e.status === 401) return; mine = []; }
  const field = (ph, max, id) => h('input', { class: 'in', id, placeholder: ph, maxlength: String(max), autocomplete: 'off', 'aria-label': ph });
  const name = field('Nama masjid *', 150, 'rg-name'), phone = field('No.HP/Telepon', 30, 'rg-phone');
  // Provinsi -> Kota/Kabupaten -> Kecamatan: pilihan bertingkat. Bila daftar wilayah gagal dimuat, berubah jadi isian teks.
  const sel = (id, label) => h('select', { class: 'in', id, 'aria-label': label, disabled: 'disabled' }, h('option', { value: '' }, label));
  const prov = sel('rg-prov', 'Pilih provinsi'), city = sel('rg-city', 'Pilih kota/kabupaten'), dist = sel('rg-dist', 'Pilih kecamatan');
  const wnote = h('p', { class: 'muted', id: 'rg-wnote', style: 'margin:4px 0 0' }, '');
  const fill = (el, label, rows) => { el.replaceChildren(h('option', { value: '' }, label), ...rows.map(x => h('option', { value: x.id }, x.name))); el.disabled = !rows.length; };
  const reset = (el, label) => { el.replaceChildren(h('option', { value: '' }, label)); el.disabled = true; };
  let prov2 = prov, city2 = city, dist2 = dist;
  const textMode = () => {
    for (const [el, ph, id] of [[prov, 'Provinsi', 'rg-prov'], [city, 'Kota/Kabupaten', 'rg-city'], [dist, 'Kecamatan', 'rg-dist']]) {
      const t = field(ph, 80, id); el.replaceWith(t);
      if (el === prov) prov2 = t; else if (el === city) city2 = t; else dist2 = t;
    }
    wnote.textContent = 'Daftar wilayah belum bisa dimuat. Isi manual saja.';
  };
  const chosen = el => el.tagName === 'SELECT' ? (el.selectedIndex > 0 ? el.options[el.selectedIndex].textContent : '') : el.value.trim();
  prov.onchange = async () => {
    reset(city, 'Pilih kota/kabupaten'); reset(dist, 'Pilih kecamatan'); wnote.textContent = '';
    if (!prov.value) return;
    const pid = prov.value; city.options[0].textContent = 'Memuat…';
    try { const rows = await listRegencies(pid); if (prov.value === pid) { fill(city, 'Pilih kota/kabupaten', rows); } }
    catch (e) { wnote.textContent = 'Kota/kabupaten belum bisa dimuat. Periksa internet lalu pilih provinsi lagi.'; reset(city, 'Pilih kota/kabupaten'); }
  };
  city.onchange = async () => {
    reset(dist, 'Pilih kecamatan'); wnote.textContent = '';
    if (!city.value) return;
    const cid = city.value; dist.options[0].textContent = 'Memuat…';
    try { const rows = await listDistricts(cid); if (city.value === cid) { fill(dist, 'Pilih kecamatan', rows); } }
    catch (e) { wnote.textContent = 'Kecamatan belum bisa dimuat. Periksa internet lalu pilih kota/kabupaten lagi.'; reset(dist, 'Pilih kecamatan'); }
  };
  listProvinces().then(rows => fill(prov, 'Pilih provinsi', rows)).catch(() => textMode());
  // Tautan lokasi Google Maps (opsional): koordinat dibaca otomatis dari tautan panjang.
  const mapsIn = h('input', { class: 'in', id: 'rg-maps', type: 'url', inputmode: 'url', placeholder: 'Tautan lokasi Google Maps (opsional)', maxlength: '500', autocomplete: 'off', 'aria-label': 'Tautan lokasi Google Maps' });
  const mapsMsg = h('p', { class: 'hint', id: 'rg-maps-msg' }, MAPS_HELP);
  let maps = { ok: false, empty: true };
  mapsIn.addEventListener('input', () => {
    maps = parseMapsUrl(mapsIn.value);
    mapsMsg.className = 'hint' + (maps.ok || maps.empty ? '' : ' mk-err');
    mapsMsg.textContent = mapsText(maps);
  });
  // Foto masjid: sampai 10, tiap foto otomatis diperkecil sampai maksimal 100 KB.
  const shots = []; // { blob, url }
  const pick = h('input', { class: 'in', id: 'rg-photos', type: 'file', multiple: 'multiple', accept: 'image/jpeg,image/png,image/webp', 'aria-label': 'Pilih foto masjid' });
  const pickMsg = h('p', { class: 'hint', id: 'rg-photos-msg' }, '');
  const strip = h('div', { class: 'rg-shots', id: 'rg-shots' });
  const emptyBox = h('div', { class: 'photo-empty', id: 'rg-photo-empty' }, 'Belum ada foto');
  const drawShots = () => {
    strip.replaceChildren(...shots.map((s, i) => h('div', { class: 'rg-shot' }, h('img', { src: s.url, alt: 'Foto ' + (i + 1) }),
      h('button', { type: 'button', class: 'rg-shot-x', 'aria-label': 'Hapus foto ' + (i + 1), onclick: () => { URL.revokeObjectURL(s.url); shots.splice(i, 1); drawShots(); } }, '×'))));
    pickMsg.className = 'hint';
    pickMsg.textContent = shots.length + ' dari ' + MAX_GALLERY + ' foto. Tiap foto otomatis diperkecil sampai maksimal 100 KB.';
    emptyBox.hidden = shots.length > 0;
    pick.disabled = shots.length >= MAX_GALLERY;
  };
  pick.addEventListener('change', async () => {
    const files = [...(pick.files || [])]; pick.value = '';
    if (!files.length) return;
    const room = MAX_GALLERY - shots.length; let bad = 0;
    pick.disabled = true; pickMsg.className = 'hint'; pickMsg.textContent = 'Memproses foto…';
    for (const f of files.slice(0, room)) {
      try { const r = await prepareProductPhoto(f); shots.push({ blob: r.blob, url: URL.createObjectURL(r.blob) }); } catch (e) { bad++; }
    }
    drawShots();
    const extra = files.length > room ? ' Hanya ' + MAX_GALLERY + ' foto yang diterima.' : '';
    if (bad || extra) { pickMsg.className = 'hint mk-err'; pickMsg.textContent = (bad ? bad + ' foto dilewati (format harus JPEG/PNG/WebP atau tidak bisa dibaca).' : '') + extra; }
  });
  drawShots();
  const addr = h('textarea', { class: 'in mt', id: 'rg-addr', placeholder: 'Alamat', maxlength: '300', 'aria-label': 'Alamat' });
  const agree = h('input', { type: 'checkbox', id: 'rg-agree' });
  const err = h('p', { class: 'mk-err', id: 'rg-err', role: 'alert' }, '');
  const btn = h('button', { class: 'btn-sm', type: 'submit', id: 'rg-submit' }, 'Daftarkan masjid');
  const form = h('form', { class: 'panel', novalidate: 'novalidate', id: 'rg-form', onsubmit: async ev => {
    ev.preventDefault(); err.textContent = '';
    const n = name.value.trim();
    if (n.length < 3) { err.textContent = 'Nama masjid minimal 3 huruf.'; return; }
    if (!agree.checked) { err.textContent = 'Centang persetujuan ketentuan dulu.'; return; }
    if (!maps.empty && !maps.ok) { err.textContent = 'Tautan lokasi harus dari Google Maps, atau kosongkan.'; return; }
    btn.disabled = true;
    try {
      const newId = await registerMosque({ name: n, province: chosen(prov2), city: chosen(city2), district: chosen(dist2), phone: phone.value.trim(), address: addr.value.trim(),
        mapsUrl: maps.ok ? maps.url : null, lat: maps.ok ? maps.lat : null, lng: maps.ok ? maps.lng : null });
      let note = '';
      if (shots.length && typeof newId === 'string') {
        try { const g = await saveGallery(newId, shots.map(s => s.blob)); if (g.failed) note = ' ' + g.failed + ' foto gagal diunggah.'; }
        catch (e) { note = ' Foto belum tersimpan.'; }
      }
      shots.forEach(s => URL.revokeObjectURL(s.url));
      toast('Masjid terkirim. Menunggu verifikasi Super Admin.' + note, !!note);
      await renderRegister(box, onBack, { currentId, onPick }); return;
    } catch (e) {
      if (e && e.status === 401) return;
      err.textContent = e && e.code === '22023' && e.message ? e.message.charAt(0).toUpperCase() + e.message.slice(1) + '.' : e && e.status === 0 ? 'Tidak ada koneksi internet.' : e && (e.status === 403 || e.code === '42501') ? 'Hanya Admin Masjid yang boleh mendaftarkan masjid.' : 'Belum terkirim. ' + hint(e);
    }
    btn.disabled = false;
  } }, h('h3', {}, 'Daftarkan masjid baru'), h('div', { class: 'grid2' }, name, prov, city, dist, phone), wnote, addr, mapsIn, mapsMsg,
    h('div', { class: 'rg-photobox', id: 'rg-photobox' }, h('h3', {}, 'Foto masjid'), emptyBox, strip, pickMsg, h('div', { class: 'mt' }, pick)),
    h('div', { class: 'rg-terms', id: 'rg-terms' }, h('b', {}, 'Ketentuan pendaftaran'), h('ul', {}, ...TERMS.map(t => h('li', {}, t)))),
    h('label', { class: 'dopt' }, agree, h('span', {}, 'Saya sudah membaca dan menyetujui ketentuan di atas.')),
    err, h('div', { class: 'mt' }, btn));
  const showPreview = id => renderMosquePreview(box, id, () => renderRegister(box, onBack, { currentId, onPick }));
  const rows = mine.map(m => h('div', { class: 'mrow', 'data-mosque': m.id },
    h('button', { class: 'minfo mrow-open', type: 'button', 'data-open': m.id, 'aria-label': 'Lihat detail ' + m.name, onclick: () => showPreview(m.id) },
      h('strong', {}, m.name), h('div', { class: 'muted' }, loc(m) || 'Lokasi belum diisi'), m.status_reason ? h('div', { class: 'muted' }, 'Alasan: ' + m.status_reason) : '', h('span', { class: 'rg-see' }, 'Lihat detail ›')),
    h('div', { class: 'macts' }, h('span', { class: 'badge b-' + m.status }, STATUS_LABEL[m.status] || m.status),
      m.status === 'active' && onPick && m.id !== currentId ? h('button', { class: 'btn-sm ghost', type: 'button', 'data-act': 'pick', onclick: () => onPick(m.id) }, 'Kelola masjid ini') : '',
      m.id === currentId ? h('span', { class: 'muted' }, 'Sedang dikelola') : '')));
  box.replaceChildren(h('div', { class: 'home', id: 'register-page' }, h('div', { class: 'home-body mp-body' },
    h('div', { class: 'mp-head' }, h('button', { class: 'btn-sm ghost', id: 'rg-back', type: 'button', onclick: onBack }, '← Kembali'), h('h2', {}, 'Masjid Saya')),
    h('div', { class: 'panel' }, h('h3', {}, 'Masjid yang Anda kelola (' + mine.length + ')'), rows.length ? rows : h('p', { class: 'muted' }, 'Belum ada. Daftarkan masjid Anda di bawah; Super Admin akan memverifikasinya.')),
    form)));
  window.scrollTo(0, 0);
}

// Admin Masjid yang belum punya masjid terverifikasi: beranda sederhana + daftar masjidnya (menunggu/ditolak) + pendaftaran.
export async function renderAdminHome(box) {
  const me = getSession() && getSession().user;
  let mine = [];
  try { mine = me ? await myAdminMosques(me.id) : []; } catch (e) { if (e && e.status === 401) return; mine = []; }
  const who = await whoAmI();
  const home = () => renderAdminHome(box);
  const openReg = () => renderRegister(box, home, { onPick: id => renderMosque(box, id, 'home') });
  const need = () => toast('Fitur ini aktif setelah masjid Anda diverifikasi Super Admin.', true);
  registerActs({ kas: need, posts: need, team: need });
  const waiting = mine.filter(m => m.status === 'pending' || m.status === 'draft').length;
  const B = {
    banner: bannerCarousel([{ art: 'banner_masjid', title: mine.length ? 'Masjid Anda sedang diperiksa' : 'Daftarkan Masjid Anda', text: mine.length ? (waiting ? waiting + ' masjid menunggu verifikasi Super Admin.' : 'Periksa status masjid Anda.') : 'Anda sudah menjadi Admin Masjid. Daftarkan masjid Anda untuk mulai mengelola.', cta: mine.length ? 'Lihat Masjid Saya' : 'Daftarkan Masjid', onclick: openReg }]),
    buku: promoBanner({ id: 'pk', art: 'promo_buku', title: 'Pustaka Buku', text: 'Koleksi buku Islami digital untuk menambah ilmu.', cta: 'Jelajahi Buku', onclick: () => go('buku') }),
    pasar: promoBanner({ id: 'pb', art: 'promo_pasar', title: 'Pasar Umat', text: 'Produk dan jasa umat yang sudah diperiksa.', cta: 'Lihat Produk', onclick: () => go('market') }),
    tasbih: tasbihCard(), jadwal: prayerCard(), artikel: await articleSection(5) || '',
    daftar: h('section', { class: 'panel', id: 'reg-card' }, h('h3', {}, 'Masjid Saya'),
      mine.length ? h('div', {}, ...mine.map(m => h('div', { class: 'mrow' }, h('div', { class: 'minfo' }, h('strong', {}, m.name), h('div', { class: 'muted' }, loc(m) || 'Lokasi belum diisi')), h('span', { class: 'badge b-' + m.status }, STATUS_LABEL[m.status] || m.status))))
        : h('p', { class: 'muted' }, 'Belum ada masjid. Daftarkan masjid Anda; Super Admin akan memverifikasinya.'),
      h('button', { class: 'btn-sm mt', id: 'open-register', type: 'button', onclick: openReg }, 'Daftarkan Masjid')) };
  const body = await homeBody('admin', B);
  box.replaceChildren(h('div', { class: 'home', id: 'home-admin' },
    greetingHeader({ title: who.name || 'Admin Masjid', sub: 'Mari perkuat iman, manfaatkan fitur BAITUNA untuk kehidupan Islami yang lebih baik.', place: { name: 'Admin Masjid', sub: mine.length ? (waiting ? 'Masjid menunggu verifikasi' : 'Belum ada masjid aktif') : 'Belum ada masjid terdaftar', onclick: openReg }, name: who.name, email: who.email, avatar: who.avatar || undefined }),
    h('div', { class: 'home-body' }, ...body)));
  window.scrollTo(0, 0);
}

export async function renderMosque(box, mosqueId, view = 'home') {
  const [mosque, team, allInvites, officers] = await Promise.all([getMosque(mosqueId), fetchTeam(mosqueId), listInvitations(), listOfficers(mosqueId)]);
  if (!mosque) { box.replaceChildren(h('p', { class: 'muted' }, 'Masjid tidak ditemukan.')); return; }
  const me = getSession() && getSession().user;
  rememberMosque(mosqueId);
  const refresh = () => renderMosque(box, mosqueId, view);
  const goHome = () => renderMosque(box, mosqueId, 'home');
  const goEdit = () => renderMosque(box, mosqueId, 'edit');
  const goList = () => renderMosque(box, mosqueId, 'list');
  if (view === 'list') { await renderMyMosques(box, { currentId: mosqueId, onBack: goHome, onEdit: goEdit, onPick: id => renderMosque(box, id, 'home'), onRegister: () => renderMosque(box, mosqueId, 'register') }); return; }
  if (view === 'audit') { await renderAuditLog(box, { onBack: goHome, mosque: { id: mosque.id, name: mosque.name } }); return; }
  if (view === 'kas') { await renderKasManager(box, mosque, { onBack: goHome, roles: { write: true, setup: true, approve: true } }); return; }
  if (view === 'posts') { await renderPostsManager(box, mosque, goHome); return; }
  if (view === 'register') { await renderRegister(box, goHome, { currentId: mosqueId, onPick: id => renderMosque(box, id, 'home') }); return; }

  const field = (ph, val, max) => h('input', { class: 'in', placeholder: ph, maxlength: String(max), autocomplete: 'off', value: val == null ? '' : String(val) });
  const name = field('Nama masjid *', mosque.name, 150), city = field('Kota/Kabupaten', mosque.city, 80),
        prov = field('Provinsi', mosque.province, 80), phone = field('No.HP/Telepon', mosque.contact_phone, 30);
  const addr = h('textarea', { class: 'in mt', placeholder: 'Alamat', maxlength: '300' }, mosque.address || '');
  const desc = h('textarea', { class: 'in mt', placeholder: 'Tentang masjid (sejarah, kegiatan, dll.)', maxlength: '1000' }, mosque.description || '');
  const fac = field('Fasilitas, pisahkan dengan koma (mis. Parkir, Toilet, Ruang wudhu)', mosque.facilities, 300);
  const tz = h('select', { class: 'in', 'aria-label': 'Zona waktu' },
    [['Asia/Jakarta', 'WIB (Waktu Indonesia Barat)'], ['Asia/Makassar', 'WITA (Waktu Indonesia Tengah)'], ['Asia/Jayapura', 'WIT (Waktu Indonesia Timur)']]
      .map(([v, l]) => h('option', { value: v }, l)));
  tz.value = mosque.timezone || 'Asia/Jakarta';
  const mapsIn = field('Tautan lokasi Google Maps (opsional)', mosque.maps_url, 500); mapsIn.type = 'url'; mapsIn.id = 'ed-maps'; mapsIn.setAttribute('inputmode', 'url');
  const mapsMsg = h('p', { class: 'hint', id: 'ed-maps-msg' }, mosque.maps_url ? 'Tautan lokasi tersimpan. Tempel tautan baru untuk menggantinya, atau kosongkan untuk menghapus.' : MAPS_HELP);
  mapsIn.addEventListener('input', () => { const mp = parseMapsUrl(mapsIn.value); mapsMsg.className = 'hint' + (mp.ok || mp.empty ? '' : ' mk-err'); mapsMsg.textContent = mapsText(mp); });
  // Koordinat: dipakai untuk JADWAL SALAT masjid. Tautan pendek Google Maps (maps.app.goo.gl) tidak memuat koordinat yang bisa dibaca.
  const hasC = mosque.latitude != null && mosque.longitude != null;
  const initC = hasC ? mosque.latitude + ', ' + mosque.longitude : '';
  const coordIn = field('Koordinat masjid untuk jadwal salat (lintang, bujur)', initC, 40); coordIn.id = 'ed-coord'; coordIn.setAttribute('inputmode', 'text'); coordIn.placeholder = 'mis. -7.8123, 110.3456';
  const coordMsg = h('p', { class: 'hint', id: 'ed-coord-msg' }, hasC ? 'Koordinat tersimpan. Jadwal salat masjid sudah bisa dihitung.' : 'Belum diisi, jadi jadwal salat masjid belum tampil. Isi dengan tombol di bawah, atau tempel koordinat dari Google Maps (tekan lama pada titik masjid, lalu salin angkanya).');
  coordIn.addEventListener('input', () => { const c = parseCoords(coordIn.value); coordMsg.className = 'hint' + (c.ok || c.empty ? '' : ' mk-err'); coordMsg.textContent = c.ok ? 'Koordinat terbaca: ' + c.lat + ', ' + c.lng + '.' : c.empty ? 'Kosong: jadwal salat tidak ditampilkan.' : 'Format belum benar. Contoh: -7.8123, 110.3456'; });
  const gpsBtn = h('button', { class: 'btn-sm ghost', type: 'button', id: 'ed-gps', onclick: () => {
    if (!navigator.geolocation) { toast('Perangkat ini tidak mendukung lokasi.', true); return; }
    gpsBtn.disabled = true; coordMsg.textContent = 'Mengambil lokasi…';
    navigator.geolocation.getCurrentPosition(p => { gpsBtn.disabled = false; coordIn.value = p.coords.latitude.toFixed(5) + ', ' + p.coords.longitude.toFixed(5); coordIn.dispatchEvent(new Event('input')); toast('Lokasi terisi. Ketuk "Simpan profil".'); },
      () => { gpsBtn.disabled = false; toast('Lokasi tidak bisa diambil. Izinkan lokasi di peramban, atau ketik koordinatnya.', true); }, { enableHighAccuracy: true, timeout: 15000 });
  } }, 'Isi dari lokasi HP ini (saat di masjid)');
  const btn = h('button', { class: 'btn-sm', type: 'submit' }, 'Simpan profil');
  const form = h('form', {
    class: 'panel', novalidate: 'novalidate',
    onsubmit: async ev => {
      ev.preventDefault();
      const n = name.value.trim();
      if (n.length < 3) { toast('Nama masjid minimal 3 karakter.', true); return; }
      const mp = parseMapsUrl(mapsIn.value);
      if (!mp.empty && !mp.ok) { toast('Tautan lokasi harus dari Google Maps, atau kosongkan.', true); return; }
      const newUrl = mp.ok ? mp.url : null;
      const geo = newUrl !== (mosque.maps_url || null) ? { maps_url: newUrl, ...(mp.ok && mp.lat != null ? { latitude: mp.lat, longitude: mp.lng } : {}) } : {};
      const cd = parseCoords(coordIn.value);
      if (!cd.empty && !cd.ok) { toast('Format koordinat belum benar. Contoh: -7.8123, 110.3456', true); return; }
      const coordChanged = coordIn.value.trim() !== initC;
      const coords = coordChanged ? (cd.ok ? { latitude: cd.lat, longitude: cd.lng } : { latitude: null, longitude: null }) : null;
      btn.disabled = true;
      try {
        await updateMosqueProfile(mosqueId, { coords,
          name: n, city: city.value.trim() || null, province: prov.value.trim() || null,
          contact_phone: phone.value.trim() || null, address: addr.value.trim() || null,
          description: desc.value.trim() || null, facilities: fac.value.trim() || null, timezone: tz.value, ...geo
        });
        toast('Profil masjid disimpan.');
        await goHome();
      } catch (e) {
        if (e.status !== 401) toast('Profil belum tersimpan. ' + hint(e), true);
      }
      btn.disabled = false;
    }
  }, h('h3', {}, 'Profil masjid'), h('div', { class: 'grid2' }, name, city, prov, phone), addr, desc, fac,
    mapsIn, mapsMsg, coordIn, coordMsg, h('div', { class: 'mt' }, gpsBtn),
    h('p', { class: 'hint' }, 'Zona waktu dipakai untuk menghitung jadwal salat masjid ini.'), tz, h('div', { class: 'mt' }, btn));

  // ----- Foto masjid (galeri: maksimal 10 foto, tiap foto otomatis <= 100 KB) -----
  const gal = Array.isArray(mosque.photos) ? mosque.photos.slice() : [];
  const gMsg = h('p', { class: 'hint', id: 'gal-msg' }, gal.length + ' dari ' + MAX_GALLERY + ' foto. Tiap foto otomatis diperkecil sampai maksimal 100 KB (JPEG, PNG, atau WebP).');
  const gPick = h('input', { class: 'in', id: 'gal-pick', type: 'file', multiple: 'multiple', accept: 'image/jpeg,image/png,image/webp', 'aria-label': 'Tambah foto masjid' });
  const gGrid = h('div', { class: 'rg-shots', id: 'gal-grid' });
  const lockG = on => { gPick.disabled = on || gal.length >= MAX_GALLERY; gGrid.querySelectorAll('button').forEach(b => { b.disabled = on; }); };
  const tile = (src, label, onDel) => h('div', { class: 'rg-shot' }, h('img', { src, alt: label, loading: 'lazy' }),
    h('button', { type: 'button', class: 'rg-shot-x', 'aria-label': 'Hapus ' + label, onclick: onDel }, '×'));
  const delPhoto = (label, run) => async () => {
    if (!(await ask({ title: 'Hapus foto?', text: 'Foto tidak akan tampil lagi di profil masjid.', reason: false }))) return;
    lockG(true);
    try { await run(); toast('Foto dihapus.'); await refresh(); return; }
    catch (e) { if (e && e.status === 401) return; toast('Foto belum terhapus. ' + hint(e), true); }
    lockG(false);
  };
  if (mosque.photo_path) gGrid.append(tile(publicPhotoUrl(mosque.photo_path), 'foto lama', delPhoto('foto lama', async () => { await setMosquePhoto(mosqueId, null); storageRemove(mosque.photo_path).catch(() => {}); })));
  gal.forEach((p, i) => gGrid.append(tile(publicPhotoUrl(p, GALLERY_BUCKET), 'foto ' + (i + 1), delPhoto('foto ' + (i + 1), async () => { await setGallery(mosqueId, gal.filter(x => x !== p)); storageRemove(p, GALLERY_BUCKET).catch(() => {}); }))));
  gPick.disabled = gal.length >= MAX_GALLERY;
  if (gal.length >= MAX_GALLERY) gMsg.textContent = 'Sudah ' + MAX_GALLERY + ' foto (batas maksimal). Hapus satu foto untuk menambah yang baru.';
  gPick.addEventListener('change', async () => {
    const files = [...(gPick.files || [])]; gPick.value = '';
    if (!files.length) return;
    const room = MAX_GALLERY - gal.length; let bad = 0; const blobs = [];
    lockG(true); gMsg.className = 'hint'; gMsg.textContent = 'Memproses foto…';
    for (const f of files.slice(0, room)) { try { blobs.push((await prepareProductPhoto(f)).blob); } catch (e) { bad++; } }
    if (!blobs.length) { gMsg.className = 'hint mk-err'; gMsg.textContent = 'Tidak ada foto yang bisa dipakai (harus JPEG, PNG, atau WebP).'; lockG(false); return; }
    try {
      gMsg.textContent = 'Mengunggah…';
      const g = await saveGallery(mosqueId, blobs, gal);
      const notes = (g.failed ? ' ' + g.failed + ' foto gagal diunggah.' : '') + (bad ? ' ' + bad + ' foto dilewati.' : '') + (files.length > room ? ' Hanya ' + room + ' foto yang muat.' : '');
      toast(g.saved ? g.saved + ' foto ditambahkan.' + notes : 'Foto belum tersimpan.' + notes, !g.saved || !!g.failed);
      await refresh(); return;
    } catch (e) { if (e && e.status === 401) return; toast('Foto belum tersimpan. ' + hint(e), true); }
    lockG(false);
  });
  const photoPanel = h('div', { class: 'panel', id: 'gal-panel' }, h('h3', {}, 'Foto masjid'),
    gGrid.children.length ? '' : h('div', { class: 'photo-empty' }, 'Belum ada foto'),
    gGrid, gMsg, h('div', { class: 'mt' }, gPick));

  const teamBox = h('div', { class: 'panel' }, teamPanel({
    mosqueId, team, officers, invites: allInvites.filter(i => i.mosque_id === mosqueId),
    roles: ROLES_FOR_ADMIN_MASJID, canRevokeAdmin: false, selfId: me && me.id, onChange: refresh
  }));

  if (view === 'team') {
    // Pilihan masjid: semua masjid aktif milik Admin Masjid ini (bertambah saat mendaftarkan masjid baru).
    let mine = [];
    try { mine = me ? await myAdminMosques(me.id) : []; } catch (e) { if (e && e.status === 401) return; mine = []; }
    mine = mine.filter(m => m.status === 'active');
    if (!mine.some(m => m.id === mosqueId)) mine.unshift({ id: mosqueId, name: mosque.name, city: mosque.city });
    const pick = h('select', { class: 'in', id: 'team-mosque', 'aria-label': 'Pilih masjid' }, ...mine.map(m => h('option', { value: m.id }, m.name + (m.city ? ' · ' + m.city : ''))));
    pick.value = mosqueId;
    pick.addEventListener('change', () => renderMosque(box, pick.value, 'team'));
    box.replaceChildren(
      h('button', { class: 'btn-sm ghost', type: 'button', id: 'team-back', onclick: goHome }, '← Kembali ke dashboard'),
      h('div', { id: 'team-anchor', class: 'tm mt' }, h('h2', { class: 'tm-h' }, 'Pengurus Masjid'),
        h('label', { class: 'hint', for: 'team-mosque' }, 'Pilih masjid yang pengurusnya ingin dikelola'), pick, teamBox));
    window.scrollTo(0, 0);
    return;
  }

  if (view === 'edit') {
    box.replaceChildren(
      h('button', { class: 'btn-sm ghost', type: 'button', onclick: goHome }, '← Kembali ke dashboard'),
      h('h2', { class: 'mt' }, 'Edit profil masjid'),
      h('p', { class: 'muted' }, mosque.name),
      photoPanel,
      form);
    window.scrollTo(0, 0);
    return;
  }

  // Data beranda: agenda & pengumuman (bila fitur agenda belum aktif, bagian ini dilewati begitu saja)
  const ztz = mosque.timezone || 'Asia/Jakarta', now = Date.now();
  let posts = null;
  try { posts = await listManagedPosts(mosqueId); } catch (e) { if (e && e.status === 401) return; }
  const live = posts ? posts.filter(p => p.status === 'published') : [];
  const upcoming = live.filter(p => p.kind === 'agenda' && p.starts_at && isUpcoming(p, now, ztz)).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const infos = live.filter(p => p.kind === 'pengumuman').sort((a, b) => Date.parse(b.published_at || b.created_at) - Date.parse(a.published_at || a.created_at));
  // Ringkasan kas bulan ini (bila buku kas belum aktif, kartu dilewati)
  let rep = null;
  try { rep = await K.report(mosqueId, K.monthKey()); } catch (e) { if (e && e.status === 401) return; rep = null; }
  const who = await whoAmI();
  let acts = [];
  try { acts = (await listAudit({ mosque: mosque.id, limit: 3 })) || []; } catch (e) { if (e && e.status === 401) return; acts = null; }
  const teamTop = h('div', { id: 'team-anchor', class: 'tm' }, h('h2', { class: 'tm-h' }, 'Pengurus ' + mosque.name), teamBox);
  const toTeam = () => renderMosque(box, mosqueId, 'team');
  const toKas = () => renderMosque(box, mosqueId, 'kas'), toPosts = () => renderMosque(box, mosqueId, 'posts');
  registerActs({ kas: toKas, posts: toPosts, team: toTeam });
  const nextAg = upcoming[0] || null, lastInfo = infos[0] || null;
  const B = {
    banner: bannerCarousel([
      { art: 'banner_masjid', title: mosque.name + ' Bersama BAITUNA', text: 'Kelola masjid lebih mudah dan profesional.', cta: 'Kelola Masjid', onclick: goList },
      { art: 'banner_kas', title: 'Catat Kas dengan Rapi', text: 'Buku kas tidak bisa diubah diam-diam; koreksi tercatat sebagai baris baru.', cta: 'Buka Kas', onclick: toKas, tone: 'gold' }]),
    buku: promoBanner({ id: 'pk', art: 'promo_buku', title: 'Pustaka Buku', text: 'Koleksi buku Islami digital untuk menambah ilmu.', cta: 'Jelajahi Buku', onclick: () => go('buku') }),
    pasar: promoBanner({ id: 'pb', art: 'promo_pasar', title: 'Pasar Umat', text: 'Produk dan jasa umat yang sudah diperiksa.', cta: 'Lihat Produk', onclick: () => go('market') }),
    tasbih: tasbihCard(),
    jadwal: prayerCard(),
    artikel: await articleSection(5) || '',
    ops: posts ? summaryCard({ id: 'ops', title: 'Ringkasan Operasional', onAll: toPosts, allLabel: 'Lihat Detail', items: [
        { ic: ICONS.user, value: officers ? officers.length : team.length, label: 'Pengurus' },
        { ic: ICONS.agenda, value: upcoming.length, label: 'Agenda Mendatang' },
        { ic: ICONS.horn, value: infos.length, label: 'Pengumuman Aktif' },
        { ic: ICONS.news, value: allInvites.filter(i => i.mosque_id === mosqueId && i.status === 'pending').length, label: 'Akses Menunggu' }] }) : '',
    fin: rep ? summaryCard({ id: 'fin', title: 'Ringkasan Keuangan Masjid', sub: K.monthLabel(rep.month || K.monthKey()), onAll: toKas, allLabel: 'Lihat Laporan', hint: (!Number(rep.masuk) && !Number(rep.keluar) && !Number(rep.saldo_akhir)) ? 'Belum ada catatan kas bulan ini.' : '', actions: [{ id: 'fin-catat', label: 'Catat Kas', gold: true, onclick: toKas }, { id: 'fin-lapor', label: 'Lihat Laporan', onclick: toKas }], items: [
        { ic: ICONS.zakat, value: K.money(rep.masuk), label: 'Kas Masuk', tone: 'tin' },
        { ic: ICONS.zakat, value: K.money(rep.keluar), label: 'Kas Keluar', tone: 'tout' },
        { ic: ICONS.zakat, value: K.money(rep.saldo_akhir), label: 'Saldo Kas' }] }) : '',
    agenda: posts ? agendaCard({ post: nextAg, parts: nextAg ? dateParts(nextAg.starts_at, ztz) : null, times: nextAg ? fmtTimes(nextAg.starts_at, nextAg.ends_at, ztz) : '', onAll: toPosts, img: mosqueCover(mosque), chip: mosque && mosque.name }) : '',
    info: posts ? announceCard({ post: lastInfo, when: lastInfo ? fmtWhen(lastInfo.published_at || lastInfo.created_at, ztz) : '', onAll: toPosts, onOpen: toPosts, onCreate: toPosts }) : '',
    akses: quickGrid('Akses Cepat', [
        { key: 'open-pengurus', id: 'qa-pengurus', onclick: toTeam },
        { key: 'open-keuangan', id: 'open-kas', onclick: toKas },
        { key: 'open-agenda', id: 'open-posts', label: 'Agenda', onclick: toPosts },
        { key: 'open-pengumuman', id: 'open-info', onclick: toPosts },
        { key: 'open-profilmasjid', id: 'open-edit', onclick: goList },
        { key: 'open-audit', id: 'open-audit', onclick: () => renderMosque(box, mosqueId, 'audit') },
        { key: 'open-market', id: 'qa-market', onclick: () => go('market') },
        { key: 'open-more', id: 'qa-more', onclick: () => go('more') }], { ic: BOLT }),
    aktivitas: acts === null ? '' : activityList(acts, actionLabel, () => renderMosque(box, mosqueId, 'audit')),
    daftar: h('section', { class: 'panel', id: 'reg-card' }, h('h3', {}, 'Daftarkan Masjid Baru'),
        h('p', { class: 'muted' }, 'Mengurus masjid lain? Lihat masjid Anda atau daftarkan yang baru di sini. Masjid tampil di direktori setelah diverifikasi Super Admin.'),
        h('button', { class: 'btn-sm', id: 'open-register', type: 'button', onclick: () => renderMosque(box, mosqueId, 'register') }, 'Daftarkan Masjid')),
    tim: teamTop };
  const body = await homeBody('admin', B);
  box.replaceChildren(h('div', { class: 'home', id: 'home-admin' },
    greetingHeader({ title: who.name || mosque.name, sub: 'Mari perkuat iman, manfaatkan fitur BAITUNA untuk kehidupan Islami yang lebih baik.', place: { name: mosque.name, sub: loc(mosque) || 'Lokasi belum diisi', onclick: () => renderMosque(box, mosqueId, 'register') }, name: who.name, email: who.email, avatar: who.avatar || mosqueCover(mosque) || undefined }),
    h('div', { class: 'home-body' }, ...body)));
  window.scrollTo(0, 0);
}
