// BAITUNA - dashboard-mosque.js
// Dashboard Admin Masjid: profil masjid, tim pengurus, dan undangan.
import { getPosition } from './nearby-service.js';
import { h, toast, hint, ask } from './ui.js';
import { getMosque, updateMosqueProfile, fetchTeam, listInvitations, setMosquePhoto } from './mosque-service.js';
import { prepareImage, newPhotoPath, PHOTO_ERRORS, MAX_BYTES } from './photo.js';
import { storageUpload, storageRemove, publicPhotoUrl } from './supabase.js';
import { teamPanel } from './team-panel.js';
import { renderPostsManager } from './posts-ui.js';
import { listManagedPosts } from './post-service.js';
import { icon, ICONS } from './feed-ui.js';
import { getSession } from './supabase.js';
import { renderKasManager } from './kas-ui.js';
import { renderAuditLog } from './audit-ui.js';
import { list as listAudit, actionLabel } from './audit-service.js';
import { greetingHeader, bannerCarousel, promoBanner, prayerCard, quickGrid, summaryCard, agendaCard, announceCard, activityList, whoAmI, go, registerActs, scrollToEl, BOLT } from './home-ui.js';
import * as K from './kas-service.js';
import { isUpcoming, dateParts, fmtTimes, fmtWhen } from './post-time.js';

const ROLES_FOR_ADMIN_MASJID = ['ketua_takmir', 'bendahara', 'pengurus_bagian', 'pengelola_usaha'];

export async function renderMosque(box, mosqueId, view = 'home') {
  const [mosque, team, allInvites] = await Promise.all([getMosque(mosqueId), fetchTeam(mosqueId), listInvitations()]);
  if (!mosque) { box.replaceChildren(h('p', { class: 'muted' }, 'Masjid tidak ditemukan.')); return; }
  const me = getSession() && getSession().user;
  const refresh = () => renderMosque(box, mosqueId, view);
  const goHome = () => renderMosque(box, mosqueId, 'home');
  const goEdit = () => renderMosque(box, mosqueId, 'edit');
  if (view === 'audit') { await renderAuditLog(box, { onBack: goHome, mosque: { id: mosque.id, name: mosque.name } }); return; }
  if (view === 'kas') { await renderKasManager(box, mosque, { onBack: goHome, roles: { setup: true, approve: true } }); return; }
  if (view === 'posts') { await renderPostsManager(box, mosque, goHome); return; }

  const field = (ph, val, max) => h('input', { class: 'in', placeholder: ph, maxlength: String(max), autocomplete: 'off', value: val == null ? '' : String(val) });
  const name = field('Nama masjid *', mosque.name, 150), city = field('Kota/Kabupaten', mosque.city, 80),
        prov = field('Provinsi', mosque.province, 80), phone = field('Telepon resmi', mosque.contact_phone, 30);
  const addr = h('textarea', { class: 'in mt', placeholder: 'Alamat', maxlength: '300' }, mosque.address || '');
  const desc = h('textarea', { class: 'in mt', placeholder: 'Tentang masjid (sejarah, kegiatan, dll.)', maxlength: '1000' }, mosque.description || '');
  const fac = field('Fasilitas, pisahkan dengan koma (mis. Parkir, Toilet, Ruang wudhu)', mosque.facilities, 300);
  const tz = h('select', { class: 'in', 'aria-label': 'Zona waktu' },
    [['Asia/Jakarta', 'WIB (Waktu Indonesia Barat)'], ['Asia/Makassar', 'WITA (Waktu Indonesia Tengah)'], ['Asia/Jayapura', 'WIT (Waktu Indonesia Timur)']]
      .map(([v, l]) => h('option', { value: v }, l)));
  tz.value = mosque.timezone || 'Asia/Jakarta';
  const lat = field('Lintang (mis. -6.914744)', mosque.latitude, 12), lng = field('Bujur (mis. 107.609810)', mosque.longitude, 12);
  const geoMsg = h('p', { class: 'hint' }, '');
  const geoBtn = h('button', { class: 'btn-sm ghost', type: 'button', onclick: async () => {
    geoBtn.disabled = true; geoMsg.textContent = 'Mencari lokasi perangkat…';
    try {
      const p = await getPosition();
      lat.value = p.lat.toFixed(6); lng.value = p.lng.toFixed(6);
      geoMsg.textContent = 'Terisi dari lokasi perangkat' + (p.acc ? ' (akurasi sekitar ' + Math.round(p.acc) + ' m)' : '') + '. Pastikan Anda sedang berada di masjid, lalu tekan Simpan profil.';
    } catch (e) {
      geoMsg.textContent = e && e.code === 'denied' ? 'Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini, lalu coba lagi.' : 'Lokasi perangkat belum tersedia. Isi lintang dan bujur secara manual.';
    }
    geoBtn.disabled = false;
  } }, 'Isi dari lokasi perangkat ini');
  const btn = h('button', { class: 'btn-sm', type: 'submit' }, 'Simpan profil');
  const form = h('form', {
    class: 'panel', novalidate: 'novalidate',
    onsubmit: async ev => {
      ev.preventDefault();
      const n = name.value.trim();
      if (n.length < 3) { toast('Nama masjid minimal 3 karakter.', true); return; }
      const num = el => el.value.trim() === '' ? null : Number(el.value.trim().replace(',', '.'));
      const la = num(lat), lo = num(lng);
      if ((la === null) !== (lo === null)) { toast('Isi lintang DAN bujur, atau kosongkan keduanya.', true); return; }
      if (la !== null && (!isFinite(la) || !isFinite(lo) || la < -12 || la > 7 || lo < 94 || lo > 142)) {
        toast('Koordinat tidak valid untuk wilayah Indonesia. Periksa lintang dan bujur.', true); return;
      }
      btn.disabled = true;
      try {
        await updateMosqueProfile(mosqueId, {
          name: n, city: city.value.trim() || null, province: prov.value.trim() || null,
          contact_phone: phone.value.trim() || null, address: addr.value.trim() || null,
          description: desc.value.trim() || null, facilities: fac.value.trim() || null, latitude: la, longitude: lo, timezone: tz.value
        });
        toast('Profil masjid disimpan.');
        await goHome();
      } catch (e) {
        if (e.status !== 401) toast('Profil belum tersimpan. ' + hint(e), true);
      }
      btn.disabled = false;
    }
  }, h('h3', {}, 'Profil masjid'), h('div', { class: 'grid2' }, name, city, prov, phone), addr, desc, fac,
    h('p', { class: 'hint' }, 'Koordinat: buka Google Maps, tekan lama pada lokasi masjid, lalu salin dua angkanya (lintang lalu bujur). Boleh dikosongkan.'),
    h('div', { class: 'grid2' }, lat, lng),
    h('div', { class: 'mt' }, geoBtn), geoMsg,
    h('p', { class: 'hint' }, 'Zona waktu dipakai untuk menghitung jadwal salat masjid ini.'), tz, h('div', { class: 'mt' }, btn));

  // ----- Foto masjid (1 foto, maksimal 2 MB) -----
  const url = publicPhotoUrl(mosque.photo_path);
  const status = h('p', { class: 'hint' }, '1 foto, maksimal 2 MB (JPEG, PNG, atau WebP). Foto yang lebih besar otomatis diperkecil.');
  const pick = h('input', { class: 'in', type: 'file', accept: 'image/jpeg,image/png,image/webp', 'aria-label': 'Pilih foto masjid' });
  const del = mosque.photo_path ? h('button', { class: 'btn-sm alt', type: 'button' }, 'Hapus foto') : '';
  const lock = on => { pick.disabled = on; if (del) del.disabled = on; };
  pick.addEventListener('change', async () => {
    const file = pick.files && pick.files[0]; if (!file) return;
    lock(true); status.textContent = 'Memproses foto…';
    let uploaded = null;
    try {
      const img = await prepareImage(file);
      status.textContent = 'Mengunggah…';
      uploaded = newPhotoPath(mosqueId);
      await storageUpload(uploaded, img.blob);
      await setMosquePhoto(mosqueId, uploaded);
      if (mosque.photo_path) storageRemove(mosque.photo_path).catch(() => {}); // foto lama dibersihkan (jika gagal, tidak mengganggu)
      toast('Foto masjid disimpan.');
      await refresh(); return;
    } catch (e) {
      if (uploaded) storageRemove(uploaded).catch(() => {}); // unggahan yatim dibersihkan bila penyimpanan lokasi gagal
      if (e && e.status === 401) return;
      const msg = e && PHOTO_ERRORS[e.code] ? PHOTO_ERRORS[e.code]
        : e && e.status === 0 ? 'Tidak ada koneksi internet.'
        : e && (e.status === 413) ? 'Foto lebih dari 2 MB.'
        : 'Foto belum tersimpan. ' + hint(e);
      status.textContent = msg; toast(msg, true);
    }
    pick.value = ''; lock(false);
  });
  if (del) del.addEventListener('click', async () => {
    if (!(await ask({ title: 'Hapus foto masjid?', text: 'Foto tidak akan tampil lagi di direktori.', reason: false }))) return;
    lock(true);
    try {
      await setMosquePhoto(mosqueId, null);
      storageRemove(mosque.photo_path).catch(() => {});
      toast('Foto dihapus.'); await refresh(); return;
    } catch (e) { if (e.status !== 401) toast('Foto belum terhapus. ' + hint(e), true); }
    lock(false);
  });
  const photoPanel = h('div', { class: 'panel' }, h('h3', {}, 'Foto masjid'),
    url ? h('img', { class: 'photo-prev', src: url, alt: 'Foto ' + mosque.name }) : h('div', { class: 'photo-empty' }, 'Belum ada foto'),
    status, h('div', { class: 'mt' }, pick), del);

  const teamBox = h('div', { class: 'panel' }, teamPanel({
    mosqueId, team, invites: allInvites.filter(i => i.mosque_id === mosqueId),
    roles: ROLES_FOR_ADMIN_MASJID, canRevokeAdmin: false, selfId: me && me.id, onChange: refresh
  }));

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
  const teamTop = h('div', { id: 'team-anchor', class: 'tm' }, h('h2', { class: 'tm-h' }, 'Pengurus Masjid'), teamBox);
  const toTeam = () => scrollToEl(teamTop);
  const toKas = () => renderMosque(box, mosqueId, 'kas'), toPosts = () => renderMosque(box, mosqueId, 'posts');
  registerActs({ kas: toKas, posts: toPosts, team: toTeam });
  const nextAg = upcoming[0] || null, lastInfo = infos[0] || null;
  box.replaceChildren(h('div', { class: 'home', id: 'home-admin' },
    greetingHeader({ title: who.name || 'Admin Masjid', sub: 'Admin ' + mosque.name, name: who.name, email: who.email, avatar: url || undefined }),
    h('div', { class: 'home-body' },
      bannerCarousel([
        { art: 'banner_masjid', title: mosque.name + ' Bersama BAITUNA', text: 'Mengelola masjid lebih mudah, lebih profesional, dan lebih berdampak.', cta: 'Kelola Masjid', onclick: goEdit },
        { art: 'banner_kas', title: 'Catat Kas dengan Rapi', text: 'Buku kas tidak bisa diubah diam-diam; koreksi tercatat sebagai baris baru.', cta: 'Buka Kas', onclick: toKas, tone: 'gold' }]),
      promoBanner({ id: 'pk', art: 'promo_buku', title: 'Pustaka Buku', text: 'Koleksi buku Islami digital untuk menambah ilmu dan wawasan.', cta: 'Jelajahi Buku', onclick: () => go('buku') }),
      promoBanner({ id: 'pb', art: 'promo_pasar', title: 'Pasar Umat', text: 'Dukung produk dan jasa umat yang sudah diperiksa pengelola.', cta: 'Lihat Produk', onclick: () => go('market') }),
      prayerCard(),
      posts ? summaryCard({ id: 'ops', title: 'Ringkasan Operasional Masjid', onAll: toPosts, allLabel: 'Lihat Detail', items: [
        { ic: ICONS.user, value: team.length, label: 'Pengurus' },
        { ic: ICONS.agenda, value: upcoming.length, label: 'Kegiatan Mendatang' },
        { ic: ICONS.horn, value: infos.length, label: 'Pengumuman Aktif' }] }) : '',
      rep ? summaryCard({ id: 'fin', title: 'Ringkasan Keuangan Masjid', sub: K.monthLabel(rep.month || K.monthKey()), onAll: toKas, allLabel: 'Lihat Laporan', items: [
        { ic: ICONS.zakat, value: K.money(rep.masuk), label: 'Kas Masuk', tone: 'tin' },
        { ic: ICONS.zakat, value: K.money(rep.keluar), label: 'Kas Keluar', tone: 'tout' },
        { ic: ICONS.zakat, value: K.money(rep.saldo_akhir), label: 'Saldo Kas' }] }) : '',
      posts ? agendaCard({ post: nextAg, parts: nextAg ? dateParts(nextAg.starts_at, ztz) : null, times: nextAg ? fmtTimes(nextAg.starts_at, nextAg.ends_at, ztz) : '', onAll: toPosts }) : '',
      posts ? announceCard({ post: lastInfo, when: lastInfo ? fmtWhen(lastInfo.published_at || lastInfo.created_at, ztz) : '', onAll: toPosts, onOpen: toPosts }) : '',
      quickGrid('Akses Cepat', [
        { key: 'open-pengurus', id: 'qa-pengurus', onclick: toTeam },
        { key: 'open-keuangan', id: 'open-kas', onclick: toKas },
        { key: 'open-agenda', id: 'open-posts', label: 'Agenda', onclick: toPosts },
        { key: 'open-pengumuman', id: 'open-info', onclick: toPosts },
        { key: 'open-profilmasjid', id: 'open-edit', onclick: goEdit },
        { key: 'open-audit', id: 'open-audit', onclick: () => renderMosque(box, mosqueId, 'audit') },
        { key: 'open-market', id: 'qa-market', onclick: () => go('market') },
        { key: 'open-more', id: 'qa-more', onclick: () => go('more') }], { ic: BOLT }),
      acts === null ? '' : activityList(acts, actionLabel, () => renderMosque(box, mosqueId, 'audit')),
      teamTop)));
  window.scrollTo(0, 0);
}
