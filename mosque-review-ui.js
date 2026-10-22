// BAITUNA - mosque-review-ui.js
// Halaman "Periksa pendaftaran" untuk Super Admin: semua data yang diinput Admin Masjid, pemeriksaan otomatis,
// lalu keputusan (setujui / tolak / ...). Keamanan sebenarnya dijaga RLS; halaman ini hanya membaca data.
import { h, toast, hint, STATUS_LABEL } from './ui.js';
import { getMosqueReview, getRegistrant } from './mosque-service.js';
import { publicPhotoUrl, GALLERY_BUCKET } from './supabase.js';
import { MAPS_RE, mapEmbed } from './maps-link.js';

const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// Pemeriksaan otomatis (hanya saran untuk pertimbangan Super Admin). Mengembalikan [{ ok, label, note }].
export function reviewChecks(m, list = []) {
  const photos = Array.isArray(m.photos) ? m.photos.length : 0;
  const hasCoord = m.latitude != null && m.longitude != null;
  const dupes = list.filter(o => o.id !== m.id && ['pending', 'active', 'suspended'].includes(o.status) && norm(o.name) === norm(m.name));
  const sameCity = dupes.filter(o => norm(o.city) === norm(m.city));
  const miss = [['Provinsi', m.province], ['Kota/Kabupaten', m.city], ['Kecamatan', m.district]].filter(x => !x[1]).map(x => x[0]);
  return [
    { ok: norm(m.name).length >= 3, label: 'Nama masjid terisi', note: m.name || '' },
    { ok: !miss.length, label: 'Wilayah lengkap (provinsi, kota/kabupaten, kecamatan)', note: miss.length ? 'Belum diisi: ' + miss.join(', ') : '' },
    { ok: norm(m.address).length >= 10, label: 'Alamat diisi', note: m.address ? '' : 'Alamat kosong' },
    { ok: !!norm(m.contact_phone), label: 'No.HP/Telepon diisi', note: m.contact_phone ? '' : 'Belum diisi' },
    { ok: photos > 0, label: 'Ada foto masjid', note: photos ? photos + ' foto' : 'Belum ada foto' },
    { ok: !!(m.maps_url && MAPS_RE.test(m.maps_url)), label: 'Tautan Google Maps', note: m.maps_url ? '' : 'Belum ada tautan' },
    { ok: hasCoord, label: 'Koordinat lokasi terbaca', note: hasCoord ? m.latitude + ', ' + m.longitude : 'Tidak terbaca (peta hanya perkiraan)' },
    { ok: !dupes.length, label: 'Tidak ada masjid lain dengan nama yang sama', note: dupes.length ? (sameCity.length ? 'Sudah ada di kota yang sama: ' : 'Nama sama di tempat lain: ') + dupes.map(o => [o.name, o.city].filter(Boolean).join(' – ') + ' (' + (STATUS_LABEL[o.status] || o.status) + ')').join('; ') : '' }
  ];
}

const fmtDate = iso => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; };

// opts: { list, onBack, buttons: [[label, key, alt]], onAction(mosque, key) }
export async function renderMosqueReview(box, id, opts) {
  let m;
  try { m = await getMosqueReview(id); } catch (e) { if (e && e.status === 401) return; toast('Data masjid belum bisa dimuat. ' + hint(e), true); return; }
  if (!m) { toast('Masjid tidak ditemukan.', true); return; }
  let reg = null;
  if (m.created_by) { try { reg = await getRegistrant(m.created_by); } catch (e) { if (e && e.status === 401) return; reg = null; } }
  const photos = (Array.isArray(m.photos) ? m.photos : []).map(p => publicPhotoUrl(p, GALLERY_BUCKET)).filter(Boolean);
  const legacy = m.photo_path ? publicPhotoUrl(m.photo_path) : null;
  const row = (label, content) => h('div', { class: 'drow' }, h('div', { class: 'muted' }, label), h('div', { class: 'prewrap' }, content));
  const mapsHref = m.maps_url && MAPS_RE.test(m.maps_url) ? m.maps_url : null;
  const checks = reviewChecks(m, opts.list || []);
  const warn = checks.filter(c => !c.ok).length;
  const btns = (opts.buttons || []).filter(b => b[1] !== 'del' || m.status !== 'active');
  box.replaceChildren(h('div', { class: 'home', id: 'mosque-review' }, h('div', { class: 'home-body mp-body' },
    h('div', { class: 'mp-head' }, h('button', { class: 'btn-sm ghost', id: 'rv-back', type: 'button', onclick: opts.onBack }, '← Daftar masjid'), h('h2', {}, 'Periksa pendaftaran')),
    h('h2', { class: 'mt' }, m.name),
    h('div', {}, h('span', { class: 'badge b-' + m.status }, STATUS_LABEL[m.status] || m.status), m.created_at ? h('span', { class: 'muted' }, ' Didaftarkan ' + fmtDate(m.created_at)) : ''),
    m.status_reason ? h('p', { class: 'muted' }, 'Alasan: ' + m.status_reason) : '',
    photos.length || legacy ? h('div', { class: 'rg-gallery', id: 'rv-gallery' }, [legacy, ...photos].filter(Boolean).map((u, i) => h('a', { href: u, target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'Foto ' + (i + 1) }, h('img', { src: u, alt: 'Foto ' + (i + 1) + ' ' + m.name, loading: 'lazy' }))))
      : h('div', { class: 'photo-empty' }, 'Belum ada foto'),
    h('div', { class: 'panel', id: 'rv-data' }, h('h3', {}, 'Data yang diinput'),
      row('Nama masjid', m.name), row('Provinsi', m.province || '—'), row('Kota/Kabupaten', m.city || '—'), row('Kecamatan', m.district || '—'),
      row('Alamat', m.address || '—'), row('No.HP/Telepon', m.contact_phone || '—'),
      row('Tautan Google Maps', mapsHref ? h('a', { class: 'link', id: 'rv-maps', href: mapsHref, target: '_blank', rel: 'noopener noreferrer' }, 'Buka di Google Maps') : '—'),
      row('Koordinat', m.latitude != null && m.longitude != null ? m.latitude + ', ' + m.longitude : 'Tidak terbaca'),
      row('Didaftarkan oleh', reg ? [reg.full_name, reg.phone].filter(Boolean).join(' · ') || 'Nama belum diisi' : 'Tidak diketahui'),
      mapEmbed(m) || ''),
    h('div', { class: 'panel', id: 'rv-checks' }, h('h3', {}, 'Pemeriksaan otomatis'),
      h('p', { class: 'muted' }, warn ? warn + ' hal perlu diperhatikan. Ini hanya saran untuk pertimbangan Anda.' : 'Semua pemeriksaan terpenuhi. Ini hanya saran untuk pertimbangan Anda.'),
      h('ul', { class: 'rv-list' }, checks.map(c => h('li', { class: c.ok ? 'rv-ok' : 'rv-warn' }, h('b', {}, (c.ok ? '✓ ' : '! ') + c.label), c.note ? h('div', { class: 'muted' }, c.note) : '')))),
    btns.length ? h('div', { class: 'panel', id: 'rv-decide' }, h('h3', {}, 'Keputusan'),
      h('div', { class: 'macts' }, btns.map(([label, key, alt]) => h('button', { class: 'btn-sm' + (alt ? ' alt' : ''), type: 'button', 'data-act': key, onclick: () => opts.onAction(m, key) }, label)))) : '')));
  window.scrollTo(0, 0);
}
