// BAITUNA - mushaf-ui.js
// Mode Mushaf: teks Arab bersambung per halaman (1-604) seperti mushaf cetak, dengan nomor ayat di ujung ayat.
// Teks dari AlQuran Cloud (lihat quran-service.js). Ini tampilan alat bantu baca, bukan gambar mushaf cetak yang ditashih:
// pemenggalan baris mengikuti lebar layar, sedangkan isi halaman dan urutan ayat mengikuti Mushaf Madinah.
import { h, toast } from './ui.js';
import { loadPage, pageOfAyah, offlinePageCount, PAGES, AUDIO_HOST, RECITERS } from './quran-service.js';

const PKEY = 'baituna.quranpage.v1', LAST = 'baituna.quranlast.v1', QKEY = 'baituna.qari.v1';
const THEMES = [['terang', 'Terang'], ['krem', 'Krem'], ['gelap', 'Gelap']];
const lsGet = (k, ok, d) => { try { const v = localStorage.getItem(k); return ok(v) ? v : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* abaikan */ } };
const getTheme = () => lsGet('baituna.mushaftheme.v1', v => THEMES.some(t => t[0] === v), 'terang');
const getAwake = () => lsGet('baituna.mushafawake.v1', v => v === '1', '0') === '1';
const getSwipe = () => lsGet('baituna.mushafswipe.v1', v => v === 'rtl' || v === 'ltr', 'rtl');
const MSIZES = [1.2, 1.4, 1.65, 1.9, 2.3];
const toAr = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
export const savedPage = () => { try { const v = Number(localStorage.getItem(PKEY)); return Number.isInteger(v) && v >= 1 && v <= PAGES ? v : 1; } catch { return 1; } };
const savePage = n => { try { localStorage.setItem(PKEY, String(n)); } catch { /* abaikan */ } };
const setLast = (s, a, page) => { try { localStorage.setItem(LAST, JSON.stringify(page ? { n: s, ayah: a, page } : { n: s, ayah: a })); } catch { /* abaikan */ } };
const clearLast = () => { try { localStorage.removeItem(LAST); } catch { /* abaikan */ } };
// Penanda "terakhir dibaca" (kunci yang sama dengan mode per ayat). Dibuang bila tidak masuk akal untuk surat tersebut.
const getMark = surahs => {
  try {
    const v = JSON.parse(localStorage.getItem(LAST)), s = v && surahs[v.n - 1];
    if (!v || !Number.isInteger(v.n) || !Number.isInteger(v.ayah) || !s || v.ayah < 1 || v.ayah > s.ayahs) return null;
    return { n: v.n, ayah: v.ayah, page: Number.isInteger(v.page) && v.page >= 1 && v.page <= PAGES ? v.page : 0 };
  } catch { return null; }
};
const qari = () => { try { const v = localStorage.getItem(QKEY); return RECITERS.some(r => r.id === v) ? v : RECITERS[0].id; } catch { return RECITERS[0].id; } };
const QUICK = [[1, 1, 'Al-Fatihah'], [2, 255, 'Ayat Kursi'], [18, 1, 'Al-Kahf'], [36, 1, 'Yasin'], [55, 1, 'Ar-Rahman'], [56, 1, 'Al-Waqi’ah'], [67, 1, 'Al-Mulk']];

// opts: { surahs, startPage, sizeIdx, onSize(delta)->idx }
export function mushafPage(opts) {
  const { surahs } = opts;
  const root = h('div', { class: 'mushaf' });
  let page = opts.startPage || savedPage(), data = null, sel = -1, cur = -1, audio = null, watch = 0, seq = false, sizeIdx = opts.sizeIdx;
  let theme = getTheme(), awake = getAwake(), swipeDir = getSwipe(), lock = null, guard = 0;
  root.dataset.theme = theme;
  const applySize = () => root.style.setProperty('--msize', MSIZES[sizeIdx] + 'rem');
  applySize();
  const stopAudio = () => { seq = false; if (audio) { try { audio.pause(); } catch { /* */ } audio.onended = audio.onerror = null; audio = null; } clearInterval(watch); watch = 0; mark(-1); playBtn.textContent = '▶ Putar halaman'; };
  /* ---- layar tetap menyala (Wake Lock) ---- */
  const wlOk = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  async function acquire() {
    if (!awake || !wlOk || lock || document.visibilityState !== 'visible') return;
    try { const l = await navigator.wakeLock.request('screen'); lock = l; l.addEventListener('release', () => { if (lock === l) lock = null; }); if (!awake) release(); }
    catch { lock = null; }
  }
  function release() { const l = lock; lock = null; if (l) { try { l.release(); } catch { /* */ } } }
  const onVis = () => { if (document.visibilityState === 'visible') acquire(); };
  document.addEventListener('visibilitychange', onVis);
  const teardown = () => { release(); document.removeEventListener('visibilitychange', onVis); clearInterval(guard); guard = 0; };
  guard = setInterval(() => { if (!root.isConnected) { stopAudio(); teardown(); } }, 1000);
  root.__stop = () => { stopAudio(); teardown(); };

  /* ---- kontrol ---- */
  const surahSel = h('select', { class: 'in qsel', 'aria-label': 'Pilih surat' }, h('option', { value: '' }, 'Lompat ke surat…'), ...surahs.map(s => h('option', { value: String(s.number) }, s.number + '. ' + s.latin)));
  surahSel.addEventListener('change', async () => { const v = Number(surahSel.value); surahSel.value = ''; if (v) await jump(v, 1); });
  const pin = h('input', { class: 'in qjump', type: 'number', inputmode: 'numeric', min: '1', max: String(PAGES), 'aria-label': 'Nomor halaman', placeholder: '1–' + PAGES });
  const goPin = () => { const v = Number(pin.value); if (!Number.isInteger(v) || v < 1 || v > PAGES) { toast('Masukkan nomor halaman 1 sampai ' + PAGES + '.', true); return; } show(v); };
  pin.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); goPin(); } });
  const prev = h('button', { class: 'btn-sm ghost mf-arrow', type: 'button', 'aria-label': 'Halaman sebelumnya', onclick: () => show(page - 1, null, 'r') }, '‹');
  const next = h('button', { class: 'btn-sm ghost mf-arrow', type: 'button', 'aria-label': 'Halaman berikutnya', onclick: () => show(page + 1, null, 'l') }, '›');
  const playBtn = h('button', { class: 'btn-sm', type: 'button', onclick: () => { if (seq) stopAudio(); else if (data) { seq = true; play(sel >= 0 ? sel : 0); } } }, '▶ Putar halaman');
  const sizeBtn = (t, d) => h('button', { class: 'btn-sm ghost', type: 'button', 'aria-label': d < 0 ? 'Perkecil tulisan' : 'Perbesar tulisan', onclick: () => { sizeIdx = opts.onSize(d); applySize(); } }, t);
  const themeBtns = THEMES.map(([k, l]) => h('button', { class: 'achip', type: 'button', 'data-theme-btn': k, 'aria-pressed': String(theme === k), onclick: () => { theme = k; lsSet('baituna.mushaftheme.v1', k); root.dataset.theme = k; themeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeBtn === k))); } }, l));
  const awakeBtn = h('button', { class: 'achip', type: 'button', id: 'mf-awake', 'aria-pressed': String(awake && wlOk), onclick: () => {
    if (!wlOk) { toast('Perangkat atau peramban ini belum mendukung layar tetap menyala.', true); return; }
    awake = !awake; lsSet('baituna.mushafawake.v1', awake ? '1' : '0'); awakeBtn.setAttribute('aria-pressed', String(awake));
    if (awake) { acquire(); toast('Layar akan tetap menyala selama Anda membaca.'); } else { release(); toast('Layar kembali mengikuti pengaturan HP.'); } } }, 'Layar tetap menyala');
  if (!wlOk) awakeBtn.title = 'Tidak didukung di perangkat ini';
  const swipeBtn = h('button', { class: 'achip', type: 'button', id: 'mf-swipe', onclick: () => { swipeDir = swipeDir === 'rtl' ? 'ltr' : 'rtl'; lsSet('baituna.mushafswipe.v1', swipeDir); drawSwipe(); } });
  const drawSwipe = () => { swipeBtn.textContent = swipeDir === 'rtl' ? 'Geser kanan = berikutnya' : 'Geser kiri = berikutnya'; swipeBtn.setAttribute('aria-label', 'Arah geser: ' + swipeBtn.textContent + '. Ketuk untuk membalik.'); };
  drawSwipe();
  const quick = h('div', { class: 'mf-quick' }, ...QUICK.map(([s, a, l]) => h('button', { class: 'achip', type: 'button', onclick: () => jump(s, a) }, l)));
  const body = h('div', { class: 'mf-body' }), bar = h('div', { class: 'mf-bar', hidden: true }), resume = h('div', { class: 'mf-resume', hidden: true, role: 'status' });
  function drawResume() {
    const mk = getMark(surahs);
    if (!mk) { resume.hidden = true; resume.replaceChildren(); return; }
    const s = surahs[mk.n - 1], here = !!data && data.ayahs.some(a => a.s === mk.n && a.n === mk.ayah);
    resume.hidden = false;
    resume.replaceChildren(
      h('div', { class: 'mf-rt' }, h('span', { class: 'hint' }, 'Terakhir dibaca'), h('b', {}, s.latin + ' ayat ' + mk.ayah + (mk.page ? ' · Hal. ' + mk.page : ''))),
      h('div', { class: 'row-btns' },
        h('button', { class: 'btn-sm', type: 'button', id: 'mf-resume', onclick: () => { if (mk.page) show(mk.page, { surah: mk.n, ayah: mk.ayah }); else jump(mk.n, mk.ayah); } }, here ? 'Ke penanda' : 'Lanjutkan'),
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { clearLast(); drawResume(); if (data) render(data); toast('Penanda dihapus.'); } }, 'Hapus penanda')));
  }

  async function jump(s, a) {
    try { const p = await pageOfAyah(s, a); await show(p, { surah: s, ayah: a }); }
    catch (e) { toast(e && e.code === 'BAD_DATA' ? 'Data dari server tidak lengkap, jadi tidak ditampilkan.' : 'Belum bisa pindah. Periksa koneksi internet.', true); }
  }

  /* ---- audio per ayat ---- */
  function mark(i) { cur = i; body.querySelectorAll('.mf-a').forEach((el, k) => el.classList.toggle('playing', k === i)); }
  function play(i) {
    if (!data || i < 0 || i >= data.ayahs.length) { stopAudio(); return; }
    if (audio) { try { audio.pause(); } catch { /* */ } audio.onended = audio.onerror = null; }
    const a = new Audio(data.ayahs[i].audio); audio = a; a.preload = 'auto';
    a.onended = () => { if (audio !== a) return; if (seq && i + 1 < data.ayahs.length) play(i + 1); else stopAudio(); };
    a.onerror = () => { if (audio !== a) return; stopAudio(); toast('Audio tidak bisa diputar. Periksa koneksi internet.', true); };
    mark(i); const el = body.querySelectorAll('.mf-a')[i]; if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    playBtn.textContent = seq ? '❚❚ Hentikan' : '▶ Putar halaman';
    const p = a.play(); if (p && p.catch) p.catch(() => { if (audio === a) { stopAudio(); toast('Audio tidak bisa diputar. Ketuk tombol putar sekali lagi.', true); } });
    if (!watch) watch = setInterval(() => { if (!root.isConnected) stopAudio(); }, 500);
  }

  /* ---- pilih ayat ---- */
  function select(i) {
    sel = i; body.querySelectorAll('.mf-a').forEach((el, k) => el.classList.toggle('sel', k === i));
    if (i < 0) { bar.hidden = true; bar.replaceChildren(); return; }
    const a = data.ayahs[i], s = surahs[a.s - 1];
    bar.hidden = false;
    bar.replaceChildren(h('div', { class: 'mf-ref' }, h('b', {}, s.latin + ' : ' + a.n), h('button', { class: 'tk-x', type: 'button', 'aria-label': 'Tutup', onclick: () => select(-1) }, '✕')),
      h('p', { class: 'atrans' }, a.id),
      h('div', { class: 'row-btns' },
        h('button', { class: 'btn-sm', type: 'button', onclick: () => { seq = false; play(i); } }, '▶ Putar ayat'),
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { seq = true; play(i); } }, 'Putar dari sini'),
        (() => { const mk = getMark(surahs), on = !!mk && mk.n === a.s && mk.ayah === a.n;
          return h('button', { class: 'btn-sm' + (on ? ' ghost' : ''), type: 'button', id: 'mf-mark', onclick: () => {
            if (on) { clearLast(); toast('Penanda dihapus.'); } else { setLast(a.s, a.n, data.page); toast('Tersimpan. Besok lanjut dari ' + s.latin + ' ayat ' + a.n + '.'); }
            const keep = sel; render(data); select(keep); drawResume(); }, 'aria-pressed': String(on) }, on ? 'Hapus penanda' : 'Selesai baca di sini'); })()));
  }

  /* ---- gambar halaman ---- */
  function render(d, focus) {
    const parts = []; let para = null; const mk = getMark(surahs);
    d.ayahs.forEach((a, i) => {
      if (a.n === 1) {
        const s = surahs[a.s - 1]; para = null;
        parts.push(h('div', { class: 'mf-head', 'data-surah': String(a.s) }, h('span', { class: 'mf-hl' }, 'Surat ' + a.s), h('b', { class: 'mf-hn', lang: 'ar', dir: 'rtl' }, s.name), h('span', { class: 'mf-hr' }, s.latin)));
        if (a.bism) parts.push(h('div', { class: 'mf-bism arab', lang: 'ar', dir: 'rtl' }, a.bism));
      }
      if (!para) { para = h('p', { class: 'mf-text arab', lang: 'ar', dir: 'rtl' }); parts.push(para); }
      const isMark = !!mk && mk.n === a.s && mk.ayah === a.n;
      const sp = h('span', { class: 'mf-a' + (isMark ? ' mark' : ''), 'data-g': String(a.g), role: 'button', tabindex: '0', 'aria-label': 'Ayat ' + a.n + ' ' + surahs[a.s - 1].latin + (isMark ? ' (penanda terakhir dibaca)' : '') }, a.ar + ' ', h('span', { class: 'mf-no' + (isMark ? ' flag' : ''), 'aria-hidden': 'true' }, toAr(a.n)));
      sp.addEventListener('click', () => select(sel === i ? -1 : i));
      sp.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(sel === i ? -1 : i); } });
      para.append(sp, ' ');
    });
    const names = d.surahs.map(s => s.latin).join(' · ');
    const off = d.offline ? h('p', { class: 'mf-off' }, 'Dibaca dari simpanan di perangkat (tanpa internet). Audio membutuhkan internet.') : '';
    const juz = d.juz.length ? 'Juz ' + d.juz.join('–') : '';
    body.replaceChildren(h('article', { class: 'mf-page' },
      h('header', { class: 'mf-ph' }, h('span', {}, juz), h('span', { class: 'mf-pn' }, names), h('span', {}, 'Hal. ' + d.page)),
      off,
      h('div', { class: 'mf-content' }, ...parts),
      h('footer', { class: 'mf-pf' }, String(d.page))),
      h('details', { class: 'panel mf-tr' }, h('summary', {}, 'Terjemahan halaman ini'),
        ...d.ayahs.map(a => h('p', { class: 'mf-trp' }, h('b', {}, surahs[a.s - 1].latin + ' ' + a.n + '. '), a.id))));
    sel = -1; bar.hidden = true; bar.replaceChildren();
    if (focus) { const i = d.ayahs.findIndex(a => a.s === focus.surah && a.n === focus.ayah); if (i >= 0) { select(i); const el = body.querySelectorAll('.mf-a')[i]; if (el && el.scrollIntoView) setTimeout(() => el.scrollIntoView({ block: 'center' }), 50); } }
  }

  async function show(n, focus, from) {
    if (!Number.isInteger(n) || n < 1 || n > PAGES) return;
    stopAudio(); page = n; pin.value = String(n);
    prev.disabled = n <= 1; next.disabled = n >= PAGES;
    const keepPos = !!from, y0 = window.scrollY;
    if (keepPos) { body.style.minHeight = body.offsetHeight + 'px'; body.style.opacity = '.45'; }
    else body.replaceChildren(h('p', { class: 'muted center' }, 'Memuat halaman ' + n + '…'));
    let d;
    try { d = await loadPage(n, qari()); }
    catch (e) {
      if (page !== n) return;
      body.style.minHeight = ''; body.style.opacity = '';
      body.replaceChildren(h('div', { class: 'empty' }, h('p', { class: 'muted' }, e && e.code === 'BAD_DATA' ? 'Data halaman dari server tidak lengkap, jadi tidak ditampilkan agar tidak salah. Coba lagi nanti.' : navigator.onLine === false ? 'Tidak ada internet, dan halaman ini belum pernah dibuka sehingga belum tersimpan di perangkat. Sambungkan internet, lalu coba lagi.' : 'Halaman belum bisa dimuat. Periksa koneksi internet, lalu coba lagi.'), h('button', { class: 'btn-sm', type: 'button', onclick: () => show(n, focus) }, 'Coba lagi')));
      return;
    }
    if (page !== n) return; // pengguna sudah pindah halaman lagi
    data = d; savePage(n); render(d, focus); drawResume();
    const art = body.querySelector('.mf-page'); if (art && from) art.classList.add(from === 'l' ? 'from-l' : 'from-r');
    if (keepPos) { body.style.minHeight = ''; body.style.opacity = ''; window.scrollTo(0, y0); } else window.scrollTo(0, 0);
    offlinePageCount().then(c => { const el = root.querySelector('.mf-offcount'); if (el) el.textContent = c ? 'Tersimpan untuk dibaca tanpa internet: ' + c + ' halaman.' : ''; });
    if (navigator.onLine !== false) setTimeout(() => { if (page === n && root.isConnected) { if (n < PAGES) loadPage(n + 1, qari()).catch(() => {}); if (n > 1) loadPage(n - 1, qari()).catch(() => {}); } }, 1200);
  }

  /* ---- geser untuk pindah halaman (arah bawaan mengikuti mushaf: geser ke kanan = halaman berikutnya) ---- */
  let sx = 0, sy = 0, stt = 0, sid = null, swiped = false;
  body.addEventListener('pointerdown', e => { if (!e.isPrimary) return; sx = e.clientX; sy = e.clientY; stt = Date.now(); sid = e.pointerId; swiped = false; });
  body.addEventListener('pointercancel', () => { sid = null; });
  body.addEventListener('pointerup', e => {
    if (e.pointerId !== sid) return; sid = null;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Date.now() - stt > 900 || Math.abs(dx) < 60 || Math.abs(dx) < 1.6 * Math.abs(dy)) return;
    swiped = true;
    const nextWanted = swipeDir === 'rtl' ? dx > 0 : dx < 0, target = page + (nextWanted ? 1 : -1);
    if (target < 1 || target > PAGES) { toast(target < 1 ? 'Ini halaman pertama.' : 'Ini halaman terakhir.'); return; }
    show(target, null, dx > 0 ? 'l' : 'r');
  });
  body.addEventListener('click', e => { if (swiped) { e.stopPropagation(); e.preventDefault(); swiped = false; } }, true);

  root.append(
    h('div', { class: 'qtools' }, surahSel, playBtn),
    h('div', { class: 'mf-nav' }, prev, pin, h('button', { class: 'btn-sm', type: 'button', onclick: goPin }, 'Pergi'), next),
    quick,
    h('div', { class: 'qtools2' }, sizeBtn('A−', -1), sizeBtn('A+', 1), h('span', { class: 'hint' }, 'Geser halaman untuk pindah. Ketuk ayat untuk terjemahan dan audio.')),
    h('div', { class: 'mf-opts', role: 'group', 'aria-label': 'Tampilan membaca' }, ...themeBtns, awakeBtn, swipeBtn),
    resume, body, bar,
    h('p', { class: 'hint mf-offcount' }, ''),
    h('p', { class: 'muted mf-note' }, 'Halaman yang pernah dibuka, serta halaman sebelum dan sesudahnya, otomatis tersimpan di perangkat agar bisa dibaca tanpa internet. Tema berlaku untuk halaman bacaan. Tampilan teks mushaf dari AlQuran Cloud (Utsmani, Mushaf Madinah). Pemenggalan baris mengikuti lebar layar, bukan gambar mushaf cetak. Untuk rujukan resmi gunakan mushaf bertanda tashih Kemenag.'));
  show(page, opts.focus); drawResume(); acquire();
  return root;
}
