// BAITUNA - quran-ui.js
// Halaman Al-Qur'an: daftar 114 surat, baca teks Arab + terjemahan, dengarkan per ayat atau berurutan.
import { h, toast } from './ui.js';
import { listSurahs, loadSurah, loadAudio, RECITERS } from './quran-service.js';

const KEY = 'baituna.qari.v1';
const getQari = () => { try { const v = localStorage.getItem(KEY); return RECITERS.some(r => r.id === v) ? v : RECITERS[0].id; } catch { return RECITERS[0].id; } };
const setQari = v => { try { localStorage.setItem(KEY, v); } catch { /* abaikan */ } };
const SIZES = [1.5, 1.8, 2.1, 2.5, 3];
const getPref = () => { try { const p = JSON.parse(localStorage.getItem('baituna.quranpref.v1')); return { size: SIZES.includes(p.size) ? p.size : 2.1, font: p.font === 'sch' ? 'sch' : 'amiri' }; } catch { return { size: 2.1, font: 'amiri' }; } };
const setPref = p => { try { localStorage.setItem('baituna.quranpref.v1', JSON.stringify(p)); } catch { /* abaikan */ } };
// Dipakai halaman Profil & Pengaturan (ukuran/gaya tulisan Arab dan bacaan terakhir).
export const READING_SIZES = SIZES;
export const readingPrefs = () => getPref();
export const saveReadingPrefs = p => setPref(p);
export const lastRead = () => getLast();
const TSIZES = [0.95, 1.05, 1.2, 1.4, 1.65];
const LAST = 'baituna.quranlast.v1';
const getLast = () => { try { const v = JSON.parse(localStorage.getItem(LAST)); return v && Number.isInteger(v.n) && Number.isInteger(v.ayah) && v.n >= 1 && v.n <= 114 && v.ayah >= 1 ? v : null; } catch { return null; } };
const setLast = (n, ayah) => { try { localStorage.setItem(LAST, JSON.stringify({ n, ayah })); } catch { /* abaikan */ } };
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '');

let player = null; // satu pemutar saja agar tidak ada dua suara bersamaan
function stopPlayer() { if (player) { try { player.pause(); } catch { /* */ } player.onended = player.onerror = null; player = null; } }

export function quranPage() {
  const wrap = h('div', { class: 'quran' }, h('p', { class: 'muted center' }, 'Memuat daftar surat…'));
  let surahs = [], q = '';
  stopPlayer();
  const pref = getPref();
  const applyPref = () => { wrap.style.setProperty('--qsize', pref.size + 'rem'); wrap.style.setProperty('--qtsize', TSIZES[SIZES.indexOf(pref.size)] + 'rem'); wrap.dataset.font = pref.font; };
  applyPref();

  const note = () => h('div', { class: 'panel qnote' }, h('h3', {}, 'Tentang sumber'),
    h('p', { class: 'muted' }, 'Teks Arab: Utsmani (Tanzil, diverifikasi terhadap Mushaf Madinah). Terjemahan: Bahasa Indonesia. Audio: Mishary Alafasy dan Mahmoud Khalil Al-Husary. Semua dimuat langsung dari AlQuran Cloud; BAITUNA tidak mengubah teksnya.'),
    h('p', { class: 'muted' }, 'Halaman ini alat bantu baca dan dengar, bukan mushaf yang ditashih. Untuk rujukan resmi gunakan mushaf bertanda tashih Kemenag (Lajnah Pentashihan Mushaf Al-Qur’an), dan belajar tajwid langsung kepada guru.'));

  function failure(retry, text) {
    wrap.replaceChildren(h('div', { class: 'empty' }, h('p', { class: 'muted' }, text || 'Al-Qur’an belum bisa dimuat. Periksa koneksi internet, lalu coba lagi.'),
      h('button', { class: 'btn-sm', type: 'button', onclick: retry }, 'Coba lagi')));
  }

  function list() {
    stopPlayer();
    const search = h('input', { class: 'in', type: 'search', placeholder: 'Cari surat (nama atau nomor)', maxlength: '40', value: q, autocomplete: 'off', 'aria-label': 'Cari surat' });
    const col = h('div', { class: 'qlist' });
    const row = s => h('button', { class: 'srow', type: 'button', onclick: () => open(s.number) },
      h('span', { class: 'snum' }, String(s.number)),
      h('span', { class: 'sinfo' }, h('b', {}, s.latin), h('span', { class: 'muted' }, s.place + ' · ' + s.ayahs + ' ayat')),
      h('span', { class: 'sar', lang: 'ar', dir: 'rtl' }, s.name));
    const fill = () => {
      const t = norm(q);
      const rows = !t ? surahs : /^\d+$/.test(t) ? surahs.filter(s => String(s.number) === t) : surahs.filter(s => norm(s.latin).includes(t) || norm(s.name).includes(t));
      col.replaceChildren(...(rows.length ? rows.map(row) : [h('p', { class: 'muted center' }, 'Tidak ada surat yang cocok.')]));
    };
    search.addEventListener('input', () => { q = search.value; fill(); });
    const last = getLast(), ls = last && surahs.find(x => x.number === last.n);
    const cont = ls && last.ayah <= ls.ayahs ? h('button', { class: 'qcont', type: 'button', onclick: () => open(last.n, last.ayah) },
      h('span', {}, 'Lanjutkan membaca'), h('b', {}, ls.latin + ' · ayat ' + last.ayah)) : '';
    wrap.replaceChildren(h('h2', { class: 'wtitle' }, 'Al-Qur’an'), h('p', { class: 'muted' }, '114 surat dengan terjemahan Indonesia dan audio per ayat.'), cont, search, col, note());
    fill();
  }

  async function open(n, ayah) {
    wrap.replaceChildren(h('p', { class: 'muted center' }, 'Memuat surat…'));
    window.scrollTo(0, 0);
    let data;
    try { data = await loadSurah(n, getQari()); }
    catch (e) { failure(() => open(n, ayah), e && e.code === 'BAD_DATA' ? 'Data surat dari server tidak lengkap, jadi tidak ditampilkan agar tidak salah. Coba lagi nanti.' : ''); return; }
    read(data, ayah);
  }

  function read(data, startAyah) {
    stopPlayer();
    { const l = getLast(); const keep = l && l.n === data.number && l.ayah <= data.ayahs.length; setLast(data.number, startAyah || (keep ? l.ayah : 1)); }
    let cur = -1, continuous = false, watch = 0;
    const urls = data.ayahs.map(a => a.audio);
    const cards = [], btns = [];
    const allBtn = h('button', { class: 'btn-sm', type: 'button' }, '▶ Putar semua');
    const stopAll = () => { continuous = false; stopPlayer(); clearInterval(watch); watch = 0; mark(-1); allBtn.textContent = '▶ Putar semua'; };
    function mark(i) {
      cur = i;
      cards.forEach((c, k) => c.classList.toggle('playing', k === i));
      btns.forEach((b, k) => { const on = k === i; b.setAttribute('aria-label', (on ? 'Hentikan ayat ' : 'Putar ayat ') + (k + 1)); b.textContent = on ? '❚❚' : '▶'; });
    }
    function play(i) {
      stopPlayer();
      if (i >= urls.length) { stopAll(); return; }
      const a = new Audio(urls[i]); player = a; a.preload = 'auto';
      a.onended = () => { if (player !== a) return; if (continuous && i + 1 < urls.length) { play(i + 1); cards[i + 1].scrollIntoView({ block: 'center', behavior: 'smooth' }); } else stopAll(); };
      a.onerror = () => { if (player !== a) return; stopAll(); toast('Audio tidak bisa diputar. Periksa koneksi internet.', true); };
      mark(i); setLast(data.number, i + 1); markStars();
      allBtn.textContent = continuous ? '❚❚ Hentikan' : '▶ Putar semua';
      const p = a.play(); if (p && p.catch) p.catch(() => { if (player === a) { stopAll(); toast('Audio tidak bisa diputar. Ketuk tombol putar sekali lagi.', true); } });
      // Berhenti sendiri bila halaman ditinggalkan (pindah tab).
      if (!watch) watch = setInterval(() => { if (!wrap.isConnected) stopAll(); }, 500);
    }
    allBtn.addEventListener('click', () => { if (continuous) { stopAll(); } else { continuous = true; play(cur >= 0 ? cur : 0); } });

    const sel = h('select', { class: 'in qsel', 'aria-label': 'Pilih qari' }, ...RECITERS.map(r => h('option', { value: r.id }, r.name)));
    sel.value = data.reciter;
    sel.addEventListener('change', async () => {
      const keep = continuous, at = cur; stopAll(); sel.disabled = true;
      try { const u = await loadAudio(data.number, sel.value, data.ayahs.length); u.forEach((x, k) => { urls[k] = x; }); setQari(sel.value); data.reciter = sel.value; toast('Qari diganti.'); if (keep && at >= 0) { continuous = true; play(at); } }
      catch { sel.value = data.reciter; toast('Qari belum bisa diganti. Periksa koneksi.', true); }
      sel.disabled = false;
    });

    const step = d => { const k = Math.max(0, Math.min(SIZES.length - 1, SIZES.indexOf(pref.size) + d)); pref.size = SIZES[k]; setPref(pref); applyPref(); };
    const sizeBtn = (t, d) => h('button', { class: 'btn-sm ghost', type: 'button', 'aria-label': d < 0 ? 'Perkecil tulisan Arab' : 'Perbesar tulisan Arab', onclick: () => step(d) }, t);
    const fontSel = h('select', { class: 'in qsel', 'aria-label': 'Gaya tulisan Arab' }, h('option', { value: 'amiri' }, 'Tulisan: Amiri'), h('option', { value: 'sch' }, 'Tulisan: Scheherazade'));
    fontSel.value = pref.font;
    fontSel.addEventListener('change', () => { pref.font = fontSel.value; setPref(pref); applyPref(); });

    const stars = [];
    const markStars = () => { const l = getLast(); stars.forEach((b, k) => { const on = !!l && l.n === data.number && l.ayah === k + 1; b.textContent = on ? '\u2605' : '\u2606'; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); };
    const jumpIn = h('input', { class: 'in qjump', type: 'number', inputmode: 'numeric', min: '1', max: String(data.ayahs.length), placeholder: 'Ke ayat (1\u2013' + data.ayahs.length + ')', 'aria-label': 'Nomor ayat tujuan' });
    const go = () => {
      const v = Number(jumpIn.value);
      if (!Number.isInteger(v) || v < 1 || v > data.ayahs.length) { toast('Masukkan nomor ayat 1 sampai ' + data.ayahs.length + '.', true); return; }
      const c = cards[v - 1]; c.scrollIntoView({ block: 'start', behavior: 'smooth' }); c.classList.add('jump'); setTimeout(() => c.classList.remove('jump'), 2000); jumpIn.blur();
    };
    jumpIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    const jumpBtn = h('button', { class: 'btn-sm', type: 'button', onclick: go }, 'Pergi');

    data.ayahs.forEach((a, i) => {
      const b = h('button', { class: 'qplay', type: 'button', 'aria-label': 'Putar ayat ' + a.n, onclick: () => { if (cur === i && player) stopAll(); else { continuous = false; allBtn.textContent = '▶ Putar semua'; play(i); } } }, '▶');
      btns.push(b);
      const star = h('button', { class: 'qstar', type: 'button', 'aria-label': 'Tandai ayat ' + a.n + ' sebagai terakhir dibaca', onclick: () => { setLast(data.number, a.n); markStars(); toast('Ditandai: ayat ' + a.n + '.'); } }, '\u2606');
      stars.push(star);
      cards.push(h('article', { class: 'ayah' },
        h('div', { class: 'ahead' }, h('span', { class: 'snum sm' }, String(a.n)), h('span', { class: 'abtns' }, star, b)),
        h('p', { class: 'arab', lang: 'ar', dir: 'rtl' }, a.ar),
        h('p', { class: 'atrans' }, a.id)));
    });

    wrap.replaceChildren(
      h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { stopAll(); list(); window.scrollTo(0, 0); } }, '← Daftar surat'),
      h('div', { class: 'qhero' },
        h('div', { class: 'qh-ar', lang: 'ar', dir: 'rtl' }, data.name),
        h('b', {}, data.number + '. ' + data.latin),
        h('span', {}, data.place + ' · ' + data.ayahs.length + ' ayat'),
        data.bismillah ? h('div', { class: 'bism arab', lang: 'ar', dir: 'rtl' }, data.bismillah) : ''),
      h('div', { class: 'qtools' }, sel, allBtn),
      h('div', { class: 'qtools2' }, sizeBtn('A\u2212', -1), sizeBtn('A+', 1), fontSel),
      h('div', { class: 'qtools2' }, jumpIn, jumpBtn),
      ...cards,
      note());
    markStars();
    if (startAyah && startAyah > 1 && cards[startAyah - 1]) requestAnimationFrame(() => { cards[startAyah - 1].scrollIntoView({ block: 'start' }); cards[startAyah - 1].classList.add('jump'); setTimeout(() => cards[startAyah - 1].classList.remove('jump'), 2000); });
  }

  function init() {
    wrap.replaceChildren(h('p', { class: 'muted center' }, 'Memuat daftar surat…'));
    listSurahs().then(r => { surahs = r; list(); }).catch(() => failure(init));
  }
  init();
  return wrap;
}

// Dipakai halaman lain (mis. Rukun Islam & Iman) agar ukuran dan gaya tulisan Arab sama dengan pilihan pengguna di tab Al-Qur'an.
export function applyReadingPrefs(el) {
  const p = getPref();
  el.classList.add('quran');
  el.style.setProperty('--qsize', p.size + 'rem');
  el.style.setProperty('--qtsize', TSIZES[SIZES.indexOf(p.size)] + 'rem');
  el.dataset.font = p.font;
}
