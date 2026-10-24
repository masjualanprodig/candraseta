// BAITUNA - dzikir-ui.js
// Dzikir Pagi & Petang: (1) tampilan jamaah dengan penghitung ketukan + tasbih bebas, (2) pengelolaan oleh Super Admin.
// Ayat Al-Qur'an diambil otomatis (tidak diketik ulang). Doa/dzikir ditulis Super Admin dengan sumber jelas.
// Hitungan hanya disimpan di perangkat pengguna (tidak dikirim ke server).
import { h, toast, hint, ask } from './ui.js';
import { icon, ICONS } from './feed-ui.js';
import { intent, SESSIONS, KINDS, listDhikr, createDhikr, updateDhikr, deleteDhikr, bump, undo, clampCount, loadProgress, saveProgress, loadTasbih, saveTasbih, loadSound, saveSound } from './dzikir-service.js';
import { canSound, tick, chime } from './dzikir-sound.js';
import { listSurahs, loadAyat } from './quran-service.js';
import { applyReadingPrefs } from './quran-ui.js';
import { ayatBlock, refLabel } from './rukun-ui.js';
import { renderDhikrImport, downloadDhikrTemplate } from './dzikir-import-ui.js';
import { svg as isvg, P as IP } from './doa-import-ui.js';

const notReady = e => e && (e.code === '42P01' || e.code === 'PGRST205' || e.status === 404);

/* ===== 1. Jamaah ===== */
export function dzikirPage() {
  const wrap = h('div', { class: 'dzikir' });
  applyReadingPrefs(wrap);
  let tab = intent.tasbih ? 'tasbih' : new Date().getHours() < 12 ? 'pagi' : 'petang';
  intent.tasbih = false;
  let items = null, surahs = null, loadErr = null;
  let prog = loadProgress();
  let sound = loadSound();
  let wake = null, wakeOn = false;
  const content = h('div');

  const keyOf = (s, it) => s + ':' + it.id;
  const mine = s => (items || []).filter(i => i.session === s || i.session === 'keduanya');
  const getN = (s, it) => clampCount(prog.c[keyOf(s, it)], it.target_count);
  const setN = (s, it, n) => { prog = loadProgress(); prog.c[keyOf(s, it)] = n; saveProgress(prog); };

  /* --- Wake Lock (opsional; hanya jika didukung perangkat) --- */
  async function setWake(on) {
    wakeOn = on;
    try {
      if (on && navigator.wakeLock) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener && wake.addEventListener('release', () => { wake = null; }); }
      else if (wake) { await wake.release(); wake = null; }
    } catch (e) { wake = null; }
  }
  const onVis = () => { if (document.visibilityState === 'visible' && wakeOn && !wake) setWake(true); };
  document.addEventListener('visibilitychange', onVis);
  const watch = setInterval(() => {
    if (!wrap.isConnected) { clearInterval(watch); document.removeEventListener('visibilitychange', onVis); setWake(false); }
  }, 1500);

  /* --- Kartu bacaan + penghitung --- */
  function card(s, it, idx, refresh) {
    const target = it.target_count, n = () => getN(s, it);
    const tap = h('button', { class: 'dtap', type: 'button' });
    const undoB = h('button', { class: 'btn-sm ghost', type: 'button', 'aria-label': 'Kurangi satu hitungan' }, '− 1');
    const resetB = h('button', { class: 'btn-sm ghost', type: 'button' }, 'Ulang');
    const art = h('article', { class: 'dcard panel' });
    const paint = () => {
      const c = n(), done = c >= target;
      art.classList.toggle('done', done);
      tap.disabled = done;
      tap.replaceChildren(done ? h('span', { class: 'dtap-main' }, 'Selesai ✓') : h('span', { class: 'dtap-main' }, 'Ketuk di sini'),
        h('span', { class: 'dtap-sub' }, target > 1 || done ? c + ' / ' + target : 'dibaca 1 kali'));
      undoB.disabled = c === 0; resetB.disabled = c === 0;
      tap.setAttribute('aria-label', done ? 'Selesai. ' + c + ' dari ' + target : 'Ketuk untuk menghitung. Sekarang ' + c + ' dari ' + target);
    };
    tap.addEventListener('click', () => {
      const before = n(), next = bump(before, target);
      if (next === before) return;
      setN(s, it, next);
      if (next >= target) { if (sound.done) chime(); } else if (sound.tap) tick();
      paint(); refresh();
    });
    undoB.addEventListener('click', () => { setN(s, it, undo(n())); paint(); refresh(); });
    resetB.addEventListener('click', () => { setN(s, it, 0); paint(); refresh(); });
    art.append(
      h('div', { class: 'dhead' }, h('span', { class: 'snum' }, String(idx + 1)), h('b', { class: 'dtitle' }, it.title || 'Bacaan ' + (idx + 1)),
        target > 1 ? h('span', { class: 'hperiod' }, target + '×') : ''),
      it.kind === 'ayat' ? ayatBlock(it, surahs) : h('div', { class: 'dalil' },
        h('p', { class: 'arab', lang: 'ar', dir: 'rtl' }, it.arabic),
        it.latin ? h('p', { class: 'dlatin' }, it.latin) : '',
        h('p', { class: 'atrans prewrap' }, it.body)),
      it.source ? h('p', { class: 'dsrc' }, h('b', {}, 'Sumber: '), it.source) : '',
      it.note ? h('p', { class: 'dnote prewrap' }, it.note) : '',
      tap, h('div', { class: 'row-btns dctl' }, undoB, resetB));
    paint();
    return art;
  }

  function sessionView(s) {
    if (loadErr) {
      return h('div', { class: 'empty' }, h('p', { class: 'muted' }, notReady(loadErr) ? 'Bacaan dzikir belum aktif. Admin pusat perlu menjalankan dzikir.sql. Penghitung Tasbih tetap bisa dipakai.' : 'Bacaan belum bisa dimuat. Periksa koneksi, lalu coba lagi. Penghitung Tasbih tetap bisa dipakai.'),
        notReady(loadErr) ? '' : h('button', { class: 'btn-sm', type: 'button', onclick: load }, 'Coba lagi'));
    }
    if (!items) return h('p', { class: 'muted center' }, 'Memuat bacaan…');
    const list = mine(s);
    if (!list.length) return h('div', { class: 'empty' }, h('p', { class: 'muted' }, 'Bacaan ' + SESSIONS[s].toLowerCase() + ' belum ditambahkan oleh admin pusat. Sementara itu, Anda bisa memakai penghitung Tasbih.'),
      h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { tab = 'tasbih'; draw(); } }, 'Buka Tasbih'));
    const sum = h('div', { class: 'dsum panel' });
    const bar = h('div', { class: 'dbar' }, h('i'));
    const txt = h('p', { class: 'dsum-t' });
    const resetAll = h('button', { class: 'btn-sm ghost', type: 'button' }, 'Ulangi dari awal');
    const refresh = () => {
      const done = list.filter(it => getN(s, it) >= it.target_count).length;
      txt.textContent = done === list.length ? 'Alhamdulillah, semua bacaan ' + SESSIONS[s].toLowerCase() + ' hari ini sudah ditandai selesai (' + done + ' dari ' + list.length + ').' : done + ' dari ' + list.length + ' bacaan selesai.';
      bar.firstChild.style.width = Math.round(done / list.length * 100) + '%';
      bar.setAttribute('aria-label', done + ' dari ' + list.length + ' bacaan selesai');
      resetAll.disabled = !list.some(it => getN(s, it) > 0);
    };
    resetAll.addEventListener('click', async () => {
      if (!(await ask({ title: 'Ulangi dari awal?', text: 'Semua hitungan ' + SESSIONS[s].toLowerCase() + ' hari ini akan dikosongkan.', reason: false }))) return;
      prog = loadProgress(); list.forEach(it => { delete prog.c[keyOf(s, it)]; }); saveProgress(prog); draw();
    });
    sum.append(txt, bar, resetAll);
    refresh();
    return h('div', {}, sum, ...list.map((it, i) => card(s, it, i, refresh)));
  }

  /* --- Tasbih bebas --- */
  function tasbihView() {
    let st = loadTasbih();
    const big = h('button', { class: 'tbig', type: 'button' });
    const info = h('p', { class: 'tinfo' });
    const bar = h('div', { class: 'dbar' }, h('i'));
    const undoB = h('button', { class: 'btn-sm ghost', type: 'button', 'aria-label': 'Kurangi satu hitungan' }, '− 1');
    const resetB = h('button', { class: 'btn-sm ghost', type: 'button' }, 'Ulang');
    const paint = () => {
      big.replaceChildren(h('span', { class: 'tnum' }, String(st.count)), h('span', { class: 'tlab' }, 'ketuk'));
      big.setAttribute('aria-label', 'Ketuk untuk menambah. Hitungan sekarang ' + st.count);
      if (st.target > 0) {
        info.textContent = st.count >= st.target ? 'Target ' + st.target + ' tercapai' + (st.count > st.target ? ' (lewat ' + (st.count - st.target) + ')' : '') + '.' : 'Target ' + st.target + ' · ' + st.count + ' / ' + st.target;
        bar.hidden = false; bar.firstChild.style.width = Math.min(100, Math.round(st.count / st.target * 100)) + '%';
      } else { info.textContent = 'Tanpa target. Hitungan: ' + st.count; bar.hidden = true; }
      undoB.disabled = st.count === 0; resetB.disabled = st.count === 0;
      big.classList.toggle('hit', st.target > 0 && st.count >= st.target);
    };
    big.addEventListener('click', () => {
      st = { ...st, count: st.count + 1 }; saveTasbih(st);
      const hit = st.target > 0 && st.count === st.target;
      if (hit) { if (sound.done) chime(); } else if (sound.tap) tick();
      paint();
    });
    undoB.addEventListener('click', () => { st = { ...st, count: undo(st.count) }; saveTasbih(st); paint(); });
    resetB.addEventListener('click', async () => {
      if (!(await ask({ title: 'Ulang hitungan dari nol?', text: 'Hitungan tasbih sekarang (' + st.count + ') akan dikosongkan.', reason: false }))) return;
      st = { ...st, count: 0 }; saveTasbih(st); paint();
    });
    const presets = h('div', { class: 'achips tpre', role: 'group', 'aria-label': 'Target hitungan' });
    const custom = h('input', { class: 'in', type: 'number', inputmode: 'numeric', min: '1', max: '9999', placeholder: 'Target lain (1–9999)', 'aria-label': 'Target lain' });
    const drawPresets = () => presets.replaceChildren(...[[33, '33'], [99, '99'], [100, '100'], [0, 'Tanpa target']].map(([v, l]) =>
      h('button', { class: 'achip', type: 'button', 'aria-pressed': String(st.target === v), 'aria-selected': String(st.target === v), onclick: () => { st = { ...st, target: v }; saveTasbih(st); drawPresets(); paint(); } }, l)));
    drawPresets();
    const setCustom = h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => {
      const v = Math.floor(Number(custom.value));
      if (!Number.isFinite(v) || v < 1 || v > 9999) { toast('Isi target antara 1 dan 9999.', true); return; }
      st = { ...st, target: v }; saveTasbih(st); custom.value = ''; drawPresets(); paint();
    } }, 'Atur');
    paint();
    const opts = [];
    if (navigator.wakeLock) {
      const cb = h('input', { type: 'checkbox' });
      cb.addEventListener('change', () => setWake(cb.checked));
      cb.checked = wakeOn;
      opts.push(h('label', { class: 'dopt' }, cb, h('span', {}, 'Jaga layar tetap menyala (bila didukung perangkat)')));
    }
    return h('div', { class: 'tasbih' },
      presets, info, bar,
      h('div', { class: 'tbigwrap' }, big),
      h('div', { class: 'row-btns dctl' }, undoB, resetB),
      h('div', { class: 'row-btns tcus' }, custom, setCustom),
      ...opts,
      h('p', { class: 'muted tdesc' }, 'Penghitung bebas untuk dzikir apa saja. Ketuk lingkaran untuk menambah satu hitungan. Hitungan tersimpan di perangkat ini.'));
  }

  const note = () => h('div', { class: 'panel qnote' }, h('h3', {}, 'Tentang halaman ini'),
    h('p', { class: 'muted' }, 'Bacaan ditulis oleh admin pusat BAITUNA dengan menyebut sumbernya, dan jumlah bacaan mengikuti riwayat yang tercantum. Ayat Al-Qur’an diambil otomatis dari AlQuran Cloud dan tidak diubah. Aplikasi ini tidak menentukan batas waktu pagi dan petang; tanyakan kepada ustaz atau ulama yang terpercaya. Hitungan hanya tersimpan di perangkat Anda dan kosong lagi setiap ganti hari.'));

  function draw() {
    const seg = h('div', { class: 'seg', role: 'tablist', 'aria-label': 'Pilih dzikir' }, ...[['pagi', 'Pagi'], ['petang', 'Petang'], ['tasbih', 'Tasbih']].map(([k, l]) =>
      h('button', { class: 'segb', type: 'button', role: 'tab', 'aria-selected': String(tab === k), onclick: () => { if (tab !== k) { tab = k; draw(); } } }, l)));
    const kids = [h('h2', { class: 'wtitle' }, 'Dzikir Pagi & Petang'),
      h('p', { class: 'muted' }, 'Ketuk tombol untuk menghitung bacaan Anda.'), seg];
    const opt = (label, checked, onchange) => { const cb = h('input', { type: 'checkbox' }); cb.checked = checked; cb.addEventListener('change', () => onchange(cb.checked)); return h('label', { class: 'dopt' }, cb, h('span', {}, label)); };
    const opts = [];
    if (canSound()) {
      opts.push(opt('Bunyi lonceng saat target tercapai', sound.done, v => { sound = { ...sound, done: v }; saveSound(sound); if (v) chime(); }));
      opts.push(opt('Bunyi detak tiap ketukan (pelan)', sound.tap, v => { sound = { ...sound, tap: v }; saveSound(sound); if (v) tick(); }));
    } else opts.push(h('p', { class: 'hint' }, 'Perangkat atau peramban ini tidak mendukung bunyi. Tanda target tercapai berupa perubahan warna dan tulisan.'));
    kids.push(h('div', { class: 'dopts' }, ...opts));
    kids.push(tab === 'tasbih' ? tasbihView() : sessionView(tab), note());
    content.replaceChildren(...kids);
  }

  function load() {
    loadErr = null; items = null; draw();
    Promise.all([listDhikr(), listSurahs().catch(() => null)]).then(([rows, s]) => { items = rows; surahs = s; draw(); })
      .catch(e => { loadErr = e || new Error('x'); draw(); });
  }
  wrap.append(content);
  load();
  return wrap;
}

/* ===== 2. Super Admin ===== */
export async function renderDhikrManager(box, onBack) {
  let rows, surahs = null;
  try { [rows, surahs] = await Promise.all([listDhikr(), listSurahs().catch(() => null)]); }
  catch (e) {
    if (e && e.status === 401) return;
    box.replaceChildren(onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '',
      h('div', { class: 'panel center' }, h('p', {}, notReady(e) ? 'Fitur ini belum aktif. Jalankan dzikir.sql di Supabase SQL Editor.' : 'Data belum bisa dimuat. Periksa koneksi, lalu coba lagi.'),
        h('button', { class: 'btn-sm', type: 'button', onclick: () => renderDhikrManager(box, onBack) }, 'Coba lagi')));
    return;
  }
  const reload = () => renderDhikrManager(box, onBack);
  let editing = null;

  const session = h('select', { class: 'in', 'aria-label': 'Waktu' }, ...Object.keys(SESSIONS).map(k => h('option', { value: k }, SESSIONS[k])));
  const kind = h('select', { class: 'in', 'aria-label': 'Jenis bacaan' }, ...Object.keys(KINDS).map(k => h('option', { value: k }, KINDS[k])));
  const title = h('input', { class: 'in', placeholder: 'Judul (opsional)', maxlength: '150', autocomplete: 'off' });
  const arabic = h('textarea', { class: 'in arab-in', lang: 'ar', dir: 'rtl', placeholder: 'Teks Arab (wajib)', maxlength: '4000' });
  const latin = h('textarea', { class: 'in', placeholder: 'Teks Latin (opsional)', maxlength: '4000' });
  const body = h('textarea', { class: 'in tall', placeholder: 'Terjemahan bahasa Indonesia (wajib)', maxlength: '4000' });
  const surahSel = h('select', { class: 'in', 'aria-label': 'Surat' }, ...(surahs || Array.from({ length: 114 }, (_, i) => ({ number: i + 1, latin: 'Surat ' + (i + 1) }))).map(s => h('option', { value: String(s.number) }, s.number + '. ' + s.latin)));
  const from = h('input', { class: 'in', type: 'number', inputmode: 'numeric', min: '1', max: '286', placeholder: 'Ayat awal' });
  const to = h('input', { class: 'in', type: 'number', inputmode: 'numeric', min: '1', max: '286', placeholder: 'Ayat akhir (kosongkan bila satu ayat)' });
  const preview = h('div', { class: 'dalil', hidden: true });
  const previewBtn = h('button', { class: 'btn-sm ghost', type: 'button' }, 'Lihat pratinjau ayat');
  const source = h('textarea', { class: 'in', placeholder: 'Sumber / dalil, mis. HR. Abu Dawud no. 5068 (wajib untuk teks)', maxlength: '500' });
  const note = h('textarea', { class: 'in', placeholder: 'Keterangan singkat (opsional)', maxlength: '1000' });
  const target = h('input', { class: 'in', type: 'number', inputmode: 'numeric', min: '1', max: '1000', value: '1', 'aria-label': 'Jumlah bacaan' });
  const order = h('input', { class: 'in', type: 'number', inputmode: 'numeric', min: '0', max: '9999', value: '100', 'aria-label': 'Urutan' });
  const fTeks = h('div', {}, arabic, latin, body);
  const fAyat = h('div', {}, h('label', { class: 'hint' }, 'Ayat Al-Qur’an: hanya rujukan yang disimpan. Teks Arab dan terjemahnya diambil otomatis dari layanan Al-Qur’an.'), surahSel, from, to, previewBtn, preview);
  const place = () => { fTeks.hidden = kind.value !== 'teks'; fAyat.hidden = kind.value !== 'ayat'; };
  kind.addEventListener('change', place);

  function readAyat() {
    const a1 = Number(from.value), a2 = to.value.trim() === '' ? a1 : Number(to.value);
    if (!Number.isInteger(a1) || !Number.isInteger(a2) || a1 < 1 || a2 < a1) { toast('Isi nomor ayat dengan benar (ayat akhir tidak boleh lebih kecil dari ayat awal).', true); return null; }
    if (a2 - a1 > 5) { toast('Maksimal 6 ayat berurutan per rujukan.', true); return null; }
    return { surah: Number(surahSel.value), ayah_from: a1, ayah_to: a2 };
  }
  previewBtn.addEventListener('click', async () => {
    const f = readAyat(); if (!f) return;
    preview.hidden = false; preview.replaceChildren(h('p', { class: 'muted' }, 'Memuat…'));
    try {
      const r = await loadAyat(f.surah, f.ayah_from, f.ayah_to);
      preview.replaceChildren(h('p', { class: 'dref' }, refLabel(surahs, f)), ...r.map(a => h('div', {}, h('p', { class: 'arab', lang: 'ar', dir: 'rtl' }, a.ar), h('p', { class: 'atrans' }, a.n + '. ' + a.id))));
    } catch { preview.replaceChildren(h('p', { class: 'muted' }, 'Ayat tidak ditemukan atau belum bisa dimuat. Periksa nomor ayat dan koneksi.')); }
  });

  const formTitle = h('h3', {}, 'Tambah bacaan');
  const status = h('p', { class: 'hint' }, '');
  const save = h('button', { class: 'btn-sm', type: 'submit' }, 'Simpan');
  const cancel = h('button', { class: 'btn-sm ghost', type: 'button', hidden: true, onclick: reload }, 'Batal ubah');

  const form = h('form', {
    class: 'panel rform', novalidate: 'novalidate',
    onsubmit: async ev => {
      ev.preventDefault();
      const k = editing ? editing.kind : kind.value;
      const tc = Number(target.value), so = Number(order.value);
      if (!Number.isInteger(tc) || tc < 1 || tc > 1000) { toast('Jumlah bacaan harus bilangan bulat 1 sampai 1000.', true); return; }
      if (!Number.isInteger(so) || so < 0 || so > 9999) { toast('Urutan harus bilangan bulat 0 sampai 9999.', true); return; }
      let f = { session: session.value, title: title.value.trim(), source: source.value.trim(), note: note.value.trim(), target_count: tc, sort_order: so };
      if (k === 'ayat') { const a = readAyat(); if (!a) return; f = { ...f, ...a }; }
      else {
        f = { ...f, arabic: arabic.value.trim(), latin: latin.value.trim(), body: body.value.trim() };
        if (f.arabic.length < 3) { toast('Teks Arab wajib diisi.', true); return; }
        if (f.body.length < 3) { toast('Terjemahan wajib diisi.', true); return; }
        if (f.source.length < 3) { toast('Sumber wajib diisi (perawi dan nomor hadits, atau rujukan lain yang jelas).', true); return; }
      }
      save.disabled = true;
      try {
        if (editing) await updateDhikr(editing.id, k, f); else await createDhikr(k, f);
        toast(editing ? 'Perubahan disimpan.' : 'Bacaan ditambahkan.');
        await reload(); return;
      } catch (e) {
        if (e && e.status === 401) return;
        const msg = e && e.status === 0 ? 'Tidak ada koneksi internet.' : 'Belum tersimpan. ' + hint(e);
        status.textContent = msg; toast(msg, true);
      }
      save.disabled = false;
    }
  }, formTitle, h('div', { class: 'grid2' }, session, kind), title, fTeks, fAyat, source, note,
    h('label', { class: 'hint' }, 'Jumlah bacaan (sesuai riwayat yang dirujuk)'), target,
    status, h('div', { class: 'mt row-btns' }, save, cancel));
  place();

  function edit(e) {
    editing = e; formTitle.textContent = 'Ubah bacaan';
    kind.value = e.kind; kind.disabled = true; place();
    session.value = e.session; title.value = e.title || ''; source.value = e.source || ''; note.value = e.note || '';
    target.value = String(e.target_count); order.value = String(e.sort_order);
    if (e.kind === 'ayat') { surahSel.value = String(e.surah); from.value = e.ayah_from; to.value = e.ayah_to === e.ayah_from ? '' : e.ayah_to; }
    else { arabic.value = e.arabic || ''; latin.value = e.latin || ''; body.value = e.body || ''; }
    cancel.hidden = false; form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const label = it => it.title || (it.kind === 'ayat' ? refLabel(surahs, it) : (it.source || 'Bacaan'));
  const item = it => h('div', { class: 'post' }, h('div', { class: 'fi-main' },
    h('span', { class: 'hperiod' }, SESSIONS[it.session]), ' ', h('span', { class: 'hperiod' }, it.target_count + '×'), h('b', {}, ' ' + label(it)),
    h('div', { class: 'muted' }, it.kind === 'ayat' ? (it.title ? refLabel(surahs, it) + ' · ' : '') + 'Teks diambil otomatis' : (it.body || '').slice(0, 90) + ((it.body || '').length > 90 ? '…' : '')),
    h('div', { class: 'row-btns mt' },
      h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => edit(it) }, 'Ubah'),
      h('button', { class: 'btn-sm alt', type: 'button', onclick: async () => {
        if (!(await ask({ title: 'Hapus bacaan ini?', text: label(it) + ' akan dihapus dan tidak bisa dikembalikan.', reason: false }))) return;
        try { await deleteDhikr(it.id); toast('Dihapus.'); await reload(); } catch (er) { if (er.status !== 401) toast('Gagal menghapus. ' + hint(er), true); }
      } }, 'Hapus'))));

  const group = s => { const list = rows.filter(r => r.session === s); return h('div', { class: 'panel' }, h('h3', {}, SESSIONS[s] + ' (' + list.length + ')'), list.length ? list.map(item) : h('p', { class: 'muted' }, 'Belum ada.')); };
  box.replaceChildren(...[
    onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '',
    h('h2', { class: 'mt' }, 'Kelola Dzikir Pagi & Petang'),
    h('p', { class: 'muted' }, 'Hanya Super Admin yang bisa mengubah. Teks doa/dzikir wajib memuat teks Arab, terjemahan, dan sumber yang jelas. Isi jumlah bacaan sesuai riwayat yang Anda rujuk. Sebaiknya diperiksa ustaz sebelum diumumkan. Bacaan berstatus "Pagi & Petang" tampil di kedua tab.'),
    h('div', { class: 'dm-tiles', id: 'dz-tiles' },
      h('button', { class: 'dm-tile main', type: 'button', id: 'dz-import', onclick: () => renderDhikrImport(box, { onBack: reload, onDone: reload }) }, isvg(IP.xl, 'ic dm-tic'), h('span', {}, h('b', {}, 'Import dari Excel/Spreadsheet'), h('small', {}, 'Tambah banyak bacaan sekaligus'))),
      h('button', { class: 'dm-tile', type: 'button', id: 'dz-tpl', onclick: downloadDhikrTemplate }, isvg(IP.file, 'ic dm-tic'), h('span', {}, h('b', {}, 'Download Template Excel'), h('small', {}, 'Gunakan template untuk import')))),
    form, group('pagi'), group('petang'), group('keduanya')
  ].flat());
  window.scrollTo(0, 0);
}
