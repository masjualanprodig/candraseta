// BAITUNA - router.js
// Router sederhana: menampilkan satu halaman (view) dan menyembunyikan yang lain.
const VIEWS = ['splash', 'login', 'reset', 'app'];

export function show(name) {
  if (!VIEWS.includes(name)) name = 'login';
  VIEWS.forEach(v => { document.getElementById('view-' + v).hidden = v !== name; });
  window.scrollTo(0, 0);
}
