// BAITUNA - nearby-ui.js
// Halaman "Masjid terdekat": peta + daftar urut jarak. Peta memakai Leaflet (ikut di aplikasi) dan ubin OpenStreetMap.
import { h } from './ui.js';
import { publicPhotoUrl } from './supabase.js';
import { fetchMosquesWithCoords, sortByDistance, fmtDistance, getPosition, directionsUrl } from './nearby-service.js';

const PAGE = 20;
const MSG = {
  denied: 'Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini di pengaturan peramban, lalu coba lagi.',
  unavailable: 'Lokasi perangkat belum tersedia. Pastikan lokasi/GPS menyala, lalu coba lagi.',
  timeout: 'Mencari lokasi terlalu lama. Coba lagi, sebaiknya di tempat terbuka.',
  unsupported: 'Peramban ini tidak mendukung lokasi perangkat.'
};

// Leaflet dimuat hanya saat halaman ini dibuka.
let leafletP = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletP) return leafletP;
  leafletP = new Promise((resolve, reject) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'leaflet.css'; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = 'leaflet.js'; s.onload = () => (window.L ? resolve(window.L) : reject(new Error('L'))); s.onerror = () => reject(new Error('muat'));
    document.head.appendChild(s);
  });
  leafletP.catch(() => { leafletP = null; });
  return leafletP;
}

let last = null; // { pos, mosques } disimpan di memori agar kembali dari profil tidak meminta lokasi lagi

export function nearbyView({ onOpen }) {
  const wrap = h('div', { class: 'nearby' });
  let map = null, shown = PAGE;

  function intro(extra) {
    wrap.replaceChildren(h('div', { class: 'panel' },
      h('h3', {}, 'Cari masjid di dekat Anda'),
      h('p', { class: 'muted' }, 'Lokasi Anda hanya dipakai di perangkat ini untuk menghitung jarak. Lokasi tidak dikirim ke server BAITUNA dan tidak disimpan.'),
      extra ? h('p', { class: 'hint err' }, extra) : '',
      h('button', { class: 'btn-sm', type: 'button', onclick: start }, extra ? 'Coba lagi' : 'Gunakan lokasi saya'),
      h('p', { class: 'hint' }, 'Hanya masjid terverifikasi yang sudah mengisi titik lokasinya yang bisa ditampilkan.')));
  }

  async function start() {
    wrap.replaceChildren(h('div', { class: 'panel center' }, h('p', { class: 'muted' }, 'Mencari lokasi Anda…')));
    let pos;
    try { pos = await getPosition(); } catch (e) { intro(MSG[e && e.code] || MSG.unavailable); return; }
    try {
      const mosques = last && last.mosques ? last.mosques : await fetchMosquesWithCoords();
      last = { pos, mosques };
    } catch { wrap.replaceChildren(h('div', { class: 'panel center' }, h('p', {}, 'Data masjid belum bisa dimuat. Periksa koneksi, lalu coba lagi.'), h('button', { class: 'btn-sm', type: 'button', onclick: start }, 'Coba lagi'))); return; }
    shown = PAGE; results();
  }

  function results() {
    if (map) { try { map.remove(); } catch { /* abaikan */ } map = null; }
    const { pos, mosques } = last;
    if (!mosques.length) {
      wrap.replaceChildren(h('div', { class: 'panel' }, h('p', { class: 'muted' }, 'Belum ada masjid yang mengisi titik lokasinya. Admin masjid dapat mengisinya di Edit profil masjid.')));
      return;
    }
    const sorted = sortByDistance(mosques, pos);
    const cards = new Map();
    const card = ({ m, km }) => {
      const u = publicPhotoUrl(m.photo_path);
      const el = h('div', { class: 'ncard', 'data-id': m.id },
        u ? h('img', { class: 'thumb', src: u, alt: 'Foto ' + m.name, loading: 'lazy' }) : h('div', { class: 'thumb thumb-empty', 'aria-hidden': 'true' }),
        h('div', { class: 'minfo' },
          h('strong', {}, m.name),
          h('div', { class: 'muted' }, [m.city, m.province].filter(Boolean).join(', ') || 'Wilayah belum diisi'),
          h('div', { class: 'ndist' }, h('b', {}, fmtDistance(km)), h('span', { class: 'muted' }, ' · garis lurus')),
          h('div', { class: 'row-btns mt' },
            h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => onOpen(m) }, 'Lihat profil'),
            h('a', { class: 'btn-sm', href: directionsUrl(m), target: '_blank', rel: 'noopener noreferrer' }, 'Petunjuk arah'))));
      cards.set(m.id, el);
      return el;
    };
    const mapBox = h('div', { class: 'nmap', role: 'region', 'aria-label': 'Peta masjid terdekat' });
    const listBox = h('div', { class: 'nlist' });
    const fill = () => {
      listBox.replaceChildren(...sorted.slice(0, shown).map(card));
      if (shown < sorted.length) listBox.append(h('div', { class: 'center mt' }, h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { shown += PAGE; fill(); } }, 'Tampilkan lebih banyak')));
    };
    fill();
    const near = sorted[0];
    wrap.replaceChildren(
      mapBox,
      h('div', { class: 'nhead' },
        h('p', { class: 'muted' }, near.km > 100 ? 'Masjid terdekat berjarak lebih dari 100 km dari Anda.' : sorted.length + ' masjid terverifikasi, diurutkan dari yang terdekat.'),
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { last = { pos: null, mosques: last.mosques }; start(); } }, 'Perbarui lokasi')),
      listBox,
      h('p', { class: 'hint' }, 'Jarak dihitung garis lurus dari lokasi Anda, bukan jarak tempuh. Titik lokasi diisi oleh admin masing-masing masjid.'));
    loadLeaflet().then(L => {
      if (!mapBox.isConnected) return;
      map = L.map(mapBox, { zoomControl: true, attributionControl: true }).setView([pos.lat, pos.lng], 14);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
      L.circleMarker([pos.lat, pos.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(map).bindTooltip(h('span', {}, 'Lokasi Anda'));
      const pts = [[pos.lat, pos.lng]];
      sorted.slice(0, 40).forEach(({ m }, i) => {
        const mk = L.marker([m.lat, m.lng], { icon: L.divIcon({ className: 'nmk', html: '<span></span>', iconSize: [26, 26], iconAnchor: [13, 13] }), title: m.name }).addTo(map);
        mk.bindTooltip(h('span', {}, m.name));
        mk.on('click', () => {
          const idx = sorted.findIndex(x => x.m.id === m.id);
          if (idx >= shown) { shown = idx + 1; fill(); }
          const el = cards.get(m.id); if (!el) return;
          cards.forEach(c => c.classList.remove('sel')); el.classList.add('sel'); el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });
        if (i < 5) pts.push([m.lat, m.lng]);
      });
      map.fitBounds(pts, { padding: [30, 30], maxZoom: 16 });
      setTimeout(() => { if (map) map.invalidateSize(); }, 50);
    }).catch(() => { mapBox.replaceChildren(h('p', { class: 'muted center' }, 'Peta belum bisa dimuat. Daftar masjid terdekat tetap bisa dipakai.')); mapBox.classList.add('nmap-off'); });
  }

  if (last && last.pos) results(); else intro();
  return wrap;
}
