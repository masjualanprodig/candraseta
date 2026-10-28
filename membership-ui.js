// BAITUNA - membership-ui.js
// Alur jamaah (semua di dalam aplikasi): Pilih Paket -> Checkout (data) -> Pilih Metode -> Bayar (QRIS/Transfer) -> Terima Kasih +
// Unggah Bukti -> Bukti Terkirim -> Riwayat & Status -> (diverifikasi admin) -> Membership Aktif -> Detail Membership / Perpanjang.
// Digambar di dalam halaman Pustaka Buku. Harga, nomor transaksi, status, dan aktivasi ditentukan SERVER (membership_v2.sql);
// layar ini tidak pernah mengirim harga atau status. WhatsApp hanya untuk bantuan, bukan jalur pembayaran.
import { h, toast, ask } from './ui.js';
import { icon, ICONS } from './feed-ui.js';
import { prepareImage, PHOTO_ERRORS } from './photo.js';
import { searchMosques } from './public-service.js';
import { getMyProfile } from './profile-service.js';
import { getSession } from './supabase.js';
import * as M from './membership-service.js';

const NS = 'http://www.w3.org/2000/svg';
const ic = (paths, cls = 'ms-ic') => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', cls); s.setAttribute('aria-hidden', 'true'); s.innerHTML = paths; return s; };
const I = {
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5L3 8z"/><path d="M5 21h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  checkc: '<circle cx="12" cy="12" r="9.5"/><path d="M7.5 12.5l3 3 6-6.5"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3"/>',
  bank: '<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5.5-5.5L5 20"/>',
  docclock: '<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h5"/><path d="M14 3v5h5M14 3l5 5v3"/><circle cx="17" cy="17" r="4.5"/><path d="M17 15v2.2l1.5 1"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  info: '<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.5v.5"/>',
  mosque: '<path d="M12 3c2.5 2 4 3.5 4 5.5a4 4 0 01-8 0C8 6.5 9.5 5 12 3z"/><path d="M4 21V12h16v9M2 21h20M10 21v-4a2 2 0 014 0v4"/>',
  down: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
  x: '<circle cx="12" cy="12" r="9.5"/><path d="M9 9l6 6M15 9l-6 6"/>',
  clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3 2"/>'
};
const A = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== false)); // h() memasang atribut walau null
const tone = s => 'ms-st ms-' + ((M.STATUS[s] || {}).tone || 'off');
const row = (k, v, id) => h('div', { class: 'ms-row' }, h('span', { class: 'muted' }, k), h('b', id ? { id } : {}, v));
const SEEN_KEY = 'baituna.membership.seen';
const seenGet = () => { try { return localStorage.getItem(SEEN_KEY) || ''; } catch (e) { return ''; } };
const seenSet = id => { try { localStorage.setItem(SEEN_KEY, id); } catch (e) { /* abaikan */ } };

// ctx: { draw(...nodes), exit(), signIn(), start: 'auto' | 'mine' | 'plans', isAdmin, openAdmin(tab) }
export function membershipFlow(ctx) {
  const { draw } = ctx;
  // v203: produk 'taaruf' (BAITUNA Ta'aruf Premium) memakai alur yang sama dengan teks & paket sendiri.
  const P = ctx.product === 'taaruf' ? 'taaruf' : ctx.product === 'pasar' ? 'pasar' : 'baituna';
  // v209: 'pasar' = langganan Pasar Umat. Halaman pilih paket milik Pasar Umat sendiri (ctx.plans); alur ini mulai dari checkout.
  const W = P === 'pasar' ? { M: 'Langganan', m: 'langganan' } : { M: 'Membership', m: 'membership' };
  const toPlans = () => (ctx.plans ? ctx.plans() : plansScreen());
  const T = P === 'pasar' ? {
    title: 'Langganan Pasar Umat', sub: 'Pilih paket langganan Pasar Umat.', benefits: [], pnote: 'Langganan aktif setelah pembayaran diverifikasi admin.',
    item: 'Langganan Pasar Umat', plan: (m, o) => (o && o.plan_name) || ('Langganan ' + m + ' Bulan'), thanks: 'Terima Kasih Sudah Memesan Langganan Pasar Umat!', exitLabel: 'Kembali ke Pasar Umat',
    actBen: ['Pasang iklan sesuai kuota paket', 'Iklan tetap melalui pemeriksaan admin', 'Tanpa perpanjangan otomatis'], startLabel: 'Kembali ke Pasar Umat',
    wa: 'langganan Pasar Umat', soon: 'Perpanjang agar iklan berbayar tetap tayang.', ended: 'Langganan telah berakhir. Iklan berbayar tidak tayang (tidak dihapus) dan tayang lagi setelah diperpanjang.',
    none: 'Anda belum berlangganan Pasar Umat.', login: 'Untuk berlangganan Pasar Umat, silakan masuk atau daftar akun BAITUNA.', mineTitle: 'Langganan Saya', seen: 'baituna.pasar.seen'
  } : P === 'taaruf' ? {
    title: 'Ta’aruf Premium', sub: 'Pilih paket BAITUNA Ta’aruf Premium.', benefits: ctx.benefits || [], pnote: 'Premium aktif setelah pembayaran diverifikasi admin. Premium tidak menjamin diterima calon dan tidak membuka data pribadi tanpa izin.',
    item: 'BAITUNA Ta’aruf Premium', plan: m => 'Ta’aruf Premium ' + m + ' Bulan', thanks: 'Terima Kasih Sudah Memesan BAITUNA Ta’aruf Premium!', exitLabel: 'Kembali ke BAITUNA Ta’aruf',
    actBen: ['Lihat lebih banyak profil calon sesuai kriteria', 'Filter pencarian lengkap', 'Agenda, topik, dan catatan perkenalan', 'Tanpa perpanjangan otomatis'], startLabel: 'Kembali ke BAITUNA Ta’aruf',
    wa: 'BAITUNA Ta’aruf Premium', soon: 'Perpanjang bila ingin tetap memakai fitur Premium.', ended: 'Premium telah berakhir. Akses kembali mengikuti aturan gratis; proses perkenalan yang berjalan tetap ada.',
    none: 'Anda belum berlangganan Ta’aruf Premium. Fitur gratis tetap bisa dipakai.', login: 'Untuk bergabung dan membayar Ta’aruf Premium, silakan masuk atau daftar akun BAITUNA.', mineTitle: 'Ta’aruf Premium Saya', seen: 'baituna.taaruf.seen'
  } : {
    title: 'Membership Premium', sub: 'Pilih Paket Membership. Buka semua buku Premium di Pustaka Buku.', benefits: M.BENEFITS, pnote: 'Setelah membership aktif, Anda bisa langsung membaca semua buku Premium.',
    item: 'Membership BAITUNA', plan: m => 'Membership ' + m + ' Bulan', thanks: 'Terima Kasih Sudah Memesan Membership BAITUNA!', exitLabel: 'Kembali ke Pustaka Buku',
    actBen: ['Membaca semua buku Premium', 'Buku Gratis tetap bisa dibaca siapa saja', 'Tanpa perpanjangan otomatis', 'Masjid pilihan tetap tercatat'], startLabel: 'Mulai Jelajahi Buku',
    wa: 'Membership BAITUNA', soon: 'Perpanjang bila ingin tetap membaca buku Premium.', ended: 'Membership telah berakhir. Akses buku Premium berhenti; buku Gratis tetap bisa dibaca.',
    none: 'Anda belum punya membership. Buku Gratis tetap bisa dibaca.', login: 'Untuk bergabung dan membayar membership, silakan masuk atau daftar akun BAITUNA.', mineTitle: 'Membership Saya', seen: SEEN_KEY
  };
  const seenGetP = () => { try { return localStorage.getItem(T.seen) || ''; } catch (e) { return ''; } };
  const seenSetP = id => { try { localStorage.setItem(T.seen, id); } catch (e) { /* abaikan */ } };
  const S = { plans: [], planCode: '', mosque: null, noMosque: false, name: '', phone: '', email: '', member: null, orders: [], settings: null, accounts: null, method: '', profileDone: false };
  const back = (label, fn) => h('button', { class: 'btn-ghost bk-back', type: 'button', id: 'ms-back', onclick: fn }, label);
  const note = (t, cls) => h('p', { class: 'hint ' + (cls || '') }, t);
  const infoBox = (t, id) => h('div', A({ class: 'ms-note', id: id || null }), ic(I.info), h('span', {}, t));
  const loading = () => draw(h('p', { class: 'muted', id: 'ms-loading' }, 'Memuat…'));
  const failView = e => draw(back(ctx.backLabel || '← Pustaka', ctx.exit), h('div', { class: 'empty' }, h('p', { class: 'muted', id: 'ms-fail' }, M.notReady(e) ? M.errorText(e) : e && e.status === 0 ? 'Tidak ada koneksi internet. Periksa jaringan Anda.' : 'Belum bisa dimuat. Coba lagi.')),
    M.notReady(e) ? '' : h('button', { class: 'btn-sm', type: 'button', id: 'ms-retry', onclick: () => start() }, 'Coba lagi'));
  const adminBar = tab => ctx.isAdmin ? h('div', { class: 'panel ms-adminbar', id: 'ms-adminbar' }, h('b', {}, 'Super Admin'), h('span', { class: 'muted bk-sd' }, tab === 'plans' ? 'Ubah harga paket di sini.' : 'Atur rekening bank dan QRIS di sini.'),
    h('button', { class: 'btn-sm', type: 'button', id: 'ms-adminedit', onclick: () => ctx.openAdmin(tab === 'plans' ? 'plans' : 'atur') }, tab === 'plans' ? 'Ubah harga paket' : 'Atur rekening & QRIS')) : '';
  const plan = () => S.plans.find(p => p.code === S.planCode) || null;
  const steps = n => h('ol', { class: 'ms-steps', id: 'ms-steps', 'aria-label': 'Langkah' }, ...['Data', 'Pembayaran', 'Selesai'].map((t, i) =>
    h('li', A({ class: i + 1 < n ? 'done' : i + 1 === n ? 'on' : '', 'aria-current': i + 1 === n ? 'step' : null }), h('span', { class: 'ms-sn' }, i + 1 < n ? ic(I.check) : String(i + 1)), h('span', {}, t))));
  const copy = async (t, label) => { try { await navigator.clipboard.writeText(t); toast(label + ' disalin.'); } catch (e) { toast('Tidak bisa menyalin. Salin manual: ' + t, true); } };
  const copyBtn = (t, label, id) => h('button', A({ class: 'ms-copy', type: 'button', id: id || null, 'aria-label': 'Salin ' + label.toLowerCase(), onclick: () => copy(t, label) }), ic(I.copy), 'Salin');
  const refBox = o => h('div', { class: 'ms-ref' }, h('div', {}, h('span', { class: 'muted' }, 'Nomor Pesanan'), h('b', { id: 'ms-ref' }, o.ref_code)), copyBtn(o.ref_code, 'Nomor pesanan', 'ms-copy-ref'));
  const findOrder = id => S.orders.find(x => x.id === id);

  async function refresh() {
    const [plans, member, orders] = await Promise.all([M.listPlans(P), M.myMembership(P), M.myOrders(P)]);
    S.plans = plans; S.member = member; S.orders = orders;
  }
  async function loadPay() { if (!S.settings) S.settings = await M.settingsPublic(); if (!S.accounts) S.accounts = await M.listAccounts(); return M.methodsReady(S.settings, S.accounts); }

  /* ===== 1. Pilih paket ===== */
  function plansScreen() {
    const ok = S.plans.filter(p => p.active);
    if (!S.planCode || !ok.some(p => p.code === S.planCode && p.price)) { const best = ok.filter(p => p.price).sort((a, b) => b.months - a.months)[0]; S.planCode = best ? best.code : ''; }
    const cards = ok.map(p => {
      const avail = !!p.price, sv = M.savingPct(p, ok);
      const inp = h('input', { type: 'radio', name: 'ms-plan', value: p.code, id: 'ms-plan-' + p.code }); inp.checked = S.planCode === p.code; if (!avail) inp.disabled = true;
      inp.addEventListener('change', () => { S.planCode = p.code; paint(); });
      return h('label', { class: 'ms-plan' + (S.planCode === p.code ? ' on' : '') + (avail ? '' : ' off'), 'data-code': p.code }, inp,
        h('span', { class: 'ms-radio', 'aria-hidden': 'true' }),
        h('span', { class: 'ms-pn' }, h('b', {}, p.months + ' Bulan')),
        h('span', { class: 'ms-pr' }, sv ? h('span', { class: 'ms-save' }, 'Hemat ' + sv + '%') : '',
          avail ? h('span', { class: 'ms-pp' }, M.rp(p.price)) : h('span', { class: 'ms-pp muted' }, 'Belum tersedia'),
          avail ? h('small', { class: 'muted' }, p.months > 1 ? '(' + M.rp(Math.round(p.price / p.months)) + '/bulan)' : 'per bulan') : ''));
    });
    const go = h('button', { class: 'btn-primary ms-cta', type: 'button', id: 'ms-next', onclick: () => { if (plan() && plan().price) { toast('Paket ' + plan().months + ' bulan dipilih.'); checkoutScreen(); } } }, 'Lanjutkan ke Checkout');
    const open = M.openOrder(S.orders);
    const kids = [back(ctx.backLabel || '← Pustaka', ctx.exit), h('div', { class: 'ms-crownhead', 'aria-hidden': 'true' }, ic(I.crown, 'ms-crownic')), h('h2', { class: 'wtitle ms-ptitle' }, T.title),
      h('p', { class: 'muted ms-psub' }, T.sub), adminBar('plans')];
    const rej = !open && S.orders[0] && S.orders[0].status === 'ditolak' ? S.orders[0] : null;
    if (open) kids.push(h('div', { class: 'panel ms-open', id: 'ms-open' }, h('b', {}, 'Ada pesanan yang belum selesai'), h('p', { class: 'muted' }, open.ref_code + ' · ' + open.plan_name + ' · ' + M.statusLabel(open.status)),
      h('button', { class: 'btn-sm', type: 'button', id: 'ms-continue', onclick: () => route(open) }, 'Lihat pesanan')));
    if (rej) kids.push(h('div', { class: 'panel ms-rej', id: 'ms-open' }, h('b', {}, 'Bukti pembayaran ditolak'), h('p', { class: 'muted' }, rej.ref_code + ' · Alasan: ' + (rej.reject_reason || '-')),
      h('button', { class: 'btn-sm', type: 'button', id: 'ms-continue', onclick: () => statusScreen(rej) }, 'Lihat & kirim ulang bukti')));
    if (M.isActive(S.member)) kids.push(infoBox('Membership Anda aktif sampai ' + M.fmtDate(S.member.ends_at) + '. Paket baru ditambahkan setelah tanggal itu, sisa masa aktif tidak hilang.', 'ms-actnote'));
    kids.push(h('ul', { class: 'ms-ben' }, ...T.benefits.map(b => h('li', {}, ic(I.checkc, 'ms-ic ms-okc'), h('span', {}, b)))));
    kids.push(cards.length ? h('div', { class: 'ms-plans', id: 'ms-plans', role: 'radiogroup', 'aria-label': 'Paket' }, ...cards) : h('p', { class: 'muted', id: 'ms-noplan' }, 'Belum ada paket yang tersedia.'));
    kids.push(go, h('p', { class: 'hint ms-pnote', id: 'ms-pnote' }, T.pnote));
    if (S.orders.length) kids.push(h('button', { class: 'btn-sm ghost mt', type: 'button', id: 'ms-tomine', onclick: mineScreen }, 'Membership Saya & riwayat'));
    draw(...kids); paint();
    function paint() { const p = plan(); go.disabled = !(p && p.price) || !!open; for (const l of document.querySelectorAll('.ms-plan')) l.classList.toggle('on', l.getAttribute('data-code') === S.planCode); }
  }

  /* ===== 2. Checkout (data pemesan) ===== */
  async function checkoutScreen() {
    if (!S.profileDone) {
      try { const p = await getMyProfile(M.userId()); if (!S.name) S.name = p.full_name || ''; if (!S.phone) S.phone = p.phone || ''; } catch (e) { /* abaikan: isi manual */ }
      const se = getSession(); if (!S.email && se && se.user && se.user.email) S.email = se.user.email;
      S.profileDone = true;
    }
    const p = plan(); if (!p) { plansScreen(); return; }
    const field = (iconPath, input) => h('div', { class: 'ms-field' }, ic(iconPath), input);
    const name = h('input', { class: 'in', id: 'ms-name', maxlength: '120', autocomplete: 'name', placeholder: 'Masukkan nama lengkap' }); name.value = S.name;
    const phone = h('input', { class: 'in', id: 'ms-phone', type: 'tel', inputmode: 'tel', maxlength: '20', autocomplete: 'tel', placeholder: 'Contoh: 0812 3456 7890' }); phone.value = S.phone;
    const email = h('input', { class: 'in', id: 'ms-email', type: 'email', inputmode: 'email', maxlength: '120', autocomplete: 'email', placeholder: 'nama@email.com' }); email.value = S.email;
    const err = h('p', { class: 'mk-err', id: 'ms-err', role: 'alert' }, '');
    const mosqueBox = h('div', { id: 'ms-mosque' });
    const lab = (t, f, req) => h('label', { class: 'ms-lab', for: f }, t, req ? h('span', { class: 'ms-req' }, ' *') : '');
    const end = M.estimateEnd(p.months, S.member && S.member.ends_at);
    const btn = h('button', { class: 'btn-primary ms-cta', type: 'button', id: 'ms-pay' }, 'Lanjutkan ke Pembayaran');
    let results = [], q = '', timer = null, seq = 0;
    const search = h('input', { class: 'in', id: 'ms-msearch', type: 'search', maxlength: '60', placeholder: 'Cari masjid (nama atau kota)…', 'aria-label': 'Cari masjid' });
    const list = h('div', { class: 'ms-mlist', id: 'ms-mlist' });
    function drawMosque() {
      if (S.mosque) { mosqueBox.replaceChildren(h('div', { class: 'ms-msel', id: 'ms-msel' }, h('span', { class: 'ms-mname' }, ic(I.mosque), h('b', {}, S.mosque.name)), h('button', { class: 'btn-sm ghost', type: 'button', id: 'ms-mchange', onclick: () => { S.mosque = null; drawMosque(); } }, 'Ganti'))); return; }
      if (S.noMosque) { mosqueBox.replaceChildren(h('div', { class: 'ms-msel', id: 'ms-msel' }, h('span', {}, 'Belum memilih masjid'), h('button', { class: 'btn-sm ghost', type: 'button', id: 'ms-mchange', onclick: () => { S.noMosque = false; drawMosque(); } }, 'Pilih masjid'))); return; }
      mosqueBox.replaceChildren(search, h('button', { class: 'btn-sm ghost', type: 'button', id: 'ms-mnone', onclick: () => { S.noMosque = true; S.mosque = null; drawMosque(); } }, 'Belum memilih masjid'), list);
      paintList();
    }
    function paintList() {
      list.replaceChildren(...(results.length ? results.map(m => h('button', { class: 'ms-mi', type: 'button', 'data-id': m.id, onclick: () => { S.mosque = { id: m.id, name: m.name }; S.noMosque = false; drawMosque(); } },
        h('b', {}, m.name), h('span', { class: 'muted' }, [m.city, m.province].filter(Boolean).join(', '))))
        : [h('p', { class: 'hint', id: 'ms-mempty' }, q ? 'Masjid tidak ditemukan. Anda boleh memilih "Belum memilih masjid".' : 'Memuat daftar masjid…')]));
    }
    async function find() {
      const my = ++seq;
      try { const r = await searchMosques({ q, offset: 0 }); if (my === seq) { results = r; paintList(); } } catch (e) { if (my === seq) { results = []; list.replaceChildren(h('p', { class: 'hint' }, 'Daftar masjid belum bisa dimuat.')); } }
    }
    search.addEventListener('input', () => { q = search.value.trim(); clearTimeout(timer); timer = setTimeout(find, 300); });
    if (P !== 'pasar') { drawMosque(); if (!S.mosque && !S.noMosque) find(); }
    btn.addEventListener('click', () => {
      S.name = name.value; S.phone = phone.value; S.email = email.value;
      const v = M.validateData({ name: name.value, phone: phone.value });
      if (v.error) { err.textContent = v.error; (v.field === 'name' ? name : phone).focus(); return; }
      const ve = M.validEmail(email.value); if (ve.error) { err.textContent = ve.error; email.focus(); return; }
      if (P !== 'pasar' && !S.mosque && !S.noMosque) { err.textContent = 'Pilih masjid tujuan donasi Anda, atau pilih "Belum memilih masjid".'; return; }
      err.textContent = ''; S.valid = { name: v.ok.name, phone: v.ok.phone, email: ve.ok };
      methodScreen();
    });
    draw(back('← Pilih paket', toPlans), h('h2', { class: 'wtitle' }, 'Checkout ' + W.M), h('p', { class: 'muted' }, 'Isi data dan konfirmasi pesanan.'), steps(1),
      h('div', { class: 'panel rform ms-form', id: 'ms-form' }, h('h3', {}, 'Data Pemesan'),
        lab('Nama Lengkap', 'ms-name', true), field(I.user, name), lab('Nomor WhatsApp', 'ms-phone', true), field(I.phone, phone),
        lab('Email (opsional)', 'ms-email'), field(I.mail, email), ...(P === 'pasar' ? [infoBox('Nomor WhatsApp ini dipakai admin untuk konfirmasi pembayaran dan tidak ditampilkan ke pengguna lain.', 'ms-donnote')] : [lab('Masjid Tujuan Donasi', 'ms-msearch'), mosqueBox,
        infoBox('Sebagian dari biaya membership Anda akan didonasikan ke masjid yang Anda pilih di atas. Pilih masjid yang ingin Anda bantu. Nomor WhatsApp Anda tidak ditampilkan ke pengguna lain.', 'ms-donnote')])),
      h('div', { class: 'panel ms-sum', id: 'ms-sum' }, h('h3', {}, 'Ringkasan Pesanan'),
        h('div', { class: 'ms-item' }, h('span', { class: 'ms-crown' }, ic(I.crown)), h('span', { class: 'ms-it' }, h('b', {}, T.item), h('span', { class: 'muted' }, P === 'pasar' ? p.name : 'Paket ' + p.months + ' Bulan')), h('b', { class: 'ms-ip' }, M.rp(p.price))),
        P === 'pasar' ? row('Kuota iklan aktif', p.quota + ' iklan') : '', row('Periode', p.months + ' bulan'), row('Perkiraan berakhir', M.fmtDate(end) + ' (dihitung saat diverifikasi)'), row('Total Pembayaran', M.rp(p.price), 'ms-total')),
      err, btn);
  }

  /* ===== 3. Pilih metode pembayaran (pesanan dibuat di sini) ===== */
  async function methodScreen() {
    const p = plan(); if (!p || !S.valid) { plansScreen(); return; }
    loading();
    let ready; try { ready = await loadPay(); } catch (e) { failView(e); return; }
    if (!ready[S.method]) S.method = ready.qris ? 'qris' : ready.transfer ? 'transfer' : '';
    const err = h('p', { class: 'mk-err', id: 'ms-err', role: 'alert' }, '');
    const btn = h('button', { class: 'btn-primary ms-cta', type: 'button', id: 'ms-create' }, 'Lanjutkan Pembayaran');
    const opt = (k, title, desc, path) => {
      const inp = h('input', { type: 'radio', name: 'ms-method', value: k, id: 'ms-mt-' + k }); inp.checked = S.method === k; if (!ready[k]) inp.disabled = true;
      inp.addEventListener('change', () => { S.method = k; paint(); });
      return h('label', { class: 'ms-mcard' + (ready[k] ? '' : ' off'), 'data-m': k }, inp, h('span', { class: 'ms-radio', 'aria-hidden': 'true' }), h('span', { class: 'ms-mic' }, ic(path)),
        h('span', { class: 'ms-mt' }, h('b', {}, title), h('span', { class: 'muted' }, ready[k] ? desc : 'Belum dikonfigurasi admin')));
    };
    const box = h('div', { class: 'ms-methods', id: 'ms-methods', role: 'radiogroup', 'aria-label': 'Metode pembayaran' },
      opt('qris', 'QRIS', 'Bayar dengan semua aplikasi e-wallet dan mobile banking.', I.qr), opt('transfer', 'Transfer Bank', 'Transfer ke rekening resmi BAITUNA.', I.bank));
    // Rincian pembayaran langsung tampil setelah metode dipilih: QRIS (gambar) atau daftar rekening bank.
    const detail = h('div', { class: 'panel ms-paybox', id: 'ms-detail-pay' });
    async function saveQr0() {
      const qr = M.qrisUrl(S.settings);
      try { const r = await fetch(qr); const b = await r.blob(); const a = h('a', { href: URL.createObjectURL(b), download: 'QRIS-BAITUNA.' + (b.type === 'image/png' ? 'png' : 'jpg') }); document.body.append(a); a.click(); a.remove(); toast('QR Code disimpan.'); }
      catch (e) { window.open(qr, '_blank', 'noopener'); }
    }
    function drawDetail() {
      if (S.method === 'qris') {
        const qr = M.qrisUrl(S.settings);
        detail.replaceChildren(h('h3', {}, 'Scan QRIS untuk membayar'), h('div', { class: 'ms-qris' }, h('img', { class: 'ms-qimg', id: 'ms-qimg', src: qr, alt: 'QRIS resmi BAITUNA' }), S.settings.qris_merchant ? h('b', {}, S.settings.qris_merchant) : '',
          h('span', { class: 'muted' }, 'Bayar tepat ' + M.rp(p.price)), h('button', { class: 'btn-sm ghost ms-saveqr', type: 'button', id: 'ms-saveqr', onclick: saveQr0 }, ic(I.down), 'Simpan QR Code')));
        detail.hidden = false;
      } else if (S.method === 'transfer') {
        const accs = (S.accounts || []).filter(a => a.active !== false);
        detail.replaceChildren(h('h3', {}, 'Transfer ke salah satu rekening'), ...accs.map(a => h('div', { class: 'ms-acc', 'data-id': a.id }, h('div', {}, h('b', {}, a.bank), h('div', { class: 'ms-num' }, a.number), h('span', { class: 'muted' }, 'a.n. ' + a.holder)), copyBtn(a.number.replace(/\D/g, ''), 'Nomor rekening'))),
          h('p', { class: 'muted' }, 'Transfer tepat ' + M.rp(p.price) + '.'));
        detail.hidden = false;
      } else { detail.replaceChildren(); detail.hidden = true; }
    }
    function paint() { btn.disabled = !S.method; for (const l of box.querySelectorAll('.ms-mcard')) l.classList.toggle('on', l.getAttribute('data-m') === S.method); drawDetail(); }
    btn.addEventListener('click', async () => {
      if (!S.method || btn.disabled) return;
      btn.disabled = true; btn.textContent = 'Membuat pesanan…'; err.textContent = '';
      try {
        const id = await M.createOrder({ plan: p.code, name: S.valid.name, phone: S.valid.phone, email: S.valid.email, mosque: S.mosque ? S.mosque.id : null, method: S.method }, P);
        M.pingNotify();
        S.orders = await M.myOrders(P); const o = findOrder(id) || M.openOrder(S.orders);
        toast('Pesanan berhasil dibuat.'); thanksScreen(o);
      } catch (e) {
        if (e && e.message === 'order_terbuka') {
          try { S.orders = await M.myOrders(P); } catch (x) { /* abaikan */ } const o = M.openOrder(S.orders); if (o) { toast('Anda masih punya pesanan yang belum selesai. Ditampilkan.'); route(o); return; }
          let other = null; try { other = M.openOrder(await M.myOrders('all')); } catch (x) { /* abaikan */ }
          if (other) { const op = M.productOf(other); err.textContent = 'Anda masih punya pesanan ' + (op === 'taaruf' ? 'BAITUNA Ta’aruf Premium' : op === 'pasar' ? 'Langganan Pasar Umat' : 'Membership BAITUNA') + ' (' + other.ref_code + ') yang belum selesai. Selesaikan atau batalkan dulu dari halaman ' + (op === 'taaruf' ? 'BAITUNA Ta’aruf' : op === 'pasar' ? 'Pasar Umat' : 'Pustaka Buku') + '.'; btn.disabled = false; btn.textContent = 'Lanjutkan Pembayaran'; return; }
        }
        err.textContent = 'Gagal membuat transaksi. ' + M.errorText(e); btn.disabled = false; btn.textContent = 'Lanjutkan Pembayaran';
        if (e && e.message === 'metode_belum') { S.settings = null; S.accounts = null; }
      }
    });
    draw(back('← Data pemesan', checkoutScreen), h('h2', { class: 'wtitle' }, 'Pilih Metode Pembayaran'), h('p', { class: 'muted' }, 'Pilih QRIS atau Transfer Bank.'), steps(2),
      h('div', { class: 'panel ms-totbox', id: 'ms-totbox' }, h('span', { class: 'muted' }, 'Total Pembayaran'), h('b', { class: 'ms-big', id: 'ms-amount' }, M.rp(p.price)), h('span', { class: 'muted' }, P === 'pasar' ? p.name : 'Paket ' + p.months + ' Bulan')),
      adminBar('pay'), h('h3', {}, 'Pilih Metode Pembayaran'), box, detail,
      !ready.qris && !ready.transfer ? h('div', { class: 'ms-note ms-bad-note', id: 'ms-nomethod', role: 'alert' }, ic(I.info), h('span', {}, 'Metode pembayaran belum dikonfigurasi. Pesanan belum bisa dibuat; silakan coba lagi nanti.')) : '',
      infoBox('Lakukan pembayaran sesuai metode di atas, lalu tekan Lanjutkan Pembayaran. Anda akan diarahkan ke halaman terima kasih untuk mengunggah bukti pembayaran. ' + W.M + ' aktif setelah pembayaran diverifikasi oleh admin.'),
      err, btn);
    paint();
  }

  /* ===== 4. Instruksi bayar (QRIS / Transfer) ===== */
  async function payScreen(o) {
    if (!o) { plansScreen(); return; }
    loading();
    let ready; try { ready = await loadPay(); } catch (e) { failView(e); return; }
    try { S.orders = await M.myOrders(P); o = findOrder(o.id) || o; } catch (e) { /* pakai data yang ada */ }   // status terbaru dari server, bukan salinan lama
    let m = o.method && ready[o.method] ? o.method : ready.qris ? 'qris' : ready.transfer ? 'transfer' : '';
    const qr = M.qrisUrl(S.settings), body = h('div', { id: 'ms-method-body' });
    const tabs = h('div', { class: 'ms-tabs', id: 'ms-seg', role: 'tablist', 'aria-label': 'Metode pembayaran' }, ...[['qris', 'QRIS'], ['transfer', 'Transfer Bank']].map(([k, l]) => {
      const b = h('button', { class: 'ms-tab', type: 'button', role: 'tab', id: 'ms-m-' + k, 'aria-selected': String(m === k), onclick: () => pick(k) }, l); if (!ready[k]) b.disabled = true; return b; }));
    async function pick(k) {
      if (k === m || !ready[k]) return;
      try { await M.setMethod(o.id, k); o.method = k; m = k; drawBody(); for (const b of tabs.children) b.setAttribute('aria-selected', String(b.id === 'ms-m-' + m)); }
      catch (e) { toast('Gagal mengganti metode. ' + M.errorText(e), true); }
    }
    const howTo = list => h('div', { class: 'ms-how' }, h('h3', {}, 'Cara pembayaran:'), h('ol', {}, ...list.map(t => h('li', {}, t))));
    async function saveQr() {
      try { const r = await fetch(qr); const b = await r.blob(); const a = h('a', { href: URL.createObjectURL(b), download: 'QRIS-BAITUNA-' + o.ref_code + '.' + (b.type === 'image/png' ? 'png' : 'jpg') }); document.body.append(a); a.click(); a.remove(); toast('QR Code disimpan.'); }
      catch (e) { window.open(qr, '_blank', 'noopener'); }
    }
    function drawBody() {
      if (m === 'qris') {
        body.replaceChildren(h('div', { class: 'ms-qris' }, h('img', { class: 'ms-qimg', id: 'ms-qimg', src: qr, alt: 'QRIS resmi BAITUNA' }), S.settings.qris_merchant ? h('b', {}, S.settings.qris_merchant) : '',
          h('span', { class: 'muted' }, 'Scan QRIS untuk membayar'), h('button', { class: 'btn-sm ghost ms-saveqr', type: 'button', id: 'ms-saveqr', onclick: saveQr }, ic(I.down), 'Simpan QR Code')),
          howTo(['Buka aplikasi mobile banking atau e-wallet.', 'Scan QR Code di atas.', 'Lakukan pembayaran sebesar ' + M.rp(o.amount) + ' (masukkan nominal tepat bila diminta).', 'Simpan bukti pembayaran, lalu unggah di langkah berikutnya.']));
      } else if (m === 'transfer') {
        body.replaceChildren(...S.accounts.filter(a => a.active !== false).map(a => h('div', { class: 'ms-acc', 'data-id': a.id }, h('div', {}, h('b', {}, a.bank), h('div', { class: 'ms-num' }, a.number), h('span', { class: 'muted' }, 'a.n. ' + a.holder)),
          copyBtn(a.number.replace(/\D/g, ''), 'Nomor rekening'))),
          howTo(['Transfer tepat ' + M.rp(o.amount) + ' ke salah satu rekening di atas.', 'Cantumkan nomor pesanan ' + o.ref_code + ' pada berita transfer bila memungkinkan.', 'Simpan bukti transfer, lalu unggah di langkah berikutnya.']));
      } else body.replaceChildren(h('div', { class: 'ms-note ms-bad-note', id: 'ms-nomethod', role: 'alert' }, ic(I.info), h('span', {}, 'Metode pembayaran belum dikonfigurasi admin. Silakan coba lagi nanti.')));
    }
    drawBody();
    const rej = o.status === 'ditolak';
    const cancel = o.status === 'menunggu_pembayaran' ? h('button', { class: 'btn-sm alt', type: 'button', id: 'ms-cancel', onclick: async () => {
      if (!(await ask({ title: 'Batalkan pesanan ini?', text: 'Pesanan ' + o.ref_code + ' dibatalkan. Anda bisa memesan lagi kapan saja.' }))) return;
      try { await M.cancelOrder(o.id); M.pingNotify(); S.orders = await M.myOrders(P); toast('Pesanan dibatalkan.'); toPlans(); }
      catch (e) {
        if (e && e.message === 'tidak_bisa') { try { S.orders = await M.myOrders(P); } catch (x) { /* abaikan */ } toast('Status pesanan sudah berubah. Menampilkan status terbaru.'); statusScreen(findOrder(o.id) || o); return; }
        toast('Gagal memperbarui status. ' + M.errorText(e), true);
      }
    } }, 'Batalkan pesanan') : '';
    const wa = M.adminWaLink(S.settings.admin_wa, 'Assalamu’alaikum, saya butuh bantuan untuk pesanan ' + W.m + ' ' + o.ref_code + '.');
    draw(back(ctx.backLabel || '← Pustaka', ctx.exit), h('h2', { class: 'wtitle' }, 'Pembayaran'), h('p', { class: 'muted' }, 'Bayar dengan QRIS atau Transfer Bank.'), steps(2),
      rej ? h('div', { class: 'panel ms-rej', id: 'ms-rej' }, h('b', {}, 'Bukti pembayaran ditolak'), h('p', {}, 'Alasan: ' + (o.reject_reason || '-')), h('p', { class: 'hint' }, 'Periksa pembayaran Anda, lalu kirim ulang bukti yang benar.')) : '',
      tabs, h('div', { class: 'panel ms-paybox' }, refBox(o), h('div', { class: 'ms-totline' }, h('span', { class: 'muted' }, 'Total Pembayaran'), h('b', { class: 'ms-big', id: 'ms-amount' }, M.rp(o.amount)), h('span', { class: 'muted' }, o.plan_name)), body),
      o.status === 'menunggu_pembayaran' ? h('div', { class: 'ms-note ms-deadline', id: 'ms-deadline' }, ic(I.clock), h('span', {}, 'Selesaikan pembayaran sebelum ' + M.fmtDateTime(o.expires_at) + '. Setelah itu pesanan kedaluwarsa otomatis.')) : '',
      S.settings.pay_note ? note(S.settings.pay_note, 'ms-info') : '', adminBar('pay'),
      h('button', { class: 'btn-primary ms-cta', type: 'button', id: 'ms-paid', onclick: () => thanksScreen(o) }, rej ? 'Kirim Ulang Bukti Pembayaran' : 'Saya Sudah Bayar, Unggah Bukti'),
      h('div', { class: 'row-btns mt' }, cancel, h('button', { class: 'btn-sm ghost', type: 'button', id: 'ms-detail', onclick: () => statusScreen(o) }, 'Lihat Detail Transaksi'),
        wa ? h('a', { class: 'btn-sm ghost', id: 'ms-wa', href: wa, target: '_blank', rel: 'noopener noreferrer' }, 'Butuh bantuan?') : ''));
  }

  /* ===== 5. Terima kasih + unggah bukti ===== */
  function thanksScreen(o) {
    const rej = o.status === 'ditolak';
    const file = h('input', { type: 'file', id: 'ms-file', accept: 'image/jpeg,image/png,image/webp', 'aria-label': 'Bukti pembayaran', hidden: true });
    const drop = h('label', { class: 'ms-drop', for: 'ms-file', id: 'ms-drop' }, ic(I.image, 'ms-ic ms-dropic'), h('b', {}, 'Pilih gambar atau seret ke sini'), h('span', { class: 'muted' }, 'Format: JPG, PNG, WebP (maks. 5 MB)'));
    const prev = h('div', { id: 'ms-prev' }), err = h('p', { class: 'mk-err', id: 'ms-err', role: 'alert' }, ''), prog = h('p', { class: 'muted', id: 'ms-prog', role: 'status' }, '');
    const label = rej ? 'Kirim Ulang Bukti' : 'Kirim Bukti Pembayaran';
    const send = h('button', { class: 'btn-primary ms-cta', type: 'button', id: 'ms-send' }, ic(I.upload), label); send.disabled = true;
    let pu = null, chosen = null;
    const take = f => {
      const bad = M.checkProofFile(f); if (pu) URL.revokeObjectURL(pu); pu = null; chosen = null;
      if (bad) { err.textContent = bad; prev.replaceChildren(); send.disabled = true; return; }
      chosen = f; pu = URL.createObjectURL(f); err.textContent = '';
      prev.replaceChildren(h('div', { class: 'ms-pvbox' }, h('img', { class: 'ms-pv', src: pu, alt: 'Pratinjau bukti' }), h('span', { class: 'muted' }, f.name + ' · ' + (f.size / 1024 / 1024).toFixed(2) + ' MB'),
        h('button', { class: 'btn-sm ghost', type: 'button', id: 'ms-repick', onclick: () => file.click() }, 'Ganti gambar')));
      send.disabled = false;
    };
    file.addEventListener('change', () => take(file.files && file.files[0]));
    ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('on'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('on'); }));
    drop.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) take(f); });
    send.addEventListener('click', async () => {
      if (!chosen || send.disabled) return;
      send.disabled = true; err.textContent = ''; prog.textContent = 'Menyiapkan gambar…';
      try {
        const img = await prepareImage(chosen); const path = M.newProofPath();
        prog.textContent = 'Mengunggah bukti…'; await M.uploadProof(path, img.blob);
        prog.textContent = 'Menyimpan…'; await M.attachProof(o.id, path, o.method || (S.settings && S.settings.qris_path ? 'qris' : 'transfer'));
        M.pingNotify();
        S.orders = await M.myOrders(P); toast('Bukti pembayaran berhasil dikirim.');
        sentScreen(findOrder(o.id) || { ...o, status: 'menunggu_verifikasi', proof_at: new Date().toISOString() });
      } catch (e) {
        prog.textContent = '';
        err.textContent = 'Gagal mengunggah bukti. ' + (e && e.code && PHOTO_ERRORS[e.code] ? PHOTO_ERRORS[e.code] : M.errorText(e));
        send.disabled = false;
      }
    });
    draw(back('← Pembayaran', () => payScreen(o)), steps(3),
      h('div', { class: 'ms-hero', id: 'ms-thanks' }, h('span', { class: 'ms-heroic ms-okbg' }, ic(I.check)),
        h('h2', { class: 'wtitle' }, rej ? 'Kirim Ulang Bukti Pembayaran' : T.thanks),
        h('p', { class: 'muted', id: 'ms-thanks-msg' }, rej ? 'Bukti sebelumnya ditolak: ' + (o.reject_reason || '-') + '. Silakan unggah bukti yang benar.' : 'Pesanan ' + W.m + ' Anda berhasil dibuat. Setelah membayar, unggah bukti pembayaran di bawah ini. ' + W.M + ' akan aktif setelah pembayaran diverifikasi oleh admin BAITUNA.')),
      h('div', { class: 'panel ms-sum', id: 'ms-sum' }, refBox(o), row('Tanggal Transaksi', M.fmtDateTime(o.created_at)), row('Paket', T.plan(o.months, o)), row('Periode', o.months + ' bulan'),
        row('Total Pembayaran', M.rp(o.amount), 'ms-total'), row('Metode Pembayaran', M.methodLabel(o.method)), h('div', { class: 'ms-row' }, h('span', { class: 'muted' }, 'Status Pembayaran'), h('span', { class: tone(o.status), id: 'ms-stat' }, M.statusLabel(o.status)))),
      h('h3', {}, 'Upload Bukti Pembayaran ', h('span', { class: 'ms-req' }, '*')), file, drop, prev, err, prog, send,
      h('div', { class: 'row-btns mt' }, h('button', { class: 'btn-sm ghost', type: 'button', id: 'ms-repay', onclick: () => payScreen(o) }, 'Lihat cara pembayaran'), h('button', { class: 'btn-sm ghost', type: 'button', id: 'ms-detail', onclick: () => statusScreen(o) }, 'Lihat Detail Transaksi'),
        h('button', { class: 'btn-sm ghost', type: 'button', id: 'ms-tolib', onclick: ctx.exit }, T.exitLabel)));
  }

  /* ===== 6. Bukti terkirim ===== */
  function sentScreen(o) {
    draw(back(ctx.backLabel || '← Pustaka', ctx.exit),
      h('div', { class: 'ms-hero', id: 'ms-sent' }, h('span', { class: 'ms-heroic ms-goldbg' }, ic(I.docclock)), h('h2', { class: 'wtitle' }, 'Bukti Pembayaran Terkirim'),
        h('p', { class: 'muted', id: 'ms-sent-msg' }, 'Bukti pembayaran berhasil dikirim. Tim BAITUNA sedang memeriksa pembayaran Anda. ' + W.M + ' aktif setelah pembayaran diverifikasi.')),
      h('div', { class: 'panel ms-sum' }, row('Nomor Pesanan', o.ref_code), row('Total Pembayaran', M.rp(o.amount)), row('Waktu Kirim', M.fmtDateTime(o.proof_at || new Date())),
        h('div', { class: 'ms-row' }, h('span', { class: 'muted' }, 'Status'), h('span', { class: tone('menunggu_verifikasi'), id: 'ms-stat' }, 'Menunggu Verifikasi'))),
      h('button', { class: 'btn-primary ms-cta', type: 'button', id: 'ms-detail', onclick: () => statusScreen(o) }, 'Lihat Detail Pesanan'),
      h('button', { class: 'btn-sm ghost ms-cta2', type: 'button', id: 'ms-tolib', onclick: ctx.exit }, T.exitLabel));
  }

  /* ===== 7. Riwayat & status satu transaksi (timeline) ===== */
  async function statusScreen(o0) {
    loading();
    let proofs = [];
    try { await refresh(); proofs = await M.myProofs(o0.id); } catch (e) { if (!M.notReady(e)) { failView(e); return; } }
    const o = findOrder(o0.id) || o0, st = o.status, now = new Date();
    const step = (state, title, when, extra) => h('li', { class: 'ms-tl-' + state }, h('span', { class: 'ms-dot' }, state === 'done' ? ic(I.check) : state === 'bad' ? ic(I.x) : ''), h('div', {}, h('b', {}, title), when ? h('span', { class: 'muted' }, when) : '', extra || ''));
    const T = [step('done', 'Pesanan dibuat', M.fmtDateTime(o.created_at))];
    if (st === 'dibatalkan') T.push(step('bad', 'Pesanan dibatalkan', M.fmtDateTime(o.updated_at || o.created_at)));
    else if (st === 'kedaluwarsa') T.push(step('bad', 'Pesanan kedaluwarsa', 'Belum dibayar sampai ' + M.fmtDateTime(o.expires_at)));
    else {
      T.push(step(o.proof_at ? 'done' : 'now', o.proof_at ? 'Bukti pembayaran terkirim' : 'Menunggu pembayaran', o.proof_at ? M.fmtDateTime(o.proof_at) : 'Bayar lalu unggah bukti sebelum ' + M.fmtDateTime(o.expires_at)));
      if (st === 'ditolak') T.push(step('bad', 'Bukti ditolak', M.fmtDateTime(o.reviewed_at), h('span', { class: 'ms-warn' }, 'Alasan: ' + (o.reject_reason || '-'))));
      else T.push(step(st === 'disetujui' ? 'done' : st === 'menunggu_verifikasi' ? 'now' : 'todo', st === 'disetujui' ? 'Pembayaran terverifikasi' : 'Menunggu verifikasi admin', st === 'disetujui' ? M.fmtDateTime(o.reviewed_at) : st === 'menunggu_verifikasi' ? 'Admin sedang memeriksa bukti pembayaran Anda.' : ''));
      T.push(step(st === 'disetujui' && new Date(o.starts_at) <= now ? 'done' : 'todo', W.M + ' aktif', st === 'disetujui' ? M.fmtDate(o.starts_at) : ''));
      T.push(step(st === 'disetujui' && new Date(o.ends_at) <= now ? 'done' : 'todo', 'Berakhir', st === 'disetujui' ? M.fmtDate(o.ends_at) : ''));
    }
    const end = st === 'disetujui' ? M.fmtDate(o.ends_at) : M.fmtDate(M.estimateEnd(o.months, S.member && S.member.ends_at));
    const acts = [];
    if (st === 'menunggu_pembayaran') acts.push(h('button', { class: 'btn-primary ms-cta', type: 'button', id: 'ms-gopay', onclick: () => payScreen(o) }, 'Lanjutkan Pembayaran'), h('button', { class: 'btn-sm ghost ms-cta2', type: 'button', id: 'ms-goup', onclick: () => thanksScreen(o) }, 'Upload Bukti Pembayaran'));
    if (st === 'ditolak') acts.push(h('button', { class: 'btn-primary ms-cta', type: 'button', id: 'ms-reup', onclick: () => thanksScreen(o) }, 'Kirim Ulang Bukti'));
    if (st === 'disetujui') acts.push(h('button', { class: 'btn-primary ms-cta', type: 'button', id: 'ms-tomember', onclick: mineScreen }, 'Lihat Detail ' + W.M));
    if (st === 'kedaluwarsa' || st === 'dibatalkan') acts.push(h('button', { class: 'btn-primary ms-cta', type: 'button', id: 'ms-again', onclick: () => { S.planCode = o.plan_code || S.planCode; toPlans(); } }, 'Pesan Lagi'));
    draw(back('← ' + (P === 'pasar' ? 'Langganan Saya' : 'Membership Saya'), mineScreen), h('h2', { class: 'wtitle' }, 'Riwayat & Status ' + W.M), h('p', { class: 'muted' }, 'Pantau status pesanan dan masa aktif.'),
      h('div', { class: 'panel ms-stcard', id: 'ms-state', 'data-status': st }, h('span', { class: 'ms-crown ms-crown-lg' }, ic(I.crown)),
        h('div', {}, h('span', { class: tone(st), id: 'ms-stat' }, M.statusLabel(st)), h('b', { class: 'ms-stp' }, P === 'pasar' ? o.plan_name : 'Paket ' + o.months + ' Bulan'), h('span', {}, M.rp(o.amount)),
          st === 'kedaluwarsa' || st === 'dibatalkan' ? '' : h('span', { class: 'muted' }, 'Berlaku hingga ' + end + (st === 'disetujui' ? '' : ' (akan aktif setelah verifikasi)')))),
      h('div', { class: 'panel' }, refBox(o), row('Metode', M.methodLabel(o.method)), P === 'pasar' ? '' : row('Masjid rujukan', o.mosque_name || 'Belum dipilih')),
      h('ol', { class: 'ms-tl', id: 'ms-tl' }, ...T),
      proofs.length ? h('div', { class: 'panel', id: 'ms-proofs' }, h('h3', {}, 'Riwayat bukti pembayaran'), ...proofs.map(p => h('div', { class: 'ms-row' }, h('span', { class: 'muted' }, M.fmtDateTime(p.uploaded_at) + ' · ' + M.methodLabel(p.method)),
        h('b', {}, (M.PROOF_STATUS[p.status] || p.status) + (p.reject_reason ? ' — ' + p.reject_reason : ''))))) : '',
      ...acts);
  }

  /* ===== 8. Baru aktif ===== */
  function activatedScreen(o) {
    seenSetP(o.id);
    draw(back(ctx.backLabel || '← Pustaka', ctx.exit),
      h('div', { class: 'ms-hero', id: 'ms-activated' }, h('span', { class: 'ms-heroic ms-okbg' }, ic(I.check)), h('h2', { class: 'wtitle' }, 'Alhamdulillah!'), h('p', { class: 'muted' }, W.M + ' Anda telah aktif. Pembayaran sudah diverifikasi admin.')),
      h('div', { class: 'panel ms-sum' }, row('Paket', T.plan(o.months, o)), row('Mulai aktif', M.fmtDate(S.member ? S.member.started_at : o.starts_at)), row('Berlaku hingga', M.fmtDate(S.member ? S.member.ends_at : o.ends_at), 'ms-until')),
      h('ul', { class: 'ms-ben' }, ...T.actBen.map(b => h('li', {}, ic(I.checkc, 'ms-ic ms-okc'), h('span', {}, b)))),
      h('button', { class: 'btn-primary ms-cta', type: 'button', id: 'ms-read', onclick: ctx.exit }, T.startLabel),
      h('button', { class: 'btn-sm ghost ms-cta2', type: 'button', id: 'ms-tomine', onclick: mineScreen }, 'Lihat Riwayat ' + W.M));
  }

  /* ===== 9. Membership Saya: detail + riwayat transaksi ===== */
  async function mineScreen() {
    loading();
    try { await refresh(); S.settings = S.settings || await M.settingsPublic(); } catch (e) { failView(e); return; }
    const m = S.member, act = M.isActive(m), open = M.openOrder(S.orders), last = S.orders.find(x => x.status === 'disetujui'), left = M.daysLeft(m);
    const wa = M.adminWaLink(S.settings.admin_wa, 'Assalamu’alaikum, saya butuh bantuan terkait ' + T.wa + '.');
    const hist = S.orders.map(o => h('button', { class: 'panel ms-ord', type: 'button', 'data-id': o.id, 'data-status': o.status, onclick: () => statusScreen(o) },
      h('div', { class: 'ms-oh' }, h('b', {}, o.plan_name), h('span', { class: tone(o.status) }, M.statusLabel(o.status))),
      h('span', { class: 'muted' }, o.ref_code + ' · ' + M.rp(o.amount) + ' · ' + M.fmtDate(o.created_at)),
      o.status === 'disetujui' ? h('span', { class: 'muted' }, 'Masa aktif ' + M.fmtDate(o.starts_at) + ' – ' + M.fmtDate(o.ends_at)) : '',
      o.status === 'ditolak' && o.reject_reason ? h('span', { class: 'ms-warn' }, 'Ditolak: ' + o.reject_reason) : ''));
    const head = act ? W.M + ' Aktif' : m ? W.M + ' Berakhir' : 'Belum Berlangganan';
    const renew = h('button', { class: 'btn-primary ms-cta', type: 'button', id: 'ms-buy', onclick: toPlans }, act || m ? 'Perpanjang ' + W.M : (P === 'pasar' ? 'Pilih Paket' : 'Gabung Membership')); if (open) renew.disabled = true;
    draw(back(ctx.backLabel || '← Pustaka', ctx.exit), h('h2', { class: 'wtitle' }, T.mineTitle),
      h('div', { class: 'panel ms-detail', id: 'ms-mine', 'data-active': String(act) }, h('span', { class: 'ms-crown ms-crown-lg' + (act ? '' : ' off') }, ic(I.crown)), h('h3', { id: 'ms-head' }, head),
        last ? row('Paket', T.plan(last.months, last)) : '', last ? row('Total Pembayaran', M.rp(last.amount)) : '',
        m ? row('Mulai aktif', M.fmtDate(m.started_at)) : '', m ? row('Berlaku hingga', M.fmtDate(m.ends_at), 'ms-until') : '',
        last && P !== 'pasar' ? row('Masjid Rujukan', last.mosque_name || 'Belum dipilih') : '', last ? row('Nomor Pesanan', last.ref_code) : '', last ? row('Metode Pembayaran', M.methodLabel(last.method)) : '',
        h('div', { class: 'ms-row' }, h('span', { class: 'muted' }, 'Status'), h('span', { class: 'ms-st ' + (act ? 'ms-ok' : 'ms-off'), id: 'ms-mstatus' }, act ? 'Aktif' : m ? 'Berakhir' : 'Belum berlangganan'))),
      act && left != null && left <= 7 ? h('div', { class: 'ms-note ms-deadline', id: 'ms-soon' }, ic(I.clock), h('span', {}, (P === 'taaruf' ? 'Premium' : W.M) + ' berakhir dalam ' + left + ' hari. ' + T.soon)) : '',
      !act && m ? h('div', { class: 'ms-note', id: 'ms-ended' }, ic(I.info), h('span', {}, T.ended)) : '',
      !m ? note(T.none) : '',
      infoBox('Tidak ada perpanjangan otomatis. Anda bisa memperpanjang secara manual; masa aktif baru ditambahkan setelah masa aktif sekarang berakhir.'),
      open ? h('div', { class: 'panel ms-open', id: 'ms-open' }, h('b', {}, 'Ada pesanan yang belum selesai'), h('p', { class: 'muted' }, open.ref_code + ' · ' + M.statusLabel(open.status)), h('button', { class: 'btn-sm', type: 'button', id: 'ms-continue', onclick: () => route(open) }, 'Lihat pesanan')) : '',
      renew,
      h('h3', {}, 'Riwayat transaksi'), S.orders.length ? h('div', { id: 'ms-hist' }, ...hist) : h('p', { class: 'muted', id: 'ms-nohist' }, 'Belum ada transaksi.'),
      wa ? h('p', { class: 'hint mt' }, 'Ada kendala? ', h('a', { id: 'ms-wa', href: wa, target: '_blank', rel: 'noopener noreferrer' }, 'Hubungi admin')) : '');
  }

  // Ke layar yang sesuai status pesanan.
  function route(o) {
    if (!o) return toPlans();
    if (o.status === 'menunggu_pembayaran') return payScreen(o);
    return statusScreen(o);
  }

  async function start() {
    const sess = getSession();
    if (!sess || !sess.user) {
      draw(back(ctx.backLabel || '← Pustaka', ctx.exit), h('div', { class: 'panel ms-state', id: 'ms-login' }, h('h2', { class: 'wtitle' }, 'Masuk dulu'), h('p', { class: 'muted' }, T.login), h('button', { class: 'btn-primary', type: 'button', id: 'ms-signin', onclick: ctx.signIn }, 'Masuk atau Daftar')));
      return;
    }
    loading();
    try { await refresh(); } catch (e) { failView(e); return; }
    const fresh = S.orders.find(x => x.status === 'disetujui');
    if (fresh && M.isActive(S.member) && seenGetP() !== fresh.id && Date.now() - new Date(fresh.reviewed_at || 0).getTime() < 14 * 86400000) { activatedScreen(fresh); return; }
    if (ctx.start === 'mine') { mineScreen(); return; }
    if (ctx.start === 'checkout' && ctx.planCode) {   // v209 (Pasar Umat): paket dipilih di halaman Pasar Umat
      const o0 = M.openOrder(S.orders); if (o0) { route(o0); return; }
      S.planCode = ctx.planCode; if (plan() && plan().active) { checkoutScreen(); return; }
    }
    const o = M.openOrder(S.orders);
    if (o && ctx.start !== 'plans') { route(o); return; }
    const lastRej = S.orders[0] && S.orders[0].status === 'ditolak' ? S.orders[0] : null;
    if (lastRej && ctx.start !== 'plans') { statusScreen(lastRej); return; }
    plansScreen();
  }
  start();
}
