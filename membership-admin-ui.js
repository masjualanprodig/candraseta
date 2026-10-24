// BAITUNA - membership-admin-ui.js
// Layar Super Admin untuk Membership (dibuka dari "Kelola Pustaka Buku"): verifikasi pembayaran, komisi masjid, dan pengaturan
// (paket, rekening, QRIS, persentase komisi, kontak admin). Izin dijaga server (RLS + fungsi); layar ini hanya antarmuka.
import { h, toast, ask } from './ui.js';
import * as M from './membership-service.js';

const tone = s => 'ms-st ms-' + ((M.STATUS[s] || {}).tone || 'off');
const row = (k, v) => h('div', { class: 'ms-row' }, h('span', { class: 'muted' }, k), h('b', {}, v));
const QRIS_MAX = 500 * 1024;
const LOG = { dibuat: 'Pesanan dibuat', bukti_dikirim: 'Bukti dikirim', disetujui: 'Pembayaran terverifikasi, membership aktif sampai', ditolak: 'Bukti ditolak', dibatalkan_pengguna: 'Dibatalkan pengguna', kedaluwarsa: 'Kedaluwarsa', komisi: 'Status komisi' };

// ctx: { draw(...nodes), exit() }
export function membershipAdminPage(ctx) {
  const { draw } = ctx;
  const st = { tab: ctx.tab === 'verif' || !ctx.tab ? 'trx' : ctx.tab, filter: 'menunggu_verifikasi', q: '' };
  const back = h('button', { class: 'btn-ghost bk-back', type: 'button', id: 'ma-back', onclick: () => ctx.exit() }, '← Kelola buku');
  const tabs = () => h('div', { class: 'mk-chips', id: 'ma-tabs', role: 'group', 'aria-label': 'Bagian' }, ...[['trx', 'Transaksi'], ['komisi', 'Komisi'], ['atur', 'Pengaturan']].map(([k, l]) =>
    h('button', { class: 'mk-chip' + (st.tab === k ? ' on' : ''), type: 'button', id: 'ma-t-' + k, 'aria-pressed': String(st.tab === k), onclick: () => { st.tab = k; show(); } }, l)));
  const frame = (...k) => draw(back, h('h2', { class: 'wtitle' }, 'Atur Membership'), tabs(), ...k);
  const fail = e => frame(h('p', { class: 'mk-err', id: 'ma-fail', role: 'alert' }, M.notReady(e) ? M.errorText(e) : M.errorText(e)));

  async function show() {
    frame(h('p', { class: 'muted', id: 'ma-loading' }, 'Memuat…'));
    try { if (st.tab === 'trx') await trx(); else if (st.tab === 'komisi') await komisi(); else await atur(); } catch (e) { fail(e); }
  }

  /* ===== Transaksi: daftar, filter, detail, verifikasi ===== */
  const FILTERS = [['', 'Semua'], ['menunggu_pembayaran', 'Menunggu pembayaran'], ['menunggu_verifikasi', 'Menunggu verifikasi'], ['disetujui', 'Terverifikasi'], ['ditolak', 'Bukti ditolak'],
    ['batal', 'Kedaluwarsa / batal'], ['m_aktif', 'Membership aktif'], ['m_habis', 'Membership berakhir']];
  async function trx() {
    await M.expireDue().catch(() => {});
    const [orders, members, proofs, set] = await Promise.all([M.adminOrders(''), M.adminMemberships(), M.adminProofs().catch(() => []), M.adminSettings()]);
    const mem = Object.fromEntries(members.map(m => [m.user_id, m]));
    const prOf = id => proofs.filter(p => p.order_id === id);
    const mst = o => o.status !== 'disetujui' ? 'none' : M.memberStatus(mem[o.user_id]);
    const match = o => {
      const f = st.filter;
      if (f === 'batal') return o.status === 'kedaluwarsa' || o.status === 'dibatalkan';
      if (f === 'm_aktif') return mst(o) === 'aktif';
      if (f === 'm_habis') return mst(o) === 'berakhir';
      return !f || o.status === f;
    };
    const q = (st.q || '').toLowerCase();
    const list = orders.filter(o => match(o) && (!q || (o.ref_code + ' ' + o.full_name).toLowerCase().includes(q)));
    const count = k => orders.filter(o => o.status === k).length;
    const chips = h('div', { class: 'mk-chips ma-filters', id: 'ma-filter', role: 'group', 'aria-label': 'Filter transaksi' }, ...FILTERS.map(([k, l]) =>
      h('button', { class: 'mk-chip' + (st.filter === k ? ' on' : ''), type: 'button', 'data-f': k, 'aria-pressed': String(st.filter === k), onclick: () => { st.filter = k; show(); } }, l)));
    const search = h('input', { class: 'in', id: 'ma-q', type: 'search', maxlength: '40', placeholder: 'Cari nomor transaksi atau nama…', 'aria-label': 'Cari transaksi' }); search.value = st.q || '';
    search.addEventListener('change', () => { st.q = search.value.trim(); show(); });
    const proofTag = o => { const p = prOf(o.id)[0]; return p ? h('span', { class: 'ms-st ' + (p.status === 'diterima' ? 'ms-ok' : p.status === 'ditolak' ? 'ms-bad' : 'ms-warn') }, 'Bukti: ' + (M.PROOF_STATUS[p.status] || p.status)) : h('span', { class: 'ms-st ms-off' }, 'Belum ada bukti'); };
    const memTag = o => { const s = mst(o); return s === 'none' ? '' : h('span', { class: 'ms-st ' + (s === 'aktif' ? 'ms-ok' : 'ms-off') }, s === 'aktif' ? 'Membership aktif' : 'Membership berakhir'); };
    const card = o => {
      const det = h('div', { class: 'ma-det', hidden: true });
      const act = o.status === 'menunggu_verifikasi' ? h('div', { class: 'row-btns mt' },
        h('button', { class: 'btn-sm ma-ok', type: 'button', onclick: async ev => {
          const warn = o.mosque_id && set.commission_pct == null ? '\n\nCatatan: persentase komisi belum diisi, jadi komisi masjid dicatat tanpa nominal.' : '';
          if (!(await ask({ title: 'Verifikasi pembayaran ini?', text: o.ref_code + ' · ' + o.full_name + ' · ' + M.rp(o.amount) + '. Pastikan dana sudah masuk. Membership langsung aktif dan tidak bisa dibatalkan dari sini.' + warn }))) return;
          ev.target.disabled = true;
          try { await M.reviewOrder(o.id, true); M.pingNotify(); toast('Pembayaran terverifikasi. Membership aktif.'); show(); } catch (e) { toast('Gagal memperbarui status. ' + M.errorText(e), true); show(); }
        } }, 'Verifikasi'),
        h('button', { class: 'btn-sm alt ma-no', type: 'button', onclick: async () => {
          const reason = await ask({ title: 'Tolak bukti pembayaran?', text: 'Tulis alasan agar jamaah bisa memperbaiki dan mengirim ulang bukti.', reason: true }); if (!reason) return;
          try { await M.reviewOrder(o.id, false, reason); M.pingNotify(); toast('Bukti ditolak.'); show(); } catch (e) { toast('Gagal memperbarui status. ' + M.errorText(e), true); show(); }
        } }, 'Tolak')) : '';
      const toggle = h('button', { class: 'btn-sm ghost ma-more', type: 'button', onclick: async () => {
        if (!det.hidden) { det.hidden = true; toggle.textContent = 'Detail & bukti'; return; }
        det.hidden = false; toggle.textContent = 'Tutup detail'; det.replaceChildren(h('p', { class: 'muted' }, 'Memuat…'));
        let log = []; try { log = await M.adminLog(o.id); } catch (e) { log = []; }
        const pr = prOf(o.id), m = mem[o.user_id];
        det.replaceChildren(
          row('Email', o.email || '-'), row('Batas bayar', M.fmtDateTime(o.expires_at)), row('Bukti terakhir', o.proof_at ? M.fmtDateTime(o.proof_at) : '-'),
          o.reviewed_at ? row('Diproses admin', M.fmtDateTime(o.reviewed_at)) : '',
          o.status === 'disetujui' ? row('Periode transaksi ini', M.fmtDate(o.starts_at) + ' – ' + M.fmtDate(o.ends_at)) : '',
          m ? row('Membership pengguna', M.fmtDate(m.started_at) + ' – ' + M.fmtDate(m.ends_at)) : '',
          h('h4', {}, 'Riwayat bukti (' + pr.length + ')'),
          ...(pr.length ? pr.map(p => { const box = h('div', { class: 'ms-proof' });
            return h('div', { class: 'ms-acc', 'data-proof': p.id }, h('div', {}, h('b', {}, M.fmtDateTime(p.uploaded_at) + ' · ' + M.methodLabel(p.method)), h('div', { class: 'muted' }, (M.PROOF_STATUS[p.status] || p.status) + (p.reject_reason ? ' — ' + p.reject_reason : '')), box),
              h('button', { class: 'btn-sm ghost ma-proof', type: 'button', onclick: async ev => {
                ev.target.disabled = true;
                try { const u = await M.proofBlobUrl(p.path); box.replaceChildren(h('a', { href: u, target: '_blank', rel: 'noopener' }, h('img', { class: 'ms-pv', src: u, alt: 'Bukti pembayaran ' + o.ref_code }))); ev.target.remove(); }
                catch (e) { toast('Bukti belum bisa dibuka.', true); ev.target.disabled = false; }
              } }, 'Lihat bukti')); })
            : o.proof_path ? [h('button', { class: 'btn-sm ghost ma-proof', type: 'button', onclick: async ev => { ev.target.disabled = true; try { const u = await M.proofBlobUrl(o.proof_path); ev.target.replaceWith(h('img', { class: 'ms-pv', src: u, alt: 'Bukti pembayaran' })); } catch (e) { toast('Bukti belum bisa dibuka.', true); ev.target.disabled = false; } } }, 'Lihat bukti')]
            : [h('p', { class: 'hint' }, 'Belum ada bukti.')]),
          h('h4', {}, 'Histori transaksi'),
          log.length ? h('ol', { class: 'ma-log' }, ...log.map(l => h('li', {}, M.fmtDateTime(l.at) + ' · ' + (LOG[l.action] || l.action) + (l.note ? ' (' + l.note + ')' : '')))) : h('p', { class: 'hint' }, 'Belum ada histori.'));
      } }, 'Detail & bukti');
      return h('div', { class: 'panel ms-ord ma-ord', 'data-id': o.id, 'data-status': o.status },
        h('div', { class: 'ms-oh' }, h('b', {}, o.ref_code), h('span', { class: tone(o.status) }, M.statusLabel(o.status))),
        h('div', { class: 'ma-tags' }, proofTag(o), memTag(o)),
        row('Nama', o.full_name), row('WhatsApp', M.phoneShow(o.phone)), row('Paket', o.plan_name), row('Harga', M.rp(o.amount)), row('Masjid rujukan', o.mosque_name || 'Belum dipilih'),
        row('Metode', M.methodLabel(o.method)), row('Tanggal checkout', M.fmtDateTime(o.created_at)),
        o.reject_reason && o.status === 'ditolak' ? h('p', { class: 'hint ms-warn' }, 'Alasan tolak: ' + o.reject_reason) : '', toggle, det, act);
    };
    frame(h('div', { class: 'ma-sum', id: 'ma-sum' }, h('div', {}, h('span', { class: 'muted' }, 'Menunggu verifikasi'), h('b', {}, String(count('menunggu_verifikasi')))),
        h('div', {}, h('span', { class: 'muted' }, 'Menunggu pembayaran'), h('b', {}, String(count('menunggu_pembayaran')))),
        h('div', {}, h('span', { class: 'muted' }, 'Membership aktif'), h('b', {}, String(members.filter(m => M.memberStatus(m) === 'aktif').length)))),
      chips, search,
      list.length ? h('div', { id: 'ma-orders' }, ...list.map(card)) : h('p', { class: 'muted', id: 'ma-empty' }, 'Tidak ada transaksi pada filter ini.'),
      orders.length >= 300 ? h('p', { class: 'hint' }, 'Menampilkan 300 transaksi terbaru.') : '');
  }

  /* ===== Komisi masjid (pencatatan) ===== */
  async function komisi() {
    const [list, orders, set] = await Promise.all([M.adminCommissions(), M.adminOrders(''), M.adminSettings()]);
    const byId = Object.fromEntries(orders.map(o => [o.id, o]));
    const sel = c => { const s = h('select', { class: 'in', 'aria-label': 'Status komisi' }, ...Object.entries(M.COMMISSION_STATUS).map(([k, l]) => h('option', { value: k }, l))); s.value = c.status;
      s.addEventListener('change', async () => { try { await M.setCommissionStatus(c.id, s.value); toast('Status komisi disimpan.'); } catch (e) { toast(M.errorText(e), true); s.value = c.status; } }); return s; };
    const card = c => { const o = byId[c.order_id] || {};
      return h('div', { class: 'panel ms-ord', 'data-id': c.id }, h('div', { class: 'ms-oh' }, h('b', {}, o.mosque_name || 'Masjid'), h('span', { class: 'ms-st ms-off' }, o.ref_code || '')),
        row('Dasar perhitungan', M.rp(c.base_amount)), row('Persentase', c.pct == null ? 'Belum diisi' : c.pct + '%'), row('Komisi', c.amount == null ? '-' : M.rp(c.amount)), row('Dicatat', M.fmtDate(c.created_at)), sel(c)); };
    frame(h('p', { class: 'muted' }, 'Pencatatan komisi dari pembayaran yang sah. Persentase yang dipakai tersimpan per transaksi saat disetujui.'),
      set.commission_pct == null ? h('p', { class: 'hint ms-warn', id: 'ma-nopct', role: 'status' }, 'Persentase komisi belum diisi (Pengaturan). Transaksi yang disetujui sekarang dicatat tanpa nominal komisi.') : h('p', { class: 'hint' }, 'Persentase berlaku saat ini: ' + set.commission_pct + '%'),
      list.length ? h('div', { id: 'ma-coms' }, ...list.map(card)) : h('p', { class: 'muted', id: 'ma-empty' }, 'Belum ada komisi tercatat.'));
  }

  /* ===== Pengaturan ===== */
  async function atur() {
    const [plans, accounts, set, hist, notes] = await Promise.all([M.listPlans(), M.adminAccounts(), M.adminSettings(), M.planHistory().catch(() => null), M.adminNotifications().catch(() => null)]);
    const lab = (t, f) => h('label', { class: 'hint bk-lab', for: f }, t);
    // Paket
    const planCard = p => {
      const price = h('input', { class: 'in', id: 'ma-price-' + p.code, inputmode: 'numeric', maxlength: '12', placeholder: 'Belum ditetapkan' }); price.value = p.price == null ? '' : String(p.price);
      const act = h('input', { type: 'checkbox', id: 'ma-pact-' + p.code }); act.checked = !!p.active; const err = h('p', { class: 'mk-err', role: 'alert' }, '');
      return h('div', { class: 'panel', 'data-code': p.code }, h('b', {}, p.name), lab('Harga (Rp)', 'ma-price-' + p.code), price, h('label', { class: 'qa-check' }, act, ' Tampilkan paket ini'), err,
        h('button', { class: 'btn-sm', type: 'button', id: 'ma-psave-' + p.code, onclick: async () => {
          const v = M.parsePrice(price.value); if (v.error) { err.textContent = v.error; return; } err.textContent = '';
          if (v.ok === p.price && act.checked === !!p.active) { toast('Tidak ada perubahan.'); return; }
          if (!(await ask({ title: 'Simpan perubahan paket?', text: p.name + ': ' + (p.price == null ? 'belum ada harga' : M.rp(p.price)) + ' → ' + (v.ok == null ? 'tanpa harga (tidak bisa dibeli)' : M.rp(v.ok)) + (act.checked ? '' : ', disembunyikan') + '. Berlaku untuk transaksi baru; transaksi lama tidak berubah. Perubahan dicatat.' }))) return;
          try { await M.savePlan(p.id, { price: v.ok, active: act.checked }); toast('Paket disimpan.'); show(); } catch (e) { err.textContent = M.errorText(e); }
        } }, 'Simpan paket'));
    };
    // Rekening
    const accRow = a => h('div', { class: 'panel ms-acc', 'data-id': a.id }, h('div', {}, h('b', {}, a.bank + ' · ' + a.number), h('div', { class: 'muted' }, 'a.n. ' + a.holder + (a.active ? '' : ' · nonaktif'))),
      h('div', { class: 'qa-acts' }, h('button', { class: 'btn-sm ghost', type: 'button', onclick: async () => { try { await M.setAccountActive(a.id, !a.active); show(); } catch (e) { toast(M.errorText(e), true); } } }, a.active ? 'Nonaktifkan' : 'Aktifkan'),
        h('button', { class: 'btn-sm alt', type: 'button', onclick: async () => { if (!(await ask({ title: 'Hapus rekening ini?', text: a.bank + ' ' + a.number }))) return; try { await M.deleteAccount(a.id); show(); } catch (e) { toast(M.errorText(e), true); } } }, 'Hapus')));
    const bank = h('input', { class: 'in', id: 'ma-bank', maxlength: '40', placeholder: 'Nama bank' }), num = h('input', { class: 'in', id: 'ma-num', inputmode: 'numeric', maxlength: '30', placeholder: 'Nomor rekening' }), holder = h('input', { class: 'in', id: 'ma-holder', maxlength: '80', placeholder: 'Nama pemilik rekening (sesuai buku tabungan)' });
    const aerr = h('p', { class: 'mk-err', id: 'ma-aerr', role: 'alert' }, '');
    const addAcc = h('div', { class: 'panel rform' }, h('b', {}, 'Tambah rekening'), bank, num, holder, aerr,
      h('button', { class: 'btn-sm', type: 'button', id: 'ma-aadd', onclick: async () => {
        const v = M.validateAccount({ bank: bank.value, number: num.value, holder: holder.value }); if (v.error) { aerr.textContent = v.error; return; } aerr.textContent = '';
        try { await M.addAccount(v.ok); toast('Rekening ditambahkan.'); show(); } catch (e) { aerr.textContent = M.errorText(e); }
      } }, 'Tambah rekening'));
    // QRIS + umum
    const qurl = M.qrisUrl(set), merchant = h('input', { class: 'in', id: 'ma-merchant', maxlength: '80', placeholder: 'Nama merchant pada QRIS' }); merchant.value = set.qris_merchant || '';
    const qfile = h('input', { class: 'in', type: 'file', id: 'ma-qfile', accept: 'image/png,image/jpeg,image/webp', 'aria-label': 'Gambar QRIS' });
    const pct = h('input', { class: 'in', id: 'ma-pct', inputmode: 'decimal', maxlength: '6', placeholder: 'Contoh: 10' }); pct.value = set.commission_pct == null ? '' : String(set.commission_pct);
    const wa = h('input', { class: 'in', id: 'ma-wa', type: 'tel', inputmode: 'tel', maxlength: '20', placeholder: 'Contoh: 0812 3456 7890' }); wa.value = set.admin_wa ? '0' + set.admin_wa.slice(2) : '';
    const pnote = h('input', { class: 'in', id: 'ma-note', maxlength: '300', placeholder: 'Catatan pembayaran (opsional)' }); pnote.value = set.pay_note || '';
    const gerr = h('p', { class: 'mk-err', id: 'ma-gerr', role: 'alert' }, '');
    const saveGen = h('button', { class: 'btn-primary', type: 'button', id: 'ma-gsave', onclick: async () => {
      const pc = M.parsePct(pct.value); if (pc.error) { gerr.textContent = pc.error; return; }
      let waN = null; if (wa.value.trim()) { waN = M.normalizePhone(wa.value); if (!waN) { gerr.textContent = 'Nomor WhatsApp admin belum benar.'; return; } }
      const f = qfile.files && qfile.files[0];
      if (f && (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > QRIS_MAX)) { gerr.textContent = 'Gambar QRIS harus PNG/JPG/WebP dan maksimal 500 KB.'; return; }
      gerr.textContent = ''; saveGen.disabled = true;
      try {
        const patch = { commission_pct: pc.ok, admin_wa: waN, qris_merchant: merchant.value.trim() || null, pay_note: pnote.value.trim() || null };
        if (f) { const path = M.newQrisPath(); await M.uploadQris(path, f); patch.qris_path = path; }
        await M.saveSettings(patch); toast('Pengaturan disimpan.'); show();
      } catch (e) { gerr.textContent = M.errorText(e); saveGen.disabled = false; }
    } }, 'Simpan pengaturan');
    // Telegram
    const tgOut = h('p', { class: 'hint', id: 'ma-tgout', role: 'status' }, '');
    const tgBtn = h('button', { class: 'btn-sm', type: 'button', id: 'ma-tgtest', onclick: async () => {
      tgBtn.disabled = true; tgOut.textContent = 'Mengirim pesan uji…';
      try { const r = await M.testTelegram(); tgOut.textContent = r.ok ? 'Berhasil. Cek grup/chat Telegram Super Admin.' : r.configured === false ? 'Telegram belum dikonfigurasi di server (TELEGRAM_BOT_TOKEN dan TELEGRAM_SUPER_ADMIN_CHAT_ID).' : 'Gagal: ' + (r.error || 'tidak diketahui'); }
      catch (e) { tgOut.textContent = e && e.status === 0 ? 'Tidak ada koneksi internet.' : 'Gagal menghubungi server.'; }
      tgBtn.disabled = false; } }, 'Uji koneksi Telegram');
    const NK = { pesanan_baru: 'Pesanan baru', bukti_masuk: 'Bukti masuk', terverifikasi: 'Terverifikasi', ditolak: 'Ditolak', kedaluwarsa: 'Kedaluwarsa', dibatalkan: 'Dibatalkan', uji: 'Uji' };
    const NS = { menunggu: 'ms-warn', mengirim: 'ms-warn', terkirim: 'ms-ok', gagal: 'ms-bad' };
    const failed = (notes || []).filter(n => n.status === 'gagal').length;
    const tgBox = h('div', { class: 'panel', id: 'ma-tg' }, h('p', { class: 'muted' }, 'Notifikasi dikirim server ke grup/chat Telegram Super Admin saat pesanan dibuat, bukti masuk, diverifikasi, ditolak, kedaluwarsa, atau dibatalkan. Token bot disimpan di Secrets Supabase, bukan di aplikasi.'),
      tgBtn, tgOut,
      notes === null ? h('p', { class: 'hint ms-warn' }, 'Log notifikasi belum tersedia. Jalankan membership_v2.sql.') : h('div', { id: 'ma-notes' }, h('h4', {}, 'Log notifikasi terakhir'),
        ...(notes.length ? notes.map(n => h('div', { class: 'ma-nt' }, h('span', {}, (NK[n.kind] || n.kind) + (n.payload && n.payload.ref ? ' · ' + n.payload.ref : '') + ' · ' + M.fmtDateTime(n.created_at) + (n.last_error ? ' · ' + n.last_error : '')),
          h('span', { class: 'ms-st ' + (NS[n.status] || 'ms-off') }, n.status))) : [h('p', { class: 'hint' }, 'Belum ada notifikasi.')]),
        failed ? h('button', { class: 'btn-sm ghost mt', type: 'button', id: 'ma-tgretry', onclick: async () => { try { const k = await M.retryNotifications(); toast(k + ' notifikasi dijadwalkan ulang.'); M.pingNotify(); show(); } catch (e) { toast(M.errorText(e), true); } } }, 'Kirim ulang ' + failed + ' yang gagal') : ''));
    const histBox = hist && hist.length ? h('details', { class: 'panel', id: 'ma-phist' }, h('summary', {}, 'Histori perubahan harga'),
      ...hist.map(x => h('div', { class: 'ms-row' }, h('span', { class: 'muted' }, M.fmtDateTime(x.changed_at) + ' · ' + x.plan_code.replace('b', ' bulan')),
        h('b', {}, (x.old_price == null ? '-' : M.rp(x.old_price)) + ' → ' + (x.new_price == null ? '-' : M.rp(x.new_price)) + (x.old_active !== x.new_active ? (x.new_active ? ' · ditampilkan' : ' · disembunyikan') : ''))))) : '';
    frame(h('h3', {}, 'Paket'), h('p', { class: 'muted' }, 'Harga berlaku untuk transaksi baru. Transaksi lama menyimpan harga saat dipesan.'), ...plans.map(planCard), histBox,
      h('h3', {}, 'Notifikasi Telegram'), tgBox,
      h('h3', {}, 'Rekening pembayaran'), h('p', { class: 'muted' }, 'Isi hanya rekening resmi milik pengelola BAITUNA. Jamaah melihat rekening yang aktif.'), accounts.length ? h('div', { id: 'ma-accs' }, ...accounts.map(accRow)) : h('p', { class: 'muted', id: 'ma-noacc' }, 'Belum ada rekening.'), addAcc,
      h('h3', {}, 'QRIS, komisi, dan kontak'), h('div', { class: 'panel rform' },
        lab('QRIS resmi (gambar asli, maks. 500 KB)', 'ma-qfile'), qurl ? h('img', { class: 'ms-qimg', id: 'ma-qimg', src: qurl, alt: 'QRIS saat ini' }) : h('p', { class: 'hint', id: 'ma-noqris' }, 'QRIS belum diunggah. Jamaah akan diarahkan ke transfer bank.'), qfile,
        lab('Nama merchant (opsional)', 'ma-merchant'), merchant,
        lab('Persentase komisi masjid (%) — kosong bila belum disepakati', 'ma-pct'), pct,
        lab('WhatsApp admin untuk bantuan jamaah', 'ma-wa'), wa, lab('Catatan pembayaran', 'ma-note'), pnote, gerr, saveGen));
  }

  show();
}
