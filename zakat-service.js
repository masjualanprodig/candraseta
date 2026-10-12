// BAITUNA - zakat-service.js
// Kalkulator Zakat: perhitungan murni (tanpa jaringan). Angka kekayaan TIDAK disimpan; hanya pengaturan (harga emas/perak, pilihan metode).
// Alat bantu hitung, bukan fatwa. Pendapat ulama berbeda di beberapa hal; hasil selalu disertai catatan sesuai pilihan pengguna.
import { hijriOf } from './islamic-calendar.js';

export const KEY = 'baituna.zakat.v1';
export const NISAB_EMAS_GRAM = 85, NISAB_PERAK_GRAM = 595, RATE = 0.025;
// Masehi vs Hijriah: 2,5% untuk tahun Hijriah; sebagian lembaga memakai 2,5775% bila patokan haul tahun Masehi.
export const RATE_MASEHI = 0.025775;
export const MAX_RP = 1e15, MAX_GRAM = 1e6;
// Nilai rujukan BAZNAS dikutip dari pemberitaan (hukumonline.com), BELUM dicek ke dokumen resmi. Pengguna diminta memeriksa di baznas.go.id.
export const BAZNAS_REF = { year: 2026, tahun: 91681728, bulan: 7640144, sk: 'Keputusan Ketua BAZNAS No. 15 Tahun 2026', verified: false };

/* ---------- membaca angka ---------- */
// Rupiah: hanya angka yang dipakai ("1.500.000", "1,500,000", "Rp 1500000" -> 1500000).
export function parseRp(s) {
  if (typeof s === 'number') return Number.isFinite(s) && s >= 0 ? Math.min(Math.round(s), MAX_RP) : 0;
  const d = String(s == null ? '' : s).replace(/[^\d]/g, '');
  if (!d) return 0;
  return Math.min(Number(d.slice(0, 16)), MAX_RP);
}
// Gram: boleh desimal ("85", "85,5", "85.5").
export function parseGram(s) {
  if (typeof s === 'number') return Number.isFinite(s) && s >= 0 ? Math.min(s, MAX_GRAM) : 0;
  const t = String(s == null ? '' : s).trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d*\.?\d*$/.test(t) || t === '' || t === '.') return 0;
  const n = Number(t);
  return Number.isFinite(n) ? Math.min(n, MAX_GRAM) : 0;
}
export const rp = n => 'Rp ' + Math.round(Number.isFinite(n) ? n : 0).toLocaleString('id-ID');
export const fmtNum = n => (n ? Math.round(n).toLocaleString('id-ID') : '');
export const gram = n => (Math.round(n * 100) / 100).toLocaleString('id-ID') + ' gram';

/* ---------- nisab ---------- */
export const nisabEmas = price => (price > 0 ? NISAB_EMAS_GRAM * price : 0);
export const nisabPerak = price => (price > 0 ? NISAB_PERAK_GRAM * price : 0);
// Nisab penghasilan per tahun: nilai BAZNAS yang diisi pengguna bila ada, jika tidak 85 gram emas x harga emas.
export const nisabPenghasilanTahun = (goldPrice, override) => (override > 0 ? override : nisabEmas(goldPrice));

/* ---------- zakat maal ---------- */
export const MAAL_FIELDS = ['cash', 'goldGram', 'jewelWornGram', 'silverGram', 'securities', 'receivable', 'trade', 'other', 'debt'];

// input: angka (cash/securities/receivable/trade/other/debt dalam Rp; goldGram/jewelWornGram/silverGram dalam gram)
// opts: { gold, silver (harga per gram), jewel: 'exclude'|'include', debt: boolean, haul: 'yes'|'no'|'unsure' }
export function maal(input, opts) {
  const i = {}; for (const k of MAAL_FIELDS) i[k] = Math.max(0, Number(input && input[k]) || 0);
  const o = opts || {};
  const gold = Number(o.gold) > 0 ? Number(o.gold) : 0, silver = Number(o.silver) > 0 ? Number(o.silver) : 0;
  const jewel = o.jewel === 'include' ? 'include' : 'exclude', deductDebt = o.debt !== false;
  const haul = ['yes', 'no', 'unsure'].includes(o.haul) ? o.haul : 'unsure';
  const nisab = nisabEmas(gold);
  const problems = [];
  if (!gold && (i.goldGram || i.jewelWornGram)) problems.push('Harga emas belum diisi, jadi emas tidak bisa dinilai dan nisab belum bisa dihitung.');
  if (!silver && i.silverGram) problems.push('Harga perak belum diisi, jadi perak tidak ikut dihitung.');
  const goldValue = gold ? i.goldGram * gold : 0;
  const silverValue = silver ? i.silverGram * silver : 0;
  const base = i.cash + goldValue + silverValue + i.securities + i.receivable + i.trade + i.other;
  const wornValue = gold ? i.jewelWornGram * gold : 0;
  const build = incl => {
    const gross = base + (incl ? wornValue : 0);
    const debt = deductDebt ? Math.min(i.debt, gross) : 0;
    const net = gross - debt;
    return { gross, debt, net, zakat: Math.round(net * RATE) };
  };
  const main = build(jewel === 'include'), other = build(jewel !== 'include');
  const rows = [
    ['Uang tunai, tabungan, deposito', i.cash], ['Emas simpanan/investasi', goldValue], ['Perak', silverValue],
    ['Saham, reksa dana, surat berharga', i.securities], ['Piutang lancar', i.receivable], ['Aset usaha dagang', i.trade], ['Harta lain yang halal & berkembang', i.other],
    ...(jewel === 'include' ? [['Perhiasan emas yang dipakai (dihitung)', wornValue]] : [])
  ].filter(r => r[1] > 0);
  let status;
  if (!gold) status = 'no-price';
  else if (main.net < nisab) status = 'below';
  else if (haul === 'no') status = 'no-haul';
  else if (haul === 'yes') status = 'due';
  else status = 'due-unsure';
  const r = { status, nisab, rows, gross: main.gross, debt: main.debt, net: main.net, zakat: status === 'due' || status === 'due-unsure' ? main.zakat : 0, ifDue: main.zakat, problems, rate: RATE, haul, jewel, deductDebt, hasWorn: i.jewelWornGram > 0 && !!gold };
  if (r.hasWorn) {
    // pendapat yang berbeda tentang perhiasan yang dipakai wajar: tampilkan keduanya, jangan menyembunyikan salah satunya
    const otherReach = other.net >= nisab;
    r.altJewel = { jewel: jewel === 'include' ? 'exclude' : 'include', net: other.net, reach: otherReach, zakat: otherReach ? other.zakat : 0 };
  }
  if (i.debt > 0 && gold) {
    const noDebt = { net: main.gross, reach: main.gross >= nisab, zakat: main.gross >= nisab ? Math.round(main.gross * RATE) : 0 };
    r.altDebt = deductDebt ? { deduct: false, ...noDebt } : { deduct: true, net: Math.max(0, main.gross - Math.min(i.debt, main.gross)), reach: (main.gross - Math.min(i.debt, main.gross)) >= nisab, zakat: (main.gross - Math.min(i.debt, main.gross)) >= nisab ? Math.round((main.gross - Math.min(i.debt, main.gross)) * RATE) : 0 };
  }
  return r;
}

/* ---------- zakat penghasilan ---------- */
// input: { rutin (per bulan), tidakRutin (bulan ini bila period 'bulan'; setahun bila 'tahun'), kebutuhan (per bulan) }
// opts: { basis: 'bruto'|'neto', period: 'bulan'|'tahun', nisabTahun }
export function penghasilan(input, opts) {
  const x = input || {}, o = opts || {};
  const rutin = Math.max(0, Number(x.rutin) || 0), tidak = Math.max(0, Number(x.tidakRutin) || 0), need = Math.max(0, Number(x.kebutuhan) || 0);
  const basis = o.basis === 'neto' ? 'neto' : 'bruto', period = o.period === 'tahun' ? 'tahun' : 'bulan';
  const nisabYear = Number(o.nisabTahun) > 0 ? Number(o.nisabTahun) : 0;
  const mult = period === 'tahun' ? 12 : 1;
  const income = rutin * mult + tidak;
  const needs = basis === 'neto' ? need * mult : 0;
  const net = Math.max(0, income - needs);
  const nisab = nisabYear ? (period === 'tahun' ? nisabYear : nisabYear / 12) : 0;
  let status;
  if (!nisab) status = 'no-price';
  else if (net < nisab) status = 'below';
  else status = 'due';
  const zakat = status === 'due' ? Math.round(net * RATE) : 0;
  const out = { status, period, basis, income, needs, net, nisab, nisabYear, zakat, rate: RATE, needsExceed: basis === 'neto' && need * mult > income };
  if (period === 'bulan' && nisabYear) {
    // gambaran setahun bila penghasilan bulan ini berulang: untuk menjawab "kalau tiap bulan belum cukup, bagaimana?"
    const yIncome = income * 12, yNeeds = needs * 12, yNet = Math.max(0, yIncome - yNeeds);
    out.yearView = { income: yIncome, net: yNet, reach: yNet >= nisabYear, zakat: yNet >= nisabYear ? Math.round(yNet * RATE) : 0 };
  }
  return out;
}

/* ---------- haul ---------- */
// Tanggal Masehi (y,m,d) saat satu tahun Hijriah berlalu sejak tanggal mulai. null bila peramban tidak mendukung kalender Hijriah.
export function haulDate(y, m, d) {
  const start = hijriOf(y, m, d); if (!start) return null;
  const base = Date.UTC(y, m - 1, d, 12);
  for (const day of [d, d - 1]) for (let k = 348; k <= 362; k++) {
    const t = new Date(base + k * 86400000), hj = hijriOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
    if (hj && hj.y === start.y + 1 && hj.m === start.m && hj.d === (day === d ? start.d : start.d - 1)) return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), hijri: hj, start };
  }
  return null;
}

/* ---------- pengaturan (hanya harga & pilihan; tanpa angka kekayaan) ---------- */
export const FITRAH_KG_DEFAULT = 2.5, MAX_JIWA = 999;
// Zakat fitrah: jiwa x takaran (kg beras) x harga beras. Takaran bawaan 2,5 kg hanyalah acuan umum; pengguna diminta mengikuti penetapan BAZNAS/Kemenag setempat.
export function fitrah(jiwa, kg, price) {
  const n = Math.min(MAX_JIWA, Math.max(0, Math.floor(Number(jiwa) || 0)));
  const k = Number(kg) > 0 ? Math.min(Number(kg), 10) : 0, p = Number(price) > 0 ? Number(price) : 0;
  const kgTotal = Math.round(n * k * 100) / 100;
  const perJiwa = Math.round(k * p);
  return { jiwa: n, kgPerJiwa: k, kgTotal, price: p, perJiwa, uang: n && k && p ? Math.round(n * k * p) : 0, status: !n ? 'empty' : !k ? 'no-kg' : !p ? 'no-price' : 'ok' };
}
export function summaryFitrah(r) {
  const L = ['Perkiraan Zakat Fitrah (alat bantu, bukan fatwa)', 'Jumlah jiwa: ' + r.jiwa, 'Takaran per jiwa: ' + r.kgPerJiwa + ' kg beras', 'Total beras: ' + r.kgTotal + ' kg'];
  if (r.uang) L.push('Harga beras: ' + rp(r.price) + ' per kg', 'Jika dibayar dengan uang: ' + rp(r.uang) + ' (' + rp(r.perJiwa) + ' per jiwa)');
  L.push('Ikuti penetapan BAZNAS/Kemenag setempat dan tanyakan ke amil/ustaz.'); return L.join('\n');
}
export const defaults = () => ({ v: 1, gold: 0, silver: 0, nisabYear: 0, basis: 'bruto', period: 'bulan', jewel: 'exclude', debt: true, rice: 0, riceKg: FITRAH_KG_DEFAULT });
export function sanitize(o) {
  const d = defaults(); if (!o || typeof o !== 'object') return d;
  const n = v => (Number.isFinite(v) && v >= 0 && v <= MAX_RP ? Math.round(v) : 0);
  d.gold = n(o.gold); d.silver = n(o.silver); d.nisabYear = n(o.nisabYear); d.rice = n(o.rice);
  if (Number.isFinite(o.riceKg) && o.riceKg > 0 && o.riceKg <= 10) d.riceKg = Math.round(o.riceKg * 100) / 100;
  if (o.basis === 'neto') d.basis = 'neto';
  if (o.period === 'tahun') d.period = 'tahun';
  if (o.jewel === 'include') d.jewel = 'include';
  if (o.debt === false) d.debt = false;
  return d;
}
export function load() { try { return sanitize(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { return defaults(); } }
export function save(s) { try { localStorage.setItem(KEY, JSON.stringify(sanitize(s))); return true; } catch { return false; } }

/* ---------- ringkasan teks untuk disalin ---------- */
export function summaryMaal(r) {
  const L = ['Perkiraan Zakat Maal (alat bantu, bukan fatwa)'];
  for (const [n, v] of r.rows) L.push('- ' + n + ': ' + rp(v));
  L.push('Total harta: ' + rp(r.gross)); if (r.debt) L.push('Utang jatuh tempo dikurangkan: ' + rp(r.debt));
  L.push('Harta bersih: ' + rp(r.net), 'Nisab (85 gram emas): ' + rp(r.nisab));
  L.push(r.status === 'below' ? 'Belum mencapai nisab: belum wajib zakat maal.' : r.status === 'no-haul' ? 'Mencapai nisab tetapi belum genap satu tahun (haul): belum wajib. Jika haul tercapai: ' + rp(r.ifDue) : (r.status === 'due-unsure' ? 'Jika haul terpenuhi, ' : '') + 'Zakat 2,5%: ' + rp(r.zakat));
  L.push('Tanyakan ke amil/ustaz untuk kondisi khusus.'); return L.join('\n');
}
export function summaryPenghasilan(r) {
  const L = ['Perkiraan Zakat Penghasilan (alat bantu, bukan fatwa)', 'Metode: ' + (r.basis === 'neto' ? 'setelah kebutuhan pokok' : 'dari penghasilan kotor') + ', ' + (r.period === 'tahun' ? 'tahunan' : 'bulanan')];
  L.push('Penghasilan: ' + rp(r.income)); if (r.needs) L.push('Kebutuhan pokok: ' + rp(r.needs));
  L.push('Dasar hitung: ' + rp(r.net), 'Nisab: ' + rp(r.nisab));
  L.push(r.status === 'due' ? 'Zakat 2,5%: ' + rp(r.zakat) : 'Belum mencapai nisab pada metode ini.'); L.push('Tanyakan ke amil/ustaz untuk kondisi khusus.'); return L.join('\n');
}
