// BAITUNA - page-ui.js
// Halaman Privasi & Disclaimer: dibaca semua orang, diubah hanya oleh Super Admin (dijaga RLS di server; tombol ubah hanya tampil untuk Super Admin).
import { h, toast, hint, ask } from './ui.js';
import { getPage, savePage, resetPage, parseDoc, MAX_BODY } from './page-service.js';
import { DEFAULT_PAGES } from './page-defaults.js';

const dateText = iso => { try { return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } };

export function renderDoc(body) {
  return parseDoc(body).map(b => b.t === 'h' ? h('h3', { class: 'legal-h' }, b.text) : b.t === 'ul' ? h('ul', { class: 'legal-ul' }, ...b.items.map(i => h('li', {}, i))) : h('p', { class: 'legal-p prewrap' }, b.text));
}

// isAdmin() dipanggil saat menggambar karena status Super Admin dimuat belakangan. Mengembalikan elemen.
export function legalView(slug, isAdmin) {
  const box = h('div', { class: 'legal' });
  let page = null, editing = false;

  function readView() {
    const kids = [h('h2', { class: 'wtitle' }, page.title),
      h('p', { class: 'muted legal-meta', id: 'legal-meta' }, page.custom ? 'Terakhir diperbarui ' + dateText(page.updated_at) + '.' : 'Teks bawaan sementara; pengelola akan menyempurnakannya.'),
      page.error === 'net' ? h('p', { class: 'hint', role: 'alert' }, 'Versi terbaru belum bisa dimuat. Menampilkan teks bawaan. Periksa koneksi.') : '',
      h('div', { class: 'panel legal-body' }, ...renderDoc(page.body))];
    if (isAdmin()) kids.push(h('div', { class: 'row-btns' }, h('button', { class: 'btn-sm', type: 'button', id: 'legal-edit', onclick: () => { editing = true; draw(); } }, 'Ubah halaman ini'),
      page.error === 'sql' ? h('p', { class: 'hint', role: 'alert' }, 'Penyimpanan halaman belum aktif. Jalankan halaman.sql di Supabase SQL Editor.') : ''));
    return kids;
  }

  function editView() {
    const title = h('input', { class: 'in', id: 'legal-title', maxlength: '120', 'aria-label': 'Judul halaman', autocomplete: 'off' }); title.value = page.title;
    const body = h('textarea', { class: 'in tall legal-ta', id: 'legal-body', maxlength: String(MAX_BODY), 'aria-label': 'Isi halaman' }); body.value = page.body;
    const status = h('p', { class: 'hint', role: 'status' }, '');
    const save = h('button', { class: 'btn-sm', type: 'submit', id: 'legal-save' }, 'Simpan');
    const form = h('form', { class: 'panel rform', novalidate: 'novalidate', onsubmit: async ev => {
      ev.preventDefault();
      const f = { title: title.value.trim(), body: body.value.trim() };
      if (f.title.length < 3) { toast('Judul minimal 3 huruf.', true); return; }
      if (f.body.length < 20) { toast('Isi minimal 20 huruf.', true); return; }
      save.disabled = true;
      try { await savePage('privasi', f); toast('Halaman disimpan.'); page = await getPage(slug); editing = false; draw(); return; }
      catch (e) { if (e && e.status === 401) return; const m = e && e.status === 0 ? 'Tidak ada koneksi internet.' : (e && (e.code === '42P01' || e.code === 'PGRST205') ? 'Penyimpanan halaman belum aktif. Jalankan halaman.sql di Supabase.' : 'Belum tersimpan. ' + hint(e)); status.textContent = m; toast(m, true); }
      save.disabled = false;
    } },
      h('h3', {}, 'Ubah halaman'),
      h('p', { class: 'muted' }, 'Hanya Super Admin yang bisa mengubah. Format: baris diawali "## " menjadi judul bagian, baris diawali "- " menjadi butir daftar, dan baris kosong memisahkan paragraf. Tidak ada kode HTML.'),
      h('label', { class: 'flab' }, h('span', { class: 'hint' }, 'Judul'), title), h('label', { class: 'flab' }, h('span', { class: 'hint' }, 'Isi'), body), status,
      h('div', { class: 'mt row-btns' }, save,
        h('button', { class: 'btn-sm ghost', type: 'button', id: 'legal-cancel', onclick: () => { editing = false; draw(); } }, 'Batal'),
        page.custom ? h('button', { class: 'btn-sm alt', type: 'button', id: 'legal-reset', onclick: async () => {
          if (!(await ask({ title: 'Kembalikan ke teks bawaan?', text: 'Versi yang Anda simpan akan dihapus dan diganti teks bawaan sementara.', reason: false }))) return;
          try { await resetPage('privasi'); toast('Dikembalikan ke teks bawaan.'); page = await getPage(slug); editing = false; draw(); } catch (e) { if (e.status !== 401) toast('Gagal mengembalikan. ' + hint(e), true); }
        } }, 'Kembalikan ke teks bawaan') : ''));
    return [form];
  }

  function draw() { if (!page) { box.replaceChildren(h('h2', { class: 'wtitle' }, DEFAULT_PAGES[slug].title), h('p', { class: 'muted' }, 'Memuat…')); return; } box.replaceChildren(...(editing && isAdmin() ? editView() : readView())); }
  box.redraw = () => { if (page) draw(); };
  draw();
  getPage(slug).then(p => { page = p; draw(); });
  return box;
}
