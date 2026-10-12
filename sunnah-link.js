// BAITUNA - sunnah-link.js
// Penghubung fitur: Notifikasi dan Kalender mengambil KETERANGAN, SUMBER, dan DERAJAT amalan dari data
// "Amalan Sunnah Harian" yang diisi Super Admin (kolom reminder_key), bukan dari tulisan di kode.
// Bila admin belum mengisi, aplikasi memakai keterangan umum dan menandainya dengan jelas.
import { listSunnah, SLOTS } from './sunnah-service.js';

// Kode yang bisa dipilih admin pada amalan (harus sama dengan check di sunnah_link.sql).
export const REMINDER_KEYS = {
  puasa_senin_kamis: 'Puasa Senin dan Kamis',
  puasa_ayyamul_bidh: 'Puasa Ayyamul Bidh',
  puasa_arafah: 'Puasa Arafah',
  puasa_tasua_asyura: 'Puasa Tasu’a dan Asyura',
  puasa_syawal: 'Puasa 6 hari Syawal',
  puasa_ramadan: 'Puasa Ramadan',
  puasa_muharram: 'Puasa di bulan Muharram',
  puasa_syaban: 'Puasa di bulan Syaban',
  puasa_zulhijah: 'Sepuluh hari pertama Zulhijah',
  salat_dhuha: 'Salat Dhuha',
  salat_tahajud: 'Salat Tahajud',
  salat_gerhana: 'Salat gerhana',
  salat_id: 'Salat Id (Idulfitri dan Iduladha)',
  malam_ganjil: 'Malam ganjil sepuluh malam terakhir Ramadan',
  hari_jumat: 'Hari Jumat'
};

// Kode item aplikasi -> reminder_key. Item yang tidak ada di sini (mis. hari dilarang berpuasa) tidak punya rujukan.
const MAP = { senin: 'puasa_senin_kamis', kamis: 'puasa_senin_kamis', ayyamul_bidh: 'puasa_ayyamul_bidh', arafah: 'puasa_arafah', tasua: 'puasa_tasua_asyura', asyura: 'puasa_tasua_asyura',
  syawal6: 'puasa_syawal', ramadan: 'puasa_ramadan', muharram: 'puasa_muharram', syaban: 'puasa_syaban', zulhijah: 'puasa_zulhijah', dhuha: 'salat_dhuha', tahajud: 'salat_tahajud',
  gerhana: 'salat_gerhana', gerhana_tidak: 'salat_gerhana', id_fitri: 'salat_id', id_adha: 'salat_id', malam_ganjil: 'malam_ganjil', jumat: 'hari_jumat' };
export const rkeyOf = itemKey => MAP[itemKey] || null;

// Pengelompokan: { byKey: {reminder_key: [item,...]}, bySlot: {time_slot: [item,...]}, all }
export function indexItems(items) {
  const byKey = {}, bySlot = {};
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || typeof it !== 'object') continue;
    if (it.reminder_key && REMINDER_KEYS[it.reminder_key]) (byKey[it.reminder_key] = byKey[it.reminder_key] || []).push(it);
    if (SLOTS[it.time_slot]) (bySlot[it.time_slot] = bySlot[it.time_slot] || []).push(it);
  }
  return { byKey, bySlot, all: Array.isArray(items) ? items : [] };
}
export const refsFor = (idx, rkey, max = 2) => (idx && rkey && idx.byKey[rkey] ? idx.byKey[rkey].slice(0, max) : []);

// Potong keterangan agar ringkas di daftar notifikasi (isi lengkap ada di Amalan Sunnah Harian).
export const brief = (s, n = 240) => { const t = String(s || '').trim(); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t; };

// Cache dalam memori (tidak ditulis ke perangkat). Kembali ke daftar kosong bila gagal.
let cache = null, at = 0;
export const clearLinks = () => { cache = null; at = 0; };
export function loadLinks(ttl = 10 * 60e3) {
  if (cache && Date.now() - at < ttl) return cache;
  const p = listSunnah().then(indexItems).catch(() => { if (cache === p) { cache = null; } return indexItems([]); });
  cache = p; at = Date.now(); return p;
}

// Titik waktu (anchor) pengingat tiap kelompok waktu. Hanya penanda awal; aplikasi tidak menetapkan batas waktu ibadah.
// mo = hasil prayerMoments; dhuhaStart dipakai bersama Jadwal Salat.
export function slotAnchors(mo, dhuhaStart) {
  const a = { subuh: mo.fajr, pagi: mo.sunrise, dhuha: dhuhaStart, siang: mo.dhuhr, sore: mo.asr, malam: mo.maghrib, tidur: mo.isha };
  return a;
}
export const SLOT_ORDER = ['subuh', 'pagi', 'dhuha', 'siang', 'sore', 'malam', 'tidur'];
