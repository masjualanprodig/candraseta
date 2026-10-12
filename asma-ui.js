// BAITUNA - asma-ui.js
// Asmaul Husna: daftar + pencarian, detail, favorit, tandai hafal, kuis hafalan, dan audio (tampil hanya bila berkas suara tersedia).
import { h, toast } from './ui.js';
import { loadAsma, loadAudioMap, matches, loadProgress, saveProgress, toggleFav, toggleHafal, recordQuiz, scoreOf, makeQuiz, shareText, QUIZ_LEN, PASS } from './asma-service.js';
import { loadAyat } from './quran-service.js';
import { applyReadingPrefs } from './quran-ui.js';

const AR = /[؀-ۿ]/;
const ar = (t, cls = '') => h('span', { class: 'bj-ar ' + cls, lang: 'ar', dir: 'rtl' }, t);
const mixed = t => String(t).split(/([؀-ۿ‍]+)/).map(x => AR.test(x) ? ar(x, 'inl') : x);
const ICON = { play: '▶', pause: '⏸', stop: '■', replay: '↺', load: '…', star: '★', starOff: '☆' };

async function copy(text) { try { await navigator.clipboard.writeText(text); toast('Disalin.'); } catch (e) { toast('Tidak bisa menyalin di perangkat ini.', true); } }
async function share(text) {
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    const w = window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
    if (!w) toast('Tidak bisa membuka WhatsApp. Gunakan tombol Salin.', true);
  } catch (e) { if (e && e.name === 'AbortError') return; toast('Tidak bisa membagikan. Gunakan tombol Salin.', true); }
}

/* ---- pemutar audio: satu elemen untuk seluruh halaman ---- */
function makePlayer(map, notify) {
  const el = new Audio(); el.preload = 'none';
  let cur = null, st = 'idle', queue = [], msg = '';
  const set = (s, n) => { st = s; if (n !== undefined) cur = n; notify(); };
  const fail = () => { msg = navigator.onLine === false ? 'Audio membutuhkan koneksi internet.' : 'Audio belum bisa diputar. Periksa koneksi, lalu coba lagi.'; queue = []; set('error'); toast(msg, true); };
  function start(n) {
    if (!map[n]) { if (queue.length) start(queue.shift()); else set('idle', null); return; }
    if (navigator.onLine === false) { cur = n; fail(); return; }
    msg = ''; el.src = map[n]; set('loading', n);
    const p = el.play(); if (p && p.catch) p.catch(e => { if (e && e.name === 'AbortError') return; fail(); });
  }
  el.addEventListener('playing', () => set('playing'));
  el.addEventListener('pause', () => { if (st === 'playing') set('paused'); });
  el.addEventListener('ended', () => { if (queue.length) start(queue.shift()); else set('idle', null); });
  el.addEventListener('error', () => { if (st !== 'idle') fail(); });
  return {
    has: n => !!map[n], any: () => Object.keys(map).length > 0, list: () => Object.keys(map).map(Number).sort((a, b) => a - b),
    state: n => cur === n ? st : 'idle', current: () => cur, active: () => st !== 'idle', message: () => msg,
    play: n => { queue = []; start(n); },
    toggle(n) { if (cur === n && st === 'playing') el.pause(); else if (cur === n && st === 'paused') { const p = el.play(); if (p && p.catch) p.catch(() => fail()); } else { queue = []; start(n); } },
    replay(n) { queue = []; if (cur === n && st !== 'error' && el.src) { el.currentTime = 0; const p = el.play(); if (p && p.catch) p.catch(() => fail()); set('loading', n); } else start(n); },
    stop() { queue = []; st = 'idle'; cur = null; el.pause(); try { el.currentTime = 0; } catch (e) {} notify(); },
    playAll(fromNo) { const l = this.list().filter(n => n >= fromNo); queue = l.slice(1); if (l.length) start(l[0]); }
  };
}

export function asmaPage() {
  const wrap = h('div', { class: 'asma' });
  applyReadingPrefs(wrap);
  let data = null, loadErr = null, prog = loadProgress(), player = null;
  let view = 'list', q = '', filter = 'semua', detailNo = null, scrollY = 0, quiz = null, ayat = null;
  const save = () => { if (!saveProgress(prog)) toast('Belum bisa disimpan di perangkat ini.', true); };
  const byNo = n => data.names[n - 1];

  // Bagian tetap (tidak digambar ulang saat mengetik)
  const search = h('input', { class: 'in', type: 'search', placeholder: 'Cari nama (Arab, Latin, atau arti)', 'aria-label': 'Cari nama', maxlength: '60', autocomplete: 'off' });
  search.addEventListener('input', () => { q = search.value; drawList(); });
  const sum = h('div', { class: 'panel dsum' }), chips = h('div', { class: 'achips', role: 'tablist', 'aria-label': 'Tampilan daftar' }), now = h('div', { class: 'as-now', role: 'status', hidden: true }), list = h('div', { class: 'as-list' });
  const content = h('div');

  /* ---- tombol audio ---- */
  function audioBtn(n, big) {
    if (!player || !player.has(n)) return '';
    const s = player.state(n), nm = byNo(n).latin;
    const b = h('button', { class: 'as-aud' + (big ? ' big' : '') + ' ' + s, type: 'button', 'aria-label': (s === 'playing' ? 'Jeda ' : 'Putar ') + nm, onclick: ev => { ev.stopPropagation(); player.toggle(n); } },
      s === 'loading' ? ICON.load : s === 'playing' ? ICON.pause : s === 'error' ? ICON.replay : ICON.play);
    return b;
  }
  function paintNow() {
    if (!player || !player.active()) { now.hidden = true; now.replaceChildren(); return; }
    const n = player.current(), s = n ? player.state(n) : 'idle', nm = n ? byNo(n).latin : '';
    now.hidden = false;
    now.replaceChildren(h('span', {}, s === 'loading' ? 'Memuat audio ' + nm + '…' : s === 'error' ? player.message() : s === 'paused' ? 'Dijeda: ' + nm : 'Memutar: ' + nm),
      n && s !== 'error' ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => player.toggle(n) }, s === 'playing' ? 'Jeda' : 'Lanjut') : '',
      h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => player.stop() }, 'Berhenti'));
  }
  const onAudio = () => { paintNow(); if (view === 'list') drawList(); else if (view === 'detail') drawDetail(); };

  /* ---- daftar ---- */
  function paintSum() {
    const n = prog.hafal.length;
    sum.replaceChildren(h('p', { class: 'dsum-t' }, n + ' dari 99 nama sudah Anda tandai hafal.'),
      h('div', { class: 'dbar', role: 'img', 'aria-label': n + ' dari 99 nama hafal' }, h('i', { style: 'width:' + Math.round(n / 99 * 100) + '%' })),
      h('div', { class: 'row-btns' },
        h('button', { class: 'btn-sm', type: 'button', onclick: startQuiz }, 'Kuis hafalan'),
        player && player.any() ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => player.playAll(1) }, '▶ Putar berurutan') : ''),
      prog.quiz ? h('p', { class: 'muted as-q' }, 'Nilai kuis terbaik ' + prog.quiz.best + '% · ' + prog.quiz.attempts + ' kali mencoba') : '');
  }
  function drawChips() {
    const mk = (k, l) => h('button', { class: 'achip', type: 'button', role: 'tab', 'aria-selected': String(filter === k), onclick: () => { filter = k; drawChips(); drawList(); } }, l);
    chips.replaceChildren(mk('semua', 'Semua'), mk('favorit', '★ Favorit' + (prog.fav.length ? ' (' + prog.fav.length + ')' : '')), mk('belum', 'Belum hafal (' + (99 - prog.hafal.length) + ')'));
  }
  function card(n) {
    const fav = prog.fav.includes(n.no), hafal = prog.hafal.includes(n.no);
    const star = h('button', { class: 'as-star' + (fav ? ' on' : ''), type: 'button', 'aria-pressed': String(fav), 'aria-label': (fav ? 'Hapus dari favorit: ' : 'Tambah ke favorit: ') + n.latin,
      onclick: ev => { ev.stopPropagation(); prog = toggleFav(prog, n.no); save(); drawChips(); drawList(); } }, fav ? ICON.star : ICON.starOff);
    const main = h('button', { class: 'as-main', type: 'button', 'aria-label': 'Buka detail ' + n.latin, onclick: () => openDetail(n.no) },
      h('span', { class: 'as-no' + (hafal ? ' ok' : '') }, hafal ? '✓' : String(n.no)),
      h('span', { class: 'as-tx' }, h('b', {}, n.latin), h('span', { class: 'muted' }, n.arti)),
      ar(n.arab, 'as-ar'));
    return h('div', { class: 'as-card panel', 'data-no': String(n.no) }, main, h('span', { class: 'as-side' }, audioBtn(n.no), star));
  }
  function drawList() {
    if (!data) return;
    let rows = data.names.filter(n => (filter === 'semua' || (filter === 'favorit' ? prog.fav.includes(n.no) : !prog.hafal.includes(n.no))) && matches(n, q));
    if (!rows.length) {
      list.replaceChildren(h('div', { class: 'empty as-empty' }, h('p', { class: 'muted' }, q.trim() ? 'Tidak ada nama yang cocok dengan “' + q.trim() + '”.' : filter === 'favorit' ? 'Belum ada nama favorit. Ketuk ☆ pada nama yang ingin dipelajari lagi.' : 'Semua nama sudah Anda tandai hafal. Alhamdulillah.')));
      return;
    }
    list.replaceChildren(h('p', { class: 'muted dcount' }, rows.length + ' nama'), ...rows.map(card));
  }
  const note = () => h('div', { class: 'panel qnote' }, h('h3', {}, 'Tentang halaman ini'),
    h('p', { class: 'muted' }, data.meta.sumberDaftar), h('p', { class: 'muted' }, data.meta.sumberArti),
    h('p', { class: 'muted' }, player && player.any() ? 'Tombol suara muncul pada nama yang rekamannya tersedia. Audio membutuhkan koneksi internet.' : 'Audio pelafalan belum tersedia dan akan ditambahkan setelah ada rekaman dari guru atau qari. Untuk mendengar bacaan yang benar, belajarlah langsung kepada guru. Favorit, tanda hafal, dan nilai kuis hanya tersimpan di perangkat ini.'));
  function drawListView() {
    view = 'list';
    content.replaceChildren(h('h2', { class: 'wtitle' }, 'Asmaul Husna'), h('p', { class: 'muted' }, ' 99 nama Allah yang baik. Pelajari, tandai yang sudah hafal, lalu uji diri dengan kuis.'),
      sum, now, search, chips, list, note());
    paintSum(); drawChips(); paintNow(); drawList();
  }

  /* ---- detail ---- */
  function openDetail(no) { scrollY = window.scrollY; detailNo = no; ayat = null; view = 'detail'; drawDetail(); window.scrollTo(0, 0); }
  function backToList() { drawListView(); window.scrollTo(0, scrollY); }
  async function showAyat(box, btn) {
    btn.disabled = true; btn.textContent = 'Memuat…'; box.replaceChildren();
    try {
      const out = [];
      for (const r of data.meta.ayatUmum) out.push({ r, a: await loadAyat(r.surah, r.from, r.to) });
      ayat = out; if (view === 'detail') drawDetail();
    } catch (e) { btn.disabled = false; btn.textContent = 'Tampilkan ayat'; box.replaceChildren(h('p', { class: 'muted' }, 'Ayat belum bisa dimuat. Periksa koneksi internet, lalu coba lagi.')); }
  }
  function drawDetail() {
    const n = byNo(detailNo), fav = prog.fav.includes(n.no), hafal = prog.hafal.includes(n.no), s = player ? player.state(n.no) : 'idle';
    const audio = player && player.has(n.no) ? h('div', { class: 'as-audgroup', role: 'group', 'aria-label': 'Audio ' + n.latin },
      audioBtn(n.no, true),
      h('button', { class: 'as-aud big', type: 'button', 'aria-label': 'Berhenti', onclick: () => player.stop() }, ICON.stop),
      h('button', { class: 'as-aud big', type: 'button', 'aria-label': 'Putar ulang ' + n.latin, onclick: () => player.replay(n.no) }, ICON.replay),
      s === 'loading' ? h('span', { class: 'muted' }, 'Memuat…') : s === 'error' ? h('span', { class: 'hint jerr' }, player.message()) : '') : '';
    if (audio && audio.querySelector('[aria-label="Berhenti"]')) audio.querySelector('[aria-label="Berhenti"]').disabled = s === 'idle';
    const refBox = h('div', { class: 'as-ayat' });
    const ayatBtn = h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => showAyat(refBox, ayatBtn) }, 'Tampilkan ayat');
    content.replaceChildren(
      h('button', { class: 'btn-sm ghost', type: 'button', onclick: backToList }, '← Daftar nama'),
      h('div', { class: 'panel as-hero' },
        h('p', { class: 'muted' }, 'Nama ke-' + n.no + ' dari 99'),
        h('div', { class: 'as-bigar' }, ar(n.arab, 'huge')),
        h('h2', { class: 'as-latin' }, n.latin), h('p', { class: 'as-arti' }, n.arti), audio),
      h('div', { class: 'panel' }, h('h3', {}, 'Penjelasan singkat'), h('p', {}, n.penjelasan), h('p', { class: 'muted as-src' }, 'Penjelasan ini hanya menerangkan makna bahasa dan belum ditinjau ustaz.')),
      h('div', { class: 'row-btns as-acts' },
        h('button', { class: 'btn-sm' + (fav ? '' : ' ghost'), type: 'button', 'aria-pressed': String(fav), onclick: () => { prog = toggleFav(prog, n.no); save(); drawDetail(); } }, fav ? '★ Favorit' : '☆ Tambah favorit'),
        h('button', { class: 'btn-sm' + (hafal ? '' : ' ghost'), type: 'button', 'aria-pressed': String(hafal), onclick: () => { prog = toggleHafal(prog, n.no); save(); drawDetail(); } }, hafal ? '✓ Sudah hafal' : 'Tandai sudah hafal'),
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => copy(shareText(n)) }, 'Salin'),
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => share(shareText(n)) }, 'Bagikan')),
      h('div', { class: 'panel' }, h('h3', {}, 'Dalam Al-Qur’an'),
        h('p', { class: 'muted' }, 'Allah memiliki Asmaul Husna (QS. Al-A‘raf 7:180), dan sejumlah nama disebut berturut-turut dalam QS. Al-Hasyr 59:22–24. Teks ayat dimuat dari layanan Al-Qur’an, bukan diketik oleh aplikasi.'),
        ayat ? ayat.map(x => h('div', { class: 'as-ay' }, h('p', { class: 'dsrc' }, h('b', {}, 'QS. ' + x.r.surah + ':' + x.r.from + (x.r.to > x.r.from ? '–' + x.r.to : ''))), ...x.a.map(a => h('div', {}, h('p', { class: 'arab', lang: 'ar', dir: 'rtl' }, a.ar), h('p', { class: 'muted' }, a.id))))) : ayatBtn, refBox),
      h('div', { class: 'row-btns as-nav' },
        n.no > 1 ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { detailNo = n.no - 1; ayat = null; drawDetail(); window.scrollTo(0, 0); } }, '← ' + byNo(n.no - 1).latin) : '',
        n.no < 99 ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { detailNo = n.no + 1; ayat = null; drawDetail(); window.scrollTo(0, 0); } }, byNo(n.no + 1).latin + ' →') : ''));
  }

  /* ---- kuis ---- */
  function startQuiz() { if (player) player.stop(); quiz = { qs: makeQuiz(data.names), i: 0, picked: null, ok: 0, wrong: [] }; view = 'quiz'; drawQuiz(); window.scrollTo(0, 0); }
  function drawQuiz() {
    const v = quiz;
    if (v.i >= v.qs.length) { drawResult(); return; }
    const qq = v.qs[v.i], answered = v.picked !== null;
    const opts = qq.options.map((o, idx) => {
      const b = h('button', { class: 'bj-opt' + (answered ? (idx === qq.answer ? ' ok' : idx === v.picked ? ' bad' : '') : ''), type: 'button', 'aria-pressed': String(v.picked === idx) }, o);
      b.disabled = answered;
      b.addEventListener('click', () => { if (v.picked !== null) return; v.picked = idx; if (idx === qq.answer) v.ok++; else v.wrong.push(qq.no); drawQuiz(); });
      return b;
    });
    const n = byNo(qq.no);
    content.replaceChildren(h('button', { class: 'btn-sm ghost', type: 'button', onclick: backToList }, '← Keluar kuis'),
      h('h2', { class: 'wtitle mt' }, 'Kuis hafalan'), h('p', { class: 'muted' }, 'Soal ' + (v.i + 1) + ' dari ' + v.qs.length),
      h('div', { class: 'dbar', role: 'img', 'aria-label': 'Soal ' + (v.i + 1) + ' dari ' + v.qs.length }, h('i', { style: 'width:' + Math.round(v.i / v.qs.length * 100) + '%' })),
      h('div', { class: 'panel bj-q' }, h('p', { class: 'bj-prompt' }, qq.prompt), qq.glyph ? h('div', { class: 'bj-qglyph' }, ar(qq.glyph, 'huge')) : '',
        h('div', { class: 'bj-opts' }, ...opts),
        answered ? h('div', { class: 'bj-fb ' + (v.picked === qq.answer ? 'ok' : 'bad'), role: 'status' }, h('b', {}, v.picked === qq.answer ? 'Benar. ' : 'Belum tepat. '), ...mixed(n.arab + ' (' + n.latin + ') berarti ' + n.arti + '.')) : '',
        answered ? h('button', { class: 'btn-primary', type: 'button', onclick: () => { v.i++; v.picked = null; if (v.i >= v.qs.length) { prog = recordQuiz(prog, scoreOf(v.ok, v.qs.length)); save(); } drawQuiz(); window.scrollTo(0, 0); } }, v.i + 1 >= v.qs.length ? 'Lihat hasil' : 'Soal berikutnya') : ''));
  }
  function drawResult() {
    const v = quiz, score = scoreOf(v.ok, v.qs.length), ok = score >= PASS, wrong = [...new Set(v.wrong)];
    content.replaceChildren(h('h2', { class: 'wtitle' }, 'Hasil kuis hafalan'),
      h('div', { class: 'panel bj-result ' + (ok ? 'ok' : 'try') }, h('b', { class: 'bj-score' }, score + '%'),
        h('p', {}, v.ok + ' dari ' + v.qs.length + ' soal benar.'),
        h('p', {}, ok ? 'Alhamdulillah, hafalan Anda sudah baik. Teruskan.' : 'Terus berlatih. Pelajari lagi nama-nama di bawah, lalu coba kuis lagi.'),
        h('p', { class: 'muted' }, 'Nilai terbaik: ' + prog.quiz.best + '% · ' + prog.quiz.attempts + ' kali mencoba')),
      wrong.length ? h('div', { class: 'panel' }, h('h3', {}, 'Pelajari lagi'), ...wrong.map(no => h('button', { class: 'as-again', type: 'button', onclick: () => openDetail(no) }, ar(byNo(no).arab, 'inl'), h('span', {}, ' ' + byNo(no).latin + ' · ' + byNo(no).arti)))) : '',
      h('div', { class: 'row-btns' }, h('button', { class: 'btn-primary', type: 'button', onclick: startQuiz }, 'Ulangi kuis'), h('button', { class: 'btn-sm ghost', type: 'button', onclick: backToList }, 'Kembali ke daftar')));
  }

  /* ---- awal ---- */
  function draw() {
    if (loadErr) { content.replaceChildren(h('h2', { class: 'wtitle' }, 'Asmaul Husna'), h('div', { class: 'empty' }, h('p', { class: 'muted' }, loadErr.code === 'BAD_DATA' ? 'Data Asmaul Husna tidak valid, jadi tidak ditampilkan. Hubungi admin BAITUNA.' : 'Daftar belum bisa dimuat. Periksa koneksi internet, lalu coba lagi.'), loadErr.code === 'BAD_DATA' ? '' : h('button', { class: 'btn-sm', type: 'button', onclick: load }, 'Coba lagi'))); return; }
    if (!data) { content.replaceChildren(h('h2', { class: 'wtitle' }, 'Asmaul Husna'), h('p', { class: 'muted center' }, 'Memuat daftar…')); return; }
    drawListView();
  }
  function load() {
    loadErr = null; data = null; draw();
    Promise.all([loadAsma(), loadAudioMap()]).then(([d, map]) => { data = d; player = makePlayer(map, onAudio); draw(); }).catch(e => { loadErr = e || new Error('x'); draw(); });
  }
  const watch = setInterval(() => { if (!wrap.isConnected) { clearInterval(watch); if (player) player.stop(); } }, 2000);
  wrap.append(content); load();
  return wrap;
}
