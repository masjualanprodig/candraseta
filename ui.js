// BAITUNA - ui.js
// Pembantu tampilan yang dipakai bersama: membuat elemen, toast, dialog konfirmasi.
export const $ = id => document.getElementById(id);

export const STATUS_LABEL = {
  draft: 'Draft', pending: 'Menunggu verifikasi', active: 'Aktif', rejected: 'Ditolak', suspended: 'Dinonaktifkan'
};

// Membuat elemen dengan aman: teks selalu lewat node teks (anti-XSS), bukan innerHTML.
export function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  Object.entries(props || {}).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  });
  kids.flat().forEach(c => e.append(c instanceof Node ? c : document.createTextNode(c == null ? '' : String(c))));
  return e;
}

export function toast(text, bad) {
  const t = $('toast');
  t.textContent = text; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 4000);
}

export const hint = e => (e && (e.status === 403 || e.code === '42501')) ? 'Anda tidak memiliki izin.' : 'Coba lagi.';

// Dialog konfirmasi untuk tindakan penting. Mengembalikan null (batal), true, atau teks alasan.
export function ask(cfg) {
  return new Promise(resolve => {
    const d = $('dlg'), ta = $('dlg-reason'), ok = $('dlg-ok'), no = $('dlg-no');
    $('dlg-title').textContent = cfg.title;
    $('dlg-text').textContent = cfg.text;
    ta.hidden = !cfg.reason; ta.value = ''; $('dlg-err').hidden = true;
    const finish = v => { ok.onclick = no.onclick = d.oncancel = null; if (d.open) d.close(); resolve(v); };
    no.onclick = () => finish(null);
    d.oncancel = () => finish(null);
    ok.onclick = () => {
      if (cfg.reason && ta.value.trim().length < 5) { $('dlg-err').hidden = false; return; }
      finish(cfg.reason ? ta.value.trim() : true);
    };
    d.showModal();
  });
}
