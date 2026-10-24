// BAITUNA - dzikir-sound.js
// Bunyi pendek untuk penghitung, dibuat langsung oleh peramban (Web Audio) - tanpa berkas audio.
// Hanya berbunyi setelah pengguna mengetuk (aturan peramban). Di iPhone, tombol senyap menutup bunyi ini.
let ctx = null;
const AC = () => (typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null);
export const canSound = () => !!AC();

function ready() {
  try {
    const C = AC(); if (!C) return null;
    ctx = ctx || new C();
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    return ctx;
  } catch (e) { return null; }
}
function tone(c, freq, start, dur, vol) {
  const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + start;
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.03);
}
// Detak pendek dan pelan untuk tiap ketukan.
export function tick() { const c = ready(); if (c) { try { tone(c, 1000, 0, 0.05, 0.06); } catch (e) {} } }
// Lonceng dua nada lembut saat target/bacaan selesai.
export function chime() { const c = ready(); if (c) { try { tone(c, 784, 0, 0.35, 0.18); tone(c, 1175, 0.18, 0.55, 0.16); } catch (e) {} } }

// Getar saat target tercapai (v168). Tidak ada di iPhone; di Android bergantung pengaturan HP/peramban. Hanya berjalan setelah ketukan.
export const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
export function buzz() { try { if (canVibrate()) navigator.vibrate([250, 120, 250, 120, 500]); } catch (e) { /* abaikan */ } }

// Tombol uji (v169): getar 0,6 detik lalu kembalikan teks hasil, agar terlihat apakah peramban menerima perintahnya.
export function testBuzz() {
  try {
    if (!canVibrate()) return 'Peramban ini tidak punya fitur getar.';
    const ok = navigator.vibrate(600);
    return ok ? 'Perintah getar diterima peramban. Bila HP tetap diam, penyebabnya ada di pengaturan HP (bukan aplikasi).' : 'Peramban menolak perintah getar (bisa karena izin situs, mode hemat baterai, atau pengaturan HP).';
  } catch (e) { return 'Perintah getar gagal: ' + (e && e.message ? e.message : 'tidak diketahui'); }
}
