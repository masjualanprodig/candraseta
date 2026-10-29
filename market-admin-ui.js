// BAITUNA - market-admin-ui.js (v209)
// Kelola Pasar Umat (Super Admin): verifikasi penjual + lihat KTP (tercatat di log), moderasi iklan, laporan,
// paket & harga langganan, pengaturan, kategori, dan log audit. Semua tindakan diperiksa ulang di server (mk_admin_*).
// Pembayaran langganan diverifikasi di panel Transaksi Membership (tabel pesanan yang sama, produk 'pasar').
import { h, toast, ask } from './ui.js';
import { publicPhotoUrl } from './supabase.js';
import { membershipAdminPage } from './membership-admin-ui.js';
import * as M from './market-service.js';

const when = iso => { try { return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
const TABS = [['verif', 'Verifikasi'], ['iklan', 'Moderasi'], ['laporan', 'Laporan'], ['paket', 'Paket & Harga'], ['atur', 'Pengaturan'], ['kategori', 'Kategori'], ['log', 'Log']];

export async function renderMarketManager(box, onBack, tabKey = 'verif') {
  const st = { tab: TABS.some(t => t[0] === tabKey) ? tabKey : tabKey === 'pending' ? 'iklan' : tabKey === 'reports' ? 'laporan' : 'verif', vf: 'menunggu', lf: 'pending', stats: null };
  const draw = (...k) => box.replaceChildren(...k);
  const back = () => onBack ? h('button', { class: 'btn-ghost pu-back', type: 'button', id: 'pa-back', onclick: onBack }, '← Kembali') : '';
  const btn = (t, cls, id, fn, extra) => h('button', Object.assign({ class: cls, type: 'button' }, id ? { id } : {}, extra || {}, { onclick: fn }), t);
  const chip = (t, tone) => h('span', { class: 'pu-chip pu-' + (tone || 'off') }, t);
  const row = (l, v) => h('div', { class: 'pu-row' }, h('span', { class: 'muted' }, l), h('b', {}, v == null || v === '' ? '-' : String(v)));
  const tabs = () => h('div', { class: 'pu-filters pa-tabs', id: 'pa-tabs', role: 'group', 'aria-label': 'Bagian' }, ...TABS.map(([k, l]) => {
    const n = st.stats ? { verif: st.stats.verif_wait, iklan: st.stats.pending, laporan: st.stats.reports }[k] : 0;
    return btn(l + (n ? ' (' + n + ')' : ''), 'pu-fchip' + (st.tab === k ? ' on' : ''), 'pa-t-' + k, () => { st.tab = k; show(); }, { 'aria-pressed': String(st.tab === k) });
  }));
  const frame = (...k) => draw(back(), h('h2', { class: 'wtitle' }, 'Kelola Pasar Umat'), statsBox(), tabs(), ...k);
  function statsBox() {
    const s = st.stats; if (!s) return '';
    return h('div', { class: 'pu-stats pa-stats', id: 'pa-stats' }, ...[['Menunggu verifikasi', s.verif_wait], ['Iklan menunggu', s.pending], ['Iklan tayang', s.live], ['Langganan aktif', s.subs], ['Bayar menunggu', s.orders_wait]]
      .map(([l, n]) => h('div', { class: 'panel pu-stat' }, h('b', {}, String(n || 0)), h('span', { class: 'muted' }, l))));
  }
  const run = async (fn, ok) => { try { await fn(); toast(ok); show(); } catch (e) { toast(M.errorText(e), true); } };
  async function reason(title, text) { return ask({ title, text: text || 'Tulis alasan yang jelas (5–300 huruf). Alasan ini terlihat oleh penjual.', reason: true }); }

  async function show() {
    frame(h('p', { class: 'muted', id: 'pa-loading' }, 'Memuat…'));
    try {
      st.stats = await M.admin.stats();
      if (st.tab === 'verif') await verif(); else if (st.tab === 'iklan') await listings(); else if (st.tab === 'laporan') await reports();
      else if (st.tab === 'paket') await plansTab(); else if (st.tab === 'atur') await settingsTab(); else if (st.tab === 'kategori') await catsTab(); else await logTab();
    } catch (e) {
      draw(back(), h('h2', { class: 'wtitle' }, 'Kelola Pasar Umat'), h('div', { class: 'empty', id: 'pa-fail' }, h('p', { class: 'muted' }, M.errorText(e)),
        M.notReady(e) ? '' : btn('Coba lagi', 'btn-sm', 'pa-retry', show)));
    }
  }

  /* ===== Verifikasi penjual ===== */
  async function verif() {
    const rows = await M.admin.verifications(st.vf);
    const filt = h('div', { class: 'pu-filters', id: 'pa-vf' }, ...[['menunggu', 'Menunggu'], ['perbaikan', 'Perlu perbaikan'], ['disetujui', 'Disetujui'], ['ditolak', 'Ditolak'], ['', 'Semua']].map(([k, l]) =>
      btn(l, 'pu-fchip' + (st.vf === k ? ' on' : ''), 'pa-vf-' + (k || 'all'), () => { st.vf = k; show(); })));
    frame(filt, h('p', { class: 'hint' }, 'KTP hanya dibuka bila perlu. Setiap pembukaan KTP tercatat di log audit.'),
      rows.length ? h('div', { id: 'pa-vlist' }, ...rows.map(vRow)) : h('p', { class: 'muted', id: 'pa-vnone' }, 'Tidak ada pengajuan.'));
  }
  function vRow(v) {
    const ktpBox = h('div', { class: 'pa-ktp', id: 'pa-ktp-' + v.user_id });
    return h('article', { class: 'panel pa-item', 'data-user': v.user_id },
      h('div', { class: 'pu-qhead' }, h('b', {}, v.store_name || '-'), chip(M.VERIF_STATUS[v.status] || v.status, v.status === 'disetujui' ? 'ok' : v.status === 'menunggu' ? 'wait' : 'warn')),
      row('Nama sesuai KTP', v.full_name), row('WhatsApp', M.waDisplay(v.whatsapp)), row('Lokasi', [v.district, v.regency, v.province].join(', ')), row('Email akun', v.email),
      row('Dikirim', when(v.submitted_at)), v.note ? row('Catatan', v.note) : '', v.seller_status === 'suspended' ? row('Toko', 'Ditangguhkan: ' + (v.seller_reason || '-')) : '',
      ktpBox,
      h('div', { class: 'pu-row-btns' },
        btn('Lihat KTP', 'btn-sm ghost', 'pa-ktpb-' + v.user_id, async e => {
          e.target.disabled = true;
          try { const path = await M.admin.ktpPath(v.user_id); const url = await M.ktpBlobUrl(path); ktpBox.replaceChildren(h('img', { class: 'pa-ktpimg', src: url, alt: 'KTP ' + v.full_name }), h('p', { class: 'hint' }, 'Jangan menyimpan atau membagikan gambar KTP.')); }
          catch (x) { ktpBox.replaceChildren(h('p', { class: 'pu-err' }, 'KTP belum bisa dibuka. ' + M.errorText(x))); e.target.disabled = false; }
        }),
        v.status !== 'disetujui' ? btn('Setujui', 'btn-sm', 'pa-ok-' + v.user_id, async () => {
          if (!(await ask({ title: 'Setujui penjual?', text: 'Pastikan nama di KTP cocok dengan data. Setelah disetujui, penjual dapat memasang iklan; produk lamanya mendapat slot sesuai kuota.' }))) return;
          run(() => M.admin.verify(v.user_id, 'setujui'), 'Penjual disetujui.');
        }) : '',
        v.status === 'menunggu' ? btn('Minta perbaikan', 'btn-sm ghost', 'pa-fix-' + v.user_id, async () => { const r = await reason('Minta perbaikan data?'); if (r) run(() => M.admin.verify(v.user_id, 'perbaikan', r), 'Permintaan perbaikan dikirim.'); }) : '',
        v.status === 'menunggu' ? btn('Tolak', 'btn-sm alt', 'pa-rej-' + v.user_id, async () => { const r = await reason('Tolak pengajuan?'); if (r) run(() => M.admin.verify(v.user_id, 'tolak', r), 'Pengajuan ditolak.'); }) : '',
        v.seller_id ? btn(v.seller_status === 'suspended' ? 'Pulihkan toko' : 'Tangguhkan toko', 'btn-sm ghost', 'pa-sus-' + v.user_id, async () => {
          if (v.seller_status === 'suspended') { run(() => M.admin.suspend(v.seller_id, false), 'Toko dipulihkan.'); return; }
          const r = await reason('Tangguhkan toko?', 'Semua iklan toko ini tidak tayang selama ditangguhkan. Tulis alasannya (terlihat oleh penjual).'); if (r) run(() => M.admin.suspend(v.seller_id, true, r), 'Toko ditangguhkan.');
        }) : ''));
  }

  /* ===== Moderasi iklan ===== */
  async function listings() {
    const rows = await M.admin.listings(st.lf);
    const filt = h('div', { class: 'pu-filters', id: 'pa-lf' }, ...[['pending', 'Menunggu'], ['revision', 'Perlu perbaikan'], ['approved', 'Aktif'], ['rejected', 'Ditolak'], ['blocked', 'Dinonaktifkan'], ['', 'Semua']].map(([k, l]) =>
      btn(l, 'pu-fchip' + (st.lf === k ? ' on' : ''), 'pa-lf-' + (k || 'all'), () => { st.lf = k; show(); })));
    frame(filt, rows.length ? h('div', { id: 'pa-llist' }, ...rows.map(lRow)) : h('p', { class: 'muted', id: 'pa-lnone' }, 'Tidak ada iklan.'));
  }
  function lRow(p) {
    const urls = (p.photos || []).map(x => publicPhotoUrl(x, M.MARKET_BUCKET));
    return h('article', { class: 'panel pa-item', 'data-id': p.id },
      urls.length ? h('div', { class: 'pa-photos' }, ...urls.map((u, i) => h('img', { src: u, alt: p.title + ' foto ' + (i + 1), loading: 'lazy' }))) : '',
      h('div', { class: 'pu-qhead' }, h('b', {}, p.title), chip(M.LISTING_STATUS[p.status] || p.status, M.listingTone(p))),
      row('Harga', M.priceText(p.price, p.price_note)), row('Kategori', M.catLabel(p.category) + (p.condition ? ' · ' + p.condition : '')), row('Lokasi', M.place(p)),
      row('Toko', (p.store_name || '-') + (p.verified ? ' (terverifikasi)' : ' (BELUM terverifikasi)') + (p.seller_status === 'suspended' ? ' · ditangguhkan' : '')),
      row('Slot', p.slot === 'free' ? 'Iklan gratis' : p.slot === 'paid' ? 'Langganan' : 'Belum ada'), p.reports ? row('Laporan terbuka', p.reports) : '',
      p.halal_note ? row('Keterangan halal', p.halal_note) : '', ...M.DETAIL_FIELDS.filter(([k]) => p.details && p.details[k]).map(([k, l]) => row(l, p.details[k])),
      p.address ? row('Patokan', p.address) : '', p.status_reason ? row('Alasan', p.status_reason) : '',
      h('details', {}, h('summary', {}, 'Deskripsi'), h('p', { class: 'pu-desc' }, p.description)),
      h('div', { class: 'pu-row-btns' },
        ['pending', 'revision', 'blocked'].includes(p.status) ? btn('Setujui', 'btn-sm', 'pa-lok-' + p.id, () => run(() => M.admin.moderate(p.id, 'setujui'), 'Iklan disetujui.')) : '',
        ['pending', 'approved'].includes(p.status) ? btn('Minta perbaikan', 'btn-sm ghost', 'pa-lfix-' + p.id, async () => { const r = await reason('Minta perbaikan iklan?'); if (r) run(() => M.admin.moderate(p.id, 'perbaikan', r), 'Permintaan perbaikan dikirim.'); }) : '',
        p.status === 'pending' ? btn('Tolak', 'btn-sm alt', 'pa-lrej-' + p.id, async () => { const r = await reason('Tolak iklan?'); if (r) run(() => M.admin.moderate(p.id, 'tolak', r), 'Iklan ditolak.'); }) : '',
        p.status !== 'blocked' ? btn('Nonaktifkan (melanggar)', 'btn-sm alt', 'pa-lblk-' + p.id, async () => { const r = await reason('Nonaktifkan iklan?', 'Iklan berhenti tayang dan penjual tidak dapat mengaktifkannya. Tulis alasannya.'); if (r) run(() => M.admin.moderate(p.id, 'blokir', r), 'Iklan dinonaktifkan.'); }) : ''));
  }

  /* ===== Laporan ===== */
  async function reports() {
    const rows = await M.admin.reports();
    frame(rows.length ? h('div', { id: 'pa-rlist' }, ...rows.map(r => h('article', { class: 'panel pa-item', 'data-id': r.id },
      h('div', { class: 'pu-qhead' }, h('b', {}, r.title), chip(M.reasonLabel(r.reason), 'warn')), row('Toko', r.store_name), row('Status iklan', M.LISTING_STATUS[r.product_status] || r.product_status),
      r.note ? row('Keterangan', r.note) : '', row('Dilaporkan', when(r.created_at)),
      h('div', { class: 'pu-row-btns' }, btn('Buka di Moderasi', 'btn-sm ghost', null, () => { st.tab = 'iklan'; st.lf = ''; show(); }),
        btn('Tandai selesai', 'btn-sm', 'pa-rdone-' + r.id, () => run(() => M.admin.reportDone(r.id), 'Laporan ditandai selesai.'))))))
      : h('p', { class: 'muted', id: 'pa-rnone' }, 'Tidak ada laporan terbuka.'));
  }

  /* ===== Paket & harga ===== */
  async function plansTab() {
    const s = await M.state();
    const cards = (s.plans || []).map(p => {
      const nm = h('input', { class: 'in', id: 'pa-pn-' + p.code, maxlength: '60' }); nm.value = p.name;
      const pr = h('input', { class: 'in', id: 'pa-pp-' + p.code, inputmode: 'numeric', maxlength: '9' }); pr.value = String(p.price);
      const qu = h('input', { class: 'in', id: 'pa-pq-' + p.code, inputmode: 'numeric', maxlength: '3' }); qu.value = String(p.quota);
      const ds = h('input', { class: 'in', id: 'pa-pd-' + p.code, maxlength: '300' }); ds.value = p.description || '';
      const so = h('input', { class: 'in', id: 'pa-ps-' + p.code, inputmode: 'numeric', maxlength: '3' }); so.value = String(s.plans.indexOf(p) + 1);
      const fe = h('input', { type: 'checkbox', id: 'pa-pf-' + p.code }); fe.checked = !!p.featured;
      const ac = h('input', { type: 'checkbox', id: 'pa-pa-' + p.code }); ac.checked = p.active !== false;
      const lab = (t, el, id) => h('label', { class: 'pu-lab', for: id }, t, el);
      return h('article', { class: 'panel pa-item pa-plan', 'data-code': p.code }, h('b', {}, p.code.toUpperCase()),
        lab('Nama paket', nm, nm.id), lab('Harga per bulan (Rp)', pr, pr.id), lab('Kuota iklan aktif', qu, qu.id), lab('Deskripsi singkat', ds, ds.id), lab('Urutan', so, so.id),
        h('label', { class: 'pu-check' }, fe, h('span', {}, 'Tandai "Populer"')), h('label', { class: 'pu-check' }, ac, h('span', {}, 'Paket aktif (tampil untuk dibeli)')),
        btn('Simpan paket', 'btn-sm', 'pa-psave-' + p.code, async () => {
          const body = { name: nm.value, price: Number(String(pr.value).replace(/\D/g, '')), quota: Number(String(qu.value).replace(/\D/g, '')), description: ds.value, sort: Number(so.value) || 1, featured: fe.checked, active: ac.checked };
          const why = await ask({ title: 'Simpan perubahan paket?', text: 'Harga & kuota baru hanya berlaku untuk pesanan baru. Pesanan dan langganan yang sudah dibuat tidak berubah. Tulis alasan perubahan (untuk log).', reason: true });
          if (!why) return;
          run(() => M.admin.plan(p.code, { ...body, reason: why }), 'Paket disimpan.');
        }));
    });
    frame(h('p', { class: 'hint' }, 'Harga minimal Rp1.000, kuota 1–500 iklan. Paket nonaktif tidak bisa dibeli; langganan yang berjalan tetap berlaku sampai habis.'),
      ...cards, btn('Buka Transaksi (verifikasi pembayaran)', 'btn-sm ghost', 'pa-trx', () => membershipAdminPage({ draw, tab: 'trx', backLabel: '← Kelola Pasar Umat', exit: show })));
  }

  /* ===== Pengaturan ===== */
  async function settingsTab() {
    const s = await M.state();
    const open = h('input', { type: 'checkbox', id: 'pa-s-open' }); open.checked = s.open !== false;
    const free = h('input', { type: 'checkbox', id: 'pa-s-free' }); free.checked = s.free_enabled !== false;
    const promo = h('input', { type: 'checkbox', id: 'pa-s-promo' }); promo.checked = !!s.promo_on;
    const pq = h('input', { class: 'in', id: 'pa-s-pq', inputmode: 'numeric', maxlength: '2' }); pq.value = String(s.promo_quota || 10);
    const mp = h('input', { class: 'in', id: 'pa-s-photos', inputmode: 'numeric', maxlength: '2' }); mp.value = String(s.max_photos);
    const kb = h('input', { class: 'in', id: 'pa-s-kb', inputmode: 'numeric', maxlength: '4' }); kb.value = String(s.max_photo_kb);
    frame(h('div', { class: 'panel pu-form', id: 'pa-settings' },
      h('label', { class: 'pu-check' }, open, h('span', {}, 'Terima penjual dan iklan baru')),
      h('label', { class: 'pu-check' }, promo, h('span', {}, 'Mode gratis (promo): penjual terverifikasi boleh memasang iklan tanpa berlangganan')),
      h('label', { class: 'pu-lab', for: 'pa-s-pq' }, 'Batas iklan aktif per penjual selama mode gratis (1–50)', pq),
      h('label', { class: 'pu-check' }, free, h('span', {}, 'Aktifkan iklan pertama gratis (satu kali per penjual; berlaku saat mode gratis mati)')),
      h('label', { class: 'pu-lab', for: 'pa-s-photos' }, 'Batas jumlah foto per iklan (1–10)', mp),
      h('label', { class: 'pu-lab', for: 'pa-s-kb' }, 'Ukuran maksimum per foto setelah diperkecil (50–1000 KB)', kb),
      btn('Simpan pengaturan', 'btn-sm', 'pa-s-save', async () => {
        const off = s.promo_on && !promo.checked, lower = Number(pq.value) < (s.promo_quota || 10);
        if ((off || lower) && !(await ask({ title: off ? 'Matikan mode gratis?' : 'Perkecil kuota mode gratis?', text: off ? 'Iklan yang dipasang gratis tidak akan tayang (tidak dihapus) sampai penjual berlangganan. Lanjutkan?' : 'Iklan aktif yang melebihi kuota baru akan dinonaktifkan otomatis (yang terbaru dulu, tidak dihapus). Lanjutkan?' }))) return;
        run(() => M.admin.settings({ open: open.checked, promo_on: promo.checked, promo_quota: Number(pq.value), free_enabled: free.checked, max_photos: Number(mp.value), max_photo_kb: Number(kb.value) }), 'Pengaturan disimpan.');
      })),
      h('p', { class: 'hint' }, 'Mematikan iklan gratis tidak mencabut iklan gratis yang sudah tayang. Mematikan mode gratis membuat iklan yang dipasang gratis berhenti tayang (tidak dihapus) sampai penjual berlangganan.'));
  }

  /* ===== Kategori ===== */
  async function catsTab() {
    const s = await M.state();
    frame(h('p', { class: 'hint' }, 'Ubah nama, urutan, atau sembunyikan kategori. Kategori yang disembunyikan tidak bisa dipilih untuk iklan baru; iklan lama tetap ada.'),
      ...(s.categories || []).map((c, i) => {
        const nm = h('input', { class: 'in', id: 'pa-cn-' + c.key, maxlength: '40' }); nm.value = c.name;
        const so = h('input', { class: 'in pa-sort', id: 'pa-cs-' + c.key, inputmode: 'numeric', maxlength: '3' }); so.value = String(i + 1);
        const ac = h('input', { type: 'checkbox', id: 'pa-ca-' + c.key }); ac.checked = c.active !== false; if (c.key === 'lainnya') ac.disabled = true;
        return h('div', { class: 'panel pa-cat', 'data-key': c.key }, nm, so, h('label', { class: 'pu-check' }, ac, h('span', {}, 'Aktif')),
          btn('Simpan', 'btn-sm', 'pa-csave-' + c.key, () => run(() => M.admin.category(c.key, { name: nm.value, sort: Number(so.value) || 100, active: ac.checked }), 'Kategori disimpan.')));
      }));
  }

  /* ===== Log audit ===== */
  async function logTab() {
    const rows = await M.admin.audit(150);
    const metaText = m => {
      if (!m || typeof m !== 'object') return '';
      if (m.alasan) return 'Alasan: ' + m.alasan;
      if (m.lama && m.baru) return 'Lama: ' + JSON.stringify(m.lama) + ' → Baru: ' + JSON.stringify(m.baru) + (m.alasan ? '' : m.reason ? ' · ' + m.reason : '');
      if (m.paket) return 'Paket ' + m.paket + ' · kuota ' + m.kuota;
      return '';
    };
    frame(h('p', { class: 'hint' }, 'Catatan tindakan penting di Pasar Umat. Isi log tidak memuat file KTP.'),
      rows.length ? h('div', { class: 'panel', id: 'pa-log' }, ...rows.map(r => h('div', { class: 'pa-logrow' }, h('b', {}, M.AUDIT_LABEL[r.action] || r.action),
        h('span', { class: 'muted' }, when(r.created_at) + ' · ' + (r.actor || 'sistem')), metaText(r.meta) ? h('span', { class: 'hint' }, metaText(r.meta)) : '')))
        : h('p', { class: 'muted' }, 'Belum ada catatan.'));
  }

  show();
}
