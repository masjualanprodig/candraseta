// BAITUNA - rukun-ui.js
// Rukun Islam & Rukun Iman: (1) tampilan publik, (2) pengelolaan oleh Super Admin.
// Ayat Al-Qur'an diambil otomatis (tidak diketik ulang). Hadits dan tuntunan ditulis Super Admin dengan sumber jelas.
import { h, toast, hint, ask } from './ui.js';
import { icon, ICONS, emptyState } from './feed-ui.js';
import { PILLARS, GROUPS, KINDS, listPillarItems, createPillarItem, updatePillarItem, deletePillarItem } from './rukun-service.js';
import { listSurahs, loadAyat } from './quran-service.js';
import { applyReadingPrefs } from './quran-ui.js';

const byKey = k => PILLARS.find(p => p.key === k);
const notReady = e => e && (e.code === '42P01' || e.code === 'PGRST205' || e.status === 404);
const refLabel = (surahs, it) => {
  const s = surahs && surahs.find(x => x.number === it.surah);
  return 'QS. ' + (s ? s.latin : 'Surat ' + it.surah) + ' [' + it.surah + ']: ' + (it.ayah_from === it.ayah_to ? it.ayah_from : it.ayah_from + '–' + it.ayah_to);
};

// Satu blok dalil Al-Qur'an (dimuat sendiri-sendiri; gagal satu tidak merusak yang lain).
function ayatBlock(it, surahs) {
  const box = h('div', { class: 'dalil' }, h('p', { class: 'dref' }, refLabel(surahs, it)), h('p', { class: 'muted' }, 'Memuat ayat…'));
  const fill = () => loadAyat(it.surah, it.ayah_from, it.ayah_to).then(rows => {
    box.replaceChildren(h('p', { class: 'dref' }, refLabel(surahs, it)),
      ...rows.map(a => h('div', {}, h('p', { class: 'arab', lang: 'ar', dir: 'rtl' }, a.ar), h('p', { class: 'atrans' }, (rows.length > 1 ? a.n + '. ' : '') + a.id))));
  }).catch(() => box.replaceChildren(h('p', { class: 'dref' }, refLabel(surahs, it)),
    h('p', { class: 'muted' }, 'Ayat belum bisa dimuat. Periksa koneksi internet.'), h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { box.lastChild.disabled = true; fill(); } }, 'Coba lagi')));
  fill();
  return box;
}

/* ===== 1. Publik ===== */
export function rukunPage() {
  const wrap = h('div', { class: 'rukun' }, h('p', { class: 'muted center' }, 'Memuat…'));
  applyReadingPrefs(wrap);
  let items = [], surahs = null;

  function list() {
    const countOf = k => {
      const n = kd => items.filter(i => i.pillar === k && i.kind === kd).length;
      return [[n('ayat'), 'dalil'], [n('hadits'), 'hadits'], [n('tuntunan'), 'tuntunan']].filter(x => x[0]).map(x => x[0] + ' ' + x[1]).join(' \u00b7 ');
    };
    const group = g => h('div', {}, h('h3', { class: 'rgroup' }, GROUPS[g] + ' (' + PILLARS.filter(p => p.group === g).length + ')'),
      h('div', { class: 'qlist' }, ...PILLARS.filter(p => p.group === g).map((p, i) => h('button', { class: 'srow', type: 'button', onclick: () => detail(p) },
        h('span', { class: 'snum' }, String(i + 1)), h('span', { class: 'sinfo' }, h('b', {}, p.name), h('span', { class: 'muted' }, countOf(p.key) || 'Segera ditambahkan')),
        icon(ICONS.chev, 'ic-chev')))));
    wrap.replaceChildren(h('h2', { class: 'wtitle' }, 'Rukun Islam & Rukun Iman'),
      h('p', { class: 'muted' }, 'Dalil dari Al-Qur’an, hadits, dan tuntunan ringkas.'), group('islam'), group('iman'), note());
    window.scrollTo(0, 0);
  }
  const note = () => h('div', { class: 'panel qnote' }, h('h3', {}, 'Tentang isi halaman ini'),
    h('p', { class: 'muted' }, 'Ayat Al-Qur’an diambil otomatis dari AlQuran Cloud dan tidak diubah. Hadits dan tuntunan ditulis oleh admin pusat BAITUNA dengan menyebut sumbernya. Untuk pendalaman dan kepastian hukum, bertanyalah kepada ustaz atau ulama yang terpercaya.'));

  function detail(p) {
    const mine = items.filter(i => i.pillar === p.key);
    const of = k => mine.filter(i => i.kind === k);
    const section = (kind, rows, build, empty) => h('div', { class: 'panel' }, h('h3', {}, KINDS[kind]),
      rows.length ? rows.map(build) : h('p', { class: 'muted' }, empty));
    wrap.replaceChildren(
      h('button', { class: 'btn-sm ghost', type: 'button', onclick: list }, '← ' + GROUPS[p.group]),
      h('h2', { class: 'mt' }, p.name),
      section('ayat', of('ayat'), it => ayatBlock(it, surahs), 'Belum ada dalil Al-Qur’an untuk bagian ini.'),
      section('hadits', of('hadits'), it => h('div', { class: 'dalil' },
        h('p', { class: 'arab', lang: 'ar', dir: 'rtl' }, it.arabic), h('p', { class: 'atrans prewrap' }, it.body),
        h('p', { class: 'dsrc' }, h('b', {}, 'Sumber: '), it.source, it.grade ? h('span', { class: 'hperiod grade' }, it.grade) : '')), 'Belum ada hadits. Akan ditambahkan oleh admin pusat.'),
      section('tuntunan', of('tuntunan'), it => h('div', { class: 'dalil' }, it.title ? h('b', {}, it.title) : '', h('p', { class: 'prewrap hread' }, it.body)), 'Belum ada tuntunan. Akan ditambahkan oleh admin pusat.'),
      note());
    window.scrollTo(0, 0);
  }

  Promise.all([listPillarItems(), listSurahs().catch(() => null)]).then(([rows, s]) => { items = rows; surahs = s; list(); }).catch(e => {
    wrap.replaceChildren(h('div', { class: 'empty' }, h('p', { class: 'muted' },
      notReady(e) ? 'Halaman ini belum aktif. Admin pusat perlu menjalankan rukun.sql.' : 'Halaman belum bisa dimuat. Periksa koneksi, lalu coba lagi.')));
  });
  return wrap;
}

/* ===== 2. Super Admin ===== */
export async function renderRukunManager(box, onBack, pillarKey) {
  let rows, surahs = null;
  try { [rows, surahs] = await Promise.all([listPillarItems(), listSurahs().catch(() => null)]); }
  catch (e) {
    box.replaceChildren(onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '',
      h('div', { class: 'panel center' }, h('p', {}, notReady(e) ? 'Fitur ini belum aktif. Jalankan rukun.sql di Supabase SQL Editor.' : 'Data belum bisa dimuat. Periksa koneksi, lalu coba lagi.'),
        h('button', { class: 'btn-sm', type: 'button', onclick: () => renderRukunManager(box, onBack, pillarKey) }, 'Coba lagi')));
    return;
  }
  const reload = k => renderRukunManager(box, onBack, k || sel.value);
  let editing = null;

  const sel = h('select', { class: 'in', 'aria-label': 'Pilih rukun' }, ...Object.keys(GROUPS).map(g => h('optgroup', { label: GROUPS[g] },
    ...PILLARS.filter(p => p.group === g).map(p => h('option', { value: p.key }, p.name)))));
  sel.value = pillarKey && byKey(pillarKey) ? pillarKey : PILLARS[0].key;
  sel.addEventListener('change', () => reload(sel.value));

  const kind = h('select', { class: 'in', 'aria-label': 'Jenis isi' }, ...Object.keys(KINDS).map(k => h('option', { value: k }, KINDS[k])));
  kind.value = 'hadits';
  // ayat
  const surahSel = h('select', { class: 'in', 'aria-label': 'Surat' }, ...(surahs || Array.from({ length: 114 }, (_, i) => ({ number: i + 1, latin: 'Surat ' + (i + 1) }))).map(s => h('option', { value: String(s.number) }, s.number + '. ' + s.latin)));
  const from = h('input', { class: 'in', type: 'number', inputmode: 'numeric', min: '1', max: '286', placeholder: 'Ayat awal' });
  const to = h('input', { class: 'in', type: 'number', inputmode: 'numeric', min: '1', max: '286', placeholder: 'Ayat akhir (kosongkan bila satu ayat)' });
  const preview = h('div', { class: 'dalil', hidden: true });
  const previewBtn = h('button', { class: 'btn-sm ghost', type: 'button' }, 'Lihat pratinjau ayat');
  // hadits + tuntunan
  const arabic = h('textarea', { class: 'in arab-in', lang: 'ar', dir: 'rtl', placeholder: 'Teks Arab hadits (wajib)', maxlength: '4000' });
  const body = h('textarea', { class: 'in tall', placeholder: 'Terjemahan / isi (wajib)', maxlength: '8000' });
  const source = h('textarea', { class: 'in', placeholder: 'Sumber (wajib), mis. HR. Muslim no. 8, Kitab Iman', maxlength: '500' });
  const grade = h('select', { class: 'in', 'aria-label': 'Derajat hadits' }, h('option', { value: '' }, 'Derajat (pilih)'), h('option', { value: 'Shahih' }, 'Shahih'), h('option', { value: 'Hasan' }, 'Hasan'));
  const title = h('input', { class: 'in', placeholder: 'Judul (opsional)', maxlength: '150', autocomplete: 'off' });
  const fAyat = h('div', {}, h('label', { class: 'hint' }, 'Ayat Al-Qur’an: hanya rujukan yang disimpan. Teks Arab dan terjemahnya diambil otomatis dari layanan Al-Qur’an.'), surahSel, from, to, previewBtn, preview);
  const slotH = h('div'), slotT = h('div');
  const fHadits = h('div', {}, arabic, slotH, source, grade);
  const fTuntunan = h('div', {}, title, slotT);
  // satu kolom 'body' dipakai bersama oleh hadits (terjemahan) dan tuntunan (isi); dipindah sesuai jenis yang dipilih
  const place = () => {
    const k = kind.value;
    fAyat.hidden = k !== 'ayat'; fHadits.hidden = k !== 'hadits'; fTuntunan.hidden = k !== 'tuntunan';
    if (k === 'hadits') slotH.appendChild(body); else if (k === 'tuntunan') slotT.appendChild(body);
    body.placeholder = k === 'hadits' ? 'Terjemahan hadits, bahasa Indonesia (wajib)' : 'Isi tuntunan (wajib, maks. 8.000 karakter)';
  };
  kind.addEventListener('change', place);

  previewBtn.addEventListener('click', async () => {
    const f = readAyat(); if (!f) return;
    preview.hidden = false; preview.replaceChildren(h('p', { class: 'muted' }, 'Memuat…'));
    try {
      const r = await loadAyat(f.surah, f.ayah_from, f.ayah_to);
      preview.replaceChildren(h('p', { class: 'dref' }, refLabel(surahs, f)), ...r.map(a => h('div', {}, h('p', { class: 'arab', lang: 'ar', dir: 'rtl' }, a.ar), h('p', { class: 'atrans' }, a.n + '. ' + a.id))));
    } catch { preview.replaceChildren(h('p', { class: 'muted' }, 'Ayat tidak ditemukan atau belum bisa dimuat. Periksa nomor ayat dan koneksi.')); }
  });
  function readAyat() {
    const a1 = Number(from.value), a2 = to.value.trim() === '' ? a1 : Number(to.value);
    if (!Number.isInteger(a1) || !Number.isInteger(a2) || a1 < 1 || a2 < a1) { toast('Isi nomor ayat dengan benar (ayat akhir tidak boleh lebih kecil dari ayat awal).', true); return null; }
    if (a2 - a1 > 5) { toast('Maksimal 6 ayat berurutan per rujukan.', true); return null; }
    return { surah: Number(surahSel.value), ayah_from: a1, ayah_to: a2 };
  }

  const formTitle = h('h3', {}, 'Tambah isi');
  const status = h('p', { class: 'hint' }, '');
  const save = h('button', { class: 'btn-sm', type: 'submit' }, 'Simpan');
  const cancel = h('button', { class: 'btn-sm ghost', type: 'button', hidden: true, onclick: () => reload() }, 'Batal ubah');

  const form = h('form', {
    class: 'panel rform', novalidate: 'novalidate',
    onsubmit: async ev => {
      ev.preventDefault();
      const k = editing ? editing.kind : kind.value; let f;
      if (k === 'ayat') { f = readAyat(); if (!f) return; }
      else if (k === 'hadits') {
        f = { arabic: arabic.value.trim(), body: body.value.trim(), source: source.value.trim(), grade: grade.value };
        if (f.arabic.length < 3) { toast('Teks Arab hadits wajib diisi.', true); return; }
        if (f.body.length < 3) { toast('Terjemahan hadits wajib diisi.', true); return; }
        if (f.source.length < 3) { toast('Sumber hadits wajib diisi (perawi dan nomor).', true); return; }
      } else {
        f = { title: title.value.trim(), body: body.value.trim() };
        if (f.body.length < 10) { toast('Isi tuntunan minimal 10 karakter.', true); return; }
      }
      save.disabled = true;
      try {
        if (editing) await updatePillarItem(editing.id, k, f); else await createPillarItem(sel.value, k, f);
        toast(editing ? 'Perubahan disimpan.' : 'Ditambahkan.');
        await reload(); return;
      } catch (e) {
        if (e && e.status === 401) return;
        const msg = e && e.status === 0 ? 'Tidak ada koneksi internet.' : 'Belum tersimpan. ' + hint(e);
        status.textContent = msg; toast(msg, true);
      }
      save.disabled = false;
    }
  }, formTitle, h('label', { class: 'hint' }, 'Jenis isi'), kind, fAyat, fHadits, fTuntunan, status, h('div', { class: 'mt row-btns' }, save, cancel));
  place();

  function edit(e) {
    editing = e; formTitle.textContent = 'Ubah ' + KINDS[e.kind].toLowerCase();
    kind.value = e.kind; kind.disabled = true; place();
    if (e.kind === 'ayat') { surahSel.value = String(e.surah); from.value = e.ayah_from; to.value = e.ayah_to === e.ayah_from ? '' : e.ayah_to; }
    else if (e.kind === 'hadits') { arabic.value = e.arabic || ''; body.value = e.body || ''; source.value = e.source || ''; grade.value = e.grade || ''; }
    else { title.value = e.title || ''; body.value = e.body || ''; }
    cancel.hidden = false; form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const mine = rows.filter(r => r.pillar === sel.value);
  const label = it => it.kind === 'ayat' ? refLabel(surahs, it) : it.kind === 'hadits' ? (it.source || 'Hadits') : (it.title || 'Tuntunan');
  const detailOf = it => it.kind === 'ayat' ? 'Teks diambil otomatis' : (it.body || '').slice(0, 90) + ((it.body || '').length > 90 ? '…' : '');
  const item = it => h('div', { class: 'post' }, h('div', { class: 'fi-main' },
    h('span', { class: 'hperiod' }, KINDS[it.kind]), h('b', {}, ' ' + label(it)), h('div', { class: 'muted' }, detailOf(it)),
    h('div', { class: 'row-btns mt' },
      h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => edit(it) }, 'Ubah'),
      h('button', { class: 'btn-sm alt', type: 'button', onclick: async () => {
        if (!(await ask({ title: 'Hapus isi ini?', text: label(it) + ' akan dihapus dari halaman dan tidak bisa dikembalikan.', reason: false }))) return;
        try { await deletePillarItem(it.id); toast('Dihapus.'); await reload(); } catch (er) { if (er.status !== 401) toast('Gagal menghapus. ' + hint(er), true); }
      } }, 'Hapus'))));

  box.replaceChildren(...[
    onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '',
    h('h2', { class: 'mt' }, 'Kelola Rukun Islam & Iman'),
    h('p', { class: 'muted' }, 'Hanya Super Admin yang bisa mengubah. Pilih rukun, lalu tambahkan dalil, hadits, atau tuntunan. Hadits wajib mencantumkan teks Arab, terjemahan, dan sumber (perawi serta nomor). Sebaiknya diperiksa ustaz sebelum diterbitkan.'),
    h('label', { class: 'hint mt' }, 'Rukun'), sel, form,
    h('div', { class: 'panel' }, h('h3', {}, 'Isi untuk ' + byKey(sel.value).name + ' (' + mine.length + ')'),
      mine.length ? mine.map(item) : h('p', { class: 'muted' }, 'Belum ada isi.'))
  ].flat());
  window.scrollTo(0, 0);
}
