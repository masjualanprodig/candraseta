// BAITUNA - articles-ui.js
// Berita & Artikel Islam: (1) tampilan jamaah (kartu + filter kategori + baca), (2) pengelolaan oleh Super Admin.
// Isi artikel selalu ditampilkan sebagai teks biasa (bukan HTML) agar aman dari penyisipan skrip.
import { h, toast, hint, ask } from './ui.js';
import { CATS, catLabel, PAGE, listArticles, getArticle, listManagedArticles, getManagedArticle, createArticle, updateArticle, setArticleCover, setArticleStatus, deleteArticle, newArticleId } from './articles-service.js';
import { prepareImage, newPhotoPath, PHOTO_ERRORS } from './photo.js';
import { publicPhotoUrl, storageUpload, storageRemove, ARTICLE_BUCKET } from './supabase.js';
import { icon, ICONS, emptyState } from './feed-ui.js';

const coverUrl = a => publicPhotoUrl(a.cover_path, ARTICLE_BUCKET);
const notReady = e => e && (e.code === '42P01' || e.code === 'PGRST205' || e.status === 404);
const safeUrl = u => /^https?:\/\/\S+$/.test(String(u || '')) ? u : null;

// "Hari ini 10:21" untuk hari ini, selain itu "11 Okt 2026".
export function fmtWhen(iso, now = new Date()) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const same = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (same) return 'Hari ini ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function shareArticle(a) {
  const url = location.origin;
  const text = (a.summary || a.title) + '\n\nDibaca di BAITUNA';
  try {
    if (navigator.share) { await navigator.share({ title: a.title, text, url }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(a.title + '\n' + text + '\n' + url); toast('Teks artikel disalin.'); }
  catch (e) { toast('Berbagi tidak didukung di peramban ini.', true); }
}

/* ===== 1. Jamaah ===== */
export function articlesPage() {
  const wrap = h('div', { class: 'news' });
  let cat = 'all', items = [], hasMore = false, loading = false, failed = false, loadedOnce = false;

  const card = a => h('article', { class: 'acard' },
    h('button', { class: 'acard-open', type: 'button', onclick: () => detail(a.id) },
      coverUrl(a) ? h('img', { class: 'acover', src: coverUrl(a), alt: '', loading: 'lazy' })
        : h('div', { class: 'acover acover-empty', 'aria-hidden': 'true' }, icon(ICONS.news, 'ic-lg')),
      h('div', { class: 'abody' },
        h('span', { class: 'acat' }, catLabel(a.category)),
        h('b', { class: 'atitle' }, a.title),
        h('div', { class: 'ameta' }, h('span', { class: 'asrc' }, a.source_name), h('span', { class: 'adate' }, fmtWhen(a.published_at))))),
    h('button', { class: 'ashare', type: 'button', 'aria-label': 'Bagikan: ' + a.title, onclick: () => shareArticle(a) }, icon(ICONS.share)));

  function chips() {
    const mk = (key, label) => h('button', { class: 'achip', type: 'button', role: 'tab', 'aria-selected': String(cat === key),
      onclick: () => { if (cat === key) return; cat = key; fetchPage(true); } }, label);
    return h('div', { class: 'achips', role: 'tablist', 'aria-label': 'Kategori' }, mk('all', 'Semua'), ...CATS.map(c => mk(c.key, c.label)));
  }

  function draw() {
    const kids = [h('h2', { class: 'wtitle' }, 'Berita & Artikel'),
      h('p', { class: 'muted' }, 'Khazanah, tips, dan bacaan Islami pilihan admin pusat BAITUNA.'), chips()];
    if (failed && !items.length) {
      kids.push(h('div', { class: 'empty' }, h('p', { class: 'muted' }, failed === 'notready'
        ? 'Halaman berita belum aktif. Admin pusat perlu menjalankan berita.sql.'
        : 'Berita belum bisa dimuat. Periksa koneksi, lalu coba lagi.'),
        failed === 'notready' ? '' : h('button', { class: 'btn-sm', type: 'button', onclick: () => fetchPage(true) }, 'Coba lagi')));
    } else if (!loadedOnce) {
      kids.push(h('p', { class: 'muted center' }, 'Memuat berita…'));
    } else if (!items.length) {
      kids.push(emptyState(cat === 'all' ? 'Belum ada artikel. Artikel akan ditambahkan oleh admin pusat.' : 'Belum ada artikel di kategori ini.'));
    } else {
      kids.push(h('div', { class: 'agrid' }, ...items.map(card)));
      if (hasMore) {
        const more = h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => fetchPage(false) }, loading ? 'Memuat…' : 'Tampilkan lebih banyak');
        more.disabled = loading;
        kids.push(h('div', { class: 'center mt' }, more));
      }
      if (failed) kids.push(h('p', { class: 'hint center' }, 'Sebagian berita belum bisa dimuat. Coba lagi.'));
    }
    wrap.replaceChildren(...kids);
  }

  let seq = 0; // jawaban lama diabaikan bila kategori sudah berganti
  async function fetchPage(reset) {
    const my = ++seq;
    loading = true; failed = false;
    if (reset) { items = []; hasMore = false; loadedOnce = false; }
    draw();
    try {
      const r = await listArticles({ category: cat, offset: reset ? 0 : items.length });
      if (my !== seq) return;
      items = reset ? r.items : items.concat(r.items); hasMore = r.hasMore;
    } catch (e) { if (my !== seq) return; failed = notReady(e) ? 'notready' : 'error'; }
    loading = false; loadedOnce = true; draw();
  }

  async function detail(id) {
    wrap.replaceChildren(h('p', { class: 'muted center' }, 'Memuat artikel…'));
    window.scrollTo(0, 0);
    let a;
    try { a = await getArticle(id); } catch (e) { a = undefined; }
    const back = h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => { draw(); } }, '← Berita & Artikel');
    if (a === undefined) { wrap.replaceChildren(back, h('div', { class: 'empty' }, h('p', { class: 'muted' }, 'Artikel belum bisa dimuat. Periksa koneksi, lalu coba lagi.'), h('button', { class: 'btn-sm', type: 'button', onclick: () => detail(id) }, 'Coba lagi'))); return; }
    if (!a) { wrap.replaceChildren(back, h('div', { class: 'empty' }, h('p', { class: 'muted' }, 'Artikel ini tidak tersedia lagi.'))); return; }
    const link = safeUrl(a.source_url);
    wrap.replaceChildren(back,
      coverUrl(a) ? h('img', { class: 'hero mt', src: coverUrl(a), alt: '' }) : '',
      h('span', { class: 'acat mt' }, catLabel(a.category)),
      h('h2', { class: 'atitle-big' }, a.title),
      h('div', { class: 'ameta big' }, h('span', { class: 'asrc' }, a.source_name), h('span', { class: 'adate' }, fmtWhen(a.published_at))),
      h('div', { class: 'panel' }, h('p', { class: 'prewrap hread' }, a.body)),
      h('div', { class: 'panel hsrc' }, h('h3', {}, 'Penulis / sumber'), h('p', {}, a.source_name),
        link ? h('a', { class: 'btn-sm ghost', href: link, target: '_blank', rel: 'noopener noreferrer' }, 'Buka tautan sumber') : ''),
      h('button', { class: 'btn-sm', type: 'button', onclick: () => shareArticle(a) }, 'Bagikan'),
      h('p', { class: 'hint mt' }, 'Artikel dipilih admin pusat BAITUNA. Untuk persoalan hukum agama, tanyakan langsung kepada ulama atau ustaz yang terpercaya.'));
    window.scrollTo(0, 0);
  }

  fetchPage(true);
  return wrap;
}

/* ===== 2. Super Admin ===== */
export async function renderArticleManager(box, onBack) {
  let rows;
  try { rows = await listManagedArticles(); }
  catch (e) {
    if (e && e.status === 401) return;
    box.replaceChildren(onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '',
      h('div', { class: 'panel center' }, h('p', {}, notReady(e) ? 'Fitur berita belum aktif. Jalankan berita.sql di Supabase SQL Editor.' : 'Data belum bisa dimuat. Periksa koneksi, lalu coba lagi.'),
        h('button', { class: 'btn-sm', type: 'button', onclick: () => renderArticleManager(box, onBack) }, 'Coba lagi')));
    return;
  }
  const reload = () => renderArticleManager(box, onBack);
  let editing = null;

  const field = (ph, max) => h('input', { class: 'in', placeholder: ph, maxlength: String(max), autocomplete: 'off' });
  const title = field('Judul *', 160);
  const cat = h('select', { class: 'in', 'aria-label': 'Kategori' }, ...CATS.map(c => h('option', { value: c.key }, c.label)));
  const summary = h('textarea', { class: 'in', placeholder: 'Ringkasan singkat (opsional, maks. 300 karakter)', maxlength: '300', rows: '2' });
  const body = h('textarea', { class: 'in', placeholder: 'Isi artikel * (teks biasa; pisahkan paragraf dengan baris kosong)', maxlength: '20000', rows: '12' });
  const srcName = field('Penulis / sumber * (mis. Redaksi BAITUNA, atau nama penulis)', 100);
  const srcUrl = field('Tautan sumber (opsional, diawali https://)', 500);
  const statusSel = h('select', { class: 'in', 'aria-label': 'Status' }, h('option', { value: 'draft' }, 'Draf (belum tampil ke jamaah)'), h('option', { value: 'published' }, 'Terbit (tampil ke jamaah)'));
  const pick = h('input', { class: 'in', type: 'file', accept: 'image/jpeg,image/png,image/webp', 'aria-label': 'Gambar sampul' });
  const status = h('p', { class: 'hint' }, 'Gambar sampul (opsional): 1 gambar, maksimal 2 MB. Gambar yang lebih besar otomatis diperkecil.');
  const formTitle = h('h3', {}, 'Tambah artikel');
  const save = h('button', { class: 'btn-sm', type: 'submit' }, 'Simpan');
  const cancel = h('button', { class: 'btn-sm ghost', type: 'button', hidden: true, onclick: reload }, 'Batal ubah');
  const photoMsg = e => e && PHOTO_ERRORS[e.code] ? PHOTO_ERRORS[e.code] : e && e.status === 0 ? 'Tidak ada koneksi internet.' : 'Gambar belum tersimpan. ' + hint(e);

  const form = h('form', {
    class: 'rform panel', novalidate: 'novalidate',
    onsubmit: async ev => {
      ev.preventDefault();
      const t = title.value.trim(), b = body.value.trim(), sn = srcName.value.trim(), su = srcUrl.value.trim();
      if (t.length < 5) { toast('Judul minimal 5 karakter.', true); return; }
      if (b.length < 50) { toast('Isi artikel minimal 50 karakter.', true); return; }
      if (sn.length < 2) { toast('Isi penulis atau sumber artikel.', true); return; }
      if (su && !/^https?:\/\/\S+$/.test(su)) { toast('Tautan sumber harus diawali http:// atau https:// dan tanpa spasi.', true); return; }
      const f = { title: t, category: cat.value, summary: summary.value.trim() || null, body: b, source_name: sn, source_url: su || null, status: statusSel.value };
      const file = pick.files && pick.files[0];
      save.disabled = true;
      let uploaded = null;
      try {
        let img = null;
        if (file) { status.textContent = 'Memproses gambar…'; img = await prepareImage(file); }
        if (editing) {
          await updateArticle(editing.id, f);
          if (img) {
            uploaded = newPhotoPath(editing.id);
            await storageUpload(uploaded, img.blob, ARTICLE_BUCKET);
            await setArticleCover(editing.id, uploaded);
            if (editing.cover_path) storageRemove(editing.cover_path, ARTICLE_BUCKET).catch(() => {});
            uploaded = null;
          }
          toast('Perubahan disimpan.');
        } else {
          const id = newArticleId();
          if (!id) throw Object.assign(new Error('peramban lama'), { status: 0 });
          if (img) { uploaded = newPhotoPath(id); await storageUpload(uploaded, img.blob, ARTICLE_BUCKET); }
          await createArticle(id, f, uploaded);
          uploaded = null;
          toast(f.status === 'published' ? 'Artikel diterbitkan.' : 'Artikel disimpan sebagai draf.');
        }
        await reload(); return;
      } catch (e) {
        if (uploaded) storageRemove(uploaded, ARTICLE_BUCKET).catch(() => {});
        if (e && e.status === 401) return;
        const msg = (e && PHOTO_ERRORS[e.code]) ? photoMsg(e) : 'Belum tersimpan. ' + hint(e);
        status.textContent = msg; toast(msg, true);
      }
      save.disabled = false;
    }
  }, formTitle,
    h('p', { class: 'hint' }, 'Tulis sendiri atau ringkas dengan kata-kata sendiri. Jangan menyalin utuh tulisan orang lain tanpa izin, dan selalu cantumkan penulis/sumber. Untuk dalil atau hukum agama, rujuk sumber yang jelas.'),
    title, h('div', { class: 'grid2' }, cat, statusSel), summary, body, srcName, srcUrl,
    h('label', { class: 'hint' }, 'Gambar sampul'), pick, status,
    h('div', { class: 'mt row-btns' }, save, cancel));

  async function edit(a) {
    let full;
    try { full = await getManagedArticle(a.id); } catch (e) { if (e.status !== 401) toast('Artikel belum bisa dimuat. ' + hint(e), true); return; }
    editing = full; formTitle.textContent = 'Ubah: ' + full.title;
    title.value = full.title; cat.value = full.category; summary.value = full.summary || ''; body.value = full.body;
    srcName.value = full.source_name; srcUrl.value = full.source_url || ''; statusSel.value = full.status;
    status.textContent = full.cover_path ? 'Gambar sampul sudah ada. Pilih gambar baru hanya jika ingin menggantinya.' : status.textContent;
    cancel.hidden = false; form.scrollIntoView({ behavior: 'smooth', block: 'start' }); title.focus();
  }

  const item = a => h('div', { class: 'post wrow' },
    coverUrl(a) ? h('img', { class: 'fi-thumb', src: coverUrl(a), alt: '', loading: 'lazy' }) : h('div', { class: 'fi-thumb wimg-empty', 'aria-hidden': 'true' }),
    h('div', { class: 'fi-main' }, h('b', {}, a.title),
      h('div', { class: 'chips mt' }, h('span', { class: 'chip' }, catLabel(a.category)), h('span', { class: 'chip ' + (a.status === 'published' ? '' : 'chip-draft') }, a.status === 'published' ? 'Terbit' : 'Draf')),
      h('div', { class: 'row-btns mt' },
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => edit(a) }, 'Ubah'),
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: async () => {
          const to = a.status === 'published' ? 'draft' : 'published';
          try { await setArticleStatus(a.id, to); toast(to === 'published' ? 'Artikel diterbitkan.' : 'Artikel ditarik ke draf.'); await reload(); }
          catch (e) { if (e.status !== 401) toast('Gagal mengubah status. ' + hint(e), true); }
        } }, a.status === 'published' ? 'Tarik ke draf' : 'Terbitkan'),
        h('button', { class: 'btn-sm alt', type: 'button', onclick: async () => {
          if (!(await ask({ title: 'Hapus "' + a.title + '"?', text: 'Artikel dihapus dan tidak bisa dikembalikan.', reason: false }))) return;
          try {
            await deleteArticle(a.id);
            if (a.cover_path) storageRemove(a.cover_path, ARTICLE_BUCKET).catch(() => {});
            toast('Dihapus.'); await reload();
          } catch (e) { if (e.status !== 401) toast('Gagal menghapus. ' + hint(e), true); }
        } }, 'Hapus'))));

  box.replaceChildren(...[
    onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '',
    h('h2', { class: 'mt' }, 'Berita & Artikel Islam'),
    h('p', { class: 'muted' }, 'Hanya Super Admin yang bisa menambah, mengubah, dan menghapus. Jamaah hanya melihat artikel yang berstatus Terbit.'),
    form,
    h('div', { class: 'panel' }, h('h3', {}, 'Daftar (' + rows.length + ')'),
      rows.length ? rows.map(item) : h('p', { class: 'muted' }, 'Belum ada artikel. Tulis artikel pertama di atas.'))
  ].flat());
  window.scrollTo(0, 0);
}
