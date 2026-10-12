// BAITUNA - belajar-ui.js
// Belajar Membaca Al-Qur'an: 8 tingkatan dari huruf hijaiyah sampai membaca surat pendek, dengan kuis dan skor.
// (1) Tampilan jamaah: materi sudah ada di aplikasi; kemajuan hanya tersimpan di perangkat ini.
// (2) Super Admin hanya MENAMBAH materi tambahan per level (dengan sumber).
import { h, toast, hint, ask } from './ui.js';
import { LEVELS, LETTERS, CONSONANTS, MAKHRAJ, NUN_RULES, MIM_RULES, QALQALAH, PASS, QUIZ_LEN, PRACTICE_SURAHS, SUKUN_SAMPLES, TASYDID_BASE,
  forms, withVowel, withTanwin, tasydid, mad, makeQuiz, hasQuiz } from './belajar-data.js';
import { loadProgress, saveProgress, recordAttempt, touch, toggleLancar, scoreOf, stars, passed, activeLevel, doneCount, agoText, reminder,
  listMateri, createMateri, updateMateri, deleteMateri } from './belajar-service.js';
import { listSurahs, loadSurah } from './quran-service.js';

const notReady = e => e && (e.code === '42P01' || e.code === 'PGRST205' || e.status === 404);
const AR = /[؀-ۿ]/;
const ar = (t, cls = '') => h('span', { class: 'bj-ar ' + cls, lang: 'ar', dir: 'rtl' }, t);
// Teks campuran Latin + Arab: bagian Arab dibungkus agar arah tulisnya benar.
const mixed = t => String(t).split(/([\u0600-\u06FF\u200D]+)/).map(x => AR.test(x) ? ar(x, 'inl') : x);
const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);

/* ===== 1. Jamaah ===== */
export function belajarPage() {
  const wrap = h('div', { class: 'belajar' });
  let prog = loadProgress(), view = { mode: 'home' }, materi = null, surahs = null;
  const save = () => { if (!saveProgress(prog)) toast('Kemajuan belum bisa disimpan di perangkat ini.', true); };
  listMateri().then(r => { materi = r; if (view.mode === 'level') draw(); }).catch(() => { materi = []; });
  const lvl = id => LEVELS.find(l => l.id === id);
  const status = id => {
    const r = prog.levels[id];
    if (!r) return { cls: 'new', text: 'Belum dimulai' };
    return passed(prog, id) ? { cls: 'pass', text: 'Lulus ' + starText(stars(r.best)) + ' · nilai ' + r.best + '%' } : { cls: 'try', text: 'Sedang belajar · nilai terbaik ' + r.best + '%' };
  };
  const go = v => { view = v; draw(); window.scrollTo(0, 0); };
  const openLevel = id => { prog = touch(prog, id); save(); go({ mode: 'level', level: id }); };

  /* ---- beranda ---- */
  function remindBox() {
    const r = reminder(prog);
    if (r.kind === 'done') return h('div', { class: 'panel bj-remind ok' }, h('b', {}, 'Alhamdulillah, semua level sudah lulus.'), h('p', { class: 'muted' }, 'Ulangi kuis kapan saja agar bacaan tetap terjaga, dan teruslah belajar bersama guru.'));
    const L = lvl(r.level), msg = r.kind === 'start' ? 'Mulai dari Level ' + L.id + ': ' + L.title + '.'
      : (r.kind === 'late' ? 'Sudah ' + r.days + ' hari sejak terakhir belajar. ' : 'Terakhir belajar ' + r.ago + ' (Level ' + r.lastLevel + '). ') + 'Lanjutkan di Level ' + L.id + ': ' + L.title + '.';
    return h('div', { class: 'panel bj-remind' + (r.kind === 'late' ? ' late' : '') }, h('b', {}, r.kind === 'start' ? 'Mulai belajar' : 'Lanjutkan belajar'), h('p', {}, msg),
      h('button', { class: 'btn-sm', type: 'button', onclick: () => openLevel(L.id) }, r.kind === 'start' ? 'Mulai Level ' + L.id : 'Lanjut ke Level ' + L.id),
      h('p', { class: 'muted bj-priv' }, 'Tanda ini hanya muncul saat Anda membuka halaman ini. Aplikasi tidak mengirim notifikasi atau alarm.'));
  }
  function home() {
    const n = doneCount(prog), next = activeLevel(prog);
    return [h('h2', { class: 'wtitle' }, 'Belajar Membaca Al-Qur’an'),
      h('p', { class: 'muted' }, 'Dari mengenal huruf hijaiyah sampai lancar membaca. Belajar bertahap, setiap level ada kuis dan nilai.'),
      remindBox(),
      h('div', { class: 'panel dsum' }, h('p', { class: 'dsum-t' }, n + ' dari ' + LEVELS.length + ' level sudah lulus (nilai minimal ' + PASS + '%).'),
        h('div', { class: 'dbar', role: 'img', 'aria-label': n + ' dari ' + LEVELS.length + ' level lulus' }, h('i', { style: 'width:' + Math.round(n / LEVELS.length * 100) + '%' }))),
      ...LEVELS.map(L => { const s = status(L.id);
        return h('button', { class: 'dcard panel bj-level ' + s.cls + (L.id === next ? ' next' : ''), type: 'button', onclick: () => openLevel(L.id), 'aria-label': 'Level ' + L.id + ': ' + L.title },
          h('span', { class: 'bj-num' }, String(L.id)), h('span', { class: 'bj-lt' }, h('b', {}, L.title), h('span', { class: 'muted' }, L.desc), h('span', { class: 'bj-st' }, s.text + (L.id === next ? ' · disarankan berikutnya' : ''))));
      }),
      note()];
  }
  const note = () => h('div', { class: 'panel qnote' }, h('h3', {}, 'Tentang halaman ini'),
    h('p', { class: 'muted' }, 'Halaman ini membantu latihan mengenali huruf dan aturan dasar. Membaca Al-Qur’an dengan benar paling baik dipelajari langsung dari guru yang bacaannya bersambung sanadnya (talaqqi), karena bunyi huruf dan dengung harus didengar dan dikoreksi. Aplikasi ini belum memutar suara huruf. Untuk mendengar bacaan, gunakan halaman Al-Qur’an (ada audio qari). Nilai dan kemajuan hanya tersimpan di perangkat ini dan akan hilang bila data peramban dihapus. Penilaian Level 8 adalah penilaian dari Anda sendiri. Materi tambahan dari admin pusat mencantumkan sumbernya; sebaiknya ustaz memeriksanya.'));

  /* ---- isi materi per jenis ---- */
  const cell = (glyph, sub) => h('div', { class: 'bj-cell' }, ar(glyph, 'big'), sub ? h('span', { class: 'bj-sub' }, sub) : '');
  const tbl = (head, rows) => h('div', { class: 'bj-twrap' }, h('table', { class: 'bj-table' },
    h('thead', {}, h('tr', {}, ...head.map(x => h('th', { scope: 'col' }, x)))), h('tbody', {}, ...rows)));
  const tr = (...tds) => h('tr', {}, ...tds);
  const td = (x, cls) => h('td', cls ? { class: cls } : {}, x);
  function body(L) {
    switch (L.kind) {
      case 'letters': return [h('div', { class: 'bj-grid', role: 'list' }, ...LETTERS.map(l => h('div', { role: 'listitem' }, cell(l.ch, l.name)))),
        h('div', { class: 'panel' }, h('h3', {}, 'Tempat keluar huruf (makhraj)'), h('p', { class: 'muted' }, 'Ringkasan lima daerah. Cara mengucapkannya paling tepat dipelajari dari guru.'),
          ...MAKHRAJ.map(m => h('p', {}, h('b', {}, m.t), h('br'), ar(m.d, 'inl'))))];
      case 'forms': return [tbl(['Huruf', 'Tunggal', 'Awal', 'Tengah', 'Akhir'], LETTERS.map(l => { const f = forms(l);
        return tr(td(l.name), td(ar(f.alone, 'big'), 'c'), td(f.initial ? ar(f.initial, 'big') : '—', 'c'), td(f.medial ? ar(f.medial, 'big') : '—', 'c'), td(ar(f.final, 'big'), 'c')); }))];
      case 'harakat': return [tbl(['Huruf', 'Fathah (a)', 'Kasrah (i)', 'Dhammah (u)'], CONSONANTS.map(l => tr(td(l.name), ...['a', 'i', 'u'].map(v => { const w = withVowel(l, v); return td([ar(w.glyph, 'big'), h('span', { class: 'bj-sub' }, w.read)], 'c'); }))))];
      case 'tanwin': return [tbl(['Huruf', 'Fathatain (an)', 'Kasratain (in)', 'Dhammatain (un)'], CONSONANTS.map(l => tr(td(l.name), ...['a', 'i', 'u'].map(v => { const w = withTanwin(l, v); return td([ar(w.glyph, 'big'), h('span', { class: 'bj-sub' }, w.read)], 'c'); }))))];
      case 'sukun': return [h('div', { class: 'panel' }, h('h3', {}, 'Contoh sukun'), h('div', { class: 'bj-grid' }, ...SUKUN_SAMPLES.map(w => cell(w.glyph, w.read)))),
        h('div', { class: 'panel' }, h('h3', {}, 'Contoh tasydid'), h('div', { class: 'bj-grid' }, ...TASYDID_BASE.slice(0, 12).map((l, i) => { const w = tasydid(l, ['a', 'i', 'u'][i % 3]); return cell(w.glyph, w.read); })))];
      case 'mad': return [tbl(['Huruf', 'Fathah + alif', 'Kasrah + ya', 'Dhammah + waw'], CONSONANTS.map(l => tr(td(l.name), ...['a', 'i', 'u'].map(k => { const w = mad(l, k); return td([ar(w.glyph, 'big'), h('span', { class: 'bj-sub' }, w.read)], 'c'); }))))];
      case 'tajwid': return [
        h('div', { class: 'panel' }, h('h3', {}, 'Nun sukun dan tanwin'), ...NUN_RULES.map(r => h('p', {}, h('b', {}, r.name), ' · ', ar(r.letters, 'inl'), h('br'), h('span', { class: 'muted' }, 'Bertemu huruf tersebut: ' + r.how + '.')))),
        h('div', { class: 'panel' }, h('h3', {}, 'Mim sukun'), ...MIM_RULES.map(r => h('p', {}, h('b', {}, r.name), ' · ', /^[^؀-ۿ]+$/.test(r.letters) ? r.letters : ar(r.letters, 'inl'), h('br'), h('span', { class: 'muted' }, 'Dibaca: ' + r.how + '.')))),
        h('div', { class: 'panel' }, h('h3', {}, 'Qalqalah'), h('p', {}, ar(QALQALAH, 'inl')), h('p', { class: 'muted' }, 'Lima huruf ini bila mati (sukun) atau dibaca berhenti, bunyinya memantul. Cara memantulkannya dipelajari dari guru.'))];
      default: return [];
    }
  }

  /* ---- Level 8: latihan surat ---- */
  function practice() {
    const total = PRACTICE_SURAHS.length, n = prog.lancar.length;
    const box = h('div', { class: 'panel' }, h('h3', {}, 'Surat latihan'),
      h('p', { class: 'dsum-t' }, n + ' dari ' + total + ' surat ditandai lancar (' + scoreOf(n, total) + '%).'),
      h('div', { class: 'dbar', role: 'img', 'aria-label': n + ' dari ' + total + ' surat lancar' }, h('i', { style: 'width:' + Math.round(n / total * 100) + '%' })),
      h('p', { class: 'muted' }, 'Level ini lulus bila ' + PASS + '% surat sudah ditandai lancar. Penilaian dari diri sendiri.'));
    const rows = h('div', { class: 'bj-surahs' });
    PRACTICE_SURAHS.forEach(no => {
      const info = surahs && surahs.find(s => s.number === no), name = info ? info.latin + ' (' + info.ayahs + ' ayat)' : 'Surat ke-' + no;
      const cb = h('input', { type: 'checkbox', 'aria-label': 'Sudah lancar: ' + name }); cb.checked = prog.lancar.includes(no);
      const text = h('div', { class: 'bj-text' });
      let open = false;
      const row = h('div', { class: 'bj-surah panel' }, h('div', { class: 'bj-srow' }, h('b', {}, name),
        h('label', { class: 'dopt sunnah-check' }, cb, h('span', {}, 'Sudah lancar')),
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: async ev => {
          open = !open; ev.target.textContent = open ? 'Tutup' : 'Baca';
          if (!open) { text.replaceChildren(); return; }
          text.replaceChildren(h('p', { class: 'muted' }, 'Memuat…'));
          try { const s = await loadSurah(no);
            if (!open) return;
            text.replaceChildren(...(s.bismillah ? [h('p', { class: 'arab', lang: 'ar', dir: 'rtl' }, s.bismillah)] : []), ...s.ayahs.map(a => h('div', { class: 'bj-ayat' }, h('p', { class: 'arab', lang: 'ar', dir: 'rtl' }, a.ar, ' ﴿' + a.n + '﴾'))),
              h('p', { class: 'muted' }, 'Teks dari layanan Al-Qur’an daring (Al-Qur’an Cloud). Arti ada di halaman Al-Qur’an.'));
          } catch (e) { text.replaceChildren(h('p', { class: 'muted' }, 'Surat belum bisa dimuat. Periksa koneksi internet.')); }
        } }, 'Baca')), text);
      cb.addEventListener('change', () => { prog = toggleLancar(prog, no); save(); draw(); });
      rows.append(row);
    });
    return [box, rows];
  }
  function ensureSurahs() { if (surahs || view.mode !== 'level' || view.level !== 8) return; listSurahs().then(r => { surahs = r; if (view.mode === 'level' && view.level === 8) draw(); }).catch(() => {}); }

  /* ---- halaman level ---- */
  function level(id) {
    const L = lvl(id), s = status(id), extra = (materi || []).filter(m => m.level === id);
    const kids = [h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => go({ mode: 'home' }) }, '← Semua level'),
      h('h2', { class: 'wtitle mt' }, 'Level ' + L.id + ': ' + L.title), h('p', { class: 'muted' }, L.desc),
      h('p', { class: 'bj-st' }, s.text),
      h('div', { class: 'panel' }, ...L.intro.map(t => h('p', {}, t))),
      ...body(L), ...(L.kind === 'practice' ? practice() : [])];
    if (extra.length) kids.push(h('div', { class: 'panel' }, h('h3', {}, 'Materi tambahan'), ...extra.map(m => h('div', { class: 'bj-extra' },
      h('b', {}, m.title), h('p', { class: 'prewrap' }, m.body), m.arabic ? h('p', { class: 'arab', lang: 'ar', dir: 'rtl' }, m.arabic) : '', m.latin ? h('p', { class: 'dlatin' }, m.latin) : '',
      h('p', { class: 'dsrc' }, h('b', {}, 'Sumber: '), m.source), m.note ? h('p', { class: 'dnote prewrap' }, m.note) : ''))));
    if (hasQuiz(id)) kids.push(h('div', { class: 'panel bj-cta' }, h('h3', {}, 'Kuis Level ' + id), h('p', { class: 'muted' }, QUIZ_LEN + ' soal. Nilai minimal ' + PASS + '% untuk lulus. Boleh diulang sampai lulus.'),
      h('button', { class: 'btn-primary', type: 'button', onclick: () => go({ mode: 'quiz', level: id, qs: makeQuiz(id), i: 0, picked: null, ok: 0 }) }, 'Mulai kuis')));
    const prev = lvl(id - 1), next = lvl(id + 1);
    kids.push(h('div', { class: 'row-btns' }, prev ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => openLevel(prev.id) }, '← Level ' + prev.id) : '', next ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => openLevel(next.id) }, 'Level ' + next.id + ' →') : ''));
    return kids;
  }

  /* ---- kuis ---- */
  function quiz() {
    const v = view, L = lvl(v.level);
    if (v.i >= v.qs.length) return result();
    const q = v.qs[v.i], answered = v.picked !== null;
    const opts = q.options.map((o, idx) => {
      const b = h('button', { class: 'bj-opt' + (answered ? (idx === q.answer ? ' ok' : idx === v.picked ? ' bad' : '') : ''), type: 'button', 'aria-pressed': String(v.picked === idx) },
        AR.test(o) ? ar(o, 'big') : o);
      b.disabled = answered;
      b.addEventListener('click', () => { if (v.picked !== null) return; v.picked = idx; if (idx === q.answer) v.ok++; draw(); });
      return b;
    });
    return [h('button', { class: 'btn-sm ghost', type: 'button', onclick: async () => { if (await ask({ title: 'Keluar dari kuis?', text: 'Nilai kuis ini tidak akan disimpan.', reason: false })) go({ mode: 'level', level: v.level }); } }, '← Keluar kuis'),
      h('h2', { class: 'wtitle mt' }, 'Kuis Level ' + L.id), h('p', { class: 'muted' }, 'Soal ' + (v.i + 1) + ' dari ' + v.qs.length),
      h('div', { class: 'dbar', role: 'img', 'aria-label': 'Soal ' + (v.i + 1) + ' dari ' + v.qs.length }, h('i', { style: 'width:' + Math.round(v.i / v.qs.length * 100) + '%' })),
      h('div', { class: 'panel bj-q' }, h('p', { class: 'bj-prompt' }, q.prompt), q.glyph ? h('div', { class: 'bj-qglyph' }, ar(q.glyph, 'huge')) : '',
        h('div', { class: 'bj-opts' }, ...opts),
        answered ? h('div', { class: 'bj-fb ' + (v.picked === q.answer ? 'ok' : 'bad'), role: 'status' }, h('b', {}, v.picked === q.answer ? 'Benar. ' : 'Belum tepat. '), ...mixed(q.exp)) : '',
        answered ? h('button', { class: 'btn-primary', type: 'button', onclick: () => { v.i++; v.picked = null; if (v.i >= v.qs.length) { prog = recordAttempt(prog, v.level, scoreOf(v.ok, v.qs.length)); save(); } draw(); window.scrollTo(0, 0); } }, v.i + 1 >= v.qs.length ? 'Lihat hasil' : 'Soal berikutnya') : '')];
  }
  function result() {
    const v = view, score = scoreOf(v.ok, v.qs.length), ok = score >= PASS, rec = prog.levels[v.level], next = lvl(v.level + 1);
    return [h('h2', { class: 'wtitle' }, 'Hasil Kuis Level ' + v.level),
      h('div', { class: 'panel bj-result ' + (ok ? 'ok' : 'try') }, h('b', { class: 'bj-score' }, score + '%'), h('p', { class: 'bj-stars', 'aria-label': stars(score) + ' dari 3 bintang' }, starText(stars(score))),
        h('p', {}, v.ok + ' dari ' + v.qs.length + ' soal benar.'),
        h('p', {}, ok ? 'Alhamdulillah, Anda lulus Level ' + v.level + '.' : 'Belum lulus (minimal ' + PASS + '%). Baca ulang materinya, lalu coba lagi.'),
        h('p', { class: 'muted' }, 'Nilai terbaik: ' + (rec ? rec.best : score) + '% · percobaan ke-' + (rec ? rec.attempts : 1))),
      h('div', { class: 'row-btns' },
        h('button', { class: 'btn-primary', type: 'button', onclick: () => go({ mode: 'quiz', level: v.level, qs: makeQuiz(v.level), i: 0, picked: null, ok: 0 }) }, 'Ulangi kuis'),
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => go({ mode: 'level', level: v.level }) }, 'Kembali ke materi'),
        ok && next ? h('button', { class: 'btn-sm', type: 'button', onclick: () => openLevel(next.id) }, 'Lanjut ke Level ' + next.id) : '',
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => go({ mode: 'home' }) }, 'Semua level'))];
  }

  function draw() {
    ensureSurahs();
    const kids = view.mode === 'home' ? home() : view.mode === 'level' ? level(view.level) : quiz();
    wrap.replaceChildren(...kids);
  }
  draw();
  return wrap;
}

/* ===== 2. Super Admin: materi tambahan ===== */
export async function renderBelajarManager(box, onBack) {
  let rows;
  try { rows = await listMateri(); }
  catch (e) {
    if (e && e.status === 401) return;
    box.replaceChildren(onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '',
      h('div', { class: 'panel center' }, h('p', {}, notReady(e) ? 'Fitur ini belum aktif. Jalankan belajar.sql di Supabase SQL Editor.' : 'Data belum bisa dimuat. Periksa koneksi, lalu coba lagi.'),
        h('button', { class: 'btn-sm', type: 'button', onclick: () => renderBelajarManager(box, onBack) }, 'Coba lagi')));
    return;
  }
  const reload = () => renderBelajarManager(box, onBack);
  let editing = null;
  const lvlSel = h('select', { class: 'in', 'aria-label': 'Level' }, ...LEVELS.map(L => h('option', { value: String(L.id) }, 'Level ' + L.id + ': ' + L.title)));
  const title = h('input', { class: 'in', placeholder: 'Judul materi (wajib)', maxlength: '150', autocomplete: 'off', 'aria-label': 'Judul materi' });
  const body = h('textarea', { class: 'in tall', placeholder: 'Penjelasan materi dalam bahasa Indonesia (wajib)', maxlength: '4000', 'aria-label': 'Penjelasan' });
  const arabic = h('textarea', { class: 'in arab-in', lang: 'ar', dir: 'rtl', placeholder: 'Teks Arab / contoh bacaan (opsional)', maxlength: '4000' });
  const latin = h('textarea', { class: 'in', placeholder: 'Cara baca Latin (opsional)', maxlength: '4000' });
  const source = h('textarea', { class: 'in', rows: '2', placeholder: 'Sumber atau rujukan, mis. nama kitab/buku/guru (wajib)', maxlength: '500', 'aria-label': 'Sumber' });
  const note = h('textarea', { class: 'in', placeholder: 'Keterangan singkat (opsional)', maxlength: '1000' });
  const lab = (t, el) => h('label', { class: 'flab' }, h('span', { class: 'hint' }, t), el);
  const formTitle = h('h3', {}, 'Tambah materi'), status = h('p', { class: 'hint' }, '');
  const save = h('button', { class: 'btn-sm', type: 'submit' }, 'Simpan');
  const cancel = h('button', { class: 'btn-sm ghost', type: 'button', hidden: true, onclick: reload }, 'Batal ubah');
  const form = h('form', { class: 'panel rform', novalidate: 'novalidate', onsubmit: async ev => {
    ev.preventDefault();
    const f = { level: Number(lvlSel.value), title: title.value.trim(), body: body.value.trim(), arabic: arabic.value.trim(), latin: latin.value.trim(), source: source.value.trim(), note: note.value.trim() };
    if (!editing) f.sort_order = 100;
    if (f.title.length < 3) { toast('Judul minimal 3 huruf.', true); return; }
    if (f.body.length < 10) { toast('Penjelasan minimal 10 huruf.', true); return; }
    if (f.source.length < 3) { toast('Sumber wajib diisi (kitab, buku, atau guru).', true); return; }
    save.disabled = true;
    try { if (editing) await updateMateri(editing.id, f); else await createMateri(f); toast(editing ? 'Perubahan disimpan.' : 'Materi ditambahkan.'); await reload(); return; }
    catch (e) { if (e && e.status === 401) return; const m = e && e.status === 0 ? 'Tidak ada koneksi internet.' : 'Belum tersimpan. ' + hint(e); status.textContent = m; toast(m, true); }
    save.disabled = false;
  } }, formTitle, lab('Level', lvlSel), lab('Judul materi *', title), lab('Penjelasan *', body), lab('Teks Arab / contoh bacaan (opsional)', arabic), lab('Cara baca Latin (opsional)', latin), lab('Sumber atau rujukan *', source), lab('Keterangan singkat (opsional)', note),
    status, h('div', { class: 'mt row-btns' }, save, cancel));
  function edit(e) {
    editing = e; formTitle.textContent = 'Ubah materi';
    lvlSel.value = String(e.level); title.value = e.title; body.value = e.body; arabic.value = e.arabic || ''; latin.value = e.latin || ''; source.value = e.source; note.value = e.note || '';
    cancel.hidden = false; form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const item = it => h('div', { class: 'post' }, h('div', { class: 'fi-main' }, h('b', {}, it.title),
    h('div', { class: 'muted' }, (it.body || '').slice(0, 90) + ((it.body || '').length > 90 ? '…' : '')),
    h('div', { class: 'row-btns mt' },
      h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => edit(it) }, 'Ubah'),
      h('button', { class: 'btn-sm alt', type: 'button', onclick: async () => {
        if (!(await ask({ title: 'Hapus materi ini?', text: it.title + ' akan dihapus dan tidak bisa dikembalikan.', reason: false }))) return;
        try { await deleteMateri(it.id); toast('Dihapus.'); await reload(); } catch (er) { if (er.status !== 401) toast('Gagal menghapus. ' + hint(er), true); }
      } }, 'Hapus'))));
  const group = L => { const l = rows.filter(r => r.level === L.id); return l.length ? h('div', { class: 'panel' }, h('h3', {}, 'Level ' + L.id + ': ' + L.title + ' (' + l.length + ')'), l.map(item)) : ''; };
  box.replaceChildren(...[
    onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '',
    h('h2', { class: 'mt' }, 'Kelola Materi Belajar Qur’an'),
    h('p', { class: 'muted' }, 'Materi dasar (8 level, kuis, dan skor) sudah ada di aplikasi dan tidak perlu diisi. Di sini Anda hanya menambahkan materi tambahan pada level tertentu. Hanya Super Admin yang bisa menambah, mengubah, dan menghapus. Setiap materi wajib mencantumkan sumber. Jangan memuat hadits atau ayat tanpa sumber; sebaiknya diperiksa ustaz sebelum diumumkan.'),
    form, ...LEVELS.map(group), rows.length ? '' : h('div', { class: 'panel' }, h('p', { class: 'muted' }, 'Belum ada materi tambahan.'))
  ].flat());
  window.scrollTo(0, 0);
}
