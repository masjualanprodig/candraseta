// BAITUNA - pengguna-ui.js
// Super Admin: daftar akun yang sudah mendaftar. Status yang bisa diatur hanya dua: Admin Masjid, atau pengguna umum.
import { h, toast, ask, STATUS_LABEL } from './ui.js';
import * as P from './pengguna-service.js';
import { icon, ICONS } from './feed-ui.js';

export async function renderUserManager(box, { onBack, mosques = [] } = {}) {
  const st = { q: '', filter: 'semua', rows: [], more: false, busy: false, open: null };
  const back = h('button', { class: 'btn-sm ghost', type: 'button', id: 'us-back', onclick: () => onBack && onBack() }, '← Kembali ke dashboard');
  const search = h('input', { class: 'in', id: 'us-q', type: 'search', placeholder: 'Cari nama atau email', maxlength: '60', autocomplete: 'off', 'aria-label': 'Cari akun' });
  const chips = h('div', { class: 'achips', id: 'us-filters', role: 'group', 'aria-label': 'Saring status' });
  const status = h('p', { class: 'muted', id: 'us-status', role: 'status' }, '');
  const list = h('div', { id: 'us-list', class: 'us-list' });
  const moreBtn = h('button', { class: 'btn-sm ghost', type: 'button', id: 'us-more', hidden: 'hidden', onclick: () => load(true) }, 'Muat lebih banyak');
  let stats = null;
  const cnt = k => stats ? ' (' + (k === 'semua' ? stats.total : k === 'admin' ? stats.admin : stats.umum) + ')' : '';
  const paintChips = () => chips.replaceChildren(...P.FILTERS.map(([k, l]) => h('button', { class: 'achip', type: 'button', 'data-f': k, 'aria-pressed': String(st.filter === k), onclick: () => { if (st.filter !== k) { st.filter = k; paintChips(); load(false); } } }, l + cnt(k))));

  async function act(fn, ok) {
    try { await fn(); toast(ok); st.open = null; await load(false, true); }
    catch (e) { if (e && e.status === 401) return; toast(P.errorText(e), true); }
  }
  const badge = u => {
    const s = P.statusOf(u);
    return h('span', { class: 'us-badge us-' + s }, s === 'super' ? 'Super Admin' : s === 'admin' ? 'Admin Masjid' : 'Pengguna umum');
  };
  const row = u => {
    const s = P.statusOf(u), others = P.otherRoles(u);
    const btns = [];
    if (s === 'umum') btns.push(h('button', { class: 'btn-sm', type: 'button', 'data-act': 'assign', onclick: () => act(() => P.setMasjidAdmin(u.id), 'Akun sekarang Admin Masjid dan bisa mendaftarkan masjid.') }, 'Jadikan Admin Masjid'));
    if (s === 'admin') btns.push(h('button', { class: 'btn-sm alt', type: 'button', 'data-act': 'unset', onclick: async () => {
      const okk = await ask({ title: 'Jadikan pengguna umum?', text: (u.full_name || u.email) + ' tidak lagi menjadi Admin Masjid dan tidak bisa mendaftarkan masjid. Masjid yang sudah didaftarkan tetap ada. Peran pengurus lain, bila ada, tidak berubah.', reason: false });
      if (okk) act(() => P.unsetMasjidAdmin(u.id), 'Akun dikembalikan jadi pengguna umum.');
    } }, 'Jadikan pengguna umum'));
    return h('div', { class: 'panel us-row', 'data-user': u.email || u.id },
      h('div', { class: 'us-r1' }, h('b', { class: 'us-name' }, u.full_name || 'Tanpa nama'), badge(u)),
      h('div', { class: 'muted us-mail' }, u.email || ''),
      s === 'admin' ? h('div', { class: 'us-mosques' }, h('div', { class: 'us-meta' }, u.admins.length ? 'Masjid yang didaftarkan (' + u.admins.length + '):' : 'Belum mendaftarkan masjid.'),
        ...u.admins.map(a => h('div', { class: 'us-mrow' }, h('span', { class: 'us-mn' }, h('b', {}, a.name), [a.city, a.province].filter(Boolean).length ? h('small', {}, [a.city, a.province].filter(Boolean).join(', ')) : ''), h('span', { class: 'badge b-' + a.status }, STATUS_LABEL[a.status] || a.status)))) : '',
      others.length ? h('div', { class: 'us-meta' }, 'Juga: ' + others.join(', ')) : '',
      s === 'super' ? h('div', { class: 'us-meta' }, 'Akun Super Admin tidak diubah dari sini.') : '',
      btns.length ? h('div', { class: 'row-btns' }, ...btns) : '');
  };
  const draw = () => {
    list.replaceChildren(...(st.rows.length ? st.rows.map(row) : [h('div', { class: 'empty', id: 'us-empty' }, h('p', { class: 'muted' }, 'Tidak ada akun yang cocok.'))]));
    status.textContent = st.rows.length + ' akun ditampilkan'; moreBtn.hidden = !st.more;
  };
  async function load(append, keep) {
    if (st.busy) return; st.busy = true; status.textContent = 'Memuat…'; moreBtn.hidden = true;
    try {
      const got = await P.listUsers({ q: st.q, filter: st.filter, offset: append ? st.rows.length : 0, limit: P.PAGE });
      st.rows = append ? st.rows.concat(got) : got; st.more = got.length >= P.PAGE;
      draw();
    } catch (e) {
      st.busy = false; if (e && e.status === 401) return;
      status.textContent = ''; list.replaceChildren(h('div', { class: 'panel', id: 'us-err' }, h('p', {}, P.errorText(e)), h('button', { class: 'btn-sm', type: 'button', id: 'us-retry', onclick: () => load(false) }, 'Coba lagi')));
      return;
    }
    st.busy = false;
  }
  let t = null;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { st.q = search.value; load(false); }, 300); });
  paintChips();
  const card = (ic, tone, id, label, sub) => { const b = h('b', { id }, '…'); return h('div', { class: 'us-stat ' + tone }, h('span', { class: 'us-sic' }, icon(ic)), h('div', { class: 'us-st' }, b, h('span', {}, label), h('small', {}, sub))); };
  const sTotal = card(ICONS.users, 'g', 'us-s-total', 'Total Pengguna', 'Semua akun terdaftar');
  const sAdmin = card(ICONS.mosque, 'g2', 'us-s-admin', 'Admin Masjid', 'Mengelola masjid');
  const sUmum = card(ICONS.user, 'y', 'us-s-umum', 'Pengguna Umum', 'Jamaah aplikasi');
  const sBaru = card(ICONS.clock, 'n', 'us-s-baru', 'Baru Minggu Ini', 'Akun baru terdaftar');
  const statBox = h('div', { class: 'us-stats', id: 'us-stats', hidden: 'hidden' }, sTotal, sAdmin, sUmum, sBaru);
  box.replaceChildren(back,
    h('div', { class: 'us-hero' }, h('div', { class: 'us-hero-tx' }, h('h2', {}, 'Pengguna'),
      h('p', { class: 'muted' }, 'Akun yang sudah mendaftar di aplikasi BAITUNA. Status hanya bisa diatur menjadi Admin Masjid, atau dikembalikan menjadi pengguna umum. Admin Masjid mendaftarkan masjidnya sendiri; Anda memverifikasinya di menu Data Masjid.'))),
    statBox, search, chips, status, list, moreBtn);
  P.userStats().then(s => {
    if (!s) return; stats = s;
    [['us-s-total', s.total], ['us-s-admin', s.admin], ['us-s-umum', s.umum], ['us-s-baru', s.baru]].forEach(([id, v]) => { const el = statBox.querySelector('#' + id); if (el) el.textContent = String(v); });
    statBox.hidden = false; paintChips();
  }).catch(() => {});
  window.scrollTo(0, 0);
  await load(false);
}
