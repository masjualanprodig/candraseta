// BAITUNA - posts-ui.js
// Tampilan agenda & pengumuman: (1) untuk jamaah di profil masjid, (2) untuk pengelola (buat/ubah/terbitkan/hapus).
import { h, toast, hint, ask } from './ui.js';
import { listPublicPosts, listManagedPosts, createPost, updatePost, setPostStatus, deletePost } from './post-service.js';
import { localToIso, isoToLocal, fmtWhen, fmtRange, isUpcoming } from './post-time.js';

const KIND = { agenda: 'Agenda', pengumuman: 'Pengumuman' };
const TOPIC = { umum: 'Umum', kajian: 'Kajian', sosial: 'Program sosial', ramadan: 'Ramadan' };

/* ===== 1. Untuk jamaah (tanpa login) ===== */
export function postsPublic(m, now = Date.now()) {
  const box = h('div', { class: 'panel posts' }, h('p', { class: 'muted' }, 'Memuat agenda…'));
  const tz = m.timezone || 'Asia/Jakarta';
  listPublicPosts(m.id).then(rows => {
    const agenda = rows.filter(p => p.kind === 'agenda' && p.starts_at && isUpcoming(p, now, tz))
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
    const info = rows.filter(p => p.kind === 'pengumuman')
      .sort((a, b) => Date.parse(b.published_at || b.created_at) - Date.parse(a.published_at || a.created_at)).slice(0, 10);
    box.replaceChildren(...[
      h('h3', {}, 'Agenda mendatang'),
      agenda.length ? agenda.map(p => h('div', { class: 'post' },
        h('b', {}, p.title),
        h('div', { class: 'muted' }, fmtRange(p.starts_at, p.ends_at, tz)),
        p.location ? h('div', { class: 'muted' }, 'Tempat: ' + p.location) : '',
        p.body ? h('p', { class: 'post-body' }, p.body) : ''))
        : h('p', { class: 'muted' }, 'Belum ada agenda mendatang.'),
      h('h3', { class: 'mt' }, 'Pengumuman'),
      info.length ? info.map(p => h('div', { class: 'post' },
        h('b', {}, p.title),
        h('div', { class: 'muted' }, fmtWhen(p.published_at || p.created_at, tz)),
        p.body ? h('p', { class: 'post-body' }, p.body) : ''))
        : h('p', { class: 'muted' }, 'Belum ada pengumuman.')
    ].flat());
  }).catch(() => box.replaceChildren(h('p', { class: 'muted' }, 'Agenda dan pengumuman belum bisa dimuat. Coba lagi nanti.')));
  return box;
}

/* ===== 2. Untuk pengelola ===== */
// box: wadah halaman; mosque: {id,name,timezone}; onBack: fungsi kembali (opsional)
export async function renderPostsManager(box, mosque, onBack) {
  const tz = mosque.timezone || 'Asia/Jakarta';
  const tzName = { 'Asia/Jakarta': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' }[tz] || 'WIB';
  let posts;
  try { posts = await listManagedPosts(mosque.id); }
  catch (e) {
    if (e.status === 401) return;
    const notReady = e && (e.code === '42P01' || e.code === 'PGRST205' || e.status === 404);
    box.replaceChildren(h('div', { class: 'panel center' },
      h('p', {}, notReady ? 'Fitur agenda belum aktif. Jalankan agenda.sql di Supabase SQL Editor.' : 'Data belum bisa dimuat. Periksa koneksi, lalu coba lagi.'),
      h('button', { class: 'btn-sm', type: 'button', onclick: () => renderPostsManager(box, mosque, onBack) }, 'Coba lagi')));
    return;
  }
  const reload = () => renderPostsManager(box, mosque, onBack);
  let editing = null; // kiriman yang sedang diubah

  const kind = h('select', { class: 'in', 'aria-label': 'Jenis' }, h('option', { value: 'agenda' }, 'Agenda (kegiatan berjadwal)'), h('option', { value: 'pengumuman' }, 'Pengumuman'));
  const topic = h('select', { class: 'in', 'aria-label': 'Jenis kabar (untuk Pusat Notifikasi jamaah)' }, h('option', { value: 'umum' }, 'Kabar umum'), h('option', { value: 'kajian' }, 'Kajian / pengajian'), h('option', { value: 'sosial' }, 'Program sosial'), h('option', { value: 'ramadan' }, 'Ramadan (agenda & kabar Ramadan)'));
  const title = h('input', { class: 'in', placeholder: 'Judul *', maxlength: '150', autocomplete: 'off' });
  const body = h('textarea', { class: 'in', placeholder: 'Keterangan (opsional)', maxlength: '2000' });
  const place = h('input', { class: 'in', placeholder: 'Tempat (mis. Aula utama)', maxlength: '150', autocomplete: 'off' });
  const startsAt = h('input', { class: 'in', type: 'datetime-local', 'aria-label': 'Mulai' });
  const endsAt = h('input', { class: 'in', type: 'datetime-local', 'aria-label': 'Selesai (opsional)' });
  const agendaBox = h('div', {}, place,
    h('label', { class: 'hint' }, 'Mulai *'), startsAt,
    h('label', { class: 'hint' }, 'Selesai (opsional)'), endsAt,
    h('p', { class: 'hint' }, 'Jam mengikuti zona waktu masjid (' + tzName + '), bukan zona waktu perangkat.'));
  const sync = () => { agendaBox.hidden = kind.value !== 'agenda'; };
  kind.addEventListener('change', sync);
  const formTitle = h('h3', {}, 'Tulis baru');
  const btnDraft = h('button', { class: 'btn-sm alt', type: 'button' }, 'Simpan sebagai draf');
  const btnPub = h('button', { class: 'btn-sm', type: 'button' }, 'Terbitkan');
  const btnCancel = h('button', { class: 'btn-sm ghost', type: 'button', hidden: true }, 'Batal ubah');

  async function submit(status) {
    const t = title.value.trim();
    if (t.length < 3) { toast('Judul minimal 3 karakter.', true); return; }
    const f = { kind: kind.value, topic: topic.value, title: t, body: body.value.trim() || null, location: null, starts_at: null, ends_at: null, status };
    if (f.kind === 'agenda') {
      f.starts_at = localToIso(startsAt.value, tz);
      if (!f.starts_at) { toast('Isi waktu mulai agenda.', true); return; }
      if (endsAt.value) {
        f.ends_at = localToIso(endsAt.value, tz);
        if (!f.ends_at) { toast('Waktu selesai tidak valid.', true); return; }
        if (Date.parse(f.ends_at) < Date.parse(f.starts_at)) { toast('Waktu selesai tidak boleh sebelum waktu mulai.', true); return; }
      }
      f.location = place.value.trim() || null;
    }
    btnDraft.disabled = btnPub.disabled = true;
    try {
      if (editing) await updatePost(editing.id, f); else await createPost(mosque.id, f);
      toast(status === 'published' ? 'Tersimpan dan diterbitkan.' : 'Tersimpan sebagai draf.');
      await reload(); return;
    } catch (e) { if (e.status !== 401) toast('Belum tersimpan. ' + hint(e), true); }
    btnDraft.disabled = btnPub.disabled = false;
  }
  btnDraft.addEventListener('click', () => submit('draft'));
  btnPub.addEventListener('click', () => submit('published'));
  btnCancel.addEventListener('click', reload);

  function edit(p) {
    editing = p; formTitle.textContent = 'Ubah ' + KIND[p.kind].toLowerCase();
    kind.value = p.kind; kind.disabled = true; topic.value = p.topic || 'umum'; title.value = p.title; body.value = p.body || ''; place.value = p.location || '';
    startsAt.value = p.starts_at ? isoToLocal(p.starts_at, tz) : ''; endsAt.value = p.ends_at ? isoToLocal(p.ends_at, tz) : '';
    btnCancel.hidden = false; sync(); form.scrollIntoView({ behavior: 'smooth', block: 'start' }); title.focus();
  }

  const form = h('div', { class: 'panel' }, formTitle, kind, topic, h('p', { class: 'hint' }, 'Jenis kabar menentukan pengelompokan di Pusat Notifikasi jamaah sekitar masjid.'), title, body, agendaBox,
    h('div', { class: 'mt row-btns' }, btnPub, btnDraft, btnCancel));
  sync();

  const item = p => {
    const live = p.status === 'published';
    return h('div', { class: 'post' },
      h('div', {}, h('span', { class: 'badge b-' + (live ? 'active' : 'draft') }, live ? 'Terbit' : 'Draf'), ' ', h('span', { class: 'badge' }, KIND[p.kind]), ' ', p.topic && p.topic !== 'umum' ? h('span', { class: 'badge' }, TOPIC[p.topic]) : ''),
      h('b', {}, p.title),
      p.kind === 'agenda' && p.starts_at ? h('div', { class: 'muted' }, fmtRange(p.starts_at, p.ends_at, tz)) : '',
      p.location ? h('div', { class: 'muted' }, 'Tempat: ' + p.location) : '',
      p.body ? h('p', { class: 'post-body' }, p.body) : '',
      h('div', { class: 'row-btns' },
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => edit(p) }, 'Ubah'),
        h('button', { class: 'btn-sm ghost', type: 'button', onclick: async ev => {
          ev.currentTarget.disabled = true;
          try { await setPostStatus(p.id, live ? 'draft' : 'published'); toast(live ? 'Ditarik menjadi draf.' : 'Diterbitkan.'); await reload(); }
          catch (e) { ev.currentTarget.disabled = false; if (e.status !== 401) toast('Gagal mengubah status. ' + hint(e), true); }
        } }, live ? 'Tarik (jadi draf)' : 'Terbitkan'),
        h('button', { class: 'btn-sm alt', type: 'button', onclick: async () => {
          if (!(await ask({ title: 'Hapus "' + p.title + '"?', text: 'Tidak bisa dikembalikan.', reason: false }))) return;
          try { await deletePost(p.id); toast('Dihapus.'); await reload(); }
          catch (e) { if (e.status !== 401) toast('Gagal menghapus. ' + hint(e), true); }
        } }, 'Hapus')));
  };

  box.replaceChildren(...[
    onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '',
    h('h2', { class: 'mt' }, 'Agenda & pengumuman'),
    h('p', { class: 'muted' }, mosque.name),
    form,
    h('div', { class: 'panel' }, h('h3', {}, 'Daftar (' + posts.length + ')'),
      posts.length ? posts.map(item) : h('p', { class: 'muted' }, 'Belum ada. Tulis agenda atau pengumuman pertama di atas.'))
  ].flat());
  window.scrollTo(0, 0);
}
