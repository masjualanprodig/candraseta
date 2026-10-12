// BAITUNA - belajar-data.js
// Bahan belajar membaca Al-Qur'an dari dasar. Isinya hanya pengetahuan dasar yang baku (huruf hijaiyah, tanda baca,
// hukum bacaan dasar). TIDAK ada ayat, hadits, atau doa yang diketik di sini; ayat latihan diambil dari layanan Al-Qur'an
// (lihat quran-service.js). Semua murni (tanpa jaringan/DOM) agar bisa diuji.
export const ZWJ = '‍';
export const MARK = { fatha: 'َ', kasra: 'ِ', damma: 'ُ', fathatan: 'ً', dammatan: 'ٌ', kasratan: 'ٍ', sukun: 'ْ', shadda: 'ّ' };
export const PASS = 80; // nilai minimal lulus (%)
export const QUIZ_LEN = 10;

// ch = huruf; name = nama huruf; stem = bunyi dasar tanpa vokal; join = menyambung ke huruf sesudahnya
const L = (ch, name, stem, join = true) => ({ ch, name, stem, join });
export const LETTERS = [
  L('ا', 'Alif', '', false), L('ب', 'Ba', 'b'), L('ت', 'Ta', 't'), L('ث', 'Tsa', 'ts'), L('ج', 'Jim', 'j'), L('ح', 'Ḥa', 'ḥ'), L('خ', 'Kha', 'kh'),
  L('د', 'Dal', 'd', false), L('ذ', 'Dzal', 'dz', false), L('ر', 'Ra', 'r', false), L('ز', 'Zai', 'z', false), L('س', 'Sin', 's'), L('ش', 'Syin', 'sy'),
  L('ص', 'Shad', 'sh'), L('ض', 'Dhad', 'dh'), L('ط', 'Tha', 'th'), L('ظ', 'Zha', 'zh'), L('ع', '‘Ain', '‘'), L('غ', 'Ghain', 'gh'), L('ف', 'Fa', 'f'),
  L('ق', 'Qaf', 'q'), L('ك', 'Kaf', 'k'), L('ل', 'Lam', 'l'), L('م', 'Mim', 'm'), L('ن', 'Nun', 'n'), L('ه', 'Ha', 'h'), L('و', 'Wau', 'w', false), L('ي', 'Ya', 'y')
];
export const CONSONANTS = LETTERS.filter(l => l.ch !== 'ا'); // 27 huruf yang bisa diberi harakat
export const MAKHRAJ = [
  { t: 'Rongga mulut dan tenggorokan (Al-Jauf)', d: 'Tempat huruf mad: ا و ي' },
  { t: 'Tenggorokan (Al-Halq)', d: 'Pangkal: ء ه · Tengah: ع ح · Ujung: غ خ' },
  { t: 'Lidah (Al-Lisan)', d: 'ق ك ج ش ي ض ل ن ر ط د ت ص ز س ظ ذ ث' },
  { t: 'Bibir (Asy-Syafatain)', d: 'ب م و (dua bibir) · ف (gigi atas dengan bibir bawah)' },
  { t: 'Rongga hidung (Al-Khaisyum)', d: 'Tempat dengung (ghunnah) pada nun dan mim' }
];
export const SIMILAR = 'ب ت ث · ج ح خ · د ذ · ر ز · س ش · ص ض · ط ظ · ع غ · ف ق';

/* ---- bentuk huruf ---- */
export const forms = l => ({ alone: l.ch, initial: l.join ? l.ch + ZWJ : null, medial: l.join ? ZWJ + l.ch + ZWJ : null, final: ZWJ + l.ch });

/* ---- rangkaian harakat (glyph + bacaan latin) ---- */
export const vowelOf = { a: MARK.fatha, i: MARK.kasra, u: MARK.damma };
export const withVowel = (l, v) => ({ glyph: l.ch + vowelOf[v], read: l.stem + v });
export const withTanwin = (l, v) => ({ glyph: l.ch + { a: MARK.fathatan, i: MARK.kasratan, u: MARK.dammatan }[v], read: l.stem + v + 'n' });
export const sukunPair = (a, b) => ({ glyph: a.ch + MARK.fatha + b.ch + MARK.sukun, read: a.stem + 'a' + b.stem });
export const tasydid = (l, v = 'a') => ({ glyph: l.ch + MARK.shadda + vowelOf[v], read: l.stem + l.stem + v });
export const mad = (l, kind) => kind === 'a' ? { glyph: l.ch + MARK.fatha + 'ا', read: l.stem + 'aa' }
  : kind === 'i' ? { glyph: l.ch + MARK.kasra + 'ي', read: l.stem + 'ii' } : { glyph: l.ch + MARK.damma + 'و', read: l.stem + 'uu' };
export const SUKUN_SECOND = CONSONANTS.filter(l => l.ch !== 'و' && l.ch !== 'ي');
export const TASYDID_BASE = CONSONANTS.filter(l => l.ch !== 'ع');
// Contoh tetap untuk tabel sukun (pasangan huruf berurutan, tanpa acak)
export const SUKUN_SAMPLES = SUKUN_SECOND.map((b, i) => sukunPair(CONSONANTS[(i * 5 + 1) % CONSONANTS.length], b)).slice(0, 12);

/* ---- hukum bacaan dasar ---- */
export const NUN_RULES = [
  { key: 'izhhar', name: 'Izhhar', how: 'dibaca jelas, tanpa dengung', letters: 'ء ه ع ح غ خ' },
  { key: 'idgham-bighunnah', name: 'Idgham bighunnah', how: 'dilebur ke huruf berikutnya dengan dengung', letters: 'ي ن م و' },
  { key: 'idgham-bilaghunnah', name: 'Idgham bilaghunnah', how: 'dilebur ke huruf berikutnya tanpa dengung', letters: 'ل ر' },
  { key: 'iqlab', name: 'Iqlab', how: 'bunyi nun diganti mim dengan dengung', letters: 'ب' },
  { key: 'ikhfa', name: 'Ikhfa', how: 'dibaca samar dengan dengung', letters: 'ت ث ج د ذ ز س ش ص ض ط ظ ف ق ك' }
];
export const MIM_RULES = [
  { key: 'ikhfa-syafawi', name: 'Ikhfa syafawi', how: 'samar dengan dengung', letters: 'ب' },
  { key: 'idgham-mimi', name: 'Idgham mimi', how: 'dilebur dengan dengung', letters: 'م' },
  { key: 'izhhar-syafawi', name: 'Izhhar syafawi', how: 'dibaca jelas', letters: 'selain ب dan م' }
];
export const QALQALAH = 'ق ط ب ج د';
const lettersOf = r => r.letters.split(' ');
export const nunRuleFor = ch => (NUN_RULES.find(r => lettersOf(r).includes(ch)) || {}).key;

/* ---- tingkatan ---- */
export const LEVELS = [
  { id: 1, title: 'Mengenal Huruf Hijaiyah', desc: '28 huruf: bentuk dan namanya', kind: 'letters',
    intro: ['Huruf hijaiyah ada 28. Al-Qur’an ditulis dan dibaca dari kanan ke kiri.',
      'Kenali bentuk dan namanya dulu. Tidak perlu hafal semuanya sekaligus; ulangi sedikit demi sedikit, misalnya 4 sampai 5 huruf tiap sesi.',
      'Beberapa huruf bentuknya mirip dan dibedakan oleh titik: ' + SIMILAR + '.',
      'Bunyi sebagian huruf tidak ada padanannya dalam bahasa Indonesia. Minta guru memperdengarkan dan mengoreksi bacaan Anda.'] },
  { id: 2, title: 'Huruf Bersambung', desc: 'Bentuk huruf di awal, tengah, dan akhir', kind: 'forms',
    intro: ['Dalam tulisan, kebanyakan huruf berubah bentuk menurut tempatnya: di awal, tengah, atau akhir kata.',
      'Enam huruf tidak menyambung ke huruf sesudahnya: ا د ذ ر ز و. Karena itu keenamnya tidak punya bentuk awal dan tengah.',
      'Tampilan bentuk huruf mengikuti font di perangkat Anda, jadi bisa sedikit berbeda antar HP.'] },
  { id: 3, title: 'Harakat: Fathah, Kasrah, Dhammah', desc: 'Tanda baca a, i, u', kind: 'harakat',
    intro: ['Harakat adalah tanda baca yang menentukan bunyi huruf.',
      'Fathah (garis kecil miring di atas huruf) dibaca “a”. Kasrah (garis kecil di bawah huruf) dibaca “i”. Dhammah (tanda seperti waw kecil di atas huruf) dibaca “u”.',
      'Contoh: ب dengan fathah dibaca “ba”, dengan kasrah “bi”, dengan dhammah “bu”.'] },
  { id: 4, title: 'Tanwin', desc: 'Tanda baca an, in, un', kind: 'tanwin',
    intro: ['Tanwin adalah harakat ganda di akhir kata benda: dua fathah dibaca “an”, dua kasrah “in”, dua dhammah “un”.',
      'Di Al-Qur’an tanwin hanya muncul di akhir kata. Di sini dilatih per huruf supaya mata dan lidah terbiasa.'] },
  { id: 5, title: 'Sukun dan Tasydid', desc: 'Huruf mati dan huruf rangkap', kind: 'sukun',
    intro: ['Sukun (lingkaran kecil di atas huruf) berarti huruf itu mati: dibaca tanpa vokal dan menyatu dengan huruf sebelumnya. Contoh: بَتْ dibaca “bat”.',
      'Tasydid (tanda seperti huruf “w” kecil di atas huruf) berarti huruf dibaca dobel: yang pertama mati, yang kedua hidup. Contoh: بَّ dibaca “bba”.'] },
  { id: 6, title: 'Bacaan Panjang (Mad)', desc: 'Mad thabi’i: dibaca dua harakat', kind: 'mad',
    intro: ['Mad thabi’i dibaca panjang dua harakat (kira-kira dua ketukan): fathah diikuti alif, kasrah diikuti ya, dhammah diikuti waw.',
      'Contoh: بَا “baa”, بِي “bii”, بُو “buu”.',
      'Jenis mad yang lain (mad wajib, jaiz, lazim, dan seterusnya) dipelajari bersama guru.'] },
  { id: 7, title: 'Hukum Bacaan Dasar', desc: 'Nun sukun, mim sukun, qalqalah', kind: 'tajwid',
    intro: ['Tajwid adalah aturan membaca agar huruf keluar dengan benar. Ini hukum dasar yang paling sering ditemui.',
      'Dengung (ghunnah) ditahan kira-kira dua harakat. Cara mengucapkannya sebaiknya didengar langsung dari guru.',
      'Hukum lain (ra tebal dan tipis, lam jalalah, mad far’i, waqaf dan ibtida, dan lainnya) dipelajari bersama guru.'] },
  { id: 8, title: 'Membaca Surat Pendek', desc: 'Latihan membaca ayat sampai lancar', kind: 'practice',
    intro: ['Saatnya membaca ayat sungguhan. Mulai dari surat yang pendek.',
      'Bacalah pelan-pelan, perhatikan harakat, mad, dan hukum yang sudah dipelajari. Bila ada yang ragu, tanyakan kepada guru.',
      'Tandai “sudah lancar” pada surat yang Anda rasa sudah lancar. Penilaian ini dari Anda sendiri, jadi jujurlah pada diri sendiri.'] }
];
// Surat latihan, dari yang paling pendek. Hanya nomor surat; teksnya diambil dari layanan Al-Qur'an.
export const PRACTICE_SURAHS = [1, 114, 113, 112, 111, 110, 109, 108, 107, 106, 105, 104, 103];

/* ---- kuis ---- */
export function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const shuffle = (arr, rng = Math.random) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const uniq = arr => [...new Set(arr)];
// Susun soal: jawaban benar + 3 pengecoh berbeda, diacak. Posisi jawaban benar dicatat di "answer".
function mkQ(prompt, glyph, correct, pool, rng, exp, n = 4) {
  const wrong = shuffle(uniq(pool.filter(x => x !== correct)), rng).slice(0, n - 1);
  const options = shuffle([correct, ...wrong], rng);
  return { prompt, glyph, options, answer: options.indexOf(correct), exp };
}

const GEN = {
  1(rng) {
    const l = pick(LETTERS, rng);
    if (rng() < 0.5) return mkQ('Apa nama huruf ini?', l.ch, l.name, LETTERS.map(x => x.name), rng, l.ch + ' = ' + l.name);
    return mkQ('Mana huruf yang bernama “' + l.name + '”?', '', l.ch, LETTERS.map(x => x.ch), rng, l.ch + ' = ' + l.name);
  },
  2(rng) {
    const l = pick(LETTERS, rng), f = forms(l), kinds = ['final'].concat(l.join ? ['initial', 'medial'] : []);
    const k = pick(kinds, rng), nm = { initial: 'awal', medial: 'tengah', final: 'akhir' }[k];
    return mkQ('Ini huruf apa? (bentuk ' + nm + ')', f[k], l.name, LETTERS.map(x => x.name), rng, 'Bentuk ' + nm + ' dari ' + l.ch + ' (' + l.name + ')');
  },
  3(rng) {
    const l = pick(CONSONANTS, rng), v = pick(['a', 'i', 'u'], rng), w = withVowel(l, v);
    const pool = ['a', 'i', 'u'].map(x => withVowel(l, x).read).concat(['a', 'i', 'u'].map(x => withVowel(pick(CONSONANTS, rng), x).read));
    return mkQ('Bagaimana cara membacanya?', w.glyph, w.read, pool, rng, w.glyph + ' dibaca “' + w.read + '”');
  },
  4(rng) {
    const l = pick(CONSONANTS, rng), v = pick(['a', 'i', 'u'], rng), w = withTanwin(l, v);
    const pool = ['a', 'i', 'u'].map(x => withTanwin(l, x).read).concat(['a', 'i', 'u'].map(x => withVowel(l, x).read));
    return mkQ('Bagaimana cara membacanya?', w.glyph, w.read, pool, rng, w.glyph + ' dibaca “' + w.read + '”');
  },
  5(rng) {
    if (rng() < 0.5) {
      const a = pick(CONSONANTS, rng), b = pick(SUKUN_SECOND, rng), w = sukunPair(a, b);
      const pool = [withVowel(a, 'a').read + withVowel(b, 'a').read, w.read + 'a', withVowel(a, 'i').read + b.stem, a.stem + 'a', a.stem + 'i' + b.stem, a.stem + 'u' + b.stem];
      return mkQ('Bagaimana cara membacanya? (huruf kedua bertanda sukun)', w.glyph, w.read, pool, rng, w.glyph + ' dibaca “' + w.read + '”: huruf kedua mati');
    }
    const l = pick(TASYDID_BASE, rng), v = pick(['a', 'i', 'u'], rng), w = tasydid(l, v);
    const pool = [l.stem + v, l.stem + l.stem + 'a', l.stem + l.stem + 'i', l.stem + l.stem + 'u', l.stem + v + l.stem];
    return mkQ('Bagaimana cara membacanya? (bertanda tasydid)', w.glyph, w.read, pool, rng, w.glyph + ' dibaca “' + w.read + '”: huruf dibaca dobel');
  },
  6(rng) {
    const l = pick(CONSONANTS, rng), k = pick(['a', 'i', 'u'], rng), w = mad(l, k);
    const pool = ['a', 'i', 'u'].map(x => mad(l, x).read).concat(['a', 'i', 'u'].map(x => withVowel(l, x).read));
    return mkQ('Bagaimana cara membacanya? (perhatikan panjang pendeknya)', w.glyph, w.read, pool, rng, w.glyph + ' dibaca “' + w.read + '”: panjang dua harakat');
  },
  7(rng) {
    const t = rng();
    if (t < 0.5) {
      const letters = NUN_RULES.flatMap(lettersOf), ch = pick(letters, rng), key = nunRuleFor(ch), r = NUN_RULES.find(x => x.key === key);
      return mkQ('Nun sukun atau tanwin bertemu huruf di bawah ini. Apa hukum bacanya?', ch, r.name, NUN_RULES.map(x => x.name), rng, 'Nun sukun/tanwin bertemu ' + ch + ' = ' + r.name + ' (' + r.how + ')');
    }
    if (t < 0.75) {
      const ch = pick(['ب', 'م', 'ت', 'ك', 'ح', 'ل', 'ن'], rng), r = MIM_RULES.find(x => x.key === (ch === 'ب' ? 'ikhfa-syafawi' : ch === 'م' ? 'idgham-mimi' : 'izhhar-syafawi'));
      return mkQ('Mim sukun bertemu huruf di bawah ini. Apa hukum bacanya?', ch, r.name, MIM_RULES.map(x => x.name), rng, 'Mim sukun bertemu ' + ch + ' = ' + r.name + ' (' + r.how + ')', 3);
    }
    const q = QALQALAH.split(' '), ch = pick(q, rng), wrongs = shuffle(CONSONANTS.map(x => x.ch).filter(c => !q.includes(c) && c !== 'ا'), rng).slice(0, 3);
    return mkQ('Huruf mana yang termasuk huruf qalqalah?', '', ch, [...wrongs], rng, 'Huruf qalqalah: ' + QALQALAH + ' (dipantulkan saat mati)');
  }
};
export function makeQuiz(level, rng = Math.random, n = QUIZ_LEN) {
  const g = GEN[level]; if (!g) return [];
  const out = [], seen = new Set();
  for (let guard = 0; out.length < n && guard < n * 40; guard++) {
    const q = g(rng), key = q.prompt + '|' + q.glyph + '|' + q.options[q.answer];
    if (seen.has(key)) continue; seen.add(key); out.push(q);
  }
  return out;
}
export const hasQuiz = level => !!GEN[level];
