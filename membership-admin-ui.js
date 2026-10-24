// BAITUNA - membership-admin-ui.js
// Layar Super Admin untuk Membership (dibuka dari "Kelola Pustaka Buku"): verifikasi pembayaran, komisi masjid, dan pengaturan
// (paket, rekening, QRIS, persentase komisi, kontak admin). Izin dijaga server (RLS + fungsi); layar ini hanya antarmuka.
import { h, toast, ask } from './ui.js';
import * as M from './membership-service.js';

const tone = s => 'ms-st ms-' + ((M.STATUS[s] || {}).tone || 'off');
const row = (k, v) => h('div', { class: 'ms-row' }, h('span', { class: 'muted' }, k), h('b', {}, v));
const QRIS_MAX = 500 * 1024;

// ctx: { draw(...nodes), exit() }
export function membershipAdminPage(ctx) {
  const { draw } = ctx;
  const st = { tab: ctx.tab || 'verif', filter: 'menunggu_verifikasi' };
  const back = h('button', { class: 'btn-ghost bk-back', type: 'button', id: 'ma-back', onclick: () => ctx.exit() }, '← Kelola buku');
  const tabs = () => h('div', { class: 'mk-chips', id: 'ma-tabs', role: 'group', 'aria-label': 'Bagian' }, ...[['verif', 'Verifikasi'], ['komisi', 'Komisi'], ['atur', 'Pengaturan']].map(([k, l]) =>
    h('button', { class: 'mk-chip' + (st.tab === k ? ' on' : ''), type: 'button', id: 'ma-t-' + k, 'aria-pressed': String(st.tab === k), onclick: () => { st.tab = k; show(); } }, l)));
  const frame = (...k) => draw(back, h('h2', { class: 'wtitle' }, 'Membership'), tabs(), ...k);
  const fail = e => frame(h('p', { class: 'mk-err', id: 'ma-fail', role: 'alert' }, M.notReady(e) ? M.errorText(e) : M.errorText(e)));

  async function show() {
    frame(h('p', { class: 'muted', id: 'ma-loading' }, 'Memuat…'));
    try { if (st.tab === 'verif') await verif(); else if (st.tab === 'komisi') await komisi(); else await atur(); } catch (e) { fail(e); }
  }

  /* ===== Verifikasi pembayaran ===== */
  async function verif() {
    const [orders, set] = await Promise.all([M.adminOrders(st.filter), M.adminSettings()]);
    const chips = h('div', { class: 'mk-chips', id: 'ma-filter', role: 'group', 'aria-label': 'Status' }, ...[['menunggu_verifikasi', 'Menunggu'], ['disetujui', 'Disetujui'], ['ditolak', 'Ditolak'], ['', 'Semua']].map(([k, l]) =>
      h('button', { class: 'mk-chip' + (st.filter === k ? ' on' : ''), type: 'button', 'data-f': k, 'aria-pressed': String(st.filter === k), onclick: () => { st.filter = k; show(); } }, l)));
    const card = o => {
      const proof = h('div', { class: 'ms-proof' });
      const act = o.status === 'menunggu_verifikasi' ? h('div', { class: 'row-btns mt' },
        h('button', { class: 'btn-sm ma-ok', type: 'button', onclick: async () => {
          const warn = o.mosque_id && set.commission_pct == null ? '\n\nCatatan: persentase komisi belum diisi, jadi komisi masjid dicatat tanpa nominal.' : '';
          if (!(await ask({ title: 'Setujui pembayaran ini?', text: o.ref_code + ' · ' + o.full_name + ' · ' + M.rp(o.amount) + '. Membership langsung aktif dan tidak bisa dibatalkan dari sini.' + warn }))) return;
          try { await M.reviewOrder(o.id, true); toast('Disetujui. Membership aktif.'); show(); } catch (e) { toast(M.errorText(e), true); show(); }
        } }, 'Setujui'),
        h('button', { class: 'btn-sm alt ma-no', type: 'button', onclick: async () => {
          const reason = await ask({ title: 'Tolak pembayaran ini?', text: 'Tulis alasan agar jamaah bisa memperbaiki dan mengirim ulang bukti.', reason: true }); if (!reason) return;
          try { await M.reviewOrder(o.id, false, reason); toast('Ditolak.'); show(); } catch (e) { toast(M.errorText(e), true); show(); }
        } }, 'Tolak')) : '';
      const view = o.proof_path ? h('button', { class: 'btn-sm ghost ma-proof', type: 'button', onclick: async ev => {
        ev.target.disabled = true;
        try { const u = await M.proofBlobUrl(o.proof_path); proof.replaceChildren(h('a', { href: u, target: '_blank', rel: 'noopener' }, h('img', { class: 'ms-pv', src: u, alt: 'Bukti pembayaran ' + o.ref_code }))); ev.target.remove(); }
        catch (e) { toast('Bukti belum bisa dibuka.', true); ev.target.disabled = false; }
      } }, 'Lihat bukti') : h('span', { class: 'hint' }, 'Belum ada bukti');
      return h('div', { class: 'panel ms-ord', 'data-id': o.id, 'data-status': o.status },
        h('div', { class: 'ms-oh' }, h('b', {}, o.ref_code), h('span', { class: tone(o.status) }, M.statusLabel(o.status))),
        row('Nama', o.full_name), row('WhatsApp', M.phoneShow(o.phone)), row('Paket', o.plan_name), row('Nominal', M.rp(o.amount)), row('Masjid rujukan', o.mosque_name || 'Belum memilih'),
        row('Metode', o.method === 'qris' ? 'QRIS' : o.method === 'transfer' ? 'Transfer bank' : '-'), row('Dipesan', M.fmtDate(o.created_at)),
        o.status === 'disetujui' ? row('Masa aktif', M.fmtDate(o.starts_at) + ' – ' + M.fmtDate(o.ends_at)) : '',
        o.reject_reason ? h('p', { class: 'hint ms-warn' }, 'Alasan tolak: ' + o.reject_reason) : '', view, proof, act);
    };
    frame(chips, orders.length ? h('div', { id: 'ma-orders' }, ...orders.map(card)) : h('p', { class: 'muted', id: 'ma-empty' }, 'Tidak ada transaksi pada status ini.'));
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
    const [plans, accounts, set] = await Promise.all([M.listPlans(), M.adminAccounts(), M.adminSettings()]);
    const lab = (t, f) => h('label', { class: 'hint bk-lab', for: f }, t);
    // Paket
    const planCard = p => {
      const price = h('input', { class: 'in', id: 'ma-price-' + p.code, inputmode: 'numeric', maxlength: '12', placeholder: 'Belum ditetapkan' }); price.value = p.price == null ? '' : String(p.price);
      const act = h('input', { type: 'checkbox', id: 'ma-pact-' + p.code }); act.checked = !!p.active; const err = h('p', { class: 'mk-err', role: 'alert' }, '');
      return h('div', { class: 'panel', 'data-code': p.code }, h('b', {}, p.name), lab('Harga (Rp)', 'ma-price-' + p.code), price, h('label', { class: 'qa-check' }, act, ' Tampilkan paket ini'), err,
        h('button', { class: 'btn-sm', type: 'button', id: 'ma-psave-' + p.code, onclick: async () => {
          const v = M.parsePrice(price.value); if (v.error) { err.textContent = v.error; return; } err.textContent = '';
          try { await M.savePlan(p.id, { price: v.ok, active: act.checked }); toast('Paket disimpan.'); } catch (e) { err.textContent = M.errorText(e); }
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
    frame(h('h3', {}, 'Paket'), h('p', { class: 'muted' }, 'Harga 3 bulan belum ditetapkan; paket tidak bisa dibeli sampai harganya diisi.'), ...plans.map(planCard),
      h('h3', {}, 'Rekening pembayaran'), h('p', { class: 'muted' }, 'Isi hanya rekening resmi milik pengelola BAITUNA. Jamaah melihat rekening yang aktif.'), accounts.length ? h('div', { id: 'ma-accs' }, ...accounts.map(accRow)) : h('p', { class: 'muted', id: 'ma-noacc' }, 'Belum ada rekening.'), addAcc,
      h('h3', {}, 'QRIS, komisi, dan kontak'), h('div', { class: 'panel rform' },
        lab('QRIS resmi (gambar asli, maks. 500 KB)', 'ma-qfile'), qurl ? h('img', { class: 'ms-qimg', id: 'ma-qimg', src: qurl, alt: 'QRIS saat ini' }) : h('p', { class: 'hint', id: 'ma-noqris' }, 'QRIS belum diunggah. Jamaah akan diarahkan ke transfer bank.'), qfile,
        lab('Nama merchant (opsional)', 'ma-merchant'), merchant,
        lab('Persentase komisi masjid (%) — kosong bila belum disepakati', 'ma-pct'), pct,
        lab('WhatsApp admin untuk bantuan jamaah', 'ma-wa'), wa, lab('Catatan pembayaran', 'ma-note'), pnote, gerr, saveGen));
  }

  show();
}
