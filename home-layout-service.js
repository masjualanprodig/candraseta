// BAITUNA - home-layout-service.js (v92)
// Pembuat Beranda: susunan blok beranda per peran, diatur Super Admin. Disimpan di app_branding (layout_<peran>).
// Jenis blok: 'b' (bawaan: bagian beranda yang sudah ada), 'banner' (slide), 'fitur' (kotak menu), 'text' (judul/paragraf).
import { request, db } from './supabase.js';
import { upload, dropFile, urlFor } from './branding-service.js';

export const ROLES = [['jamaah', 'Jamaah'], ['admin', 'Admin Masjid'], ['super', 'Super Admin']];
export const SPEEDS = [[0, 'Tidak otomatis'], [2, '2 detik'], [3, '3 detik'], [4, '4 detik'], [5, '5 detik'], [6, '6 detik'], [8, '8 detik'], [10, '10 detik'], [15, '15 detik']];
export const DEFAULT_SPEED = 5;
const speedOf = (v, def) => (Number.isInteger(v) && v >= 0 && v <= 30) ? v : def;
export const LIMITS = { gridItems: 20, blocks: 30, slides: 6, items: 12, title: 80, text: 200, cta: 30, ftitle: 60, para: 600 };

// Tujuan tautan yang boleh dipilih (kunci -> [nama, kunci ikon di quick-catalog, tab halaman fitur]).
export const LINKS = {
  quran: ['Al-Qur’an', 'open-quran', 'quran'], jadwal: ['Jadwal Salat', 'open-jadwal', 'jadwal'], dir: ['Masjid Terdekat', 'open-nearby', 'dir'],
  doa: ['Doa Harian', 'open-doa', 'doa'], zakat: ['Zakat', 'open-zakat', 'zakat'], info: ['Agenda & Info', 'open-agenda', 'info'],
  market: ['Pasar Umat', 'open-market', 'market'], buku: ['Pustaka Buku', 'open-more', 'buku'], sejarah: ['Sejarah Islam', 'open-more', 'sejarah'],
  belajar: ['Belajar Qur’an', 'open-more', 'belajar'], sunnah: ['Amalan Sunnah', 'open-more', 'sunnah'], berita: ['Berita & Artikel', 'open-more', 'berita'],
  dzikir: ['Dzikir Pagi & Petang', 'open-more', 'dzikir'], kiblat: ['Arah Kiblat', 'open-more', 'kiblat'], tanya: ['Tanya Jawab', 'open-more', 'tanya'],
  notif: ['Notifikasi', 'open-notif', 'notif'], more: ['Lainnya', 'open-more', 'more']
};

// Bagian bawaan tiap peran, urutan = tampilan bawaan. required = tak boleh dihapus (agar tidak kehilangan akses menu).
export const BUILTINS = {
  jamaah: [['banner', 'Banner bawaan'], ['buku', 'Pustaka Buku'], ['pasar', 'Pasar Umat'], ['kelola', 'Kelola Masjid (hanya pengurus)'], ['jadwal', 'Jadwal Salat'], ['akses', 'Akses Cepat'], ['anggota', 'Keanggotaan (hanya anggota)'], ['artikel', 'Artikel Terbaru']],
  admin: [['banner', 'Banner bawaan'], ['buku', 'Pustaka Buku'], ['pasar', 'Pasar Umat'], ['jadwal', 'Jadwal Salat'], ['ops', 'Ringkasan Operasional'], ['fin', 'Ringkasan Keuangan'], ['agenda', 'Agenda Terdekat'], ['info', 'Pengumuman'], ['akses', 'Akses Cepat'], ['aktivitas', 'Aktivitas Terbaru'], ['daftar', 'Daftarkan Masjid Baru'], ['tim', 'Pengurus Masjid']],
  super: [['banner', 'Banner bawaan'], ['buku', 'Pustaka Buku'], ['pasar', 'Pasar Umat'], ['jadwal', 'Jadwal Salat'], ['mgmt', 'Manajemen Platform'], ['stats', 'Statistik Platform']]
};
export const REQUIRED = { jamaah: [], admin: ['akses'], super: ['mgmt'] };
export const REQUIRED_ITEMS = { 'super:mgmt': ['qa-konten'] };   // menu yang tak boleh disembunyikan

// Nilai bawaan tiap bagian (untuk mengisi editor dan pratinjau). Hanya yang berbeda dari bawaan yang disimpan.
const SL = (title, text, cta, link, tone, art, extra) => ({ title, text, cta, link, tone: tone || 'green', art, ...(extra || {}) });
const PROMO = {
  buku: { title: 'Pustaka Buku', text: 'Koleksi buku Islami digital untuk menambah ilmu.', cta: 'Jelajahi Buku', art: 'promo_buku' },
  pasar: { title: 'Pasar Umat', text: 'Produk dan jasa umat yang sudah diperiksa.', cta: 'Lihat Produk', art: 'promo_pasar' }
};
export const DEFAULTS = {
  jamaah: {
    banner: { slides: [SL('Bersama BAITUNA', 'Jelajahi kisah, pelajaran, dan nilai-nilai yang menginspirasi kehidupan sehari-hari.', 'Pelajari Sekarang', 'sejarah', 'green', 'banner_sejarah', { kicker: 'Sejarah Islam' }),
      SL('Belajar Qur’an', 'Materi belajar membaca Al-Qur’an, dari dasar sampai lancar.', 'Mulai Belajar', 'belajar', 'gold', 'banner_belajar'),
      SL('Amalan Sunnah Harian', 'Pengingat amalan sunnah untuk dibiasakan setiap hari.', 'Lihat Amalan', 'sunnah', 'green', 'banner_sunnah')] },
    buku: PROMO.buku, pasar: PROMO.pasar,
    akses: { title: 'Akses Cepat', items: [['qa-quran', 'Al-Qur’an', 'open-quran'], ['qa-jadwal', 'Jadwal Salat', 'open-jadwal'], ['qa-nearby', 'Masjid Terdekat', 'open-nearby'], ['qa-doa', 'Doa Harian', 'open-doa'], ['qa-zakat', 'Zakat', 'open-zakat'], ['qa-agenda', 'Agenda', 'open-agenda'], ['qa-market', 'Pasar Umat', 'open-market'], ['qa-more', 'Lainnya', 'open-more']] },
    kelola: { title: 'Kelola Masjid' }, jadwal: { title: 'Jadwal Salat Hari Ini' }, anggota: { title: 'Keanggotaan Anda' }, artikel: { title: 'Artikel Terbaru' }
  },
  admin: {
    banner: { slides: [SL('(Nama masjid) Bersama BAITUNA', 'Kelola masjid lebih mudah dan profesional.', 'Kelola Masjid', '', 'green', 'banner_masjid'),
      SL('Catat Kas dengan Rapi', 'Buku kas tidak bisa diubah diam-diam; koreksi tercatat sebagai baris baru.', 'Buka Kas', '', 'gold', 'banner_kas')] },
    buku: PROMO.buku, pasar: PROMO.pasar,
    akses: { title: 'Akses Cepat', items: [['qa-pengurus', 'Pengurus', 'open-pengurus'], ['open-kas', 'Keuangan', 'open-keuangan'], ['open-posts', 'Agenda', 'open-agenda'], ['open-info', 'Pengumuman', 'open-pengumuman'], ['open-edit', 'Profil Masjid', 'open-profilmasjid'], ['open-audit', 'Jejak Audit', 'open-audit'], ['qa-market', 'Pasar Umat', 'open-market'], ['qa-more', 'Lainnya', 'open-more']] },
    jadwal: { title: 'Jadwal Salat Hari Ini' }, ops: { title: 'Ringkasan Operasional Masjid' }, fin: { title: 'Ringkasan Keuangan Masjid' },
    agenda: { title: 'Agenda Terdekat' }, info: { title: 'Pengumuman' }, aktivitas: { title: 'Aktivitas Terbaru' }, daftar: { title: 'Daftarkan Masjid Baru' }, tim: { title: 'Pengurus Masjid' }
  },
  super: {
    banner: { slides: [SL('Satu Platform, Banyak Masjid', 'Kelola dan pantau masjid bersama BAITUNA.', 'Kelola Masjid', '', 'green', 'banner_masjid'),
      SL('Verifikasi Masjid', '(Jumlah masjid menunggu verifikasi)', 'Buka Daftar Masjid', '', 'gold', 'banner_kas')] },
    buku: { ...PROMO.buku, text: 'Kelola koleksi buku Islami umat.', cta: 'Kelola Buku' },
    pasar: { ...PROMO.pasar, text: 'Periksa produk dan jasa sebelum tampil.', cta: 'Verifikasi' },
    jadwal: { title: 'Jadwal Salat Hari Ini' },
    mgmt: { title: 'Manajemen Platform', items: [['qa-masjid', 'Data Masjid', 'open-datamasjid'], ['qa-konten', 'Editor', 'open-konten'], ['adm-market', 'Verifikasi Pasar', 'open-market'], ['adm-audit', 'Jejak Audit', 'open-audit'], ['adm-tampilan', 'Tampilan', 'open-tampilan'], ['adm-notif', 'Notifikasi', 'open-notif'], ['qa-more', 'Lainnya', 'open-more']] },
    stats: { title: 'Statistik Platform' }
  }
};
// Menu tambahan (di luar bawaan) memakai id 'x-<tujuan>', mis. 'x-quran'.
export const extraId = k => 'x-' + k;
export const defaultsOf = (role, id) => (DEFAULTS[role] || {})[id] || {};
// Jenis ubahan: 'slides' (banner), 'promo' (judul+teks+tombol+gambar), 'grid' (judul+menu), 'title' (hanya judul).
export const kindOf = (role, id) => { const d = defaultsOf(role, id); return d.slides ? 'slides' : d.items ? 'grid' : d.cta ? 'promo' : 'title'; };
export const builtinLabel = (role, id) => ((BUILTINS[role] || []).find(x => x[0] === id) || [id, id])[1];
export const defaultBlocks = role => (BUILTINS[role] || []).map(x => ({ t: 'b', id: x[0] }));

const ID_RE = /^[a-z]{2,12}$/;
const str = (v, n) => (typeof v === 'string' ? v : '').slice(0, n);

const ITEM_RE = /^[a-z0-9-]{2,24}$/;
const imgOk = v => typeof v === 'string' && !!urlFor(v);
// Ubahan bagian bawaan: hanya isian yang dikenal; hasil kosong => null.
export function cleanOverride(role, id, o) {
  if (!o || typeof o !== 'object') return null;
  const d = defaultsOf(role, id), kind = kindOf(role, id), out = {};
  if (typeof o.title === 'string' && o.title.trim()) out.title = o.title.slice(0, LIMITS.ftitle);
  if (kind === 'promo') {
    if (typeof o.text === 'string' && o.text.trim()) out.text = o.text.slice(0, LIMITS.text);
    if (typeof o.cta === 'string' && o.cta.trim()) out.cta = o.cta.slice(0, LIMITS.cta);
    if (LINKS[o.link]) out.link = o.link;
    if (imgOk(o.img)) out.img = o.img;
  }
  if (kind === 'slides' && Array.isArray(o.slides)) {
    const sl = (d.slides || []).map((_, k) => {
      const s = o.slides[k]; if (!s || typeof s !== 'object') return {};
      const r = {};
      if (typeof s.title === 'string' && s.title.trim()) r.title = s.title.slice(0, LIMITS.title);
      if (typeof s.text === 'string' && s.text.trim()) r.text = s.text.slice(0, LIMITS.text);
      if (typeof s.cta === 'string' && s.cta.trim()) r.cta = s.cta.slice(0, LIMITS.cta);
      if (LINKS[s.link]) r.link = s.link;
      if (s.tone === 'gold' || s.tone === 'green') r.tone = s.tone;
      if (imgOk(s.img)) r.img = s.img;
      if (s.hide === true) r.hide = true;
      return r;
    });
    if (sl.some(r => Object.keys(r).length)) out.slides = sl;
  }
  if (kind === 'slides' && Number.isInteger(o.speed) && o.speed > 0 && o.speed <= 30) out.speed = o.speed;
  if (kind === 'grid' && Array.isArray(o.items)) {
    const ok = new Set([...(d.items || []).map(x => x[0]), ...Object.keys(LINKS).map(k => 'x-' + k)]);
    let items = [...new Set(o.items.filter(k => typeof k === 'string' && ITEM_RE.test(k) && ok.has(k)))];
    for (const r of REQUIRED_ITEMS[role + ':' + id] || []) if (!items.includes(r)) items.push(r);
    if (items.length) out.items = items;
  }
  return Object.keys(out).length ? out : null;
}

// Bersihkan susunan dari server/cadangan: hanya bentuk yang dikenal yang dipakai. Mengembalikan null bila tak ada yang valid.
export function cleanBlocks(role, raw) {
  if (!Array.isArray(raw)) return null;
  const known = new Set((BUILTINS[role] || []).map(x => x[0]));
  const out = [], seen = new Set();
  for (const b of raw.slice(0, LIMITS.blocks)) {
    if (!b || typeof b !== 'object') continue;
    if (b.t === 'b') { if (known.has(b.id) && !seen.has(b.id)) { seen.add(b.id); const o = cleanOverride(role, b.id, b.o); out.push(o ? { t: 'b', id: b.id, o } : { t: 'b', id: b.id }); } }
    else if (b.t === 'banner' && Array.isArray(b.slides)) {
      // Slide baru = gambar saja. Slide lama yang berjudul tetap dipakai apa adanya.
      const slides = b.slides.slice(0, LIMITS.slides).filter(s => s && typeof s === 'object' && ((typeof s.img === 'string' && urlFor(s.img)) || str(s.title, 80).trim())).map(s => {
        const o = {};
        if (typeof s.img === 'string' && urlFor(s.img)) o.img = s.img;
        if (str(s.title, 80).trim()) Object.assign(o, { title: str(s.title, LIMITS.title), text: str(s.text, LIMITS.text), cta: str(s.cta, LIMITS.cta), link: LINKS[s.link] ? s.link : '', tone: s.tone === 'gold' ? 'gold' : 'green' });
        return o;
      });
      if (slides.length) out.push({ t: 'banner', speed: speedOf(b.speed, DEFAULT_SPEED), slides });
    } else if (b.t === 'fitur' && Array.isArray(b.items)) {
      const items = [...new Set(b.items.filter(k => typeof k === 'string' && LINKS[k]))].slice(0, LIMITS.items);
      if (items.length) out.push({ t: 'fitur', title: str(b.title, LIMITS.ftitle), items });
    } else if (b.t === 'text' && str(b.text, LIMITS.para).trim()) {
      out.push({ t: 'text', style: ['h1', 'h2', 'p'].includes(b.style) ? b.style : 'p', align: ['left', 'center', 'right'].includes(b.align) ? b.align : 'left', text: str(b.text, LIMITS.para) });
    }
  }
  // bagian wajib selalu ada, agar menu penting tidak hilang
  for (const id of REQUIRED[role] || []) if (!seen.has(id)) out.push({ t: 'b', id });
  return out.length ? out : null;
}

// null = pakai susunan bawaan (belum diatur / tidak terjangkau).
export async function fetchLayout(role) {
  try {
    const r = await request('/rest/v1/app_branding?select=key,value&key=eq.layout_' + role);
    if (!r.ok || !Array.isArray(r.data)) return null;
    const row = r.data.find(x => x && x.key === 'layout_' + role);
    return row && row.value ? cleanBlocks(role, row.value.blocks) : null;
  } catch (e) { return null; }
}

const rpc = (fn, body) => db('rpc/' + fn, { method: 'POST', body });
// Penyimpan gambar pada sebuah blok: objek yang memuat {img, _file}.
export const holders = b => b.t === 'banner' ? b.slides : b.t === 'b' && b.o ? [...(b.o.slides || []).filter(Boolean), ...(b.o.img !== undefined || b.o._file ? [b.o] : [])] : [];
export const imagePaths = blocks => (blocks || []).flatMap(b => holders(b).map(x => x.img).filter(Boolean));
// Buang ubahan kosong supaya yang tersimpan hanya yang berbeda dari bawaan. File gambar baru (_file) ikut dibawa.
const NEW = 'lay-new.jpg';
export function pruneBlocks(role, blocks) {
  return blocks.map(b => {
    if (b.t !== 'b' || !b.o) return b;
    const o = JSON.parse(JSON.stringify(b.o, (k, v) => (k === '_file' || k === '_url') ? undefined : v));
    if (b.o._file) o.img = NEW;
    (b.o.slides || []).forEach((x, k) => { if (x && x._file && o.slides && o.slides[k]) o.slides[k].img = NEW; });
    const c = cleanOverride(role, b.id, o);
    if (!c) return { t: 'b', id: b.id };
    if (b.o._file && c.img === NEW) c._file = b.o._file;
    (c.slides || []).forEach((x, k) => { const f = b.o.slides && b.o.slides[k] && b.o.slides[k]._file; if (f && x.img === NEW) x._file = f; });
    return { t: 'b', id: b.id, o: c };
  });
}

// Simpan. Gambar baru (_file = hasil prepareImage) diunggah dulu; gambar yang tak dipakai lagi dihapus setelah berhasil.
export async function saveLayout(role, blocks, previous) {
  const up = [];
  const src = pruneBlocks(role, blocks);
  const prepared = JSON.parse(JSON.stringify(src, (k, v) => (k === '_file' || k === '_url') ? undefined : v));
  try {
    for (let i = 0; i < src.length; i++) {
      const hs = holders(src[i]), ps = holders(prepared[i]);
      for (let j = 0; j < hs.length; j++) if (hs[j]._file) { const name = await upload('lay', hs[j]._file.blob, 'jpg'); up.push(name); ps[j].img = name; }
    }
    prepared.forEach(b => { holders(b).forEach(x => { if (!x.img) delete x.img; }); });
    await rpc('layout_set', { p_role: role, p_blocks: prepared });
  } catch (e) { await Promise.all(up.map(dropFile)); throw e; }
  const keep = new Set(imagePaths(prepared));
  await Promise.all(imagePaths(previous).filter(p => !keep.has(p)).map(dropFile));
  return prepared;
}
export async function resetLayout(role, previous) {
  await rpc('layout_reset', { p_role: role });
  await Promise.all(imagePaths(previous).map(dropFile));
}
