// BAITUNA - membership-ui.js
// Alur jamaah: Pilih Paket -> Isi Data -> Pembayaran (transfer/QRIS) -> Unggah Bukti -> Menunggu Verifikasi -> Aktif. Plus "Membership Saya".
// Digambar di dalam halaman Pustaka Buku (tidak ada halaman terpisah). Aktivasi hanya terjadi di server setelah admin menyetujui.
import { h, toast, ask } from './ui.js';
import { icon, ICONS } from './feed-ui.js';
import { prepareImage, PHOTO_ERRORS } from './photo.js';
import { searchMosques } from './public-service.js';
import { getMyProfile } from './profile-service.js';
import { getSession } from './supabase.js';
import * as M from './membership-service.js';

const tone = s => 'ms-st ms-' + ((M.STATUS[s] || {}).tone || 'off');
const row = (k, v) => h('div', { class: 'ms-row' }, h('span', { class: 'muted' }, k), h('b', {}, v));

// ctx: { draw(...nodes), exit(), signIn(), start: 'auto' | 'mine' | 'plans' }
export function membershipFlow(ctx) {
  const { draw } = ctx;
  const S = { plans: [], planCode: '', mosque: null, noMosque: false, name: '', phone: '', member: null, orders: [], settings: null, accounts: null, method: 'transfer', profileDone: false };
  const back = (label, fn) => h('button', { class: 'btn-ghost bk-back', type: 'button', id: 'ms-back', onclick: fn }, label);
  const note = (t, cls) => h('p', { class: 'hint ' + (cls || '') }, t);
  const loading = () => draw(h('p', { class: 'muted', id: 'ms-loading' }, 'Memuat…'));
  const failView = e => draw(back('← Pustaka', ctx.exit), h('div', { class: 'empty' }, h('p', { class: 'muted', id: 'ms-fail' }, M.notReady(e) ? M.errorText(e) : 'Belum bisa dimuat. Periksa koneksi.')),
    M.notReady(e) ? '' : h('button', { class: 'btn-sm', type: 'button', id: 'ms-retry', onclick: () => start() }, 'Coba lagi'));
  const plan = () => S.plans.find(p => p.code === S.planCode) || null;

  async function refresh() {
    const [plans, member, orders] = await Promise.all([M.listPlans(), M.myMembership(), M.myOrders()]);
    S.plans = plans; S.member = member; S.orders = orders;
  }

  /* ===== 1. Pilih paket ===== */
  function plansScreen() {
    const ok = S.plans.filter(p => p.active);
    if (!S.planCode || !ok.some(p => p.code === S.planCode && p.price)) { const best = ok.filter(p => p.price).sort((a, b) => b.months - a.months)[0]; S.planCode = best ? best.code : ''; }
    const cards = ok.map(p => {
      const avail = !!p.price, sv = M.savingPct(p, ok);
      const inp = h('input', { type: 'radio', name: 'ms-plan', value: p.code, id: 'ms-plan-' + p.code }); inp.checked = S.planCode === p.code; if (!avail) inp.disabled = true;
      inp.addEventListener('change', () => { S.planCode = p.code; paint(); });
      return h('label', { class: 'ms-plan' + (S.planCode === p.code ? ' on' : '') + (avail ? '' : ' off'), 'data-code': p.code }, inp,
        h('span', { class: 'ms-pn' }, h('b', {}, p.months + ' Bulan'), sv ? h('span', { class: 'ms-save' }, 'Hemat ' + sv + '%') : ''),
        avail ? h('span', { class: 'ms-pp' }, M.rp(p.price), h('small', { class: 'muted' }, p.months > 1 ? ' (' + M.rp(Math.round(p.price / p.months)) + '/bulan)' : ' per bulan'))
          : h('span', { class: 'ms-pp muted' }, 'Harga belum ditetapkan'));
    });
    const go = h('button', { class: 'btn-primary', type: 'button', id: 'ms-next', onclick: () => { if (plan() && plan().price) dataScreen(); } }, 'Lanjutkan');
    const kids = [back('← Pustaka', ctx.exit), h('h2', { class: 'wtitle' }, 'Pilih Paket Membership'),
      h('p', { class: 'muted' }, 'Buka semua buku Premium di Pustaka Buku.')];
    if (M.isActive(S.member)) kids.push(note('Membership Anda aktif sampai ' + M.fmtDate(S.member.ends_at) + '. Paket baru menambah masa aktif setelah tanggal itu.', 'ms-info'));
    kids.push(h('ul', { class: 'ms-ben' }, ...M.BENEFITS.map(b => h('li', {}, b))));
    kids.push(cards.length ? h('div', { class: 'ms-plans', id: 'ms-plans', role: 'radiogroup', 'aria-label': 'Paket' }, ...cards) : h('p', { class: 'muted', id: 'ms-noplan' }, 'Belum ada paket yang tersedia.'));
    kids.push(go, note('Tidak ada perpanjangan otomatis. Setelah masa habis, Anda bebas memilih untuk memperpanjang atau tidak.'));
    draw(...kids); paint();
    function paint() { const p = plan(); go.disabled = !(p && p.price); for (const l of document.querySelectorAll('.ms-plan')) l.classList.toggle('on', l.getAttribute('data-code') === S.planCode); }
  }

  /* ===== 2. Isi data ===== */
  async function dataScreen() {
    if (!S.profileDone) {
      try { const p = await getMyProfile(M.userId()); if (!S.name) S.name = p.full_name || ''; if (!S.phone) S.phone = p.phone || ''; } catch (e) { /* abaikan: isi manual */ }
      S.profileDone = true;
    }
    const p = plan(); if (!p) { plansScreen(); return; }
    const name = h('input', { class: 'in', id: 'ms-name', maxlength: '120', autocomplete: 'name', placeholder: 'Masukkan nama lengkap' }); name.value = S.name;
    const phone = h('input', { class: 'in', id: 'ms-phone', type: 'tel', inputmode: 'tel', maxlength: '20', autocomplete: 'tel', placeholder: 'Contoh: 0812 3456 7890' }); phone.value = S.phone;
    const err = h('p', { class: 'mk-err', id: 'ms-err', role: 'alert' }, '');
    const mosqueBox = h('div', { id: 'ms-mosque' });
    const lab = (t, f) => h('label', { class: 'hint bk-lab', for: f }, t);
    const end = M.estimateEnd(p.months, S.member && S.member.ends_at);
    const btn = h('button', { class: 'btn-primary', type: 'button', id: 'ms-pay' }, 'Lanjut ke Pembayaran');
    let results = [], q = '', timer = null, seq = 0;
    const search = h('input', { class: 'in', id: 'ms-msearch', type: 'search', maxlength: '60', placeholder: 'Cari masjid (nama atau kota)…', 'aria-label': 'Cari masjid' });
    const list = h('div', { class: 'ms-mlist', id: 'ms-mlist' });
    function drawMosque() {
      if (S.mosque) { mosqueBox.replaceChildren(h('div', { class: 'ms-msel', id: 'ms-msel' }, h('span', {}, icon(ICONS.mosque, 'ic-sm'), ' ', h('b', {}, S.mosque.name)), h('button', { class: 'btn-sm ghost', type: 'button', id: 'ms-mchange', onclick: () => { S.mosque = null; drawMosque(); } }, 'Ganti'))); return; }
      if (S.noMosque) { mosqueBox.replaceChildren(h('div', { class: 'ms-msel', id: 'ms-msel' }, h('span', {}, 'Belum memilih masjid'), h('button', { class: 'btn-sm ghost', type: 'button', id: 'ms-mchange', onclick: () => { S.noMosque = false; drawMosque(); } }, 'Pilih masjid'))); return; }
      mosqueBox.replaceChildren(search, h('button', { class: 'btn-sm ghost', type: 'button', id: 'ms-mnone', onclick: () => { S.noMosque = true; S.mosque = null; drawMosque(); } }, 'Belum memilih masjid'), list);
      paintList();
    }
    function paintList() {
      list.replaceChildren(...(results.length ? results.map(m => h('button', { class: 'ms-mi', type: 'button', 'data-id': m.id, onclick: () => { S.mosque = { id: m.id, name: m.name }; S.noMosque = false; drawMosque(); } },
        h('b', {}, m.name), h('span', { class: 'muted' }, [m.city, m.province].filter(Boolean).join(', '))))
        : [h('p', { class: 'hint', id: 'ms-mempty' }, q ? 'Masjid tidak ditemukan. Anda boleh memilih "Belum memilih masjid" dan meminta bantuan admin.' : 'Memuat daftar masjid…')]));
    }
    async function find() {
      const my = ++seq;
      try { const r = await searchMosques({ q, offset: 0 }); if (my === seq) { results = r; paintList(); } } catch (e) { if (my === seq) { results = []; list.replaceChildren(h('p', { class: 'hint' }, 'Daftar masjid belum bisa dimuat.')); } }
    }
    search.addEventListener('input', () => { q = search.value.trim(); clearTimeout(timer); timer = setTimeout(find, 300); });
    drawMosque();
    if (!S.mosque && !S.noMosque) find();
    btn.addEventListener('click', async () => {
      S.name = name.value; S.phone = phone.value;
      const v = M.validateData({ name: name.value, phone: phone.value });
      if (v.error) { err.textContent = v.error; (v.field === 'name' ? name : phone).focus(); return; }
      if (!S.mosque && !S.noMosque) { err.textContent = 'Pilih masjid rujukan Anda, atau pilih "Belum memilih masjid".'; return; }
      err.textContent = ''; btn.disabled = true;
      try {
        await M.createOrder({ plan: p.code, name: v.ok.name, phone: v.ok.phone, mosque: S.mosque ? S.mosque.id : null });
        S.orders = await M.myOrders(); orderScreen(M.openOrder(S.orders));
      } catch (e) {
        if (e && e.message === 'order_terbuka') { try { S.orders = await M.myOrders(); } catch (x) { /* abaikan */ } const o = M.openOrder(S.orders); if (o) { toast('Anda masih punya pesanan terbuka. Dilanjutkan.'); orderScreen(o); return; } }
        err.textContent = M.errorText(e); btn.disabled = false;
      }
    });
    draw(back('← Pilih paket', plansScreen), h('h2', { class: 'wtitle' }, 'Isi Data Keanggotaan'),
      h('p', { class: 'muted' }, 'Data ini dipakai untuk mengelola keanggotaan dan pencatatan masjid rujukan. Nomor HP tidak ditampilkan ke pengguna lain.'),
      h('div', { class: 'panel rform', id: 'ms-form' }, lab('Nama lengkap *', 'ms-name'), name, lab('Nomor WhatsApp *', 'ms-phone'), phone, lab('Masjid rujukan *', 'ms-msearch'), mosqueBox,
        note('Masjid pilihan Anda tercatat sebagai masjid rujukan. Anda tidak akan dihubungkan ke masjid yang tidak Anda pilih.')),
      h('div', { class: 'panel ms-sum', id: 'ms-sum' }, h('h3', {}, 'Ringkasan'), row('Paket', p.name), row('Total pembayaran', M.rp(p.price)), row('Perkiraan berakhir', M.fmtDate(end))),
      err, btn);
  }

  /* ===== 3. Pembayaran + bukti ===== */
  async function orderScreen(o) {
    if (!o) { plansScreen(); return; }
    if (o.status === 'menunggu_verifikasi' || o.status === 'disetujui') { statusScreen(o); return; }
    if (o.status !== 'menunggu_pembayaran' && o.status !== 'ditolak') { mineScreen(); return; }
    loading();
    try { if (!S.settings) S.settings = await M.settingsPublic(); if (!S.accounts) S.accounts = await M.listAccounts(); } catch (e) { failView(e); return; }
    const acc = S.accounts, qr = M.qrisUrl(S.settings), end = M.estimateEnd(o.months, S.member && S.member.ends_at);
    const hasTransfer = acc.length > 0, hasQris = !!qr;
    if (S.method === 'qris' && !hasQris) S.method = 'transfer';
    if (S.method === 'transfer' && !hasTransfer && hasQris) S.method = 'qris';
    const copy = async (t, label) => { try { await navigator.clipboard.writeText(t); toast(label + ' disalin.'); } catch (e) { toast('Tidak bisa menyalin. Salin manual: ' + t, true); } };
    const body = h('div', { id: 'ms-method-body' });
    const seg = h('div', { class: 'seg ms-seg', id: 'ms-seg', role: 'group', 'aria-label': 'Metode pembayaran' }, ...[['transfer', 'Transfer Bank'], ['qris', 'QRIS']].map(([k, l]) =>
      h('button', { class: 'segb', type: 'button', id: 'ms-m-' + k, 'aria-pressed': String(S.method === k), 'aria-selected': String(S.method === k), onclick: () => { S.method = k; drawBody(); for (const b of seg.children) { const on = b.id === 'ms-m-' + S.method; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-selected', String(on)); } } }, l)));
    const amountRow = h('div', { class: 'ms-amt' }, h('span', { class: 'muted' }, 'Nominal yang harus dibayar'), h('b', { class: 'ms-amt-v', id: 'ms-amount' }, M.rp(o.amount)), h('button', { class: 'btn-sm ghost', type: 'button', id: 'ms-copy-amt', onclick: () => copy(String(o.amount), 'Nominal') }, 'Salin'));
    function drawBody() {
      if (S.method === 'qris') {
        body.replaceChildren(qr ? h('div', { class: 'ms-qris' }, h('img', { class: 'ms-qimg', id: 'ms-qimg', src: qr, alt: 'QRIS pembayaran' }), S.settings.qris_merchant ? h('b', {}, S.settings.qris_merchant) : '',
          h('p', { class: 'hint' }, 'Pindai dengan aplikasi bank atau dompet digital. Jika QRIS meminta nominal, masukkan tepat ' + M.rp(o.amount) + '.'))
          : h('p', { class: 'hint ms-warn', id: 'ms-noqris' }, 'QRIS belum tersedia. Silakan gunakan transfer bank.'));
        return;
      }
      body.replaceChildren(...(hasTransfer ? acc.map(a => h('div', { class: 'ms-acc', 'data-id': a.id }, h('div', {}, h('b', {}, a.bank), h('div', { class: 'ms-num' }, a.number), h('span', { class: 'muted' }, 'a.n. ' + a.holder)),
        h('button', { class: 'btn-sm ghost ms-copy', type: 'button', onclick: () => copy(a.number.replace(/\D/g, ''), 'Nomor rekening') }, 'Salin')))
        : [h('p', { class: 'hint ms-warn', id: 'ms-noacc' }, 'Rekening pembayaran belum diatur admin. Hubungi admin untuk bantuan.')]));
    }
    drawBody();
    const file = h('input', { class: 'in', type: 'file', id: 'ms-file', accept: 'image/jpeg,image/png,image/webp', 'aria-label': 'Bukti pembayaran' });
    const prev = h('div', { id: 'ms-prev' }); const err = h('p', { class: 'mk-err', id: 'ms-err', role: 'alert' }, '');
    const send = h('button', { class: 'btn-primary', type: 'button', id: 'ms-send', disabled: 'disabled' }, o.status === 'ditolak' ? 'Kirim Ulang Bukti' : 'Saya Sudah Bayar, Kirim Bukti');
    let pu = null;
    file.addEventListener('change', () => { const f = file.files && file.files[0]; if (pu) URL.revokeObjectURL(pu); pu = f ? URL.createObjectURL(f) : null; prev.replaceChildren(pu ? h('img', { class: 'ms-pv', src: pu, alt: 'Pratinjau bukti' }) : ''); send.disabled = !f || !(hasTransfer || hasQris); err.textContent = ''; });
    send.addEventListener('click', async () => {
      const f = file.files && file.files[0]; if (!f) return;
      send.disabled = true; err.textContent = ''; send.textContent = 'Mengirim…';
      try {
        const img = await prepareImage(f); const path = M.newProofPath();
        await M.uploadProof(path, img.blob); await M.attachProof(o.id, path, S.method);
        S.orders = await M.myOrders(); toast('Bukti terkirim. Menunggu verifikasi admin.'); statusScreen(S.orders.find(x => x.id === o.id) || { ...o, status: 'menunggu_verifikasi' });
      } catch (e) {
        err.textContent = e && e.code && PHOTO_ERRORS[e.code] ? PHOTO_ERRORS[e.code] : M.errorText(e);
        send.disabled = false; send.textContent = o.status === 'ditolak' ? 'Kirim Ulang Bukti' : 'Saya Sudah Bayar, Kirim Bukti';
      }
    });
    const cancel = o.status === 'menunggu_pembayaran' ? h('button', { class: 'btn-sm alt', type: 'button', id: 'ms-cancel', onclick: async () => {
      if (!(await ask({ title: 'Batalkan pesanan ini?', text: 'Pesanan ' + o.ref_code + ' dibatalkan. Anda bisa memesan lagi kapan saja.' }))) return;
      try { await M.cancelOrder(o.id); S.orders = await M.myOrders(); toast('Pesanan dibatalkan.'); plansScreen(); } catch (e) { toast(M.errorText(e), true); }
    } }, 'Batalkan pesanan') : '';
    const wa = M.adminWaLink(S.settings.admin_wa, 'Assalamu’alaikum, saya ingin bertanya tentang pesanan membership ' + o.ref_code + '.');
    draw(back('← Pustaka', ctx.exit), h('h2', { class: 'wtitle' }, 'Pembayaran Membership'),
      o.status === 'ditolak' ? h('div', { class: 'panel ms-rej', id: 'ms-rej' }, h('b', {}, 'Pembayaran ditolak'), h('p', {}, o.reject_reason || ''), h('p', { class: 'hint' }, 'Periksa lalu kirim ulang bukti yang benar.')) : '',
      h('div', { class: 'panel ms-sum', id: 'ms-sum' }, h('h3', {}, 'Ringkasan Pesanan'), row('Kode pesanan', o.ref_code), row('Paket', o.plan_name), row('Masjid rujukan', o.mosque_name || 'Belum memilih'), row('Perkiraan berakhir', M.fmtDate(end))),
      h('h3', {}, 'Pilih Metode Pembayaran'), seg, amountRow, body,
      S.settings.pay_note ? note(S.settings.pay_note, 'ms-info') : '',
      note('Cantumkan kode ' + o.ref_code + ' pada berita transfer bila memungkinkan.'),
      h('h3', {}, 'Unggah Bukti Pembayaran'), file, prev, note('Foto atau tangkapan layar bukti transfer/QRIS (JPG, PNG, atau WebP). Membership belum aktif sebelum admin menyetujui.'), err, send,
      h('div', { class: 'row-btns mt' }, cancel, wa ? h('a', { class: 'btn-sm ghost', id: 'ms-wa', href: wa, target: '_blank', rel: 'noopener noreferrer' }, 'Hubungi admin') : ''));
  }

  /* ===== 4. Status ===== */
  function statusScreen(o) {
    const wait = o.status === 'menunggu_verifikasi', done = o.status === 'disetujui';
    draw(back('← Pustaka', ctx.exit), h('div', { class: 'panel ms-state', id: 'ms-state', 'data-status': o.status },
      h('h2', { class: 'wtitle' }, done ? 'Alhamdulillah! Membership aktif' : wait ? 'Bukti pembayaran terkirim' : M.statusLabel(o.status)),
      h('p', { class: 'muted' }, done ? 'Buku Premium sekarang bisa Anda baca.' : wait ? 'Admin akan memeriksa pembayaran Anda. Membership aktif setelah disetujui; ini bisa memerlukan waktu.' : ''),
      row('Kode pesanan', o.ref_code), row('Paket', o.plan_name), row('Nominal', M.rp(o.amount)),
      done ? row('Berlaku', M.fmtDate(o.starts_at) + ' – ' + M.fmtDate(o.ends_at)) : '', h('div', { class: 'mt' }, h('span', { class: tone(o.status) }, M.statusLabel(o.status)))),
      h('div', { class: 'row-btns mt' }, done ? h('button', { class: 'btn-primary', type: 'button', id: 'ms-read', onclick: ctx.exit }, 'Mulai Jelajahi Buku') : '',
        h('button', { class: 'btn-sm ghost', type: 'button', id: 'ms-tomine', onclick: mineScreen }, 'Membership Saya')));
  }

  /* ===== 5. Membership Saya ===== */
  async function mineScreen() {
    loading();
    try { await refresh(); S.settings = S.settings || await M.settingsPublic(); } catch (e) { failView(e); return; }
    const m = S.member, act = M.isActive(m), open = M.openOrder(S.orders), last = S.orders.find(x => x.status === 'disetujui');
    const wa = M.adminWaLink(S.settings.admin_wa, 'Assalamu’alaikum, saya butuh bantuan terkait Membership BAITUNA.');
    const hist = S.orders.map(o => h('div', { class: 'panel ms-ord', 'data-id': o.id, 'data-status': o.status },
      h('div', { class: 'ms-oh' }, h('b', {}, o.plan_name), h('span', { class: tone(o.status) }, M.statusLabel(o.status))),
      row('Kode', o.ref_code), row('Nominal', M.rp(o.amount)), row('Tanggal pesan', M.fmtDate(o.created_at)), row('Masjid rujukan', o.mosque_name || 'Belum memilih'),
      o.status === 'disetujui' ? row('Masa aktif', M.fmtDate(o.starts_at) + ' – ' + M.fmtDate(o.ends_at)) : '',
      o.status === 'ditolak' && o.reject_reason ? h('p', { class: 'hint ms-warn' }, 'Alasan: ' + o.reject_reason) : '',
      o.status === 'menunggu_pembayaran' || o.status === 'ditolak' ? h('button', { class: 'btn-sm', type: 'button', onclick: () => orderScreen(o) }, o.status === 'ditolak' ? 'Kirim ulang bukti' : 'Lanjutkan pembayaran') : ''));
    draw(back('← Pustaka', ctx.exit), h('h2', { class: 'wtitle' }, 'Membership Saya'),
      h('div', { class: 'panel ms-state', id: 'ms-mine', 'data-active': String(act) },
        h('div', { class: 'ms-oh' }, h('b', {}, 'Status'), h('span', { class: 'ms-st ' + (act ? 'ms-ok' : 'ms-off'), id: 'ms-mstatus' }, act ? 'Aktif' : m ? 'Sudah berakhir' : 'Belum berlangganan')),
        last ? row('Paket terakhir', last.plan_name) : '', m ? row('Tanggal mulai', M.fmtDate(m.started_at)) : '', m ? row('Tanggal berakhir', M.fmtDate(m.ends_at)) : '', last ? row('Masjid rujukan', last.mosque_name || 'Belum memilih') : '',
        !m ? h('p', { class: 'muted' }, 'Anda belum punya membership. Buku Gratis tetap bisa dibaca.') : ''),
      open ? h('div', { class: 'panel ms-open', id: 'ms-open' }, h('b', {}, 'Ada pesanan yang belum selesai'), h('p', { class: 'muted' }, open.plan_name + ' · ' + M.statusLabel(open.status)), h('button', { class: 'btn-sm', type: 'button', id: 'ms-continue', onclick: () => orderScreen(open) }, 'Lihat pesanan')) : '',
      buyBtn(open, act),
      h('h3', {}, 'Cara memperpanjang'), h('p', { class: 'muted' }, 'Tekan “Perpanjang Membership”, pilih paket, bayar, lalu unggah bukti. Masa aktif baru ditambahkan setelah masa aktif sekarang berakhir. Tidak ada tagihan otomatis.'),
      h('h3', {}, 'Riwayat transaksi'), S.orders.length ? h('div', { id: 'ms-hist' }, ...hist) : h('p', { class: 'muted', id: 'ms-nohist' }, 'Belum ada transaksi.'),
      h('h3', {}, 'Ada masalah?'), wa ? h('a', { class: 'btn-sm', id: 'ms-wa', href: wa, target: '_blank', rel: 'noopener noreferrer' }, 'Hubungi admin lewat WhatsApp') : h('p', { class: 'muted' }, 'Kontak admin belum diatur. Hubungi pengurus aplikasi melalui masjid Anda.'));
  }

  function buyBtn(open, act) { const b = h('button', { class: 'btn-primary', type: 'button', id: 'ms-buy', onclick: plansScreen }, act ? 'Perpanjang Membership' : 'Gabung Membership'); if (open) b.disabled = true; return b; }

  async function start() {
    const sess = getSession();
    if (!sess || !sess.user) {
      draw(back('← Pustaka', ctx.exit), h('div', { class: 'panel ms-state', id: 'ms-login' }, h('h2', { class: 'wtitle' }, 'Masuk dulu'), h('p', { class: 'muted' }, 'Untuk bergabung dan membayar membership, silakan masuk ke akun BAITUNA Anda.'), h('button', { class: 'btn-primary', type: 'button', id: 'ms-signin', onclick: ctx.signIn }, 'Masuk atau Daftar')));
      return;
    }
    loading();
    try { await refresh(); } catch (e) { failView(e); return; }
    if (ctx.start === 'mine') { mineScreen(); return; }
    const o = M.openOrder(S.orders);
    if (o && ctx.start !== 'plans') { orderScreen(o); return; }
    plansScreen();
  }
  start();
}
