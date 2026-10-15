// BAITUNA - home-layout-service.js (v92)
// Pembuat Beranda: susunan blok beranda per peran, diatur Super Admin. Disimpan di app_branding (layout_<peran>).
// Jenis blok: 'b' (bawaan: bagian beranda yang sudah ada), 'banner' (slide), 'fitur' (kotak menu), 'text' (judul/paragraf).
import { request, db } from './supabase.js';
import { upload, dropFile, urlFor } from './branding-service.js';

export const ROLES = [['jamaah', 'Jamaah'], ['admin', 'Admin Masjid'], ['super', 'Super Admin']];
export const LIMITS = { blocks: 30, slides: 6, items: 12, title: 80, text: 200, cta: 30, ftitle: 60, para: 600 };

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
export const builtinLabel = (role, id) => ((BUILTINS[role] || []).find(x => x[0] === id) || [id, id])[1];
export const defaultBlocks = role => (BUILTINS[role] || []).map(x => ({ t: 'b', id: x[0] }));

const ID_RE = /^[a-z]{2,12}$/;
const str = (v, n) => (typeof v === 'string' ? v : '').slice(0, n);

// Bersihkan susunan dari server/cadangan: hanya bentuk yang dikenal yang dipakai. Mengembalikan null bila tak ada yang valid.
export function cleanBlocks(role, raw) {
  if (!Array.isArray(raw)) return null;
  const known = new Set((BUILTINS[role] || []).map(x => x[0]));
  const out = [], seen = new Set();
  for (const b of raw.slice(0, LIMITS.blocks)) {
    if (!b || typeof b !== 'object') continue;
    if (b.t === 'b') { if (known.has(b.id) && !seen.has(b.id)) { seen.add(b.id); out.push({ t: 'b', id: b.id }); } }
    else if (b.t === 'banner' && Array.isArray(b.slides)) {
      const slides = b.slides.slice(0, LIMITS.slides).filter(s => s && typeof s === 'object' && str(s.title, 80).trim()).map(s => {
        const o = { title: str(s.title, LIMITS.title), text: str(s.text, LIMITS.text), cta: str(s.cta, LIMITS.cta), link: LINKS[s.link] ? s.link : '', tone: s.tone === 'gold' ? 'gold' : 'green' };
        if (typeof s.img === 'string' && urlFor(s.img)) o.img = s.img;
        return o;
      });
      if (slides.length) out.push({ t: 'banner', slides });
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
export const imagePaths = blocks => (blocks || []).flatMap(b => b.t === 'banner' ? b.slides.map(s => s.img).filter(Boolean) : []);

// Simpan. Gambar baru (slide._file = hasil prepareImage) diunggah dulu; gambar yang tak dipakai lagi dihapus setelah berhasil.
export async function saveLayout(role, blocks, previous) {
  const up = [];
  const prepared = JSON.parse(JSON.stringify(blocks.map(b => b.t === 'banner' ? { ...b, slides: b.slides.map(({ _file, ...s }) => s) } : b)));
  try {
    for (let i = 0; i < blocks.length; i++) if (blocks[i].t === 'banner') for (let j = 0; j < blocks[i].slides.length; j++) {
      const f = blocks[i].slides[j]._file;
      if (f) { const name = await upload('lay', f.blob, 'jpg'); up.push(name); prepared[i].slides[j].img = name; }
    }
    prepared.forEach(b => { if (b.t === 'banner') b.slides.forEach(s => { if (!s.img) delete s.img; }); });
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
