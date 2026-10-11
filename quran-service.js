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
