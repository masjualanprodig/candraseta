// BAITUNA - quran-service.js
// Al-Qur'an dibaca langsung dari AlQuran Cloud (gratis, tanpa kunci API). Tidak ada teks Qur'an yang diketik/diubah oleh BAITUNA.
//  - Teks Arab : edisi "quran-uthmani" (teks Tanzil, diverifikasi terhadap Mushaf Madinah)
//  - Terjemah  : edisi "id.indonesian" (Bahasa Indonesia)
//  - Audio     : per ayat dari cdn.islamic.network (qari pilihan di RECITERS)
// Data dari luar selalu divalidasi sebelum tampil; bila janggal, ditolak (tidak menampilkan teks setengah benar).
const BASE = 'https://api.alquran.cloud/v1';
export const AUDIO_HOST = 'https://cdn.islamic.network/';

export const RECITERS = [
  { id: 'ar.alafasy', name: 'Mishary Alafasy' },
  { id: 'ar.husary', name: 'Al-Husary (murattal)' }
];
const RID = RECITERS.map(r => r.id);
const TEXT_ED = 'quran-uthmani', TRANS_ED = 'id.indonesian';

const bad = msg => Object.assign(new Error(msg), { code: 'BAD_DATA' });
const isInt = n => Number.isInteger(n);

async function getJson(path) {
  let res;
  try { res = await fetch(BASE + path, { headers: { Accept: 'application/json' } }); }
  catch { throw Object.assign(new Error('jaringan'), { code: 'NETWORK' }); }
  if (!res.ok) throw Object.assign(new Error('http ' + res.status), { code: 'HTTP', status: res.status });
  let j;
  try { j = await res.json(); } catch { throw bad('bukan JSON'); }
  if (!j || j.code !== 200 || !('data' in j)) throw bad('respons tidak dikenal');
  return j.data;
}

let surahCache = null;
export async function listSurahs() {
  if (surahCache) return surahCache;
  const d = await getJson('/surah');
  if (!Array.isArray(d) || d.length !== 114) throw bad('daftar surat tidak lengkap');
  const out = d.map((s, i) => {
    if (!s || s.number !== i + 1 || !isInt(s.numberOfAyahs) || s.numberOfAyahs < 3 || typeof s.name !== 'string' || typeof s.englishName !== 'string') throw bad('surat ' + (i + 1));
    return { number: s.number, name: s.name, latin: s.englishName, ayahs: s.numberOfAyahs, place: s.revelationType === 'Medinan' ? 'Madaniyah' : 'Makkiyah' };
  });
  surahCache = out;
  return out;
}

// Rangka huruf tanpa harakat, untuk mengenali basmalah yang ikut menempel di ayat 1.
const skeleton = s => s.replace(/[ً-ٰٟۖ-ۭـ]/g, '').replace(/ٱ/g, 'ا');
const BISM_SKEL = 'بسم الله الرحمن الرحيم';

// Pisahkan basmalah yang menempel di awal ayat 1 (kebiasaan data sumber). Hanya dikenali bila empat kata pertamanya basmalah.
export function splitBismillah(text, surahNo) {
  if (surahNo === 1 || surahNo === 9) return { bismillah: '', text };
  const w = text.trim().split(/\s+/);
  if (w.length > 4 && skeleton(w.slice(0, 4).join(' ')) === BISM_SKEL) return { bismillah: w.slice(0, 4).join(' '), text: w.slice(4).join(' ') };
  return { bismillah: '', text };
}

function audioList(ed, n, count) {
  if (!ed || ed.edition === undefined || !Array.isArray(ed.ayahs) || ed.ayahs.length !== count) throw bad('audio tidak lengkap');
  return ed.ayahs.map((a, i) => {
    if (!a || a.numberInSurah !== i + 1 || typeof a.audio !== 'string' || !a.audio.startsWith(AUDIO_HOST) || !a.audio.endsWith('.mp3')) throw bad('audio ayat ' + (i + 1));
    return a.audio;
  });
}

export async function loadSurah(n, reciter) {
  if (!isInt(n) || n < 1 || n > 114) throw bad('nomor surat');
  const rec = RID.includes(reciter) ? reciter : RID[0];
  const d = await getJson('/surah/' + n + '/editions/' + TEXT_ED + ',' + TRANS_ED + ',' + rec);
  if (!Array.isArray(d) || d.length !== 3) throw bad('edisi tidak lengkap');
  const by = id => d.find(e => e && e.edition && e.edition.identifier === id);
  const ar = by(TEXT_ED), tr = by(TRANS_ED), au = by(rec);
  if (!ar || !tr || !au) throw bad('edisi hilang');
  const count = ar.numberOfAyahs;
  if (ar.number !== n || !isInt(count) || [ar, tr].some(e => !Array.isArray(e.ayahs) || e.ayahs.length !== count)) throw bad('jumlah ayat tidak cocok');
  const audio = audioList(au, n, count);
  let bismillah = '';
  const ayahs = ar.ayahs.map((a, i) => {
    const t = tr.ayahs[i];
    if (!a || !t || a.numberInSurah !== i + 1 || t.numberInSurah !== i + 1 || typeof a.text !== 'string' || typeof t.text !== 'string' || !a.text.trim()) throw bad('ayat ' + (i + 1));
    let text = a.text;
    if (i === 0) { const r = splitBismillah(text, n); bismillah = r.bismillah; text = r.text; }
    return { n: i + 1, ar: text, id: t.text, audio: audio[i] };
  });
  return { number: n, name: ar.name, latin: ar.englishName, place: ar.revelationType === 'Medinan' ? 'Madaniyah' : 'Makkiyah', bismillah, reciter: rec, ayahs };
}

// Ganti qari tanpa memuat ulang teks.
export async function loadAudio(n, reciter, count) {
  if (!RID.includes(reciter)) throw bad('qari');
  const d = await getJson('/surah/' + n + '/' + reciter);
  return audioList(d, n, count);
}

// Teks ayat (Arab + terjemah) untuk rujukan "surat:ayat awal-akhir". Satu surat dimuat sekali lalu disimpan di memori.
const textCache = new Map();
async function surahText(n) {
  if (textCache.has(n)) return textCache.get(n);
  const p = (async () => {
    const d = await getJson('/surah/' + n + '/editions/' + TEXT_ED + ',' + TRANS_ED);
    if (!Array.isArray(d) || d.length !== 2) throw bad('edisi tidak lengkap');
    const ar = d.find(e => e && e.edition && e.edition.identifier === TEXT_ED), tr = d.find(e => e && e.edition && e.edition.identifier === TRANS_ED);
    if (!ar || !tr || ar.number !== n || !isInt(ar.numberOfAyahs) || [ar, tr].some(e => !Array.isArray(e.ayahs) || e.ayahs.length !== ar.numberOfAyahs)) throw bad('jumlah ayat tidak cocok');
    return ar.ayahs.map((a, i) => {
      const t = tr.ayahs[i];
      if (!a || !t || a.numberInSurah !== i + 1 || t.numberInSurah !== i + 1 || typeof a.text !== 'string' || typeof t.text !== 'string' || !a.text.trim()) throw bad('ayat ' + (i + 1));
      return { n: i + 1, ar: i === 0 ? splitBismillah(a.text, n).text : a.text, id: t.text };
    });
  })();
  textCache.set(n, p);
  p.catch(() => textCache.delete(n)); // gagal: boleh dicoba lagi
  return p;
}
export async function loadAyat(n, from, to) {
  if (!isInt(n) || !isInt(from) || !isInt(to) || n < 1 || n > 114 || from < 1 || to < from || to - from > 5) throw bad('rujukan ayat');
  const all = await surahText(n);
  if (to > all.length) throw bad('ayat di luar surat');
  return all.slice(from - 1, to);
}

/* ===== Mode Mushaf: teks bersambung per halaman (604 halaman Mushaf Madinah) =====
   Nomor halaman, juz, dan pembagian ayat datang dari AlQuran Cloud. Surat tiap ayat dihitung dari nomor ayat global
   (nomor 1..6236) dan daftar jumlah ayat 114 surat, lalu dicocokkan dengan numberInSurah. BAITUNA tidak mengetik teks Qur'an. */
export const PAGES = 604, TOTAL_AYAH = 6236;
const MAX_PAGE_AYAH = 80;
let cumCache = null;
async function cumulative() {
  if (cumCache) return cumCache;
  const s = await listSurahs();
  const c = [0]; s.forEach(x => c.push(c[c.length - 1] + x.ayahs));
  if (c[114] !== TOTAL_AYAH) throw bad('jumlah ayat total tidak cocok');
  return (cumCache = c);
}
function locate(g, cum) { // nomor ayat global -> { s: nomor surat, n: nomor ayat dalam surat }
  if (!isInt(g) || g < 1 || g > TOTAL_AYAH) return null;
  let lo = 0, hi = 113;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cum[mid] < g) lo = mid; else hi = mid - 1; }
  return { s: lo + 1, n: g - cum[lo] };
}
const pageCache = new Map();
async function pageEditions(n, rec) {
  try {
    const d = await getJson('/page/' + n + '/editions/' + TEXT_ED + ',' + TRANS_ED + ',' + rec);
    if (Array.isArray(d) && d.length === 3) return d;
  } catch (e) { if (e && e.code === 'NETWORK') throw e; }
  // Cadangan: tiga permintaan terpisah bila titik akhir gabungan tidak tersedia.
  return Promise.all([TEXT_ED, TRANS_ED, rec].map(ed => getJson('/page/' + n + '/' + ed)));
}
export async function loadPage(n, reciter) {
  if (!isInt(n) || n < 1 || n > PAGES) throw bad('nomor halaman');
  const rec = RID.includes(reciter) ? reciter : RID[0], key = n + '|' + rec;
  if (pageCache.has(key)) return pageCache.get(key);
  const p = (async () => {
    const cum = await cumulative();
    const d = await pageEditions(n, rec);
    const by = id => d.find(e => e && e.edition && e.edition.identifier === id);
    const ar = by(TEXT_ED), tr = by(TRANS_ED), au = by(rec);
    if (!ar || !tr || !au) throw bad('edisi hilang');
    const L = Array.isArray(ar.ayahs) ? ar.ayahs.length : 0;
    if (L < 1 || L > MAX_PAGE_AYAH || [tr, au].some(e => !Array.isArray(e.ayahs) || e.ayahs.length !== L)) throw bad('jumlah ayat halaman tidak cocok');
    let prev = 0;
    const ayahs = ar.ayahs.map((a, i) => {
      const t = tr.ayahs[i], u = au.ayahs[i];
      if (!a || !t || !u || !isInt(a.number) || a.number !== t.number || a.number !== u.number) throw bad('nomor ayat tidak cocok');
      if (i > 0 && a.number !== prev + 1) throw bad('ayat tidak berurutan');
      prev = a.number;
      if (a.page !== undefined && a.page !== n) throw bad('halaman ayat tidak cocok');
      const loc = locate(a.number, cum);
      if (!loc || (a.numberInSurah !== undefined && a.numberInSurah !== loc.n)) throw bad('nomor ayat dalam surat tidak cocok');
      if (typeof a.text !== 'string' || !a.text.trim() || typeof t.text !== 'string' || typeof u.audio !== 'string' || !u.audio.startsWith(AUDIO_HOST) || !u.audio.endsWith('.mp3')) throw bad('isi ayat ' + a.number);
      let text = a.text, bism = '';
      if (loc.n === 1) { const r = splitBismillah(text, loc.s); bism = r.bismillah; text = r.text; }
      return { g: a.number, s: loc.s, n: loc.n, ar: text, bism, id: t.text, audio: u.audio, juz: isInt(a.juz) && a.juz >= 1 && a.juz <= 30 ? a.juz : 0 };
    });
    const surahs = await listSurahs();
    const out = { page: n, reciter: rec, ayahs, surahs: [...new Set(ayahs.map(a => a.s))].map(s => surahs[s - 1]), juz: [...new Set(ayahs.map(a => a.juz).filter(Boolean))] };
    return out;
  })();
  pageCache.set(key, p);
  p.catch(() => pageCache.delete(key)); // gagal: boleh dicoba lagi
  if (pageCache.size > 12) pageCache.delete(pageCache.keys().next().value);
  return p;
}
// Halaman mushaf tempat sebuah ayat berada (untuk lompat ke surat / ayat tertentu).
const ayahPageCache = new Map();
export async function pageOfAyah(s, a) {
  if (!isInt(s) || !isInt(a) || s < 1 || s > 114 || a < 1) throw bad('rujukan ayat');
  const k = s + ':' + a; if (ayahPageCache.has(k)) return ayahPageCache.get(k);
  const d = await getJson('/ayah/' + k + '/' + TEXT_ED);
  if (!d || !isInt(d.page) || d.page < 1 || d.page > PAGES || (d.numberInSurah !== undefined && d.numberInSurah !== a)) throw bad('halaman ayat');
  ayahPageCache.set(k, d.page); return d.page;
}
