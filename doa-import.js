// BAITUNA - doa-import.js
// Impor banyak doa dari berkas Excel (.xlsx). Murni (tanpa DOM, tanpa jaringan) agar bisa diuji terpisah.
// - Pembaca .xlsx buatan sendiri di atas zip + DecompressionStream bawaan peramban: tanpa pustaka luar.
// - Rumus TIDAK pernah dihitung: hanya nilai tersimpan di sel yang dibaca, sebagai teks.
// - Tidak ada teks doa/sumber/derajat yang dibuat di sini. Contoh pada template hanya penanda (placeholder).
// - Validasi mencerminkan batasan tabel duas (doa.sql); nilai yang tidak dikenali dilaporkan, bukan diubah diam-diam.
import { CATS, GRADES } from './doa-service.js';

export const LIMIT = { bytes: 2 * 1024 * 1024, rows: 1000, unzipped: 20 * 1024 * 1024, files: 200 };
export const HEADERS = [
  ['kategori_doa', 'Kategori doa', true], ['judul_doa', 'Judul doa', false], ['teks_arab', 'Teks Arab', true],
  ['teks_latin', 'Teks Latin', false], ['terjemahan_indonesia', 'Terjemahan Indonesia', true], ['sumber_hadis', 'Sumber hadis', true],
  ['derajat_hadis', 'Derajat hadis', true], ['penilai_derajat', 'Nama penilai derajat', true], ['keterangan', 'Keterangan', false],
  ['jenis_sumber', 'Jenis sumber (hadits/ayat)', false], ['surat', 'Nomor surat (khusus ayat)', false], ['ayat_awal', 'Ayat awal (khusus ayat)', false], ['ayat_akhir', 'Ayat akhir (khusus ayat)', false]];

/* ===== util ===== */
const enc = new TextEncoder(), dec = new TextDecoder('utf-8');
const u16 = (b, o) => b[o] | (b[o + 1] << 8), u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
export const fmtSize = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1).replace('.', ',') + ' KB' : (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const xmlUnesc = s => s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (m, g) => {
  if (g === 'amp') return '&'; if (g === 'lt') return '<'; if (g === 'gt') return '>'; if (g === 'quot') return '"'; if (g === 'apos') return "'";
  const n = g[1] === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
  return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
});
const colName = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const colIndex = ref => { const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return -1; let n = 0; for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };

/* ===== zip: baca ===== */
async function inflateRaw(data, cap) {
  const ds = new DecompressionStream('deflate-raw');
  const w = ds.writable.getWriter(); w.write(data).catch(() => {}); w.close().catch(() => {});
  const rd = ds.readable.getReader(), parts = []; let total = 0;
  for (;;) {
    const { value, done } = await rd.read(); if (done) break;
    total += value.length; if (total > cap) { try { await rd.cancel(); } catch (e) {} throw new Error('Isi berkas terlalu besar setelah dibuka.'); }
    parts.push(value);
  }
  const out = new Uint8Array(total); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
export function zipEntries(bytes) {
  if (bytes.length < 22 || u32(bytes, 0) !== 0x04034b50) throw new Error('Berkas bukan Excel (.xlsx) yang valid.');
  let e = -1; for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (u32(bytes, i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('Berkas rusak atau bukan Excel (.xlsx).');
  const n = u16(bytes, e + 10); let p = u32(bytes, e + 16); const out = new Map();
  if (n > LIMIT.files) throw new Error('Berkas Excel tidak wajar (terlalu banyak bagian).');
  for (let i = 0; i < n; i++) {
    if (p + 46 > bytes.length || u32(bytes, p) !== 0x02014b50) throw new Error('Berkas rusak atau bukan Excel (.xlsx).');
    const nl = u16(bytes, p + 28), el = u16(bytes, p + 30), cl = u16(bytes, p + 32);
    out.set(dec.decode(bytes.subarray(p + 46, p + 46 + nl)), { method: u16(bytes, p + 10), csize: u32(bytes, p + 20), usize: u32(bytes, p + 24), off: u32(bytes, p + 42) });
    p += 46 + nl + el + cl;
  }
  return out;
}
async function zipRead(bytes, ents, name, cap) {
  const en = ents.get(name); if (!en) return null;
  if (en.usize > cap) throw new Error('Isi berkas terlalu besar setelah dibuka.');
  const o = en.off; if (o + 30 > bytes.length || u32(bytes, o) !== 0x04034b50) throw new Error('Berkas rusak.');
  const s = o + 30 + u16(bytes, o + 26) + u16(bytes, o + 28), raw = bytes.subarray(s, s + en.csize);
  if (en.method === 0) return raw;
  if (en.method === 8) return inflateRaw(raw, cap);
  throw new Error('Cara kompresi berkas tidak didukung.');
}

/* ===== xlsx: baca ===== */
const textOf = s => { let t = ''; const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g; let m; while ((m = re.exec(s))) t += m[1]; return xmlUnesc(t); };
function parseShared(xml) { const out = []; const re = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g; let m; while ((m = re.exec(xml))) out.push(textOf(m[1])); return out; }
function parseSheet(xml, shared) {
  const rows = []; const reRow = /<row\b([^>]*)>([\s\S]*?)<\/row>/g; let m, auto = 0;
  while ((m = reRow.exec(xml))) {
    const rn = /\br="(\d+)"/.exec(m[1]); const r = rn ? Number(rn[1]) : auto + 1; auto = r;
    if (r > 20000) break;
    const cells = []; const reC = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let c, idx = 0;
    while ((c = reC.exec(m[2]))) {
      const at = c[1], ref = /\br="([A-Z]+\d+)"/.exec(at), ty = /\bt="([^"]*)"/.exec(at);
      const ci = ref ? colIndex(ref[1]) : idx; idx = ci + 1; if (ci < 0 || ci > 60) continue;
      const body = c[2] || ''; let val = '';
      const v = /<v>([\s\S]*?)<\/v>/.exec(body), t = ty ? ty[1] : 'n';
      if (t === 'inlineStr') val = textOf(body);
      else if (t === 's') val = v ? (shared[Number(v[1])] || '') : '';
      else if (t === 'e') val = '';
      else if (t === 'b') val = v ? (v[1] === '1' ? 'TRUE' : 'FALSE') : '';
      else val = v ? xmlUnesc(v[1]) : '';
      cells[ci] = val;
    }
    rows.push({ r, cells });
  }
  return rows;
}
// Mengembalikan { rows: [{r, cells:[]}], sheet } dari berkas .xlsx. Rumus tidak dihitung.
export async function readXlsx(bytes, prefer = 'doa') {
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
  if (bytes.length > LIMIT.bytes) throw new Error('Ukuran berkas melebihi ' + fmtSize(LIMIT.bytes) + '.');
  const ents = zipEntries(bytes);
  if (!ents.has('xl/workbook.xml')) throw new Error('Berkas bukan Excel (.xlsx) yang valid.');
  const T = async n => { const b = await zipRead(bytes, ents, n, LIMIT.unzipped); return b ? dec.decode(b) : null; };
  const wb = await T('xl/workbook.xml'), rels = (await T('xl/_rels/workbook.xml.rels')) || '';
  const sheets = []; const reS = /<sheet\b([^>]*)\/?>/g; let m;
  while ((m = reS.exec(wb))) { const nm = /\bname="([^"]*)"/.exec(m[1]), id = /\br:id="([^"]*)"/.exec(m[1]); if (nm && id) sheets.push({ name: xmlUnesc(nm[1]), rid: id[1] }); }
  if (!sheets.length) throw new Error('Berkas Excel tidak berisi lembar kerja.');
  const pick = sheets.find(s => s.name.trim().toLowerCase() === prefer) || sheets[0];
  let target = null; const reR = /<Relationship\b([^>]*)\/?>/g;
  while ((m = reR.exec(rels))) { const id = /\bId="([^"]*)"/.exec(m[1]), tg = /\bTarget="([^"]*)"/.exec(m[1]); if (id && tg && id[1] === pick.rid) target = tg[1]; }
  if (!target) throw new Error('Lembar kerja tidak ditemukan di berkas.');
  const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
  const sx = await T(path); if (sx == null) throw new Error('Lembar kerja tidak ditemukan di berkas.');
  const ss = await T('xl/sharedStrings.xml');
  return { rows: parseSheet(sx, ss ? parseShared(ss) : []), sheet: pick.name };
}

/* ===== zip + xlsx: tulis (template) ===== */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zipWrite(files) {
  const chunks = [], cd = []; let off = 0;
  const w16 = n => [n & 255, (n >> 8) & 255], w32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  for (const [name, text] of files) {
    const nb = enc.encode(name), db = enc.encode(text), crc = crc32(db);
    const lh = new Uint8Array([...w32(0x04034b50), ...w16(20), ...w16(0x0800), ...w16(0), ...w16(0), ...w16(0x21), ...w32(crc), ...w32(db.length), ...w32(db.length), ...w16(nb.length), ...w16(0)]);
    chunks.push(lh, nb, db);
    cd.push(new Uint8Array([...w32(0x02014b50), ...w16(20), ...w16(20), ...w16(0x0800), ...w16(0), ...w16(0), ...w16(0x21), ...w32(crc), ...w32(db.length), ...w32(db.length), ...w16(nb.length), ...w16(0), ...w16(0), ...w16(0), ...w16(0), ...w32(0), ...w32(off)]), nb);
    off += lh.length + nb.length + db.length;
  }
  const cdLen = cd.reduce((a, b) => a + b.length, 0);
  const end = new Uint8Array([...w32(0x06054b50), ...w16(0), ...w16(0), ...w16(files.length), ...w16(files.length), ...w32(cdLen), ...w32(off), ...w16(0)]);
  const all = [...chunks, ...cd, end], out = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let o = 0;
  for (const b of all) { out.set(b, o); o += b.length; }
  return out;
}
const cell = (ci, r, text, s) => text === '' || text == null ? '' : '<c r="' + colName(ci) + r + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(text) + '</t></is></c>';
export function sheetXml(rows, { widths, validations, freeze }) {
  const rx = rows.map((row, i) => '<row r="' + (i + 1) + '">' + row.map((c, ci) => cell(ci, i + 1, c.t, c.s)).join('') + '</row>').join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + (freeze ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '')
    + '<cols>' + widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>'
    + '<sheetData>' + rx + '</sheetData>' + (validations || '') + '</worksheet>';
}
export const listVal = (sqref, items) => '<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Nilai tidak dikenali" error="Pilih salah satu nilai dari daftar." sqref="' + sqref + '"><formula1>"' + xmlEsc(items.join(',')) + '"</formula1></dataValidation>';
const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF0B5D4B"/><name val="Calibri"/></font></fonts>'
  + '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B5D4B"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCEFE8"/></patternFill></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="4"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"><alignment vertical="top" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0"><alignment vertical="center" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0"><alignment vertical="center" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

// Berkas template .xlsx (Uint8Array). Lembar "Doa" kosong (hanya judul kolom) agar contoh tidak ikut terimpor.
export function buildTemplate() {
  const head = HEADERS.map(([k, , req]) => ({ t: k, s: req ? 1 : 2 }));
  const labels = Object.values(CATS), grades = Object.values(GRADES);
  const doa = sheetXml([head], { widths: [20, 26, 40, 32, 40, 28, 16, 34, 28, 16, 14, 12, 12], freeze: true,
    validations: '<dataValidations count="3">' + listVal('A2:A1001', labels) + listVal('G2:G1001', grades) + listVal('J2:J1001', ['hadits', 'ayat']) + '</dataValidations>' });
  const ex = (a) => a.map(t => ({ t, s: 3 }));
  const contoh = sheetXml([head, ex([labels[0], '(judul doa)', '(tempel teks Arab di sini)', '(teks Latin, boleh kosong)', '(terjemahan bahasa Indonesia)', '(perawi dan nomor hadis, mis. HR. ... no. ...)', grades[0], '(nama ulama penilai + judul kitab + nomor)', '(catatan, boleh kosong)', 'hadits', '', '', '']),
    ex([labels[8], '(judul rujukan ayat)', '', '', '', '', '', '', '(catatan, boleh kosong)', 'ayat', '1', '1', '2'])], { widths: [20, 26, 40, 32, 40, 28, 16, 34, 28, 16, 14, 12, 12] });
  const tips = [
    ['PETUNJUK PENGISIAN (lembar ini tidak diimpor)'],
    ['1. Isi data hanya di lembar "Doa", mulai baris 2. Jangan mengubah nama kolom di baris 1. Lembar "Contoh" hanya gambaran bentuk isian.'],
    ['2. Kolom berwarna hijau tua WAJIB untuk doa dari hadis: kategori_doa, teks_arab, terjemahan_indonesia, sumber_hadis, derajat_hadis, penilai_derajat.'],
    ['3. kategori_doa: pilih dari daftar (' + labels.join(', ') + '). Nilai di luar daftar akan ditolak, tidak diubah otomatis.'],
    ['4. derajat_hadis: hanya ' + grades.join(' atau ') + '. Hadis lemah tidak boleh dimuat. penilai_derajat diisi siapa yang menilai dan di kitab apa.'],
    ['5. Aplikasi tidak menentukan derajat hadis. Isi sumber dan derajat hanya dari rujukan yang sudah Anda periksa, dan sebaiknya ditinjau ustaz.'],
    ['6. Untuk rujukan ayat Al-Qur\'an: isi jenis_sumber = ayat, lalu surat (1-114), ayat_awal, ayat_akhir (maks. 6 ayat berurutan), judul_doa, kategori_doa. Teks Arab, terjemahan, dan derajat DIKOSONGKAN (teks ayat diambil otomatis).'],
    ['7. Doa dari hadis: jenis_sumber boleh dikosongkan atau diisi hadits. Kolom surat/ayat_awal/ayat_akhir dikosongkan.'],
    ['8. Batas: maksimal ' + LIMIT.rows + ' baris dan ' + fmtSize(LIMIT.bytes) + ' per berkas. Format .xlsx (Google Sheets: Berkas > Unduh > Microsoft Excel). Rumus tidak dihitung; tulis nilai biasa.'],
    ['9. Data yang tampaknya sudah ada (teks Arab/judul sama) dilewati, tidak menimpa data lama.']].map(r => r.map(t => ({ t, s: 3 })));
  const petunjuk = sheetXml(tips, { widths: [140] });
  return buildWorkbook([['Doa', doa], ['Contoh', contoh], ['Petunjuk', petunjuk]]);
}
// Rakit berkas .xlsx dari daftar [nama lembar, xml lembar]. Dipakai juga oleh template impor lain (mis. Amalan Sunnah).
export function buildWorkbook(sheets) {
  return zipWrite([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + sheets.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map(([n], i) => '<sheet name="' + n + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', STYLES],
    ...sheets.map(([, x], i) => ['xl/worksheets/sheet' + (i + 1) + '.xml', x])]);
}

/* ===== normalisasi, pemetaan, validasi ===== */
const key = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ALIAS = { kategori: 'kategori_doa', kategoridoa: 'kategori_doa', judul: 'judul_doa', juduldoa: 'judul_doa', teksarab: 'teks_arab', arab: 'teks_arab', tekslatin: 'teks_latin', latin: 'teks_latin',
  terjemahanindonesia: 'terjemahan_indonesia', terjemahan: 'terjemahan_indonesia', sumberhadis: 'sumber_hadis', sumber: 'sumber_hadis', derajathadis: 'derajat_hadis', derajat: 'derajat_hadis',
  penilaiderajat: 'penilai_derajat', penilai: 'penilai_derajat', keterangan: 'keterangan', jenissumber: 'jenis_sumber', jenis: 'jenis_sumber', surat: 'surat', surah: 'surat', ayatawal: 'ayat_awal', ayatakhir: 'ayat_akhir' };
const catByName = (() => { const m = new Map(); for (const [k, l] of Object.entries(CATS)) { m.set(key(k), k); m.set(key(l), k); } return m; })();
const gradeByName = (() => { const m = new Map(); for (const [k, l] of Object.entries(GRADES)) { m.set(key(k), k); m.set(key(l), k); } return m; })();
// Teks Arab tanpa harakat/tatweel dan spasi berlebih, untuk deteksi duplikat.
export const normArabic = s => String(s || '').replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '').replace(/\s+/g, ' ').trim();
const normTitle = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
export const dupKeys = r => {
  const out = [];
  if (r.kind === 'ayat') out.push('a:' + r.surah + ':' + r.ayah_from + '-' + r.ayah_to);
  else if (r.arabic) out.push('t:' + normArabic(r.arabic));
  if (r.title && r.kind !== 'ayat') out.push('j:' + r.category + '|' + normTitle(r.title));
  return out;
};
const clean = v => v == null ? '' : String(v).replace(/\u0000/g, '').trim();
const intOf = s => /^\d{1,4}$/.test(s) ? Number(s) : (/^\d{1,4}\.0+$/.test(s) ? Number(s.split('.')[0]) : NaN);

// rows: hasil readXlsx().rows. existing: daftar doa di database. Mengembalikan ringkasan + baris bernilai.
export function analyze(rows, existing = []) {
  const res = { total: 0, items: [], errors: [], fatal: null, valid: 0, bad: 0, dup: 0 };
  if (!rows.length) { res.fatal = 'Berkas kosong. Isi data di lembar "Doa" mulai baris 2.'; return res; }
  const hr = rows[0], map = {};
  (hr.cells || []).forEach((c, i) => { const k = ALIAS[key(c)]; if (k && !(k in map)) map[k] = i; });
  const need = HEADERS.filter(([, , req]) => req).map(([k]) => k).filter(k => !(k in map));
  if (need.length) { res.fatal = 'Kolom wajib tidak ditemukan di baris 1: ' + need.join(', ') + '. Gunakan template dan jangan ubah nama kolom.'; return res; }
  const body = rows.slice(1).filter(r => (r.cells || []).some(c => clean(c) !== ''));
  if (!body.length) { res.fatal = 'Berkas tidak berisi data. Isi doa mulai baris 2 pada lembar "Doa".'; return res; }
  if (body.length > LIMIT.rows) { res.fatal = 'Jumlah baris (' + body.length + ') melebihi batas ' + LIMIT.rows + ' per berkas. Bagi menjadi beberapa berkas.'; return res; }
  const seen = new Map(); for (const e of existing) for (const k of dupKeys(e)) if (!seen.has(k)) seen.set(k, 'sudah ada di database');
  for (const row of body) {
    const g = k => clean(row.cells[map[k]]); const rn = row.r, errs = [], it = { row: rn, status: 'valid' }; res.total++;
    const jenisRaw = key(g('jenis_sumber')); let kind = 'teks';
    if (jenisRaw === '' || ['hadits', 'hadis', 'teks', 'doa'].includes(jenisRaw)) kind = 'teks';
    else if (['ayat', 'quran', 'alquran'].includes(jenisRaw)) kind = 'ayat'; else errs.push(['jenis_sumber', 'Jenis sumber tidak dikenali (isi hadits atau ayat).']);
    const cat = catByName.get(key(g('kategori_doa')));
    if (!g('kategori_doa')) errs.push(['kategori_doa', 'Kategori wajib diisi.']); else if (!cat) errs.push(['kategori_doa', 'Kategori tidak dikenali: ' + g('kategori_doa').slice(0, 40) + '.']);
    const f = { kind, category: cat || '', title: g('judul_doa'), note: g('keterangan'), source: g('sumber_hadis'), sort_order: 100 };
    const len = (k, v, max, nm) => { if (v.length > max) errs.push([k, nm + ' terlalu panjang (maks. ' + max + ' karakter).']); };
    len('judul_doa', f.title, 150, 'Judul'); len('keterangan', f.note, 1000, 'Keterangan'); len('sumber_hadis', f.source, 500, 'Sumber');
    if (kind === 'teks') {
      Object.assign(f, { arabic: g('teks_arab'), latin: g('teks_latin'), body: g('terjemahan_indonesia'), grading: g('penilai_derajat') });
      if (f.arabic.length < 3) errs.push(['teks_arab', 'Teks Arab wajib diisi.']); len('teks_arab', f.arabic, 4000, 'Teks Arab');
      len('teks_latin', f.latin, 4000, 'Teks Latin');
      if (f.body.length < 3) errs.push(['terjemahan_indonesia', 'Terjemahan wajib diisi.']); len('terjemahan_indonesia', f.body, 4000, 'Terjemahan');
      if (f.source.length < 3) errs.push(['sumber_hadis', 'Sumber hadis belum diisi.']);
      const gr = g('derajat_hadis'), gk = gradeByName.get(key(gr));
      if (!gr) errs.push(['derajat_hadis', 'Derajat hadis belum diisi.']); else if (!gk) errs.push(['derajat_hadis', 'Derajat "' + gr.slice(0, 30) + '" tidak diterima (hanya Shahih atau Hasan).']); else f.grade = gk;
      if (f.grading.length < 3) errs.push(['penilai_derajat', 'Nama penilai derajat belum diisi.']); len('penilai_derajat', f.grading, 500, 'Penilai derajat');
      if (g('surat') || g('ayat_awal') || g('ayat_akhir')) errs.push(['surat', 'Kolom surat/ayat hanya untuk jenis ayat.']);
    } else {
      const sr = intOf(g('surat')), a1 = intOf(g('ayat_awal')), a2 = g('ayat_akhir') === '' ? a1 : intOf(g('ayat_akhir'));
      if (!(sr >= 1 && sr <= 114)) errs.push(['surat', 'Nomor surat harus 1 sampai 114.']);
      if (!(a1 >= 1 && a1 <= 286)) errs.push(['ayat_awal', 'Ayat awal harus berupa angka 1 sampai 286.']);
      else if (!(a2 >= a1 && a2 <= 286)) errs.push(['ayat_akhir', 'Ayat akhir tidak boleh lebih kecil dari ayat awal.']);
      else if (a2 - a1 > 5) errs.push(['ayat_akhir', 'Maksimal 6 ayat berurutan.']);
      if (g('teks_arab') || g('teks_latin') || g('terjemahan_indonesia') || g('derajat_hadis') || g('penilai_derajat')) errs.push(['teks_arab', 'Untuk ayat, teks Arab, terjemahan, dan derajat dikosongkan.']);
      Object.assign(f, { surah: sr, ayah_from: a1, ayah_to: a2 });
    }
    if (errs.length) { it.status = 'error'; it.errors = errs; res.bad++; for (const [col, msg] of errs) res.errors.push({ row: rn, col, msg }); }
    else {
      const keys = dupKeys(f); let why = null; for (const k of keys) if (seen.has(k)) { why = seen.get(k); break; }
      if (why) { it.status = 'dup'; it.dupWhy = why; res.dup++; res.errors.push({ row: rn, col: '', msg: 'Data diduga sudah ada (' + why + ').', dup: true }); }
      else { for (const k of keys) seen.set(k, 'sama dengan baris ' + rn); res.valid++; }
    }
    it.f = f; res.items.push(it);
  }
  return res;
}
// Bidang yang dikirim ke database (tanpa kolom tambahan).
export function toPayload(f) {
  // Semua baris HARUS punya kunci yang sama: PostgREST menolak impor massal bila kunci antar-baris berbeda (PGRST102).
  const ayat = f.kind === 'ayat';
  return { kind: f.kind, category: f.category, title: f.title || null, note: f.note || null, sort_order: f.sort_order, source: f.source || null,
    arabic: ayat ? null : f.arabic, latin: ayat ? null : (f.latin || null), body: ayat ? null : f.body, grade: ayat ? null : f.grade, grading: ayat ? null : f.grading,
    surah: ayat ? f.surah : null, ayah_from: ayat ? f.ayah_from : null, ayah_to: ayat ? f.ayah_to : null };
}
// Laporan CSV (aman dari injeksi rumus saat dibuka di Excel).
const csvCell = s => { let v = String(s == null ? '' : s); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
export function reportCsv(res, skippedExtra = []) {
  const lines = [['baris', 'kolom', 'keterangan'].map(csvCell).join(',')];
  for (const e of res.errors) lines.push([e.row, e.col, e.msg].map(csvCell).join(','));
  for (const e of skippedExtra) lines.push([e.row, e.col || '', e.msg].map(csvCell).join(','));
  return '﻿' + lines.join('\r\n');
}
