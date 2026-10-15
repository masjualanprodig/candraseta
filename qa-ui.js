// BAITUNA - qa-ui.js
// Halaman Tanya Jawab: tab Terbaru, Populer, Kategori; detail jawaban; ajukan pertanyaan (harus masuk);
// pertanyaan saya; kelola untuk penjawab resmi; pengaturan untuk Super Admin. Tidak ada isi agama bawaan: semua jawaban berasal dari penjawab resmi.
import { h, toast, ask } from './ui.js';
import { getSession } from './supabase.js';
import * as S from './qa-service.js';
import { icon, ICONS } from './feed-ui.js';

export const DISCLAIMER = 'Jawaban ini adalah pandangan penjawab yang bersangkutan beserta rujukannya, bukan fatwa. Untuk perkara besar atau pribadi, tanyakan langsung kepada ulama atau ustaz yang Anda percaya.';
export const TABS = [['terbaru', 'Terbaru'], ['populer', 'Populer'], ['kategori', 'Kategori']];
const fmt = iso => { try { return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };

export function qaPage({ go, onSignIn } = {}) {
  const wrap = h('div', { class: 'qa' });
  const st = { view: 'list', tab: 'terbaru', cat: '', q: '', items: [], more: false, loading: false, cats: [], counts: {}, role: { moderate: false, admin: false }, openId: '', from: 'list', seq: 0 };
  const catName = id => (st.cats.find(c => c.id === id) || {}).name || 'Lainnya';
  const signedIn = () => !!getSession();
  const draw = (...kids) => wrap.replaceChildren(...kids);
  const back = (label, fn, id = 'qa-back') => h('button', { class: 'btn-ghost qa-back', type: 'button', id, onclick: fn }, label);
  const empty = t => h('div', { class: 'empty' }, h('p', { class: 'muted' }, t));
  const nameFor = e => S.askError(e);

  /* ===== Daftar ===== */
  async function loadCats() { try { st.cats = await S.listCategories(); } catch (e) { st.cats = []; } try { st.counts = await S.categoryCounts(); } catch (e) { st.counts = {}; } }
  async function fetchPage(reset) {
    const my = ++st.seq; st.loading = true;
    try {
      const rows = await S.listQuestions({ tab: st.tab, category: st.cat, q: st.q, offset: reset ? 0 : st.items.length });
      if (my !== st.seq) return;
      st.items = reset ? rows : st.items.concat(rows); st.more = rows.length >= S.PAGE; st.fail = false;
    } catch (e) { if (my !== st.seq) return; st.fail = true; if (reset) st.items = []; st.more = false; }
    st.loading = false;
  }
  async function showList(reset = true) {
    st.view = 'list';
    if (!st.cats.length) await loadCats();
    if (st.tab === 'kategori' && !st.cat) { st.items = []; drawList(); return; }
    drawList(true); await fetchPage(reset); drawList();
  }
  function head() {
    const acts = [h('button', { class: 'btn-sm', type: 'button', id: 'qa-ask', onclick: showAsk }, 'Ajukan pertanyaan')];
    if (signedIn()) acts.push(h('button', { class: 'btn-sm ghost', type: 'button', id: 'qa-mine', onclick: showMine }, 'Pertanyaan saya'));
    if (st.role.moderate) acts.push(h('button', { class: 'btn-sm ghost', type: 'button', id: 'qa-manage', onclick: showManage }, 'Kelola'));
    if (st.role.admin) acts.push(h('button', { class: 'btn-sm ghost', type: 'button', id: 'qa-admin', onclick: showAdmin }, 'Pengaturan'));
    return [h('h2', { class: 'wtitle' }, 'Tanya Jawab'),
      h('p', { class: 'muted' }, 'Pertanyaan dari jamaah dijawab oleh penjawab resmi, lengkap dengan rujukannya.'),
      h('div', { class: 'qa-acts' }, acts)];
  }
  const seg = () => h('div', { class: 'seg', id: 'qa-seg', role: 'tablist', 'aria-label': 'Urutan pertanyaan' }, ...TABS.map(([k, l]) =>
    h('button', { class: 'segb', type: 'button', role: 'tab', 'data-tab': k, 'aria-selected': String(st.tab === k), onclick: () => { if (st.tab !== k) { st.tab = k; st.cat = ''; showList(); } } }, l)));
  function item(r) {
    return h('button', { class: 'qa-item', type: 'button', 'data-id': r.id, onclick: () => showDetail(r.id, 'list') },
      h('span', { class: 'qa-ic', 'aria-hidden': 'true' }, icon(ICONS.help)),
      h('b', { class: 'qa-t' }, r.title),
      h('span', { class: 'muted qa-m' }, catName(r.category_id) + ' · ' + fmt(r.answered_at || r.created_at)),
      h('span', { class: 'muted qa-m' }, r.view_count + ' dibaca · ' + r.helpful_count + ' bermanfaat'));
  }
  function drawList(loading) {
    const kids = [...head(), seg()];
    const search = h('input', { class: 'in', id: 'qa-search', type: 'search', maxlength: '60', placeholder: 'Cari judul pertanyaan…', 'aria-label': 'Cari pertanyaan' }); search.value = st.q;
    let timer; search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { st.q = search.value; showList().then(() => { const el = document.getElementById('qa-search'); if (el) { el.focus(); const n = el.value.length; try { el.setSelectionRange(n, n); } catch (e) { /* abaikan */ } } }); }, 350); });
    kids.push(search);
    if (st.tab === 'kategori' && !st.cat) {
      kids.push(h('div', { class: 'qlist', id: 'qa-cats' }, ...st.cats.map(c => h('button', { class: 'morecard qa-cat', type: 'button', 'data-id': c.id, onclick: () => { st.cat = c.id; showList(); } },
        h('span', { class: 'mc-tx' }, h('b', {}, c.name), h('span', { class: 'muted' }, (st.counts[c.id] || 0) + ' pertanyaan terjawab'))))));
      if (!st.cats.length) kids.push(empty('Kategori belum tersedia.'));
    } else {
      if (st.tab === 'kategori') kids.push(h('div', { class: 'qa-crumb' }, h('button', { class: 'btn-sm ghost', type: 'button', id: 'qa-allcats', onclick: () => { st.cat = ''; showList(); } }, '← Semua kategori'), h('b', {}, catName(st.cat))));
      if (loading && !st.items.length) kids.push(h('p', { class: 'muted', id: 'qa-loading' }, 'Memuat…'));
      else if (st.fail) kids.push(empty('Pertanyaan belum bisa dimuat. Periksa koneksi lalu coba lagi.'), h('button', { class: 'btn-sm', type: 'button', id: 'qa-retry', onclick: () => showList() }, 'Coba lagi'));
      else if (!st.items.length) kids.push(empty(st.q ? 'Tidak ada pertanyaan yang cocok dengan pencarian.' : 'Belum ada pertanyaan yang dijawab di sini.'));
      else kids.push(h('div', { class: 'qlist', id: 'qa-list' }, ...st.items.map(item)));
      if (st.more && !loading) kids.push(h('button', { class: 'btn-ghost', type: 'button', id: 'qa-more', onclick: async () => { await fetchPage(false); drawList(); } }, 'Muat lebih banyak'));
    }
    kids.push(h('p', { class: 'hint' }, DISCLAIMER));
    draw(...kids);
  }

  /* ===== Detail ===== */
  async function showDetail(id, from) {
    st.view = 'detail'; st.openId = id; st.from = from || 'list';
    const goBack = () => (st.from === 'mine' ? showMine() : st.from === 'manage' ? showManage() : showList());
    draw(back('← Kembali', goBack), h('p', { class: 'muted', id: 'qa-loading' }, 'Memuat…'));
    let q = null, a = null;
    try { q = await S.getQuestion(id); a = q ? await S.getAnswer(id) : null; } catch (e) { draw(back('← Kembali', goBack), empty('Belum bisa dimuat. Coba lagi.')); return; }
    if (!q || (!a && q.status === 'dijawab')) { draw(back('← Kembali', goBack), empty('Pertanyaan tidak ditemukan atau sudah tidak ditampilkan.')); return; }
    if (q.status === 'dijawab') S.markViewed(id).then(n => { if (typeof n === 'number') { const el = document.getElementById('qa-views'); if (el) el.textContent = n + ' dibaca'; } });
    const on = S.voted().includes(id);
    let count = q.helpful_count;
    const hb = h('button', { class: 'btn-sm' + (on ? '' : ' ghost'), type: 'button', id: 'qa-helpful', 'aria-pressed': String(on) });
    const paint = (v, n) => { hb.className = 'btn-sm' + (v ? '' : ' ghost'); hb.setAttribute('aria-pressed', String(v)); hb.textContent = (v ? '✓ Bermanfaat' : 'Bermanfaat') + ' · ' + n; };
    paint(on, count);
    hb.addEventListener('click', async () => {
      const now = hb.getAttribute('aria-pressed') !== 'true'; hb.setAttribute('aria-busy', 'true');
      try { const n = await S.setHelpful(id, now); if (typeof n === 'number') { count = n; S.rememberVote(id, now); paint(now, n); } else toast('Belum bisa dicatat sekarang.', true); }
      catch (e) { toast('Belum bisa dicatat. Coba lagi.', true); }
      hb.removeAttribute('aria-busy');
    });
    draw(back('← Kembali', goBack),
      h('article', { class: 'panel qa-detail', id: 'qa-detail' },
        h('span', { class: 'chip' }, catName(q.category_id)),
        h('h3', { class: 'qa-dt' }, q.title),
        q.body ? h('p', { class: 'qa-body' }, q.body) : '',
        h('p', { class: 'muted' }, 'Ditanyakan oleh ' + q.asker_label + ' · ' + fmt(q.created_at) + ' · ', h('span', { id: 'qa-views' }, q.view_count + ' dibaca')),
        a ? h('div', { class: 'qa-answer', id: 'qa-answer' },
          h('h4', {}, 'Jawaban'),
          h('p', { class: 'qa-body' }, a.body),
          h('h4', {}, 'Sumber / rujukan'),
          h('p', { class: 'qa-body qa-src', id: 'qa-sources' }, a.sources),
          h('p', { class: 'muted' }, 'Dijawab oleh ' + a.answerer_name + ' · ' + fmt(a.updated_at || a.created_at))) : h('p', { class: 'muted' }, STATUS_NOTE(q.status)),
        a && q.status === 'dijawab' ? h('div', { class: 'qa-vote' }, hb) : '',
        h('p', { class: 'hint', id: 'qa-disc' }, DISCLAIMER)));
  }
  const STATUS_NOTE = s => s === 'disembunyikan' ? 'Pertanyaan ini sedang disembunyikan dari publik.' : 'Belum dijawab.';

  /* ===== Ajukan pertanyaan ===== */
  async function showAsk() {
    st.view = 'ask';
    if (!signedIn()) {
      draw(back('← Kembali', () => showList()), h('h2', { class: 'wtitle' }, 'Ajukan pertanyaan'),
        h('div', { class: 'panel', id: 'qa-login' }, h('p', {}, 'Untuk bertanya, silakan masuk dulu. Ini menjaga agar pertanyaan tetap tertib dan tidak disalahgunakan.'),
          h('p', { class: 'muted' }, 'Belum punya akun? Pilih Daftar di halaman masuk, lalu masuk dan ajukan pertanyaan.'),
          h('button', { class: 'btn-primary', type: 'button', id: 'qa-signin', onclick: () => onSignIn && onSignIn() }, 'Masuk')));
      return;
    }
    let role = st.role;
    if (role.approved === undefined) { try { role = await S.myRole(); st.role = role; } catch (e) { /* lanjut */ } }
    if (!st.cats.length) await loadCats();
    const title = h('input', { class: 'in', id: 'qa-title', maxlength: String(S.LIMIT.titleMax), placeholder: 'Tulis pertanyaan Anda secara singkat' });
    const body = h('textarea', { class: 'in tall', id: 'qa-body', rows: '6', maxlength: String(S.LIMIT.bodyMax), placeholder: 'Rincian (boleh dikosongkan). Jangan menulis data pribadi yang sensitif.' });
    const cat = h('select', { class: 'in', id: 'qa-cat' }, h('option', { value: '' }, 'Pilih kategori…'), ...st.cats.map(c => h('option', { value: c.id }, c.name)));
    const show = h('input', { type: 'checkbox', id: 'qa-show' });
    const err = h('p', { class: 'mk-err', id: 'qa-err', role: 'alert' }, '');
    const btn = h('button', { class: 'btn-primary', type: 'submit', id: 'qa-submit' }, 'Kirim pertanyaan');
    let busy = false;
    const form = h('form', { class: 'panel rform', novalidate: 'novalidate' },
      h('label', { class: 'hint', for: 'qa-title' }, 'Pertanyaan'), title,
      h('label', { class: 'hint', for: 'qa-body' }, 'Rincian'), body,
      h('label', { class: 'hint', for: 'qa-cat' }, 'Kategori'), cat,
      h('label', { class: 'qa-check' }, show, ' Tampilkan nama depan saya (jika tidak, tampil sebagai "Jamaah")'),
      err, btn,
      h('p', { class: 'hint' }, 'Pertanyaan baru tampil ke publik setelah dijawab penjawab resmi. Anda bisa memantau statusnya di "Pertanyaan saya". Pertanyaan bisa ditolak jika di luar cakupan. Batas: 3 pertanyaan menunggu, 5 per hari. BAITUNA tidak mengirim pemberitahuan saat dijawab.'));
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); if (busy) return;
      const v = S.checkQuestion({ title: title.value, body: body.value, category: cat.value, showName: show.checked });
      if (v.error) { err.textContent = v.error; ({ title, body, category: cat })[v.field].focus(); return; }
      err.textContent = ''; busy = true; btn.disabled = true; btn.textContent = 'Mengirim…';
      try { await S.askQuestion(v.ok); toast('Pertanyaan terkirim. Menunggu dijawab.'); busy = false; showMine(true); return; }
      catch (e) { err.textContent = nameFor(e); }
      busy = false; btn.disabled = false; btn.textContent = 'Kirim pertanyaan';
    });
    draw(back('← Kembali', () => showList()), h('h2', { class: 'wtitle' }, 'Ajukan pertanyaan'), form);
  }

  /* ===== Pertanyaan saya ===== */
  async function showMine(justSent) {
    st.view = 'mine';
    if (!signedIn()) { showAsk(); return; }
    draw(back('← Kembali', () => showList()), h('h2', { class: 'wtitle' }, 'Pertanyaan saya'), h('p', { class: 'muted', id: 'qa-loading' }, 'Memuat…'));
    let rows = [];
    try { rows = await S.myQuestions(); } catch (e) { draw(back('← Kembali', () => showList()), h('h2', { class: 'wtitle' }, 'Pertanyaan saya'), empty('Belum bisa dimuat. Coba lagi.')); return; }
    if (!st.cats.length) await loadCats();
    draw(back('← Kembali', () => showList()), h('h2', { class: 'wtitle' }, 'Pertanyaan saya'),
      justSent ? h('p', { class: 'hint', id: 'qa-sent' }, 'Pertanyaan Anda sudah masuk antrean penjawab. Periksa halaman ini lagi nanti untuk melihat jawabannya.') : '',
      rows.length ? h('div', { class: 'qlist', id: 'qa-mylist' }, ...rows.map(r => h('div', { class: 'panel qa-my', 'data-st': r.status },
        h('b', { class: 'qa-t' }, r.title),
        h('span', { class: 'chip qa-st' }, S.STATUS_LABEL[r.status] || r.status),
        h('span', { class: 'muted qa-m' }, catName(r.category_id) + ' · ' + fmt(r.created_at)),
        r.status === 'ditolak' && r.reject_reason ? h('p', { class: 'qa-body' }, 'Alasan: ' + r.reject_reason) : '',
        r.status === 'dijawab' ? h('button', { class: 'btn-sm', type: 'button', onclick: () => showDetail(r.id, 'mine') }, 'Lihat jawaban') : ''))) : empty('Anda belum mengajukan pertanyaan.'));
  }

  /* ===== Kelola (penjawab dan Super Admin) ===== */
  async function showManage() {
    st.view = 'manage';
    const bk = () => showList();
    draw(back('← Kembali', bk), h('h2', { class: 'wtitle' }, 'Kelola Tanya Jawab'), h('p', { class: 'muted', id: 'qa-loading' }, 'Memuat…'));
    let q = [], m = [];
    try { [q, m] = await Promise.all([S.queue(), S.manageList()]); } catch (e) { draw(back('← Kembali', bk), empty('Belum bisa dimuat. ' + (e && e.status === 403 ? 'Anda tidak memiliki izin.' : 'Coba lagi.'))); return; }
    if (!st.cats.length) await loadCats();
    const qcard = r => {
      const body = h('textarea', { class: 'in tall qa-ans', rows: '6', maxlength: String(S.LIMIT.ansMax), placeholder: 'Tulis jawaban…', 'aria-label': 'Jawaban' });
      const src = h('textarea', { class: 'in qa-srcin', rows: '3', maxlength: String(S.LIMIT.srcMax), placeholder: 'Sumber / rujukan (wajib): ayat, hadits, kitab, atau nama ulama…', 'aria-label': 'Sumber atau rujukan' });
      const err = h('p', { class: 'mk-err', role: 'alert' }, '');
      const send = h('button', { class: 'btn-sm qa-send', type: 'button' }, 'Kirim jawaban');
      const rej = h('button', { class: 'btn-sm alt qa-reject', type: 'button' }, 'Tolak');
      send.addEventListener('click', async () => {
        const v = S.checkAnswer({ body: body.value, sources: src.value });
        if (v.error) { err.textContent = v.error; ({ body, sources: src })[v.field].focus(); return; }
        err.textContent = ''; send.disabled = true;
        try { await S.answerQuestion(r.id, v.ok); toast('Jawaban terkirim dan sudah tampil.'); showManage(); return; }
        catch (e) { err.textContent = S.adminError(e); }
        send.disabled = false;
      });
      rej.addEventListener('click', async () => {
        const reason = await ask({ title: 'Tolak pertanyaan?', text: 'Tulis alasan singkat. Penanya akan melihatnya di "Pertanyaan saya".', reason: true });
        if (!reason) return;
        try { await S.rejectQuestion(r.id, reason.slice(0, S.LIMIT.reasonMax)); toast('Pertanyaan ditolak.'); showManage(); }
        catch (e) { toast(S.adminError(e), true); }
      });
      return h('div', { class: 'panel qa-q', 'data-id': r.id }, h('span', { class: 'chip' }, catName(r.category_id)), h('b', { class: 'qa-t' }, r.title),
        r.body ? h('p', { class: 'qa-body' }, r.body) : '', h('span', { class: 'muted qa-m' }, 'Oleh ' + r.asker_label + ' · ' + fmt(r.created_at)),
        body, src, err, h('div', { class: 'qa-acts' }, send, rej));
    };
    const mcard = r => {
      const hid = r.status === 'disembunyikan';
      return h('div', { class: 'panel qa-mg', 'data-id': r.id, 'data-st': r.status }, h('b', { class: 'qa-t' }, r.title),
        h('span', { class: 'muted qa-m' }, (hid ? 'Disembunyikan' : 'Tampil') + ' · ' + r.view_count + ' dibaca · ' + r.helpful_count + ' bermanfaat'),
        h('div', { class: 'qa-acts' },
          h('button', { class: 'btn-sm ghost', type: 'button', onclick: () => showDetail(r.id, 'manage') }, 'Lihat'),
          h('button', { class: 'btn-sm ghost qa-hide', type: 'button', onclick: async () => { try { await S.setHidden(r.id, !hid); toast(hid ? 'Ditampilkan lagi.' : 'Disembunyikan.'); showManage(); } catch (e) { toast(S.adminError(e), true); } } }, hid ? 'Tampilkan' : 'Sembunyikan'),
          st.role.admin ? h('button', { class: 'btn-sm alt qa-del', type: 'button', onclick: async () => { if (!(await ask({ title: 'Hapus permanen?', text: 'Pertanyaan dan jawabannya dihapus dan tidak bisa dikembalikan.' }))) return; try { await S.deleteQuestion(r.id); toast('Dihapus.'); showManage(); } catch (e) { toast(S.adminError(e), true); } } }, 'Hapus') : ''));
    };
    draw(back('← Kembali', bk), h('h2', { class: 'wtitle' }, 'Kelola Tanya Jawab'),
      h('h3', {}, 'Antrean (' + q.length + ')'), q.length ? h('div', { id: 'qa-queue' }, ...q.map(qcard)) : empty('Tidak ada pertanyaan yang menunggu.'),
      h('h3', {}, 'Sudah dijawab'), m.length ? h('div', { id: 'qa-managed' }, ...m.map(mcard)) : empty('Belum ada.'),
      h('p', { class: 'hint' }, 'Jawaban tampil ke publik dengan nama dan gelar Anda. Tuliskan sumber yang bisa diperiksa. Pertanyaan yang meminta fatwa pribadi atau di luar keahlian sebaiknya ditolak dengan alasan yang sopan.'));
  }

  /* ===== Pengaturan Super Admin ===== */
  async function showAdmin() {
    st.view = 'admin';
    const bk = () => showList();
    draw(back('← Kembali', bk), h('h2', { class: 'wtitle' }, 'Pengaturan Tanya Jawab'), h('p', { class: 'muted', id: 'qa-loading' }, 'Memuat…'));
    let ans = [], cats = [];
    try { [ans, cats] = await Promise.all([S.listAnswerers(), S.allCategories()]); } catch (e) { draw(back('← Kembali', bk), empty('Belum bisa dimuat. Coba lagi.')); return; }
    const again = () => { st.cats = []; showAdmin(); };
    const act = async fn => { try { await fn(); again(); } catch (e) { toast(S.adminError(e), true); } };
    const em = h('input', { class: 'in', id: 'qa-a-email', type: 'email', maxlength: '120', placeholder: 'Email akun penjawab' });
    const nm = h('input', { class: 'in', id: 'qa-a-name', maxlength: '60', placeholder: 'Nama yang tampil, mis. Ahmad Fauzi' });
    const ti = h('input', { class: 'in', id: 'qa-a-title', maxlength: '40', placeholder: 'Gelar (boleh kosong), mis. Ustaz' });
    const aerr = h('p', { class: 'mk-err', id: 'qa-a-err', role: 'alert' }, '');
    const add = h('button', { class: 'btn-sm', type: 'button', id: 'qa-a-add', onclick: async () => {
      if (!em.value.trim() || nm.value.trim().length < 2) { aerr.textContent = 'Isi email dan nama (minimal 2 huruf).'; return; }
      aerr.textContent = ''; add.disabled = true;
      try { await S.addAnswerer(em.value, nm.value, ti.value); toast('Penjawab ditambahkan.'); again(); return; } catch (e) { aerr.textContent = S.adminError(e); }
      add.disabled = false;
    } }, 'Tambah penjawab');
    const cn = h('input', { class: 'in', id: 'qa-c-name', maxlength: '40', placeholder: 'Nama kategori baru' });
    const cerr = h('p', { class: 'mk-err', id: 'qa-c-err', role: 'alert' }, '');
    const cadd = h('button', { class: 'btn-sm', type: 'button', id: 'qa-c-add', onclick: async () => {
      if (cn.value.trim().length < 2) { cerr.textContent = 'Nama kategori minimal 2 huruf.'; return; }
      cerr.textContent = ''; cadd.disabled = true;
      try { await S.addCategory(cn.value, (cats.reduce((m, c) => Math.max(m, c.sort_order || 0), 0)) + 10); toast('Kategori ditambahkan.'); again(); return; } catch (e) { cerr.textContent = S.adminError(e); }
      cadd.disabled = false;
    } }, 'Tambah kategori');
    draw(back('← Kembali', bk), h('h2', { class: 'wtitle' }, 'Pengaturan Tanya Jawab'),
      h('div', { class: 'panel rform', id: 'qa-ansers' }, h('h3', {}, 'Penjawab resmi'),
        h('p', { class: 'muted' }, 'Penjawab harus sudah punya akun BAITUNA. Hanya tunjuk orang yang kompeten dan dipercaya; jawaban tampil dengan nama dan gelarnya.'),
        ...ans.map(a => h('div', { class: 'qa-arow', 'data-id': a.user_id }, h('span', {}, h('b', {}, (a.title ? a.title + ' ' : '') + a.display_name), h('span', { class: 'muted' }, ' · ' + a.email + (a.active ? '' : ' · nonaktif'))),
          h('span', { class: 'qa-acts' },
            h('button', { class: 'btn-sm ghost qa-toggle', type: 'button', onclick: () => act(() => S.setAnswererActive(a.user_id, !a.active)) }, a.active ? 'Nonaktifkan' : 'Aktifkan'),
            h('button', { class: 'btn-sm alt qa-rm', type: 'button', onclick: async () => { if (await ask({ title: 'Hapus penjawab?', text: 'Jawaban lama tetap tampil. Orang ini tidak bisa menjawab lagi.' })) act(() => S.removeAnswerer(a.user_id)); } }, 'Hapus')))),
        ans.length ? '' : empty('Belum ada penjawab. Tambahkan di bawah.'),
        em, nm, ti, aerr, add),
      h('div', { class: 'panel rform', id: 'qa-catsadm' }, h('h3', {}, 'Kategori'),
        ...cats.map(c => h('div', { class: 'qa-arow', 'data-id': c.id }, h('span', {}, h('b', {}, c.name), c.active ? '' : h('span', { class: 'muted' }, ' · nonaktif')),
          h('button', { class: 'btn-sm ghost qa-ctoggle', type: 'button', onclick: () => act(() => S.updateCategory(c.id, { active: !c.active })) }, c.active ? 'Nonaktifkan' : 'Aktifkan'))),
        cn, cerr, cadd));
  }

  // Mulai
  S.myRole().then(r => { st.role = r; if (st.view === 'list') drawList(st.loading); });
  showList();
  return wrap;
}
