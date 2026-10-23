// BAITUNA - sunnah-import.js
// Impor banyak Amalan Sunnah Harian dari Excel (.xlsx). Murni (tanpa DOM, tanpa jaringan) agar bisa diuji terpisah.
// Pembaca/penulis .xlsx memakai doa-import.js. Tidak ada teks amalan/sumber/derajat yang dibuat di sini;
// contoh pada template hanya penanda (placeholder). Validasi mengikuti batasan tabel sunnah_items (sunnah.sql).
import { SLOTS, GRADES } from './sunnah-service.js';
import { REMINDER_KEYS } from './sunnah-link.js';
import { LIMIT, fmtSize, readXlsx, sheetXml, listVal, buildWorkbook, normArabic } from './doa-import.js';

export { LIMIT, fmtSize };
export const SHEET = 'Amalan';
export const HEADERS = [
  ['waktu', 'Waktu', true], ['judul_amalan', 'Judul amalan', true], ['penjelasan', 'Penjelasan', true],
  ['teks_arab', 'Teks Arab', false], ['teks_latin', 'Teks Latin', false], ['sumber', 'Sumber (perawi dan nomor)', true],
  ['derajat_hadis', 'Derajat hadis', true], ['penilai_derajat', 'Keterangan derajat (penilai dan kitab)', true],
  ['keterangan', 'Keterangan singkat', false], ['terkait_pengingat', 'Terkait pengingat', false]];
export const readSunnahXlsx = bytes => readXlsx(bytes, SHEET.toLowerCase());

const WIDTHS = [16, 30, 44, 36, 32, 30, 14, 36, 28, 30];
export function buildTemplate() {
  const head = HEADERS.map(([k, , req]) => ({ t: k, s: req ? 1 : 2 }));
  const slots = Object.values(SLOTS), grades = Object.values(GRADES), rems = Object.values(REMINDER_KEYS);
  const data = sheetXml([head], { widths: WIDTHS, freeze: true,
    validations: '<dataValidations count="2">' + listVal('A2:A1001', slots) + listVal('G2:G1001', grades) + '</dataValidations>' });
  const ex = a => a.map(t => ({ t, s: 3 }));
  const contoh = sheetXml([head,
    ex([slots[0], '(judul amalan)', '(penjelasan amalan dalam bahasa Indonesia, minimal 10 huruf)', '(teks Arab bila berupa doa/dzikir, boleh kosong)', '(teks Latin, boleh kosong)', '(perawi dan nomor hadis, mis. HR. ... no. ...)', grades[0], '(nama ulama penilai + judul kitab + nomor)', '(catatan, boleh kosong)', '']),
    ex([slots[2], '(judul amalan)', '(penjelasan amalan)', '', '', '(perawi dan nomor hadis)', grades[1], '(penilai derajat dan kitab)', '', rems.find(x => /Dhuha/.test(x)) || ''])], { widths: WIDTHS });
  const tips = [
    ['PETUNJUK PENGISIAN (lembar ini tidak diimpor)'],
    ['1. Isi data hanya di lembar "' + SHEET + '", mulai baris 2. Jangan mengubah nama kolom di baris 1. Lembar "Contoh" hanya gambaran bentuk isian.'],
    ['2. Kolom berwarna hijau tua WAJIB: waktu, judul_amalan, penjelasan, sumber, derajat_hadis, penilai_derajat.'],
    ['3. waktu: pilih dari daftar (' + slots.join(', ') + '). Ini hanya pengelompokan tampilan, bukan batas waktu ibadah.'],
    ['4. derajat_hadis: hanya ' + grades.join(' atau ') + '. Hadis lemah tidak boleh dimuat. penilai_derajat diisi siapa yang menilai dan di kitab apa.'],
    ['5. Aplikasi tidak menentukan derajat hadis. Isi sumber dan derajat hanya dari rujukan yang sudah Anda periksa, dan sebaiknya ditinjau ustaz.'],
    ['6. terkait_pengingat (boleh kosong): isi persis salah satu dari: ' + rems.join('; ') + '. Isinya tampil di Notifikasi dan Kalender untuk pengingat itu.'],
    ['7. Panjang: judul 3-150 huruf, penjelasan 10-4000 huruf, sumber dan keterangan derajat 3-500 huruf, keterangan singkat maks. 1000 huruf.'],
    ['8. Batas: maksimal ' + LIMIT.rows + ' baris dan ' + fmtSize(LIMIT.bytes) + ' per berkas. Format .xlsx (Google Sheets: Berkas > Unduh > Microsoft Excel). Rumus tidak dihitung; tulis nilai biasa.'],
    ['9. Data yang tampaknya sudah ada (judul sama di waktu yang sama, atau teks Arab sama) dilewati, tidak menimpa data lama.']].map(r => r.map(t => ({ t, s: 3 })));
  return buildWorkbook([[SHEET, data], ['Contoh', contoh], ['Petunjuk', sheetXml(tips, { widths: [140] })]]);
}

/* ===== normalisasi, pemetaan, validasi ===== */
const key = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ALIAS = { waktu: 'waktu', slot: 'waktu', judulamalan: 'judul_amalan', judul: 'judul_amalan', penjelasan: 'penjelasan', isi: 'penjelasan',
  teksarab: 'teks_arab', arab: 'teks_arab', tekslatin: 'teks_latin', latin: 'teks_latin', sumber: 'sumber', sumberhadis: 'sumber',
  derajathadis: 'derajat_hadis', derajat: 'derajat_hadis', penilaiderajat: 'penilai_derajat', penilai: 'penilai_derajat', keteranganderajat: 'penilai_derajat',
  keterangan: 'keterangan', keterangansingkat: 'keterangan', terkaitpengingat: 'terkait_pengingat', pengingat: 'terkait_pengingat' };
const mapOf = obj => { const m = new Map(); for (const [k, l] of Object.entries(obj)) { m.set(key(k), k); m.set(key(l), k); } return m; };
const slotBy = mapOf(SLOTS), gradeBy = mapOf(GRADES), remBy = mapOf(REMINDER_KEYS);
const normTitle = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
export const dupKeys = r => { const out = ['j:' + r.time_slot + '|' + normTitle(r.title)]; const a = normArabic(r.arabic); if (a.length >= 3) out.push('t:' + a); return out; };
const clean = v => v == null ? '' : String(v).replace(/\u0000/g, '').trim();

export function analyze(rows, existing = []) {
  const res = { total: 0, items: [], errors: [], fatal: null, valid: 0, bad: 0, dup: 0, withReminder: 0 };
  if (!rows.length) { res.fatal = 'Berkas kosong. Isi data di lembar "' + SHEET + '" mulai baris 2.'; return res; }
  const map = {};
  (rows[0].cells || []).forEach((c, i) => { const k = ALIAS[key(c)]; if (k && !(k in map)) map[k] = i; });
  const need = HEADERS.filter(([, , req]) => req).map(([k]) => k).filter(k => !(k in map));
  if (need.length) { res.fatal = 'Kolom wajib tidak ditemukan di baris 1: ' + need.join(', ') + '. Gunakan template Amalan Sunnah dan jangan ubah nama kolom.'; return res; }
  const body = rows.slice(1).filter(r => (r.cells || []).some(c => clean(c) !== ''));
  if (!body.length) { res.fatal = 'Berkas tidak berisi data. Isi amalan mulai baris 2 pada lembar "' + SHEET + '".'; return res; }
  if (body.length > LIMIT.rows) { res.fatal = 'Jumlah baris (' + body.length + ') melebihi batas ' + LIMIT.rows + ' per berkas. Bagi menjadi beberapa berkas.'; return res; }
  const seen = new Map(); for (const e of existing) for (const k of dupKeys(e)) if (!seen.has(k)) seen.set(k, 'sudah ada di database');
  for (const row of body) {
    const g = k => (k in map ? clean(row.cells[map[k]]) : ''); const rn = row.r, errs = [], it = { row: rn, status: 'valid' }; res.total++;
    const len = (k, v, min, max, nm, req) => { if (req && v.length < min) errs.push([k, nm + (v ? ' terlalu pendek (min. ' + min + ' huruf).' : ' wajib diisi.')]); else if (v.length > max) errs.push([k, nm + ' terlalu panjang (maks. ' + max + ' huruf).']); };
    const slot = slotBy.get(key(g('waktu')));
    if (!g('waktu')) errs.push(['waktu', 'Waktu wajib diisi.']); else if (!slot) errs.push(['waktu', 'Waktu tidak dikenali: ' + g('waktu').slice(0, 30) + '.']);
    const f = { time_slot: slot || '', title: g('judul_amalan'), body: g('penjelasan'), arabic: g('teks_arab'), latin: g('teks_latin'), source: g('sumber'), grading: g('penilai_derajat'), note: g('keterangan'), sort_order: 100 };
    len('judul_amalan', f.title, 3, 150, 'Judul', true); len('penjelasan', f.body, 10, 4000, 'Penjelasan', true);
    len('teks_arab', f.arabic, 0, 4000, 'Teks Arab'); len('teks_latin', f.latin, 0, 4000, 'Teks Latin');
    len('sumber', f.source, 3, 500, 'Sumber', true); len('penilai_derajat', f.grading, 3, 500, 'Keterangan derajat', true); len('keterangan', f.note, 0, 1000, 'Keterangan');
    const gr = g('derajat_hadis'), gk = gradeBy.get(key(gr));
    if (!gr) errs.push(['derajat_hadis', 'Derajat hadis wajib diisi.']); else if (!gk) errs.push(['derajat_hadis', 'Derajat "' + gr.slice(0, 30) + '" tidak diterima (hanya Shahih atau Hasan).']); else f.grade = gk;
    const rm = g('terkait_pengingat');
    if (rm) { const rk = remBy.get(key(rm)); if (!rk) errs.push(['terkait_pengingat', 'Pengingat tidak dikenali: ' + rm.slice(0, 40) + '. Lihat daftar di lembar Petunjuk, atau kosongkan.']); else f.reminder_key = rk; }
    if (errs.length) { it.status = 'error'; it.errors = errs; res.bad++; for (const [col, msg] of errs) res.errors.push({ row: rn, col, msg }); }
    else {
      const keys = dupKeys(f); let why = null; for (const k of keys) if (seen.has(k)) { why = seen.get(k); break; }
      if (why) { it.status = 'dup'; res.dup++; res.errors.push({ row: rn, col: '', msg: 'Data diduga sudah ada (' + why + ').', dup: true }); }
      else { for (const k of keys) seen.set(k, 'sama dengan baris ' + rn); res.valid++; if (f.reminder_key) res.withReminder++; }
    }
    it.f = f; res.items.push(it);
  }
  return res;
}
// withRem: sertakan kolom reminder_key (semua baris harus punya kunci yang sama untuk impor massal).
export function toPayload(f, withRem) {
  const o = { time_slot: f.time_slot, title: f.title, body: f.body, arabic: f.arabic || null, latin: f.latin || null, source: f.source, grade: f.grade, grading: f.grading, note: f.note || null, sort_order: f.sort_order };
  if (withRem) o.reminder_key = f.reminder_key || null;
  return o;
}
