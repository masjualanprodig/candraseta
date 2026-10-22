// BAITUNA - home-kartu.js (v129)
// Blok "Kartu fitur" pada beranda: judul, gambar, deskripsi, dan tombol yang bisa diatur Super Admin.
//  * fitur berisi daftar (Berita & Artikel, Pustaka Buku, Sejarah Islam): Kartu / Grid / Daftar dengan 1-6 isi nyata
//  * fitur alat (Zakat, Jadwal Salat, Al-Qur'an): Ringkas (kartu) atau Penuh (fiturnya tampil langsung di beranda)
//  * fitur lain: kartu dengan tombol menuju fitur
import { h } from './ui.js';
import { icon, ICONS } from './feed-ui.js';
import { go, sectionHead, prayerCard } from './home-ui.js';
import { LINKS, kartuKind } from './home-layout-service.js';
import { urlFor } from './branding-service.js';
import { request, publicPhotoUrl, ARTICLE_BUCKET } from './supabase.js';
import { listBooks, coverUrl, shortDesc, priceText } from './books-service.js';
import { listHistory } from './history-service.js';
import { catLabel } from './articles-service.js';

const PH = { berita: ICONS.news, buku: ICONS.book, sejarah: ICONS.book };
const FETCH = {
  berita: async n => {
    const r = await request('/rest/v1/articles?select=id,title,category,cover_path&status=eq.published&order=published_at.desc&limit=' + n);
    return (r.ok && Array.isArray(r.data) ? r.data : []).map(a => ({ title: a.title, sub: catLabel(a.category), img: a.cover_path ? publicPhotoUrl(a.cover_path, ARTICLE_BUCKET) : null }));
  },
  buku: async n => (await listBooks()).slice(0, n).map(b => ({ title: b.title, sub: priceText(b.price) || shortDesc(b.description, 60), img: coverUrl(b) })),
  sejarah: async n => (await listHistory()).slice(0, n).map(e => ({ title: e.title, sub: e.period || '', img: e.photo_path ? publicPhotoUrl(e.photo_path, 'history-photos') : null }))
};
const MOCK = ['Contoh judul pertama', 'Contoh judul kedua', 'Contoh judul ketiga', 'Contoh judul keempat', 'Contoh judul kelima', 'Contoh judul keenam'];

export function kartuNode(b, { preview = false } = {}) {
  const L = LINKS[b.feature]; if (!L) return null;
  const kind = kartuKind(b.feature), title = b.title || L[0];
  const openF = () => { if (!preview) go(L[2]); };
  const img = b._url || (b.img && urlFor(b.img)) || '';
  const mode = kind === 'data' ? (b.mode || 'kartu') : 'kartu', count = Number.isInteger(b.count) ? b.count : 3;
  const full = kind === 'embed' && b.size === 'penuh';
  const sec = h('section', { class: 'kt kt-' + (full ? 'full' : mode), 'data-feature': b.feature, ...(b.id ? { id: b.id } : {}) });
  if (full && b.feature === 'jadwal') { sec.classList.add('kt-bare'); }
  else sec.append(sectionHead(title, openF, 'kt-all'));
  if (img) sec.append(h('img', { class: 'kt-hero', src: img, alt: '', loading: 'lazy' }));
  if (b.text && b.text.trim()) sec.append(h('p', { class: 'kt-text' }, b.text));

  if (full) {
    const slot = h('div', { class: 'kt-embed' });
    sec.append(slot);
    if (preview) { slot.append(h('div', { class: 'hb-ph' }, 'Fitur ' + L[0] + ' tampil penuh di sini.')); return sec; }
    const mount = async () => {
      try {
        if (b.feature === 'jadwal') slot.append(prayerCard());
        else if (b.feature === 'zakat') slot.append((await import('./zakat-ui.js')).zakatPage());
        else if (b.feature === 'quran') slot.append((await import('./quran-ui.js')).quranPage());
      } catch (e) { slot.append(h('p', { class: 'muted' }, 'Fitur belum bisa ditampilkan. Ketuk "Lihat Semua".')); }
    };
    mount();
    return sec;
  }

  if (kind === 'data' && mode !== 'kartu') {
    const box = h('div', { class: mode === 'grid' ? 'kt-items kt-g' : 'kt-items kt-l' });
    const draw = items => box.replaceChildren(...items.map(it => h('button', { class: 'kt-item', type: 'button', onclick: openF },
      it.img ? h('img', { class: 'kt-thumb', src: it.img, alt: '', loading: 'lazy' }) : h('span', { class: 'kt-thumb kt-ph' }, icon(PH[b.feature] || ICONS.mosque)),
      h('span', { class: 'kt-it' }, h('b', {}, it.title), it.sub ? h('small', {}, it.sub) : ''))));
    sec.append(box);
    if (preview) draw(MOCK.slice(0, count).map(t => ({ title: t, sub: 'Contoh keterangan', img: null })));
    else FETCH[b.feature](count).then(items => { if (items.length) draw(items); else box.replaceChildren(h('p', { class: 'muted kt-empty' }, 'Belum ada isi.')); }).catch(() => box.replaceChildren(h('p', { class: 'muted kt-empty' }, 'Isi belum bisa dimuat.')));
    return sec;
  }
  sec.append(h('button', { class: 'btn-sm kt-cta', type: 'button', onclick: openF }, b.cta || 'Buka ' + L[0], icon(ICONS.chev)));
  return sec;
}
