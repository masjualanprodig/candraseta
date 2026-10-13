// BAITUNA - saran-ui.js
// Halaman Kritik & Saran: deskripsi singkat + formulir (nama, email, pesan). Pesan disimpan di server dan diteruskan ke email Super Admin
// lewat fungsi "baituna-push" (aksi feedback). Tanpa akun. Draf tidak disimpan di perangkat.
import { h, toast } from './ui.js';
import { CONFIG } from './config.js';

export const FN_URL = CONFIG.SUPABASE_URL + '/functions/v1/baituna-push';
export const LIMIT = { nameMin: 2, nameMax: 80, msgMin: 10, msgMax: 2000, emailMax: 120 };
const EMAIL = /^[^\s@<>()\[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const oneLine = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim();

// Hasil: { ok:{name,email,message} } | { error, field }
export function check(v) {
  const name = oneLine(v.name), email = oneLine(v.email), message = String(v.message == null ? '' : v.message).replace(/\r\n?/g, '\n').trim();
  if (name.length < LIMIT.nameMin || name.length > LIMIT.nameMax) return { error: 'Nama ' + LIMIT.nameMin + ' sampai ' + LIMIT.nameMax + ' huruf. Nama panggilan boleh.', field: 'name' };
  if (email.length > LIMIT.emailMax || !EMAIL.test(email)) return { error: 'Alamat email belum benar. Contoh: nama@contoh.com', field: 'email' };
  if (message.length < LIMIT.msgMin) return { error: 'Tulis kritik atau saran minimal ' + LIMIT.msgMin + ' huruf.', field: 'message' };
  if (message.length > LIMIT.msgMax) return { error: 'Kritik dan saran maksimal ' + LIMIT.msgMax + ' huruf.', field: 'message' };
  return { ok: { name, email, message } };
}

// Hasil: { ok:true } | { ok:false, status, error, field }
export async function send(f, website = '') {
  try {
    const r = await fetch(FN_URL, { method: 'POST', headers: { 'content-type': 'application/json', apikey: CONFIG.SUPABASE_ANON_KEY }, body: JSON.stringify({ action: 'feedback', ...f, website }) });
    let j = null; try { j = await r.json(); } catch (e) { /* abaikan */ }
    if (r.ok && j && j.ok) return { ok: true };
    return { ok: false, status: r.status, error: j && j.error, field: j && j.field };
  } catch (e) { return { ok: false, status: 0 }; }
}
const failText = r => r.status === 0 ? 'Tidak ada koneksi. Pesan Anda masih ada di formulir; coba lagi saat online.'
  : r.status === 400 && r.error ? r.error
  : r.status === 429 ? (r.error || 'Terlalu banyak kiriman. Coba lagi nanti.')
  : r.status === 404 || r.status === 503 ? 'Kotak saran belum aktif di server. Pengelola perlu menjalankan saran.sql dan memperbarui fungsi baituna-push. Pesan Anda masih ada di formulir.'
  : 'Belum terkirim. Coba lagi sebentar lagi; pesan Anda masih ada di formulir.';

export function saranPage({ name = '', email = '' } = {}) {
  const wrap = h('div', { class: 'saran' });
  let busy = false;
  const nm = h('input', { class: 'in', id: 'sr-name', maxlength: String(LIMIT.nameMax), autocomplete: 'name', placeholder: 'Nama atau nama panggilan' }); nm.value = name || '';
  const em = h('input', { class: 'in', id: 'sr-email', type: 'email', maxlength: String(LIMIT.emailMax), autocomplete: 'email', inputmode: 'email', placeholder: 'nama@contoh.com' }); em.value = email || '';
  const msg = h('textarea', { class: 'in tall sr-msg', id: 'sr-msg', maxlength: String(LIMIT.msgMax), rows: '8', placeholder: 'Tulis kritik, saran, atau kendala yang Anda alami…' });
  const count = h('span', { class: 'hint', id: 'sr-count' }, '0 / ' + LIMIT.msgMax);
  const hp = h('input', { type: 'text', id: 'sr-web', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
  const err = h('p', { class: 'mk-err', id: 'sr-err', role: 'alert' }, '');
  const btn = h('button', { class: 'btn-primary', type: 'submit', id: 'sr-send' }, 'Kirim');
  msg.addEventListener('input', () => { count.textContent = msg.value.length + ' / ' + LIMIT.msgMax; });
  const form = h('form', { class: 'panel sr-form', novalidate: 'novalidate' },
    h('label', { class: 'hint', for: 'sr-name' }, 'Nama'), nm,
    h('label', { class: 'hint', for: 'sr-email' }, 'Email (agar pengelola bisa membalas)'), em,
    h('label', { class: 'hint', for: 'sr-msg' }, 'Kritik dan saran'), msg,
    h('div', { class: 'sr-foot' }, count),
    h('div', { class: 'sr-hp', 'aria-hidden': 'true' }, h('label', {}, 'Jangan diisi', hp)),
    err, btn,
    h('p', { class: 'hint' }, 'Nama, email, dan pesan disimpan di server BAITUNA dan diteruskan ke email pengelola. Alamat IP tidak disimpan utuh (hanya sidik satu arah untuk membatasi spam). Jangan menulis kata sandi, nomor kartu, atau data sensitif lain.'));
  const done = name => h('div', { class: 'panel sr-done', id: 'sr-done', role: 'status' }, h('h3', {}, 'Terima kasih, ' + name + '.'),
    h('p', { class: 'muted' }, 'Kritik dan saran Anda sudah kami terima dan akan dibaca pengelola BAITUNA. Jika perlu dibalas, balasan dikirim ke email yang Anda isi.'),
    h('button', { class: 'btn-sm', type: 'button', id: 'sr-again', onclick: () => { msg.value = ''; count.textContent = '0 / ' + LIMIT.msgMax; err.textContent = ''; draw(false); } }, 'Kirim masukan lain'));
  form.addEventListener('submit', async ev => {
    ev.preventDefault(); if (busy) return;
    const v = check({ name: nm.value, email: em.value, message: msg.value });
    if (v.error) { err.textContent = v.error; ({ name: nm, email: em, message: msg })[v.field].focus(); return; }
    err.textContent = ''; busy = true; btn.disabled = true; btn.textContent = 'Mengirim…';
    const r = await send(v.ok, hp.value);
    busy = false; btn.disabled = false; btn.textContent = 'Kirim';
    if (r.ok) { toast('Terkirim. Terima kasih!'); nm.value = v.ok.name; em.value = v.ok.email; draw(true, v.ok.name); return; }
    err.textContent = failText(r);
  });
  function draw(ok, who) { wrap.replaceChildren(h('h2', { class: 'wtitle' }, 'Kritik & Saran'), ...(ok ? [done(who)] : [h('div', { class: 'panel' }, h('p', {}, 'Aplikasi ini kami bangun untuk kemaslahatan umat, dan masukan Anda sangat berarti. Sampaikan kritik, saran, atau kendala yang Anda temui; pesan Anda dibaca langsung oleh pengelola BAITUNA. Tidak perlu akun.')), form])); }
  draw(false);
  return wrap;
}
