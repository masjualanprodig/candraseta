// BAITUNA - branding-ui.js (v71)
// Editor "Tampilan Aplikasi" khusus Super Admin: foto latar splash, font, dan ikon Akses Cepat.
import { h, ask } from './ui.js';
import * as B from './branding-service.js';
import { icon } from './feed-ui.js';

const SAMPLE = 'Satu Masjid, Banyak Manfaat';

export function renderBrandingEditor(box, onBack) {
  const status = h('p', { class: 'hint', id: 'br-status', role: 'status' }, '');
  const say = (t, bad) => { status.textContent = t || ''; status.className = 'hint' + (bad ? ' err' : ''); };
  let busy = false;
  const guard = async (okMsg, fn) => {
    if (busy) return; busy = true; say('Memproses…');
    try { await fn(); say(okMsg); } catch (e) { say(B.errorText(e), true); }
    busy = false; paint();
  };
  const fileBtn = (label, accept, onFile, id, cls) => {
    const input = h('input', { type: 'file', accept, id, class: 'br-file', 'aria-label': label });
    input.addEventListener('change', () => { const f = input.files && input.files[0]; input.value = ''; if (f) onFile(f); });
    return h('label', { class: cls || 'btn-sm' }, label, input);
  };

  /* ===== 1. Foto latar ===== */
  function bgSection() {
    const cfg = B.getCurrent(); const url = cfg.splash_bg && B.urlFor(cfg.splash_bg.path);
    const prev = h('div', { class: 'br-bg', id: 'br-bg-preview', 'data-custom': url ? '1' : '0', role: 'img', 'aria-label': 'Pratinjau latar splash' });
    if (url) prev.style.backgroundImage = 'url("' + url + '")';
    return h('section', { class: 'panel br-sec', id: 'br-sec-bg' },
      h('h3', {}, 'Foto latar splash'),
      h('p', { class: 'muted' }, 'Dipakai di halaman splash, masuk, dan daftar. Foto otomatis diperkecil dan data lokasi (EXIF) dibuang. Pakai foto yang gelap di bagian bawah agar tulisan tetap terbaca.'),
      prev,
      h('div', { class: 'br-row' },
        fileBtn(url ? 'Ganti foto' : 'Pilih foto', 'image/jpeg,image/png,image/webp', f => guard('Foto latar disimpan.', async () => { await B.setBackground(await B.prepareBackground(f)); }), 'br-bg-file'),
        url ? h('button', { class: 'btn-sm ghost', type: 'button', id: 'br-bg-reset', onclick: async () => { if (await ask({ title: 'Kembalikan foto bawaan?', text: 'Foto latar kembali ke bawaan BAITUNA.' })) guard('Foto bawaan dipakai lagi.', () => B.resetBackground()); } }, 'Kembalikan bawaan') : ''));
  }

  /* ===== 1b. Gambar banner & kartu beranda ===== */
  function artSection() {
    const arts = B.getCurrent().arts || {};
    return h('section', { class: 'panel br-sec', id: 'br-sec-art' },
      h('h3', {}, 'Gambar banner & kartu beranda'),
      h('p', { class: 'muted' }, 'Gambar dipakai di sisi kanan banner dan kartu beranda (otomatis diperkecil, data lokasi dibuang). Pakai gambar yang terang di sisi kanan; tulisan ada di sisi kiri. Pastikan Anda berhak memakai gambarnya.'),
      ...B.ART_SLOTS.map(([key, label]) => { const u = B.urlFor(arts[key]);
        return h('div', { class: 'br-art', 'data-key': key },
          h('div', { class: 'br-art-prev', 'data-custom': u ? '1' : '0', style: u ? 'background-image:url("' + u + '")' : '' }),
          h('div', { class: 'br-art-tx' }, h('b', {}, label),
            h('div', { class: 'br-row' },
              fileBtn(u ? 'Ganti' : 'Pilih gambar', 'image/jpeg,image/png,image/webp', f => guard('Gambar disimpan.', async () => { await B.setArt(key, await B.prepareBackground(f)); }), 'br-art-file-' + key),
              u ? h('button', { class: 'btn-sm ghost br-art-reset', type: 'button', onclick: async () => { if (await ask({ title: 'Hapus gambar ini?', text: 'Kembali ke tampilan bawaan.' })) guard('Gambar dikembalikan.', () => B.resetArt(key)); } }, 'Hapus') : ''))); }));
  }

  /* ===== 2. Font ===== */
  let pending = null;   // font yang sudah divalidasi, menunggu "Simpan"
  let sampleStyle = null;
  function fontSection() {
    const cfg = B.getCurrent(); const f = cfg.font;
    const sample = h('p', { class: 'br-sample', id: 'br-font-sample' }, SAMPLE + ' 0123456789');
    const label = h('p', { class: 'muted', id: 'br-font-name' }, pending ? 'Pratinjau: ' + pending.name + ' (belum disimpan)' : f ? 'Font aktif: ' + f.name : 'Font bawaan: Plus Jakarta Sans');
    if (pending) {
      if (!sampleStyle) { sampleStyle = document.createElement('style'); document.head.appendChild(sampleStyle); }
      const u = URL.createObjectURL(pending.blob);
      sampleStyle.textContent = '@font-face{font-family:"BT Preview";src:url("' + u + '") format("' + pending.format + '")}';
      sample.style.fontFamily = '"BT Preview",sans-serif';
    }
    return h('section', { class: 'panel br-sec', id: 'br-sec-font' },
      h('h3', {}, 'Font aplikasi'),
      h('p', { class: 'muted' }, 'Unggah berkas font .woff2, .woff, .ttf, atau .otf (maksimal 1,5 MB). Pastikan Anda berhak memakainya (lisensi). Font Al-Qur’an tidak ikut berubah agar bacaan tetap tepat.'),
      label, sample,
      h('div', { class: 'br-row' },
        fileBtn(f ? 'Ganti font' : 'Unggah font', '.woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf', async file => {
          if (busy) return; busy = true; say('Memeriksa font…');
          try { pending = await B.prepareFont(file); say('Font terbaca. Periksa pratinjau lalu tekan Simpan font.'); } catch (e) { pending = null; say(B.errorText(e), true); }
          busy = false; paint();
        }, 'br-font-file'),
        pending ? h('button', { class: 'btn-sm', type: 'button', id: 'br-font-save', onclick: () => { const p = pending; guard('Font disimpan.', async () => { await B.setFont(p); pending = null; }); } }, 'Simpan font') : '',
        pending ? h('button', { class: 'btn-sm ghost', type: 'button', id: 'br-font-cancel', onclick: () => { pending = null; say(''); paint(); } }, 'Batal') : '',
        f && !pending ? h('button', { class: 'btn-sm ghost', type: 'button', id: 'br-font-reset', onclick: async () => { if (await ask({ title: 'Kembalikan font bawaan?', text: 'Aplikasi memakai Plus Jakarta Sans lagi.' })) guard('Font bawaan dipakai lagi.', () => B.resetFont()); } }, 'Kembalikan bawaan') : ''));
  }

  /* ===== 3. Ikon Akses Cepat ===== */
  function iconSection() {
    const cfg = B.getCurrent(); const tiles = B.tileList();
    const rows = tiles.map(t => {
      const custom = cfg.icons[t.id];
      const src = document.querySelector('a.tile#' + t.id + ' svg.ic');
      const thumb = h('span', { class: 'br-thumb' });
      if (custom && B.urlFor(custom)) thumb.appendChild(h('img', { src: B.urlFor(custom), alt: '', class: 'ic-img' }));
      else if (src) { const c = src.cloneNode(true); c.removeAttribute('hidden'); thumb.appendChild(c); }
      else if (t.ic) thumb.appendChild(icon(t.ic));
      return h('li', { class: 'br-icon', 'data-key': t.id, 'data-custom': custom ? '1' : '0' },
        thumb, h('span', { class: 'br-label' }, t.label),
        fileBtn(custom ? 'Ganti' : 'Pilih', 'image/png,image/jpeg,image/webp,image/svg+xml,.svg', f => guard('Ikon “' + t.label + '” disimpan.', async () => { await B.setIcon(t.id, await B.prepareIcon(f)); }), null, 'btn-sm br-icon-pick'),
        custom ? h('button', { class: 'btn-sm ghost br-icon-reset', type: 'button', 'aria-label': 'Kembalikan ikon ' + t.label, onclick: () => guard('Ikon bawaan dipakai lagi.', () => B.resetIcon(t.id)) }, 'Bawaan') : '');
    });
    const any = Object.keys(cfg.icons).length > 0;
    return h('section', { class: 'panel br-sec', id: 'br-sec-icons' },
      h('h3', {}, 'Ikon Akses Cepat'),
      h('p', { class: 'muted' }, 'Ganti ikon tiap fitur. Pakai gambar persegi dengan latar transparan (PNG/WebP) atau SVG sederhana. Gambar diperkecil otomatis.'),
      h('ul', { class: 'br-icons', id: 'br-icons' }, ...rows),
      !tiles.length ? h('p', { class: 'muted' }, 'Daftar fitur belum tersedia.') : '',
      any ? h('div', { class: 'br-row' }, h('button', { class: 'btn-sm ghost', type: 'button', id: 'br-icons-reset', onclick: async () => { if (await ask({ title: 'Kembalikan semua ikon?', text: 'Semua ikon kembali ke bawaan.' })) guard('Semua ikon bawaan dipakai lagi.', () => B.resetAllIcons()); } }, 'Kembalikan semua ikon')) : '');
  }

  function paint() {
    box.replaceChildren(
      h('button', { class: 'btn-sm ghost', type: 'button', id: 'br-back', onclick: () => { if (sampleStyle) sampleStyle.remove(); onBack && onBack(); } }, '← Kembali'),
      h('h2', {}, 'Tampilan Aplikasi'),
      h('p', { class: 'muted' }, 'Khusus Super Admin. Perubahan berlaku untuk semua pengguna. Setiap perubahan tercatat di Jejak audit.'),
      status, bgSection(), artSection(), fontSection(), iconSection());
  }
  paint();
  B.fetchConfig().then(c => { if (c && !busy) { B.applyBranding(c); paint(); } });
}
