// BAITUNA - quran-ui.js
// Halaman Al-Qur'an: daftar 114 surat, baca teks Arab + terjemahan, dengarkan per ayat atau berurutan.
import { h, toast } from './ui.js';
import { listSurahs, loadSurah, loadAudio, RECITERS } from './quran-service.js';

const KEY = 'baituna.qari.v1';
const getQari = () => { try { const v = localStorage.getItem(KEY); return RECITERS.some(r => r.id === v) ? v : RECITERS[0].id; } catch { return RECITERS[0].id; } };
const setQari = v => { try { localStorage.setItem(KEY, v); } catch { /* abaikan */ } };
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '');

let player = null; // satu pemutar saja agar tidak ada dua suara bersamaan
function stopPlayer() { if (player) { try { player.pause(); } catch { /* */ } player.onended = player.onerror = null; player = null; } }

export function quranPage() {
  const wrap = h('div', { class: 'quran' }, h('p', { class: 'muted center' }, 'Memuat daftar surat…'));
  let surahs = [], q = '';
  stopPlayer();

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
    wrap.replaceChildren(h('h2', { class: 'wtitle' }, 'Al-Qur’an'), h('p', { class: 'muted' }, '114 surat dengan terjemahan Indonesia dan audio per ayat.'), search, col, note());
    fill();
  }

  async function open(n) {
    wrap.replaceChildren(h('p', { class: 'muted center' }, 'Memuat surat…'));
    window.scrollTo(0, 0);
    let data;
    try { data = await loadSurah(n, getQari()); }
    catch (e) { failure(() => open(n), e && e.code === 'BAD_DATA' ? 'Data surat dari server tidak lengkap, jadi tidak ditampilkan agar tidak salah. Coba lagi nanti.' : ''); return; }
    read(data);
  }

  function read(data) {
    stopPlayer();
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
      mark(i);
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

    data.ayahs.forEach((a, i) => {
      const b = h('button', { class: 'qplay', type: 'button', 'aria-label': 'Putar ayat ' + a.n, onclick: () => { if (cur === i && player) stopAll(); else { continuous = false; allBtn.textContent = '▶ Putar semua'; play(i); } } }, '▶');
      btns.push(b);
      cards.push(h('article', { class: 'ayah' },
        h('div', { class: 'ahead' }, h('span', { class: 'snum sm' }, String(a.n)), b),
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
      ...cards,
      note());
  }

  function init() {
    wrap.replaceChildren(h('p', { class: 'muted center' }, 'Memuat daftar surat…'));
    listSurahs().then(r => { surahs = r; list(); }).catch(() => failure(init));
  }
  init();
  return wrap;
}
