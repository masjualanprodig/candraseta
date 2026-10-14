// BAITUNA - audit-ui.js
// 4C. Jejak audit: hanya dibaca. Super Admin (semua, bisa saring masjid) atau Admin Masjid (masjidnya saja).
import { h } from './ui.js';
import * as A from './audit-service.js';

const fmt = iso => { try { return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (e) { return ''; } };
export const NOTE = 'Jejak ini otomatis dan tidak bisa diubah atau dihapus oleh siapa pun, termasuk admin.';

export async function renderAuditLog(box, { onBack, mosque = null, mosques = null } = {}) {
  // mosque: {id,name} untuk Admin Masjid (terkunci). mosques: daftar untuk saringan Super Admin.
  const st = { group: '', mosque: mosque ? mosque.id : '', rows: [], more: false, busy: false };
  const back = h('button', { class: 'btn-sm ghost', type: 'button', id: 'au-back', onclick: () => onBack && onBack() }, '← Kembali');
  const body = h('div', { id: 'au-list' });
  const moreBtn = h('button', { class: 'btn-sm ghost', type: 'button', id: 'au-more', hidden: 'hidden', onclick: () => load(true) }, 'Muat lebih lama');
  const status = h('p', { class: 'muted', id: 'au-status', role: 'status' }, '');
  const chips = h('div', { class: 'achips au-groups', id: 'au-groups', role: 'group', 'aria-label': 'Jenis catatan' });
  const paintChips = () => chips.replaceChildren(...A.GROUPS.map(([k, l]) => h('button', { class: 'achip', type: 'button', 'data-g': k, 'aria-pressed': String(st.group === k), onclick: () => { if (st.group !== k) { st.group = k; paintChips(); load(false); } } }, l)));
  const filters = [chips];
  if (!mosque && mosques) {
    const sel = h('select', { class: 'in', id: 'au-mosque', 'aria-label': 'Saring masjid' }, h('option', { value: '' }, 'Semua masjid dan tingkat platform'), ...mosques.map(m => h('option', { value: m.id }, m.name)));
    sel.addEventListener('change', () => { st.mosque = sel.value; load(false); });
    filters.push(sel);
  }
  const row = r => h('div', { class: 'panel au-row', 'data-action': r.action },
    h('div', { class: 'au-r1' }, h('b', { class: 'au-act' }, A.actionLabel(r.action)), h('span', { class: 'muted au-time' }, fmt(r.created_at))),
    h('div', { class: 'muted au-r2' }, (r.actor_name || 'Tanpa nama') + (r.actor_email ? ' (' + r.actor_email + ')' : '') + (r.mosque_name && !mosque ? ' · ' + r.mosque_name : (r.mosque_id ? '' : ' · tingkat platform'))),
    A.describe(r.details) ? h('div', { class: 'au-d' }, A.describe(r.details)) : '');
  async function load(append) {
    if (st.busy) return; st.busy = true; status.textContent = 'Memuat…'; moreBtn.hidden = true;
    const before = append && st.rows.length ? st.rows[st.rows.length - 1] : null;
    try {
      const got = await A.list({ mosque: st.mosque || null, group: st.group, before, limit: A.PAGE });
      st.rows = append ? st.rows.concat(got) : got; st.more = got.length >= A.PAGE;
      body.replaceChildren(...(st.rows.length ? st.rows.map(row) : [h('div', { class: 'empty', id: 'au-empty' }, h('p', { class: 'muted' }, 'Belum ada catatan.'))]));
      status.textContent = st.rows.length + ' catatan ditampilkan'; moreBtn.hidden = !st.more;
    } catch (e) {
      if (e && e.status === 401) { st.busy = false; return; }
      status.textContent = ''; body.replaceChildren(h('div', { class: 'panel', id: 'au-err' }, h('p', {}, A.errorText(e)), h('button', { class: 'btn-sm', type: 'button', id: 'au-retry', onclick: () => load(false) }, 'Coba lagi')));
    }
    st.busy = false;
  }
  paintChips();
  box.replaceChildren(back, h('h2', { class: 'mt' }, 'Jejak audit'), h('p', { class: 'muted' }, mosque ? mosque.name : 'Semua masjid dan tingkat platform'), ...filters, status, body, moreBtn, h('p', { class: 'hint' }, NOTE));
  await load(false);
}
