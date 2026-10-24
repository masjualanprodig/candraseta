// BAITUNA - dzikir-import.js
// Impor banyak bacaan Dzikir Pagi & Petang dari Excel (.xlsx). Murni (tanpa DOM, tanpa jaringan) agar bisa diuji terpisah.
// Pembaca/penulis .xlsx memakai doa-import.js. Tidak ada teks doa/dzikir/sumber yang dibuat di sini;
// contoh pada template hanya penanda (placeholder) dan baris penanda ditolak saat impor. Validasi mengikuti dzikir.sql.
import { SESSIONS } from './dzikir-service.js';
import { LIMIT, fmtSize, readXlsx, sheetXml, listVal, buildWorkbook, normArabic } from './doa-import.js';

export { LIMIT, fmtSize };
export const SHEET = 'Dzikir';
export const HEADERS = [
  ['sesi', 'Sesi', true], ['jenis', 'Jenis', true], ['judul', 'Judul', false], ['teks_arab', 'Teks Arab', true], ['latin', 'Latin', false],
  ['terjemahan', 'Terjemahan', true], ['sumber', 'Sumber', true], ['catatan', 'Catatan', false], ['jumlah', 'Jumlah bacaan', true], ['urutan', 'Urutan', false],
  ['surah', 'Surah', false], ['ayat_dari', 'Ayat dari', false], ['ayat_sampai', 'Ayat sampai', false]];
export const readDhikrXlsx = bytes => readXlsx(bytes, SHEET.toLowerCase());
const WIDTHS = [12, 10, 26, 48, 30, 48, 34, 30, 16, 10, 9, 10, 12];

export function buildTemplate() {
  const head = HEADERS.map(([, label, req]) => ({ t: label + (req ? ' *' : ''), s: req ? 1 : 2 }));
  const ses = Object.keys(SESSIONS);
  const data = sheetXml([head], { widths: WIDTHS, freeze: true, validations: '<dataValidations count="2">' + listVal('A2:A1001', ses) + listVal('B2:B1001', ['teks', 'ayat']) + '</dataValidations>' });
  const ex = a => a.map(t => ({ t, s: 3 }));
  const contoh = sheetXml([head,
    ex(['keduanya', 'teks', '(judul bacaan, boleh kosong)', '(tempel teks Arab berharakat dari sumber yang sudah diperiksa)', '(teks Latin, boleh kosong)', '(terjemahan bahasa Indonesia dari sumber yang sama)', '(perawi dan nomor hadis, mis. HR. ... no. ...)', '(catatan, boleh kosong)', '1', '10', '', '', '']),
    ex(['pagi', 'ayat', '(judul rujukan ayat, boleh kosong)', '', '', '', '', '', '1', '20', '112', '1', '4'])], { widths: WIDTHS });
  const tips = [
    ['PETUNJUK PENGISIAN (lembar ini tidak diimpor)'],
    ['1. Isi data hanya di lembar "' + SHEET + '", mulai baris 2. Jangan mengubah nama kolom di baris 1. Lembar "Contoh" hanya gambaran bentuk isian.'],
    ['2. Kolom bertanda * wajib untuk jenis teks: Sesi, Jenis, Teks Arab, Terjemahan, Sumber (perawi dan nomor), Jumlah bacaan.'],
    ['3. Sesi: pagi, petang, atau keduanya (tampil di kedua tab). Jenis: teks (doa/dzikir yang Anda ketik) atau ayat (rujukan ayat Al-Qur\'an).'],
    ['4. Jumlah bacaan: angka 1 sampai 1000 sesuai riwayat yang dirujuk. Bila riwayat tidak menyebut jumlah, isi 1. Aplikasi tidak menebak jumlah.'],
    ['5. Jenis ayat: isi Surah (1-114), Ayat dari, Ayat sampai (maksimal 6 ayat berurutan). Teks Arab, Latin, dan Terjemahan DIKOSONGKAN karena teks ayat diambil otomatis dari layanan Al-Qur\'an.'],
    ['6. Isi teks, sumber, dan jumlah hanya dari rujukan yang sudah Anda periksa, dan sebaiknya ditinjau ustaz. Aplikasi tidak memeriksa kesahihan hadis.'],
    ['7. Urutan (boleh kosong): angka kecil tampil lebih dulu. Kosong = 100.'],
    ['8. Batas: maksimal ' + LIMIT.rows + ' baris dan ' + fmtSize(LIMIT.bytes) + ' per berkas. Format .xlsx (Google Sheets: Berkas > Unduh > Microsoft Excel). Rumus tidak dihitung; tulis nilai biasa.'],
    ['9. Data yang tampaknya sudah ada (teks Arab sama di sesi yang sama, atau ayat yang sama) dilewati, tidak menimpa data lama. Baris contoh yang belum diganti akan ditolak.']].map(r => r.map(t => ({ t, s: 3 })));
  return buildWorkbook([[SHEET, data], ['Contoh', contoh], ['Petunjuk', sheetXml(tips, { widths: [140] })]]);
}

/* ===== normalisasi, pemetaan, validasi ===== */
const key = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ALIAS = { sesi: 'sesi', waktu: 'sesi', jenis: 'jenis', judul: 'judul', teksarab: 'teks_arab', arab: 'teks_arab', latin: 'latin', tekslatin: 'latin',
  terjemahan: 'terjemahan', terjemahanindonesia: 'terjemahan', sumber: 'sumber', sumberhadis: 'sumber', catatan: 'catatan', keterangan: 'catatan',
  jumlahbacaan: 'jumlah', jumlah: 'jumlah', urutan: 'urutan', surah: 'surah', surat: 'surah', ayatdari: 'ayat_dari', ayatawal: 'ayat_dari', ayatsampai: 'ayat_sampai', ayatakhir: 'ayat_sampai' };
const sesBy = (() => { const m = new Map(); for (const [k, l] of Object.entries(SESSIONS)) { m.set(key(k), k); m.set(key(l), k); } return m; })();
const clean = v => v == null ? '' : String(v).replace(/\u0000/g, '').trim();
const intOf = s => /^\d{1,5}$/.test(s) ? Number(s) : (/^\d{1,5}\.0+$/.test(s) ? Number(s.split('.')[0]) : NaN);
// Kunci duplikat: ayat yang sama di sesi yang sama, atau teks Arab (tanpa harakat) yang sama di sesi yang sama.
export const dupKeys = r => {
  if (r.kind === 'ayat') return ['a:' + r.session + ':' + r.surah + ':' + r.ayah_from + '-' + r.ayah_to];
  const a = normArabic(r.arabic); return a.length >= 3 ? ['t:' + r.session + ':' + a] : [];
};
const placeholder = (title, arab) => /^contoh\b/i.test(title) || /^\(.*\)$/.test(arab);

export function analyze(rows, existing = []) {
  const res = { total: 0, items: [], errors: [], fatal: null, valid: 0, bad: 0, dup: 0 };
  if (!rows.length) { res.fatal = 'Berkas kosong. Isi data di lembar "' + SHEET + '" mulai baris 2.'; return res; }
  const map = {};
  (rows[0].cells || []).forEach((c, i) => { const k = ALIAS[key(c)]; if (k && !(k in map)) map[k] = i; });
  const need = ['sesi', 'jenis', 'jumlah'].filter(k => !(k in map));
  if (need.length) { res.fatal = 'Kolom wajib tidak ditemukan di baris 1: ' + need.join(', ') + '. Gunakan template Dzikir dan jangan ubah nama kolom.'; return res; }
  const body = rows.slice(1).filter(r => (r.cells || []).some(c => clean(c) !== ''));
  if (!body.length) { res.fatal = 'Berkas tidak berisi data. Isi bacaan mulai baris 2 pada lembar "' + SHEET + '".'; return res; }
  if (body.length > LIMIT.rows) { res.fatal = 'Jumlah baris (' + body.length + ') melebihi batas ' + LIMIT.rows + ' per berkas. Bagi menjadi beberapa berkas.'; return res; }
  const seen = new Map(); for (const e of existing) for (const k of dupKeys(e)) if (!seen.has(k)) seen.set(k, 'sudah ada di database');
  for (const row of body) {
    const g = k => (k in map ? clean(row.cells[map[k]]) : ''); const rn = row.r, errs = [], it = { row: rn, status: 'valid' }; res.total++;
    const len = (k, v, max, nm) => { if (v.length > max) errs.push([k, nm + ' terlalu panjang (maks. ' + max + ' karakter).']); };
    const ses = sesBy.get(key(g('sesi')));
    if (!g('sesi')) errs.push(['sesi', 'Sesi wajib diisi.']); else if (!ses) errs.push(['sesi', 'Sesi tidak dikenali: ' + g('sesi').slice(0, 30) + ' (isi pagi, petang, atau keduanya).']);
    const jr = key(g('jenis')); let kind = 'teks';
    if (jr === '' || ['teks', 'doa', 'dzikir', 'hadits', 'hadis'].includes(jr)) kind = 'teks'; else if (['ayat', 'quran', 'alquran'].includes(jr)) kind = 'ayat'; else errs.push(['jenis', 'Jenis tidak dikenali (isi teks atau ayat).']);
    const f = { session: ses || '', kind, title: g('judul'), source: g('sumber'), note: g('catatan'), target_count: 1, sort_order: 100 };
    len('judul', f.title, 150, 'Judul'); len('sumber', f.source, 500, 'Sumber'); len('catatan', f.note, 1000, 'Catatan');
    const jm = g('jumlah'), n = jm === '' ? 1 : intOf(jm);
    if (!(n >= 1 && n <= 1000)) errs.push(['jumlah', 'Jumlah bacaan harus angka 1 sampai 1000.']); else f.target_count = n;
    const ur = g('urutan'); if (ur !== '') { const u = intOf(ur); if (!(u >= 0 && u <= 9999)) errs.push(['urutan', 'Urutan harus angka 0 sampai 9999.']); else f.sort_order = u; }
    if (kind === 'teks') {
      Object.assign(f, { arabic: g('teks_arab'), latin: g('latin'), body: g('terjemahan') });
      if (f.arabic.length < 3) errs.push(['teks_arab', 'Teks Arab wajib diisi.']); len('teks_arab', f.arabic, 4000, 'Teks Arab'); len('latin', f.latin, 4000, 'Latin');
      if (f.body.length < 3) errs.push(['terjemahan', 'Terjemahan wajib diisi.']); len('terjemahan', f.body, 4000, 'Terjemahan');
      if (f.source.length < 3) errs.push(['sumber', 'Sumber wajib diisi (perawi dan nomor hadis, atau nama kitab).']);
      if (g('surah') || g('ayat_dari') || g('ayat_sampai')) errs.push(['surah', 'Kolom surah/ayat hanya untuk jenis ayat.']);
      if (placeholder(f.title, f.arabic)) errs.push(['teks_arab', 'Ini baris contoh/penanda yang belum diganti. Isi dengan data asli atau hapus barisnya.']);
    } else {
      const sr = intOf(g('surah')), a1 = intOf(g('ayat_dari')), a2 = g('ayat_sampai') === '' ? a1 : intOf(g('ayat_sampai'));
      if (!(sr >= 1 && sr <= 114)) errs.push(['surah', 'Nomor surah harus 1 sampai 114.']);
      if (!(a1 >= 1 && a1 <= 286)) errs.push(['ayat_dari', 'Ayat dari harus angka 1 sampai 286.']);
      else if (!(a2 >= a1 && a2 <= 286)) errs.push(['ayat_sampai', 'Ayat sampai tidak boleh lebih kecil dari ayat dari.']);
      else if (a2 - a1 > 5) errs.push(['ayat_sampai', 'Maksimal 6 ayat berurutan.']);
      if (g('teks_arab') || g('latin') || g('terjemahan')) errs.push(['teks_arab', 'Untuk ayat, teks Arab, Latin, dan Terjemahan dikosongkan (diambil otomatis).']);
      Object.assign(f, { surah: sr, ayah_from: a1, ayah_to: a2 });
      if (/^contoh\b/i.test(f.title)) errs.push(['judul', 'Ini baris contoh yang belum diganti. Isi dengan data asli atau hapus barisnya.']);
    }
    if (errs.length) { it.status = 'error'; it.errors = errs; res.bad++; for (const [col, msg] of errs) res.errors.push({ row: rn, col, msg }); }
    else {
      const keys = dupKeys(f); let why = null; for (const k of keys) if (seen.has(k)) { why = seen.get(k); break; }
      if (why) { it.status = 'dup'; res.dup++; res.errors.push({ row: rn, col: '', msg: 'Data diduga sudah ada (' + why + ').', dup: true }); }
      else { for (const k of keys) seen.set(k, 'sama dengan baris ' + rn); res.valid++; }
    }
    it.f = f; res.items.push(it);
  }
  return res;
}
// Semua baris HARUS punya kunci yang sama (PostgREST menolak impor massal bila kunci antar-baris berbeda).
export function toPayload(f) {
  const ayat = f.kind === 'ayat';
  return { session: f.session, kind: f.kind, title: f.title || null, source: f.source || null, note: f.note || null, target_count: f.target_count, sort_order: f.sort_order,
    arabic: ayat ? null : f.arabic, latin: ayat ? null : (f.latin || null), body: ayat ? null : f.body,
    surah: ayat ? f.surah : null, ayah_from: ayat ? f.ayah_from : null, ayah_to: ayat ? f.ayah_to : null };
}
