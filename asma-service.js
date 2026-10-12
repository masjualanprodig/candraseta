// BAITUNA - asma-service.js
// Asmaul Husna: data statis (asmaul-husna.json), audio opsional (asmaul-husna-audio.json), favorit/hafalan/kuis di perangkat.
// Data selalu divalidasi; bila janggal, ditolak (tidak menampilkan daftar setengah benar). Bagian murni dites terpisah.
export const DATA_URL = './asmaul-husna.json', AUDIO_URL = './asmaul-husna-audio.json';
export const KEY = 'baituna.asma.v1';
export const QUIZ_LEN = 10, PASS = 80;
const bad = m => Object.assign(new Error(m), { code: 'BAD_DATA' });
const AR = /[؀-ۿ]/;
const str = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;

export function validateData(j) {
  if (!j || typeof j !== 'object' || !j.meta || !Array.isArray(j.names) || j.names.length !== 99) throw bad('daftar tidak lengkap');
  const names = j.names.map((n, i) => {
    if (!n || n.no !== i + 1 || !str(n.arab, 60) || !AR.test(n.arab) || !str(n.latin, 60) || !str(n.arti, 100) || !str(n.penjelasan, 400)) throw bad('nama ke-' + (i + 1));
    return { no: n.no, arab: n.arab, latin: n.latin, arti: n.arti, penjelasan: n.penjelasan };
  });
  const m = j.meta, refs = Array.isArray(m.ayatUmum) ? m.ayatUmum.filter(r => r && Number.isInteger(r.surah) && r.surah >= 1 && r.surah <= 114 && Number.isInteger(r.from) && Number.isInteger(r.to) && r.from >= 1 && r.to >= r.from && r.to - r.from <= 5) : [];
  return { names, meta: { sumberDaftar: str(m.sumberDaftar, 800) ? m.sumberDaftar : '', sumberArti: str(m.sumberArti, 800) ? m.sumberArti : '', ayatUmum: refs } };
}
let cache = null;
export async function loadAsma() {
  if (cache) return cache;
  let res;
  try { res = await fetch(DATA_URL); } catch (e) { throw Object.assign(new Error('jaringan'), { code: 'NETWORK' }); }
  if (!res.ok) throw Object.assign(new Error('http ' + res.status), { code: 'HTTP', status: res.status });
  let j; try { j = await res.json(); } catch (e) { throw bad('bukan JSON'); }
  cache = validateData(j);
  return cache;
}

// Audio: hanya nama yang BERKAS-nya didaftarkan di manifes yang dianggap punya audio. Manifes rusak/tidak ada = tanpa audio.
export function parseAudio(j) {
  const out = {};
  if (!j || typeof j !== 'object' || typeof j.basePath !== 'string' || !j.files || typeof j.files !== 'object') return out;
  const base = j.basePath;
  if (!/^[A-Za-z0-9_\-/]{1,60}\/$/.test(base) || base.startsWith('/') || base.includes('..')) return out;
  for (const [k, f] of Object.entries(j.files)) {
    const n = Number(k);
    if (Number.isInteger(n) && n >= 1 && n <= 99 && typeof f === 'string' && /^[A-Za-z0-9_\-]{1,40}\.(mp3|m4a|ogg|wav)$/.test(f)) out[n] = './' + base + f;
  }
  return out;
}
export async function loadAudioMap() {
  try { const r = await fetch(AUDIO_URL); if (!r.ok) return {}; return parseAudio(await r.json()); } catch (e) { return {}; }
}

/* ===== Pencarian ===== */
// Arab: buang harakat dan tatwil, samakan bentuk alif/ya. Latin: huruf kecil, tanpa tanda baca.
export const normArab = s => String(s || '').replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ۖ|ۗ/g, '');
export const normLatin = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’‘`ʼʻ\-]/g, '').replace(/\s+/g, ' ').trim();
export function matches(n, q) {
  const raw = String(q || '').trim();
  if (!raw) return true;
  const hayL = normLatin(n.latin + ' ' + n.arti), hayA = normArab(n.arab), compactL = hayL.replace(/ /g, '');
  return raw.split(/\s+/).every(t => {
    if (AR.test(t)) return hayA.includes(normArab(t));
    const x = normLatin(t); return x === '' || hayL.includes(x) || compactL.includes(x);
  });
}

/* ===== Kemajuan di perangkat ===== */
export const emptyProgress = () => ({ v: 1, fav: [], hafal: [], quiz: null });
const nums = a => Array.isArray(a) ? [...new Set(a.filter(n => Number.isInteger(n) && n >= 1 && n <= 99))].sort((x, y) => x - y) : [];
export function loadProgress() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!o || typeof o !== 'object') return emptyProgress();
    const q = o.quiz && Number.isFinite(o.quiz.best) && o.quiz.best >= 0 && o.quiz.best <= 100 ? { best: Math.round(o.quiz.best), attempts: Number.isInteger(o.quiz.attempts) && o.quiz.attempts > 0 && o.quiz.attempts < 100000 ? o.quiz.attempts : 1 } : null;
    return { v: 1, fav: nums(o.fav), hafal: nums(o.hafal), quiz: q };
  } catch (e) { return emptyProgress(); }
}
export const saveProgress = p => { try { localStorage.setItem(KEY, JSON.stringify(p)); return true; } catch (e) { return false; } };
const flip = (arr, n) => arr.includes(n) ? arr.filter(x => x !== n) : [...arr, n].sort((a, b) => a - b);
export const toggleFav = (p, n) => ({ ...p, fav: flip(p.fav, n) });
export const toggleHafal = (p, n) => ({ ...p, hafal: flip(p.hafal, n) });
export const scoreOf = (c, t) => t > 0 ? Math.round(c / t * 100) : 0;
export const recordQuiz = (p, score) => ({ ...p, quiz: { best: Math.max(p.quiz ? p.quiz.best : 0, score), attempts: (p.quiz ? p.quiz.attempts : 0) + 1 } });

/* ===== Kuis hafalan ===== */
// Nama yang artinya/nama Latinnya kembar tidak dipakai sebagai jawaban benar; nama yang maknanya berdekatan tidak dijadikan pengecoh satu sama lain.
const NEAR = [[14, 34], [48, 65], [66, 67], [69, 70]];
const sameGroup = (a, b) => NEAR.some(g => g.includes(a) && g.includes(b));
export const shuffle = (arr, rng = Math.random) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export function makeQuiz(names, rng = Math.random, n = QUIZ_LEN) {
  const count = (k, v) => names.filter(x => x[k] === v).length;
  const uniq = k => names.filter(x => count(k, x[k]) === 1);
  const uArti = uniq('arti'), uLatin = uniq('latin');
  const types = ['arab-arti', 'arti-latin', 'arab-latin'];
  const out = [], seen = new Set();
  for (let guard = 0; out.length < n && guard < n * 60; guard++) {
    const t = types[Math.floor(rng() * types.length)];
    const pool = t === 'arab-latin' ? uLatin : uArti, field = t === 'arab-arti' ? 'arti' : 'latin';
    const c = pool[Math.floor(rng() * pool.length)];
    const key = t + c.no; if (seen.has(key)) continue;
    const dpool = (field === 'arti' ? uArti : uLatin).filter(x => x.no !== c.no && !sameGroup(x.no, c.no));
    const wrong = shuffle(dpool, rng).slice(0, 3).map(x => x[field]);
    const options = shuffle([c[field], ...wrong], rng);
    seen.add(key);
    out.push({ no: c.no, type: t, prompt: t === 'arti-latin' ? 'Nama manakah yang artinya “' + c.arti + '”?' : t === 'arab-arti' ? 'Apa arti nama ini?' : 'Bagaimana cara menulis nama ini dalam huruf Latin?',
      glyph: t === 'arti-latin' ? '' : c.arab, options, answer: options.indexOf(c[field]) });
  }
  return out;
}
export const shareText = n => 'Asmaul Husna ke-' + n.no + ': ' + n.arab + ' (' + n.latin + ') berarti ' + n.arti + '.\n\nBAITUNA';
