// BAITUNA - home-builder-ui.js (v92)
// Editor "Tampilan Beranda" (Super Admin): atur blok beranda tiap peran dari atas ke bawah.
// Naik/turun dengan tombol, tambah/hapus blok, ubah isi blok, pratinjau, simpan, kembalikan ke bawaan.
import { h, toast, ask } from './ui.js';
import { prepareImage } from './photo.js';
import { errorText } from './branding-service.js';
import { ROLES, LINKS, LIMITS, BUILTINS, REQUIRED, builtinLabel, defaultBlocks, fetchLayout, saveLayout, resetLayout } from './home-layout-service.js';
import { layoutNodes } from './home-builder.js';

const TYPE_NAME = { banner: 'Banner slide', fitur: 'Kotak fitur', text: 'Teks' };
const clone = o => JSON.parse(JSON.stringify(o, (k, v) => (k === '_file' || k === '_url') ? undefined : v));
const msgOf = e => (e && e.code === '22023' && e.message) ? e.message.charAt(0).toUpperCase() + e.message.slice(1) + '.' : errorText(e);

export async function renderHomeBuilder(box, onBack, startRole = 'jamaah') {
  let role = startRole, blocks = [], saved = null, dirty = false, busy = false, showPrev = false;
  const open = new Set();   // blok yang sedang dibuka untuk diubah
  const bump = () => { dirty = true; };

  const wrap = h('section', { class: 'konten', id: 'hb' });
  box.replaceChildren(wrap);

  async function load(r) {
    role = r; open.clear(); showPrev = false;
    wrap.replaceChildren(h('p', { class: 'muted' }, 'Memuat susunan…'));
    saved = await fetchLayout(r);
    blocks = saved ? clone(saved) : defaultBlocks(r);
    dirty = false; draw();
  }
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= blocks.length) return; [blocks[i], blocks[j]] = [blocks[j], blocks[i]]; bump(); draw(); };
  const remove = i => { blocks.splice(i, 1); bump(); draw(); };
  const hiddenBuiltins = () => BUILTINS[role].filter(([id]) => !blocks.some(b => b.t === 'b' && b.id === id));

  function summary(b) {
    if (b.t === 'b') return ['Bawaan: ' + builtinLabel(role, b.id), 'Bagian aplikasi yang sudah ada'];
    if (b.t === 'banner') return [TYPE_NAME.banner, b.slides.length + ' slide · ' + ((b.slides[0] && b.slides[0].title) || '(tanpa judul)')];
    if (b.t === 'fitur') return [TYPE_NAME.fitur, (b.title || 'Akses Cepat') + ' · ' + b.items.length + ' menu'];
    return [TYPE_NAME.text + ' (' + ({ h1: 'Judul', h2: 'Subjudul', p: 'Paragraf' })[b.style] + ')', (b.text || '').slice(0, 60) || '(kosong)'];
  }

  const field = (label, el) => h('label', {}, label, el);
  const input = (val, max, on, ph) => { const e = h('input', { class: 'in', maxlength: String(max), value: val || '', placeholder: ph || '' }); e.addEventListener('input', () => { on(e.value); bump(); refreshBar(); }); return e; };
  const select = (opts, val, on) => { const e = h('select', { class: 'in' }, ...opts.map(([v, l]) => h('option', { value: v }, l))); e.value = val; e.addEventListener('change', () => { on(e.value); bump(); refreshBar(); }); return e; };

  function editBanner(b) {
    const list = b.slides.map((s, k) => {
      const fileIn = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'hb-file', 'aria-label': 'Gambar slide ' + (k + 1) });
      const info = h('small', { class: 'muted' }, s._file ? 'Gambar baru siap diunggah saat Simpan.' : s.img ? 'Memakai gambar unggahan.' : 'Tanpa gambar: memakai gambar bawaan.');
      fileIn.addEventListener('change', async () => {
        const f = fileIn.files && fileIn.files[0]; if (!f) return;
        try { const p = await prepareImage(f); s._file = p; s._url = URL.createObjectURL(p.blob); bump(); draw(); }
        catch (e) { toast(errorText(e), true); fileIn.value = ''; }
      });
      return h('div', { class: 'hbe-slide' }, h('b', {}, 'Slide ' + (k + 1)),
        field('Judul (wajib)', input(s.title, LIMITS.title, v => { s.title = v; })),
        field('Teks', input(s.text, LIMITS.text, v => { s.text = v; })),
        field('Teks tombol (kosongkan = tanpa tombol)', input(s.cta, LIMITS.cta, v => { s.cta = v; })),
        field('Tombol menuju', select([['', '— pilih —'], ...Object.entries(LINKS).map(([k2, v]) => [k2, v[0]])], s.link || '', v => { s.link = v; })),
        field('Warna', select([['green', 'Hijau'], ['gold', 'Emas']], s.tone || 'green', v => { s.tone = v; })),
        field('Gambar latar (JPEG/PNG/WebP)', fileIn), info,
        h('div', { class: 'hbe-acts' },
          (s.img || s._file) ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { delete s.img; delete s._file; delete s._url; bump(); draw(); } }, 'Hapus gambar') : '',
          b.slides.length > 1 ? h('button', { class: 'btn-sm alt', type: 'button', onclick: () => { b.slides.splice(k, 1); bump(); draw(); } }, 'Hapus slide') : ''));
    });
    return h('div', { class: 'hbe-edit' }, ...list,
      b.slides.length < LIMITS.slides ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { b.slides.push({ title: '', text: '', cta: '', link: '', tone: 'green' }); bump(); draw(); } }, '+ Tambah slide (' + b.slides.length + ' dari ' + LIMITS.slides + ')') : h('small', { class: 'muted' }, 'Maksimal ' + LIMITS.slides + ' slide.'));
  }
  function editFitur(b) {
    const boxes = Object.entries(LINKS).map(([k, v]) => {
      const c = h('input', { type: 'checkbox', value: k }); c.checked = b.items.includes(k);
      c.addEventListener('change', () => {
        if (c.checked && b.items.length >= LIMITS.items) { c.checked = false; toast('Maksimal ' + LIMITS.items + ' menu.', true); return; }
        b.items = c.checked ? [...b.items, k] : b.items.filter(x => x !== k); bump(); refreshBar();
      });
      return h('label', {}, c, v[0]);
    });
    return h('div', { class: 'hbe-edit' }, field('Judul bagian', input(b.title, LIMITS.ftitle, v => { b.title = v; }, 'Akses Cepat')), h('div', { class: 'hbe-chk' }, ...boxes));
  }
  function editText(b) {
    const ta = h('textarea', { class: 'in', maxlength: String(LIMITS.para), rows: '4', 'aria-label': 'Isi teks' }); ta.value = b.text || '';
    ta.addEventListener('input', () => { b.text = ta.value; bump(); refreshBar(); });
    return h('div', { class: 'hbe-edit' },
      field('Gaya', select([['h1', 'Judul (besar)'], ['h2', 'Subjudul'], ['p', 'Paragraf']], b.style, v => { b.style = v; })),
      field('Rata teks', select([['left', 'Kiri'], ['center', 'Tengah'], ['right', 'Kanan']], b.align || 'left', v => { b.align = v; })),
      field('Isi teks (maks. ' + LIMITS.para + ' huruf)', ta));
  }

  function item(b, i) {
    const [name, sub] = summary(b);
    const req = b.t === 'b' && (REQUIRED[role] || []).includes(b.id);
    const isOpen = open.has(b);
    return h('div', { class: 'hbe-item', 'data-i': String(i) },
      h('div', { class: 'hbe-top' },
        h('div', { class: 'hbe-name' }, name, h('small', {}, sub)),
        h('div', { class: 'hbe-acts' },
          h('button', { class: 'btn-sm ghost hb-up', type: 'button', 'aria-label': 'Naikkan', ...(i === 0 ? { disabled: 'disabled' } : {}), onclick: () => move(i, -1) }, '↑'),
          h('button', { class: 'btn-sm ghost hb-down', type: 'button', 'aria-label': 'Turunkan', ...(i === blocks.length - 1 ? { disabled: 'disabled' } : {}), onclick: () => move(i, 1) }, '↓'),
          b.t !== 'b' ? h('button', { class: 'btn-sm ghost hb-edit', type: 'button', 'aria-expanded': String(isOpen), onclick: () => { isOpen ? open.delete(b) : open.add(b); draw(); } }, isOpen ? 'Tutup' : 'Ubah') : '',
          req ? h('button', { class: 'btn-sm ghost hb-del', type: 'button', disabled: 'disabled', title: 'Bagian ini wajib agar menu tidak hilang' }, 'Wajib')
              : h('button', { class: 'btn-sm alt hb-del', type: 'button', onclick: () => remove(i) }, b.t === 'b' ? 'Sembunyikan' : 'Hapus'))),
      isOpen ? (b.t === 'banner' ? editBanner(b) : b.t === 'fitur' ? editFitur(b) : editText(b)) : '');
  }

  // Cek isian sebelum dikirim; mengembalikan teks galat atau ''.
  function problem() {
    if (!blocks.length) return 'Beranda tidak boleh kosong. Tambahkan minimal satu blok.';
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i], n = 'Blok ' + (i + 1) + ': ';
      if (b.t === 'banner') { for (const s of b.slides) if (!(s.title || '').trim()) return n + 'judul slide wajib diisi.'; for (const s of b.slides) if ((s.cta || '').trim() && !s.link) return n + 'pilih tujuan tombol, atau kosongkan teks tombol.'; }
      if (b.t === 'fitur' && !b.items.length) return n + 'pilih minimal satu menu.';
      if (b.t === 'text' && !(b.text || '').trim()) return n + 'teks masih kosong.';
    }
    return '';
  }

  let saveBtn, bar;
  const refreshBar = () => { if (saveBtn) saveBtn.disabled = !dirty || busy; };

  async function doSave() {
    const p = problem(); if (p) { toast(p, true); return; }
    busy = true; refreshBar();
    try {
      saved = await saveLayout(role, blocks, saved);
      blocks = clone(saved); dirty = false; open.clear();
      toast('Susunan beranda tersimpan.');
    } catch (e) { if (!(e && e.status === 401)) toast(msgOf(e), true); }
    busy = false; draw();
  }
  async function doReset() {
    if (!(await ask({ title: 'Kembalikan ke bawaan?', text: 'Susunan khusus beranda ' + ROLES.find(r => r[0] === role)[1] + ' dihapus dan kembali ke tampilan bawaan aplikasi.', reason: false }))) return;
    busy = true; refreshBar();
    try { await resetLayout(role, saved); saved = null; blocks = defaultBlocks(role); dirty = false; open.clear(); toast('Kembali ke susunan bawaan.'); }
    catch (e) { if (!(e && e.status === 401)) toast(msgOf(e), true); }
    busy = false; draw();
  }
  async function switchRole(r) {
    if (r === role) return;
    if (dirty && !(await ask({ title: 'Buang perubahan?', text: 'Perubahan yang belum disimpan akan hilang.', reason: false }))) return;
    await load(r);
  }
  async function leave() {
    if (dirty && !(await ask({ title: 'Buang perubahan?', text: 'Perubahan yang belum disimpan akan hilang.', reason: false }))) return;
    onBack();
  }

  function draw() {
    const y = window.scrollY;
    const hidden = hiddenBuiltins();
    const sel = hidden.length ? h('select', { class: 'in', id: 'hb-b-sel', 'aria-label': 'Bagian bawaan yang disembunyikan' }, ...hidden.map(([id, l]) => h('option', { value: id }, l))) : null;
    const add = t => { if (blocks.length >= LIMITS.blocks) { toast('Maksimal ' + LIMITS.blocks + ' blok.', true); return; }
      const nb = t === 'banner' ? { t, slides: [{ title: '', text: '', cta: '', link: '', tone: 'green' }] } : t === 'fitur' ? { t, title: '', items: [] } : { t, style: 'p', align: 'left', text: '' };
      blocks.push(nb); open.add(nb); bump(); draw(); };
    saveBtn = h('button', { class: 'btn-sm', id: 'hb-save', type: 'button', onclick: doSave }, 'Simpan');
    bar = h('div', { class: 'hbe-bar' }, saveBtn, h('button', { class: 'btn-sm ghost', id: 'hb-prev-btn', type: 'button', onclick: () => { showPrev = !showPrev; draw(); } }, showPrev ? 'Tutup pratinjau' : 'Pratinjau'),
      h('button', { class: 'btn-sm alt', id: 'hb-reset', type: 'button', onclick: doReset }, 'Kembalikan ke bawaan'));
    wrap.replaceChildren(
      h('button', { class: 'btn-sm ghost', id: 'hb-back', type: 'button', onclick: leave }, '← Kembali'), h('h2', {}, 'Tampilan Beranda'),
      h('p', { class: 'muted' }, 'Atur isi beranda dari atas ke bawah. "Bawaan" adalah bagian aplikasi yang sudah ada; bagian lain bisa Anda tambah. Perubahan baru terlihat di beranda setelah Simpan.'),
      h('div', { class: 'hbe-tabs', id: 'hb-tabs', role: 'tablist' }, ...ROLES.map(([k, l]) => h('button', { class: 'btn-sm ghost' + (k === role ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': String(k === role), 'data-role': k, onclick: () => switchRole(k) }, l))),
      h('p', { class: 'hint', id: 'hb-status' }, (saved ? 'Memakai susunan khusus.' : 'Memakai susunan bawaan aplikasi.') + (dirty ? ' Ada perubahan yang belum disimpan.' : '')),
      h('div', { id: 'hb-list' }, ...blocks.map(item)),
      h('div', { class: 'hbe-add' },
        h('button', { class: 'btn-sm ghost', id: 'hb-add-banner', type: 'button', onclick: () => add('banner') }, '+ Banner slide'),
        h('button', { class: 'btn-sm ghost', id: 'hb-add-fitur', type: 'button', onclick: () => add('fitur') }, '+ Kotak fitur'),
        h('button', { class: 'btn-sm ghost', id: 'hb-add-text', type: 'button', onclick: () => add('text') }, '+ Teks')),
      sel ? h('div', { class: 'hbe-add' }, sel, h('button', { class: 'btn-sm ghost', id: 'hb-add-b', type: 'button', onclick: () => { if (blocks.length >= LIMITS.blocks) { toast('Maksimal ' + LIMITS.blocks + ' blok.', true); return; } blocks.push({ t: 'b', id: sel.value }); bump(); draw(); } }, '+ Tampilkan bagian bawaan')) : '',
      showPrev ? h('div', { class: 'hbe-prev', id: 'hb-prev', 'aria-label': 'Pratinjau susunan' }, ...layoutNodes(role, blocks, {}, { preview: true })) : '',
      bar);
    refreshBar(); window.scrollTo(0, y);
  }

  await load(role);
}
