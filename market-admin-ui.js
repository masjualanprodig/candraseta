// BAITUNA - market-admin-ui.js
// Verifikasi Pasar Umat oleh Super Admin: setujui / tolak produk (alasan wajib), tangguhkan penjual, tinjau laporan jamaah.
import { h, toast, hint, ask } from './ui.js';
import { publicPhotoUrl } from './supabase.js';
import * as M from './market-service.js';

const msgOf = e => e && e.status === 0 ? 'Tidak ada koneksi internet.' : 'Belum berhasil. ' + hint(e);
const notReady = e => e && (e.code === '42P01' || e.code === 'PGRST205' || e.status === 404);
const when = iso => { try { return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

export async function renderMarketManager(box, onBack, tabKey = 'pending') {
  const back = onBack ? h('button', { class: 'btn-sm ghost', type: 'button', onclick: onBack }, '← Kembali ke dashboard') : '';
  box.replaceChildren(back, h('div', { class: 'panel center' }, h('p', {}, 'Memuat…')));
  const reload = (k = tabKey) => renderMarketManager(box, onBack, k);
  let pending, approved, rejected, reports;
  try { [pending, approved, rejected, reports] = await Promise.all([M.adminListProducts('pending'), M.adminListProducts('approved'), M.adminListProducts('rejected'), M.adminListReports()]); }
  catch (e) {
    box.replaceChildren(back, h('div', { class: 'panel center' }, h('p', {}, notReady(e) ? 'Pasar Umat belum aktif: jalankan pasar.sql di Supabase SQL Editor.' : 'Data belum bisa dimuat. Periksa koneksi, lalu coba lagi.'),
      notReady(e) ? '' : h('button', { class: 'btn-sm', type: 'button', onclick: () => reload() }, 'Coba lagi')));
    return;
  }
  const openReports = reports.filter(r => r.status === 'open');
  const TABS = [['pending', 'Menunggu', pending.length], ['reports', 'Laporan', openReports.length], ['approved', 'Tayang', approved.length], ['rejected', 'Ditolak', rejected.length]];

  const act = (fn, okMsg) => async () => { try { await fn(); toast(okMsg); reload(); } catch (e) { toast(msgOf(e), true); } };
  async function reject(p, title) {
    const reason = await ask({ title: title || 'Tolak produk?', text: 'Tulis alasan yang jelas agar penjual bisa memperbaiki. Alasan ini terlihat oleh penjual.', reason: true }); if (!reason) return;
    try { await M.adminSetProduct(p.id, 'rejected', reason); toast('Produk ditolak.'); reload(); } catch (e) { toast(msgOf(e), true); }
  }
  async function suspend(s) {
    if (!s) return;
    if (s.status === 'suspended') { try { await M.adminSetSeller(s.id, false); toast('Penjual diaktifkan kembali.'); reload(); } catch (e) { toast(msgOf(e), true); } return; }
    const reason = await ask({ title: 'Tangguhkan penjual?', text: 'Semua produk penjual ini akan hilang dari katalog. Tulis alasannya (terlihat oleh penjual).', reason: true }); if (!reason) return;
    try { await M.adminSetSeller(s.id, true, reason); toast('Penjual ditangguhkan.'); reload(); } catch (e) { toast(msgOf(e), true); }
  }

  function productRow(p, mode) {
    const s = p.seller, urls = (p.photos || []).map(x => publicPhotoUrl(x, M.MARKET_BUCKET));
    return h('article', { class: 'panel mk-adm', 'data-id': p.id },
      urls.length ? h('div', { class: 'mk-admph' }, ...urls.map((u, i) => h('img', { class: 'mk-admimg', src: u, alt: p.title + ' (foto ' + (i + 1) + ')', loading: 'lazy' }))) : '',
      h('div', { class: 'mk-chips1' }, h('span', { class: 'mk-badge' }, M.catLabel(p.category)), p.available === false ? h('span', { class: 'mk-badge out' }, 'Stok habis') : ''),
      h('h3', {}, p.title), h('p', { class: 'mk-price' }, M.priceText(p.price, p.price_note)),
      h('p', { class: 'mk-desc' }, p.description),
      p.address ? h('p', { class: 'mk-fine' }, 'Alamat: ' + p.address) : '',
      h('p', { class: 'mk-halal' }, 'Pernyataan halal: ' + (p.halal_declared ? 'dicentang penjual' : 'TIDAK dicentang') + (p.halal_note ? '. Keterangan: ' + p.halal_note : '. (tanpa keterangan)')),
      s ? h('div', { class: 'mk-sinfo' }, h('b', {}, s.name), ' · ' + (s.city || 'kota tidak diisi'), h('br'), 'WA: ' + M.waDisplay(s.whatsapp) + (s.other_contact ? ' · ' + s.other_contact : ''),
        s.status === 'suspended' ? h('p', { class: 'mk-warn' }, 'Penjual ditangguhkan: ' + (s.status_reason || '')) : '') : '',
      p.status === 'rejected' && p.status_reason ? h('p', { class: 'mk-why' }, 'Alasan penolakan: ' + p.status_reason) : '',
      h('p', { class: 'mk-fine' }, 'Diajukan ' + when(p.created_at) + (p.approved_at ? ' · disetujui ' + when(p.approved_at) : '')),
      h('div', { class: 'mk-rowact' },
        p.status !== 'approved' ? h('button', { class: 'btn-sm', type: 'button', 'data-act': 'approve', onclick: act(() => M.adminSetProduct(p.id, 'approved'), 'Produk disetujui dan tayang.') }, 'Setujui') : '',
        p.status !== 'rejected' ? h('button', { class: 'btn-sm alt', type: 'button', 'data-act': 'reject', onclick: () => reject(p, p.status === 'approved' ? 'Turunkan produk?' : 'Tolak produk?') }, p.status === 'approved' ? 'Turunkan' : 'Tolak') : '',
        s ? h('button', { class: 'btn-sm ghost', type: 'button', 'data-act': 'suspend', onclick: () => suspend(s) }, s.status === 'suspended' ? 'Aktifkan penjual' : 'Tangguhkan penjual') : ''));
  }

  function reportRow(r) {
    const p = r.product;
    return h('article', { class: 'panel mk-adm', 'data-id': r.id },
      h('b', {}, p ? p.title : '(produk sudah dihapus)'), h('p', { class: 'mk-why' }, M.reasonLabel(r.reason)), r.note ? h('p', { class: 'mk-desc' }, r.note) : '',
      h('p', { class: 'mk-fine' }, when(r.created_at) + (p ? ' · status produk: ' + (M.STATUS_LABEL[p.status] || p.status) : '') + ' · ' + (r.status === 'open' ? 'belum ditangani' : 'selesai')),
      h('div', { class: 'mk-rowact' },
        r.status === 'open' ? h('button', { class: 'btn-sm', type: 'button', 'data-act': 'handled', onclick: act(() => M.adminHandleReport(r.id, true), 'Laporan ditandai selesai.') }, 'Tandai selesai') : h('button', { class: 'btn-sm ghost', type: 'button', onclick: act(() => M.adminHandleReport(r.id, false), 'Dibuka kembali.') }, 'Buka lagi'),
        p && p.status === 'approved' ? h('button', { class: 'btn-sm alt', type: 'button', 'data-act': 'takedown', onclick: () => reject(p, 'Turunkan produk?') }, 'Turunkan produk') : ''));
  }

  const tabs = h('div', { class: 'zk-tabs', role: 'tablist' }, ...TABS.map(([k, l, n]) => h('button', { class: 'zk-tab' + (tabKey === k ? ' on' : ''), type: 'button', role: 'tab', 'data-t': k, 'aria-selected': String(tabKey === k), onclick: () => reload(k) }, l + ' (' + n + ')')));
  const list = tabKey === 'reports' ? reports : tabKey === 'approved' ? approved : tabKey === 'rejected' ? rejected : pending;
  const items = tabKey === 'reports' ? list.map(reportRow) : list.map(p => productRow(p));
  box.replaceChildren(back, h('h2', {}, 'Verifikasi Pasar Umat'),
    h('p', { class: 'muted' }, 'Periksa kelayakan produk (halal, sah, jujur, pantas). Ini bukan sertifikasi halal. Tolak dengan alasan yang jelas.'),
    tabs, ...(items.length ? items : [h('div', { class: 'panel center' }, h('p', { class: 'muted' }, tabKey === 'pending' ? 'Tidak ada produk yang menunggu verifikasi.' : 'Belum ada data.'))]));
}
