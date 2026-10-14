// BAITUNA - jamaah-ui.js
// 4B. Untuk pengguna: ajukan diri sebagai jamaah (di Profil). Untuk Super Admin: setujui atau tolak.
import { h, toast, ask } from './ui.js';
import * as J from './jamaah-service.js';

const fmt = iso => { try { return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
export const INFO = 'Pendaftaran jamaah membantu pengelola menjaga Tanya Jawab tetap tertib. Yang kami simpan: nama, nomor telepon (bila Anda isi), email akun, masjid pilihan, dan catatan Anda. Hanya admin pusat yang dapat melihat dan memutuskannya.';

/* ===== Di Profil: status dan formulir pengajuan ===== */
export function jamaahPanel({ name, role } = {}) {
  const box = h('div', { class: 'panel jm', id: 'jm-panel' }, h('p', { class: 'muted' }, 'Memuat…'));
  async function draw() {
    let s, mosques = [];
    try { s = await J.myStatus(); } catch (e) { if (e && e.status === 401) return; box.replaceChildren(h('p', {}, J.errorText(e)), h('button', { class: 'btn-sm', type: 'button', id: 'jm-retry', onclick: draw }, 'Coba lagi')); return; }
    const head = [h('h3', {}, 'Keanggotaan jamaah'), h('p', { class: 'muted' }, INFO)];
    if (s && s.status === 'approved') { box.replaceChildren(...head, h('p', { class: 'jm-state ok', id: 'jm-state' }, '✓ Disetujui' + (s.decided_at ? ' · ' + fmt(s.decided_at) : '')), h('p', { class: 'muted' }, 'Anda dapat mengajukan pertanyaan di Tanya Jawab.')); return; }
    if (s && s.status === 'pending') { box.replaceChildren(...head, h('p', { class: 'jm-state wait', id: 'jm-state' }, 'Menunggu persetujuan · diajukan ' + fmt(s.requested_at)), h('p', { class: 'muted' }, 'Admin pusat akan memeriksa pendaftaran Anda. Buka halaman ini lagi nanti untuk melihat hasilnya.')); return; }
    if (!s && role && role.approved) { box.replaceChildren(...head, h('p', { class: 'jm-state ok', id: 'jm-state' }, 'Anda sudah dapat bertanya karena berperan sebagai pengurus atau penjawab. Pendaftaran jamaah tidak diperlukan.')); return; }
    if (s && !J.canReapply(s)) { box.replaceChildren(...head, h('p', { class: 'jm-state no', id: 'jm-state' }, 'Ditolak' + (s.reject_reason ? ': ' + s.reject_reason : '')), h('p', { class: 'muted' }, 'Batas pendaftaran ulang tercapai. Hubungi admin pusat lewat Kritik & Saran.')); return; }
    try { mosques = await J.activeMosques(); } catch (e) { /* pilihan masjid opsional */ }
    const sel = h('select', { class: 'in', id: 'jm-mosque', 'aria-label': 'Masjid pilihan' }, h('option', { value: '' }, 'Masjid tempat Anda biasa beribadah (opsional)'), ...mosques.map(m => h('option', { value: m.id }, m.name + (m.city ? ' · ' + m.city : ''))));
    const note = h('textarea', { class: 'in', id: 'jm-note', rows: '3', maxlength: String(J.LIMIT.noteMax), placeholder: 'Catatan singkat untuk admin (opsional), mis. warga RT 3' });
    const err = h('p', { class: 'mk-err', id: 'jm-err', role: 'alert' }, '');
    const btn = h('button', { class: 'btn-primary', type: 'submit', id: 'jm-submit' }, s ? 'Ajukan ulang' : 'Ajukan sebagai jamaah');
    let busy = false;
    const form = h('form', { class: 'rform', novalidate: 'novalidate' }, sel, note, err, btn);
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); if (busy) return;
      const v = J.checkApply({ name, note: note.value }); if (v.error) { err.textContent = v.error; return; }
      err.textContent = ''; busy = true; btn.disabled = true;
      try { await J.apply(sel.value || null, v.ok.note); toast('Pendaftaran terkirim.'); await draw(); return; }
      catch (e) { if (e && e.status === 401) return; err.textContent = J.errorText(e); }
      busy = false; btn.disabled = false;
    });
    box.replaceChildren(...head, s && s.status === 'rejected' ? h('p', { class: 'jm-state no', id: 'jm-state' }, 'Pendaftaran sebelumnya ditolak' + (s.reject_reason ? ': ' + s.reject_reason : '') + '. Anda boleh mengajukan ulang (' + s.attempts + ' dari ' + J.LIMIT.tries + ').') : '', form);
  }
  draw();
  return box;
}

/* ===== Super Admin: antrean pendaftaran ===== */
export async function renderJamaahManager(box, onBack) {
  const st = { tab: 'pending' };
  const back = h('button', { class: 'btn-sm ghost', type: 'button', id: 'jm-back', onclick: () => onBack && onBack() }, '← Kembali');
  async function show(tab) {
    st.tab = tab;
    const tabs = h('div', { class: 'seg', id: 'jm-tabs', role: 'tablist', 'aria-label': 'Status pendaftaran' }, ...J.TABS.map(([k, l]) =>
      h('button', { class: 'segb', type: 'button', role: 'tab', 'data-tab': k, 'aria-selected': String(st.tab === k), onclick: () => { if (st.tab !== k) show(k); } }, l)));
    const frame = (...kids) => { box.replaceChildren(back, h('h2', { class: 'mt' }, 'Pendaftaran jamaah'), h('p', { class: 'muted' }, 'Hanya Super Admin yang dapat menyetujui atau menolak.'), tabs, ...kids); window.scrollTo(0, 0); };
    frame(h('p', { class: 'muted', id: 'jm-loading' }, 'Memuat…'));
    let rows;
    try { rows = await J.queue(tab); } catch (e) { if (e && e.status === 401) return; frame(h('div', { class: 'panel' }, h('p', {}, J.errorText(e)), h('button', { class: 'btn-sm', type: 'button', id: 'jm-retry', onclick: () => show(tab) }, 'Coba lagi'))); return; }
    const card = r => {
      const acts = [];
      const go = async (approve) => {
        let reason = null;
        if (approve) { if (!(await ask({ title: 'Setujui jamaah ini?', text: (r.full_name || r.email) + ' akan dapat mengajukan pertanyaan di Tanya Jawab.' }))) return; }
        else { reason = await ask({ title: r.status === 'approved' ? 'Cabut persetujuan?' : 'Tolak pendaftaran?', text: 'Tulis alasan singkat. Pengguna akan membacanya.', reason: true }); if (!reason) return; if (!J.checkReason(reason)) { toast('Alasan 3 sampai 200 huruf.', true); return; } }
        try { await J.decide(r.user_id, approve, reason); toast(approve ? 'Jamaah disetujui.' : 'Keputusan tersimpan.'); await show(st.tab); } catch (e) { toast(J.errorText(e), true); }
      };
      if (r.status !== 'approved') acts.push(h('button', { class: 'btn-sm jm-approve', type: 'button', onclick: () => go(true) }, 'Setujui'));
      if (r.status !== 'rejected') acts.push(h('button', { class: 'btn-sm alt jm-reject', type: 'button', onclick: () => go(false) }, r.status === 'approved' ? 'Cabut' : 'Tolak'));
      return h('div', { class: 'panel jm-row', 'data-id': r.user_id },
        h('b', { class: 'jm-name' }, r.full_name || 'Tanpa nama'),
        h('div', { class: 'muted' }, r.email + (r.phone ? ' · ' + r.phone : '')),
        h('div', { class: 'muted' }, (r.mosque_name ? 'Masjid: ' + r.mosque_name + ' · ' : '') + 'diajukan ' + fmt(r.requested_at) + (r.attempts > 1 ? ' · pengajuan ke-' + r.attempts : '')),
        r.note ? h('p', { class: 'jm-note' }, '“' + r.note + '”') : '',
        r.reject_reason ? h('p', { class: 'hint' }, 'Alasan: ' + r.reject_reason) : '',
        acts.length ? h('div', { class: 'qa-acts' }, ...acts) : '');
    };
    frame(...(rows.length ? rows.map(card) : [h('div', { class: 'empty', id: 'jm-empty' }, h('p', { class: 'muted' }, tab === 'pending' ? 'Tidak ada pendaftaran yang menunggu.' : 'Belum ada data.'))]));
  }
  await show('pending');
}
