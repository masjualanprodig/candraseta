// BAITUNA - ai-ui.js
// Forum Tanya Jawab BAITUNA (dibantu AI). Halaman: pengenalan/terkunci, beranda forum (kategori, contoh, kolom tanya),
// percakapan (jawaban, dalil & rujukan, sumber terkait, opsi), riwayat, dan kelola (Super Admin: laporan & sumber rujukan).
// Tidak ada jawaban/rujukan contoh yang ditampilkan seolah nyata: semua isi berasal dari server.
import { h, toast, ask as confirmDlg } from './ui.js';
import { getSession } from './supabase.js';
import * as A from './ai-service.js';
import * as M from './membership-service.js';
import { membershipFlow } from './membership-ui.js';
import { membershipAdminPage } from './membership-admin-ui.js';
import { icon, ICONS } from './feed-ui.js';

const I = {
  salat: '<circle cx="12" cy="5" r="2"/><path d="M4 20h16M7 20l2.5-6h5L17 20M9.5 14 8 10.5M14.5 14 16 10.5"/>',
  puasa: ICONS.moon, zakat: ICONS.zakat, quran: ICONS.quran, keluarga: ICONS.users, lainnya: ICONS.help,
  haji: '<path d="M4 8l8-4 8 4v9l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v9M4 11l8 4 8-4"/>',
  muamalah: '<path d="M12 4v15M8 19h8M5 7h14"/><path d="M5 7l-2.5 5.5a2.5 2.5 0 0 0 5 0zM19 7l-2.5 5.5a2.5 2.5 0 0 0 5 0z"/>',
  akhlak: '<path d="M12 20s-7-4.3-7-9.6A4 4 0 0 1 12 7.8a4 4 0 0 1 7 2.6C19 15.7 12 20 12 20z"/><path d="M9.2 11.6l1.9 1.9 3.7-3.7"/>',
  send: '<path d="M4.5 12 20 4.5 15 20l-3-6.5z"/><path d="M12 13.5 20 4.5"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
  flag: '<path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11"/>', bookmark: ICONS.bookmark, share: ICONS.share, more: ICONS.more, clock: ICONS.clock, lock: ICONS.lock, chat: ICONS.chat,
  plus: '<path d="M12 5v14M5 12h14"/>', trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>',
  shield: ICONS.shield, book: ICONS.book, news: ICONS.news, mosque: ICONS.mosque
};
const ic = (n, cls) => icon(I[n] || n, cls);
const two = n => String(n).padStart(2, '0');
const hm = v => { const d = new Date(v); return isNaN(d) ? '' : two(d.getHours()) + '.' + two(d.getMinutes()); };
const day = v => { const d = new Date(v); return isNaN(d) ? '' : M.fmtDate(d); };
const OPEN_ORDER = ['menunggu_pembayaran', 'menunggu_verifikasi'];

export function aiForumPage({ go, onSignIn, openRelated } = {}) {
  const wrap = h('div', { class: 'ai' });
  const d0 = A.loadDraft();
  const st = { access: null, admin: false, used: 0, limit: A.DAILY_LIMIT, cat: d0.cat, q: d0.q, conv: null, msgs: [], pending: null, sending: false, view: '', orders: null };
  const draw = (...k) => { wrap.replaceChildren(...k); };
  const back = (label, fn, id) => h('button', { class: 'btn-ghost ai-back', type: 'button', id: id || 'ai-back', onclick: fn }, label);
  const left = () => Math.max(0, st.limit - st.used);
  const btn = (text, cls, id, onclick, extra) => h('button', Object.assign({ class: cls, type: 'button', id, onclick }, extra || {}), text);

  /* ===== Masuk ===== */
  async function start() {
    if (!getSession()) { introScreen('tamu'); return; }
    draw(h('p', { class: 'muted', id: 'ai-loading' }, 'Memuat…'));
    try {
      const s = await A.myStatus();
      st.admin = !!(s && s.admin); st.used = s && Number.isFinite(s.used) ? s.used : 0;
      st.access = !!(s && (s.premium || s.admin));
    } catch (e) {
      st.access = null;
      introScreen(A.notReady(e) ? 'belum' : 'gagal'); return;
    }
    if (st.access) { st.conv ? chatScreen() : homeScreen(); return; }
    introScreen('kunci');
    try { st.orders = await M.myOrders(); } catch (e) { st.orders = []; }
    if (st.view === 'intro' && st.orders.some(o => OPEN_ORDER.includes(o.status))) introScreen('kunci');
  }

  function openMembership(where) {
    membershipFlow({ draw, start: where, backLabel: '← Forum Tanya Jawab', isAdmin: st.admin,
      openAdmin: tab => membershipAdminPage({ draw, tab, exit: () => openMembership(where) }),
      signIn: () => { if (onSignIn) onSignIn(); }, exit: () => { st.conv = null; start(); } });
    window.scrollTo(0, 0);
  }

  /* ===== Halaman 2: pengenalan (belum member / tamu) ===== */
  function introScreen(mode) {
    st.view = 'intro';
    const open = (st.orders || []).find(o => OPEN_ORDER.includes(o.status));
    const more = h('div', { class: 'ai-more', id: 'ai-benefits', hidden: '' },
      h('h3', {}, 'Cara kerja Forum Tanya Jawab'),
      h('ul', { class: 'ai-list' },
        h('li', {}, 'Pertanyaan Anda dijawab oleh asisten digital BAITUNA yang diarahkan menjawab dengan santun dan berdasarkan rujukan. Pertanyaan dikirim ke layanan pengolah jawaban pihak ketiga, jadi jangan menulis data pribadi.'),
        h('li', {}, 'Ayat Al-Qur’an yang dirujuk diambil langsung dari mushaf (teks Arab dan terjemahan), bukan diketik oleh asisten. Rujukan yang tidak dapat diperiksa tidak ditampilkan.'),
        h('li', {}, 'Sumber lain (fatwa, kitab, artikel) hanya ditampilkan bila sudah dikurasi pengelola BAITUNA.'),
        h('li', {}, 'Jawaban ini bukan fatwa dan bisa keliru. Untuk perkara besar atau pribadi, tanyakan langsung kepada ulama atau ustaz yang Anda percaya.'),
        h('li', {}, 'Riwayat percakapan tersimpan di akun Anda, hanya bisa dilihat oleh Anda, dan bisa dihapus kapan saja.'),
        h('li', {}, 'Batas ' + st.limit + ' pertanyaan per hari agar layanan tetap terjangkau.')),
      '');
    let cta;
    if (mode === 'tamu') cta = btn('Masuk atau Daftar', 'ai-gold', 'ai-signin', () => { if (onSignIn) onSignIn(); });
    else if (mode === 'kunci') cta = open ? btn('Lihat status pesanan', 'ai-gold', 'ai-order', () => openMembership('mine')) : btn('Gabung Membership', 'ai-gold', 'ai-join', () => openMembership('plans'));
    else cta = btn('Coba lagi', 'ai-gold', 'ai-retry-status', start);
    const note = mode === 'tamu' ? 'Silakan masuk dulu untuk memakai Forum Tanya Jawab.'
      : mode === 'belum' ? 'Forum Tanya Jawab belum aktif di server. Pengelola perlu menjalankan tanya_ai.sql.'
      : mode === 'gagal' ? 'Status membership belum bisa diperiksa. Periksa koneksi, lalu coba lagi.'
      : open ? (open.status === 'menunggu_verifikasi' ? 'Pembayaran membership Anda sedang menunggu verifikasi admin. Forum terbuka otomatis setelah pembayaran diverifikasi.' : 'Anda punya pesanan membership yang belum dibayar. Selesaikan pembayaran untuk membuka forum.') : '';
    const toggle = h('button', { class: 'ai-link', type: 'button', id: 'ai-more-btn', 'aria-expanded': 'false', 'aria-controls': 'ai-benefits',
      onclick: () => { const o = more.hidden; more.hidden = !o; toggle.setAttribute('aria-expanded', String(o)); toggle.textContent = o ? 'Tutup penjelasan' : 'Lihat Manfaat Lengkap'; } }, 'Lihat Manfaat Lengkap');
    draw(h('h2', { class: 'wtitle ai-title' }, 'Forum Tanya Jawab'),
      h('p', { class: 'muted' }, 'Tempat bertanya dan belajar Islam dengan jawaban yang jelas, santun, dan berdasarkan rujukan tepercaya.'),
      h('section', { class: 'ai-lock', id: 'ai-lock', 'data-mode': mode },
        h('span', { class: 'ai-lock-ic', 'aria-hidden': 'true' }, ic('chat', 'ai-lock-chat'), h('span', { class: 'ai-lock-pad' }, ic('lock'))),
        h('b', { class: 'ai-lock-k' }, 'Fitur Premium'),
        h('h3', { class: 'ai-lock-t' }, 'Tanya jawab keislaman beserta rujukannya'),
        h('p', { class: 'ai-lock-s' }, 'Khusus jamaah dengan membership aktif.'),
        h('ul', { class: 'ai-lock-l' }, ...['Jawaban disertai rujukan yang dapat diperiksa', 'Penjelasan santun dan mudah dipahami', 'Tersedia 9 kategori pertanyaan', 'Maksimal ' + st.limit + ' pertanyaan per hari'].map(t => h('li', {}, ic('check', 'ai-lock-ok'), h('span', {}, t)))),
        note ? h('p', { class: 'ai-lock-note', id: 'ai-lock-note' }, note) : '',
        cta, toggle),
      more);
  }

  /* ===== Halaman 5: beranda forum ===== */
  function quota(id) {
    const n = left();
    return h('p', { class: 'ai-quota' + (n <= 3 ? ' low' : ''), id: id || 'ai-quota' }, n > 0 ? 'Sisa pertanyaan hari ini: ' + n + ' dari ' + st.limit : 'Batas ' + st.limit + ' pertanyaan hari ini sudah tercapai. Silakan lanjut besok, insyaAllah.');
  }
  function homeScreen() {
    st.view = 'home'; st.conv = null; st.msgs = []; st.pending = null;
    const tile = c => {
      const on = st.cat === c.key;
      return h('button', { class: 'ai-cat' + (on ? ' on' : ''), type: 'button', 'data-cat': c.key, 'aria-pressed': String(on),
        onclick: () => { st.cat = on ? '' : c.key; A.saveDraft({ q: st.q, cat: st.cat }); homeScreen(); } },
        h('span', { class: 'ai-cat-ic' }, ic(c.key)), h('span', { class: 'ai-cat-t' }, c.label, c.sub ? h('small', {}, c.sub) : ''), on ? ic('check', 'ai-cat-ok') : '');
    };
    const ex = q => h('button', { class: 'ai-ex', type: 'button', onclick: () => { st.q = q; A.saveDraft({ q, cat: st.cat }); const t = document.getElementById('ai-input'); if (t) { t.value = q; grow(t); t.focus(); } } }, q);
    draw(
      h('div', { class: 'ai-head' }, h('h2', { class: 'wtitle ai-title' }, 'Forum Tanya Jawab'), h('span', { class: 'ai-prem' }, ic('star'), 'Premium')),
      h('p', { class: 'ai-hello' }, 'Assalamu’alaikum, Saudaraku.'),
      h('p', { class: 'muted ai-desc' }, 'Mari belajar dan memahami Islam bersama melalui jawaban yang jelas, santun, dan dilengkapi rujukan yang dapat diperiksa.'),
      quota(),
      h('h3', { class: 'ai-sec' }, 'Pilih kategori ', h('span', { class: 'muted' }, '(boleh dilewati)')),
      h('div', { class: 'ai-cats', id: 'ai-cats' }, ...A.CATEGORIES.map(tile)),
      h('h3', { class: 'ai-sec' }, 'Contoh pertanyaan'),
      h('div', { class: 'ai-exs', id: 'ai-exs' }, ...A.EXAMPLES.map(ex)),
      h('div', { class: 'ai-acts' },
        btn([ic('clock'), 'Riwayat percakapan'], 'btn-sm ghost', 'ai-history', historyScreen),
        st.admin ? btn([ic('shield'), 'Kelola forum'], 'btn-sm ghost', 'ai-admin', () => adminScreen('laporan')) : ''),
      h('p', { class: 'hint ai-disc' }, 'Jawaban disusun asisten digital dan bukan fatwa. Periksa rujukannya, dan tanyakan kepada ustaz atau ulama yang Anda percaya untuk perkara besar atau pribadi.'),
      composer('Tulis pertanyaan Anda…'));
  }

  /* ===== Kolom pertanyaan ===== */
  function grow(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 150) + 'px'; }
  function composer(ph) {
    const inChat = st.view === 'chat' && !!st.conv;
    const t = h('textarea', { class: 'ai-in', id: 'ai-input', rows: '1', placeholder: ph, 'aria-label': 'Tulis pertanyaan', enterkeyhint: 'send' });
    t.value = st.q || '';
    const count = h('span', { class: 'ai-count', id: 'ai-count', 'aria-live': 'polite' });
    const paint = () => { const n = A.cleanQuestion(t.value).length; count.textContent = n > A.Q_MAX * 0.8 ? n + '/' + A.Q_MAX : ''; count.classList.toggle('over', n > A.Q_MAX); };
    t.addEventListener('input', () => { st.q = t.value; A.saveDraft({ q: st.q, cat: st.cat }); grow(t); paint(); });
    t.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } });
    // mousedown dicegah: kolom tetap fokus, tata letak tidak bergeser di tengah ketukan (keyboard HP tidak menutup-buka).
    const keep = e => e.preventDefault();
    const sendB = h('button', { class: 'ai-send', type: 'button', id: 'ai-send', 'aria-label': 'Kirim pertanyaan', onmousedown: keep, onclick: () => submit() }, ic('send'));
    const out = left() <= 0;
    if (st.sending || out) sendB.disabled = true;
    if (out) t.disabled = true;
    const catB = inChat ? '' : h('button', { class: 'ai-catbtn' + (st.cat ? ' on' : ''), type: 'button', id: 'ai-catbtn', onmousedown: keep, 'aria-label': st.cat ? 'Kategori: ' + A.catLabel(st.cat) + '. Ubah kategori' : 'Pilih kategori', onclick: categorySheet }, ic('grid'));
    const chip = st.cat && !inChat ? h('div', { class: 'ai-chip', id: 'ai-chip' }, h('span', {}, 'Kategori: ' + A.catLabel(st.cat)),
      h('button', { type: 'button', class: 'ai-chip-x', onmousedown: e => e.preventDefault(), 'aria-label': 'Hapus pilihan kategori', onclick: () => { st.cat = ''; A.saveDraft({ q: st.q, cat: '' }); rerender(); } }, ic('x'))) : '';
    const box = h('div', { class: 'ai-composer', id: 'ai-composer' }, chip, h('div', { class: 'ai-cbar' }, catB, t, sendB), count);
    setTimeout(() => { grow(t); paint(); }, 0);
    return box;
  }
  const rerender = () => st.view === 'chat' ? chatScreen() : homeScreen();

  async function submit(retry) {
    if (st.sending) return; // cegah ketuk berulang
    let q, clientId;
    if (retry && st.pending) { q = st.pending.question; clientId = st.pending.clientId; }
    else {
      const v = A.validateQuestion(st.q);
      if (v.error) { toast(v.error, true); const t = document.getElementById('ai-input'); if (t) t.focus(); return; }
      if (left() <= 0) { toast('Batas pertanyaan hari ini sudah tercapai.', true); return; }
      q = v.ok; clientId = A.newId();
    }
    const usedCat = st.conv ? (st.conv.category || null) : (st.cat || null);
    st.pending = { question: q, clientId, error: null, category: usedCat };
    st.sending = true; st.q = ''; A.saveDraft({ q: '', cat: st.cat });
    if (!st.conv) st.newTitle = q;
    chatScreen(true);
    try {
      const r = await A.ask({ question: q, category: st.conv ? null : usedCat, conversationId: st.conv ? st.conv.id : null, clientId });
      if (!st.conv || st.conv.id !== r.conversation_id) { st.conv = { id: r.conversation_id, title: q.slice(0, 80), category: usedCat, saved: false }; st.msgs = []; }
      st.msgs.push({ id: r.question_id, role: 'user', content: q, created_at: new Date().toISOString() });
      if (r.answer) st.msgs.push({ id: r.answer.id, role: 'assistant', content: r.answer.content, answer: r.answer.answer, created_at: r.answer.created_at, reply_to: r.question_id });
      if (Number.isFinite(r.used)) st.used = r.used; if (Number.isFinite(r.limit)) st.limit = r.limit;
      st.pending = null; st.cat = ''; A.saveDraft({ q: '', cat: '' });
    } catch (e) {
      st.pending.error = e;
      if (e.conversationId && !st.conv) st.conv = { id: e.conversationId, title: q.slice(0, 80), category: usedCat, saved: false };
      if (e.error === 'kuota') st.used = Math.max(st.used, e.limit || st.limit);
      if (e.error === 'premium') { st.sending = false; st.access = false; toast(A.errorText(e), true); start(); return; }
    }
    st.sending = false;
    if (wrap.isConnected) chatScreen(true);
  }

  /* ===== Halaman 7-12: percakapan ===== */
  function bubbleUser(text, time, extra) {
    return h('div', { class: 'ai-u' + (extra ? ' ' + extra : '') }, h('p', { class: 'ai-u-t' }, text), time ? h('span', { class: 'ai-time' }, hm(time)) : '');
  }
  function answerCard(m, question) {
    const a = m.answer || { inti: m.content };
    const body = h('div', { class: 'ai-a-body' });
    body.append(h('p', { class: 'ai-a-inti' }, a.inti || ''));
    A.paragraphs(a.penjelasan).forEach(p => body.append(h('p', {}, p)));
    if (a.perbedaan_pendapat) body.append(h('div', { class: 'ai-a-khilaf' }, h('b', {}, 'Perbedaan pendapat ulama'), ...A.paragraphs(a.perbedaan_pendapat).map(p => h('p', {}, p))));
    const long = A.answerLength(a) > 900;
    const kids = [h('div', { class: 'ai-a-who' }, h('span', { class: 'ai-a-av', 'aria-hidden': 'true' }, ic('mosque')), h('b', {}, 'Asisten Islami BAITUNA'), h('span', { class: 'ai-tag' }, 'Asisten digital')), body];
    if (long) {
      body.classList.add('clip');
      const more = h('button', { class: 'ai-link ai-readmore', type: 'button', 'aria-expanded': 'false', onclick: () => { body.classList.remove('clip'); more.remove(); } }, 'Baca selengkapnya');
      kids.push(more);
    }
    // Dalil & rujukan: hanya yang terverifikasi / dari database
    const refs = [];
    (a.ayat || []).forEach(x => refs.push(h('li', { class: 'ai-ref ai-ref-q' },
      h('b', { class: 'ai-ref-t' }, A.ayahLabel(x)), x.untuk ? h('span', { class: 'muted ai-ref-u' }, x.untuk) : '',
      ...(x.teks || []).map(t => h('div', { class: 'ai-ayah' }, h('p', { class: 'ai-ar', lang: 'ar', dir: 'rtl' }, t.arab + ' ۝' + t.no), h('p', { class: 'ai-tr' }, t.no + '. ' + t.terjemah))))));
    (a.sumber || []).forEach(s => refs.push(h('li', { class: 'ai-ref' }, h('span', { class: 'ai-kind' }, A.kindLabel(s.kind)), h('b', { class: 'ai-ref-t' }, s.title),
      [s.author, s.edition, s.reference].filter(Boolean).length ? h('span', { class: 'muted ai-ref-u' }, [s.author, s.edition, s.reference].filter(Boolean).join(' · ')) : '',
      s.url ? h('a', { class: 'ai-link', href: s.url, target: '_blank', rel: 'noopener noreferrer' }, 'Buka sumber') : '')));
    const refBox = h('section', { class: 'ai-refs' }, h('h4', {}, 'Dalil dan Rujukan'));
    if (refs.length) {
      refBox.append(h('ol', { class: 'ai-refl' }, ...refs));
      if ((a.ayat || []).length) refBox.append(h('p', { class: 'hint ai-src-note' }, 'Teks dan terjemahan ayat diambil dari mushaf (AlQuran Cloud: quran-uthmani & id.indonesian), bukan ditulis asisten.'));
    } else refBox.append(h('p', { class: 'muted ai-noref' }, 'Belum ada rujukan terverifikasi untuk jawaban ini. Mohon periksa kembali kepada ustaz atau ulama yang Anda percaya.'));
    if (a.ayat_dibuang) refBox.append(h('p', { class: 'hint' }, 'Sebagian rujukan ayat tidak dapat diverifikasi sehingga tidak ditampilkan.'));
    kids.push(refBox);
    const notes = [];
    if (a.catatan) notes.push(...A.paragraphs(a.catatan).map(p => h('p', {}, p)));
    if (a.sumber_cukup === false) notes.push(h('p', {}, 'Sumber yang tersedia belum memadai untuk menjawab dengan yakin. Mohon pastikan kembali kepada ustaz atau ulama.'));
    if (a.perlu_ahli) notes.push(h('p', {}, 'Untuk perkara ini, sebaiknya tanyakan langsung kepada ulama, ahli fikih, atau tenaga profesional yang kompeten.'));
    if (notes.length) kids.push(h('section', { class: 'ai-note' }, h('h4', {}, 'Catatan Penting'), ...notes));
    const rel = (a.terkait || []).filter(r => r && r.id && r.title && (r.type === 'artikel' || r.type === 'buku'));
    if (rel.length && openRelated) kids.push(h('section', { class: 'ai-rel' }, h('h4', {}, 'Sumber Terkait'), h('p', { class: 'muted' }, 'Anda juga mungkin tertarik:'),
      ...rel.map(r => h('button', { class: 'ai-rel-i', type: 'button', onclick: () => openRelated(r.type, r.id) }, h('span', { class: 'ai-rel-ic' }, ic(r.type === 'buku' ? 'book' : 'news')),
        h('span', { class: 'ai-rel-tx' }, h('b', {}, r.title), h('span', { class: 'muted' }, r.type === 'buku' ? 'Buku · Pustaka BAITUNA' + (r.access === 'premium' ? ' (Premium)' : '') : 'Artikel' + (r.source ? ' · ' + r.source : ''))), ic(ICONS.chev, 'ai-rel-chev')))));
    kids.push(h('div', { class: 'ai-a-foot' },
      h('button', { class: 'ai-mini', type: 'button', 'data-act': 'share', onclick: () => shareAnswer(m, question) }, ic('share'), 'Bagikan'),
      h('button', { class: 'ai-mini', type: 'button', 'data-act': 'report', onclick: () => reportSheet(m) }, ic('flag'), 'Laporkan'),
      h('span', { class: 'ai-time' }, hm(m.created_at))));
    kids.push(h('p', { class: 'ai-a-disc' }, 'Dijawab oleh asisten digital (kecerdasan buatan). Bukan fatwa; periksa rujukannya.'));
    return h('article', { class: 'ai-a', 'data-id': m.id }, ...kids);
  }
  function chatScreen(scrollEnd) {
    st.view = 'chat';
    const title = st.conv ? st.conv.title : (st.newTitle || 'Percakapan baru');
    const cat = st.conv ? st.conv.category : (st.pending && st.pending.category);
    const list = h('div', { class: 'ai-thread', id: 'ai-thread', 'aria-live': 'polite' });
    const byId = {}; st.msgs.forEach(m => { byId[m.id] = m; });
    st.msgs.forEach(m => list.append(m.role === 'user' ? bubbleUser(m.content, m.created_at) : answerCard(m, m.reply_to && byId[m.reply_to] ? byId[m.reply_to].content : '')));
    if (!st.msgs.length && !st.pending) list.append(h('p', { class: 'muted ai-empty' }, 'Percakapan ini belum berisi jawaban. Silakan tulis pertanyaan.'));
    const p = st.pending;
    if (p) {
      list.append(bubbleUser(p.question, null, p.error ? 'err' : 'wait'));
      if (!p.error) list.append(h('div', { class: 'ai-wait', id: 'ai-wait', role: 'status' }, h('span', { class: 'ai-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), 'Sedang menyusun jawaban…'));
      else list.append(h('div', { class: 'ai-err', id: 'ai-err', role: 'alert' }, h('p', {}, A.errorText(p.error)),
        h('div', { class: 'ai-err-acts' },
          A.final(p.error) ? '' : btn('Coba lagi', 'btn-sm', 'ai-retry', () => submit(true)),
          btn('Ubah pertanyaan', 'btn-sm ghost', 'ai-edit', () => { st.q = p.question; st.pending = null; A.saveDraft({ q: st.q, cat: st.cat }); chatScreen(); const t = document.getElementById('ai-input'); if (t) t.focus(); }))));
    }
    const menuB = st.conv ? h('button', { class: 'ai-menu', type: 'button', id: 'ai-menu', 'aria-label': 'Opsi percakapan', onclick: optionsSheet }, ic('more')) : '';
    draw(h('div', { class: 'ai-chat-top' }, back('← Forum Tanya Jawab', () => { if (st.sending) return; homeScreen(); window.scrollTo(0, 0); }, 'ai-back'), menuB),
      h('div', { class: 'ai-chat-head' }, h('b', { class: 'ai-chat-t', id: 'ai-chat-title' }, title),
        h('span', { class: 'ai-chat-meta' }, h('span', { class: 'ai-prem sm' }, ic('star'), 'Premium'), cat ? h('span', { class: 'ai-chip ro' }, A.catLabel(cat)) : '', st.conv && st.conv.saved ? h('span', { class: 'ai-chip ro', id: 'ai-saved-chip' }, 'Tersimpan') : '')),
      list, left() <= 5 ? quota('ai-quota-chat') : '', composer('Tulis pertanyaan lanjutan…'));
    if (scrollEnd) setTimeout(() => { const el = document.getElementById(p ? (p.error ? 'ai-err' : 'ai-wait') : 'ai-composer'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, 30);
  }
  async function openConversation(c) {
    draw(h('p', { class: 'muted', id: 'ai-loading' }, 'Memuat percakapan…'));
    try { st.msgs = await A.loadMessages(c.id); }
    catch (e) { draw(back('← Riwayat', historyScreen), h('div', { class: 'empty' }, h('p', { class: 'muted' }, 'Percakapan belum bisa dimuat. Periksa koneksi, lalu coba lagi.'), btn('Coba lagi', 'btn-sm', 'ai-conv-retry', () => openConversation(c)))); return; }
    st.conv = { ...c }; st.pending = null; st.q = '';
    chatScreen(); window.scrollTo(0, document.body.scrollHeight);
  }

  /* ===== Lembar bawah (kategori, opsi, laporan) ===== */
  function sheet(title, id, ...kids) {
    const close = () => { ov.remove(); document.removeEventListener('keydown', esc); };
    const esc = e => { if (e.key === 'Escape') close(); };
    const x = h('button', { class: 'ai-sheet-x', type: 'button', 'aria-label': 'Tutup', 'data-overlay-back': '', onclick: close }, ic('x'));
    const ov = h('div', { class: 'ai-ov', id, role: 'dialog', 'aria-modal': 'true', 'aria-label': title, onclick: e => { if (e.target === ov) close(); } },
      h('div', { class: 'ai-sheet' }, h('div', { class: 'ai-sheet-h' }, h('b', {}, title), x), h('div', { class: 'ai-sheet-b' }, ...kids)));
    document.addEventListener('keydown', esc);
    document.body.append(ov); setTimeout(() => x.focus(), 0);
    return close;
  }
  function categorySheet() {
    let close;
    const row = c => { const on = st.cat === c.key; return h('button', { class: 'ai-srow' + (on ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': String(on), 'data-cat': c.key,
      onclick: () => { st.cat = c.key; A.saveDraft({ q: st.q, cat: st.cat }); close(); rerender(); } },
      h('span', { class: 'ai-cat-ic' }, ic(c.key)), h('span', { class: 'ai-srow-t' }, c.label, c.sub ? h('small', {}, ' ' + c.sub) : ''), h('span', { class: 'ai-radio' }, on ? ic('check') : '')); };
    close = sheet('Pilih Kategori', 'ai-catsheet', h('div', { role: 'radiogroup', 'aria-label': 'Kategori' }, ...A.CATEGORIES.map(row)),
      st.cat ? btn('Hapus pilihan kategori', 'btn-sm ghost ai-sheet-btn', 'ai-cat-clear', () => { st.cat = ''; A.saveDraft({ q: st.q, cat: '' }); close(); rerender(); }) : '');
  }
  const lastAnswer = () => { for (let i = st.msgs.length - 1; i >= 0; i--) if (st.msgs[i].role === 'assistant') return st.msgs[i]; return null; };
  const questionOf = m => { const q = st.msgs.find(x => x.id === m.reply_to); return q ? q.content : ''; };
  function optionsSheet() {
    let close;
    const row = (icn, text, id, fn, cls) => h('button', { class: 'ai-orow' + (cls ? ' ' + cls : ''), type: 'button', id, onclick: () => { close(); fn(); } }, ic(icn), h('span', {}, text));
    const la = lastAnswer();
    close = sheet('Opsi percakapan', 'ai-opts',
      row('bookmark', st.conv.saved ? 'Hapus dari simpanan' : 'Simpan percakapan', 'ai-o-save', toggleSave),
      la ? row('share', 'Bagikan jawaban', 'ai-o-share', () => shareAnswer(la, questionOf(la))) : '',
      la ? row('flag', 'Laporkan jawaban', 'ai-o-report', () => reportSheet(la)) : '',
      row('plus', 'Mulai percakapan baru', 'ai-o-new', () => { if (!st.sending) { homeScreen(); window.scrollTo(0, 0); } }),
      row('trash', 'Hapus percakapan', 'ai-o-del', () => removeConversation(st.conv, () => { homeScreen(); window.scrollTo(0, 0); }), 'bad'));
  }
  async function toggleSave() {
    const want = !st.conv.saved;
    try { await A.setSaved(st.conv.id, want); st.conv.saved = want; toast(want ? 'Percakapan disimpan di Riwayat.' : 'Dihapus dari simpanan.'); chatScreen(); }
    catch (e) { toast('Belum berhasil. Coba lagi.', true); }
  }
  async function removeConversation(c, after) {
    const ok = await confirmDlg({ title: 'Hapus percakapan?', text: 'Percakapan "' + c.title + '" beserta semua jawabannya akan dihapus permanen dari akun Anda.' });
    if (!ok) return;
    try { await A.deleteConversation(c.id); if (st.conv && st.conv.id === c.id) st.conv = null; toast('Percakapan dihapus.'); after(); }
    catch (e) { toast('Belum berhasil menghapus. Coba lagi.', true); }
  }
  async function shareAnswer(m, question) {
    const ok = await confirmDlg({ title: 'Bagikan jawaban?', text: 'Yang dibagikan hanya pertanyaan dan jawaban ini beserta rujukannya, tanpa nama atau akun Anda, dan tanpa riwayat percakapan lainnya.' });
    if (!ok) return;
    const text = A.shareText(m.answer || { inti: m.content }, question);
    try {
      if (navigator.share) { await navigator.share({ title: 'Forum Tanya Jawab', text }); return; }
      await navigator.clipboard.writeText(text); toast('Jawaban disalin. Tempel di aplikasi yang Anda inginkan.');
    } catch (e) { if (!e || e.name !== 'AbortError') toast('Tidak bisa membagikan dari perangkat ini.', true); }
  }
  function reportSheet(m) {
    let close, reason = '';
    const err = h('p', { class: 'ai-ferr', id: 'ai-rep-err', hidden: '' });
    const note = h('textarea', { class: 'in', id: 'ai-rep-note', rows: '3', maxlength: '500', placeholder: 'Catatan (opsional), mis. bagian yang keliru', 'aria-label': 'Catatan laporan' });
    const opts = A.REPORT_REASONS.map(([k, l]) => { const r = h('input', { type: 'radio', name: 'ai-rep', value: k, id: 'ai-rep-' + k }); r.addEventListener('change', () => { reason = k; }); return h('label', { class: 'ai-rrow', for: 'ai-rep-' + k }, r, h('span', {}, l)); });
    const send = h('button', { class: 'btn-primary ai-sheet-btn', type: 'button', id: 'ai-rep-send', onclick: async () => {
      if (!reason) { err.textContent = 'Pilih alasan laporan.'; err.hidden = false; return; }
      send.disabled = true;
      try { await A.report(m.id, reason, note.value.trim()); close(); toast('Terima kasih. Laporan Anda akan ditinjau pengelola BAITUNA.'); }
      catch (e) { send.disabled = false; err.textContent = e && e.message === 'tidak_ada' ? 'Jawaban ini tidak ditemukan.' : 'Laporan belum terkirim. Coba lagi.'; err.hidden = false; }
    } }, 'Kirim laporan');
    close = sheet('Laporkan jawaban', 'ai-report', h('p', { class: 'muted' }, 'Laporan membantu kami memperbaiki jawaban. Yang dikirim: jawaban ini, pertanyaannya, alasan, dan catatan Anda.'),
      h('div', { class: 'ai-rgroup', role: 'radiogroup', 'aria-label': 'Alasan' }, ...opts), note, err, send);
  }

  /* ===== Riwayat ===== */
  async function historyScreen() {
    st.view = 'history';
    draw(back('← Forum Tanya Jawab', () => { homeScreen(); window.scrollTo(0, 0); }), h('h2', { class: 'wtitle' }, 'Riwayat Percakapan'), h('p', { class: 'muted', id: 'ai-loading' }, 'Memuat…'));
    window.scrollTo(0, 0);
    let rows;
    try { rows = await A.listConversations(); }
    catch (e) { draw(back('← Forum Tanya Jawab', homeScreen), h('h2', { class: 'wtitle' }, 'Riwayat Percakapan'), h('div', { class: 'empty' }, h('p', { class: 'muted' }, 'Riwayat belum bisa dimuat.'), btn('Coba lagi', 'btn-sm', 'ai-hist-retry', historyScreen))); return; }
    let onlySaved = false;
    const box = h('div', { class: 'ai-hist', id: 'ai-hist' });
    const paint = () => {
      const list = rows.filter(r => !onlySaved || r.saved);
      if (!list.length) { box.replaceChildren(h('div', { class: 'empty' }, h('p', { class: 'muted' }, onlySaved ? 'Belum ada percakapan yang disimpan.' : 'Belum ada percakapan. Mulai dengan menulis pertanyaan pertama Anda.'))); return; }
      box.replaceChildren(...list.map(r => h('div', { class: 'ai-hrow', 'data-id': r.id },
        h('button', { class: 'ai-hopen', type: 'button', onclick: () => openConversation(r) }, h('b', {}, r.title),
          h('span', { class: 'muted' }, [r.category ? A.catLabel(r.category) : '', day(r.updated_at), r.saved ? 'Tersimpan' : ''].filter(Boolean).join(' · '))),
        h('button', { class: 'ai-hdel', type: 'button', 'aria-label': 'Hapus percakapan ' + r.title, onclick: () => removeConversation(r, () => { rows = rows.filter(x => x.id !== r.id); paint(); }) }, ic('trash')))));
    };
    const f = h('button', { class: 'btn-sm ghost', type: 'button', id: 'ai-hist-saved', 'aria-pressed': 'false', onclick: () => { onlySaved = !onlySaved; f.setAttribute('aria-pressed', String(onlySaved)); f.textContent = onlySaved ? 'Tampilkan semua' : 'Hanya yang disimpan'; paint(); } }, 'Hanya yang disimpan');
    draw(back('← Forum Tanya Jawab', () => { homeScreen(); window.scrollTo(0, 0); }), h('h2', { class: 'wtitle' }, 'Riwayat Percakapan'),
      h('p', { class: 'hint' }, 'Riwayat tersimpan di akun Anda dan hanya bisa dilihat oleh Anda. Hapus kapan saja; percakapan yang dihapus tidak bisa dikembalikan.'),
      h('div', { class: 'ai-acts' }, f, btn([ic('plus'), 'Pertanyaan baru'], 'btn-sm', 'ai-hist-new', () => { homeScreen(); window.scrollTo(0, 0); })), box);
    paint();
  }

  /* ===== Kelola (Super Admin): laporan & sumber rujukan ===== */
  async function adminScreen(tab) {
    st.view = 'admin';
    const seg = h('div', { class: 'seg', role: 'tablist', 'aria-label': 'Kelola forum' }, ...[['laporan', 'Laporan jawaban'], ['sumber', 'Sumber rujukan']].map(([k, l]) =>
      h('button', { class: 'segb', type: 'button', role: 'tab', id: 'ai-tab-' + k, 'aria-selected': String(tab === k), onclick: () => adminScreen(k) }, l)));
    const box = h('div', { id: 'ai-admin-box' }, h('p', { class: 'muted' }, 'Memuat…'));
    draw(back('← Forum Tanya Jawab', () => { homeScreen(); window.scrollTo(0, 0); }), h('h2', { class: 'wtitle' }, 'Kelola Forum Tanya Jawab'), seg, box);
    window.scrollTo(0, 0);
    if (tab === 'laporan') {
      let rows; try { rows = await A.reportList(null); } catch (e) { box.replaceChildren(h('p', { class: 'muted' }, 'Laporan belum bisa dimuat.')); return; }
      if (!rows.length) { box.replaceChildren(h('div', { class: 'empty' }, h('p', { class: 'muted' }, 'Belum ada laporan dari jamaah.'))); return; }
      box.replaceChildren(h('p', { class: 'hint' }, 'Hanya jawaban yang dilaporkan jamaah yang tampil di sini (percakapan lain tetap pribadi).'), ...rows.map(r => {
        const sel = h('select', { class: 'in ai-rsel', 'aria-label': 'Status laporan' }, ...A.REPORT_STATUS.map(([k, l]) => { const o = h('option', { value: k }, l); if (k === r.status) o.selected = true; return o; }));
        sel.addEventListener('change', async () => { try { await A.reportSet(r.id, sel.value); toast('Status laporan diperbarui.'); } catch (e) { toast('Belum berhasil.', true); } });
        return h('div', { class: 'panel ai-rep', 'data-id': r.id },
          h('b', {}, (A.REPORT_REASONS.find(x => x[0] === r.reason) || [0, r.reason])[1]), h('span', { class: 'muted' }, ' · ' + day(r.created_at) + (r.category ? ' · ' + A.catLabel(r.category) : '')),
          r.note ? h('p', {}, 'Catatan: ' + r.note) : '',
          h('details', {}, h('summary', {}, 'Lihat pertanyaan & jawaban'), h('p', { class: 'prewrap' }, 'Pertanyaan: ' + (r.question || '-')), h('p', { class: 'prewrap' }, 'Jawaban: ' + (r.answer || '-'))),
          h('label', { class: 'muted' }, 'Status ', sel));
      }));
      return;
    }
    let rows; try { rows = await A.listSources(); } catch (e) { box.replaceChildren(h('p', { class: 'muted' }, 'Sumber belum bisa dimuat.')); return; }
    const list = rows.map(s => h('button', { class: 'ai-srcrow', type: 'button', 'data-id': s.id, onclick: () => sourceForm(s) },
      h('b', {}, s.title), h('span', { class: 'muted' }, A.kindLabel(s.kind) + ' · ' + (A.SOURCE_STATUS.find(x => x[0] === s.status) || [0, s.status])[1] + (s.category ? ' · ' + A.catLabel(s.category) : ''))));
    box.replaceChildren(
      h('p', { class: 'hint' }, 'Asisten hanya boleh mengutip sumber berstatus Disetujui. Salin kutipan dari sumber aslinya, cantumkan penulis/lembaga, edisi, dan nomor rujukan, serta pastikan izin penggunaannya.'),
      btn([ic('plus'), 'Tambah sumber'], 'btn-sm', 'ai-src-add', () => sourceForm(null)),
      rows.length ? h('div', { class: 'ai-srclist' }, ...list) : h('div', { class: 'empty' }, h('p', { class: 'muted' }, 'Belum ada sumber rujukan. Selama kosong, asisten menjawab tanpa sumber kurasi dan wajib menyatakan keterbatasannya.')));
  }
  function sourceForm(s) {
    const v = s || {};
    const f = {};
    const field = (k, label, el) => { f[k] = el; el.id = 'ai-src-' + k; return h('label', { class: 'ai-field', for: el.id }, h('span', {}, label), el); };
    const inp = (k, ph, max) => { const e = h('input', { class: 'in', type: 'text', maxlength: String(max), placeholder: ph || '' }); e.value = v[k] || ''; return e; };
    const sel = (k, opts, blank) => { const e = h('select', { class: 'in' }, blank ? h('option', { value: '' }, blank) : '', ...opts.map(([a, b]) => h('option', { value: a }, b))); e.value = v[k] || (blank ? '' : opts[0][0]); return e; };
    const ex = h('textarea', { class: 'in', rows: '6', maxlength: '4000', placeholder: 'Salin kutipan dari sumber aslinya (20–4.000 huruf)' }); ex.value = v.excerpt || '';
    const err = h('p', { class: 'ai-ferr', id: 'ai-src-err', hidden: '' });
    const save = h('button', { class: 'btn-primary', type: 'button', id: 'ai-src-save', onclick: async () => {
      const r = A.validateSource(Object.fromEntries(Object.entries(f).map(([k, e]) => [k, e.value])));
      if (r.error) { err.textContent = r.error; err.hidden = false; if (f[r.field]) f[r.field].focus(); return; }
      save.disabled = true;
      try { await A.saveSource(v.id || null, r.ok); toast('Sumber disimpan.'); adminScreen('sumber'); }
      catch (e) { save.disabled = false; err.textContent = 'Belum berhasil menyimpan. ' + (e && e.status === 403 ? 'Anda tidak memiliki izin.' : 'Coba lagi.'); err.hidden = false; }
    } }, 'Simpan sumber');
    draw(back('← Sumber rujukan', () => adminScreen('sumber')), h('h2', { class: 'wtitle' }, s ? 'Ubah Sumber Rujukan' : 'Tambah Sumber Rujukan'),
      h('div', { class: 'panel ai-form' },
        field('title', 'Judul sumber *', inp('title', 'mis. Judul fatwa / nama kitab', 200)),
        field('kind', 'Jenis *', sel('kind', A.SOURCE_KINDS)),
        field('author', 'Penulis / lembaga', inp('author', '', 200)),
        field('edition', 'Edisi / penerbit / tahun', inp('edition', '', 200)),
        field('reference', 'Nomor rujukan (fatwa, hadis, halaman)', inp('reference', '', 200)),
        field('url', 'Tautan (https://, opsional)', inp('url', 'https://', 500)),
        field('excerpt', 'Kutipan *', ex),
        field('keywords', 'Kata kunci (pisahkan spasi)', inp('keywords', 'mis. zakat penghasilan profesi nisab', 500)),
        field('category', 'Kategori', sel('category', A.CATEGORIES.map(c => [c.key, A.catLabel(c.key)]), 'Semua kategori')),
        field('license_note', 'Catatan izin / lisensi', inp('license_note', '', 300)),
        field('status', 'Status', sel('status', A.SOURCE_STATUS)),
        s && s.reviewed_at ? h('p', { class: 'hint' }, 'Disetujui pada ' + day(s.reviewed_at) + '.') : '',
        err, save));
    window.scrollTo(0, 0);
  }

  start();
  return wrap;
}
